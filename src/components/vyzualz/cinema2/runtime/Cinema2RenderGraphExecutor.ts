import type {
  Cinema2CapabilityId,
  Cinema2JsonValue,
  Cinema2LayerBlendMode,
  Cinema2LayerDepthPolicy,
  Cinema2LayerId,
  Cinema2ModuleId,
  Cinema2RenderAttachment,
  Cinema2RenderPassId,
  Cinema2RenderQualityLevel,
  Cinema2RenderSlotId,
  Cinema2RenderTargetId,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleFrameReadContext, Cinema2ModuleRenderPassProvider } from '../modules/Cinema2ModuleContracts'
import type { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import type { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import type { Cinema2FinalValueResolver, Cinema2TargetHandle } from '../parameters/Cinema2TargetRuntime'
import type {
  Cinema2CompiledRenderInput,
  Cinema2CompiledRenderPass,
  Cinema2CompiledRenderPlan,
} from '../render/Cinema2RenderGraph'
import type { Cinema2CompiledLayerDefinition, Cinema2CompiledSceneGraph } from '../scene/Cinema2SceneGraph'
import type { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import type { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentRuntime } from '../spatial/Cinema2LightingEnvironmentRuntime'
import {
  Cinema2ResourceManager,
  type Cinema2RenderTargetBinding,
  type Cinema2RenderTargetDescriptor,
  type Cinema2RenderTargetLease,
} from './Cinema2ResourceManager'
import { Cinema2Compositor } from './Cinema2Compositor'
import { assertCinema2NoGlErrors } from './Cinema2GpuValidation'

export interface Cinema2RenderGraphExecutorDiagnostic {
  code: string
  message: string
  passId: Cinema2RenderPassId | null
}

export interface Cinema2RenderVisibilityCheckpoint {
  stage: 'pass-target' | 'canvas'
  passId: Cinema2RenderPassId
  width: number
  height: number
  sampledWidth: number
  sampledHeight: number
  maxRgbByte: number | null
  rgbEnergyDetected: boolean | null
  error: string | null
}

export interface Cinema2RenderGraphExecutorSnapshot {
  disposed: boolean
  frameCount: number
  executedPassCount: number
  skippedPassCount: number
  failedPassCount: number
  activePersistentTargetCount: number
  lastExecutedPassIds: readonly Cinema2RenderPassId[]
  diagnostics: readonly Readonly<Cinema2RenderGraphExecutorDiagnostic>[]
  visibilityCheckpoints: readonly Readonly<Cinema2RenderVisibilityCheckpoint>[]
}

export interface Cinema2RenderGraphExecutorOptions {
  quality?: Cinema2RenderQualityLevel
  availableCapabilities?: Iterable<Cinema2CapabilityId>
  effectRuntime?: Cinema2EffectRuntime
  spatialRuntime?: Cinema2SpatialRuntime
  cameraRuntime?: Cinema2CameraRuntime
  lightingEnvironmentRuntime?: Cinema2LightingEnvironmentRuntime
  targetResolver?: Cinema2FinalValueResolver
  /** Explicit development/test-only sparse readback. Disabled by default. */
  debugVisibilityReadback?: boolean
}

interface TargetRecord {
  lease: Cinema2RenderTargetLease
  binding: Readonly<Cinema2RenderTargetBinding>
}

interface ProducedOutput {
  binding: Readonly<Cinema2RenderTargetBinding> | null
  valid: boolean
}

interface ResolvedRenderInput {
  id: Cinema2RenderSlotId
  attachment: Cinema2RenderAttachment
  texture: WebGLTexture
  width: number
  height: number
}

interface ResolvedLayerState {
  definition: Readonly<Cinema2CompiledLayerDefinition>
  visible: boolean
  opacity: number
  blendMode: Cinema2LayerBlendMode
  depthPolicy: Cinema2LayerDepthPolicy
}

const QUALITY_ORDER = Object.freeze({ low: 0, medium: 1, high: 2 } as const)

/**
 * Canonical Stage 07C executor. It consumes only immutable compiled plans and
 * engine-owned providers/resources; presets never receive framebuffer lifetime
 * or frame scheduling authority.
 */
export class Cinema2RenderGraphExecutor {
  private readonly persistentTargets = new Map<Cinema2RenderTargetId, TargetRecord>()
  private readonly targetHandles = new Map<Cinema2RenderTargetId, Readonly<Cinema2CompiledRenderPlan['targets'][number]>>()
  private readonly passById = new Map<Cinema2RenderPassId, Readonly<Cinema2CompiledRenderPass>>()
  private quality: Cinema2RenderQualityLevel
  private readonly availableCapabilities: ReadonlySet<Cinema2CapabilityId>
  private readonly effectRuntime: Cinema2EffectRuntime | null
  private readonly spatialRuntime: Cinema2SpatialRuntime | null
  private readonly cameraRuntime: Cinema2CameraRuntime | null
  private readonly lightingEnvironmentRuntime: Cinema2LightingEnvironmentRuntime | null
  private readonly targetResolver: Cinema2FinalValueResolver | null
  private readonly debugVisibilityReadback: boolean
  private readonly layerTargets = new Map<string, Readonly<Cinema2TargetHandle>>()
  private compositor: Cinema2Compositor | null = null
  private contextAvailable = true
  private diagnostics: Cinema2RenderGraphExecutorDiagnostic[] = []
  private frameCount = 0
  private executedPassCount = 0
  private skippedPassCount = 0
  private failedPassCount = 0
  private lastExecutedPassIds: Cinema2RenderPassId[] = []
  private visibilityCheckpoints: Cinema2RenderVisibilityCheckpoint[] = []
  private disposed = false
  private readonly frameBindings = new Map<WebGLTexture, Readonly<Cinema2RenderTargetBinding>>()

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly plan: Readonly<Cinema2CompiledRenderPlan>,
    private readonly scene: Readonly<Cinema2CompiledSceneGraph>,
    private readonly parameters: Cinema2ParameterState,
    private readonly resources: Cinema2ResourceManager,
    options: Cinema2RenderGraphExecutorOptions = {},
  ) {
    this.quality = options.quality ?? 'high'
    this.availableCapabilities = new Set(options.availableCapabilities ?? [])
    this.effectRuntime = options.effectRuntime ?? null
    this.spatialRuntime = options.spatialRuntime ?? null
    this.cameraRuntime = options.cameraRuntime ?? null
    this.lightingEnvironmentRuntime = options.lightingEnvironmentRuntime ?? null
    this.targetResolver = options.targetResolver ?? null
    this.debugVisibilityReadback = options.debugVisibilityReadback === true
    if (this.targetResolver) {
      for (const target of this.targetResolver.plan.targets) {
        if (target.kind === 'layer') this.layerTargets.set(`${target.ownerId}\u0000${target.property}`, target)
      }
    }
    for (const target of plan.targets) this.targetHandles.set(target.id, target)
    for (const pass of plan.passes) this.passById.set(pass.id, pass)
  }

  setQuality(quality: Cinema2RenderQualityLevel): void {
    this.quality = quality
  }

  executeFrame(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: readonly Readonly<Cinema2ModuleRenderPassProvider>[],
  ): void {
    if (this.disposed) return
    this.frameCount += 1
    this.diagnostics = []
    this.lastExecutedPassIds = []
    this.visibilityCheckpoints = []
    const transientTargets = new Map<Cinema2RenderTargetId, TargetRecord>()
    const produced = new Map<string, ProducedOutput>()
    const providerByModuleId = new Map(providers.map(provider => [provider.moduleId, provider] as const))
    let finalOutputSucceeded = false
    this.frameBindings.clear()
    for (const record of this.persistentTargets.values()) this.frameBindings.set(record.binding.colorTexture, record.binding)

    try {
      for (const passId of this.plan.passOrder) {
        const pass = this.passById.get(passId)
        if (!pass) continue
        if (!this.shouldExecute(pass)) {
          this.skippedPassCount += 1
          this.markOutputs(pass, produced, null, false)
          continue
        }
        if (!this.requiredInputsAvailable(pass, produced)) {
          this.skippedPassCount += 1
          this.markOutputs(pass, produced, null, false)
          this.pushDiagnostic('CINEMA2_RENDER_PASS_INPUT_UNAVAILABLE', 'Required upstream render input is unavailable; pass was skipped safely.', pass.id)
          continue
        }

        let target: TargetRecord | null = null
        try {
          target = this.resolvePassTarget(pass, transientTargets)
          const resolvedInputs = pass.inputs.map(input => ({ input, value: this.resolveInput(input, produced) }))
          const unavailableRequiredInput = resolvedInputs.find(entry => !entry.input.optional && entry.value == null)
          if (unavailableRequiredInput) {
            throw new Error(`Render input "${unavailableRequiredInput.input.id}" is unavailable in an executable form.`)
          }
          const inputs = resolvedInputs.map(entry => entry.value).filter((value): value is NonNullable<typeof value> => value != null)
          this.executePass(pass, frame, providerByModuleId, target?.binding ?? null, inputs)
          this.executedPassCount += 1
          this.lastExecutedPassIds.push(pass.id)
          this.markOutputs(pass, produced, target?.binding ?? null, true)
          if (target?.binding) this.captureVisibilityCheckpoint('pass-target', pass.id, target.binding, frame)
          if (pass.id === this.plan.outputPassId) {
            if (target?.binding) this.presentBinding(target.binding, frame)
            this.captureVisibilityCheckpoint('canvas', pass.id, null, frame)
            finalOutputSucceeded = true
          }
        } catch (error) {
          this.failedPassCount += 1
          this.markOutputs(pass, produced, null, false)
          this.restoreDefaultFramebuffer(frame)
          const message = errorMessage(error)
          this.pushDiagnostic(
            message.includes('resource budget exceeded') ? 'CINEMA2_RENDER_RESOURCE_BUDGET_EXCEEDED' : 'CINEMA2_RENDER_PASS_FAILED',
            message,
            pass.id,
          )
        }
      }
    } finally {
      for (const record of transientTargets.values()) this.resources.release(record.lease)
      this.resources.releaseTransient('cinema2.render-executor')
      this.frameBindings.clear()
      if (!finalOutputSucceeded) this.clearTarget(null, frame)
      this.restoreDefaultFramebuffer(frame)
    }
  }

  handleContextLost(): void {
    if (this.disposed) return
    this.frameBindings.clear()
    this.contextAvailable = false
    this.compositor?.dispose()
    this.compositor = null
  }

  handleContextRestored(): void {
    if (this.disposed) return
    this.contextAvailable = true
    this.rebindPersistentTargets()
  }

  getSnapshot(): Readonly<Cinema2RenderGraphExecutorSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      frameCount: this.frameCount,
      executedPassCount: this.executedPassCount,
      skippedPassCount: this.skippedPassCount,
      failedPassCount: this.failedPassCount,
      activePersistentTargetCount: this.persistentTargets.size,
      lastExecutedPassIds: Object.freeze([...this.lastExecutedPassIds]),
      diagnostics: Object.freeze(this.diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
      visibilityCheckpoints: Object.freeze(this.visibilityCheckpoints.map(checkpoint => Object.freeze({ ...checkpoint }))),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.persistentTargets.values()) this.resources.release(record.lease)
    this.persistentTargets.clear()
    this.resources.releaseOwner('cinema2.render-executor')
    this.compositor?.dispose()
    this.compositor = null
  }

  private rebindPersistentTargets(): void {
    for (const [targetId, record] of this.persistentTargets) {
      this.persistentTargets.set(targetId, { lease: record.lease, binding: this.resources.getRenderTargetBinding(record.lease) })
    }
  }

  private shouldExecute(pass: Readonly<Cinema2CompiledRenderPass>): boolean {
    const level = QUALITY_ORDER[this.quality]
    if (pass.quality?.min && level < QUALITY_ORDER[pass.quality.min]) return false
    if (pass.quality?.max && level > QUALITY_ORDER[pass.quality.max]) return false
    return pass.enabledWhen.every(condition => {
      if (condition.kind === 'capability-available') return this.availableCapabilities.has(condition.capability)
      const value = this.parameters.getValue(condition.parameterId)
      const equal = jsonEqual(value, condition.value)
      return condition.kind === 'parameter-equals' ? equal : !equal
    })
  }

  private requiredInputsAvailable(pass: Readonly<Cinema2CompiledRenderPass>, produced: ReadonlyMap<string, ProducedOutput>): boolean {
    return pass.inputs.every(input => input.optional || produced.get(outputKey(input.sourcePass.id, input.sourceOutputId))?.valid === true)
  }

  private resolvePassTarget(
    pass: Readonly<Cinema2CompiledRenderPass>,
    transientTargets: Map<Cinema2RenderTargetId, TargetRecord>,
  ): TargetRecord | null {
    const targetIds = [...new Set(pass.outputs.map(output => output.target?.id).filter((id): id is Cinema2RenderTargetId => id != null))]
    if (targetIds.length === 0) return null
    if (targetIds.length > 1) throw new Error(`Pass "${pass.id}" requires multiple framebuffer targets, which one draw call cannot bind safely.`)
    const targetId = targetIds[0]
    const handle = this.targetHandles.get(targetId)
    if (!handle) throw new Error(`Compiled render target "${targetId}" is unavailable.`)

    try {
      if (handle.ownership === 'persistent') {
        const existingPersistent = this.persistentTargets.get(targetId)
        if (existingPersistent) {
          const rebound = { lease: existingPersistent.lease, binding: this.resources.getRenderTargetBinding(existingPersistent.lease) }
          this.persistentTargets.set(targetId, rebound)
          this.frameBindings.set(rebound.binding.colorTexture, rebound.binding)
          return rebound
        }
        const lease = this.resources.acquireRenderTarget('cinema2.render-executor', handle.descriptor, 'persistent', {
          sampleableDepth: handle.sampleableDepth,
        })
        const created = { lease, binding: this.resources.getRenderTargetBinding(lease) }
        this.persistentTargets.set(targetId, created)
        this.frameBindings.set(created.binding.colorTexture, created.binding)
        return created
      }
      const existing = transientTargets.get(targetId)
      if (existing) return existing
      const lease = this.resources.acquireRenderTarget('cinema2.render-executor', handle.descriptor, 'transient', {
        sampleableDepth: handle.sampleableDepth,
      })
      const created = { lease, binding: this.resources.getRenderTargetBinding(lease) }
      transientTargets.set(targetId, created)
      this.frameBindings.set(created.binding.colorTexture, created.binding)
      return created
    } catch (error) {
      throw new Error(`Render target "${targetId}" for pass "${pass.id}" could not be resolved: ${errorMessage(error)}`)
    }
  }

  private resolveInput(input: Readonly<Cinema2CompiledRenderInput>, produced: ReadonlyMap<string, ProducedOutput>) {
    const source = produced.get(outputKey(input.sourcePass.id, input.sourceOutputId))
    if (!source?.valid || !source.binding) return null
    const texture = input.attachment === 'depth' ? source.binding.depthTexture : source.binding.colorTexture
    if (!texture) return null
    return Object.freeze({
      id: input.id,
      attachment: input.attachment,
      texture,
      width: source.binding.width,
      height: source.binding.height,
    })
  }

  private executePass(
    pass: Readonly<Cinema2CompiledRenderPass>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: ReadonlyMap<string, Readonly<Cinema2ModuleRenderPassProvider>>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
    inputs: readonly ResolvedRenderInput[],
  ): void {
    if (pass.effect) {
      if (!this.effectRuntime) throw new Error(`Render pass "${pass.id}" requires the Cinema 2.0 effect runtime.`)
      const colorInputs = inputs.filter(input => input.attachment === 'color')
      if (colorInputs.length !== 1) throw new Error(`Effect render pass "${pass.id}" requires exactly one executable color input.`)
      const result = this.effectRuntime.execute(pass.effect.id, {
        frame,
        input: colorInputs[0],
        inputs,
        target: target?.framebuffer ?? null,
        width: target?.width ?? frame.viewport.width,
        height: target?.height ?? frame.viewport.height,
      })
      if (result === 'applied') return
      this.blitFirstInput(colorInputs, target, frame)
      return
    }
    if (pass.kind === 'composite') {
      this.executeCompositePass(pass, inputs, target, frame)
      return
    }
    if (pass.kind === 'output') {
      const colorInputs = inputs.filter(input => input.attachment === 'color')
      if (colorInputs.length <= 1) this.blitFirstInput(colorInputs, target, frame)
      else this.executeCompositePass(pass, colorInputs, target, frame)
      return
    }
    if (pass.layers.length > 0) {
      this.executeLayeredCreativePass(pass, frame, providers, target, inputs)
      return
    }
    this.executeCreativeProviders(pass, frame, providers, target, inputs, pass.layers, null)
  }

  private executeCreativeProviders(
    pass: Readonly<Cinema2CompiledRenderPass>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: ReadonlyMap<string, Readonly<Cinema2ModuleRenderPassProvider>>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
    inputs: readonly ResolvedRenderInput[],
    layers: readonly Readonly<Cinema2CompiledRenderPass['layers'][number]>[],
    depthPolicy: Cinema2LayerDepthPolicy | null,
    preserveDepth = false,
  ): void {
    const moduleIds = this.resolvePassModuleIds(pass, layers)
    if (moduleIds.length === 0) {
      if (this.plan.intent === 'safe-clear') {
        this.clearTarget(target, frame)
        return
      }
      throw new Error(`Render pass "${pass.id}" has no reachable module render provider.`)
    }
    const passProviders = moduleIds.map(moduleId => {
      const provider = providers.get(moduleId)
      if (!provider) throw new Error(`No active render provider is bound for module "${moduleId}".`)
      return { moduleId, provider }
    })
    const hasWorldProvider = passProviders.some(entry => entry.provider.intent === 'world')
    if (hasWorldProvider) this.prepareWorldTarget(pass, target, preserveDepth)
    for (const { moduleId, provider } of passProviders) {
      this.prepareProviderState(provider.intent, depthPolicy)
      provider.execute({
        frame,
        target: target?.framebuffer ?? null,
        width: target?.width ?? frame.viewport.width,
        height: target?.height ?? frame.viewport.height,
        depthAvailable: hasDepthAttachment(target),
        spatialNodes: this.resolveSpatialNodesForModule(pass, moduleId, layers),
        camera: provider.intent === 'world' ? this.cameraRuntime?.getFrame() : undefined,
        lightingEnvironment: this.lightingEnvironmentRuntime?.getFrame(),
        inputs,
      })
    }
  }

  private prepareProviderState(
    intent: Readonly<Cinema2ModuleRenderPassProvider>['intent'],
    depthPolicy: Cinema2LayerDepthPolicy | null = null,
  ): void {
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.colorMask(true, true, true, true)
    if (intent === 'world') {
      this.gl.enable(this.gl.DEPTH_TEST)
      this.gl.depthFunc(this.gl.LEQUAL)
      this.gl.depthMask(depthPolicy !== 'read-only')
      return
    }
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.depthMask(false)
  }

  private executeLayeredCreativePass(
    pass: Readonly<Cinema2CompiledRenderPass>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: ReadonlyMap<string, Readonly<Cinema2ModuleRenderPassProvider>>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
    inputs: readonly ResolvedRenderInput[],
  ): void {
    const layers = this.resolvePassLayers(pass)
    const activeLayers = layers.filter(layer => layer.visible && layer.opacity > 0)
    if (activeLayers.length === 0) {
      this.requireCompositor().clear(target?.framebuffer ?? null, target?.width ?? frame.viewport.width, target?.height ?? frame.viewport.height)
      if (hasDepthAttachment(target)) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target!.framebuffer)
        this.gl.depthMask(true)
        this.gl.clearDepth(1)
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT)
      }
      return
    }

    let destination = target
    let internalDestinationLease: Cinema2RenderTargetLease | null = null
    const requiresDepth = activeLayers.some(layer => this.layerTargetDescriptor(pass, layer, providers).depthFormat !== 'none')
    if (!destination && requiresDepth) {
      internalDestinationLease = this.resources.acquireRenderTarget('cinema2.render-executor', {
        size: { kind: 'viewport' },
        colorFormat: 'rgba8',
        depthFormat: 'depth24',
        surfaceLayout: 'single',
      }, 'transient')
      destination = this.resources.getRenderTargetBinding(internalDestinationLease)
    }

    try {
      const direct = activeLayers.length === 1
        && layers.length === 1
        && activeLayers[0].opacity >= 1
        && activeLayers[0].blendMode === 'normal'
      if (direct) {
        const layer = activeLayers[0]
        this.executeCreativeProviders(pass, frame, providers, destination, inputs, [this.layerHandle(pass, layer.definition.id)], layer.depthPolicy)
        if (internalDestinationLease && pass.id === this.plan.outputPassId) this.presentBinding(destination!, frame)
        return
      }

      const destinationWidth = destination?.width ?? frame.viewport.width
      const destinationHeight = destination?.height ?? frame.viewport.height
      this.requireCompositor().clear(destination?.framebuffer ?? null, destinationWidth, destinationHeight)
      if (hasDepthAttachment(destination)) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, destination!.framebuffer)
        this.gl.depthMask(true)
        this.gl.clearDepth(1)
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT)
      }
      let copiedDepth = false

      for (const layer of activeLayers) {
        const layerHandle = this.layerHandle(pass, layer.definition.id)
        const descriptor = this.layerTargetDescriptor(pass, layer, providers)
        const lease = this.resources.acquireRenderTarget('cinema2.render-executor', descriptor, 'transient')
        const binding = this.resources.getRenderTargetBinding(lease)
        try {
          this.clearLayerTarget(binding, frame, layer)
          const preserveDepth = layer.depthPolicy !== 'disabled' && hasDepthAttachment(binding) && hasDepthAttachment(destination)
          if (preserveDepth) this.copyDepth(destination!, binding)
          this.executeCreativeProviders(pass, frame, providers, binding, inputs, [layerHandle], layer.depthPolicy, preserveDepth)
          this.requireCompositor().draw({ texture: binding.colorTexture, opacity: layer.opacity, blendMode: layer.blendMode }, destination?.framebuffer ?? null, destinationWidth, destinationHeight)
          if (layer.depthPolicy === 'read-write' && hasDepthAttachment(binding) && hasDepthAttachment(destination)) {
            this.copyDepth(binding, destination!)
            copiedDepth = true
          }
        } finally {
          this.resources.release(lease)
        }
      }

      if (hasDepthAttachment(destination) && !copiedDepth) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, destination!.framebuffer)
        this.gl.depthMask(true)
        this.gl.clearDepth(1)
        this.gl.clear(this.gl.DEPTH_BUFFER_BIT)
      }
      if (internalDestinationLease && pass.id === this.plan.outputPassId) this.presentBinding(destination!, frame)
    } finally {
      if (internalDestinationLease) this.resources.release(internalDestinationLease)
    }
  }

  private executeCompositePass(
    pass: Readonly<Cinema2CompiledRenderPass>,
    inputs: readonly ResolvedRenderInput[],
    target: Readonly<Cinema2RenderTargetBinding> | null,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    const colorInputs = inputs.filter(input => input.attachment === 'color')
    const width = target?.width ?? frame.viewport.width
    const height = target?.height ?? frame.viewport.height
    this.requireCompositor().clear(target?.framebuffer ?? null, width, height)
    if (colorInputs.length === 0) return

    const authoredLayers = pass.layers
      .map(handle => this.scene.layers[handle.index])
      .filter((definition): definition is Readonly<Cinema2CompiledLayerDefinition> => definition != null)
      .map(definition => this.resolveLayerState(definition))
    const declaredColorInputs = pass.inputs.filter(input => input.attachment === 'color')
    const layerByInputId = new Map<Cinema2RenderSlotId, ResolvedLayerState>()
    if (authoredLayers.length === declaredColorInputs.length) {
      declaredColorInputs.forEach((input, index) => layerByInputId.set(input.id, authoredLayers[index]))
    }
    const sources = colorInputs.map((input, index) => ({
      input,
      layer: layerByInputId.get(input.id) ?? null,
      sourceIndex: index,
    }))
    if (layerByInputId.size > 0) {
      sources.sort((left, right) => {
        if (!left.layer || !right.layer) return left.sourceIndex - right.sourceIndex
        return (left.layer.definition.compositionIndex - right.layer.definition.compositionIndex) || left.sourceIndex - right.sourceIndex
      })
    }

    for (const { input, layer } of sources) {
      if (target?.colorTexture === input.texture) {
        throw new Error(`Composite pass "${pass.id}" cannot sample and write the same color attachment.`)
      }
      if (layer && (!layer.visible || layer.opacity <= 0)) continue
      this.requireCompositor().draw({
        texture: input.texture,
        opacity: layer?.opacity ?? 1,
        blendMode: layer?.blendMode ?? 'normal',
      }, target?.framebuffer ?? null, width, height)
    }
  }

  private resolvePassLayers(pass: Readonly<Cinema2CompiledRenderPass>): ResolvedLayerState[] {
    return pass.layers
      .map(handle => this.scene.layers[handle.index])
      .filter((definition): definition is Readonly<Cinema2CompiledLayerDefinition> => definition != null)
      .sort((left, right) => left.compositionIndex - right.compositionIndex)
      .map(definition => this.resolveLayerState(definition))
  }

  private resolveLayerState(definition: Readonly<Cinema2CompiledLayerDefinition>): ResolvedLayerState {
    let visible = definition.visible
    let opacity = clamp01(definition.opacity)
    if (this.targetResolver) {
      const visibleTarget = this.layerTargets.get(`${definition.id}\u0000visible`)
      const opacityTarget = this.layerTargets.get(`${definition.id}\u0000opacity`)
      if (visibleTarget) {
        const resolved = this.targetResolver.resolve(visibleTarget.id)
        if (resolved.ok && typeof resolved.value === 'boolean') visible = resolved.value
      }
      if (opacityTarget) {
        const resolved = this.targetResolver.resolve(opacityTarget.id)
        if (resolved.ok && typeof resolved.value === 'number') opacity = clamp01(resolved.value)
      }
    }
    return { definition, visible, opacity, blendMode: definition.blendMode, depthPolicy: definition.depthPolicy }
  }

  private layerHandle(
    pass: Readonly<Cinema2CompiledRenderPass>,
    layerId: Cinema2LayerId,
  ): Readonly<Cinema2CompiledRenderPass['layers'][number]> {
    const handle = pass.layers.find(candidate => candidate.id === layerId)
    if (!handle) throw new Error(`Render pass "${pass.id}" does not contain layer "${layerId}".`)
    return handle
  }

  private layerTargetDescriptor(
    pass: Readonly<Cinema2CompiledRenderPass>,
    layer: Readonly<ResolvedLayerState>,
    providers: ReadonlyMap<string, Readonly<Cinema2ModuleRenderPassProvider>>,
  ): Cinema2RenderTargetDescriptor {
    const passTarget = pass.outputs.find(output => output.target)?.target
    const moduleIds = this.resolvePassModuleIds(pass, [this.layerHandle(pass, layer.definition.id)])
    const needsDepth = layer.depthPolicy !== 'disabled' || moduleIds.some(moduleId => providers.get(moduleId)?.intent === 'world')
    const base = passTarget?.descriptor
    return {
      size: base?.size ?? { kind: 'viewport' as const },
      colorFormat: base?.colorFormat ?? 'rgba8' as const,
      depthFormat: needsDepth ? (base?.depthFormat && base.depthFormat !== 'none' ? base.depthFormat : 'depth24' as const) : 'none' as const,
      filter: base?.filter,
      wrap: base?.wrap,
      surfaceLayout: 'single' as const,
    }
  }

  private clearLayerTarget(
    target: Readonly<Cinema2RenderTargetBinding>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    layer: Readonly<ResolvedLayerState>,
  ): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer)
    this.gl.viewport(0, 0, target.width, target.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.colorMask(true, true, true, true)
    const background = layer.definition.role === 'world' ? this.backgroundColor() : [0, 0, 0, 0] as const
    this.gl.clearColor(background[0], background[1], background[2], background[3])
    let mask = this.gl.COLOR_BUFFER_BIT
    if (hasDepthAttachment(target)) {
      this.gl.depthMask(true)
      this.gl.clearDepth(1)
      mask |= this.gl.DEPTH_BUFFER_BIT
    }
    this.gl.clear(mask)
    this.restoreDefaultFramebuffer(frame)
  }

  private copyDepth(source: Readonly<Cinema2RenderTargetBinding>, target: Readonly<Cinema2RenderTargetBinding>): void {
    if (typeof this.gl.blitFramebuffer !== 'function') throw new Error('Cinema 2.0 depth propagation requires WebGL2 blitFramebuffer support.')
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, source.framebuffer)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, target.framebuffer)
    this.gl.blitFramebuffer(
      0, 0, source.width, source.height,
      0, 0, target.width, target.height,
      this.gl.DEPTH_BUFFER_BIT,
      this.gl.NEAREST,
    )
    assertCinema2NoGlErrors(this.gl, 'depth propagation blit', `${source.width}x${source.height} -> ${target.width}x${target.height}`)
  }

  private resolvePassModuleIds(
    pass: Readonly<Cinema2CompiledRenderPass>,
    layers: readonly Readonly<Cinema2CompiledRenderPass['layers'][number]>[] = pass.layers,
  ): Cinema2ModuleId[] {
    if (pass.module) return [pass.module.id]
    const nodeIds = new Set<string>()
    if (pass.sceneNode) nodeIds.add(pass.sceneNode.id)
    for (const layer of layers) {
      const definition = this.scene.layers[layer.index]
      if (definition) nodeIds.add(definition.sourceNodeId)
    }
    if (nodeIds.size === 0 && pass.kind === 'scene') for (const id of this.scene.rootNodeIds) nodeIds.add(id)
    const moduleIds: Cinema2ModuleId[] = []
    for (const node of this.scene.nodes) {
      if (!node.effectiveVisible || !node.moduleId) continue
      if (nodeIds.has(node.id) || node.layerIds.some(layerId => layers.some(layer => layer.id === layerId)) || isDescendantOfAny(node.id, nodeIds, this.scene)) {
        if (!moduleIds.includes(node.moduleId)) moduleIds.push(node.moduleId)
      }
    }
    return moduleIds
  }

  private prepareWorldTarget(
    pass: Readonly<Cinema2CompiledRenderPass>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
    preserveDepth = false,
  ): void {
    if (!target || !hasDepthAttachment(target)) {
      throw new Error(`World-space render pass "${pass.id}" requires an engine-owned render target with a depth attachment.`)
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer)
    this.gl.viewport(0, 0, target.width, target.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.enable(this.gl.DEPTH_TEST)
    this.gl.depthFunc(this.gl.LEQUAL)
    this.gl.depthMask(true)
    this.gl.colorMask(true, true, true, true)
    const background = this.backgroundColor()
    this.gl.clearColor(background[0], background[1], background[2], background[3])
    this.gl.clearDepth(1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | (preserveDepth ? 0 : this.gl.DEPTH_BUFFER_BIT))
  }

  private resolveSpatialNodesForModule(
    pass: Readonly<Cinema2CompiledRenderPass>,
    moduleId: Cinema2ModuleId,
    layers: readonly Readonly<Cinema2CompiledRenderPass['layers'][number]>[] = pass.layers,
  ) {
    if (!this.spatialRuntime) return Object.freeze([])
    const nodes = this.spatialRuntime.resolveModuleNodes(moduleId)
    if (pass.module) return nodes
    const roots = new Set<string>()
    if (pass.sceneNode) roots.add(pass.sceneNode.id)
    for (const layer of layers) {
      const definition = this.scene.layers[layer.index]
      if (definition) roots.add(definition.sourceNodeId)
    }
    if (roots.size === 0 && pass.kind === 'scene') for (const id of this.scene.rootNodeIds) roots.add(id)
    if (roots.size === 0) return nodes
    return Object.freeze(nodes.filter(node => roots.has(node.id) || isDescendantOfAny(node.id, roots, this.scene)))
  }

  private requireCompositor(): Cinema2Compositor {
    if (!this.contextAvailable) throw new Error('Cinema 2.0 compositor is unavailable while the WebGL2 context is lost.')
    if (!this.compositor) this.compositor = new Cinema2Compositor(this.gl)
    return this.compositor
  }

  private presentBinding(
    source: Readonly<Cinema2RenderTargetBinding>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    if (typeof this.gl.blitFramebuffer !== 'function') {
      throw new Error('Cinema 2.0 final output presentation requires WebGL2 blitFramebuffer support.')
    }
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.colorMask(true, true, true, true)
    this.gl.viewport(0, 0, frame.viewport.width, frame.viewport.height)
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, source.framebuffer)
    this.gl.readBuffer(this.gl.COLOR_ATTACHMENT0)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null)
    this.gl.blitFramebuffer(
      0, 0, source.width, source.height,
      0, 0, frame.viewport.width, frame.viewport.height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.LINEAR,
    )
    assertCinema2NoGlErrors(
      this.gl,
      'final output presentation',
      `${source.width}x${source.height} -> ${frame.viewport.width}x${frame.viewport.height}`,
    )
  }

  private blitFirstInput(
    inputs: readonly { texture: WebGLTexture; width: number; height: number }[],
    target: Readonly<Cinema2RenderTargetBinding> | null,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    if (inputs.length === 0) {
      this.clearTarget(target, frame)
      return
    }
    const sourceBinding = this.findBindingForTexture(inputs[0].texture)
    if (!sourceBinding || typeof this.gl.blitFramebuffer !== 'function') {
      throw new Error('Cinema 2.0 output/composite pass requires a framebuffer-backed color input and WebGL2 blitFramebuffer support.')
    }
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.colorMask(true, true, true, true)
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, sourceBinding.framebuffer)
    this.gl.readBuffer(this.gl.COLOR_ATTACHMENT0)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, target?.framebuffer ?? null)
    const width = target?.width ?? frame.viewport.width
    const height = target?.height ?? frame.viewport.height
    this.gl.blitFramebuffer(
      0, 0, sourceBinding.width, sourceBinding.height,
      0, 0, width, height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.LINEAR,
    )
    assertCinema2NoGlErrors(
      this.gl,
      'render input blit',
      `${sourceBinding.width}x${sourceBinding.height} -> ${width}x${height}`,
    )
  }

  private findBindingForTexture(texture: WebGLTexture): Readonly<Cinema2RenderTargetBinding> | null {
    for (const record of this.persistentTargets.values()) if (record.binding.colorTexture === texture) return record.binding
    return this.frameBindings.get(texture) ?? null
  }

  private clearTarget(target: Readonly<Cinema2RenderTargetBinding> | null, frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target?.framebuffer ?? null)
    this.gl.viewport(0, 0, target?.width ?? frame.viewport.width, target?.height ?? frame.viewport.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    const background = this.backgroundColor()
    this.gl.clearColor(background[0], background[1], background[2], background[3])
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }

  private backgroundColor(): readonly [number, number, number, number] {
    return this.lightingEnvironmentRuntime?.getFrame().environment.backgroundColor ?? [0, 0, 0, 1]
  }

  private markOutputs(
    pass: Readonly<Cinema2CompiledRenderPass>,
    produced: Map<string, ProducedOutput>,
    binding: Readonly<Cinema2RenderTargetBinding> | null,
    valid: boolean,
  ): void {
    for (const output of pass.outputs) produced.set(outputKey(pass.id, output.id), { binding, valid })
  }

  private captureVisibilityCheckpoint(
    stage: Cinema2RenderVisibilityCheckpoint['stage'],
    passId: Cinema2RenderPassId,
    source: Readonly<Cinema2RenderTargetBinding> | null,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    if (!this.debugVisibilityReadback || typeof this.gl.readPixels !== 'function') return
    const width = source?.width ?? frame.viewport.width
    const height = source?.height ?? frame.viewport.height
    const sampledWidth = Math.max(1, Math.min(8, width))
    const sampledHeight = Math.max(1, Math.min(8, height))
    const x = Math.max(0, Math.floor((width - sampledWidth) / 2))
    const y = Math.max(0, Math.floor((height - sampledHeight) / 2))
    const pixels = new Uint8Array(sampledWidth * sampledHeight * 4)
    let maxRgbByte: number | null = null
    let rgbEnergyDetected: boolean | null = null
    let error: string | null = null
    try {
      this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, source?.framebuffer ?? null)
      this.gl.readBuffer(source ? this.gl.COLOR_ATTACHMENT0 : this.gl.BACK)
      this.gl.readPixels(x, y, sampledWidth, sampledHeight, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels)
      assertCinema2NoGlErrors(this.gl, `${stage} visibility checkpoint`, String(passId))
      let maximum = 0
      for (let index = 0; index < pixels.length; index += 4) {
        maximum = Math.max(maximum, pixels[index] ?? 0, pixels[index + 1] ?? 0, pixels[index + 2] ?? 0)
      }
      maxRgbByte = maximum
      rgbEnergyDetected = maximum > 0
    } catch (caught) {
      error = errorMessage(caught)
    } finally {
      this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, null)
    }
    this.visibilityCheckpoints.push({
      stage,
      passId,
      width,
      height,
      sampledWidth,
      sampledHeight,
      maxRgbByte,
      rgbEnergyDetected,
      error,
    })
  }

  private restoreDefaultFramebuffer(frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, frame.viewport.width, frame.viewport.height)
  }

  private pushDiagnostic(code: string, message: string, passId: Cinema2RenderPassId | null): void {
    this.diagnostics.push({ code, message, passId })
  }
}

function hasDepthAttachment(binding: Readonly<Cinema2RenderTargetBinding> | null): boolean {
  return binding?.depthTexture != null || binding?.depthRenderbuffer != null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1))
}

function outputKey(passId: Cinema2RenderPassId, outputId: Cinema2RenderSlotId): string {
  return `${passId}\u0000${outputId}`
}

function jsonEqual(left: Cinema2JsonValue | undefined, right: Cinema2JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isDescendantOfAny(nodeId: string, roots: ReadonlySet<string>, scene: Readonly<Cinema2CompiledSceneGraph>): boolean {
  let current = scene.nodes.find(node => node.id === nodeId) ?? null
  while (current?.parentId) {
    if (roots.has(current.parentId)) return true
    current = scene.nodes.find(node => node.id === current?.parentId) ?? null
  }
  return false
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

import type {
  Cinema2CapabilityId,
  Cinema2JsonValue,
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
import type {
  Cinema2CompiledRenderInput,
  Cinema2CompiledRenderPass,
  Cinema2CompiledRenderPlan,
} from '../render/Cinema2RenderGraph'
import type { Cinema2CompiledSceneGraph } from '../scene/Cinema2SceneGraph'
import type { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import type { Cinema2CameraRuntime } from '../spatial/Cinema2CameraRuntime'
import type { Cinema2LightingEnvironmentRuntime } from '../spatial/Cinema2LightingEnvironmentRuntime'
import {
  Cinema2ResourceManager,
  type Cinema2RenderTargetBinding,
  type Cinema2RenderTargetLease,
} from './Cinema2ResourceManager'

export interface Cinema2RenderGraphExecutorDiagnostic {
  code: string
  message: string
  passId: Cinema2RenderPassId | null
}

export interface Cinema2RenderGraphExecutorSnapshot {
  disposed: boolean
  frameCount: number
  executedPassCount: number
  skippedPassCount: number
  failedPassCount: number
  activePersistentTargetCount: number
  diagnostics: readonly Readonly<Cinema2RenderGraphExecutorDiagnostic>[]
}

export interface Cinema2RenderGraphExecutorOptions {
  quality?: Cinema2RenderQualityLevel
  availableCapabilities?: Iterable<Cinema2CapabilityId>
  effectRuntime?: Cinema2EffectRuntime
  spatialRuntime?: Cinema2SpatialRuntime
  cameraRuntime?: Cinema2CameraRuntime
  lightingEnvironmentRuntime?: Cinema2LightingEnvironmentRuntime
}

interface TargetRecord {
  lease: Cinema2RenderTargetLease
  binding: Readonly<Cinema2RenderTargetBinding>
}

interface ProducedOutput {
  binding: Readonly<Cinema2RenderTargetBinding> | null
  valid: boolean
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
  private readonly quality: Cinema2RenderQualityLevel
  private readonly availableCapabilities: ReadonlySet<Cinema2CapabilityId>
  private readonly effectRuntime: Cinema2EffectRuntime | null
  private readonly spatialRuntime: Cinema2SpatialRuntime | null
  private readonly cameraRuntime: Cinema2CameraRuntime | null
  private readonly lightingEnvironmentRuntime: Cinema2LightingEnvironmentRuntime | null
  private diagnostics: Cinema2RenderGraphExecutorDiagnostic[] = []
  private frameCount = 0
  private executedPassCount = 0
  private skippedPassCount = 0
  private failedPassCount = 0
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
    for (const target of plan.targets) this.targetHandles.set(target.id, target)
    for (const pass of plan.passes) this.passById.set(pass.id, pass)
  }

  executeFrame(
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: readonly Readonly<Cinema2ModuleRenderPassProvider>[],
  ): void {
    if (this.disposed) return
    this.frameCount += 1
    this.diagnostics = []
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
          this.markOutputs(pass, produced, target?.binding ?? null, true)
          if (pass.id === this.plan.outputPassId) {
            if (target?.binding) this.presentBinding(target.binding, frame)
            finalOutputSucceeded = true
          }
        } catch (error) {
          this.failedPassCount += 1
          this.markOutputs(pass, produced, null, false)
          this.restoreDefaultFramebuffer(frame)
          this.pushDiagnostic('CINEMA2_RENDER_PASS_FAILED', errorMessage(error), pass.id)
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
  }

  handleContextRestored(): void {
    if (this.disposed) return
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
      diagnostics: Object.freeze(this.diagnostics.map(diagnostic => Object.freeze({ ...diagnostic }))),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const record of this.persistentTargets.values()) this.resources.release(record.lease)
    this.persistentTargets.clear()
    this.resources.releaseOwner('cinema2.render-executor')
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
    if (handle.ownership === 'persistent') {
      const existingPersistent = this.persistentTargets.get(targetId)
      if (existingPersistent) {
        const rebound = { lease: existingPersistent.lease, binding: this.resources.getRenderTargetBinding(existingPersistent.lease) }
        this.persistentTargets.set(targetId, rebound)
        this.frameBindings.set(rebound.binding.colorTexture, rebound.binding)
        return rebound
      }
      const lease = this.resources.acquireRenderTarget('cinema2.render-executor', handle.descriptor, 'persistent')
      const created = { lease, binding: this.resources.getRenderTargetBinding(lease) }
      this.persistentTargets.set(targetId, created)
      this.frameBindings.set(created.binding.colorTexture, created.binding)
      return created
    }
    const existing = transientTargets.get(targetId)
    if (existing) return existing
    const lease = this.resources.acquireRenderTarget('cinema2.render-executor', handle.descriptor, 'transient')
    const created = { lease, binding: this.resources.getRenderTargetBinding(lease) }
    transientTargets.set(targetId, created)
    this.frameBindings.set(created.binding.colorTexture, created.binding)
    return created
  }

  private resolveInput(input: Readonly<Cinema2CompiledRenderInput>, produced: ReadonlyMap<string, ProducedOutput>) {
    const source = produced.get(outputKey(input.sourcePass.id, input.sourceOutputId))
    if (!source?.valid || !source.binding || input.attachment === 'depth') return null
    return Object.freeze({
      id: input.id,
      attachment: input.attachment,
      texture: source.binding.colorTexture,
      width: source.binding.width,
      height: source.binding.height,
    })
  }

  private executePass(
    pass: Readonly<Cinema2CompiledRenderPass>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
    providers: ReadonlyMap<string, Readonly<Cinema2ModuleRenderPassProvider>>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
    inputs: readonly { id: Cinema2RenderSlotId; attachment: Cinema2RenderAttachment; texture: WebGLTexture; width: number; height: number }[],
  ): void {
    if (pass.effect) {
      if (!this.effectRuntime) throw new Error(`Render pass "${pass.id}" requires the Cinema 2.0 effect runtime.`)
      if (inputs.length !== 1) throw new Error(`Effect render pass "${pass.id}" requires exactly one executable color input.`)
      const result = this.effectRuntime.execute(pass.effect.id, {
        frame,
        input: inputs[0],
        target: target?.framebuffer ?? null,
        width: target?.width ?? frame.viewport.width,
        height: target?.height ?? frame.viewport.height,
      })
      if (result === 'applied') return
      this.blitFirstInput(inputs, target, frame)
      return
    }
    if (pass.kind === 'output' || pass.kind === 'composite') {
      this.blitFirstInput(inputs, target, frame)
      return
    }
    const moduleIds = this.resolvePassModuleIds(pass)
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
    if (hasWorldProvider) this.prepareWorldTarget(pass, target)
    for (const { moduleId, provider } of passProviders) {
      this.prepareProviderState(provider.intent)
      provider.execute({
        frame,
        target: target?.framebuffer ?? null,
        width: target?.width ?? frame.viewport.width,
        height: target?.height ?? frame.viewport.height,
        depthAvailable: target?.depthRenderbuffer != null,
        spatialNodes: this.resolveSpatialNodesForModule(pass, moduleId),
        camera: provider.intent === 'world' ? this.cameraRuntime?.getFrame() : undefined,
        lightingEnvironment: this.lightingEnvironmentRuntime?.getFrame(),
        inputs,
      })
    }
  }

  private prepareProviderState(intent: Readonly<Cinema2ModuleRenderPassProvider>['intent']): void {
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.colorMask(true, true, true, true)
    if (intent === 'world') {
      this.gl.enable(this.gl.DEPTH_TEST)
      this.gl.depthFunc(this.gl.LEQUAL)
      this.gl.depthMask(true)
      return
    }
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.depthMask(false)
  }

  private resolvePassModuleIds(pass: Readonly<Cinema2CompiledRenderPass>): Cinema2ModuleId[] {
    if (pass.module) return [pass.module.id]
    const nodeIds = new Set<string>()
    if (pass.sceneNode) nodeIds.add(pass.sceneNode.id)
    for (const layer of pass.layers) {
      const definition = this.scene.layers[layer.index]
      if (definition) nodeIds.add(definition.sourceNodeId)
    }
    if (nodeIds.size === 0 && pass.kind === 'scene') for (const id of this.scene.rootNodeIds) nodeIds.add(id)
    const moduleIds: Cinema2ModuleId[] = []
    for (const node of this.scene.nodes) {
      if (!node.effectiveVisible || !node.moduleId) continue
      if (nodeIds.has(node.id) || node.layerIds.some(layerId => pass.layers.some(layer => layer.id === layerId)) || isDescendantOfAny(node.id, nodeIds, this.scene)) {
        if (!moduleIds.includes(node.moduleId)) moduleIds.push(node.moduleId)
      }
    }
    return moduleIds
  }

  private prepareWorldTarget(
    pass: Readonly<Cinema2CompiledRenderPass>,
    target: Readonly<Cinema2RenderTargetBinding> | null,
  ): void {
    if (!target?.depthRenderbuffer) {
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
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
  }

  private resolveSpatialNodesForModule(
    pass: Readonly<Cinema2CompiledRenderPass>,
    moduleId: Cinema2ModuleId,
  ) {
    if (!this.spatialRuntime) return Object.freeze([])
    const nodes = this.spatialRuntime.resolveModuleNodes(moduleId)
    if (pass.module) return nodes
    const roots = new Set<string>()
    if (pass.sceneNode) roots.add(pass.sceneNode.id)
    for (const layer of pass.layers) {
      const definition = this.scene.layers[layer.index]
      if (definition) roots.add(definition.sourceNodeId)
    }
    if (roots.size === 0 && pass.kind === 'scene') for (const id of this.scene.rootNodeIds) roots.add(id)
    if (roots.size === 0) return nodes
    return Object.freeze(nodes.filter(node => roots.has(node.id) || isDescendantOfAny(node.id, roots, this.scene)))
  }

  private presentBinding(
    source: Readonly<Cinema2RenderTargetBinding>,
    frame: Readonly<Cinema2ModuleFrameReadContext>,
  ): void {
    if (typeof this.gl.blitFramebuffer !== 'function') {
      throw new Error('Cinema 2.0 final output presentation requires WebGL2 blitFramebuffer support.')
    }
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, source.framebuffer)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, null)
    this.gl.blitFramebuffer(
      0, 0, source.width, source.height,
      0, 0, frame.viewport.width, frame.viewport.height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.LINEAR,
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
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, sourceBinding.framebuffer)
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, target?.framebuffer ?? null)
    this.gl.blitFramebuffer(
      0, 0, sourceBinding.width, sourceBinding.height,
      0, 0, target?.width ?? frame.viewport.width, target?.height ?? frame.viewport.height,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.LINEAR,
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

  private restoreDefaultFramebuffer(frame: Readonly<Cinema2ModuleFrameReadContext>): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, frame.viewport.width, frame.viewport.height)
  }

  private pushDiagnostic(code: string, message: string, passId: Cinema2RenderPassId | null): void {
    this.diagnostics.push({ code, message, passId })
  }
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

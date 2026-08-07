import type {
  CinemaAssetBindingDefinition,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaNodeDefinition,
  CinemaParameterValue,
  CinemaParameterValues,
} from '../CinemaDomain'
import { createCinemaAssetFallback, normalizeCinemaAssetBinding } from '../CinemaAssets'
import {
  compileCinemaCompositionGraph,
  type CinemaCompiledGraphPlan,
  type CinemaGraphCompilationResult,
} from '../CinemaGraphCompiler'
import type {
  CinemaAssetBindingId,
  CinemaAssetId,
  CinemaNodeId,
  CinemaPortId,
} from '../CinemaIdentifiers'
import type { CinemaNodeDefinitionRegistry, CinemaNodeRegistryEntry } from '../CinemaNodeRegistry'
import type { CinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import {
  CINEMA_STATE_RESET_ACTION_IDS,
  type CinemaAssetRuntimeService,
  type CinemaRuntimeAssetView,
  type CinemaFrameContext,
  type CinemaNodeResetContext,
  type CinemaPlatformCapabilities,
  type CinemaRenderNode,
  type CinemaRenderTargetLease,
  type CinemaRuntimeDiagnosticSink,
  type CinemaTargetDescriptor,
  type CinemaTextureView,
  type CinemaViewport,
  type CinemaWebGLRenderService,
} from '../CinemaRendererContracts'
import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from '../CinemaDiagnostics'
import { resolveCinemaParameterSnapshot } from '../CinemaParameterResolver'
import { CinemaModulationRuntime } from '../CinemaModulationRuntime'
import {
  CinemaPerformanceRuntime,
  type CinemaPerformanceEvaluation,
  type CinemaPerformanceStateCommand,
} from '../CinemaPerformanceRuntime'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import { createCinemaDefinitionRegistryFromPersistedDefinitions } from '../CinemaDefinitionRegistry'
import { CinemaRenderTargetPool } from './CinemaRenderTargetPool'
import { CinemaTextureManager } from './CinemaTextureManager'
import {
  cameraFrameForCapability,
  createCinemaCameraParameterSchemaMap,
  resolveCinemaCameraFrame,
} from '../CinemaCameraRuntime'


const NOOP_ASSET_RUNTIME: CinemaAssetRuntimeService = Object.freeze({
  resolve: (binding: Readonly<CinemaAssetBindingDefinition>): Readonly<CinemaRuntimeAssetView> => Object.freeze({
    bindingId: binding.id,
    assetId: binding.assetId,
    status: 'fallback',
    mediaKind: 'unknown',
    mimeType: null,
    width: null,
    height: null,
    durationSec: null,
    texture: null,
    mediaElement: null,
    fallback: createCinemaAssetFallback(binding.role, 'unavailable'),
  }),
  prepare: async (binding: Readonly<CinemaAssetBindingDefinition>): Promise<Readonly<CinemaRuntimeAssetView>> => NOOP_ASSET_RUNTIME.resolve(binding),
  releaseAsset: (_assetId: CinemaAssetId): void => {},
  getDiagnostics: () => Object.freeze({ sourceCount: 0, resourceCount: 0, readyCount: 0 }),
})

export interface CinemaGraphExecutorSnapshot {
  compositionId: string | null
  compositionRevision: number | null
  planCacheKey: string | null
  planCacheSize: number
  activeNodeCount: number
  initializedNodeCount: number
  failedNodeCount: number
  outputNodeId: string | null
  outputRendered: boolean
  safeOutputActive: boolean
  modulationRouteCount: number
  activeModulationRouteCount: number
  performanceRuleCount: number
  activePerformanceRuleCount: number
  activePerformanceTransientCount: number
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaGraphExecutorOptions {
  runtimeRegistry: CinemaRuntimeNodeRegistry
  platform: Readonly<CinemaPlatformCapabilities>
  targets: CinemaRenderTargetPool
  textures: CinemaTextureManager
  assetManager?: CinemaAssetRuntimeService
  webgl: CinemaWebGLRenderService
  diagnostics: CinemaRuntimeDiagnosticSink
  onSnapshot?: (snapshot: CinemaGraphExecutorSnapshot) => void
  maximumPlanCacheSize?: number
}

interface RuntimeNodeRecord {
  authored: Readonly<CinemaNodeDefinition>
  registryEntry: Readonly<CinemaNodeRegistryEntry>
  renderer: CinemaRenderNode
  abortController: AbortController
  status: 'initializing' | 'ready' | 'failed'
  disposed: boolean
  values: Readonly<CinemaParameterValues>
  assets: readonly Readonly<CinemaAssetBindingDefinition>[]
}

interface FeedbackSourceState {
  sourceNodeId: CinemaNodeId
  maximumHistoryFrames: number
  leases: CinemaRenderTargetLease[]
  cursor: number
  framesWritten: number
}

interface GraphConfiguration {
  composition: Readonly<CinemaCompositionDefinition> | null
  instance: Readonly<CinemaCompositionInstance> | null
  definitions: readonly CinemaPersistedDefinition[]
}

/** Executes one compiled Cinema graph inside the owning CinemaRuntime loop. */
export class CinemaGraphExecutor {
  private readonly runtimeRegistry: CinemaRuntimeNodeRegistry
  private readonly platform: Readonly<CinemaPlatformCapabilities>
  private readonly targets: CinemaRenderTargetPool
  private readonly textures: CinemaTextureManager
  private readonly assetManager: CinemaAssetRuntimeService
  private readonly webgl: CinemaWebGLRenderService
  private readonly diagnosticsSink: CinemaRuntimeDiagnosticSink
  private readonly onSnapshot: ((snapshot: CinemaGraphExecutorSnapshot) => void) | null
  private readonly maximumPlanCacheSize: number
  private readonly planCache = new Map<string, CinemaGraphCompilationResult>()
  private readonly diagnostics: CinemaDiagnostic[] = []
  private readonly records = new Map<CinemaNodeId, RuntimeNodeRecord>()
  private readonly feedbackSources = new Map<CinemaNodeId, FeedbackSourceState>()

  private configuration: GraphConfiguration = { composition: null, instance: null, definitions: [] }
  private parameterRegistry: CinemaNodeDefinitionRegistry | null = null
  private cameraParameterSchemas: ReturnType<typeof createCinemaCameraParameterSchemaMap> = Object.freeze({})
  private baseParameterValues: Readonly<Record<string, CinemaParameterValue>> = Object.freeze({})
  private modulationRuntime: CinemaModulationRuntime | null = null
  private performanceRuntime: CinemaPerformanceRuntime | null = null
  private activeModulationRouteCount = 0
  private activePerformanceRuleCount = 0
  private activePerformanceTransientCount = 0
  private readonly seekDisabledNodes = new Set<CinemaNodeId>()
  private plan: CinemaCompiledGraphPlan | null = null
  private planCacheKey: string | null = null
  private configurationKey: string | null = null
  private generation = 0
  private lastResetGeneration = -1
  private viewport: CinemaViewport = { width: 1, height: 1, dpr: 1 }
  private outputRendered = false
  private safeOutputActive = true
  private disposed = false

  constructor(options: CinemaGraphExecutorOptions) {
    this.runtimeRegistry = options.runtimeRegistry
    this.platform = options.platform
    this.targets = options.targets
    this.textures = options.textures
    this.assetManager = options.assetManager ?? NOOP_ASSET_RUNTIME
    this.webgl = options.webgl
    this.diagnosticsSink = options.diagnostics
    this.onSnapshot = options.onSnapshot ?? null
    this.maximumPlanCacheSize = Math.max(1, Math.floor(options.maximumPlanCacheSize ?? 16))
  }

  setGraph(configuration: GraphConfiguration): void {
    if (this.disposed) return
    const nextKey = configurationKey(configuration, this.runtimeRegistry.fingerprint)
    this.configuration = configuration
    if (nextKey === this.configurationKey) return
    this.configurationKey = nextKey
    this.rebuild('superseded')
  }

  resize(previousViewport: CinemaViewport, viewport: CinemaViewport): void {
    if (this.disposed) return
    this.viewport = { ...viewport }
    for (const record of this.records.values()) {
      if (record.status !== 'ready') continue
      try {
        record.renderer.resize({
          nodeId: record.authored.id,
          previousViewport,
          viewport,
          targets: this.targets,
          webgl: this.webgl,
          diagnostics: this.diagnosticsSink,
        })
      } catch (error) {
        this.failNode(record, 'CINEMA_NODE_RESET_FAILED', `Cinema node "${record.authored.id}" failed during resize.`, error)
      }
    }
    this.resetAll(CINEMA_STATE_RESET_ACTION_IDS.resolutionChange, null)
    this.emitSnapshot()
  }

  render(frame: Readonly<CinemaFrameContext> | null): boolean {
    if (this.disposed) return false
    this.outputRendered = false
    if (!frame || !this.plan) {
      this.renderSafeOutput()
      this.emitSnapshot()
      return false
    }

    const transportResetPending = frame.transport.reset.required
      && frame.transport.reset.generation !== this.lastResetGeneration
    if (transportResetPending) {
      this.lastResetGeneration = frame.transport.reset.generation
      this.prepareTransportReset()
    }

    const performance = this.performanceRuntime?.evaluate(frame) ?? emptyPerformanceEvaluation()
    this.activePerformanceRuleCount = performance.activeRuleCount
    this.activePerformanceTransientCount = performance.activeTransientCount
    for (const diagnostic of performance.diagnostics.diagnostics) this.reportOnce(diagnostic)
    const performanceFrame = applyPerformanceFrameOverrides(frame, performance)
    const resolvedParameterValues = this.updateFrameParameterValues(performanceFrame, performance)
    const cameraResolution = this.configuration.composition?.cameras.length
      ? resolveCinemaCameraFrame({
          composition: this.configuration.composition,
          instance: this.configuration.instance,
          frame: performanceFrame,
          requestedCameraId: performanceFrame.activeCameraId,
          resolvedParameterValues,
        })
      : null
    for (const diagnostic of cameraResolution?.diagnostics.diagnostics ?? []) this.reportOnce(diagnostic)
    const renderFrame: Readonly<CinemaFrameContext> = cameraResolution?.camera
      ? Object.freeze({
          ...performanceFrame,
          activeCameraId: cameraResolution.cameraId,
          camera: cameraResolution.camera,
        })
      : performanceFrame.camera != null || performanceFrame.activeCameraId != null
        ? Object.freeze({ ...performanceFrame, activeCameraId: null, camera: null })
        : performanceFrame
    if (transportResetPending) this.dispatchTransportReset(renderFrame)
    this.dispatchPerformanceCommands(performance.stateCommands, renderFrame)

    const frameLeases: CinemaRenderTargetLease[] = []
    let frameFallbackUsed = false
    this.textures.clearPublishedOutputs()
    try {
      for (const nodeId of this.plan.nodeOrder) {
        const record = this.records.get(nodeId)
        const outputNode = nodeId === this.plan.output.nodeId
        const enabled = record
          ? (performance.nodeEnabledOverrides[nodeId] ?? record.authored.enabled)
          : false
        const transparentSource = record != null
          && record.authored.opacity <= 0
          && (record.authored.family === 'media'
            || record.authored.family === 'logo'
            || record.authored.family === 'text'
            || record.authored.family === 'lyrics'
            || record.authored.family === 'procedural')
        if (!record || record.status !== 'ready' || this.seekDisabledNodes.has(nodeId)) {
          frameFallbackUsed = true
          this.renderNodeFallback(record?.authored ?? null, outputNode, frameLeases)
          continue
        }
        if (!enabled) {
          if (outputNode) frameFallbackUsed = true
          this.renderNodeFallback(record.authored, outputNode, frameLeases)
          continue
        }
        if (transparentSource) {
          this.renderNodeFallback(record.authored, outputNode, frameLeases)
          continue
        }

        const target = outputNode ? null : this.acquireFrameTarget(record, frameLeases)
        const inputs = this.resolveInputs(nodeId)
        try {
          const nodeFrame = cameraFrameForCapability(
            renderFrame,
            record.registryEntry.definition.capabilities.camera.mode,
          )
          record.renderer.render({
            nodeId,
            frame: nodeFrame,
            viewport: this.viewport,
            values: record.values,
            assets: record.assets,
            assetManager: this.assetManager,
            inputs,
            target,
            outputNode,
            targets: this.targets,
            textures: this.textures,
            webgl: this.webgl,
            diagnostics: this.diagnosticsSink,
          })
          if (outputNode) {
            this.outputRendered = true
          } else if (target) {
            this.publishNodeOutputs(record, target)
          }
        } catch (error) {
          frameFallbackUsed = true
          this.failNode(record, 'CINEMA_NODE_RENDER_FAILED', `Cinema node "${nodeId}" failed during render.`, error)
          this.renderNodeFallback(record.authored, outputNode, frameLeases, target)
        }
      }
    } finally {
      for (const lease of frameLeases.reverse()) this.targets.release(lease)
      this.textures.clearPublishedOutputs()
      this.webgl.resetState()
    }

    if (!this.outputRendered) this.renderSafeOutput()
    else this.safeOutputActive = frameFallbackUsed
    this.emitSnapshot()
    return this.outputRendered
  }

  handleContextLost(): void {
    if (this.disposed) return
    this.disposeRecords('context-lost')
    this.releaseFeedbackTargets()
    this.plan = null
    this.safeOutputActive = true
    this.outputRendered = false
    this.emitSnapshot()
  }

  rebuildAfterContextRestore(): void {
    if (this.disposed) return
    this.configurationKey = null
    this.setGraph(this.configuration)
    this.resetAll(CINEMA_STATE_RESET_ACTION_IDS.contextRestore, null)
  }

  getSnapshot(): CinemaGraphExecutorSnapshot {
    let initializedNodeCount = 0
    let failedNodeCount = 0
    for (const record of this.records.values()) {
      if (record.status === 'ready') initializedNodeCount += 1
      if (record.status === 'failed') failedNodeCount += 1
    }
    return {
      compositionId: this.plan?.compositionId ?? this.configuration.composition?.id ?? null,
      compositionRevision: this.plan?.compositionRevision ?? this.configuration.composition?.revision ?? null,
      planCacheKey: this.planCacheKey,
      planCacheSize: this.planCache.size,
      activeNodeCount: this.records.size,
      initializedNodeCount,
      failedNodeCount,
      outputNodeId: this.plan?.output.nodeId ?? null,
      outputRendered: this.outputRendered,
      safeOutputActive: this.safeOutputActive,
      modulationRouteCount: this.modulationRuntime?.routeCount ?? 0,
      activeModulationRouteCount: this.activeModulationRouteCount,
      performanceRuleCount: this.performanceRuntime?.ruleCount ?? 0,
      activePerformanceRuleCount: this.activePerformanceRuleCount,
      activePerformanceTransientCount: this.activePerformanceTransientCount,
      diagnostics: createCinemaDiagnosticSnapshot(this.diagnostics),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    this.disposeRecords('unmount')
    this.releaseFeedbackTargets()
    this.planCache.clear()
    this.plan = null
    this.textures.clearPublishedOutputs()
    this.emitSnapshot()
  }

  private rebuild(reason: 'superseded' | 'registry-change'): void {
    this.generation += 1
    const generation = this.generation
    this.disposeRecords(reason)
    this.releaseFeedbackTargets()
    this.plan = null
    this.planCacheKey = null
    this.parameterRegistry = null
    this.cameraParameterSchemas = Object.freeze({})
    this.baseParameterValues = Object.freeze({})
    this.modulationRuntime = null
    this.performanceRuntime = null
    this.activeModulationRouteCount = 0
    this.activePerformanceRuleCount = 0
    this.activePerformanceTransientCount = 0
    this.seekDisabledNodes.clear()
    this.outputRendered = false
    this.safeOutputActive = true
    this.lastResetGeneration = -1
    this.textures.clearPublishedOutputs()

    const composition = this.configuration.composition
    if (!composition) {
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
        severity: 'info',
        message: 'Cinema graph executor has no active composition and is rendering the safe output.',
        attribution: { stage: 'graph-executor' },
      }))
      this.emitSnapshot()
      return
    }

    const definitionResult = createCinemaDefinitionRegistryFromPersistedDefinitions(
      this.configuration.definitions,
      this.runtimeRegistry,
    )
    for (const diagnostic of definitionResult.diagnostics) this.report(diagnostic)

    const key = `${composition.id}:${composition.revision}:${definitionResult.registry.fingerprint}:${this.runtimeRegistry.fingerprint}`
    this.planCacheKey = key
    let compilation = this.planCache.get(key)
    if (!compilation) {
      compilation = compileCinemaCompositionGraph(createRuntimeCompilationComposition(composition), definitionResult.registry)
      this.cachePlan(key, compilation)
    }
    for (const diagnostic of compilation.diagnostics.diagnostics) this.report(diagnostic)
    if (!compilation.ok) {
      this.renderSafeOutput()
      this.emitSnapshot()
      return
    }
    this.plan = compilation.plan
    this.configureFeedbackSources(compilation.plan)
    this.cameraParameterSchemas = createCinemaCameraParameterSchemaMap(composition)

    const resolution = resolveCinemaParameterSnapshot({
      composition,
      registry: definitionResult.registry,
      instance: this.configuration.instance,
      cameraParameterSchemas: this.cameraParameterSchemas,
    })
    for (const diagnostic of resolution.diagnostics.diagnostics) this.report(diagnostic)
    this.parameterRegistry = definitionResult.registry
    this.baseParameterValues = resolution.values
    this.modulationRuntime = new CinemaModulationRuntime({
      composition,
      registry: definitionResult.registry,
      cameraParameterSchemas: this.cameraParameterSchemas,
    })
    this.performanceRuntime = new CinemaPerformanceRuntime(composition)
    for (const diagnostic of this.performanceRuntime.snapshot.diagnostics.diagnostics) this.report(diagnostic)
    for (const diagnostic of this.modulationRuntime.diagnostics.diagnostics) this.report(diagnostic)
    const valuesByNode = collectNodeValues(resolution.values)
    const assetsByNode = resolveNodeAssetBindings(composition, this.configuration.instance, diagnostic => this.report(diagnostic))
    const authoredById = new Map(composition.nodes.map(node => [node.id, node]))

    for (const nodeId of compilation.plan.nodeOrder) {
      const authored = authoredById.get(nodeId)
      const registryEntry = authored ? definitionResult.registry.get(authored.typeId) : undefined
      if (!authored || !registryEntry) {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_NODE_TYPE_MISSING',
          severity: 'error',
          message: `Cinema could not instantiate node "${nodeId}" because its authored definition is unavailable.`,
          attribution: { compositionId: composition.id, nodeId },
        }))
        continue
      }
      const registration = this.runtimeRegistry.getByPluginId(registryEntry.rendererPlugin.id)
      if (!registration || registration.plugin.definition.typeId !== authored.typeId) {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_PLUGIN_UNAVAILABLE',
          severity: 'error',
          message: `Cinema renderer plugin "${registryEntry.rendererPlugin.id}" is unavailable for node "${nodeId}".`,
          attribution: { compositionId: composition.id, nodeId },
          details: { pluginId: String(registryEntry.rendererPlugin.id), typeId: String(authored.typeId) },
        }))
        continue
      }
      if (!compatibleRuntimeDefinition(registryEntry.definition, registration.plugin.definition)) {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_NODE_REGISTRY_INCOMPATIBLE',
          severity: 'error',
          message: `Cinema renderer plugin "${registryEntry.rendererPlugin.id}" does not match the persisted contract for node "${nodeId}".`,
          attribution: { compositionId: composition.id, nodeId },
          details: {
            pluginId: String(registryEntry.rendererPlugin.id),
            persistedVersion: registryEntry.definition.version,
            runtimeVersion: registration.plugin.definition.version,
          },
        }))
        continue
      }
      const unsupported = unsupportedCapabilities(registryEntry.definition, this.platform)
      if (unsupported.length > 0) {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_CAPABILITY_UNAVAILABLE',
          severity: 'error',
          message: `Cinema node "${nodeId}" cannot initialize because required capabilities are unavailable.`,
          attribution: { compositionId: composition.id, nodeId },
          details: { capabilities: unsupported.join(',') },
        }))
        continue
      }

      let renderer: CinemaRenderNode
      try {
        renderer = registration.plugin.createNode(authored)
      } catch (error) {
        this.report(nodeFailureDiagnostic('CINEMA_NODE_INITIALIZE_FAILED', authored, 'factory creation', error))
        continue
      }
      if (!isCinemaRenderNode(renderer, authored)) {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_NODE_INITIALIZE_FAILED',
          severity: 'error',
          message: `Cinema renderer plugin "${registryEntry.rendererPlugin.id}" returned an invalid lifecycle object for node "${nodeId}".`,
          attribution: { compositionId: composition.id, nodeId },
          details: { pluginId: String(registryEntry.rendererPlugin.id), typeId: String(authored.typeId) },
        }))
        continue
      }
      const abortController = new AbortController()
      const record: RuntimeNodeRecord = {
        authored,
        registryEntry,
        renderer,
        abortController,
        status: 'initializing',
        disposed: false,
        values: valuesByNode.get(nodeId) ?? {},
        assets: assetsByNode.get(nodeId) ?? [],
      }
      this.records.set(nodeId, record)
      for (const binding of record.assets) {
        void this.assetManager.prepare(binding, abortController.signal).catch(() => {
          // The manager reports a bounded diagnostic and keeps a deterministic fallback active.
        })
      }

      try {
        const initialized = renderer.initialize({
          node: authored,
          definition: registryEntry.definition,
          viewport: this.viewport,
          platform: this.platform,
          targets: this.targets,
          textures: this.textures,
          webgl: this.webgl,
          assets: record.assets,
          assetManager: this.assetManager,
          diagnostics: this.diagnosticsSink,
          signal: abortController.signal,
        })
        if (isPromiseLike(initialized)) {
          void initialized.then(() => {
            if (this.disposed || generation !== this.generation || abortController.signal.aborted) return
            record.status = 'ready'
            this.resetRecord(record, CINEMA_STATE_RESET_ACTION_IDS.activation, null)
            this.emitSnapshot()
          }).catch(error => {
            if (generation !== this.generation || abortController.signal.aborted) return
            this.failNode(record, 'CINEMA_NODE_INITIALIZE_FAILED', `Cinema node "${nodeId}" failed during initialize.`, error)
            this.emitSnapshot()
          })
        } else {
          record.status = 'ready'
        }
      } catch (error) {
        this.failNode(record, 'CINEMA_NODE_INITIALIZE_FAILED', `Cinema node "${nodeId}" failed during initialize.`, error)
      }
    }

    this.resetAll(CINEMA_STATE_RESET_ACTION_IDS.activation, null)
    this.emitSnapshot()
  }

  private acquireFrameTarget(record: RuntimeNodeRecord, leases: CinemaRenderTargetLease[]): CinemaRenderTargetLease {
    const output = record.registryEntry.definition.output
    const descriptor: CinemaTargetDescriptor = {
      ...output,
      widthScale: 1,
      heightScale: 1,
      filter: 'linear',
      wrap: 'clamp',
      clearColor: [0, 0, 0, 0],
    }
    const feedback = this.feedbackSources.get(record.authored.id)
    if (feedback) {
      this.ensureFeedbackLeases(feedback, descriptor)
      feedback.cursor = (feedback.cursor + 1) % feedback.leases.length
      const lease = feedback.leases[feedback.cursor]
      this.targets.clear(lease)
      return lease
    }

    const lease = this.targets.acquire(record.authored.id, descriptor, 'frame')
    leases.push(lease)
    this.targets.clear(lease)
    return lease
  }

  private resolveInputs(nodeId: CinemaNodeId): Readonly<Partial<Record<CinemaPortId, CinemaTextureView | null>>> {
    const inputs: Partial<Record<CinemaPortId, CinemaTextureView | null>> = {}
    for (const binding of this.plan?.inputBindings ?? []) {
      if (binding.nodeId !== nodeId) continue
      const source = binding.sources[0]
      if (!source) {
        inputs[binding.portId] = null
        continue
      }
      if (source.timing === 'feedback-write') {
        const edge = this.plan?.feedbackEdges.find(candidate => candidate.connectionId === source.connectionId)
        inputs[binding.portId] = edge ? this.resolveFeedbackInput(edge) : null
        continue
      }
      inputs[binding.portId] = this.textures.resolveInput(source.sourceNodeId, source.sourcePortId)
    }
    return inputs
  }

  private resolveFeedbackInput(edge: CinemaCompiledGraphPlan['feedbackEdges'][number]): CinemaTextureView | null {
    const feedback = this.feedbackSources.get(edge.sourceNodeId)
    const historyFrames = Math.max(1, Math.floor(edge.historyFrames))
    if (!feedback || feedback.cursor < 0 || feedback.framesWritten < historyFrames) return null
    const index = positiveModulo(feedback.cursor - historyFrames, feedback.leases.length)
    return this.targets.getReadTexture(feedback.leases[index])
  }

  private publishNodeOutputs(record: RuntimeNodeRecord, lease: CinemaRenderTargetLease): void {
    const colorTexture = this.targets.getReadTexture(lease)
    if (!colorTexture) return
    const maskTexture = this.targets.getReadMaskTexture?.(lease) ?? null
    for (const port of record.registryEntry.definition.outputPorts) {
      this.textures.publishOutput(
        record.authored.id,
        port.id,
        port.dataType === 'mask-texture' && maskTexture ? maskTexture : colorTexture,
      )
    }
    const feedback = this.feedbackSources.get(record.authored.id)
    if (feedback && feedback.cursor >= 0 && feedback.leases[feedback.cursor] === lease) {
      feedback.framesWritten += 1
    }
  }

  private renderNodeFallback(
    authored: Readonly<CinemaNodeDefinition> | null,
    outputNode: boolean,
    leases: CinemaRenderTargetLease[],
    existingTarget?: CinemaRenderTargetLease | null,
  ): void {
    if (outputNode) {
      this.renderSafeOutput()
      return
    }
    if (!authored) return
    const record = this.records.get(authored.id)
    if (!record) return
    const target = existingTarget ?? this.acquireFrameTarget(record, leases)
    this.targets.clear(target)
    this.publishNodeOutputs(record, target)
  }

  private configureFeedbackSources(plan: CinemaCompiledGraphPlan): void {
    for (const edge of plan.feedbackEdges) {
      const historyFrames = Math.max(1, Math.floor(edge.historyFrames))
      const current = this.feedbackSources.get(edge.sourceNodeId)
      if (current) {
        current.maximumHistoryFrames = Math.max(current.maximumHistoryFrames, historyFrames)
        continue
      }
      this.feedbackSources.set(edge.sourceNodeId, {
        sourceNodeId: edge.sourceNodeId,
        maximumHistoryFrames: historyFrames,
        leases: [],
        cursor: -1,
        framesWritten: 0,
      })
    }
  }

  private ensureFeedbackLeases(state: FeedbackSourceState, descriptor: CinemaTargetDescriptor): void {
    if (state.leases.length > 0) return
    const targetCount = state.maximumHistoryFrames + 1
    for (let index = 0; index < targetCount; index += 1) {
      state.leases.push(this.targets.acquire(state.sourceNodeId, descriptor, 'persistent-node'))
    }
  }

  private clearFeedbackHistory(nodeId?: CinemaNodeId): void {
    for (const state of this.feedbackSources.values()) {
      if (nodeId != null && state.sourceNodeId !== nodeId) continue
      for (const lease of state.leases) this.targets.clear(lease)
      state.cursor = -1
      state.framesWritten = 0
    }
  }

  private releaseFeedbackTargets(): void {
    for (const state of this.feedbackSources.values()) {
      for (const lease of state.leases) this.targets.release(lease)
    }
    this.feedbackSources.clear()
  }

  private resetAll(actionId: CinemaNodeResetContext['actionId'], frame: Readonly<CinemaFrameContext> | null): void {
    this.clearFeedbackHistory()
    this.modulationRuntime?.reset()
    this.activeModulationRouteCount = 0
    for (const record of this.records.values()) this.resetRecord(record, actionId, frame)
  }

  private prepareTransportReset(): void {
    this.clearFeedbackHistory()
    this.modulationRuntime?.reset()
    this.activeModulationRouteCount = 0
  }

  private dispatchTransportReset(frame: Readonly<CinemaFrameContext>): void {
    const reasons = frame.transport.reset.reasons
    if (reasons.includes('track-change') || reasons.includes('activation')) {
      this.seekDisabledNodes.clear()
      const actionId = frame.transport.reset.actionIds[0] ?? CINEMA_STATE_RESET_ACTION_IDS.timingDiscontinuity
      for (const record of this.records.values()) this.resetRecord(record, actionId, frame)
      return
    }

    const actionId = frame.transport.reset.actionIds[0] ?? CINEMA_STATE_RESET_ACTION_IDS.seek
    for (const record of this.records.values()) {
      const policy = record.registryEntry.definition.seekPolicy
      switch (policy.mode) {
        case 'stateless':
          break
        case 'reset-at-position':
        case 'deterministic-replay':
        case 'checkpoint-replay':
          this.resetRecord(record, actionId, frame, {
            type: 'seekReconstruction',
            reconstructionMode: policy.mode,
            seed: frame.timing.seeds.musicalPosition,
            eventIdentity: frame.transport.reset.identity ?? undefined,
          })
          break
        case 'unsupported':
          if (policy.fallback === 'safe-output') {
            this.seekDisabledNodes.add(record.authored.id)
            this.reportOnce(createCinemaDiagnostic({
              code: 'CINEMA_CAPABILITY_UNAVAILABLE',
              severity: 'warning',
              message: `Cinema node "${record.authored.id}" entered safe output because its seek policy is unsupported.`,
              attribution: {
                compositionId: this.configuration.composition?.id,
                nodeId: record.authored.id,
                stage: 'performance-runtime',
              },
              details: { policy: policy.mode, fallback: policy.fallback },
            }))
          } else {
            this.resetRecord(record, actionId, frame, {
              type: 'seekReconstruction',
              reconstructionMode: policy.mode,
              seed: frame.timing.seeds.musicalPosition,
              eventIdentity: frame.transport.reset.identity ?? undefined,
            })
          }
          break
      }
    }
  }

  private dispatchPerformanceCommands(
    commands: readonly CinemaPerformanceStateCommand[],
    frame: Readonly<CinemaFrameContext>,
  ): void {
    for (const command of commands) {
      const record = this.records.get(command.nodeId)
      if (!record || record.status !== 'ready') continue
      if (command.type === 'resetFeedback') this.clearFeedbackHistory(command.nodeId)
      this.resetRecord(record, command.actionId, frame, {
        type: command.type,
        eventIdentity: command.eventIdentity,
        seed: command.seed,
      })
    }
  }

  private updateFrameParameterValues(
    frame: Readonly<CinemaFrameContext>,
    performance: Readonly<CinemaPerformanceEvaluation>,
  ): Readonly<Record<string, CinemaParameterValue>> {
    const composition = this.configuration.composition
    const registry = this.parameterRegistry
    const modulationRuntime = this.modulationRuntime
    if (!composition || !registry || !modulationRuntime) return this.baseParameterValues

    const modulation = modulationRuntime.evaluate(frame, this.baseParameterValues)
    this.activeModulationRouteCount = modulation.activeRouteCount
    for (const diagnostic of modulation.diagnostics.diagnostics) this.reportOnce(diagnostic)

    const resolution = resolveCinemaParameterSnapshot({
      composition,
      registry,
      instance: this.configuration.instance,
      cameraParameterSchemas: this.cameraParameterSchemas,
      modulationSnapshot: modulation.values,
      performanceOverrides: performance.parameterOverrides,
      brandColors: frame.brand.colors,
    })
    for (const diagnostic of resolution.diagnostics.diagnostics) this.report(diagnostic)
    const valuesByNode = collectNodeValues(resolution.values)
    for (const [nodeId, record] of this.records) {
      record.values = valuesByNode.get(nodeId) ?? Object.freeze({})
    }
    return resolution.values
  }

  private resetRecord(
    record: RuntimeNodeRecord,
    actionId: CinemaNodeResetContext['actionId'],
    frame: Readonly<CinemaFrameContext> | null,
    command?: Readonly<import('../CinemaRendererContracts').CinemaNodeStateCommand>,
  ): void {
    if (record.status !== 'ready') return
    try {
      const nodeFrame = frame
        ? cameraFrameForCapability(frame, record.registryEntry.definition.capabilities.camera.mode)
        : null
      record.renderer.reset({
        nodeId: record.authored.id,
        actionId,
        frame: nodeFrame,
        ...(nodeFrame ? { seekTargetSec: nodeFrame.transport.audioTimeSec } : {}),
        ...(command ? { command } : {}),
        webgl: this.webgl,
        diagnostics: this.diagnosticsSink,
      })
    } catch (error) {
      this.failNode(record, 'CINEMA_NODE_RESET_FAILED', `Cinema node "${record.authored.id}" failed during reset.`, error)
    }
  }

  private failNode(
    record: RuntimeNodeRecord,
    code: 'CINEMA_NODE_INITIALIZE_FAILED' | 'CINEMA_NODE_RENDER_FAILED' | 'CINEMA_NODE_RESET_FAILED',
    message: string,
    error: unknown,
  ): void {
    if (record.status === 'failed') return
    record.status = 'failed'
    record.abortController.abort()
    this.report(createCinemaDiagnostic({
      code,
      severity: 'error',
      message,
      attribution: {
        compositionId: this.configuration.composition?.id,
        nodeId: record.authored.id,
        stage: 'graph-executor',
      },
      details: { reason: errorMessage(error), typeId: String(record.authored.typeId) },
    }))
    this.disposeRecord(record, code === 'CINEMA_NODE_RENDER_FAILED' ? 'render-failed' : 'setup-failed', 'failure cleanup')
  }

  private disposeRecords(reason: 'unmount' | 'superseded' | 'context-lost' | 'registry-change'): void {
    for (const record of this.records.values()) this.disposeRecord(record, reason, 'dispose')
    this.records.clear()
  }

  private disposeRecord(
    record: RuntimeNodeRecord,
    reason: 'unmount' | 'superseded' | 'setup-failed' | 'render-failed' | 'context-lost' | 'registry-change',
    operation: string,
  ): void {
    if (record.disposed) return
    record.disposed = true
    record.abortController.abort()
    try {
      record.renderer.dispose({
        nodeId: record.authored.id,
        reason,
        webgl: this.webgl,
        diagnostics: this.diagnosticsSink,
      })
    } catch (error) {
      this.report(nodeFailureDiagnostic('CINEMA_NODE_DISPOSE_FAILED', record.authored, operation, error))
    }
  }

  private renderSafeOutput(): void {
    const gl = this.webgl.gl
    this.webgl.bindDefaultFramebuffer(this.viewport)
    this.webgl.resetState()
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.flush()
    this.safeOutputActive = true
    this.outputRendered = false
  }

  private cachePlan(key: string, result: CinemaGraphCompilationResult): void {
    if (this.planCache.has(key)) this.planCache.delete(key)
    this.planCache.set(key, result)
    while (this.planCache.size > this.maximumPlanCacheSize) {
      const oldest = this.planCache.keys().next().value as string | undefined
      if (oldest == null) break
      this.planCache.delete(oldest)
    }
  }

  private reportOnce(diagnostic: CinemaDiagnostic): void {
    if (this.diagnostics.some(existing => existing.id === diagnostic.id)) return
    this.report(diagnostic)
  }

  private report(diagnostic: CinemaDiagnostic): void {
    if (!this.diagnostics.some(existing => existing.id === diagnostic.id)) {
      this.diagnostics.push(diagnostic)
      if (this.diagnostics.length > 100) this.diagnostics.splice(0, this.diagnostics.length - 100)
    }
    this.diagnosticsSink.report(diagnostic)
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot())
  }
}

function collectNodeValues(
  values: Readonly<Record<string, CinemaParameterValue>>,
): ReadonlyMap<CinemaNodeId, Readonly<CinemaParameterValues>> {
  const result = new Map<CinemaNodeId, Record<string, CinemaParameterValue>>()
  for (const [path, value] of Object.entries(values)) {
    const parts = path.split('.')
    if ((parts[0] !== 'nodes' && parts[0] !== 'effects') || parts.length !== 3) continue
    const nodeId = parts[1] as CinemaNodeId
    const parameterId = parts[2]
    const current = result.get(nodeId) ?? {}
    current[parameterId] = value
    result.set(nodeId, current)
  }
  return result
}

function resolveNodeAssetBindings(
  composition: Readonly<CinemaCompositionDefinition>,
  instance: Readonly<CinemaCompositionInstance> | null,
  report: (diagnostic: CinemaDiagnostic) => void,
): ReadonlyMap<CinemaNodeId, readonly Readonly<CinemaAssetBindingDefinition>[]> {
  const overrides = new Map<CinemaAssetBindingId, CinemaCompositionInstance['assetBindingOverrides'][number]['values']>()
  if (instance?.compositionId === composition.id) {
    for (const override of instance.assetBindingOverrides) overrides.set(override.bindingId, override.values)
  }
  const resolved = new Map<CinemaAssetBindingId, Readonly<CinemaAssetBindingDefinition>>()
  for (const binding of composition.assetBindings) {
    const override = overrides.get(binding.id)
    const normalized = normalizeCinemaAssetBinding({ ...binding, ...(override ?? {}) })
    for (const diagnostic of normalized.diagnostics.diagnostics) report(diagnostic)
    if (normalized.value) resolved.set(binding.id, normalized.value)
  }
  const byNode = new Map<CinemaNodeId, readonly Readonly<CinemaAssetBindingDefinition>[]>()
  for (const node of composition.nodes) {
    const assets = (node.assetBindingIds ?? [])
      .map(bindingId => resolved.get(bindingId))
      .filter((binding): binding is Readonly<CinemaAssetBindingDefinition> => binding != null)
    byNode.set(node.id, Object.freeze(assets))
  }
  return byNode
}

function createRuntimeCompilationComposition(
  composition: Readonly<CinemaCompositionDefinition>,
): CinemaCompositionDefinition {
  const runtimeEnabledNodeIds = new Set<CinemaNodeId>()
  for (const rule of composition.performanceRules) {
    if (!rule.enabled) continue
    for (const action of rule.actions) {
      if ((action.type === 'set-node-enabled' || action.type === 'set-effect-enabled') && action.enabled) {
        runtimeEnabledNodeIds.add(action.nodeId)
      }
    }
  }
  if (runtimeEnabledNodeIds.size === 0) return composition as CinemaCompositionDefinition
  return {
    ...composition,
    nodes: composition.nodes.map(node => runtimeEnabledNodeIds.has(node.id) ? { ...node, enabled: true } : node),
  }
}

function applyPerformanceFrameOverrides(
  frame: Readonly<CinemaFrameContext>,
  performance: Readonly<CinemaPerformanceEvaluation>,
): Readonly<CinemaFrameContext> {
  const hasPaletteOverride = Object.keys(performance.paletteOverrides).length > 0
  const hasCameraOverride = performance.activeCameraId != null
  if (!hasPaletteOverride && !hasCameraOverride) return frame
  return Object.freeze({
    ...frame,
    ...(hasCameraOverride ? { activeCameraId: performance.activeCameraId } : {}),
    ...(hasPaletteOverride
      ? {
          brand: Object.freeze({
            available: true,
            colors: Object.freeze({ ...frame.brand.colors, ...performance.paletteOverrides }),
          }),
        }
      : {}),
  })
}

function emptyPerformanceEvaluation(): CinemaPerformanceEvaluation {
  return Object.freeze({
    parameterOverrides: Object.freeze({}),
    nodeEnabledOverrides: Object.freeze({}),
    activeCameraId: null,
    paletteOverrides: Object.freeze({}),
    stateCommands: Object.freeze([]),
    emittedEvents: Object.freeze([]),
    activeRuleCount: 0,
    activeTransientCount: 0,
    diagnostics: createCinemaDiagnosticSnapshot([]),
  })
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function configurationKey(configuration: GraphConfiguration, runtimeFingerprint: string): string {
  const composition = configuration.composition
  if (!composition) return `none:${runtimeFingerprint}:${definitionFingerprint(configuration.definitions)}`
  const instance = configuration.instance
  return [
    composition.id,
    composition.revision,
    instance?.id ?? 'base',
    instance?.revision ?? 0,
    definitionFingerprint(configuration.definitions),
    runtimeFingerprint,
  ].join(':')
}

function definitionFingerprint(definitions: readonly CinemaPersistedDefinition[]): string {
  return definitions
    .map(definition => `${definition.id}:${definition.definition.version}:${definition.rendererPluginId}`)
    .sort(compareStrings)
    .join('|')
}

function nodeFailureDiagnostic(
  code: 'CINEMA_NODE_INITIALIZE_FAILED' | 'CINEMA_NODE_DISPOSE_FAILED',
  node: Readonly<CinemaNodeDefinition>,
  operation: string,
  error: unknown,
): CinemaDiagnostic {
  return createCinemaDiagnostic({
    code,
    severity: 'error',
    message: `Cinema node "${node.id}" failed during ${operation}.`,
    attribution: { nodeId: node.id, stage: 'graph-executor' },
    details: { reason: errorMessage(error), typeId: String(node.typeId) },
  })
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return value != null && typeof (value as PromiseLike<void>).then === 'function'
}


function isCinemaRenderNode(value: unknown, authored: Readonly<CinemaNodeDefinition>): value is CinemaRenderNode {
  if (value == null || typeof value !== 'object') return false
  const candidate = value as Partial<CinemaRenderNode>
  return candidate.nodeId === authored.id
    && candidate.typeId === authored.typeId
    && typeof candidate.initialize === 'function'
    && typeof candidate.resize === 'function'
    && typeof candidate.render === 'function'
    && typeof candidate.reset === 'function'
    && typeof candidate.dispose === 'function'
}

function compatibleRuntimeDefinition(
  persisted: Readonly<import('../CinemaRendererContracts').CinemaNodeTypeDefinition>,
  runtime: Readonly<import('../CinemaRendererContracts').CinemaNodeTypeDefinition>,
): boolean {
  return persisted.typeId === runtime.typeId
    && persisted.version === runtime.version
    && persisted.family === runtime.family
    && portFingerprint(persisted.inputPorts) === portFingerprint(runtime.inputPorts)
    && portFingerprint(persisted.outputPorts) === portFingerprint(runtime.outputPorts)
    && parameterFingerprint(persisted.parameters) === parameterFingerprint(runtime.parameters)
    && JSON.stringify(persisted.output) === JSON.stringify(runtime.output)
}

function portFingerprint(ports: readonly import('../CinemaDomain').CinemaPortDefinition[]): string {
  return ports.map(port => [
    port.id, port.direction, port.dataType, port.cardinality ?? 'one', port.required === true ? 'required' : 'optional',
  ].join(':')).sort(compareStrings).join('|')
}

function parameterFingerprint(parameters: readonly import('../CinemaDomain').CinemaParameterDefinition[]): string {
  return parameters.map(parameter => `${parameter.id}:${parameter.type}`).sort(compareStrings).join('|')
}

function unsupportedCapabilities(
  definition: Readonly<import('../CinemaRendererContracts').CinemaNodeTypeDefinition>,
  platform: Readonly<CinemaPlatformCapabilities>,
): string[] {
  const unavailable: string[] = []
  for (const [capability, required] of Object.entries(definition.capabilities.requires)) {
    if (required == null || required === false) continue
    const actual = platform[capability as keyof CinemaPlatformCapabilities]
    if (typeof required === 'boolean') {
      if (actual !== true) unavailable.push(capability)
    } else if (typeof actual !== 'number' || actual < required) {
      unavailable.push(`${capability}>=${required}`)
    }
  }
  return unavailable.sort(compareStrings)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

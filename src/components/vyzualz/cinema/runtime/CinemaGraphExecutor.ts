import type {
  CinemaAssetBindingDefinition,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaNodeDefinition,
  CinemaParameterValue,
  CinemaParameterValues,
} from '../CinemaDomain'
import {
  compileCinemaCompositionGraph,
  type CinemaCompiledGraphPlan,
  type CinemaGraphCompilationResult,
} from '../CinemaGraphCompiler'
import type {
  CinemaAssetBindingId,
  CinemaNodeId,
  CinemaPortId,
} from '../CinemaIdentifiers'
import type { CinemaNodeDefinitionRegistry, CinemaNodeRegistryEntry } from '../CinemaNodeRegistry'
import type { CinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import {
  CINEMA_STATE_RESET_ACTION_IDS,
  type CinemaFrameContext,
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
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import { createCinemaDefinitionRegistryFromPersistedDefinitions } from '../CinemaDefinitionRegistry'
import { CinemaRenderTargetPool } from './CinemaRenderTargetPool'
import { CinemaTextureManager } from './CinemaTextureManager'

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
  diagnostics: CinemaDiagnosticSnapshot
}

export interface CinemaGraphExecutorOptions {
  runtimeRegistry: CinemaRuntimeNodeRegistry
  platform: Readonly<CinemaPlatformCapabilities>
  targets: CinemaRenderTargetPool
  textures: CinemaTextureManager
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
  private baseParameterValues: Readonly<Record<string, CinemaParameterValue>> = Object.freeze({})
  private modulationRuntime: CinemaModulationRuntime | null = null
  private activeModulationRouteCount = 0
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

    if (frame.transport.reset.required && frame.transport.reset.generation !== this.lastResetGeneration) {
      this.lastResetGeneration = frame.transport.reset.generation
      const actions = frame.transport.reset.actionIds.length > 0
        ? frame.transport.reset.actionIds
        : [CINEMA_STATE_RESET_ACTION_IDS.timingDiscontinuity]
      for (const actionId of actions) this.resetAll(actionId, frame)
    }

    this.updateFrameParameterValues(frame)

    const frameLeases: CinemaRenderTargetLease[] = []
    let frameFallbackUsed = false
    this.textures.clearPublishedOutputs()
    try {
      for (const nodeId of this.plan.nodeOrder) {
        const record = this.records.get(nodeId)
        const outputNode = nodeId === this.plan.output.nodeId
        if (!record || record.status !== 'ready') {
          frameFallbackUsed = true
          this.renderNodeFallback(record?.authored ?? null, outputNode, frameLeases)
          continue
        }

        const target = outputNode ? null : this.acquireFrameTarget(record, frameLeases)
        const inputs = this.resolveInputs(nodeId)
        try {
          record.renderer.render({
            nodeId,
            frame,
            viewport: this.viewport,
            values: record.values,
            assets: record.assets,
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
    this.baseParameterValues = Object.freeze({})
    this.modulationRuntime = null
    this.activeModulationRouteCount = 0
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
      compilation = compileCinemaCompositionGraph(composition, definitionResult.registry)
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

    const resolution = resolveCinemaParameterSnapshot({
      composition,
      registry: definitionResult.registry,
      instance: this.configuration.instance,
    })
    for (const diagnostic of resolution.diagnostics.diagnostics) this.report(diagnostic)
    this.parameterRegistry = definitionResult.registry
    this.baseParameterValues = resolution.values
    this.modulationRuntime = new CinemaModulationRuntime({
      composition,
      registry: definitionResult.registry,
    })
    for (const diagnostic of this.modulationRuntime.diagnostics.diagnostics) this.report(diagnostic)
    const valuesByNode = collectNodeValues(resolution.values)
    const assetsByNode = resolveNodeAssetBindings(composition, this.configuration.instance)
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
    const index = positiveModulo(feedback.cursor - (historyFrames - 1), feedback.leases.length)
    return this.targets.getReadTexture(feedback.leases[index])
  }

  private publishNodeOutputs(record: RuntimeNodeRecord, lease: CinemaRenderTargetLease): void {
    const texture = this.targets.getReadTexture(lease)
    if (!texture) return
    for (const port of record.registryEntry.definition.outputPorts) {
      this.textures.publishOutput(record.authored.id, port.id, texture)
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

  private clearFeedbackHistory(): void {
    for (const state of this.feedbackSources.values()) {
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

  private resetAll(actionId: string, frame: Readonly<CinemaFrameContext> | null): void {
    this.clearFeedbackHistory()
    this.modulationRuntime?.reset()
    this.activeModulationRouteCount = 0
    for (const record of this.records.values()) this.resetRecord(record, actionId, frame)
  }

  private updateFrameParameterValues(frame: Readonly<CinemaFrameContext>): void {
    const composition = this.configuration.composition
    const registry = this.parameterRegistry
    const modulationRuntime = this.modulationRuntime
    if (!composition || !registry || !modulationRuntime) return

    const modulation = modulationRuntime.evaluate(frame, this.baseParameterValues)
    this.activeModulationRouteCount = modulation.activeRouteCount
    for (const diagnostic of modulation.diagnostics.diagnostics) this.reportOnce(diagnostic)

    const resolution = resolveCinemaParameterSnapshot({
      composition,
      registry,
      instance: this.configuration.instance,
      modulationSnapshot: modulation.values,
    })
    for (const diagnostic of resolution.diagnostics.diagnostics) this.report(diagnostic)
    const valuesByNode = collectNodeValues(resolution.values)
    for (const [nodeId, record] of this.records) {
      record.values = valuesByNode.get(nodeId) ?? Object.freeze({})
    }
  }

  private resetRecord(
    record: RuntimeNodeRecord,
    actionId: string,
    frame: Readonly<CinemaFrameContext> | null,
  ): void {
    if (record.status !== 'ready') return
    try {
      record.renderer.reset({
        nodeId: record.authored.id,
        actionId: actionId as import('../CinemaRendererContracts').CinemaStateResetActionId,
        frame,
        ...(frame ? { seekTargetSec: frame.transport.audioTimeSec } : {}),
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
): ReadonlyMap<CinemaNodeId, readonly Readonly<CinemaAssetBindingDefinition>[]> {
  const overrides = new Map<CinemaAssetBindingId, CinemaCompositionInstance['assetBindingOverrides'][number]['values']>()
  if (instance?.compositionId === composition.id) {
    for (const override of instance.assetBindingOverrides) overrides.set(override.bindingId, override.values)
  }
  const resolved = new Map<CinemaAssetBindingId, Readonly<CinemaAssetBindingDefinition>>()
  for (const binding of composition.assetBindings) {
    const override = overrides.get(binding.id)
    resolved.set(binding.id, Object.freeze({ ...binding, ...(override ?? {}) }))
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

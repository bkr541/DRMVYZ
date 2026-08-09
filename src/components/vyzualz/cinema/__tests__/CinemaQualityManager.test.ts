import { describe, expect, it } from 'vitest'
import {
  CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  CINEMA_STAGE16_REFERENCE_COMPOSITION,
  CinemaQualityManager,
  CinemaRuntimeDiagnosticsStore,
  createCinemaDiagnosticSnapshot,
  compileCinemaCompositionGraph,
  createCinemaDefinitionRegistryFromPersisted,
  type CinemaCompositionDefinition,
  type CinemaNodeId,
  type CinemaRenderTargetPoolDiagnostics,
} from '..'

const HEAVY_TARGETS: CinemaRenderTargetPoolDiagnostics = {
  createdAllocationCount: 30,
  reusedAllocationCount: 0,
  destroyedAllocationCount: 0,
  activeLeaseCount: 18,
  pooledAllocationCount: 12,
  maximumPooledAllocationCount: 24,
  maximumTextureSize: 8192,
  totalAllocationCount: 30,
  estimatedAllocationMemoryMb: 512,
  activeLeaseCountByOwner: {},
  viewport: { width: 1920, height: 1080, dpr: 1 },
}

function setup() {
  const registryResult = createCinemaDefinitionRegistryFromPersisted(
    CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
    CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  )
  const compilation = compileCinemaCompositionGraph(CINEMA_STAGE16_REFERENCE_COMPOSITION, registryResult.registry)
  if (!compilation.plan) throw new Error('Stage 16 reference composition did not compile for Stage 17 quality tests.')
  return { registry: registryResult.registry, plan: compilation.plan }
}

describe('Cinema Stage 17 graph-aware quality manager', () => {
  it('budgets by graph cost and preserves foreground/output quality ahead of background nodes', () => {
    const { registry, plan } = setup()
    const manager = new CinemaQualityManager({ downgradeHysteresisFrames: 1, upgradeHysteresisFrames: 4 })
    const snapshot = manager.evaluate({
      composition: CINEMA_STAGE16_REFERENCE_COMPOSITION,
      plan,
      registry,
      viewport: { width: 1920, height: 1080, dpr: 1 },
      targets: HEAVY_TARGETS,
    })

    expect(snapshot.pressure).toBe('critical')
    expect(['low', 'medium']).toContain(snapshot.selectedTier)
    expect(snapshot.estimatedGraphCostScore).toBeGreaterThan(0)
    expect(snapshot.estimatedTargetMemoryMb).toBe(512)

    const authoredById = new Map(CINEMA_STAGE16_REFERENCE_COMPOSITION.nodes.map(node => [node.id, node]))
    const isAdaptive = (nodeId: CinemaNodeId) => {
      const authored = authoredById.get(nodeId)
      return authored ? registry.get(authored.typeId)?.quality.adaptive === true : false
    }
    const output = snapshot.nodeDecisions.find(decision => decision.role === 'output')
    const foreground = snapshot.nodeDecisions.find(decision => decision.role === 'foreground' && isAdaptive(decision.nodeId))
    const background = snapshot.nodeDecisions.find(decision => decision.role === 'background' && isAdaptive(decision.nodeId))
    expect(output).toMatchObject({ resolutionScale: 1, skip: false })
    expect(foreground).toBeDefined()
    expect(background).toBeDefined()
    expect(background!.resolutionScale).toBeLessThanOrEqual(foreground!.resolutionScale)
    expect(background!.simulationScale).toBeLessThanOrEqual(foreground!.simulationScale)
  })

  it('freezes transparent nodes and skips disabled nodes without rewriting authored state', () => {
    const { registry, plan } = setup()
    const baselineManager = new CinemaQualityManager({ downgradeHysteresisFrames: 1 })
    const baseline = baselineManager.evaluate({
      composition: CINEMA_STAGE16_REFERENCE_COMPOSITION,
      plan,
      registry,
      viewport: { width: 1280, height: 720, dpr: 1 },
      targets: { ...HEAVY_TARGETS, totalAllocationCount: 0, estimatedAllocationMemoryMb: 0, activeLeaseCount: 0, pooledAllocationCount: 0 },
    })
    const skippableIds = baseline.nodeDecisions.filter(decision => decision.role !== 'output').map(decision => decision.nodeId)
    expect(skippableIds.length).toBeGreaterThanOrEqual(2)
    const transparentId = skippableIds[0] as CinemaNodeId
    const disabledId = skippableIds[1] as CinemaNodeId

    const composition: CinemaCompositionDefinition = {
      ...CINEMA_STAGE16_REFERENCE_COMPOSITION,
      nodes: CINEMA_STAGE16_REFERENCE_COMPOSITION.nodes.map(node => (
        node.id === transparentId ? { ...node, opacity: 0 } : node
      )),
    }
    const manager = new CinemaQualityManager({ downgradeHysteresisFrames: 1 })
    const snapshot = manager.evaluate({
      composition,
      plan,
      registry,
      viewport: { width: 1280, height: 720, dpr: 1 },
      targets: { ...HEAVY_TARGETS, totalAllocationCount: 0, estimatedAllocationMemoryMb: 0, activeLeaseCount: 0, pooledAllocationCount: 0 },
      enabledOverrides: { [disabledId]: false },
    })

    expect(manager.getDecision(transparentId)).toMatchObject({ visibility: 'transparent', skip: true, freeze: true })
    expect(manager.getDecision(disabledId)).toMatchObject({ visibility: 'disabled', skip: true, freeze: false })
    expect(snapshot.skippedNodeCount).toBeGreaterThanOrEqual(2)
    expect(snapshot.frozenNodeCount).toBeGreaterThanOrEqual(1)
    expect(CINEMA_STAGE16_REFERENCE_COMPOSITION.nodes.find(node => node.id === transparentId)?.opacity).not.toBe(0)
  })


  it('bounds frame samples, recovery events, and telemetry snapshot history', () => {
    const { registry, plan } = setup()
    const manager = new CinemaQualityManager({ downgradeHysteresisFrames: 1 })
    const quality = manager.evaluate({
      composition: CINEMA_STAGE16_REFERENCE_COMPOSITION,
      plan,
      registry,
      viewport: { width: 1280, height: 720, dpr: 1 },
      targets: { ...HEAVY_TARGETS, totalAllocationCount: 0, estimatedAllocationMemoryMb: 0, activeLeaseCount: 0, pooledAllocationCount: 0 },
    })
    const store = new CinemaRuntimeDiagnosticsStore(5, 3, 2)
    for (let index = 0; index < 12; index += 1) store.recordFrameTime(index + 1)
    for (let index = 0; index < 5; index += 1) {
      store.recordRecovery({ type: 'restore-succeeded', contextGeneration: index + 2, frameCount: index, message: null })
    }
    const graph = {
      compositionId: CINEMA_STAGE16_REFERENCE_COMPOSITION.id,
      compositionRevision: CINEMA_STAGE16_REFERENCE_COMPOSITION.revision,
      planCacheKey: 'stage17-test',
      planCacheSize: 1,
      activeNodeCount: quality.nodeDecisions.length,
      initializedNodeCount: quality.nodeDecisions.length,
      failedNodeCount: 0,
      outputNodeId: String(plan.output.nodeId),
      outputRendered: true,
      safeOutputActive: false,
      modulationRouteCount: 0,
      activeModulationRouteCount: 0,
      performanceRuleCount: 0,
      activePerformanceRuleCount: 0,
      activePerformanceTransientCount: 0,
      parameterResolutionCount: 0,
      parameterReuseCount: 0,
      snapshotPublicationCount: 0,
      profile: { sampleCount: 0, performanceMs: 0, qualityMs: 0, parameterMs: 0, cameraMs: 0, graphRenderMs: 0 },
      quality,
      diagnostics: createCinemaDiagnosticSnapshot([]),
    }
    const capture = () => store.capture({
      phase: 'running', contextGeneration: 6, contextLost: false, frameCount: 12,
      graph, diagnostics: createCinemaDiagnosticSnapshot([]), targets: HEAVY_TARGETS,
      textures: { textureViewCount: 4, publishedOutputCount: 2 },
      assets: { sourceCount: 1, resourceCount: 1, readyCount: 1 },
    })
    capture()
    const snapshot = capture()
    capture()

    expect(snapshot.frameTime).toMatchObject({ sampleCount: 5, lastMs: 12, maxMs: 12 })
    expect(snapshot.recoveryEvents).toHaveLength(3)
    expect(snapshot.context.recoveryCount).toBe(5)
    expect(store.getHistory()).toHaveLength(2)
  })

  it('uses hysteresis so one slow frame does not oscillate the selected tier', () => {
    const { registry, plan } = setup()
    const manager = new CinemaQualityManager({ downgradeHysteresisFrames: 3, upgradeHysteresisFrames: 6 })
    const targets = { ...HEAVY_TARGETS, totalAllocationCount: 0, estimatedAllocationMemoryMb: 0, activeLeaseCount: 0, pooledAllocationCount: 0 }
    const evaluate = () => manager.evaluate({
      composition: CINEMA_STAGE16_REFERENCE_COMPOSITION,
      plan,
      registry,
      viewport: { width: 1280, height: 720, dpr: 1 },
      targets,
    })

    const initialTier = evaluate().selectedTier
    manager.observeFrameTime(45)
    expect(evaluate().selectedTier).toBe(initialTier)
    manager.observeFrameTime(45)
    expect(evaluate().selectedTier).toBe(initialTier)
    manager.observeFrameTime(45)
    expect(evaluate().selectedTier).not.toBe(initialTier)
  })

  it('degrades from sustained presentation or GPU pressure even when CPU submission is fast', () => {
    const { registry, plan } = setup()
    const targets = { ...HEAVY_TARGETS, totalAllocationCount: 0, estimatedAllocationMemoryMb: 0, activeLeaseCount: 0, pooledAllocationCount: 0 }
    const evaluate = (manager: CinemaQualityManager) => manager.evaluate({
      composition: CINEMA_STAGE16_REFERENCE_COMPOSITION,
      plan,
      registry,
      viewport: { width: 1280, height: 720, dpr: 1 },
      targets,
    })

    const presentationManager = new CinemaQualityManager({ downgradeHysteresisFrames: 2 })
    presentationManager.observeFrameMetrics({ cpuMs: 2, presentationMs: 42, gpuMs: null })
    evaluate(presentationManager)
    presentationManager.observeFrameMetrics({ cpuMs: 2, presentationMs: 42, gpuMs: null })
    const presentation = evaluate(presentationManager)
    expect(presentation.selectedTier).not.toBe('high')
    expect(presentation.averageCpuTimeMs).toBe(2)
    expect(presentation.averagePresentationTimeMs).toBe(42)

    const gpuManager = new CinemaQualityManager({ downgradeHysteresisFrames: 2 })
    gpuManager.observeFrameMetrics({ cpuMs: 2, presentationMs: 16, gpuMs: 38 })
    evaluate(gpuManager)
    gpuManager.observeFrameMetrics({ cpuMs: 2, presentationMs: 16, gpuMs: 38 })
    const gpu = evaluate(gpuManager)
    expect(gpu.selectedTier).not.toBe('high')
    expect(gpu.averageGpuTimeMs).toBe(38)
  })
})

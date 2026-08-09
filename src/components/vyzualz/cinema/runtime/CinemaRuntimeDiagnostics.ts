import type { CinemaDiagnosticSnapshot } from '../CinemaDiagnostics'
import type { CinemaNodeId } from '../CinemaIdentifiers'
import type { CinemaRuntimePhase } from './CinemaRuntime'
import type { CinemaGraphExecutorSnapshot } from './CinemaGraphExecutor'
import type { CinemaRenderTargetPoolDiagnostics } from './CinemaRenderTargetPool'

export const CINEMA_RUNTIME_DIAGNOSTICS_VERSION = 1 as const

export type CinemaRecoveryEventType = 'context-lost' | 'restore-started' | 'restore-succeeded' | 'restore-failed'

export interface CinemaRecoveryEvent {
  sequence: number
  type: CinemaRecoveryEventType
  contextGeneration: number
  frameCount: number
  message: string | null
}

export interface CinemaRuntimeNodeDiagnosticSnapshot {
  nodeId: CinemaNodeId
  role: 'output' | 'foreground' | 'background'
  tier: 'low' | 'medium' | 'high' | 'ultra'
  visibility: 'visible' | 'transparent' | 'disabled' | 'failed'
  degraded: boolean
  skipped: boolean
  frozen: boolean
  reasons: readonly string[]
  diagnosticCount: number
  errorCount: number
}

export interface CinemaRuntimeDiagnosticsSnapshot {
  version: typeof CINEMA_RUNTIME_DIAGNOSTICS_VERSION
  sequence: number
  historyDepth: number
  composition: Readonly<{
    id: string | null
    revision: number | null
    activeNodeCount: number
    initializedNodeCount: number
    failedNodeCount: number
  }>
  nodes: readonly CinemaRuntimeNodeDiagnosticSnapshot[]
  targets: Readonly<CinemaRenderTargetPoolDiagnostics>
  textures: Readonly<{ textureViewCount: number; publishedOutputCount: number }>
  assets: Readonly<{ sourceCount: number; resourceCount: number; readyCount: number }>
  context: Readonly<{
    phase: CinemaRuntimePhase
    generation: number
    lost: boolean
    recoveryCount: number
    lastRecoveryStatus: 'none' | 'lost' | 'restoring' | 'restored' | 'failed'
  }>
  frameTime: Readonly<{
    sampleCount: number
    lastMs: number
    averageMs: number
    p95Ms: number
    maxMs: number
  }>
  presentationTime: Readonly<{
    sampleCount: number
    lastMs: number
    averageMs: number
    p95Ms: number
    maxMs: number
  }>
  gpuTime: Readonly<{
    availableSampleCount: number
    lastMs: number | null
    averageMs: number | null
    p95Ms: number | null
    maxMs: number | null
  }>
  executorProfile: CinemaGraphExecutorSnapshot['profile']
  quality: CinemaGraphExecutorSnapshot['quality']
  adapters: Readonly<{
    diagnosticCount: number
    errorCount: number
  }>
  recoveryEvents: readonly CinemaRecoveryEvent[]
}


export function createCinemaEmptyRuntimeDiagnosticsSnapshot(): CinemaRuntimeDiagnosticsSnapshot {
  return Object.freeze({
    version: CINEMA_RUNTIME_DIAGNOSTICS_VERSION,
    sequence: 0,
    historyDepth: 0,
    composition: Object.freeze({ id: null, revision: null, activeNodeCount: 0, initializedNodeCount: 0, failedNodeCount: 0 }),
    nodes: Object.freeze([]),
    targets: Object.freeze({
      createdAllocationCount: 0,
      reusedAllocationCount: 0,
      destroyedAllocationCount: 0,
      activeLeaseCount: 0,
      pooledAllocationCount: 0,
      maximumPooledAllocationCount: 0,
      maximumTextureSize: 0,
      totalAllocationCount: 0,
      estimatedAllocationMemoryMb: 0,
      activeLeaseCountByOwner: Object.freeze({}),
      viewport: Object.freeze({ width: 1, height: 1, dpr: 1 }),
    }),
    textures: Object.freeze({ textureViewCount: 0, publishedOutputCount: 0 }),
    assets: Object.freeze({ sourceCount: 0, resourceCount: 0, readyCount: 0 }),
    context: Object.freeze({ phase: 'initializing', generation: 1, lost: false, recoveryCount: 0, lastRecoveryStatus: 'none' }),
    frameTime: Object.freeze({ sampleCount: 0, lastMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0 }),
    presentationTime: Object.freeze({ sampleCount: 0, lastMs: 0, averageMs: 0, p95Ms: 0, maxMs: 0 }),
    gpuTime: Object.freeze({ availableSampleCount: 0, lastMs: null, averageMs: null, p95Ms: null, maxMs: null }),
    executorProfile: Object.freeze({ sampleCount: 0, performanceMs: 0, qualityMs: 0, parameterMs: 0, cameraMs: 0, graphRenderMs: 0 }),
    quality: Object.freeze({
      selectedTier: 'high', desiredTier: 'high', pressure: 'nominal', estimatedGraphCostScore: 0, graphBudgetScore: 0,
      targetAllocationCount: 0, estimatedTargetMemoryMb: 0, averageFrameTimeMs: 0, p95FrameTimeMs: 0,
      averageCpuTimeMs: 0, averagePresentationTimeMs: 0, averageGpuTimeMs: null,
      degradedNodeCount: 0, skippedNodeCount: 0, frozenNodeCount: 0, nodeDecisions: Object.freeze([]),
    }),
    adapters: Object.freeze({ diagnosticCount: 0, errorCount: 0 }),
    recoveryEvents: Object.freeze([]),
  })
}

interface CaptureInput {
  phase: CinemaRuntimePhase
  contextGeneration: number
  contextLost: boolean
  frameCount: number
  graph: Readonly<CinemaGraphExecutorSnapshot>
  diagnostics: Readonly<CinemaDiagnosticSnapshot>
  targets: Readonly<CinemaRenderTargetPoolDiagnostics>
  textures: Readonly<{ textureViewCount: number; publishedOutputCount: number }>
  assets: Readonly<{ sourceCount: number; resourceCount: number; readyCount: number }>
}

/**
 * Runtime-only bounded telemetry store. It intentionally stores neither authored
 * Cinema state nor GPU/media objects, so a project save cannot accidentally
 * capture transient frame or recovery data.
 */
export class CinemaRuntimeDiagnosticsStore {
  private readonly frameTimes: number[] = []
  private readonly presentationTimes: number[] = []
  private readonly gpuTimes: number[] = []
  private readonly recoveryEvents: CinemaRecoveryEvent[] = []
  private readonly history: CinemaRuntimeDiagnosticsSnapshot[] = []
  private sequence = 0
  private recoverySequence = 0
  private successfulRecoveryCount = 0

  constructor(
    private readonly frameTimeLimit = 120,
    private readonly recoveryEventLimit = 16,
    private readonly snapshotHistoryLimit = 16,
  ) {}

  recordFrameTime(frameTimeMs: number): void {
    this.recordFrameMetrics({ cpuMs: frameTimeMs, presentationMs: frameTimeMs, gpuMs: null })
  }

  recordFrameMetrics(metrics: { cpuMs: number; presentationMs: number; gpuMs: number | null }): void {
    pushSample(this.frameTimes, metrics.cpuMs, this.frameTimeLimit)
    pushSample(this.presentationTimes, metrics.presentationMs, this.frameTimeLimit)
    if (metrics.gpuMs != null) pushSample(this.gpuTimes, metrics.gpuMs, this.frameTimeLimit)
  }

  recordRecovery(input: Omit<CinemaRecoveryEvent, 'sequence'>): void {
    if (input.type === 'restore-succeeded') this.successfulRecoveryCount += 1
    this.recoveryEvents.push(Object.freeze({ sequence: ++this.recoverySequence, ...input }))
    trimHead(this.recoveryEvents, this.recoveryEventLimit)
  }

  capture(input: CaptureInput): CinemaRuntimeDiagnosticsSnapshot {
    const nodeDiagnostics = new Map<string, { count: number; errors: number }>()
    let adapterDiagnosticCount = 0
    let adapterErrorCount = 0
    for (const diagnostic of input.diagnostics.diagnostics) {
      const nodeId = diagnostic.attribution?.nodeId
      if (nodeId) {
        const current = nodeDiagnostics.get(nodeId) ?? { count: 0, errors: 0 }
        current.count += 1
        if (diagnostic.severity === 'error' || diagnostic.severity === 'fatal') current.errors += 1
        nodeDiagnostics.set(nodeId, current)
      }
      if ((diagnostic.attribution?.stage ?? '').toLowerCase().includes('adapter')) {
        adapterDiagnosticCount += 1
        if (diagnostic.severity === 'error' || diagnostic.severity === 'fatal') adapterErrorCount += 1
      }
    }

    const frameTimes = this.frameTimes
    const sortedFrameTimes = [...frameTimes].sort((left, right) => left - right)
    const presentationTimes = this.presentationTimes
    const sortedPresentationTimes = [...presentationTimes].sort((left, right) => left - right)
    const gpuTimes = this.gpuTimes
    const sortedGpuTimes = [...gpuTimes].sort((left, right) => left - right)
    const lastRecovery = this.recoveryEvents[this.recoveryEvents.length - 1]
    const recoveryCount = this.successfulRecoveryCount
    const snapshot: CinemaRuntimeDiagnosticsSnapshot = Object.freeze({
      version: CINEMA_RUNTIME_DIAGNOSTICS_VERSION,
      sequence: ++this.sequence,
      historyDepth: Math.min(this.snapshotHistoryLimit, this.history.length + 1),
      composition: Object.freeze({
        id: input.graph.compositionId,
        revision: input.graph.compositionRevision,
        activeNodeCount: input.graph.activeNodeCount,
        initializedNodeCount: input.graph.initializedNodeCount,
        failedNodeCount: input.graph.failedNodeCount,
      }),
      nodes: Object.freeze(input.graph.quality.nodeDecisions.map(decision => {
        const diagnostics = nodeDiagnostics.get(decision.nodeId) ?? { count: 0, errors: 0 }
        return Object.freeze({
          nodeId: decision.nodeId,
          role: decision.role,
          tier: decision.tier,
          visibility: decision.visibility,
          degraded: decision.degraded,
          skipped: decision.skip,
          frozen: decision.freeze,
          reasons: Object.freeze([...decision.reasons]),
          diagnosticCount: diagnostics.count,
          errorCount: diagnostics.errors,
        })
      })),
      targets: Object.freeze({ ...input.targets, activeLeaseCountByOwner: Object.freeze({ ...input.targets.activeLeaseCountByOwner }) }),
      textures: Object.freeze({ ...input.textures }),
      assets: Object.freeze({ ...input.assets }),
      context: Object.freeze({
        phase: input.phase,
        generation: input.contextGeneration,
        lost: input.contextLost,
        recoveryCount,
        lastRecoveryStatus: recoveryStatus(lastRecovery),
      }),
      frameTime: Object.freeze({
        sampleCount: frameTimes.length,
        lastMs: round3(frameTimes[frameTimes.length - 1] ?? 0),
        averageMs: round3(average(frameTimes)),
        p95Ms: round3(percentile(sortedFrameTimes, 0.95)),
        maxMs: round3(sortedFrameTimes[sortedFrameTimes.length - 1] ?? 0),
      }),
      presentationTime: Object.freeze({
        sampleCount: presentationTimes.length,
        lastMs: round3(presentationTimes[presentationTimes.length - 1] ?? 0),
        averageMs: round3(average(presentationTimes)),
        p95Ms: round3(percentile(sortedPresentationTimes, 0.95)),
        maxMs: round3(sortedPresentationTimes[sortedPresentationTimes.length - 1] ?? 0),
      }),
      gpuTime: Object.freeze({
        availableSampleCount: gpuTimes.length,
        lastMs: nullableRound3(gpuTimes[gpuTimes.length - 1]),
        averageMs: gpuTimes.length > 0 ? round3(average(gpuTimes)) : null,
        p95Ms: nullableRound3(gpuTimes.length > 0 ? percentile(sortedGpuTimes, 0.95) : undefined),
        maxMs: nullableRound3(sortedGpuTimes[sortedGpuTimes.length - 1]),
      }),
      executorProfile: input.graph.profile,
      quality: input.graph.quality,
      adapters: Object.freeze({ diagnosticCount: adapterDiagnosticCount, errorCount: adapterErrorCount }),
      recoveryEvents: Object.freeze([...this.recoveryEvents]),
    })
    this.history.push(snapshot)
    trimHead(this.history, this.snapshotHistoryLimit)
    return snapshot
  }

  getHistory(): readonly CinemaRuntimeDiagnosticsSnapshot[] {
    return Object.freeze([...this.history])
  }

  resetFrameHistory(): void {
    this.frameTimes.length = 0
    this.presentationTimes.length = 0
    this.gpuTimes.length = 0
  }
}

function recoveryStatus(event: CinemaRecoveryEvent | undefined): 'none' | 'lost' | 'restoring' | 'restored' | 'failed' {
  if (!event) return 'none'
  if (event.type === 'context-lost') return 'lost'
  if (event.type === 'restore-started') return 'restoring'
  if (event.type === 'restore-succeeded') return 'restored'
  return 'failed'
}

function trimHead<T>(values: T[], maximum: number): void {
  const limit = Math.max(1, Math.floor(maximum))
  if (values.length > limit) values.splice(0, values.length - limit)
}

function pushSample(values: number[], value: number, maximum: number): void {
  if (!Number.isFinite(value) || value < 0) return
  values.push(value)
  trimHead(values, maximum)
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1))
  return sortedValues[index] ?? 0
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function nullableRound3(value: number | undefined): number | null {
  return value == null ? null : round3(value)
}

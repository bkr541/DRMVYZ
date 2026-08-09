import type { CinemaCompositionDefinition, CinemaParameterValue, CinemaParameterValues } from '../CinemaDomain'
import type { CinemaCompiledGraphPlan } from '../CinemaGraphCompiler'
import type { CinemaNodeId, CinemaParameterId } from '../CinemaIdentifiers'
import type { CinemaNodeDefinitionRegistry, CinemaNodeRegistryEntry, CinemaQualityTier } from '../CinemaNodeRegistry'
import type { CinemaViewport } from '../CinemaRendererContracts'
import type { CinemaRenderTargetPoolDiagnostics } from './CinemaRenderTargetPool'

export type CinemaNodeQualityRole = 'output' | 'foreground' | 'background'
export type CinemaQualityPressure = 'nominal' | 'elevated' | 'critical'
export type CinemaNodeVisibilityState = 'visible' | 'transparent' | 'disabled' | 'failed'

export interface CinemaNodeQualityDecision {
  nodeId: CinemaNodeId
  role: CinemaNodeQualityRole
  tier: CinemaQualityTier
  degraded: boolean
  resolutionScale: number
  simulationScale: number
  feedbackHistoryScale: number
  optionalPassTier: number
  estimatedCostScore: number
  visibility: CinemaNodeVisibilityState
  skip: boolean
  freeze: boolean
  reasons: readonly string[]
}

export interface CinemaGraphQualitySnapshot {
  selectedTier: CinemaQualityTier
  desiredTier: CinemaQualityTier
  pressure: CinemaQualityPressure
  estimatedGraphCostScore: number
  graphBudgetScore: number
  targetAllocationCount: number
  estimatedTargetMemoryMb: number
  averageFrameTimeMs: number
  p95FrameTimeMs: number
  averageCpuTimeMs: number
  averagePresentationTimeMs: number
  averageGpuTimeMs: number | null
  degradedNodeCount: number
  skippedNodeCount: number
  frozenNodeCount: number
  nodeDecisions: readonly CinemaNodeQualityDecision[]
}

export interface CinemaQualityManagerOptions {
  targetFrameTimeMs?: number
  frameHistoryLimit?: number
  downgradeHysteresisFrames?: number
  upgradeHysteresisFrames?: number
}

export interface CinemaQualityFrameMetrics {
  cpuMs: number
  presentationMs: number
  gpuMs: number | null
}

const TIER_RANK: Readonly<Record<CinemaQualityTier, number>> = Object.freeze({ low: 0, medium: 1, high: 2, ultra: 3 })
const RANK_TIER: readonly CinemaQualityTier[] = Object.freeze(['low', 'medium', 'high', 'ultra'])
const RESOLUTION_SCALE: Readonly<Record<CinemaQualityTier, number>> = Object.freeze({ low: 0.5, medium: 0.72, high: 1, ultra: 1 })
const SIMULATION_SCALE: Readonly<Record<CinemaQualityTier, number>> = Object.freeze({ low: 0.38, medium: 0.65, high: 0.88, ultra: 1 })
const FEEDBACK_SCALE: Readonly<Record<CinemaQualityTier, number>> = Object.freeze({ low: 0.35, medium: 0.6, high: 0.82, ultra: 1 })
const COST_WEIGHT = Object.freeze({ minimal: 0.5, low: 1, medium: 2, high: 4, extreme: 8 })

/**
 * Runtime-only graph quality controller. It never mutates authored Cinema state.
 * Decisions are deterministic for the same graph, viewport, target pressure, and
 * bounded frame-time history. Hysteresis avoids quality ping-pong around a threshold.
 */
export class CinemaQualityManager {
  private readonly targetFrameTimeMs: number
  private readonly frameHistoryLimit: number
  private readonly downgradeHysteresisFrames: number
  private readonly upgradeHysteresisFrames: number
  private readonly cpuTimes: number[] = []
  private readonly presentationTimes: number[] = []
  private readonly gpuTimes: number[] = []
  private selectedTier: CinemaQualityTier = 'high'
  private pendingTier: CinemaQualityTier | null = null
  private pendingTierFrames = 0
  private decisions = new Map<CinemaNodeId, CinemaNodeQualityDecision>()
  private lastSnapshot: CinemaGraphQualitySnapshot = createCinemaEmptyGraphQualitySnapshot()

  constructor(options: CinemaQualityManagerOptions = {}) {
    this.targetFrameTimeMs = positiveFinite(options.targetFrameTimeMs, 1000 / 60)
    this.frameHistoryLimit = positiveInteger(options.frameHistoryLimit, 120)
    this.downgradeHysteresisFrames = positiveInteger(options.downgradeHysteresisFrames, 3)
    this.upgradeHysteresisFrames = positiveInteger(options.upgradeHysteresisFrames, 24)
  }

  observeFrameTime(frameTimeMs: number): void {
    this.observeFrameMetrics({ cpuMs: frameTimeMs, presentationMs: frameTimeMs, gpuMs: null })
  }

  observeFrameMetrics(metrics: Readonly<CinemaQualityFrameMetrics>): void {
    pushBoundedSample(this.cpuTimes, metrics.cpuMs, this.frameHistoryLimit)
    pushBoundedSample(this.presentationTimes, metrics.presentationMs, this.frameHistoryLimit)
    if (metrics.gpuMs != null) pushBoundedSample(this.gpuTimes, metrics.gpuMs, this.frameHistoryLimit)
  }

  evaluate(input: {
    composition: Readonly<CinemaCompositionDefinition> | null
    plan: Readonly<CinemaCompiledGraphPlan> | null
    registry: CinemaNodeDefinitionRegistry | null
    viewport: Readonly<CinemaViewport>
    targets: Readonly<CinemaRenderTargetPoolDiagnostics>
    enabledOverrides?: Readonly<Partial<Record<CinemaNodeId, boolean>>>
    failedNodeIds?: ReadonlySet<CinemaNodeId>
  }): CinemaGraphQualitySnapshot {
    const { composition, plan, registry } = input
    if (!composition || !plan || !registry) {
      this.decisions.clear()
      this.lastSnapshot = Object.freeze({
        ...createCinemaEmptyGraphQualitySnapshot(),
        selectedTier: this.selectedTier,
        desiredTier: this.selectedTier,
        averageFrameTimeMs: average(this.presentationTimes) || average(this.cpuTimes),
        p95FrameTimeMs: percentile95(this.presentationTimes) || percentile95(this.cpuTimes),
        averageCpuTimeMs: average(this.cpuTimes),
        averagePresentationTimeMs: average(this.presentationTimes),
        averageGpuTimeMs: nullableAverage(this.gpuTimes),
        targetAllocationCount: input.targets.totalAllocationCount,
        estimatedTargetMemoryMb: input.targets.estimatedAllocationMemoryMb,
      })
      return this.lastSnapshot
    }

    const roles = deriveNodeRoles(plan, composition)
    const authoredById = new Map(composition.nodes.map(node => [node.id, node]))
    let graphCost = 0
    for (const nodeId of plan.nodeOrder) {
      const node = authoredById.get(nodeId)
      const entry = node ? registry.get(node.typeId) : undefined
      if (!node || !entry) continue
      const role = roles.get(nodeId) ?? 'background'
      graphCost += estimateNodeCost(entry) * roleCostMultiplier(role)
    }

    const megapixels = Math.max(0.25, (Math.max(1, input.viewport.width) * Math.max(1, input.viewport.height)) / 1_000_000)
    const targetPressure = Math.max(0, input.targets.estimatedAllocationMemoryMb / 256)
      + Math.max(0, input.targets.totalAllocationCount - 12) / 24
    const graphBudget = Math.max(28, 92 / Math.sqrt(megapixels))
    const costRatio = (graphCost / graphBudget) + targetPressure * 0.35
    const averageCpu = average(this.cpuTimes)
    const averagePresentation = average(this.presentationTimes)
    const averageGpu = nullableAverage(this.gpuTimes)
    const avgFrame = averagePresentation || averageCpu
    const p95 = Math.max(percentile95(this.presentationTimes), percentile95(this.cpuTimes), percentile95(this.gpuTimes))
    const desiredTier = desiredTierFor(costRatio, averageCpu, averagePresentation, averageGpu, p95, this.targetFrameTimeMs)
    this.updateSelectedTier(desiredTier)
    const pressure = qualityPressure(costRatio, averageCpu, averagePresentation, averageGpu, this.targetFrameTimeMs)
    // Tier hysteresis owns quality transitions. Instantaneous pressure remains observable,
    // but node-level degradation waits until the selected tier accepts the change so a
    // single spike cannot make background resolution/pass policy oscillate frame-to-frame.
    const decisionPressure: CinemaQualityPressure = this.selectedTier === desiredTier ? pressure : 'nominal'

    const decisions = new Map<CinemaNodeId, CinemaNodeQualityDecision>()
    let degradedNodeCount = 0
    let skippedNodeCount = 0
    let frozenNodeCount = 0

    for (const nodeId of plan.nodeOrder) {
      const node = authoredById.get(nodeId)
      const entry = node ? registry.get(node.typeId) : undefined
      if (!node || !entry) continue
      const role = roles.get(nodeId) ?? 'background'
      const enabled = input.enabledOverrides?.[nodeId] ?? node.enabled
      const failed = input.failedNodeIds?.has(nodeId) === true
      const visibility: CinemaNodeVisibilityState = failed
        ? 'failed'
        : !enabled
          ? 'disabled'
          : node.opacity <= 0.0001 && role !== 'output'
            ? 'transparent'
            : 'visible'
      const tier = resolveNodeTier(this.selectedTier, role, entry, decisionPressure)
      const reasons: string[] = []
      if (tier !== clampTier(this.selectedTier, entry)) reasons.push(role === 'background' ? 'background-priority' : 'node-tier-limit')
      if (decisionPressure !== 'nominal' && tier !== 'ultra') reasons.push(`graph-pressure:${decisionPressure}`)
      if (visibility === 'disabled') reasons.push('disabled')
      if (visibility === 'transparent') reasons.push('transparent')
      if (visibility === 'failed') reasons.push('failed')
      const skip = visibility !== 'visible'
      const freeze = visibility === 'transparent'
      const adaptive = entry.quality.adaptive
      const degraded = adaptive && (
        TIER_RANK[tier] < TIER_RANK[entry.quality.maximumTier]
        || (role === 'background' && decisionPressure !== 'nominal')
      )
      if (degraded) degradedNodeCount += 1
      if (skip) skippedNodeCount += 1
      if (freeze) frozenNodeCount += 1

      decisions.set(nodeId, Object.freeze({
        nodeId,
        role,
        tier,
        degraded,
        resolutionScale: !adaptive || role === 'output' ? 1 : role === 'background' ? RESOLUTION_SCALE[tier] : Math.max(0.72, RESOLUTION_SCALE[tier]),
        simulationScale: adaptive ? SIMULATION_SCALE[tier] : 1,
        feedbackHistoryScale: adaptive ? FEEDBACK_SCALE[tier] : 1,
        optionalPassTier: adaptive ? TIER_RANK[tier] : TIER_RANK.ultra,
        estimatedCostScore: estimateNodeCost(entry),
        visibility,
        skip,
        freeze,
        reasons: Object.freeze(reasons),
      }))
    }

    this.decisions = decisions
    this.lastSnapshot = Object.freeze({
      selectedTier: this.selectedTier,
      desiredTier,
      pressure,
      estimatedGraphCostScore: round3(graphCost),
      graphBudgetScore: round3(graphBudget),
      targetAllocationCount: input.targets.totalAllocationCount,
      estimatedTargetMemoryMb: round3(input.targets.estimatedAllocationMemoryMb),
      averageFrameTimeMs: round3(avgFrame),
      p95FrameTimeMs: round3(p95),
      averageCpuTimeMs: round3(averageCpu),
      averagePresentationTimeMs: round3(averagePresentation),
      averageGpuTimeMs: averageGpu == null ? null : round3(averageGpu),
      degradedNodeCount,
      skippedNodeCount,
      frozenNodeCount,
      nodeDecisions: Object.freeze([...decisions.values()]),
    })
    return this.lastSnapshot
  }

  getDecision(nodeId: CinemaNodeId): Readonly<CinemaNodeQualityDecision> | null {
    return this.decisions.get(nodeId) ?? null
  }

  getSnapshot(): Readonly<CinemaGraphQualitySnapshot> {
    return this.lastSnapshot
  }

  resetTransientHistory(): void {
    this.cpuTimes.length = 0
    this.presentationTimes.length = 0
    this.gpuTimes.length = 0
    this.pendingTier = null
    this.pendingTierFrames = 0
  }

  private updateSelectedTier(desiredTier: CinemaQualityTier): void {
    if (desiredTier === this.selectedTier) {
      this.pendingTier = null
      this.pendingTierFrames = 0
      return
    }
    if (this.pendingTier !== desiredTier) {
      this.pendingTier = desiredTier
      this.pendingTierFrames = 1
    } else {
      this.pendingTierFrames += 1
    }
    const downgrading = TIER_RANK[desiredTier] < TIER_RANK[this.selectedTier]
    const threshold = downgrading ? this.downgradeHysteresisFrames : this.upgradeHysteresisFrames
    if (this.pendingTierFrames < threshold) return
    this.selectedTier = desiredTier
    this.pendingTier = null
    this.pendingTierFrames = 0
  }
}

export function applyCinemaQualityScalars(
  entry: Readonly<CinemaNodeRegistryEntry>,
  values: Readonly<CinemaParameterValues>,
  decision: Readonly<CinemaNodeQualityDecision> | null,
): Readonly<CinemaParameterValues> {
  const scalars = entry.definition.cost.qualityScalars
  if (!decision || !scalars || scalars.length === 0) return values
  let next: Partial<Record<CinemaParameterId, CinemaParameterValue>> | null = null
  for (const scalar of scalars) {
    const current = values[scalar.parameterId]
    if (typeof current !== 'number') continue
    const qualityScalar = scalar[decision.tier]
    if (!Number.isFinite(qualityScalar)) continue
    if (!next) next = { ...values }
    next[scalar.parameterId] = current * qualityScalar
  }
  return next ? Object.freeze(next) : values
}

function deriveNodeRoles(
  plan: Readonly<CinemaCompiledGraphPlan>,
  composition: Readonly<CinemaCompositionDefinition>,
): ReadonlyMap<CinemaNodeId, CinemaNodeQualityRole> {
  const reverse = new Map<CinemaNodeId, CinemaNodeId[]>()
  const explicitForeground = new Set<CinemaNodeId>()
  for (const binding of plan.inputBindings) {
    for (const source of binding.sources) {
      const current = reverse.get(binding.nodeId) ?? []
      current.push(source.sourceNodeId)
      reverse.set(binding.nodeId, current)
      if (String(binding.portId).toLowerCase().includes('foreground')) explicitForeground.add(source.sourceNodeId)
    }
  }
  const distance = new Map<CinemaNodeId, number>([[plan.output.nodeId, 0]])
  const queue: CinemaNodeId[] = [plan.output.nodeId]
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    const nextDistance = (distance.get(nodeId) ?? 0) + 1
    for (const sourceId of reverse.get(nodeId) ?? []) {
      const previous = distance.get(sourceId)
      if (previous != null && previous <= nextDistance) continue
      distance.set(sourceId, nextDistance)
      queue.push(sourceId)
    }
  }
  const authoredById = new Map(composition.nodes.map(node => [node.id, node]))
  return new Map(plan.nodeOrder.map(nodeId => {
    if (nodeId === plan.output.nodeId) return [nodeId, 'output' as const]
    const node = authoredById.get(nodeId)
    const foregroundFamily = node?.family === 'logo' || node?.family === 'text' || node?.family === 'lyrics'
    const nearOutput = (distance.get(nodeId) ?? Number.POSITIVE_INFINITY) <= 1
    return [nodeId, explicitForeground.has(nodeId) || foregroundFamily || nearOutput ? 'foreground' as const : 'background' as const]
  }))
}

function resolveNodeTier(
  selectedTier: CinemaQualityTier,
  role: CinemaNodeQualityRole,
  entry: Readonly<CinemaNodeRegistryEntry>,
  pressure: CinemaQualityPressure,
): CinemaQualityTier {
  if (!entry.quality.adaptive) return entry.quality.maximumTier
  let rank = TIER_RANK[selectedTier]
  if (role === 'output') rank = Math.max(rank, TIER_RANK.high)
  if (role === 'background' && pressure === 'elevated') rank -= 1
  if (role === 'background' && pressure === 'critical') rank -= 2
  if (role === 'foreground' && pressure === 'critical') rank -= 1
  rank = Math.max(TIER_RANK[entry.quality.minimumTier], Math.min(TIER_RANK[entry.quality.maximumTier], rank))
  return RANK_TIER[Math.max(0, Math.min(RANK_TIER.length - 1, rank))]
}

function clampTier(tier: CinemaQualityTier, entry: Readonly<CinemaNodeRegistryEntry>): CinemaQualityTier {
  const rank = Math.max(TIER_RANK[entry.quality.minimumTier], Math.min(TIER_RANK[entry.quality.maximumTier], TIER_RANK[tier]))
  return RANK_TIER[rank]
}

function desiredTierFor(
  costRatio: number,
  averageCpuMs: number,
  averagePresentationMs: number,
  averageGpuMs: number | null,
  p95FrameMs: number,
  targetFrameMs: number,
): CinemaQualityTier {
  const cpuRatio = averageCpuMs > 0 ? averageCpuMs / targetFrameMs : 0
  const presentationRatio = averagePresentationMs > 0 ? averagePresentationMs / targetFrameMs : 0
  const gpuRatio = averageGpuMs != null && averageGpuMs > 0 ? averageGpuMs / targetFrameMs : 0
  const p95Ratio = p95FrameMs > 0 ? p95FrameMs / targetFrameMs : 0
  const pressure = Math.max(costRatio, cpuRatio, presentationRatio, gpuRatio, p95Ratio * 0.9)
  if (pressure >= 1.65) return 'low'
  if (pressure >= 1.15) return 'medium'
  if (pressure <= 0.48 && (presentationRatio === 0 || presentationRatio <= 0.72)) return 'ultra'
  return 'high'
}

function qualityPressure(
  costRatio: number,
  averageCpuMs: number,
  averagePresentationMs: number,
  averageGpuMs: number | null,
  targetFrameMs: number,
): CinemaQualityPressure {
  const pressure = Math.max(
    costRatio,
    averageCpuMs > 0 ? averageCpuMs / targetFrameMs : 0,
    averagePresentationMs > 0 ? averagePresentationMs / targetFrameMs : 0,
    averageGpuMs != null && averageGpuMs > 0 ? averageGpuMs / targetFrameMs : 0,
  )
  if (pressure >= 1.25) return 'critical'
  if (pressure >= 0.72) return 'elevated'
  return 'nominal'
}

function estimateNodeCost(entry: Readonly<CinemaNodeRegistryEntry>): number {
  const cost = entry.definition.cost
  return COST_WEIGHT[cost.cpu] * 1.5
    + COST_WEIGHT[cost.gpu] * 3
    + Math.max(0, cost.estimatedPassCount) * 2.5
    + Math.max(0, cost.persistentTargetCount) * 2
    + Math.max(0, cost.pingPongPairCount) * 4
    + Math.max(0, cost.estimatedTextureMemoryMb ?? 0) / 12
}

function roleCostMultiplier(role: CinemaNodeQualityRole): number {
  if (role === 'output') return 1.15
  if (role === 'foreground') return 1
  return 0.8
}

export function createCinemaEmptyGraphQualitySnapshot(): CinemaGraphQualitySnapshot {
  return Object.freeze({
    selectedTier: 'high', desiredTier: 'high', pressure: 'nominal', estimatedGraphCostScore: 0, graphBudgetScore: 0,
    targetAllocationCount: 0, estimatedTargetMemoryMb: 0, averageFrameTimeMs: 0, p95FrameTimeMs: 0,
    averageCpuTimeMs: 0, averagePresentationTimeMs: 0, averageGpuTimeMs: null,
    degradedNodeCount: 0, skippedNodeCount: 0, frozenNodeCount: 0, nodeDecisions: Object.freeze([]),
  })
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function nullableAverage(values: readonly number[]): number | null {
  return values.length > 0 ? average(values) : null
}

function pushBoundedSample(values: number[], value: number, maximum: number): void {
  if (!Number.isFinite(value) || value < 0) return
  values.push(value)
  if (values.length > maximum) values.splice(0, values.length - maximum)
}

function percentile95(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1))]
}

function positiveFinite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? value as number : fallback
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0 ? value as number : fallback
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

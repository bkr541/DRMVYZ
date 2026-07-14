import type { SharedPerformanceContext, SharedPerformanceSectionPhase } from './context'
import { performanceDeterministicUnit } from './determinism'

export interface SharedPerformanceOccurrenceMatch {
  occurrences?: readonly number[]
  minOccurrence?: number
  maxOccurrence?: number
  every?: number
}

export interface SharedPerformanceCapabilityGate {
  capability?: keyof SharedPerformanceContext['capabilities']
  minConfidence?: number
  confidence?: keyof SharedPerformanceContext['confidence']
}

export interface SharedPerformanceCadenceState {
  sectionPhase: SharedPerformanceSectionPhase
  barStage: number
  fourBarBlockIndex: number
  eightBarRecruitmentStage: number
  sixteenBarEvolutionStage: number
  fourBarBoundary: boolean
  eightBarBoundary: boolean
  sixteenBarBoundary: boolean
  phraseProgress: number
}

export interface SharedPerformanceSceneSelectionAdapter<TScene> {
  id(scene: TScene): string
  matches(scene: TScene, context: SharedPerformanceContext): boolean
  priority?(scene: TScene): number
  deterministicScore?(scene: TScene, context: SharedPerformanceContext): number
}

export interface SharedPerformanceWeightedVariation {
  id: string
  weight?: number
}

export interface SharedPerformanceActionAdapter<TState, TAction> {
  isLocked(state: TState, action: TAction): boolean
  apply(state: TState, action: TAction): TState
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function sharedPerformanceOccurrenceMatches(
  occurrence: number,
  match: SharedPerformanceOccurrenceMatch | null | undefined,
): boolean {
  if (!match) return true
  const value = Math.max(0, Math.floor(finite(occurrence)))
  if (match.occurrences?.length && !match.occurrences.includes(value)) return false
  if (match.minOccurrence != null && value < match.minOccurrence) return false
  if (match.maxOccurrence != null && value > match.maxOccurrence) return false
  if (match.every != null && match.every > 0 && value > 0 && (value - 1) % Math.floor(match.every) !== 0) return false
  return true
}

export function sharedPerformanceGatePasses(
  context: SharedPerformanceContext,
  gate: SharedPerformanceCapabilityGate | null | undefined,
): boolean {
  if (!gate) return true
  if (gate.capability && !context.capabilities[gate.capability]) return false
  if (gate.minConfidence != null) {
    const confidenceKey = gate.confidence ?? 'overall'
    if (context.confidence[confidenceKey] < gate.minConfidence) return false
  }
  return true
}

export function resolveSharedPerformanceCadence(
  context: SharedPerformanceContext,
): SharedPerformanceCadenceState {
  return {
    sectionPhase: context.macroSectionPhase,
    barStage: Math.max(1, context.barWithinMacroSection + 1),
    fourBarBlockIndex: context.performanceFourBarBlockIndex,
    eightBarRecruitmentStage: Math.max(1, context.performanceEightBarBlockIndex + 1),
    sixteenBarEvolutionStage: Math.max(1, context.performanceSixteenBarBlockIndex + 1),
    fourBarBoundary: context.boundaries.performanceFourBarBoundary,
    eightBarBoundary: context.boundaries.performanceEightBarBoundary,
    sixteenBarBoundary: context.boundaries.performanceSixteenBarBoundary,
    phraseProgress: context.phraseProgress,
  }
}

export function selectSharedPerformanceScene<TScene>(
  scenes: readonly TScene[],
  context: SharedPerformanceContext,
  adapter: SharedPerformanceSceneSelectionAdapter<TScene>,
): TScene | null {
  let selected: TScene | null = null
  let selectedPriority = Number.NEGATIVE_INFINITY
  let selectedScore = Number.NEGATIVE_INFINITY
  for (const scene of scenes) {
    if (!adapter.matches(scene, context)) continue
    const priority = adapter.priority?.(scene) ?? 0
    const score = adapter.deterministicScore?.(scene, context) ?? 0
    if (selected === null || priority > selectedPriority || (
      priority === selectedPriority && (score > selectedScore || (
        score === selectedScore && adapter.id(scene).localeCompare(adapter.id(selected)) < 0
      ))
    )) {
      selected = scene
      selectedPriority = priority
      selectedScore = score
    }
  }
  return selected
}

export function selectSharedPerformanceWeightedVariation<T extends SharedPerformanceWeightedVariation>(
  variations: readonly T[],
  seedParts: readonly (string | number | boolean | null | undefined)[],
): T | null {
  if (!variations.length) return null
  const totalWeight = variations.reduce((sum, item) => sum + Math.max(1e-6, finite(item.weight, 1)), 0)
  let cursor = performanceDeterministicUnit(...seedParts) * totalWeight
  for (const variation of variations) {
    cursor -= Math.max(1e-6, finite(variation.weight, 1))
    if (cursor <= 1e-6) return variation
  }
  return variations[variations.length - 1] ?? null
}

/** User locks are authoritative; adapters own the meaning of both locks and actions. */
export function applySharedPerformanceActions<TState, TAction>(
  state: TState,
  actions: readonly TAction[],
  adapter: SharedPerformanceActionAdapter<TState, TAction>,
): TState {
  let next = state
  for (const action of actions) {
    if (adapter.isLocked(next, action)) continue
    next = adapter.apply(next, action)
  }
  return next
}

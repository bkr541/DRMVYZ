import type { CanvasCompositionRichnessTier } from './CanvasPerformanceTypes'

export function clampCanvasOrchestrationControl(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/**
 * Structural richness uses explicit tiers instead of a raw slot-count multiplier.
 * The thresholds intentionally leave a wide low-complexity range and reserve the
 * final supporting treatment for the upper end of the control.
 */
export function resolveCanvasCompositionRichnessTier(value: number): CanvasCompositionRichnessTier {
  const normalized = clampCanvasOrchestrationControl(value)
  if (normalized < 0.2) return 0
  if (normalized < 0.45) return 1
  if (normalized < 0.7) return 2
  if (normalized < 0.85) return 3
  return 4
}

/** Upper motion values open up more quickly while 0 remains a true neutral point. */
export function resolveCanvasMotionResponse(value: number): number {
  return clampCanvasOrchestrationControl(value) ** 1.12
}

/** Effects reach the authored recipe's full safe range at 100%. */
export function resolveCanvasEffectResponse(value: number): number {
  return clampCanvasOrchestrationControl(value) ** 0.9
}

/**
 * Optional media changes remain deterministic; this curve controls how many
 * musically-valid opportunities become edits. 100% deliberately accepts every
 * eligible opportunity while 0% accepts none.
 */
export function resolveCanvasCutOpportunityProbability(value: number, opportunityWeight = 1): number {
  const normalized = clampCanvasOrchestrationControl(value)
  if (normalized <= 0) return 0
  if (normalized >= 1) return 1
  return clampCanvasOrchestrationControl((normalized ** 1.08) * Math.max(0, opportunityWeight))
}

/** Animated transitions are disabled at 0% and become the default at 100%. */
export function resolveCanvasTransitionOpportunityProbability(value: number, opportunityWeight = 1): number {
  const normalized = clampCanvasOrchestrationControl(value)
  if (normalized <= 0) return 0
  if (normalized >= 1) return 1
  return clampCanvasOrchestrationControl((normalized ** 0.92) * Math.max(0, opportunityWeight))
}

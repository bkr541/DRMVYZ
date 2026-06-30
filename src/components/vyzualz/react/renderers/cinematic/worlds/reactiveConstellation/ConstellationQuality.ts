import type { CinematicQualityTier } from '../../../../CinematicWorldConfig'

export interface ConstellationQualityBudget {
  nodeCountCap: number
  edgeCountCap: number
  trailSampleCap: number
  historicalDrawCount: number
  glowPassComplexity: number
  curtainCountCap: number
  /** Internal scene/post-processing resolution multiplier for this tier. */
  postProcessingScale: number
}

export const CONSTELLATION_QUALITY_BUDGETS: Readonly<Record<CinematicQualityTier, ConstellationQualityBudget>> = {
  low: {
    nodeCountCap: 28,
    edgeCountCap: 56,
    trailSampleCap: 5,
    historicalDrawCount: 3,
    glowPassComplexity: 0.42,
    curtainCountCap: 6,
    postProcessingScale: 0.5,
  },
  medium: {
    nodeCountCap: 44,
    edgeCountCap: 112,
    trailSampleCap: 9,
    historicalDrawCount: 6,
    glowPassComplexity: 0.68,
    curtainCountCap: 10,
    postProcessingScale: 0.68,
  },
  high: {
    nodeCountCap: 72,
    edgeCountCap: 216,
    trailSampleCap: 16,
    historicalDrawCount: 12,
    glowPassComplexity: 1,
    curtainCountCap: 16,
    postProcessingScale: 0.86,
  },
  ultra: {
    nodeCountCap: 96,
    edgeCountCap: 384,
    trailSampleCap: 28,
    historicalDrawCount: 24,
    glowPassComplexity: 1.35,
    curtainCountCap: 24,
    postProcessingScale: 1,
  },
  // Auto is intentionally bounded below Ultra. Device eligibility for an
  // explicit Ultra selection is handled by the existing Cinematic controls.
  auto: {
    nodeCountCap: 60,
    edgeCountCap: 168,
    trailSampleCap: 13,
    historicalDrawCount: 9,
    glowPassComplexity: 0.88,
    curtainCountCap: 12,
    postProcessingScale: 0.8,
  },
}

export function constellationQualityBudget(tier: CinematicQualityTier): ConstellationQualityBudget {
  return CONSTELLATION_QUALITY_BUDGETS[tier] ?? CONSTELLATION_QUALITY_BUDGETS.auto
}

export function clampConstellationNodeCount(requested: number, budget: ConstellationQualityBudget): number {
  const finite = Number.isFinite(requested) ? requested : 12
  return Math.max(8, Math.min(budget.nodeCountCap, Math.floor(finite)))
}

export function clampConstellationEdgeCount(requested: number, budget: ConstellationQualityBudget): number {
  const finite = Number.isFinite(requested) ? requested : 0
  return Math.max(0, Math.min(budget.edgeCountCap, Math.floor(finite)))
}

export function clampConstellationTrailSamples(requested: number, budget: ConstellationQualityBudget): number {
  const finite = Number.isFinite(requested) ? requested : 0
  return Math.max(0, Math.min(budget.trailSampleCap, Math.floor(finite)))
}

export function reactiveConstellationResolutionScale(tier: CinematicQualityTier): number {
  return constellationQualityBudget(tier).postProcessingScale
}

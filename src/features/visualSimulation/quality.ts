import { finiteSimulationNumber } from './math'

export type VisualSimulationQualityTier = 'auto' | 'low' | 'medium' | 'high'

export interface VisualSimulationResourceBudget {
  simulationPointCount: number
  particleCount: number
  trailSampleCount: number
  substepCount: number
  auxiliaryEffectCount: number
  eventStateCount: number
}

export const VISUAL_SIMULATION_QUALITY_BUDGETS: Readonly<Record<VisualSimulationQualityTier, VisualSimulationResourceBudget>> = {
  low: {
    simulationPointCount: 1_024,
    particleCount: 256,
    trailSampleCount: 8,
    substepCount: 4,
    auxiliaryEffectCount: 4,
    eventStateCount: 32,
  },
  medium: {
    simulationPointCount: 4_096,
    particleCount: 1_024,
    trailSampleCount: 16,
    substepCount: 6,
    auxiliaryEffectCount: 8,
    eventStateCount: 64,
  },
  high: {
    simulationPointCount: 16_384,
    particleCount: 4_096,
    trailSampleCount: 32,
    substepCount: 8,
    auxiliaryEffectCount: 16,
    eventStateCount: 128,
  },
  auto: {
    simulationPointCount: 8_192,
    particleCount: 2_048,
    trailSampleCount: 24,
    substepCount: 8,
    auxiliaryEffectCount: 12,
    eventStateCount: 96,
  },
}

const MINIMUMS: VisualSimulationResourceBudget = {
  simulationPointCount: 1,
  particleCount: 0,
  trailSampleCount: 0,
  substepCount: 1,
  auxiliaryEffectCount: 0,
  eventStateCount: 1,
}

function clampBudgetValue(value: unknown, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(finiteSimulationNumber(value, minimum))))
}

export function visualSimulationQualityBudget(tier: VisualSimulationQualityTier): VisualSimulationResourceBudget {
  return VISUAL_SIMULATION_QUALITY_BUDGETS[tier] ?? VISUAL_SIMULATION_QUALITY_BUDGETS.auto
}

/** Clamps engine requests to a generic quality tier without assigning visual meaning. */
export function clampVisualSimulationResourceBudget(
  requested: Partial<VisualSimulationResourceBudget>,
  tier: VisualSimulationQualityTier,
): VisualSimulationResourceBudget {
  const cap = visualSimulationQualityBudget(tier)
  return {
    simulationPointCount: clampBudgetValue(requested.simulationPointCount ?? cap.simulationPointCount, MINIMUMS.simulationPointCount, cap.simulationPointCount),
    particleCount: clampBudgetValue(requested.particleCount ?? cap.particleCount, MINIMUMS.particleCount, cap.particleCount),
    trailSampleCount: clampBudgetValue(requested.trailSampleCount ?? cap.trailSampleCount, MINIMUMS.trailSampleCount, cap.trailSampleCount),
    substepCount: clampBudgetValue(requested.substepCount ?? cap.substepCount, MINIMUMS.substepCount, cap.substepCount),
    auxiliaryEffectCount: clampBudgetValue(requested.auxiliaryEffectCount ?? cap.auxiliaryEffectCount, MINIMUMS.auxiliaryEffectCount, cap.auxiliaryEffectCount),
    eventStateCount: clampBudgetValue(requested.eventStateCount ?? cap.eventStateCount, MINIMUMS.eventStateCount, cap.eventStateCount),
  }
}

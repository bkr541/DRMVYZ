import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { clamp, clamp01, lerp } from './CutbankRandom'

/** Fallback transport tempo used only when no canonical BPM exists (or BPM Sync is off). */
export const CUTBANK_FALLBACK_BPM = 120

export interface CutbankClock {
  /** Seconds on the active transport (audio time, or idle wall time when nothing is playing). */
  timeSec: number
  /** Continuous beat position. */
  beat: number
  secondsPerBeat: number
  beatsPerBar: number
  bar: number
  beatWithinBar: number
  /** True when timing comes from the canonical Shared Performance BPM. */
  canonical: boolean
}

/**
 * One clock for everything CUTBANK times. When BPM Sync is on and the shared
 * context has a BPM, beats are the canonical grid. Otherwise a deterministic
 * transport-time fallback at CUTBANK_FALLBACK_BPM is used — never a second
 * drifting BPM clock.
 */
export function resolveCutbankClock(
  context: SharedPerformanceContext,
  { bpmSync, transportTimeSec }: { bpmSync: boolean; transportTimeSec: number },
): CutbankClock {
  const beatsPerBar = Math.max(1, Math.round(context.timeSignature || 4))
  if (bpmSync && context.bpm > 0 && Number.isFinite(context.absoluteBeat)) {
    // The shared context refreshes ~20×/s; extrapolate a little so per-frame timing is smooth.
    const extrapolated = clamp(transportTimeSec - context.audioTimeSec, 0, 0.25)
    const beat = context.absoluteBeat + clamp01(context.beatPhase) + extrapolated / (60 / context.bpm)
    return {
      timeSec: Math.max(transportTimeSec, context.audioTimeSec),
      beat,
      secondsPerBeat: 60 / context.bpm,
      beatsPerBar,
      bar: Math.floor(beat / beatsPerBar),
      beatWithinBar: beat - Math.floor(beat / beatsPerBar) * beatsPerBar,
      canonical: true,
    }
  }
  const secondsPerBeat = 60 / CUTBANK_FALLBACK_BPM
  const beat = Math.max(0, transportTimeSec) / secondsPerBeat
  return {
    timeSec: transportTimeSec,
    beat,
    secondsPerBeat,
    beatsPerBar: 4,
    bar: Math.floor(beat / 4),
    beatWithinBar: beat - Math.floor(beat / 4) * 4,
    canonical: false,
  }
}

const HOLD_STEPS = [0.5, 1, 2, 4, 8, 16, 32] as const

/** Slider 0..1 → 0.5 … 32 beats (exponential). */
export function holdSliderToBeats(value: number): number {
  return 0.5 * Math.pow(2, clamp01(value) * 6)
}

/** Nearest musical division (1/2 … 32 beats) in log space. */
export function snapHoldBeats(beats: number): number {
  const exponent = clamp(Math.round(Math.log2(Math.max(0.5, beats) / 0.5)), 0, HOLD_STEPS.length - 1)
  return HOLD_STEPS[exponent]
}

/** Cut Rate 0 → a cut every 16 beats, 1 → every half beat. */
export function cutRateToIntervalBeats(rate: number): number {
  return 16 * Math.pow(2, -clamp01(rate) * 5)
}

export type CutbankEnergyTier = 'low' | 'medium' | 'high'

export interface CutbankEnergyState {
  /** 0..1 blended musical energy. */
  level: number
  tier: CutbankEnergyTier
  drop: boolean
  build: number
  vocal: number
  /** False when no analysis existed and CUTBANK is running on its neutral default. */
  informed: boolean
}

export const CUTBANK_NEUTRAL_ENERGY = 0.4

/**
 * Reads the existing Shared Performance context — no second analyser.
 * When Auto Performance is off the level is pinned neutral so Manual settings
 * alone decide behaviour.
 */
export function resolveCutbankEnergy(context: SharedPerformanceContext, autoPerformance: boolean): CutbankEnergyState {
  if (!autoPerformance) {
    return { level: 0.5, tier: 'medium', drop: false, build: 0, vocal: 0, informed: false }
  }
  const live = (context.bass + context.mid + context.high) / 3
  const measured = Math.max(context.energy, context.trackRelativeEnergy, live)
  const informed = measured > 0.001 || context.sectionType != null
  let level = informed ? clamp01(measured) : CUTBANK_NEUTRAL_ENERGY
  const drop = context.sectionType === 'drop' || context.dropImpact > 0.55
  const build = context.sectionType === 'build' || context.sectionType === 'preDrop'
    ? clamp01(context.buildProgress)
    : clamp01(context.buildProgress * 0.5)
  if (drop) level = Math.max(level, lerp(0.85, 1, clamp01(context.dropImpact)))
  else if (context.sectionType === 'build' || context.sectionType === 'preDrop') level = Math.max(level, lerp(0.35, 0.75, build))
  else if (context.sectionType === 'breakdown' || context.sectionType === 'bridge' || context.sectionType === 'intro' || context.sectionType === 'outro') level = Math.min(level, 0.38)
  level = clamp01(level)
  const tier: CutbankEnergyTier = level < 0.34 ? 'low' : level < 0.68 ? 'medium' : 'high'
  return { level, tier, drop, build, vocal: clamp01(context.vocalEnergy), informed }
}

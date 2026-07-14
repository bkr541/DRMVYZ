export type SharedPerformanceEnvelopeCurve =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'exponential'
  | 'overshoot'
  | 'step'
  | 'stepped'

export interface SharedPerformanceEventEnvelope {
  attack: number
  hold: number
  release: number
  curve?: SharedPerformanceEnvelopeCurve
}

export interface SharedPerformanceSmoothingState {
  value: number
  initialized: boolean
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: unknown): number {
  return Math.max(0, Math.min(1, finite(value)))
}

export function curveSharedPerformanceProgress(
  progress: number,
  curve: SharedPerformanceEnvelopeCurve = 'linear',
): number {
  const t = clamp01(progress)
  switch (curve) {
    case 'easeIn': return t * t
    case 'easeOut': return 1 - (1 - t) * (1 - t)
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
    case 'exponential': return t <= 0 ? 0 : Math.min(1, 2 ** (10 * t - 10))
    case 'overshoot': {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * ((t - 1) ** 3) + c1 * ((t - 1) ** 2)
    }
    case 'step': return t >= 1 ? 1 : 0
    case 'stepped': return Math.floor(t * 4) / 4
    default: return t
  }
}

/**
 * Resolves an attack/hold/release pulse from elapsed musical units. The units
 * may be beats, bars, or seconds as long as the caller uses the same unit for
 * every envelope field.
 */
export function resolveSharedPerformanceEventEnvelope(
  elapsed: number,
  envelope: SharedPerformanceEventEnvelope,
): number {
  const time = Math.max(0, finite(elapsed))
  const attack = Math.max(0, finite(envelope.attack))
  const hold = Math.max(0, finite(envelope.hold))
  const release = Math.max(0, finite(envelope.release))
  if (attack > 0 && time < attack) return curveSharedPerformanceProgress(time / attack, envelope.curve ?? 'easeOut')
  if (time <= attack + hold) return 1
  if (release <= 0 || time >= attack + hold + release) return 0
  const releaseProgress = (time - attack - hold) / release
  return clamp01(1 - curveSharedPerformanceProgress(releaseProgress, envelope.curve ?? 'easeOut'))
}

/** Mutates and returns a reusable state object, avoiding per-frame allocations. */
export function smoothSharedPerformanceModulation(
  state: SharedPerformanceSmoothingState,
  target: number,
  deltaSec: number,
  attackSec: number,
  releaseSec: number,
): number {
  const next = finite(target)
  if (!state.initialized) {
    state.value = next
    state.initialized = true
    return state.value
  }
  const duration = next >= state.value ? Math.max(0, finite(attackSec)) : Math.max(0, finite(releaseSec))
  if (duration <= 0) {
    state.value = next
    return state.value
  }
  const coefficient = 1 - Math.exp(-Math.max(0, finite(deltaSec)) / duration)
  state.value += (next - state.value) * coefficient
  return state.value
}

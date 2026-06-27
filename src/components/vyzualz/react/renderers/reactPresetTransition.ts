import type {
  ReactPerformancePadTransition,
  ReactPresetControlValues,
} from '../ReactTypes'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Resolves the controls that should be rendered at `nowMs`.
 * `target` is the already-selected preset snapshot stored in Zustand. The
 * transition is deliberately transient and is not included in persisted state.
 */
export function resolvePerformancePadTransition(
  target: ReactPresetControlValues,
  transition: ReactPerformancePadTransition | null | undefined,
  nowMs: number,
): ReactPresetControlValues {
  if (!transition || transition.durationMs <= 0) return target

  const progress = clamp01((nowMs - transition.startedAtMs) / transition.durationMs)
  if (progress >= 1) return target

  return {
    intensity:       lerp(transition.from.intensity,       transition.to.intensity,       progress),
    motion:          lerp(transition.from.motion,          transition.to.motion,          progress),
    glow:            lerp(transition.from.glow,            transition.to.glow,            progress),
    bassReactivity:  lerp(transition.from.bassReactivity,  transition.to.bassReactivity,  progress),
    trailDecay:      lerp(transition.from.trailDecay,      transition.to.trailDecay,      progress),
    fogDensity:      lerp(transition.from.fogDensity,      transition.to.fogDensity,      progress),
    particleDensity: lerp(transition.from.particleDensity, transition.to.particleDensity, progress),
  }
}

/**
 * Beam kinematics — pure functions that convert travel progress (0–1) into
 * visible segment fractions along the beam path.
 *
 * All results are fractions of the origin→target vector:
 *   0 = at origin,  1 = at target
 *
 * The compiler lerps visibleOriginFrac and visibleTargetFrac against the
 * compiled canvas coordinates to get actual pixel positions.
 */

import type { LaserDmxBeamTravelMode } from '../ReactTypes'

// ── Public result type ────────────────────────────────────────────────────────

export interface KinematicResult {
  /** Fraction along origin→target path where the visible segment starts. */
  visibleOriginFrac: number
  /** Fraction along origin→target path where the visible segment ends (head). */
  visibleTargetFrac: number
  /** 0–1 extra intensity boost at the beam head (for non-static modes). */
  headIntensity: number
  /** Present only for pulseTrain: multiple segments along the path. */
  pulseSegments?: { startFrac: number; endFrac: number }[]
}

// ── Easing ────────────────────────────────────────────────────────────────────

export function applyEasing(t: number, easing: string): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  switch (easing) {
    case 'easeIn':    return x * x
    case 'easeOut':   return 1 - (1 - x) * (1 - x)
    case 'easeInOut': return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)
    default:          return x  // linear
  }
}

// ── Main kinematics function ──────────────────────────────────────────────────

/**
 * Compute visible segment fractions for a given travel mode and progress.
 *
 * @param mode        Travel mode.
 * @param rawProgress 0–1 travel progress (from sequence or free-running phase).
 *                    pingPong applies triangle-wave internally.
 * @param tailLength  0–1 fraction of path occupied by tail / pulse width.
 * @param headGlow    0–1 head-flare brightness (0 = no flare).
 * @param easing      Easing function name (applied after pingPong fold-back).
 */
export function computeKinematics(
  mode:        LaserDmxBeamTravelMode,
  rawProgress: number,
  tailLength:  number,
  headGlow:    number,
  easing:      string,
): KinematicResult {
  if (mode === 'static') {
    return { visibleOriginFrac: 0, visibleTargetFrac: 1, headIntensity: 0 }
  }

  // pingPong: fold raw 0→1 into triangle wave 0→1→0 before easing
  const folded = mode === 'pingPong'
    ? (rawProgress < 0.5 ? rawProgress * 2 : (1 - rawProgress) * 2)
    : rawProgress

  const p = applyEasing(folded < 0 ? 0 : folded > 1 ? 1 : folded, easing)

  switch (mode) {
    case 'grow':
      return { visibleOriginFrac: 0, visibleTargetFrac: p, headIntensity: headGlow }

    case 'pingPong':
      return { visibleOriginFrac: 0, visibleTargetFrac: p, headIntensity: headGlow }

    case 'projectile': {
      const tail = Math.max(0, p - tailLength)
      return { visibleOriginFrac: tail, visibleTargetFrac: p, headIntensity: headGlow }
    }

    case 'scanner': {
      const segLen = Math.max(0.05, tailLength)
      const tail   = Math.max(0, p - segLen)
      return { visibleOriginFrac: tail, visibleTargetFrac: Math.min(1, p), headIntensity: headGlow }
    }

    case 'pulseTrain': {
      const numPulses  = 3
      const pulseWidth = Math.max(0.04, tailLength / numPulses)
      const segments: { startFrac: number; endFrac: number }[] = []
      for (let i = 0; i < numPulses; i++) {
        const center = (p + i / numPulses) % 1
        const start  = Math.max(0, center - pulseWidth / 2)
        const end    = Math.min(1, center + pulseWidth / 2)
        if (end > start) segments.push({ startFrac: start, endFrac: end })
      }
      return {
        visibleOriginFrac: segments[0]?.startFrac ?? 0,
        visibleTargetFrac: segments[segments.length - 1]?.endFrac ?? p,
        headIntensity:     headGlow,
        pulseSegments:     segments.length > 0 ? segments : undefined,
      }
    }

    default:
      return { visibleOriginFrac: 0, visibleTargetFrac: 1, headIntensity: 0 }
  }
}

// ── Lerp helper ───────────────────────────────────────────────────────────────

/** Linearly interpolate between two 3D points at fraction t. */
export function lerpPt(
  ox: number, oy: number, oz: number,
  tx: number, ty: number, tz: number,
  t:  number,
): { x: number; y: number; z: number } {
  return {
    x: ox + (tx - ox) * t,
    y: oy + (ty - oy) * t,
    z: oz + (tz - oz) * t,
  }
}

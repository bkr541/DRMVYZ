import type { LetterReactionSource, LetterReactionTarget } from '../ReactTypes'

// ── Signal evaluation ─────────────────────────────────────────────────────────

/**
 * Returns a 0→1 signal value for the given source, with optional phase-wrap
 * and inversion applied.
 *
 * phaseOffset wraps the raw signal: effectiveSignal = fract(raw + phaseOffset).
 * This lets two letters with the same source react at different points in the
 * audio cycle — e.g., phaseOffset=0.5 shifts the activation by half a cycle.
 */
export function evalCustomSignal(
  source:      LetterReactionSource,
  rawBass:     number,
  rawMid:      number,
  rawHigh:     number,
  beatPulse:   number,
  phaseOffset: number,
  invert:      boolean,
): number {
  let raw: number
  switch (source) {
    case 'bass': raw = rawBass;   break
    case 'mid':  raw = rawMid;    break
    case 'high': raw = rawHigh;   break
    case 'beat': raw = beatPulse; break
    default:     raw = 0
  }
  let sig = raw
  if (phaseOffset !== 0) {
    sig = sig + phaseOffset
    // Wrap shifted value into [0, 1)
    sig = sig - Math.floor(sig)
  }
  if (invert) sig = 1 - sig
  return sig
}

// ── Target delta accumulator ──────────────────────────────────────────────────

/**
 * Mutable accumulator filled by one or more assignments for a single letter.
 * Each assignment calls `applyCustomTargetDelta` in sequence.
 */
export interface CustomTargetDelta {
  ldx:    number  // local-offset x (relative to char centroid)
  ldy:    number  // local-offset y
  dOffX:  number  // centroid shift x
  dOffY:  number  // centroid shift y
  jitter: number  // extra jitter amplitude (applied by renderer with seededRandom)
}

/**
 * Applies one assignment's target transformation to the accumulator.
 * Returns an updated accumulator (object is mutated in place for perf).
 *
 * Amount semantics per target:
 *   scale:    1 + signal × amount        (amount=1 → 2× at peak signal)
 *   rotation: signal × amount × 2π rad   (amount=1 → one full turn at peak)
 *   offsetX/Y: signal × amount           (in normalized glyph units)
 *   jitter:   signal × amount            (in normalized glyph units, ≤ 0.5 typical)
 */
export function applyCustomTargetDelta(
  target: LetterReactionTarget,
  signal: number,
  amount: number,
  acc:    CustomTargetDelta,
): void {
  switch (target) {
    case 'scale': {
      const s = 1 + signal * amount
      acc.ldx *= s
      acc.ldy *= s
      break
    }
    case 'rotation': {
      const angle = signal * amount * Math.PI * 2
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const tx = acc.ldx * c - acc.ldy * s
      const ty = acc.ldx * s + acc.ldy * c
      acc.ldx = tx
      acc.ldy = ty
      break
    }
    case 'offsetX':
      acc.dOffX += signal * amount
      break
    case 'offsetY':
      acc.dOffY += signal * amount
      break
    case 'jitter':
      acc.jitter += signal * amount
      break
  }
}

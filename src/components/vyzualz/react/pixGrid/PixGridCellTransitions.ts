import type { PixGridProgramTransitionOverride } from './PixGridTypes'

export type PixGridCellTransitionDirection = 'forward' | 'reverse'
export interface PixGridCellTransitionOrigin { x: number; y: number }

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function easePixGridTransition(
  progress: number,
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step' = 'linear',
): number {
  const p = clamp01(progress)
  if (easing === 'easeIn') return p * p
  if (easing === 'easeOut') return 1 - (1 - p) * (1 - p)
  if (easing === 'easeInOut') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
  if (easing === 'step') return p >= 1 ? 1 : 0
  return p
}

export function pixGridTransitionNoise(x: number, y: number, seed: number): number {
  let value = Math.imul((x + 1) ^ seed, 0x45d9f3b) ^ Math.imul((y + 1) ^ (seed >>> 1), 0x27d4eb2d)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return (value >>> 0) / 0xffffffff
}

/**
 * Shared logical-cell transition grammar. Complete-state transitions and
 * frame-based layer transitions call this same stateless resolver.
 */
export function pixGridCellTransitionMix(
  type: PixGridProgramTransitionOverride,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  seed: number,
  direction: PixGridCellTransitionDirection = 'forward',
  origin: PixGridCellTransitionOrigin = { x: 0.5, y: 0.5 },
): number {
  const p = clamp01(progress)
  if (type === 'cut') return 1
  if (p <= 0) return 0
  if (p >= 1) return 1
  const rawU = (x + 0.5) / Math.max(1, width)
  const rawV = (y + 0.5) / Math.max(1, height)
  const u = direction === 'reverse' ? 1 - rawU : rawU
  const v = direction === 'reverse' ? 1 - rawV : rawV
  switch (type) {
    case 'crossfade':
    case 'paletteFade':
      return p
    case 'rowWipe':
      return v <= p ? 1 : 0
    case 'columnWipe':
      return u <= p ? 1 : 0
    case 'checkerWipe': {
      const checker = ((x + y) & 1) * 0.12
      return v <= Math.max(0, p - checker) ? 1 : 0
    }
    case 'pixelDissolve':
      return pixGridTransitionNoise(x, y, seed) <= p ? 1 : 0
    case 'radialReveal': {
      const maxRadius = Math.max(
        Math.hypot(origin.x, origin.y),
        Math.hypot(1 - origin.x, origin.y),
        Math.hypot(origin.x, 1 - origin.y),
        Math.hypot(1 - origin.x, 1 - origin.y),
      )
      return Math.hypot(rawU - origin.x, rawV - origin.y) / Math.max(0.000001, maxRadius) <= p ? 1 : 0
    }
    case 'powerOn':
    case 'powerOff':
      // Lifecycle power transitions are coherent whole-sign fades. The prior
      // per-cell noise threshold made a healthy sign look like corrupt or
      // missing pixels during startup, shutdown, and seek reconstruction.
      return p
    default:
      return 1
  }
}

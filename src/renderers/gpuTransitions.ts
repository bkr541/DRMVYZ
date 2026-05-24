import type { VzTransitionType } from '../types/timeline'

/**
 * Transition types handled entirely on the GPU by GPU_TRANSITION_FRAG.
 * All others fall back to the Canvas 2D transitionRenderer path.
 */
export const GPU_TRANSITION_TYPES: ReadonlySet<VzTransitionType> = new Set([
  'crossfade',
  'wipeLeft',
  'wipeRight',
  'wipeUp',
  'wipeDown',
  'additiveBlend',
  'lumaFade',
  'radialWipe',
  'zoomIn',
  'zoomOut',
])

const GPU_TRANSITION_INDEX: Partial<Record<VzTransitionType, number>> = {
  crossfade:     0,
  wipeLeft:      1,
  wipeRight:     2,
  wipeUp:        3,
  wipeDown:      4,
  additiveBlend: 5,
  lumaFade:      6,
  radialWipe:    7,
  zoomIn:        8,
  zoomOut:       9,
}

/** Returns the u_type uniform value for a GPU-handled transition type. */
export function getGpuTransitionIndex(type: VzTransitionType): number {
  return GPU_TRANSITION_INDEX[type] ?? 0
}

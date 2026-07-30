import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'

export const SOUND_DRAWING_VISUAL_SIZE_MIN = 0.1
export const SOUND_DRAWING_VISUAL_SIZE_MAX = 2.5

export function normalizeSoundDrawingVisualSize(
  value: unknown,
  fallback = DEFAULT_OSCILLATOR_SETTINGS.pathScale,
): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  const safeFallback = Number.isFinite(fallback)
    ? Math.min(SOUND_DRAWING_VISUAL_SIZE_MAX, Math.max(SOUND_DRAWING_VISUAL_SIZE_MIN, fallback))
    : 0.78
  if (!Number.isFinite(numeric)) return safeFallback
  return Math.min(SOUND_DRAWING_VISUAL_SIZE_MAX, Math.max(SOUND_DRAWING_VISUAL_SIZE_MIN, numeric))
}

/**
 * Converts the shared Visual/Show Size control into a composition transform.
 * The authored default remains 1:1, while the broad 0.1-2.5 UI range stays
 * useful without collapsing the three ribbon lanes into a hairline or pushing
 * them far outside the viewport.
 */
export function resolveSoundDrawingAuthoredCompositionScale(
  value: unknown,
  authoredDefault = DEFAULT_OSCILLATOR_SETTINGS.pathScale,
): number {
  const normalized = normalizeSoundDrawingVisualSize(value, authoredDefault)
  const baseline = normalizeSoundDrawingVisualSize(authoredDefault, 0.78)
  return Math.min(1.45, Math.max(0.72, Math.sqrt(normalized / Math.max(0.001, baseline))))
}

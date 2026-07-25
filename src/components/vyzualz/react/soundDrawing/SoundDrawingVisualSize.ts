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

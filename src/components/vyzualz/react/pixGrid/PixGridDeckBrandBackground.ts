import type { BrandKit } from '../../../../features/personalization/BrandKitTypes'
import { normalizeHexColor } from '../../../../features/personalization/paletteColorSpace'

export const PIX_GRID_DECK_FALLBACK_TRANSPARENT_BACKGROUND = '#000000' as const

function usableColor(value: unknown): string | null {
  const normalized = normalizeHexColor(value, '')
  return normalized || null
}

/**
 * Resolves a source-preparation background without copying Brand Kit state.
 * The active kit's background role wins, then primary, then deterministic black.
 */
export function resolvePixGridDeckTransparentBackground(
  activeKit: Pick<BrandKit, 'palette'> | null | undefined,
): string {
  return usableColor(activeKit?.palette?.background)
    ?? usableColor(activeKit?.palette?.primary)
    ?? PIX_GRID_DECK_FALLBACK_TRANSPARENT_BACKGROUND
}

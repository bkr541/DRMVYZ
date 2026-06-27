import { isSvgContent } from '../renderers/svgGlyphUtils'

export interface SvgGlyphPrecacheInput {
  mediaId: string
  rawSvg: string
  title?: string
  name: string
}

export interface SvgGlyphPrecacheRequest {
  mediaId: string
  rawSvg: string
  displayName: string
}

/**
 * Validates and normalizes the serializable payload passed from the media
 * library into the React-view SVG cache. Kept pure so upload handling can be
 * tested without loading either Zustand store.
 */
export function buildSvgGlyphPrecacheRequest(
  input: SvgGlyphPrecacheInput,
): SvgGlyphPrecacheRequest | null {
  if (!isSvgContent(input.rawSvg)) return null

  const displayName = (input.title ?? input.name)
    .replace(/\.svg$/i, '')
    .trim() || 'SVG Glyph'

  return {
    mediaId: input.mediaId,
    rawSvg: input.rawSvg,
    displayName,
  }
}

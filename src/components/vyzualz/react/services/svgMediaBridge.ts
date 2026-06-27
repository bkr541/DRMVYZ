import { useReactStore } from '../../../../stores/reactStore'
import { buildSvgGlyphPrecacheRequest } from './svgMediaBridgeTypes'

export interface PrecacheUploadedSvgGlyphInput {
  file: File
  mediaId: string
  title?: string
  name: string
}

export type SvgGlyphPrecacheResult = 'cached' | 'invalid'

/**
 * Lazy bridge between the general media library and React-view SVG state.
 * This module is intentionally imported only from SVG-specific media actions,
 * keeping the central React store singleton in the initial graph while moving
 * the cross-feature integration code behind a genuine feature boundary.
 */
export async function precacheUploadedSvgGlyph(
  input: PrecacheUploadedSvgGlyphInput,
): Promise<SvgGlyphPrecacheResult> {
  const request = buildSvgGlyphPrecacheRequest({
    mediaId: input.mediaId,
    rawSvg: await input.file.text(),
    title: input.title,
    name: input.name,
  })

  if (!request) return 'invalid'

  useReactStore.getState().addAndCacheMediaSvgGlyph(
    request.mediaId,
    request.rawSvg,
    request.displayName,
  )
  return 'cached'
}

/** Remove React-view SVG caches and selection associated with a media item. */
export function cleanupRemovedSvgMedia(mediaId: string): void {
  const store = useReactStore.getState()
  store.removeOscillatorGlyphAsset(`glyph-media:${mediaId}`)
  store.clearSvgVisualForMedia(mediaId)
}

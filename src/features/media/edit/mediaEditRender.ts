// The one entry point Save and Save As use to turn an edit into a real file.

import type { MediaEditState } from './mediaEditModel'
import { renderEditedImage } from './mediaEditImageExport'
import type { RenderedMedia } from './mediaEditOutput'
import { renderEditedVideo } from './mediaEditVideoExport'

export interface EditableMediaSource {
  type: 'image' | 'video'
  /** Loadable URL of the current content (signed URL or blob URL). */
  url: string
  mimeType: string | null
  hasAlpha: boolean
  fps?: number
}

export interface RenderEditedMediaOptions {
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

export function renderEditedMedia(
  source: EditableMediaSource,
  edit: MediaEditState,
  options: RenderEditedMediaOptions = {},
): Promise<RenderedMedia> {
  if (!source.url) return Promise.reject(new Error('The media is not loaded yet. Wait for it to appear, then try again.'))
  if (source.type === 'video') {
    return renderEditedVideo({
      url: source.url,
      edit,
      sourceMimeType: source.mimeType,
      fps: source.fps,
      signal: options.signal,
      onProgress: options.onProgress,
    })
  }
  return renderEditedImage({
    url: source.url,
    edit,
    sourceMimeType: source.mimeType,
    sourceHasAlpha: source.hasAlpha,
    signal: options.signal,
  })
}

/**
 * Which media the editor supports. Animated GIFs would silently lose their
 * animation and SVGs would be flattened to bitmaps, so both are refused with a
 * clear reason instead of producing a lossy save.
 */
export function mediaEditUnsupportedReason(media: {
  type: 'image' | 'video'
  mimeType?: string | null
  mediaRole?: string
  storagePath?: string
}): string | null {
  const mime = media.mimeType?.toLowerCase() ?? ''
  const path = media.storagePath?.toLowerCase() ?? ''
  if (mime === 'image/svg+xml' || media.mediaRole === 'svg' || path.endsWith('.svg')) {
    return 'Vector SVG media cannot be edited here because saving would flatten it to a bitmap.'
  }
  if (mime === 'image/gif' || path.endsWith('.gif')) {
    return 'Animated GIFs cannot be edited here because saving would remove the animation.'
  }
  return null
}

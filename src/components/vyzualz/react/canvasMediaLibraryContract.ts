import type { UploadedMedia } from '../../../stores/mediaStore'
import type { CanvasMediaItemType } from './ReactTypes'

/** Production CANVAS media eligibility shared by runtime selection and Show authoring. */
export function getCanvasLibraryMediaType(media: UploadedMedia): CanvasMediaItemType | null {
  const name = media.name.toLowerCase()
  const mime = (media.mimeType ?? '').toLowerCase()
  if (mime === 'image/svg+xml' || name.endsWith('.svg') || media.mediaRole === 'svg') return 'svg'
  if (
    media.type === 'image' && (
      mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/webp'
      || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')
    )
  ) return 'image'
  if (
    media.type === 'video' && (
      mime === 'video/mp4' || mime === 'video/webm' || mime === 'video/quicktime' || mime === 'video/x-quicktime'
      || name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov')
    )
  ) return 'video'
  return null
}

export function getCanvasLibraryDisabledReason(media: UploadedMedia): string | null {
  if (media.uploading) return 'Still syncing to the media library.'
  if (!media.url && !media.proxyUrl) return 'Media URL is unavailable. Refresh or check storage access.'
  if (!getCanvasLibraryMediaType(media)) return 'Unsupported in CANVAS. Use MP4, WebM, MOV, PNG, JPG, WebP, or SVG.'
  return null
}

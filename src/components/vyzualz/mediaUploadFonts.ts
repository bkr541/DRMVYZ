// Font handling for the media upload dialog. Fonts are not media records: they go to the Font Library (the same upload the Font Library
// panel uses) and carry a name, tags and collections, so the dialog swaps its media fields for font fields when fonts are queued.

import type { FontFileDetails } from './react/renderers/fontGlyphUtils'

export const FONT_UPLOAD_ACCEPT = '.ttf,.otf,font/ttf,font/otf'
export const FONT_UPLOAD_LABEL = '.ttf / .otf, up to 2 MB'
export const FONT_PREVIEW_SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789'

export type FontQueueStatus = 'ready' | 'uploading' | 'done' | 'error'

export interface FontQueueEntry {
  id: string
  file: File
  /** Parsed details; null while the file is still being read. */
  details: FontFileDetails | null
  /** Why the file cannot be uploaded (wrong type, too large, unreadable). */
  fileError: string | null
  name: string
  tags: string[]
  collectionIds: string[]
  status: FontQueueStatus
  uploadError?: string
}

export function isFontUploadFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.(ttf|otf)$/i.test(file.name) || file.type === 'font/ttf' || file.type === 'font/otf'
}

/** A font entry can be uploaded once it has parsed cleanly and has a name. */
export function isFontEntryUploadable(entry: FontQueueEntry): boolean {
  return entry.status !== 'done' && entry.status !== 'uploading' && !entry.fileError && entry.details !== null && entry.name.trim().length > 0
}

export function formatFontBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** CSS family name the dialog registers for a queued font's live preview. */
export function fontPreviewFamily(entryId: string): string {
  return `mum-font-preview-${entryId}`
}

/** Why a selection of files cannot be queued together, or null when it can. */
export function explainFontSelection(args: {
  files: readonly Pick<File, 'name' | 'type'>[]
  mediaQueued: number
  fontsQueued: number
  audioOnly: boolean
}): string | null {
  const fonts = args.files.filter(isFontUploadFile)
  if (fonts.length === 0) return args.fontsQueued > 0 ? 'Fonts are queued. Upload or clear them before adding images, video or audio.' : null
  if (args.audioOnly) return 'Only audio files can be uploaded here.'
  if (fonts.length !== args.files.length || args.mediaQueued > 0) return 'Upload fonts in a separate batch from images, video and audio so each receives the right details.'
  return null
}

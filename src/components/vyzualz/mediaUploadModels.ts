// 3D model handling for the media upload dialog. A GLB is not a media record: it is stored as an imported model in the 3D Models library, so the dialog
// swaps its media fields for model fields when .glb files are queued (the same arrangement fonts use).

import type { GlbInspection } from '../../features/models/import/glbImport'
import { isGlbFile, MODEL_UPLOAD_ACCEPT, MODEL_UPLOAD_LABEL } from '../../features/models/import/glbContainer'

export { MODEL_UPLOAD_ACCEPT, MODEL_UPLOAD_LABEL }
export const isModelUploadFile = isGlbFile

export type ModelQueueStatus = 'ready' | 'uploading' | 'done' | 'error'

export interface ModelQueueEntry {
  id: string
  file: File
  /** The checked file; null while it is still being read and validated. */
  inspection: GlbInspection | null
  /** Why the file cannot be imported (not a GLB, over a budget, needs a decoder). */
  fileError: string | null
  /** Object URL of the drawn thumbnail, when there is one. */
  thumbnailUrl: string | null
  name: string
  description: string
  tags: string[]
  collectionIds: string[]
  status: ModelQueueStatus
  uploadError?: string
}

/** A model entry can be imported once it has been checked and has a name. */
export function isModelEntryUploadable(entry: ModelQueueEntry): boolean {
  return entry.status !== 'done' && entry.status !== 'uploading' && !entry.fileError && entry.inspection !== null && entry.name.trim().length > 0
}

/** Why a selection of files cannot be queued together, or null when it can. */
export function explainModelSelection(args: {
  files: readonly Pick<File, 'name' | 'type'>[]
  mediaQueued: number
  fontsQueued: number
  modelsQueued: number
  audioOnly: boolean
}): string | null {
  const models = args.files.filter(isModelUploadFile)
  if (models.length === 0) return args.modelsQueued > 0 ? '3D models are queued. Import or clear them before adding images, video, audio or fonts.' : null
  if (args.audioOnly) return 'Only audio files can be uploaded here.'
  if (models.length !== args.files.length || args.mediaQueued > 0 || args.fontsQueued > 0) return 'Import 3D models (.glb) in a separate batch from images, video, audio and fonts so each receives the right details.'
  return null
}

export function formatModelBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

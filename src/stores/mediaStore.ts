import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  listMediaItemsPage,
  saveMediaItemAtomic,
  reorderMediaCollectionAtomic,
  createSignedMediaUrl,
  uploadMediaFile,
  deleteMediaFile,
  beginMediaUpload,
  finalizeMediaUploadAtomic,
  markMediaUploadCleanupPending,
  updateMediaCleanupJob,
  requestMediaDeletion,
  finalizeMediaDeletion,
  listPendingMediaCleanup,
  listMediaCollections,
  createMediaCollection,
  updateMediaCollection,
  deleteMediaCollection,
} from '../lib/mediaDb'
import type { MediaMetadata, MediaDerivativePath, MediaCleanupJobRow, MediaUploadPhase } from '../types/database'
import type { CanonicalMediaItem, MediaLibraryCursor, MediaLibraryQuery } from '../lib/mediaDb'
import { suggestMediaRole, isAudioFile, isSvgFile } from '../lib/mediaRoles'
import type { MediaRole, MediaEnergy } from '../lib/mediaRoles'
import { useAudioStore } from './audioStore'
import { analyzeAudioFile } from '../utils/analyzeAudioFile'
import { useVisualStore } from './visualStore'
import { generateThumbnail, clearMediaGenerationCaches } from '../components/vyzualz/media/generateThumbnail'
import { MediaSigningCoordinator } from '../lib/mediaSigning'
import { BoundedObjectUrlCache } from '../lib/mediaAssetCache'
import type { MediaSigningPriority } from '../lib/mediaSigning'
import { analyzeSvgCapabilities } from '../components/vyzualz/react/renderers/svgCapabilityAnalysis'
import { analyzePaletteForMediaFile, mergeMediaMetadata } from '../features/personalization/mediaPaletteMetadata'

export type { MediaRole, MediaEnergy }
export type { MediaMetadata }

// ── Public types ──────────────────────────────────────────────────────────────

export interface UploadedMedia {
  id: string
  name: string
  title?: string
  description?: string
  type: 'image' | 'video'
  url: string
  thumbnailUrl: string | null       // server-side or upload-time generated thumbnail
  localThumbnailObjectUrl?: string  // client-generated thumbnail (data URL); used when thumbnailUrl is absent
  proxyUrl?: string                 // reserved: future backend/Electron proxy or transcode URL
  meta: string                      // e.g. "MP4 · 0:08" or "PNG · 1920×1080"
  favorite: boolean
  mediaRole: MediaRole
  tags: string[]
  collectionIds: string[]
  metadata: MediaMetadata           // width, height, duration, fps, hasAlpha, analyzedAt, etc.
  uploading?: boolean
  uploadError?: string
  derivativeWarning?: string
  /** Retained only for a failed local upload so the user can retry without reselecting the file. */
  uploadSourceFile?: File
  storagePath?: string
  thumbnailStoragePath?: string | null
  dbId?: string
  /** Stored upload MIME type. Used with mediaRole/content inspection for SVG filtering. */
  mimeType?: string | null
  /** Server-issued optimistic concurrency token. Present for synced media. */
  revision?: number
  uploadOperationId?: string
  lifecycleStatus?: 'complete' | 'deletion_pending' | 'deletion_failed'
  derivativePaths?: MediaDerivativePath[]
  uploadPhase?: MediaUploadPhase
  urlExpiresAt?: number
  thumbnailExpiresAt?: number
  originalSigning?: boolean
  thumbnailSigning?: boolean
  originalSigningError?: string
  thumbnailSigningError?: string
  originalLoadRetries?: number
  thumbnailLoadRetries?: number
  /** Registry key for a temporary local blob URL so eviction and cleanup revoke it exactly once. */
  localObjectUrlKey?: string
}

export type MediaMutationOperation =
  | 'edit' | 'role' | 'favorite' | 'tags' | 'add-to-collection'
  | 'remove-from-collection' | 'metadata'

export interface MediaEditAttempt {
  role: MediaRole
  title: string
  description: string
  favorite: boolean
  tags: string[]
  collectionIds: string[]
  metadata: MediaMetadata
}

export interface MediaMutationState {
  itemId: string
  operation: MediaMutationOperation
  status: 'pending' | 'failed' | 'conflict'
  message: string | null
  attempted: MediaEditAttempt
  baseline: MediaEditAttempt
  updatedAt: number
}

export interface CollectionOrderMutationState {
  collectionId: string
  status: 'pending' | 'failed' | 'conflict'
  message: string | null
  attemptedOrder: string[]
  previousOrder: string[]
  updatedAt: number
}

export interface MediaDeletionState {
  itemId: string
  dbId: string
  jobId: string
  status: 'pending' | 'failed'
  message: string | null
  storagePaths: string[]
  completedPaths: string[]
  updatedAt: number
}


export interface MediaUploadCleanupState {
  jobId: string
  operationId: string
  status: 'pending' | 'failed'
  message: string | null
  storagePaths: string[]
  completedPaths: string[]
  updatedAt: number
}

export function mediaMutationKey(itemId: string, operation: MediaMutationOperation): string {
  return `${itemId}:${operation}`
}

export interface UploadQueueItem {
  tempId: string
  operationId: string
  file: File
  previewUrl: string        // object URL for preview in modal
  suggestedRole: MediaRole
  isAudio: boolean
}

export type UploadWorkflowPhase = MediaUploadPhase | 'cancelled'

export interface UploadProgressEvent {
  tempId: string
  fileName: string
  completed: number
  total: number
  status: 'uploading' | 'done' | 'error'
  phase?: UploadWorkflowPhase
  error?: string
}

export interface UploadBatchFailure {
  tempId: string
  fileName: string
  error: string
}

export interface UploadBatchResult {
  total: number
  succeeded: number
  failures: UploadBatchFailure[]
}

export interface UploadQueuedMediaOptions {
  onProgress?: (event: UploadProgressEvent) => void
  signal?: AbortSignal
}

export interface CanonicalVisualUploadOptions {
  role?: MediaRole
  title?: string
  description?: string
  tags?: string[]
  collectionIds?: string[]
  metadata?: MediaMetadata
  operationId?: string
  signal?: AbortSignal
  onPhase?: (phase: UploadWorkflowPhase) => void
}

export type CanonicalVisualUploadResult =
  | { ok: true; item: UploadedMedia }
  | { ok: false; error: string; phase: UploadWorkflowPhase; cleanupPending?: boolean }

export type MediaDeletionConfirmation = 'remove-deck-references' | 'delete-affected-decks'

export interface MediaDeletionAffectedDeck {
  id: string
  name: string
  remainingItemCount: number
}

export interface MediaDeletionWarning {
  itemId: string
  affectedDecks: MediaDeletionAffectedDeck[]
  action: 'confirm-reference-removal' | 'confirm-deck-deletion'
  message: string
  confirmationCopy: string
}

export type MediaDeletionGuardResult =
  | { allowed: true; apply?: () => boolean; rollback?: () => void }
  | { allowed: false; warning: MediaDeletionWarning }

export type MediaDeletionGuard = (
  item: UploadedMedia,
  confirmation?: MediaDeletionConfirmation,
) => MediaDeletionGuardResult

let mediaDeletionGuard: MediaDeletionGuard | null = null

export function registerMediaDeletionGuard(guard: MediaDeletionGuard | null): () => void {
  mediaDeletionGuard = guard
  return () => {
    if (mediaDeletionGuard === guard) mediaDeletionGuard = null
  }
}

export interface UploadDraft {
  role: MediaRole
  title: string
  description: string
  tags: string[]
  collectionIds: string[]
  metadata: MediaMetadata
  // Audio-specific fields (only used when queue contains audio files)
  audioArtist: string
  audioGenre: string
  audioBpm: string       // kept as string to match text/number input value
  audioMusicalKey: string
}

export type MediaFilter = 'all' | 'images' | 'videos' | 'favorites' | MediaRole

export interface MediaCollection {
  id: string
  name: string
  description?: string
}

const DEFAULT_DRAFT: UploadDraft = {
  role: 'other',
  title: '',
  description: '',
  tags: [],
  collectionIds: [],
  metadata: {},
  audioArtist: '',
  audioGenre: '',
  audioBpm: '',
  audioMusicalKey: '',
}

export const MEDIA_LIBRARY_PAGE_SIZE = 48
export const MEDIA_LIBRARY_STALE_AFTER_MS = 2 * 60 * 1000
const MEDIA_STORAGE_BUCKET = 'media-items'
const DEFAULT_LIBRARY_QUERY: MediaLibraryQuery = { search: '', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' }
export const MEDIA_BATCH_CONCURRENCY = 4

/** Run input-sized media work through a fixed worker pool instead of spawning one promise per item. */
export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (values.length === 0) return []
  const results = new Array<R>(values.length)
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), values.length))

  const runWorker = async () => {
    while (true) {
      const index = nextIndex
      nextIndex += 1
      if (index >= values.length) return
      results[index] = await worker(values[index], index)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

let libraryRequestGeneration = 0
let nextPagePromise: Promise<void> | null = null
let refreshPromise: { queryKey: string; promise: Promise<void> } | null = null
const mediaObjectUrlCache = new BoundedObjectUrlCache(512)

function managedObjectUrl(key: string, blob: Blob): string {
  const url = URL.createObjectURL(blob)
  mediaObjectUrlCache.set(key, url)
  return url
}

function releaseManagedObjectUrl(key: string | undefined, fallbackUrl?: string | null): void {
  if (key && mediaObjectUrlCache.delete(key)) return
  if (fallbackUrl?.startsWith('blob:')) URL.revokeObjectURL(fallbackUrl)
}

const mediaSigningCoordinator = new MediaSigningCoordinator({
  maxConcurrency: 4,
  maxCacheEntries: 256,
  expiresInSeconds: 60 * 60,
  refreshSkewMs: 60_000,
  signer: async (_bucket, path, expiresInSeconds) => createSignedMediaUrl(path, expiresInSeconds),
})

export function mediaLibraryQueryKey(query: MediaLibraryQuery): string {
  return JSON.stringify({ search: query.search.trim(), filter: query.filter, scope: query.scope, collectionId: query.collectionId, sort: query.sort })
}

function normalizeLibraryQuery(query: MediaLibraryQuery): MediaLibraryQuery {
  return { ...query, search: query.search.trim(), collectionId: query.collectionId || null, sort: 'created_desc' }
}

function stableMediaCachePrefix(item: Pick<UploadedMedia, 'storagePath' | 'id'>): string {
  return item.storagePath ?? item.id
}

function itemMatchesLibraryQuery(item: UploadedMedia, query: MediaLibraryQuery): boolean {
  if (query.collectionId && !item.collectionIds.includes(query.collectionId)) return false
  if (query.scope === 'react' && !(
    item.mediaRole === 'svg' || item.mediaRole === 'logo' || item.mediaRole === 'transparent_element' || item.mediaRole === 'overlay'
    || item.mimeType?.toLowerCase() === 'image/svg+xml' || item.storagePath?.toLowerCase().endsWith('.svg')
  )) return false
  switch (query.filter) {
    case 'images': if (item.type !== 'image') return false; break
    case 'videos': if (item.type !== 'video') return false; break
    case 'favorites': if (!item.favorite) return false; break
    case 'backgrounds': if (item.mediaRole !== 'background_image' && item.mediaRole !== 'background_video') return false; break
    case 'logos': if (item.mediaRole !== 'logo') return false; break
    case 'transparent': if (item.mediaRole !== 'transparent_element') return false; break
    case 'overlays': if (item.mediaRole !== 'overlay') return false; break
    case 'svg': if (!(item.mediaRole === 'svg' || item.mimeType?.toLowerCase() === 'image/svg+xml' || item.storagePath?.toLowerCase().endsWith('.svg'))) return false; break
  }
  const search = query.search.trim().toLowerCase()
  return !search || (item.title ?? item.name).toLowerCase().includes(search)
    || item.name.toLowerCase().includes(search)
    || (item.description ?? '').toLowerCase().includes(search)
    || item.tags.some(tag => tag.toLowerCase().includes(search))
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function generateId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function generateOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function storageExtensionForFile(file: File): string {
  const filenameExt = file.name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1]
  const allowed = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'mov', 'webm'])
  if (filenameExt && allowed.has(filenameExt)) return filenameExt === 'jpeg' ? 'jpg' : filenameExt
  const byMime: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  }
  return byMime[file.type] ?? 'bin'
}

function isOwnedExactStoragePath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.split('/').some(segment => segment === '..' || segment === '.')
}

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getImageDimensions(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function getVideoDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.preload = 'metadata'
    const cleanup = (result: number) => {
      v.onloadedmetadata = null; v.onerror = null
      v.src = ''; resolve(result)
    }
    v.onloadedmetadata = () => cleanup(v.duration || 0)
    v.onerror          = () => cleanup(0)
    v.src = url
  })
}

function grabVideoThumbnail(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.muted = true; v.playsInline = true
    v.preload = 'metadata'; v.crossOrigin = 'anonymous'
    const cleanup = (result: string | null) => {
      v.onseeked = null; v.onerror = null; v.onloadeddata = null
      v.src = ''; resolve(result)
    }
    const draw = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 160; c.height = 90
        const ctx = c.getContext('2d')
        if (!ctx) { cleanup(null); return }
        ctx.drawImage(v, 0, 0, 160, 90)
        cleanup(c.toDataURL('image/jpeg', 0.7))
      } catch { cleanup(null) }
    }
    v.onseeked     = draw
    v.onerror      = () => cleanup(null)
    v.onloadeddata = () => { if (v.readyState >= 2) draw() }
    v.src = url; v.currentTime = 0.5
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch?.[1] ?? 'image/jpeg'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// Internal upload pipeline shape — carries detected dims/duration for DB columns
type LocalItem = UploadedMedia & {
  _width?: number
  _height?: number
  _duration?: number
  _thumbDataUrl?: string
}

interface BuildItemOptions {
  role?: MediaRole
  title?: string
  description?: string
  tags?: string[]
  collectionIds?: string[]
  metadata?: MediaMetadata
}

async function buildLocalItem(file: File, opts?: BuildItemOptions): Promise<LocalItem> {
  const id = generateId()
  const localObjectUrlKey = `local:${id}:original`
  const url = managedObjectUrl(localObjectUrlKey, file)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
  const ext     = (file.name.split('.').pop() ?? '').toUpperCase()
  const role    = opts?.role ?? suggestMediaRole(file)
  const baseMeta: MediaMetadata = opts?.metadata ?? {}
  let svgValidation = baseMeta.svgValidation

  if (!svgValidation && isSvgFile(file)) {
    try {
      const capabilities = analyzeSvgCapabilities(await file.text())
      svgValidation = {
        isValidSvg:             capabilities.isValidSvg,
        hasVectorGeometry:      capabilities.hasVectorGeometry,
        hasEmbeddedRaster:      capabilities.hasEmbeddedRaster,
        hasExternalRaster:      capabilities.hasExternalRaster,
        reactivePathCompatible: capabilities.reactivePathCompatible,
      }
    } catch {
      svgValidation = {
        isValidSvg: false,
        hasVectorGeometry: false,
        hasEmbeddedRaster: false,
        hasExternalRaster: false,
        reactivePathCompatible: false,
      }
    }
  }

  const mimeType = svgValidation?.isValidSvg
    ? 'image/svg+xml'
    : (baseMeta.detectedMimeType || file.type || null)
  const metadataWithSvg = mergeMediaMetadata(baseMeta, svgValidation ? { svgValidation } : {})

  if (isVideo) {
    const [thumbDataUrl, duration] = await Promise.all([
      grabVideoThumbnail(url),
      getVideoDuration(url),
    ])
    return {
      id, name: file.name, type: 'video', url,
      localObjectUrlKey,
      thumbnailUrl: thumbDataUrl,
      meta: `${ext} · ${fmtDur(duration)}`,
      favorite: false,
      mediaRole: role,
      tags: opts?.tags ?? [],
      collectionIds: opts?.collectionIds ?? [],
      title: opts?.title,
      description: opts?.description,
      metadata: mergeMediaMetadata(metadataWithSvg, { duration }),
      mimeType,
      _duration: duration,
      _thumbDataUrl: thumbDataUrl ?? undefined,
    }
  }

  const dims = await getImageDimensions(url)
  const shouldAnalyzePalette = !isSvgFile(file) || svgValidation?.isValidSvg === true
  const paletteMetadata = shouldAnalyzePalette ? await analyzePaletteForMediaFile(file) : {}
  const preparedMetadata = mergeMediaMetadata(metadataWithSvg, {
    ...paletteMetadata,
    width: dims?.w,
    height: dims?.h,
  })
  if (paletteMetadata.paletteAnalysisError) {
    console.warn('[mediaStore] palette analysis failed (non-fatal):', file.name, paletteMetadata.paletteAnalysisError.message)
  }
  return {
    id, name: file.name, type: 'image', url,
    localObjectUrlKey,
    thumbnailUrl: url,
    meta: dims ? `${ext} · ${dims.w}×${dims.h}` : ext,
    favorite: false,
    mediaRole: role,
    tags: opts?.tags ?? [],
    collectionIds: opts?.collectionIds ?? [],
    title: opts?.title,
    description: opts?.description,
    metadata: preparedMetadata,
    mimeType,
    _width: dims?.w,
    _height: dims?.h,
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  if (!supabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

type UploadResult =
  | {
      ok: true
      storagePath: string
      thumbnailStoragePath: string | null
      derivatives: MediaDerivativePath[]
      mediaItem: CanonicalMediaItem
      derivativeWarning?: string
    }
  | { ok: false; error: string; phase: UploadWorkflowPhase; cleanupPending?: boolean }

function uploadCancelled(signal?: AbortSignal): boolean {
  return signal?.aborted === true
}

async function cleanupFailedUpload(
  operationId: string,
  paths: string[],
  reason: string,
): Promise<{ cleanupPending: boolean; detail?: string }> {
  const uniquePaths = Array.from(new Set(paths))
  const recorded = await markMediaUploadCleanupPending(operationId, uniquePaths, reason)
  if (!recorded.ok) {
    return { cleanupPending: true, detail: `${reason} Cleanup recovery could not be recorded: ${recorded.message}` }
  }

  const completed = [...recorded.cleanupJob.completed_paths]
  let cleanupError: string | null = null
  for (const path of uniquePaths) {
    if (completed.includes(path)) continue
    const result = await deleteMediaFile(path)
    if (result.error) {
      cleanupError = interpretError(result.error)
      break
    }
    completed.push(path)
  }

  if (cleanupError) {
    await updateMediaCleanupJob(recorded.cleanupJob.id, completed, 'failed', cleanupError)
    return { cleanupPending: true, detail: `${reason} Uploaded objects are queued for cleanup. Retry after reconnecting.` }
  }

  const updated = await updateMediaCleanupJob(recorded.cleanupJob.id, completed, 'complete', null)
  if (!updated.ok) {
    return { cleanupPending: true, detail: `${reason} Storage was cleaned, but cleanup completion could not be reconciled.` }
  }
  return { cleanupPending: false }
}

async function uploadToSupabase(
  file: File,
  item: LocalItem,
  userId: string,
  operationId: string,
  options: { signal?: AbortSignal; onPhase?: (phase: UploadWorkflowPhase) => void } = {},
): Promise<UploadResult> {
  const extension = storageExtensionForFile(file)
  const storagePath = `${userId}/uploads/${operationId}/original.${extension}`
  const thumbPath = `${userId}/uploads/${operationId}/thumbnail.jpg`
  const plannedDerivatives: MediaDerivativePath[] = item.type === 'video'
    ? [{ kind: 'thumbnail', path: thumbPath, required: false, status: 'pending' }]
    : []
  const cleanupPaths: string[] = []

  const fail = async (error: string, phase: UploadWorkflowPhase): Promise<UploadResult> => {
    if (!cleanupPaths.length) return { ok: false, error, phase }
    options.onPhase?.('cleanup_pending')
    const cleanup = await cleanupFailedUpload(operationId, cleanupPaths, error)
    return {
      ok: false,
      error: cleanup.detail ?? error,
      phase: cleanup.cleanupPending ? 'cleanup_pending' : phase,
      cleanupPending: cleanup.cleanupPending,
    }
  }

  try {
    options.onPhase?.('preparing')
    const begun = await beginMediaUpload(operationId, storagePath, plannedDerivatives)
    if (!begun.ok) return { ok: false, error: begun.message, phase: 'preparing' }
    const existingCanonical = begun.mediaItem
    const retryableDerivativeFailure = existingCanonical?.derivative_paths?.some(
      derivative => derivative.status === 'failed',
    ) === true
    if (existingCanonical && !retryableDerivativeFailure) {
      return {
        ok: true,
        storagePath: existingCanonical.storage_path,
        thumbnailStoragePath: existingCanonical.thumbnail_path,
        derivatives: existingCanonical.derivative_paths ?? [],
        mediaItem: existingCanonical,
      }
    }
    if (uploadCancelled(options.signal)) return { ok: false, error: 'Upload cancelled before storage changes began.', phase: 'cancelled' }

    options.onPhase?.('uploading_original')
    const contentType = item.metadata.svgValidation?.isValidSvg
      ? 'image/svg+xml'
      : (item.mimeType || file.type || 'application/octet-stream')
    const originalResult = await uploadMediaFile(storagePath, file, contentType)
    if (originalResult.error) return { ok: false, error: interpretError(originalResult.error), phase: 'uploading_original' }
    if (!existingCanonical) cleanupPaths.push(storagePath)
    if (uploadCancelled(options.signal)) return fail('Upload cancelled. The uploaded original is being cleaned up.', 'cancelled')

    let thumbnailStoragePath: string | null = item.type === 'image' ? storagePath : null
    let derivativeWarning: string | undefined
    const derivatives = plannedDerivatives.map(derivative => ({ ...derivative }))

    if (item.type === 'video') {
      options.onPhase?.('preparing_derivative')
      const thumbnail = derivatives[0]
      if (item._thumbDataUrl) {
        try {
          const thumbBlob = dataUrlToBlob(item._thumbDataUrl)
          const thumbResult = await uploadMediaFile(thumbPath, thumbBlob, 'image/jpeg')
          if (thumbResult.error) {
            thumbnail.status = 'failed'
            thumbnail.error = interpretError(thumbResult.error)
            derivativeWarning = `Thumbnail failed: ${thumbnail.error}`
          } else {
            thumbnail.status = 'ready'
            thumbnailStoragePath = thumbPath
            if (!existingCanonical) cleanupPaths.push(thumbPath)
          }
        } catch (error) {
          thumbnail.status = 'failed'
          thumbnail.error = error instanceof Error ? error.message : 'Thumbnail preparation failed.'
          derivativeWarning = `Thumbnail failed: ${thumbnail.error}`
        }
      } else {
        thumbnail.status = 'failed'
        thumbnail.error = 'A thumbnail could not be generated from this video.'
        derivativeWarning = thumbnail.error
      }
    }

    if (uploadCancelled(options.signal)) return fail('Upload cancelled. Uploaded objects are being cleaned up.', 'cancelled')

    options.onPhase?.('saving_record')
    const finalized = await finalizeMediaUploadAtomic({
      operationId,
      media: {
        name: item.name,
        type: item.type,
        storage_path: storagePath,
        thumbnail_path: thumbnailStoragePath,
        mime_type: contentType || null,
        file_size: file.size,
        width: item._width ?? item.metadata.width ?? null,
        height: item._height ?? item.metadata.height ?? null,
        duration_sec: item._duration ?? item.metadata.duration ?? null,
        favorite: false,
        media_role: item.mediaRole,
        title: item.title ?? null,
        description: item.description ?? null,
        metadata: item.metadata,
      },
      tagNames: item.tags,
      collectionIds: item.collectionIds,
      derivatives,
    })
    if (!finalized.ok) {
      if (finalized.kind === 'transport') {
        const reconciled = await beginMediaUpload(operationId, storagePath, plannedDerivatives)
        if (reconciled.ok && reconciled.mediaItem) {
          options.onPhase?.('complete')
          return {
            ok: true,
            storagePath: reconciled.mediaItem.storage_path,
            thumbnailStoragePath: reconciled.mediaItem.thumbnail_path,
            derivatives: reconciled.mediaItem.derivative_paths ?? derivatives,
            mediaItem: reconciled.mediaItem,
          }
        }
      }
      return fail(finalized.message, 'saving_record')
    }

    options.onPhase?.('complete')
    return {
      ok: true,
      storagePath: finalized.mediaItem.storage_path,
      thumbnailStoragePath: finalized.mediaItem.thumbnail_path,
      derivatives: finalized.mediaItem.derivative_paths ?? derivatives,
      mediaItem: finalized.mediaItem,
      ...(derivativeWarning ? { derivativeWarning } : {}),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected upload error'
    return fail(interpretError(message), 'failed')
  }
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function interpretError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('jwt') || lower.includes('unauthorized') || lower.includes('not authenticated')) return 'Session expired — sign in again'
  if (lower.includes('row-level security') || lower.includes('policy')) return 'Storage permission denied — check RLS policies'
  if (lower.includes('already exists') || lower.includes('duplicate')) return 'File already exists in storage'
  if (lower.includes('network') || lower.includes('fetch')) return 'Network error — check connection'
  if (lower.includes('bucket') && lower.includes('not found')) return 'Storage bucket not found — check Supabase config'
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg
}


function mediaAttemptFromItem(item: UploadedMedia, overrides: Partial<MediaEditAttempt> = {}): MediaEditAttempt {
  return {
    role: overrides.role ?? item.mediaRole,
    title: overrides.title ?? item.title ?? '',
    description: overrides.description ?? item.description ?? '',
    favorite: overrides.favorite ?? item.favorite,
    tags: overrides.tags ?? [...item.tags],
    collectionIds: overrides.collectionIds ?? [...item.collectionIds],
    metadata: overrides.metadata ?? { ...item.metadata },
  }
}

function reconcileCanonicalMediaItem(item: UploadedMedia, canonical: CanonicalMediaItem): UploadedMedia {
  const metadata: MediaMetadata = {
    width: canonical.width ?? undefined,
    height: canonical.height ?? undefined,
    duration: canonical.duration_sec ?? undefined,
    ...(canonical.metadata ?? {}),
  }
  return {
    ...item,
    dbId: canonical.id,
    storagePath: canonical.storage_path,
    thumbnailStoragePath: canonical.thumbnail_path,
    mimeType: canonical.mime_type,
    name: canonical.name,
    title: canonical.title ?? undefined,
    description: canonical.description ?? undefined,
    type: canonical.type,
    favorite: canonical.favorite,
    mediaRole: canonical.media_role as MediaRole,
    tags: [...canonical.tags],
    collectionIds: [...canonical.collection_ids],
    metadata,
    revision: canonical.revision,
    uploadOperationId: canonical.upload_operation_id ?? undefined,
    lifecycleStatus: canonical.lifecycle_status,
    derivativePaths: [...(canonical.derivative_paths ?? [])],
    uploadPhase: 'complete',
  }
}


function canonicalMediaToUploaded(canonical: CanonicalMediaItem, existing?: UploadedMedia): UploadedMedia {
  const extension = canonical.storage_path.split('.').pop()?.toUpperCase() ?? ''
  const displayMeta = canonical.type === 'video'
    ? `${extension} · ${fmtDur(canonical.duration_sec ?? 0)}`
    : canonical.width && canonical.height ? `${extension} · ${canonical.width}×${canonical.height}` : extension
  return reconcileCanonicalMediaItem(existing ?? {
    id: `db-${canonical.id}`,
    dbId: canonical.id,
    name: canonical.name,
    type: canonical.type,
    url: '',
    thumbnailUrl: null,
    meta: displayMeta,
    favorite: canonical.favorite,
    mediaRole: canonical.media_role as MediaRole,
    tags: [],
    collectionIds: [],
    metadata: {},
  }, canonical)
}

function withCanonicalWarnings(item: UploadedMedia, canonical: CanonicalMediaItem): UploadedMedia {
  const failed = (canonical.derivative_paths ?? []).filter(derivative => derivative.status === 'failed')
  return {
    ...canonicalMediaToUploaded(canonical, item),
    derivativeWarning: failed.length
      ? `${failed.map(derivative => derivative.kind).join(', ')} generation failed. Re-select the original file to retry.`
      : undefined,
  }
}

function reconcileLibraryItems(
  current: UploadedMedia[],
  canonicalItems: CanonicalMediaItem[],
  mutationStates: Record<string, MediaMutationState>,
): UploadedMedia[] {
  const byId = new Map(current.map(item => [item.id, item]))
  for (const canonical of canonicalItems) {
    const id = `db-${canonical.id}`
    const existing = byId.get(id)
    const pending = Object.values(mutationStates).some(state => state.itemId === id && state.status === 'pending')
    const reconciled = withCanonicalWarnings(existing ?? canonicalMediaToUploaded(canonical), canonical)
    byId.set(id, existing && pending ? {
      ...reconciled,
      title: existing.title,
      description: existing.description,
      favorite: existing.favorite,
      mediaRole: existing.mediaRole,
      tags: [...existing.tags],
      collectionIds: [...existing.collectionIds],
      metadata: { ...existing.metadata },
    } : reconciled)
  }
  const existingIds = new Set(current.map(item => item.id))
  return [
    ...current.map(item => byId.get(item.id)!).filter(Boolean),
    ...canonicalItems.map(item => byId.get(`db-${item.id}`)!).filter(item => !existingIds.has(item.id)),
  ]
}

function cleanupJobToUploadState(job: MediaCleanupJobRow): MediaUploadCleanupState | null {
  if (job.kind !== 'upload_rollback' || !job.upload_operation_id || job.status === 'complete') return null
  return {
    jobId: job.id,
    operationId: job.upload_operation_id,
    status: job.status === 'failed' ? 'failed' : 'pending',
    message: job.last_error,
    storagePaths: [...job.storage_paths],
    completedPaths: [...job.completed_paths],
    updatedAt: Date.parse(job.updated_at) || Date.now(),
  }
}

function uploadCleanupStatesFromRows(rows: MediaCleanupJobRow[]): Record<string, MediaUploadCleanupState> {
  return Object.fromEntries(
    rows.map(cleanupJobToUploadState)
      .filter((state): state is MediaUploadCleanupState => state !== null)
      .map(state => [state.jobId, state]),
  )
}

async function runUploadRollbackCleanup(
  state: MediaUploadCleanupState,
  userId: string,
): Promise<{ ok: true } | { ok: false; state: MediaUploadCleanupState }> {
  const completed = [...state.completedPaths]
  for (const path of state.storagePaths) {
    if (completed.includes(path)) continue
    if (!isOwnedExactStoragePath(userId, path)) {
      const message = 'Upload cleanup stopped because a path is invalid or belongs to another account.'
      await updateMediaCleanupJob(state.jobId, completed, 'failed', message)
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }
    const removed = await deleteMediaFile(path)
    if (removed.error) {
      const message = `Upload cleanup failed for one exact object: ${interpretError(removed.error)}`
      await updateMediaCleanupJob(state.jobId, completed, 'failed', message)
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }
    completed.push(path)
    const progress = await updateMediaCleanupJob(state.jobId, completed, 'pending', null)
    if (!progress.ok) {
      const message = `Storage was removed, but upload cleanup progress could not be saved: ${progress.message}`
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }
  }
  const complete = await updateMediaCleanupJob(state.jobId, completed, 'complete', null)
  if (!complete.ok) {
    const message = complete.message
    return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
  }
  return { ok: true }
}

function cleanupJobToDeletionState(job: MediaCleanupJobRow): MediaDeletionState | null {
  if (job.kind !== 'media_deletion' || !job.media_item_id || job.status === 'complete') return null
  return {
    itemId: `db-${job.media_item_id}`,
    dbId: job.media_item_id,
    jobId: job.id,
    status: job.status === 'failed' ? 'failed' : 'pending',
    message: job.last_error,
    storagePaths: [...job.storage_paths],
    completedPaths: [...job.completed_paths],
    updatedAt: Date.parse(job.updated_at) || Date.now(),
  }
}

async function runDeletionCleanup(
  state: MediaDeletionState,
  userId: string,
): Promise<{ ok: true } | { ok: false; state: MediaDeletionState }> {
  const completed = [...state.completedPaths]
  for (const path of state.storagePaths) {
    if (completed.includes(path)) continue
    if (!isOwnedExactStoragePath(userId, path)) {
      const message = 'Deletion stopped because a cleanup path is invalid or belongs to another account.'
      await updateMediaCleanupJob(state.jobId, completed, 'failed', message)
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }

    const removed = await deleteMediaFile(path)
    if (removed.error) {
      const message = `Storage cleanup failed for one exact media object: ${interpretError(removed.error)}`
      await updateMediaCleanupJob(state.jobId, completed, 'failed', message)
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }
    completed.push(path)
    const progress = await updateMediaCleanupJob(state.jobId, completed, 'pending', null)
    if (!progress.ok) {
      const message = `Storage was removed, but cleanup progress could not be saved: ${progress.message}`
      return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
    }
  }

  const finalized = await finalizeMediaDeletion(state.jobId)
  if (!finalized.ok) {
    const message = finalized.message
    await updateMediaCleanupJob(state.jobId, completed, 'failed', message)
    return { ok: false, state: { ...state, status: 'failed', message, completedPaths: completed, updatedAt: Date.now() } }
  }
  return { ok: true }
}

function purgeRuntimeMedia(item: UploadedMedia, remaining: UploadedMedia[]): void {
  const visual = useVisualStore.getState()
  const wasActive = visual.activeMediaId === item.id
  visual.removeMediaReferences(item.id)
  if (wasActive) visual.setActiveMedia(remaining[0]?.id ?? null)

  releaseManagedObjectUrl(item.localObjectUrlKey, item.url)
  if (item.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(item.thumbnailUrl)
  if (item.localThumbnailObjectUrl?.startsWith('blob:')) URL.revokeObjectURL(item.localThumbnailObjectUrl)
  clearMediaGenerationCaches(stableMediaCachePrefix(item))
  const pathUserId = item.storagePath?.split('/')[0]
  if (pathUserId) {
    mediaSigningCoordinator.purgePaths(pathUserId, MEDIA_STORAGE_BUCKET, [
      item.storagePath,
      item.thumbnailStoragePath,
      ...(item.derivativePaths ?? []).map(derivative => derivative.path),
    ].filter((path): path is string => Boolean(path)))
  }
  void import('../components/vyzualz/react/services/svgMediaBridge')
    .then(({ cleanupRemovedSvgMedia }) => cleanupRemovedSvgMedia(item.id))
    .catch(() => undefined)
}

function applyLocalAttempt(item: UploadedMedia, attempt: MediaEditAttempt): UploadedMedia {
  return {
    ...item,
    mediaRole: attempt.role,
    title: attempt.title.trim() || undefined,
    description: attempt.description.trim() || undefined,
    favorite: attempt.favorite,
    tags: [...attempt.tags],
    collectionIds: [...attempt.collectionIds],
    metadata: { ...attempt.metadata },
  }
}


function rebaseAttemptForOperation(
  current: UploadedMedia,
  operation: MediaMutationOperation,
  attempted: MediaEditAttempt,
  baseline: MediaEditAttempt,
): MediaEditAttempt {
  if (operation === 'edit') return attempted
  const rebased = mediaAttemptFromItem(current)
  if (operation === 'role') return { ...rebased, role: attempted.role }
  if (operation === 'favorite') return { ...rebased, favorite: attempted.favorite }
  if (operation === 'tags') return { ...rebased, tags: [...attempted.tags] }
  if (operation === 'add-to-collection') {
    const added = attempted.collectionIds.filter(id => !baseline.collectionIds.includes(id))
    return { ...rebased, collectionIds: Array.from(new Set([...rebased.collectionIds, ...added])) }
  }
  if (operation === 'remove-from-collection') {
    const removed = new Set(baseline.collectionIds.filter(id => !attempted.collectionIds.includes(id)))
    return { ...rebased, collectionIds: rebased.collectionIds.filter(id => !removed.has(id)) }
  }
  const changedMetadata = Object.fromEntries(
    Object.entries(attempted.metadata).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(baseline.metadata[key as keyof MediaMetadata])),
  ) as Partial<MediaMetadata>
  return { ...rebased, metadata: mergeMediaMetadata(rebased.metadata, changedMetadata) }
}

function applyCollectionOrder(items: UploadedMedia[], collectionId: string, orderedIds: string[]): UploadedMedia[] {
  const ordered = orderedIds
    .map(id => items.find(item => item.id === id))
    .filter((item): item is UploadedMedia => Boolean(item && item.collectionIds.includes(collectionId)))
  if (ordered.length !== orderedIds.length) return items
  let index = 0
  return items.map(item => item.collectionIds.includes(collectionId) ? ordered[index++] : item)
}

// ── Store interface ───────────────────────────────────────────────────────────

interface MediaState {
  items: UploadedMedia[]
  queryItemIds: string[]
  collections: MediaCollection[]
  loading: boolean
  nextPageLoading: boolean
  refreshing: boolean
  hasMore: boolean
  cursor: MediaLibraryCursor | null
  libraryQuery: MediaLibraryQuery
  libraryQueryKey: string
  queryError: string | null
  lastSuccessfulLoad: number | null
  invalidated: boolean
  accountId: string | null
  collectionsLoading: boolean
  loadError: string | null
  deleteError: string | null
  pendingDeletionWarning: MediaDeletionWarning | null
  authRequired: boolean
  storageAvailable: boolean
  lastRestored: number | null
  activeFilter: MediaFilter
  mutationStates: Record<string, MediaMutationState>
  collectionOrderMutations: Record<string, CollectionOrderMutationState>
  deletionStates: Record<string, MediaDeletionState>
  uploadCleanupStates: Record<string, MediaUploadCleanupState>

  // Modal
  importModalOpen: boolean
  openImportMediaModal(): void
  closeImportMediaModal(): void

  // Upload queue
  uploadQueue: UploadQueueItem[]
  addFilesToUploadQueue(files: File[]): number
  removeUploadQueueItem(tempId: string): void
  clearUploadQueue(): void

  // Upload draft (shared metadata for all queued files)
  uploadDraft: UploadDraft
  setUploadDraftRole(role: MediaRole): void
  setUploadDraftTitle(title: string): void
  setUploadDraftDescription(desc: string): void
  setUploadDraftTags(tags: string[]): void
  setUploadDraftCollections(ids: string[]): void
  setUploadDraftMetadata(patch: Partial<MediaMetadata>): void
  replaceUploadDraftMetadata(metadata: MediaMetadata): void
  setUploadDraftAudioArtist(v: string): void
  setUploadDraftAudioGenre(v: string): void
  setUploadDraftAudioBpm(v: string): void
  setUploadDraftAudioMusicalKey(v: string): void
  resetUploadDraft(): void

  // Upload
  uploadQueuedMedia(options?: UploadQueuedMediaOptions): Promise<UploadBatchResult>
  uploadCanonicalVisualFile(file: File, options?: CanonicalVisualUploadOptions): Promise<CanonicalVisualUploadResult>
  addFiles(files: File[]): Promise<void>   // quick drag-drop path (no modal)

  // Load
  setLibraryQuery(query: MediaLibraryQuery): void
  ensureLibraryLoaded(query?: MediaLibraryQuery, force?: boolean): Promise<void>
  loadFromSupabase(): Promise<void>
  loadNextPage(): Promise<void>
  refreshLibrary(): Promise<void>
  invalidateLibrary(): void
  ensureMediaSigned(itemIds: string[], priority: MediaSigningPriority): Promise<void>
  retryMediaAsset(itemId: string, variant: 'original' | 'thumbnail'): Promise<boolean>
  markMediaAssetLoaded(itemId: string, variant: 'original' | 'thumbnail'): void

  // Item mutations
  removeItem(id: string, options?: { confirmation?: MediaDeletionConfirmation }): Promise<boolean>
  retryUpload(id: string): Promise<boolean>
  retryDeletion(itemId: string): Promise<boolean>
  retryUploadCleanup(jobId: string): Promise<boolean>
  persistMediaMutation(id: string, operation: MediaMutationOperation, attempt: MediaEditAttempt): Promise<boolean>
  retryMediaMutation(id: string, operation: MediaMutationOperation): Promise<boolean>
  reapplyMediaMutation(id: string, operation: MediaMutationOperation): Promise<boolean>
  clearMediaMutation(id: string, operation: MediaMutationOperation): void
  toggleFavorite(id: string): Promise<boolean>
  toggleFavoriteMedia(id: string): Promise<boolean>    // alias for toggleFavorite
  reorderItems(order: string[]): void
  setMediaRole(mediaId: string, role: MediaRole): Promise<boolean>
  setMediaTags(mediaId: string, tags: string[]): Promise<boolean>
  addMediaTag(mediaId: string, tag: string): Promise<boolean>
  removeMediaTag(mediaId: string, tag: string): Promise<boolean>
  bulkTagMedia(mediaIds: string[], tags: string[]): Promise<void>
  saveMediaEdits(id: string, patch: { role: MediaRole; title: string; description: string; tags: string[]; collectionIds: string[]; metadata: MediaMetadata }): Promise<boolean>
  updateMediaMetadata(mediaId: string, patch: Partial<MediaMetadata>): Promise<boolean>

  // Collections
  loadCollections(): Promise<void>
  createCollection(name: string, description?: string): Promise<string | null>
  updateCollection(id: string, name: string, description?: string): Promise<boolean>
  removeCollection(id: string): Promise<boolean>
  addMediaToCollection(collectionId: string, mediaIds: string[]): Promise<void>
  removeMediaFromCollection(collectionId: string, mediaIds: string[]): Promise<void>
  reorderCollectionItems(collectionId: string, orderedMediaIds: string[]): Promise<boolean>
  retryCollectionReorder(collectionId: string): Promise<boolean>
  clearCollectionReorderError(collectionId: string): void

  // Thumbnail generation
  generateMissingThumbnails(): void

  // Filter
  filterMedia(filter: MediaFilter): void

  // Error / status
  clearLoadError(): void
  clearDeleteError(): void
  clearRestored(): void
  clear(): void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],
  queryItemIds: [],
  collections: [],
  loading: false,
  nextPageLoading: false,
  refreshing: false,
  hasMore: true,
  cursor: null,
  libraryQuery: { ...DEFAULT_LIBRARY_QUERY },
  libraryQueryKey: mediaLibraryQueryKey(DEFAULT_LIBRARY_QUERY),
  queryError: null,
  lastSuccessfulLoad: null,
  invalidated: true,
  accountId: null,
  collectionsLoading: false,
  loadError: null,
  deleteError: null,
  pendingDeletionWarning: null,
  authRequired: false,
  storageAvailable: supabaseConfigured,
  lastRestored: null,
  activeFilter: 'all',
  mutationStates: {},
  collectionOrderMutations: {},
  deletionStates: {},
  uploadCleanupStates: {},

  // ── Modal ─────────────────────────────────────────────────────────────────

  importModalOpen: false,
  openImportMediaModal()  { set({ importModalOpen: true }) },
  closeImportMediaModal() { set({ importModalOpen: false }) },

  // ── Upload queue ──────────────────────────────────────────────────────────

  uploadQueue: [],

  addFilesToUploadQueue(files) {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/') ||
      /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (!mediaFiles.length) {
      set({ loadError: 'No supported image, video, SVG, or audio files were selected.' })
      return 0
    }
    const incomingKinds = new Set(mediaFiles.map(file => isAudioFile(file) ? 'audio' : 'visual'))
    const existingKind = get().uploadQueue[0]?.isAudio ? 'audio' : get().uploadQueue[0] ? 'visual' : null
    if (incomingKinds.size > 1 || (existingKind && !incomingKinds.has(existingKind))) {
      set({ loadError: 'Upload audio and visual files in separate batches.' })
      return 0
    }
    const items: UploadQueueItem[] = mediaFiles.map(file => {
      const audio = isAudioFile(file)
      const tempId = generateId()
      return {
        tempId,
        operationId: generateOperationId(),
        file,
        previewUrl: managedObjectUrl(`queue:${tempId}`, file),
        suggestedRole: audio ? 'audio_track' : suggestMediaRole(file),
        isAudio: audio,
      }
    })
    set(state => ({ uploadQueue: [...state.uploadQueue, ...items], loadError: null }))
    return items.length
  },

  removeUploadQueueItem(tempId) {
    const item = get().uploadQueue.find(q => q.tempId === tempId)
    if (item) releaseManagedObjectUrl(`queue:${item.tempId}`, item.previewUrl)
    set(s => ({ uploadQueue: s.uploadQueue.filter(q => q.tempId !== tempId) }))
  },

  clearUploadQueue() {
    get().uploadQueue.forEach(q => releaseManagedObjectUrl(`queue:${q.tempId}`, q.previewUrl))
    set({ uploadQueue: [] })
  },

  // ── Upload draft ──────────────────────────────────────────────────────────

  uploadDraft: { ...DEFAULT_DRAFT },

  setUploadDraftRole(role)               { set(s => ({ uploadDraft: { ...s.uploadDraft, role } })) },
  setUploadDraftTitle(title)             { set(s => ({ uploadDraft: { ...s.uploadDraft, title } })) },
  setUploadDraftDescription(description) { set(s => ({ uploadDraft: { ...s.uploadDraft, description } })) },
  setUploadDraftTags(tags)               { set(s => ({ uploadDraft: { ...s.uploadDraft, tags } })) },
  setUploadDraftCollections(collectionIds) { set(s => ({ uploadDraft: { ...s.uploadDraft, collectionIds } })) },
  setUploadDraftMetadata(patch)          { set(s => ({ uploadDraft: { ...s.uploadDraft, metadata: { ...s.uploadDraft.metadata, ...patch } } })) },
  replaceUploadDraftMetadata(metadata)    { set(s => ({ uploadDraft: { ...s.uploadDraft, metadata: { ...metadata } } })) },
  setUploadDraftAudioArtist(v)     { set(s => ({ uploadDraft: { ...s.uploadDraft, audioArtist: v } })) },
  setUploadDraftAudioGenre(v)      { set(s => ({ uploadDraft: { ...s.uploadDraft, audioGenre: v } })) },
  setUploadDraftAudioBpm(v)        { set(s => ({ uploadDraft: { ...s.uploadDraft, audioBpm: v } })) },
  setUploadDraftAudioMusicalKey(v) { set(s => ({ uploadDraft: { ...s.uploadDraft, audioMusicalKey: v } })) },
  resetUploadDraft()               { set({ uploadDraft: { ...DEFAULT_DRAFT } }) },

  // ── Canonical visual upload service ──────────────────────────────────────

  async uploadCanonicalVisualFile(file, options = {}) {
    if (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)) {
      return { ok: false, error: 'The canonical visual upload path requires an image file.', phase: 'failed' }
    }
    if (uploadCancelled(options.signal)) {
      return { ok: false, error: 'Upload cancelled.', phase: 'cancelled' }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      const error = supabaseConfigured ? 'Sign in to upload media.' : 'Supabase is not configured.'
      set({ authRequired: supabaseConfigured, loadError: error })
      return { ok: false, error, phase: 'failed' }
    }

    const operationId = options.operationId ?? generateOperationId()
    let localItem: LocalItem
    try {
      localItem = await buildLocalItem(file, {
        role: options.role ?? suggestMediaRole(file),
        title: options.title,
        description: options.description,
        tags: options.tags ?? [],
        collectionIds: options.collectionIds ?? [],
        metadata: options.metadata ?? {},
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image preparation failed.'
      return { ok: false, error: message, phase: 'preparing' }
    }

    const result = await uploadToSupabase(file, localItem, userId, operationId, {
      signal: options.signal,
      onPhase: options.onPhase,
    })
    if (!result.ok) {
      releaseManagedObjectUrl(localItem.localObjectUrlKey, localItem.url)
      return result
    }

    const stableId = `db-${result.mediaItem.id}`
    const uploadedItem = reconcileCanonicalMediaItem({
      ...localItem,
      id: stableId,
      uploading: false,
      uploadError: undefined,
      derivativeWarning: result.derivativeWarning,
      uploadSourceFile: result.derivativeWarning ? file : undefined,
      uploadOperationId: operationId,
    }, result.mediaItem)
    set(state => ({
      items: [uploadedItem, ...state.items.filter(item => item.id !== stableId)],
      queryItemIds: itemMatchesLibraryQuery(uploadedItem, state.libraryQuery)
        ? [stableId, ...state.queryItemIds.filter(id => id !== stableId)]
        : state.queryItemIds.filter(id => id !== stableId),
      invalidated: true,
      loadError: result.derivativeWarning ?? null,
    }))

    if (isSvgFile(file)) {
      void (async () => {
        try {
          const { precacheUploadedSvgGlyph } = await import('../components/vyzualz/react/services/svgMediaBridge')
          await precacheUploadedSvgGlyph({ file, mediaId: stableId, title: localItem.title, name: localItem.name })
        } catch (error) {
          console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', error)
        }
      })()
    }

    return { ok: true, item: uploadedItem }
  },

  // ── Upload: queue-based (modal path) ─────────────────────────────────────

  async uploadQueuedMedia(options = {}) {
    const { uploadQueue, uploadDraft } = get()
    const total = uploadQueue.length
    const failures: UploadBatchFailure[] = []
    if (!total) return { total: 0, succeeded: 0, failures }

    const hasAudio = uploadQueue.some(item => item.isAudio)
    const hasVisual = uploadQueue.some(item => !item.isAudio)
    if (hasAudio && hasVisual) {
      const error = 'Upload audio and visual files in separate batches.'
      for (const item of uploadQueue) {
        failures.push({ tempId: item.tempId, fileName: item.file.name, error })
        options.onProgress?.({ tempId: item.tempId, fileName: item.file.name, completed: failures.length, total, status: 'error', phase: 'failed', error })
      }
      return { total, succeeded: 0, failures }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      const error = supabaseConfigured ? 'Sign in to upload media.' : 'Supabase is not configured.'
      set({ authRequired: supabaseConfigured, loadError: error })
      for (const item of uploadQueue) {
        failures.push({ tempId: item.tempId, fileName: item.file.name, error })
        options.onProgress?.({ tempId: item.tempId, fileName: item.file.name, completed: failures.length, total, status: 'error', phase: 'failed', error })
      }
      return { total, succeeded: 0, failures }
    }

    let completed = 0
    let succeeded = 0
    for (const queueItem of uploadQueue) {
      if (uploadCancelled(options.signal)) {
        const error = 'Upload cancelled. Files that were not started remain in the queue.'
        failures.push({ tempId: queueItem.tempId, fileName: queueItem.file.name, error })
        options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'error', phase: 'cancelled', error })
        continue
      }

      options.onProgress?.({
        tempId: queueItem.tempId,
        fileName: queueItem.file.name,
        completed,
        total,
        status: 'uploading',
        phase: 'preparing',
      })

      if (queueItem.isAudio) {
        const analysis = await analyzeAudioFile(queueItem.file).catch(() => null)
        const saved = await useAudioStore.getState().uploadAndSaveTrack({
          file: queueItem.file,
          title: total === 1 ? uploadDraft.title : '',
          artist: uploadDraft.audioArtist,
          genre: uploadDraft.audioGenre,
          bpmInput: uploadDraft.audioBpm,
          musicalKey: uploadDraft.audioMusicalKey,
          userId,
          analysis,
        })
        completed += 1
        if (!saved) {
          const error = useAudioStore.getState().loadError ?? 'Audio upload failed.'
          failures.push({ tempId: queueItem.tempId, fileName: queueItem.file.name, error })
          options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'error', phase: 'failed', error })
          continue
        }
        succeeded += 1
        get().removeUploadQueueItem(queueItem.tempId)
        options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'done', phase: 'complete' })
        continue
      }

      const localItem = await buildLocalItem(queueItem.file, {
        role: uploadDraft.role,
        title: total === 1 ? (uploadDraft.title || undefined) : undefined,
        description: uploadDraft.description || undefined,
        tags: uploadDraft.tags,
        collectionIds: uploadDraft.collectionIds,
        metadata: uploadDraft.metadata,
      })
      const result = await uploadToSupabase(queueItem.file, localItem, userId, queueItem.operationId, {
        signal: options.signal,
        onPhase: phase => options.onProgress?.({
          tempId: queueItem.tempId,
          fileName: queueItem.file.name,
          completed,
          total,
          status: 'uploading',
          phase,
        }),
      })
      completed += 1
      if (!result.ok) {
        releaseManagedObjectUrl(localItem.localObjectUrlKey, localItem.url)
        failures.push({ tempId: queueItem.tempId, fileName: queueItem.file.name, error: result.error })
        options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'error', phase: result.phase, error: result.error })
        continue
      }

      const stableId = `db-${result.mediaItem.id}`
      const uploadedItem = reconcileCanonicalMediaItem({
        ...localItem,
        id: stableId,
        uploading: false,
        uploadError: undefined,
        derivativeWarning: result.derivativeWarning,
        uploadSourceFile: result.derivativeWarning ? queueItem.file : undefined,
        uploadOperationId: queueItem.operationId,
      }, result.mediaItem)
      set(state => ({
        items: [uploadedItem, ...state.items.filter(item => item.id !== stableId)],
        queryItemIds: itemMatchesLibraryQuery(uploadedItem, state.libraryQuery)
          ? [stableId, ...state.queryItemIds.filter(id => id !== stableId)]
          : state.queryItemIds.filter(id => id !== stableId),
        invalidated: true,
        loadError: result.derivativeWarning ?? null,
      }))
      succeeded += 1
      get().removeUploadQueueItem(queueItem.tempId)
      options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'done', phase: 'complete' })

      if (isSvgFile(queueItem.file)) {
        void (async () => {
          try {
            const { precacheUploadedSvgGlyph } = await import('../components/vyzualz/react/services/svgMediaBridge')
            await precacheUploadedSvgGlyph({ file: queueItem.file, mediaId: stableId, title: localItem.title, name: localItem.name })
          } catch (error) {
            console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', error)
          }
        })()
      }
    }

    return { total, succeeded, failures }
  },

  // ── Upload: drag-drop path (no modal, auto-detect role) ───────────────────

  async addFiles(files) {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm)$/i.test(f.name)
    )
    if (!mediaFiles.length) return

    const prepared = await mapWithConcurrency(mediaFiles, MEDIA_BATCH_CONCURRENCY, async file => ({
      file,
      operationId: generateOperationId(),
      item: await buildLocalItem(file, { role: suggestMediaRole(file) }),
    }))
    const withUploading = prepared.map(({ item, operationId }) => ({
      ...item,
      uploading: true,
      uploadOperationId: operationId,
      uploadPhase: 'preparing' as MediaUploadPhase,
    }))
    set(state => ({ items: [...state.items, ...withUploading] }))

    const userId = await getCurrentUserId()
    if (!userId) {
      set(state => ({
        authRequired: supabaseConfigured,
        items: state.items.map(item => {
          const index = withUploading.findIndex(candidate => candidate.id === item.id)
          return index < 0 ? item : {
            ...item,
            uploading: false,
            uploadError: supabaseConfigured ? 'Sign in to upload this file' : 'Supabase is not configured',
            uploadSourceFile: prepared[index].file,
          }
        }),
      }))
      return
    }

    await mapWithConcurrency(prepared, MEDIA_BATCH_CONCURRENCY, async ({ file, operationId, item }) => {
      const previousId = item.id
      const result = await uploadToSupabase(file, item, userId, operationId, {
        onPhase: phase => set(state => ({
          items: state.items.map(candidate => candidate.id === previousId ? { ...candidate, uploadPhase: phase === 'cancelled' ? 'failed' : phase } : candidate),
        })),
      })
      if (!result.ok) {
        set(state => ({
          items: state.items.map(candidate => candidate.id === previousId ? {
            ...candidate,
            uploading: false,
            uploadError: result.error,
            uploadSourceFile: file,
            uploadPhase: result.phase === 'cancelled' ? 'failed' : result.phase,
          } : candidate),
          loadError: result.error,
        }))
        return
      }

      const stableId = `db-${result.mediaItem.id}`
      set(state => {
        const reconciled = reconcileCanonicalMediaItem({
          ...(state.items.find(candidate => candidate.id === previousId) ?? item),
          id: stableId,
          uploading: false,
          uploadError: undefined,
          derivativeWarning: result.derivativeWarning,
          uploadSourceFile: result.derivativeWarning ? file : undefined,
          uploadOperationId: operationId,
        }, result.mediaItem)
        return {
          items: state.items.map(candidate => candidate.id === previousId ? reconciled : candidate),
          queryItemIds: itemMatchesLibraryQuery(reconciled, state.libraryQuery)
            ? [stableId, ...state.queryItemIds.filter(id => id !== previousId && id !== stableId)]
            : state.queryItemIds.filter(id => id !== previousId && id !== stableId),
          invalidated: true,
          loadError: result.derivativeWarning ?? null,
        }
      })
      useVisualStore.getState().remapMediaId(previousId, stableId)

      if (isSvgFile(file)) {
        void (async () => {
          try {
            const { precacheUploadedSvgGlyph } = await import('../components/vyzualz/react/services/svgMediaBridge')
            const outcome = await precacheUploadedSvgGlyph({ file, mediaId: stableId, title: item.title, name: item.name })
            if (outcome === 'invalid') console.warn('[mediaStore] SVG pre-cache: not valid SVG:', item.name)
          } catch (error) {
            console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', error)
          }
        })()
      }
    })
  },

  async retryUpload(id) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item?.uploadSourceFile || !item.uploadOperationId) {
      set({ loadError: 'The original file or stable upload session is no longer available. Choose the file again to retry.' })
      return false
    }
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: supabaseConfigured, loadError: supabaseConfigured ? 'Sign in to retry this upload.' : 'Supabase is not configured.' })
      return false
    }

    set(state => ({
      items: state.items.map(candidate => candidate.id === id ? {
        ...candidate,
        uploading: true,
        uploadError: undefined,
        derivativeWarning: undefined,
        uploadPhase: 'preparing',
      } : candidate),
    }))
    const result = await uploadToSupabase(item.uploadSourceFile, item as LocalItem, userId, item.uploadOperationId, {
      onPhase: phase => set(state => ({
        items: state.items.map(candidate => candidate.id === id ? { ...candidate, uploadPhase: phase === 'cancelled' ? 'failed' : phase } : candidate),
      })),
    })
    if (!result.ok) {
      set(state => ({
        items: state.items.map(candidate => candidate.id === id ? { ...candidate, uploading: false, uploadError: result.error } : candidate),
        loadError: result.error,
      }))
      return false
    }

    const stableId = `db-${result.mediaItem.id}`
    set(state => {
      const reconciled = reconcileCanonicalMediaItem({
        ...(state.items.find(candidate => candidate.id === id) ?? item),
        id: stableId,
        uploading: false,
        uploadError: undefined,
        derivativeWarning: result.derivativeWarning,
        uploadSourceFile: result.derivativeWarning ? item.uploadSourceFile : undefined,
      }, result.mediaItem)
      return {
        items: state.items.map(candidate => candidate.id === id ? reconciled : candidate),
        queryItemIds: itemMatchesLibraryQuery(reconciled, state.libraryQuery)
          ? [stableId, ...state.queryItemIds.filter(candidateId => candidateId !== id && candidateId !== stableId)]
          : state.queryItemIds.filter(candidateId => candidateId !== id && candidateId !== stableId),
        invalidated: true,
        loadError: result.derivativeWarning ?? null,
      }
    })
    if (id !== stableId) useVisualStore.getState().remapMediaId(id, stableId)
    return true
  },

  // ── Canonical paged library ───────────────────────────────────────────────

  setLibraryQuery(query) {
    const normalized = normalizeLibraryQuery(query)
    const key = mediaLibraryQueryKey(normalized)
    const previous = get()
    if (key === previous.libraryQueryKey) return
    libraryRequestGeneration += 1
    nextPagePromise = null
    refreshPromise = null
    mediaSigningCoordinator.abandonScope(previous.libraryQueryKey)
    set({
      libraryQuery: normalized,
      libraryQueryKey: key,
      queryItemIds: [],
      cursor: null,
      hasMore: true,
      queryError: null,
      loadError: null,
      invalidated: true,
      loading: false,
      nextPageLoading: false,
      refreshing: false,
    })
  },

  async ensureLibraryLoaded(query, force = false) {
    const requestedQuery = normalizeLibraryQuery(query ?? get().libraryQuery)
    if (query) get().setLibraryQuery(requestedQuery)

    // A fresh page may be reused across compatible surfaces, but never across
    // accounts. Verify the cheap auth identity before accepting cached private
    // rows or signed URLs.
    if (supabaseConfigured) {
      const userId = await getCurrentUserId()
      const accountId = get().accountId
      if (!userId) {
        if (accountId) get().clear()
        set({ authRequired: true })
        return
      }
      if (accountId && accountId !== userId) {
        get().clear()
        get().setLibraryQuery(requestedQuery)
      }
    }

    const state = get()
    const stale = state.lastSuccessfulLoad == null || Date.now() - state.lastSuccessfulLoad >= MEDIA_LIBRARY_STALE_AFTER_MS
    if (!force && !state.invalidated && !stale && state.queryItemIds.length > 0) return
    await get().refreshLibrary()
  },

  async loadFromSupabase() {
    await get().ensureLibraryLoaded(undefined, false)
  },

  async refreshLibrary() {
    const requestedQuery = { ...get().libraryQuery }
    const requestedQueryKey = get().libraryQueryKey
    if (refreshPromise?.queryKey === requestedQueryKey) return refreshPromise.promise

    const promise = (async () => {
        if (!supabaseConfigured) {
          set({ loadError: 'Storage not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.', queryError: 'Storage not configured.' })
          return
        }
        const userId = await getCurrentUserId()
        if (!userId) { set({ authRequired: true }); return }
        if (get().libraryQueryKey !== requestedQueryKey) return

        const before = get()
        if (before.accountId && before.accountId !== userId) {
          get().clear()
          get().setLibraryQuery(requestedQuery)
        }
        if (get().libraryQueryKey !== requestedQueryKey) return
        const query = requestedQuery
        const queryKey = requestedQueryKey
        const requestGeneration = ++libraryRequestGeneration
        const initial = get().queryItemIds.length === 0
        mediaSigningCoordinator.activateScope(queryKey, userId)
        set({
          accountId: userId,
          loading: initial,
          refreshing: !initial,
          queryError: null,
          loadError: null,
          authRequired: false,
        })

        try {
          const [pageResult, collectionsResult, cleanupResult] = await Promise.all([
            listMediaItemsPage(query, null, MEDIA_LIBRARY_PAGE_SIZE),
            listMediaCollections(userId),
            listPendingMediaCleanup(),
          ])
          if (requestGeneration !== libraryRequestGeneration || get().libraryQueryKey !== queryKey || get().accountId !== userId) return
          if (!pageResult.ok) {
            const message = interpretError(pageResult.message)
            set({ queryError: message, loadError: message })
            return
          }

          const deletionStates = Object.fromEntries(
            cleanupResult.rows.map(cleanupJobToDeletionState)
              .filter((state): state is MediaDeletionState => state !== null)
              .map(state => [state.itemId, state]),
          )
          const deletedIds = new Set(Object.keys(deletionStates))
          const pageItems = pageResult.page.items.filter(item => !deletedIds.has(`db-${item.id}`))
          const pageIds = pageItems.map(item => `db-${item.id}`)
          const collections: MediaCollection[] = collectionsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description ?? undefined,
          }))
          const cleanupMessage = cleanupResult.error
            ? `Pending cleanup could not be loaded: ${interpretError(cleanupResult.error)}`
            : collectionsResult.error ? `Collections could not be refreshed: ${interpretError(collectionsResult.error)}` : null

          set(state => ({
            items: reconcileLibraryItems(state.items, pageItems, state.mutationStates),
            queryItemIds: Array.from(new Set(pageIds)),
            cursor: pageResult.page.nextCursor,
            hasMore: pageResult.page.hasMore,
            collections,
            deletionStates,
            uploadCleanupStates: uploadCleanupStatesFromRows(cleanupResult.rows),
            lastRestored: pageItems.length,
            lastSuccessfulLoad: Date.now(),
            invalidated: false,
            queryError: null,
            loadError: cleanupMessage,
          }))
        } catch (error) {
          if (requestGeneration !== libraryRequestGeneration) return
          const message = error instanceof Error ? interpretError(error.message) : 'Unexpected error loading media'
          set({ queryError: message, loadError: message })
        } finally {
          if (requestGeneration === libraryRequestGeneration) set({ loading: false, refreshing: false })
        }

    })()
    refreshPromise = { queryKey: requestedQueryKey, promise }
    try {
      await promise
    } finally {
      if (refreshPromise?.promise === promise) refreshPromise = null
    }
  },

  async loadNextPage() {
    if (nextPagePromise) return nextPagePromise
    const state = get()
    if (!state.hasMore || !state.cursor || state.loading || state.refreshing || state.nextPageLoading) return
    const query = state.libraryQuery
    const queryKey = state.libraryQueryKey
    const cursor = state.cursor
    const requestGeneration = libraryRequestGeneration
    const userId = state.accountId
    set({ nextPageLoading: true, queryError: null })

    nextPagePromise = (async () => {
      try {
        const result = await listMediaItemsPage(query, cursor, MEDIA_LIBRARY_PAGE_SIZE)
        if (requestGeneration !== libraryRequestGeneration || get().libraryQueryKey !== queryKey || get().accountId !== userId) return
        if (!result.ok) {
          const message = interpretError(result.message)
          set({ queryError: message, loadError: message })
          return
        }
        const deletedIds = new Set(Object.keys(get().deletionStates))
        const pageItems = result.page.items.filter(item => !deletedIds.has(`db-${item.id}`))
        const pageIds = pageItems.map(item => `db-${item.id}`)
        set(current => ({
          items: reconcileLibraryItems(current.items, pageItems, current.mutationStates),
          queryItemIds: Array.from(new Set([...current.queryItemIds, ...pageIds])),
          cursor: result.page.nextCursor,
          hasMore: result.page.hasMore,
          lastSuccessfulLoad: Date.now(),
          invalidated: false,
          queryError: null,
        }))
      } catch (error) {
        if (requestGeneration !== libraryRequestGeneration) return
        const message = error instanceof Error ? interpretError(error.message) : 'Unexpected error loading more media'
        set({ queryError: message, loadError: message })
      } finally {
        if (requestGeneration === libraryRequestGeneration) {
          set({ nextPageLoading: false })
          nextPagePromise = null
        }
      }
    })()
    return nextPagePromise
  },

  invalidateLibrary() { set({ invalidated: true }) },

  async ensureMediaSigned(itemIds, priority) {
    const state = get()
    const userId = state.accountId ?? await getCurrentUserId()
    if (!userId) return
    const scopeId = state.libraryQueryKey
    mediaSigningCoordinator.activateScope(scopeId, userId)
    const now = Date.now()
    const jobs: Promise<void>[] = []

    const requestAsset = (item: UploadedMedia, variant: 'original' | 'thumbnail', path: string) => {
      const expiresAt = variant === 'original' ? item.urlExpiresAt : item.thumbnailExpiresAt
      const currentUrl = variant === 'original' ? item.url : item.thumbnailUrl
      if (currentUrl && expiresAt && expiresAt - now > 60_000) return
      set(current => ({
        items: current.items.map(candidate => candidate.id === item.id ? {
          ...candidate,
          ...(variant === 'original' ? { originalSigning: true, originalSigningError: undefined } : { thumbnailSigning: true, thumbnailSigningError: undefined }),
        } : candidate),
      }))
      jobs.push(mediaSigningCoordinator.request({ userId, bucket: MEDIA_STORAGE_BUCKET, path, priority, scopeId }).then(asset => {
        if (variant === 'original') releaseManagedObjectUrl(item.localObjectUrlKey, item.url)
        set(current => ({
          items: current.items.map(candidate => {
            if (candidate.id !== item.id) return candidate
            const currentPath = variant === 'original'
              ? candidate.storagePath
              : (candidate.thumbnailStoragePath ?? (candidate.type === 'image' ? candidate.storagePath : null))
            if (currentPath !== path) return candidate
            if (variant === 'original') {
              return {
                ...candidate,
                url: asset.url,
                urlExpiresAt: asset.expiresAt,
                originalSigning: false,
                originalSigningError: undefined,
                localObjectUrlKey: undefined,
                ...(candidate.type === 'image' && path === (candidate.thumbnailStoragePath ?? candidate.storagePath)
                  ? { thumbnailUrl: asset.url, thumbnailExpiresAt: asset.expiresAt, thumbnailSigning: false, thumbnailSigningError: undefined }
                  : {}),
              }
            }
            return { ...candidate, thumbnailUrl: asset.url, thumbnailExpiresAt: asset.expiresAt, thumbnailSigning: false, thumbnailSigningError: undefined }
          }),
        }))
      }).catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        const message = error instanceof Error ? interpretError(error.message) : 'Media signing failed.'
        set(current => ({
          items: current.items.map(candidate => candidate.id === item.id ? {
            ...candidate,
            ...(variant === 'original' ? { originalSigning: false, originalSigningError: message } : { thumbnailSigning: false, thumbnailSigningError: message }),
          } : candidate),
        }))
      }))
    }

    for (const itemId of Array.from(new Set(itemIds))) {
      const item = get().items.find(candidate => candidate.id === itemId)
      if (!item || item.uploading || !item.storagePath || item.storagePath.startsWith('blob:')) continue
      const thumbnailPath = item.thumbnailStoragePath ?? (item.type === 'image' ? item.storagePath : null)
      if (priority === 'visible') requestAsset(item, 'original', item.storagePath)
      if (thumbnailPath && (thumbnailPath !== item.storagePath || priority !== 'visible')) requestAsset(item, 'thumbnail', thumbnailPath)
      if (priority === 'visible' && item.type === 'image' && thumbnailPath === item.storagePath && !item.url) {
        // The original request above hydrates both image fields.
      }
    }
    await Promise.allSettled(jobs)
  },

  async retryMediaAsset(itemId, variant) {
    const item = get().items.find(candidate => candidate.id === itemId)
    if (!item) return false
    const retryField = variant === 'original' ? 'originalLoadRetries' : 'thumbnailLoadRetries'
    const retries = item[retryField] ?? 0
    if (retries >= 1) {
      const message = 'The signed media URL was refreshed once and still could not be loaded.'
      set(state => ({
        items: state.items.map(candidate => candidate.id === itemId ? {
          ...candidate,
          ...(variant === 'original' ? { originalSigningError: message } : { thumbnailSigningError: message }),
        } : candidate),
      }))
      return false
    }
    const userId = get().accountId ?? await getCurrentUserId()
    if (!userId) return false
    const path = variant === 'original'
      ? item.storagePath
      : (item.thumbnailStoragePath ?? (item.type === 'image' ? item.storagePath : null))
    if (!path) return false
    set(state => ({
      items: state.items.map(candidate => candidate.id === itemId ? { ...candidate, [retryField]: retries + 1 } : candidate),
    }))
    try {
      const asset = await mediaSigningCoordinator.request({
        userId,
        bucket: MEDIA_STORAGE_BUCKET,
        path,
        priority: 'visible',
        scopeId: get().libraryQueryKey,
        force: true,
      })
      if (variant === 'original') releaseManagedObjectUrl(item.localObjectUrlKey, item.url)
      set(state => ({
        items: state.items.map(candidate => candidate.id === itemId ? variant === 'original'
          ? {
              ...candidate,
              url: asset.url,
              urlExpiresAt: asset.expiresAt,
              originalSigningError: undefined,
              localObjectUrlKey: undefined,
              ...(candidate.type === 'image' ? { thumbnailUrl: asset.url, thumbnailExpiresAt: asset.expiresAt } : {}),
            }
          : { ...candidate, thumbnailUrl: asset.url, thumbnailExpiresAt: asset.expiresAt, thumbnailSigningError: undefined }
          : candidate),
      }))
      return true
    } catch (error) {
      const message = error instanceof Error ? interpretError(error.message) : 'Media URL refresh failed.'
      set(state => ({
        items: state.items.map(candidate => candidate.id === itemId ? {
          ...candidate,
          ...(variant === 'original' ? { originalSigningError: message } : { thumbnailSigningError: message }),
        } : candidate),
      }))
      return false
    }
  },


  markMediaAssetLoaded(itemId, variant) {
    const item = get().items.find(candidate => candidate.id === itemId)
    if (!item) return
    const retries = variant === 'original' ? item.originalLoadRetries : item.thumbnailLoadRetries
    const error = variant === 'original' ? item.originalSigningError : item.thumbnailSigningError
    if (!retries && !error) return
    set(state => ({
      items: state.items.map(candidate => candidate.id === itemId ? {
        ...candidate,
        ...(variant === 'original'
          ? { originalLoadRetries: 0, originalSigningError: undefined }
          : { thumbnailLoadRetries: 0, thumbnailSigningError: undefined }),
      } : candidate),
    }))
  },

  // ── Item mutations ────────────────────────────────────────────────────────

  async removeItem(id, options = {}) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) {
      set({ deleteError: 'That media item is no longer available.', pendingDeletionWarning: null })
      return false
    }

    const guardResult = mediaDeletionGuard?.(item, options.confirmation) ?? { allowed: true as const }
    if (!guardResult.allowed) {
      set({ deleteError: guardResult.warning.message, pendingDeletionWarning: guardResult.warning })
      return false
    }
    const applyGuard = (): boolean => guardResult.apply ? guardResult.apply() : true
    const rollbackGuard = (): void => guardResult.rollback?.()

    if (!item.dbId) {
      if (!applyGuard()) {
        set({ deleteError: 'Deck references could not be updated, so the media item was not deleted.' })
        return false
      }
      const remaining = get().items.filter(candidate => candidate.id !== id)
      set(state => ({
        items: remaining,
        queryItemIds: state.queryItemIds.filter(itemId => itemId !== id),
        invalidated: true,
        deleteError: null,
        pendingDeletionWarning: null,
        mutationStates: Object.fromEntries(Object.entries(state.mutationStates).filter(([, mutation]) => mutation.itemId !== id)),
      }))
      purgeRuntimeMedia(item, remaining)
      return true
    }

    if (!supabaseConfigured) {
      set({ deleteError: 'Supabase is not configured. Synced media cannot be deleted.' })
      return false
    }
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true, deleteError: 'Sign in to delete synced media.' })
      return false
    }

    if (!applyGuard()) {
      set({ deleteError: 'Deck references could not be updated, so the media item was not deleted.' })
      return false
    }

    const requested = await requestMediaDeletion(item.dbId)
    if (!requested.ok) {
      rollbackGuard()
      set({ deleteError: interpretError(requested.message) })
      return false
    }
    const deletion = cleanupJobToDeletionState(requested.cleanupJob)
    if (!deletion) {
      // The canonical delete request has already committed at this point. Restoring
      // Deck references here would create dangling references to media scheduled for
      // deletion, so keep the coherent cross-store mutation and surface recovery.
      set({ deleteError: 'The deletion request returned incomplete cleanup state.' })
      return false
    }

    const remaining = get().items.filter(candidate => candidate.id !== id)
    set(state => ({
      items: remaining,
      queryItemIds: state.queryItemIds.filter(itemId => itemId !== id),
      invalidated: true,
      deleteError: null,
      pendingDeletionWarning: null,
      deletionStates: { ...state.deletionStates, [id]: deletion },
      mutationStates: Object.fromEntries(Object.entries(state.mutationStates).filter(([, mutation]) => mutation.itemId !== id)),
    }))
    purgeRuntimeMedia(item, remaining)

    const cleaned = await runDeletionCleanup(deletion, userId)
    if (!cleaned.ok) {
      set(state => ({
        deletionStates: { ...state.deletionStates, [id]: cleaned.state },
        deleteError: cleaned.state.message,
      }))
      return false
    }
    set(state => ({
      deletionStates: Object.fromEntries(Object.entries(state.deletionStates).filter(([itemId]) => itemId !== id)),
      deleteError: null,
    }))
    return true
  },

  async retryDeletion(itemId) {
    const deletion = get().deletionStates[itemId]
    if (!deletion) return false
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true, deleteError: 'Sign in to retry media cleanup.' })
      return false
    }
    const pending: MediaDeletionState = { ...deletion, status: 'pending', message: null, updatedAt: Date.now() }
    set(state => ({ deletionStates: { ...state.deletionStates, [itemId]: pending }, deleteError: null }))
    const cleaned = await runDeletionCleanup(pending, userId)
    if (!cleaned.ok) {
      set(state => ({ deletionStates: { ...state.deletionStates, [itemId]: cleaned.state }, deleteError: cleaned.state.message }))
      return false
    }
    set(state => ({
      deletionStates: Object.fromEntries(Object.entries(state.deletionStates).filter(([id]) => id !== itemId)),
      deleteError: null,
    }))
    return true
  },

  async retryUploadCleanup(jobId) {
    const cleanup = get().uploadCleanupStates[jobId]
    if (!cleanup) return false
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true, loadError: 'Sign in to retry failed upload cleanup.' })
      return false
    }
    const pending = { ...cleanup, status: 'pending' as const, message: null, updatedAt: Date.now() }
    set(state => ({ uploadCleanupStates: { ...state.uploadCleanupStates, [jobId]: pending }, loadError: null }))
    const result = await runUploadRollbackCleanup(pending, userId)
    if (!result.ok) {
      set(state => ({ uploadCleanupStates: { ...state.uploadCleanupStates, [jobId]: result.state }, loadError: result.state.message }))
      return false
    }
    set(state => ({
      uploadCleanupStates: Object.fromEntries(Object.entries(state.uploadCleanupStates).filter(([id]) => id !== jobId)),
      loadError: null,
    }))
    return true
  },

  async persistMediaMutation(id, operation, attempt) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) return false

    const key = mediaMutationKey(id, operation)
    const baseline = mediaAttemptFromItem(item)
    if (get().mutationStates[key]?.status === 'pending') return false

    if (!item.dbId) {
      set(state => ({
        items: state.items.map(candidate => candidate.id === id ? applyLocalAttempt(candidate, attempt) : candidate),
        mutationStates: Object.fromEntries(Object.entries(state.mutationStates).filter(([entryKey]) => entryKey !== key)),
      }))
      return true
    }

    const failBeforeRequest = (message: string) => {
      set(state => ({
        mutationStates: {
          ...state.mutationStates,
          [key]: { itemId: id, operation, status: 'failed', message, attempted: attempt, baseline, updatedAt: Date.now() },
        },
      }))
      return false
    }

    // Claim the mutation slot synchronously, before any `await`. getCurrentUserId()
    // below yields to the event loop; without claiming the slot first, a second
    // call for the same (id, operation) racing in during that gap would also pass
    // the pending-guard above and fire a duplicate concurrent RPC.
    set(state => ({
      mutationStates: {
        ...state.mutationStates,
        [key]: { itemId: id, operation, status: 'pending', message: null, attempted: attempt, baseline, updatedAt: Date.now() },
      },
    }))

    if (!supabaseConfigured) return failBeforeRequest('Supabase is not configured. This media change was not saved.')
    if (item.revision == null) return failBeforeRequest('This media item has no server revision. Reload the library after applying the latest database migration.')
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true })
      return failBeforeRequest('Sign in to save this media change.')
    }

    const result = await saveMediaItemAtomic({
      mediaItemId: item.dbId,
      expectedRevision: item.revision,
      patch: {
        media_role: attempt.role,
        title: attempt.title.trim() || null,
        description: attempt.description.trim() || null,
        favorite: attempt.favorite,
        metadata: attempt.metadata,
      },
      tagNames: attempt.tags,
      collectionIds: attempt.collectionIds,
    })

    if (result.ok) {
      set(state => ({
        items: state.items.map(candidate => candidate.id === id ? reconcileCanonicalMediaItem(candidate, result.mediaItem) : candidate),
        invalidated: true,
        mutationStates: Object.fromEntries(Object.entries(state.mutationStates).filter(([entryKey]) => entryKey !== key)),
      }))
      return true
    }

    set(state => ({
      items: result.mediaItem
        ? state.items.map(candidate => candidate.id === id ? reconcileCanonicalMediaItem(candidate, result.mediaItem!) : candidate)
        : state.items,
      mutationStates: {
        ...state.mutationStates,
        [key]: {
          itemId: id,
          operation,
          status: result.kind === 'conflict' ? 'conflict' : 'failed',
          message: result.message,
          attempted: attempt,
          baseline,
          updatedAt: Date.now(),
        },
      },
    }))
    return false
  },

  async retryMediaMutation(id, operation) {
    const state = get().mutationStates[mediaMutationKey(id, operation)]
    if (!state || state.status === 'pending') return false
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) return false
    return get().persistMediaMutation(
      id,
      operation,
      rebaseAttemptForOperation(item, operation, state.attempted, state.baseline),
    )
  },

  async reapplyMediaMutation(id, operation) {
    return get().retryMediaMutation(id, operation)
  },

  clearMediaMutation(id, operation) {
    const key = mediaMutationKey(id, operation)
    set(state => ({
      mutationStates: Object.fromEntries(Object.entries(state.mutationStates).filter(([entryKey]) => entryKey !== key)),
    }))
  },

  async toggleFavorite(id) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) return false
    return get().persistMediaMutation(id, 'favorite', mediaAttemptFromItem(item, { favorite: !item.favorite }))
  },

  async toggleFavoriteMedia(id) { return get().toggleFavorite(id) },

  reorderItems(order) {
    set(state => {
      const ordered = order.map(id => state.items.find(item => item.id === id)).filter(Boolean) as UploadedMedia[]
      const remaining = state.items.filter(item => !order.includes(item.id))
      return { items: [...ordered, ...remaining] }
    })
  },

  async setMediaRole(mediaId, role) {
    const item = get().items.find(candidate => candidate.id === mediaId)
    if (!item) return false
    return get().persistMediaMutation(mediaId, 'role', mediaAttemptFromItem(item, { role }))
  },

  async setMediaTags(mediaId, tags) {
    const item = get().items.find(candidate => candidate.id === mediaId)
    if (!item) return false
    const normalized = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)))
    return get().persistMediaMutation(mediaId, 'tags', mediaAttemptFromItem(item, { tags: normalized }))
  },

  async addMediaTag(mediaId, tag) {
    const item = get().items.find(candidate => candidate.id === mediaId)
    const cleanTag = tag.trim()
    if (!item || !cleanTag || item.tags.includes(cleanTag)) return false
    return get().setMediaTags(mediaId, [...item.tags, cleanTag])
  },

  async removeMediaTag(mediaId, tag) {
    const item = get().items.find(candidate => candidate.id === mediaId)
    if (!item) return false
    return get().setMediaTags(mediaId, item.tags.filter(existing => existing !== tag))
  },

  async bulkTagMedia(mediaIds, tags) {
    await mapWithConcurrency(mediaIds, MEDIA_BATCH_CONCURRENCY, async id => {
      const item = get().items.find(candidate => candidate.id === id)
      if (!item) return
      const merged = Array.from(new Set([...item.tags, ...tags.map(tag => tag.trim()).filter(Boolean)]))
      await get().setMediaTags(id, merged)
    })
  },

  async saveMediaEdits(id, patch) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) return false
    return get().persistMediaMutation(id, 'edit', mediaAttemptFromItem(item, {
      role: patch.role,
      title: patch.title,
      description: patch.description,
      tags: [...patch.tags],
      collectionIds: [...patch.collectionIds],
      metadata: mergeMediaMetadata(item.metadata, patch.metadata),
    }))
  },

  async updateMediaMetadata(mediaId, patch) {
    const item = get().items.find(candidate => candidate.id === mediaId || candidate.dbId === mediaId)
    if (!item) return false
    return get().persistMediaMutation(item.id, 'metadata', mediaAttemptFromItem(item, {
      metadata: mergeMediaMetadata(item.metadata, patch),
    }))
  },

  // ── Collections ───────────────────────────────────────────────────────────

  async loadCollections() {
    if (!supabaseConfigured) return
    const userId = await getCurrentUserId()
    if (!userId) return
    set({ collectionsLoading: true })
    try {
      const { rows, error } = await listMediaCollections(userId)
      if (error) {
        console.error('[mediaStore] loadCollections:', error)
        set({ loadError: `Collections could not be loaded: ${interpretError(error)}` })
        return
      }
      set({ collections: rows.map(r => ({ id: r.id, name: r.name, description: r.description ?? undefined })) })
    } finally {
      set({ collectionsLoading: false })
    }
  },

  async createCollection(name, description) {
    const cleanName = name.trim()
    if (!cleanName) {
      set({ loadError: 'Collection name is required.' })
      return null
    }
    if (!supabaseConfigured) {
      set({ loadError: 'Supabase is not configured. Collections cannot be synced.' })
      return null
    }
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true, loadError: 'Sign in to create a collection.' })
      return null
    }
    const { id, error } = await createMediaCollection({ user_id: userId, name: cleanName, description: description?.trim() || undefined })
    if (error || !id) {
      set({ loadError: `Collection creation failed: ${interpretError(error || 'Unknown error')}` })
      return null
    }
    const collection = { id, name: cleanName, description: description?.trim() || undefined }
    set(state => ({
      collections: [...state.collections.filter(item => item.id !== id), collection].sort((a, b) => a.name.localeCompare(b.name)),
      invalidated: true,
      loadError: null,
    }))
    return id
  },

  async updateCollection(id, name, description) {
    const cleanName = name.trim()
    if (!cleanName) {
      set({ loadError: 'Collection name is required.' })
      return false
    }
    if (!supabaseConfigured) {
      set({ loadError: 'Supabase is not configured. Collection changes were not saved.' })
      return false
    }
    const { error } = await updateMediaCollection(id, {
      name: cleanName,
      description: description?.trim() || null,
    })
    if (error) {
      set({ loadError: `Collection update failed: ${interpretError(error)}` })
      return false
    }
    set(state => ({
      collections: state.collections.map(item => item.id === id ? {
        ...item,
        name: cleanName,
        description: description?.trim() || undefined,
      } : item).sort((a, b) => a.name.localeCompare(b.name)),
      invalidated: true,
      loadError: null,
    }))
    return true
  },

  async removeCollection(id) {
    const collection = get().collections.find(item => item.id === id)
    if (!collection) {
      set({ loadError: 'That collection is no longer available.' })
      return false
    }
    if (!supabaseConfigured) {
      set({ loadError: 'Supabase is not configured. The collection was not deleted.' })
      return false
    }
    const { error } = await deleteMediaCollection(id)
    if (error) {
      set({ loadError: `Collection deletion failed: ${interpretError(error)}` })
      return false
    }
    set(state => ({
      collections: state.collections.filter(item => item.id !== id),
      items: state.items.map(item => ({
        ...item,
        collectionIds: item.collectionIds.filter(collectionId => collectionId !== id),
      })),
      loadError: null,
      invalidated: true,
      collectionOrderMutations: Object.fromEntries(
        Object.entries(state.collectionOrderMutations).filter(([collectionId]) => collectionId !== id),
      ),
    }))
    return true
  },

  async addMediaToCollection(collectionId, mediaIds) {
    await mapWithConcurrency(mediaIds, MEDIA_BATCH_CONCURRENCY, async mediaId => {
      const item = get().items.find(candidate => candidate.id === mediaId)
      if (!item || item.collectionIds.includes(collectionId)) return
      await get().persistMediaMutation(mediaId, 'add-to-collection', mediaAttemptFromItem(item, {
        collectionIds: [...item.collectionIds, collectionId],
      }))
    })
  },

  async removeMediaFromCollection(collectionId, mediaIds) {
    await mapWithConcurrency(mediaIds, MEDIA_BATCH_CONCURRENCY, async mediaId => {
      const item = get().items.find(candidate => candidate.id === mediaId)
      if (!item || !item.collectionIds.includes(collectionId)) return
      await get().persistMediaMutation(mediaId, 'remove-from-collection', mediaAttemptFromItem(item, {
        collectionIds: item.collectionIds.filter(id => id !== collectionId),
      }))
    })
  },

  async reorderCollectionItems(collectionId, orderedMediaIds) {
    const currentItems = get().items
    const previousOrder = currentItems.filter(item => item.collectionIds.includes(collectionId)).map(item => item.id)
    const stateKey = collectionId
    if (get().collectionOrderMutations[stateKey]?.status === 'pending') return false

    const failBeforeRequest = (message: string) => {
      set(state => ({
        collectionOrderMutations: {
          ...state.collectionOrderMutations,
          [stateKey]: {
            collectionId,
            status: 'failed',
            message,
            attemptedOrder: [...orderedMediaIds],
            previousOrder,
            updatedAt: Date.now(),
          },
        },
      }))
      return false
    }

    if (new Set(orderedMediaIds).size !== orderedMediaIds.length) {
      return failBeforeRequest('Collection order cannot contain duplicate media items.')
    }
    if (orderedMediaIds.length !== previousOrder.length || orderedMediaIds.some(id => !previousOrder.includes(id))) {
      return failBeforeRequest('Collection order must include every current item exactly once.')
    }
    if (!supabaseConfigured) return failBeforeRequest('Supabase is not configured. Collection order was not saved.')
    const dbIds = orderedMediaIds.map(id => currentItems.find(item => item.id === id)?.dbId)
    if (dbIds.some(id => !id)) return failBeforeRequest('Every reordered media item must be synced before collection order can be saved.')

    set(state => ({
      items: applyCollectionOrder(state.items, collectionId, orderedMediaIds),
      collectionOrderMutations: {
        ...state.collectionOrderMutations,
        [stateKey]: {
          collectionId,
          status: 'pending',
          message: null,
          attemptedOrder: [...orderedMediaIds],
          previousOrder,
          updatedAt: Date.now(),
        },
      },
    }))

    const result = await reorderMediaCollectionAtomic(collectionId, dbIds as string[])
    if (result.ok) {
      const canonicalLocalIds = result.orderedMediaIds.map(dbId => get().items.find(item => item.dbId === dbId)?.id)
      if (canonicalLocalIds.some(id => !id)) {
        set(state => ({
          items: applyCollectionOrder(state.items, collectionId, previousOrder),
          collectionOrderMutations: {
            ...state.collectionOrderMutations,
            [stateKey]: {
              collectionId,
              status: 'failed',
              message: 'The server returned a collection item that is not present in the local library. Reload and retry.',
              attemptedOrder: [...orderedMediaIds],
              previousOrder,
              updatedAt: Date.now(),
            },
          },
        }))
        return false
      }
      set(state => ({
        items: applyCollectionOrder(state.items, collectionId, canonicalLocalIds as string[]),
        invalidated: true,
        collectionOrderMutations: Object.fromEntries(Object.entries(state.collectionOrderMutations).filter(([key]) => key !== stateKey)),
      }))
      return true
    }

    set(state => ({
      items: applyCollectionOrder(state.items, collectionId, previousOrder),
      collectionOrderMutations: {
        ...state.collectionOrderMutations,
        [stateKey]: {
          collectionId,
          status: result.kind === 'conflict' ? 'conflict' : 'failed',
          message: result.message,
          attemptedOrder: [...orderedMediaIds],
          previousOrder,
          updatedAt: Date.now(),
        },
      },
    }))
    return false
  },

  async retryCollectionReorder(collectionId) {
    const mutation = get().collectionOrderMutations[collectionId]
    if (!mutation || mutation.status === 'pending') return false
    return get().reorderCollectionItems(collectionId, mutation.attemptedOrder)
  },

  clearCollectionReorderError(collectionId) {
    set(state => ({
      collectionOrderMutations: Object.fromEntries(Object.entries(state.collectionOrderMutations).filter(([key]) => key !== collectionId)),
    }))
  },

  // ── Thumbnail generation ──────────────────────────────────────────────────

  generateMissingThumbnails() {
    const needsThumb = get().items.filter(i =>
      !i.uploading && !i.thumbnailUrl && !i.localThumbnailObjectUrl && i.url
    )
    for (const item of needsThumb) {
      generateThumbnail(item.url, item.type, stableMediaCachePrefix(item)).then(result => {
        if (!result.thumbnailObjectUrl) return
        set(s => ({
          items: s.items.map(i =>
            i.id === item.id
              ? {
                  ...i,
                  localThumbnailObjectUrl: result.thumbnailObjectUrl!,
                  metadata: { ...i.metadata, analyzedAt: result.analyzedAt },
                }
              : i
          ),
        }))
      }).catch(() => { /* non-fatal: leave item with no thumbnail */ })
    }
  },

  // ── Filter ────────────────────────────────────────────────────────────────

  filterMedia(filter) { set({ activeFilter: filter }) },

  // ── Error / status ────────────────────────────────────────────────────────

  clearLoadError()   { set({ loadError: null }) },
  clearDeleteError() { set({ deleteError: null, pendingDeletionWarning: null }) },
  clearRestored()    { set({ lastRestored: null }) },

  clear() {
    const current = get()
    current.items.forEach(item => {
      releaseManagedObjectUrl(item.localObjectUrlKey, item.url)
      if (item.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(item.thumbnailUrl)
      if (item.localThumbnailObjectUrl?.startsWith('blob:')) URL.revokeObjectURL(item.localThumbnailObjectUrl)
    })
    current.uploadQueue.forEach(item => URL.revokeObjectURL(item.previewUrl))
    if (current.accountId) mediaSigningCoordinator.clearUser(current.accountId)
    mediaSigningCoordinator.abandonScope(current.libraryQueryKey)
    clearMediaGenerationCaches()
    libraryRequestGeneration += 1
    nextPagePromise = null
    refreshPromise = null
    set({
      items: [],
      queryItemIds: [],
      collections: [],
      uploadQueue: [],
      mutationStates: {},
      collectionOrderMutations: {},
      deletionStates: {},
      uploadCleanupStates: {},
      loadError: null,
      queryError: null,
      deleteError: null,
      pendingDeletionWarning: null,
      authRequired: false,
      lastRestored: null,
      lastSuccessfulLoad: null,
      invalidated: true,
      accountId: null,
      cursor: null,
      hasMore: true,
      loading: false,
      nextPageLoading: false,
      refreshing: false,
      libraryQuery: { ...DEFAULT_LIBRARY_QUERY },
      libraryQueryKey: mediaLibraryQueryKey(DEFAULT_LIBRARY_QUERY),
    })
  },
}))

import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  listMediaItems,
  createMediaItem,
  updateMediaItem,
  updateMediaItemRole,
  updateMediaItemFavorite,
  deleteMediaItem,
  createSignedMediaUrl,
  uploadMediaFile,
  deleteMediaFiles,
  setMediaItemTags,
  listMediaItemTagNames,
  listMediaCollections,
  createMediaCollection,
  updateMediaCollection,
  deleteMediaCollection,
  listMediaItemCollectionIds,
  setMediaItemCollections,
  reorderCollectionItems as dbReorderCollectionItems,
} from '../lib/mediaDb'
import type { MediaItemRow, MediaMetadata } from '../types/database'
import { suggestMediaRole, isAudioFile, isSvgFile } from '../lib/mediaRoles'
import type { MediaRole, MediaEnergy } from '../lib/mediaRoles'
import { useAudioStore } from './audioStore'
import { analyzeAudioFile } from '../utils/analyzeAudioFile'
import { useVisualStore } from './visualStore'
import { generateThumbnail, clearFilmstripCache } from '../components/vyzualz/media/generateThumbnail'
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
  /** Retained only for a failed local upload so the user can retry without reselecting the file. */
  uploadSourceFile?: File
  storagePath?: string
  dbId?: string
  /** Stored upload MIME type. Used with mediaRole/content inspection for SVG filtering. */
  mimeType?: string | null
}

export interface UploadQueueItem {
  tempId: string
  file: File
  previewUrl: string        // object URL for preview in modal
  suggestedRole: MediaRole
  isAudio: boolean
}

export interface UploadProgressEvent {
  tempId: string
  fileName: string
  completed: number
  total: number
  status: 'uploading' | 'done' | 'error'
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

// ── Local helpers ─────────────────────────────────────────────────────────────

function generateId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
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
  const url     = URL.createObjectURL(file)
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
    : (file.type || null)
  const metadataWithSvg = mergeMediaMetadata(baseMeta, svgValidation ? { svgValidation } : {})

  if (isVideo) {
    const [thumbDataUrl, duration] = await Promise.all([
      grabVideoThumbnail(url),
      getVideoDuration(url),
    ])
    return {
      id: generateId(), name: file.name, type: 'video', url,
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
    id: generateId(), name: file.name, type: 'image', url,
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
  | { ok: true; storagePath: string; dbId: string; thumbnailStoragePath: string | null }
  | { ok: false; error: string }

async function uploadToSupabase(
  file: File,
  item: LocalItem,
  userId: string,
): Promise<UploadResult> {
  const storagePath = `${userId}/${item.id}/${item.name}`
  let thumbnailStoragePath: string | null = null
  const uploadedPaths: string[] = []

  try {
    const contentType = item.metadata.svgValidation?.isValidSvg
      ? 'image/svg+xml'
      : (item.mimeType || file.type || 'application/octet-stream')
    const { error: uploadErr } = await uploadMediaFile(storagePath, file, contentType)
    if (uploadErr) return { ok: false, error: interpretError(uploadErr) }
    uploadedPaths.push(storagePath)

    if (item.type === 'video' && item._thumbDataUrl) {
      try {
        const thumbBlob = dataUrlToBlob(item._thumbDataUrl)
        const thumbPath = `${userId}/${item.id}/thumb.jpg`
        const { error: thumbErr } = await uploadMediaFile(thumbPath, thumbBlob, 'image/jpeg')
        if (!thumbErr) {
          thumbnailStoragePath = thumbPath
          uploadedPaths.push(thumbPath)
        }
      } catch { /* thumbnail generation is non-fatal */ }
    } else if (item.type === 'image') {
      thumbnailStoragePath = storagePath
    }

    const { id: dbId, error: dbErr } = await createMediaItem({
      user_id:        userId,
      name:           item.name,
      type:           item.type,
      storage_path:   storagePath,
      thumbnail_path: thumbnailStoragePath,
      mime_type:      contentType || null,
      file_size:      file.size,
      width:          item._width  ?? item.metadata.width  ?? null,
      height:         item._height ?? item.metadata.height ?? null,
      duration_sec:   item._duration ?? item.metadata.duration ?? null,
      favorite:       false,
      media_role:     item.mediaRole,
      title:          item.title    ?? null,
      description:    item.description ?? null,
      metadata:       item.metadata,
    })

    if (dbErr || !dbId) {
      await deleteMediaFiles(uploadedPaths)
      return { ok: false, error: interpretError(dbErr || 'Media record was not created') }
    }

    if (item.tags.length) {
      const { error: tagsErr } = await setMediaItemTags(dbId, userId, item.tags)
      if (tagsErr) console.warn('[mediaStore] setMediaItemTags:', tagsErr)
    }
    if (item.collectionIds.length) {
      const { error: collErr } = await setMediaItemCollections(dbId, item.collectionIds)
      if (collErr) console.warn('[mediaStore] setMediaItemCollections:', collErr)
    }

    return { ok: true, storagePath, dbId, thumbnailStoragePath }
  } catch (error) {
    if (uploadedPaths.length) await deleteMediaFiles(uploadedPaths).catch(() => {})
    const message = error instanceof Error ? error.message : 'Unexpected upload error'
    console.error('[mediaStore] uploadToSupabase:', error)
    return { ok: false, error: interpretError(message) }
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

// ── Store interface ───────────────────────────────────────────────────────────

interface MediaState {
  items: UploadedMedia[]
  collections: MediaCollection[]
  loading: boolean
  collectionsLoading: boolean
  loadError: string | null
  deleteError: string | null
  authRequired: boolean
  storageAvailable: boolean
  lastRestored: number | null
  activeFilter: MediaFilter

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
  setUploadDraftAudioArtist(v: string): void
  setUploadDraftAudioGenre(v: string): void
  setUploadDraftAudioBpm(v: string): void
  setUploadDraftAudioMusicalKey(v: string): void
  resetUploadDraft(): void

  // Upload
  uploadQueuedMedia(options?: UploadQueuedMediaOptions): Promise<UploadBatchResult>
  addFiles(files: File[]): Promise<void>   // quick drag-drop path (no modal)

  // Load
  loadFromSupabase(): Promise<void>

  // Item mutations
  removeItem(id: string): Promise<boolean>
  retryUpload(id: string): Promise<boolean>
  toggleFavorite(id: string): void
  toggleFavoriteMedia(id: string): void    // alias for toggleFavorite
  reorderItems(order: string[]): void
  setMediaRole(mediaId: string, role: MediaRole): void
  setMediaTags(mediaId: string, tags: string[]): void
  addMediaTag(mediaId: string, tag: string): void
  removeMediaTag(mediaId: string, tag: string): void
  bulkTagMedia(mediaIds: string[], tags: string[]): void
  saveMediaEdits(id: string, patch: { role: MediaRole; title: string; description: string; tags: string[]; collectionIds: string[]; metadata: MediaMetadata }): Promise<boolean>
  updateMediaMetadata(mediaId: string, patch: Partial<MediaMetadata>): Promise<boolean>

  // Collections
  loadCollections(): Promise<void>
  createCollection(name: string, description?: string): Promise<string | null>
  updateCollection(id: string, name: string, description?: string): Promise<boolean>
  removeCollection(id: string): Promise<boolean>
  addMediaToCollection(collectionId: string, mediaIds: string[]): void
  removeMediaFromCollection(collectionId: string, mediaIds: string[]): void
  reorderCollectionItems(collectionId: string, orderedMediaIds: string[]): Promise<void>

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
  collections: [],
  loading: false,
  collectionsLoading: false,
  loadError: null,
  deleteError: null,
  authRequired: false,
  storageAvailable: supabaseConfigured,
  lastRestored: null,
  activeFilter: 'all',

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
      return {
        tempId: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        suggestedRole: audio ? 'audio_track' : suggestMediaRole(file),
        isAudio: audio,
      }
    })
    set(state => ({ uploadQueue: [...state.uploadQueue, ...items], loadError: null }))
    return items.length
  },

  removeUploadQueueItem(tempId) {
    const item = get().uploadQueue.find(q => q.tempId === tempId)
    if (item) URL.revokeObjectURL(item.previewUrl)
    set(s => ({ uploadQueue: s.uploadQueue.filter(q => q.tempId !== tempId) }))
  },

  clearUploadQueue() {
    get().uploadQueue.forEach(q => URL.revokeObjectURL(q.previewUrl))
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
  setUploadDraftAudioArtist(v)     { set(s => ({ uploadDraft: { ...s.uploadDraft, audioArtist: v } })) },
  setUploadDraftAudioGenre(v)      { set(s => ({ uploadDraft: { ...s.uploadDraft, audioGenre: v } })) },
  setUploadDraftAudioBpm(v)        { set(s => ({ uploadDraft: { ...s.uploadDraft, audioBpm: v } })) },
  setUploadDraftAudioMusicalKey(v) { set(s => ({ uploadDraft: { ...s.uploadDraft, audioMusicalKey: v } })) },
  resetUploadDraft()               { set({ uploadDraft: { ...DEFAULT_DRAFT } }) },

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
        options.onProgress?.({ tempId: item.tempId, fileName: item.file.name, completed: failures.length, total, status: 'error', error })
      }
      return { total, succeeded: 0, failures }
    }

    const userId = await getCurrentUserId()
    if (!userId) {
      const error = supabaseConfigured ? 'Sign in to upload media.' : 'Supabase is not configured.'
      set({ authRequired: supabaseConfigured, loadError: error })
      for (const item of uploadQueue) {
        failures.push({ tempId: item.tempId, fileName: item.file.name, error })
        options.onProgress?.({ tempId: item.tempId, fileName: item.file.name, completed: failures.length, total, status: 'error', error })
      }
      return { total, succeeded: 0, failures }
    }

    let completed = 0
    let succeeded = 0
    for (const queueItem of uploadQueue) {
      options.onProgress?.({
        tempId: queueItem.tempId,
        fileName: queueItem.file.name,
        completed,
        total,
        status: 'uploading',
      })

      if (queueItem.isAudio) {
        const analysis = await analyzeAudioFile(queueItem.file).catch(() => null)
        const saved = await useAudioStore.getState().uploadAndSaveTrack({
          file:       queueItem.file,
          title:      total === 1 ? uploadDraft.title : '',
          artist:     uploadDraft.audioArtist,
          genre:      uploadDraft.audioGenre,
          bpmInput:   uploadDraft.audioBpm,
          musicalKey: uploadDraft.audioMusicalKey,
          userId,
          analysis,
        })
        completed += 1
        if (!saved) {
          const error = useAudioStore.getState().loadError ?? 'Audio upload failed.'
          failures.push({ tempId: queueItem.tempId, fileName: queueItem.file.name, error })
          options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'error', error })
          continue
        }
        succeeded += 1
        get().removeUploadQueueItem(queueItem.tempId)
        options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'done' })
        continue
      }

      const localItem = await buildLocalItem(queueItem.file, {
        role:          uploadDraft.role,
        title:         total === 1 ? (uploadDraft.title || undefined) : undefined,
        description:   uploadDraft.description || undefined,
        tags:          uploadDraft.tags,
        collectionIds: uploadDraft.collectionIds,
        metadata:      uploadDraft.metadata,
      })
      const result = await uploadToSupabase(queueItem.file, localItem, userId)
      completed += 1
      if (!result.ok) {
        if (localItem.url.startsWith('blob:')) URL.revokeObjectURL(localItem.url)
        failures.push({ tempId: queueItem.tempId, fileName: queueItem.file.name, error: result.error })
        options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'error', error: result.error })
        continue
      }

      const stableId = `db-${result.dbId}`
      const uploadedItem: UploadedMedia = {
        ...localItem,
        id: stableId,
        uploading: false,
        uploadError: undefined,
        storagePath: result.storagePath,
        dbId: result.dbId,
      }
      set(state => ({ items: [uploadedItem, ...state.items], loadError: null }))
      succeeded += 1
      get().removeUploadQueueItem(queueItem.tempId)
      options.onProgress?.({ tempId: queueItem.tempId, fileName: queueItem.file.name, completed, total, status: 'done' })

      if (isSvgFile(queueItem.file)) {
        void (async () => {
          try {
            const { precacheUploadedSvgGlyph } = await import('../components/vyzualz/react/services/svgMediaBridge')
            await precacheUploadedSvgGlyph({
              file: queueItem.file,
              mediaId: stableId,
              title: localItem.title,
              name: localItem.name,
            })
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

    const localItems = await Promise.all(
      mediaFiles.map(f => buildLocalItem(f, { role: suggestMediaRole(f) }))
    )
    const withUploading = localItems.map(i => ({ ...i, uploading: true }))
    set(s => ({ items: [...s.items, ...withUploading] }))

    const userId = await getCurrentUserId()
    if (!userId) {
      set(s => ({
        authRequired: true,
        items: s.items.map(i =>
          withUploading.some(w => w.id === i.id)
            ? { ...i, uploading: false, uploadError: supabaseConfigured ? 'Sign in to upload this file' : 'Supabase is not configured', uploadSourceFile: mediaFiles[withUploading.findIndex(w => w.id === i.id)] }
            : i
        ),
      }))
      return
    }

    await Promise.all(
      withUploading.map(async (item, i) => {
        const result = await uploadToSupabase(mediaFiles[i], item as LocalItem, userId)
        if (!result.ok) {
          set(s => ({
            items: s.items.map(e =>
              e.id === item.id
                ? { ...e, uploading: false, uploadError: result.error, uploadSourceFile: mediaFiles[i] }
                : e
            ),
          }))
          return
        }

        const stableId = `db-${result.dbId}`
        const prevId   = item.id
        set(s => ({
          items: s.items.map(e =>
            e.id === prevId
              ? { ...e, id: stableId, uploading: false, uploadError: undefined, uploadSourceFile: undefined, storagePath: result.storagePath, dbId: result.dbId }
              : e
          ),
        }))

        // Atomically remap every visual reference (activeMediaId, timeline
        // clips, overlay clips, layer items, session and preset snapshots) so
        // that anything placed while the upload was in-flight is not orphaned.
        useVisualStore.getState().remapMediaId(prevId, stableId)

        // SVG glyph pre-cache — fire-and-forget, non-blocking. The bridge is
        // lazy so the general media store stays independent of React-view internals.
        if (isSvgFile(mediaFiles[i])) {
          ;(async () => {
            try {
              const { precacheUploadedSvgGlyph } = await import('../components/vyzualz/react/services/svgMediaBridge')
              const outcome = await precacheUploadedSvgGlyph({
                file: mediaFiles[i],
                mediaId: `db-${result.dbId}`,
                title: item.title,
                name: item.name,
              })
              if (outcome === 'invalid') {
                console.warn('[mediaStore] SVG pre-cache: not valid SVG:', item.name)
              }
            } catch (e) {
              console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', e)
            }
          })()
        }
      })
    )
  },

  async retryUpload(id) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item?.uploadSourceFile) {
      set({ loadError: 'The original file is no longer available. Choose it again to retry.' })
      return false
    }
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: supabaseConfigured, loadError: supabaseConfigured ? 'Sign in to retry this upload.' : 'Supabase is not configured.' })
      return false
    }

    set(state => ({
      items: state.items.map(candidate => candidate.id === id ? { ...candidate, uploading: true, uploadError: undefined } : candidate),
    }))
    const result = await uploadToSupabase(item.uploadSourceFile, item as LocalItem, userId)
    if (!result.ok) {
      set(state => ({
        items: state.items.map(candidate => candidate.id === id ? { ...candidate, uploading: false, uploadError: result.error } : candidate),
        loadError: result.error,
      }))
      return false
    }

    const stableId = `db-${result.dbId}`
    set(state => ({
      items: state.items.map(candidate => candidate.id === id ? {
        ...candidate,
        id: stableId,
        uploading: false,
        uploadError: undefined,
        uploadSourceFile: undefined,
        storagePath: result.storagePath,
        dbId: result.dbId,
      } : candidate),
      loadError: null,
    }))
    useVisualStore.getState().remapMediaId(id, stableId)
    return true
  },

  // ── Load from Supabase ────────────────────────────────────────────────────

  async loadFromSupabase() {
    if (!supabaseConfigured) {
      set({ loadError: 'Storage not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' })
      return
    }
    const userId = await getCurrentUserId()
    if (!userId) { set({ authRequired: true }); return }

    set({ loading: true, loadError: null, authRequired: false })
    try {
      const [
        { rows, error },
        { tagMap, error: tagErr },
        { collMap, error: collErr },
        { rows: collRows, error: collListErr },
      ] = await Promise.all([
        listMediaItems(userId),
        listMediaItemTagNames(userId),
        listMediaItemCollectionIds(userId),
        listMediaCollections(userId),
      ])

      if (error)        { set({ loadError: interpretError(error) }); return }
      if (tagErr)       console.warn('[mediaStore] tag load:', tagErr)
      if (collErr)      console.warn('[mediaStore] collection-items load:', collErr)
      if (collListErr)  console.warn('[mediaStore] collections load:', collListErr)

      let signedUrlFailures = 0
      const collections: MediaCollection[] = collRows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
      }))

      if (!rows.length) {
        const currentItems = get().items
        const localOnly = currentItems.filter(item => !item.dbId)
        const removedRemoteIds = currentItems.filter(item => item.dbId).map(item => item.id)
        const visual = useVisualStore.getState()
        const previousActiveId = visual.activeMediaId
        removedRemoteIds.forEach(id => visual.removeMediaReferences(id))
        if (previousActiveId && removedRemoteIds.includes(previousActiveId)) {
          visual.setActiveMedia(localOnly[0]?.id ?? null)
        }
        set({ items: localOnly, lastRestored: 0, collections })
        return
      }

      const items: UploadedMedia[] = await Promise.all(
        rows.map(async (row: MediaItemRow) => {
          const { url, error: signErr } = await createSignedMediaUrl(row.storage_path)
          if (signErr) {
            signedUrlFailures += 1
            console.warn('[mediaStore] signed URL:', signErr, row.storage_path)
          }

          const isVideo = row.type === 'video'
          const ext = row.storage_path.split('.').pop()?.toUpperCase() ?? ''
          const displayMeta = isVideo
            ? `${ext} · ${fmtDur(row.duration_sec ?? 0)}`
            : row.width && row.height
              ? `${ext} · ${row.width}×${row.height}`
              : ext

          let thumbnailUrl: string | null = null
          if (isVideo) {
            if (row.thumbnail_path) {
              const { url: thumbUrl, error: thumbError } = await createSignedMediaUrl(row.thumbnail_path)
              if (thumbError) signedUrlFailures += 1
              thumbnailUrl = thumbUrl ?? null
            }
            // Missing video thumbnails are generated lazily after load — not blocking here
          } else {
            thumbnailUrl = url
          }

          // Merge DB-column dims into metadata JSONB
          const mergedMeta: MediaMetadata = {
            width:    row.width    ?? undefined,
            height:   row.height   ?? undefined,
            duration: row.duration_sec ?? undefined,
            ...((row.metadata as MediaMetadata) ?? {}),
          }

          return {
            id:           `db-${row.id}`,
            dbId:         row.id,
            storagePath:  row.storage_path,
            mimeType:      row.mime_type,
            name:         row.name,
            title:        row.title ?? undefined,
            description:  row.description ?? undefined,
            type:         row.type,
            url:          url ?? '',
            thumbnailUrl,
            meta:         displayMeta,
            favorite:     row.favorite,
            mediaRole:    row.media_role as MediaRole,
            tags:         tagMap.get(row.id) ?? [],
            collectionIds: collMap.get(row.id) ?? [],
            metadata:     mergedMeta,
          } satisfies UploadedMedia
        })
      )

      const currentItems = get().items
      const localOnly = currentItems.filter(item => !item.dbId)
      const merged = [...items, ...localOnly]
      const restoredIds = new Set(items.map(item => item.id))
      const removedRemoteIds = currentItems
        .filter(item => item.dbId && !restoredIds.has(item.id))
        .map(item => item.id)
      const visual = useVisualStore.getState()
      const previousActiveId = visual.activeMediaId
      removedRemoteIds.forEach(id => visual.removeMediaReferences(id))
      if (previousActiveId && !merged.some(item => item.id === previousActiveId)) {
        visual.setActiveMedia(merged[0]?.id ?? null)
      }
      set({
        items: merged,
        lastRestored: items.length,
        collections,
        loadError: signedUrlFailures > 0
          ? `${signedUrlFailures} media file${signedUrlFailures === 1 ? '' : 's'} could not be opened. Refresh or check storage access.`
          : null,
      })
      // Lazily generate thumbnails for any videos that lack a stored thumb
      get().generateMissingThumbnails()
    } catch (e) {
      const msg = e instanceof Error ? interpretError(e.message) : 'Unexpected error loading media'
      console.error('[mediaStore] loadFromSupabase exception:', e)
      set({ loadError: msg })
    } finally {
      set({ loading: false })
    }
  },

  // ── Item mutations ────────────────────────────────────────────────────────

  async removeItem(id) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) {
      set({ deleteError: 'That media item is no longer available.' })
      return false
    }

    if (item.dbId) {
      if (!supabaseConfigured) {
        set({ deleteError: 'Supabase is not configured. Synced media cannot be deleted.' })
        return false
      }
      const { error } = await deleteMediaItem(item.dbId)
      if (error) {
        set({ deleteError: interpretError(error) })
        return false
      }
    }

    const remaining = get().items.filter(candidate => candidate.id !== id)
    set({ items: remaining, deleteError: null })
    const visual = useVisualStore.getState()
    const wasActive = visual.activeMediaId === id
    visual.removeMediaReferences(id)
    if (wasActive) visual.setActiveMedia(remaining[0]?.id ?? null)

    if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
    if (item.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(item.thumbnailUrl)
    if (item.localThumbnailObjectUrl?.startsWith('blob:')) URL.revokeObjectURL(item.localThumbnailObjectUrl)
    if (item.type === 'video') {
      clearFilmstripCache(item.url)
      if (item.localThumbnailObjectUrl) clearFilmstripCache(item.localThumbnailObjectUrl)
    }

    try {
      const { cleanupRemovedSvgMedia } = await import('../components/vyzualz/react/services/svgMediaBridge')
      cleanupRemovedSvgMedia(id)
    } catch { /* non-fatal */ }

    if (item.dbId) {
      const storagePaths = [
        item.storagePath,
        item.storagePath && item.type === 'video'
          ? item.storagePath.replace(/\/[^/]+$/, '/thumb.jpg')
          : null,
      ].filter((path): path is string => Boolean(path))
      if (storagePaths.length) {
        const { error } = await deleteMediaFiles(storagePaths)
        if (error) set({ loadError: `Media deleted, but storage cleanup failed: ${interpretError(error)}` })
      }
    }
    return true
  },

  toggleFavorite(id) {
    const item = get().items.find(i => i.id === id)
    if (!item) return
    const newFav = !item.favorite
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, favorite: newFav } : i) }))
    if (item.dbId && supabaseConfigured) {
      updateMediaItemFavorite(item.dbId, newFav)
        .then(({ error }) => {
          if (!error) return
          console.error('[mediaStore] toggle fav:', error)
          set(state => ({
            items: state.items.map(candidate => candidate.id === id ? { ...candidate, favorite: item.favorite } : candidate),
            loadError: `Favorite update failed: ${interpretError(error)}`,
          }))
        })
    }
  },

  toggleFavoriteMedia(id) { get().toggleFavorite(id) },

  reorderItems(order) {
    set(s => {
      const ordered   = order.map(id => s.items.find(i => i.id === id)).filter(Boolean) as UploadedMedia[]
      const remaining = s.items.filter(i => !order.includes(i.id))
      return { items: [...ordered, ...remaining] }
    })
  },

  setMediaRole(mediaId, role) {
    const item = get().items.find(i => i.id === mediaId)
    if (!item) return
    set(s => ({ items: s.items.map(i => i.id === mediaId ? { ...i, mediaRole: role } : i) }))
    if (item.dbId && supabaseConfigured) {
      updateMediaItemRole(item.dbId, role)
        .then(({ error }) => { if (error) console.error('[mediaStore] setMediaRole:', error) })
    }
  },

  setMediaTags(mediaId, tags) {
    const item = get().items.find(i => i.id === mediaId)
    if (!item) return
    set(s => ({ items: s.items.map(i => i.id === mediaId ? { ...i, tags } : i) }))
    if (item.dbId && supabaseConfigured) {
      getCurrentUserId().then(userId => {
        if (!userId) return
        setMediaItemTags(item.dbId!, userId, tags)
          .then(({ error }) => { if (error) console.error('[mediaStore] setMediaTags:', error) })
      })
    }
  },

  addMediaTag(mediaId, tag) {
    const item = get().items.find(i => i.id === mediaId)
    if (!item || item.tags.includes(tag)) return
    get().setMediaTags(mediaId, [...item.tags, tag])
  },

  removeMediaTag(mediaId, tag) {
    const item = get().items.find(i => i.id === mediaId)
    if (!item) return
    get().setMediaTags(mediaId, item.tags.filter(t => t !== tag))
  },

  bulkTagMedia(mediaIds, tags) {
    for (const id of mediaIds) {
      const item = get().items.find(i => i.id === id)
      if (!item) continue
      const merged = Array.from(new Set([...item.tags, ...tags]))
      get().setMediaTags(id, merged)
    }
  },

  async saveMediaEdits(id, patch) {
    const item = get().items.find(candidate => candidate.id === id)
    if (!item) {
      set({ loadError: 'That media item is no longer available.' })
      return false
    }

    const nextItem: UploadedMedia = {
      ...item,
      mediaRole: patch.role,
      title: patch.title.trim() || undefined,
      description: patch.description.trim() || undefined,
      tags: patch.tags,
      collectionIds: patch.collectionIds,
      metadata: mergeMediaMetadata(item.metadata, patch.metadata),
    }

    if (item.dbId) {
      if (!supabaseConfigured) {
        set({ loadError: 'Supabase is not configured. Media changes were not saved.' })
        return false
      }
      const userId = await getCurrentUserId()
      if (!userId) {
        set({ authRequired: true, loadError: 'Sign in to save media changes.' })
        return false
      }
      const results = await Promise.all([
        updateMediaItem(item.dbId, {
          media_role: nextItem.mediaRole,
          title: nextItem.title ?? null,
          description: nextItem.description ?? null,
          metadata: nextItem.metadata,
        }),
        setMediaItemTags(item.dbId, userId, patch.tags),
        setMediaItemCollections(item.dbId, patch.collectionIds),
      ])
      const error = results.find(result => result.error)?.error
      if (error) {
        set({ loadError: `Media update failed: ${interpretError(error)}` })
        return false
      }
    }

    set(state => ({
      items: state.items.map(candidate => candidate.id === id ? nextItem : candidate),
      loadError: null,
    }))
    return true
  },

  async updateMediaMetadata(mediaId, patch) {
    const item = get().items.find(candidate => candidate.id === mediaId || candidate.dbId === mediaId)
    if (!item) return false
    const previous = item.metadata
    const metadata = mergeMediaMetadata(previous, patch)
    set(state => ({
      items: state.items.map(candidate => candidate.id === item.id ? { ...candidate, metadata } : candidate),
    }))
    if (!item.dbId || !supabaseConfigured) return true
    const { error } = await updateMediaItem(item.dbId, { metadata })
    if (!error) return true
    console.error('[mediaStore] updateMediaMetadata:', error)
    set(state => ({
      items: state.items.map(candidate => candidate.id === item.id ? { ...candidate, metadata: previous } : candidate),
    }))
    return false
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
    }))
    return true
  },

  addMediaToCollection(collectionId, mediaIds) {
    for (const mediaId of mediaIds) {
      const item = get().items.find(i => i.id === mediaId)
      if (!item || item.collectionIds.includes(collectionId)) continue
      const newIds = [...item.collectionIds, collectionId]
      set(s => ({ items: s.items.map(i => i.id === mediaId ? { ...i, collectionIds: newIds } : i) }))
      if (item.dbId && supabaseConfigured) {
        setMediaItemCollections(item.dbId, newIds)
          .then(({ error }) => { if (error) console.error('[mediaStore] addMediaToCollection:', error) })
      }
    }
  },

  removeMediaFromCollection(collectionId, mediaIds) {
    for (const mediaId of mediaIds) {
      const item = get().items.find(i => i.id === mediaId)
      if (!item) continue
      const newIds = item.collectionIds.filter(id => id !== collectionId)
      set(s => ({ items: s.items.map(i => i.id === mediaId ? { ...i, collectionIds: newIds } : i) }))
      if (item.dbId && supabaseConfigured) {
        setMediaItemCollections(item.dbId, newIds)
          .then(({ error }) => { if (error) console.error('[mediaStore] removeMediaFromCollection:', error) })
      }
    }
  },

  async reorderCollectionItems(collectionId, orderedMediaIds) {
    const dbIds = orderedMediaIds
      .map(id => get().items.find(i => i.id === id)?.dbId)
      .filter(Boolean) as string[]
    if (!dbIds.length || !supabaseConfigured) return
    const { error } = await dbReorderCollectionItems(collectionId, dbIds)
    if (error) console.error('[mediaStore] reorderCollectionItems:', error)
  },

  // ── Thumbnail generation ──────────────────────────────────────────────────

  generateMissingThumbnails() {
    const needsThumb = get().items.filter(i =>
      !i.uploading && !i.thumbnailUrl && !i.localThumbnailObjectUrl && i.url
    )
    for (const item of needsThumb) {
      generateThumbnail(item.url, item.type).then(result => {
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
  clearDeleteError() { set({ deleteError: null }) },
  clearRestored()    { set({ lastRestored: null }) },

  clear() {
    get().items.forEach(i => {
      if (i.url.startsWith('blob:'))                         URL.revokeObjectURL(i.url)
      if (i.thumbnailUrl?.startsWith('blob:'))               URL.revokeObjectURL(i.thumbnailUrl)
      if (i.localThumbnailObjectUrl?.startsWith('blob:'))    URL.revokeObjectURL(i.localThumbnailObjectUrl)
      if (i.type === 'video') {
        clearFilmstripCache(i.url)
        if (i.localThumbnailObjectUrl) clearFilmstripCache(i.localThumbnailObjectUrl)
      }
    })
    get().uploadQueue.forEach(q => URL.revokeObjectURL(q.previewUrl))
    set({ items: [], uploadQueue: [] })
  },
}))

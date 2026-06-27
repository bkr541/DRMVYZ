import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  listMediaItems,
  createMediaItem,
  updateMediaItem,
  updateMediaItemRole,
  updateMediaItemFavorite,
  updateMediaItemMetadata,
  deleteMediaItem,
  createSignedMediaUrl,
  uploadMediaFile,
  deleteMediaFiles,
  setMediaItemTags,
  listMediaItemTagNames,
  listMediaCollections,
  createMediaCollection,
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
      metadata: { ...baseMeta, ...(svgValidation ? { svgValidation } : {}), duration },
      mimeType,
      _duration: duration,
      _thumbDataUrl: thumbDataUrl ?? undefined,
    }
  }

  const dims = await getImageDimensions(url)
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
    metadata: { ...baseMeta, ...(svgValidation ? { svgValidation } : {}), width: dims?.w, height: dims?.h },
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

interface UploadResult {
  storagePath: string
  dbId: string
  thumbnailStoragePath: string | null
}

async function uploadToSupabase(
  file: File,
  item: LocalItem,
  userId: string,
): Promise<UploadResult | null> {
  try {
    const storagePath = `${userId}/${item.id}/${item.name}`

    // Only content-inspected SVG documents are uploaded as image/svg+xml.
    // A misleading .svg filename must not override the actual content type.
    const contentType = item.metadata.svgValidation?.isValidSvg
      ? 'image/svg+xml'
      : (item.mimeType || file.type || 'application/octet-stream')
    const { error: uploadErr } = await uploadMediaFile(storagePath, file, contentType)
    if (uploadErr) { console.error('[mediaStore] storage upload:', uploadErr); return null }

    let thumbnailStoragePath: string | null = null
    if (item.type === 'video' && item._thumbDataUrl) {
      try {
        const thumbBlob = dataUrlToBlob(item._thumbDataUrl)
        const thumbPath = `${userId}/${item.id}/thumb.jpg`
        const { error: thumbErr } = await uploadMediaFile(thumbPath, thumbBlob, 'image/jpeg')
        if (!thumbErr) thumbnailStoragePath = thumbPath
      } catch { /* non-fatal */ }
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

    if (dbErr || !dbId) { console.error('[mediaStore] db insert:', dbErr); return null }

    // Persist tags via normalized junction tables
    if (item.tags.length) {
      const { error: tagsErr } = await setMediaItemTags(dbId, userId, item.tags)
      if (tagsErr) console.warn('[mediaStore] setMediaItemTags:', tagsErr)
    }

    // Persist collection memberships
    if (item.collectionIds.length) {
      const { error: collErr } = await setMediaItemCollections(dbId, item.collectionIds)
      if (collErr) console.warn('[mediaStore] setMediaItemCollections:', collErr)
    }

    return { storagePath, dbId, thumbnailStoragePath }
  } catch (e) {
    console.error('[mediaStore] uploadToSupabase:', e)
    return null
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
  addFilesToUploadQueue(files: File[]): void
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
  uploadQueuedMedia(): Promise<void>
  addFiles(files: File[]): Promise<void>   // quick drag-drop path (no modal)

  // Load
  loadFromSupabase(): Promise<void>

  // Item mutations
  removeItem(id: string): void
  toggleFavorite(id: string): void
  toggleFavoriteMedia(id: string): void    // alias for toggleFavorite
  reorderItems(order: string[]): void
  setMediaRole(mediaId: string, role: MediaRole): void
  setMediaTags(mediaId: string, tags: string[]): void
  addMediaTag(mediaId: string, tag: string): void
  removeMediaTag(mediaId: string, tag: string): void
  bulkTagMedia(mediaIds: string[], tags: string[]): void
  saveMediaEdits(id: string, patch: { role: MediaRole; title: string; description: string; tags: string[]; collectionIds: string[]; metadata: MediaMetadata }): Promise<void>

  // Collections
  loadCollections(): Promise<void>
  createCollection(name: string, description?: string): Promise<string | null>
  removeCollection(id: string): void
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
      /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|mkv|mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
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
    set(s => ({ uploadQueue: [...s.uploadQueue, ...items] }))
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

  async uploadQueuedMedia() {
    const { uploadQueue, uploadDraft } = get()
    if (!uploadQueue.length) return

    // ── Audio upload path ─────────────────────────────────────────────────
    const isAudioQueue = uploadQueue.every(q => q.isAudio)
    if (isAudioQueue) {
      const userId = await getCurrentUserId()
      if (!userId) { set({ authRequired: true }); return }

      for (const q of uploadQueue) {
        const analysis = await analyzeAudioFile(q.file).catch(() => null)
        await useAudioStore.getState().uploadAndSaveTrack({
          file:       q.file,
          title:      uploadDraft.title,
          artist:     uploadDraft.audioArtist,
          genre:      uploadDraft.audioGenre,
          bpmInput:   uploadDraft.audioBpm,
          musicalKey: uploadDraft.audioMusicalKey,
          userId,
          analysis,
        })
      }
      get().clearUploadQueue()
      return
    }

    // ── Visual media upload path (existing) ───────────────────────────────
    const localItems = await Promise.all(
      uploadQueue.map(q =>
        buildLocalItem(q.file, {
          role:         uploadDraft.role,
          title:        uploadDraft.title || undefined,
          description:  uploadDraft.description || undefined,
          tags:         uploadDraft.tags,
          collectionIds: uploadDraft.collectionIds,
          metadata:     uploadDraft.metadata,
        })
      )
    )

    const files = uploadQueue.map(q => q.file)   // capture before queue is cleared
    const withUploading = localItems.map(i => ({ ...i, uploading: true }))
    set(s => ({ items: [...s.items, ...withUploading] }))
    get().clearUploadQueue()

    const userId = await getCurrentUserId()
    if (!userId) {
      set(s => ({
        authRequired: true,
        items: s.items.map(i =>
          withUploading.some(w => w.id === i.id) ? { ...i, uploading: false } : i
        ),
      }))
      return
    }

    await Promise.all(
      withUploading.map(async (item, i) => {
        const result = await uploadToSupabase(files[i], item as LocalItem, userId)
        if (!result) {
          set(s => ({
            items: s.items.map(e =>
              e.id === item.id
                ? { ...e, uploading: false, uploadError: 'Upload failed — stored locally' }
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
              ? { ...e, id: stableId, uploading: false, uploadError: undefined, storagePath: result.storagePath, dbId: result.dbId }
              : e
          ),
        }))

        // Atomically remap every visual reference (activeMediaId, timeline
        // clips, overlay clips, layer items, session and preset snapshots) so
        // that anything placed while the upload was in-flight is not orphaned.
        useVisualStore.getState().remapMediaId(prevId, stableId)

        // SVG glyph pre-cache — fire-and-forget, non-blocking
        if (isSvgFile(files[i])) {
          ;(async () => {
            try {
              const rawSvg = await files[i].text()
              const { isSvgContent } = await import('../components/vyzualz/react/renderers/svgGlyphUtils')
              if (!isSvgContent(rawSvg)) { console.warn('[mediaStore] SVG pre-cache: not valid SVG:', item.name); return }
              const { useReactStore } = await import('./reactStore')
              const displayName = (item.title ?? item.name).replace(/\.svg$/i, '').trim() || 'SVG Glyph'
              // Use db-prefixed ID to match the media store item ID format used by the glyph dropdown
              useReactStore.getState().addAndCacheMediaSvgGlyph(`db-${result.dbId}`, rawSvg, displayName)
            } catch (e) {
              console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', e)
            }
          })()
        }
      })
    )
  },

  // ── Upload: drag-drop path (no modal, auto-detect role) ───────────────────

  async addFiles(files) {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|svg|mp4|mov|webm|mkv)$/i.test(f.name)
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
          withUploading.some(w => w.id === i.id) ? { ...i, uploading: false } : i
        ),
      }))
      return
    }

    await Promise.all(
      withUploading.map(async (item, i) => {
        const result = await uploadToSupabase(mediaFiles[i], item as LocalItem, userId)
        if (!result) {
          set(s => ({
            items: s.items.map(e =>
              e.id === item.id
                ? { ...e, uploading: false, uploadError: 'Upload failed — stored locally' }
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
              ? { ...e, id: stableId, uploading: false, uploadError: undefined, storagePath: result.storagePath, dbId: result.dbId }
              : e
          ),
        }))

        // Atomically remap every visual reference (activeMediaId, timeline
        // clips, overlay clips, layer items, session and preset snapshots) so
        // that anything placed while the upload was in-flight is not orphaned.
        useVisualStore.getState().remapMediaId(prevId, stableId)

        // SVG glyph pre-cache — fire-and-forget, non-blocking
        if (isSvgFile(mediaFiles[i])) {
          ;(async () => {
            try {
              const rawSvg = await mediaFiles[i].text()
              const { isSvgContent } = await import('../components/vyzualz/react/renderers/svgGlyphUtils')
              if (!isSvgContent(rawSvg)) { console.warn('[mediaStore] SVG pre-cache: not valid SVG:', item.name); return }
              const { useReactStore } = await import('./reactStore')
              const displayName = (item.title ?? item.name).replace(/\.svg$/i, '').trim() || 'SVG Glyph'
              // Use db-prefixed ID to match the media store item ID format used by the glyph dropdown
              useReactStore.getState().addAndCacheMediaSvgGlyph(`db-${result.dbId}`, rawSvg, displayName)
            } catch (e) {
              console.warn('[mediaStore] SVG glyph pre-cache failed (non-fatal):', e)
            }
          })()
        }
      })
    )
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

      const collections: MediaCollection[] = collRows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
      }))

      if (!rows.length) {
        set({ lastRestored: 0, collections })
        return
      }

      const items: UploadedMedia[] = await Promise.all(
        rows.map(async (row: MediaItemRow) => {
          const { url, error: signErr } = await createSignedMediaUrl(row.storage_path)
          if (signErr) console.warn('[mediaStore] signed URL:', signErr, row.storage_path)

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
              const { url: thumbUrl } = await createSignedMediaUrl(row.thumbnail_path)
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

      set(s => {
        const dbIds = new Set(items.map(i => i.dbId))
        const localOnly = s.items.filter(i => !i.dbId || !dbIds.has(i.dbId))
        const merged = [...items, ...localOnly]
        const visual = useVisualStore.getState()
        if (visual.activeMediaId !== null && !merged.some(i => i.id === visual.activeMediaId)) {
          visual.setActiveMedia(merged[0]?.id ?? null)
        }
        return { items: merged, lastRestored: items.length, collections }
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

  removeItem(id) {
    const { items } = get()
    const item = items.find(i => i.id === id)
    if (!item) return
    const remaining = items.filter(i => i.id !== id)
    set({ items: remaining })
    if (item.url.startsWith('blob:'))                         URL.revokeObjectURL(item.url)
    if (item.thumbnailUrl?.startsWith('blob:'))               URL.revokeObjectURL(item.thumbnailUrl)
    if (item.localThumbnailObjectUrl?.startsWith('blob:'))    URL.revokeObjectURL(item.localThumbnailObjectUrl)
    // Release cached filmstrip frames so stale frames don't accumulate in memory
    if (item.type === 'video') {
      clearFilmstripCache(item.url)
      if (item.localThumbnailObjectUrl) clearFilmstripCache(item.localThumbnailObjectUrl)
    }
    const visual = useVisualStore.getState()
    if (visual.activeMediaId === id) visual.setActiveMedia(remaining[0]?.id ?? null)

    // Clean up any SVG glyph asset and SVG visual selection backed by this media item
    ;(async () => {
      try {
        const { useReactStore } = await import('./reactStore')
        const store = useReactStore.getState()
        store.removeOscillatorGlyphAsset(`glyph-media:${id}`)
        store.clearSvgVisualForMedia(id)
      } catch { /* non-fatal */ }
    })()

    if (item.dbId && supabaseConfigured) {
      const storagePaths = [
        item.storagePath,
        item.storagePath && item.type === 'video'
          ? item.storagePath.replace(/\/[^/]+$/, '/thumb.jpg')
          : null,
      ].filter(Boolean) as string[]

      Promise.all([
        deleteMediaItem(item.dbId),
        storagePaths.length ? deleteMediaFiles(storagePaths) : Promise.resolve({ error: null }),
      ]).then(([dbResult, storageResult]) => {
        const err = dbResult.error ?? storageResult.error
        if (err) {
          console.error('[mediaStore] delete failed:', err)
          set(s => ({ items: [item, ...s.items], deleteError: interpretError(err) }))
          if (visual.activeMediaId !== id) visual.setActiveMedia(id)
          // TODO(SVG-rollback): SVG glyph asset and SVG visual selection were already
          // cleaned up optimistically above.  Restoring the media item does not restore
          // the oscillator selection.  To fix: snapshot oscillatorGlyphAssets /
          // oscillatorSettings before cleanup and call addOscillatorGlyphAsset +
          // selectOscillatorGlyph / selectSvgVisual inside this rollback branch.
        }
      }).catch(e => {
        const msg = e instanceof Error ? e.message : 'Delete failed'
        set(s => ({ items: [item, ...s.items], deleteError: interpretError(msg) }))
        if (visual.activeMediaId !== id) visual.setActiveMedia(id)
        // TODO(SVG-rollback): same as above — SVG state not restored on catch rollback.
      })
    }
  },

  toggleFavorite(id) {
    const item = get().items.find(i => i.id === id)
    if (!item) return
    const newFav = !item.favorite
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, favorite: newFav } : i) }))
    if (item.dbId && supabaseConfigured) {
      updateMediaItemFavorite(item.dbId, newFav)
        .then(({ error }) => { if (error) console.error('[mediaStore] toggle fav:', error) })
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
    const item = get().items.find(i => i.id === id)
    if (!item) return
    set(s => ({
      items: s.items.map(i => i.id === id ? {
        ...i,
        mediaRole:   patch.role,
        title:       patch.title       || undefined,
        description: patch.description || undefined,
        tags:        patch.tags,
        collectionIds: patch.collectionIds,
        metadata:    { ...i.metadata, ...patch.metadata },
      } : i),
    }))
    if (item.dbId && supabaseConfigured) {
      const userId = await getCurrentUserId()
      await Promise.all([
        updateMediaItem(item.dbId, {
          media_role:  patch.role,
          title:       patch.title       || null,
          description: patch.description || null,
          metadata:    patch.metadata,
        }),
        userId
          ? setMediaItemTags(item.dbId, userId, patch.tags)
              .then(({ error }) => { if (error) console.error('[mediaStore] saveMediaEdits tags:', error) })
          : Promise.resolve(),
        setMediaItemCollections(item.dbId, patch.collectionIds)
          .then(({ error }) => { if (error) console.error('[mediaStore] saveMediaEdits collections:', error) }),
      ])
    }
  },

  // ── Collections ───────────────────────────────────────────────────────────

  async loadCollections() {
    if (!supabaseConfigured) return
    const userId = await getCurrentUserId()
    if (!userId) return
    set({ collectionsLoading: true })
    try {
      const { rows, error } = await listMediaCollections(userId)
      if (error) { console.error('[mediaStore] loadCollections:', error); return }
      set({ collections: rows.map(r => ({ id: r.id, name: r.name, description: r.description ?? undefined })) })
    } finally {
      set({ collectionsLoading: false })
    }
  },

  async createCollection(name, description) {
    if (!supabaseConfigured) return null
    const userId = await getCurrentUserId()
    if (!userId) return null
    const { id, error } = await createMediaCollection({ user_id: userId, name, description })
    if (error || !id) { console.error('[mediaStore] createCollection:', error); return null }
    set(s => ({ collections: [...s.collections, { id, name, description }] }))
    return id
  },

  removeCollection(id) {
    set(s => ({ collections: s.collections.filter(c => c.id !== id) }))
    if (supabaseConfigured) {
      deleteMediaCollection(id).then(({ error }) => {
        if (error) console.error('[mediaStore] removeCollection:', error)
      })
    }
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

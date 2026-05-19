import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  listMediaItems,
  createMediaItem,
  updateMediaItem,
  deleteMediaItem,
  createSignedMediaUrl,
  uploadMediaFile,
  deleteMediaFiles,
} from '../lib/mediaDb'
import type { MediaItemRow } from '../types/database'
import { useVisualStore } from './visualStore'

export interface UploadedMedia {
  id: string
  name: string
  type: 'image' | 'video'
  url: string             // object URL (local) or signed URL (from Supabase)
  thumbnailUrl: string | null
  meta: string
  favorite: boolean
  uploading?: boolean     // true while background upload is in progress
  uploadError?: string    // set when Supabase upload fails; item stays local-only
  storagePath?: string    // set after Supabase upload
  dbId?: string           // Supabase media_items row id
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
    v.src = url; v.preload = 'metadata'
    v.onloadedmetadata = () => resolve(v.duration || 0)
    v.onerror = () => resolve(0)
  })
}

function grabVideoThumbnail(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.src = url; v.muted = true; v.playsInline = true
    v.preload = 'metadata'; v.crossOrigin = 'anonymous'; v.currentTime = 0.5
    const draw = () => {
      try {
        const c = document.createElement('canvas')
        c.width = 160; c.height = 90
        const ctx = c.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(v, 0, 0, 160, 90)
        resolve(c.toDataURL('image/jpeg', 0.7))
      } catch { resolve(null) }
    }
    v.onseeked = draw
    v.onerror  = () => resolve(null)
    v.onloadeddata = () => { if (v.readyState >= 2) draw() }
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

type LocalItem = UploadedMedia & {
  _width?: number
  _height?: number
  _duration?: number
  _thumbDataUrl?: string  // for videos: the generated thumbnail data URL to upload
}

async function buildLocalItem(file: File): Promise<LocalItem> {
  const url     = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
  const ext     = (file.name.split('.').pop() ?? '').toUpperCase()

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

    // Upload the main file
    const { error: uploadErr } = await uploadMediaFile(storagePath, file, file.type)
    if (uploadErr) { console.error('[mediaStore] storage upload:', uploadErr); return null }

    // For videos: upload thumbnail blob separately so reload doesn't need to re-render it
    let thumbnailStoragePath: string | null = null
    if (item.type === 'video' && item._thumbDataUrl) {
      try {
        const thumbBlob = dataUrlToBlob(item._thumbDataUrl)
        const thumbPath = `${userId}/${item.id}/thumb.jpg`
        const { error: thumbErr } = await uploadMediaFile(thumbPath, thumbBlob, 'image/jpeg')
        if (!thumbErr) thumbnailStoragePath = thumbPath
      } catch { /* non-fatal; thumbnail will be re-generated on next reload */ }
    } else if (item.type === 'image') {
      // Image is its own thumbnail
      thumbnailStoragePath = storagePath
    }

    // Insert DB row
    const { id: dbId, error: dbErr } = await createMediaItem({
      user_id:        userId,
      name:           item.name,
      type:           item.type,
      storage_path:   storagePath,
      thumbnail_path: thumbnailStoragePath,
      mime_type:      file.type || null,
      file_size:      file.size,
      width:          item._width  ?? null,
      height:         item._height ?? null,
      duration_sec:   item._duration ?? null,
      favorite:       false,
    })

    if (dbErr || !dbId) { console.error('[mediaStore] db insert:', dbErr); return null }
    return { storagePath, dbId, thumbnailStoragePath }
  } catch (e) {
    console.error('[mediaStore] uploadToSupabase:', e)
    return null
  }
}

// ── Error helpers ──────────────────────────────────────────────────────────────

function interpretError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('jwt') || lower.includes('unauthorized') || lower.includes('not authenticated')) return 'Session expired — sign in again'
  if (lower.includes('row-level security') || lower.includes('policy')) return 'Storage permission denied — check RLS policies'
  if (lower.includes('already exists') || lower.includes('duplicate')) return 'File already exists in storage'
  if (lower.includes('network') || lower.includes('fetch')) return 'Network error — check connection'
  if (lower.includes('bucket') && lower.includes('not found')) return 'Storage bucket not found — check Supabase config'
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface MediaState {
  items: UploadedMedia[]
  loading: boolean
  loadError: string | null       // error from loadFromSupabase
  deleteError: string | null     // error from a failed removeItem
  authRequired: boolean          // true when user is not signed in
  storageAvailable: boolean      // false when Supabase env vars are missing
  lastRestored: number | null    // count of items restored; cleared by component after showing
  addFiles(files: File[]): Promise<void>
  loadFromSupabase(): Promise<void>
  removeItem(id: string): void
  toggleFavorite(id: string): void
  reorderItems(order: string[]): void
  clearLoadError(): void
  clearDeleteError(): void
  clearRestored(): void
  clear(): void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],
  loading: false,
  loadError: null,
  deleteError: null,
  authRequired: false,
  storageAvailable: supabaseConfigured,
  lastRestored: null,

  async addFiles(files) {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (!mediaFiles.length) return

    // Build local items immediately so the UI responds without waiting for upload
    const localItems = await Promise.all(mediaFiles.map(buildLocalItem))
    const withUploading = localItems.map(i => ({ ...i, uploading: true }))
    set(s => ({ items: [...s.items, ...withUploading] }))

    // Upload to Supabase in background
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

        // Use 'db-{dbId}' as the canonical stable id — matches what loadFromSupabase returns
        const stableId = `db-${result.dbId}`
        const prevId = item.id

        set(s => ({
          items: s.items.map(e =>
            e.id === prevId
              ? {
                  ...e,
                  id: stableId,
                  uploading: false,
                  uploadError: undefined,
                  storagePath: result.storagePath,
                  dbId: result.dbId,
                }
              : e
          ),
        }))

        // Preserve activeMediaId when the local ID transitions to the stable DB ID
        const visual = useVisualStore.getState()
        if (visual.activeMediaId === prevId) {
          visual.setActiveMedia(stableId)
        }
      })
    )
  },

  async loadFromSupabase() {
    if (!supabaseConfigured) {
      set({ loadError: 'Storage not configured — add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env' })
      return
    }
    const userId = await getCurrentUserId()
    if (!userId) {
      set({ authRequired: true })
      return
    }

    set({ loading: true, loadError: null, authRequired: false })
    try {
      const { rows, error } = await listMediaItems(userId)

      if (error) {
        console.error('[mediaStore] load:', error)
        set({ loadError: interpretError(error) })
        return
      }
      if (!rows.length) {
        set({ lastRestored: 0 })
        return
      }

      // Build items from DB rows, generating signed URLs
      const items: UploadedMedia[] = await Promise.all(
        rows.map(async (row: MediaItemRow) => {
          const { url, error: signErr } = await createSignedMediaUrl(row.storage_path)
          if (signErr) console.warn('[mediaStore] signed URL:', signErr, row.storage_path)

          const isVideo = row.type === 'video'
          const ext = row.storage_path.split('.').pop()?.toUpperCase() ?? ''

          const meta = isVideo
            ? `${ext} · ${fmtDur(row.duration_sec ?? 0)}`
            : row.width && row.height
              ? `${ext} · ${row.width}×${row.height}`
              : ext

          // Prefer stored thumbnail_path over re-generating from video every load
          let thumbnailUrl: string | null = null
          if (isVideo) {
            if (row.thumbnail_path) {
              const { url: thumbUrl } = await createSignedMediaUrl(row.thumbnail_path)
              thumbnailUrl = thumbUrl
            }
            // Fallback: grab from video if no stored thumbnail (legacy or failed upload)
            if (!thumbnailUrl && url) thumbnailUrl = await grabVideoThumbnail(url)
          } else {
            thumbnailUrl = url  // image is its own thumbnail
          }

          return {
            id: `db-${row.id}`,
            dbId: row.id,
            storagePath: row.storage_path,
            name: row.name,
            type: row.type,
            url: url ?? '',
            thumbnailUrl,
            meta,
            favorite: row.favorite,
          }
        })
      )

      // Merge: keep locally-added items still uploading, replace any with a dbId match
      set(s => {
        const dbIds = new Set(items.map(i => i.dbId))
        const localOnly = s.items.filter(i => !i.dbId || !dbIds.has(i.dbId))
        const merged = [...items, ...localOnly]

        // Correct stale activeMediaId: if it doesn't match any loaded item, select the first one
        const visual = useVisualStore.getState()
        if (visual.activeMediaId !== null) {
          const exists = merged.some(i => i.id === visual.activeMediaId)
          if (!exists) {
            visual.setActiveMedia(merged[0]?.id ?? null)
          }
        }

        return { items: merged, lastRestored: items.length }
      })
    } catch (e) {
      const msg = e instanceof Error ? interpretError(e.message) : 'Unexpected error loading media'
      console.error('[mediaStore] loadFromSupabase exception:', e)
      set({ loadError: msg })
    } finally {
      set({ loading: false })
    }
  },

  removeItem(id) {
    const { items } = get()
    const item = items.find(i => i.id === id)
    if (!item) return

    // Optimistic removal from UI
    const remaining = items.filter(i => i.id !== id)
    set({ items: remaining })

    // Revoke object URLs
    if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
    if (item.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(item.thumbnailUrl)

    // If this was the active item, select the next available one
    const visual = useVisualStore.getState()
    if (visual.activeMediaId === id) {
      visual.setActiveMedia(remaining[0]?.id ?? null)
    }

    // Background cleanup: DB row + storage file
    if (item.dbId && supabaseConfigured) {
      const storagePaths = [
        item.storagePath,
        // Also delete thumbnail if it's a separate file (not the main file)
        item.storagePath && item.thumbnailUrl && !item.thumbnailUrl.startsWith('blob:') && item.type === 'video'
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
          // Restore item and show error banner
          set(s => ({
            items: [item, ...s.items],
            deleteError: interpretError(err),
          }))
          // Restore active selection if we changed it
          if (visual.activeMediaId !== id) {
            visual.setActiveMedia(id)
          }
        }
      }).catch(e => {
        const msg = e instanceof Error ? e.message : 'Delete failed'
        console.error('[mediaStore] delete exception:', e)
        set(s => ({ items: [item, ...s.items], deleteError: interpretError(msg) }))
        if (visual.activeMediaId !== id) visual.setActiveMedia(id)
      })
    }
  },

  toggleFavorite(id) {
    const item = get().items.find(i => i.id === id)
    if (!item) return
    const newFav = !item.favorite
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, favorite: newFav } : i) }))
    if (item.dbId && supabaseConfigured) {
      updateMediaItem(item.dbId, { favorite: newFav })
        .then(({ error }) => { if (error) console.error('[mediaStore] toggle fav:', error) })
    }
  },

  reorderItems(order: string[]) {
    set(s => {
      const ordered   = order.map(id => s.items.find(i => i.id === id)).filter(Boolean) as UploadedMedia[]
      const remaining = s.items.filter(i => !order.includes(i.id))
      return { items: [...ordered, ...remaining] }
    })
  },

  clearLoadError()   { set({ loadError: null }) },
  clearDeleteError() { set({ deleteError: null }) },
  clearRestored()    { set({ lastRestored: null }) },

  clear() {
    get().items.forEach(i => {
      if (i.url.startsWith('blob:')) URL.revokeObjectURL(i.url)
      if (i.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(i.thumbnailUrl)
    })
    set({ items: [] })
  },
}))

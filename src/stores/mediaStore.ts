import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { MediaItemRow } from '../types/database'

// The Database generic in our typed client causes `never` inference for table
// queries when the schema has complex union types. Use an untyped alias for DB
// operations only; storage calls remain fully typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface UploadedMedia {
  id: string
  name: string
  type: 'image' | 'video'
  url: string             // object URL (local) or signed URL (from Supabase)
  thumbnailUrl: string | null
  meta: string
  favorite: boolean
  storagePath?: string    // set after Supabase upload
  dbId?: string           // Supabase media_items row id
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function generateId() {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
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

async function buildLocalItem(file: File): Promise<UploadedMedia & {
  _width?: number; _height?: number; _duration?: number
}> {
  const url     = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
  const ext     = (file.name.split('.').pop() ?? '').toUpperCase()

  if (isVideo) {
    const [thumbUrl, duration] = await Promise.all([grabVideoThumbnail(url), getVideoDuration(url)])
    return {
      id: generateId(), name: file.name, type: 'video', url,
      thumbnailUrl: thumbUrl,
      meta: `${ext} · ${fmtDur(duration)}`,
      favorite: false,
      _duration: duration,
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

async function uploadToSupabase(
  file: File,
  item: UploadedMedia & { _width?: number; _height?: number; _duration?: number },
  userId: string,
): Promise<{ storagePath: string; dbId: string } | null> {
  try {
    const ext          = file.name.split('.').pop() ?? 'bin'
    const storagePath  = `${userId}/${item.id}/${item.name}`

    // Upload file to storage
    const { error: uploadErr } = await supabase.storage
      .from('media-items')
      .upload(storagePath, file, { upsert: false, contentType: file.type })

    if (uploadErr) { console.error('[mediaStore] storage upload:', uploadErr.message); return null }

    // Insert metadata row
    const { data: row, error: dbErr } = await db
      .from('media_items')
      .insert({
        user_id:      userId,
        name:         item.name.replace(`.${ext}`, '').replace(/[-_]/g, ' '),
        type:         item.type,
        storage_path: storagePath,
        mime_type:    file.type || null,
        file_size:    file.size,
        width:        item._width  ?? null,
        height:       item._height ?? null,
        duration_sec: item._duration ?? null,
        favorite:     false,
      })
      .select('id')
      .single()

    if (dbErr) { console.error('[mediaStore] db insert:', dbErr.message); return null }

    return { storagePath, dbId: (row as MediaItemRow).id }
  } catch (e) {
    console.error('[mediaStore] uploadToSupabase:', e)
    return null
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface MediaState {
  items: UploadedMedia[]
  loading: boolean
  addFiles(files: File[]): Promise<void>
  loadFromSupabase(): Promise<void>
  removeItem(id: string): void
  toggleFavorite(id: string): void
  clear(): void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],
  loading: false,

  async addFiles(files) {
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (!mediaFiles.length) return

    // Build local items immediately so the UI responds without waiting for upload
    const localItems = await Promise.all(mediaFiles.map(buildLocalItem))
    set(s => ({ items: [...s.items, ...localItems] }))

    // Upload to Supabase in the background
    const userId = await getCurrentUserId()
    if (!userId) return

    await Promise.all(
      localItems.map(async (item, i) => {
        const result = await uploadToSupabase(mediaFiles[i], item, userId)
        if (!result) return
        // Patch the local item with storagePath + dbId
        set(s => ({
          items: s.items.map(existing =>
            existing.id === item.id
              ? { ...existing, storagePath: result.storagePath, dbId: result.dbId }
              : existing
          ),
        }))
      })
    )
  },

  async loadFromSupabase() {
    if (!supabaseConfigured) return
    const userId = await getCurrentUserId()
    if (!userId) return

    set({ loading: true })
    try {
      const { data: rows, error } = await db
        .from('media_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }) as { data: MediaItemRow[] | null; error: { message: string } | null }

      if (error) { console.error('[mediaStore] load:', error.message); return }
      if (!rows?.length) return

      // Create signed URLs (7 days) for each item
      const items: UploadedMedia[] = await Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from('media-items')
            .createSignedUrl(row.storage_path as string, 604800)

          const url = signed?.signedUrl ?? ''
          const isVideo = (row.type as string) === 'video'
          const ext = (row.storage_path as string).split('.').pop()?.toUpperCase() ?? ''

          const meta = isVideo
            ? `${ext} · ${fmtDur(row.duration_sec as number ?? 0)}`
            : row.width && row.height
              ? `${ext} · ${row.width}×${row.height}`
              : ext

          const thumbUrl = isVideo ? await grabVideoThumbnail(url) : url

          return {
            id: `db-${row.id as string}`,
            dbId: row.id as string,
            storagePath: row.storage_path as string,
            name: row.name as string,
            type: row.type as 'image' | 'video',
            url,
            thumbnailUrl: thumbUrl,
            meta,
            favorite: row.favorite as boolean,
          }
        })
      )

      // Merge: keep locally-added items that haven't finished uploading yet,
      // replace any that now have a dbId match
      set(s => {
        const dbIds = new Set(items.map(i => i.dbId))
        const localOnly = s.items.filter(i => !i.dbId || !dbIds.has(i.dbId))
        return { items: [...items, ...localOnly] }
      })
    } finally {
      set({ loading: false })
    }
  },

  removeItem(id) {
    const item = get().items.find(i => i.id === id)
    if (!item) return

    // Revoke object URL if local
    if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url)
    if (item.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(item.thumbnailUrl)

    // Remove from local state immediately
    set(s => ({ items: s.items.filter(i => i.id !== id) }))

    // Clean up Supabase in background
    if (item.dbId && supabaseConfigured) {
      db.from('media_items').delete().eq('id', item.dbId)
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('[mediaStore] delete row:', error.message) })

      if (item.storagePath) {
        supabase.storage.from('media-items').remove([item.storagePath])
          .then(({ error }) => { if (error) console.error('[mediaStore] delete file:', error.message) })
      }
    }
  },

  toggleFavorite(id) {
    const item = get().items.find(i => i.id === id)
    if (!item) return
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i) }))
    // Sync favorite to DB
    if (item.dbId && supabaseConfigured) {
      db.from('media_items')
        .update({ favorite: !item.favorite })
        .eq('id', item.dbId)
        .then(({ error }: { error: { message: string } | null }) => { if (error) console.error('[mediaStore] toggle fav:', error.message) })
    }
  },

  clear() {
    get().items.forEach(i => {
      if (i.url.startsWith('blob:')) URL.revokeObjectURL(i.url)
      if (i.thumbnailUrl?.startsWith('blob:')) URL.revokeObjectURL(i.thumbnailUrl)
    })
    set({ items: [] })
  },
}))

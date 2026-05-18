import { create } from 'zustand'

export interface UploadedMedia {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  thumbnailUrl: string | null   // for video: first-frame canvas data URL
  meta: string                  // e.g. "PNG · 1920×1080" or "MP4 · 0:15"
  favorite: boolean
}

function generateId() {
  return `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function buildMediaItem(file: File): Promise<UploadedMedia> {
  const url = URL.createObjectURL(file)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
  const ext = (file.name.split('.').pop() ?? '').toUpperCase()

  if (isVideo) {
    const thumbUrl = await grabVideoThumbnail(url)
    const duration = await getVideoDuration(url)
    return {
      id: generateId(), name: file.name, type: 'video', url,
      thumbnailUrl: thumbUrl,
      meta: `${ext} · ${fmtDur(duration)}`,
      favorite: false,
    }
  }

  // Image: get dimensions
  const dims = await getImageDimensions(url)
  return {
    id: generateId(), name: file.name, type: 'image', url,
    thumbnailUrl: url,
    meta: dims ? `${ext} · ${dims.w}×${dims.h}` : ext,
    favorite: false,
  }
}

function getImageDimensions(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function getVideoDuration(url: string): Promise<number> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.src = url
    v.preload = 'metadata'
    v.onloadedmetadata = () => resolve(v.duration || 0)
    v.onerror = () => resolve(0)
  })
}

function grabVideoThumbnail(url: string): Promise<string | null> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.src = url
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.crossOrigin = 'anonymous'
    v.currentTime = 0.5

    const done = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(v, 0, 0, 160, 90)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        resolve(null)
      }
    }

    v.onseeked = done
    v.onerror = () => resolve(null)
    // Fallback: attempt seek on loadeddata
    v.onloadeddata = () => { if (v.readyState >= 2) done() }
  })
}

interface MediaState {
  items: UploadedMedia[]
  addFiles(files: File[]): Promise<void>
  removeItem(id: string): void
  toggleFavorite(id: string): void
  clear(): void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  items: [],

  async addFiles(files) {
    const newItems = await Promise.all(files.map(buildMediaItem))
    set(s => ({ items: [...s.items, ...newItems] }))
  },

  removeItem(id) {
    const item = get().items.find(i => i.id === id)
    if (item) {
      URL.revokeObjectURL(item.url)
      if (item.thumbnailUrl && item.thumbnailUrl !== item.url && !item.thumbnailUrl.startsWith('data:')) {
        URL.revokeObjectURL(item.thumbnailUrl)
      }
    }
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },

  toggleFavorite(id) {
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, favorite: !i.favorite } : i) }))
  },

  clear() {
    get().items.forEach(i => {
      URL.revokeObjectURL(i.url)
      if (i.thumbnailUrl && i.thumbnailUrl !== i.url && !i.thumbnailUrl.startsWith('data:')) {
        URL.revokeObjectURL(i.thumbnailUrl)
      }
    })
    set({ items: [] })
  },
}))

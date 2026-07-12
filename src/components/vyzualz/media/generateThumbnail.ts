// Browser-side thumbnail and filmstrip generation with stable, bounded caches.
// Cache identities must be user + stable media id/storage path, never signed URLs.

import { BoundedLruCache } from '../../../lib/boundedLru'

export interface ThumbnailResult {
  thumbnailObjectUrl: string | null
  width: number
  height: number
  duration?: number
  analyzedAt: number
}

const THUMB_W = 200
const THUMB_H = 112
export const MAX_FILMSTRIP_FRAMES = 8
export const MAX_GENERATED_THUMBNAILS = 64
export const MAX_FILMSTRIP_CACHE_ENTRIES = 24

const thumbnailCache = new BoundedLruCache<string, ThumbnailResult>({ maxEntries: MAX_GENERATED_THUMBNAILS })
const thumbnailPending = new Map<string, Promise<ThumbnailResult>>()
const filmstripCache = new BoundedLruCache<string, string[]>({ maxEntries: MAX_FILMSTRIP_CACHE_ENTRIES })
const filmstripPending = new Map<string, Promise<string[]>>()

function drawToDataUrl(
  source: HTMLImageElement | HTMLVideoElement,
  naturalW: number,
  naturalH: number,
): string | null {
  try {
    const aspect = naturalW > 0 && naturalH > 0 ? naturalW / naturalH : 16 / 9
    let tw = THUMB_W
    let th = Math.round(THUMB_W / aspect)
    if (th > THUMB_H) { th = THUMB_H; tw = Math.round(THUMB_H * aspect) }
    tw = Math.max(1, tw); th = Math.max(1, th)
    const canvas = document.createElement('canvas')
    canvas.width = tw; canvas.height = th
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(source, 0, 0, tw, th)
    return canvas.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

export function generateImageThumbnail(url: string): Promise<ThumbnailResult> {
  const analyzedAt = Date.now()
  return new Promise(resolve => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      resolve({ thumbnailObjectUrl: drawToDataUrl(image, width, height), width, height, analyzedAt })
    }
    image.onerror = () => resolve({ thumbnailObjectUrl: null, width: 0, height: 0, analyzedAt })
    image.src = url
  })
}

export function generateVideoThumbnail(url: string): Promise<ThumbnailResult> {
  const analyzedAt = Date.now()
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    let settled = false
    const timer = setTimeout(() => finish({ thumbnailObjectUrl: null, width: 0, height: 0, analyzedAt }), 8000)
    const finish = (result: ThumbnailResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.onerror = null; video.onloadedmetadata = null; video.onseeked = null
      video.src = ''
      video.load()
      resolve(result)
    }

    video.onerror = () => finish({ thumbnailObjectUrl: null, width: 0, height: 0, analyzedAt })
    video.onloadedmetadata = () => {
      const duration = isFinite(video.duration) ? video.duration : undefined
      const width = video.videoWidth
      const height = video.videoHeight
      const seekTo = duration && duration > 0 ? Math.min(duration * 0.1, 0.5) : 0.5
      video.onseeked = () => finish({
        thumbnailObjectUrl: drawToDataUrl(video, width || 160, height || 90),
        width,
        height,
        duration,
        analyzedAt,
      })
      video.currentTime = seekTo
    }
    video.src = url
  })
}

export function generateThumbnail(
  url: string,
  type: 'image' | 'video',
  stableCacheKey = url,
): Promise<ThumbnailResult> {
  const cached = thumbnailCache.get(stableCacheKey)
  if (cached) return Promise.resolve(cached)
  const pending = thumbnailPending.get(stableCacheKey)
  if (pending) return pending
  const promise = (type === 'video' ? generateVideoThumbnail(url) : generateImageThumbnail(url)).then(result => {
    thumbnailPending.delete(stableCacheKey)
    if (result.thumbnailObjectUrl) thumbnailCache.set(stableCacheKey, result)
    return result
  }, error => {
    thumbnailPending.delete(stableCacheKey)
    throw error
  })
  thumbnailPending.set(stableCacheKey, promise)
  return promise
}

function extractFilmstripFrames(
  url: string,
  count: number,
  inSec: number,
  outSec: number | undefined,
): Promise<string[]> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.crossOrigin = 'anonymous'

    let settled = false
    const finish = (frames: string[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.onerror = null; video.onloadedmetadata = null; video.onseeked = null
      video.src = ''; video.load()
      resolve(frames)
    }
    const timer = setTimeout(() => finish([]), 12_000)
    video.onerror = () => finish([])
    video.onloadedmetadata = () => {
      const fullDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      const start = Math.max(0, inSec)
      const end = outSec !== undefined ? Math.min(outSec, fullDuration) : fullDuration
      const duration = Math.max(0.1, end - start)
      const frameTotal = Math.min(MAX_FILMSTRIP_FRAMES, Math.max(1, count))
      const width = video.videoWidth || 160
      const height = video.videoHeight || 90
      const frames: string[] = []
      const seekNext = (index: number) => {
        if (index >= frameTotal) { finish(frames); return }
        video.onseeked = () => {
          const dataUrl = drawToDataUrl(video, width, height)
          if (dataUrl) frames.push(dataUrl)
          seekNext(index + 1)
        }
        video.currentTime = start + ((index + 0.5) / frameTotal) * duration
      }
      seekNext(0)
    }
    video.src = url
  })
}

function filmstripKey(stableCacheKey: string, inSec: number, outSec: number | undefined): string {
  return `${stableCacheKey}\u0000${inSec},${outSec ?? ''}`
}

export function generateVideoFilmstrip(
  url: string,
  frameCount = 4,
  inSec = 0,
  outSec?: number,
  stableCacheKey = url,
): Promise<string[]> {
  const key = filmstripKey(stableCacheKey, inSec, outSec)
  const cached = filmstripCache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = filmstripPending.get(key)
  if (pending) return pending
  const promise = extractFilmstripFrames(url, frameCount, inSec, outSec).then(frames => {
    filmstripPending.delete(key)
    if (frames.length > 0) filmstripCache.set(key, frames)
    return frames
  }, error => {
    filmstripPending.delete(key)
    throw error
  })
  filmstripPending.set(key, promise)
  return promise
}

export function clearFilmstripCache(stableCacheKey: string): void {
  const prefix = `${stableCacheKey}\u0000`
  filmstripCache.deleteWhere((_frames, key) => key.startsWith(prefix))
  for (const key of Array.from(filmstripPending.keys())) {
    if (key.startsWith(prefix)) filmstripPending.delete(key)
  }
}

export function clearGeneratedThumbnailCache(stableCacheKey: string): void {
  thumbnailCache.delete(stableCacheKey)
  thumbnailPending.delete(stableCacheKey)
}

export function clearMediaGenerationCaches(stablePrefix?: string): void {
  if (!stablePrefix) {
    thumbnailCache.clear()
    filmstripCache.clear()
    thumbnailPending.clear()
    filmstripPending.clear()
    return
  }
  thumbnailCache.deleteWhere((_result, key) => key.startsWith(stablePrefix))
  filmstripCache.deleteWhere((_frames, key) => key.startsWith(stablePrefix))
  for (const key of Array.from(thumbnailPending.keys())) if (key.startsWith(stablePrefix)) thumbnailPending.delete(key)
  for (const key of Array.from(filmstripPending.keys())) if (key.startsWith(stablePrefix)) filmstripPending.delete(key)
}

export function getMediaGenerationCacheStats(): { thumbnails: number; filmstrips: number } {
  return { thumbnails: thumbnailCache.size, filmstrips: filmstripCache.size }
}

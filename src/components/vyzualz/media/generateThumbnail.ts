// Lightweight thumbnail generation and metadata extraction.
// Works entirely in the browser without blocking the UI.
// Falls back gracefully on CORS failures or decode errors.

export interface ThumbnailResult {
  thumbnailObjectUrl: string | null  // data URL (jpeg), or original URL for small images
  width:   number
  height:  number
  duration?: number  // seconds; videos only
  analyzedAt: number // Date.now() snapshot
}

const THUMB_W = 200
const THUMB_H = 112  // 16:9 target

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
    const c = document.createElement('canvas')
    c.width = tw; c.height = th
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, tw, th)
    return c.toDataURL('image/jpeg', 0.75)
  } catch {
    return null
  }
}

export function generateImageThumbnail(url: string): Promise<ThumbnailResult> {
  const analyzedAt = Date.now()
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight
      // Skip canvas round-trip for small images — original URL is fine as-is
      if (w <= THUMB_W * 2 && h <= THUMB_H * 2) {
        resolve({ thumbnailObjectUrl: url, width: w, height: h, analyzedAt })
        return
      }
      const dataUrl = drawToDataUrl(img, w, h)
      resolve({ thumbnailObjectUrl: dataUrl ?? url, width: w, height: h, analyzedAt })
    }
    img.onerror = () => resolve({ thumbnailObjectUrl: null, width: 0, height: 0, analyzedAt })
    img.src = url
  })
}

export function generateVideoThumbnail(url: string): Promise<ThumbnailResult> {
  const analyzedAt = Date.now()
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.crossOrigin = 'anonymous'

    let settled = false
    const done = (result: ThumbnailResult) => {
      if (settled) return
      settled = true
      v.onerror = null; v.onloadedmetadata = null; v.onseeked = null
      v.src = ''
      v.load()
      resolve(result)
    }
    const fail = () => done({ thumbnailObjectUrl: null, width: 0, height: 0, analyzedAt })

    // Hard timeout so we never block the caller indefinitely
    const timer = setTimeout(fail, 8000)

    v.onerror = fail
    v.onloadedmetadata = () => {
      const duration = isFinite(v.duration) ? v.duration : undefined
      const w = v.videoWidth, h = v.videoHeight
      // Seek to 10% of duration or 0.5 s, whichever is smaller, avoiding seek to 0
      const seekTo = duration && duration > 0 ? Math.min(duration * 0.1, 0.5) : 0.5
      v.onseeked = () => {
        clearTimeout(timer)
        const dataUrl = drawToDataUrl(v, w || 160, h || 90)
        done({ thumbnailObjectUrl: dataUrl, width: w, height: h, duration, analyzedAt })
      }
      v.onerror = () => { clearTimeout(timer); fail() }
      v.currentTime = seekTo
    }

    v.src = url
  })
}

export function generateThumbnail(url: string, type: 'image' | 'video'): Promise<ThumbnailResult> {
  return type === 'video' ? generateVideoThumbnail(url) : generateImageThumbnail(url)
}

// ── Video filmstrip ────────────────────────────────────────────────────────────
// Extracts N evenly-spaced frames from a video and caches them by URL.
// Frames are data URLs (no revocation needed). Cache persists for the session.

export const MAX_FILMSTRIP_FRAMES = 8

const filmstripCache   = new Map<string, string[]>()
const filmstripPending = new Map<string, Promise<string[]>>()

function extractFilmstripFrames(
  url: string, count: number, inSec: number, outSec: number | undefined,
): Promise<string[]> {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.crossOrigin = 'anonymous'

    let settled = false
    const finish = (frames: string[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      v.onerror = null; v.onloadedmetadata = null; v.onseeked = null
      v.src = ''; v.load()
      resolve(frames)
    }

    // Hard timeout to prevent indefinite hang on problematic videos
    const timer = setTimeout(() => finish([]), 12_000)

    v.onerror = () => finish([])

    v.onloadedmetadata = () => {
      const fullDur = isFinite(v.duration) && v.duration > 0 ? v.duration : 1
      // Clamp sampling range to [inSec, outSec] so frames reflect the trimmed region
      const start = Math.max(0, inSec)
      const end   = outSec !== undefined ? Math.min(outSec, fullDur) : fullDur
      const dur   = Math.max(0.1, end - start)
      const N     = Math.min(MAX_FILMSTRIP_FRAMES, Math.max(1, count))
      const W     = v.videoWidth  || 160
      const H     = v.videoHeight || 90
      const frames: string[] = []

      const seekNext = (i: number) => {
        if (i >= N) { finish(frames); return }
        v.onseeked = () => {
          const dataUrl = drawToDataUrl(v, W, H)
          if (dataUrl) frames.push(dataUrl)
          seekNext(i + 1)
        }
        // Sample from the middle of each equal-length segment within the trim range
        v.currentTime = start + ((i + 0.5) / N) * dur
      }
      seekNext(0)
    }

    v.src = url
  })
}

// Cache key includes trim bounds so the same video trimmed differently gets separate entries.
// Null character (U+0000) is used as separator — it cannot appear in any valid URL.
function filmstripKey(url: string, inSec: number, outSec: number | undefined): string {
  return (inSec > 0 || outSec !== undefined) ? `${url}\x00${inSec},${outSec ?? ''}` : url
}

/** Returns an array of frame data URLs for a video, cached by URL + trim range. */
export function generateVideoFilmstrip(
  url: string, frameCount = 4, inSec = 0, outSec?: number,
): Promise<string[]> {
  const key = filmstripKey(url, inSec, outSec)

  const cached = filmstripCache.get(key)
  if (cached) return Promise.resolve(cached)

  // Deduplicate concurrent calls for the same key
  const pending = filmstripPending.get(key)
  if (pending) return pending

  const promise = extractFilmstripFrames(url, frameCount, inSec, outSec).then(frames => {
    filmstripPending.delete(key)
    filmstripCache.set(key, frames)
    return frames
  })
  filmstripPending.set(key, promise)
  return promise
}

/** Remove all cached filmstrip entries for a URL (all trim variants). */
export function clearFilmstripCache(url: string): void {
  const prefix = url + '\x00'
  for (const key of filmstripCache.keys()) {
    if (key === url || key.startsWith(prefix)) filmstripCache.delete(key)
  }
  for (const key of filmstripPending.keys()) {
    if (key === url || key.startsWith(prefix)) filmstripPending.delete(key)
  }
}

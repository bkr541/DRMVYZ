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

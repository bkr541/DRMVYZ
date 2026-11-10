// The picture or video behind the performer in Virtual Backdrop. The left window's Media tab chooses a library
// item; this loads it (same cross-origin-safe way the other engines load library media) and hands the effect
// something it can draw. Until it is ready the effect shows its backdrop colour, so the program never goes blank.

export type HeadlinerBackdropKind = 'image' | 'video'

export interface HeadlinerBackdropMedia {
  id: string
  url: string
  kind: HeadlinerBackdropKind
  /** Changes when the same item gets a new (e.g. re-signed) URL. */
  revision: string
}

export interface HeadlinerBackdropFrame {
  source: CanvasImageSource
  width: number
  height: number
}

interface LoadedBackdrop {
  key: string
  element: HTMLImageElement | HTMLVideoElement
  ready: boolean
}

export class HeadlinerBackdropLoader {
  private current: LoadedBackdrop | null = null

  /** Loads `media` (or clears with null). Calling again with the same item and revision does nothing. */
  setMedia(media: HeadlinerBackdropMedia | null): void {
    const key = media ? `${media.id}|${media.revision}|${media.url}` : ''
    if ((this.current?.key ?? '') === key) return
    this.retire()
    if (!media || typeof document === 'undefined') return

    if (media.kind === 'video') {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.preload = 'auto'
      video.muted = true
      video.loop = true
      video.playsInline = true
      const entry: LoadedBackdrop = { key, element: video, ready: false }
      video.addEventListener('loadeddata', () => {
        if (this.current !== entry) return
        entry.ready = true
        void video.play().catch(() => undefined)
      }, { once: true })
      this.current = entry
      video.src = media.url
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    const entry: LoadedBackdrop = { key, element: image, ready: false }
    image.addEventListener('load', () => { if (this.current === entry) entry.ready = true }, { once: true })
    this.current = entry
    image.src = media.url
  }

  /** The drawable backdrop, or null while nothing is chosen or it is still loading (or failed to load). */
  getFrame(): HeadlinerBackdropFrame | null {
    const entry = this.current
    if (!entry?.ready) return null
    const element = entry.element
    if (element instanceof HTMLVideoElement) {
      if (element.readyState < 2 || element.videoWidth <= 0 || element.videoHeight <= 0) return null
      return { source: element, width: element.videoWidth, height: element.videoHeight }
    }
    if (element.naturalWidth <= 0 || element.naturalHeight <= 0) return null
    return { source: element, width: element.naturalWidth, height: element.naturalHeight }
  }

  dispose(): void {
    this.retire()
  }

  private retire(): void {
    const entry = this.current
    this.current = null
    if (!entry) return
    if (entry.element instanceof HTMLVideoElement) {
      entry.element.pause()
      entry.element.removeAttribute('src')
      entry.element.load()
    } else {
      entry.element.src = ''
    }
  }
}

/** Where a picture of `source` size lands on a `target` canvas: fill the frame (crop) or fit inside it (bars). */
export function fitBackdrop(
  source: { width: number; height: number },
  target: { width: number; height: number },
  fit: 'cover' | 'contain',
): { x: number; y: number; width: number; height: number } {
  const scale = fit === 'contain'
    ? Math.min(target.width / source.width, target.height / source.height)
    : Math.max(target.width / source.width, target.height / source.height)
  const width = source.width * scale
  const height = source.height * scale
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height }
}

import type { UploadedMedia } from '../../../../../stores/mediaStore'

export type MediaPortalStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'unsupported' | 'error'
export interface MediaPortalResolvedSource {
  status: MediaPortalStatus
  media: UploadedMedia | null
  element: HTMLImageElement | HTMLVideoElement | null
  message: string | null
}

const SUPPORTED_IMAGE = /^(image\/(png|jpeg|jpg|webp|gif|svg\+xml))$/i
const SUPPORTED_VIDEO = /^(video\/(mp4|webm|quicktime|x-matroska))$/i

export function isSupportedMediaPortalSource(media: UploadedMedia): boolean {
  const mime = media.mimeType ?? ''
  if (media.type === 'image') return mime ? SUPPORTED_IMAGE.test(mime) : /\.(png|jpe?g|webp|gif|svg)$/i.test(media.name)
  if (media.type === 'video') return mime ? SUPPORTED_VIDEO.test(mime) : /\.(mp4|webm|mov|mkv)$/i.test(media.name)
  return false
}

export function normalizeDurableMediaReference(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const ref = value.trim()
  if (!ref || /^(blob:|data:)/i.test(ref)) return null
  return ref
}

export class MediaPortalSourceManager {
  private generation = 0
  private element: HTMLImageElement | HTMLVideoElement | null = null
  private listeners: Array<() => void> = []
  private ownedObjectUrl: string | null = null
  private stream: MediaStream | null = null
  private pendingResolve: ((value: MediaPortalResolvedSource) => void) | null = null

  async load(media: UploadedMedia | null, options: { loop: boolean; muted: boolean }): Promise<MediaPortalResolvedSource> {
    const generation = ++this.generation
    this.cleanupElement()
    if (!media) return { status: 'missing', media: null, element: null, message: 'Media is missing. Relink a source asset.' }
    if (!isSupportedMediaPortalSource(media)) {
      return { status: 'unsupported', media, element: null, message: `Unsupported Media Portal source: ${media.name}` }
    }
    if (!media.url) return { status: 'missing', media, element: null, message: `Source file is unavailable: ${media.name}` }

    const element = media.type === 'video' ? document.createElement('video') : new Image()
    this.element = element
    if (element instanceof HTMLVideoElement) {
      element.crossOrigin = 'anonymous'
      element.preload = 'auto'
      element.playsInline = true
      element.loop = options.loop
      element.muted = options.muted
    } else element.crossOrigin = 'anonymous'

    return new Promise(resolve => {
      this.pendingResolve = resolve
      const finish = (result: MediaPortalResolvedSource) => {
        this.pendingResolve = null
        if (generation !== this.generation) {
          resolve({ status: 'error', media, element: null, message: 'Stale media load ignored.' })
          return
        }
        resolve(result)
      }
      const ready = () => finish({ status: 'ready', media, element, message: null })
      const failed = () => finish({ status: 'error', media, element: null, message: `Could not load media: ${media.name}` })
      const readyEvent = element instanceof HTMLVideoElement ? 'loadeddata' : 'load'
      element.addEventListener(readyEvent, ready, { once: true })
      element.addEventListener('error', failed, { once: true })
      this.listeners.push(
        () => element.removeEventListener(readyEvent, ready),
        () => element.removeEventListener('error', failed),
      )
      element.src = media.url
      if (element instanceof HTMLVideoElement) element.load()
    })
  }

  setOwnedObjectUrl(url: string | null): void { this.ownedObjectUrl = url }
  setLiveStream(stream: MediaStream | null): void { this.stream = stream }
  invalidate(): void { this.generation += 1 }
  dispose(): void { this.generation += 1; this.cleanupElement() }

  private cleanupElement(): void {
    if (this.pendingResolve) {
      this.pendingResolve({ status: 'error', media: null, element: null, message: 'Stale media load ignored.' })
      this.pendingResolve = null
    }
    for (const remove of this.listeners.splice(0)) remove()
    if (typeof HTMLVideoElement !== 'undefined' && this.element instanceof HTMLVideoElement) {
      this.element.pause()
      this.element.removeAttribute('src')
      this.element.load()
    } else if (this.element) this.element.src = ''
    this.element = null
    if (this.ownedObjectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this.ownedObjectUrl)
    this.ownedObjectUrl = null
    if (this.stream) for (const track of this.stream.getTracks()) track.stop()
    this.stream = null
  }
}

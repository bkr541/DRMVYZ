import type { CanvasMediaItem } from '../ReactTypes'
import {
  MAX_CANVAS_ACTIVE_VIDEO_DECODERS,
  MAX_CANVAS_SHOW_VIDEO_DECODERS,
  MAX_CANVAS_MEDIA_HANDLES,
  MAX_CANVAS_PRELOAD_QUEUE,
  type CanvasMediaReadiness,
} from './CanvasPerformanceTypes'

export type CanvasPreloadHandle = HTMLVideoElement | HTMLImageElement

function isVideoPreloadHandle(handle: CanvasPreloadHandle | null): handle is HTMLVideoElement {
  if (!handle) return false
  if (typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement) return true
  return String((handle as { tagName?: string }).tagName ?? '').toUpperCase() === 'VIDEO'
}

function isImagePreloadHandle(handle: CanvasPreloadHandle | null): handle is HTMLImageElement {
  if (!handle) return false
  if (typeof HTMLImageElement !== 'undefined' && handle instanceof HTMLImageElement) return true
  return String((handle as { tagName?: string }).tagName ?? '').toUpperCase() === 'IMG'
}

/**
 * A preload is only ready when the compositor can draw the retained source.
 * Keep this contract shared with CanvasOrchestrationStage so readiness cannot
 * claim success for a missing/zero-dimension handle that the stage then skips.
 */
export function isCanvasPreloadHandleDrawable(handle: CanvasPreloadHandle | null): handle is CanvasPreloadHandle {
  if (isVideoPreloadHandle(handle)) {
    return handle.readyState >= 2 && handle.videoWidth > 0 && handle.videoHeight > 0
  }
  if (isImagePreloadHandle(handle)) {
    return handle.complete && handle.naturalWidth > 0 && handle.naturalHeight > 0
  }
  return false
}

const DEFAULT_CANVAS_PRELOAD_TIMEOUT_MS = 10_000

export interface CanvasPreloadRequest {
  media: CanvasMediaItem
  trackIdentity: string | null
  poolRevision: number
  priority: number
}

export type CanvasPreloadLoader = (
  media: CanvasMediaItem,
  signal: AbortSignal,
) => Promise<CanvasPreloadHandle | null>

interface QueueEntry extends CanvasPreloadRequest {
  order: number
  sourceKey: string
}

function getCanvasPreloadSourceKey(media: CanvasMediaItem): string {
  return `${media.type}:${media.mediaRevision ?? 0}:${media.objectUrl}`
}

function defaultCanvasPreloadLoader(media: CanvasMediaItem, signal: AbortSignal): Promise<CanvasPreloadHandle | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  if (media.type === 'video') {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      const cleanup = () => {
        video.removeEventListener('canplay', ready)
        video.removeEventListener('loadeddata', ready)
        video.removeEventListener('error', failed)
        signal.removeEventListener('abort', aborted)
      }
      const ready = () => { cleanup(); resolve(video) }
      const failed = () => { cleanup(); reject(new Error(`Unable to preload ${media.name}`)) }
      const aborted = () => {
        cleanup()
        video.pause()
        video.removeAttribute('src')
        video.load()
        reject(new DOMException('Preload cancelled', 'AbortError'))
      }
      video.addEventListener('canplay', ready, { once: true })
      video.addEventListener('loadeddata', ready, { once: true })
      video.addEventListener('error', failed, { once: true })
      signal.addEventListener('abort', aborted, { once: true })
      video.src = media.objectUrl
      video.load()
    })
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', aborted)
    }
    const aborted = () => {
      cleanup()
      image.src = ''
      reject(new DOMException('Preload cancelled', 'AbortError'))
    }
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error(`Unable to preload ${media.name}`)) }
    signal.addEventListener('abort', aborted, { once: true })
    image.src = media.objectUrl
  })
}

function releaseCanvasPreloadHandle(handle: CanvasPreloadHandle | null | undefined): void {
  if (!handle) return
  if (typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement) {
    handle.pause()
    handle.removeAttribute('src')
    handle.load()
  } else if (typeof HTMLImageElement !== 'undefined' && handle instanceof HTMLImageElement) {
    handle.src = ''
  }
}

export class CanvasPreloadManager {
  private readonly loader: CanvasPreloadLoader
  private readonly maxQueue: number
  private readonly maxHandles: number
  private maxVideoHandles: number
  private readonly preloadTimeoutMs: number
  private readonly readiness = new Map<string, CanvasMediaReadiness>()
  private readonly handles = new Map<string, { handle: CanvasPreloadHandle | null; lastUsedAt: number; type: CanvasMediaItem['type'] }>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly sourceKeys = new Map<string, string>()
  private queue: QueueEntry[] = []
  private order = 0
  private activeLoads = 0
  private trackIdentity: string | null = null
  private poolRevision = 0
  private disposed = false

  constructor(options: {
    loader?: CanvasPreloadLoader
    maxQueue?: number
    maxHandles?: number
    maxVideoHandles?: number
    preloadTimeoutMs?: number
  } = {}) {
    this.loader = options.loader ?? defaultCanvasPreloadLoader
    this.maxQueue = Math.max(1, Math.min(MAX_CANVAS_PRELOAD_QUEUE, options.maxQueue ?? MAX_CANVAS_PRELOAD_QUEUE))
    this.maxHandles = Math.max(1, Math.min(MAX_CANVAS_MEDIA_HANDLES, options.maxHandles ?? MAX_CANVAS_MEDIA_HANDLES))
    this.maxVideoHandles = Math.max(1, Math.min(MAX_CANVAS_SHOW_VIDEO_DECODERS, options.maxVideoHandles ?? MAX_CANVAS_ACTIVE_VIDEO_DECODERS))
    this.preloadTimeoutMs = Math.max(1, Math.round(options.preloadTimeoutMs ?? DEFAULT_CANVAS_PRELOAD_TIMEOUT_MS))
  }

  setMaxVideoHandles(maxVideoHandles: number): void {
    this.maxVideoHandles = Math.max(1, Math.min(MAX_CANVAS_SHOW_VIDEO_DECODERS, Math.round(maxVideoHandles)))
  }

  setScope(trackIdentity: string | null, poolRevision: number): void {
    if (this.trackIdentity === trackIdentity && this.poolRevision === poolRevision) return
    this.cancelPending('Scope changed')
    for (const entry of this.handles.values()) releaseCanvasPreloadHandle(entry.handle)
    this.handles.clear()
    this.readiness.clear()
    this.sourceKeys.clear()
    this.trackIdentity = trackIdentity
    this.poolRevision = poolRevision
  }

  /**
   * Reuse a source the direct CANVAS renderer has already decoded. This makes
   * the single-source -> authored-layer handoff atomic instead of waiting for a
   * second Image/video element to independently preload the exact same media.
   */
  adoptDrawableHandle(media: CanvasMediaItem, handle: CanvasPreloadHandle | null): boolean {
    if (this.disposed || !media.objectUrl || !isCanvasPreloadHandleDrawable(handle)) return false

    const sourceKey = getCanvasPreloadSourceKey(media)
    const previousSourceKey = this.sourceKeys.get(media.id)
    if (previousSourceKey && previousSourceKey !== sourceKey) this.invalidate(media.id)

    const existing = this.handles.get(media.id)
    if (existing?.handle && existing.handle !== handle) releaseCanvasPreloadHandle(existing.handle)

    // A queued duplicate is no longer useful. If the same source is already
    // loading, let it finish; the completion handlers below preserve this
    // adopted drawable instead of allowing a late failure to revoke readiness.
    this.queue = this.queue.filter(entry => entry.media.id !== media.id)
    this.sourceKeys.set(media.id, sourceKey)
    this.handles.set(media.id, { handle, lastUsedAt: Date.now(), type: media.type })
    this.readiness.set(media.id, {
      mediaId: media.id,
      status: 'ready',
      trackIdentity: this.trackIdentity,
      poolRevision: this.poolRevision,
      error: null,
    })
    this.enforceHandleBounds(new Set([media.id]))
    return true
  }

  request(requests: readonly CanvasPreloadRequest[]): void {
    if (this.disposed) return
    const accepted = requests
      .filter(request => request.media.objectUrl && request.trackIdentity === this.trackIdentity && request.poolRevision === this.poolRevision)
      .sort((a, b) => b.priority - a.priority || a.media.id.localeCompare(b.media.id))

    for (const request of accepted) {
      const sourceKey = getCanvasPreloadSourceKey(request.media)
      const previousSourceKey = this.sourceKeys.get(request.media.id)
      if (previousSourceKey && previousSourceKey !== sourceKey) {
        this.queue = this.queue.filter(entry => entry.media.id !== request.media.id)
        this.controllers.get(request.media.id)?.abort()
        const retained = this.handles.get(request.media.id)
        if (retained) releaseCanvasPreloadHandle(retained.handle)
        this.handles.delete(request.media.id)
        this.readiness.delete(request.media.id)
        this.sourceKeys.delete(request.media.id)
      }

      const existing = this.readiness.get(request.media.id)
      if (existing?.status === 'ready' || existing?.status === 'loading' || existing?.status === 'queued' || existing?.status === 'error') {
        const retained = this.handles.get(request.media.id)
        if (retained) retained.lastUsedAt = Date.now()
        continue
      }
      this.queue.push({ ...request, order: this.order++, sourceKey })
      this.sourceKeys.set(request.media.id, sourceKey)
      this.readiness.set(request.media.id, {
        mediaId: request.media.id,
        status: 'queued',
        trackIdentity: request.trackIdentity,
        poolRevision: request.poolRevision,
        error: null,
      })
    }

    this.queue.sort((a, b) => b.priority - a.priority || a.order - b.order)
    if (this.queue.length > this.maxQueue) {
      const dropped = this.queue.splice(this.maxQueue)
      dropped.forEach(entry => this.readiness.set(entry.media.id, {
        mediaId: entry.media.id,
        status: 'cancelled',
        trackIdentity: entry.trackIdentity,
        poolRevision: entry.poolRevision,
        error: 'Preload queue capacity reached',
      }))
    }
    this.pump()
  }

  private pump(): void {
    if (this.disposed) return
    while (this.activeLoads < 2 && this.queue.length > 0) {
      const entry = this.queue.shift()!
      if (entry.trackIdentity !== this.trackIdentity || entry.poolRevision !== this.poolRevision) {
        this.readiness.set(entry.media.id, {
          mediaId: entry.media.id,
          status: 'cancelled',
          trackIdentity: entry.trackIdentity,
          poolRevision: entry.poolRevision,
          error: 'Stale preload request',
        })
        continue
      }
      this.activeLoads += 1
      const controller = new AbortController()
      this.controllers.set(entry.media.id, controller)
      this.readiness.set(entry.media.id, {
        mediaId: entry.media.id,
        status: 'loading',
        trackIdentity: entry.trackIdentity,
        poolRevision: entry.poolRevision,
        error: null,
      })

      let timedOut = false
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(new Error(`Timed out preloading ${entry.media.name}`))
        }, this.preloadTimeoutMs)
      })

      void Promise.race([this.loader(entry.media, controller.signal), timeout]).then(handle => {
        const scopeIsCurrent = entry.trackIdentity === this.trackIdentity && entry.poolRevision === this.poolRevision
        const sourceIsCurrent = this.sourceKeys.get(entry.media.id) === entry.sourceKey
        if (controller.signal.aborted || !scopeIsCurrent || !sourceIsCurrent || this.disposed) {
          releaseCanvasPreloadHandle(handle)
          // A late completion from an old track or pool must never overwrite the
          // readiness state belonging to the replacement scope or refreshed URL.
          if (scopeIsCurrent && sourceIsCurrent && !this.disposed && !timedOut) {
            this.readiness.set(entry.media.id, {
              mediaId: entry.media.id,
              status: 'cancelled',
              trackIdentity: entry.trackIdentity,
              poolRevision: entry.poolRevision,
              error: 'Stale preload result rejected',
            })
          }
          return
        }
        if (!isCanvasPreloadHandleDrawable(handle)) {
          releaseCanvasPreloadHandle(handle)
          throw new Error(`Preloaded ${entry.media.name} without drawable ${entry.media.type === 'video' ? 'video' : 'image'} data`)
        }
        const adoptedHandle = this.handles.get(entry.media.id)?.handle ?? null
        if (this.getReadiness(entry.media.id).status === 'ready' && isCanvasPreloadHandleDrawable(adoptedHandle)) {
          if (handle !== adoptedHandle) releaseCanvasPreloadHandle(handle)
          return
        }
        this.handles.set(entry.media.id, { handle, lastUsedAt: Date.now(), type: entry.media.type })
        this.readiness.set(entry.media.id, {
          mediaId: entry.media.id,
          status: 'ready',
          trackIdentity: entry.trackIdentity,
          poolRevision: entry.poolRevision,
          error: null,
        })
        this.enforceHandleBounds(new Set([entry.media.id]))
      }).catch(error => {
        const scopeIsCurrent = entry.trackIdentity === this.trackIdentity && entry.poolRevision === this.poolRevision
        const sourceIsCurrent = this.sourceKeys.get(entry.media.id) === entry.sourceKey
        if (!scopeIsCurrent || !sourceIsCurrent || this.disposed) return
        // A direct-renderer handle may have been adopted while this duplicate
        // request was in flight. Never let a late preload failure demote a
        // source that the compositor can already draw.
        if (this.isReady(entry.media.id)) return
        const cancelled = !timedOut && (controller.signal.aborted || error?.name === 'AbortError')
        const errorMessage = timedOut
          ? `Timed out preloading ${entry.media.name}`
          : error instanceof Error
            ? error.message
            : 'Preload failed'
        this.readiness.set(entry.media.id, {
          mediaId: entry.media.id,
          status: cancelled ? 'cancelled' : 'error',
          trackIdentity: entry.trackIdentity,
          poolRevision: entry.poolRevision,
          error: cancelled ? 'Preload cancelled' : errorMessage,
        })
      }).finally(() => {
        if (timeoutId) clearTimeout(timeoutId)
        if (this.controllers.get(entry.media.id) === controller) this.controllers.delete(entry.media.id)
        this.activeLoads = Math.max(0, this.activeLoads - 1)
        this.pump()
      })
    }
  }

  getReadiness(mediaId: string): CanvasMediaReadiness {
    return this.readiness.get(mediaId) ?? {
      mediaId,
      status: 'idle',
      trackIdentity: this.trackIdentity,
      poolRevision: this.poolRevision,
      error: null,
    }
  }

  isReady(mediaId: string): boolean {
    if (this.getReadiness(mediaId).status !== 'ready') return false
    return isCanvasPreloadHandleDrawable(this.handles.get(mediaId)?.handle ?? null)
  }

  getHandle(mediaId: string): CanvasPreloadHandle | null {
    const entry = this.handles.get(mediaId)
    if (!entry) return null
    entry.lastUsedAt = Date.now()
    return entry.handle
  }

  /** Clear one retained/error source so an explicit URL refresh can be retried even when the signed URL string is unchanged. */
  invalidate(mediaId: string): void {
    this.queue = this.queue.filter(entry => entry.media.id !== mediaId)
    this.controllers.get(mediaId)?.abort()
    this.controllers.delete(mediaId)
    const retained = this.handles.get(mediaId)
    if (retained) releaseCanvasPreloadHandle(retained.handle)
    this.handles.delete(mediaId)
    this.readiness.delete(mediaId)
    this.sourceKeys.delete(mediaId)
  }

  retainOnly(mediaIds: readonly string[]): void {
    const retain = new Set(mediaIds)
    // Video elements own decoder resources even when the global handle budget has
    // spare capacity. Retire inactive videos immediately; images may remain in
    // the bounded LRU cache because they do not consume a decoder.
    for (const [mediaId, entry] of this.handles) {
      if (retain.has(mediaId) || entry.type !== 'video') continue
      releaseCanvasPreloadHandle(entry.handle)
      this.handles.delete(mediaId)
      this.readiness.delete(mediaId)
      this.sourceKeys.delete(mediaId)
    }
    this.enforceHandleBounds(retain)
  }

  private enforceHandleBounds(retain: ReadonlySet<string>): void {
    const entries = [...this.handles.entries()].sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)
    let videoCount = entries.filter(([, entry]) => entry.type === 'video').length
    let totalCount = entries.length
    for (const [mediaId, entry] of entries) {
      if (retain.has(mediaId)) continue
      if (totalCount <= this.maxHandles && (entry.type !== 'video' || videoCount <= this.maxVideoHandles)) continue
      releaseCanvasPreloadHandle(entry.handle)
      this.handles.delete(mediaId)
      this.readiness.delete(mediaId)
      this.sourceKeys.delete(mediaId)
      totalCount -= 1
      if (entry.type === 'video') videoCount -= 1
    }
  }

  cancelPending(reason = 'Preload cancelled'): void {
    this.queue.splice(0).forEach(entry => this.readiness.set(entry.media.id, {
      mediaId: entry.media.id,
      status: 'cancelled',
      trackIdentity: entry.trackIdentity,
      poolRevision: entry.poolRevision,
      error: reason,
    }))
    for (const [mediaId, controller] of this.controllers) {
      controller.abort()
      const state = this.readiness.get(mediaId)
      this.readiness.set(mediaId, {
        mediaId,
        status: 'cancelled',
        trackIdentity: state?.trackIdentity ?? this.trackIdentity,
        poolRevision: state?.poolRevision ?? this.poolRevision,
        error: reason,
      })
    }
    this.controllers.clear()
  }

  releaseAll(): void {
    this.cancelPending('Resources released')
    for (const entry of this.handles.values()) releaseCanvasPreloadHandle(entry.handle)
    this.handles.clear()
    this.readiness.clear()
    this.sourceKeys.clear()
  }

  dispose(): void {
    this.disposed = true
    this.releaseAll()
  }

  getSnapshot(): { queued: number; loading: number; ready: number; handles: number; videoHandles: number } {
    return {
      queued: this.queue.length,
      loading: this.activeLoads,
      ready: [...this.readiness.values()].filter(item => item.status === 'ready').length,
      handles: this.handles.size,
      videoHandles: [...this.handles.values()].filter(entry => entry.type === 'video').length,
    }
  }
}

export function buildCanvasPreloadRequests({
  mediaItems,
  activeMediaIds,
  candidateMediaIds,
  trackIdentity,
  poolRevision,
}: {
  mediaItems: readonly CanvasMediaItem[]
  activeMediaIds: readonly string[]
  candidateMediaIds: readonly string[]
  trackIdentity: string | null
  poolRevision: number
}): CanvasPreloadRequest[] {
  const byId = new Map(mediaItems.map(item => [item.id, item]))
  const active = new Set(activeMediaIds)
  const ordered = [...activeMediaIds, ...candidateMediaIds.filter(id => !active.has(id))]
  return [...new Set(ordered)].slice(0, MAX_CANVAS_PRELOAD_QUEUE).flatMap((mediaId, index) => {
    const media = byId.get(mediaId)
    return media ? [{ media, trackIdentity, poolRevision, priority: active.has(mediaId) ? 100 - index : 50 - index }] : []
  })
}

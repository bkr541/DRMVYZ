import { useEffect, useRef, type RefObject } from 'react'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { useMediaStore } from '../../../../../stores/mediaStore'
import type { CanvasMediaItem, CanvasPresetSettings } from '../../ReactTypes'
import { CanvasPreloadManager, isCanvasPreloadHandleDrawable, type CanvasPreloadHandle } from '../../canvasPerformance/CanvasPreloadManager'
import { MAX_CANVAS_ACTIVE_VIDEO_DECODERS, type CanvasMediaPool } from '../../canvasPerformance/CanvasPerformanceTypes'
import { composeCutbankFrame, releaseCutbankComposeScratch, type CutbankDrawable } from './CutbankCompose'
import { CutbankRuntime } from './CutbankRuntime'
import { CutbankTreatPass } from './CutbankTreatPass'
import { cutbankUnit } from './CutbankRandom'

const MAX_RENDER_WIDTH = 1600
const MAX_SIGN_REQUEST = 32
const SNAPSHOT_INTERVAL_MS = 30

function measureSvgLuma(image: HTMLImageElement): number | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, 32, 32)
    const data = ctx.getImageData(0, 0, 32, 32).data
    let sum = 0
    let weight = 0
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      if (a < 0.2) continue
      sum += ((data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255) * a
      weight += a
    }
    canvas.width = 0
    canvas.height = 0
    return weight > 0 ? sum / weight : null
  } catch {
    return null
  }
}

/**
 * CUTBANK's dedicated CANVAS renderer layer. It owns every resource it
 * creates (GL pass, compose canvas, preload manager, RAF loop, listeners) and
 * releases all of it on unmount or when the preset is left. Inputs that change
 * during playback flow in through refs so the loop is created exactly once.
 */
export function CanvasCutbankLayer({
  active,
  settings,
  pool,
  poolRevision,
  mediaItems,
  trackIdentity,
  getAudioTime,
  performanceContextRef,
  audioActive,
  onCanvasReady,
  onStatusChange,
}: {
  active: boolean
  settings: CanvasPresetSettings
  pool: CanvasMediaPool | null
  poolRevision: number
  mediaItems: readonly CanvasMediaItem[]
  trackIdentity: string | null
  getAudioTime?: () => number
  performanceContextRef: RefObject<SharedPerformanceContext | null>
  /** True while the shared transport (or live input) is producing audio time. */
  audioActive: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onStatusChange?: (message: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const live = useRef({ settings, pool, poolRevision, mediaItems, trackIdentity, getAudioTime, audioActive })
  live.current = { settings, pool, poolRevision, mediaItems, trackIdentity, getAudioTime, audioActive }
  const callbacks = useRef({ onCanvasReady, onStatusChange })
  callbacks.current = { onCanvasReady, onStatusChange }

  // Ask the shared library to sign this Pool's media (bounded); unsigned items are invisible to CANVAS.
  const signKey = pool ? `${pool.id}:${pool.mediaIds.slice(0, MAX_SIGN_REQUEST).join(',')}` : ''
  useEffect(() => {
    if (!active || !pool || pool.mediaIds.length === 0) return
    void useMediaStore.getState().ensureMediaSigned(pool.mediaIds.slice(0, MAX_SIGN_REQUEST), 'visible')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, signKey])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const created = CutbankTreatPass.create(canvas)
    if (!created.pass) {
      callbacks.current.onCanvasReady?.(null)
      callbacks.current.onStatusChange?.(`${created.error ?? 'CUTBANK could not initialize'}.`)
      return () => {
        callbacks.current.onCanvasReady?.(null)
        callbacks.current.onStatusChange?.(null)
      }
    }
    const pass = created.pass
    const runtime = new CutbankRuntime()
    const preload = new CanvasPreloadManager({ maxVideoHandles: MAX_CANVAS_ACTIVE_VIDEO_DECODERS })
    const composeCanvas = document.createElement('canvas')
    const composeCtx = composeCanvas.getContext('2d', { alpha: false })
    const snapshotCanvas = document.createElement('canvas')
    const snapshotCtx = snapshotCanvas.getContext('2d', { alpha: false })
    const fallbackContext = createSharedPerformanceFallbackContext(0)
    const svgLuma = new Map<string, number | null>()
    let mediaIndexSource: readonly CanvasMediaItem[] | null = null
    let mediaIndex = new Map<string, CanvasMediaItem>()
    const lookupMedia = (id: string): CanvasMediaItem | undefined => {
      const items = live.current.mediaItems
      if (mediaIndexSource !== items) {
        mediaIndexSource = items
        mediaIndex = new Map(items.map(item => [item.id, item]))
      }
      return mediaIndex.get(id)
    }
    const playedVideos = new Map<string, HTMLVideoElement>()
    const videoStarts = new Set<string>()
    const failedIds = new Set<string>()
    let failedSnapshot: ReadonlySet<string> = new Set()
    let lastPreloadKey = ''
    let lastStatus: string | null = null
    let frameId = 0
    let disposed = false
    let contextLost = false
    let idleTimeSec = 0
    let lastNow = typeof performance !== 'undefined' ? performance.now() : Date.now()
    let lastSnapshotAt = 0

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      if (disposed) return
      contextLost = true
      callbacks.current.onStatusChange?.('CUTBANK lost its WebGL2 context. It is inactive until the preset is re-entered; settings are preserved.')
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)
    callbacks.current.onCanvasReady?.(snapshotCanvas)
    callbacks.current.onStatusChange?.(null)

    const resolveDrawable = (mediaId: string): CutbankDrawable | null => {
      const handle: CanvasPreloadHandle | null = preload.getHandle(mediaId)
      if (!handle || !isCanvasPreloadHandleDrawable(handle)) return null
      if (typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement) {
        return { source: handle, width: handle.videoWidth, height: handle.videoHeight }
      }
      const image = handle as HTMLImageElement
      const item = lookupMedia(mediaId)
      let luma: number | null | undefined
      if (item?.type === 'svg') {
        const key = `${mediaId}:${item.mediaRevision ?? 0}`
        luma = svgLuma.get(key)
        if (luma === undefined) {
          luma = measureSvgLuma(image)
          if (svgLuma.size >= 32) svgLuma.clear()
          svgLuma.set(key, luma)
        }
      }
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, svgLuma: luma }
    }

    const tick = () => {
      if (disposed) return
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const dtSec = Math.min(0.1, Math.max(0, (nowMs - lastNow) / 1000))
      lastNow = nowMs
      const cur = live.current

      if (!contextLost && composeCtx) {
        try {
          const rect = canvas.getBoundingClientRect()
          const cssW = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1))
          const cssH = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1))
          const dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1))
          const scale = Math.min(1, MAX_RENDER_WIDTH / Math.max(1, cssW * dpr))
          const width = Math.max(2, Math.round(cssW * dpr * scale))
          const height = Math.max(2, Math.round(cssH * dpr * scale))
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            composeCanvas.width = width
            composeCanvas.height = height
            pass.resize(width, height)
          }

          // Idle preview (nothing playing) advances on wall time with the deterministic fallback tempo.
          if (!cur.audioActive) idleTimeSec += dtSec
          const context = performanceContextRef.current ?? fallbackContext
          const transportTimeSec = cur.audioActive
            ? (cur.getAudioTime?.() ?? context.audioTimeSec)
            : idleTimeSec
          const runtimeSettings = cur.audioActive ? cur.settings.cutbank : { ...cur.settings.cutbank, bpmSync: false }
          preload.setScope(cur.trackIdentity, cur.poolRevision)

          const plan = runtime.update({
            settings: runtimeSettings,
            pool: cur.pool,
            mediaItems: cur.mediaItems,
            context,
            transportTimeSec,
            dtSec,
            trackIdentity: cur.trackIdentity,
            poolRevision: cur.poolRevision,
            isMediaReady: mediaId => preload.isReady(mediaId),
            failedMediaIds: failedSnapshot,
            nowMs,
          })

          // Bounded preload of just the current/outgoing/next media; everything else is retired.
          const preloadKey = plan.preloadMediaIds.join('|')
          if (preloadKey !== lastPreloadKey) {
            lastPreloadKey = preloadKey
            preload.retainOnly(plan.preloadMediaIds)
          }
          const requests: Array<{ media: CanvasMediaItem; trackIdentity: string | null; poolRevision: number; priority: number }> = []
          for (const [index, mediaId] of plan.preloadMediaIds.entries()) {
            const media = lookupMedia(mediaId)
            if (!media) continue
            const readiness = preload.getReadiness(mediaId)
            if (readiness.status === 'error' && !failedIds.has(mediaId)) {
              failedIds.add(mediaId)
              failedSnapshot = new Set(failedIds)
            }
            if (readiness.status === 'idle' || readiness.status === 'cancelled') {
              requests.push({ media, trackIdentity: cur.trackIdentity, poolRevision: cur.poolRevision, priority: 100 - index })
            }
          }
          if (requests.length > 0) preload.request(requests)

          // Failed media leave the Pool once it is edited/replaced (new revision clears them).
          if (failedIds.size > 0 && cur.pool && !cur.pool.mediaIds.some(id => failedIds.has(id))) {
            failedIds.clear()
            failedSnapshot = new Set()
          }

          // Videos: start at a deterministic in-point when first shown, pause when no longer shown.
          const shown = new Set<string>()
          for (const composition of [plan.current, plan.outgoing]) {
            for (const el of composition?.elements ?? []) {
              const item = plan.items.get(el.itemKey)
              if (item?.kind !== 'video' || !item.mediaId) continue
              shown.add(item.mediaId)
              const handle = preload.getHandle(item.mediaId)
              if (handle instanceof HTMLVideoElement && isCanvasPreloadHandleDrawable(handle)) {
                const startKey = `${plan.sequenceIndex}:${item.mediaId}`
                if (!videoStarts.has(startKey)) {
                  if (videoStarts.size > 64) videoStarts.clear()
                  videoStarts.add(startKey)
                  const duration = Number.isFinite(handle.duration) ? handle.duration : 0
                  if (duration > 1) handle.currentTime = cutbankUnit('video-in', item.mediaId, plan.sequenceIndex) * Math.max(0, duration - 3)
                }
                handle.loop = true
                handle.muted = true
                if (handle.paused) void handle.play().catch(() => undefined)
                playedVideos.set(item.mediaId, handle)
              }
            }
          }
          for (const [mediaId, video] of playedVideos) {
            if (shown.has(mediaId)) continue
            video.pause()
            playedVideos.delete(mediaId)
          }

          composeCutbankFrame(composeCtx, { plan, width, height, resolveDrawable })
          pass.render(composeCanvas, {
            treatment: plan.treatment,
            palette: plan.palette,
            timeSec: plan.clock.timeSec,
            seed: plan.current?.seed ?? 0,
          })

          const message = plan.status.message
          if (message !== lastStatus) {
            lastStatus = message
            callbacks.current.onStatusChange?.(message)
          }

          if (snapshotCtx && nowMs - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
            if (snapshotCanvas.width !== width || snapshotCanvas.height !== height) {
              snapshotCanvas.width = width
              snapshotCanvas.height = height
            }
            try {
              snapshotCtx.drawImage(canvas, 0, 0)
            } catch {
              // Keep the previous stable capture frame after a transient GPU-copy failure.
            }
            lastSnapshotAt = nowMs
          }
        } catch (error) {
          contextLost = true
          pass.dispose()
          callbacks.current.onStatusChange?.(`${error instanceof Error ? error.message : 'CUTBANK runtime failure'}. It is inactive until the preset is re-entered.`)
        }
      }
      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      for (const video of playedVideos.values()) video.pause()
      playedVideos.clear()
      preload.dispose()
      runtime.reset()
      pass.dispose()
      composeCanvas.width = 0
      composeCanvas.height = 0
      snapshotCanvas.width = 0
      snapshotCanvas.height = 0
      svgLuma.clear()
      releaseCutbankComposeScratch()
      callbacks.current.onCanvasReady?.(null)
      callbacks.current.onStatusChange?.(null)
    }
  }, [active, performanceContextRef])

  if (!active) return null
  return (
    <canvas
      ref={canvasRef}
      className="rv-canvas-cutbank-layer"
      data-renderer-backend="webgl2"
      aria-label="CUTBANK output"
    />
  )
}

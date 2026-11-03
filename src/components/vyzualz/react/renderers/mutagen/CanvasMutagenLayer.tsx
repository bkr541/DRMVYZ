import { useEffect, useRef, useState, type RefObject } from 'react'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../../ReactTypes'
import { MutagenPerformanceController } from './MutagenPerformanceController'
import type { CanvasMutagenSettings } from './MutagenSettings'
import { isMutagenSource, MutagenRenderer, resolveMutagenRenderSize, type MutagenTransform } from './MutagenRenderer'

export function CanvasMutagenLayer(props: {
  outputAlpha?: number
  active: boolean
  activeItem: CanvasMediaItem | null
  sourceRef: RefObject<HTMLImageElement | null>
  settings: CanvasMutagenSettings
  fitMode: CanvasFitMode
  sourceTransform: MutagenTransform
  performanceContextRef: RefObject<SharedPerformanceContext | null>
  trackIdentity: string | null
  isPlaying: boolean
  audioActive?: boolean
  getAudioTime?: () => number
  isPaused: boolean
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void
  onStatusChange: (message: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const live = useRef(props)
  live.current = props
  const [ready, setReady] = useState(false)
  const [restoreRevision, setRestoreRevision] = useState(0)
  const restoreBudget = useRef({ key: '', attempts: 0 })
  const { active, activeItem, sourceRef, trackIdentity, onCanvasReady, onStatusChange } = props

  useEffect(() => {
    if (!active || !activeItem) return
    const resourceKey = `${activeItem.id}:${activeItem.objectUrl}:${activeItem.mediaRevision ?? 0}:${trackIdentity}`
    if (restoreBudget.current.key !== resourceKey) restoreBudget.current = { key: resourceKey, attempts: 0 }
    setReady(false)
    onCanvasReady(null)
    if (!isMutagenSource(activeItem)) {
      onStatusChange('MUTAGEN supports still images and SVG. Video plays unchanged; select a still image in Media Manager for image mutation.')
      return () => onStatusChange(null)
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const result = MutagenRenderer.create(canvas)
    if (!result.renderer) {
      onStatusChange(`${result.error}. Showing the original source.`)
      return () => onStatusChange(null)
    }
    const renderer = result.renderer
    const snapshot = document.createElement('canvas')
    const context = snapshot.getContext('2d', { alpha: true })
    let frameId = 0
    let stopped = false
    let contextLost = false
    let disposed = false
    let rendererDisposed = false
    const disposeRenderer = () => { if (!rendererDisposed) { rendererDisposed = true; renderer.dispose() } }
    let published = false
    let ambientTime = 0
    let previousMs = performance.now()
    const controller = new MutagenPerformanceController()
    let lastRenderedRecipe: CanvasMutagenSettings | null = null
    let lastRenderedGeometry = ''
    onStatusChange(null)

    const fail = (message: string) => {
      if (stopped) return
      stopped = true
      window.cancelAnimationFrame(frameId)
      disposeRenderer()
      snapshot.width = 0; snapshot.height = 0
      setReady(false)
      onCanvasReady(null)
      onStatusChange(`${message}. Showing the original source; switch presets and re-enter MUTAGEN to retry.`)
    }
    const lost = (event: Event) => { event.preventDefault(); contextLost = true; fail('MUTAGEN lost its WebGL2 context') }
    const restored = () => {
      if (disposed || !contextLost || restoreBudget.current.attempts >= 1) return
      restoreBudget.current.attempts++
      setRestoreRevision(value => value + 1)
    }
    const visibility = () => { renderer.resetHistory(); controller.reset(); previousMs = performance.now() }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    document.addEventListener('visibilitychange', visibility)
    const tick = (now: number) => {
      if (stopped) return
      const delta = Math.max(0, Math.min(0.1, (now - previousMs) / 1000))
      previousMs = now
      const current = live.current
      const rect = canvas.getBoundingClientRect()
      if (!document.hidden && rect.width > 0 && rect.height > 0) {
        const shared = current.performanceContextRef.current
        // Ambient motion when stopped uses elapsed animation time only. Musical
        // playback uses the existing authoritative audio position, never a beat clock.
        if (!current.isPaused) ambientTime += delta
        try {
          const audioTime = current.isPlaying ? current.getAudioTime?.() ?? shared?.audioTimeSec ?? ambientTime : ambientTime
          const decision = controller.update({ settings: current.settings, context: shared, audioActive: current.audioActive ?? current.isPlaying, paused: current.isPaused, timeSec: audioTime, deltaSec: delta })
          if (decision.reset) renderer.resetHistory()
          const transform = current.sourceTransform
          const geometry = `${window.devicePixelRatio || 1}:${rect.width}:${rect.height}:${current.fitMode}:${transform.scale}:${transform.positionX}:${transform.positionY}:${transform.rotation}`
          // Reuse the last usable snapshot while paused. Sampling a cleared
          // non-preserved GL drawing buffer or advancing feedback would not freeze.
          if (current.isPaused && !decision.positionReset && published && lastRenderedRecipe === current.settings && lastRenderedGeometry === geometry) {
            frameId = window.requestAnimationFrame(tick)
            return
          }
          const size = resolveMutagenRenderSize(rect.width, rect.height, window.devicePixelRatio || 1, current.settings.mutation === 0 || current.settings.sourceMix === 1 ? 'balanced' : current.settings.quality)
          renderer.resize(size.width, size.height)
          const rendered = renderer.render({
            source: sourceRef.current,
            settings: current.settings,
            fitMode: current.fitMode,
            sourceTransform: current.sourceTransform,
            timeSec: audioTime,
            qualityViewport: { width: rect.width, height: rect.height },
            performance: decision,
          })
          if (rendered) {
            lastRenderedRecipe = current.settings; lastRenderedGeometry = geometry
            if (!context) throw new Error('MUTAGEN capture context unavailable')
            if (snapshot.width !== canvas.width || snapshot.height !== canvas.height) {
              snapshot.width = canvas.width; snapshot.height = canvas.height
            }
            context.clearRect(0, 0, snapshot.width, snapshot.height)
            context.drawImage(canvas, 0, 0)
            if (!published) { published = true; setReady(true); onCanvasReady(snapshot) }
          } else if (published) {
            published = false; setReady(false); onCanvasReady(null)
          }
        } catch (error) { fail(error instanceof Error ? error.message : 'MUTAGEN render failed'); return }
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => {
      stopped = true
      disposed = true
      window.cancelAnimationFrame(frameId)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      document.removeEventListener('visibilitychange', visibility)
      disposeRenderer()
      snapshot.width = 0; snapshot.height = 0
      onCanvasReady(null)
      onStatusChange(null)
    }
  }, [restoreRevision, active, activeItem?.id, activeItem?.type, activeItem?.objectUrl, activeItem?.mediaRevision, trackIdentity, sourceRef, onCanvasReady, onStatusChange])

  if (!active || !isMutagenSource(activeItem)) return null
  return <canvas ref={canvasRef} className="rv-canvas-mutagen-layer" style={{ opacity: props.outputAlpha ?? 1 }} data-ready={ready} data-renderer-backend="webgl2" aria-hidden="true" />
}

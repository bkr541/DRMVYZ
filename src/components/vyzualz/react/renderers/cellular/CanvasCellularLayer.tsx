import { useEffect, useRef, useState, type RefObject } from 'react'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../../ReactTypes'
import { CellularRenderer, type CellularSource, type CellularTransform } from './CellularRenderer'
import { CellularPerformance } from './CellularPerformance'
import { getCellularReseedRevision, isCellularClean, resolveCellularPlan, type CanvasCellularSettings } from './CellularSettings'
export function CanvasCellularLayer(props: {
  active: boolean; activeItem: CanvasMediaItem | null
  sourceRef: RefObject<CellularSource | null>; settings: CanvasCellularSettings
  fitMode: CanvasFitMode; sourceTransform: CellularTransform; outputAlpha: number
  performanceContextRef: RefObject<SharedPerformanceContext | null>; trackIdentity: string | null
  isPlaying: boolean; isPaused: boolean; audioActive: boolean; getAudioTime?: () => number
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void; onStatusChange: (message: string | null) => void
}) {
  const visibleRef = useRef<HTMLCanvasElement>(null), live = useRef(props)
  live.current = props
  const [ready, setReady] = useState(false), [restoreRevision, setRestoreRevision] = useState(0)
  const retries = useRef({ key: '', attempts: 0 })
  const { active, activeItem, trackIdentity, onCanvasReady, onStatusChange } = props
  const resourceKey = activeItem ? `${activeItem.id}:${activeItem.type}:${activeItem.objectUrl}:${activeItem.mediaRevision}:${trackIdentity}` : null
  useEffect(() => {
    if (!active || !resourceKey || !visibleRef.current) return
    const canvas = visibleRef.current, gpu = document.createElement('canvas')
    if (retries.current.key !== resourceKey) retries.current = { key: resourceKey, attempts: 0 }
    setReady(false); onCanvasReady(null)
    const created = CellularRenderer.create(gpu)
    if (!created.renderer) { onStatusChange(`${created.error}. Showing the original source.`); return () => onStatusChange(null) }
    const renderer = created.renderer, context = canvas.getContext('2d', { alpha: true })
    const controller = new CellularPerformance()
    let frameId = 0, disposed = false, stopped = false, lost = false, rendererDisposed = false, published = false
    let previousMs = performance.now(), ambient = 0, clearRevision = getCellularReseedRevision()
    let sourceSeekPending = false
    let lastClean = false
    let lastGeometry = '', lastSettings: CanvasCellularSettings | null = null
    const disposeRenderer = () => { if (!rendererDisposed) { rendererDisposed = true; renderer.dispose() } }
    const fail = (message: string) => {
      if (stopped) return
      stopped = true; window.cancelAnimationFrame(frameId); disposeRenderer()
      context?.clearRect(0, 0, canvas.width, canvas.height)
      setReady(false); onCanvasReady(null)
      onStatusChange(`${message}. Showing the original source; switch presets and re-enter Cellular to retry.`)
    }
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; fail('Cellular lost its WebGL2 context') }
    const restored = () => { if (!disposed && lost && retries.current.attempts < 1) { retries.current.attempts++; setRestoreRevision(n => n + 1) } }
    const visibility = () => { renderer.resetHistory(); controller.reset(); previousMs = performance.now() }
    const sourceElement = live.current.sourceRef.current
    const sourceSeeking = () => { sourceSeekPending = true }
    if (sourceElement && 'videoWidth' in sourceElement) sourceElement.addEventListener('seeking', sourceSeeking)
    gpu.addEventListener('webglcontextlost', contextLost); gpu.addEventListener('webglcontextrestored', restored)
    document.addEventListener('visibilitychange', visibility)
    onStatusChange(null)
    const tick = (now: number) => {
      if (stopped) return
      const delta = Math.max(0, Math.min(0.1, (now - previousMs) / 1000)); previousMs = now
      const current = live.current, rect = canvas.getBoundingClientRect()
      if (!document.hidden && rect.width > 0 && rect.height > 0) {
        try {
          const source = current.sourceRef.current
          if (source && 'videoWidth' in source && (source.seeking || (sourceSeekPending && source.readyState < 2))) {
            sourceSeekPending = true
            frameId = window.requestAnimationFrame(tick)
            return
          }
          const command = getCellularReseedRevision(), cleared = command !== clearRevision || sourceSeekPending
          sourceSeekPending = false
          if (cleared) { renderer.resetHistory(); controller.reset(); clearRevision = command }
          if (!current.isPaused) ambient += delta
          const time = current.isPlaying ? current.getAudioTime?.() ?? current.performanceContextRef.current?.audioTimeSec ?? ambient : ambient
          const decision = controller.update({ settings: current.settings, context: current.performanceContextRef.current, timeSec: time, deltaSec: delta, paused: current.isPaused, audioActive: current.audioActive })
          if (decision.reset) renderer.resetHistory()
          const t = current.sourceTransform
          const geometry = `${rect.width}:${rect.height}:${window.devicePixelRatio}:${current.fitMode}:${t.scale}:${t.positionX}:${t.positionY}:${t.rotation}`
          const clean = isCellularClean(current.settings)
          const holding = current.isPaused
          if (holding && !decision.positionReset && !cleared && published && clean === lastClean && geometry === lastGeometry && lastSettings === current.settings) {
            frameId = window.requestAnimationFrame(tick); return
          }
          const plan = resolveCellularPlan(current.settings, rect.width, rect.height, window.devicePixelRatio || 1)
          renderer.resize(plan.output.width, plan.output.height)
          const rendered = renderer.render({ source, settings: current.settings, performance: decision, timeSec: time, fitMode: current.fitMode, sourceTransform: t, viewport: rect })
          if (rendered) {
            if (!context) throw new Error('Cellular capture context unavailable')
            if (canvas.width !== gpu.width || canvas.height !== gpu.height) { canvas.width = gpu.width; canvas.height = gpu.height }
            context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(gpu, 0, 0)
            lastGeometry = geometry; lastSettings = current.settings; lastClean = clean
            if (!published) { published = true; setReady(true); onCanvasReady(canvas) }
          } else if (published) { published = false; setReady(false); onCanvasReady(null); context?.clearRect(0, 0, canvas.width, canvas.height) }
        } catch (error) { fail(error instanceof Error ? error.message : 'Cellular rendering failed'); return }
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => {
      disposed = true; stopped = true; window.cancelAnimationFrame(frameId)
      gpu.removeEventListener('webglcontextlost', contextLost); gpu.removeEventListener('webglcontextrestored', restored)
      document.removeEventListener('visibilitychange', visibility); disposeRenderer()
      sourceElement?.removeEventListener('seeking', sourceSeeking)
      onCanvasReady(null); onStatusChange(null)
      canvas.width = 0; canvas.height = 0; gpu.width = 0; gpu.height = 0
    }
  }, [active, resourceKey, restoreRevision, onCanvasReady, onStatusChange])
  if (!active || !activeItem) return null
  return <canvas ref={visibleRef} className="rv-canvas-cellular-layer" data-ready={ready} data-renderer-backend="webgl2" style={{ opacity: props.outputAlpha }} aria-hidden="true" />
}

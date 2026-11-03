import { useEffect, useRef, useState, type RefObject } from 'react'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem } from '../ReactTypes'

export type DirectWebGLSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
export type DirectWebGLTransform = { scale: number; positionX: number; positionY: number; rotation: number }

export type DirectWebGLLayerProps<Settings> = {
  activeItem: CanvasMediaItem | null
  sourceRef: RefObject<DirectWebGLSource | null>; settings: Settings
  fitMode: CanvasFitMode; sourceTransform: DirectWebGLTransform; outputAlpha: number
  performanceContextRef: RefObject<SharedPerformanceContext | null>; trackIdentity: string | null
  isPlaying: boolean; isPaused: boolean; audioActive: boolean; getAudioTime?: () => number
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void; onStatusChange: (message: string | null) => void
}

type FrameInput<Settings, Frame> = {
  source: DirectWebGLSource | null
  settings: Settings
  frame: Frame
  fitMode: CanvasFitMode
  transform: DirectWebGLTransform
  viewport: { width: number; height: number }
  dpr: number
}

type DirectWebGLAdapter<Settings, Frame> = {
  label: string
  className: string
  createRenderer: (canvas: HTMLCanvasElement) => { render(input: FrameInput<Settings, Frame>): boolean; dispose(): void }
  createController: () => {
    reset(): void
    update(settings: Settings, context: SharedPerformanceContext | null, time: number, delta: number, paused: boolean, audioActive: boolean): Frame
  }
}

export function CanvasDirectWebGLLayer<Settings, Frame>(props: DirectWebGLLayerProps<Settings> & {
  adapter: DirectWebGLAdapter<Settings, Frame>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const live = useRef(props)
  live.current = props
  const [ready, setReady] = useState(false)
  const [restoreRevision, setRestoreRevision] = useState(0)
  const recovery = useRef({ key: '', used: false })
  const { activeItem, onCanvasReady, onStatusChange, adapter } = props
  const resourceKey = activeItem ? `${activeItem.id}:${activeItem.type}:${activeItem.objectUrl}:${activeItem.mediaRevision}` : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !resourceKey) return
    if (recovery.current.key !== resourceKey) recovery.current = { key: resourceKey, used: false }
    let renderer: ReturnType<typeof adapter.createRenderer> | null = null
    let raf = 0
    let published = false
    let ambient = 0
    let previousMs = performance.now()
    let track = live.current.trackIdentity
    const controller = adapter.createController()
    const publish = (available: boolean) => {
      if (available === published) return
      published = available
      setReady(available)
      onCanvasReady(available ? canvas : null)
    }
    const fail = (message: string) => {
      cancelAnimationFrame(raf)
      renderer?.dispose()
      renderer = null
      publish(false)
      onStatusChange(`${message}. Showing the original source.`)
    }
    const lost = (event: Event) => {
      event.preventDefault()
      fail(`${adapter.label} lost its WebGL2 context`)
    }
    const restored = () => {
      if (recovery.current.used) return
      recovery.current.used = true
      setRestoreRevision(value => value + 1)
    }
    const visibility = () => {
      previousMs = performance.now()
      controller.reset()
    }
    const tick = (now: number) => {
      const delta = Math.max(0, Math.min(0.1, (now - previousMs) / 1000))
      previousMs = now
      const current = live.current
      const viewport = canvas.getBoundingClientRect()
      if (renderer && !document.hidden && viewport.width > 0 && viewport.height > 0) {
        const source = current.sourceRef.current
        // Keep the last drawable frame until the existing decoder resolves a seek.
        if (!(source && 'videoWidth' in source && (source.seeking || source.readyState < 2))) {
          if (track !== current.trackIdentity) {
            track = current.trackIdentity
            ambient = 0
            controller.reset()
          }
          if (!current.isPaused) ambient += delta
          const context = current.performanceContextRef.current
          const time = current.isPlaying ? current.getAudioTime?.() ?? context?.audioTimeSec ?? ambient : ambient
          const frame = controller.update(current.settings, context, time, delta, current.isPaused, current.audioActive)
          try {
            publish(renderer.render({
              source, settings: current.settings, frame, fitMode: current.fitMode,
              transform: current.sourceTransform, viewport, dpr: window.devicePixelRatio || 1,
            }))
          } catch (error) {
            fail(error instanceof Error ? error.message : `${adapter.label} rendering failed`)
            return
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    setReady(false)
    onCanvasReady(null)
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    document.addEventListener('visibilitychange', visibility)
    try {
      renderer = adapter.createRenderer(canvas)
      onStatusChange(null)
      raf = requestAnimationFrame(tick)
    } catch (error) {
      fail(error instanceof Error ? error.message : `${adapter.label} initialization failed`)
    }
    return () => {
      cancelAnimationFrame(raf)
      renderer?.dispose()
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      document.removeEventListener('visibilitychange', visibility)
      onCanvasReady(null)
      onStatusChange(null)
      canvas.width = canvas.height = 1
    }
  }, [resourceKey, restoreRevision, onCanvasReady, onStatusChange, adapter])

  if (!activeItem) return null
  return <canvas ref={canvasRef} className={adapter.className} data-ready={ready}
    data-renderer-backend="webgl2" style={{ opacity: props.outputAlpha }} aria-hidden="true" />
}

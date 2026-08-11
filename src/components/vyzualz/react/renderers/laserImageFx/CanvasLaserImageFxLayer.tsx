import { useEffect, useRef, type RefObject } from 'react'
import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import type { CanvasFitMode, CanvasMediaItem, CanvasPresetSettings } from '../../ReactTypes'
import {
  LaserImageFxRenderer,
  type LaserImageFxAudioFrame,
  type LaserImageFxSourceElement,
  type LaserImageFxSourceTransform,
} from './LaserImageFxRenderer'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function averageRange(data: Uint8Array, startRatio: number, endRatio: number): number {
  if (data.length === 0) return 0
  const start = Math.max(0, Math.min(data.length - 1, Math.floor(data.length * startRatio)))
  const end = Math.max(start + 1, Math.min(data.length, Math.ceil(data.length * endRatio)))
  let sum = 0
  for (let index = start; index < end; index += 1) sum += data[index]
  return sum / ((end - start) * 255)
}

export function CanvasLaserImageFxLayer({
  active,
  activeItem,
  sourceRef,
  settings,
  fitMode,
  sourceTransform,
  analyser,
  performanceContextRef,
  isPlaying,
  isPaused,
  onCanvasReady,
  onStatusChange,
  outputAlpha,
}: {
  active: boolean
  activeItem: CanvasMediaItem | null
  sourceRef: RefObject<LaserImageFxSourceElement | null>
  settings: CanvasPresetSettings
  fitMode: CanvasFitMode
  sourceTransform: LaserImageFxSourceTransform
  analyser?: AnalyserNode | null
  performanceContextRef: RefObject<SharedPerformanceContext | null>
  isPlaying: boolean
  isPaused: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onStatusChange?: (message: string | null) => void
  outputAlpha: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const settingsRef = useRef(settings)
  const fitModeRef = useRef(fitMode)
  const sourceTransformRef = useRef(sourceTransform)
  const playbackRef = useRef({ isPlaying, isPaused })

  settingsRef.current = settings
  fitModeRef.current = fitMode
  sourceTransformRef.current = sourceTransform
  playbackRef.current = { isPlaying, isPaused }

  useEffect(() => {
    // This layer is shared by CanvasEngineSurface, but Laser-specific lifecycle
    // work must be completely inert while another renderer owns the surface.
    if (!active || !activeItem) return
    const canvas = canvasRef.current
    if (!canvas) return

    const createResult = LaserImageFxRenderer.create(canvas)
    if (!createResult.renderer) {
      onCanvasReady?.(null)
      onStatusChange?.(`${createResult.error ?? 'Laser Image FX could not initialize'}. The dry source remains available.`)
      return () => {
        onCanvasReady?.(null)
        onStatusChange?.(null)
      }
    }

    const renderer = createResult.renderer
    const captureSnapshotCanvas = document.createElement('canvas')
    const captureSnapshotContext = captureSnapshotCanvas.getContext('2d', { alpha: true })
    const frequencyData = analyser ? new Uint8Array(Math.max(1, analyser.frequencyBinCount)) : null
    let frameId = 0
    let disposed = false
    let contextLost = false
    let previousBass = 0
    let heldBeat = 0
    let previousFrameMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
    let manualTimeSec = 0
    let lastSnapshotAt = 0

    onCanvasReady?.(captureSnapshotCanvas)
    onStatusChange?.(null)

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      if (disposed) return
      contextLost = true
      onStatusChange?.('Laser Image FX lost its WebGL2 context. The renderer is inactive until the preset is re-entered; settings are preserved.')
    }
    canvas.addEventListener('webglcontextlost', handleContextLost)

    const readAudio = (fallbackTimeSec: number): LaserImageFxAudioFrame => {
      const playback = playbackRef.current
      const context = performanceContextRef.current
      if (context) {
        const liveBeat = playback.isPlaying && !playback.isPaused
          ? Math.max(context.kickStrength, context.transient * 0.74, context.downbeat && context.boundaries.beatBoundary ? 1 : 0)
          : 0
        return {
          bass: clamp01(context.bass),
          mid: clamp01(context.mid),
          high: clamp01(context.high),
          beat: clamp01(liveBeat),
          bpm: Math.max(0, context.bpm),
          absoluteBeat: Math.max(0, context.absoluteBeat),
        }
      }

      let bass = 0.15
      let mid = 0.12
      let high = 0.1
      let beat = Math.max(0, Math.sin(fallbackTimeSec * 2.6)) * 0.24
      if (analyser && frequencyData && playback.isPlaying && !playback.isPaused) {
        analyser.getByteFrequencyData(frequencyData)
        bass = averageRange(frequencyData, 0, 0.12)
        mid = averageRange(frequencyData, 0.16, 0.55)
        high = averageRange(frequencyData, 0.62, 1)
        const bassDelta = bass - previousBass
        heldBeat = Math.max(0, heldBeat * 0.78, bass > 0.5 && bassDelta > 0.04 ? 1 : 0)
        beat = heldBeat
        previousBass = previousBass * 0.58 + bass * 0.42
      } else {
        previousBass = bass
      }
      return { bass, mid, high, beat, bpm: 0, absoluteBeat: 0 }
    }

    const tick = () => {
      if (disposed) return
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const deltaSec = Math.min(0.1, Math.max(0, (nowMs - previousFrameMs) / 1000))
      previousFrameMs = nowMs
      const playback = playbackRef.current
      if (playback.isPlaying && !playback.isPaused) manualTimeSec += deltaSec

      if (!contextLost) {
        const rect = canvas.getBoundingClientRect()
        const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1))
        const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1))
        const dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1))
        let rendered = false
        try {
          renderer.resize(Math.round(cssWidth * dpr), Math.round(cssHeight * dpr))

          const context = performanceContextRef.current
          const timeSec = context
            ? Math.max(0, context.audioTimeSec)
            : manualTimeSec
          rendered = renderer.render({
            source: sourceRef.current,
            settings: settingsRef.current,
            fitMode: fitModeRef.current,
            sourceTransform: sourceTransformRef.current,
            audio: readAudio(timeSec),
            timeSec,
          })
        } catch (error) {
          contextLost = true
          renderer.dispose()
          onStatusChange?.(`${error instanceof Error ? error.message : 'Laser Image FX runtime failure'}. The renderer is inactive until the preset is re-entered; the dry source remains available.`)
        }

        if (rendered && captureSnapshotContext && nowMs - lastSnapshotAt >= 30) {
          if (captureSnapshotCanvas.width !== canvas.width || captureSnapshotCanvas.height !== canvas.height) {
            captureSnapshotCanvas.width = canvas.width
            captureSnapshotCanvas.height = canvas.height
          }
          captureSnapshotContext.clearRect(0, 0, captureSnapshotCanvas.width, captureSnapshotCanvas.height)
          try {
            captureSnapshotContext.drawImage(canvas, 0, 0)
          } catch {
            // Keep the previous stable capture frame after transient GPU-copy failures.
          }
          lastSnapshotAt = nowMs
        }
      }

      frameId = window.requestAnimationFrame(tick)
    }

    tick()
    return () => {
      disposed = true
      window.cancelAnimationFrame(frameId)
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      renderer.dispose()
      captureSnapshotContext?.clearRect(0, 0, captureSnapshotCanvas.width, captureSnapshotCanvas.height)
      onCanvasReady?.(null)
      onStatusChange?.(null)
    }
  }, [active, activeItem?.id, activeItem?.mediaRevision, activeItem?.objectUrl, analyser, onCanvasReady, onStatusChange, performanceContextRef, sourceRef])

  if (!active || !activeItem) return null
  return (
    <canvas
      ref={canvasRef}
      className="rv-canvas-laser-image-fx-layer"
      data-renderer-backend="webgl2"
      style={{ opacity: outputAlpha }}
      aria-hidden="true"
    />
  )
}

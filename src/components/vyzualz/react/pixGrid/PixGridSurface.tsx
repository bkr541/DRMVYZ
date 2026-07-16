import { useEffect, useRef } from 'react'
import type { ReactPreset, ReactTrackSection } from '../ReactTypes'
import { createLiveFpsReporter } from '../fpsDiagnostics'
import { acquireReactLiveEngineOwnership } from '../renderers/ReactLiveEngineOwnership'
import { applyCanvasResolution, resolveCanvasResolution, type CanvasResolution } from '../rendering/canvasResolution'
import { disposePixGridBaselineRenderer, renderPixGridBaseline } from '../renderers/pixGrid/PixGridBaselineRenderer'
import { createPixGridRendererLifecycle } from '../renderers/pixGrid/PixGridRendererLifecycle'
import type { PixGridQualityTier, PixGridState } from './PixGridTypes'

export interface PixGridSurfaceProps {
  analyser: AnalyserNode | null
  activePreset: ReactPreset | null
  pixGridState: PixGridState
  intensity: number
  motion: number
  glow: number
  bassReactivity: number
  isPlaying: boolean
  isPaused?: boolean
  trackSections?: readonly ReactTrackSection[]
  getAudioTime: () => number
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}

function canvasQuality(quality: PixGridQualityTier): 'low' | 'medium' | 'high' | 'ultra' {
  if (quality === 'draft') return 'low'
  if (quality === 'low') return 'medium'
  return quality
}

function averageRange(data: Uint8Array<ArrayBuffer>, start: number, end: number): number {
  const safeStart = Math.max(0, Math.min(data.length, start))
  const safeEnd = Math.max(safeStart + 1, Math.min(data.length, end))
  let sum = 0
  for (let i = safeStart; i < safeEnd; i += 1) sum += data[i]
  return sum / ((safeEnd - safeStart) * 255)
}

function resolveSectionScene(preset: ReactPreset, sections: readonly ReactTrackSection[], audioTime: number): string | null {
  const section = sections.find(candidate => audioTime >= candidate.startSec && audioTime < candidate.endSec)
  if (!section) return null
  return preset.sectionMappings.find(mapping => mapping.sectionType === section.type)?.sceneId ?? null
}

export function PixGridSurface(props: PixGridSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props

  useEffect(() => {
    const canvas = canvasRef.current
    const preset = propsRef.current.activePreset
    if (!canvas || !preset) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }

    let resolution: CanvasResolution | null = null
    let frequencyData: Uint8Array<ArrayBuffer> | null = null
    let lastBass = 0
    let beatLatch = false
    let renderedStoppedFrame = false
    let frameCount = 0
    let fpsWindowStarted = performance.now()
    const fpsReporter = createLiveFpsReporter(() => propsRef.current.onLiveFps)
    const lifecycle = createPixGridRendererLifecycle(() => {
      disposePixGridBaselineRenderer()
      propsRef.current.onCanvasReady?.(null)
      fpsReporter.unavailable()
    })

    const ownership = acquireReactLiveEngineOwnership('pixGrid', () => lifecycle.dispose())

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const next = resolveCanvasResolution({
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        devicePixelRatio: window.devicePixelRatio,
        quality: canvasQuality(propsRef.current.pixGridState.quality),
        previous: resolution,
      })
      if (!next.valid) return
      applyCanvasResolution(canvas, next)
      resolution = next
      renderedStoppedFrame = false
    }

    const observer = new ResizeObserver(resize)
    lifecycle.setResizeObserver(observer)
    observer.observe(canvas)
    resize()
    propsRef.current.onCanvasReady?.(canvas)
    ownership.markStable()

    const render = (now: number) => {
      if (lifecycle.disposed || !ownership.isCurrent()) return
      const current = propsRef.current
      const activePreset = current.activePreset
      if (!activePreset) return

      if (current.isPaused) {
        fpsReporter.unavailable()
        return
      }

      const shouldAnimate = current.isPlaying
      if (!shouldAnimate && renderedStoppedFrame) {
        fpsReporter.unavailable()
        return
      }

      const analyser = current.analyser
      if (analyser) {
        if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
          frequencyData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        }
        analyser.getByteFrequencyData(frequencyData)
      }
      const bins = frequencyData?.length ?? 0
      const bass = frequencyData ? averageRange(frequencyData, 0, Math.max(1, Math.floor(bins * 0.12))) : 0
      const mid = frequencyData ? averageRange(frequencyData, Math.floor(bins * 0.12), Math.floor(bins * 0.45)) : 0
      const high = frequencyData ? averageRange(frequencyData, Math.floor(bins * 0.45), bins) : 0
      const beatHit = shouldAnimate && bass > 0.58 && bass > lastBass + 0.055 && !beatLatch
      beatLatch = bass > 0.46
      if (bass < 0.34) beatLatch = false
      lastBass = bass
      const sampledAudioTime = current.getAudioTime()
      const audioTime = Number.isFinite(sampledAudioTime) ? sampledAudioTime : 0
      const beatPhase = ((audioTime * 2) % 1 + 1) % 1
      const selectedSceneId = resolveSectionScene(activePreset, current.trackSections ?? [], audioTime)
      const state = selectedSceneId
        ? { ...current.pixGridState, selectedSceneId }
        : current.pixGridState

      renderPixGridBaseline(ctx, {
        width: canvas.width,
        height: canvas.height,
        audioTime,
        bass,
        mid,
        high,
        volume: Math.max(bass, mid, high),
        beatHit,
        beatPhase,
        isPlaying: shouldAnimate,
        motion: current.motion,
        intensity: current.intensity,
        glow: current.glow,
        bassReactivity: current.bassReactivity,
      }, activePreset, state)

      renderedStoppedFrame = !shouldAnimate
      frameCount += 1
      const elapsed = now - fpsWindowStarted
      if (elapsed >= 1000) {
        fpsReporter.report(frameCount * 1000 / elapsed)
        frameCount = 0
        fpsWindowStarted = now
      }
      if (shouldAnimate) lifecycle.setAnimationFrame(requestAnimationFrame(render))
      else fpsReporter.unavailable()
    }

    lifecycle.setAnimationFrame(requestAnimationFrame(render))
    return () => ownership.retire('unmount')
  }, [
    props.activePreset?.id,
    props.bassReactivity,
    props.glow,
    props.intensity,
    props.isPaused,
    props.isPlaying,
    props.motion,
    props.pixGridState,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="rv-preview-canvas rv-pix-grid-surface"
      role="img"
      aria-label={props.activePreset ? `PixGrid visualization: ${props.activePreset.name}` : 'PixGrid visualization'}
      data-authoring={props.pixGridState.authoringOverlayVisible ? 'true' : undefined}
      data-pix-grid-matrix={`${props.pixGridState.matrixWidth}x${props.pixGridState.matrixHeight}`}
    />
  )
}

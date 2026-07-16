import { useEffect, useRef, useState } from 'react'
import type { ReactPreset, ReactTrackSection } from '../ReactTypes'
import { createLiveFpsReporter } from '../fpsDiagnostics'
import { acquireReactLiveEngineOwnership } from '../renderers/ReactLiveEngineOwnership'
import { applyCanvasResolution, resolveCanvasResolution, type CanvasResolution } from '../rendering/canvasResolution'
import {
  disposePixGridBaselineRenderer,
  renderPixGridCanvasFallback,
  type PixGridBaselineRenderFrame,
} from '../renderers/pixGrid/PixGridBaselineRenderer'
import { PixGridGpuRenderer } from '../renderers/pixGrid/PixGridGpuRenderer'
import { resolvePixGridFallbackResolution } from '../renderers/pixGrid/PixGridRenderMath'
import { createPixGridRendererLifecycle } from '../renderers/pixGrid/PixGridRendererLifecycle'
import type {
  PixGridQualityTier,
  PixGridRendererDiagnostics,
  PixGridState,
} from './PixGridTypes'

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
  effectiveBpm?: number
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  onDiagnostics?: (diagnostics: PixGridRendererDiagnostics) => void
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

const EMPTY_DIAGNOSTICS: PixGridRendererDiagnostics = {
  path: 'canvas2d-fallback',
  logicalWidth: 96,
  logicalHeight: 54,
  presentationWidth: 0,
  presentationHeight: 0,
  fps: 0,
  logicalFramebufferAllocated: false,
  logicalAllocationCount: 0,
  contextState: 'unavailable',
  fallbackReason: null,
  approximateGpuResourceCount: 0,
}

function diagnosticsEqual(a: PixGridRendererDiagnostics, b: PixGridRendererDiagnostics): boolean {
  return a.path === b.path
    && a.logicalWidth === b.logicalWidth
    && a.logicalHeight === b.logicalHeight
    && a.presentationWidth === b.presentationWidth
    && a.presentationHeight === b.presentationHeight
    && a.fps === b.fps
    && a.logicalFramebufferAllocated === b.logicalFramebufferAllocated
    && a.logicalAllocationCount === b.logicalAllocationCount
    && a.contextState === b.contextState
    && a.fallbackReason === b.fallbackReason
    && a.approximateGpuResourceCount === b.approximateGpuResourceCount
}

export function PixGridSurface(props: PixGridSurfaceProps) {
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  const requestRenderRef = useRef<(force?: boolean) => void>(() => {})
  const retryGpuRef = useRef<() => void>(() => {})
  const [diagnostics, setDiagnostics] = useState<PixGridRendererDiagnostics>(EMPTY_DIAGNOSTICS)
  propsRef.current = props
  const hasActivePreset = props.activePreset != null

  useEffect(() => {
    const gpuCanvas = gpuCanvasRef.current
    const fallbackCanvas = fallbackCanvasRef.current
    const preset = propsRef.current.activePreset
    if (!gpuCanvas || !fallbackCanvas || !preset) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }

    const fallbackContext = fallbackCanvas.getContext('2d', { alpha: false })
    const logicalCanvas = document.createElement('canvas')
    const logicalContext = logicalCanvas.getContext('2d', { alpha: true })
    if (!fallbackContext || !logicalContext) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }

    let resolution: CanvasResolution | null = null
    let frequencyData: Uint8Array<ArrayBuffer> | null = null
    let lastBass = 0
    let lastMid = 0
    let lastHigh = 0
    let beatLatch = false
    let snareLatch = false
    let hatLatch = false
    let animationFrame = 0
    let gpuRenderer: PixGridGpuRenderer | null = null
    let activePath: PixGridRendererDiagnostics['path'] = 'canvas2d-fallback'
    let fallbackReason: string | null = null
    let forcedRender = false
    let frameCount = 0
    let fpsWindowStarted = performance.now()
    let lastFps = 0
    let lastDiagnostics = EMPTY_DIAGNOSTICS
    let mounted = true

    const fpsReporter = createLiveFpsReporter(() => propsRef.current.onLiveFps)

    const publishDiagnostics = (next: PixGridRendererDiagnostics) => {
      lastDiagnostics = next
      propsRef.current.onDiagnostics?.(next)
      if (mounted) setDiagnostics(previous => diagnosticsEqual(previous, next) ? previous : next)
    }

    const activatePath = (path: PixGridRendererDiagnostics['path'], reason: string | null) => {
      activePath = path
      fallbackReason = reason
      gpuCanvas.hidden = path !== 'webgl2'
      fallbackCanvas.hidden = path !== 'canvas2d-fallback'
      propsRef.current.onCanvasReady?.(path === 'webgl2' ? gpuCanvas : fallbackCanvas)
    }

    const currentFrameInput = (): {
      frame: PixGridBaselineRenderFrame
      state: PixGridState
      blackout: boolean
      preset: ReactPreset
    } | null => {
      const current = propsRef.current
      const activePreset = current.activePreset
      if (!activePreset) return null
      const shouldAnimate = current.isPlaying
      const analyser = shouldAnimate ? current.analyser : null
      if (analyser) {
        if (!frequencyData || frequencyData.length !== analyser.frequencyBinCount) {
          frequencyData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        }
        analyser.getByteFrequencyData(frequencyData)
      }
      const bins = frequencyData?.length ?? 0
      const bass = analyser && frequencyData
        ? averageRange(frequencyData, 0, Math.max(1, Math.floor(bins * 0.12)))
        : 0
      const mid = analyser && frequencyData
        ? averageRange(frequencyData, Math.floor(bins * 0.12), Math.floor(bins * 0.45))
        : 0
      const high = analyser && frequencyData
        ? averageRange(frequencyData, Math.floor(bins * 0.45), bins)
        : 0
      const beatHit = shouldAnimate && bass > 0.58 && bass > lastBass + 0.055 && !beatLatch
      const snareHit = shouldAnimate && mid > 0.46 && mid > lastMid + 0.045 && !snareLatch
      const hatHit = shouldAnimate && high > 0.3 && high > lastHigh + 0.035 && !hatLatch
      beatLatch = shouldAnimate && bass > 0.46
      snareLatch = shouldAnimate && mid > 0.36
      hatLatch = shouldAnimate && high > 0.23
      if (!shouldAnimate || bass < 0.34) beatLatch = false
      if (!shouldAnimate || mid < 0.28) snareLatch = false
      if (!shouldAnimate || high < 0.17) hatLatch = false
      lastBass = bass
      lastMid = mid
      lastHigh = high
      const sampledAudioTime = shouldAnimate ? current.getAudioTime() : 0
      const audioTime = Number.isFinite(sampledAudioTime) ? sampledAudioTime : 0
      const effectiveBpm = Number.isFinite(current.effectiveBpm) ? Math.max(1, current.effectiveBpm!) : 120
      const musicalBeat = audioTime * effectiveBpm / 60
      const beatPhase = ((musicalBeat % 1) + 1) % 1
      const beatIndex = Math.max(0, Math.floor(musicalBeat))
      const selectedSceneId = resolveSectionScene(activePreset, current.trackSections ?? [], audioTime)
      const state = selectedSceneId
        ? { ...current.pixGridState, selectedSceneId }
        : current.pixGridState
      return {
        preset: activePreset,
        state,
        blackout: !shouldAnimate && state.stoppedBehavior === 'blackout',
        frame: {
          width: activePath === 'webgl2' ? gpuCanvas.width : fallbackCanvas.width,
          height: activePath === 'webgl2' ? gpuCanvas.height : fallbackCanvas.height,
          audioTime,
          bass,
          mid,
          high,
          volume: Math.max(bass, mid, high),
          beatHit,
          kickHit: beatHit,
          snareHit,
          hatHit,
          beatPhase,
          beatIndex,
          isPlaying: shouldAnimate,
          motion: current.motion,
          intensity: current.intensity,
          glow: current.glow,
          bassReactivity: current.bassReactivity,
        },
      }
    }

    const renderFallback = (input: NonNullable<ReturnType<typeof currentFrameInput>>) => {
      const frame = input.blackout
        ? { ...input.frame, intensity: 0 }
        : input.frame
      const fallbackState = input.blackout
        ? { ...input.state, backgroundMode: 'black' as const, backgroundBrightness: 0 }
        : input.state
      const fallbackLogical = renderPixGridCanvasFallback(
        fallbackContext,
        { canvas: logicalCanvas, context: logicalContext },
        frame,
        input.preset,
        fallbackState,
      )
      publishDiagnostics({
        path: 'canvas2d-fallback',
        logicalWidth: fallbackLogical.logicalWidth,
        logicalHeight: fallbackLogical.logicalHeight,
        presentationWidth: fallbackCanvas.width,
        presentationHeight: fallbackCanvas.height,
        fps: lastFps,
        logicalFramebufferAllocated: false,
        logicalAllocationCount: 0,
        contextState: gpuRenderer?.diagnostics.contextState ?? 'unavailable',
        fallbackReason,
        approximateGpuResourceCount: gpuRenderer?.diagnostics.approximateGpuResourceCount ?? 0,
      })
    }

    const requestRender = (force = false) => {
      forcedRender = forcedRender || force
      if (animationFrame || lifecycle.disposed || !ownership.isCurrent()) return
      if (propsRef.current.isPaused && !forcedRender) return
      animationFrame = requestAnimationFrame(render)
      lifecycle.setAnimationFrame(animationFrame)
    }

    const render = (now: number) => {
      animationFrame = 0
      if (lifecycle.disposed || !ownership.isCurrent()) return
      const force = forcedRender
      forcedRender = false
      const current = propsRef.current
      if (current.isPaused && !force) {
        lastFps = 0
        fpsReporter.unavailable()
        publishDiagnostics({ ...lastDiagnostics, fps: 0 })
        return
      }

      const input = currentFrameInput()
      if (!input) return
      let rendered = false
      if (activePath === 'webgl2' && gpuRenderer?.isReady) {
        rendered = gpuRenderer.render({
          frame: input.frame,
          preset: input.preset,
          state: input.blackout
            ? { ...input.state, backgroundMode: 'black', backgroundBrightness: 0 }
            : input.state,
          presentationWidth: gpuCanvas.width,
          presentationHeight: gpuCanvas.height,
          blackout: input.blackout,
        })
        if (rendered) {
          const gpuDiagnostics = gpuRenderer.diagnostics
          publishDiagnostics({ ...gpuDiagnostics, fps: lastFps })
        }
      }
      if (!rendered) {
        if (activePath !== 'canvas2d-fallback') {
          activatePath('canvas2d-fallback', fallbackReason ?? 'The PixGrid GPU renderer is temporarily unavailable.')
        }
        renderFallback(input)
      }

      frameCount += 1
      const elapsed = now - fpsWindowStarted
      if (elapsed >= 1000) {
        lastFps = current.isPlaying ? Math.round(frameCount * 1000 / elapsed) : 0
        fpsReporter.report(lastFps)
        frameCount = 0
        fpsWindowStarted = now
        publishDiagnostics({ ...lastDiagnostics, fps: lastFps })
      }
      if (current.isPlaying && !current.isPaused) requestRender()
      else fpsReporter.unavailable()
    }

    const createGpuRenderer = () => {
      gpuRenderer?.dispose()
      gpuRenderer = null
      const result = PixGridGpuRenderer.create(gpuCanvas, {
        onContextLost: () => {
          activatePath('canvas2d-fallback', 'PixGrid WebGL context was lost. Canvas2D fallback is active while recovery is attempted.')
          requestRender(true)
        },
        onContextRestored: () => {
          activatePath('webgl2', null)
          requestRender(true)
        },
        onContextRestoreFailed: reason => {
          activatePath('canvas2d-fallback', `PixGrid context restoration failed: ${reason}`)
          requestRender(true)
        },
      })
      if (result.renderer) {
        gpuRenderer = result.renderer
        activatePath('webgl2', null)
        publishDiagnostics({
          ...result.renderer.diagnostics,
          presentationWidth: gpuCanvas.width,
          presentationHeight: gpuCanvas.height,
          fps: lastFps,
        })
      } else {
        activatePath('canvas2d-fallback', result.error)
        const fallbackResolution = resolvePixGridFallbackResolution(propsRef.current.pixGridState.quality)
        publishDiagnostics({
          path: 'canvas2d-fallback',
          logicalWidth: fallbackResolution.width,
          logicalHeight: fallbackResolution.height,
          presentationWidth: fallbackCanvas.width,
          presentationHeight: fallbackCanvas.height,
          fps: lastFps,
          logicalFramebufferAllocated: false,
          logicalAllocationCount: 0,
          contextState: 'unavailable',
          fallbackReason: result.error,
          approximateGpuResourceCount: 0,
        })
      }
      requestRender()
    }

    const resize = () => {
      const bounds = gpuCanvas.getBoundingClientRect()
      const next = resolveCanvasResolution({
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        devicePixelRatio: window.devicePixelRatio,
        quality: canvasQuality(propsRef.current.pixGridState.quality),
        previous: resolution,
      })
      if (!next.valid) return
      applyCanvasResolution(gpuCanvas, next)
      applyCanvasResolution(fallbackCanvas, next)
      resolution = next
      requestRender()
    }

    const lifecycle = createPixGridRendererLifecycle(() => {
      mounted = false
      gpuRenderer?.dispose()
      gpuRenderer = null
      disposePixGridBaselineRenderer()
      propsRef.current.onCanvasReady?.(null)
      fpsReporter.unavailable()
      propsRef.current.onDiagnostics?.({ ...lastDiagnostics, fps: 0 })
      requestRenderRef.current = () => {}
      retryGpuRef.current = () => {}
    })
    const ownership = acquireReactLiveEngineOwnership('pixGrid', () => lifecycle.dispose())

    requestRenderRef.current = requestRender
    retryGpuRef.current = createGpuRenderer
    const observer = new ResizeObserver(resize)
    lifecycle.setResizeObserver(observer)
    observer.observe(gpuCanvas)
    resize()
    createGpuRenderer()
    ownership.markStable()

    return () => ownership.retire('unmount')
  }, [hasActivePreset])

  useEffect(() => {
    requestRenderRef.current()
  }, [
    props.activePreset,
    props.bassReactivity,
    props.glow,
    props.intensity,
    props.isPaused,
    props.isPlaying,
    props.motion,
    props.pixGridState,
    props.trackSections,
  ])

  const fallbackActive = diagnostics.path === 'canvas2d-fallback'
  return (
    <div
      className="rv-pix-grid-surface-host"
      role="img"
      aria-label={props.activePreset ? `PixGrid visualization: ${props.activePreset.name}` : 'PixGrid visualization'}
      data-authoring={props.pixGridState.authoringOverlayVisible ? 'true' : undefined}
      data-pix-grid-matrix={`${props.pixGridState.matrixWidth}x${props.pixGridState.matrixHeight}`}
      data-pix-grid-renderer={diagnostics.path}
      data-pix-grid-context={diagnostics.contextState}
      data-pix-grid-presentation={`${diagnostics.presentationWidth}x${diagnostics.presentationHeight}`}
      data-pix-grid-resources={diagnostics.approximateGpuResourceCount}
    >
      <canvas
        ref={gpuCanvasRef}
        className="rv-preview-canvas rv-pix-grid-surface rv-pix-grid-surface--gpu"
        hidden={fallbackActive}
      />
      <canvas
        ref={fallbackCanvasRef}
        className="rv-preview-canvas rv-pix-grid-surface rv-pix-grid-surface--fallback"
        hidden={!fallbackActive}
      />
      {fallbackActive && diagnostics.fallbackReason && (
        <div className="rv-pix-grid-diagnostic" role="status" aria-live="polite">
          <span>{diagnostics.fallbackReason}</span>
          <button type="button" onClick={() => retryGpuRef.current()}>Retry GPU</button>
        </div>
      )}
    </div>
  )
}

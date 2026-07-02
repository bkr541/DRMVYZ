import { useRef, useEffect } from 'react'
import { AudioFeatureBus }        from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { ReactFrameContext }  from './renderers/reactRenderUtils'
import type { ReactTrackSection, ReactPerformancePadTransition } from './ReactTypes'
import { resolvePerformancePadTransition } from './renderers/reactPresetTransition'
import { ShaderWebGLRuntime }      from './shaders/runtime/ShaderWebGLRuntime'
import { ShaderEngineRenderer }    from './shaders/ShaderEngineRenderer'
import type { ShaderMasterParams } from './shaders/ShaderEngineRenderer'
import { useShaderPanelStore }     from './shaders/ui/shaderPanelStore'
import { DEFAULT_SHADER_SCENE_ID } from './shaders/scenes'
import { shaderRegistry }          from './shaders/registry'
import type { ActiveBrandOverlay } from '../../../features/personalization/brandAssetCompositor'
import { compositeBrandAsset } from '../../../features/personalization/brandAssetCompositor'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  analyser:          AnalyserNode | null
  intensity?:        number
  motion?:           number
  glow?:             number
  bassReactivity?:   number
  trailDecay?:       number
  fogDensity?:       number
  particleDensity?:  number
  performancePadTransition?: ReactPerformancePadTransition | null
  isPlaying:         boolean
  /** True when playback is paused at a non-terminal playhead position. */
  isPaused?:         boolean
  getAudioTime?:     () => number
  effectiveBpm?:     number | null
  durationSec?:      number
  trackSections?:    ReactTrackSection[]
  onCanvasReady?:    (canvas: HTMLCanvasElement | null) => void
  onLiveFps?:        (fps: number) => void
  brandOverlay?:      ActiveBrandOverlay | null
}

// ── ReactShaderCanvas ─────────────────────────────────────────────────────────

/**
 * Dedicated WebGL2 canvas for the GLSL Shader engine.
 *
 * Owns the rAF loop, audio sampling, Music Intelligence pump, ReactFrameContext
 * construction, and ShaderEngineRenderer lifecycle.
 *
 * Critical ownership rules:
 * - All frame callbacks read from `rendererRef.current` (never a closed-over
 *   constant) so context-restoration can swap in a fresh renderer seamlessly.
 * - Context restoration calls `disposeAfterContextLoss()` instead of `dispose()`
 *   to avoid re-losing the freshly restored context via WEBGL_lose_context.
 * - The WebGL runtime owns drawing-buffer resolution; this component must not
 *   overwrite canvas.width/canvas.height directly.
 */
export function ReactShaderCanvas({
  analyser,
  intensity       = 1.0,
  motion          = 1.0,
  glow            = 0.5,
  bassReactivity  = 0.7,
  trailDecay      = 0.08,
  fogDensity      = 0.5,
  particleDensity = 0.5,
  performancePadTransition = null,
  isPlaying,
  isPaused         = false,
  getAudioTime,
  effectiveBpm    = null,
  durationSec     = 0,
  trackSections   = [],
  onCanvasReady,
  onLiveFps,
  brandOverlay = null,
}: Props) {
  const activeShaderId = useShaderPanelStore(s => s.activeShaderId)
  const activeShaderName = shaderRegistry.get(activeShaderId ?? DEFAULT_SHADER_SCENE_ID)?.name
    ?? 'Shader scene'
  const canvasLabel = `Shader Engine visualization: ${activeShaderName}`
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const outputCanvasRef = useRef<HTMLCanvasElement>(null)
  const animRef     = useRef<number>(0)
  const rendererRef = useRef<ShaderEngineRenderer | null>(null)
  // Whether rAF is paused due to context loss
  const pausedRef   = useRef(false)

  // Audio analyser buffers
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const freqBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const audioTimeRef = useRef(0)
  const tRef         = useRef(0)

  // Mutable refs — rAF loop reads these so we don't need to restart on prop change
  const intensityRef        = useRef(intensity)
  const motionRef           = useRef(motion)
  const glowRef             = useRef(glow)
  const bassReactRef        = useRef(bassReactivity)
  const trailDecayRef       = useRef(trailDecay)
  const fogDensityRef       = useRef(fogDensity)
  const particleDensityRef  = useRef(particleDensity)
  const performancePadTransitionRef = useRef<ReactPerformancePadTransition | null>(performancePadTransition)
  const isPlayingRef        = useRef(isPlaying)
  const isPausedRef         = useRef(isPaused)
  const effectiveBpmRef     = useRef<number | null>(effectiveBpm)
  const durationSecRef      = useRef(durationSec)
  const trackSectionsRef    = useRef(trackSections)
  const getAudioTimeRef     = useRef(getAudioTime)
  const onCanvasReadyRef    = useRef(onCanvasReady)
  const onLiveFpsRef        = useRef(onLiveFps)
  const brandOverlayRef      = useRef<ActiveBrandOverlay | null>(brandOverlay)

  // Keep refs current every render
  intensityRef.current       = intensity
  motionRef.current          = motion
  glowRef.current            = glow
  bassReactRef.current       = bassReactivity
  trailDecayRef.current      = trailDecay
  fogDensityRef.current      = fogDensity
  particleDensityRef.current = particleDensity
  performancePadTransitionRef.current = performancePadTransition
  isPlayingRef.current       = isPlaying
  isPausedRef.current         = isPaused
  effectiveBpmRef.current    = effectiveBpm
  durationSecRef.current     = durationSec
  trackSectionsRef.current   = trackSections
  getAudioTimeRef.current    = getAudioTime
  onCanvasReadyRef.current   = onCanvasReady
  onLiveFpsRef.current       = onLiveFps
  brandOverlayRef.current     = brandOverlay

  // Sync analyser buffers on change
  useEffect(() => {
    analyserRef.current = analyser
    if (analyser) {
      freqBufRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      timeBufRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
    } else {
      freqBufRef.current = null
      timeBufRef.current = null
    }
  }, [analyser])

  // Main effect: create WebGL2 runtime + renderer, rAF loop
  useEffect(() => {
    const canvas = canvasRef.current
    const outputCanvas = outputCanvasRef.current
    const outputCtx = outputCanvas?.getContext('2d') ?? null
    if (!canvas || !outputCanvas || !outputCtx) return
    const sourceCanvas: HTMLCanvasElement = canvas
    const visibleCanvas: HTMLCanvasElement = outputCanvas
    const visibleCtx: CanvasRenderingContext2D = outputCtx

    // Ensure a default scene is selected
    const store = useShaderPanelStore.getState()
    if (!store.activeShaderId) {
      store.setActiveShaderId(DEFAULT_SHADER_SCENE_ID)
    }

    // Cached layout dimensions (CSS pixels) for resize + context restore
    let lastCssW = 0
    let lastCssH = 0
    let lastDevicePixelRatio = 1

    function createRenderer(): ShaderEngineRenderer | null {
      const { runtime, error } = ShaderWebGLRuntime.create(sourceCanvas, {
        onContextLost: () => {
          pausedRef.current = true
          cancelAnimationFrame(animRef.current)
        },
        ownership: {
          lifetime: 'live-reusable',
          role: 'react-preview',
          engine: 'shader-engine',
        },
        onContextRestored: () => {
          // The old renderer's GL handles are all invalid.  Use disposeAfterContextLoss()
          // instead of dispose() to avoid re-losing the freshly restored context via loseContext().
          rendererRef.current?.disposeAfterContextLoss()

          const newRenderer = createRenderer()
          if (!newRenderer) return

          rendererRef.current  = newRenderer
          pausedRef.current    = false

          // Restore active scene
          const s = useShaderPanelStore.getState()
          const sceneId = s.activeShaderId ?? DEFAULT_SHADER_SCENE_ID
          s.setActiveShaderId(null)
          s.setActiveShaderId(sceneId)

          // Resize with last known CSS dimensions
          if (lastCssW > 0 && lastCssH > 0) {
            newRenderer.resize(lastCssW, lastCssH, lastDevicePixelRatio)
          }

          // Resume rAF
          animRef.current = requestAnimationFrame(frame)
        },
      })

      if (!runtime) {
        if (import.meta.env.DEV) console.warn('[ReactShaderCanvas] WebGL2 unavailable:', error)
        return null
      }

      return new ShaderEngineRenderer(runtime)
    }

    const initialRenderer = createRenderer()
    if (!initialRenderer) return

    rendererRef.current = initialRenderer
    onCanvasReadyRef.current?.(visibleCanvas)

    // ResizeObserver — reads from rendererRef.current so it stays valid across restores
    function resize() {
      if (pausedRef.current) return
      const renderer = rendererRef.current
      if (!renderer) return
      const r = visibleCanvas.getBoundingClientRect()
      if (!Number.isFinite(r.width) || !Number.isFinite(r.height)) return
      if (r.width <= 0 || r.height <= 0) return
      lastCssW = r.width
      lastCssH = r.height
      lastDevicePixelRatio = window.devicePixelRatio
      renderer.resize(r.width, r.height, lastDevicePixelRatio)
      // The runtime owns the hidden WebGL buffer. The visible 2D output mirrors
      // that exact buffer so recordings and screenshots include the compositor.
      visibleCanvas.width = sourceCanvas.width
      visibleCanvas.height = sourceCanvas.height
    }

    // Transactional setup: create observer, perform guarded first resize, then
    // start rAF — if any step fails the cleanup function is still returned so
    // the observer is always disconnected.
    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(resize)
      ro.observe(visibleCanvas)
      resize()
    } catch (err) {
      ro?.disconnect()
      rendererRef.current?.dispose()
      rendererRef.current = null
      if (import.meta.env.DEV) {
        console.error('[ReactShaderCanvas] setup failed:', err)
      }
      useShaderPanelStore.getState().setCompileError(String(err))
      return
    }

    // FPS tracking
    let fpsCount  = 0
    let fpsLastMs = performance.now()

    // Beat tracking for fallback
    let beatPhase = 0
    let prevBass  = 0
    const FALLBACK_BPM = 120
    const beatPeriodMs = 60000 / FALLBACK_BPM

    let lastFrameMs = performance.now()
    let cinematicElapsedSec = 0
    let forceTimingReset = false
    const handleVisibilityChange = () => {
      lastFrameMs = performance.now()
      forceTimingReset = true
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Track last resolved section to detect changes (for pulse signal)
    let lastSectionType: string | null = null
    let lastSectionStart = -1

    function frame(now: number) {
      if (pausedRef.current) return

      // Freeze the WebGL drawing buffer and all transport-driven shader state
      // while paused. Keeping the rAF heartbeat alive avoids a large resume
      // delta and lets context-loss handling continue to work normally.
      if (isPausedRef.current) {
        lastFrameMs = now
        fpsCount = 0
        fpsLastMs = now
        if (visibleCanvas.width !== sourceCanvas.width || visibleCanvas.height !== sourceCanvas.height) {
          visibleCanvas.width = sourceCanvas.width
          visibleCanvas.height = sourceCanvas.height
        }
        visibleCtx.globalCompositeOperation = 'source-over'
        visibleCtx.globalAlpha = 1
        visibleCtx.drawImage(sourceCanvas, 0, 0, visibleCanvas.width, visibleCanvas.height)
        compositeBrandAsset(visibleCtx, brandOverlayRef.current, {
          width: visibleCanvas.width,
          height: visibleCanvas.height,
          audioTime: audioTimeRef.current,
          durationSec: durationSecRef.current,
          audioEnergy: 0,
          sectionType: null,
        })
        animRef.current = requestAnimationFrame(frame)
        return
      }

      const rawDeltaMs = now - lastFrameMs
      lastFrameMs = now
      const timingDiscontinuity = forceTimingReset || !Number.isFinite(rawDeltaMs) || rawDeltaMs < 0 || rawDeltaMs > 250
      forceTimingReset = false
      const deltaMs = timingDiscontinuity ? 0 : Math.min(rawDeltaMs, 100)
      cinematicElapsedSec += deltaMs / 1000

      fpsCount++
      if (now - fpsLastMs >= 1000) {
        onLiveFpsRef.current?.(fpsCount)
        fpsCount  = 0
        fpsLastMs = now
      }

      tRef.current++

      // Sample audio
      const an   = analyserRef.current
      const buf  = freqBufRef.current
      const tBuf = timeBufRef.current

      let bass = 0.05, mid = 0.05, high = 0.05, vol = 0.05
      let freqData: Uint8Array<ArrayBuffer> | null = null
      let timeDomainData: Uint8Array<ArrayBuffer> | null = null

      if (an && buf) {
        an.getByteFrequencyData(buf)
        if (tBuf) an.getByteTimeDomainData(tBuf)
        freqData       = buf
        timeDomainData = tBuf ?? null

        const binCount = buf.length
        const bassBins = Math.floor(binCount * 0.08)
        const midBins  = Math.floor(binCount * 0.30)
        let bSum = 0, mSum = 0, hSum = 0, vSum = 0
        for (let i = 0;        i < bassBins; i++) { bSum += buf[i]; vSum += buf[i] }
        for (let i = bassBins; i < midBins;  i++) { mSum += buf[i]; vSum += buf[i] }
        for (let i = midBins;  i < binCount; i++) { hSum += buf[i]; vSum += buf[i] }
        bass = bSum / bassBins / 255
        mid  = mSum / (midBins - bassBins) / 255
        high = hSum / (binCount - midBins)  / 255
        vol  = vSum / binCount / 255

        const freshTime = getAudioTimeRef.current?.()
        if (freshTime !== undefined) {
          audioTimeRef.current = freshTime
        } else if (isPlayingRef.current) {
          audioTimeRef.current += deltaMs / 1000
        }

        musicIntelligenceEngine.updateFromAudioFrame({
          freqBuf:    buf,
          timeBuf:    tBuf,
          sampleRate: an.context.sampleRate,
          audioTime:  audioTimeRef.current,
          isPlaying:  isPlayingRef.current,
        })
      }

      const miFrame = AudioFeatureBus.getFrame()
      const hasMI   = miFrame.frameId > 0

      // Resolve the current section from the merged track timeline; MI is a fallback only.
      const audioTimeSec = audioTimeRef.current
      const sections = trackSectionsRef.current
      const trackSection = sections.find(
        s => s.startSec <= audioTimeSec && audioTimeSec < s.endSec,
      ) ?? null

      const resolvedSectionType  = trackSection?.type ?? miFrame.section?.type ?? null
      const resolvedSectionStart = trackSection?.startSec ?? miFrame.section?.startSec ?? -1
      const resolvedSectionEnd   = trackSection
        ? trackSection.endSec
        : (miFrame.section?.endSec ?? Infinity)
      const resolvedSectionSource = trackSection
        ? (trackSection.source === 'user-created' || trackSection.source === 'user-edited-auto'
            ? 'manual'
            : trackSection.source === 'auto' ? 'analysis' : 'inferred')
        : miFrame.section?.source
      const resolvedProgress = trackSection
        ? (resolvedSectionEnd > resolvedSectionStart
            ? Math.max(0, Math.min(1, (audioTimeSec - resolvedSectionStart) / (resolvedSectionEnd - resolvedSectionStart)))
            : 0)
        : (miFrame.section?.progress ?? -1)

      const sectionChanged = resolvedSectionType !== lastSectionType ||
        resolvedSectionStart !== lastSectionStart
      if (sectionChanged) {
        lastSectionType  = resolvedSectionType
        lastSectionStart = resolvedSectionStart
      }

      // Resolve BPM and beat phase
      const bpmSrc    = effectiveBpmRef.current
      const activeBpm = (bpmSrc != null && bpmSrc > 0) ? bpmSrc
                      : (hasMI && miFrame.rhythm.bpm > 0) ? miFrame.rhythm.bpm
                      : 0

      let beatHit = false
      let activeBeatPhase: number

      if (hasMI && miFrame.rhythm.beatPhase !== undefined) {
        activeBeatPhase = miFrame.rhythm.beatPhase
        beatHit         = miFrame.rhythm.beatHit ?? false
      } else {
        const bassDelta = bass - prevBass
        if (bassDelta > 0.15 && bass > 0.4) { beatPhase = 0; beatHit = true }
        prevBass    = bass
        beatPhase  += deltaMs / beatPeriodMs
        if (beatPhase > 1) beatPhase -= Math.floor(beatPhase)
        activeBeatPhase = beatPhase
      }

      const W = sourceCanvas.width  || 1
      const H = sourceCanvas.height || 1

      const rfCtx: ReactFrameContext = {
        W,
        H,
        dpr:       rendererRef.current?.effectivePixelRatio ?? 1,
        t:         tRef.current,
        elapsedTimeSec: cinematicElapsedSec,
        deltaTimeSec: deltaMs / 1000,
        timingDiscontinuity,
        timeSec:   now / 1000,
        audioTime: audioTimeRef.current,
        bpm:       activeBpm,
        beatPhase: activeBeatPhase,
        beatHit,
        isPlaying: isPlayingRef.current,
        isPaused:  isPausedRef.current,
        audio: { bass, mid, high, volume: vol },
        freqData,
        timeDomainData,
        musicIntelligence: hasMI ? miFrame : null,
        // Pass manual-section-override-aware section (with progress) to the renderer.
        resolvedSection: resolvedSectionType !== null
          ? {
              type:     resolvedSectionType,
              startSec: resolvedSectionStart,
              endSec:   resolvedSectionEnd,
              progress: resolvedProgress,
              source:   resolvedSectionSource,
            }
          : null,
        sectionChanged,
      }

      const master: ShaderMasterParams = resolvePerformancePadTransition({
        intensity:       intensityRef.current,
        motion:          motionRef.current,
        glow:            glowRef.current,
        bassReactivity:  bassReactRef.current,
        trailDecay:      trailDecayRef.current,
        fogDensity:      fogDensityRef.current,
        particleDensity: particleDensityRef.current,
      }, performancePadTransitionRef.current, now)

      // Read from rendererRef.current — NEVER from the closed-over `initialRenderer`
      // so context-restoration can swap in a new renderer transparently.
      rendererRef.current?.render(rfCtx, durationSecRef.current, master)

      if (visibleCanvas.width !== sourceCanvas.width || visibleCanvas.height !== sourceCanvas.height) {
        visibleCanvas.width = sourceCanvas.width
        visibleCanvas.height = sourceCanvas.height
      }
      visibleCtx.globalCompositeOperation = 'source-over'
      visibleCtx.globalAlpha = 1
      visibleCtx.drawImage(sourceCanvas, 0, 0, visibleCanvas.width, visibleCanvas.height)
      compositeBrandAsset(visibleCtx, brandOverlayRef.current, {
        width: visibleCanvas.width,
        height: visibleCanvas.height,
        audioTime: audioTimeRef.current,
        durationSec: durationSecRef.current,
        audioEnergy: vol,
        sectionType: resolvedSectionType,
      })

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      ro!.disconnect()
      // Dispose whatever renderer is currently live (may differ from initialRenderer
      // if context restoration replaced it)
      rendererRef.current?.dispose()
      rendererRef.current = null
      onCanvasReadyRef.current?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      <canvas
        ref={outputCanvasRef}
        role="img"
        aria-label={canvasLabel}
        style={{ display: 'block', width: '100%', height: '100%', background: '#000' }}
      >
        {canvasLabel}. Animated visual output is not described frame by frame.
      </canvas>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

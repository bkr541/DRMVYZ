import { useRef, useEffect } from 'react'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { LyricPlaybackBus } from '../../../features/lyrics/runtime/LyricPlaybackBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type {
  ReactEngineId,
  ReactPreset,
  ReactTrackSection,
  OscillatorSettings,
  OscillatorFontAsset,
  OscillatorGlyphAsset,
  OscillatorGlyphPoint,
  SoundDrawingLayer,
  SoundDrawingClip,
  ReactPerformancePadTransition,
} from './ReactTypes'
import { isSelectableReactEngineId } from './reactEngineCatalog'
import type { ReactPerformanceActionEvent } from './ReactPerformanceActions'
import type { TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { DEFAULT_OSCILLATOR_SETTINGS } from './ReactTypes'
import {
  DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  type SoundDrawingPerformanceSettings,
} from './soundDrawing/SoundDrawingPerformanceTypes'
import {
  resolveAuthoritativeFrameSection,
  type ReactFrameContext,
  type ReactRenderParams,
} from './renderers/reactRenderUtils'
import {
  DEFAULT_REACT_RENDER_PARAMS,
  disposeReactEngineRenderer,
  renderReactEngine,
} from './renderers/ReactEngineRenderer'
import { resolveCinematicPortalBackend } from './renderers/CinematicPortalRenderer'
import { acquireReactLiveEngineOwnership } from './renderers/ReactLiveEngineOwnership'
import { assertDrmvyzWebGLContextOwnershipBoundsForDevelopment } from './shaders/runtime/WebGLContextLifecycle'
import { clearSoundDrawingRuntimeCaches, setSoundDrawingClipsForFrame } from './renderers/SoundDrawingRenderer'
import { resolvePerformancePadTransition } from './renderers/reactPresetTransition'
import { createLiveFpsReporter } from './fpsDiagnostics'
import { applyCanvasResolution, resolveCanvasResolution, type CanvasResolution } from './rendering/canvasResolution'
import type { ActiveBrandOverlay } from '../../../features/personalization/brandAssetCompositor'
import { compositeBrandAsset } from '../../../features/personalization/brandAssetCompositor'
import type { StereoScopeAudioTap } from '../../../audio/scope/StereoScopeAudioTap'
import { resolveScopeCaptureRequestFrames } from './renderers/soundDrawingScopeGeometry'
import { soundDrawingPerformanceShowProfessionalScopeLayers } from './soundDrawing/SoundDrawingPerformanceShows'
import {
  professionalScopeCaptureFrames,
  resolveProfessionalScopeLayerSettings,
} from './soundDrawing/SoundDrawingProfessionalScopeLayer'

const ENGINE_ACCESSIBLE_LABELS: Record<ReactEngineId, string> = {
  shaderPads:      'Shader',
  cinematicPortal: 'Cinematic Worlds',
  oscilloscope:    'Sound Drawing',
  canvas:          'CANVAS',
  laserDmx:        'LaserDMX',
  pixGrid:         'PixGrid',
}

interface Props {
  analyser:           AnalyserNode | null
  /**
   * Synchronized stereo capture for Sound Drawing's professional scope modes.
   * Optional and best-effort — rendering never depends on it being available.
   */
  scopeStereoTap?:    StereoScopeAudioTap | null
  /** Stable ownership boundary for the mounted live renderer. */
  engine:             Exclude<ReactEngineId, 'shaderPads' | 'canvas' | 'pixGrid'>
  activePreset:       ReactPreset | null
  intensity:          number
  motion:             number
  glow:               number
  bassReactivity:     number
  trailDecay?:        number
  fogDensity?:        number
  particleDensity?:   number
  performancePadTransition?: ReactPerformancePadTransition | null
  oscillatorSettings?:          OscillatorSettings
  oscillatorFontAssets?:        OscillatorFontAsset[]
  oscillatorGlyphAssets?:       OscillatorGlyphAsset[]
  oscillatorGlyphPointCache?:   Record<string, OscillatorGlyphPoint[]>
  oscillatorTextPointCache?:    Record<string, OscillatorGlyphPoint[]>
  soundDrawingTrailResetRevision?: number
  soundDrawingRibbonResetRevision?: number
  soundDrawingPerformanceSettings?: SoundDrawingPerformanceSettings
  performanceActionEvent?:      ReactPerformanceActionEvent | null
  performanceActionEvents?:     readonly ReactPerformanceActionEvent[]
  performanceActionToggleStates?: Readonly<Record<string, boolean>>
  isPlaying:                    boolean
  /** True when playback is paused at a non-terminal playhead position. */
  isPaused?:                    boolean
  trackSections?:               ReactTrackSection[]
  trackAnalysis?:               TrackIntelligenceAnalysis | null
  getAudioTime?:                () => number
  /**
   * Canonical effective BPM from the audio engine.  When provided and > 0 this
   * becomes the authoritative BPM for the ReactFrameContext.  When null or 0
   * (no track / still analyzing), BPM-driven timing freezes rather than
   * falling back to a hardcoded 120 that misrepresents the track.
   */
  effectiveBpm?:                number | null
  /** Called once when the canvas element is ready for capture, and with null on unmount. */
  onCanvasReady?:               (canvas: HTMLCanvasElement | null) => void
  /** Called approximately once per second with the current render frame rate. */
  onLiveFps?:                   (fps: number) => void
  soundDrawingLayers?:          SoundDrawingLayer[]
  soundDrawingClips?:           SoundDrawingClip[]
  activeAudioTrackId?:          string | null
  brandOverlay?:                ActiveBrandOverlay | null
  durationSec?:                 number
}

export function ReactPlaceholderCanvas({
  analyser,
  scopeStereoTap              = null,
  engine,
  activePreset,
  intensity,
  motion,
  glow,
  bassReactivity,
  trailDecay         = 0.08,
  fogDensity         = 0.5,
  particleDensity    = 0.5,
  performancePadTransition = null,
  oscillatorSettings         = DEFAULT_OSCILLATOR_SETTINGS,
  oscillatorFontAssets        = [] as OscillatorFontAsset[],
  oscillatorGlyphAssets      = [] as OscillatorGlyphAsset[],
  oscillatorGlyphPointCache  = {} as Record<string, OscillatorGlyphPoint[]>,
  oscillatorTextPointCache   = {} as Record<string, OscillatorGlyphPoint[]>,
  soundDrawingTrailResetRevision = 0,
  soundDrawingRibbonResetRevision = 0,
  soundDrawingPerformanceSettings = DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
  performanceActionEvent     = null,
  performanceActionEvents    = [],
  performanceActionToggleStates = {},
  isPlaying,
  isPaused                    = false,
  trackSections              = [],
  trackAnalysis              = null,
  getAudioTime,
  effectiveBpm               = null,
  onCanvasReady,
  onLiveFps,
  soundDrawingLayers         = [] as SoundDrawingLayer[],
  soundDrawingClips          = [] as SoundDrawingClip[],
  activeAudioTrackId         = null,
  brandOverlay               = null,
  durationSec                = 0,
}: Props) {
  const canvasLabel =
    activePreset && isSelectableReactEngineId(activePreset.engine)
    ? `${ENGINE_ACCESSIBLE_LABELS[activePreset.engine]} visualization: ${activePreset.name}`
    : 'React visualization preview'
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const animRef        = useRef<number>(0)
  const analyserRef    = useRef<AnalyserNode | null>(null)
  const scopeTapRef    = useRef<StereoScopeAudioTap | null>(scopeStereoTap)
  const freqBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const tRef           = useRef(0)
  const renderRevisionRef = useRef(0)
  renderRevisionRef.current += 1

  // Mutable refs so the rAF loop reads current values without restarting
  const intensityRef          = useRef(intensity)
  const motionRef             = useRef(motion)
  const glowRef               = useRef(glow)
  const bassReactRef          = useRef(bassReactivity)
  const trailDecayRef         = useRef(trailDecay)
  const fogDensityRef         = useRef(fogDensity)
  const particleDensityRef    = useRef(particleDensity)
  const performancePadTransitionRef = useRef<ReactPerformancePadTransition | null>(performancePadTransition)
  const oscillatorSettingsRef  = useRef(oscillatorSettings)
  const fontAssetsRef          = useRef<OscillatorFontAsset[]>(oscillatorFontAssets)
  const glyphAssetsRef         = useRef<OscillatorGlyphAsset[]>(oscillatorGlyphAssets)
  const glyphPointCacheRef     = useRef<Record<string, OscillatorGlyphPoint[]>>(oscillatorGlyphPointCache)
  const textPointCacheRef      = useRef<Record<string, OscillatorGlyphPoint[]>>(oscillatorTextPointCache)
  const soundDrawingTrailResetRevisionRef = useRef(soundDrawingTrailResetRevision)
  const soundDrawingRibbonResetRevisionRef = useRef(soundDrawingRibbonResetRevision)
  const soundDrawingPerformanceSettingsRef = useRef(soundDrawingPerformanceSettings)
  const performanceActionEventRef = useRef<ReactPerformanceActionEvent | null>(performanceActionEvent)
  const performanceActionEventsRef = useRef<readonly ReactPerformanceActionEvent[]>(performanceActionEvents)
  const performanceActionToggleStatesRef = useRef<Readonly<Record<string, boolean>>>(performanceActionToggleStates)
  const isPlayingRef           = useRef(isPlaying)
  const isPausedRef            = useRef(isPaused)
  const presetRef             = useRef<ReactPreset | null>(activePreset)
  const trackSectionsRef      = useRef<ReactTrackSection[]>(trackSections)
  const trackAnalysisRef      = useRef<TrackIntelligenceAnalysis | null>(trackAnalysis)
  const audioTimeRef          = useRef(0)
  const getAudioTimeRef        = useRef(getAudioTime)
  const effectiveBpmRef        = useRef<number | null>(effectiveBpm)
  const onCanvasReadyRef       = useRef(onCanvasReady)
  const onLiveFpsRef           = useRef(onLiveFps)
  const sdLayersRef            = useRef<SoundDrawingLayer[]>(soundDrawingLayers)
  const sdClipsRef             = useRef<SoundDrawingClip[]>(soundDrawingClips)
  const activeAudioTrackIdRef  = useRef<string | null>(activeAudioTrackId)
  const brandOverlayRef        = useRef<ActiveBrandOverlay | null>(brandOverlay)
  const durationSecRef         = useRef(durationSec)

  // Keep refs current every render
  intensityRef.current          = intensity
  motionRef.current             = motion
  glowRef.current               = glow
  bassReactRef.current          = bassReactivity
  trailDecayRef.current         = trailDecay
  fogDensityRef.current         = fogDensity
  particleDensityRef.current    = particleDensity
  performancePadTransitionRef.current = performancePadTransition
  oscillatorSettingsRef.current  = oscillatorSettings
  fontAssetsRef.current           = oscillatorFontAssets
  glyphAssetsRef.current         = oscillatorGlyphAssets
  glyphPointCacheRef.current     = oscillatorGlyphPointCache
  textPointCacheRef.current      = oscillatorTextPointCache
  soundDrawingTrailResetRevisionRef.current = soundDrawingTrailResetRevision
  soundDrawingRibbonResetRevisionRef.current = soundDrawingRibbonResetRevision
  soundDrawingPerformanceSettingsRef.current = soundDrawingPerformanceSettings
  performanceActionEventRef.current = performanceActionEvent
  performanceActionEventsRef.current = performanceActionEvents
  performanceActionToggleStatesRef.current = performanceActionToggleStates
  isPlayingRef.current           = isPlaying
  isPausedRef.current            = isPaused
  presetRef.current             = activePreset
  trackSectionsRef.current      = trackSections
  trackAnalysisRef.current      = trackAnalysis
  getAudioTimeRef.current        = getAudioTime
  effectiveBpmRef.current        = effectiveBpm
  onCanvasReadyRef.current       = onCanvasReady
  onLiveFpsRef.current           = onLiveFps
  sdLayersRef.current            = soundDrawingLayers
  sdClipsRef.current             = soundDrawingClips
  activeAudioTrackIdRef.current  = activeAudioTrackId
  brandOverlayRef.current         = brandOverlay
  durationSecRef.current          = durationSec
  scopeTapRef.current             = scopeStereoTap

  // Update analyser buffers when analyser changes
  useEffect(() => {
    analyserRef.current = analyser
    if (analyser) {
      freqBufRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      timeBufRef.current = new Uint8Array(analyser.fftSize)             as Uint8Array<ArrayBuffer>
    } else {
      freqBufRef.current = null
      timeBufRef.current = null
    }
  }, [analyser])

  useEffect(() => {
    clearSoundDrawingRuntimeCaches()
  }, [
    oscillatorFontAssets,
    activeAudioTrackId,
    soundDrawingLayers,
    oscillatorSettings.textSource,
    oscillatorSettings.lyricGapBehavior,
    oscillatorSettings.lyricFallbackText,
    oscillatorSettings.text,
    oscillatorSettings.textFontId,
    oscillatorSettings.textLetterSpacing,
    oscillatorSettings.textLineHeight,
    oscillatorSettings.textAlignment,
    oscillatorSettings.pathResolution,
  ])

  // Main rAF loop — stable, no dependencies on changing params (reads refs instead)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ownedEngine = engine

    let disposed = false
    let canvasResolution: CanvasResolution | null = null
    let ro: ResizeObserver | null = null
    let fpsReporter: ReturnType<typeof createLiveFpsReporter> | null = null

    const retireOwnedResources = () => {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(animRef.current)
      animRef.current = 0
      ro?.disconnect()
      try {
        disposeReactEngineRenderer(ctx, ownedEngine, {
          width: canvas.width,
          height: canvas.height,
          affectProductionOutput: true,
        })
      } catch (error) {
        if (import.meta.env.DEV) console.error('[ReactPlaceholderCanvas] renderer disposal failed:', error)
      }
      try {
        clearSoundDrawingRuntimeCaches()
      } catch {
        /* Continue deterministic cleanup. */
      }
      try {
        onCanvasReadyRef.current?.(null)
      } catch {
        /* Parent teardown must not retain renderer ownership. */
      }
      try {
        fpsReporter?.unavailable()
      } catch {
        /* Diagnostic callbacks are non-critical. */
      }
    }
    const ownership = acquireReactLiveEngineOwnership(ownedEngine, retireOwnedResources)

    function resize() {
      if (disposed || !ownership.isCurrent() || !canvas) return
      const r = canvas.getBoundingClientRect()
      const next = resolveCanvasResolution({
        cssWidth: r.width,
        cssHeight: r.height,
        devicePixelRatio: window.devicePixelRatio,
        quality: 'high',
        previous: canvasResolution,
      })
      if (!next.valid) return
      applyCanvasResolution(canvas, next)
      canvasResolution = next
    }
    try {
      ro = new ResizeObserver(resize)
      ro.observe(canvas)
      resize()
    } catch (error) {
      ownership.retire('setup-failed')
      if (import.meta.env.DEV) console.error('[ReactPlaceholderCanvas] setup failed:', error)
      return
    }

    // Notify the parent that this canvas is ready for capture (e.g. recording, PNG export).
    onCanvasReadyRef.current?.(canvas)

    // FPS tracking — sample once per second and report via onLiveFps. The
    // reporter deduplicates unavailable=0 so the no-preset path never invokes a
    // React state callback on every frame.
    fpsReporter = createLiveFpsReporter(() => onLiveFpsRef.current)
    let fpsFrameCount = 0
    let fpsLastMs = performance.now()
    let previousFrameMs: number | null = null
    let previousAudioTimeSec: number | null = null
    let elapsedTimeSec = 0
    let lastPausedRenderKey = ''

    // Simple transient-based beat detection used when MI bus has no valid BPM yet.
    // beatPeriodMs is a LOCAL rendering fallback only — it drives visual beat phase
    // advancement in the fallback path and must never be shown as track metadata.
    let prevBass = 0
    let beatPhase = 0
    const FALLBACK_BPM_LOCAL = 120           // internal visual fallback only
    const beatPeriodMs = 60000 / FALLBACK_BPM_LOCAL
    let stableReported = false
    let lastExpectedWebglEngine: 'cinematic-worlds' | null | undefined

    function reportStable(preset: ReactPreset | null): void {
      const expectedWebglEngine =
        preset?.engine === 'cinematicPortal' && resolveCinematicPortalBackend(preset) === 'webgl2'
        ? 'cinematic-worlds'
        : null
      if (!stableReported) {
        stableReported = true
        ownership.markStable()
      }
      if (lastExpectedWebglEngine !== expectedWebglEngine) {
        lastExpectedWebglEngine = expectedWebglEngine
        assertDrmvyzWebGLContextOwnershipBoundsForDevelopment(expectedWebglEngine)
      }
    }

    function scheduleNextFrame(): void {
      if (disposed || !ownership.isCurrent()) return
      animRef.current = requestAnimationFrame(runFrame)
    }

    function runFrame(now: number): void {
      try {
        frame(now)
      } catch (error) {
        ownership.retire('render-failed')
        if (import.meta.env.DEV) console.error('[ReactPlaceholderCanvas] render failed:', error)
      }
    }

    function frame(now: number) {
      if (disposed || !ownership.isCurrent() || !canvas || !ctx) return
      const W = canvas.width,
        H = canvas.height
      if (!W || !H) {
        scheduleNextFrame()
        return
      }

      // Preserve the completed frame during pause, but render one fresh frame
      // when lyrics, project controls, fonts, or the loaded track change.
      if (isPausedRef.current) {
        const pausedTime = getAudioTimeRef.current?.()
        if (pausedTime !== undefined) audioTimeRef.current = pausedTime
        musicIntelligenceEngine.resolveLyricsAt(audioTimeRef.current, 'discontinuous')
        const lyricState = LyricPlaybackBus.getState()
        const pausedRenderKey = [
          renderRevisionRef.current,
          activeAudioTrackIdRef.current ?? 'none',
          lyricState.sourceIdentity ?? 'none',
          lyricState.documentId ?? 'none',
          lyricState.timelineRevision,
          lyricState.activeCue?.id ?? 'none',
          lyricState.activeWord?.id ?? 'none',
          lyricState.isGap ? 'gap' : 'active',
        ].join(':')
        if (pausedRenderKey === lastPausedRenderKey) {
          fpsFrameCount = 0
          fpsLastMs = now
          previousFrameMs = now
          scheduleNextFrame()
          return
        }
        lastPausedRenderKey = pausedRenderKey
      } else {
        lastPausedRenderKey = ''
      }

      const preset = presetRef.current
      if (!preset) {
        // No preset — clear the canvas and invalidate diagnostics before this
        // frame returns so an FPS value from the previous engine cannot linger.
        fpsFrameCount = 0
        fpsLastMs = now
        fpsReporter?.unavailable()
        ctx.fillStyle = '#060d10'
        ctx.fillRect(0, 0, W, H)
        reportStable(null)
        scheduleNextFrame()
        return
      }

      const deltaTimeSec = previousFrameMs == null ? 1 / 60 : Math.min(0.1, Math.max(0, (now - previousFrameMs) / 1000))
      previousFrameMs = now
      const frameElapsedTimeSec = elapsedTimeSec

      // Sample audio
      const an  = analyserRef.current
      const buf = freqBufRef.current
      const tBuf = timeBufRef.current

      let bass = 0.05,
        mid = 0.05,
        high = 0.05,
        vol = 0.05
      if (an && buf) {
        an.getByteFrequencyData(buf)
        if (tBuf) an.getByteTimeDomainData(tBuf)
        const binCount  = buf.length
        const bassBins  = Math.floor(binCount * 0.08)
        const midBins = Math.floor(binCount * 0.3)
        let bSum = 0,
          mSum = 0,
          hSum = 0,
          vSum = 0
        for (let i = 0; i < bassBins; i++) {
          bSum += buf[i]
          vSum += buf[i]
        }
        for (let i = bassBins; i < midBins; i++) {
          mSum += buf[i]
          vSum += buf[i]
        }
        for (let i = midBins; i < binCount; i++) {
          hSum += buf[i]
          vSum += buf[i]
        }
        bass = bSum / bassBins / 255
        mid  = mSum / (midBins - bassBins) / 255
        high = hSum / (binCount - midBins)  / 255
        vol  = vSum / binCount / 255

        // Resolve the current audio time before pumping the MI engine so it
        // receives an accurate timestamp — not the value from the previous frame.
        const freshTime = getAudioTimeRef.current?.()
        if (freshTime !== undefined) {
          audioTimeRef.current = freshTime
        } else if (isPlayingRef.current) {
          audioTimeRef.current += 1 / 60
        }

        // Pump Music Intelligence Engine so LaserDMX and other React engines get
        // full MI data (kick, snare, beatPhase, buildProgress, etc.), not just the
        // simple bass/mid/high fallback that ReactPlaceholderCanvas computes above.
        musicIntelligenceEngine.updateFromAudioFrame({
          freqBuf:    buf,
          timeBuf:    tBuf,
          sampleRate: an.context.sampleRate,
          audioTime:  audioTimeRef.current,
          isPlaying:  isPlayingRef.current,
        })
      }

      // Expose the MI frame whenever any data has been published (frameId > 0),
      // even when BPM is still unknown (bpm === 0). Energy, section, and semantic
      // data are useful without a known BPM. BPM is resolved separately below.
      const miFrame  = AudioFeatureBus.getFrame()
      const hasMI    = miFrame.frameId > 0

      let beatHit: boolean
      let activeBeatPhase: number
      // activeBpm: 0 means "no canonical BPM available yet" — renderers must not treat
      // this as 120 BPM.  It is local to this frame context and not track metadata.
      let activeBpm: number

      if (hasMI) {
        beatHit          = miFrame.rhythm.beatHit
        activeBeatPhase  = miFrame.rhythm.beatPhase
        // BPM: prefer engine-canonical effective BPM when available.
        // When MI BPM is zero (track analysis not yet available), use effectiveBpm
        // or 0 to signal "BPM unknown" — never substitute a hardcoded fallback.
        const miBpm = miFrame.rhythm.bpm
        activeBpm = (effectiveBpmRef.current ?? 0) > 0 ? effectiveBpmRef.current! : miBpm > 0 ? miBpm : 0
      } else {
        beatHit          = bass > 0.55 && bass > prevBass + 0.08
        prevBass         = bass * 0.8
        // Advance beat phase using effectiveBpm when known, local fallback otherwise.
        // The local fallback rate keeps the visual beat phase animating smoothly but
        // is never surfaced as a track BPM value.
        const phaseBpm = (effectiveBpmRef.current ?? 0) > 0 ? effectiveBpmRef.current! : FALLBACK_BPM_LOCAL
        activeBeatPhase  = beatPhase = (beatPhase + 16 / (60000 / phaseBpm)) % 1
        // Pass effectiveBpm when available, otherwise 0 to signal "unknown BPM".
        activeBpm        = (effectiveBpmRef.current ?? 0) > 0 ? effectiveBpmRef.current! : 0
      }

      // Audio time is already resolved above (before the MI pump) when the
      // analyser is present. Advance the clock here only when there is no analyser.
      if (!analyserRef.current) {
        const realTime = getAudioTimeRef.current?.()
        if (realTime !== undefined) {
          audioTimeRef.current = realTime
        } else if (isPlayingRef.current) {
          audioTimeRef.current += 1 / 60
        }
        musicIntelligenceEngine.resolveLyricsAt(audioTimeRef.current)
      }

      const canonicalAudioTime = Number.isFinite(audioTimeRef.current) ? Math.max(0, audioTimeRef.current) : 0
      const audioDeltaSec = previousAudioTimeSec == null ? 0 : canonicalAudioTime - previousAudioTimeSec
      const timingDiscontinuity =
        previousAudioTimeSec != null &&
        (audioDeltaSec < -0.001 || audioDeltaSec > Math.max(0.2, deltaTimeSec * 4 + 0.05))
      previousAudioTimeSec = canonicalAudioTime

      const t = tRef.current
      const dpr = canvasResolution?.effectiveDpr ?? 1
      // Seconds-based time for strobe, envelopes, and time-accurate effects.
      // Prefer audioTime when valid; fall back to wall clock.
      const nowSec = performance.now() / 1000
      const timeSec = Number.isFinite(audioTimeRef.current) && audioTimeRef.current > 0 ? audioTimeRef.current : nowSec

      const resolvedSection = resolveAuthoritativeFrameSection({
        musicIntelligence: hasMI ? miFrame : null,
        trackSections: trackSectionsRef.current,
        audioTime: canonicalAudioTime,
      })

      // Synchronized stereo capture. Read only when Sound Drawing's professional
      // scope core is actually enabled — every other engine ignores the field,
      // and an unread window is a wasted copy on every frame.
      let scopeStereo: ReactFrameContext['scopeStereo'] = null
      const scopeTap = scopeTapRef.current
      if (scopeTap && preset.engine === 'oscilloscope') {
        const requestFrames = resolveScopeCaptureRequestFrames(
          oscillatorSettingsRef.current,
          scopeTap.sampleRate,
        )
        const performanceSettings = soundDrawingPerformanceSettingsRef.current
        const authoredRequestFrames = performanceSettings.autoPerformance && performanceSettings.selectedShowId != null
          ? soundDrawingPerformanceShowProfessionalScopeLayers(performanceSettings.selectedShowId).reduce(
              (maximum, layer) =>
                Math.max(
                  maximum,
                  professionalScopeCaptureFrames(
                    resolveProfessionalScopeLayerSettings(layer.professionalScope).state,
                    scopeTap.sampleRate,
                  ),
                ),
              0,
            )
          : 0
        const requiredFrames = Math.max(requestFrames, authoredRequestFrames)
        if (requiredFrames > 0) {
          scopeStereo = scopeTap.readLatest(requiredFrames, audioTimeRef.current)
        }
      }

      const rfCtx: ReactFrameContext = {
        W,
        H,
        dpr,
        t,
        elapsedTimeSec: frameElapsedTimeSec,
        deltaTimeSec,
        timeSec,
        audioTime: canonicalAudioTime,
        trackKey: activeAudioTrackIdRef.current,
        timingDiscontinuity,
        bpm:       activeBpm,
        beatPhase: activeBeatPhase,
        beatHit,
        isPlaying: isPlayingRef.current,
        isPaused:  isPausedRef.current,
        audio:     { bass, mid, high, volume: vol },
        freqData:       buf ?? null,
        timeDomainData: tBuf ?? null,
        scopeStereo,
        musicIntelligence: hasMI ? miFrame : null,
        trackAnalysis: trackAnalysisRef.current,
        trackSections: trackSectionsRef.current,
        resolvedSection,
      }

      const transitionedControls = resolvePerformancePadTransition(
        {
        intensity:       intensityRef.current,
        motion:          motionRef.current,
        glow:            glowRef.current,
        bassReactivity:  bassReactRef.current,
        trailDecay:      trailDecayRef.current,
        fogDensity:      fogDensityRef.current,
        particleDensity: particleDensityRef.current,
        },
        performancePadTransitionRef.current,
        now,
      )

      const renderParams: ReactRenderParams = {
        ...DEFAULT_REACT_RENDER_PARAMS,
        ...transitionedControls,
        oscillator:                oscillatorSettingsRef.current,
        oscillatorFontAssets:      fontAssetsRef.current,
        oscillatorGlyphAssets:     glyphAssetsRef.current,
        oscillatorGlyphPointCache: glyphPointCacheRef.current,
        oscillatorTextPointCache:  textPointCacheRef.current,
        soundDrawingTrailResetRevision: soundDrawingTrailResetRevisionRef.current,
        soundDrawingRibbonResetRevision: soundDrawingRibbonResetRevisionRef.current,
        soundDrawingPerformanceSettings: soundDrawingPerformanceSettingsRef.current,
        performanceActionEvent:    performanceActionEventRef.current,
        performanceActionEvents:   performanceActionEventsRef.current,
        performanceActionToggleStates: performanceActionToggleStatesRef.current,
      }

      const lyricPlayback = isPlayingRef.current || isPausedRef.current ? LyricPlaybackBus.getState() : undefined
      setSoundDrawingClipsForFrame(
        sdLayersRef.current,
        sdClipsRef.current,
        lyricPlayback,
        activeAudioTrackIdRef.current,
      )
      renderReactEngine(ctx, rfCtx, preset, renderParams, trackSectionsRef.current)
      compositeBrandAsset(ctx, brandOverlayRef.current, {
        width: W,
        height: H,
        audioTime: audioTimeRef.current,
        durationSec: durationSecRef.current,
        audioEnergy: vol,
        sectionType: rfCtx.resolvedSection?.type ?? null,
      })
      reportStable(preset)
      elapsedTimeSec += deltaTimeSec

      // LaserDMX animation clock is frozen while paused so scan/path generators
      // don't accumulate ticks that cause a visible jump when playback resumes.
      // Other engines keep their slow idle drift (0.15/frame) while paused.
      const isLaserDmx = preset.engine === 'laserDmx'
      if (isPlayingRef.current) {
        tRef.current++
      } else if (!isLaserDmx) {
        tRef.current += 0.15
      }

      fpsFrameCount++
      const nowMs = performance.now()
      if (nowMs - fpsLastMs >= 1000) {
        const elapsed = (nowMs - fpsLastMs) / 1000
        fpsReporter?.report(fpsFrameCount / elapsed)
        fpsFrameCount = 0
        fpsLastMs = nowMs
      }

      scheduleNextFrame()
    }

    runFrame(performance.now())
    return () => {
      ownership.retire('unmount')
    }
  }, [engine])  // ReactView also keys by engine; this documents the ownership boundary.

  return (
    <canvas
      ref={canvasRef}
      className="rv-preview-canvas"
      role="img"
      aria-label={canvasLabel}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {canvasLabel}. Animated visual output is not described frame by frame.
    </canvas>
  )
}

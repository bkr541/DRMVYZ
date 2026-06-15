import { useRef, useEffect } from 'react'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { ReactPreset, ReactTrackSection, OscillatorSettings, OscillatorGlyphAsset, OscillatorGlyphPoint } from './ReactTypes'
import { DEFAULT_OSCILLATOR_SETTINGS } from './ReactTypes'
import type { ReactRenderParams } from './renderers/reactRenderUtils'
import { DEFAULT_REACT_RENDER_PARAMS } from './renderers/ReactEngineRenderer'
import { renderReactEngine } from './renderers/ReactEngineRenderer'
import type { ReactFrameContext } from './renderers/reactRenderUtils'

interface Props {
  analyser:           AnalyserNode | null
  activePreset:       ReactPreset | null
  intensity:          number
  motion:             number
  glow:               number
  bassReactivity:     number
  trailDecay?:        number
  fogDensity?:        number
  particleDensity?:   number
  oscillatorSettings?:          OscillatorSettings
  oscillatorGlyphAssets?:       OscillatorGlyphAsset[]
  oscillatorGlyphPointCache?:   Record<string, OscillatorGlyphPoint[]>
  oscillatorTextPointCache?:    Record<string, OscillatorGlyphPoint[]>
  isPlaying:                    boolean
  manualSections?:              ReactTrackSection[]
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
}

export function ReactPlaceholderCanvas({
  analyser,
  activePreset,
  intensity,
  motion,
  glow,
  bassReactivity,
  trailDecay         = 0.08,
  fogDensity         = 0.5,
  particleDensity    = 0.5,
  oscillatorSettings         = DEFAULT_OSCILLATOR_SETTINGS,
  oscillatorGlyphAssets      = [] as OscillatorGlyphAsset[],
  oscillatorGlyphPointCache  = {} as Record<string, OscillatorGlyphPoint[]>,
  oscillatorTextPointCache   = {} as Record<string, OscillatorGlyphPoint[]>,
  isPlaying,
  manualSections             = [],
  getAudioTime,
  effectiveBpm               = null,
  onCanvasReady,
  onLiveFps,
}: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const animRef        = useRef<number>(0)
  const analyserRef    = useRef<AnalyserNode | null>(null)
  const freqBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const tRef           = useRef(0)

  // Mutable refs so the rAF loop reads current values without restarting
  const intensityRef          = useRef(intensity)
  const motionRef             = useRef(motion)
  const glowRef               = useRef(glow)
  const bassReactRef          = useRef(bassReactivity)
  const trailDecayRef         = useRef(trailDecay)
  const fogDensityRef         = useRef(fogDensity)
  const particleDensityRef    = useRef(particleDensity)
  const oscillatorSettingsRef  = useRef(oscillatorSettings)
  const glyphAssetsRef         = useRef<OscillatorGlyphAsset[]>(oscillatorGlyphAssets)
  const glyphPointCacheRef     = useRef<Record<string, OscillatorGlyphPoint[]>>(oscillatorGlyphPointCache)
  const textPointCacheRef      = useRef<Record<string, OscillatorGlyphPoint[]>>(oscillatorTextPointCache)
  const isPlayingRef           = useRef(isPlaying)
  const presetRef             = useRef<ReactPreset | null>(activePreset)
  const sectionsRef           = useRef<ReactTrackSection[]>(manualSections)
  const audioTimeRef          = useRef(0)
  const getAudioTimeRef        = useRef(getAudioTime)
  const effectiveBpmRef        = useRef<number | null>(effectiveBpm)
  const onCanvasReadyRef       = useRef(onCanvasReady)
  const onLiveFpsRef           = useRef(onLiveFps)

  // Keep refs current every render
  intensityRef.current          = intensity
  motionRef.current             = motion
  glowRef.current               = glow
  bassReactRef.current          = bassReactivity
  trailDecayRef.current         = trailDecay
  fogDensityRef.current         = fogDensity
  particleDensityRef.current    = particleDensity
  oscillatorSettingsRef.current  = oscillatorSettings
  glyphAssetsRef.current         = oscillatorGlyphAssets
  glyphPointCacheRef.current     = oscillatorGlyphPointCache
  textPointCacheRef.current      = oscillatorTextPointCache
  isPlayingRef.current           = isPlaying
  presetRef.current             = activePreset
  sectionsRef.current           = manualSections
  getAudioTimeRef.current        = getAudioTime
  effectiveBpmRef.current        = effectiveBpm
  onCanvasReadyRef.current       = onCanvasReady
  onLiveFpsRef.current           = onLiveFps

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

  // Main rAF loop — stable, no dependencies on changing params (reads refs instead)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const w = Math.round(r.width  * devicePixelRatio)
      const h = Math.round(r.height * devicePixelRatio)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w
        canvas.height = h
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Notify the parent that this canvas is ready for capture (e.g. recording, PNG export).
    onCanvasReadyRef.current?.(canvas)

    // FPS tracking — sample once per second and report via onLiveFps
    let fpsFrameCount = 0
    let fpsLastMs = performance.now()

    // Simple transient-based beat detection used when MI bus has no valid BPM yet.
    // beatPeriodMs is a LOCAL rendering fallback only — it drives visual beat phase
    // advancement in the fallback path and must never be shown as track metadata.
    let prevBass = 0
    let beatPhase = 0
    const FALLBACK_BPM_LOCAL = 120           // internal visual fallback only
    const beatPeriodMs = 60000 / FALLBACK_BPM_LOCAL

    function frame(now: number) {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (!W || !H) { animRef.current = requestAnimationFrame(frame); return }

      const preset = presetRef.current
      if (!preset) {
        // No preset — just clear to black
        ctx.fillStyle = '#060d10'
        ctx.fillRect(0, 0, W, H)
        animRef.current = requestAnimationFrame(frame)
        return
      }

      // Sample audio
      const an  = analyserRef.current
      const buf = freqBufRef.current
      const tBuf = timeBufRef.current

      let bass = 0.05, mid = 0.05, high = 0.05, vol = 0.05
      if (an && buf) {
        an.getByteFrequencyData(buf)
        if (tBuf) an.getByteTimeDomainData(tBuf)
        const binCount  = buf.length
        const bassBins  = Math.floor(binCount * 0.08)
        const midBins   = Math.floor(binCount * 0.30)
        let bSum = 0, mSum = 0, hSum = 0, vSum = 0
        for (let i = 0;        i < bassBins; i++) { bSum += buf[i]; vSum += buf[i] }
        for (let i = bassBins; i < midBins;  i++) { mSum += buf[i]; vSum += buf[i] }
        for (let i = midBins;  i < binCount; i++) { hSum += buf[i]; vSum += buf[i] }
        bass = bSum / bassBins / 255
        mid  = mSum / (midBins - bassBins) / 255
        high = hSum / (binCount - midBins)  / 255
        vol  = vSum / binCount / 255

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

      // Use Music Intelligence bus when available; fall back to simple transient detection.
      // MI BPM is considered valid when the engine has published at least one frame AND
      // its BPM is non-zero (zero means setTrackAnalysis(null) cleared the engine).
      const miFrame  = AudioFeatureBus.getFrame()
      const hasMI    = miFrame.frameId > 0 && miFrame.rhythm.bpm > 0

      let beatHit: boolean
      let activeBeatPhase: number
      // activeBpm: 0 means "no canonical BPM available yet" — renderers must not treat
      // this as 120 BPM.  It is local to this frame context and not track metadata.
      let activeBpm: number

      if (hasMI) {
        beatHit          = miFrame.rhythm.beatHit
        activeBeatPhase  = miFrame.rhythm.beatPhase
        // Prefer the engine-canonical effective BPM when available (overrides sync).
        // Fall back to the MI frame value which is authoritative from the beat grid.
        activeBpm        = effectiveBpmRef.current ?? miFrame.rhythm.bpm
      } else {
        beatHit          = bass > 0.55 && bass > prevBass + 0.08
        prevBass         = bass * 0.8
        // Advance beat phase using effectiveBpm when known, local fallback otherwise.
        // The local fallback rate keeps the visual beat phase animating smoothly but
        // is never surfaced as a track BPM value.
        const phaseBpm   = (effectiveBpmRef.current ?? 0) > 0
          ? effectiveBpmRef.current!
          : FALLBACK_BPM_LOCAL
        activeBeatPhase  = beatPhase = (beatPhase + 16 / (60000 / phaseBpm)) % 1
        // Pass effectiveBpm when available, otherwise 0 to signal "unknown BPM".
        activeBpm        = (effectiveBpmRef.current ?? 0) > 0 ? effectiveBpmRef.current! : 0
      }

      const realTime = getAudioTimeRef.current?.()
      if (realTime !== undefined) {
        audioTimeRef.current = realTime
      } else if (isPlayingRef.current) {
        audioTimeRef.current += 1 / 60
      }

      const t = tRef.current
      const dpr = devicePixelRatio
      // Seconds-based time for strobe, envelopes, and time-accurate effects.
      // Prefer audioTime when valid; fall back to wall clock.
      const nowSec = performance.now() / 1000
      const timeSec = Number.isFinite(audioTimeRef.current) && audioTimeRef.current > 0
        ? audioTimeRef.current
        : nowSec

      const rfCtx: ReactFrameContext = {
        W, H, dpr,
        t,
        timeSec,
        audioTime: audioTimeRef.current,
        bpm:       activeBpm,
        beatPhase: activeBeatPhase,
        beatHit,
        isPlaying: isPlayingRef.current,
        audio:     { bass, mid, high, volume: vol },
        freqData:       buf ?? null,
        timeDomainData: tBuf ?? null,
      }

      const renderParams: ReactRenderParams = {
        ...DEFAULT_REACT_RENDER_PARAMS,
        intensity:          intensityRef.current,
        motion:             motionRef.current,
        glow:               glowRef.current,
        bassReactivity:     bassReactRef.current,
        trailDecay:         trailDecayRef.current,
        fogDensity:         fogDensityRef.current,
        particleDensity:    particleDensityRef.current,
        oscillator:                oscillatorSettingsRef.current,
        oscillatorGlyphAssets:     glyphAssetsRef.current,
        oscillatorGlyphPointCache: glyphPointCacheRef.current,
        oscillatorTextPointCache:  textPointCacheRef.current,
      }

      renderReactEngine(ctx, rfCtx, preset, renderParams, sectionsRef.current)

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
        onLiveFpsRef.current?.(Math.round(fpsFrameCount / elapsed))
        fpsFrameCount = 0
        fpsLastMs = nowMs
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      onCanvasReadyRef.current?.(null)
    }
  }, [])  // stable — reads all state via refs

  return (
    <canvas
      ref={canvasRef}
      className="rv-preview-canvas"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}

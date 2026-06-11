import { useRef, useEffect } from 'react'
import type { ReactPreset, ReactTrackSection, OscillatorSettings, OscillatorGlyphAsset } from './ReactTypes'
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
  oscillatorSettings?:     OscillatorSettings
  oscillatorGlyphAssets?:  OscillatorGlyphAsset[]
  isPlaying:               boolean
  manualSections?:         ReactTrackSection[]
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
  oscillatorSettings     = DEFAULT_OSCILLATOR_SETTINGS,
  oscillatorGlyphAssets  = [] as OscillatorGlyphAsset[],
  isPlaying,
  manualSections         = [],
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
  const isPlayingRef           = useRef(isPlaying)
  const presetRef             = useRef<ReactPreset | null>(activePreset)
  const sectionsRef           = useRef<ReactTrackSection[]>(manualSections)
  const audioTimeRef          = useRef(0)

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
  isPlayingRef.current           = isPlaying
  presetRef.current             = activePreset
  sectionsRef.current           = manualSections

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

    // Beat detection state
    let prevBass = 0
    let beatPhase = 0
    const beatPeriodMs = 60000 / 120  // default 120 BPM until we have better data

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
      }

      if (an && tBuf) an.getByteTimeDomainData(tBuf)

      // Beat detection — transient + phase
      const beatHit = bass > 0.55 && bass > prevBass + 0.08
      prevBass = bass * 0.8

      beatPhase = (beatPhase + 16 / beatPeriodMs) % 1

      if (isPlayingRef.current) {
        audioTimeRef.current += 1 / 60  // approximate; real audioTime from engine if available
      }

      const t = tRef.current
      const dpr = devicePixelRatio

      const rfCtx: ReactFrameContext = {
        W, H, dpr,
        t,
        audioTime: audioTimeRef.current,
        bpm:       120,
        beatPhase,
        beatHit,
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
        oscillator:            oscillatorSettingsRef.current,
        oscillatorGlyphAssets: glyphAssetsRef.current,
      }

      renderReactEngine(ctx, rfCtx, preset, renderParams, sectionsRef.current)

      if (isPlayingRef.current) tRef.current++
      else tRef.current += 0.15  // slow idle animation

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
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

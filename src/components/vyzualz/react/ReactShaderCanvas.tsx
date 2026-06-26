import { useRef, useEffect } from 'react'
import { AudioFeatureBus }        from '../../../features/musicIntelligence/AudioFeatureBus'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import type { ReactFrameContext }  from './renderers/reactRenderUtils'
import { ShaderWebGLRuntime }      from './shaders/runtime/ShaderWebGLRuntime'
import { ShaderEngineRenderer }    from './shaders/ShaderEngineRenderer'
import type { ShaderMasterParams } from './shaders/ShaderEngineRenderer'
import { useShaderPanelStore }     from './shaders/ui/shaderPanelStore'
import { DEFAULT_SHADER_SCENE_ID } from './shaders/scenes'

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
  isPlaying:         boolean
  getAudioTime?:     () => number
  effectiveBpm?:     number | null
  durationSec?:      number
  onCanvasReady?:    (canvas: HTMLCanvasElement | null) => void
  onLiveFps?:        (fps: number) => void
}

// ── ReactShaderCanvas ─────────────────────────────────────────────────────────

/**
 * Dedicated WebGL2 canvas for the GLSL Shader engine.
 *
 * Owns the rAF loop, audio sampling, Music Intelligence pump, ReactFrameContext
 * construction, and ShaderEngineRenderer lifecycle.
 *
 * Must NOT call renderReactEngine or setSoundDrawingClipsForFrame.
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
  isPlaying,
  getAudioTime,
  effectiveBpm    = null,
  durationSec     = 0,
  onCanvasReady,
  onLiveFps,
}: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const animRef     = useRef<number>(0)
  const rendererRef = useRef<ShaderEngineRenderer | null>(null)

  // Audio analyser buffers
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const freqBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const audioTimeRef = useRef(0)
  const tRef         = useRef(0)

  // Mutable refs — rAF loop reads these so we don't need to restart on prop change
  const intensityRef       = useRef(intensity)
  const motionRef          = useRef(motion)
  const glowRef            = useRef(glow)
  const bassReactRef       = useRef(bassReactivity)
  const trailDecayRef      = useRef(trailDecay)
  const fogDensityRef      = useRef(fogDensity)
  const particleDensityRef = useRef(particleDensity)
  const isPlayingRef       = useRef(isPlaying)
  const effectiveBpmRef    = useRef<number | null>(effectiveBpm)
  const durationSecRef     = useRef(durationSec)
  const getAudioTimeRef    = useRef(getAudioTime)
  const onCanvasReadyRef   = useRef(onCanvasReady)
  const onLiveFpsRef       = useRef(onLiveFps)

  // Keep refs current every render (does not restart any effect)
  intensityRef.current       = intensity
  motionRef.current          = motion
  glowRef.current            = glow
  bassReactRef.current       = bassReactivity
  trailDecayRef.current      = trailDecay
  fogDensityRef.current      = fogDensity
  particleDensityRef.current = particleDensity
  isPlayingRef.current       = isPlaying
  effectiveBpmRef.current    = effectiveBpm
  durationSecRef.current     = durationSec
  getAudioTimeRef.current    = getAudioTime
  onCanvasReadyRef.current   = onCanvasReady
  onLiveFpsRef.current       = onLiveFps

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

  // Main effect: create WebGL runtime + renderer, rAF loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Ensure a default scene is selected
    const store = useShaderPanelStore.getState()
    if (!store.activeShaderId) {
      store.setActiveShaderId(DEFAULT_SHADER_SCENE_ID)
    }

    // Create WebGL2 runtime
    const { runtime, error } = ShaderWebGLRuntime.create(canvas, {
      onContextLost:     () => { /* renderer handles internally */ },
      onContextRestored: () => { /* runtime cleared internally */ },
    })

    if (!runtime) {
      if (import.meta.env.DEV) console.warn('[ReactShaderCanvas] WebGL2 unavailable:', error)
      return
    }

    const renderer = new ShaderEngineRenderer(runtime)
    rendererRef.current = renderer

    // Notify parent
    onCanvasReadyRef.current?.(canvas)

    // Resize handling
    function resize() {
      const r = canvas!.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width  * devicePixelRatio))
      const h = Math.max(1, Math.round(r.height * devicePixelRatio))
      renderer.resize(r.width, r.height, devicePixelRatio)
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width  = w
        canvas!.height = h
      }
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // FPS tracking
    let fpsCount  = 0
    let fpsLastMs = performance.now()

    // Beat tracking for fallback
    let beatPhase = 0
    let prevBass  = 0
    const FALLBACK_BPM = 120
    const beatPeriodMs = 60000 / FALLBACK_BPM

    let lastFrameMs = performance.now()

    function frame(now: number) {
      const deltaMs = now - lastFrameMs
      lastFrameMs = now

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

        // Pump Music Intelligence Engine
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

      // Resolve BPM and beat phase
      const bpmSrc = effectiveBpmRef.current
      const activeBpm = (bpmSrc != null && bpmSrc > 0) ? bpmSrc
                      : (hasMI && miFrame.rhythm.bpm > 0) ? miFrame.rhythm.bpm
                      : 0

      let beatHit = false
      let activeBeatPhase: number

      if (hasMI && miFrame.rhythm.beatPhase !== undefined) {
        activeBeatPhase = miFrame.rhythm.beatPhase
        beatHit         = miFrame.rhythm.beatHit ?? false
      } else {
        // Fallback beat phase from bass transient
        const bassDelta = bass - prevBass
        if (bassDelta > 0.15 && bass > 0.4) { beatPhase = 0; beatHit = true }
        prevBass    = bass
        beatPhase  += deltaMs / beatPeriodMs
        if (beatPhase > 1) beatPhase -= Math.floor(beatPhase)
        activeBeatPhase = beatPhase
      }

      const W = canvas!.width  || 1
      const H = canvas!.height || 1

      const rfCtx: ReactFrameContext = {
        W,
        H,
        dpr:       devicePixelRatio,
        t:         tRef.current,
        timeSec:   now / 1000,
        audioTime: audioTimeRef.current,
        bpm:       activeBpm,
        beatPhase: activeBeatPhase,
        beatHit,
        isPlaying: isPlayingRef.current,
        audio: { bass, mid, high, volume: vol },
        freqData,
        timeDomainData,
        musicIntelligence: hasMI ? miFrame : null,
      }

      const master: ShaderMasterParams = {
        intensity:      intensityRef.current,
        motion:         motionRef.current,
        glow:           glowRef.current,
        bassReactivity: bassReactRef.current,
        trailDecay:     trailDecayRef.current,
        fogDensity:     fogDensityRef.current,
        particleDensity: particleDensityRef.current,
      }

      renderer.render(rfCtx, durationSecRef.current, master)

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
      onCanvasReadyRef.current?.(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width:   '100%',
        height:  '100%',
        background: '#000',
      }}
    />
  )
}

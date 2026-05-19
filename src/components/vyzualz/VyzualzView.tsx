import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { AnalyzerSidebar } from '../analyzer/AnalyzerSidebar'
import { useSharedAudio }  from '../../context/AudioEngineContext'
import { useMediaStore }   from '../../stores/mediaStore'
import { useVisualStore, DEFAULT_PRESETS }  from '../../stores/visualStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzEffects, VzPreset, VzSession, Quality } from '../../stores/visualStore'
import { extractBandValues, applyModulatedEffects, BAND_LABELS, EFFECT_LABELS } from '../../lib/audioModulation'
import type { ModulationRoute, AudioBandValues } from '../../lib/audioModulation'
import { TrackScrubber } from '../shared/TrackScrubber'

// ── Constants ─────────────────────────────────────────────────────────
const EFFECT_CHAIN_ITEMS = ['RGB Split','Glitch Bars','Scanlines','Tunnel','Displacement','Noise Fog','Bloom','Feedback'] as const
const SHORTCUTS = [
  { key: '1–5', desc: 'Switch Preset' },
  { key: 'F',   desc: 'Fullscreen' },
  { key: 'G',   desc: 'Glitch Punch' },
  { key: 'B',   desc: 'Bass Pulse' },
  { key: 'SPC', desc: 'Beat Flash' },
  { key: 'V',   desc: 'Next Media' },
]

// ── Quality render config (renderer-only, not stored in session) ──────
interface QualityConfig {
  dprCap:        number  // max devicePixelRatio used for backing store
  bloomBlur:     number  // max blur px for bloom pass (0 = skip blur, alpha-only)
  glitchMax:     number  // max glitch slice count
  fogParticles:  number  // noise fog dot count
  scanlineStep:  number  // px between scanlines
  tunnelRings:   number  // concentric ring count
}
const QUALITY: Record<Quality, QualityConfig> = {
  High:   { dprCap: 3,   bloomBlur: 10, glitchMax: 5, fogParticles: 600, scanlineStep: 3, tunnelRings: 8 },
  Medium: { dprCap: 1.5, bloomBlur: 5,  glitchMax: 3, fogParticles: 200, scanlineStep: 4, tunnelRings: 5 },
  Low:    { dprCap: 1,   bloomBlur: 0,  glitchMax: 1, fogParticles: 50,  scanlineStep: 6, tunnelRings: 3 },
}

// ── Band helpers ──────────────────────────────────────────────────────
// getBandAvg lives in audioModulation.ts; keep a local alias for components
// that still need it directly (VyzualzHeader, AudioAnalyzerPanel).
function getBandAvg(buf: Uint8Array<ArrayBuffer>, sampleRate: number, lo: number, hi: number): number {
  const n = buf.length
  const nyq = sampleRate / 2
  const lb = Math.floor((lo / nyq) * n)
  const hb = Math.min(Math.ceil((hi / nyq) * n), n - 1)
  if (hb <= lb) return 0
  let sum = 0
  for (let i = lb; i <= hb; i++) sum += buf[i]
  return sum / ((hb - lb + 1) * 255)
}

// ── VzSlider ──────────────────────────────────────────────────────────
function VzSlider({ label, value, min = 0, max = 1, step = 0.01, onChange, colorTrack }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; colorTrack?: boolean
}) {
  const pct = `${((value - min) / (max - min)) * 100}%`
  return (
    <div className="vz-slider-wrap">
      <div className="vz-slider-header">
        <span className="vz-slider-label">{label}</span>
        <span className="vz-slider-val">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        className={`vz-slider${colorTrack ? ' vz-slider--color' : ''}`}
        style={{ '--pct': pct } as React.CSSProperties}
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}

// ── BpmInput ──────────────────────────────────────────────────────────
function BpmInput({ value, onChange, className }: {
  value: number; onChange: (v: number) => void; className?: string
}) {
  const [draft, setDraft] = useState(String(value))

  // Keep draft in sync when the store value changes externally (e.g. tap tempo)
  useEffect(() => { setDraft(String(value)) }, [value])

  const commit = (raw: string) => {
    const v = parseInt(raw, 10)
    if (!isNaN(v)) onChange(v)          // store clamps to 40-300
    else           setDraft(String(value))  // revert invalid text
  }

  return (
    <input
      type="number"
      className={`vz-bpm-input${className ? ' ' + className : ''}`}
      value={draft}
      min={40} max={300} step={1}
      onChange={e => setDraft(e.target.value)}
      onBlur={e  => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

// ── BeatCanvas ────────────────────────────────────────────────────────
function BeatCanvas({ bass }: { bass: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const bassRef   = useRef(bass)

  useEffect(() => { bassRef.current = bass }, [bass])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 70, H = 22
    canvas.width  = W * devicePixelRatio
    canvas.height = H * devicePixelRatio
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const dpr = devicePixelRatio

    const shape = [0,0,0.08,0.15,0.9,1,0.7,0.4,0.22,0.14,0.1,0.08,0.06,0.05,0.04,0.03,0.02,0.01,0,0]

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cW = canvas.width, cH = canvas.height
      const mid = cH / 2
      const beatPulse = Math.min(1, bassRef.current * 1.4)

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
      })
      ;[...shape].reverse().forEach((v, i) => {
        const x = ((shape.length - 1 - i) / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        ctx.lineTo(x, mid + amp)
      })
      ctx.closePath()

      const alpha = 0.35 + beatPulse * 0.6
      const grad = ctx.createLinearGradient(0, 0, cW, 0)
      grad.addColorStop(0, `rgba(25,191,242,0)`)
      grad.addColorStop(0.25, `rgba(25,191,242,${alpha})`)
      grad.addColorStop(0.75, `rgba(25,191,242,${alpha})`)
      grad.addColorStop(1, `rgba(25,191,242,0)`)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
      })
      ctx.strokeStyle = `rgba(25,191,242,${0.55 + beatPulse * 0.4})`
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, mid); ctx.lineTo(cW, mid)
      ctx.strokeStyle = 'rgba(25,191,242,0.1)'
      ctx.lineWidth = dpr
      ctx.stroke()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return <canvas ref={canvasRef} />
}

// ── Generative art fallback ───────────────────────────────────────────
function drawGenerativeArt(
  ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number,
  t: number, speed: number, bass: number, effects: VzEffects
) {
  const cx = W / 2, cy = H / 2

  const bgGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.55)
  bgGlow.addColorStop(0, 'rgba(10,24,45,0.9)')
  bgGlow.addColorStop(1, 'rgba(3,6,8,0)')
  ctx.fillStyle = bgGlow
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.strokeStyle = 'rgba(25,191,242,0.04)'
  ctx.lineWidth = dpr
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * Math.max(W, H), cy + Math.sin(angle) * Math.max(W, H))
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(25,191,242,0.04)'
  ctx.lineWidth = dpr
  for (let i = 1; i <= 5; i++) {
    const y  = cy + (H * 0.5) * (i / 5) ** 1.4
    const y2 = cy - (H * 0.5) * (i / 5) ** 1.4
    ctx.beginPath(); ctx.moveTo(0, y);  ctx.lineTo(W, y);  ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke()
  }

  const bassReact = 1 + bass * effects.bassReactivity * 0.35
  for (let r = 0; r < 5; r++) {
    const baseR  = (Math.min(W, H) * 0.09) + r * (Math.min(W, H) * 0.085)
    const pulse  = Math.sin(t * 0.001 * speed * (1 + r * 0.12) + r * 1.3) * (Math.min(W, H) * 0.012)
    const radius = (baseR + pulse) * (r === 0 ? bassReact : 1)
    const alpha  = 0.06 + Math.sin(t * 0.0013 * speed + r * 1.2) * 0.04
    ctx.strokeStyle = `rgba(25,191,242,${alpha})`
    ctx.lineWidth = 1.5 * dpr
    ctx.shadowColor = '#19bff2'
    ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0
  }

  const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.18)
  innerGlow.addColorStop(0, 'rgba(25,191,242,0.07)')
  innerGlow.addColorStop(1, 'rgba(25,191,242,0)')
  ctx.fillStyle = innerGlow
  ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.18, 0, Math.PI * 2); ctx.fill()

  const fontSize = Math.max(20 * dpr, Math.min(52 * dpr, W * 0.12)) * effects.logoScale
  ctx.font = `900 ${fontSize}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const hue = effects.colorShift * 360
  const rgbShift = (2.5 + bass * effects.rgbSplit * 8) * dpr
  ctx.globalAlpha = 0.35
  ctx.fillStyle = `hsl(${hue - 30},100%,50%)`
  ctx.fillText('DVYDRM', cx - rgbShift, cy)
  ctx.fillStyle = `hsl(${hue + 210},100%,60%)`
  ctx.fillText('DVYDRM', cx + rgbShift, cy)
  ctx.globalAlpha = 1

  ctx.shadowColor = '#19bff2'
  ctx.shadowBlur = 24 + bass * effects.bloom * 20
  ctx.fillStyle = 'rgba(25,191,242,0.92)'
  ctx.fillText('DVYDRM', cx, cy)
  ctx.shadowBlur = 0

  const subSize = fontSize * 0.26
  ctx.globalAlpha = 0.35
  ctx.font = `400 ${subSize}px Inter, sans-serif`
  ctx.fillStyle = '#19bff2'
  ctx.fillText('DREAM  WORLD', cx, cy + fontSize * 0.7)
  ctx.globalAlpha = 1
}

// ── LiveVisualCanvas ──────────────────────────────────────────────────
interface CanvasProps {
  analyser: AnalyserNode | null
  activeMedia: UploadedMedia | null
  effects: VzEffects
  enabledFx: Set<string>
  isPlaying: boolean
  bpm: number
  bpmSync: boolean
  quality: Quality
  audioTime: number   // engine.currentTime in seconds; 0 when no track playing
  modulationRoutes: ModulationRoute[]
}

function LiveVisualCanvas({ analyser, activeMedia, effects, enabledFx, isPlaying, bpm, bpmSync, quality, audioTime, modulationRoutes }: CanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const animRef       = useRef<number>(0)
  const resizeFnRef   = useRef<() => void>(() => {})

  // Refs for values that change without needing to restart the RAF loop
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const freqBufRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const mediaElRef    = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const effectsRef    = useRef<VzEffects>(effects)
  const enabledFxRef  = useRef<Set<string>>(enabledFx)
  const isPlayingRef  = useRef(isPlaying)
  const bpmRef        = useRef(bpm)
  const bpmSyncRef    = useRef(bpmSync)
  const qualityRef    = useRef<Quality>(quality)
  const audioTimeRef  = useRef(audioTime)
  const prevBassRef   = useRef(0)
  const routesRef     = useRef<ModulationRoute[]>(modulationRoutes)

  // Sync refs on every render (cheap assignments)
  useEffect(() => { effectsRef.current  = effects })
  useEffect(() => { enabledFxRef.current = enabledFx })
  useEffect(() => { isPlayingRef.current = isPlaying })
  useEffect(() => { bpmRef.current = bpm })
  useEffect(() => { bpmSyncRef.current = bpmSync })
  useEffect(() => { qualityRef.current = quality; resizeFnRef.current() }, [quality])
  useEffect(() => { audioTimeRef.current = audioTime })
  useEffect(() => { routesRef.current = modulationRoutes }, [modulationRoutes])

  useEffect(() => {
    analyserRef.current  = analyser
    freqBufRef.current   = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  // Load/unload media element when active media changes
  useEffect(() => {
    const prev = mediaElRef.current
    if (prev instanceof HTMLVideoElement) { prev.pause(); prev.src = '' }
    mediaElRef.current = null

    if (!activeMedia) return

    if (activeMedia.type === 'image') {
      const img = new Image()
      img.src = activeMedia.url
      img.onload = () => { mediaElRef.current = img }
    } else {
      const video = document.createElement('video')
      video.src = activeMedia.url
      video.muted = true
      video.loop  = true
      video.playsInline = true
      if (isPlayingRef.current) video.play().catch(() => {})
      mediaElRef.current = video
    }

    return () => {
      const el = mediaElRef.current
      if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
    }
  }, [activeMedia?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Control video playback when isPlaying changes
  useEffect(() => {
    const el = mediaElRef.current
    if (!(el instanceof HTMLVideoElement)) return
    if (isPlaying) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [isPlaying])

  // Main RAF loop — runs once, reads from refs
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r   = canvas.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio, QUALITY[qualityRef.current].dprCap)
      canvas.width  = Math.round(r.width  * dpr)
      canvas.height = Math.round(r.height * dpr)
    }
    resizeFnRef.current = resize
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const startTime = performance.now()

    function frame() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (!W || !H) { animRef.current = requestAnimationFrame(frame); return }

      const dpr  = Math.min(devicePixelRatio, QUALITY[qualityRef.current].dprCap)
      const q    = QUALITY[qualityRef.current]
      const t    = performance.now() - startTime
      const eff  = effectsRef.current
      const fxSet = enabledFxRef.current
      const speed = isPlayingRef.current ? 1 : 0.25

      // Beat phase: 0→1 cycling at BPM.
      // When synced and audio is playing, anchor phase to engine.currentTime so
      // beat boundaries track the actual track position instead of the canvas clock.
      const beatMs    = 60000 / Math.max(1, bpmRef.current)
      const synced    = bpmSyncRef.current
      const audioMs   = audioTimeRef.current * 1000
      const beatPhase = synced && audioMs > 0
        ? (audioMs % beatMs) / beatMs
        : (t % beatMs) / beatMs

      // ── Read frequency data + extract bands ───────────────────────
      const an  = analyserRef.current
      const buf = freqBufRef.current
      let rawBands: AudioBandValues = { bass: 0, lowMid: 0, mid: 0, high: 0, volume: 0, beat: 0 }
      if (an && buf) {
        an.getByteFrequencyData(buf)
        rawBands = extractBandValues(buf, an.context.sampleRate, beatPhase, synced)
      }
      const bass = rawBands.bass
      const high = rawBands.high

      // ── Per-band modulation routing ────────────────────────────────
      // Smooth bass with EMA to avoid jitter on scale/punch
      const smoothBass = prevBassRef.current * 0.65 + bass * 0.35

      // Bass transient → impact punch (brief extra scale burst on attack)
      const bassDelta  = bass - prevBassRef.current
      const impactMod  = Math.max(0, bassDelta * 2.8)
      const punchScale = 1 + impactMod * eff.bassReactivity * 0.25

      // Apply all enabled modulation routes — additively boosts each effect param
      const mEff = applyModulatedEffects(eff, { ...rawBands, bass: smoothBass }, routesRef.current)

      // Derive renderer-level variables from modulated effects
      const bassReact   = 1 + smoothBass * mEff.bassReactivity * 0.35 * mEff.masterIntensity
      const dispMod     = mEff.displacement
      const feedbackMod = Math.min(0.97, mEff.feedbackTrails)
      const glitchMod   = mEff.glitchAmount
      const edgeFlicker = high * mEff.masterIntensity
      const bloomMod    = Math.min(1, mEff.bloom)

      // Beat boundary → flash hit / transition frame
      const onBeatBoundary = synced && beatPhase < 0.04

      // ── Background / feedback ──────────────────────────────────────
      // Low-mid modulates feedback retention (smear/bend)
      if (fxSet.has('Feedback') && feedbackMod > 0) {
        ctx.fillStyle = `rgba(5,7,9,${1 - feedbackMod * 0.92})`
        ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = '#050709'
        ctx.fillRect(0, 0, W, H)
      }

      const mediaEl = mediaElRef.current
      const cx = W / 2, cy = H / 2
      // Bass drives scale pulse; impact punch adds brief burst on transient
      const scale = bassReact * punchScale * eff.logoScale
      const sw = W * scale, sh = H * scale
      const ox = (W - sw) / 2, oy = (H - sh) / 2

      if (mediaEl) {
        // ── Tunnel (behind media) ──────────────────────────────────
        if (fxSet.has('Tunnel') && eff.tunnelSpeed > 0) {
          ctx.save()
          // When synced, use beat phase so rings expand on each beat boundary
          const tunnelT     = synced ? beatPhase * beatMs * eff.tunnelSpeed : t * eff.tunnelSpeed
          // Bass widens tunnel ring spacing (depth modulation)
          const tunnelDepth = 1 + smoothBass * eff.bassReactivity * 0.45
          for (let r = 0; r < q.tunnelRings; r++) {
            const radius = ((tunnelT * 0.1 + r * 30 * tunnelDepth) % 300) + 10
            const alpha  = 0.07 * (1 - radius / 300)
            ctx.strokeStyle = `rgba(25,191,242,${alpha})`
            ctx.lineWidth = 1.5 * dpr
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
          }
          ctx.restore()
        }

        // ── RGB Split ──────────────────────────────────────────────
        if (fxSet.has('RGB Split') && mEff.rgbSplit > 0) {
          const shift = mEff.rgbSplit * 14
          ctx.save()
          ctx.globalCompositeOperation = 'screen'
          ctx.globalAlpha = 0.65
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
          ctx.drawImage(mediaEl, ox - shift, oy, sw, sh)
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(200deg)'
          ctx.drawImage(mediaEl, ox + shift, oy, sw, sh)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          ctx.filter = 'none'
          ctx.restore()
        }

        // ── Main draw ──────────────────────────────────────────────
        ctx.save()
        if (mEff.colorShift > 0) ctx.filter = `hue-rotate(${mEff.colorShift * 360}deg)`
        ctx.drawImage(mediaEl, ox, oy, sw, sh)
        ctx.filter = 'none'
        ctx.restore()

        // ── Bloom — volume modulates intensity ─────────────────────
        if (fxSet.has('Bloom') && bloomMod > 0) {
          ctx.save()
          const blurPx = Math.round(bloomMod * q.bloomBlur)
          if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`
          ctx.globalAlpha = bloomMod * 0.45
          ctx.globalCompositeOperation = 'screen'
          ctx.drawImage(mediaEl, ox - 2, oy - 2, sw + 4, sh + 4)
          ctx.filter = 'none'
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
          ctx.restore()
        }

        // ── Displacement — low-mid drives warp magnitude ───────────
        if (fxSet.has('Displacement') && dispMod > 0) {
          // When synced, displacement oscillates with beat phase (peaks at beat boundary)
          const dispAngle = synced ? beatPhase * Math.PI * 2 : t * 0.002
          const offX = Math.sin(dispAngle) * dispMod * 12
          const offY = Math.cos(synced ? beatPhase * Math.PI * 2 : t * 0.0017) * dispMod * 8
          ctx.save()
          ctx.globalAlpha = 0.35 * dispMod
          ctx.globalCompositeOperation = 'screen'
          if (mEff.colorShift > 0) ctx.filter = `hue-rotate(${mEff.colorShift * 360 + 90}deg)`
          ctx.drawImage(mediaEl, ox + offX, oy + offY, sw, sh)
          ctx.filter = 'none'
          ctx.globalAlpha = 1
          ctx.globalCompositeOperation = 'source-over'
          ctx.restore()
        }

        // ── Glitch bars ────────────────────────────────────────────
        // Glitch — high freq boosts probability and slice count
        if (fxSet.has('Glitch Bars') && glitchMod > 0 && Math.random() < glitchMod * 0.25) {
          const numGlitches = Math.min(Math.ceil(glitchMod * 5), q.glitchMax)
          for (let g = 0; g < numGlitches; g++) {
            const gy = Math.floor(Math.random() * H)
            const gh = Math.floor(Math.random() * 10 + 2)
            if (gy + gh > H) continue
            const gShift = (Math.random() - 0.5) * eff.glitchAmount * 40
            try {
              const slice = ctx.getImageData(0, gy, W, gh)
              ctx.putImageData(slice, gShift, gy)
            } catch { /* cross-origin guard */ }
          }
        }
      } else if (isPlayingRef.current || rawBands.volume > 0.01) {
        // ── Generative art fallback (only when playing or audio active) ──
        drawGenerativeArt(ctx, W, H, dpr, t, speed, bass, mEff)
      } else {
        // ── Idle — no media, not playing, no signal ────────────────
        const cx = W / 2, cy = H / 2
        ctx.save()
        ctx.globalAlpha = 0.18
        ctx.strokeStyle = 'rgba(25,191,242,0.5)'
        ctx.lineWidth = 1.5 * dpr
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.12, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
        const fs = Math.max(9 * dpr, Math.min(13 * dpr, W * 0.025))
        ctx.font = `600 ${fs}px 'JetBrains Mono', 'Fira Code', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(25,191,242,0.28)'
        ctx.fillText('NO INPUT', cx, cy)
        ctx.restore()
      }

      // ── Scanlines ──────────────────────────────────────────────────
      if (fxSet.has('Scanlines')) {
        ctx.fillStyle = `rgba(0,0,0,${0.1 + mEff.masterIntensity * 0.07})`
        for (let y = 0; y < H; y += q.scanlineStep) ctx.fillRect(0, y, W, 1)
      }

      // ── Noise fog ──────────────────────────────────────────────────
      if (fxSet.has('Noise Fog') && mEff.masterIntensity > 0.3) {
        ctx.save()
        ctx.globalAlpha = (mEff.masterIntensity - 0.3) * 0.12
        for (let i = 0; i < q.fogParticles; i++) {
          ctx.fillStyle = `rgba(25,191,242,${Math.random()})`
          ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
        }
        ctx.globalAlpha = 1
        ctx.restore()
      }

      // ── Strobe — highs modulate sensitivity via mEff.strobe ──────
      // Beat sync: fire on boundary; free: trigger on bass transient.
      const strobeOnBeat = synced && mEff.strobe > 0 && beatPhase < 0.05
      const strobeOnBass = !synced && mEff.strobe > 0 &&
        bass > 0.62 && bass > prevBassRef.current + 0.06
      if (strobeOnBeat || strobeOnBass) {
        const strobeAlpha = strobeOnBeat
          ? mEff.strobe * (1 - beatPhase / 0.05) * 0.9
          : mEff.strobe * bass * 0.85
        ctx.fillStyle = `rgba(255,255,255,${strobeAlpha})`
        ctx.fillRect(0, 0, W, H)
      }

      // ── Beat flash hit (impact frame on beat boundary) ────────────
      if (onBeatBoundary) {
        const decay = 1 - beatPhase / 0.04
        ctx.fillStyle = `rgba(255,255,255,${(0.07 + mEff.masterIntensity * 0.11) * decay})`
        ctx.fillRect(0, 0, W, H)
        // Cyan edge ring — clear beat indicator regardless of effects chain state
        const ring = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.28, cx, cy, Math.min(W, H) * 0.54)
        ring.addColorStop(0, 'rgba(25,191,242,0)')
        ring.addColorStop(1, `rgba(25,191,242,${0.38 * decay})`)
        ctx.fillStyle = ring
        ctx.fillRect(0, 0, W, H)
      }

      // ── Edge flicker — highs create a vignette shimmer ────────────
      if (edgeFlicker > 0.15 && mEff.masterIntensity > 0.3) {
        const flickerAlpha = (edgeFlicker - 0.15) * mEff.masterIntensity * 0.45
        const grad = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.min(W, H) * 0.55)
        grad.addColorStop(0, 'rgba(25,191,242,0)')
        grad.addColorStop(1, `rgba(25,191,242,${flickerAlpha})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      prevBassRef.current = bass * 0.82

      // ── HUD corners ────────────────────────────────────────────────
      const cSize  = 14 * dpr
      const margin = 10 * dpr
      ctx.strokeStyle = 'rgba(25,191,242,0.28)'
      ctx.lineWidth = 1.5 * dpr
      ;([[margin, margin, 1, 1], [W - margin, margin, -1, 1], [margin, H - margin, 1, -1], [W - margin, H - margin, -1, -1]] as [number,number,number,number][])
        .forEach(([x, y, dx, dy]) => {
          ctx.beginPath()
          ctx.moveTo(x + dx * cSize, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * cSize)
          ctx.stroke()
        })

      // ── Freq bars HUD (bottom right when audio active) ────────────
      if (an && buf && rawBands.volume > 0.05) {
        const barW = 3 * dpr, gap = 1 * dpr
        const barColors = ['#19bff2','#58d15b','#a78bfa','#f97316']
        const barVals   = [bass, rawBands.lowMid, high, rawBands.volume]
        barVals.forEach((v, i) => {
          const bh = Math.max(2, v * 30 * dpr)
          const bx = W - margin - (barVals.length - i) * (barW + gap)
          ctx.fillStyle = barColors[i] + '88'
          ctx.fillRect(bx, H - margin - bh, barW, bh)
        })
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvasRef} className="vz-preview-canvas" />
}

// ── AudioWaveformCanvas (real analyser) ───────────────────────────────
function AudioWaveformCanvas({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const animRef       = useRef<number>(0)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const freqBufRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    analyserRef.current  = analyser
    freqBufRef.current   = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      canvas.width  = Math.round(r.width  * devicePixelRatio)
      canvas.height = Math.round(r.height * devicePixelRatio)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (!W || !H) { animRef.current = requestAnimationFrame(frame); return }
      const dpr = devicePixelRatio
      ctx.clearRect(0, 0, W, H)
      const mid = H / 2

      const an  = analyserRef.current
      const buf = freqBufRef.current

      ctx.beginPath()
      if (an && buf) {
        an.getByteFrequencyData(buf)
        const pts = Math.min(buf.length, 120)
        for (let i = 0; i <= pts; i++) {
          const x   = (i / pts) * W
          const val = buf[Math.floor((i / pts) * buf.length)] / 255
          const amp = val * mid * 0.85
          if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
        }
      } else {
        // Idle animation
        const pts = 120
        for (let i = 0; i <= pts; i++) {
          const x   = (i / pts) * W
          const amp = (Math.sin(i * 0.18 + t * 0.04) * 0.45 + Math.sin(i * 0.07 + t * 0.02) * 0.3) * mid * 0.5
          if (i === 0) ctx.moveTo(x, mid + amp); else ctx.lineTo(x, mid + amp)
        }
      }
      ctx.strokeStyle = 'rgba(25,191,242,0.65)'
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(25,191,242,0.15)')
      grad.addColorStop(1, 'rgba(25,191,242,0)')
      ctx.fillStyle = grad
      ctx.fill()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="vz-waveform-mini" style={{ flex: 1, height: '26px', display: 'block' }} />
}

// ── VyzualzHeader ─────────────────────────────────────────────────────
function VyzualzHeader({ analyser, bassLive }: { analyser: AnalyserNode | null; bassLive: number }) {
  const engine = useSharedAudio()
  const barRefs  = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 5 }, () => null))
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const freqBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef      = useRef<number>(0)

  useEffect(() => {
    analyserRef.current = analyser
    freqBufRef.current  = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    function frame() {
      const an  = analyserRef.current
      const buf = freqBufRef.current
      let bands = [0.05, 0.05, 0.05, 0.05, 0.05]

      if (an && buf) {
        an.getByteFrequencyData(buf)
        const sr = an.context.sampleRate
        const b  = getBandAvg(buf, sr, 20,   250)
        const lm = getBandAvg(buf, sr, 250,  1000)
        const m  = getBandAvg(buf, sr, 1000, 4000)
        const h  = getBandAvg(buf, sr, 4000, 16000)
        bands = [b, lm, m, h, Math.min(1, (b + m + h) / 2.5)]
      }

      barRefs.current.forEach((el, i) => {
        if (el) el.style.height = `${Math.max(4, bands[i] * 100)}%`
      })
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const sourceLabel = engine.source === 'microphone' ? 'Microphone'
    : engine.source === 'demo' ? 'Demo Signal'
    : 'File Input'

  const BAND_COLORS = ['#19bff2', '#58d15b', '#a78bfa', '#f97316', '#19bff2']
  const BAND_LABELS = ['Bass', 'LMid', 'Mid', 'High', 'Vol']

  return (
    <div className="vz-header">
      <div className="vz-header-title-group">
        <div className="vz-header-title">VYZUALZ</div>
        <div className="vz-header-sub">Visual Audio Synthesizer</div>
      </div>

      <div className="vz-header-sep" />

      <div className="vz-input-group">
        <span className="vz-input-label">Audio In</span>
        <select className="az-select" value={engine.source} onChange={e => engine.setSource(e.target.value as typeof engine.source)}>
          <option value="file">File Input</option>
          <option value="microphone">Microphone</option>
          <option value="demo">Demo Signal</option>
        </select>
        <span className="vz-active-pill">{sourceLabel.toUpperCase()}</span>
      </div>

      <div className="vz-header-sep" />

      <div className="vz-freq-meters">
        {BAND_LABELS.map((label, i) => (
          <div key={label} className="vz-freq-meter">
            <div className="vz-freq-bar-track">
              <div
                ref={el => { barRefs.current[i] = el }}
                className="vz-freq-bar-fill"
                style={{ height: '5%', background: BAND_COLORS[i] }}
              />
            </div>
            <span className="vz-freq-label">{label}</span>
          </div>
        ))}
      </div>

      <div className="vz-header-sep" />

      <div className="vz-beat-wrap">
        <BeatCanvas bass={bassLive} />
        <span className="vz-beat-label">KICK</span>
      </div>

      <span className="az-spacer" />
      <button className="az-overflow-btn">···</button>
    </div>
  )
}

// ── MediaStatusBar ────────────────────────────────────────────────────
function MediaStatusBar() {
  const {
    loading, loadError, deleteError, authRequired,
    storageAvailable, lastRestored,
    clearLoadError, clearDeleteError, clearRestored,
  } = useMediaStore()

  // Auto-clear the "restored" success message after 4 seconds
  useEffect(() => {
    if (lastRestored === null || lastRestored === 0) return
    const id = setTimeout(() => clearRestored(), 4000)
    return () => clearTimeout(id)
  }, [lastRestored, clearRestored])

  if (loading) return (
    <div className="vz-media-status vz-media-status--info">
      <span className="vz-media-status-dot vz-media-status-dot--pulse" />
      Reloading media library…
    </div>
  )

  if (!storageAvailable) return (
    <div className="vz-media-status vz-media-status--warn">
      <span className="vz-media-status-dot" />
      Storage not configured — files are local only
    </div>
  )

  if (deleteError) return (
    <div className="vz-media-status vz-media-status--error">
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delete failed: {deleteError}</span>
      <button className="vz-media-status-dismiss" onClick={clearDeleteError} title="Dismiss">✕</button>
    </div>
  )

  if (loadError) return (
    <div className="vz-media-status vz-media-status--error">
      <span className="vz-media-status-dot" />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loadError}</span>
      <button className="vz-media-status-dismiss" onClick={clearLoadError} title="Dismiss">✕</button>
    </div>
  )

  if (authRequired) return (
    <div className="vz-media-status vz-media-status--info">
      <span className="vz-media-status-dot" />
      Sign in to sync media to cloud
    </div>
  )

  if (lastRestored !== null && lastRestored > 0) return (
    <div className="vz-media-status vz-media-status--ok">
      <span className="vz-media-status-dot" />
      Restored {lastRestored} media item{lastRestored !== 1 ? 's' : ''}
    </div>
  )

  return null
}

// ── MediaDeckPanel ────────────────────────────────────────────────────
function MediaDeckPanel({ activeMediaId, onSelect }: {
  activeMediaId: string | null; onSelect: (id: string) => void
}) {
  const { items, addFiles, removeItem, toggleFavorite, loadFromSupabase, loading } = useMediaStore()
  const [filter, setFilter] = useState<'All' | 'Images' | 'Videos' | 'Favorites'>('All')
  const [dragOver, setDragOver] = useState(false)
  const fileInputId = useId()

  // Load persisted media from Supabase on mount
  useEffect(() => { loadFromSupabase() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = items.filter(m => {
    if (filter === 'Images')    return m.type === 'image'
    if (filter === 'Videos')    return m.type === 'video'
    if (filter === 'Favorites') return m.favorite
    return true
  })

  const handleFiles = (files: File[]) => {
    const media = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (media.length) addFiles(media)
  }

  return (
    <div
      className="vz-panel"
      style={{ flex: 1, minHeight: 0 }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)) }}
    >
      <div className="vz-panel-header">
        <span className="vz-panel-title">Media Deck</span>
        <label htmlFor={fileInputId} className="vz-import-btn" style={{ cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Import
        </label>
        <input
          id={fileInputId}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
      </div>

      <div className="vz-filter-tabs">
        {(['All','Images','Videos','Favorites'] as const).map(f => (
          <button key={f}
            className={`vz-filter-tab ${filter === f ? 'vz-filter-tab--active' : ''}`}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      <MediaStatusBar />

      <div className="vz-media-scroll">
        {loading && items.length === 0 ? (
          // Loading skeleton while Supabase fetch is in progress
          <div className="vz-media-grid" style={{ padding: '8px 4px' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="vz-media-card" style={{ opacity: 0.4, pointerEvents: 'none' }}>
                <div className="vz-media-thumb" style={{ background: 'linear-gradient(90deg,#0a1420 25%,#0f1f30 50%,#0a1420 75%)', backgroundSize: '200% 100%', animation: 'vz-skeleton-shimmer 1.4s infinite' }}/>
                <div className="vz-media-info"><div className="vz-media-name" style={{ background: '#0a1420', borderRadius: 2, height: 8, width: '70%' }}/></div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <label
            htmlFor={fileInputId}
            className="ref-empty-slot"
            style={{ cursor: 'pointer', margin: 12, height: 120, display: 'flex' }}
          >
            <div className="ref-empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </div>
            <div className="ref-empty-title">Import Media</div>
            <div className="ref-empty-sub" style={{ fontSize: 9 }}>{dragOver ? 'Drop here!' : 'Images & Video'}</div>
          </label>
        ) : (
          <div className="vz-media-grid">
            {filtered.map(m => (
              <div
                key={m.id}
                className={`vz-media-card ${activeMediaId === m.id ? 'vz-media-card--active' : ''}`}
                onClick={() => !m.uploading && onSelect(m.id)}
                style={m.uploading ? { opacity: 0.6, cursor: 'default' } : undefined}
              >
                <div className="vz-media-thumb" style={{ background: '#050a12', overflow: 'hidden', position: 'relative' }}>
                  {m.thumbnailUrl && (
                    <img
                      src={m.thumbnailUrl}
                      alt={m.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  {m.uploading ? (
                    <span className="vz-media-type-badge" style={{ background: 'rgba(25,191,242,0.25)', color: '#19bff2' }}>↑ SYNC</span>
                  ) : m.uploadError ? (
                    <span className="vz-media-type-badge" style={{ background: 'rgba(248,113,113,0.22)', color: '#f87171' }} title={m.uploadError}>⚠ LOCAL</span>
                  ) : (
                    <span className="vz-media-type-badge">{m.type === 'video' ? 'VID' : 'IMG'}</span>
                  )}
                  <button
                    className={`vz-media-star ${m.favorite ? 'vz-media-star--active' : ''}`}
                    onClick={e => { e.stopPropagation(); toggleFavorite(m.id) }}
                  >★</button>
                  <button
                    className="vz-media-remove"
                    onClick={e => { e.stopPropagation(); removeItem(m.id) }}
                    title="Remove"
                    style={{
                      position: 'absolute', top: 3, left: 3, background: 'rgba(0,0,0,0.6)',
                      border: 'none', color: 'rgba(245,248,250,0.5)', cursor: 'pointer',
                      fontSize: 9, borderRadius: 2, padding: '1px 4px', lineHeight: 1.4,
                    }}
                  >✕</button>
                </div>
                <div className="vz-media-info">
                  <div className="vz-media-name">{m.name}</div>
                  <div className="vz-media-meta">{m.meta}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── LiveVisualPreview ─────────────────────────────────────────────────
function LiveVisualPreview({
  analyser, activeMedia, effects, enabledFx,
  isPlaying, onPlay, onPause, onPrev, onNext,
  bpm, onBpmChange, bpmSync, onToggleBpmSync, onTap,
  quality, onQualityChange,
  canvasWrapRef, audioTime, modulationRoutes,
}: {
  analyser: AnalyserNode | null
  activeMedia: UploadedMedia | null
  effects: VzEffects
  enabledFx: Set<string>
  isPlaying: boolean; onPlay: () => void; onPause: () => void
  onPrev: () => void; onNext: () => void
  bpm: number; onBpmChange: (v: number) => void
  bpmSync: boolean; onToggleBpmSync: () => void; onTap: () => void
  quality: Quality; onQualityChange: (q: Quality) => void
  canvasWrapRef: React.RefObject<HTMLDivElement>
  audioTime: number
  modulationRoutes: ModulationRoute[]
}) {
  return (
    <div className="vz-preview-panel">
      <div className="vz-preview-canvas-wrap" ref={canvasWrapRef}>
        <LiveVisualCanvas
          analyser={analyser}
          activeMedia={activeMedia}
          effects={effects}
          enabledFx={enabledFx}
          isPlaying={isPlaying}
          bpm={bpm}
          bpmSync={bpmSync}
          quality={quality}
          audioTime={audioTime}
          modulationRoutes={modulationRoutes}
        />
        <div className="vz-preview-pills">
          <span className="vz-preview-pill">{quality}</span>
          <span className="vz-preview-pill">60 FPS</span>
          <span className="vz-preview-pill">Canvas 2D</span>
        </div>
      </div>

      <div className="vz-preview-transport">
        <button className="vz-preview-trans-btn" title="Previous" onClick={onPrev}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </button>

        <button className="vz-preview-play-btn" title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}>
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>

        <button className="vz-preview-trans-btn" title="Next" onClick={onNext}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>

        <div className="az-spacer" />

        <div className="vz-sync-toggle" onClick={onToggleBpmSync}>
          <div className={`vz-sync-track ${bpmSync ? 'vz-sync-track--on' : ''}`}>
            <div className="vz-sync-thumb" />
          </div>
          <span className="vz-sync-label">BPM Sync</span>
        </div>

        <div className="vz-bpm-group">
          <span className="vz-bpm-label">BPM</span>
          <BpmInput value={bpm} onChange={onBpmChange} />
          <button className="vz-tap-btn" onClick={onTap}>TAP</button>
        </div>

        <div className="vz-header-sep" />

        <select className="az-select" value={quality}
          onChange={e => onQualityChange(e.target.value as Quality)}>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
  )
}

// ── AudioAnalyzerPanel ────────────────────────────────────────────────
function AudioAnalyzerPanel({ analyser }: { analyser: AnalyserNode | null }) {
  const barRefs = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 5 }, () => null))
  const valRefs = useRef<Array<HTMLSpanElement | null>>(Array.from({ length: 5 }, () => null))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBufRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef     = useRef<number>(0)

  useEffect(() => {
    analyserRef.current = analyser
    freqBufRef.current  = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    const BAND_COLORS = ['#19bff2', '#58d15b', '#a78bfa', '#f97316', '#19bff2']
    const BANDS_HZ: [number, number][] = [[20,250],[250,1000],[1000,4000],[4000,16000],[20,16000]]

    function frame() {
      const an  = analyserRef.current
      const buf = freqBufRef.current
      let bands = [0.05, 0.05, 0.05, 0.05, 0.05]

      if (an && buf) {
        an.getByteFrequencyData(buf)
        const sr = an.context.sampleRate
        bands = BANDS_HZ.map(([lo, hi]) => getBandAvg(buf, sr, lo, hi))
        bands[4] = Math.min(1, (bands[0] + bands[1] + bands[2] + bands[3]) / 3)
      }

      barRefs.current.forEach((el, i) => {
        if (el) { el.style.height = `${Math.max(2, bands[i] * 100)}%`; el.style.background = BAND_COLORS[i] }
      })
      valRefs.current.forEach((el, i) => {
        if (el) el.textContent = bands[i].toFixed(2)
      })
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const BAND_LABELS = ['Bass', 'Low Mid', 'Mid', 'High', 'Volume']

  return (
    <div className="vz-analyzer-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Audio Analyzer</span>
      </div>
      <div className="vz-analyzer-body">
        <div className="vz-band-bars">
          {BAND_LABELS.map((label, i) => (
            <div key={label} className="vz-band-col">
              <span ref={el => { valRefs.current[i] = el }} className="vz-band-bar-val">0.05</span>
              <div className="vz-band-bar-track">
                <div
                  ref={el => { barRefs.current[i] = el }}
                  className="vz-band-bar-fill"
                  style={{ height: '5%', background: '#19bff2' }}
                />
              </div>
              <span className="vz-band-bar-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="vz-waveform-row">
          <span className="vz-waveform-label">LIVE WAVEFORM</span>
          <AudioWaveformCanvas analyser={analyser} />
        </div>
      </div>
    </div>
  )
}

// ── ModulationPanel ───────────────────────────────────────────────────
function ModulationPanel({ routes, onToggle, onSetAmount }: {
  routes: ModulationRoute[]
  onToggle: (id: string) => void
  onSetAmount: (id: string, amount: number) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount = routes.filter(r => r.enabled).length

  return (
    <div className="vz-panel vz-mod-panel">
      <button className="vz-panel-header vz-mod-header" onClick={() => setOpen(v => !v)}>
        <span className="vz-panel-title">Modulation</span>
        <span className="vz-mod-summary">{activeCount}/{routes.length} active</span>
        <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>

      {open && (
        <div className="vz-mod-list">
          {routes.map(route => (
            <div key={route.id} className={`vz-mod-route ${route.enabled ? 'vz-mod-route--on' : ''}`}>
              <button
                className="vz-mod-toggle"
                onClick={() => onToggle(route.id)}
                title={route.enabled ? 'Disable route' : 'Enable route'}
              >
                <span className={`vz-mod-dot ${route.enabled ? 'vz-mod-dot--on' : ''}`} />
              </button>
              <span className="vz-mod-source">{BAND_LABELS[route.source]}</span>
              <span className="vz-mod-arrow">→</span>
              <span className="vz-mod-target">{EFFECT_LABELS[route.effectId] ?? route.effectId}</span>
              <input
                type="range"
                className="vz-mod-amount"
                min={0} max={1} step={0.05}
                value={route.amount}
                disabled={!route.enabled}
                title={`Amount: ${route.amount.toFixed(2)}`}
                onChange={e => onSetAmount(route.id, parseFloat(e.target.value))}
              />
              <span className="vz-mod-amount-val">{route.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── EffectControlsPanel ───────────────────────────────────────────────
function EffectControlsPanel({ effects, onChange, onReset }: {
  effects: VzEffects
  onChange: (key: keyof VzEffects, v: number) => void
  onReset: () => void
}) {
  const sliders: { key: keyof VzEffects; label: string; min?: number; max?: number; color?: boolean }[] = [
    { key: 'masterIntensity', label: 'Master Intensity' },
    { key: 'bassReactivity',  label: 'Bass Reactivity' },
    { key: 'glitchAmount',    label: 'Glitch Amount' },
    { key: 'rgbSplit',        label: 'RGB Split' },
    { key: 'tunnelSpeed',     label: 'Tunnel Speed' },
    { key: 'displacement',    label: 'Displacement' },
    { key: 'bloom',           label: 'Bloom' },
    { key: 'strobe',          label: 'Strobe' },
    { key: 'feedbackTrails',  label: 'Feedback Trails' },
    { key: 'logoScale',       label: 'Logo Scale',    min: 0, max: 2 },
    { key: 'colorShift',      label: 'Color Shift',   color: true },
  ]
  return (
    <div className="vz-effects-panel">
      <div className="vz-panel-header">
        <span className="vz-panel-title">Effect Controls</span>
        <button className="vz-reset-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="vz-effects-scroll">
        {sliders.map(s => (
          <VzSlider key={s.key} label={s.label} value={effects[s.key]}
            min={s.min} max={s.max} colorTrack={s.color}
            onChange={v => onChange(s.key, v)}
          />
        ))}
      </div>
    </div>
  )
}

// ── EffectChainPanel ──────────────────────────────────────────────────
function EffectChainPanel({ enabled, onToggle }: {
  enabled: Set<string>; onToggle: (name: string) => void
}) {
  return (
    <div className="vz-chain-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Effect Chain</span>
      </div>
      <div className="vz-chain-grid">
        {EFFECT_CHAIN_ITEMS.map(name => (
          <button key={name}
            className={`vz-chain-btn ${enabled.has(name) ? 'vz-chain-btn--active' : ''}`}
            onClick={() => onToggle(name)}
          >{name}</button>
        ))}
      </div>
    </div>
  )
}

// ── OutputModeCard ────────────────────────────────────────────────────
function OutputModeCard({ onFullscreen }: { onFullscreen: () => void }) {
  return (
    <div className="vz-output-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <span className="vz-panel-title">Output</span>
      </div>
      <div className="vz-output-body">
        <button className="vz-fullscreen-btn" onClick={onFullscreen}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ marginRight: 5 }}>
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
          Fullscreen Output
        </button>
        <span className="vz-hotkey-pill">F</span>
      </div>
    </div>
  )
}

// ── PresetStrip ───────────────────────────────────────────────────────
function PresetStrip({ activePresetId, presets, onSelect, onSave, onDelete }: {
  activePresetId: string
  presets: VzPreset[]
  onSelect: (id: string) => void
  onSave: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="vz-presets-section">
      <div className="vz-presets-header">
        <span className="vz-presets-label">Presets</span>
        <button className="vz-new-preset-btn" onClick={onSave}>
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          New
        </button>
      </div>
      <div className="vz-preset-cards">
        {presets.map(p => (
          <div
            key={p.id}
            className={`vz-preset-card ${activePresetId === p.id ? 'vz-preset-card--active' : ''}`}
            onClick={() => onSelect(p.id)}
            title={p.name}
          >
            <div className="vz-preset-thumb" style={{ background: p.gradient, position: 'relative' }}>
              {!p.isDefault && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                  title="Delete"
                  style={{
                    position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)',
                    border: 'none', color: 'rgba(245,248,250,0.6)', cursor: 'pointer',
                    fontSize: 8, borderRadius: 2, padding: '1px 3px', lineHeight: 1.4,
                  }}
                >✕</button>
              )}
            </div>
            <div className="vz-preset-name">{p.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ShortcutPanel ─────────────────────────────────────────────────────
function ShortcutPanel() {
  return (
    <div className="vz-shortcuts-section">
      <span className="vz-shortcuts-label">Shortcuts</span>
      <div className="vz-shortcut-grid">
        {SHORTCUTS.map(s => (
          <div key={s.key} className="vz-shortcut-card">
            <span className="vz-shortcut-key">{s.key}</span>
            <span className="vz-shortcut-desc">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SessionPanel ─────────────────────────────────────────────────────
function SessionPanel({ sessions, sessionsLoading, sessionSyncError, onSave, onLoad, onDelete, onRename, onClearSyncError }: {
  sessions: VzSession[]
  sessionsLoading: boolean
  sessionSyncError: string | null
  onSave: () => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
  onClearSyncError: () => void
}) {
  const [open, setOpen]               = useState(false)
  const [confirmId, setConfirmId]     = useState<string | null>(null)
  const [renamingId, setRenamingId]   = useState<string | null>(null)
  const [renameVal, setRenameVal]     = useState('')

  function fmtDate(ts: number) {
    const d = new Date(ts)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  function startRename(s: VzSession) {
    setRenamingId(s.id)
    setRenameVal(s.name)
    setConfirmId(null)
  }

  function commitRename(id: string) {
    const trimmed = renameVal.trim()
    if (trimmed) onRename(id, trimmed)
    setRenamingId(null)
  }

  return (
    <div className="vz-session-panel">
      <button className="vz-session-save-btn" onClick={onSave} title="Save current state as a session">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
          <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
        </svg>
        Save Session
      </button>

      {(sessions.length > 0 || sessionsLoading) && (
        <button
          className={`vz-session-load-btn ${open ? 'vz-session-load-btn--open' : ''}`}
          onClick={() => setOpen(v => !v)}
          title="Load a saved session"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
          </svg>
          {sessionsLoading ? 'Syncing…' : `Sessions (${sessions.length})`}
          <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ marginLeft: 3, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M7 10l5 5 5-5z"/>
          </svg>
        </button>
      )}

      {open && (
        <div className="vz-session-list">
          {sessionSyncError && (
            <div className="vz-session-sync-error">
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>⚠ {sessionSyncError}</span>
              <button className="vz-session-row-del" onClick={onClearSyncError}>✕</button>
            </div>
          )}
          {sessions.length === 0 && !sessionsLoading && (
            <div style={{ padding: '8px 10px', fontSize: 10, color: 'rgba(245,248,250,0.35)' }}>No sessions saved yet</div>
          )}
          {sessions.map(s => (
            <div key={s.id} className="vz-session-row">
              {confirmId === s.id ? (
                // ── Delete confirmation ──────────────────────────────────────
                <>
                  <span className="vz-session-confirm-msg">Delete "{s.name}"?</span>
                  <button className="vz-session-confirm-yes" onClick={() => { onDelete(s.id); setConfirmId(null) }}>Yes</button>
                  <button className="vz-session-confirm-no"  onClick={() => setConfirmId(null)}>No</button>
                </>
              ) : renamingId === s.id ? (
                // ── Inline rename ────────────────────────────────────────────
                <>
                  <input
                    className="vz-session-rename-input"
                    value={renameVal}
                    autoFocus
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => commitRename(s.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(s.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <button className="vz-session-confirm-yes" onMouseDown={() => commitRename(s.id)}>✓</button>
                </>
              ) : (
                // ── Normal row ───────────────────────────────────────────────
                <>
                  <span
                    className={`vz-session-source-badge vz-session-source-badge--${s.source}`}
                    title={s.source === 'cloud' ? 'Saved to cloud' : 'Local only'}
                  >
                    {s.source === 'cloud' ? '☁' : '○'}
                  </span>
                  <button
                    className="vz-session-row-name"
                    onClick={() => { onLoad(s.id); setOpen(false) }}
                    title={`Load "${s.name}"`}
                  >
                    <svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor" style={{ marginRight: 4, opacity: 0.5, flexShrink: 0 }}>
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    {s.name}
                  </button>
                  <span className="vz-session-row-meta">{fmtDate(s.updatedAt ?? s.createdAt)}</span>
                  <button
                    className="vz-session-row-action"
                    onClick={() => startRename(s)}
                    title="Rename"
                  >✎</button>
                  <button
                    className="vz-session-row-del"
                    onClick={() => setConfirmId(s.id)}
                    title="Delete session"
                  >✕</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VyzualzDock ───────────────────────────────────────────────────────
function VyzualzDock() {
  const {
    presets, activePresetId, bpm, setBpm, bpmSync, toggleBpmSync,
    quality, setQuality, resetEffects, resetModulationRoutes,
  } = useVisualStore()
  const { storageAvailable, authRequired } = useMediaStore()
  const preset = presets.find(p => p.id === activePresetId) ?? presets[0] ?? DEFAULT_PRESETS[0]
  const engine = useSharedAudio()
  const fileInputId = useId()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLButtonElement>(null)

  // Close on Escape or outside click
  useEffect(() => {
    if (!settingsOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false) }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      // Dismiss if click is outside the popover and the gear button itself
      if (gearRef.current?.contains(target)) return
      const popover = document.querySelector('.vz-settings-popover')
      if (popover && !popover.contains(target)) setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [settingsOpen])

  const vol    = engine.volume
  const volPct = `${Math.round(vol * 100)}%`

  const track = engine.tracks[engine.currentIndex] ?? null
  const hasTrack = engine.tracks.length > 0

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (audio.length) {
      engine.addTracks(audio)
      if (engine.source !== 'file') engine.setSource('file')
    }
  }

  const initial  = track?.displayName?.[0]?.toUpperCase() ?? '♪'
  const title    = track?.displayName ?? 'No track loaded'
  const srLabel  = `${(engine.sampleRate / 1000).toFixed(1)} kHz`

  return (
    <div className="az-dock">
      {/* Track info + upload */}
      <div className="az-dock-track">
        <label
          className="az-dock-thumb"
          htmlFor={fileInputId}
          title="Click to load audio"
          style={{ cursor: 'pointer', borderColor: preset.color + '40' }}
        >
          <span className="az-dock-thumb-letter" style={{ color: preset.color + 'cc' }}>
            {hasTrack ? initial : '♪'}
          </span>
        </label>
        <div className="az-dock-info">
          <span className="az-dock-title">{title}</span>
          {hasTrack && (
            <div className="az-dock-format">
              <span className="az-dock-format-tag">{srLabel}</span>
              <span className="az-dock-format-tag">Stereo</span>
            </div>
          )}
        </div>
        <label
          className="az-dock-upload-btn"
          htmlFor={fileInputId}
          title="Upload audio file"
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          Add Track
        </label>
      </div>

      {/* Transport */}
      <div className="az-dock-transport">
        <button className="az-transport-btn" title="Stop" disabled={!hasTrack}
          onClick={() => { engine.stop() }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
        </button>
        <button className="az-transport-btn" title="Previous" disabled={!hasTrack}
          onClick={engine.prev}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button
          className="az-play-btn"
          title={engine.isPlaying ? 'Pause' : 'Play'}
          disabled={!hasTrack}
          style={{ borderColor: preset.color, color: preset.color, boxShadow: `0 0 12px ${preset.color}30` }}
          onClick={engine.isPlaying ? engine.pause : engine.play}
        >
          {engine.isPlaying
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        <button className="az-transport-btn" title="Next" disabled={!hasTrack}
          onClick={engine.next}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      {/* Scrubber */}
      <TrackScrubber
        currentTime={engine.currentTime}
        duration={engine.duration}
        onSeek={engine.seek}
        disabled={!hasTrack}
        accentColor={preset.color}
      />

      <div className="vz-dock-bpm-group">
        <span className="vz-dock-bpm-label">BPM</span>
        <BpmInput value={bpm} onChange={setBpm} className="vz-dock-bpm-input" />
        <button
          className={`vz-dock-sync-btn${bpmSync ? ' vz-dock-sync-btn--on' : ''}`}
          onClick={toggleBpmSync}
          title={bpmSync ? 'BPM Sync: ON — click to disable' : 'BPM Sync: OFF — click to enable'}
        >
          {bpmSync && <span className="vz-dock-sync-dot" />}
          SYNC
        </button>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => handleFiles(e.target.files)}
      />

      <div className="az-dock-volume">
        <span className="az-dock-vol-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </span>
        <span className="az-dock-vol-db" style={{ fontSize: 9 }}>
          {vol < 0.001 ? '-∞ dB' : `${(20 * Math.log10(vol)).toFixed(1)} dB`}
        </span>
        <input type="range" className="az-dock-vol-slider"
          min={0} max={1} step={0.005} value={vol}
          onChange={e => engine.setVolume(parseFloat(e.target.value))}
          style={{ '--pct': volPct } as React.CSSProperties}
        />
      </div>

      <div className="az-dock-right" style={{ position: 'relative' }}>
        <select className="az-dock-source-select">
          <option>Main Out</option>
        </select>
        <button
          ref={gearRef}
          className={`az-dock-gear-btn${settingsOpen ? ' az-dock-gear-btn--active' : ''}`}
          title="VYZUALZ Settings"
          aria-label="VYZUALZ Settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(v => !v)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>

        {/* ── VYZUALZ Settings panel ─────────────────────────── */}
        {settingsOpen && (
          <div className="az-settings-popover vz-settings-popover">
            <div className="az-settings-popover-header">
              VYZUALZ Settings
              <button className="az-popover-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">✕</button>
            </div>
            <div className="az-settings-popover-body">

              {/* Quality */}
              <div>
                <div className="az-popover-section-title">Canvas Quality</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['High', 'Medium', 'Low'] as const).map(q => (
                    <button
                      key={q}
                      className={`vz-settings-seg-btn${quality === q ? ' vz-settings-seg-btn--active' : ''}`}
                      onClick={() => setQuality(q)}
                    >{q}</button>
                  ))}
                </div>
              </div>

              {/* BPM Sync */}
              <div>
                <div className="az-popover-section-title">BPM Sync</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className={`vz-settings-seg-btn${bpmSync ? ' vz-settings-seg-btn--active' : ''}`}
                    onClick={toggleBpmSync}
                    style={{ minWidth: 54 }}
                  >{bpmSync ? 'ON' : 'OFF'}</button>
                  <span style={{ fontSize: 10, color: 'rgba(245,248,250,0.45)' }}>
                    {bpmSync ? `Locked to ${bpm} BPM` : 'Free-running beat phase'}
                  </span>
                </div>
              </div>

              {/* Media sync status */}
              <div>
                <div className="az-popover-section-title">Media Sync</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                    background: storageAvailable && !authRequired ? '#58d15b' : 'rgba(245,248,250,0.2)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: 'rgba(245,248,250,0.55)' }}>
                    {!storageAvailable ? 'Local only — Supabase not configured'
                      : authRequired   ? 'Signed out — media stored locally'
                      :                  'Cloud sync enabled'}
                  </span>
                </div>
              </div>

              {/* Reset actions */}
              <div>
                <div className="az-popover-section-title">Reset</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    className="vz-settings-reset-btn"
                    onClick={() => { resetEffects(); setSettingsOpen(false) }}
                    title="Set all effect sliders back to defaults"
                  >Reset Effects</button>
                  <button
                    className="vz-settings-reset-btn"
                    onClick={() => { resetModulationRoutes(); setSettingsOpen(false) }}
                    title="Restore default audio modulation routing"
                  >Reset Modulation</button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────
interface Props {
  activeView: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate: (v: 'analyzer' | 'reference' | 'vyzualz') => void
}

export function VyzualzView({ activeView, onNavigate }: Props) {
  const engine = useSharedAudio()
  const analyser = engine.analyserMaster

  const {
    effects, enabledFxArr,
    activeMediaId, presets, activePresetId,
    bpm, bpmSync, isPlaying, quality,
    setEffect, resetEffects, toggleFx, selectPreset, savePreset, deletePreset,
    setActiveMedia, setBpm, toggleBpmSync, setPlaying, setQuality,
    sessions, sessionsLoading, sessionSyncError,
    saveSession, loadSession, renameSession, deleteSession,
    syncSessionsFromCloud, clearSessionSyncError,
    modulationRoutes, toggleModulationRoute, setModulationRouteAmount,
  } = useVisualStore()

  const { items, loading, reorderItems } = useMediaStore()

  const enabledFxSet = useMemo(() => new Set(enabledFxArr), [enabledFxArr])

  // After Supabase load completes, restore or auto-select active media
  useEffect(() => {
    if (loading) return
    if (!items.length) return
    if (activeMediaId && items.some(i => i.id === activeMediaId)) return
    setActiveMedia(items[0].id)
  }, [items, activeMediaId, loading, setActiveMedia])
  const activeMedia  = items.find(i => i.id === activeMediaId) ?? null

  // Live bass for BeatCanvas
  const [bassLive, setBassLive] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBufRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef     = useRef<number>(0)

  useEffect(() => {
    analyserRef.current = analyser
    freqBufRef.current  = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    function frame() {
      const an  = analyserRef.current
      const buf = freqBufRef.current
      if (an && buf) {
        an.getByteFrequencyData(buf)
        setBassLive(getBandAvg(buf, an.context.sampleRate, 20, 250))
      }
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const tapTimesRef   = useRef<number[]>([])
  const canvasWrapRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  const handlePrevMedia = useCallback(() => {
    if (!items.length) return
    const idx = items.findIndex(i => i.id === activeMediaId)
    const prev = idx <= 0 ? items[items.length - 1] : items[idx - 1]
    setActiveMedia(prev.id)
  }, [items, activeMediaId, setActiveMedia])

  const handleNextMedia = useCallback(() => {
    if (!items.length) return
    const idx = items.findIndex(i => i.id === activeMediaId)
    const next = idx === -1 || idx >= items.length - 1 ? items[0] : items[idx + 1]
    setActiveMedia(next.id)
  }, [items, activeMediaId, setActiveMedia])

  const handleTap = useCallback(() => {
    const now = performance.now()
    const times = tapTimesRef.current
    times.push(now)
    if (times.length > 4) times.splice(0, times.length - 4)
    if (times.length >= 2) {
      const intervals = times.slice(1).map((t, i) => t - times[i])
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
      setBpm(Math.round(60000 / avg))
    }
  }, [setBpm])

  const handleFullscreen = useCallback(() => {
    canvasWrapRef.current?.requestFullscreen?.().catch(() => {})
  }, [])

  // Sync cloud sessions on mount
  useEffect(() => { syncSessionsFromCloud() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePreset = useCallback(() => {
    const name = prompt('Preset name:')?.trim()
    if (name) savePreset(name)
  }, [savePreset])

  const handleSaveSession = useCallback(() => {
    const name = prompt('Session name:')?.trim()
    if (!name) return
    const mediaOrder = items.map(i => i.id)
    saveSession(name, engine.source as VzSession['audioSource'], mediaOrder)
  }, [items, engine.source, saveSession])

  const handleLoadSession = useCallback((id: string) => {
    const session = loadSession(id)  // applies visual/preset/bpm/quality state
    if (!session) return
    // Restore audio source
    if (session.audioSource && engine.source !== session.audioSource) {
      engine.setSource(session.audioSource)
    }
    // Restore media deck order: put saved items first, extras at the end
    if (session.mediaOrder?.length) {
      reorderItems(session.mediaOrder)
    }
    // If saved activeMediaId no longer exists, fall back to first item in deck
    const allIds = items.map(i => i.id)
    if (session.activeMediaId && !allIds.includes(session.activeMediaId)) {
      const firstSaved = session.mediaOrder.find(id => allIds.includes(id))
      setActiveMedia(firstSaved ?? (items[0]?.id ?? null))
    }
  }, [loadSession, engine, reorderItems, items, setActiveMedia])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'f' || e.key === 'F') handleFullscreen()
      if (e.key === ' ') { e.preventDefault(); setPlaying(!isPlaying) }
      if (e.key >= '1' && e.key <= '5') {
        const preset = presets[parseInt(e.key) - 1]
        if (preset) selectPreset(preset.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, presets, selectPreset, setPlaying, handleFullscreen])

  return (
    <div className="az-root">
      <div className="az-shell">
        <AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} />

        <div className="vz-main">
          <VyzualzHeader analyser={analyser} bassLive={bassLive} />

          <div className="vz-body">
            <div className="vz-left">
              <MediaDeckPanel activeMediaId={activeMediaId} onSelect={setActiveMedia} />
            </div>

            <div className="vz-center">
              <LiveVisualPreview
                analyser={analyser}
                activeMedia={activeMedia}
                effects={effects}
                enabledFx={enabledFxSet}
                isPlaying={isPlaying}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onPrev={handlePrevMedia}
                onNext={handleNextMedia}
                bpm={bpm}
                onBpmChange={setBpm}
                bpmSync={bpmSync}
                onToggleBpmSync={toggleBpmSync}
                onTap={handleTap}
                quality={quality}
                onQualityChange={setQuality}
                canvasWrapRef={canvasWrapRef}
                audioTime={engine.currentTime}
                modulationRoutes={modulationRoutes}
              />
              <AudioAnalyzerPanel analyser={analyser} />
            </div>

            <div className="vz-right">
              <EffectControlsPanel
                effects={effects}
                onChange={setEffect}
                onReset={resetEffects}
              />
              <EffectChainPanel enabled={enabledFxSet} onToggle={toggleFx} />
              <ModulationPanel
                routes={modulationRoutes}
                onToggle={toggleModulationRoute}
                onSetAmount={setModulationRouteAmount}
              />
              <OutputModeCard onFullscreen={handleFullscreen} />
            </div>
          </div>

          <div className="vz-bottom">
            <PresetStrip
              activePresetId={activePresetId}
              presets={presets}
              onSelect={selectPreset}
              onSave={handleSavePreset}
              onDelete={deletePreset}
            />
            <SessionPanel
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              sessionSyncError={sessionSyncError}
              onSave={handleSaveSession}
              onLoad={handleLoadSession}
              onDelete={deleteSession}
              onRename={renameSession}
              onClearSyncError={clearSessionSyncError}
            />
            <ShortcutPanel />
          </div>
        </div>
      </div>

      <VyzualzDock />
    </div>
  )
}

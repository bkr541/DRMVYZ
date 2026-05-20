import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import {
  Layers01Icon,
  ChartHistogramIcon,
  Route01Icon,
  MagicWand01Icon,
  Flowchart01Icon,
  Tv01Icon,
} from 'hugeicons-react'
import { AnalyzerSidebar } from '../analyzer/AnalyzerSidebar'
import { useSharedAudio }  from '../../context/AudioEngineContext'
import { useMediaStore }   from '../../stores/mediaStore'
import { useVisualStore, DEFAULT_PRESETS }  from '../../stores/visualStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzEffects, VzPreset, VzSession, Quality, PresetScope } from '../../stores/visualStore'
import { LOOK_SCOPE, SCENE_SCOPE } from '../../stores/visualStore'
import { extractBandValues, applyModulatedEffects, BAND_LABELS, EFFECT_LABELS, getBandAvg } from '../../lib/audioModulation'
import type { ModulationRoute, AudioBandValues } from '../../lib/audioModulation'
import { TrackScrubber } from '../shared/TrackScrubber'
import { MediaUploadModal } from './MediaUploadModal'
import { LyricManagerModal } from './LyricManagerModal'
import { TimelinePanel } from './TimelinePanel'
import { VyzualzErrorBoundary } from './VyzualzErrorBoundary'
import {
  getActiveTimelineClip, getNextTimelineClip, getTransitionState,
  getClipSourceTime, shouldFreezeClipFrame,
} from '../../lib/timeline'
import type { TwoClipRenderState } from '../../lib/timeline'
import type { VzTimelineClip } from '../../types/timeline'
import { renderTimelineTransition } from '../../lib/transitionRenderer'
import type { MediaRole } from '../../lib/mediaRoles'
import {
  VZ_LAYER_RENDER_ORDER, LAYER_TO_ROLES, LAYER_MANAGED_ROLES,
  DEFAULT_LAYER_CONFIGS, LAYER_LABELS, LAYER_BLEND_MODES, ROLE_TO_LAYER,
} from '../../types/vzLayers'
import type { VzLayerConfig, VzLayerConfigId } from '../../types/vzLayers'
import {
  drawSpectrumBars, drawCircularSpectrum, drawOscilloscope,
  updateAndDrawBeatRings, updateAndDrawParticles,
  drawReactiveGrid, getCameraShakeOffset,
  drawKaleidoscope, drawMirrorSplit, drawRadialBlur,
  drawVhsStatic, drawDatamoshSmear, drawEdgeGlow, drawColorCycle,
} from './visualEffects'
import type { BeatRing, BurstParticle } from './visualEffects'

// ── Constants ─────────────────────────────────────────────────────────
const EFFECT_CHAIN_ITEMS = [
  'RGB Split','Glitch Bars','Scanlines','Tunnel','Displacement','Noise Fog','Bloom','Feedback','Strobe','Color Shift',
  'Spectrum Bars','Circular Spectrum','Oscilloscope','Beat Ring','Particle Burst',
  'Reactive Grid','Camera Shake','Kaleidoscope','Mirror Split','Radial Blur',
  'VHS Static','Datamosh Smear','Edge Glow','Color Cycle',
] as const

/** Maps VzEffects keys → their controlling chain item name. Keys absent from this map have no chain gate. */
const EFFECT_CONTROL_CHAIN_MAP: Partial<Record<keyof VzEffects, string>> = {
  glitchAmount:    'Glitch Bars',
  rgbSplit:        'RGB Split',
  tunnelSpeed:     'Tunnel',
  displacement:    'Displacement',
  bloom:           'Bloom',
  strobe:          'Strobe',
  feedbackTrails:  'Feedback',
  colorShift:      'Color Shift',
  spectrumBars:    'Spectrum Bars',
  circularSpectrum: 'Circular Spectrum',
  oscilloscope:    'Oscilloscope',
  beatRing:        'Beat Ring',
  particleBurst:   'Particle Burst',
  reactiveGrid:    'Reactive Grid',
  cameraShake:     'Camera Shake',
  kaleidoscope:    'Kaleidoscope',
  mirrorSplit:     'Mirror Split',
  radialBlur:      'Radial Blur',
  vhsStatic:       'VHS Static',
  datamoshSmear:   'Datamosh Smear',
  edgeGlow:        'Edge Glow',
  colorCycle:      'Color Cycle',
}
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

// ── VzSlider ──────────────────────────────────────────────────────────
function VzSlider({ label, value, min = 0, max = 1, step = 0.01, onChange, colorTrack, chainEnabled }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; colorTrack?: boolean
  /** When explicitly false, renders dimmed with an "Off in chain" hint. */
  chainEnabled?: boolean
}) {
  const pct   = `${((value - min) / (max - min)) * 100}%`
  const isOff = chainEnabled === false
  return (
    <div className={`vz-slider-wrap${isOff ? ' vz-slider-wrap--off' : ''}`}>
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
      {isOff && <span className="vz-slider-chain-hint">Off in chain</span>}
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
      grad.addColorStop(0, `rgba(74,199,219,0)`)
      grad.addColorStop(0.25, `rgba(74,199,219,${alpha})`)
      grad.addColorStop(0.75, `rgba(74,199,219,${alpha})`)
      grad.addColorStop(1, `rgba(74,199,219,0)`)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
      })
      ctx.strokeStyle = `rgba(74,199,219,${0.55 + beatPulse * 0.4})`
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, mid); ctx.lineTo(cW, mid)
      ctx.strokeStyle = 'rgba(74,199,219,0.1)'
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
  ctx.strokeStyle = 'rgba(74,199,219,0.04)'
  ctx.lineWidth = dpr
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(angle) * Math.max(W, H), cy + Math.sin(angle) * Math.max(W, H))
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = 'rgba(74,199,219,0.04)'
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
    ctx.strokeStyle = `rgba(74,199,219,${alpha})`
    ctx.lineWidth = 1.5 * dpr
    ctx.shadowColor = '#4ac7db'
    ctx.shadowBlur = 8
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
    ctx.shadowBlur = 0
  }

  const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.18)
  innerGlow.addColorStop(0, 'rgba(74,199,219,0.07)')
  innerGlow.addColorStop(1, 'rgba(74,199,219,0)')
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

  ctx.shadowColor = '#4ac7db'
  ctx.shadowBlur = 24 + bass * effects.bloom * 20
  ctx.fillStyle = 'rgba(74,199,219,0.92)'
  ctx.fillText('DVYDRM', cx, cy)
  ctx.shadowBlur = 0

  const subSize = fontSize * 0.26
  ctx.globalAlpha = 0.35
  ctx.font = `400 ${subSize}px Inter, sans-serif`
  ctx.fillStyle = '#4ac7db'
  ctx.fillText('DREAM  WORLD', cx, cy + fontSize * 0.7)
  ctx.globalAlpha = 1
}

// ── Role-based rendering helpers ─────────────────────────────────────

function shouldRenderRoleByDefault(role: MediaRole | null): boolean {
  if (!role) return true
  return role !== 'reference' && role !== 'texture' && role !== 'transition'
}

function getDefaultFitModeForRole(role: MediaRole | null): 'cover' | 'contain' {
  if (!role) return 'cover'
  switch (role) {
    case 'logo':
    case 'transparent_element':
    case 'character_art':
      return 'contain'
    default:
      return 'cover'
  }
}

function getCompositeOpForRole(role: MediaRole | null): GlobalCompositeOperation {
  return role === 'overlay' ? 'screen' : 'source-over'
}

function shouldApplyScalePulse(role: MediaRole | null): boolean {
  if (!role || role === 'other') return true
  return role === 'logo' || role === 'transparent_element' || role === 'character_art'
}

function getMediaNaturalSize(el: HTMLImageElement | HTMLVideoElement): { w: number; h: number } {
  if (el instanceof HTMLImageElement) return { w: el.naturalWidth || 0, h: el.naturalHeight || 0 }
  return { w: el.videoWidth || 0, h: el.videoHeight || 0 }
}

function computeDrawRect(
  W: number, H: number,
  el: HTMLImageElement | HTMLVideoElement,
  fitMode: 'cover' | 'contain',
  scale: number,
  role: MediaRole | null
): { ox: number; oy: number; sw: number; sh: number } {
  const { w: imgW, h: imgH } = getMediaNaturalSize(el)

  if (!imgW || !imgH) {
    // Dimensions not available yet — fill canvas with scale
    const sw = W * scale, sh = H * scale
    return { ox: (W - sw) / 2, oy: (H - sh) / 2, sw, sh }
  }

  const imgAspect    = imgW / imgH
  const canvasAspect = W / H
  let drawW: number, drawH: number

  if (fitMode === 'cover') {
    if (imgAspect >= canvasAspect) {
      // Image proportionally wider — fit by height so height fills canvas
      drawH = H * scale
      drawW = drawH * imgAspect
    } else {
      // Image proportionally taller — fit by width so width fills canvas
      drawW = W * scale
      drawH = drawW / imgAspect
    }
  } else {
    // contain — show entire image, letterbox/pillarbox as needed
    if (imgAspect >= canvasAspect) {
      // Image proportionally wider — constrain by width
      drawW = W * scale
      drawH = drawW / imgAspect
    } else {
      // Image proportionally taller — constrain by height
      drawH = H * scale
      drawW = drawH * imgAspect
    }
  }

  let ox = (W - drawW) / 2
  let oy = (H - drawH) / 2

  // Character art: anchor slightly below center for natural staging
  if (role === 'character_art') oy = H * 0.55 - drawH / 2

  return { ox, oy, sw: drawW, sh: drawH }
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
  // Timeline
  timelineEnabled: boolean
  timelineClips: VzTimelineClip[]
  timelineLoop: boolean
  mediaItems: UploadedMedia[]
  onFpsUpdate: (fps: number) => void
  // Layer compositor
  layerConfigs: VzLayerConfig[]
}

function LiveVisualCanvas({ analyser, activeMedia, effects, enabledFx, isPlaying, bpm, bpmSync, quality, audioTime, modulationRoutes, timelineEnabled, timelineClips, timelineLoop, mediaItems, onFpsUpdate, layerConfigs }: CanvasProps) {
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

  // Timeline refs
  const timelineEnabledRef = useRef(timelineEnabled)
  const timelineClipsRef   = useRef<VzTimelineClip[]>(timelineClips)
  const timelineLoopRef    = useRef(timelineLoop)
  const mediaItemsRef      = useRef<UploadedMedia[]>(mediaItems)
  const layerConfigsRef    = useRef<VzLayerConfig[]>(layerConfigs)
  // Shared pool: keyed by mediaId, used by both timeline clips and overlay layers
  const mediaPoolRef       = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map())
  const activeClipIdRef    = useRef<string | null>(null)
  const timelineClockRef   = useRef(0)
  const lastFrameTimeRef   = useRef<number | null>(null)

  // Stateful effect refs — persistent between frames (no re-render on change)
  const beatRingsRef     = useRef<BeatRing[]>([])
  const particlesRef     = useRef<BurstParticle[]>([])
  const offscreenRef     = useRef<HTMLCanvasElement | null>(null)
  const shakeAmountRef   = useRef(0)
  const colorCycleHueRef = useRef(0)
  const timeBufRef       = useRef<Uint8Array<ArrayBuffer> | null>(null)

  // Role-based rendering refs — updated when active media or timeline clip changes
  const activeMediaRoleRef    = useRef<MediaRole | null>(null)
  const activeMediaFitModeRef = useRef<'cover' | 'contain' | null>(null)

  // Active clip object ref — kept in sync with activeClipIdRef for per-frame video control
  const activeClipRef = useRef<VzTimelineClip | null>(null)

  // Transition rendering refs
  const incomingMediaElRef   = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const transitionStateRef   = useRef<TwoClipRenderState | null>(null)
  const incomingRoleRef      = useRef<MediaRole | null>(null)
  const incomingFitModeRef   = useRef<'cover' | 'contain' | null>(null)
  const prevTransitionOnRef  = useRef(false)

  // FPS measurement — updated once per second inside the RAF loop
  const fpsRef            = useRef(0)
  const fpsFrameCountRef  = useRef(0)
  const fpsWindowStartRef = useRef<number>(0)
  const onFpsUpdateRef    = useRef(onFpsUpdate)

  // Timeline clock store writer — grabbed once at mount, stable forever
  const setTimelineClockStoreRef = useRef<(t: number) => void>(() => {})

  // Sync refs on every render (cheap assignments)
  useEffect(() => { onFpsUpdateRef.current = onFpsUpdate })
  useEffect(() => { effectsRef.current  = effects })
  useEffect(() => { enabledFxRef.current = enabledFx })
  useEffect(() => { isPlayingRef.current = isPlaying })
  useEffect(() => { bpmRef.current = bpm })
  useEffect(() => { bpmSyncRef.current = bpmSync })
  useEffect(() => { qualityRef.current = quality; resizeFnRef.current() }, [quality])
  useEffect(() => { audioTimeRef.current = audioTime })
  useEffect(() => { routesRef.current = modulationRoutes }, [modulationRoutes])
  useEffect(() => { timelineEnabledRef.current = timelineEnabled }, [timelineEnabled])
  useEffect(() => { timelineClipsRef.current = timelineClips }, [timelineClips])
  useEffect(() => { timelineLoopRef.current = timelineLoop }, [timelineLoop])
  useEffect(() => { mediaItemsRef.current = mediaItems }, [mediaItems])
  useEffect(() => { layerConfigsRef.current = layerConfigs }, [layerConfigs])

  useEffect(() => {
    setTimelineClockStoreRef.current = useVisualStore.getState().setTimelineClock
  }, [])

  // Mirror scrub commands from the UI back into the canvas clock
  useEffect(() => {
    return useVisualStore.subscribe((state) => {
      const t = state.timelineClock
      if (Math.abs(timelineClockRef.current - t) > 0.05) {
        timelineClockRef.current = t
        lastFrameTimeRef.current = null
      }
    })
  }, [])

  useEffect(() => {
    analyserRef.current  = analyser
    freqBufRef.current   = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    timeBufRef.current   = analyser ? new Uint8Array(analyser.fftSize) : null
  }, [analyser])

  // Load/unload media element when active media changes
  useEffect(() => {
    const prev = mediaElRef.current
    if (prev instanceof HTMLVideoElement) { prev.pause(); prev.src = '' }
    mediaElRef.current = null
    // Sync role so the RAF loop draws with correct fit/composite
    activeMediaRoleRef.current    = activeMedia?.mediaRole ?? null
    activeMediaFitModeRef.current = null // no clip override in single-media mode

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
  // Intentionally keyed on activeMedia.id only — re-create the media element
  // when clip identity changes, not on every render. isPlayingRef is a stable
  // ref; reading .current inside an effect is safe without a dep entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia?.id])

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

  // Reset timeline clock when timeline is enabled; clean up pool when disabled
  useEffect(() => {
    if (timelineEnabled) {
      timelineClockRef.current = 0
      lastFrameTimeRef.current = null
      activeClipIdRef.current  = null
    } else {
      // Clear pool and give back the mediaElRef to the single-media system
      mediaPoolRef.current.forEach(el => {
        if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
      })
      mediaPoolRef.current.clear()
      activeClipIdRef.current = null
    }
  }, [timelineEnabled])

  // Sync pool when clips or deck changes: evict entries no longer needed by
  // either the timeline OR the overlay layer compositor.
  useEffect(() => {
    const tlIds    = new Set(timelineClips.map(c => c.mediaId))
    const layerIds = new Set(
      mediaItems
        .filter(m => LAYER_MANAGED_ROLES.has(m.mediaRole))
        .map(m => m.id)
    )
    const keepIds = new Set([...tlIds, ...layerIds])
    mediaPoolRef.current.forEach((el, id) => {
      if (!keepIds.has(id)) {
        if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
        mediaPoolRef.current.delete(id)
      }
    })
  }, [timelineClips, mediaItems])

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

      // ── FPS measurement ────────────────────────────────────────────
      const now = performance.now()
      fpsFrameCountRef.current += 1
      if (fpsWindowStartRef.current === 0) fpsWindowStartRef.current = now
      const elapsed = now - fpsWindowStartRef.current
      if (elapsed >= 1000) {
        fpsRef.current = Math.round((fpsFrameCountRef.current * 1000) / elapsed)
        onFpsUpdateRef.current(fpsRef.current)
        fpsFrameCountRef.current  = 0
        fpsWindowStartRef.current = now
      }

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

      // Gate chain-controlled effects — zero out when toggled off in Effect Chain
      const activeColorShift = fxSet.has('Color Shift') ? mEff.colorShift : 0
      const activeStrobe     = fxSet.has('Strobe')      ? mEff.strobe     : 0

      // Derive renderer-level variables from modulated effects
      const bassReact   = 1 + smoothBass * mEff.bassReactivity * 0.35 * mEff.masterIntensity
      const dispMod     = mEff.displacement
      const feedbackMod = Math.min(0.97, mEff.feedbackTrails)
      const glitchMod   = mEff.glitchAmount
      const edgeFlicker = high * mEff.masterIntensity
      const bloomMod    = Math.min(1, mEff.bloom)

      // Beat boundary → flash hit / transition frame
      const onBeatBoundary = synced && beatPhase < 0.04
      // Free-mode transient detector — used by beat-reactive new effects
      const beatHit = onBeatBoundary || (!synced && bass > 0.65 && bass > prevBassRef.current + 0.07)

      // ── Background / feedback ──────────────────────────────────────
      // Low-mid modulates feedback retention (smear/bend)
      if (fxSet.has('Feedback') && feedbackMod > 0) {
        ctx.fillStyle = `rgba(5,7,9,${1 - feedbackMod * 0.92})`
        ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = '#090d0f'
        ctx.fillRect(0, 0, W, H)
      }

      // ── Datamosh Smear: draw previous frame ghost ─────────────────
      if (fxSet.has('Datamosh Smear') && mEff.datamoshSmear > 0 && offscreenRef.current) {
        drawDatamoshSmear(ctx, W, H, offscreenRef.current, mEff.datamoshSmear, rawBands.volume)
      }

      // ── Timeline clock & active clip ──────────────────────────────
      if (timelineEnabledRef.current && timelineClipsRef.current.length > 0) {
        const nowMs = performance.now()
        const audioT = audioTimeRef.current
        if (audioT > 0) {
          // Audio engine time is authoritative — keeps timeline synced to track
          timelineClockRef.current = audioT
        } else if (isPlayingRef.current) {
          // Wall-clock fallback
          if (lastFrameTimeRef.current !== null) {
            timelineClockRef.current += (nowMs - lastFrameTimeRef.current) / 1000
          }
        }
        lastFrameTimeRef.current = nowMs
        setTimelineClockStoreRef.current(timelineClockRef.current)

        const clips = timelineClipsRef.current
        const { clip, localTimeSec } = getActiveTimelineClip(clips, timelineClockRef.current, timelineLoopRef.current)
        const clipId = clip?.id ?? null

        if (clipId !== activeClipIdRef.current) {
          activeClipIdRef.current = clipId
          activeClipRef.current   = clip ?? null
          if (clip) {
            // Sync role refs for the incoming clip's media
            const m = mediaItemsRef.current.find(x => x.id === clip.mediaId)
            activeMediaRoleRef.current    = m?.mediaRole ?? null
            activeMediaFitModeRef.current = clip.fitMode

            const pool = mediaPoolRef.current
            if (!pool.has(clip.mediaId)) {
              if (m) {
                if (m.type === 'image') {
                  const img = new Image()
                  img.src = m.url
                  pool.set(m.id, img)
                } else {
                  const vid = document.createElement('video')
                  vid.src = m.url
                  vid.muted = true
                  vid.playsInline = true
                  pool.set(m.id, vid)
                }
              }
            }
            const el = pool.get(clip.mediaId) ?? null
            mediaElRef.current = el
            if (el instanceof HTMLVideoElement) {
              // Seek to initial in-point; manual sync takes over from here
              el.loop        = false  // we manage looping/trimming ourselves
              el.currentTime = clip.mediaInSec
              if (isPlayingRef.current) el.play().catch(() => {})
            }
          } else {
            mediaElRef.current = null
            activeClipRef.current         = null
            activeMediaRoleRef.current    = null
            activeMediaFitModeRef.current = null
          }
        }

        // ── Pre-warm next clip + compute transition state ─────────────
        // Preload the clip that follows the active one so the pool is ready
        // before its transition window opens.
        if (clip) {
          const nextClip = getNextTimelineClip(clips, clip.id, timelineLoopRef.current)
          if (nextClip && !mediaPoolRef.current.has(nextClip.mediaId)) {
            const nm = mediaItemsRef.current.find(x => x.id === nextClip.mediaId)
            if (nm) {
              if (nm.type === 'image') {
                const img = new Image(); img.src = nm.url
                mediaPoolRef.current.set(nm.id, img)
              } else {
                const vid = document.createElement('video')
                vid.src = nm.url; vid.muted = true; vid.playsInline = true
                mediaPoolRef.current.set(nm.id, vid)
              }
            }
          }
        }

        const txState = getTransitionState(clips, timelineClockRef.current, timelineLoopRef.current)
        transitionStateRef.current = txState

        const txNowActive    = txState !== null
        const txJustStarted  = txNowActive && !prevTransitionOnRef.current
        prevTransitionOnRef.current = txNowActive

        if (txState) {
          const inClip  = txState.incomingClip
          // Ensure incoming clip element exists in pool
          if (!mediaPoolRef.current.has(inClip.mediaId)) {
            const inm = mediaItemsRef.current.find(x => x.id === inClip.mediaId)
            if (inm) {
              if (inm.type === 'image') {
                const img = new Image(); img.src = inm.url
                mediaPoolRef.current.set(inm.id, img)
              } else {
                const vid = document.createElement('video')
                vid.src = inm.url; vid.muted = true; vid.playsInline = true
                mediaPoolRef.current.set(inm.id, vid)
              }
            }
          }
          const inEl = mediaPoolRef.current.get(inClip.mediaId) ?? null
          incomingMediaElRef.current  = inEl
          const inm = mediaItemsRef.current.find(x => x.id === inClip.mediaId)
          incomingRoleRef.current     = inm?.mediaRole ?? null
          incomingFitModeRef.current  = inClip.fitMode
          // On transition start: seek incoming video to its in-point (localTime = 0)
          if (txJustStarted && inEl instanceof HTMLVideoElement) {
            const inDur = isFinite(inEl.duration) ? inEl.duration : 0
            inEl.currentTime = getClipSourceTime(inClip, 0, inDur)
            inEl.loop        = false  // we manage looping ourselves
            if (isPlayingRef.current) inEl.play().catch(() => {})
          }
        } else {
          incomingMediaElRef.current = null
          incomingRoleRef.current    = null
          incomingFitModeRef.current = null
        }

        // ── Per-frame video sync (outgoing / primary clip) ────────────
        const DRIFT = 0.12
        const activeVid = mediaElRef.current
        if (activeClipRef.current && activeVid instanceof HTMLVideoElement) {
          const aClip  = activeClipRef.current
          const dur    = isFinite(activeVid.duration) ? activeVid.duration : 0
          const frozen = shouldFreezeClipFrame(aClip, localTimeSec, dur)

          if (frozen) {
            if (!activeVid.paused) activeVid.pause()
          } else {
            const desired = getClipSourceTime(aClip, localTimeSec, dur)
            if (isPlayingRef.current) {
              if (activeVid.paused) activeVid.play().catch(() => {})
              if (Math.abs(activeVid.currentTime - desired) > DRIFT) {
                activeVid.currentTime = desired
              }
            } else {
              if (Math.abs(activeVid.currentTime - desired) > DRIFT) {
                activeVid.currentTime = desired
              }
              if (!activeVid.paused) activeVid.pause()
            }
          }
        }

        // ── Per-frame video sync (incoming clip during overlap) ───────
        const txCurrent = transitionStateRef.current
        const inVid     = incomingMediaElRef.current
        if (txCurrent && inVid instanceof HTMLVideoElement) {
          const inClipSync = txCurrent.incomingClip
          const inDurSync  = isFinite(inVid.duration) ? inVid.duration : 0
          const desired    = getClipSourceTime(inClipSync, txCurrent.incomingLocalTimeSec, inDurSync)
          if (isPlayingRef.current) {
            if (inVid.paused) inVid.play().catch(() => {})
            if (Math.abs(inVid.currentTime - desired) > DRIFT) inVid.currentTime = desired
          } else {
            if (Math.abs(inVid.currentTime - desired) > DRIFT) inVid.currentTime = desired
            if (!inVid.paused) inVid.pause()
          }
        }
      }

      const mediaEl = mediaElRef.current
      const cx = W / 2, cy = H / 2

      // ── Role-aware draw setup ──────────────────────────────────────
      const role        = activeMediaRoleRef.current
      const renderMedia = shouldRenderRoleByDefault(role)
      const fitMode     = activeMediaFitModeRef.current ?? getDefaultFitModeForRole(role)
      const compositeOp = getCompositeOpForRole(role)
      // Scale pulse only for roles that call for bass reactivity (logo, character, transparent, fallback)
      const scale = shouldApplyScalePulse(role)
        ? bassReact * punchScale * eff.logoScale
        : 1
      const { ox, oy, sw, sh } = mediaEl
        ? computeDrawRect(W, H, mediaEl, fitMode, scale, role)
        : { ox: 0, oy: 0, sw: W, sh: H }

      // ── Camera Shake: apply transform before main scene ──────────
      let shakeApplied = false
      if (fxSet.has('Camera Shake') && mEff.cameraShake > 0) {
        const { dx, dy } = getCameraShakeOffset(shakeAmountRef, smoothBass, beatHit, mEff.cameraShake)
        if (Math.abs(dx) + Math.abs(dy) > 0.1) {
          ctx.save()
          ctx.translate(Math.round(dx), Math.round(dy))
          shakeApplied = true
        }
      }

      if (mediaEl && renderMedia) {
        // ── Reactive Grid (behind media) ───────────────────────────
        if (fxSet.has('Reactive Grid') && mEff.reactiveGrid > 0) {
          drawReactiveGrid(ctx, W, H, dpr, t, mEff.reactiveGrid, bass, rawBands.lowMid)
        }

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
            ctx.strokeStyle = `rgba(74,199,219,${alpha})`
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

        // ── Main draw (transition-aware) ───────────────────────────
        {
          const txState = transitionStateRef.current
          const inEl    = incomingMediaElRef.current

          // Helper: compute draw rect for incoming clip using its own role/fit/scale
          const inRole        = incomingRoleRef.current
          const inFitMode     = incomingFitModeRef.current ?? getDefaultFitModeForRole(inRole)
          const inScale       = shouldApplyScalePulse(inRole) ? bassReact * punchScale * eff.logoScale : 1
          const inRect        = inEl ? computeDrawRect(W, H, inEl, inFitMode, inScale, inRole)
                                     : { ox: 0, oy: 0, sw: W, sh: H }
          const inCompositeOp = getCompositeOpForRole(inRole)

          if (txState && txState.config.type !== 'cut') {
            // ── Transition: delegated to centralized renderer ─────
            renderTimelineTransition({
              ctx, W, H,
              outEl:          mediaEl,
              outRect:        { ox, oy, sw, sh },
              outCompositeOp: compositeOp,
              inEl,
              inRect,
              inCompositeOp,
              config:         txState.config,
              progress:       txState.progress,
              time:           t,
              colorShift:     activeColorShift,
              bass:           rawBands.bass,
              beat:           rawBands.beat,
            })
          } else {
            // ── Normal main draw (no active transition) ───────────
            ctx.save()
            if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
            if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360}deg)`
            ctx.drawImage(mediaEl, ox, oy, sw, sh)
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'source-over'
            ctx.restore()
          }
        }

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
          if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360 + 90}deg)`
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
        drawGenerativeArt(ctx, W, H, dpr, t, speed, bass, { ...mEff, colorShift: activeColorShift })
      } else {
        // ── Idle — no media, not playing, no signal ────────────────
        const cx = W / 2, cy = H / 2
        ctx.save()
        ctx.globalAlpha = 0.18
        ctx.strokeStyle = 'rgba(74,199,219,0.5)'
        ctx.lineWidth = 1.5 * dpr
        ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.12, 0, Math.PI * 2); ctx.stroke()
        ctx.globalAlpha = 1
        const fs = Math.max(9 * dpr, Math.min(13 * dpr, W * 0.025))
        ctx.font = `600 ${fs}px 'JetBrains Mono', 'Fira Code', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(74,199,219,0.28)'
        ctx.fillText('NO INPUT', cx, cy)
        ctx.restore()
      }

      // ── Overlay layer compositor ──────────────────────────────────────
      // Renders texture → character → logo → overlay in z-order above the
      // primary media / timeline output.  Each layer draws ALL deck items
      // whose mediaRole maps to that layer.  Timeline clips are NOT rendered
      // here — they are handled by the primary media path above.
      {
        const layerCfgs  = layerConfigsRef.current
        const deckItems  = mediaItemsRef.current
        const pool       = mediaPoolRef.current

        for (const layerId of VZ_LAYER_RENDER_ORDER) {
          const cfg = layerCfgs.find(c => c.id === layerId)
          if (!cfg || !cfg.enabled) continue

          const roles      = LAYER_TO_ROLES[layerId]
          const layerItems = deckItems.filter(m => roles.includes(m.mediaRole as MediaRole))
          if (!layerItems.length) continue

          for (const item of layerItems) {
            // Lazy-load element into shared pool
            if (!pool.has(item.id)) {
              if (item.type === 'image') {
                const img = new Image()
                img.src = item.url
                pool.set(item.id, img)
              } else {
                const vid = document.createElement('video')
                vid.src = item.url
                vid.muted = true
                vid.playsInline = true
                vid.loop = true
                if (isPlayingRef.current) vid.play().catch(() => {})
                pool.set(item.id, vid)
              }
            }

            const el = pool.get(item.id)
            if (!el) continue

            // Keep layer videos synced with global play state
            if (el instanceof HTMLVideoElement) {
              if (isPlayingRef.current && el.paused)  el.play().catch(() => {})
              if (!isPlayingRef.current && !el.paused) el.pause()
            }

            const layerScale = shouldApplyScalePulse(item.mediaRole as MediaRole)
              ? bassReact * punchScale * eff.logoScale
              : 1
            const rect = computeDrawRect(W, H, el, cfg.fit, layerScale, item.mediaRole as MediaRole)

            ctx.save()
            ctx.globalAlpha = cfg.opacity
            if (cfg.blendMode !== 'source-over') ctx.globalCompositeOperation = cfg.blendMode
            if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360}deg)`
            ctx.drawImage(el, rect.ox, rect.oy, rect.sw, rect.sh)
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = 1
            ctx.restore()
          }
        }
      }

      // ── New canvas effects (post main draw) ────────────────────────

      if (fxSet.has('Spectrum Bars') && mEff.spectrumBars > 0 && an && buf) {
        drawSpectrumBars(ctx, W, H, dpr, buf, mEff.spectrumBars, bass, mEff.masterIntensity)
      }

      if (fxSet.has('Circular Spectrum') && mEff.circularSpectrum > 0 && an && buf) {
        drawCircularSpectrum(ctx, W, H, dpr, buf, mEff.circularSpectrum, bass)
      }

      if (fxSet.has('Oscilloscope') && mEff.oscilloscope > 0) {
        const tBuf = timeBufRef.current
        if (an && tBuf) an.getByteTimeDomainData(tBuf)
        drawOscilloscope(ctx, W, H, dpr, timeBufRef.current, mEff.oscilloscope, rawBands.volume, rawBands.mid, high, t)
      }

      if (fxSet.has('Beat Ring') && mEff.beatRing > 0) {
        updateAndDrawBeatRings(ctx, W, H, dpr, beatRingsRef.current, mEff.beatRing, bass, beatHit)
      }

      if (fxSet.has('Particle Burst') && mEff.particleBurst > 0) {
        updateAndDrawParticles(ctx, W, H, dpr, particlesRef.current, mEff.particleBurst, bass, beatHit)
      }

      if (fxSet.has('Kaleidoscope') && mEff.kaleidoscope > 0) {
        drawKaleidoscope(ctx, W, H, mEff.kaleidoscope)
      }

      if (fxSet.has('Mirror Split') && mEff.mirrorSplit > 0) {
        drawMirrorSplit(ctx, W, H, mEff.mirrorSplit)
      }

      if (fxSet.has('Radial Blur') && mEff.radialBlur > 0) {
        drawRadialBlur(ctx, W, H, mEff.radialBlur, bass)
      }

      if (fxSet.has('Edge Glow') && mEff.edgeGlow > 0) {
        drawEdgeGlow(ctx, W, H, mEff.edgeGlow, rawBands.volume, high)
      }

      if (fxSet.has('Color Cycle') && mEff.colorCycle > 0) {
        drawColorCycle(ctx, W, H, colorCycleHueRef, mEff.colorCycle, rawBands.mid, rawBands.volume)
      }

      // Restore camera shake transform — HUD and scanlines stay in fixed screen space
      if (shakeApplied) ctx.restore()

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
          ctx.fillStyle = `rgba(74,199,219,${Math.random()})`
          ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
        }
        ctx.globalAlpha = 1
        ctx.restore()
      }

      // ── Strobe — highs modulate sensitivity via activeStrobe ──────
      // Beat sync: fire on boundary; free: trigger on bass transient.
      const strobeOnBeat = synced && activeStrobe > 0 && beatPhase < 0.05
      const strobeOnBass = !synced && activeStrobe > 0 &&
        bass > 0.62 && bass > prevBassRef.current + 0.06
      if (strobeOnBeat || strobeOnBass) {
        const strobeAlpha = strobeOnBeat
          ? activeStrobe * (1 - beatPhase / 0.05) * 0.9
          : activeStrobe * bass * 0.85
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
        ring.addColorStop(0, 'rgba(74,199,219,0)')
        ring.addColorStop(1, `rgba(74,199,219,${0.38 * decay})`)
        ctx.fillStyle = ring
        ctx.fillRect(0, 0, W, H)
      }

      // ── Edge flicker — highs create a vignette shimmer ────────────
      if (edgeFlicker > 0.15 && mEff.masterIntensity > 0.3) {
        const flickerAlpha = (edgeFlicker - 0.15) * mEff.masterIntensity * 0.45
        const grad = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.min(W, H) * 0.55)
        grad.addColorStop(0, 'rgba(74,199,219,0)')
        grad.addColorStop(1, `rgba(74,199,219,${flickerAlpha})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      // ── VHS Static ────────────────────────────────────────────────
      if (fxSet.has('VHS Static') && mEff.vhsStatic > 0) {
        drawVhsStatic(ctx, W, H, mEff.vhsStatic, t)
      }

      // ── Datamosh Smear: save this frame for next frame's ghost ────
      if (fxSet.has('Datamosh Smear') && mEff.datamoshSmear > 0) {
        if (!offscreenRef.current || offscreenRef.current.width !== W || offscreenRef.current.height !== H) {
          offscreenRef.current = document.createElement('canvas')
          offscreenRef.current.width  = W
          offscreenRef.current.height = H
        }
        offscreenRef.current.getContext('2d')?.drawImage(canvas, 0, 0)
      }

      prevBassRef.current = bass * 0.82

      // ── HUD corners ────────────────────────────────────────────────
      const cSize  = 14 * dpr
      const margin = 10 * dpr
      ctx.strokeStyle = 'rgba(74,199,219,0.28)'
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
        const barColors = ['#4ac7db','#61d6aa','#b84fc9','#d8b95a']
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
  // The RAF loop is started once on mount. All props are accessed through refs
  // (effectsRef, isPlayingRef, etc.) so the loop never needs to restart.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      ctx.strokeStyle = 'rgba(74,199,219,0.65)'
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(74,199,219,0.15)')
      grad.addColorStop(1, 'rgba(74,199,219,0)')
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
function VyzualzHeader({ analyser, bassLive, onSaveSession }: { analyser: AnalyserNode | null; bassLive: number; onSaveSession: () => void }) {
  const engine = useSharedAudio()
  const barRefs  = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 5 }, () => null))
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const freqBufRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef      = useRef<number>(0)
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [lyricManagerOpen, setLyricManagerOpen] = useState(false)

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

  const BAND_COLORS = ['#4ac7db', '#61d6aa', '#b84fc9', '#d8b95a', '#4ac7db']
  const BAND_LABELS = ['Bass', 'LMid', 'Mid', 'High', 'Vol']

  return (
    <>
    <div className="vz-header">
      <div className="vz-header-title-group">
        <div className="vz-header-title">VYZUALZ</div>
        <div className="vz-header-sub">Visual Audio Synthesizer</div>
      </div>

      <div className="vz-header-sep" />

      <button className="vz-session-save-btn" onClick={onSaveSession} title="Save current state as a session">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
          <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
        </svg>
        Save Session
      </button>

      <button
        className="vz-session-save-btn"
        onClick={() => setLyricManagerOpen(true)}
        title="Open Lyric Manager"
      >
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
          <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm-1 14H9V7h2v10zm4 0h-2V7h2v10z"/>
        </svg>
        Lyric Manager
      </button>

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
      <button
        className="vsm-settings-btn"
        title="Settings"
        onClick={() => setSettingsOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>
      <button className="az-overflow-btn">···</button>
    </div>
    {settingsOpen     && <SettingsModal      onClose={() => setSettingsOpen(false)} />}
    {lyricManagerOpen && <LyricManagerModal onClose={() => setLyricManagerOpen(false)} />}
  </>
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

const ROLE_BADGE: Record<string, string> = {
  background_image: 'BG', background_video: 'BGV', logo: 'LOGO',
  transparent_element: 'ALPHA', overlay: 'OVR', character_art: 'CHR',
  texture: 'TEX', loop: 'LOOP', transition: 'TRNS', reference: 'REF',
}

type DeckFilter = 'all' | 'images' | 'videos' | 'favorites' | 'backgrounds' | 'logos' | 'transparent' | 'overlays'

const DECK_FILTERS: { key: DeckFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'images',      label: 'Images'      },
  { key: 'videos',      label: 'Videos'      },
  { key: 'favorites',   label: 'Favorites'   },
  { key: 'backgrounds', label: 'Backgrounds' },
  { key: 'logos',       label: 'Logos'       },
  { key: 'transparent', label: 'Transparent' },
  { key: 'overlays',    label: 'Overlays'    },
]

function matchesDeckFilter(m: UploadedMedia, f: DeckFilter): boolean {
  switch (f) {
    case 'images':      return m.type === 'image'
    case 'videos':      return m.type === 'video'
    case 'favorites':   return m.favorite
    case 'backgrounds': return m.mediaRole === 'background_image' || m.mediaRole === 'background_video'
    case 'logos':       return m.mediaRole === 'logo'
    case 'transparent': return m.mediaRole === 'transparent_element'
    case 'overlays':    return m.mediaRole === 'overlay'
    default:            return true
  }
}

function MediaDeckPanel({ activeMediaId, onSelect }: {
  activeMediaId: string | null; onSelect: (id: string) => void
}) {
  const {
    items, addFiles, removeItem, toggleFavorite,
    loadFromSupabase, loading,
    importModalOpen, openImportMediaModal, closeImportMediaModal,
  } = useMediaStore()
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('all')
  const [dragOver, setDragOver] = useState(false)

  // Stable ref so the mount effect doesn't need loadFromSupabase in its dep array.
  const loadFromSupabaseRef = useRef(loadFromSupabase)
  useEffect(() => { loadFromSupabaseRef.current = loadFromSupabase }, [loadFromSupabase])

  // Load persisted media from Supabase exactly once on mount.
  useEffect(() => { loadFromSupabaseRef.current() }, [])

  const filtered = useMemo(
    () => items.filter(m => matchesDeckFilter(m, deckFilter)),
    [items, deckFilter]
  )

  // Quick drag-drop onto the panel still works without opening the modal
  const handleQuickDrop = (files: File[]) => {
    const media = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/') ||
      /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv)$/i.test(f.name)
    )
    if (media.length) addFiles(media)
  }

  return (
    <>
    {importModalOpen && <MediaUploadModal onClose={closeImportMediaModal} />}
    <div
      className="vz-panel"
      style={{ flex: 1, minHeight: 0 }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleQuickDrop(Array.from(e.dataTransfer.files)) }}
    >
      <div className="vz-panel-header">
        <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Media Deck</span>
        <button className="vz-import-btn" onClick={openImportMediaModal}>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Import
        </button>
      </div>

      <div className="vz-filter-tabs">
        {DECK_FILTERS.map(({ key, label }) => (
          <button key={key}
            className={`vz-filter-tab ${deckFilter === key ? 'vz-filter-tab--active' : ''}`}
            onClick={() => setDeckFilter(key)}
          >{label}</button>
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
          <div
            className="ref-empty-slot"
            style={{ cursor: 'pointer', margin: 12, height: 120, display: 'flex' }}
            onClick={openImportMediaModal}
          >
            <div className="ref-empty-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </div>
            <div className="ref-empty-title">Import Media</div>
            <div className="ref-empty-sub" style={{ fontSize: 9 }}>{dragOver ? 'Drop here!' : 'Images & Video'}</div>
          </div>
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
                    <span className="vz-media-type-badge" style={{ background: 'rgba(74,199,219,0.25)', color: '#4ac7db' }}>↑ SYNC</span>
                  ) : m.uploadError ? (
                    <span className="vz-media-type-badge" style={{ background: 'rgba(248,113,113,0.22)', color: '#f87171' }} title={m.uploadError}>⚠ LOCAL</span>
                  ) : ROLE_BADGE[m.mediaRole] ? (
                    <span className="vz-media-type-badge" style={{ background: 'rgba(10,20,32,0.75)' }}>{ROLE_BADGE[m.mediaRole]}</span>
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
                  <div className="vz-media-name">{m.title ?? m.name}</div>
                  <div className="vz-media-meta">{m.meta}</div>
                  {m.tags.length > 0 && (
                    <div className="vz-media-tags">
                      {m.tags.slice(0, 3).map(t => (
                        <span key={t} className="vz-media-tag">{t}</span>
                      ))}
                      {m.tags.length > 3 && <span className="vz-media-tag vz-media-tag--more">+{m.tags.length - 3}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// ── LiveVisualPreview ─────────────────────────────────────────────────
function LiveVisualPreview({
  analyser, activeMedia, effects, enabledFx,
  isPlaying, onPlay, onPause, onPrev, onNext, onFullscreen,
  bpm, onBpmChange, bpmSync, onToggleBpmSync, onTap,
  quality, onQualityChange,
  canvasWrapRef, audioTime, modulationRoutes,
  timelineEnabled, onToggleTimeline, timelineClips, timelineLoop, mediaItems,
  layerConfigs,
}: {
  analyser: AnalyserNode | null
  activeMedia: UploadedMedia | null
  effects: VzEffects
  enabledFx: Set<string>
  isPlaying: boolean; onPlay: () => void; onPause: () => void
  onPrev: () => void; onNext: () => void; onFullscreen: () => void
  bpm: number; onBpmChange: (v: number) => void
  bpmSync: boolean; onToggleBpmSync: () => void; onTap: () => void
  quality: Quality; onQualityChange: (q: Quality) => void
  canvasWrapRef: React.RefObject<HTMLDivElement>
  audioTime: number
  modulationRoutes: ModulationRoute[]
  timelineEnabled: boolean; onToggleTimeline: () => void
  timelineClips: VzTimelineClip[]; timelineLoop: boolean
  mediaItems: UploadedMedia[]
  layerConfigs: VzLayerConfig[]
}) {
  const [liveFps, setLiveFps] = useState(0)

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
          timelineEnabled={timelineEnabled}
          timelineClips={timelineClips}
          timelineLoop={timelineLoop}
          mediaItems={mediaItems}
          layerConfigs={layerConfigs}
          onFpsUpdate={setLiveFps}
        />
        <div className="vz-preview-pills">
          <span className="vz-preview-pill">{quality}</span>
          <span className="vz-preview-pill">{liveFps > 0 ? `${liveFps} FPS` : '-- FPS'}</span>
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

        <button className="vz-preview-trans-btn" title="Fullscreen Output" onClick={onFullscreen}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        </button>

        <div className="az-spacer" />

        <div className="vz-timeline-group">
          <button
            className={`vz-timeline-pill ${timelineEnabled ? 'vz-timeline-pill--on' : ''}`}
            onClick={onToggleTimeline}
            title={timelineEnabled ? 'Timeline mode ON — click to disable' : 'Timeline mode OFF — click to enable'}
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">
              <path d="M3 5h18v2H3V5zm0 4h12v2H3V9zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/>
            </svg>
            <span className="vz-timeline-pill-label">Timeline</span>
            <span className={`vz-timeline-pill-dot${timelineEnabled ? ' vz-timeline-pill-dot--on' : ''}`} />
          </button>
        </div>

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
const AZ_BAND_COLORS  = ['#4ac7db', '#61d6aa', '#b84fc9', '#d8b95a', '#4ac7db', '#80dfc0']
const AZ_BAND_LABELS  = ['Bass', 'Low Mids', 'Mids', 'High Mids', 'Highs', 'Vocal']
const AZ_BANDS_HZ: [number, number][] = [
  [20, 250], [250, 800], [800, 2500], [2500, 5000], [5000, 16000], [300, 3000],
]

function AudioAnalyzerPanel({ analyser }: { analyser: AnalyserNode | null }) {
  const barRefs = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 6 }, () => null))
  const valRefs = useRef<Array<HTMLSpanElement | null>>(Array.from({ length: 6 }, () => null))
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
      let bands = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05]

      if (an && buf) {
        an.getByteFrequencyData(buf)
        const sr = an.context.sampleRate
        bands = AZ_BANDS_HZ.map(([lo, hi]) => getBandAvg(buf, sr, lo, hi))
        bands[5] = Math.min(1, (bands[1] + bands[2] + bands[3]) / 2.5)
      }

      barRefs.current.forEach((el, i) => {
        if (el) { el.style.height = `${Math.max(2, bands[i] * 100)}%`; el.style.background = AZ_BAND_COLORS[i] }
      })
      valRefs.current.forEach((el, i) => {
        if (el) el.textContent = bands[i].toFixed(2)
      })
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="vz-analyzer-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <ChartHistogramIcon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Audio Analyzer</span>
      </div>
      <div className="vz-analyzer-body">
        <div className="vz-band-bars">
          {AZ_BAND_LABELS.map((label, i) => (
            <div key={label} className="vz-band-col">
              <span
                ref={el => { valRefs.current[i] = el }}
                className="vz-band-bar-val"
                style={{ color: AZ_BAND_COLORS[i] }}
              >0.05</span>
              <div className="vz-band-bar-track">
                <div
                  ref={el => { barRefs.current[i] = el }}
                  className="vz-band-bar-fill"
                  style={{ height: '5%', background: AZ_BAND_COLORS[i] }}
                />
              </div>
              <span className="vz-band-bar-label">{label}</span>
            </div>
          ))}
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
        <Route01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
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
function EffectControlsPanel({ effects, enabledFx, onChange, onReset }: {
  effects: VzEffects
  enabledFx: Set<string>
  onChange: (key: keyof VzEffects, v: number) => void
  onReset: () => void
}) {
  const sliders: { key: keyof VzEffects; label: string; min?: number; max?: number; color?: boolean }[] = [
    { key: 'masterIntensity',  label: 'Master Intensity' },
    { key: 'bassReactivity',   label: 'Bass Reactivity' },
    { key: 'glitchAmount',     label: 'Glitch Amount' },
    { key: 'rgbSplit',         label: 'RGB Split' },
    { key: 'tunnelSpeed',      label: 'Tunnel Speed' },
    { key: 'displacement',     label: 'Displacement' },
    { key: 'bloom',            label: 'Bloom' },
    { key: 'strobe',           label: 'Strobe' },
    { key: 'feedbackTrails',   label: 'Feedback Trails' },
    { key: 'logoScale',        label: 'Logo Scale',       min: 0, max: 2 },
    { key: 'colorShift',       label: 'Color Shift',      color: true },
    { key: 'spectrumBars',     label: 'Spectrum Bars' },
    { key: 'circularSpectrum', label: 'Circular Spectrum' },
    { key: 'oscilloscope',     label: 'Oscilloscope' },
    { key: 'beatRing',         label: 'Beat Ring' },
    { key: 'particleBurst',    label: 'Particle Burst' },
    { key: 'reactiveGrid',     label: 'Reactive Grid' },
    { key: 'cameraShake',      label: 'Camera Shake' },
    { key: 'kaleidoscope',     label: 'Kaleidoscope' },
    { key: 'mirrorSplit',      label: 'Mirror Split' },
    { key: 'radialBlur',       label: 'Radial Blur' },
    { key: 'vhsStatic',        label: 'VHS Static' },
    { key: 'datamoshSmear',    label: 'Datamosh Smear' },
    { key: 'edgeGlow',         label: 'Edge Glow' },
    { key: 'colorCycle',       label: 'Color Cycle' },
  ]
  return (
    <div className="vz-effects-panel">
      <div className="vz-panel-header">
        <MagicWand01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Effect Controls</span>
        <button className="vz-reset-btn" onClick={onReset}>Reset</button>
      </div>
      <div className="vz-effects-scroll">
        {sliders.map(s => {
          const chainItem = EFFECT_CONTROL_CHAIN_MAP[s.key]
          const chainEnabled = chainItem === undefined ? undefined : enabledFx.has(chainItem)
          return (
            <VzSlider key={s.key} label={s.label} value={effects[s.key]}
              min={s.min} max={s.max} colorTrack={s.color}
              chainEnabled={chainEnabled}
              onChange={v => onChange(s.key, v)}
            />
          )
        })}
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
        <Flowchart01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
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
        <Tv01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
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
// ── SavePresetDialog ──────────────────────────────────────────────────
// Inline form that replaces the "New" button while active.
// Lets the user choose a name and which scene data to include in the preset.
const SCOPE_FIELDS: { key: keyof PresetScope, label: string, group: 'look' | 'scene' }[] = [
  { key: 'effects',     label: 'Effects',      group: 'look' },
  { key: 'enabledFx',   label: 'FX Chain',     group: 'look' },
  { key: 'modulation',  label: 'Modulation',   group: 'look' },
  { key: 'activeMedia', label: 'Active Media', group: 'scene' },
  { key: 'mediaOrder',  label: 'Media Order',  group: 'scene' },
  { key: 'audioSource', label: 'Audio Source', group: 'scene' },
  { key: 'bpm',         label: 'BPM',          group: 'scene' },
  { key: 'bpmSync',     label: 'BPM Sync',     group: 'scene' },
  { key: 'quality',     label: 'Quality',      group: 'scene' },
]

function SavePresetDialog({ onSave, onCancel }: {
  onSave: (name: string, scope: PresetScope) => void
  onCancel: () => void
}) {
  const [name, setName]   = useState('')
  const [scope, setScope] = useState<PresetScope>(LOOK_SCOPE)

  const toggleField = (key: keyof PresetScope) =>
    setScope(s => ({ ...s, [key]: !s[key] }))

  const applyQuickScope = (s: PresetScope) => setScope(s)

  const hasScene = SCOPE_FIELDS.some(f => f.group === 'scene' && scope[f.key])

  return (
    <div className="vz-preset-dialog">
      <input
        className="vz-preset-dialog-name"
        placeholder="Preset name…"
        value={name}
        autoFocus
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim(), scope)
          if (e.key === 'Escape') onCancel()
        }}
      />

      <div className="vz-preset-dialog-quick">
        <button
          className={`vz-preset-scope-btn${!hasScene ? ' vz-preset-scope-btn--active' : ''}`}
          onClick={() => applyQuickScope(LOOK_SCOPE)}
        >Look</button>
        <button
          className={`vz-preset-scope-btn${hasScene ? ' vz-preset-scope-btn--active' : ''}`}
          onClick={() => applyQuickScope(SCENE_SCOPE)}
        >Scene</button>
      </div>

      <div className="vz-preset-dialog-scope">
        <span className="vz-preset-scope-group-label">Visual</span>
        {SCOPE_FIELDS.filter(f => f.group === 'look').map(f => (
          <label key={f.key} className="vz-preset-scope-row">
            <input type="checkbox" checked={!!scope[f.key]} onChange={() => toggleField(f.key)} />
            {f.label}
          </label>
        ))}
        <span className="vz-preset-scope-group-label" style={{ marginTop: 6 }}>Scene</span>
        {SCOPE_FIELDS.filter(f => f.group === 'scene').map(f => (
          <label key={f.key} className="vz-preset-scope-row">
            <input type="checkbox" checked={!!scope[f.key]} onChange={() => toggleField(f.key)} />
            {f.label}
          </label>
        ))}
      </div>

      <div className="vz-preset-dialog-actions">
        <button className="vz-preset-dialog-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="vz-preset-dialog-save"
          disabled={!name.trim()}
          onClick={() => name.trim() && onSave(name.trim(), scope)}
        >Save</button>
      </div>
    </div>
  )
}

// Returns true when a preset contains any scene-level data beyond visual look
function presetHasScene(p: VzPreset): boolean {
  const s = p.scope
  if (!s) return false
  return !!(s.activeMedia || s.mediaOrder || s.audioSource || s.bpm || s.bpmSync || s.quality || s.modulation)
}

// ── PresetStrip ───────────────────────────────────────────────────────
function PresetStrip({ activePresetId, presets, onSelect, onSave, onDelete }: {
  activePresetId: string
  presets: VzPreset[]
  onSelect: (id: string) => void
  onSave: (name: string, scope: PresetScope) => void
  onDelete: (id: string) => void
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch]         = useState('')
  const [category, setCategory]     = useState('all')

  const filtered = useMemo(() => {
    let out = presets
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(p => p.name.toLowerCase().includes(q))
    }
    if (category === 'default') out = out.filter(p =>  p.isDefault)
    if (category === 'custom')  out = out.filter(p => !p.isDefault)
    if (category === 'scene')   out = out.filter(p =>  presetHasScene(p))
    return out
  }, [presets, search, category])

  return (
    <div className="vz-presets-section">
      <div className="vz-presets-header">
        <span className="vz-presets-label">Presets</span>
        <div className="vz-presets-search-wrap">
          <svg className="vz-presets-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
          </svg>
          <input
            className="vz-presets-search"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="az-select vz-presets-cat-select"
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          <option value="default">Default</option>
          <option value="custom">Custom</option>
          <option value="scene">Scene</option>
        </select>
        {!dialogOpen && (
          <button className="vz-new-preset-btn" onClick={() => setDialogOpen(true)}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            New
          </button>
        )}
      </div>

      {dialogOpen && (
        <SavePresetDialog
          onSave={(name, scope) => { onSave(name, scope); setDialogOpen(false) }}
          onCancel={() => setDialogOpen(false)}
        />
      )}

      <div className="vz-preset-cards">
        {filtered.map(p => (
          <div
            key={p.id}
            className={`vz-preset-card ${activePresetId === p.id ? 'vz-preset-card--active' : ''}`}
            style={{ background: p.gradient ?? p.color }}
            onClick={() => onSelect(p.id)}
            title={p.name + (presetHasScene(p) ? ' · Scene preset' : '')}
          >
            <div className="vz-preset-card-header">
              {presetHasScene(p) && (
                <span className="vz-preset-scene-badge" title="Scene preset">◈</span>
              )}
              {!p.isDefault && (
                <button
                  className="vz-preset-del-btn"
                  onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                  title="Delete"
                >✕</button>
              )}
            </div>
            <div className="vz-preset-card-body">
              <span className="vz-preset-name">{p.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VzLayersPanel ─────────────────────────────────────────────────────
function VzLayersPanel() {
  const { layerConfigs, setLayerConfig, resetLayerConfigs } = useVisualStore()
  const { items } = useMediaStore()

  const countByLayer = useMemo<Record<VzLayerConfigId, number>>(() => {
    const counts: Record<VzLayerConfigId, number> = {
      texture: 0, character: 0, logo: 0, overlay: 0,
    }
    for (const item of items) {
      const layerId = ROLE_TO_LAYER[item.mediaRole as MediaRole]
      if (layerId) counts[layerId]++
    }
    return counts
  }, [items])

  return (
    <div className="vz-layers-panel vz-panel">
      <div className="vz-panel-header">
        <Layers01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Layers</span>
        <button className="vz-layers-reset-btn" onClick={resetLayerConfigs} title="Reset to defaults">↺</button>
      </div>
      <div className="vz-layers-list">
        {VZ_LAYER_RENDER_ORDER.map(layerId => {
          const cfg   = layerConfigs.find(c => c.id === layerId) ?? DEFAULT_LAYER_CONFIGS.find(c => c.id === layerId)!
          const count = countByLayer[layerId]
          return (
            <div
              key={layerId}
              className={`vz-layer-row${cfg.enabled ? '' : ' vz-layer-row--off'}`}
            >
              <button
                className={`vz-layer-eye${cfg.enabled ? ' vz-layer-eye--on' : ''}`}
                onClick={() => setLayerConfig(layerId, { enabled: !cfg.enabled })}
                title={cfg.enabled ? 'Hide layer' : 'Show layer'}
              >
                {cfg.enabled ? '◉' : '○'}
              </button>
              <span className="vz-layer-name">
                {LAYER_LABELS[layerId]}
                {count > 0 && <span className="vz-layer-count">{count}</span>}
              </span>
              <input
                type="range"
                className="vz-layer-opacity-slider"
                min={0} max={1} step={0.05}
                value={cfg.opacity}
                disabled={!cfg.enabled}
                title={`Opacity: ${Math.round(cfg.opacity * 100)}%`}
                onChange={e => setLayerConfig(layerId, { opacity: parseFloat(e.target.value) })}
              />
              <select
                className="az-select vz-layer-blend-select"
                value={cfg.blendMode}
                disabled={!cfg.enabled}
                title="Blend mode"
                onChange={e => setLayerConfig(layerId, { blendMode: e.target.value as GlobalCompositeOperation })}
              >
                {LAYER_BLEND_MODES.map(bm => (
                  <option key={bm} value={bm}>{bm}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SystemSettingsPanel ───────────────────────────────────────────────
function SystemSettingsPanel() {
  const {
    quality, setQuality, bpmSync, toggleBpmSync, bpm,
    resetEffects, resetModulationRoutes,
  } = useVisualStore()
  const { storageAvailable, authRequired } = useMediaStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      <div>
        <div className="az-popover-section-title">BPM Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`vz-settings-seg-btn${bpmSync ? ' vz-settings-seg-btn--active' : ''}`}
            onClick={toggleBpmSync}
            style={{ minWidth: 54 }}
          >{bpmSync ? 'ON' : 'OFF'}</button>
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.45)', fontFamily: 'var(--az-font-data)' }}>
            {bpmSync ? `Locked to ${bpm} BPM` : 'Free-running beat phase'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Media Sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: storageAvailable && !authRequired ? '#61d6aa' : 'rgba(245,248,250,0.2)',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: 'rgba(245,248,250,0.55)', fontFamily: 'var(--az-font-data)' }}>
            {!storageAvailable ? 'Local only — Supabase not configured'
              : authRequired   ? 'Signed out — media stored locally'
              :                  'Cloud sync enabled'}
          </span>
        </div>
      </div>

      <div>
        <div className="az-popover-section-title">Reset</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="vz-settings-reset-btn"
            onClick={resetEffects}
            title="Set all effect sliders back to defaults"
          >Reset Effects</button>
          <button
            className="vz-settings-reset-btn"
            onClick={resetModulationRoutes}
            title="Restore default audio modulation routing"
          >Reset Modulation</button>
        </div>
      </div>
    </div>
  )
}

// ── SettingsModal ─────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'account' | 'shortcuts' | 'system'>('account')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="vsm-backdrop" onMouseDown={onClose}>
      <div className="vsm-modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <div className="vsm-header">
          <div className="vsm-title">SETTINGS</div>
          <button className="vsm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="vsm-body">
          <nav className="vsm-nav">
            <div
              className={`vsm-nav-item${tab === 'account' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('account')}
            >Account</div>
            <div
              className={`vsm-nav-item${tab === 'shortcuts' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('shortcuts')}
            >Shortcuts</div>
            <div
              className={`vsm-nav-item${tab === 'system' ? ' vsm-nav-item--active' : ''}`}
              onClick={() => setTab('system')}
            >System Settings</div>
          </nav>
          <div className="vsm-content">
            {tab === 'account' && (
              <p className="vsm-account-placeholder">Account settings coming soon.</p>
            )}
            {tab === 'shortcuts' && <ShortcutPanel />}
            {tab === 'system' && <SystemSettingsPanel />}
          </div>
        </div>
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
    presets, activePresetId, bpm, setBpm, bpmSync, toggleBpmSync, setPlaying,
  } = useVisualStore()
  const preset = presets.find(p => p.id === activePresetId) ?? presets[0] ?? DEFAULT_PRESETS[0]
  const engine = useSharedAudio()
  const fileInputId = useId()

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
      if (engine.tracks.length > 0) engine.replaceTracks(audio)
      else engine.addTracks(audio)
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
          onClick={() => {
            if (engine.isPlaying) {
              engine.pause()
              setPlaying(false)
            } else {
              engine.play()
              setPlaying(true)
            }
          }}
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

      <div className="az-dock-right">
        <select className="az-dock-source-select">
          <option>Main Out</option>
        </select>
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
    timelineEnabled, timelineClips, timelineLoop, setTimelineEnabled,
    layerConfigs,
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

  // One-way sync: if the audio engine stops on its own (e.g. last track ends),
  // bring visualStore.isPlaying down so the canvas drops to idle.
  useEffect(() => {
    if (!engine.isPlaying && isPlaying) setPlaying(false)
  }, [engine.isPlaying, isPlaying, setPlaying])

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

  const handleTogglePlayback = useCallback(() => {
    if (engine.isPlaying) {
      engine.pause()
      setPlaying(false)
    } else {
      if (!engine.tracks.length) {
        console.warn('[VYZUALZ] No audio track loaded — playback skipped')
        return
      }
      engine.play()
      setPlaying(true)
    }
  }, [engine, setPlaying])

  // Stable ref so the mount effect doesn't need syncSessionsFromCloud in its dep array.
  const syncSessionsRef = useRef(syncSessionsFromCloud)
  useEffect(() => { syncSessionsRef.current = syncSessionsFromCloud }, [syncSessionsFromCloud])

  // Sync cloud sessions exactly once on mount.
  useEffect(() => { syncSessionsRef.current() }, [])

  const handleSavePreset = useCallback((name: string, scope: PresetScope) => {
    savePreset(name, {
      scope,
      mediaOrder: scope.mediaOrder ? items.map(i => i.id) : undefined,
      audioSource: scope.audioSource ? (engine.source as VzSession['audioSource']) : undefined,
    })
  }, [savePreset, items, engine.source])

  const handleSelectPreset = useCallback((id: string) => {
    const scene = selectPreset(id)
    if (!scene) return
    if (scene.audioSource && engine.source !== scene.audioSource) {
      engine.setSource(scene.audioSource)
    }
    if (scene.mediaOrder?.length) {
      reorderItems(scene.mediaOrder)
    }
  }, [selectPreset, engine, reorderItems])

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
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) return
      if (e.key === 'f' || e.key === 'F') handleFullscreen()
      if (e.key === ' ') { e.preventDefault(); handleTogglePlayback() }
      if (e.key >= '1' && e.key <= '5') {
        const preset = presets[parseInt(e.key) - 1]
        if (preset) handleSelectPreset(preset.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presets, handleSelectPreset, handleFullscreen, handleTogglePlayback])

  return (
    <div className="az-root">
      <div className="az-shell">
        <AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} />

        <div className="vz-main">
          <VyzualzHeader analyser={analyser} bassLive={bassLive} onSaveSession={handleSaveSession} />

          <div className="vz-content">
            {/* Left column — full height, same as vz-right */}
            <div className="vz-left">
              <VyzualzErrorBoundary section="MediaDeck">
                <MediaDeckPanel activeMediaId={activeMediaId} onSelect={setActiveMedia} />
              </VyzualzErrorBoundary>
              <VyzualzErrorBoundary section="Layers">
                <VzLayersPanel />
              </VyzualzErrorBoundary>
            </div>

            {/* Center column — canvas above, bottom bar only spans this column */}
            <div className="vz-center-col">
              <div className="vz-center">
                <VyzualzErrorBoundary section="Canvas">
                  <LiveVisualPreview
                    analyser={analyser}
                    activeMedia={activeMedia}
                    effects={effects}
                    enabledFx={enabledFxSet}
                    isPlaying={isPlaying}
                    onPlay={handleTogglePlayback}
                    onPause={handleTogglePlayback}
                    onPrev={handlePrevMedia}
                    onNext={handleNextMedia}
                    onFullscreen={handleFullscreen}
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
                    timelineEnabled={timelineEnabled}
                    onToggleTimeline={() => setTimelineEnabled(!timelineEnabled)}
                    timelineClips={timelineClips}
                    timelineLoop={timelineLoop}
                    mediaItems={items}
                    layerConfigs={layerConfigs}
                  />
                </VyzualzErrorBoundary>
                {timelineEnabled && (
                  <VyzualzErrorBoundary section="Timeline">
                    <TimelinePanel />
                  </VyzualzErrorBoundary>
                )}
              </div>

              <div className="vz-bottom">
                <PresetStrip
                  activePresetId={activePresetId}
                  presets={presets}
                  onSelect={handleSelectPreset}
                  onSave={handleSavePreset}
                  onDelete={deletePreset}
                />
                <AudioAnalyzerPanel analyser={analyser} />
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
              </div>
            </div>

            {/* Right column — full height */}
            <div className="vz-right">
              <EffectChainPanel enabled={enabledFxSet} onToggle={toggleFx} />
              <EffectControlsPanel
                effects={effects}
                enabledFx={enabledFxSet}
                onChange={setEffect}
                onReset={resetEffects}
              />
              <ModulationPanel
                routes={modulationRoutes}
                onToggle={toggleModulationRoute}
                onSetAmount={setModulationRouteAmount}
              />
            </div>
          </div>
        </div>
      </div>

      <VyzualzDock />
    </div>
  )
}

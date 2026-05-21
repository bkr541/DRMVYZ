import { useRef, useEffect } from 'react'
import { useVisualStore } from '../../../stores/visualStore'
import type { VzEffects, Quality } from '../../../stores/visualStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useLyricsStore } from '../../../stores/lyricsStore'
import type { LyricCue, LyricDocument, LyricStyle, LyricAnimation, LyricEasingName } from '../../../types/lyrics'
import { extractBandValues, applyModulatedEffects } from '../../../lib/audioModulation'
import type { ModulationRoute, AudioBandValues } from '../../../lib/audioModulation'
import {
  getActiveTimelineClip, getNextTimelineClip, getTransitionState,
  getClipSourceTime, shouldFreezeClipFrame,
} from '../../../lib/timeline'
import type { TwoClipRenderState } from '../../../lib/timeline'
import type { VzTimelineClip } from '../../../types/timeline'
import { renderTimelineTransition } from '../../../lib/transitionRenderer'
import type { MediaRole } from '../../../lib/mediaRoles'
import { VZ_LAYER_RENDER_ORDER } from '../../../types/vzLayers'
import type { VzLayerConfig, VzLayerItem } from '../../../types/vzLayers'
import type { PerformanceStats, WarningLevel } from '../../../types/performanceStats'
import type { VzEffectParams } from '../../../types/effectParams'
import {
  resolveGlitchParams, resolveTunnelParams,
  GLITCH_DEFAULTS, TUNNEL_DEFAULTS,
} from '../../../types/effectParams'
import {
  getCameraShakeOffset,
  drawDatamoshSmear,
} from '../visualEffects'
import { getEffectsForPhase } from '../effects/registry'
import type { VzFrameContext } from '../effects/types'

// ── Lyric rendering helpers ───────────────────────────────────────────────────

const LYRIC_DEF_STYLE: LyricStyle = {
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 46, fontWeight: 700,
  color: '#ffffff', opacity: 1,
  strokeColor: '', strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0.85)', shadowBlur: 14, shadowOffsetX: 0, shadowOffsetY: 2,
  x: 0.5, y: 0.82, align: 'center', baseline: 'middle',
  maxWidth: 0.88, letterSpacing: 0, lineHeight: 1.3,
  textTransform: 'none', blendMode: 'source-over',
}

const LYRIC_DEF_ANIM: LyricAnimation = {
  in: 'fade', out: 'fade', inMs: 280, outMs: 180,
  easing: 'easeOut', delayMs: 0, staggerMs: 0,
  direction: 'up', intensity: 1,
}

function lyricEase(name: LyricEasingName, t: number): number {
  switch (name) {
    case 'easeIn':          return t * t
    case 'easeOut':         return 1 - (1 - t) * (1 - t)
    case 'easeInOut':       return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
    case 'easeOutCubic':    return 1 - (1 - t) ** 3
    case 'easeInCubic':     return t ** 3
    case 'easeInOutCubic':  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    default:                return t
  }
}

function lyricTextTransform(text: string, tf: LyricStyle['textTransform']): string {
  switch (tf) {
    case 'uppercase':  return text.toUpperCase()
    case 'lowercase':  return text.toLowerCase()
    case 'capitalize': return text.replace(/\b\w/g, c => c.toUpperCase())
    default:           return text
  }
}

function wrapLyricText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawLyricCue(
  ctx: CanvasRenderingContext2D,
  cue: LyricCue,
  activeMs: number,
  doc: LyricDocument | null,
  W: number, H: number, dpr: number,
): void {
  const style: LyricStyle = { ...LYRIC_DEF_STYLE, ...(doc?.defaultStyle ?? {}), ...(cue.style ?? {}) }
  const anim: LyricAnimation = { ...LYRIC_DEF_ANIM, ...(doc?.defaultAnimation ?? {}), ...(cue.animation ?? {}) }

  const elapsed = activeMs - cue.startMs - anim.delayMs
  const inT  = Math.max(0, Math.min(1, elapsed / Math.max(1, anim.inMs)))
  const outT = Math.max(0, Math.min(1, (activeMs - (cue.endMs - anim.outMs)) / Math.max(1, anim.outMs)))

  const easedIn  = lyricEase(anim.easing, inT)
  const easedOut = lyricEase(anim.easing, outT)
  const visibility = Math.max(0, Math.min(1, easedIn * (1 - easedOut)))
  if (visibility <= 0) return

  let displayText = lyricTextTransform(cue.text, style.textTransform)
  if (anim.in === 'typewriter' && inT < 1) {
    displayText = displayText.slice(0, Math.max(1, Math.ceil(displayText.length * easedIn)))
  } else if (anim.out === 'typewriter' && outT > 0) {
    displayText = displayText.slice(0, Math.max(0, Math.ceil(displayText.length * (1 - easedOut))))
  }

  const fs     = style.fontSize * dpr
  const shift  = 28 * dpr * anim.intensity
  const maxW   = style.maxWidth > 0 ? style.maxWidth * W : W * 0.9
  const lineH  = fs * style.lineHeight

  let tx = 0, ty = 0, sc = 1, blurPx = 0

  const ip = 1 - easedIn
  switch (anim.in) {
    case 'fadeUp':   ty -= shift * ip; break
    case 'fadeDown': ty += shift * ip; break
    case 'scale':    sc *= 0.8 + 0.2 * easedIn; break
    case 'scalePop': sc *= 1 + 0.18 * (1 - easedIn) * Math.sin(easedIn * Math.PI); break
    case 'slide': {
      const d = anim.direction
      if (d === 'up')    ty -= shift * ip
      else if (d === 'down')  ty += shift * ip
      else if (d === 'left')  tx -= shift * ip
      else                    tx += shift * ip
      break
    }
    case 'blurIn':  blurPx = Math.max(blurPx, (1 - easedIn) * 12 * anim.intensity); break
    case 'glitch':
    case 'glitchOut': tx += (Math.random() - 0.5) * shift * 0.4 * ip; break
    default: break
  }

  const op = easedOut
  switch (anim.out) {
    case 'fadeUp':   ty -= shift * op; break
    case 'fadeDown': ty += shift * op; break
    case 'scale':    sc *= 1 - 0.2 * easedOut; break
    case 'slide': {
      const d = anim.direction
      if (d === 'up')    ty -= shift * op
      else if (d === 'down')  ty += shift * op
      else if (d === 'left')  tx -= shift * op
      else                    tx += shift * op
      break
    }
    case 'blurOut': blurPx = Math.max(blurPx, easedOut * 12 * anim.intensity); break
    case 'glitch':
    case 'glitchOut': tx += (Math.random() - 0.5) * shift * 0.4 * op; break
    default: break
  }

  ctx.save()
  ctx.globalAlpha = Math.max(0, visibility * style.opacity)
  ctx.globalCompositeOperation = style.blendMode
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`
  ctx.font = `${style.fontWeight} ${fs}px ${style.fontFamily}`
  ctx.textAlign = style.align
  ctx.textBaseline = style.baseline
  if (style.letterSpacing > 0) {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${style.letterSpacing * dpr}px`
  }
  if (style.shadowBlur > 0 || style.shadowOffsetX !== 0 || style.shadowOffsetY !== 0) {
    ctx.shadowColor   = style.shadowColor
    ctx.shadowBlur    = style.shadowBlur * dpr
    ctx.shadowOffsetX = style.shadowOffsetX * dpr
    ctx.shadowOffsetY = style.shadowOffsetY * dpr
  }

  ctx.translate(style.x * W + tx, style.y * H + ty)
  if (sc !== 1) ctx.scale(sc, sc)

  const lines = wrapLyricText(ctx, displayText, maxW)
  const totalH = lines.length * lineH
  const startY = -totalH / 2 + lineH / 2

  const drawLines = (stroke: boolean) => {
    if (stroke) { ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0 }
    lines.forEach((ln, i) => {
      if (stroke) ctx.strokeText(ln, 0, startY + i * lineH)
      else        ctx.fillText(ln,   0, startY + i * lineH)
    })
  }

  ctx.fillStyle = style.color
  drawLines(false)

  if (style.strokeWidth > 0 && style.strokeColor) {
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth   = style.strokeWidth * dpr
    drawLines(true)
  }

  ctx.restore()
}

// ── Quality render config ──────────────────────────────────────────────
interface QualityConfig {
  dprCap:        number
  bloomBlur:     number
  glitchMax:     number
  fogParticles:  number
  scanlineStep:  number
  tunnelRings:   number
}
const QUALITY: Record<Quality, QualityConfig> = {
  High:   { dprCap: 2,    bloomBlur: 10, glitchMax: 5, fogParticles: 600, scanlineStep: 3, tunnelRings: 8 },
  Medium: { dprCap: 1.25, bloomBlur: 5,  glitchMax: 3, fogParticles: 200, scanlineStep: 4, tunnelRings: 5 },
  Low:    { dprCap: 1,    bloomBlur: 0,  glitchMax: 1, fogParticles: 50,  scanlineStep: 6, tunnelRings: 3 },
}

const AUTO_QUALITY_ORDER: Quality[] = ['Low', 'Medium', 'High']

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
    const sw = W * scale, sh = H * scale
    return { ox: (W - sw) / 2, oy: (H - sh) / 2, sw, sh }
  }

  const imgAspect    = imgW / imgH
  const canvasAspect = W / H
  let drawW: number, drawH: number

  if (fitMode === 'cover') {
    if (imgAspect >= canvasAspect) {
      drawH = H * scale
      drawW = drawH * imgAspect
    } else {
      drawW = W * scale
      drawH = drawW / imgAspect
    }
  } else {
    if (imgAspect >= canvasAspect) {
      drawW = W * scale
      drawH = drawW / imgAspect
    } else {
      drawH = H * scale
      drawW = drawH * imgAspect
    }
  }

  let ox = (W - drawW) / 2
  let oy = (H - drawH) / 2

  if (role === 'character_art') oy = H * 0.55 - drawH / 2

  return { ox, oy, sw: drawW, sh: drawH }
}

function computeLayerItemDrawSize(
  W: number, H: number,
  el: HTMLImageElement | HTMLVideoElement,
  fitMode: VzLayerItem['fitMode'],
): { w: number; h: number } {
  const { w: iW, h: iH } = getMediaNaturalSize(el)
  if (!iW || !iH) return { w: W, h: H }
  switch (fitMode) {
    case 'stretch':  return { w: W,        h: H        }
    case 'original': return { w: iW,       h: iH       }
    case 'cover': {
      const r = Math.max(W / iW, H / iH)
      return { w: iW * r, h: iH * r }
    }
    case 'contain':
    default: {
      const r = Math.min(W / iW, H / iH)
      return { w: iW * r, h: iH * r }
    }
  }
}

function getLayerItemAnchorOffset(
  anchor: VzLayerItem['anchor'],
  w: number,
  h: number,
): { ox: number; oy: number } {
  switch (anchor) {
    case 'topLeft':     return { ox: 0,    oy: 0    }
    case 'topRight':    return { ox: -w,   oy: 0    }
    case 'bottomLeft':  return { ox: 0,    oy: -h   }
    case 'bottomRight': return { ox: -w,   oy: -h   }
    default:            return { ox: -w/2, oy: -h/2 }
  }
}

// ── Layer render plan ─────────────────────────────────────────────────
interface CompiledLayerEntry {
  item: VzLayerItem
  layerConfig: VzLayerConfig
  media: UploadedMedia
}

function buildLayerRenderPlan(
  layerItems: VzLayerItem[],
  layerConfigs: VzLayerConfig[],
  mediaItems: UploadedMedia[],
): CompiledLayerEntry[] {
  const plan: CompiledLayerEntry[] = []
  for (const layerId of VZ_LAYER_RENDER_ORDER) {
    const cfg = layerConfigs.find(c => c.id === layerId)
    if (!cfg || !cfg.enabled) continue
    const candidates = layerItems
      .filter(i => i.layerId === layerId && i.enabled)
      .sort((a, b) => a.zIndex - b.zIndex)
    if (!candidates.length) continue
    const hasSolo  = candidates.some(i => i.solo)
    const toRender = hasSolo ? candidates.filter(i => i.solo) : candidates
    for (const item of toRender) {
      const media = mediaItems.find(m => m.id === item.mediaId)
      if (!media) continue
      plan.push({ item, layerConfig: cfg, media })
    }
  }
  return plan
}

// ── LiveVisualCanvas ──────────────────────────────────────────────────
export interface CanvasProps {
  analyser: AnalyserNode | null
  activeMedia: UploadedMedia | null
  effects: VzEffects
  enabledFx: Set<string>
  isPlaying: boolean
  bpm: number
  bpmSync: boolean
  quality: Quality
  audioTime: number
  modulationRoutes: ModulationRoute[]
  timelineEnabled: boolean
  timelineClips: VzTimelineClip[]
  timelineLoop: boolean
  mediaItems: UploadedMedia[]
  onStatsUpdate: (stats: PerformanceStats) => void
  layerConfigs: VzLayerConfig[]
  layerItems: VzLayerItem[]
  effectParams: VzEffectParams
}

export function LiveVisualCanvas({ analyser, activeMedia, effects, enabledFx, isPlaying, bpm, bpmSync, quality, audioTime, modulationRoutes, timelineEnabled, timelineClips, timelineLoop, mediaItems, onStatsUpdate, layerConfigs, layerItems, effectParams }: CanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const animRef       = useRef<number>(0)
  const resizeFnRef   = useRef<() => void>(() => {})

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

  const timelineEnabledRef = useRef(timelineEnabled)
  const timelineClipsRef   = useRef<VzTimelineClip[]>(timelineClips)
  const timelineLoopRef    = useRef(timelineLoop)
  const mediaItemsRef      = useRef<UploadedMedia[]>(mediaItems)
  const layerConfigsRef    = useRef<VzLayerConfig[]>(layerConfigs)
  const layerItemsRef      = useRef<VzLayerItem[]>(layerItems)
  const layerRenderPlanRef = useRef<CompiledLayerEntry[]>([])
  const mediaPoolRef       = useRef<Map<string, HTMLImageElement | HTMLVideoElement>>(new Map())
  const activeClipIdRef    = useRef<string | null>(null)
  const timelineClockRef   = useRef(0)
  const lastFrameTimeRef   = useRef<number | null>(null)

  const offscreenRef     = useRef<HTMLCanvasElement | null>(null)
  const glitchScratchRef = useRef<HTMLCanvasElement | null>(null)
  const shakeAmountRef = useRef(0)
  const timeBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const activeMediaRoleRef    = useRef<MediaRole | null>(null)
  const activeMediaFitModeRef = useRef<'cover' | 'contain' | null>(null)

  const activeClipRef = useRef<VzTimelineClip | null>(null)

  const incomingMediaElRef   = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const transitionStateRef   = useRef<TwoClipRenderState | null>(null)
  const incomingRoleRef      = useRef<MediaRole | null>(null)
  const incomingFitModeRef   = useRef<'cover' | 'contain' | null>(null)
  const prevTransitionOnRef  = useRef(false)

  const lyricsEnabledRef  = useRef(false)
  const lyricsCuesRef     = useRef<LyricCue[]>([])
  const lyricsOffsetMsRef = useRef(0)
  const lyricsDocRef      = useRef<LyricDocument | null>(null)

  const fpsRef            = useRef(0)
  const fpsFrameCountRef  = useRef(0)
  const fpsWindowStartRef = useRef<number>(0)
  const onStatsUpdateRef  = useRef(onStatsUpdate)

  const fpsSamplesRef          = useRef<number[]>([])   // rolling 5-sample buffer for avg
  const droppedFrameCountRef   = useRef(0)              // drops in current 1s window
  const prevFrameNowRef        = useRef(0)              // perf.now() of previous frame

  const effectParamsRef = useRef<VzEffectParams>(effectParams)

  const lowFpsSinceRef          = useRef(0)   // perf.now() when low-FPS streak began, 0 = none
  const highFpsSinceRef         = useRef(0)   // perf.now() when high-FPS streak began, 0 = none
  const lastAutoQualityChangeMsRef = useRef(0)

  const setTimelineClockStoreRef  = useRef<(t: number) => void>(() => {})
  // Throttle Zustand clock writes to ~15fps so UI panels don't re-render every frame
  const clockPublishLastMsRef = useRef(0)
  const CLOCK_PUBLISH_MS = 1000 / 15  // ~66 ms

  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate })
  useEffect(() => { effectParamsRef.current = effectParams }, [effectParams])
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
  useEffect(() => {
    layerConfigsRef.current = layerConfigs
    layerItemsRef.current   = layerItems
    const newPlan = buildLayerRenderPlan(layerItems, layerConfigs, mediaItems)
    // Eagerly populate the media pool so the RAF loop never needs to create elements
    const pool = mediaPoolRef.current
    for (const { media } of newPlan) {
      if (!pool.has(media.id)) {
        if (media.type === 'image') {
          const img = new Image()
          img.src = media.url
          pool.set(media.id, img)
        } else {
          const vid = document.createElement('video')
          vid.src   = media.url
          vid.muted = true
          vid.playsInline = true
          vid.loop  = true
          if (isPlayingRef.current) vid.play().catch(() => {})
          pool.set(media.id, vid)
        }
      }
    }
    layerRenderPlanRef.current = newPlan
  }, [layerItems, layerConfigs, mediaItems])

  useEffect(() => {
    setTimelineClockStoreRef.current = useVisualStore.getState().setTimelineClock
  }, [])

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
    const sync = (s: ReturnType<typeof useLyricsStore.getState>) => {
      lyricsEnabledRef.current  = s.lyricsEnabled
      lyricsCuesRef.current     = s.cues
      lyricsOffsetMsRef.current = s.globalOffsetMs
      lyricsDocRef.current      = s.activeDocument
    }
    sync(useLyricsStore.getState())
    return useLyricsStore.subscribe(sync)
  }, [])

  useEffect(() => {
    analyserRef.current  = analyser
    freqBufRef.current   = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    timeBufRef.current   = analyser ? new Uint8Array(analyser.fftSize) : null
  }, [analyser])

  useEffect(() => {
    const prev = mediaElRef.current
    if (prev instanceof HTMLVideoElement) { prev.pause(); prev.src = '' }
    mediaElRef.current = null
    activeMediaRoleRef.current    = activeMedia?.mediaRole ?? null
    activeMediaFitModeRef.current = null

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMedia?.id])

  useEffect(() => {
    const el = mediaElRef.current
    if (!(el instanceof HTMLVideoElement)) return
    if (isPlaying) {
      el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    if (timelineEnabled) {
      timelineClockRef.current = 0
      lastFrameTimeRef.current = null
      activeClipIdRef.current  = null
    } else {
      mediaPoolRef.current.forEach(el => {
        if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
      })
      mediaPoolRef.current.clear()
      activeClipIdRef.current = null
    }
  }, [timelineEnabled])

  useEffect(() => {
    const tlIds = new Set(timelineClips.map(c => c.mediaId))
    const layerIds = new Set(layerItems.map(i => i.mediaId))
    const keepIds = new Set([...tlIds, ...layerIds])
    mediaPoolRef.current.forEach((el, id) => {
      if (!keepIds.has(id)) {
        if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
        mediaPoolRef.current.delete(id)
      }
    })
    if (timelineClips.length === 0 || !tlIds.has(activeClipIdRef.current ?? '')) {
      activeClipIdRef.current = null
      activeClipRef.current   = null
      if (timelineEnabledRef.current) mediaElRef.current = null
    }
  }, [timelineClips, mediaItems, layerConfigs, layerItems])

  // Main RAF loop — runs once, reads from refs
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
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

      // ── FPS measurement & stats ────────────────────────────────────
      const now = performance.now()
      // Dropped-frame tracking: a frame is "dropped" when inter-frame time > 33ms
      if (prevFrameNowRef.current > 0) {
        if (now - prevFrameNowRef.current > 33) droppedFrameCountRef.current++
      }
      prevFrameNowRef.current = now

      fpsFrameCountRef.current += 1
      if (fpsWindowStartRef.current === 0) fpsWindowStartRef.current = now
      const elapsed = now - fpsWindowStartRef.current
      if (elapsed >= 1000) {
        fpsRef.current = Math.round((fpsFrameCountRef.current * 1000) / elapsed)
        fpsFrameCountRef.current  = 0
        fpsWindowStartRef.current = now

        // Rolling 5-sample average
        const samples = fpsSamplesRef.current
        samples.push(fpsRef.current)
        if (samples.length > 5) samples.shift()
        const avgFps = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)

        // Snapshot stats for UI — once per second, no frame-rate setState
        const dropped = droppedFrameCountRef.current
        droppedFrameCountRef.current = 0
        const layerItemSnap = layerItemsRef.current
        const mediaItemSnap = mediaItemsRef.current
        const missingMediaCount = layerItemSnap.filter(
          i => i.enabled && !mediaItemSnap.find(m => m.id === i.mediaId)
        ).length
        const el = mediaElRef.current
        const activeMediaLoaded = el instanceof HTMLImageElement
          ? el.complete && el.naturalWidth > 0
          : el instanceof HTMLVideoElement
          ? el.readyState >= 2
          : false
        const curDpr = Math.min(devicePixelRatio, QUALITY[qualityRef.current].dprCap)
        const frameTimeMs = prevFrameNowRef.current > 0
          ? Math.round(now - prevFrameNowRef.current)
          : 0
        let warningLevel: WarningLevel = 'ok'
        if (avgFps < 40 || dropped >= 5) warningLevel = 'critical'
        else if (avgFps < 55)            warningLevel = 'caution'
        onStatsUpdateRef.current({
          fps: fpsRef.current, averageFps: avgFps, droppedFrameCount: dropped,
          frameTimeMs, canvasWidth: canvas.width, canvasHeight: canvas.height,
          dpr: curDpr, quality: qualityRef.current,
          activeMediaLoaded, missingMediaCount, warningLevel,
        })

        // ── Auto quality ────────────────────────────────────────────────
        const aq = useVisualStore.getState()
        if (aq.autoQualityEnabled) {
          const fps     = fpsRef.current
          const curIdx  = AUTO_QUALITY_ORDER.indexOf(qualityRef.current)
          const minIdx  = AUTO_QUALITY_ORDER.indexOf(aq.autoQualityMin)
          const maxIdx  = AUTO_QUALITY_ORDER.indexOf(aq.autoQualityMax)
          if (fps < 45) {
            if (lowFpsSinceRef.current === 0) lowFpsSinceRef.current = now
            highFpsSinceRef.current = 0
            if (
              now - lowFpsSinceRef.current >= 2000 &&
              curIdx > minIdx &&
              now - lastAutoQualityChangeMsRef.current >= 2000
            ) {
              const newQ = AUTO_QUALITY_ORDER[curIdx - 1]
              aq.setQuality(newQ)
              aq.setAutoQualityReason(`↓ ${fps} fps < 45 → ${newQ}`)
              lastAutoQualityChangeMsRef.current = now
              lowFpsSinceRef.current = 0
            }
          } else if (fps >= 58) {
            if (highFpsSinceRef.current === 0) highFpsSinceRef.current = now
            lowFpsSinceRef.current = 0
            if (
              now - highFpsSinceRef.current >= 8000 &&
              curIdx < maxIdx &&
              now - lastAutoQualityChangeMsRef.current >= 2000
            ) {
              const newQ = AUTO_QUALITY_ORDER[curIdx + 1]
              aq.setQuality(newQ)
              aq.setAutoQualityReason(`↑ ${fps} fps ≥ 58 → ${newQ}`)
              lastAutoQualityChangeMsRef.current = now
              highFpsSinceRef.current = 0
            }
          } else {
            lowFpsSinceRef.current  = 0
            highFpsSinceRef.current = 0
          }
        } else {
          lowFpsSinceRef.current  = 0
          highFpsSinceRef.current = 0
        }
      }

      const dpr  = Math.min(devicePixelRatio, QUALITY[qualityRef.current].dprCap)
      const q    = QUALITY[qualityRef.current]
      const t    = performance.now() - startTime
      const eff  = effectsRef.current
      const fxSet = enabledFxRef.current
      const speed = isPlayingRef.current ? 1 : 0.25

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

      const smoothBass = prevBassRef.current * 0.65 + bass * 0.35
      const bassDelta  = bass - prevBassRef.current
      const impactMod  = Math.max(0, bassDelta * 2.8)
      const punchScale = 1 + impactMod * eff.bassReactivity * 0.25

      const mEff = applyModulatedEffects(eff, { ...rawBands, bass: smoothBass }, routesRef.current)

      const activeColorShift = fxSet.has('Color Shift') ? mEff.colorShift : 0

      const bassReact   = 1 + smoothBass * mEff.bassReactivity * 0.35 * mEff.masterIntensity
      const dispMod     = mEff.displacement
      const feedbackMod = Math.min(0.97, mEff.feedbackTrails)
      const glitchMod   = mEff.glitchAmount
      const bloomMod    = Math.min(1, mEff.bloom)

      const onBeatBoundary = synced && beatPhase < 0.04
      const beatHit = onBeatBoundary || (!synced && bass > 0.65 && bass > prevBassRef.current + 0.07)

      const cx = W / 2, cy = H / 2

      if (an && timeBufRef.current && fxSet.has('Oscilloscope')) {
        an.getByteTimeDomainData(timeBufRef.current)
      }

      const frameCtx: VzFrameContext = {
        W, H, dpr,
        time:            t,
        audioTime:       audioTimeRef.current,
        bpm:             bpmRef.current,
        beatPhase,
        onBeatBoundary,
        beatHit,
        audio:           rawBands,
        masterIntensity: mEff.masterIntensity,
        quality: {
          scanlineStep: q.scanlineStep,
          fogParticles: q.fogParticles,
          glitchMax:    q.glitchMax,
          bloomBlur:    q.bloomBlur,
          tunnelRings:  q.tunnelRings,
        },
        cx,
        cy,
        freqData:       (an && buf) ? buf : null,
        timeDomainData: timeBufRef.current,
        effectParams:   effectParamsRef.current,
      }

      // ── Background / feedback ──────────────────────────────────────
      if (fxSet.has('Feedback') && feedbackMod > 0) {
        ctx.fillStyle = `rgba(5,7,9,${1 - feedbackMod * 0.92})`
        ctx.fillRect(0, 0, W, H)
      } else {
        ctx.fillStyle = '#090d0f'
        ctx.fillRect(0, 0, W, H)
      }

      if (fxSet.has('Datamosh Smear') && mEff.datamoshSmear > 0 && offscreenRef.current) {
        drawDatamoshSmear(ctx, W, H, offscreenRef.current, mEff.datamoshSmear, rawBands.volume)
      }

      // ── Timeline clock & active clip ──────────────────────────────
      if (timelineEnabledRef.current && timelineClipsRef.current.length > 0) {
        const nowMs = performance.now()
        const audioT = audioTimeRef.current
        if (audioT > 0) {
          timelineClockRef.current = audioT
        } else if (isPlayingRef.current) {
          if (lastFrameTimeRef.current !== null) {
            timelineClockRef.current += (nowMs - lastFrameTimeRef.current) / 1000
          }
        }
        lastFrameTimeRef.current = nowMs
        // Throttle: push to Zustand at ~15fps, not every frame
        if (nowMs - clockPublishLastMsRef.current >= CLOCK_PUBLISH_MS) {
          clockPublishLastMsRef.current = nowMs
          setTimelineClockStoreRef.current(timelineClockRef.current)
        }

        const clips = timelineClipsRef.current
        const { clip, localTimeSec } = getActiveTimelineClip(clips, timelineClockRef.current, timelineLoopRef.current)
        const clipId = clip?.id ?? null

        if (clipId !== activeClipIdRef.current) {
          activeClipIdRef.current = clipId
          activeClipRef.current   = clip ?? null
          if (clip) {
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
              el.loop        = false
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
          if (txJustStarted && inEl instanceof HTMLVideoElement) {
            const inDur = isFinite(inEl.duration) ? inEl.duration : 0
            inEl.currentTime = getClipSourceTime(inClip, 0, inDur)
            inEl.loop        = false
            if (isPlayingRef.current) inEl.play().catch(() => {})
          }
        } else {
          incomingMediaElRef.current = null
          incomingRoleRef.current    = null
          incomingFitModeRef.current = null
        }

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

      const role        = activeMediaRoleRef.current
      const renderMedia = shouldRenderRoleByDefault(role)
      const fitMode     = activeMediaFitModeRef.current ?? getDefaultFitModeForRole(role)
      const compositeOp = getCompositeOpForRole(role)
      const scale = shouldApplyScalePulse(role)
        ? bassReact * punchScale * eff.logoScale
        : 1
      const { ox, oy, sw, sh } = mediaEl
        ? computeDrawRect(W, H, mediaEl, fitMode, scale, role)
        : { ox: 0, oy: 0, sw: W, sh: H }

      let shakeApplied = false
      if (fxSet.has('Camera Shake') && mEff.cameraShake > 0) {
        const { dx, dy } = getCameraShakeOffset(shakeAmountRef, smoothBass, beatHit, mEff.cameraShake)
        if (Math.abs(dx) + Math.abs(dy) > 0.1) {
          ctx.save()
          ctx.translate(Math.round(dx), Math.round(dy))
          shakeApplied = true
        }
      }

      for (const mod of getEffectsForPhase('preMedia')) {
        if (!fxSet.has(mod.chainName)) continue
        const intensity = (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
        if (intensity <= 0) continue
        mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
      }

      if (mediaEl && renderMedia) {
        if (fxSet.has('Tunnel') && eff.tunnelSpeed > 0) {
          const tp = resolveTunnelParams(effectParamsRef.current)
          ctx.save()
          const tunnelT     = synced ? beatPhase * beatMs * eff.tunnelSpeed : t * eff.tunnelSpeed
          const tunnelDepth = (1 + smoothBass * eff.bassReactivity * 0.45) * tp.depth
          const ringCount   = Math.min(q.tunnelRings, tp.ringCount)
          for (let r = 0; r < ringCount; r++) {
            const radius = ((tunnelT * 0.1 + r * 30 * tunnelDepth) % 300) + 10
            const alpha  = 0.07 * (1 - radius / 300)
            ctx.strokeStyle = `rgba(74,199,219,${alpha})`
            ctx.lineWidth = tp.lineWidth * dpr
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
          }
          ctx.restore()
        }

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

        {
          const txState = transitionStateRef.current
          const inEl    = incomingMediaElRef.current

          const inRole        = incomingRoleRef.current
          const inFitMode     = incomingFitModeRef.current ?? getDefaultFitModeForRole(inRole)
          const inScale       = shouldApplyScalePulse(inRole) ? bassReact * punchScale * eff.logoScale : 1
          const inRect        = inEl ? computeDrawRect(W, H, inEl, inFitMode, inScale, inRole)
                                     : { ox: 0, oy: 0, sw: W, sh: H }
          const inCompositeOp = getCompositeOpForRole(inRole)

          if (txState && txState.config.type !== 'cut') {
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
            ctx.save()
            if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
            if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360}deg)`
            ctx.drawImage(mediaEl, ox, oy, sw, sh)
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'source-over'
            ctx.restore()
          }
        }

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

        if (fxSet.has('Displacement') && dispMod > 0) {
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

        if (fxSet.has('Glitch Bars') && glitchMod > 0 && W > 1 && H > 1) {
          const gp = resolveGlitchParams(effectParamsRef.current)
          if (Math.random() < glitchMod * gp.probability) {
            let scratch = glitchScratchRef.current
            if (!scratch) { scratch = document.createElement('canvas'); glitchScratchRef.current = scratch }
            if (scratch.width !== W || scratch.height !== H) { scratch.width = W; scratch.height = H }
            const scratchCtx = scratch.getContext('2d')
            if (scratchCtx) {
              scratchCtx.drawImage(canvas, 0, 0)
              const numGlitches = Math.min(Math.ceil(glitchMod * 5), q.glitchMax, gp.sliceCount)
              for (let g = 0; g < numGlitches; g++) {
                const gy = Math.floor(Math.random() * H)
                const gh = Math.floor(Math.random() * 10 + 2)
                if (gh < 1 || gy + gh > H) continue
                const gShift = (Math.random() - 0.5) * glitchMod * gp.maxShift
                ctx.drawImage(scratch, 0, gy, W, gh, gShift, gy, W, gh)
              }
            }
          }
        }
      } else if (isPlayingRef.current || rawBands.volume > 0.01) {
        drawGenerativeArt(ctx, W, H, dpr, t, speed, bass, { ...mEff, colorShift: activeColorShift })
      } else {
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

      // ── Overlay layer compositor ──────────────────────────────────────────────
      {
        const pool = mediaPoolRef.current
        for (const { item, layerConfig, media } of layerRenderPlanRef.current) {
          let el = pool.get(item.mediaId)
          if (!el) {
            // Defensive: populate pool if plan was built before pool entry existed
            if (media.type === 'image') {
              el = new Image(); (el as HTMLImageElement).src = media.url
            } else {
              const vid = document.createElement('video')
              vid.src = media.url; vid.muted = true; vid.playsInline = true; vid.loop = true
              if (isPlayingRef.current) vid.play().catch(() => {})
              el = vid
            }
            pool.set(item.mediaId, el)
          }

          if (el instanceof HTMLVideoElement) {
            if (isPlayingRef.current && el.paused)   el.play().catch(() => {})
            if (!isPlayingRef.current && !el.paused) el.pause()
          }

          const { w, h } = computeLayerItemDrawSize(W, H, el, item.fitMode)
          const { ox, oy } = getLayerItemAnchorOffset(item.anchor, w, h)
          const audioScale = item.audioReactive ? bassReact * punchScale * eff.logoScale : 1
          const totalScale = item.scale * audioScale

          ctx.save()
          ctx.globalAlpha = layerConfig.opacity * item.opacity
          if (item.blendMode !== 'source-over') ctx.globalCompositeOperation = item.blendMode
          if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360}deg)`
          ctx.translate(item.x * W, item.y * H)
          if (item.rotation !== 0) ctx.rotate(item.rotation * Math.PI / 180)
          if (totalScale !== 1)    ctx.scale(totalScale, totalScale)
          ctx.drawImage(el, ox, oy, w, h)
          ctx.filter = 'none'
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          ctx.restore()
        }
      }

      for (const mod of getEffectsForPhase('postMedia')) {
        if (!fxSet.has(mod.chainName)) continue
        const intensity = (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
        if (intensity <= 0) continue
        mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
      }

      if (shakeApplied) ctx.restore()

      for (const mod of getEffectsForPhase('master')) {
        if (!fxSet.has(mod.chainName)) continue
        const intensity = (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
        if (intensity <= 0) continue
        mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
      }

      if (fxSet.has('Datamosh Smear') && mEff.datamoshSmear > 0) {
        if (!offscreenRef.current || offscreenRef.current.width !== W || offscreenRef.current.height !== H) {
          offscreenRef.current = document.createElement('canvas')
          offscreenRef.current.width  = W
          offscreenRef.current.height = H
        }
        offscreenRef.current.getContext('2d')?.drawImage(canvas, 0, 0)
      }

      prevBassRef.current = bass * 0.82

      // ── Lyrics ─────────────────────────────────────────────────────
      if (lyricsEnabledRef.current && lyricsCuesRef.current.length > 0) {
        const adjustedMs = audioTimeRef.current * 1000 + lyricsOffsetMsRef.current
        const cues = lyricsCuesRef.current
        const activeCue = cues.find(c => c.startMs <= adjustedMs && adjustedMs < c.endMs) ?? null
        if (activeCue) {
          drawLyricCue(ctx, activeCue, adjustedMs, lyricsDocRef.current, W, H, dpr)
        }
      }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas ref={canvasRef} className="vz-preview-canvas" />
}

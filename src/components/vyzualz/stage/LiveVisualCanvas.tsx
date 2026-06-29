import { useRef, useEffect, useLayoutEffect } from 'react'
import { useVisualStore } from '../../../stores/visualStore'
import type { VzEffects, Quality } from '../../../stores/visualStore'
import type { UploadedMedia } from '../../../stores/mediaStore'
import { useLyricsStore } from '../../../stores/lyricsStore'
import type { LyricCue, LyricDocument, LyricStyle, LyricAnimation, LyricEasingName } from '../../../types/lyrics'
import { extractBandValues, applyModulatedEffects, gateAudioBands } from '../../../lib/audioModulation'
import type { ModulationRoute, AudioBandValues } from '../../../lib/audioModulation'
import {
  getActiveTimelineClip, getNextTimelineClip, getTransitionState,
  getClipSourceTime, getClipSourceRange, shouldFreezeClipFrame, getActiveOverlayClips,
  getEasedProgress, isClipSnapToBpmEnabled, getNativeVideoPlaybackDecision,
  getClipTransitionInState, getClipTransitionOutState,
} from '../../../lib/timeline'
import type { TwoClipRenderState, SingleClipTransitionState } from '../../../lib/timeline'
import type { VzTimelineMediaClip, VzTimelineEffectRegion } from '../../../types/timeline'
import { DEFAULT_OVERLAY_COMPOSITING, resolveClipGlobalFx } from '../../../types/timeline'
import { renderTimelineTransition, renderSingleElementTransition } from '../../../lib/transitionRenderer'
import type { MediaRole } from '../../../lib/mediaRoles'
import { VZ_LAYER_RENDER_ORDER } from '../../../types/vzLayers'
import type { VzLayerConfig, VzLayerItem } from '../../../types/vzLayers'
import type { PerformanceStats, WarningLevel, RendererType } from '../../../types/performanceStats'
import type { VzEffectParams } from '../../../types/effectParams'
import {
  resolveGlitchParams, resolveTunnelParams,
  GLITCH_DEFAULTS, TUNNEL_DEFAULTS,
} from '../../../types/effectParams'
import {
  getCameraShakeOffset,
  drawDatamoshSmear,
} from '../visualEffects'
import { getEffectsForPhase, getEffectModule } from '../effects/registry'
import type { VzFrameContext } from '../effects/types'
import { WebGL2Renderer } from '../../../renderers/WebGL2Renderer'
import type { RenderTransitionParams } from '../../../renderers/WebGL2Renderer'
import { GPU_TRANSITION_TYPES, getGpuTransitionIndex } from '../../../renderers/gpuTransitions'
import { resolveRendererType } from '../../../renderers/rendererSelection'
import { selectPostProcessSource } from '../../../renderers/postProcessSource'
import { CanvasBufferPool } from '../../../renderers/CanvasBufferPool'
import {
  derivePostProcessParams, isPostProcessActive, deriveDisplacementParams,
  derivePixelDistortionParams, deriveBloomGpuParams, deriveFeedbackParams, deriveNoiseWarpParams,
} from '../../../renderers/postProcessParams'
import type { WebGL2CreateResult } from '../../../renderers/WebGL2Renderer'
import { deriveColorGradeParams, buildCanvasColorGradeFilter } from '../../../renderers/colorGradeParams'
import {
  getOrCreateMediaInstance, pauseInactiveMediaInstances, destroyMediaInstance,
} from './mediaPool'
import { renderReactEngine, reactFrameFromVz, DEFAULT_REACT_RENDER_PARAMS } from '../react/renderers/ReactEngineRenderer'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'

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
  currentAudioMs: number,
  effectiveStartMs: number,
  effectiveEndMs: number,
  doc: LyricDocument | null,
  W: number, H: number, dpr: number,
): void {
  const style: LyricStyle = { ...LYRIC_DEF_STYLE, ...(doc?.defaultStyle ?? {}), ...(cue.style ?? {}) }
  const anim: LyricAnimation = { ...LYRIC_DEF_ANIM, ...(doc?.defaultAnimation ?? {}), ...(cue.animation ?? {}) }

  const elapsed = currentAudioMs - effectiveStartMs - anim.delayMs
  const inT  = Math.max(0, Math.min(1, elapsed / Math.max(1, anim.inMs)))
  const outT = Math.max(0, Math.min(1, (currentAudioMs - (effectiveEndMs - anim.outMs)) / Math.max(1, anim.outMs)))

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
  dprCap:       number
  maxPixels:    number  // pixel budget cap — canvas W×H cannot exceed this
  bloomBlur:    number
  glitchMax:    number
  fogParticles: number
  scanlineStep: number
  tunnelRings:  number
}
const QUALITY: Record<Quality, QualityConfig> = {
  High:   { dprCap: 2.0, maxPixels: 2_073_600, bloomBlur: 10, glitchMax: 5, fogParticles: 600, scanlineStep: 3, tunnelRings: 8 },
  Medium: { dprCap: 1.5, maxPixels: 1_382_400, bloomBlur: 5,  glitchMax: 3, fogParticles: 200, scanlineStep: 4, tunnelRings: 5 },
  Low:    { dprCap: 1.0, maxPixels:   921_600, bloomBlur: 0,  glitchMax: 1, fogParticles: 50,  scanlineStep: 6, tunnelRings: 3 },
}

const AUTO_QUALITY_ORDER: Quality[] = ['Low', 'Medium', 'High']

// ── Video sync thresholds ─────────────────────────────────────────────
// Hard seek only when drift is large enough that rate correction can't catch up.
// Tight threshold only for paused scrubbing where frame accuracy matters.
const DRIFT_HARD_SEEK_S  = 0.5    // playing: hard seek if drift exceeds this
const DRIFT_RATE_UPPER_S = 0.1    // playing: engage rate correction above this
const DRIFT_PAUSED_S     = 0.12   // paused / scrub: seek threshold
const RATE_FAST          = 1.02   // gentle speed-up when video lags timeline
const RATE_SLOW          = 0.98   // gentle slow-down when video runs ahead

// ── requestVideoFrameCallback support ────────────────────────────────
// Type augmentation: rVFC is in TS5+ lib.dom but declared here for safety.
declare global {
  interface VideoFrameCallbackMetadata {
    presentedFrames: number
    mediaTime:       number
    expectedDisplayTime: DOMHighResTimeStamp
    width:  number
    height: number
    captureTime?:        DOMHighResTimeStamp
    processingDuration?: number
  }
  interface HTMLVideoElement {
    requestVideoFrameCallback(
      callback: (now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) => void
    ): number
    cancelVideoFrameCallback(handle: number): void
  }
}
const VFC_SUPPORTED =
  typeof HTMLVideoElement !== 'undefined' &&
  'requestVideoFrameCallback' in HTMLVideoElement.prototype

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

/**
 * Returns true when a placed media instance should receive global audio-reactive
 * scale modulation (bassReact * punchScale * logoScale).
 *
 * Two independent gates must both pass:
 *   1. enableGlobalFx resolved via resolveClipGlobalFx() — per-element permission.
 *      OFF by default for background_video, ON for all other roles.
 *   2. Role eligibility — the set of roles whose visual design benefits from pulsing.
 *      background_video is included here because when Global FX is explicitly ON
 *      for that instance it should pulse exactly like a logo would.
 *
 * Local color grade, compositing, transitions, and clip-targeted FX regions are
 * NOT gated here — only the global audio-reactive scale path.
 */
function shouldApplyScalePulse(role: MediaRole | null, enableGlobalFx?: boolean): boolean {
  if (!resolveClipGlobalFx(enableGlobalFx, role)) return false
  if (!role || role === 'other') return true
  return (
    role === 'logo' ||
    role === 'transparent_element' ||
    role === 'character_art' ||
    role === 'background_video'
  )
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

// ── Helper canvas factory ─────────────────────────────────────────────
// Creates or resizes a persistent offscreen canvas stored in a ref.
// All helper canvases use alpha:true (the main output canvas is alpha:false).
function ensureHelperCanvas(
  ref: React.MutableRefObject<HTMLCanvasElement | null>,
  w: number,
  h: number,
): HTMLCanvasElement {
  if (!ref.current) ref.current = document.createElement('canvas')
  const c = ref.current
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  return c
}

// ── Effect region targeting helpers ──────────────────────────────────

/** Resolve the effective intensity for an effect module this frame.
 *  Returns > 0 when the effect should run (either via enabledFx or a global region). */
function resolveEffectIntensity(
  mod: { id: string; chainName: string; effectKey: string },
  fxSet: Set<string>,
  mEff: VzEffects,
  globalActiveRegions: VzTimelineEffectRegion[],
): number {
  if (fxSet.has(mod.chainName)) {
    return (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
  }
  const region = globalActiveRegions.find(r => r.effectId === mod.id)
  if (!region) return 0
  return region.intensity ?? (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
}

/** Collect {mod, intensity} pairs for targeted effect regions matching a given id. */
function collectTargetedEffects(
  regions: VzTimelineEffectRegion[],
  targetId: string,
  mEff: VzEffects,
): Array<{ mod: ReturnType<typeof getEffectModule>; intensity: number }> {
  const results: Array<{ mod: ReturnType<typeof getEffectModule>; intensity: number }> = []
  for (const r of regions) {
    if (!r.targetIds?.includes(targetId)) continue
    const mod = getEffectModule(r.effectId)
    if (!mod) continue
    const intensity = r.intensity ?? (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
    results.push({ mod, intensity })
  }
  return results
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
  /** When true the React engine renderer replaces the generative art fallback. */
  reactMode?: boolean
  quality: Quality
  getAudioTime: () => number
  modulationRoutes: ModulationRoute[]
  timelineEnabled: boolean
  timelineClips: VzTimelineMediaClip[]
  timelineOverlayClips?: VzTimelineMediaClip[]
  timelineEffectRegions?: VzTimelineEffectRegion[]
  timelineLoop: boolean
  mediaItems: UploadedMedia[]
  onStatsUpdate: (stats: PerformanceStats) => void
  layerConfigs: VzLayerConfig[]
  layerItems: VzLayerItem[]
  effectParams: VzEffectParams
  audioReactivityEnabled: boolean
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  /** Active React preset — used when reactMode is true. */
  reactPreset?: import('../react/ReactTypes').ReactPreset | null
  /** Live render params from the React control panel — used when reactMode is true. */
  reactParams?: import('../react/renderers/reactRenderUtils').ReactRenderParams
  /** Manual track sections for section-aware React rendering. */
  reactSections?: import('../react/ReactTypes').ReactTrackSection[]
}

export function LiveVisualCanvas({ analyser, activeMedia, effects, enabledFx, isPlaying, bpm, bpmSync, quality, getAudioTime, modulationRoutes, timelineEnabled, timelineClips, timelineOverlayClips = [], timelineEffectRegions = [], timelineLoop, mediaItems, onStatsUpdate, layerConfigs, layerItems, effectParams, audioReactivityEnabled, onCanvasReady, reactMode = false, reactPreset = null, reactParams, reactSections = [] }: CanvasProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const animRef       = useRef<number>(0)
  const resizeFnRef   = useRef<() => void>(() => {})

  const analyserRef   = useRef<AnalyserNode | null>(null)
  const freqBufRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const mediaElRef    = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  // Tracks the deck (non-timeline) media element independently so we can
  // restore it into mediaElRef when timeline mode is turned off.
  const deckMediaElRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const effectsRef    = useRef<VzEffects>(effects)
  const enabledFxRef  = useRef<Set<string>>(enabledFx)
  const isPlayingRef  = useRef(isPlaying)
  const bpmRef        = useRef(bpm)
  const bpmSyncRef    = useRef(bpmSync)
  const qualityRef    = useRef<Quality>(quality)
  const getAudioTimeRef = useRef(getAudioTime)
  const prevBassRef   = useRef(0)
  const routesRef     = useRef<ModulationRoute[]>(modulationRoutes)

  // React engine mode refs
  const reactModeRef     = useRef(reactMode)
  const reactPresetRef   = useRef(reactPreset)
  const reactParamsRef   = useRef(reactParams)
  const reactSectionsRef = useRef(reactSections)

  const timelineEnabledRef          = useRef(timelineEnabled)
  const timelineClipsRef            = useRef<VzTimelineMediaClip[]>(timelineClips)
  const timelineOverlayClipsRef     = useRef<VzTimelineMediaClip[]>(timelineOverlayClips)
  const timelineEffectRegionsRef    = useRef<VzTimelineEffectRegion[]>(timelineEffectRegions)
  const targetEffectOffscreenRef    = useRef(new CanvasBufferPool())
  const timelineLoopRef             = useRef(timelineLoop)
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
  // Source snapshot: one alpha-enabled W×H capture of the current video/image,
  // shared by RGB Split, Bloom and Displacement to avoid repeated video draws.
  const srcSnapRef       = useRef<HTMLCanvasElement | null>(null)
  // Bloom buffer: half-resolution (W/2 × H/2) blur buffer.
  const bloomBufRef      = useRef<HTMLCanvasElement | null>(null)
  // GPU transition targets: persistent W×H canvases that hold the GPU-composited
  // outgoing and incoming sources during clip transitions. Allocated once, resized
  // in-place by ensureHelperCanvas — never per-frame allocated.
  const txOutCanvasRef   = useRef<HTMLCanvasElement | null>(null)
  const txInCanvasRef    = useRef<HTMLCanvasElement | null>(null)
  // Canvas 2D color-grade scratch buffers: hold a graded copy of each transition
  // source so the grade is applied BEFORE the Canvas 2D transition compositor.
  const cgOutCanvasRef   = useRef<HTMLCanvasElement | null>(null)
  const cgInCanvasRef    = useRef<HTMLCanvasElement | null>(null)

  const devSrcDrawsRef   = useRef(0)   // DEV: direct HTMLVideoElement draws this frame
  const devEffPassRef    = useRef(0)   // DEV: canvas-to-canvas effect draws this frame

  const shakeAmountRef = useRef(0)
  const timeBufRef     = useRef<Uint8Array<ArrayBuffer> | null>(null)

  const activeMediaRoleRef    = useRef<MediaRole | null>(null)
  const activeMediaFitModeRef = useRef<'cover' | 'contain' | null>(null)

  const activeClipRef = useRef<VzTimelineMediaClip | null>(null)

  // ── Free-running sync state ───────────────────────────────────────────
  // scrubGenRef increments each time the user performs a discontinuous seek.
  // freeRunAnchorRef maps per-clip keys to the scrub generation at which that
  // clip was last re-anchored so we only re-seek once per scrub event.
  // previousSnapStateRef tracks the snap-to-BPM state from the previous frame
  // so the renderer can detect ON→OFF transitions and re-initialize native playback.
  const scrubGenRef          = useRef(0)
  const freeRunAnchorRef     = useRef<Map<string, number>>(new Map())
  const previousSnapStateRef = useRef<Map<string, boolean>>(new Map())

  const incomingMediaElRef   = useRef<HTMLImageElement | HTMLVideoElement | null>(null)
  const transitionStateRef        = useRef<TwoClipRenderState | null>(null)
  const clipTxInStateRef          = useRef<SingleClipTransitionState | null>(null)
  const clipTxOutStateRef         = useRef<SingleClipTransitionState | null>(null)
  const incomingRoleRef      = useRef<MediaRole | null>(null)
  const incomingFitModeRef   = useRef<'cover' | 'contain' | null>(null)
  const prevTransitionOnRef  = useRef(false)

  const lyricsEnabledRef = useRef(false)
  const lyricsDocRef     = useRef<LyricDocument | null>(null)

  const fpsRef            = useRef(0)
  const fpsFrameCountRef  = useRef(0)
  const fpsWindowStartRef = useRef<number>(0)
  const onStatsUpdateRef  = useRef(onStatsUpdate)

  const fpsSamplesRef          = useRef<number[]>([])   // rolling 5-sample buffer for avg
  const droppedFrameCountRef   = useRef(0)              // frames >33ms in current window
  const prevFrameNowRef        = useRef(0)              // perf.now() of previous frame
  const frameDeltaMsRef        = useRef(0)              // most recent captured inter-frame delta
  const windowDeltaSumRef      = useRef(0)
  const windowDeltaMaxRef      = useRef(0)
  const windowOver60Ref        = useRef(0)              // frames >16.7ms in current window
  const prevVideoDroppedRef    = useRef(0)              // last-published cumulative video drop count

  const devSeekCountRef  = useRef(0)   // DEV: hard seeks issued this second
  const devLastDriftRef  = useRef(0)   // DEV: most recent drift magnitude
  const devCorrModeRef   = useRef<'none' | 'rate' | 'seek'>('none')  // DEV: last correction applied

  // ── Video-frame-callback scheduler ───────────────────────────────────
  // vfcVideoRef / vfcIdRef: the video element and callback handle currently
  // registered with requestVideoFrameCallback.  Only one element at a time.
  const vfcVideoRef        = useRef<HTMLVideoElement | null>(null)
  const vfcIdRef           = useRef(0)
  const videoFrameReadyRef = useRef(false)  // true when rVFC fired since last draw
  const lastPaintedVidRef  = useRef(-1)     // mediaTime of the last painted frame
  // Counts for DEV diagnostics and PerformanceStats
  const vfcPresentedRef    = useRef(0)   // cumulative rVFC callbacks received
  const totalCanvasDrawRef = useRef(0)   // cumulative canvas redraws executed
  const skippedDrawRef     = useRef(0)   // redraws skipped (no new frame, no animation)
  // requestRedrawRef: call from any useEffect to wake the rAF if it is idle.
  const requestRedrawRef   = useRef(() => {})

  const effectParamsRef = useRef<VzEffectParams>(effectParams)
  const audioReactivityEnabledRef = useRef(audioReactivityEnabled)

  // ── Renderer tracking (set by GPU integration useEffect) ──────────────
  const rendererTypeRef          = useRef<RendererType>('canvas2d')
  const gpuEffectsRef            = useRef<string[]>([])
  const gl2RendererRef           = useRef<WebGL2Renderer | null>(null)
  const rendererFallbackReasonRef = useRef<string | null>(null)
  const contextLostRef           = useRef(false)

  // ── Color grade state (stable snapshots — never in animation-loop React state) ──
  const masterDimmerRef            = useRef(0)
  const colorGradePreviewBypassRef = useRef(false)

  const lowFpsSinceRef          = useRef(0)   // perf.now() when low-FPS streak began, 0 = none
  const highFpsSinceRef         = useRef(0)   // perf.now() when high-FPS streak began, 0 = none
  const lastAutoQualityChangeMsRef = useRef(0)

  // Set by resize() — effective DPR after both DPR cap and pixel budget scaling.
  // Used instead of raw devicePixelRatio for coordinate scaling in the render loop.
  const effectiveDprRef  = useRef(1)
  const renderScaleRef   = useRef(1)   // pixel budget scale factor (1 = no budget applied)

  const setTimelineClockStoreRef  = useRef<(t: number) => void>(() => {})
  // Throttle Zustand clock writes to ~15fps so UI panels don't re-render every frame
  const clockPublishLastMsRef = useRef(0)
  const CLOCK_PUBLISH_MS = 1000 / 15  // ~66 ms
  const STATS_PUBLISH_MS = 500        // publish performance metrics ~2/sec

  useEffect(() => { onStatsUpdateRef.current = onStatsUpdate })

  // Notify parent when the output canvas is available for captureStream recording.
  const onCanvasReadyRef = useRef(onCanvasReady)
  useEffect(() => { onCanvasReadyRef.current = onCanvasReady }, [onCanvasReady])
  useEffect(() => {
    onCanvasReadyRef.current?.(canvasRef.current)
    return () => { onCanvasReadyRef.current?.(null) }
  }, [])

  useEffect(() => { effectParamsRef.current = effectParams; requestRedrawRef.current() }, [effectParams])
  useEffect(() => { effectsRef.current  = effects; requestRedrawRef.current() })
  // enabledFx change may switch between VFC-driven and rAF-driven mode; wake rAF.
  useEffect(() => { enabledFxRef.current = enabledFx; requestRedrawRef.current() })
  // Play/pause: always wake rAF so it can act on the new play state.
  useEffect(() => { isPlayingRef.current = isPlaying; requestRedrawRef.current() }, [isPlaying])
  useEffect(() => { bpmRef.current = bpm })
  useEffect(() => { bpmSyncRef.current = bpmSync })
  useEffect(() => { qualityRef.current = quality; resizeFnRef.current() }, [quality])
  useEffect(() => { getAudioTimeRef.current = getAudioTime }, [getAudioTime])
  useEffect(() => { routesRef.current = modulationRoutes }, [modulationRoutes])
  useEffect(() => { audioReactivityEnabledRef.current = audioReactivityEnabled }, [audioReactivityEnabled])
  useEffect(() => { reactModeRef.current    = reactMode                    }, [reactMode])
  useEffect(() => { reactPresetRef.current  = reactPreset ?? null          }, [reactPreset])
  useEffect(() => { reactParamsRef.current  = reactParams                  }, [reactParams])
  useEffect(() => { reactSectionsRef.current = reactSections               }, [reactSections])

  // ── WebGL2 renderer lifecycle ─────────────────────────────────────────
  // Driven by gpuPreference (persisted), not rendererType (ephemeral).
  // applyPreference resolves the preference → creates/destroys the renderer
  // → writes rendererType back to the store so stats and UI stay in sync.
  //
  // Context-loss safety:
  //   onContextLost  — immediately switches render path to Canvas 2D; does not
  //                    dispose the renderer (browser may restore the context).
  //   onContextRestored — deferred via setTimeout so we exit the browser event
  //                    handler before disposing and re-initialising; prevents
  //                    recursive loseContext() calls inside the restore event.
  useEffect(() => {
    const applyPreference = (pref: 'auto' | 'webgl2' | 'canvas2d') => {
      const { type, fallbackReason } = resolveRendererType(pref)

      if (type === 'webgl2' && !gl2RendererRef.current) {
        const result: WebGL2CreateResult = WebGL2Renderer.create({
          onContextLost: (reason: string) => {
            // Immediately fall back to Canvas 2D in the render loop
            contextLostRef.current            = true
            rendererTypeRef.current           = 'canvas2d'
            rendererFallbackReasonRef.current = reason
            const store = useVisualStore.getState()
            store.setRendererContextLost(true)
            store.setRendererType('canvas2d')
            store.setRendererFallbackReason(reason)
            if (import.meta.env.DEV) console.warn('[LiveVisualCanvas] WebGL2 context lost — switching to Canvas 2D')
          },
          onContextRestored: () => {
            // Capture the stale renderer so we can dispose it after exiting
            // the event handler (calling loseContext() from within the restore
            // event can immediately re-lose the context in some browsers).
            const staleRenderer = gl2RendererRef.current
            gl2RendererRef.current = null   // stop render loop from using stale context
            contextLostRef.current = false
            useVisualStore.getState().setRendererContextLost(false)
            setTimeout(() => {
              staleRenderer?.dispose()  // listeners already removed by dispose()
              applyPreference(useVisualStore.getState().gpuPreference)
              if (import.meta.env.DEV) console.log('[LiveVisualCanvas] WebGL2 context restored — reinitialising')
            }, 0)
          },
        })

        if (result.error === null) {
          gl2RendererRef.current            = result.renderer
          rendererTypeRef.current           = 'webgl2'
          rendererFallbackReasonRef.current = null
          const store = useVisualStore.getState()
          store.setRendererType('webgl2')
          store.setRendererFallbackReason(null)
          store.setRendererContextLost(false)
          if (import.meta.env.DEV) console.log('[LiveVisualCanvas] WebGL2 renderer created')
        } else {
          // Typed failure — result.error is a human-readable reason
          const reason = result.error
          gl2RendererRef.current            = null
          rendererTypeRef.current           = 'canvas2d'
          rendererFallbackReasonRef.current = reason
          const store = useVisualStore.getState()
          store.setRendererType('canvas2d')
          store.setRendererFallbackReason(reason)
          if (import.meta.env.DEV) console.warn('[LiveVisualCanvas] WebGL2 create() failed:', reason)
        }
      } else if (type === 'canvas2d') {
        gl2RendererRef.current?.dispose()
        gl2RendererRef.current            = null
        gpuEffectsRef.current             = []
        rendererTypeRef.current           = 'canvas2d'
        rendererFallbackReasonRef.current = fallbackReason  // null for intentional canvas2d
        const store = useVisualStore.getState()
        store.setRendererType('canvas2d')
        store.setRendererFallbackReason(fallbackReason)
        // Clear context-loss state when switching away from GPU intentionally
        if (contextLostRef.current) {
          contextLostRef.current = false
          store.setRendererContextLost(false)
        }
      }
      requestRedrawRef.current()
    }

    // Initialize from the persisted GPU preference on mount
    applyPreference(useVisualStore.getState().gpuPreference)

    // Re-apply when the user changes their preference via the health indicator
    let prevPref = useVisualStore.getState().gpuPreference
    const unsub = useVisualStore.subscribe(state => {
      if (state.gpuPreference !== prevPref) {
        prevPref = state.gpuPreference
        applyPreference(state.gpuPreference)
      }
    })

    return () => {
      unsub()
      gl2RendererRef.current?.dispose()
      gl2RendererRef.current = null
      gpuEffectsRef.current  = []
    }
  }, [])

  // Sync timeline refs with useLayoutEffect so RAF always sees current values
  // before the next frame fires — prevents stale-media rendering after clip deletion.
  useLayoutEffect(() => { timelineEnabledRef.current = timelineEnabled }, [timelineEnabled])
  useLayoutEffect(() => { timelineClipsRef.current = timelineClips }, [timelineClips])
  useLayoutEffect(() => { timelineOverlayClipsRef.current = timelineOverlayClips }, [timelineOverlayClips])
  useEffect(() => { timelineEffectRegionsRef.current = timelineEffectRegions; requestRedrawRef.current() }, [timelineEffectRegions])
  useEffect(() => { timelineLoopRef.current = timelineLoop }, [timelineLoop])
  useEffect(() => { mediaItemsRef.current = mediaItems }, [mediaItems])
  useEffect(() => {
    layerConfigsRef.current = layerConfigs
    layerItemsRef.current   = layerItems
    const newPlan = buildLayerRenderPlan(layerItems, layerConfigs, mediaItems)
    // Eagerly populate the media pool so the RAF loop never needs to create elements
    const pool = mediaPoolRef.current
    for (const { item, media } of newPlan) {
      const key = `layer:${item.id}`
      const el = getOrCreateMediaInstance(pool, key, media, { loop: true })
      if (el instanceof HTMLVideoElement && isPlayingRef.current && el.paused) {
        el.play().catch(() => {})
      }
    }
    layerRenderPlanRef.current = newPlan
  }, [layerItems, layerConfigs, mediaItems])

  useEffect(() => {
    setTimelineClockStoreRef.current = useVisualStore.getState().setTimelineClock
  }, [])

  // ── Color grade snapshots — sync masterDimmer / preview bypass into refs ──────
  // Read once on mount, then keep current via store subscription. The RAF loop
  // reads these refs each frame; they are never put into React state so the loop
  // identity stays stable.
  useEffect(() => {
    const sync = (s: ReturnType<typeof useVisualStore.getState>) => {
      masterDimmerRef.current            = s.masterDimmer
      colorGradePreviewBypassRef.current = s.colorGradePreviewBypass
      requestRedrawRef.current()
    }
    sync(useVisualStore.getState())
    return useVisualStore.subscribe(sync)
  }, [])

  useEffect(() => {
    return useVisualStore.subscribe((state) => {
      const t = state.timelineClock
      if (Math.abs(timelineClockRef.current - t) > 0.05) {
        timelineClockRef.current = t
        lastFrameTimeRef.current = null
        scrubGenRef.current++       // signal free-running clips to re-anchor once
        requestRedrawRef.current()  // external scrub — wake rAF if paused-idle
      }
    })
  }, [])

  useEffect(() => {
    const sync = (s: ReturnType<typeof useLyricsStore.getState>) => {
      lyricsEnabledRef.current = s.lyricsEnabled
      lyricsDocRef.current     = s.activeDocument
      requestRedrawRef.current()
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
    // Tear down previous deck element
    const prev = deckMediaElRef.current
    if (prev instanceof HTMLVideoElement) { prev.pause(); prev.src = '' }
    deckMediaElRef.current = null
    // Only clear mediaElRef when timeline is not managing it
    if (!timelineEnabledRef.current) mediaElRef.current = null
    activeMediaRoleRef.current    = activeMedia?.mediaRole ?? null
    activeMediaFitModeRef.current = null

    if (!activeMedia) return

    if (activeMedia.type === 'image') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = activeMedia.url
      img.onload = () => {
        deckMediaElRef.current = img
        if (!timelineEnabledRef.current) mediaElRef.current = img
        requestRedrawRef.current()
      }
    } else {
      const video = document.createElement('video')
      // crossOrigin MUST be set before src — see mediaPool.ts for rationale.
      video.crossOrigin = 'anonymous'
      video.muted       = true
      video.playsInline = true
      video.preload     = 'auto'
      video.loop        = true
      video.src         = activeMedia.url
      video.load()
      if (isPlayingRef.current) video.play().catch(() => {})
      deckMediaElRef.current = video
      if (!timelineEnabledRef.current) mediaElRef.current = video
      requestRedrawRef.current()
    }

    return () => {
      const el = deckMediaElRef.current
      if (el instanceof HTMLVideoElement) { el.pause(); el.src = '' }
      deckMediaElRef.current = null
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

  // useLayoutEffect so pool/ref cleanup happens before the next RAF when the
  // user toggles timeline mode, preventing stale pool elements from rendering.
  useLayoutEffect(() => {
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
      activeClipRef.current   = null
      // Restore the deck element so the canvas immediately shows deck media
      // (the activeMedia?.id effect won't re-fire since activeMedia didn't change).
      mediaElRef.current = deckMediaElRef.current
      requestRedrawRef.current()
    }
  }, [timelineEnabled])

  // useLayoutEffect so media references are cleared synchronously before the
  // next RAF fires — prevents any stale-media frames after clip deletion.
  useLayoutEffect(() => {
    const keepKeys = new Set<string>([
      ...timelineClips.map(c => `background:${c.id}`),
      ...timelineOverlayClips.map(oc => `overlay:${oc.id}`),
      ...layerItems.map(i => `layer:${i.id}`),
    ])

    // Pause and evict pool entries whose instance is no longer referenced
    const toEvict: string[] = []
    mediaPoolRef.current.forEach((_el, key) => {
      if (!keepKeys.has(key)) toEvict.push(key)
    })
    for (const key of toEvict) destroyMediaInstance(mediaPoolRef.current, key)

    // If the currently active clip was deleted (or timeline is now empty),
    // clear the render references immediately so no stale frame is drawn.
    const activeClipGone = timelineClips.length === 0
      || !timelineClips.some(c => c.id === (activeClipIdRef.current ?? ''))
    if (activeClipGone) {
      activeClipIdRef.current = null
      activeClipRef.current   = null
      if (timelineEnabledRef.current) mediaElRef.current = null
    }
    // Evict free-run anchor entries for removed clips (map uses bg:/overlay: prefix)
    const freeRunMap = freeRunAnchorRef.current
    for (const key of freeRunMap.keys()) {
      const poolKey = key.startsWith('bg:')
        ? `background:${key.slice(3)}`
        : key  // overlay:xxx already matches keepKeys format
      if (!keepKeys.has(poolKey)) freeRunMap.delete(key)
    }
    // Evict previousSnapState entries for removed clips (same key convention)
    const prevSnapMap = previousSnapStateRef.current
    for (const key of prevSnapMap.keys()) {
      const poolKey = key.startsWith('bg:')
        ? `background:${key.slice(3)}`
        : key
      if (!keepKeys.has(poolKey)) prevSnapMap.delete(key)
    }
    requestRedrawRef.current()
  }, [timelineClips, timelineOverlayClips, mediaItems, layerConfigs, layerItems])

  // Main RAF loop — runs once, reads from refs
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // alpha:false lets the compositor skip per-pixel alpha blending with the page.
    // willReadFrequently is NOT set — this canvas never calls getImageData/putImageData.
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    function requestRedraw() {
      if (animRef.current === 0) {
        animRef.current = requestAnimationFrame(frame)
      }
    }
    requestRedrawRef.current = requestRedraw

    function onVideoFrame(_now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
      videoFrameReadyRef.current = true
      lastPaintedVidRef.current  = metadata.mediaTime
      if (import.meta.env.DEV) vfcPresentedRef.current++
      // Re-arm for the next decoded frame
      if (vfcVideoRef.current) {
        vfcIdRef.current = vfcVideoRef.current.requestVideoFrameCallback(onVideoFrame)
      }
      // Wake rAF if the canvas is idle (paused-static state)
      requestRedraw()
    }

    // Returns true if the visual output needs to change every rAF tick independent
    // of whether a new video frame has arrived (time-based effects, audio reactivity,
    // compound frame-history effects, transitions, or no media / generative art).
    function hasContinuousAnim(): boolean {
      if (enabledFxRef.current.size > 0) return true            // any effect = time/beat/audio driven
      if (audioReactivityEnabledRef.current && analyserRef.current) return true  // audio bands change every frame
      if (transitionStateRef.current !== null) return true      // transition progress animates
      const el = mediaElRef.current
      if (!el) return true                                      // generative art uses perf.now() time
      // Keep loop running until video has at least one decodable frame (readyState >= HAVE_CURRENT_DATA).
      // rVFC never fires for readyState < 2, so vfcDriven mode would freeze the canvas permanently.
      if (el instanceof HTMLVideoElement && el.readyState < 2) return true
      return false
    }

    function resize() {
      if (!canvas) return
      const r   = canvas.getBoundingClientRect()
      const q   = QUALITY[qualityRef.current]
      const dpr = Math.min(devicePixelRatio, q.dprCap)
      let W = Math.round(r.width  * dpr)
      let H = Math.round(r.height * dpr)
      // Pixel budget cap: scale down proportionally when both axes together exceed limit.
      const rawPixels = W * H
      let pxScale = 1
      if (rawPixels > 0 && rawPixels > q.maxPixels) {
        pxScale = Math.sqrt(q.maxPixels / rawPixels)
        W = Math.max(1, Math.round(W * pxScale))
        H = Math.max(1, Math.round(H * pxScale))
      }
      canvas.width  = W
      canvas.height = H
      renderScaleRef.current  = pxScale
      effectiveDprRef.current = r.width > 0 ? W / r.width : dpr
      requestRedraw()
    }
    resizeFnRef.current = resize
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    if (import.meta.env.DEV) {
      const q   = QUALITY[qualityRef.current]
      const dpr = Math.min(devicePixelRatio, q.dprCap)
      console.log(
        `[LiveVisualCanvas] init | alpha=false willReadFrequently=false | ` +
        `${canvas.width}×${canvas.height}px | DPR cap=${dpr.toFixed(2)} effectiveDpr=${effectiveDprRef.current.toFixed(2)} ` +
        `(screen=${devicePixelRatio.toFixed(2)}) renderScale=${renderScaleRef.current.toFixed(3)} | quality=${qualityRef.current}`
      )
    }

    const startTime = performance.now()

    function frame() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (!W || !H) { animRef.current = requestAnimationFrame(frame); return }

      // ── Frame timing & rolling stats ────────────────────────────────
      const now = performance.now()
      // Capture delta BEFORE updating the previous-frame timestamp — prevents zero-delta bug
      const frameDeltaMs = prevFrameNowRef.current > 0 ? now - prevFrameNowRef.current : 0
      prevFrameNowRef.current = now
      frameDeltaMsRef.current = frameDeltaMs

      if (frameDeltaMs > 0) {
        fpsFrameCountRef.current  += 1
        windowDeltaSumRef.current += frameDeltaMs
        if (frameDeltaMs > windowDeltaMaxRef.current) windowDeltaMaxRef.current = frameDeltaMs
        if (frameDeltaMs > 16.7) windowOver60Ref.current      += 1
        if (frameDeltaMs > 33.3) droppedFrameCountRef.current += 1
      }
      if (fpsWindowStartRef.current === 0) fpsWindowStartRef.current = now
      const elapsed = now - fpsWindowStartRef.current

      if (elapsed >= STATS_PUBLISH_MS) {
        const wFrames = fpsFrameCountRef.current
        fpsRef.current = wFrames > 0 ? Math.round((wFrames * 1000) / elapsed) : 0

        // Rolling 5-sample average FPS
        const samples = fpsSamplesRef.current
        samples.push(fpsRef.current)
        if (samples.length > 5) samples.shift()
        const avgFps = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)

        const avgDeltaMs   = wFrames > 0 ? Math.round(windowDeltaSumRef.current / wFrames) : 0
        const worstDeltaMs = Math.round(windowDeltaMaxRef.current)
        const over60       = windowOver60Ref.current
        const dropped      = droppedFrameCountRef.current

        // Video playback quality (cumulative browser-reported counts)
        const videoEl = mediaElRef.current instanceof HTMLVideoElement ? mediaElRef.current : null
        let videoTotalFrames = 0, videoDroppedFrames = 0
        if (videoEl && typeof videoEl.getVideoPlaybackQuality === 'function') {
          const vq         = videoEl.getVideoPlaybackQuality()
          videoTotalFrames   = vq.totalVideoFrames
          videoDroppedFrames = vq.droppedVideoFrames
        }
        const videoDroppedDelta = videoDroppedFrames - prevVideoDroppedRef.current
        prevVideoDroppedRef.current = videoDroppedFrames

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
        const activeEffectCount = enabledFxRef.current.size

        // Count managed video elements (pool + deck + incoming transition)
        let videoElementCount = 0
        let videoPlayingCount = 0
        const countedVids = new Set<HTMLVideoElement>()
        const countVid = (v: HTMLVideoElement) => {
          if (countedVids.has(v)) return
          countedVids.add(v)
          videoElementCount++
          if (!v.paused) videoPlayingCount++
        }
        if (deckMediaElRef.current instanceof HTMLVideoElement) countVid(deckMediaElRef.current)
        mediaPoolRef.current.forEach(e => { if (e instanceof HTMLVideoElement) countVid(e) })
        if (incomingMediaElRef.current instanceof HTMLVideoElement) countVid(incomingMediaElRef.current)

        let warningLevel: WarningLevel = 'ok'
        if (avgFps < 40 || dropped >= 3)                                          warningLevel = 'critical'
        else if (avgFps < 55 || over60 > wFrames * 0.10 || videoDroppedDelta >= 3) warningLevel = 'caution'

        // Read auto quality state once — reused in both stats publish and auto quality logic.
        const aq = useVisualStore.getState()

        onStatsUpdateRef.current({
          fps: fpsRef.current, averageFps: avgFps, droppedFrameCount: dropped,
          frameTimeMs:       Math.round(frameDeltaMsRef.current),
          avgFrameDeltaMs:   avgDeltaMs,
          worstFrameDeltaMs: worstDeltaMs,
          framesOver60:      over60,
          framesOver30:      dropped,
          videoTotalFrames, videoDroppedFrames,
          canvasWidth: canvas.width, canvasHeight: canvas.height,
          dpr: effectiveDprRef.current, renderScale: renderScaleRef.current,
          quality: qualityRef.current,
          autoQualityEnabled: aq.autoQualityEnabled, autoQualityReason: aq.autoQualityReason,
          activeMediaLoaded, missingMediaCount, activeEffectCount,
          warningLevel,
          videoElementCount, videoPlayingCount,
          rendererType: rendererTypeRef.current,
          gpuEffects:   gpuEffectsRef.current,
          rendererFallbackReason: rendererFallbackReasonRef.current,
          contextLost:            contextLostRef.current,
        })

        // Reset window counters
        fpsFrameCountRef.current  = 0
        fpsWindowStartRef.current = now
        windowDeltaSumRef.current = 0
        windowDeltaMaxRef.current = 0
        windowOver60Ref.current   = 0
        droppedFrameCountRef.current = 0

        // ── Auto quality ─────────────────────────────────────────────────
        // Frame-time driven: avgFrameDeltaMs > 22ms ≈ sustained < 45fps.
        // Longer hysteresis windows (3s down, 15s up) prevent thrashing.
        if (aq.autoQualityEnabled) {
          const curIdx  = AUTO_QUALITY_ORDER.indexOf(qualityRef.current)
          const minIdx  = AUTO_QUALITY_ORDER.indexOf(aq.autoQualityMin)
          const maxIdx  = AUTO_QUALITY_ORDER.indexOf(aq.autoQualityMax)
          if (avgDeltaMs > 22) {
            if (lowFpsSinceRef.current === 0) lowFpsSinceRef.current = now
            highFpsSinceRef.current = 0
            if (
              now - lowFpsSinceRef.current >= 3000 &&
              curIdx > minIdx &&
              now - lastAutoQualityChangeMsRef.current >= 3000
            ) {
              const newQ = AUTO_QUALITY_ORDER[curIdx - 1]
              aq.setQuality(newQ)
              aq.setAutoQualityReason(`↓ avg ${avgDeltaMs}ms/frame → ${newQ}`)
              lastAutoQualityChangeMsRef.current = now
              lowFpsSinceRef.current = 0
            }
          } else if (avgDeltaMs < 17 && fpsRef.current >= 58) {
            if (highFpsSinceRef.current === 0) highFpsSinceRef.current = now
            lowFpsSinceRef.current = 0
            if (
              now - highFpsSinceRef.current >= 15000 &&
              curIdx < maxIdx &&
              now - lastAutoQualityChangeMsRef.current >= 3000
            ) {
              const newQ = AUTO_QUALITY_ORDER[curIdx + 1]
              aq.setQuality(newQ)
              aq.setAutoQualityReason(`↑ avg ${avgDeltaMs}ms/frame → ${newQ}`)
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

      // ── rVFC management ───────────────────────────────────────────────
      // Register requestVideoFrameCallback on the current active video element.
      // Fires once per decoded frame; re-armed in onVideoFrame. Cancelled when
      // the video changes or media becomes non-video.
      {
        const mainVid = mediaElRef.current instanceof HTMLVideoElement
          ? mediaElRef.current : null
        if (VFC_SUPPORTED && mainVid) {
          if (vfcVideoRef.current !== mainVid) {
            // Active video changed — cancel old registration and switch to new
            if (vfcVideoRef.current && vfcIdRef.current) {
              vfcVideoRef.current.cancelVideoFrameCallback(vfcIdRef.current)
              vfcIdRef.current = 0
            }
            vfcVideoRef.current        = mainVid
            videoFrameReadyRef.current = true  // force first draw on new video
            vfcIdRef.current = mainVid.requestVideoFrameCallback(onVideoFrame)
          }
          // else: already registered — rVFC fires when next decoded frame is ready
        } else if (!mainVid && vfcVideoRef.current) {
          // Media changed to image or null — cancel outstanding callback
          vfcVideoRef.current.cancelVideoFrameCallback(vfcIdRef.current)
          vfcIdRef.current = 0
          vfcVideoRef.current = null
        }
      }

      // ── shouldDraw: gate full canvas repaint on video frame delivery ──
      // When vfcDriven: no animation runs independently of the video decode
      // clock, so painting the same frame twice is pure waste.  Skip the
      // canvas ops (but still run rAF for stats and clock housekeeping).
      const continuousAnim = hasContinuousAnim()
      const vfcDriven = VFC_SUPPORTED &&
        (mediaElRef.current instanceof HTMLVideoElement) &&
        !continuousAnim
      const shouldDraw = !vfcDriven || videoFrameReadyRef.current
      if (!shouldDraw) {
        if (import.meta.env.DEV) skippedDrawRef.current++
        animRef.current = requestAnimationFrame(frame)
        return
      }
      videoFrameReadyRef.current = false   // consume the new-frame signal
      if (import.meta.env.DEV) totalCanvasDrawRef.current++

      const dpr  = effectiveDprRef.current
      const q    = QUALITY[qualityRef.current]
      const t    = performance.now() - startTime
      const eff  = effectsRef.current
      const fxSet = enabledFxRef.current
      const speed = isPlayingRef.current ? 1 : 0.25

      // Read audio time once per frame directly from HTMLAudioElement — never from React state
      const audioTimeNow = getAudioTimeRef.current()

      // ── Active effect regions (computed once per frame) ────────────────
      const activeRegions = timelineEnabledRef.current
        ? timelineEffectRegionsRef.current.filter(r =>
            r.enabled &&
            audioTimeNow >= r.startSec &&
            audioTimeNow < r.startSec + r.durationSec
          )
        : []
      const globalActiveRegions    = activeRegions.filter(r => !r.targetType || r.targetType === 'global')
      const layerActiveRegions     = activeRegions.filter(r => r.targetType === 'layer')
      const layerItemActiveRegions = activeRegions.filter(r => r.targetType === 'layerItem')
      const clipActiveRegions      = activeRegions.filter(r => r.targetType === 'clip')

      const beatMs    = 60000 / Math.max(1, bpmRef.current)
      const synced    = bpmSyncRef.current
      const audioMs   = audioTimeNow * 1000
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
        // Feed Music Intelligence Engine — publishes audio and canonical lyric state.
        musicIntelligenceEngine.updateFromAudioFrame({
          freqBuf:    buf,
          timeBuf:    null,   // time-domain only read when Oscilloscope is enabled
          sampleRate: an.context.sampleRate,
          audioTime:  audioTimeNow,
          isPlaying:  isPlayingRef.current,
        })
      }
      const lyricPlayback = an && buf
        ? musicIntelligenceEngine.getLyricPlaybackState()
        : musicIntelligenceEngine.resolveLyricsAt(audioTimeNow)
      const audioOn    = audioReactivityEnabledRef.current
      // Single gate: all downstream consumers read activeBands, never rawBands,
      // so disabling audio reactivity makes every audio-driven path go silent.
      const activeBands = gateAudioBands(rawBands, audioOn)
      const bass = activeBands.bass
      const high = activeBands.high

      const smoothBass = prevBassRef.current * 0.65 + bass * 0.35
      const bassDelta  = bass - prevBassRef.current
      const impactMod  = Math.max(0, bassDelta * 2.8)

      // ── Effect Chain gates for the three global-modulation parameters ─────────
      // These correspond to the entries seeded in migration 0010.  When a toggle
      // is OFF the value is neutralised to its identity value (1.0 for multipliers)
      // so individual effect sliders retain their saved values and resume on re-enable.
      // Pre-migration sessions have these names auto-added to enabledFxArr in the
      // store merge function, so "always on" legacy behaviour is preserved.
      const bassReactEnabled   = fxSet.has('Bass Reactivity')
      const logoScaleEnabled   = fxSet.has('Reactive Scale')
      const masterIntEnabled   = fxSet.has('Master Intensity')

      const punchScale = (audioOn && bassReactEnabled)
        ? 1 + impactMod * eff.bassReactivity * 0.25
        : 1

      const mEff = audioOn
        ? applyModulatedEffects(eff, { ...rawBands, bass: smoothBass }, routesRef.current, AudioFeatureBus.getFrame())
        : eff

      const activeColorShift = fxSet.has('Color Shift') ? mEff.colorShift : 0

      // Effective master intensity: 1.0 (neutral) when the Effect Chain toggle is off,
      // so individual effects keep their configured levels rather than going silent.
      const effectiveMasterInt = masterIntEnabled ? mEff.masterIntensity : 1

      const bassReact = (audioOn && bassReactEnabled)
        ? 1 + smoothBass * mEff.bassReactivity * 0.35 * effectiveMasterInt
        : 1

      // Reactive Scale contribution: 1.0 when toggled off so scale reverts to mediaScale.
      const activeLogoScale = logoScaleEnabled ? eff.logoScale : 1
      const dispMod     = mEff.displacement
      const feedbackMod = Math.min(0.97, mEff.feedbackTrails)
      const glitchMod   = mEff.glitchAmount
      const bloomMod    = Math.min(1, mEff.bloom)

      const onBeatBoundary = synced && beatPhase < 0.04
      // beatHit drives beat-reactive effects; suppress when audio reactivity is off
      const beatHit = audioOn
        ? (onBeatBoundary || (!synced && bass > 0.65 && bass > prevBassRef.current + 0.07))
        : false

      const cx = W / 2, cy = H / 2

      if (an && timeBufRef.current && fxSet.has('Oscilloscope')) {
        an.getByteTimeDomainData(timeBufRef.current)
      }

      const frameCtx: VzFrameContext = {
        W, H, dpr,
        time:            t,
        audioTime:       audioTimeNow,
        bpm:             bpmRef.current,
        beatPhase,
        onBeatBoundary,
        beatHit,
        audio:           activeBands,
        masterIntensity: effectiveMasterInt,
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
        drawDatamoshSmear(ctx, W, H, offscreenRef.current, mEff.datamoshSmear, activeBands.volume)
      }

      // ── Video sync helper — drift-aware position correction ──────────────
      // Defined here so it is accessible to both background clips and overlay clips.
      function syncVideoEl(vid: HTMLVideoElement, desired: number, playing: boolean) {
        if (vid.seeking) return
        const drift    = desired - vid.currentTime
        const absDrift = Math.abs(drift)
        if (playing) {
          if (absDrift > DRIFT_HARD_SEEK_S) {
            vid.playbackRate = 1
            vid.currentTime  = desired
            if (import.meta.env.DEV) { devSeekCountRef.current++; devCorrModeRef.current = 'seek' }
          } else if (absDrift > DRIFT_RATE_UPPER_S) {
            vid.playbackRate = drift < 0 ? RATE_SLOW : RATE_FAST
            if (import.meta.env.DEV) devCorrModeRef.current = 'rate'
          } else {
            vid.playbackRate = 1
            if (import.meta.env.DEV) devCorrModeRef.current = 'none'
          }
          if (import.meta.env.DEV) devLastDriftRef.current = absDrift
        } else {
          if (absDrift > DRIFT_PAUSED_S) {
            vid.currentTime  = desired
            vid.playbackRate = 1
            if (import.meta.env.DEV) { devSeekCountRef.current++; devCorrModeRef.current = 'seek' }
          }
        }
      }

      // Per-frame flags: true when a native non-loop clip has expired so that the
      // corresponding drawImage call is skipped and no stale frame is rendered.
      let bgVideoExpired = false
      let txInExpired    = false

      // ── Timeline clock & active clip ──────────────────────────────
      if (timelineEnabledRef.current && timelineClipsRef.current.length > 0) {
        const nowMs = performance.now()
        const audioT = audioTimeNow
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
          // `clips` is VzTimelineMediaClip[]; getActiveTimelineClip widens the
          // element type to VzTimelineClip but the runtime object is the media clip.
          activeClipRef.current   = (clip as VzTimelineMediaClip | null) ?? null
          if (clip) {
            const m = mediaItemsRef.current.find(x => x.id === clip.mediaId)
            activeMediaRoleRef.current    = m?.mediaRole ?? null
            activeMediaFitModeRef.current = clip.fitMode

            const bgKey = `background:${clip.id}`
            const el = m ? getOrCreateMediaInstance(mediaPoolRef.current, bgKey, m) : null
            mediaElRef.current = el
            if (el instanceof HTMLVideoElement) {
              el.loop         = false
              el.playbackRate = 1
              const elDur     = isFinite(el.duration) ? el.duration : 0
              el.currentTime  = getClipSourceTime(clip, localTimeSec, elDur)
              if (isPlayingRef.current) el.play().catch(() => {})
            }
            // Record that this clip was just anchored so the free-running path
            // does not immediately re-seek on the first frame.
            freeRunAnchorRef.current.set(`bg:${clip.id}`, scrubGenRef.current)
          } else {
            mediaElRef.current = null
            activeClipRef.current         = null
            activeMediaRoleRef.current    = null
            activeMediaFitModeRef.current = null
          }
        } else if (clip) {
          // Clip ID unchanged but the clip object may have new property values
          // (e.g. colorGrade edited via Inspector). Keep the ref current so
          // per-frame grade reads always see the latest stored values.
          activeClipRef.current = clip as VzTimelineMediaClip
        }

        if (clip) {
          const nextClip = getNextTimelineClip(clips, clip.id, timelineLoopRef.current)
          if (nextClip) {
            const nm = mediaItemsRef.current.find(x => x.id === nextClip.mediaId)
            if (nm) getOrCreateMediaInstance(mediaPoolRef.current, `background:${nextClip.id}`, nm)
          }
        }

        const txState = getTransitionState(clips, timelineClockRef.current, timelineLoopRef.current)
        transitionStateRef.current = txState

        // Per-clip single-element transitions — only active when no pairwise overlap
        if (!txState && clip) {
          clipTxInStateRef.current  = getClipTransitionInState(clip,  timelineClockRef.current)
          clipTxOutStateRef.current = getClipTransitionOutState(clip, timelineClockRef.current)
        } else {
          clipTxInStateRef.current  = null
          clipTxOutStateRef.current = null
        }

        const txNowActive    = txState !== null
        const txJustStarted  = txNowActive && !prevTransitionOnRef.current
        prevTransitionOnRef.current = txNowActive

        if (txState) {
          const inClip = txState.incomingClip
          const inm    = mediaItemsRef.current.find(x => x.id === inClip.mediaId)
          const inEl   = inm
            ? getOrCreateMediaInstance(mediaPoolRef.current, `background:${inClip.id}`, inm)
            : null
          incomingMediaElRef.current  = inEl
          incomingRoleRef.current     = inm?.mediaRole ?? null
          incomingFitModeRef.current  = inClip.fitMode
          if (txJustStarted && inEl instanceof HTMLVideoElement) {
            const inDur         = isFinite(inEl.duration) ? inEl.duration : 0
            inEl.loop           = false
            inEl.playbackRate   = 1
            inEl.currentTime    = getClipSourceTime(inClip, txState.incomingLocalTimeSec, inDur)
            if (isPlayingRef.current) inEl.play().catch(() => {})
            // Record anchor for free-running path
            freeRunAnchorRef.current.set(`bg:${inClip.id}`, scrubGenRef.current)
          }
        } else {
          incomingMediaElRef.current = null
          incomingRoleRef.current    = null
          incomingFitModeRef.current = null
        }

        // ── Active background video sync ──────────────────────────────────
        // Use the FRESH clip from getActiveTimelineClip (not stale activeClipRef.current)
        // so property changes like snapToBpm take effect immediately without a clip switch.
        const activeVid = mediaElRef.current
        if (clip && activeVid instanceof HTMLVideoElement) {
          const dur         = isFinite(activeVid.duration) ? activeVid.duration : 0
          const snapEnabled = isClipSnapToBpmEnabled(clip)
          const bgKey       = `bg:${clip.id}`

          // Detect ON→OFF transition so native playback is immediately re-initialized.
          const prevSnap         = previousSnapStateRef.current.get(bgKey)
          const justDisabledSnap = prevSnap === true && !snapEnabled
          previousSnapStateRef.current.set(bgKey, snapEnabled)

          if (snapEnabled) {
            // SYNCED PATH — freeze logic only applies when synchronisation is active
            const frozen = shouldFreezeClipFrame(clip, localTimeSec, dur)
            if (frozen) {
              if (!activeVid.paused) activeVid.pause()
            } else {
              const desired = getClipSourceTime(clip, localTimeSec, dur)
              if (isPlayingRef.current) {
                if (activeVid.paused) activeVid.play().catch(() => {})
                syncVideoEl(activeVid, desired, true)
              } else {
                syncVideoEl(activeVid, desired, false)
                if (!activeVid.paused) activeVid.pause()
              }
            }
          } else {
            // FREE-RUNNING PATH — native speed, boundary detected via video.currentTime
            const decision = getNativeVideoPlaybackDecision(clip, localTimeSec, dur)
            const { inSec, outSec } = getClipSourceRange(clip, dur)
            const lastGen  = freeRunAnchorRef.current.get(bgKey) ?? -1
            const scrubGen = scrubGenRef.current

            if (justDisabledSnap || scrubGen !== lastGen) {
              // Re-anchor: first activation, scrub, or Snap ON→OFF transition.
              // For ON→OFF on trim/freeze: if the video was held at the sync endpoint,
              // restart from inSec so native playback has room to visibly progress.
              let initPos = decision.sourceTimeSec!
              if (justDisabledSnap && !decision.loopsNaturally && activeVid.currentTime >= outSec - 0.05) {
                initPos = inSec
              }
              activeVid.currentTime  = initPos
              activeVid.playbackRate = 1
              freeRunAnchorRef.current.set(bgKey, scrubGen)
            } else if (activeVid.currentTime < inSec) {
              activeVid.currentTime = inSec
            } else if (activeVid.currentTime >= outSec) {
              if (decision.loopsNaturally) {
                activeVid.currentTime = inSec    // natural loop wrap
              } else if (!activeVid.paused) {
                activeVid.pause()                // at source boundary: hold, keep drawing
              }
            }
            // Drive transport — no play() once a non-loop clip has reached outSec
            const atNonLoopBoundary = !decision.loopsNaturally && activeVid.currentTime >= outSec
            if (!atNonLoopBoundary) {
              if (isPlayingRef.current) {
                activeVid.playbackRate = 1
                if (activeVid.paused) activeVid.play().catch(() => {})
              } else {
                if (!activeVid.paused) activeVid.pause()
              }
            }
          }
        }

        // ── Incoming transition video sync ────────────────────────────────
        const txCurrent = transitionStateRef.current
        const inVid     = incomingMediaElRef.current
        if (txCurrent && inVid instanceof HTMLVideoElement) {
          const inClipSync    = txCurrent.incomingClip
          const inDurSync     = isFinite(inVid.duration) ? inVid.duration : 0
          // Track snap state for incoming clip so ON→OFF transitions are detected correctly.
          const inKey         = `bg:${inClipSync.id}`
          const inSnapEnabled = isClipSnapToBpmEnabled(inClipSync)
          const prevInSnap    = previousSnapStateRef.current.get(inKey)
          const justDisabledInSnap = prevInSnap === true && !inSnapEnabled
          previousSnapStateRef.current.set(inKey, inSnapEnabled)

          if (inSnapEnabled) {
            // SYNCED PATH for incoming clip
            const desired = getClipSourceTime(inClipSync, txCurrent.incomingLocalTimeSec, inDurSync)
            if (isPlayingRef.current) {
              if (inVid.paused) inVid.play().catch(() => {})
              syncVideoEl(inVid, desired, true)
            } else {
              syncVideoEl(inVid, desired, false)
              if (!inVid.paused) inVid.pause()
            }
          } else {
            // FREE-RUNNING PATH for incoming clip — boundary detected via video.currentTime
            const txDecision = getNativeVideoPlaybackDecision(
              inClipSync, txCurrent.incomingLocalTimeSec, inDurSync,
            )
            const { inSec: inIn, outSec: inOut } = getClipSourceRange(inClipSync, inDurSync)
            const lastGen  = freeRunAnchorRef.current.get(inKey) ?? -1
            const scrubGen = scrubGenRef.current

            if (justDisabledInSnap || scrubGen !== lastGen) {
              // Re-anchor: snap disable or scrub.
              // ON→OFF on trim/freeze: restart from inSec if held at sync endpoint.
              let initPos = txDecision.sourceTimeSec!
              if (justDisabledInSnap && !txDecision.loopsNaturally && inVid.currentTime >= inOut - 0.05) {
                initPos = inIn
              }
              inVid.currentTime  = initPos
              inVid.playbackRate = 1
              freeRunAnchorRef.current.set(inKey, scrubGen)
            } else if (inVid.currentTime < inIn) {
              inVid.currentTime = inIn
            } else if (inVid.currentTime >= inOut) {
              if (txDecision.loopsNaturally) {
                inVid.currentTime = inIn
              } else if (!inVid.paused) {
                inVid.pause()
              }
            }
            const atNonLoopBoundary = !txDecision.loopsNaturally && inVid.currentTime >= inOut
            if (!atNonLoopBoundary) {
              if (isPlayingRef.current) {
                inVid.playbackRate = 1
                if (inVid.paused) inVid.play().catch(() => {})
              } else {
                if (!inVid.paused) inVid.pause()
              }
            }
          }
        }
      }

      // Null out mediaEl when the active native non-loop clip has expired so all
      // downstream drawImage calls are skipped — no stale last frame is rendered.
      const mediaEl = bgVideoExpired ? null : mediaElRef.current

      // ── Color grade snapshots for this frame ──────────────────────────────
      // The active background source uses its own clip grade (timeline mode).
      // Deck media has no per-source grade in Phase 1 (undefined → neutral).
      const cgBypass = colorGradePreviewBypassRef.current
      const masterDimmer = masterDimmerRef.current
      const activeClipGrade = timelineEnabledRef.current
        ? activeClipRef.current?.colorGrade
        : undefined

      const role        = activeMediaRoleRef.current
      const renderMedia = shouldRenderRoleByDefault(role)
      const fitMode     = activeMediaFitModeRef.current ?? getDefaultFitModeForRole(role)
      const compositeOp = getCompositeOpForRole(role)
      const clipMediaScale    = activeClipRef.current?.mediaScale ?? 1
      const clipEnableGlobalFx = activeClipRef.current?.enableGlobalFx
      const bgGlobalFxOn = resolveClipGlobalFx(clipEnableGlobalFx, role)
      const scale = shouldApplyScalePulse(role, clipEnableGlobalFx)
        ? clipMediaScale * bassReact * punchScale * activeLogoScale
        : clipMediaScale
      const { ox, oy, sw, sh } = mediaEl
        ? computeDrawRect(W, H, mediaEl, fitMode, scale, role)
        : { ox: 0, oy: 0, sw: W, sh: H }

      let shakeApplied = false
      if (audioOn && fxSet.has('Camera Shake') && mEff.cameraShake > 0) {
        const { dx, dy } = getCameraShakeOffset(shakeAmountRef, smoothBass, beatHit, mEff.cameraShake)
        if (Math.abs(dx) + Math.abs(dy) > 0.1) {
          ctx.save()
          ctx.translate(Math.round(dx), Math.round(dy))
          shakeApplied = true
        }
      }

      for (const mod of getEffectsForPhase('preMedia')) {
        const intensity = resolveEffectIntensity(mod, fxSet, mEff, globalActiveRegions)
        if (intensity <= 0) continue
        mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
      }

      if (mediaEl && renderMedia) {
        if (fxSet.has('Tunnel') && eff.tunnelSpeed > 0) {
          const tp = resolveTunnelParams(effectParamsRef.current)
          ctx.save()
          const tunnelT     = synced ? beatPhase * beatMs * eff.tunnelSpeed : t * eff.tunnelSpeed
          const tunnelDepth = (1 + smoothBass * (bassReactEnabled ? eff.bassReactivity : 0) * 0.45) * tp.depth
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

        // ── GPU compositor path ───────────────────────────────────────────
        // When WebGL2 is active, video draw + RGB Split + Bloom + grain/scanlines
        // are handed off to the GPU compositor. During transitions each source is
        // rendered through the GPU into persistent canvases (txOutCanvasRef /
        // txInCanvasRef) before being forwarded to the Canvas 2D transition
        // compositor — no per-frame allocation, no double-application of effects.
        // Displacement and all post-media effects still run on the Canvas 2D ctx.
        const gl2   = gl2RendererRef.current
        const isGpu = rendererTypeRef.current === 'webgl2' && gl2 !== null
                      && !contextLostRef.current
        gpuEffectsRef.current = []  // repopulated by GPU path each frame

        // ── Source snapshot: one video draw shared by all multi-pass effects ──
        // RGB Split, Bloom, and Displacement each used to draw the video element
        // directly at full output resolution. At 2× DPR that was 4 expensive video
        // texture uploads per frame.  Instead: draw mediaEl once into srcSnapRef
        // (an alpha-enabled W×H canvas), then reuse the GPU-resident canvas texture
        // for all subsequent effect passes.  Direct video element draws drop from N
        // to 1 whenever any of these effects are active simultaneously.
        // Skipped when GPU path is active — GPU compositor handles this internally.
        const needsSnap =
          bgGlobalFxOn && !isGpu && (
            (fxSet.has('RGB Split')    && mEff.rgbSplit  > 0) ||
            (fxSet.has('Bloom')        && bloomMod        > 0) ||
            (fxSet.has('Displacement') && dispMod         > 0)
          )
        // Canvas 2D color grade filter for this source. Baked into the snapshot
        // (so RGB Split / Bloom / Displacement build on the graded base) and
        // applied to the direct-draw path. 'none' when neutral / bypassed / GPU.
        const canvasGradeFilter = isGpu ? 'none' : buildCanvasColorGradeFilter(activeClipGrade, cgBypass)

        let srcSnap: HTMLCanvasElement | null = null
        if (needsSnap) {
          srcSnap = ensureHelperCanvas(srcSnapRef, W, H)
          const snapCtx = srcSnap.getContext('2d')
          if (snapCtx) {
            snapCtx.clearRect(0, 0, W, H)
            snapCtx.save()
            snapCtx.filter = canvasGradeFilter   // bake grade BEFORE downstream effects
            snapCtx.drawImage(mediaEl, ox, oy, sw, sh)   // sole video draw for this frame
            snapCtx.restore()
          }
          if (import.meta.env.DEV) devSrcDrawsRef.current++
        }

        if (bgGlobalFxOn && !isGpu && fxSet.has('RGB Split') && mEff.rgbSplit > 0) {
          const shift = mEff.rgbSplit * 14
          ctx.save()
          ctx.globalCompositeOperation = 'screen'
          ctx.globalAlpha = 0.65
          // Draw from srcSnap (canvas GPU blit) instead of mediaEl (video texture upload)
          const splitSrc = srcSnap ?? mediaEl
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
          ctx.drawImage(splitSrc, srcSnap ? -shift : ox - shift, srcSnap ? 0 : oy, srcSnap ? W : sw, srcSnap ? H : sh)
          ctx.filter = 'sepia(1) saturate(5) hue-rotate(200deg)'
          ctx.drawImage(splitSrc, srcSnap ?  shift : ox + shift, srcSnap ? 0 : oy, srcSnap ? W : sw, srcSnap ? H : sh)
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = 1
          ctx.filter = 'none'
          ctx.restore()
          if (import.meta.env.DEV) devEffPassRef.current += 2
        }

        {
          const txState = transitionStateRef.current
          // Null out inEl when the incoming native non-loop clip has expired.
          const inEl    = txInExpired ? null : incomingMediaElRef.current

          const inRole        = incomingRoleRef.current
          const inFitMode     = incomingFitModeRef.current ?? getDefaultFitModeForRole(inRole)
          const inClipMediaScale    = txState ? ((txState.incomingClip as VzTimelineMediaClip).mediaScale ?? 1) : 1
          const inClipEnableGlobalFx = txState ? (txState.incomingClip as VzTimelineMediaClip).enableGlobalFx : undefined
          const inScale       = shouldApplyScalePulse(inRole, inClipEnableGlobalFx) ? inClipMediaScale * bassReact * punchScale * activeLogoScale : inClipMediaScale
          const inRect        = inEl ? computeDrawRect(W, H, inEl, inFitMode, inScale, inRole)
                                     : { ox: 0, oy: 0, sw: W, sh: H }
          const inCompositeOp = getCompositeOpForRole(inRole)

          if (txState && txState.config.type !== 'cut') {
            if (isGpu) {
              const ep         = effectParamsRef.current
              const ppParams   = derivePostProcessParams(fxSet, mEff, q)
              const dispParams = deriveDisplacementParams(fxSet, dispMod, synced, beatPhase, t, activeColorShift)
              const pdParams   = derivePixelDistortionParams(fxSet, mEff, ep, activeBands.beat)
              const bloomExtra = deriveBloomGpuParams(ep)
              const fbParams   = deriveFeedbackParams(fxSet, feedbackMod, ep)
              const nwParams   = deriveNoiseWarpParams(fxSet, dispMod, ep)
              const sharedGpu = {
                canvasW: W, canvasH: H,
                rgbShiftPx:  fxSet.has('RGB Split') ? mEff.rgbSplit * 14 : 0,
                bloomBlurPx: (fxSet.has('Bloom') && bloomMod > 0) ? bloomMod * q.bloomBlur : 0,
                bloomAmount: bloomMod,
                bgR: 9 / 255, bgG: 13 / 255, bgB: 15 / 255,
                grainAmount: ppParams.grainAmount,
                scanAlpha:   ppParams.scanAlpha,
                scanStep:    ppParams.scanStep,
                ...dispParams,
                ...pdParams,
                ...bloomExtra,
                ...fbParams,
                ...nwParams,
              }

              // Per-source grades: outgoing = active clip's grade, incoming = its own.
              const outGrade = deriveColorGradeParams(activeClipGrade, cgBypass)
              const inGrade  = deriveColorGradeParams((txState.incomingClip as VzTimelineMediaClip).colorGrade, cgBypass)

              if (GPU_TRANSITION_TYPES.has(txState.config.type)) {
                // Full GPU path: both sources rendered + composited entirely on GPU.
                // No intermediate Canvas 2D copies — the transition shader runs
                // from txOutFBO + txInFBO directly to the output canvas.
                const easedProgress = getEasedProgress(txState.progress, txState.config.easing)
                const txParams: RenderTransitionParams = {
                  ...sharedGpu,
                  outEl: mediaEl, outOx: ox, outOy: oy, outSw: sw, outSh: sh,
                  inEl,
                  inOx: inRect.ox, inOy: inRect.oy, inSw: inRect.sw, inSh: inRect.sh,
                  transitionType: getGpuTransitionIndex(txState.config.type),
                  progress: easedProgress,
                  outGrade, inGrade,
                  // Master dimmer is applied once at frame end on the Canvas 2D
                  // output so it also covers overlays / lyrics / HUD.
                }
                gl2!.renderTransition(txParams)
                ctx.drawImage(gl2!.outputCanvas, 0, 0)
              } else {
                // Canvas 2D fallback for transition types not yet in GPU_TRANSITION_TYPES.
                // Each source is still rendered through the GPU pipeline to apply
                // effects, then copied to a canvas for Canvas 2D compositing.
                // Master dimmer is applied to the final Canvas 2D composite below,
                // not per-source, so it isn't passed to these intermediate renders.
                const outGpu = ensureHelperCanvas(txOutCanvasRef, W, H)
                gl2!.setColorGrade(outGrade)
                gl2!.renderFrame({ mediaEl, ox, oy, sw, sh, ...sharedGpu })
                outGpu.getContext('2d')!.drawImage(gl2!.outputCanvas, 0, 0)

                let inGpu: HTMLCanvasElement | null = null
                if (inEl) {
                  inGpu = ensureHelperCanvas(txInCanvasRef, W, H)
                  gl2!.setColorGrade(inGrade)
                  gl2!.renderFrame({ mediaEl: inEl, ox: inRect.ox, oy: inRect.oy, sw: inRect.sw, sh: inRect.sh, ...sharedGpu })
                  inGpu.getContext('2d')!.drawImage(gl2!.outputCanvas, 0, 0)
                }

                renderTimelineTransition({
                  ctx, W, H,
                  outEl: outGpu, outRect: { ox: 0, oy: 0, sw: W, sh: H }, outCompositeOp: compositeOp,
                  inEl: inGpu,   inRect:  { ox: 0, oy: 0, sw: W, sh: H }, inCompositeOp,
                  config: txState.config, progress: txState.progress, time: t,
                  colorShift: activeColorShift, bass: activeBands.bass, beat: activeBands.beat,
                })
              }

              const gpuFx: string[] = []
              if (fxSet.has('RGB Split')        && mEff.rgbSplit          > 0) gpuFx.push('RGB Split')
              if (fxSet.has('Bloom')            && bloomMod               > 0) gpuFx.push('Bloom')
              if (ppParams.grainAmount          > 0) gpuFx.push('Noise Fog')
              if (ppParams.scanAlpha            > 0) gpuFx.push('Scanlines')
              if (dispParams.dispAmount         > 0) gpuFx.push('Displacement')
              if (pdParams.pixelDistortAmount   > 0) gpuFx.push('Pixel Distortion')
              if (fbParams.feedbackDecay        > 0) gpuFx.push('Feedback')
              if (nwParams.noiseWarpAmount      > 0) gpuFx.push('Noise Warp')
              gpuEffectsRef.current = gpuFx
              if (import.meta.env.DEV) devSrcDrawsRef.current += inEl ? 2 : 1
            } else {
              // Canvas-only transition path.
              // Pre-grade each source into a full-canvas scratch buffer so the
              // per-clip grade is applied BEFORE the transition compositor runs.
              const outFilter = buildCanvasColorGradeFilter(activeClipGrade, cgBypass)
              const inFilter  = buildCanvasColorGradeFilter((txState.incomingClip as VzTimelineMediaClip).colorGrade, cgBypass)

              let outSrc: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement = mediaEl
              let outDrawRect = { ox, oy, sw, sh }
              if (outFilter !== 'none') {
                const cg = ensureHelperCanvas(cgOutCanvasRef, W, H)
                const cgCtx = cg.getContext('2d')
                if (cgCtx) {
                  cgCtx.clearRect(0, 0, W, H)
                  cgCtx.save()
                  cgCtx.filter = outFilter
                  cgCtx.drawImage(mediaEl, ox, oy, sw, sh)
                  cgCtx.restore()
                  outSrc = cg
                  outDrawRect = { ox: 0, oy: 0, sw: W, sh: H }
                }
              }

              let inSrc = inEl
              let inDrawRect = inRect
              if (inEl && inFilter !== 'none') {
                const cg = ensureHelperCanvas(cgInCanvasRef, W, H)
                const cgCtx = cg.getContext('2d')
                if (cgCtx) {
                  cgCtx.clearRect(0, 0, W, H)
                  cgCtx.save()
                  cgCtx.filter = inFilter
                  cgCtx.drawImage(inEl, inRect.ox, inRect.oy, inRect.sw, inRect.sh)
                  cgCtx.restore()
                  inSrc = cg as unknown as HTMLImageElement | HTMLVideoElement
                  inDrawRect = { ox: 0, oy: 0, sw: W, sh: H }
                }
              }

              renderTimelineTransition({
                ctx, W, H,
                outEl:          outSrc,
                outRect:        outDrawRect,
                outCompositeOp: compositeOp,
                inEl:           inSrc,
                inRect:         inDrawRect,
                inCompositeOp,
                config:         txState.config,
                progress:       txState.progress,
                time:           t,
                colorShift:     activeColorShift,
                bass:           activeBands.bass,
                beat:           activeBands.beat,
              })
              if (import.meta.env.DEV) devSrcDrawsRef.current += 2  // out + in
            }
          } else if (isGpu) {
            // GPU compositor: color grade + video draw + RGB Split + Bloom + grain/scanlines + Displacement + new effects
            const ep         = effectParamsRef.current
            const ppParams   = derivePostProcessParams(fxSet, mEff, q)
            const dispParams = deriveDisplacementParams(fxSet, dispMod, synced, beatPhase, t, activeColorShift)
            const pdParams   = derivePixelDistortionParams(fxSet, mEff, ep, activeBands.beat)
            const bloomExtra = deriveBloomGpuParams(ep)
            const fbParams   = deriveFeedbackParams(fxSet, feedbackMod, ep)
            const nwParams   = deriveNoiseWarpParams(fxSet, dispMod, ep)
            gl2!.setColorGrade(deriveColorGradeParams(activeClipGrade, cgBypass))
            gl2!.renderFrame({
              mediaEl,
              canvasW: W, canvasH: H,
              ox, oy, sw, sh,
              rgbShiftPx:  bgGlobalFxOn && fxSet.has('RGB Split') ? mEff.rgbSplit * 14 : 0,
              bloomBlurPx: bgGlobalFxOn && fxSet.has('Bloom') && bloomMod > 0 ? bloomMod * q.bloomBlur : 0,
              bloomAmount: bgGlobalFxOn ? bloomMod : 0,
              bgR: 9 / 255, bgG: 13 / 255, bgB: 15 / 255,
              grainAmount: ppParams.grainAmount,
              scanAlpha:   ppParams.scanAlpha,
              scanStep:    ppParams.scanStep,
              ...(bgGlobalFxOn ? dispParams : { dispOffXPx: 0, dispOffYPx: 0, dispAmount: 0, dispHueRad: 0 }),
              ...pdParams,
              ...bloomExtra,
              ...fbParams,
              ...nwParams,
            })
            {
              const seTxIn  = clipTxInStateRef.current
              const seTxOut = clipTxOutStateRef.current
              const seTx    = seTxIn ?? seTxOut
              if (seTx) {
                // GPU output baked to helper canvas so single-element renderer can read it
                const gpuBuf = ensureHelperCanvas(txOutCanvasRef, W, H)
                gpuBuf.getContext('2d')!.drawImage(gl2!.outputCanvas, 0, 0)
                renderSingleElementTransition({
                  ctx, W, H, el: gpuBuf,
                  rect: { ox: 0, oy: 0, sw: W, sh: H },
                  state: seTx, time: t, colorShift: 0,
                  bass: activeBands.bass, beat: activeBands.beat,
                  compositeOp, baseOpacity: 1,
                })
              } else {
                ctx.drawImage(gl2!.outputCanvas, 0, 0)
              }
            }
            const gpuFx: string[] = []
            if (fxSet.has('RGB Split')        && mEff.rgbSplit          > 0) gpuFx.push('RGB Split')
            if (fxSet.has('Bloom')            && bloomMod               > 0) gpuFx.push('Bloom')
            if (ppParams.grainAmount          > 0) gpuFx.push('Noise Fog')
            if (ppParams.scanAlpha            > 0) gpuFx.push('Scanlines')
            if (dispParams.dispAmount         > 0) gpuFx.push('Displacement')
            if (pdParams.pixelDistortAmount   > 0) gpuFx.push('Pixel Distortion')
            if (fbParams.feedbackDecay        > 0) gpuFx.push('Feedback')
            if (nwParams.noiseWarpAmount      > 0) gpuFx.push('Noise Warp')
            gpuEffectsRef.current = gpuFx
          } else {
            const seTxIn  = clipTxInStateRef.current
            const seTxOut = clipTxOutStateRef.current
            const seTx    = seTxIn ?? seTxOut
            const bgColorShift = bgGlobalFxOn ? activeColorShift : 0
            if (seTx) {
              // Pre-bake grade+colorShift to a helper canvas, then route through
              // the single-element transition renderer.
              const cgBuf    = ensureHelperCanvas(cgOutCanvasRef, W, H)
              const cgBufCtx = cgBuf.getContext('2d')!
              cgBufCtx.clearRect(0, 0, W, H)
              cgBufCtx.save()
              const shiftPart = bgColorShift > 0 ? `hue-rotate(${bgColorShift * 360}deg)` : ''
              const gradePart = canvasGradeFilter !== 'none' ? canvasGradeFilter : ''
              const combined  = [gradePart, shiftPart].filter(Boolean).join(' ')
              if (combined) cgBufCtx.filter = combined
              if (srcSnap) {
                cgBufCtx.drawImage(srcSnap, 0, 0)
              } else {
                cgBufCtx.drawImage(mediaEl, ox, oy, sw, sh)
              }
              cgBufCtx.filter = 'none'
              cgBufCtx.restore()
              renderSingleElementTransition({
                ctx, W, H, el: cgBuf,
                rect: { ox: 0, oy: 0, sw: W, sh: H },
                state: seTx, time: t, colorShift: 0,
                bass: activeBands.bass, beat: activeBands.beat,
                compositeOp, baseOpacity: 1,
              })
            } else {
              ctx.save()
              if (compositeOp !== 'source-over') ctx.globalCompositeOperation = compositeOp
              if (srcSnap) {
                // Reuse the snap (grade already baked in). Apply colorShift only.
                if (bgColorShift > 0) ctx.filter = `hue-rotate(${bgColorShift * 360}deg)`
                ctx.drawImage(srcSnap, 0, 0)
                if (import.meta.env.DEV) devEffPassRef.current++
              } else {
                // Direct draw: combine the color grade filter with colorShift hue-rotate.
                const shiftPart = bgColorShift > 0 ? `hue-rotate(${bgColorShift * 360}deg)` : ''
                const gradePart = canvasGradeFilter !== 'none' ? canvasGradeFilter : ''
                const combined  = [gradePart, shiftPart].filter(Boolean).join(' ')
                if (combined) ctx.filter = combined
                ctx.drawImage(mediaEl, ox, oy, sw, sh)
                if (import.meta.env.DEV) devSrcDrawsRef.current++
              }
              ctx.filter = 'none'
              ctx.globalCompositeOperation = 'source-over'
              ctx.restore()
            }
          }
        }

        if (bgGlobalFxOn && !isGpu && fxSet.has('Bloom') && bloomMod > 0) {
          const blurPx = Math.round(bloomMod * q.bloomBlur)
          if (blurPx > 0) {
            // Reduced-resolution bloom: downsample srcSnap to W/2 × H/2, blur there
            // (4× fewer pixels), then composite the upscaled blurry result.
            // blur(R/2) at half-res produces the same visual spread as blur(R) at full res.
            const bW = Math.ceil(W / 2)
            const bH = Math.ceil(H / 2)
            const bloomBuf = ensureHelperCanvas(bloomBufRef, bW, bH)
            const bloomCtx = bloomBuf.getContext('2d')
            const drawSrc  = srcSnap ?? mediaEl
            if (bloomCtx) {
              bloomCtx.clearRect(0, 0, bW, bH)
              bloomCtx.filter = `blur(${Math.max(1, Math.round(blurPx / 2))}px)`
              if (srcSnap) {
                bloomCtx.drawImage(srcSnap, 0, 0, bW, bH)
              } else {
                bloomCtx.drawImage(drawSrc as HTMLImageElement | HTMLVideoElement, ox / 2, oy / 2, sw / 2, sh / 2)
              }
              bloomCtx.filter = 'none'
            }
            ctx.save()
            ctx.globalAlpha = bloomMod * 0.45
            ctx.globalCompositeOperation = 'screen'
            ctx.drawImage(bloomBuf, ox - 2, oy - 2, sw + 4, sh + 4)
            ctx.globalAlpha = 1
            ctx.globalCompositeOperation = 'source-over'
            ctx.restore()
            if (import.meta.env.DEV) devEffPassRef.current += 2  // downsample + composite
          }
        }

        // GPU handles Displacement in Stage 5 of renderFrame when isGpu is true.
        // Canvas path runs only in Canvas 2D mode (isGpu=false).
        if (bgGlobalFxOn && !isGpu && fxSet.has('Displacement') && dispMod > 0) {
          const dispAngle = synced ? beatPhase * Math.PI * 2 : t * 0.002
          const offX = Math.sin(dispAngle) * dispMod * 12
          const offY = Math.cos(synced ? beatPhase * Math.PI * 2 : t * 0.0017) * dispMod * 8
          ctx.save()
          ctx.globalAlpha = 0.35 * dispMod
          ctx.globalCompositeOperation = 'screen'
          if (activeColorShift > 0) ctx.filter = `hue-rotate(${activeColorShift * 360 + 90}deg)`
          const { src: dispSrc, fullFrame: dispFull } = selectPostProcessSource(
            srcSnap, false, null, mediaEl,
          )
          if (dispSrc) {
            if (dispFull) {
              ctx.drawImage(dispSrc, offX, offY)
              if (import.meta.env.DEV) devEffPassRef.current++
            } else {
              ctx.drawImage(dispSrc, ox + offX, oy + offY, sw, sh)
              if (import.meta.env.DEV) devSrcDrawsRef.current++
            }
          }
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
      } else if (reactModeRef.current && reactPresetRef.current) {
        renderReactEngine(
          ctx,
          reactFrameFromVz(frameCtx),
          reactPresetRef.current,
          reactParamsRef.current ?? DEFAULT_REACT_RENDER_PARAMS,
          reactSectionsRef.current,
        )
      } else if (isPlayingRef.current || activeBands.volume > 0.01) {
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

      // ── Bg clip targeted effects (full-canvas post-bg pass) ───────────────────
      if (clipActiveRegions.length > 0 && activeClipIdRef.current) {
        const bgClipId = activeClipIdRef.current
        for (const region of clipActiveRegions) {
          if (!region.targetIds?.includes(bgClipId)) continue
          // Only apply if this is a bg clip (overlay clips use offscreen rendering below)
          if (timelineOverlayClipsRef.current.some(oc => oc.id === bgClipId)) continue
          const mod = getEffectModule(region.effectId)
          if (!mod) continue
          const intensity = region.intensity ?? (mEff as unknown as Record<string, number>)[mod.effectKey] ?? 0
          if (intensity <= 0) continue
          mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
        }
      }

      // ── Overlay layer compositor ──────────────────────────────────────────────
      {
        const pool = mediaPoolRef.current
        for (const { item, layerConfig, media } of layerRenderPlanRef.current) {
          const layerKey = `layer:${item.id}`
          let el = pool.get(layerKey)
          if (!el) {
            el = getOrCreateMediaInstance(pool, layerKey, media, { loop: true })
            if (el instanceof HTMLVideoElement && isPlayingRef.current) el.play().catch(() => {})
          }

          if (el instanceof HTMLVideoElement) {
            if (isPlayingRef.current && el.paused)   el.play().catch(() => {})
            if (!isPlayingRef.current && !el.paused) el.pause()
          }

          const { w, h } = computeLayerItemDrawSize(W, H, el, item.fitMode)
          const { ox, oy } = getLayerItemAnchorOffset(item.anchor, w, h)
          const itemGlobalFx = item.enableGlobalFx !== undefined ? item.enableGlobalFx : item.audioReactive
          const audioScale = itemGlobalFx ? bassReact * punchScale * activeLogoScale : 1
          const totalScale = item.scale * audioScale

          // Collect targeted effects for this item (by layer or by item id)
          const itemFxLayer = collectTargetedEffects(layerActiveRegions, item.layerId, mEff)
          const itemFxItem  = collectTargetedEffects(layerItemActiveRegions, item.id, mEff)
          const itemFx = [...itemFxLayer, ...itemFxItem].filter(x => x.intensity > 0)

          // Per-item color grade (Canvas 2D filter — temperature/tint are GPU-only
          // and intentionally not represented for layer items in Phase 1).
          const itemGradeFilter = buildCanvasColorGradeFilter(item.colorGrade, cgBypass)

          if (itemFx.length > 0) {
            // Offscreen path: render item to offscreen, apply effects, blit to main
            const off = targetEffectOffscreenRef.current.acquire(`li_${item.id}`, W, H)
            const offCtx = off.getContext('2d')!
            offCtx.clearRect(0, 0, W, H)
            offCtx.save()
            offCtx.translate(item.x * W, item.y * H)
            if (item.rotation !== 0) offCtx.rotate(item.rotation * Math.PI / 180)
            if (totalScale !== 1)    offCtx.scale(totalScale, totalScale)
            offCtx.filter = itemGradeFilter   // grade baked BEFORE targeted effects
            offCtx.drawImage(el, ox, oy, w, h)
            offCtx.restore()
            for (const { mod, intensity } of itemFx) {
              mod!.draw(offCtx, frameCtx, { ...mod!.defaultParams, amount: intensity })
            }
            const itemColorShift = itemGlobalFx ? activeColorShift : 0
            ctx.save()
            ctx.globalAlpha = layerConfig.opacity * item.opacity
            if (item.blendMode !== 'source-over') ctx.globalCompositeOperation = item.blendMode
            if (itemColorShift > 0) ctx.filter = `hue-rotate(${itemColorShift * 360}deg)`
            ctx.drawImage(off, 0, 0)
            ctx.filter = 'none'
            ctx.globalCompositeOperation = 'source-over'
            ctx.globalAlpha = 1
            ctx.restore()
          } else {
            const itemColorShift = itemGlobalFx ? activeColorShift : 0
            ctx.save()
            ctx.globalAlpha = layerConfig.opacity * item.opacity
            if (item.blendMode !== 'source-over') ctx.globalCompositeOperation = item.blendMode
            // Combine the item color grade with the global colorShift hue-rotate.
            const shiftPart = itemColorShift > 0 ? `hue-rotate(${itemColorShift * 360}deg)` : ''
            const gradePart = itemGradeFilter !== 'none' ? itemGradeFilter : ''
            const combined  = [gradePart, shiftPart].filter(Boolean).join(' ')
            if (combined) ctx.filter = combined
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
      }

      // ── Timeline overlay clips (Phase 1B) ────────────────────────────────────
      // Active overlay clips are composited above the background and layer items.
      // Uses the same media pool as bg clips for zero-cost preload reuse.
      if (timelineEnabledRef.current && timelineOverlayClipsRef.current.length > 0) {
        const activeOverlays = getActiveOverlayClips(
          timelineOverlayClipsRef.current,
          timelineClockRef.current,
        )
        const pool = mediaPoolRef.current
        for (const oc of activeOverlays) {
          const m = mediaItemsRef.current.find(x => x.id === oc.mediaId)
          if (!m) continue

          const ovKey = `overlay:${oc.id}`
          const el = getOrCreateMediaInstance(pool, ovKey, m)

          // Expired flag: set true when a native non-loop overlay clip has ended;
          // causes the entire draw block below to be skipped via continue.
          let ovExpired = false

          if (el instanceof HTMLVideoElement) {
            const ovLocalTime   = timelineClockRef.current - oc.startSec
            const ovDur         = isFinite(el.duration) ? el.duration : 0
            el.loop             = false
            const ovSnapEnabled = isClipSnapToBpmEnabled(oc)

            // Detect ON→OFF transition so native playback is immediately re-initialized.
            const prevOvSnap         = previousSnapStateRef.current.get(ovKey)
            const justDisabledOvSnap = prevOvSnap === true && !ovSnapEnabled
            previousSnapStateRef.current.set(ovKey, ovSnapEnabled)

            if (ovSnapEnabled) {
              // SYNCED PATH — freeze logic only applies when synchronisation is active
              const frozen = shouldFreezeClipFrame(oc, ovLocalTime, ovDur)
              if (frozen) {
                if (!el.paused) el.pause()
              } else {
                const desired = getClipSourceTime(oc, ovLocalTime, ovDur)
                if (isPlayingRef.current) {
                  if (el.paused) el.play().catch(() => {})
                  syncVideoEl(el, desired, true)
                } else {
                  syncVideoEl(el, desired, false)
                  if (!el.paused) el.pause()
                }
              }
            } else {
              // FREE-RUNNING PATH — native speed, boundary detected via video.currentTime
              const ovDecision = getNativeVideoPlaybackDecision(oc, ovLocalTime, ovDur)
              const { inSec, outSec } = getClipSourceRange(oc, ovDur)
              const lastGen  = freeRunAnchorRef.current.get(ovKey) ?? -1
              const scrubGen = scrubGenRef.current

              if (lastGen === -1 || justDisabledOvSnap || scrubGen !== lastGen) {
                // Re-anchor: first activation, snap disable, or scrub.
                // ON→OFF on trim/freeze: restart from inSec if held at sync endpoint.
                let initPos = ovDecision.sourceTimeSec!
                if (justDisabledOvSnap && !ovDecision.loopsNaturally && el.currentTime >= outSec - 0.05) {
                  initPos = inSec
                }
                el.currentTime  = initPos
                el.playbackRate = 1
                freeRunAnchorRef.current.set(ovKey, scrubGen)
              } else if (el.currentTime < inSec) {
                el.currentTime = inSec
              } else if (el.currentTime >= outSec) {
                if (ovDecision.loopsNaturally) {
                  el.currentTime = inSec   // natural loop wrap
                } else if (!el.paused) {
                  el.pause()               // at source boundary: hold, keep drawing
                }
              }
              // Drive transport — no play() once non-loop clip reaches outSec
              const atNonLoopBoundary = !ovDecision.loopsNaturally && el.currentTime >= outSec
              if (!atNonLoopBoundary) {
                if (isPlayingRef.current) {
                  el.playbackRate = 1
                  if (el.paused) el.play().catch(() => {})
                } else {
                  if (!el.paused) el.pause()
                }
              }
            }
          }

          // Skip all drawing for this overlay when it is natively expired.
          if (ovExpired) continue

          const cfg = oc.compositingConfig ?? DEFAULT_OVERLAY_COMPOSITING
          const { ox, oy, sw, sh } = computeDrawRect(W, H, el, cfg.fitMode, cfg.scale, m.mediaRole ?? null)

          // Collect targeted effects for this overlay clip
          const ocFx = collectTargetedEffects(clipActiveRegions, oc.id, mEff).filter(x => x.intensity > 0)

          // Per-overlay color grade (Canvas 2D filter; temperature/tint GPU-only).
          const ocGradeFilter = buildCanvasColorGradeFilter(oc.colorGrade, cgBypass)
          const ocGlobalFx    = resolveClipGlobalFx(oc.enableGlobalFx, m.mediaRole ?? null)
          const ocColorShift  = ocGlobalFx ? activeColorShift : 0

          // Per-clip single-element transitions for overlay clips
          const ocTxIn  = getClipTransitionInState(oc,  timelineClockRef.current)
          const ocTxOut = getClipTransitionOutState(oc, timelineClockRef.current)
          const ocTx    = ocTxIn ?? ocTxOut

          if (ocTx || ocFx.length > 0) {
            // Offscreen path: render overlay to offscreen canvas, then composite
            const off = targetEffectOffscreenRef.current.acquire(`oc_${oc.id}`, W, H)
            const offCtx = off.getContext('2d')!
            offCtx.clearRect(0, 0, W, H)
            offCtx.save()
            offCtx.filter = ocGradeFilter   // grade baked BEFORE effects/transitions
            if (cfg.rotation !== 0 || cfg.posX !== 0.5 || cfg.posY !== 0.5) {
              const ocx = cfg.posX * W
              const ocy = cfg.posY * H
              offCtx.translate(ocx, ocy)
              if (cfg.rotation !== 0) offCtx.rotate(cfg.rotation * Math.PI / 180)
              offCtx.drawImage(el, ox - W / 2, oy - H / 2, sw, sh)
            } else {
              offCtx.drawImage(el, ox, oy, sw, sh)
            }
            offCtx.restore()
            for (const { mod, intensity } of ocFx) {
              mod!.draw(offCtx, frameCtx, { ...mod!.defaultParams, amount: intensity })
            }
            if (ocTx) {
              renderSingleElementTransition({
                ctx, W, H, el: off,
                rect: { ox: 0, oy: 0, sw: W, sh: H },
                state: ocTx, time: t, colorShift: ocColorShift,
                bass: activeBands.bass, beat: activeBands.beat,
                compositeOp: cfg.blendMode as GlobalCompositeOperation,
                baseOpacity: cfg.opacity,
              })
            } else {
              ctx.save()
              ctx.globalAlpha              = cfg.opacity
              ctx.globalCompositeOperation = cfg.blendMode as GlobalCompositeOperation
              ctx.drawImage(off, 0, 0)
              ctx.restore()
            }
          } else {
            ctx.save()
            ctx.globalAlpha              = cfg.opacity
            ctx.globalCompositeOperation = cfg.blendMode as GlobalCompositeOperation
            const ocFilter = ocGradeFilter !== 'none' || ocColorShift > 0
              ? [ocGradeFilter !== 'none' ? ocGradeFilter : '', ocColorShift > 0 ? `hue-rotate(${ocColorShift * 360}deg)` : ''].filter(Boolean).join(' ')
              : 'none'
            if (ocFilter !== 'none') ctx.filter = ocFilter
            if (cfg.rotation !== 0 || cfg.posX !== 0.5 || cfg.posY !== 0.5) {
              const ocx = cfg.posX * W
              const ocy = cfg.posY * H
              ctx.translate(ocx, ocy)
              if (cfg.rotation !== 0) ctx.rotate(cfg.rotation * Math.PI / 180)
              ctx.drawImage(el, ox - W / 2, oy - H / 2, sw, sh)
            } else {
              ctx.drawImage(el, ox, oy, sw, sh)
            }
            ctx.filter = 'none'
            ctx.restore()
          }
        }
      }

      // Evict targeted-effect canvases for items no longer active this frame.
      targetEffectOffscreenRef.current.endFrame()

      // ── Pause non-active pool instances every frame ────────────────────────
      {
        const activeKeys = new Set<string>()
        if (activeClipIdRef.current) activeKeys.add(`background:${activeClipIdRef.current}`)
        if (transitionStateRef.current) {
          activeKeys.add(`background:${transitionStateRef.current.incomingClip.id}`)
        }
        if (timelineEnabledRef.current) {
          for (const oc of getActiveOverlayClips(timelineOverlayClipsRef.current, timelineClockRef.current)) {
            activeKeys.add(`overlay:${oc.id}`)
          }
        }
        for (const { item } of layerRenderPlanRef.current) activeKeys.add(`layer:${item.id}`)
        pauseInactiveMediaInstances(mediaPoolRef.current, activeKeys)
      }

      for (const mod of getEffectsForPhase('postMedia')) {
        const intensity = resolveEffectIntensity(mod, fxSet, mEff, globalActiveRegions)
        if (intensity <= 0) continue
        mod.draw(ctx, frameCtx, { ...mod.defaultParams, amount: intensity })
      }

      if (shakeApplied) ctx.restore()

      // Skip master-phase modules that the GPU compositor already rendered this frame.
      // gpuEffectsRef is populated by the GPU path above (or stays empty in Canvas 2D mode).
      const gpuHandledFx = new Set(gpuEffectsRef.current)
      for (const mod of getEffectsForPhase('master')) {
        const intensity = resolveEffectIntensity(mod, fxSet, mEff, globalActiveRegions)
        if (intensity <= 0) continue
        if (gpuHandledFx.has(mod.chainName)) continue
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
      if (
        lyricsEnabledRef.current &&
        lyricPlayback.activeCue &&
        lyricPlayback.effectiveCueStartMs !== null &&
        lyricPlayback.effectiveCueEndMs !== null
      ) {
        drawLyricCue(
          ctx,
          lyricPlayback.activeCue,
          lyricPlayback.currentAudioMs,
          lyricPlayback.effectiveCueStartMs,
          lyricPlayback.effectiveCueEndMs,
          lyricsDocRef.current,
          W,
          H,
          dpr,
        )
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

      if (an && buf && activeBands.volume > 0.05) {
        const barW = 3 * dpr, gap = 1 * dpr
        const barColors = ['#4ac7db','#61d6aa','#b84fc9','#d8b95a']
        const barVals   = [bass, activeBands.lowMid, high, activeBands.volume]
        barVals.forEach((v, i) => {
          const bh = Math.max(2, v * 30 * dpr)
          const bx = W - margin - (barVals.length - i) * (barW + gap)
          ctx.fillStyle = barColors[i] + '88'
          ctx.fillRect(bx, H - margin - bh, barW, bh)
        })
      }

      // ── Master Dimmer ──────────────────────────────────────────────────
      // Global output dimmer applied at the very end so it covers the full
      // composite (background, layers, overlays, lyrics, HUD). Black overlay
      // at alpha = masterDimmer. Skipped when 0.
      if (masterDimmer > 0) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = Math.min(1, masterDimmer)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }

      // ── Paused-idle: stop rAF when nothing will visibly change ──────────
      // When paused and no continuous animation, rVFC won't fire and nothing
      // moves — halt the RAF loop entirely.  requestRedrawRef.current() restarts
      // it on any state change (play, seek, effect toggle, media change, etc.).
      if (!isPlayingRef.current && !hasContinuousAnim()) {
        animRef.current = 0   // mark loop as stopped (requestRedraw checks this)
        return
      }
      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(animRef.current)
      // Cancel any outstanding rVFC registration
      if (vfcVideoRef.current && vfcIdRef.current) {
        vfcVideoRef.current.cancelVideoFrameCallback(vfcIdRef.current)
        vfcIdRef.current = 0
      }
      ro.disconnect()
      targetEffectOffscreenRef.current.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (import.meta.env.DEV) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const id = setInterval(() => {
        // Video frame scheduler diagnostics
        const draws    = totalCanvasDrawRef.current
        const skipped  = skippedDrawRef.current
        const vfcFires = vfcPresentedRef.current
        const total    = draws + skipped
        if (total > 0) {
          const ratio = total > 0 ? ((draws / total) * 100).toFixed(1) : '—'
          console.debug(
            `[LiveVisualCanvas] scheduler — draws: ${draws}  skipped: ${skipped}  (${ratio}% draw rate)` +
            (vfcFires > 0 ? `  vfc-fires: ${vfcFires}` : '  vfc: n/a')
          )
          totalCanvasDrawRef.current  = 0
          skippedDrawRef.current      = 0
          vfcPresentedRef.current     = 0
        }
        // Effect pipeline diagnostics
        const srcDraws  = devSrcDrawsRef.current
        const effPasses = devEffPassRef.current
        if (srcDraws > 0 || effPasses > 0) {
          const bW = bloomBufRef.current?.width  ?? 0
          const bH = bloomBufRef.current?.height ?? 0
          console.debug(
            `[LiveVisualCanvas] effects — src-video-draws: ${srcDraws}  canvas-effect-passes: ${effPasses}` +
            (bW > 0 ? `  bloom-buf: ${bW}×${bH}` : '')
          )
          devSrcDrawsRef.current  = 0
          devEffPassRef.current   = 0
        }
        // Buffer pool diagnostics
        const poolSize = targetEffectOffscreenRef.current.size
        if (poolSize > 0) {
          console.debug(`[LiveVisualCanvas] buffer pool — ${poolSize} targeted-effect canvas(es)`)
        }
        // Video seek diagnostics
        if (devSeekCountRef.current > 0 || devCorrModeRef.current !== 'none') {
          console.debug(
            `[LiveVisualCanvas] video sync — seeks/s: ${devSeekCountRef.current}`,
            `drift: ${(devLastDriftRef.current * 1000).toFixed(1)}ms`,
            `mode: ${devCorrModeRef.current}`,
          )
          devSeekCountRef.current = 0
        }
      }, 2000)
      return () => clearInterval(id)
    }, [])
  }

  return <canvas ref={canvasRef} className="vz-preview-canvas" />
}

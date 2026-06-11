import type { VzFrameContext } from '../../effects/types'
import type { ReactTrackSection, ReactSectionType, OscillatorSettings, OscillatorGlyphAsset } from '../ReactTypes'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'

// ── React frame context ───────────────────────────────────────────────────────
// A lighter version of VzFrameContext used by all React engine renderers.
// Can be built directly from an AnalyserNode or converted from VzFrameContext.

export interface ReactFrameContext {
  W: number
  H: number
  dpr: number
  /** Animation tick; counts up each frame regardless of playback. */
  t: number
  audioTime: number
  bpm: number
  beatPhase: number
  beatHit: boolean
  audio: {
    bass:   number  // 0–1
    mid:    number  // 0–1
    high:   number  // 0–1
    volume: number  // 0–1
  }
  freqData:       Uint8Array<ArrayBuffer> | null
  timeDomainData: Uint8Array<ArrayBuffer> | null
}

// ── Per-engine render params ──────────────────────────────────────────────────

export interface ReactRenderParams {
  intensity:       number  // 0–1 master intensity
  motion:          number  // 0–1 animation speed multiplier
  glow:            number  // 0–1 shadow/bloom amount
  bassReactivity:  number  // 0–1 how much bass drives visuals
  trailDecay:      number  // 0–1 trail fade speed (0=long, 1=instant)
  fogDensity:            number  // 0–1 fog/particle density
  particleDensity:       number  // 0–1 particle count scale
  oscillator:            OscillatorSettings
  oscillatorGlyphAssets: OscillatorGlyphAsset[]
}

export const DEFAULT_REACT_RENDER_PARAMS: ReactRenderParams = {
  intensity:       0.7,
  motion:          0.5,
  glow:            0.65,
  bassReactivity:  0.8,
  trailDecay:      0.08,
  fogDensity:            0.5,
  particleDensity:       0.5,
  oscillator:            DEFAULT_OSCILLATOR_SETTINGS,
  oscillatorGlyphAssets: [],
}

// ── VzFrameContext → ReactFrameContext conversion ────────────────────────────

export function reactFrameFromVz(vz: VzFrameContext): ReactFrameContext {
  return {
    W: vz.W, H: vz.H, dpr: vz.dpr,
    t:         vz.time,
    audioTime: vz.audioTime,
    bpm:       vz.bpm,
    beatPhase: vz.beatPhase,
    beatHit:   vz.beatHit,
    audio: {
      bass:   vz.audio.bass,
      mid:    (vz.audio.lowMid + vz.audio.mid) * 0.5,
      high:   vz.audio.high,
      volume: vz.audio.volume,
    },
    freqData:       vz.freqData,
    timeDomainData: vz.timeDomainData,
  }
}

// ── Math helpers ──────────────────────────────────────────────────────────────

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1.0) * 10000
  return x - Math.floor(x)
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) || 0
  const g = parseInt(h.slice(2, 4), 16) || 0
  const b = parseInt(h.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

// ── Section helpers ───────────────────────────────────────────────────────────

export function resolveSectionAtTime(
  sections: ReactTrackSection[],
  audioTime: number,
): ReactTrackSection | null {
  for (const s of sections) {
    if (audioTime >= s.startSec && audioTime < s.endSec) return s
  }
  return null
}

export function sectionIntensityMultiplier(type: ReactSectionType | null): number {
  switch (type) {
    case 'intro':     return 0.35
    case 'verse':     return 0.60
    case 'build':     return 0.78
    case 'drop':      return 1.00
    case 'breakdown': return 0.50
    case 'outro':     return 0.28
    default:          return 0.65
  }
}

export function getAudioEnergy(audio: ReactFrameContext['audio']): number {
  return clamp01(audio.bass * 0.5 + audio.mid * 0.3 + audio.high * 0.2)
}

// ── Canvas draw helpers ───────────────────────────────────────────────────────

export function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  color: string, glowRadius: number, alpha: number,
): void {
  if (r <= 0 || alpha <= 0) return
  ctx.save()
  ctx.globalAlpha    = alpha
  ctx.shadowColor    = color
  ctx.shadowBlur     = glowRadius
  ctx.fillStyle      = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawAdditiveLine(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  color: string,
  lineWidth: number,
  alpha: number,
  glow: number,
): void {
  if (points.length < 2 || alpha <= 0) return
  ctx.save()
  ctx.globalAlpha              = alpha
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle              = color
  ctx.lineWidth                = lineWidth
  ctx.shadowColor              = color
  ctx.shadowBlur               = glow
  ctx.lineCap                  = 'round'
  ctx.lineJoin                 = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
  ctx.stroke()
  ctx.restore()
}

// ── Offscreen trail canvas management ────────────────────────────────────────

export function getOrCreateOffscreen(
  map: WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>,
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
): HTMLCanvasElement {
  let c = map.get(ctx)
  if (!c) { c = document.createElement('canvas'); map.set(ctx, c) }
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  return c
}

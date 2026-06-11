import type { ReactPreset, ReactSectionType, OscillatorGlyphPoint, OscillatorSettings } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba, getOrCreateOffscreen, seededRandom } from './reactRenderUtils'
import { generateBuiltinShapePoints, clamp } from './oscillatorPathUtils'
import { textToGlyphPoints } from './textGlyphUtils'
// parseSvgToGlyphPoints is intentionally NOT imported here.
// SVG parsing happens at upload/select/resolution-change time in reactStore.ts.
// This renderer only reads pre-prepared points from params.oscillatorGlyphPointCache.

// ── Trail canvas pool (per ctx) ───────────────────────────────────────────────
const trailMap = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>()

function getTrail(ctx: CanvasRenderingContext2D, W: number, H: number): HTMLCanvasElement {
  return getOrCreateOffscreen(trailMap, ctx, W, H)
}

// ── Beat envelope (per canvas context) ─────────────────────────────────────────

const beatEnvelopeMap = new WeakMap<CanvasRenderingContext2D, number>()
const BEAT_DECAY = 0.86

function tickBeatEnvelope(ctx: CanvasRenderingContext2D, beatHit: boolean): number {
  const prev = beatEnvelopeMap.get(ctx) ?? 0
  const next = beatHit ? 1.0 : prev * BEAT_DECAY
  beatEnvelopeMap.set(ctx, next)
  return next
}

// ── Mode selector ─────────────────────────────────────────────────────────────

type ScopeMode = 'waveform' | 'lissajous' | 'radialScope' | 'spiralScope' | 'pathScope'

function modeForSection(type: ReactSectionType | null): ScopeMode {
  switch (type) {
    case 'intro':     return 'waveform'
    case 'verse':     return 'waveform'
    case 'build':     return 'radialScope'
    case 'drop':      return 'lissajous'
    case 'breakdown': return 'spiralScope'
    case 'outro':     return 'waveform'
    default:          return 'waveform'
  }
}

// ── Path point cache ──────────────────────────────────────────────────────────
// Points are expensive to compute (SVG parsing, canvas text rasterisation, etc.)
// so we cache them by a content-derived key.  The cache is module-level so it
// survives across frames and across preset switches for the same source.
//
// Key structure:
//   builtin:<shape>:<resolution>   — deterministic; changes only when shape or res changes
//   text:<trimmedText>:<resolution> — trimmed so whitespace-only edits don't invalidate
//   svg:<asset.id>:<resolution>    — asset.id is a content-hash so same SVG = same key
//   builtin:circle:<resolution>    — sentinel for svgGlyph with no selection / bad SVG
//
// LRU eviction: when the cache reaches PATH_CACHE_MAX entries the oldest entry
// (Map insertion order) is dropped.  Max 32 keeps memory bounded (each entry is
// an array of ~512 plain objects ≈ 100–200 KB worst case).

const PATH_CACHE_MAX = 32
const pathCache = new Map<string, OscillatorGlyphPoint[]>()

function cachePut(key: string, pts: OscillatorGlyphPoint[]): void {
  if (pathCache.size >= PATH_CACHE_MAX) {
    const first = pathCache.keys().next().value
    if (first !== undefined) pathCache.delete(first)
  }
  pathCache.set(key, pts)
}

function getOscillatorPathPoints(params: ReactRenderParams): OscillatorGlyphPoint[] | null {
  const osc = params.oscillator
  const res = clamp(Math.round(osc.pathResolution), 64, 2048)

  switch (osc.sourceType) {
    case 'builtinShape': {
      const key = `builtin:${osc.builtinShape}:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = generateBuiltinShapePoints(osc.builtinShape, res)
      cachePut(key, pts)
      return pts
    }
    case 'text': {
      const trimmed = osc.text.trim()

      // Prefer OpenType vector paths when a custom font is selected and points are prepared.
      if (osc.textFontId && trimmed) {
        const openTypeKey = `${osc.textFontId}:${trimmed}:${osc.textFontSize}:${osc.textLetterSpacing}:${res}`
        const prepared = params.oscillatorTextPointCache[openTypeKey]
        if (prepared) return prepared
        if (import.meta.env.DEV) {
          console.warn(`[SoundDrawingRenderer] OpenType points not ready for font "${osc.textFontId}" — using canvas fallback`)
        }
      }

      // Canvas fallback (original behaviour)
      if (!trimmed) {
        const key = `builtin:${osc.builtinShape}:${res}`
        const cached = pathCache.get(key)
        if (cached) return cached
        const pts = generateBuiltinShapePoints(osc.builtinShape, res)
        cachePut(key, pts)
        return pts
      }
      const key = `text:${trimmed}:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = textToGlyphPoints(trimmed, res)
      cachePut(key, pts)
      return pts
    }
    case 'svgGlyph': {
      const glyphId = osc.selectedGlyphId
      const asset = glyphId ? params.oscillatorGlyphAssets.find(a => a.id === glyphId) : undefined
      if (asset) {
        // Read from the pre-parsed cache populated by reactStore at upload/select/resolution-change time.
        // Key format: "${assetId}:${resolution}" — matches the key written by reactStore.ts.
        const cacheKey = `${asset.id}:${res}`
        const prepared = params.oscillatorGlyphPointCache[cacheKey]
        if (prepared) return prepared
        // Points not yet prepared (e.g. first frame after page reload before any interaction).
        // Fall back to circle silently; the store will populate the cache on next select.
        if (import.meta.env.DEV) {
          console.warn(`[SoundDrawingRenderer] No prepared points for glyph "${asset.id}" at res ${res} — falling back to circle`)
        }
      }
      // No asset selected or points not ready — circle sentinel
      const key = `builtin:circle:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = generateBuiltinShapePoints('circle', res)
      cachePut(key, pts)
      return pts
    }
    case 'classic':
      return null
    default:
      return null
  }
}

// Shapes that naturally close back to their start point
const CLOSED_SHAPES = new Set(['circle', 'square', 'triangle', 'star', 'hexagon', 'infinity'])

function shouldClose(params: ReactRenderParams): boolean {
  const osc = params.oscillator
  return osc.sourceType === 'builtinShape' && CLOSED_SHAPES.has(osc.builtinShape)
}

// ── Section modifiers for oscillator ─────────────────────────────────────────

export interface OscillatorSectionModifiers {
  duplicateTraces:   number
  rotationSpeed:     number
  bassScale:         number
  beatBloom:         number
  pathScale:         number
  midTwist:          number
  audioDisplacement: number
  highJitter:        number
}

/**
 * Returns computed oscillator values adjusted for the active section type.
 * Pure function — does not mutate the input settings.
 * Only applied when `osc.autoSectionMode` is true.
 */
export function resolveOscillatorSectionModifiers(
  sectionType: ReactSectionType | null,
  settings: OscillatorSettings,
): OscillatorSectionModifiers {
  const base: OscillatorSectionModifiers = {
    duplicateTraces:   settings.duplicateTraces,
    rotationSpeed:     settings.rotationSpeed,
    bassScale:         settings.bassScale,
    beatBloom:         settings.beatBloom,
    pathScale:         settings.pathScale,
    midTwist:          settings.midTwist,
    audioDisplacement: settings.audioDisplacement,
    highJitter:        settings.highJitter,
  }

  switch (sectionType) {
    case 'intro':
      return {
        ...base,
        duplicateTraces:   1,
        audioDisplacement: Math.min(base.audioDisplacement, 0.08),
        rotationSpeed:     base.rotationSpeed * 0.4,
        pathScale:         base.pathScale * 0.85,
      }
    case 'verse':
      return {
        ...base,
        audioDisplacement: base.audioDisplacement * 0.7,
        rotationSpeed:     base.rotationSpeed * 0.6,
      }
    case 'build':
      return {
        ...base,
        rotationSpeed:   base.rotationSpeed * 1.5,
        midTwist:        Math.min(1, base.midTwist + 0.1),
        beatBloom:       Math.min(1, base.beatBloom + 0.15),
        duplicateTraces: Math.min(6, base.duplicateTraces + 1),
      }
    case 'drop':
      return {
        ...base,
        bassScale:       Math.min(1, base.bassScale + 0.15),
        duplicateTraces: Math.min(6, base.duplicateTraces + 2),
        beatBloom:       Math.min(1, base.beatBloom + 0.2),
        rotationSpeed:   base.rotationSpeed * 1.8,
      }
    case 'breakdown':
      return {
        ...base,
        highJitter:        Math.max(0, base.highJitter - 0.04),
        rotationSpeed:     base.rotationSpeed * 0.5,
        audioDisplacement: base.audioDisplacement * 0.8,
        duplicateTraces:   Math.max(1, base.duplicateTraces - 1),
      }
    case 'outro':
      return {
        ...base,
        pathScale:         base.pathScale * 0.8,
        rotationSpeed:     base.rotationSpeed * 0.3,
        audioDisplacement: base.audioDisplacement * 0.5,
        duplicateTraces:   1,
      }
    default:
      return base
  }
}

// ── Real-time audio modifiers ─────────────────────────────────────────────────

export interface OscillatorAudioModifiers {
  /** Scale multiplier from bass energy: always ≥ 1. */
  bassPulse:          number
  /** Decaying beat envelope (0–1); 1 immediately after a beat hit. */
  beatPulse:          number
  /** Per-point mid-twist combined factor (mid × midTwist × beat bonus). */
  midTwistAmount:     number
  /** Deterministic high-freq jitter scale: clamped to [0, 0.25]. */
  highJitterAmount:   number
  /** Extra canvas shadow-blur pixels from volume + beat. */
  glowBoost:          number
  /** Line-width multiplier: ≥ 1, boosted by beat and bass. */
  lineWidthBoost:     number
  /** Per-point displacement scale in normalised path space, capped at 0.25. */
  displacementAmount: number
  /** Rotation speed multiplier: 1 + mid×0.3×beatPulse. */
  rotationBoost:      number
}

/**
 * Computes frame-level audio-reactive values for the oscilloscope renderer.
 * Pure: all state comes from `frame`, `params`, and the caller-managed `beatEnvelope`.
 * `params.oscillator` should already have section modifiers merged in when autoSectionMode
 * is active, so both section and audio reactivity combine correctly.
 */
export function resolveOscillatorAudioModifiers(
  frame:        ReactFrameContext,
  params:       ReactRenderParams,
  beatEnvelope: number,
): OscillatorAudioModifiers {
  const osc  = params.oscillator
  const bass = frame.audio.bass * params.bassReactivity
  const mid  = frame.audio.mid
  const high = frame.audio.high
  const vol  = frame.audio.volume

  const bassPulse = 1 + clamp(bass * osc.bassScale, 0, 0.6)

  const midTwistAmount = mid * osc.midTwist * (1 + beatEnvelope * 0.3)

  const highJitterAmount = clamp(high * osc.highJitter, 0, 0.25)

  const glowBoost = vol * 8 + beatEnvelope * 18 * osc.beatBloom

  const lineWidthBoost = 1 + beatEnvelope * 0.8 * osc.beatBloom + bass * 0.4

  // Cap displacement at 25% of shape scale so glyphs stay readable
  const displacementAmount = clamp(osc.audioDisplacement * (1 + bass * 0.3), 0, 0.25)

  const rotationBoost = 1 + mid * 0.3 * beatEnvelope

  return {
    bassPulse,
    beatPulse:          beatEnvelope,
    midTwistAmount,
    highJitterAmount,
    glowBoost,
    lineWidthBoost,
    displacementAmount,
    rotationBoost,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeDomainNorm(timeDomainData: Uint8Array<ArrayBuffer> | null, i: number): number {
  if (!timeDomainData) return 0
  const raw = timeDomainData[i % timeDomainData.length]
  return (raw / 128.0) - 1.0  // -1..1
}

function getFreqNorm(freqData: Uint8Array<ArrayBuffer> | null, i: number): number {
  if (!freqData) return 0
  return freqData[i % freqData.length] / 255
}

// Synthetic "left/right" channels from a single analyser by splitting freq bands
function getSynthStereo(
  timeDomainData: Uint8Array<ArrayBuffer> | null,
  freqData: Uint8Array<ArrayBuffer> | null,
  i: number,
  totalPts: number,
): { x: number; y: number } {
  if (timeDomainData && timeDomainData.length >= 2) {
    const half   = Math.floor(timeDomainData.length / 2)
    const idxL   = Math.floor((i / totalPts) * half)
    const idxR   = half + Math.floor((i / totalPts) * half)
    return {
      x: (timeDomainData[idxL] / 128) - 1,
      y: (timeDomainData[idxR] / 128) - 1,
    }
  }
  const phase = (i / totalPts) * Math.PI * 2
  const bassEnergy = freqData ? freqData[4] / 255 : 0.3
  return {
    x: Math.sin(phase       + bassEnergy * 0.5),
    y: Math.sin(phase * 1.5 + bassEnergy * 0.8),
  }
}

// ── Canvas path helpers ───────────────────────────────────────────────────────

function drawConnectedPath(
  tctx: CanvasRenderingContext2D,
  pts: [number, number][],
  close: boolean,
): void {
  if (pts.length < 2) return
  tctx.beginPath()
  tctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) tctx.lineTo(pts[i][0], pts[i][1])
  if (close) tctx.closePath()
  tctx.stroke()
}

function drawDotPoints(
  tctx: CanvasRenderingContext2D,
  pts: [number, number][],
  r: number,
): void {
  tctx.beginPath()
  for (const [x, y] of pts) {
    tctx.moveTo(x + r, y)
    tctx.arc(x, y, r, 0, Math.PI * 2)
  }
  tctx.fill()
}

// ── Fade trail each frame ─────────────────────────────────────────────────────

function fadeTrail(
  trailCanvas: HTMLCanvasElement,
  bgColor: string,
  decayAlpha: number,
): void {
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) return
  tctx.fillStyle = hexToRgba(bgColor, Math.max(0.02, decayAlpha))
  tctx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)
}

// ── Waveform mode ─────────────────────────────────────────────────────────────

function drawWaveformOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, beatHit } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 256
  const stepX = W / pts

  const lineColor = preset.palette.primary
  const glowPx    = params.glow * (12 + (beatHit ? 18 : 0)) + bass * 14

  const layers = [
    { yOff: H * 0.25, scaleY: H * 0.18, color: preset.palette.secondary, alpha: 0.4 },
    { yOff: H * 0.5,  scaleY: H * 0.24, color: lineColor,                 alpha: 0.9 },
    { yOff: H * 0.75, scaleY: H * 0.18, color: preset.palette.secondary, alpha: 0.4 },
  ]

  for (const layer of layers) {
    tctx.save()
    tctx.globalAlpha              = layer.alpha * intMul
    tctx.globalCompositeOperation = 'screen'
    tctx.strokeStyle              = layer.color
    tctx.lineWidth                = (1.2 + bass * 2) * dpr * params.intensity
    tctx.shadowColor              = layer.color
    tctx.shadowBlur               = glowPx * (layer.alpha > 0.8 ? 1 : 0.4)
    tctx.lineCap                  = 'round'
    tctx.lineJoin                 = 'round'
    tctx.beginPath()
    for (let i = 0; i <= pts; i++) {
      const v = getTimeDomainNorm(timeDomainData, i)
      const x = i * stepX
      const y = layer.yOff + v * layer.scaleY * (1 + bass * 0.5) * params.intensity
      if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
    }
    tctx.stroke()
    tctx.restore()
  }
}

// ── Lissajous mode ────────────────────────────────────────────────────────────

function drawLissajousOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, freqData, beatHit } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 512
  const cx2   = W / 2, cy2 = H / 2
  const scale = Math.min(W, H) * 0.42 * (1 + bass * 0.12) * params.intensity

  const glowPx = params.glow * (14 + (beatHit ? 20 : 0))
  const col    = preset.palette.primary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (0.9 + bass * 1.5) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.85 * intMul
  tctx.lineCap                  = 'round'
  tctx.lineJoin                 = 'round'
  tctx.beginPath()

  for (let i = 0; i <= pts; i++) {
    const st = getSynthStereo(timeDomainData, freqData, i, pts)
    const x  = cx2 + st.x * scale
    const y  = cy2 + st.y * scale
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.stroke()

  tctx.strokeStyle = preset.palette.accent
  tctx.shadowColor = preset.palette.accent
  tctx.shadowBlur  = glowPx * 0.5
  tctx.lineWidth  *= 0.4
  tctx.globalAlpha = 0.3 * intMul
  tctx.stroke()

  tctx.restore()
}

// ── Radial scope mode ─────────────────────────────────────────────────────────

function drawRadialScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, beatHit } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2    = W / 2, cy2 = H / 2
  const baseR  = Math.min(W, H) * 0.3 * params.intensity
  const pts    = 256
  const glowPx = params.glow * (10 + (beatHit ? 16 : 0)) + bass * 10
  const col    = preset.palette.secondary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (1.0 + bass * 1.8) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.9 * intMul
  tctx.lineCap                  = 'round'
  tctx.beginPath()

  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * Math.PI * 2
    const v     = getTimeDomainNorm(timeDomainData, i)
    const r     = baseR + v * baseR * 0.55 * (1 + bass * 0.6)
    const x     = cx2 + Math.cos(angle) * r
    const y     = cy2 + Math.sin(angle) * r
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.closePath()
  tctx.stroke()

  tctx.strokeStyle = preset.palette.accent
  tctx.shadowColor = preset.palette.accent
  tctx.lineWidth  *= 0.5
  tctx.globalAlpha = 0.35 * intMul
  tctx.beginPath()
  tctx.arc(cx2, cy2, baseR * 0.55, 0, Math.PI * 2)
  tctx.stroke()

  tctx.restore()
}

// ── Spiral scope mode ─────────────────────────────────────────────────────────

function drawSpiralScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, freqData, t, beatHit } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2    = W / 2, cy2 = H / 2
  const pts    = 360
  const glowPx = params.glow * (12 + (beatHit ? 18 : 0))
  const col    = preset.palette.primary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (0.8 + bass * 1.2) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.85 * intMul
  tctx.lineCap                  = 'round'
  tctx.beginPath()

  const spiralR     = Math.min(W, H) * 0.35 * params.intensity
  const spiralTurns = 3.5 + audio.mid * 1.5

  for (let i = 0; i <= pts; i++) {
    const frac    = i / pts
    const angle   = frac * Math.PI * 2 * spiralTurns + t * 0.001 * params.motion
    const freqVal = getFreqNorm(freqData, Math.floor(frac * (freqData ? freqData.length : 256)))
    const r       = frac * spiralR * (0.8 + freqVal * 0.5 + bass * 0.3)
    const x       = cx2 + Math.cos(angle) * r
    const y       = cy2 + Math.sin(angle) * r
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.stroke()

  tctx.restore()
}

// ── Path / glyph scope mode ───────────────────────────────────────────────────

function drawPathScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  sectionType: ReactSectionType | null,
): void {
  const osc = params.oscillator
  const { audio, timeDomainData, beatHit, t } = frame

  const basePoints = getOscillatorPathPoints(params)
  if (!basePoints || basePoints.length === 0) return

  const resolution = basePoints.length
  const cx = W / 2
  const cy = H / 2

  const bass = audio.bass * params.bassReactivity

  // Merge section modifiers into the effective osc settings so that
  // resolveOscillatorAudioModifiers sees the correct per-section values.
  let effectiveOsc = osc
  if (osc.autoSectionMode) {
    const sm = resolveOscillatorSectionModifiers(sectionType, osc)
    effectiveOsc = {
      ...osc,
      duplicateTraces:   sm.duplicateTraces,
      rotationSpeed:     sm.rotationSpeed,
      bassScale:         sm.bassScale,
      beatBloom:         sm.beatBloom,
      pathScale:         sm.pathScale,
      midTwist:          sm.midTwist,
      audioDisplacement: sm.audioDisplacement,
      highJitter:        sm.highJitter,
    }
  }

  // Beat envelope persists across frames keyed to this canvas context
  const beatEnvelope = tickBeatEnvelope(tctx, beatHit)

  // All audio-reactive values in one pure call
  const am = resolveOscillatorAudioModifiers(
    frame,
    { ...params, oscillator: effectiveOsc },
    beatEnvelope,
  )

  const numTraces = clamp(effectiveOsc.duplicateTraces, 1, 6)
  const close     = shouldClose(params)

  // Rotation: section speed × audio boost
  const rotRad = t * 0.002 * params.motion * effectiveOsc.rotationSpeed * am.rotationBoost

  // Scale: section pathScale × bass pulse × sustained beat bloom
  const bloomFactor = am.beatPulse * effectiveOsc.beatBloom
  const baseScale   = Math.min(W, H) * 0.42 * effectiveOsc.pathScale * params.intensity
                    * am.bassPulse * (1 + bloomFactor * 0.4)
  const glowBase    = params.glow * (10 + am.glowBoost) + bass * 8

  const tdLen = timeDomainData ? timeDomainData.length : resolution

  // Groups based on source pathIndex — each sub-path (letter, hole, logo piece)
  // is drawn separately so there are no connector lines between unrelated paths.
  // Built-in shapes all have pathIndex 0 so they render as a single group (unchanged).
  const pathIndexGroups = new Map<number, number[]>()  // pathIndex → array of source point indices
  for (let i = 0; i < resolution; i++) {
    const pidx = basePoints[i].pathIndex ?? 0
    if (!pathIndexGroups.has(pidx)) pathIndexGroups.set(pidx, [])
    pathIndexGroups.get(pidx)!.push(i)
  }
  const sourceGroups = Array.from(pathIndexGroups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, indices]) => indices)

  let mainTraceGroups: [number, number][][] | null = null

  for (let traceIdx = 0; traceIdx < numTraces; traceIdx++) {
    const isMain        = traceIdx === 0
    const traceScaleMul = 1 - traceIdx * 0.04
    // Beat pulse musically boosts trace alpha
    const traceAlpha = isMain
      ? Math.min(1, 0.92 + am.beatPulse * 0.08)
      : Math.max(0.1, 0.38 - traceIdx * 0.06 + am.beatPulse * 0.1)
    const traceColor = isMain ? preset.palette.primary : preset.palette.secondary
    // Beat-phase offset keeps duplicate traces musically animated
    const traceRotOffset = traceIdx * 0.08 + traceIdx * frame.beatPhase * 0.015 * am.beatPulse
    const totalRot       = rotRad + traceRotOffset
    const cosR           = Math.cos(totalRot)
    const sinR           = Math.sin(totalRot)
    const traceScale     = baseScale * traceScaleMul

    // Transform all source points to screen coordinates (global index preserved for audio sampling)
    const screenPts: [number, number][] = new Array(resolution)
    for (let i = 0; i < resolution; i++) {
      const p = basePoints[i]
      let px = p.x
      let py = p.y

      // Mid twist: rotate each point proportional to path progress
      if (am.midTwistAmount > 0) {
        const twAngle = p.progress * Math.PI * 2 * am.midTwistAmount
        const cosTw   = Math.cos(twAngle)
        const sinTw   = Math.sin(twAngle)
        const tx = px * cosTw - py * sinTw
        const ty = px * sinTw + py * cosTw
        px = tx
        py = ty
      }

      // Per-point audio displacement in normalised space
      const tdIdx   = Math.floor(i * tdLen / resolution)
      const td      = getTimeDomainNorm(timeDomainData, tdIdx)
      const dispAmt = td * am.displacementAmount
      switch (osc.audioDisplaceMode) {
        case 'normal': {
          px += (p.normalX ?? 0) * dispAmt
          py += (p.normalY ?? 0) * dispAmt
          break
        }
        case 'radial': {
          const rlen = Math.sqrt(p.x * p.x + p.y * p.y)
          if (rlen > 0) {
            px += (p.x / rlen) * dispAmt
            py += (p.y / rlen) * dispAmt
          }
          break
        }
        case 'tangent': {
          px += -(p.normalY ?? 0) * dispAmt
          py +=  (p.normalX ?? 0) * dispAmt
          break
        }
        case 'xy': {
          const halfLen = Math.floor(tdLen / 2)
          const tdX     = getTimeDomainNorm(timeDomainData, tdIdx)
          const tdY     = getTimeDomainNorm(timeDomainData, tdIdx + halfLen)
          px += tdX * am.displacementAmount
          py += tdY * am.displacementAmount
          break
        }
      }

      // Deterministic high-freq jitter (no Math.random per frame)
      if (am.highJitterAmount > 0) {
        const jSeed = i * 17.37 + Math.floor(t / 4)
        const jrand = (seededRandom(jSeed) - 0.5) * 2
        const nx    = p.normalX ?? Math.cos(p.progress * Math.PI * 2)
        const ny    = p.normalY ?? Math.sin(p.progress * Math.PI * 2)
        px += nx * jrand * am.highJitterAmount
        py += ny * jrand * am.highJitterAmount
      }

      if (osc.mirrorX) px = -px
      if (osc.mirrorY) py = -py

      const sx = px * traceScale
      const sy = py * traceScale
      screenPts[i] = [cx + sx * cosR - sy * sinR, cy + sx * sinR + sy * cosR]
    }

    // Gather screen coords grouped by source pathIndex (preserving source order within each group)
    const screenGroups: [number, number][][] = sourceGroups.map(
      indices => indices.map(i => screenPts[i])
    )

    if (isMain) mainTraceGroups = screenGroups

    tctx.save()
    tctx.globalCompositeOperation = 'screen'
    tctx.lineCap  = 'round'
    tctx.lineJoin = 'round'

    switch (osc.renderMode) {
      case 'outline': {
        tctx.globalAlpha = traceAlpha * intMul
        tctx.strokeStyle = traceColor
        tctx.shadowColor = traceColor
        tctx.shadowBlur  = glowBase
        tctx.lineWidth   = (1.2 + bass * 1.5) * am.lineWidthBoost * dpr * params.intensity
        for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        break
      }
      case 'multiTrace': {
        if (isMain) {
          tctx.globalAlpha = 0.25 * intMul
          tctx.strokeStyle = preset.palette.accent
          tctx.shadowColor = preset.palette.accent
          tctx.shadowBlur  = glowBase * 0.8
          tctx.lineWidth   = (2.5 + bass * 2.5) * am.lineWidthBoost * dpr
          for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        }
        tctx.globalAlpha = traceAlpha * intMul
        tctx.strokeStyle = traceColor
        tctx.shadowColor = traceColor
        tctx.shadowBlur  = glowBase
        tctx.lineWidth   = (1.0 + bass * 1.5) * am.lineWidthBoost * dpr * params.intensity
        for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        break
      }
      case 'dots': {
        const dotR = Math.max(0.5, (0.8 + bass) * am.lineWidthBoost * dpr * params.intensity)
        tctx.globalAlpha = traceAlpha * intMul
        tctx.fillStyle   = traceColor
        tctx.shadowColor = traceColor
        tctx.shadowBlur  = glowBase * 0.6
        for (const group of screenGroups) drawDotPoints(tctx, group, dotR)
        break
      }
      case 'ribbon': {
        // Underlay pass (wide, semi-transparent) — all groups first
        tctx.globalAlpha = 0.18 * intMul
        tctx.strokeStyle = preset.palette.accent
        tctx.shadowColor = preset.palette.accent
        tctx.shadowBlur  = glowBase * 1.2
        tctx.lineWidth   = (5 + bass * 5) * am.lineWidthBoost * dpr
        for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        // Inner trace pass (thin, full alpha) — all groups second
        tctx.globalAlpha = traceAlpha * intMul
        tctx.strokeStyle = traceColor
        tctx.shadowColor = traceColor
        tctx.shadowBlur  = glowBase
        tctx.lineWidth   = (1.5 + bass * 1.5) * am.lineWidthBoost * dpr * params.intensity
        for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        break
      }
    }

    tctx.restore()
  }

  // Beat bloom flash — sustained by envelope, not a single-frame spike.
  // Iterates over the same per-pathIndex groups so no cross-path connector lines appear here either.
  if (am.beatPulse > 0.05 && mainTraceGroups) {
    tctx.save()
    tctx.globalCompositeOperation = 'screen'
    tctx.strokeStyle = preset.palette.accent
    tctx.shadowColor = preset.palette.accent
    tctx.shadowBlur  = glowBase * 2.5
    tctx.lineWidth   = (2.5 + bass * 3) * dpr
    tctx.globalAlpha = 0.5 * am.beatPulse * effectiveOsc.beatBloom * intMul
    tctx.lineCap     = 'round'
    tctx.lineJoin    = 'round'
    for (const group of mainTraceGroups) drawConnectedPath(tctx, group, close)
    tctx.restore()
  }
}

// ── Public export ─────────────────────────────────────────────────────────────

export function renderSoundDrawing(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): void {
  const { W, H, dpr } = frame
  const intMul = params.intensity
  const osc    = params.oscillator

  // Route to pathScope for any non-classic source; otherwise honour classicMode
  let mode: ScopeMode
  if (osc.sourceType === 'classic') {
    if (osc.autoSectionMode || osc.classicMode === 'sectionAuto') {
      mode = modeForSection(sectionType)
    } else {
      mode = osc.classicMode as ScopeMode
    }
  } else {
    mode = 'pathScope'
  }

  const trailCanvas = getTrail(ctx, W, H)
  const tctx        = trailCanvas.getContext('2d')
  if (!tctx) return

  // Fade trail
  const decayRate = params.trailDecay * 0.25 + 0.01
  fadeTrail(trailCanvas, preset.palette.background, decayRate)

  // Draw new scope frame onto trail canvas
  switch (mode) {
    case 'lissajous':
      drawLissajousOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    case 'radialScope':
      drawRadialScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    case 'spiralScope':
      drawSpiralScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    case 'pathScope':
      drawPathScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, sectionType)
      break
    default:
      drawWaveformOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
  }

  // Composite trail onto main canvas
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(trailCanvas, 0, 0)
}

import type { ReactPreset, ReactSectionType, OscillatorGlyphPoint, OscillatorSettings, OscillatorTextWaveformMode, OscillatorTextLetterReactionMode, LetterReactionAssignment } from '../ReactTypes'
import { getCharReactionWeights } from './letterReactionUtils'
import { evalCustomSignal, applyCustomTargetDelta } from './letterReactionCustom'
import type { CustomTargetDelta } from './letterReactionCustom'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba, getOrCreateOffscreen, seededRandom } from './reactRenderUtils'
import { generateBuiltinShapePoints, clamp } from './oscillatorPathUtils'
import { textToGlyphPoints } from './textGlyphUtils'
import { getSvgVisualEntry } from './svgVisualCache'
import { getSvgGlyphCacheKey, findNearestSvgGlyphCacheEntry } from './svgGlyphUtils'
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

// ── Twist sign (per canvas context) ──────────────────────────────────────────
// When altTwist is enabled the sign flips on every beat, producing true
// left-right-left-right alternation.  Beat edges are detected two ways:
//   1. beatHit flag (fires exactly once per advancing beat index from the
//      music-intelligence engine, or from the bass-transient fallback).
//   2. beatPhase wrap-around (prevPhase > 0.8 → currPhase < 0.2) as a
//      secondary trigger so alternation works even when beatHit is sparse.
// Using both ensures the sign always flips regardless of audio state.
const twistSignMap     = new WeakMap<CanvasRenderingContext2D, 1 | -1>()
const twistPhasePrevMap = new WeakMap<CanvasRenderingContext2D, number>()

function tickTwistSign(
  ctx:       CanvasRenderingContext2D,
  beatHit:   boolean,
  beatPhase: number,
  altTwist:  boolean,
): 1 | -1 {
  if (!altTwist) {
    twistSignMap.delete(ctx)
    twistPhasePrevMap.delete(ctx)
    return 1
  }

  const prevPhase  = twistPhasePrevMap.get(ctx) ?? beatPhase
  const phaseWrapped = prevPhase > 0.8 && beatPhase < 0.2
  twistPhasePrevMap.set(ctx, beatPhase)

  const prev = twistSignMap.get(ctx) ?? 1
  if (beatHit || phaseWrapped) {
    const next: 1 | -1 = (prev * -1) as 1 | -1
    twistSignMap.set(ctx, next)
    return next
  }
  return prev
}

// ── Rotation phase accumulator (per canvas context) ───────────────────────────
// Replaces global-time rotation so that changing speed doesn't snap the angle,
// and so that text/svg sources can be stationary when autoRotate is false.

interface RotState { phase: number; prevT: number; prevSourceKey: string }
const rotPhaseMap = new WeakMap<CanvasRenderingContext2D, RotState>()

function tickRotPhase(
  ctx: CanvasRenderingContext2D,
  t: number,
  sourceKey: string,
  shouldRotate: boolean,
  angularVelocity: number,
): number {
  const prev = rotPhaseMap.get(ctx) ?? { phase: 0, prevT: t, prevSourceKey: '' }
  const sourceChanged = sourceKey !== prev.prevSourceKey
  const deltaT_s = sourceChanged ? 0 : Math.min((t - prev.prevT) / 1000, 0.1)
  const newPhase = sourceChanged || !shouldRotate
    ? 0
    : prev.phase + deltaT_s * angularVelocity
  rotPhaseMap.set(ctx, { phase: newPhase, prevT: t, prevSourceKey: sourceKey })
  return newPhase
}

// ── Original Artwork offscreen palette canvas (per ctx) ───────────────────────
const artworkPaletteMap = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>()

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
//   builtin:<shape>:<resolution>                           — deterministic
//   text:<trimmedText>:<spacing>:<resolution>              — trimmed text + font params
//   <assetId>:<resolution>:v<compilerVersion>:<hash>       — versioned; see getSvgGlyphCacheKey
//   builtin:circle:<resolution>                            — sentinel for svgGlyph with no selection / bad SVG
//
// LRU eviction: when the cache reaches PATH_CACHE_MAX entries the oldest entry
// (Map insertion order) is dropped.  Max 32 keeps memory bounded (each entry is
// an array of ~512 plain objects ≈ 100–200 KB worst case).

const PATH_CACHE_MAX = 32
const pathCache = new Map<string, OscillatorGlyphPoint[]>()

/** Neutral textFontSize — matches the default value in OscillatorSettings.
 *  At this value the font-size multiplier is 1.0 so existing presets are unaffected. */
export const DEFAULT_TEXT_FONT_SIZE = 160

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
        const openTypeKey = `${osc.textFontId}:${trimmed}:${osc.textLetterSpacing}:${res}`
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
      const spacing = osc.textLetterSpacing ?? 0
      const key = `text:${trimmed}:${res}:${spacing}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = textToGlyphPoints(trimmed, res, { letterSpacing: spacing })
      cachePut(key, pts)
      return pts
    }
    case 'svgGlyph': {
      const glyphId = osc.selectedGlyphId
      const asset = glyphId ? params.oscillatorGlyphAssets.find(a => a.id === glyphId) : undefined
      if (asset) {
        // Read from the pre-parsed cache populated by reactStore at upload/select/resolution-change time.
        const cacheKey = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
        const prepared = params.oscillatorGlyphPointCache[cacheKey]
        if (prepared) return prepared
        // Exact key not ready (debounce window or first frame after page reload).
        // Use the nearest already-compiled resolution to keep the glyph visible
        // instead of flashing a circle while the new resolution compiles.
        const nearest = findNearestSvgGlyphCacheEntry(
          params.oscillatorGlyphPointCache,
          asset.id,
          res,
          asset.contentHash,
        )
        if (nearest) return nearest
        if (import.meta.env.DEV) {
          console.warn(`[SoundDrawingRenderer] No compiled points for glyph "${asset.id}" at res ${res} — falling back to circle`)
        }
      }
      // No asset selected or no compiled entry at all — circle sentinel
      const key = `builtin:circle:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = generateBuiltinShapePoints('circle', res)
      cachePut(key, pts)
      return pts
    }
    case 'svg': {
      // Unified SVG source. When svgRenderMode is originalArtwork this branch is
      // unreachable (renderSoundDrawing routes away before calling getOscillatorPathPoints).
      // For reactivePath (or auto where glyph points are available), look up by glyph-media: prefix.
      const glyphId = osc.selectedSvgId ? `glyph-media:${osc.selectedSvgId}` : null
      const asset   = glyphId ? params.oscillatorGlyphAssets.find(a => a.id === glyphId) : undefined
      if (asset) {
        const cacheKey = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
        const prepared = params.oscillatorGlyphPointCache[cacheKey]
        if (prepared) return prepared
        const nearest = findNearestSvgGlyphCacheEntry(
          params.oscillatorGlyphPointCache, asset.id, res, asset.contentHash,
        )
        if (nearest) return nearest
      }
      // No glyph points ready — circle sentinel keeps something visible while compiling
      const key    = `builtin:circle:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = generateBuiltinShapePoints('circle', res)
      cachePut(key, pts)
      return pts
    }
    case 'svgVisual':
    case 'classic':
      return null
    default:
      return null
  }
}

// ── Original Artwork renderer ─────────────────────────────────────────────────
// Renders the cached SVG image with full audio-reactive whole-object effects:
// bass scale, beat bloom, mid twist, high jitter, audio displacement, duplicate
// traces, trail decay, intensity-driven glow, and optional React Palette tinting.

function renderOriginalArtwork(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
): void {
  const { W, H, t, dpr } = frame
  const osc  = params.oscillator
  const bass = frame.audio.bass * params.bassReactivity
  const mid  = frame.audio.mid
  const high = frame.audio.high
  const vol  = frame.audio.volume

  // Look up image — unified 'svg' uses selectedSvgId; legacy 'svgVisual' uses selectedSvgVisualId
  const mediaId = osc.sourceType === 'svg'
    ? (osc.selectedSvgId ?? '')
    : (osc.selectedSvgVisualId ?? '')
  const entry = getSvgVisualEntry(mediaId)

  // Trail canvas for decay / ghost-echo effect
  const trailCanvas = getTrail(ctx, W, H)
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) return

  const beatEnvelope = tickBeatEnvelope(tctx, frame.beatHit)

  // Fade trail
  const decayRate = params.trailDecay * 0.25 + 0.01
  fadeTrail(trailCanvas, preset.palette.background, decayRate)

  // Composite trail to main canvas even if image is missing, so background shows
  if (!entry?.loaded || !entry.image) {
    ctx.fillStyle = preset.palette.background
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(trailCanvas, 0, 0)
    return
  }

  const img  = entry.image
  const imgW = entry.width  || img.naturalWidth  || 512
  const imgH = entry.height || img.naturalHeight || 512

  // ── Audio-reactive values ─────────────────────────────────────────────────

  // Scale: bass scale + beat bloom (much stronger than legacy 4% cap)
  const bassPulse   = 1 + clamp(bass * osc.bassScale, 0, 0.6)
  const bloomFactor = beatEnvelope * osc.beatBloom
  const maxSide     = Math.min(W, H) * Math.max(0.05, osc.pathScale)
  const ratio       = Math.min(maxSide / imgW, maxSide / imgH)
  const drawScale   = ratio * bassPulse * (1 + bloomFactor * 0.4)
  const drawW       = imgW * drawScale
  const drawH       = imgH * drawScale

  // Rotation phase (delta-time, respects autoRotate)
  const sourceKey    = `svg:${mediaId}`
  const shouldRotate = osc.autoRotate !== false
  const angularVel   = 2 * params.motion * osc.rotationSpeed * (1 + mid * 0.3 * beatEnvelope)
  const rotRad       = tickRotPhase(tctx, t, sourceKey, shouldRotate, angularVel)

  // Mid twist: additional rotation perturbation from mid-range energy.
  // altTwist randomly picks a new direction on each beat; sign is held until the next beat.
  const twistSignArtwork = tickTwistSign(tctx, frame.beatHit, frame.beatPhase, osc.altTwist)
  const midTwistAngle = twistSignArtwork * mid * osc.midTwist * 0.4 * Math.PI

  // High jitter: deterministic XY noise driven by high-freq energy
  const jitterAmt = clamp(high * osc.highJitter, 0, 0.25)
  const jx = (seededRandom(Math.floor(t / 3) * 17 + 37) - 0.5) * 2 * jitterAmt * Math.min(W, H) * 0.15
  const jy = (seededRandom(Math.floor(t / 3) * 29 + 83) - 0.5) * 2 * jitterAmt * Math.min(W, H) * 0.15

  // Audio displacement: XY position offset from time-domain waveform
  const dispAmt = clamp(osc.audioDisplacement * (1 + bass * 0.3), 0, 0.25)
  const tdLen   = frame.timeDomainData ? frame.timeDomainData.length : 256
  const tdX     = getTimeDomainNorm(frame.timeDomainData, Math.floor(tdLen * 0.1)) * dispAmt * Math.min(W, H) * 0.3
  const tdY     = getTimeDomainNorm(frame.timeDomainData, Math.floor(tdLen * 0.6)) * dispAmt * Math.min(W, H) * 0.3

  const cx = W / 2 + tdX + jx
  const cy = H / 2 + tdY + jy

  const numTraces       = clamp(osc.duplicateTraces, 1, 6)
  const visualIntensity = clamp(params.intensity ?? 1, 0, 2)
  const glowBoost       = vol * 8 + beatEnvelope * 18 * osc.beatBloom
  const glowBase        = (params.glow * (10 + glowBoost) + bass * 8) * visualIntensity
  const totalRot        = rotRad + midTwistAngle

  // ── Draw each trace onto the trail canvas ─────────────────────────────────

  for (let traceIdx = 0; traceIdx < numTraces; traceIdx++) {
    const isMain       = traceIdx === 0
    const traceScale   = 1 - traceIdx * 0.04
    const traceAlpha   = isMain
      ? Math.min(1, (0.92 + beatEnvelope * 0.08) * visualIntensity)
      : Math.max(0.1, (0.38 - traceIdx * 0.06 + beatEnvelope * 0.1) * visualIntensity)
    const traceRotOff  = traceIdx * 0.08 + traceIdx * frame.beatPhase * 0.015 * beatEnvelope
    const tRot         = totalRot + traceRotOff
    const tDrawW       = drawW * traceScale
    const tDrawH       = drawH * traceScale

    // Glow pass: blurred, screen-blended copy on main trace only
    if (isMain && params.glow > 0.15) {
      const blurPx    = Math.max(1, Math.round(params.glow * 16 + bass * 10 + beatEnvelope * 12))
      const glowAlpha = Math.min(0.45, glowBase * 0.035)
      tctx.save()
      tctx.translate(cx, cy)
      tctx.rotate(tRot)
      tctx.globalAlpha              = glowAlpha
      tctx.globalCompositeOperation = 'screen'
      tctx.filter                   = `blur(${blurPx}px)`
      tctx.drawImage(img, -tDrawW / 2, -tDrawH / 2, tDrawW, tDrawH)
      tctx.filter = 'none'
      tctx.restore()
    }

    if (osc.svgUseReactPalette) {
      // Offscreen canvas for palette tinting via source-in compositing
      const offscreen = getOrCreateOffscreen(artworkPaletteMap, ctx, W, H)
      const octx = offscreen.getContext('2d')
      if (octx) {
        octx.clearRect(0, 0, W, H)
        octx.save()
        octx.translate(cx, cy)
        octx.rotate(tRot)
        octx.globalAlpha = 1
        octx.drawImage(img, -tDrawW / 2, -tDrawH / 2, tDrawW, tDrawH)
        octx.restore()

        // Tint image with palette gradient
        octx.save()
        octx.globalCompositeOperation = 'source-in'
        const grad = octx.createLinearGradient(cx - tDrawW / 2, cy - tDrawH / 2, cx + tDrawW / 2, cy + tDrawH / 2)
        grad.addColorStop(0, preset.palette.primary)
        grad.addColorStop(1, preset.palette.secondary)
        octx.fillStyle = grad
        octx.fillRect(0, 0, W, H)
        octx.restore()

        tctx.save()
        tctx.globalAlpha              = traceAlpha
        tctx.globalCompositeOperation = 'screen'
        tctx.drawImage(offscreen, 0, 0)
        tctx.restore()
      }
    } else {
      tctx.save()
      tctx.translate(cx, cy)
      tctx.rotate(tRot)
      tctx.globalAlpha              = traceAlpha
      tctx.globalCompositeOperation = 'screen'
      tctx.drawImage(img, -tDrawW / 2, -tDrawH / 2, tDrawW, tDrawH)
      tctx.restore()
    }
  }

  // ── Composite trail to main canvas ────────────────────────────────────────
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(trailCanvas, 0, 0)
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

// ── Text waveform helpers ─────────────────────────────────────────────────────

function fract(v: number): number { return v - Math.floor(v) }

function getPointBounds(points: OscillatorGlyphPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  if (points.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  return { minX, maxX, minY, maxY }
}

export interface TextWaveformMeta {
  minX: number
  maxX: number
  minY: number
  maxY: number
  charCount: number
  localProgressByPointIndex: number[]
}

/**
 * Computes per-point local waveform progress for text sources.
 * For multi-group (OpenType) text, each group uses j/(group.length-1) so every
 * letter gets its own 0→1 cycle.  For single-group canvas-fallback text, an
 * x-based char-cycling term dominates so the waveform repeats across each
 * letter rather than stretching once across the whole word.
 */
export function buildTextWaveformMeta(
  basePoints: OscillatorGlyphPoint[],
  sourceGroups: number[][],
  text: string,
): TextWaveformMeta {
  const { minX, maxX, minY, maxY } = getPointBounds(basePoints)
  const xRange    = (maxX - minX) || 1
  const charCount = Math.max(1, text.trim().length)
  const isSingle  = sourceGroups.length === 1
  const local     = new Array<number>(basePoints.length).fill(0)

  for (const group of sourceGroups) {
    for (let j = 0; j < group.length; j++) {
      const srcIdx          = group[j]
      const p               = basePoints[srcIdx]
      const pathLocalProgress = group.length > 1 ? j / (group.length - 1) : 0

      if (isSingle) {
        // Canvas-fallback: all points share pathIndex 0.  Override monotonic
        // 0→1 progress with a char-cycling x-based value so "GOONZ" gets
        // waveform detail on every letter rather than a single long stretch.
        const xProgress  = clamp((p.x - minX) / xRange, 0, 1)
        const charProgress = fract(xProgress * charCount)
        local[srcIdx] = pathLocalProgress * 0.25 + charProgress * 0.75
      } else {
        // OpenType: each group is already one letter/contour.
        local[srcIdx] = pathLocalProgress
      }
    }
  }

  return { minX, maxX, minY, maxY, charCount, localProgressByPointIndex: local }
}

/**
 * Applies text-specific waveform displacement to a single point.
 * origX/origY are the pre-midTwist coordinates (for radial direction).
 * px/py are the post-midTwist working coordinates that get displaced.
 * Returns new { px, py }.
 */
export function applyTextWaveformDisplacement(
  px: number, py: number,
  origX: number, origY: number,
  normalX: number, normalY: number,
  pointIndex: number,
  meta: TextWaveformMeta,
  mode: OscillatorTextWaveformMode,
  amount: number,
  cycles: number,
  scrollPhase: number,
  timeDomainData: Uint8Array<ArrayBuffer> | null,
  bass: number,
): { px: number; py: number } {
  const localProgress  = meta.localProgressByPointIndex[pointIndex] ?? 0
  const tdLen          = timeDomainData ? timeDomainData.length : 256
  const sampleProgress = fract(localProgress * cycles + scrollPhase)
  const tdIdx          = Math.floor(sampleProgress * tdLen)
  const wave           = getTimeDomainNorm(timeDomainData, tdIdx)
  const effectiveAmt   = clamp(amount * (1 + bass * 0.35), 0, 0.30)
  const dispAmt        = wave * effectiveAmt

  switch (mode) {
    case 'normal':
      return { px: px + normalX * dispAmt, py: py + normalY * dispAmt }
    case 'radial': {
      const rlen = Math.sqrt(origX * origX + origY * origY)
      if (rlen > 0) return { px: px + (origX / rlen) * dispAmt, py: py + (origY / rlen) * dispAmt }
      return { px, py }
    }
    case 'tangent':
      return { px: px - normalY * dispAmt, py: py + normalX * dispAmt }
    case 'xy': {
      const sp2   = fract(sampleProgress + 0.5)
      const waveY = getTimeDomainNorm(timeDomainData, Math.floor(sp2 * tdLen))
      return { px: px + wave * effectiveAmt, py: py + waveY * effectiveAmt }
    }
    default:
      return { px, py }
  }
}

// ── Path geometry formula (exported for unit tests) ──────────────────────────

/**
 * Pure formula for the Sound Drawing path geometry scale.
 * params.intensity is intentionally NOT a parameter — it must not affect object size.
 * Use pathScale to resize; use bassPulse for audio-driven pulse; use bloomFactor for beat bloom.
 */
export function computePathBaseScale(
  W:           number,
  H:           number,
  pathScale:   number,
  bassPulse:   number,
  bloomFactor: number,
): number {
  return Math.min(W, H) * 0.42 * pathScale * bassPulse * (1 + bloomFactor * 0.4)
}

/**
 * Text-specific fit scale.  After height-based normalisation the y-extent is
 * always ≈ [-1, 1], but multi-character text can have a much wider x-extent.
 * This function returns the scale that makes the text at *default spacing*
 * (maxAbsX / maxAbsY of the zero-spacing points) fill the canvas with a 5 %
 * margin on each edge.  pathScale and fontSizeMul are then applied as
 * multipliers so both controls still have their full visual effect.
 *
 * Audio-reactive terms (bassPulse, bloomFactor) are applied locally per
 * character inside the draw loop so each letter reacts around its own center.
 */
export function computeTextFitScale(
  W:           number,
  H:           number,
  maxAbsX:     number,
  maxAbsY:     number,
  pathScale:   number,
  fontSizeMul: number,
): number {
  const MARGIN    = 0.05
  const fitScaleX = (W / 2) * (1 - MARGIN) / maxAbsX
  const fitScaleY = (H / 2) * (1 - MARGIN) / maxAbsY
  return Math.min(fitScaleX, fitScaleY) * pathScale * fontSizeMul
}

/**
 * Computes the centroid (mean x, mean y) of each character's points in
 * normalized glyph space.  Keyed by `characterIndex`.
 *
 * Using the centroid (not bbox center) guarantees that scaling or rotating
 * local offsets around it leaves the centroid unchanged — the expected layout
 * position stays anchored while audio-reactive motion expands outward.
 */
export function computeCharCenters(
  points: OscillatorGlyphPoint[],
): Map<number, { cx: number; cy: number }> {
  const sums = new Map<number, { sx: number; sy: number; n: number }>()
  for (const p of points) {
    const ci = p.characterIndex
    if (ci == null) continue
    const s = sums.get(ci)
    if (s) { s.sx += p.x; s.sy += p.y; s.n++ }
    else sums.set(ci, { sx: p.x, sy: p.y, n: 1 })
  }
  const centers = new Map<number, { cx: number; cy: number }>()
  for (const [ci, s] of sums) centers.set(ci, { cx: s.sx / s.n, cy: s.sy / s.n })
  return centers
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
  const mid  = audio.mid
  const high = audio.high

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

  // Twist sign: held constant between beats; randomly resampled on each beat hit
  const twistSign = tickTwistSign(tctx, beatHit, frame.beatPhase, effectiveOsc.altTwist)

  // All audio-reactive values in one pure call
  const amRaw = resolveOscillatorAudioModifiers(
    frame,
    { ...params, oscillator: effectiveOsc },
    beatEnvelope,
  )
  const am = twistSign === -1
    ? { ...amRaw, midTwistAmount: -amRaw.midTwistAmount }
    : amRaw

  const numTraces = clamp(effectiveOsc.duplicateTraces, 1, 6)
  const close     = shouldClose(params)

  // Rotation: delta-time phase accumulator — changing speed doesn't snap angle.
  // For text sources: rotate only when autoRotate is explicitly true (default: stationary).
  // For all other sources: rotate unless autoRotate is explicitly false (backward compat).
  const isTextSource = effectiveOsc.sourceType === 'text'
  const rotate       = isTextSource
    ? effectiveOsc.autoRotate === true
    : effectiveOsc.autoRotate !== false
  const sourceKey    = `${effectiveOsc.sourceType}:${effectiveOsc.selectedGlyphId ?? effectiveOsc.selectedSvgId ?? effectiveOsc.text ?? effectiveOsc.builtinShape}`
  const angularVel   = 2 * params.motion * effectiveOsc.rotationSpeed * am.rotationBoost
  const rotRad       = tickRotPhase(tctx, t, sourceKey, rotate, angularVel)

  // visualIntensity drives opacity / glow / line weight — NOT geometry size.
  // intensityLineBoost is neutral at intensity=1 and subtle across the full range,
  // so lines feel stronger/weaker without appearing to scale the object.
  const visualIntensity    = clamp(params.intensity ?? 1, 0, 2)
  const intensityLineBoost = 0.6 + visualIntensity * 0.4

  // Scale: section pathScale × font-size (text only) × bass pulse × sustained beat bloom.
  // params.intensity is intentionally absent — use pathScale for object size.
  // fontSizeMul is neutral at DEFAULT_TEXT_FONT_SIZE so existing presets are unaffected.
  const bloomFactor = am.beatPulse * effectiveOsc.beatBloom
  const fontSizeMul = isTextSource ? effectiveOsc.textFontSize / DEFAULT_TEXT_FONT_SIZE : 1

  let baseScale: number
  if (isTextSource) {
    // Text fit: compute the scale using zero-spacing bounds so default settings
    // keep the whole word on screen, while higher letter-spacing intentionally
    // widens the text (the fit baseline doesn't contract as spacing grows).
    const trimmed = effectiveOsc.text.trim()
    const res     = clamp(Math.round(effectiveOsc.pathResolution), 64, 2048)

    // Retrieve (or generate) the zero-spacing point set for this text.
    // Zero-spacing bounds are the canonical baseline; current-spacing points
    // are used only as a cold-start fallback (first frame before cache is warm).
    let fitPoints: OscillatorGlyphPoint[] | null = null
    if (trimmed) {
      if (effectiveOsc.textFontId) {
        // OpenType: look for the pre-computed zero-spacing entry in the params cache.
        const zeroOTKey = `${effectiveOsc.textFontId}:${trimmed}:0:${res}`
        fitPoints = params.oscillatorTextPointCache[zeroOTKey] ?? null
      }
      if (!fitPoints) {
        // Canvas fallback: look in the local path cache, generating on demand if absent.
        const zeroCanvasKey = `text:${trimmed}:${res}:0`
        if (!pathCache.has(zeroCanvasKey)) {
          const pts = textToGlyphPoints(trimmed, res, { letterSpacing: 0 })
          cachePut(zeroCanvasKey, pts)
        }
        fitPoints = pathCache.get(zeroCanvasKey) ?? null
      }
    }
    // Cold-start fallback: zero-spacing OpenType cache not yet populated.
    if (!fitPoints) fitPoints = basePoints

    let maxAbsX = 1e-6, maxAbsY = 1e-6
    for (const p of fitPoints) {
      const ax = Math.abs(p.x); if (ax > maxAbsX) maxAbsX = ax
      const ay = Math.abs(p.y); if (ay > maxAbsY) maxAbsY = ay
    }
    baseScale = computeTextFitScale(W, H, maxAbsX, maxAbsY, effectiveOsc.pathScale, fontSizeMul)
  } else {
    baseScale = computePathBaseScale(W, H, effectiveOsc.pathScale, am.bassPulse, bloomFactor)
  }

  // Glow scales with intensity so the object looks dimmer/brighter as expected.
  const glowBase    = (params.glow * (10 + am.glowBoost) + bass * 8) * visualIntensity

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

  // Per-character audio transform setup.
  // charCenters is non-null only when text points carry characterIndex metadata.
  // Legacy cached text (no characterIndex) falls back to the old global behavior.
  const hasCharGroups = isTextSource && basePoints.some(p => p.characterIndex != null)
  const charCenters   = hasCharGroups ? computeCharCenters(basePoints) : null

  // Precompute per-character reaction weights for this frame (constant across traces).
  // Each entry scales bassPulse-delta, midTwistAmount, and bloomFactor independently
  // so different letter-reaction modes animate each letter differently.
  const letterReactionMode: OscillatorTextLetterReactionMode =
    effectiveOsc.textLetterReactionMode ?? 'uniform'
  const charWeightsMap = new Map<number, ReturnType<typeof getCharReactionWeights>>()
  if (charCenters !== null && letterReactionMode !== 'custom') {
    // numChars uses the max visible characterIndex + 1 (not charCenters.size) so that
    // ripple mode normalizes correctly when spaces create gaps in the index sequence.
    // Example: "HI Y" has visible chars at ci=0,1,3 → numChars=4, ripple norm = ci/3.
    const numChars = charCenters.size > 0 ? Math.max(...charCenters.keys()) + 1 : 1
    for (const ci of charCenters.keys()) {
      charWeightsMap.set(ci, getCharReactionWeights(letterReactionMode, ci, numChars, t))
    }
  }

  // In custom mode, build a lookup from characterIndex → its assignments.
  // Stale entries (ci not present in charCenters) are silently ignored — this
  // correctly handles both text-shortening and spaces in the middle of text.
  const assignmentsByChar = new Map<number, LetterReactionAssignment[]>()
  if (letterReactionMode === 'custom' && charCenters !== null) {
    for (const asgn of effectiveOsc.textLetterAssignments ?? []) {
      if (!charCenters.has(asgn.characterIndex)) continue
      const list = assignmentsByChar.get(asgn.characterIndex)
      if (list) list.push(asgn)
      else assignmentsByChar.set(asgn.characterIndex, [asgn])
    }
  }

  // Text-specific waveform: build per-point local progress metadata once,
  // reuse across all trace passes.  null when mode is 'off' or source is not text.
  const isTextWaveActive = effectiveOsc.sourceType === 'text' && effectiveOsc.textWaveformMode !== 'off'
  const textWaveMeta     = isTextWaveActive
    ? buildTextWaveformMeta(basePoints, sourceGroups, effectiveOsc.text)
    : null
  const textWaveScrollPhase = isTextWaveActive
    ? fract(t * 0.001 * params.motion * effectiveOsc.textWaveformScroll)
    : 0

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

      // Per-character local transforms (text with characterIndex metadata).
      if (charCenters !== null && p.characterIndex != null) {
        const cc = charCenters.get(p.characterIndex)
        if (cc) {
          if (letterReactionMode === 'custom') {
            // Custom mode: apply explicit LetterReactionAssignment entries.
            // Letters without an assignment remain static at their layout position.
            const assignments = assignmentsByChar.get(p.characterIndex)
            if (assignments && assignments.length > 0) {
              const acc: CustomTargetDelta = {
                ldx: px - cc.cx, ldy: py - cc.cy,
                dOffX: 0, dOffY: 0, jitter: 0,
              }
              for (const asgn of assignments) {
                const sig = evalCustomSignal(
                  asgn.source, bass, mid, high, am.beatPulse,
                  asgn.phaseOffset, asgn.invert,
                )
                applyCustomTargetDelta(asgn.target, sig, asgn.amount, acc)
              }
              px = cc.cx + acc.dOffX + acc.ldx
              py = cc.cy + acc.dOffY + acc.ldy
              if (acc.jitter > 0) {
                const jSeed = i * 31.71 + Math.floor(t / 4) + p.characterIndex * 999
                const jrand = (seededRandom(jSeed) - 0.5) * 2
                const nx = p.normalX ?? Math.cos(p.progress * Math.PI * 2)
                const ny = p.normalY ?? Math.sin(p.progress * Math.PI * 2)
                px += nx * jrand * acc.jitter
                py += ny * jrand * acc.jitter
              }
            }
          } else {
            // Automatic modes (uniform / alternating / frequencySplit / ripple):
            // Bass/bloom and mid-twist scaled by the per-mode weight for this char.
            const w             = charWeightsMap.get(p.characterIndex) ?? { bassScale: 1, midScale: 1, bloomScale: 1 }
            const charBassScale = 1 + (am.bassPulse - 1) * w.bassScale
            const charBloom     = bloomFactor * w.bloomScale
            const charScale     = charBassScale * (1 + charBloom * 0.4)
            const charMidTwist  = am.midTwistAmount * w.midScale

            let ldx = px - cc.cx
            let ldy = py - cc.cy

            if (charMidTwist !== 0) {
              const twAngle = (p.localProgress ?? p.progress) * Math.PI * 2 * charMidTwist
              const cosTw   = Math.cos(twAngle)
              const sinTw   = Math.sin(twAngle)
              const tx = ldx * cosTw - ldy * sinTw
              const ty = ldx * sinTw + ldy * cosTw
              ldx = tx
              ldy = ty
            }

            ldx *= charScale
            ldy *= charScale
            px = cc.cx + ldx
            py = cc.cy + ldy
          }
        }
      } else {
        // Non-text or legacy text (no characterIndex): global mid-twist around word origin
        if (am.midTwistAmount !== 0) {
          const twAngle = p.progress * Math.PI * 2 * am.midTwistAmount
          const cosTw   = Math.cos(twAngle)
          const sinTw   = Math.sin(twAngle)
          const tx = px * cosTw - py * sinTw
          const ty = px * sinTw + py * cosTw
          px = tx
          py = ty
        }
      }

      // Per-point audio displacement in normalised space.
      // Text with textWaveformMode !== 'off' uses the letter-local waveform path;
      // all other sources (and text with mode 'off') use the generic path.
      if (textWaveMeta !== null) {
        const r = applyTextWaveformDisplacement(
          px, py, p.x, p.y,
          p.normalX ?? 0, p.normalY ?? 0,
          i,
          textWaveMeta,
          effectiveOsc.textWaveformMode,
          effectiveOsc.textWaveformAmount,
          effectiveOsc.textWaveformCycles,
          textWaveScrollPhase,
          timeDomainData,
          bass,
        )
        px = r.px
        py = r.py
      } else {
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
        tctx.lineWidth   = (1.2 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
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
        tctx.lineWidth   = (1.0 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
        for (const group of screenGroups) drawConnectedPath(tctx, group, close)
        break
      }
      case 'dots': {
        const dotR = Math.max(0.5, (0.8 + bass) * am.lineWidthBoost * dpr * intensityLineBoost)
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
        tctx.lineWidth   = (1.5 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
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

// ── SVG auto-mode helper ──────────────────────────────────────────────────────

function hasSvgGlyphPoints(osc: OscillatorSettings, params: ReactRenderParams): boolean {
  const res     = clamp(Math.round(osc.pathResolution), 64, 2048)
  const glyphId = osc.selectedSvgId ? `glyph-media:${osc.selectedSvgId}` : null
  const asset   = glyphId ? params.oscillatorGlyphAssets.find(a => a.id === glyphId) : undefined
  if (!asset) return false
  const key = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
  if (params.oscillatorGlyphPointCache[key]) return true
  return findNearestSvgGlyphCacheEntry(params.oscillatorGlyphPointCache, asset.id, res, asset.contentHash) !== null
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

  // Original Artwork path: svgVisual (legacy) or svg with originalArtwork mode.
  // For 'auto' mode with no compiled glyph points, also falls back to originalArtwork.
  if (osc.sourceType === 'svgVisual') {
    renderOriginalArtwork(ctx, frame, preset, params)
    return
  }
  if (osc.sourceType === 'svg') {
    const wantsOriginal = osc.svgRenderMode === 'originalArtwork' ||
      (osc.svgRenderMode === 'auto' && !hasSvgGlyphPoints(osc, params))
    if (wantsOriginal) {
      renderOriginalArtwork(ctx, frame, preset, params)
      return
    }
  }

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

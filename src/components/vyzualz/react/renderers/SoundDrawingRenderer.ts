import type {
  ClassicScopeMode,
  ReactPreset,
  ReactSectionType,
  OscillatorGlyphPoint,
  OscillatorSettings,
  OscillatorTextWaveformMode,
  OscillatorTextLetterReactionMode,
  LetterReactionAssignment,
  SoundDrawingLayer,
  SoundDrawingClip,
} from '../ReactTypes'
import { getCharReactionWeights } from './letterReactionUtils'
import { evalCustomSignal, applyCustomTargetDelta } from './letterReactionCustom'
import type { CustomTargetDelta } from './letterReactionCustom'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { getOrCreateOffscreen, seededRandom } from './reactRenderUtils'
import { generateBuiltinShapePoints, clamp } from './oscillatorPathUtils'
import {
  buildScopeTracePoints,
  canRenderProfessionalScope,
  disposeScopeSignalCore,
  getScopeSignalCore,
  toStereoScopeFrame,
} from './soundDrawingScopeGeometry'
import { textToGlyphPoints } from './textGlyphUtils'
import {
  clearRuntimeOpenTypeTextGeometry,
  getRuntimeOpenTypeTextGeometryStats,
  getRuntimeOpenTypeTextPoints,
} from './soundDrawingTextGeometryCache'
import {
  EMPTY_LYRIC_PLAYBACK_STATE,
  type LyricPlaybackState,
} from '../../../../features/lyrics/runtime/lyricPlaybackResolver'
import { SoundDrawingLyricTextRuntime } from '../../../../features/lyrics/runtime/soundDrawingLyricText'
import { getSvgVisualEntry } from './svgVisualCache'
import { getSvgGlyphCacheKey, findNearestSvgGlyphCacheEntry } from './svgGlyphUtils'
import { getSvgGlyphAssetId, resolveUnifiedSvgSource } from '../svgSourceLifecycle'
import { createSharedPerformanceDiagnostics, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { resolveSoundDrawingPerformanceFrame } from '../soundDrawing/SoundDrawingPerformanceEngine'
import { normalizeSoundDrawingVisualSize } from '../soundDrawing/SoundDrawingVisualSize'
import {
  disposeSoundDrawingBehaviorRuntime,
  synchronizeSoundDrawingBehaviorRuntime,
} from '../soundDrawing/SoundDrawingBehaviorRuntime'
import {
  MAX_SOUND_DRAWING_PERFORMANCE_LAYERS,
  MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES,
  MAX_SOUND_DRAWING_PERFORMANCE_TRACES,
  type SoundDrawingBlendMode,
  type SoundDrawingColorRole,
  type SoundDrawingResolvedPerformanceFrame,
  type SoundDrawingResolvedPerformanceLayer,
  type SoundDrawingPerformanceTemporalState,
  type SoundDrawingIdentityProfile,
  type SoundDrawingModulationRoute,
  type SoundDrawingPerformanceSettings,
  type SoundDrawingSourceTreatment,
} from '../soundDrawing/SoundDrawingPerformanceTypes'
import {
  clearSharedPerformanceDiagnostics,
  publishSharedPerformanceDiagnostics,
} from '../SharedPerformanceDiagnosticsStore'
import {
  disposeLivingRibbonCanvasRuntimes,
  getLivingRibbonCanvasDiagnostics,
  pauseLivingRibbonCanvasRuntimes,
  prepareLivingRibbonCanvasFrame,
  renderLivingRibbonCanvasLayer,
  resetLivingRibbonCanvasRuntimes,
  usesLivingRibbonCanvasRenderer,
} from './LivingRibbonCanvas2DRenderer'
import { rasterizeVectorBeamSegments, velocityRatioFromSpacingPx } from '../vectorBeam/VectorBeamRasterizer'
import type { VectorBeamColor, VectorBeamPoint, VectorBeamSegment } from '../vectorBeam/VectorBeamTypes'
import {
  applyVectorBeamScannerKinematics,
  type VectorBeamScannerKinematicsSettings,
} from '../vectorBeam/VectorBeamScannerKinematics'
// parseSvgToGlyphPoints is intentionally NOT imported here.
// SVG parsing happens at upload/select/resolution-change time in reactStore.ts.
// This renderer only reads pre-prepared points from params.oscillatorGlyphPointCache.

// ── Trail canvas pool (per ctx) ───────────────────────────────────────────────
const trailMap = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>()
const soundDrawingPerformanceContextMap = new WeakMap<CanvasRenderingContext2D, SharedPerformanceContext>()
const soundDrawingPerformanceTemporalStateMap = new WeakMap<
  CanvasRenderingContext2D,
  SoundDrawingPerformanceTemporalState
>()
const SOUND_DRAWING_DIAGNOSTIC_EVENT_REASONS = new Set([
  'beat',
  'downbeat',
  'kick',
  'snare',
  'hat',
  'transient',
  'semanticMoment',
])

function getTrail(ctx: CanvasRenderingContext2D, W: number, H: number): HTMLCanvasElement {
  return getOrCreateOffscreen(trailMap, ctx, W, H)
}

// ── Beat envelope (per canvas context) ─────────────────────────────────────────

const beatEnvelopeMap = new WeakMap<CanvasRenderingContext2D, number>()
const BEAT_DECAY = 0.86

// ── Additive trace blending ────────────────────────────────────────────────────
// Reference oscilloscope footage shows core-to-white / halo-to-hue desaturation,
// the signature of additive accumulation (not 'screen' blend). Authored performance
// layers already resolve their own blend mode; the legacy/manual and clip pipelines
// have no layer to read from, so they default to 'lighter'.
const SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE: SoundDrawingBlendMode = 'lighter'

// ── Trail decay (per canvas context) ──────────────────────────────────────────
// Reference footage: per-frame retention ~0.35 at 30fps / ~0.59 at 60fps, decaying
// to the noise floor in ~100ms (3-4 visible trail frames). 0.59 ≈ 0.35^0.5, i.e. the
// underlying decay is a continuous rate expressed per 1/30s reference frame and then
// raised to the actual elapsed-time ratio, so the look holds across 30/60/120fps.
const SOUND_DRAWING_TRAIL_REFERENCE_FPS = 30
const SOUND_DRAWING_TRAIL_RETENTION_MIN = 0.35 // trailDecay = 1 (fastest)
const SOUND_DRAWING_TRAIL_RETENTION_MAX = 0.97 // trailDecay = 0 (slowest)
const trailDecayTimeMap = new WeakMap<CanvasRenderingContext2D, number>()

/** Maps the 0–1 trailDecay control to a per-reference-frame (1/30s) retention fraction. */
export function computeSoundDrawingTrailRetentionPerReferenceFrame(trailDecay: number): number {
  const t = clamp(trailDecay, 0, 1)
  return SOUND_DRAWING_TRAIL_RETENTION_MAX - t * (SOUND_DRAWING_TRAIL_RETENTION_MAX - SOUND_DRAWING_TRAIL_RETENTION_MIN)
}

/** Frame-rate-independent trail retention over an actual elapsed `dtSeconds`. */
export function computeSoundDrawingTrailRetention(trailDecay: number, dtSeconds: number): number {
  const perReferenceFrame = computeSoundDrawingTrailRetentionPerReferenceFrame(trailDecay)
  const frameRatio = Math.max(0, dtSeconds) * SOUND_DRAWING_TRAIL_REFERENCE_FPS
  return Math.pow(clamp(perReferenceFrame, 0.0001, 0.9999), frameRatio)
}

/** Fraction of trail energy to erase this frame (destination-out alpha), floored so the trail never fully freezes. */
export function computeSoundDrawingTrailDecayAlpha(trailDecay: number, dtSeconds: number): number {
  return clamp(1 - computeSoundDrawingTrailRetention(trailDecay, dtSeconds), 0.01, 1)
}

/** Tracks per-context wall-clock time so trail decay scales by actual elapsed time, not frame count. */
function tickTrailDeltaSeconds(ctx: CanvasRenderingContext2D, t: number): number {
  const prevT = trailDecayTimeMap.get(ctx)
  trailDecayTimeMap.set(ctx, t)
  if (prevT === undefined) return 1 / SOUND_DRAWING_TRAIL_REFERENCE_FPS
  return Math.max(0, Math.min((t - prevT) / 1000, 0.5))
}

// ── Inverse-velocity stroke modulation ────────────────────────────────────────
// Physical oscilloscope beams dwell longer (brighter) at cusps/turning points and
// sweep faster (dimmer) across straight runs. velocityRatio (from
// resamplePointsWithVelocity, or derived from segment length when that signal is
// absent) is 0..1, low sweep velocity → high ratio, and is consumed by
// resolveVectorBeamSegmentExposure in the shared vector-beam rasterizer.
//
// The alpha/line-width/bucket/glow-radius tuning constants that used to live here
// were superseded by that shared rasterizer, which owns stroke appearance for
// every trace path (core+halo widths and colors come from LaserDmxBeamOptics /
// LaserDmxColorScience, run batching from its own APPEARANCE_BUCKETS).

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

function tickTwistSign(ctx: CanvasRenderingContext2D, beatHit: boolean, beatPhase: number, altTwist: boolean): 1 | -1 {
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

interface RotState {
  phase: number
  prevT: number
  prevSourceKey: string
}
const rotPhaseMap = new WeakMap<CanvasRenderingContext2D, RotState>()

function tickRotPhase(
  ctx: CanvasRenderingContext2D,
  t: number,
  sourceKey: string,
  shouldRotate: boolean,
  angularVelocity: number,
): number {
  const prev = rotPhaseMap.get(ctx) ?? {
    phase: 0,
    prevT: t,
    prevSourceKey: '',
  }
  const sourceChanged = sourceKey !== prev.prevSourceKey
  const deltaT_s = sourceChanged ? 0 : Math.min((t - prev.prevT) / 1000, 0.1)
  const newPhase = sourceChanged || !shouldRotate ? 0 : prev.phase + deltaT_s * angularVelocity
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

type ScopeMode =
  | 'waveform'
  | 'lissajous'
  | 'radialScope'
  | 'spiralScope'
  | 'pathScope'
  | 'professionalScope'

/**
 * Maps a persisted classic mode onto a draw routine.
 *
 * `monoDelayXY` and the legacy `lissajous` both route to the same draw path:
 * they are the same visual, and renaming it must not change a single pixel of an
 * existing project.
 */
export function scopeModeForClassicMode(classicMode: ClassicScopeMode): ScopeMode {
  switch (classicMode) {
    case 'lissajous':
    case 'monoDelayXY':
      return 'lissajous'
    case 'radialScope':
      return 'radialScope'
    case 'spiralScope':
      return 'spiralScope'
    case 'professionalScope':
      return 'professionalScope'
    case 'waveform':
    case 'sectionAuto':
    default:
      return 'waveform'
  }
}

function modeForSection(type: ReactSectionType | null): ScopeMode {
  switch (type) {
    case 'intro':
      return 'waveform'
    case 'verse':
      return 'waveform'
    case 'build':
      return 'radialScope'
    case 'drop':
      return 'lissajous'
    case 'breakdown':
      return 'spiralScope'
    case 'outro':
      return 'waveform'
    default:
      return 'waveform'
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

// ── Per-frame clip state ──────────────────────────────────────────────────────
// Set by ReactPlaceholderCanvas before each renderReactEngine call so that
// clip data reaches SoundDrawingRenderer without touching ReactRenderParams.
let _sdLayers: SoundDrawingLayer[] = []
let _sdClips:  SoundDrawingClip[]  = []
let _sdLyricPlayback: LyricPlaybackState = EMPTY_LYRIC_PLAYBACK_STATE
let _sdLyricDocumentKey = 'none:none:none:0'
let _sdExpectedAudioTrackId: string | null = null
let _sdTrailResetRevision = 0
const trailResetSeenMap = new WeakMap<CanvasRenderingContext2D, string>()
const authoredTrailIdentityMap = new WeakMap<CanvasRenderingContext2D, string>()
const livingRibbonResetSeenMap = new WeakMap<CanvasRenderingContext2D, number>()

const lyricTextRuntime = new SoundDrawingLyricTextRuntime()
let textGeometryBuildCount = 0

function clearTextPathEntries(): void {
  for (const key of pathCache.keys()) {
    if (key.startsWith('text:')) pathCache.delete(key)
  }
}

/** Releases bounded text geometry and previous-lyric state on project/font teardown. */
export function clearSoundDrawingRuntimeCaches(): void {
  lyricTextRuntime.clear()
  clearRuntimeOpenTypeTextGeometry()
  clearTextPathEntries()
}

/** Releases per-canvas trails and animation accumulators when Sound Drawing is no longer live. */
export function disposeSoundDrawingRenderer(
  ctx: CanvasRenderingContext2D,
  options: { affectProductionDiagnostics?: boolean } = {},
): void {
  const trail = trailMap.get(ctx)
  if (trail) {
    trail.getContext('2d')?.clearRect(0, 0, trail.width, trail.height)
    trail.width = 1
    trail.height = 1
  }
  const artwork = artworkPaletteMap.get(ctx)
  if (artwork) {
    artwork.getContext('2d')?.clearRect(0, 0, artwork.width, artwork.height)
    artwork.width = 1
    artwork.height = 1
  }
  trailMap.delete(ctx)
  artworkPaletteMap.delete(ctx)
  beatEnvelopeMap.delete(ctx)
  twistSignMap.delete(ctx)
  twistPhasePrevMap.delete(ctx)
  rotPhaseMap.delete(ctx)
  trailDecayTimeMap.delete(ctx)
  trailResetSeenMap.delete(ctx)
  authoredTrailIdentityMap.delete(ctx)
  livingRibbonResetSeenMap.delete(ctx)
  disposeLivingRibbonCanvasRuntimes(ctx)
  soundDrawingPerformanceContextMap.delete(ctx)
  const temporalState = soundDrawingPerformanceTemporalStateMap.get(ctx)
  if (temporalState) disposeSoundDrawingBehaviorRuntime(temporalState)
  soundDrawingPerformanceTemporalStateMap.delete(ctx)
  // Release the professional scope core and its point buffers with the canvas
  // that owned them; a stale core would carry trigger and filter history into
  // whatever renders next.
  disposeScopeSignalCore(ctx)
  scopeTracePointBuffers.delete(ctx)
  if (options.affectProductionDiagnostics !== false) clearSharedPerformanceDiagnostics('soundDrawing')
}

export function pauseSoundDrawingRenderer(ctx: CanvasRenderingContext2D): void {
  pauseLivingRibbonCanvasRuntimes(ctx)
}

export function getSoundDrawingRuntimeCacheStats(): {
  canvasTextEntries: number
  openTypeTextEntries: number
  previousLyricEntries: number
  textGeometryBuildCount: number
  trailResetRevision: number
} {
  let canvasTextEntries = 0
  for (const key of pathCache.keys()) {
    if (key.startsWith('text:')) canvasTextEntries += 1
  }
  return {
    canvasTextEntries,
    openTypeTextEntries: getRuntimeOpenTypeTextGeometryStats().entries,
    previousLyricEntries: lyricTextRuntime.size,
    textGeometryBuildCount,
    trailResetRevision: _sdTrailResetRevision,
  }
}

export function setSoundDrawingClipsForFrame(
  layers: SoundDrawingLayer[],
  clips:  SoundDrawingClip[],
  lyricPlayback: LyricPlaybackState = EMPTY_LYRIC_PLAYBACK_STATE,
  expectedAudioTrackId: string | null = null,
): void {
  _sdLayers = layers
  _sdClips  = clips
  _sdLyricPlayback = lyricPlayback
  _sdExpectedAudioTrackId = expectedAudioTrackId

  const nextDocumentKey = [
    expectedAudioTrackId ?? 'none',
    lyricPlayback.sourceIdentity ?? 'none',
    lyricPlayback.documentId ?? 'none',
    lyricPlayback.timelineRevision,
  ].join(':')
  if (nextDocumentKey !== _sdLyricDocumentKey) {
    _sdLyricDocumentKey = nextDocumentKey
    _sdTrailResetRevision += 1
    clearSoundDrawingRuntimeCaches()
  }
}

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

/** Test seam for verifying content-keyed geometry reuse without a render loop. */
export function getSoundDrawingPathPointsForTest(params: ReactRenderParams): OscillatorGlyphPoint[] | null {
  return getOscillatorPathPoints(params)
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
        const lh  = osc.textLineHeight ?? 1.2
        const ali = osc.textAlignment  ?? 'center'
        const points = getRuntimeOpenTypeTextPoints({
          assets: params.oscillatorFontAssets,
          preparedCache: params.oscillatorTextPointCache,
          fontId: osc.textFontId,
          text: trimmed,
          resolution: res,
          letterSpacing: osc.textLetterSpacing,
          lineHeight: lh,
          alignment: ali,
        })
        if (points) {
          textGeometryBuildCount = getRuntimeOpenTypeTextGeometryStats().buildCount
          return points
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
      const lh      = osc.textLineHeight    ?? 1.2
      const ali     = osc.textAlignment     ?? 'center'
      const key = `text:${trimmed}:${res}:${spacing}:${lh}:${ali}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const pts = textToGlyphPoints(trimmed, res, {
        letterSpacing: spacing,
        lineHeight: lh,
        alignment: ali,
      })
      cachePut(key, pts)
      textGeometryBuildCount += 1
      return pts
    }
    case 'svgGlyph':
    case 'svg': {
      const unified = resolveUnifiedSvgSource(osc)
      const glyphId = unified?.mediaId
        ? getSvgGlyphAssetId(unified.mediaId)
        : osc.sourceType === 'svgGlyph'
          ? osc.selectedGlyphId
          : null
      const asset = glyphId ? params.oscillatorGlyphAssets.find((candidate) => candidate.id === glyphId) : undefined
      if (asset) {
        const cacheKey = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
        const prepared = params.oscillatorGlyphPointCache[cacheKey]
        if (prepared) return prepared
        const nearest = findNearestSvgGlyphCacheEntry(
          params.oscillatorGlyphPointCache,
          asset.id,
          res,
          asset.contentHash,
        )
        if (nearest) return nearest
        if (import.meta.env.DEV) {
          console.warn(
            `[SoundDrawingRenderer] No compiled points for SVG "${asset.id}" at res ${res} — falling back to circle`,
          )
        }
      }
      const key = `builtin:circle:${res}`
      const cached = pathCache.get(key)
      if (cached) return cached
      const points = generateBuiltinShapePoints('circle', res)
      cachePut(key, points)
      return points
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
  mediaId: string,
): void {
  const { W, H, t, dpr } = frame
  const osc  = params.oscillator
  const bass = frame.audio.bass * params.bassReactivity
  const mid  = frame.audio.mid
  const high = frame.audio.high

  const entry = getSvgVisualEntry(mediaId)

  // Trail canvas for decay / ghost-echo effect
  const trailCanvas = getTrail(ctx, W, H)
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) return

  const beatEnvelope = tickBeatEnvelope(tctx, frame.beatHit)

  // Fade trail (frame-rate independent; erases toward zero energy under additive blending)
  const dtSeconds = tickTrailDeltaSeconds(ctx, t)
  fadeTrail(trailCanvas, computeSoundDrawingTrailDecayAlpha(params.trailDecay, dtSeconds))

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
  const maxSide     = Math.min(W, H) * normalizeSoundDrawingVisualSize(osc.pathScale)
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
  const jx = sampleCoherentSoundDrawingNoise(37, t, 5) * jitterAmt * Math.min(W, H) * 0.15
  const jy = sampleCoherentSoundDrawingNoise(83, t, 4.5) * jitterAmt * Math.min(W, H) * 0.15

  // Audio displacement: XY position offset from time-domain waveform
  const dispAmt = clamp(osc.audioDisplacement * (1 + bass * 0.3), 0, 0.25)
  const tdLen   = frame.timeDomainData ? frame.timeDomainData.length : 256
  const tdX     = getTimeDomainNorm(frame.timeDomainData, Math.floor(tdLen * 0.1)) * dispAmt * Math.min(W, H) * 0.3
  const tdY     = getTimeDomainNorm(frame.timeDomainData, Math.floor(tdLen * 0.6)) * dispAmt * Math.min(W, H) * 0.3

  const cx = W / 2 + tdX + jx
  const cy = H / 2 + tdY + jy

  const numTraces       = clamp(osc.duplicateTraces, 1, 6)
  const visualIntensity = clamp(params.intensity ?? 1, 0, 2)
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
        tctx.globalCompositeOperation = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE
        tctx.drawImage(offscreen, 0, 0)
        tctx.restore()
      }
    } else {
      tctx.save()
      tctx.translate(cx, cy)
      tctx.rotate(tRot)
      tctx.globalAlpha              = traceAlpha
      tctx.globalCompositeOperation = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE
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
  return raw / 128.0 - 1.0 // -1..1
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
      x: timeDomainData[idxL] / 128 - 1,
      y: timeDomainData[idxR] / 128 - 1,
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

function fract(v: number): number {
  return v - Math.floor(v)
}

function getPointBounds(points: OscillatorGlyphPoint[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
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
  const xRange = maxX - minX || 1
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

  return {
    minX,
    maxX,
    minY,
    maxY,
    charCount,
    localProgressByPointIndex: local,
  }
}

/**
 * Applies text-specific waveform displacement to a single point.
 * origX/origY are the pre-midTwist coordinates (for radial direction).
 * px/py are the post-midTwist working coordinates that get displaced.
 * Returns new { px, py }.
 */
export function applyTextWaveformDisplacement(
  px: number,
  py: number,
  origX: number,
  origY: number,
  normalX: number,
  normalY: number,
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
  const effectiveAmt = clamp(amount * (1 + bass * 0.35), 0, 0.3)
  const dispAmt        = wave * effectiveAmt

  switch (mode) {
    case 'normal':
      return { px: px + normalX * dispAmt, py: py + normalY * dispAmt }
    case 'radial': {
      const rlen = Math.sqrt(origX * origX + origY * origY)
      if (rlen > 0)
        return {
          px: px + (origX / rlen) * dispAmt,
          py: py + (origY / rlen) * dispAmt,
        }
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
  return Math.min(W, H) * 0.42 * normalizeSoundDrawingVisualSize(pathScale) * bassPulse * (1 + bloomFactor * 0.4)
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
  const fitScaleX = ((W / 2) * (1 - MARGIN)) / maxAbsX
  const fitScaleY = ((H / 2) * (1 - MARGIN)) / maxAbsY
  return Math.min(fitScaleX, fitScaleY) * normalizeSoundDrawingVisualSize(pathScale) * fontSizeMul
}

/**
 * Computes the centroid (mean x, mean y) of each character's points in
 * normalized glyph space.  Keyed by `characterIndex`.
 *
 * Using the centroid (not bbox center) guarantees that scaling or rotating
 * local offsets around it leaves the centroid unchanged — the expected layout
 * position stays anchored while audio-reactive motion expands outward.
 */
export function computeCharCenters(points: OscillatorGlyphPoint[]): Map<number, { cx: number; cy: number }> {
  const sums = new Map<number, { sx: number; sy: number; n: number }>()
  for (const p of points) {
    const ci = p.characterIndex
    if (ci == null) continue
    const s = sums.get(ci)
    if (s) {
      s.sx += p.x
      s.sy += p.y
      s.n++
    } else sums.set(ci, { sx: p.x, sy: p.y, n: 1 })
  }
  const centers = new Map<number, { cx: number; cy: number }>()
  for (const [ci, s] of sums) centers.set(ci, { cx: s.sx / s.n, cy: s.sy / s.n })
  return centers
}

// ── Canvas path helpers ───────────────────────────────────────────────────────

// ── Vector-beam segment construction ──────────────────────────────────────────
// Every trace draw path below builds an array of shared VectorBeamSegments and
// hands it to the ONE shared rasterizer (rasterizeVectorBeamSegments), instead
// of issuing its own beginPath/stroke sequence — the same segment model and
// beam-optics/color-science pipeline src/.../renderers/laserDmx/ uses to author
// its own scene frames. A galvo scanner and an oscilloscope trace are both XY
// vector displays; this is where that gets shared instead of duplicated.

function vectorBeamColorFromHex(hex: string, alpha: number): VectorBeamColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const value = match?.[1] ?? '4ac7db'
  return {
    r: parseInt(value.slice(0, 2), 16) / 255,
    g: parseInt(value.slice(2, 4), 16) / 255,
    b: parseInt(value.slice(4, 6), 16) / 255,
    a: clamp(alpha, 0, 1),
  }
}

/** Angle in degrees between two direction vectors: 0 = continues straight, 180 = full reversal. */
function directionTurnAngleDeg(dx1: number, dy1: number, dx2: number, dy2: number): number {
  const denom = Math.hypot(dx1, dy1) * Math.hypot(dx2, dy2)
  if (denom <= 1e-8) return 0
  const cos = clamp((dx1 * dx2 + dy1 * dy2) / denom, -1, 1)
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Builds shared vector-beam segments from a point path, deriving dwellWeight
 * from corner/cusp detection (the sharper the direction change at a segment's
 * origin, the higher its dwell — a physical beam lingers longer at turning
 * points) and velocityRatio from `velocityRatios` (Phase 1's per-point inverse-
 * velocity signal) when supplied, falling back to a dwell-derived estimate for
 * sources that never went through resamplePointsWithVelocity (built-in shapes, SVG).
 */
/** Reads the (optional, default-off) scanner kinematics knobs off an oscillator's settings. */
function resolveVectorBeamScannerKinematicsSettings(osc: OscillatorSettings): VectorBeamScannerKinematicsSettings {
  return {
    enabled: osc.scannerKinematicsEnabled === true,
    cornerDwellMicros: osc.scannerCornerDwellMicros,
    blankingDelayMicros: osc.scannerBlankingDelayMicros,
    maxAngularVelocityDegPerSec: osc.scannerMaxAngularVelocityDegPerSec,
  }
}

function buildVectorBeamSegmentsFromPoints(
  points: readonly VectorBeamPoint[],
  close: boolean,
  color: VectorBeamColor,
  velocityRatios?: readonly (number | undefined)[] | null,
  kinematics?: VectorBeamScannerKinematicsSettings,
): VectorBeamSegment[] {
  const n = points.length
  if (n < 2) return []
  const segmentCount = close ? n : n - 1
  const segments: VectorBeamSegment[] = []
  for (let s = 0; s < segmentCount; s++) {
    const originIdx = s
    const targetIdx = (s + 1) % n
    const origin = points[originIdx]
    const target = points[targetIdx]

    let dwellWeight = 0
    const hasPrior = close || originIdx > 0
    if (hasPrior) {
      const prior = points[(originIdx - 1 + n) % n]
      const turnAngle = directionTurnAngleDeg(
        origin.x - prior.x, origin.y - prior.y,
        target.x - origin.x, target.y - origin.y,
      )
      dwellWeight = clamp(turnAngle / 150, 0, 1)
    }

    // Prefer the measured pre-resample velocity signal (text/font glyph sources).
    // Otherwise derive it from this segment's own on-screen length: a short hop
    // means a slow beam and therefore a brighter, longer-dwelled stroke. The old
    // fallback (1 - dwellWeight * 0.5) was physically inverted — it made corners,
    // which are the SLOWEST part of a sweep, read as the fastest.
    const measuredRatio = velocityRatios?.[originIdx]
    const velocityRatio = clamp(
      measuredRatio ?? velocityRatioFromSpacingPx(Math.hypot(target.x - origin.x, target.y - origin.y)),
      0,
      1,
    )
    segments.push({
      origin,
      target,
      color,
      density: 1,
      dwellWeight,
      velocityRatio,
      historyWeight: color.a,
    })
  }
  return kinematics
    ? (applyVectorBeamScannerKinematics(segments, kinematics) as VectorBeamSegment[])
    : segments
}

function circleVectorBeamPoints(cx: number, cy: number, radius: number, count = 64): VectorBeamPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
  })
}

/**
 * Strokes a path through the shared vector-beam rasterizer. Reads the caller's
 * current globalAlpha (as base density), lineWidth (as base stroke width), and
 * globalCompositeOperation (as blend mode) — the same "set state, then draw"
 * contract the old direct-stroke call sites already used — but resolves color
 * from the explicit `colorHex` parameter rather than reading `tctx.strokeStyle`
 * back, since browsers may normalize a color string on readback (e.g. to
 * `rgb(...)`), which would silently break hex parsing.
 * `ratios` carries Phase 1's per-point velocityRatio when available (text/font
 * glyph sources); dwell-derived geometry is computed either way, so sources
 * with no velocity signal (built-in shapes, SVG) still render through the same
 * shared beam-optics/color-science pipeline as everything else.
 */
function drawConnectedPathWithVelocity(
  tctx: CanvasRenderingContext2D,
  pts: [number, number][],
  ratios: (number | undefined)[] | null,
  close: boolean,
  colorHex: string,
  kinematics?: VectorBeamScannerKinematicsSettings,
): void {
  if (pts.length < 2) return
  const baseAlpha = tctx.globalAlpha
  const baseLineWidth = tctx.lineWidth
  const blendMode = tctx.globalCompositeOperation as GlobalCompositeOperation

  const points: VectorBeamPoint[] = pts.map(([x, y]) => ({ x, y }))
  const color = vectorBeamColorFromHex(colorHex, baseAlpha)
  const segments = buildVectorBeamSegmentsFromPoints(points, close, color, ratios, kinematics)
  rasterizeVectorBeamSegments(tctx, segments, { blendMode, baseWidthPx: baseLineWidth, intensity: 1 })
}

function drawDotPoints(tctx: CanvasRenderingContext2D, pts: [number, number][], r: number): void {
  tctx.beginPath()
  for (const [x, y] of pts) {
    tctx.moveTo(x + r, y)
    tctx.arc(x, y, r, 0, Math.PI * 2)
  }
  tctx.fill()
}

// ── Fade trail each frame ─────────────────────────────────────────────────────
// Under additive ('lighter') blending the trail buffer holds accumulated light
// energy on a transparent base — it must asymptote to zero energy, not toward the
// background color (the background is composited underneath separately by callers).
// destination-out erases by alpha regardless of what blend mode drew the pixels.

function fadeTrail(trailCanvas: HTMLCanvasElement, decayAlpha: number): void {
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) return
  tctx.save()
  tctx.globalCompositeOperation = 'destination-out'
  tctx.globalAlpha = clamp(decayAlpha, 0, 1)
  tctx.fillStyle = '#000000'
  tctx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)
  tctx.restore()
}

// ── Waveform mode ─────────────────────────────────────────────────────────────

function drawWaveformOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): void {
  const { audio, timeDomainData } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 256
  const stepX = W / pts

  const lineColor = preset.palette.primary

  const layers = [
    {
      yOff: H * 0.25,
      scaleY: H * 0.18,
      color: preset.palette.secondary,
      alpha: 0.4,
    },
    { yOff: H * 0.5,  scaleY: H * 0.24, color: lineColor,                 alpha: 0.9 },
    {
      yOff: H * 0.75,
      scaleY: H * 0.18,
      color: preset.palette.secondary,
      alpha: 0.4,
    },
  ]

  const baseWidthPx = (1.2 + bass * 2) * dpr * params.intensity
  const kinematics = resolveVectorBeamScannerKinematicsSettings(params.oscillator)

  for (const layer of layers) {
    const points: VectorBeamPoint[] = new Array(pts + 1)
    for (let i = 0; i <= pts; i++) {
      const v = getTimeDomainNorm(timeDomainData, i)
      points[i] = { x: i * stepX, y: layer.yOff + v * layer.scaleY * (1 + bass * 0.5) * params.intensity }
    }
    const color = vectorBeamColorFromHex(layer.color, layer.alpha * intMul)
    const segments = buildVectorBeamSegmentsFromPoints(points, false, color, undefined, kinematics)
    rasterizeVectorBeamSegments(tctx, segments, { blendMode, baseWidthPx, intensity: 1 })
  }
}

// ── Professional scope mode ───────────────────────────────────────────────────
//
// Draws the resolved trace from the professional signal core. Unlike the legacy
// modes below, the geometry here is a measurement: the trace's shape carries
// real information about channel relationships, so nothing in this path applies
// decorative deformation that would corrupt the reading. Audio-reactive
// treatment is limited to beam width and brightness.

function drawProfessionalScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): boolean {
  const osc = params.oscillator
  if (!canRenderProfessionalScope(osc, frame)) return false

  const capture = toStereoScopeFrame(frame)
  if (!capture) return false

  const core = getScopeSignalCore(ctx)
  const trace = core.process({
    state: osc.scope,
    frame: capture,
    // Path resolution controls plotted point density. It deliberately does not
    // control the timebase — how much audio is shown is the timebase's job.
    requestedPoints: Math.max(64, Math.round(osc.pathResolution)),
    deltaSeconds: frame.deltaTimeSec ?? 1 / 60,
    bpm: frame.bpm > 0 ? frame.bpm : 0,
    timingDiscontinuity: frame.timingDiscontinuity === true,
  })
  if (!trace) return false

  const bass = frame.audio.bass * params.bassReactivity
  const scalePx = Math.min(W, H) * 0.42 * normalizeSoundDrawingVisualSize(osc.pathScale) * params.intensity
  const geometry = {
    W,
    H,
    scalePx,
    centerX: W / 2,
    centerY: H / 2,
    secondaryOffsetPx: H * 0.18,
  }

  const baseWidthPx = (1.0 + bass * 1.6) * dpr * params.intensity
  const kinematics = resolveVectorBeamScannerKinematicsSettings(osc)

  // Dual-channel display separates the two traces vertically so each can be read
  // on its own, rather than overlaying them into one ambiguous figure. The pair
  // straddles centre, so the primary shifts up by the same amount the secondary
  // shifts down.
  const drawsSecondary = trace.hasSecondary && trace.secondaryY != null
  const primaryOffsetPx = drawsSecondary ? -geometry.secondaryOffsetPx : 0

  const primaryPoints = getScopeTracePointBuffer(ctx, 0)
  const primaryCount = buildScopeTracePoints(trace, trace.y, geometry, primaryPoints, primaryOffsetPx)
  if (primaryCount < 2) return false

  const primarySegments = buildVectorBeamSegmentsFromPoints(
    primaryPoints, false, vectorBeamColorFromHex(preset.palette.primary, 0.9 * intMul), undefined, kinematics,
  )
  rasterizeVectorBeamSegments(tctx, primarySegments, { blendMode, baseWidthPx, intensity: 1 })

  if (drawsSecondary) {
    const secondaryPoints = getScopeTracePointBuffer(ctx, 1)
    const secondaryCount = buildScopeTracePoints(
      trace, trace.secondaryY!, geometry, secondaryPoints, geometry.secondaryOffsetPx,
    )
    if (secondaryCount >= 2) {
      const secondarySegments = buildVectorBeamSegmentsFromPoints(
        secondaryPoints, false, vectorBeamColorFromHex(preset.palette.secondary, 0.9 * intMul), undefined, kinematics,
      )
      rasterizeVectorBeamSegments(tctx, secondarySegments, { blendMode, baseWidthPx, intensity: 1 })
    }
  }

  return true
}

/** Reusable per-canvas point buffers so the scope draw path allocates nothing. */
const scopeTracePointBuffers = new WeakMap<CanvasRenderingContext2D, VectorBeamPoint[][]>()

function getScopeTracePointBuffer(ctx: CanvasRenderingContext2D, index: number): VectorBeamPoint[] {
  let buffers = scopeTracePointBuffers.get(ctx)
  if (!buffers) {
    buffers = [[], []]
    scopeTracePointBuffers.set(ctx, buffers)
  }
  return buffers[index]
}

// ── Lissajous mode ────────────────────────────────────────────────────────────

function drawLissajousOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): void {
  const { audio, timeDomainData, freqData } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 512
  const cx2 = W / 2,
    cy2 = H / 2
  const scale = Math.min(W, H) * 0.42 * (1 + bass * 0.12) * params.intensity

  const points: VectorBeamPoint[] = new Array(pts + 1)
  for (let i = 0; i <= pts; i++) {
    const st = getSynthStereo(timeDomainData, freqData, i, pts)
    points[i] = { x: cx2 + st.x * scale, y: cy2 + st.y * scale }
  }

  const baseWidthPx = (0.9 + bass * 1.5) * dpr * params.intensity
  const kinematics = resolveVectorBeamScannerKinematicsSettings(params.oscillator)

  const mainSegments = buildVectorBeamSegmentsFromPoints(
    points, false, vectorBeamColorFromHex(preset.palette.primary, 0.85 * intMul), undefined, kinematics,
  )
  rasterizeVectorBeamSegments(tctx, mainSegments, { blendMode, baseWidthPx, intensity: 1 })

  const accentSegments = buildVectorBeamSegmentsFromPoints(
    points, false, vectorBeamColorFromHex(preset.palette.accent, 0.3 * intMul), undefined, kinematics,
  )
  rasterizeVectorBeamSegments(tctx, accentSegments, { blendMode, baseWidthPx: baseWidthPx * 0.4, intensity: 1 })
}

// ── Radial scope mode ─────────────────────────────────────────────────────────

function drawRadialScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): void {
  const { audio, timeDomainData } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2 = W / 2,
    cy2 = H / 2
  const baseR  = Math.min(W, H) * 0.3 * params.intensity
  const pts    = 256

  const points: VectorBeamPoint[] = new Array(pts + 1)
  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * Math.PI * 2
    const v     = getTimeDomainNorm(timeDomainData, i)
    const r     = baseR + v * baseR * 0.55 * (1 + bass * 0.6)
    points[i] = { x: cx2 + Math.cos(angle) * r, y: cy2 + Math.sin(angle) * r }
  }

  const baseWidthPx = (1.0 + bass * 1.8) * dpr * params.intensity
  const kinematics = resolveVectorBeamScannerKinematicsSettings(params.oscillator)

  const mainSegments = buildVectorBeamSegmentsFromPoints(
    points, true, vectorBeamColorFromHex(preset.palette.secondary, 0.9 * intMul), undefined, kinematics,
  )
  rasterizeVectorBeamSegments(tctx, mainSegments, { blendMode, baseWidthPx, intensity: 1 })

  const accentPoints = circleVectorBeamPoints(cx2, cy2, baseR * 0.55)
  const accentSegments = buildVectorBeamSegmentsFromPoints(
    accentPoints, true, vectorBeamColorFromHex(preset.palette.accent, 0.35 * intMul), undefined, kinematics,
  )
  rasterizeVectorBeamSegments(tctx, accentSegments, { blendMode, baseWidthPx: baseWidthPx * 0.5, intensity: 1 })
}

// ── Spiral scope mode ─────────────────────────────────────────────────────────

function drawSpiralScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): void {
  const { audio, freqData, t } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2 = W / 2,
    cy2 = H / 2
  const pts    = 360

  const spiralR     = Math.min(W, H) * 0.35 * params.intensity
  const spiralTurns = 3.5 + audio.mid * 1.5

  const points: VectorBeamPoint[] = new Array(pts + 1)
  for (let i = 0; i <= pts; i++) {
    const frac    = i / pts
    const angle   = frac * Math.PI * 2 * spiralTurns + t * 0.001 * params.motion
    const freqVal = getFreqNorm(freqData, Math.floor(frac * (freqData ? freqData.length : 256)))
    const r       = frac * spiralR * (0.8 + freqVal * 0.5 + bass * 0.3)
    points[i] = { x: cx2 + Math.cos(angle) * r, y: cy2 + Math.sin(angle) * r }
  }

  const baseWidthPx = (0.8 + bass * 1.2) * dpr * params.intensity
  const segments = buildVectorBeamSegmentsFromPoints(
    points, false, vectorBeamColorFromHex(preset.palette.primary, 0.85 * intMul), undefined,
    resolveVectorBeamScannerKinematicsSettings(params.oscillator),
  )
  rasterizeVectorBeamSegments(tctx, segments, { blendMode, baseWidthPx, intensity: 1 })
}

interface SoundDrawingPerformanceSourceRuntimePolicy {
  sourceKind: SoundDrawingResolvedPerformanceLayer['source']['kind']
  identityProfile: SoundDrawingIdentityProfile
  treatment: SoundDrawingSourceTreatment
  preserveIdentity: boolean
  contourBudget: number
  contourScale: number
  allowCharacterDeformation: boolean
  allowTextWaveform: boolean
}

type PerformanceAwareOscillator = OscillatorSettings & {
  __soundDrawingPerformanceSource?: SoundDrawingPerformanceSourceRuntimePolicy
}

function getPerformanceSourcePolicy(oscillator: OscillatorSettings): SoundDrawingPerformanceSourceRuntimePolicy | null {
  return (oscillator as PerformanceAwareOscillator).__soundDrawingPerformanceSource ?? null
}

export function shouldApplyGenericSoundDrawingPathDisplacement(
  sourceType: OscillatorSettings['sourceType'],
  _textWaveformMode: OscillatorSettings['textWaveformMode'],
  preserveIdentity = false,
  contourScale = 1,
): boolean {
  if (preserveIdentity || contourScale <= 0.000001) return false
  if (sourceType === 'text') return false
  return sourceType !== 'classic'
}

export function computeRuntimeSoundDrawingContourScale(input: {
  budget: number
  waveform: number
  twist: number
  jitter: number
  character: number
}): number {
  const requested = Math.max(
    0,
    Math.abs(input.waveform) + Math.abs(input.twist) + Math.abs(input.jitter) + Math.abs(input.character),
  )
  if (requested <= 0) return 1
  return clamp(Math.max(0, input.budget) / requested, 0, 1)
}

export function sampleCoherentSoundDrawingNoise(seed: number, timeMs: number, rateHz = 6): number {
  const position = Math.max(0, timeMs) * 0.001 * Math.max(0.05, rateHz)
  const lower = Math.floor(position)
  const mix = position - lower
  const smooth = mix * mix * (3 - 2 * mix)
  const a = seededRandom(seed + lower * 101.3) * 2 - 1
  const b = seededRandom(seed + (lower + 1) * 101.3) * 2 - 1
  return a + (b - a) * smooth
}

// ── Path / glyph scope mode ───────────────────────────────────────────────────

function resolveLyricDrivenOscillator(
  oscillator: OscillatorSettings,
  runtimeKey: string,
): { oscillator: OscillatorSettings; visible: boolean } {
  const textSource = oscillator.textSource ?? 'static'
  if (oscillator.sourceType !== 'text' || textSource === 'static') {
    lyricTextRuntime.delete(runtimeKey)
    return { oscillator, visible: true }
  }

  const playbackMatchesTrack = Boolean(
    _sdExpectedAudioTrackId && _sdLyricPlayback.sourceIdentity?.startsWith(`${_sdExpectedAudioTrackId}:`),
  )
  const playback = playbackMatchesTrack ? _sdLyricPlayback : EMPTY_LYRIC_PLAYBACK_STATE

  const resolved = lyricTextRuntime.resolve(
    runtimeKey,
    {
    textSource,
    staticText: oscillator.text,
    gapBehavior: oscillator.lyricGapBehavior,
    fallbackText: oscillator.lyricFallbackText,
    },
    playback,
  )

  return {
    oscillator: resolved.text === oscillator.text ? oscillator : { ...oscillator, text: resolved.text },
    visible: resolved.visible,
  }
}

function drawPathScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
  sectionType: ReactSectionType | null,
  runtimeKey = 'global',
  blendMode: SoundDrawingBlendMode = SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
): void {
  const lyricDriven = resolveLyricDrivenOscillator(params.oscillator, runtimeKey)
  if (!lyricDriven.visible) return
  const osc = lyricDriven.oscillator
  const effectiveParams = osc === params.oscillator ? params : { ...params, oscillator: osc }
  const sourcePolicy = getPerformanceSourcePolicy(osc)
  const contourScale = sourcePolicy?.contourScale ?? 1
  const contourAllowed =
    sourcePolicy?.treatment !== 'preserveIdentity' &&
    sourcePolicy?.identityProfile !== 'originalArtwork' &&
    contourScale > 0.000001
  const { audio, timeDomainData, beatHit, t } = frame

  const basePoints = getOscillatorPathPoints(effectiveParams)
  if (!basePoints || basePoints.length === 0) return

  const resolution = basePoints.length
  const cx = W / 2
  const cy = H / 2

  const bass = audio.bass * effectiveParams.bassReactivity
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
  const amRaw = resolveOscillatorAudioModifiers(frame, { ...effectiveParams, oscillator: effectiveOsc }, beatEnvelope)
  const textWaveContourRequested =
    effectiveOsc.sourceType === 'text' &&
    effectiveOsc.textWaveformMode !== 'off' &&
    (sourcePolicy?.allowTextWaveform ?? true) &&
    contourAllowed
  const runtimeContourScale =
    sourcePolicy && sourcePolicy.sourceKind !== 'generated' && contourAllowed
    ? computeRuntimeSoundDrawingContourScale({
        budget: sourcePolicy.contourBudget,
        waveform: textWaveContourRequested
          ? effectiveOsc.textWaveformAmount * (1 + bass * 0.35)
            : effectiveOsc.sourceType === 'text'
              ? 0
              : amRaw.displacementAmount,
        twist: Math.abs(amRaw.midTwistAmount) * 0.08,
        jitter: amRaw.highJitterAmount,
        character: sourcePolicy.allowCharacterDeformation ? 0.04 : 0,
      })
    : 1
  const amBudgeted =
    runtimeContourScale < 0.999999
    ? {
        ...amRaw,
        midTwistAmount: amRaw.midTwistAmount * runtimeContourScale,
        highJitterAmount: amRaw.highJitterAmount * runtimeContourScale,
        displacementAmount: amRaw.displacementAmount * runtimeContourScale,
      }
    : amRaw
  const am = twistSign === -1 ? { ...amBudgeted, midTwistAmount: -amBudgeted.midTwistAmount } : amBudgeted

  const numTraces = clamp(effectiveOsc.duplicateTraces, 1, 6)
  const close     = shouldClose(effectiveParams)

  // Rotation: delta-time phase accumulator — changing speed doesn't snap angle.
  // For text sources: rotate only when autoRotate is explicitly true (default: stationary).
  // For all other sources: rotate unless autoRotate is explicitly false (backward compat).
  const isTextSource = effectiveOsc.sourceType === 'text'
  const rotate = isTextSource ? effectiveOsc.autoRotate === true : effectiveOsc.autoRotate !== false
  const sourceKey    = `${effectiveOsc.sourceType}:${effectiveOsc.selectedGlyphId ?? effectiveOsc.selectedSvgId ?? effectiveOsc.text ?? effectiveOsc.builtinShape}`
  const angularVel   = 2 * effectiveParams.motion * effectiveOsc.rotationSpeed * am.rotationBoost
  const rotRad       = tickRotPhase(tctx, t, sourceKey, rotate, angularVel)

  // visualIntensity drives opacity / glow / line weight — NOT geometry size.
  // intensityLineBoost is neutral at intensity=1 and subtle across the full range,
  // so lines feel stronger/weaker without appearing to scale the object.
  const visualIntensity    = clamp(effectiveParams.intensity ?? 1, 0, 2)
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
        const lh  = effectiveOsc.textLineHeight ?? 1.2
        const ali = effectiveOsc.textAlignment  ?? 'center'
        fitPoints = getRuntimeOpenTypeTextPoints({
          assets: effectiveParams.oscillatorFontAssets,
          preparedCache: effectiveParams.oscillatorTextPointCache,
          fontId: effectiveOsc.textFontId,
          text: trimmed,
          resolution: res,
          letterSpacing: 0,
          lineHeight: lh,
          alignment: ali,
        })
      }
      if (!fitPoints) {
        // Canvas fallback: look in the local path cache, generating on demand if absent.
        const lh  = effectiveOsc.textLineHeight ?? 1.2
        const ali = effectiveOsc.textAlignment  ?? 'center'
        const zeroCanvasKey = `text:${trimmed}:${res}:0:${lh}:${ali}`
        if (!pathCache.has(zeroCanvasKey)) {
          const pts = textToGlyphPoints(trimmed, res, {
            letterSpacing: 0,
            lineHeight: lh,
            alignment: ali,
          })
          cachePut(zeroCanvasKey, pts)
        }
        fitPoints = pathCache.get(zeroCanvasKey) ?? null
      }
    }
    // Cold-start fallback: zero-spacing OpenType cache not yet populated.
    if (!fitPoints) fitPoints = basePoints

    let maxAbsX = 1e-6,
      maxAbsY = 1e-6
    for (const p of fitPoints) {
      const ax = Math.abs(p.x)
      if (ax > maxAbsX) maxAbsX = ax
      const ay = Math.abs(p.y)
      if (ay > maxAbsY) maxAbsY = ay
    }
    baseScale = computeTextFitScale(W, H, maxAbsX, maxAbsY, effectiveOsc.pathScale, fontSizeMul)
    baseScale *= am.bassPulse * (1 + bloomFactor * 0.24)
  } else {
    baseScale = computePathBaseScale(W, H, effectiveOsc.pathScale, am.bassPulse, bloomFactor)
  }

  // Glow scales with intensity so the object looks dimmer/brighter as expected.
  const glowBase    = (effectiveParams.glow * (10 + am.glowBoost) + bass * 8) * visualIntensity

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

  // Inverse-velocity stroke modulation: only meaningful for sources that carry
  // pre-resample spacing data (text/font glyphs). Built-in shapes and SVG have no
  // signal, so groups fall back to the original uniform-alpha stroke unchanged.
  const hasVelocityData = basePoints.some((p) => p.velocityRatio !== undefined)
  const ratioGroups: (number | undefined)[][] | null = hasVelocityData
    ? sourceGroups.map((indices) => indices.map((i) => basePoints[i].velocityRatio))
    : null
  const kinematics = resolveVectorBeamScannerKinematicsSettings(effectiveOsc)

  // Per-character audio transform setup.
  // charCenters is non-null only when text points carry characterIndex metadata.
  // Legacy cached text (no characterIndex) falls back to the old global behavior.
  const hasCharGroups = isTextSource && basePoints.some((p) => p.characterIndex != null)
  const charCenters =
    hasCharGroups && (sourcePolicy?.allowCharacterDeformation ?? true) && contourAllowed
    ? computeCharCenters(basePoints)
    : null

  // Precompute per-character reaction weights for this frame (constant across traces).
  // Each entry scales bassPulse-delta, midTwistAmount, and bloomFactor independently
  // so different letter-reaction modes animate each letter differently.
  const letterReactionMode: OscillatorTextLetterReactionMode = effectiveOsc.textLetterReactionMode ?? 'uniform'
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
  const isTextWaveActive =
    effectiveOsc.sourceType === 'text' &&
    effectiveOsc.textWaveformMode !== 'off' &&
    (sourcePolicy?.allowTextWaveform ?? true) &&
    contourAllowed
  const textWaveMeta = isTextWaveActive ? buildTextWaveformMeta(basePoints, sourceGroups, effectiveOsc.text) : null
  const textWaveScrollPhase = isTextWaveActive
    ? fract(t * 0.001 * effectiveParams.motion * effectiveOsc.textWaveformScroll)
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
                ldx: px - cc.cx,
                ldy: py - cc.cy,
                dOffX: 0,
                dOffY: 0,
                jitter: 0,
              }
              for (const asgn of assignments) {
                const sig = evalCustomSignal(asgn.source, bass, mid, high, am.beatPulse, asgn.phaseOffset, asgn.invert)
                applyCustomTargetDelta(asgn.target, sig, asgn.amount * runtimeContourScale, acc)
              }
              px = cc.cx + acc.dOffX + acc.ldx
              py = cc.cy + acc.dOffY + acc.ldy
              if (acc.jitter > 0) {
                const jSeed = i * 31.71 + p.characterIndex * 999
                const jrand = sampleCoherentSoundDrawingNoise(jSeed, t, 5.5)
                const nx = p.normalX ?? Math.cos(p.progress * Math.PI * 2)
                const ny = p.normalY ?? Math.sin(p.progress * Math.PI * 2)
                px += nx * jrand * acc.jitter
                py += ny * jrand * acc.jitter
              }
            }
          } else {
            // Automatic modes (uniform / alternating / frequencySplit / ripple):
            // Bass/bloom and mid-twist scaled by the per-mode weight for this char.
            const w = charWeightsMap.get(p.characterIndex) ?? {
              bassScale: 1,
              midScale: 1,
              bloomScale: 1,
            }
            const charBassScale = 1 + (am.bassPulse - 1) * w.bassScale * runtimeContourScale
            const charBloom     = bloomFactor * w.bloomScale * runtimeContourScale
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
        if (contourAllowed && am.midTwistAmount !== 0) {
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
          px,
          py,
          p.x,
          p.y,
          p.normalX ?? 0,
          p.normalY ?? 0,
          i,
          textWaveMeta,
          effectiveOsc.textWaveformMode,
          effectiveOsc.textWaveformAmount * runtimeContourScale,
          effectiveOsc.textWaveformCycles,
          textWaveScrollPhase,
          timeDomainData,
          bass,
        )
        px = r.px
        py = r.py
      } else if (
        shouldApplyGenericSoundDrawingPathDisplacement(
        effectiveOsc.sourceType,
        effectiveOsc.textWaveformMode,
        sourcePolicy?.treatment === 'preserveIdentity' || sourcePolicy?.identityProfile === 'originalArtwork',
        contourScale,
        )
      ) {
        const tdIdx = Math.floor((i * tdLen) / resolution)
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
      if (contourAllowed && am.highJitterAmount > 0) {
        const jSeed = i * 17.37 + (p.pathIndex ?? 0) * 503
        const jrand = sampleCoherentSoundDrawingNoise(jSeed, t, 7)
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
    const screenGroups: [number, number][][] = sourceGroups.map((indices) => indices.map((i) => screenPts[i]))

    if (isMain) mainTraceGroups = screenGroups

    tctx.save()
    tctx.globalCompositeOperation = blendMode
    tctx.lineCap  = 'round'
    tctx.lineJoin = 'round'

    switch (osc.renderMode) {
      case 'outline': {
        tctx.globalAlpha = traceAlpha * intMul
        tctx.lineWidth   = (1.2 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
        for (let g = 0; g < screenGroups.length; g++) {
          drawConnectedPathWithVelocity(
            tctx, screenGroups[g], ratioGroups?.[g] ?? null, close, traceColor, kinematics,
          )
        }
        break
      }
      case 'multiTrace': {
        if (isMain) {
          tctx.globalAlpha = 0.25 * intMul
          tctx.lineWidth   = (2.5 + bass * 2.5) * am.lineWidthBoost * dpr
          for (let g = 0; g < screenGroups.length; g++) {
            drawConnectedPathWithVelocity(
              tctx, screenGroups[g], ratioGroups?.[g] ?? null, close, preset.palette.accent, kinematics,
            )
          }
        }
        tctx.globalAlpha = traceAlpha * intMul
        tctx.lineWidth   = (1.0 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
        for (let g = 0; g < screenGroups.length; g++) {
          drawConnectedPathWithVelocity(
            tctx, screenGroups[g], ratioGroups?.[g] ?? null, close, traceColor, kinematics,
          )
        }
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
        tctx.lineWidth   = (5 + bass * 5) * am.lineWidthBoost * dpr
        for (let g = 0; g < screenGroups.length; g++) {
          drawConnectedPathWithVelocity(
            tctx, screenGroups[g], ratioGroups?.[g] ?? null, close, preset.palette.accent, kinematics,
          )
        }
        // Inner trace pass (thin, full alpha) — all groups second
        tctx.globalAlpha = traceAlpha * intMul
        tctx.lineWidth   = (1.5 + bass * 1.5) * am.lineWidthBoost * dpr * intensityLineBoost
        for (let g = 0; g < screenGroups.length; g++) {
          drawConnectedPathWithVelocity(
            tctx, screenGroups[g], ratioGroups?.[g] ?? null, close, traceColor, kinematics,
          )
        }
        break
      }
    }

    tctx.restore()
  }

  // Beat bloom flash — sustained by envelope, not a single-frame spike.
  // Iterates over the same per-pathIndex groups so no cross-path connector lines appear here either.
  if (am.beatPulse > 0.05 && mainTraceGroups) {
    tctx.save()
    tctx.globalCompositeOperation = blendMode
    tctx.lineWidth   = (2.5 + bass * 3) * dpr
    tctx.globalAlpha = 0.5 * am.beatPulse * effectiveOsc.beatBloom * intMul
    tctx.lineCap     = 'round'
    tctx.lineJoin    = 'round'
    for (let g = 0; g < mainTraceGroups.length; g++) {
      drawConnectedPathWithVelocity(
        tctx, mainTraceGroups[g], ratioGroups?.[g] ?? null, close, preset.palette.accent, kinematics,
      )
    }
    tctx.restore()
  }
}

// ── SVG auto-mode helper ──────────────────────────────────────────────────────

function hasSvgGlyphPoints(osc: OscillatorSettings, params: ReactRenderParams): boolean {
  const res = clamp(Math.round(osc.pathResolution), 64, 2048)
  const mediaId = resolveUnifiedSvgSource(osc)?.mediaId
  const glyphId = mediaId ? getSvgGlyphAssetId(mediaId) : null
  const asset = glyphId ? params.oscillatorGlyphAssets.find((candidate) => candidate.id === glyphId) : undefined
  if (!asset) return false
  const key = getSvgGlyphCacheKey(asset.id, res, asset.contentHash)
  if (params.oscillatorGlyphPointCache[key]) return true
  return findNearestSvgGlyphCacheEntry(params.oscillatorGlyphPointCache, asset.id, res, asset.contentHash) !== null
}

function clearSoundDrawingTrail(ctx: CanvasRenderingContext2D, W: number, H: number, background: string): void {
  const trailCanvas = getTrail(ctx, W, H)
  const trailContext = trailCanvas.getContext('2d')
  if (trailContext) {
    // Under additive blending the trail buffer holds light energy on a transparent
    // base (the background is composited underneath separately by callers) — reset
    // to fully transparent, not opaque background color.
    trailContext.save()
    trailContext.setTransform(1, 0, 0, 1, 0, 0)
    trailContext.globalCompositeOperation = 'source-over'
    trailContext.globalAlpha = 1
    trailContext.clearRect(0, 0, trailCanvas.width, trailCanvas.height)
    trailContext.restore()
  }

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  lyricTextRuntime.clear()
  beatEnvelopeMap.delete(ctx)
  twistSignMap.delete(ctx)
  twistPhasePrevMap.delete(ctx)
  rotPhaseMap.delete(ctx)
  trailDecayTimeMap.delete(ctx)
}

function resetTrailForRevisionIfNeeded(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  background: string,
  revisionKey: string,
): void {
  if (trailResetSeenMap.get(ctx) === revisionKey) return
  clearSoundDrawingTrail(ctx, W, H, background)
  trailResetSeenMap.set(ctx, revisionKey)
}

// ── Public export ─────────────────────────────────────────────────────────────

// ── Clip rendering helpers ────────────────────────────────────────────────────

function computeClipFade(timeSec: number, clip: SoundDrawingClip): number {
  const { startSec, endSec, fadeInMs, fadeOutMs } = clip
  const dur       = endSec - startSec
  const elapsed   = timeSec - startSec
  const remaining = endSec - timeSec

  const fadeInSec  = (fadeInMs  ?? 0) / 1000
  const fadeOutSec = (fadeOutMs ?? 0) / 1000

  let alpha = 1
  if (fadeInSec  > 0 && elapsed   < fadeInSec)  alpha = Math.min(1, elapsed / fadeInSec)
  if (fadeOutSec > 0 && remaining < fadeOutSec)  alpha = Math.min(alpha, remaining / fadeOutSec)
  void dur
  return Math.max(0, Math.min(1, alpha))
}

function buildEffectiveOscForLayer(globalOsc: OscillatorSettings, layer: SoundDrawingLayer): OscillatorSettings {
  const overrides: Partial<OscillatorSettings> = {
    // geometry / source fields always come from the layer
    ...(layer.sourceType === 'text'         && { sourceType: 'text'         }),
    ...(layer.sourceType === 'builtinShape' && {
      sourceType: 'builtinShape',
      builtinShape: layer.shape,
    }),
    ...(layer.sourceType === 'svg'          && { sourceType: 'svg'          }),
    ...(layer.fontId        !== null         && { textFontId:       layer.fontId }),
    ...(layer.text                           && { text:             layer.text }),
    ...(layer.sourceType === 'text' && {
      textSource: layer.textSource ?? 'static',
      lyricGapBehavior: layer.lyricGapBehavior ?? 'hide',
      lyricFallbackText: layer.lyricFallbackText ?? '',
    }),
    ...(layer.letterSpacing !== undefined && {
      textLetterSpacing: layer.letterSpacing,
    }),
    ...(layer.lineHeight    !== undefined    && { textLineHeight:   layer.lineHeight }),
    ...(layer.alignment     !== undefined    && { textAlignment:    layer.alignment }),
    ...(layer.svgId         !== null         && { selectedSvgId:    layer.svgId }),
    // oscillator overrides from the layer (partial)
    ...layer.oscillatorOverride,
  }
  return { ...globalOsc, ...overrides }
}

function renderSoundDrawingClips(
  ctx:         CanvasRenderingContext2D,
  frame:       ReactFrameContext,
  preset:      ReactPreset,
  params:      ReactRenderParams,
  sectionType: ReactSectionType | null,
  layers:      SoundDrawingLayer[],
  clips:       SoundDrawingClip[],
): void {
  const { W, H, dpr } = frame
  const timeSec = frame.timeSec ?? 0
  const layerMap = new Map(layers.map((l) => [l.id, l]))

  // Filter to active, enabled clips in z-order. Runtime state belonging to
  // inactive layers is discarded so lyric text does not linger between clips.
  const activeClips = clips
    .filter((c) => c.enabled && timeSec >= c.startSec && timeSec < c.endSec)
    .sort((a, b) => a.zIndex - b.zIndex)
  const activeLayerIds = new Set(activeClips.map((clip) => clip.layerId))
  for (const layer of layers) {
    if (!layer.enabled || !activeLayerIds.has(layer.id)) {
      lyricTextRuntime.delete(`layer:${layer.id}`)
    }
  }
  lyricTextRuntime.delete('global')

  const trailCanvas = getTrail(ctx, W, H)
  const tctx        = trailCanvas.getContext('2d')
  if (!tctx) return

  const dtSeconds = tickTrailDeltaSeconds(ctx, frame.t)
  fadeTrail(trailCanvas, computeSoundDrawingTrailDecayAlpha(params.trailDecay, dtSeconds))

  // Continue fading and repainting during gaps instead of leaving the final
  // lyric frame frozen on the canvas.
  if (activeClips.length === 0) {
    ctx.fillStyle = preset.palette.background
    ctx.fillRect(0, 0, W, H)
    ctx.drawImage(trailCanvas, 0, 0)
    return
  }

  for (const clip of activeClips) {
    const layer = layerMap.get(clip.layerId)
    if (!layer || !layer.enabled) continue

    const fade       = computeClipFade(timeSec, clip)
    const clipAlpha  = fade * params.intensity

    const effectiveOsc = buildEffectiveOscForLayer(params.oscillator, layer)
    const effectiveParams: ReactRenderParams = {
      ...params,
      oscillator: effectiveOsc,
    }

    // Apply layer position, scale, and rotation as a canvas transform
    const cx      = layer.x * W + W / 2
    const cy      = layer.y * H + H / 2
    const s       = layer.scale ?? 1
    const rotRad  = ((layer.rotation ?? 0) * Math.PI) / 180

    tctx.save()
    tctx.translate(cx, cy)
    tctx.rotate(rotRad)
    tctx.scale(s, s)
    tctx.translate(-W / 2, -H / 2)

    drawPathScopeOnTrail(
      tctx, W, H, dpr, frame, preset, effectiveParams, clipAlpha, sectionType, `layer:${layer.id}`,
      SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
    )

    tctx.restore()
  }

  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(trailCanvas, 0, 0)
}

function paletteForPerformanceRole(preset: ReactPreset, colorRole: SoundDrawingColorRole): ReactPreset {
  if (colorRole === 'primary') return preset
  const palette = preset.palette
  if (colorRole === 'secondary') {
    return {
      ...preset,
      palette: {
        ...palette,
        primary: palette.secondary,
        secondary: palette.primary,
      },
    }
  }
  if (colorRole === 'accent') {
    return {
      ...preset,
      palette: {
        ...palette,
        primary: palette.accent,
        secondary: palette.highlight,
        accent: palette.secondary,
      },
    }
  }
  return {
    ...preset,
    palette: {
      ...palette,
      primary: palette.highlight,
      secondary: palette.accent,
      accent: palette.primary,
    },
  }
}

function performanceLayerUsesPath(layer: SoundDrawingResolvedPerformanceLayer): boolean {
  if (layer.source.kind === 'text') return true
  if (layer.source.kind === 'svg') return layer.source.renderMode === 'traced-path'
  if (layer.source.kind === 'active-user-source') return true
  return (
    layer.generator === 'circularBassMembrane' ||
    layer.generator === 'kaleidoscopicTrace' ||
    layer.generator === 'particleSpline'
  )
}

function buildPerformanceOscillator(
  base: OscillatorSettings,
  layer: SoundDrawingResolvedPerformanceLayer,
  motionIntensity: number,
): OscillatorSettings {
  const usesPath = performanceLayerUsesPath(layer)
  const isProtectedSource =
    layer.source.kind === 'text' || layer.source.kind === 'svg' || layer.source.kind === 'active-user-source'
  const sourceType =
    layer.source.kind === 'text'
    ? 'text'
    : layer.source.kind === 'svg'
      ? 'svg'
      : layer.source.kind === 'active-user-source'
        ? base.sourceType
          : usesPath
            ? 'builtinShape'
            : 'classic'
  const result: PerformanceAwareOscillator = {
    ...base,
    sourceType,
    selectedSvgId: layer.source.kind === 'svg' ? layer.source.svgId : base.selectedSvgId,
    svgRenderMode:
      layer.source.kind === 'svg'
        ? layer.source.renderMode === 'original-artwork'
          ? 'originalArtwork'
          : 'reactivePath'
      : base.svgRenderMode,
    classicMode: layer.classicMode,
    builtinShape: layer.shape,
    renderMode: layer.renderMode,
    autoSectionMode: false,
    autoRotate: isProtectedSource
      ? motionIntensity * layer.wholeObjectMotion > 0.001 && Math.abs(layer.rotation) > 0.01
      : usesPath && motionIntensity > 0.001,
    rotationSpeed: clamp((0.018 + Math.abs(layer.rotation) / 900) * motionIntensity * layer.wholeObjectMotion, 0, 0.22),
    duplicateTraces: isProtectedSource
      ? Math.round(clamp(1 + layer.echoStrength * 2, 1, 3))
      : Math.round(clamp(layer.traceCount, 1, 6)),
    pathScale: clamp(base.pathScale * (0.84 + layer.topologyVariant * 0.025), 0.2, 1.35),
    audioDisplacement: clamp(layer.audioDisplacement, 0, 0.25),
    highJitter: clamp(layer.jitter, 0, 0.25),
    bassScale: clamp((isProtectedSource ? 0.08 : base.bassScale) + Math.max(0, layer.strokeWidth - 1) * 0.12, 0, 0.8),
    beatBloom: clamp((isProtectedSource ? 0.18 : base.beatBloom) + layer.glow * 0.25, 0, 1),
    midTwist:
      layer.treatment === 'preserveIdentity'
      ? 0
      : clamp(base.midTwist * layer.contourScale + Math.abs(layer.rotation) / 1100, 0, 0.7),
    textWaveformAmount: clamp(base.textWaveformAmount * layer.contourScale, 0, 0.25),
    textWaveformMode: layer.allowTextWaveform ? base.textWaveformMode : 'off',
    textLetterReactionMode: layer.allowCharacterDeformation ? base.textLetterReactionMode : 'uniform',
    mirrorX: isProtectedSource ? false : layer.symmetry >= 2,
    mirrorY: isProtectedSource ? false : layer.symmetry >= 4,
    __soundDrawingPerformanceSource: {
      sourceKind: layer.source.kind,
      identityProfile: layer.identityProfile,
      treatment: layer.treatment,
      preserveIdentity: layer.preserveIdentity,
      contourBudget: layer.contourBudget,
      contourScale: layer.contourScale,
      allowCharacterDeformation: layer.allowCharacterDeformation,
      allowTextWaveform: layer.allowTextWaveform,
    },
  }
  return result
}

function drawOriginalArtworkPerformanceLayer(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  layer: SoundDrawingResolvedPerformanceLayer,
  mediaId: string,
): void {
  const entry = getSvgVisualEntry(mediaId)
  if (!entry?.loaded || !entry.image) return
  const img = entry.image
  const imgW = entry.width || img.naturalWidth || 512
  const imgH = entry.height || img.naturalHeight || 512
  const maxSide = Math.min(frame.W, frame.H) * normalizeSoundDrawingVisualSize(params.oscillator.pathScale)
  const ratio = Math.min(maxSide / imgW, maxSide / imgH)
  const bassPulse = 1 + frame.audio.bass * params.bassReactivity * 0.08
  const beatPulse = frame.beatHit ? 1.06 : 1
  const drawW = imgW * ratio * bassPulse * beatPulse
  const drawH = imgH * ratio * bassPulse * beatPulse
  const copies = Math.round(clamp(1 + layer.echoStrength * 2, 1, 3))

  for (let copy = copies - 1; copy >= 0; copy--) {
    const echo = copy / Math.max(1, copies - 1)
    const offset = echo * layer.echoStrength * Math.min(frame.W, frame.H) * 0.025
    ctx.save()
    ctx.translate(frame.W / 2 + offset, frame.H / 2)
    ctx.globalAlpha = clamp(params.intensity * (copy === 0 ? 1 : 0.28 * layer.echoStrength), 0, 1)
    ctx.globalCompositeOperation = copy === 0 ? 'source-over' : 'screen'
    if (copy === 0 && params.glow > 0.05) {
      ctx.shadowColor = preset.palette.primary
      ctx.shadowBlur = Math.round((6 + frame.audio.bass * 10) * params.glow)
    }
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }
}

interface PerformanceLayerRenderResult {
  fallbackReason?: string
}

function renderPerformanceLayer(
  ownerContext: CanvasRenderingContext2D,
  tctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  performance: SoundDrawingResolvedPerformanceFrame,
  layer: SoundDrawingResolvedPerformanceLayer,
  sectionType: ReactSectionType | null,
): PerformanceLayerRenderResult {
  if (!layer.enabled || layer.opacity <= 0.001) return {}
  const { W, H, dpr } = frame
  const camera = performance.global
  const layerPreset = paletteForPerformanceRole(preset, layer.colorRole)
  const effectiveOscillator = buildPerformanceOscillator(
    params.oscillator,
    layer,
    params.soundDrawingPerformanceSettings.motionIntensity,
  )
  const effectiveParams: ReactRenderParams = {
    ...params,
    intensity: clamp(params.intensity * layer.opacity * (0.88 + layer.strokeWidth * 0.12), 0, 1.4),
    motion: clamp(params.motion * params.soundDrawingPerformanceSettings.motionIntensity, 0, 1),
    glow: clamp(params.glow * (0.45 + layer.glow * 0.75), 0, 1.3),
    bassReactivity: clamp(params.bassReactivity * params.soundDrawingPerformanceSettings.reactionIntensity, 0, 1.2),
    oscillator: effectiveOscillator,
  }
  const layerFrame: ReactFrameContext =
    layer.phaseOffset === 0
    ? frame
      : {
          ...frame,
          t: frame.t + layer.phaseOffset * 240,
          beatPhase: (frame.beatPhase + layer.phaseOffset + 1) % 1,
        }

  if (
    layer.source.kind === 'svg' &&
    layer.source.renderMode === 'traced-path' &&
    !hasSvgGlyphPoints(effectiveOscillator, effectiveParams)
  )
    return {}

  let result: PerformanceLayerRenderResult = {}
  tctx.save()
  try {
    tctx.globalCompositeOperation = layer.blendMode
    const cameraX = camera.cameraX * W
    const cameraY = camera.cameraY * H
    tctx.translate(W / 2 + cameraX, H / 2 + cameraY)
    tctx.rotate((camera.cameraRotation * Math.PI) / 180)
    tctx.scale(camera.cameraScale, camera.cameraScale)
    tctx.translate(-W / 2, -H / 2)

    const cx = W / 2 + layer.x * W * 0.5
    const cy = H / 2 + layer.y * H * 0.5
    tctx.translate(cx, cy)
    tctx.rotate(((layer.rotation + layer.topologyVariant * 7.5) * Math.PI) / 180)
    const topologyScale = 1 + Math.max(0, layer.symmetry - 1) * 0.015
    tctx.scale(layer.scale * topologyScale, layer.scale * topologyScale)
    tctx.translate(-W / 2, -H / 2)

    if (usesLivingRibbonCanvasRenderer(layer)) {
      const livingRibbon = renderLivingRibbonCanvasLayer({
        ownerContext,
        targetContext: tctx,
        frame: layerFrame,
        preset: layerPreset,
        performance,
        layer,
        intensity: effectiveParams.intensity,
        glow: effectiveParams.glow,
      })
      result = { fallbackReason: livingRibbon.fallbackReason ?? undefined }
      if (!livingRibbon.rendered) {
        // Preserve a basic audio-reactive visual when the simulation or Canvas2D
        // path fails. The existing harmonic ribbon path is deliberately retained.
        drawWaveformOnTrail(
          tctx, W, H, dpr, layerFrame, layerPreset, effectiveParams, effectiveParams.intensity, layer.blendMode,
        )
      }
    } else if (layer.source.kind === 'svg' && layer.source.renderMode === 'original-artwork') {
      drawOriginalArtworkPerformanceLayer(tctx, layerFrame, layerPreset, effectiveParams, layer, layer.source.svgId)
    } else if (performanceLayerUsesPath(layer)) {
      drawPathScopeOnTrail(
        tctx,
        W,
        H,
        dpr,
        layerFrame,
        layerPreset,
        effectiveParams,
        effectiveParams.intensity,
        sectionType,
        `performance:${performance.showId}:${layer.id}`,
        layer.blendMode,
      )
    } else {
      switch (layer.classicMode) {
        // Authored layers may carry either the migrated or the legacy value.
        case 'monoDelayXY':
        case 'lissajous':
          drawLissajousOnTrail(
            tctx, W, H, dpr, layerFrame, layerPreset, effectiveParams, effectiveParams.intensity, layer.blendMode,
          )
          break
        case 'radialScope':
          drawRadialScopeOnTrail(
            tctx, W, H, dpr, layerFrame, layerPreset, effectiveParams, effectiveParams.intensity, layer.blendMode,
          )
          break
        case 'spiralScope':
          drawSpiralScopeOnTrail(
            tctx, W, H, dpr, layerFrame, layerPreset, effectiveParams, effectiveParams.intensity, layer.blendMode,
          )
          break
        default:
          drawWaveformOnTrail(
            tctx, W, H, dpr, layerFrame, layerPreset, effectiveParams, effectiveParams.intensity, layer.blendMode,
          )
          break
      }
    }
  } finally {
    tctx.restore()
  }
  return result
}

function authoredTrailIdentity(performance: SoundDrawingResolvedPerformanceFrame, params: ReactRenderParams): string {
  const oscillator = params.oscillator
  return [
    performance.showId,
    params.soundDrawingPerformanceSettings.generatorPreference,
    params.soundDrawingPerformanceSettings.performanceSource,
    params.soundDrawingPerformanceSettings.sourceTreatment,
    params.soundDrawingPerformanceSettings.useSourceAs,
    oscillator.sourceType,
    oscillator.classicMode,
    oscillator.builtinShape,
    oscillator.selectedSvgId ?? 'no-svg',
    oscillator.selectedGlyphId ?? 'no-glyph',
    oscillator.textFontId ?? 'no-font',
    oscillator.text,
    performance.context.trackIdentity ?? 'no-track',
  ].join('|')
}

function renderSafeAuthoredFallback(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
): void {
  ctx.save()
  try {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = preset.palette.background
    ctx.fillRect(0, 0, frame.W, frame.H)
    drawWaveformOnTrail(ctx, frame.W, frame.H, frame.dpr, frame, preset, params, params.intensity)
  } finally {
    ctx.restore()
  }
}

function soundDrawingRouteIsActive(
  route: SoundDrawingModulationRoute,
  context: SharedPerformanceContext,
  settings: SoundDrawingPerformanceSettings,
): boolean {
  if (route.lockKey && settings.locks[route.lockKey]) return false
  if (route.capability && !context.capabilities[route.capability]) return false
  if (route.capabilityAny && !route.capabilityAny.some((key) => context.capabilities[key])) return false
  const section = context.macroSectionType ?? context.sectionType ?? 'unknown'
  if (route.sectionFilter?.length && !route.sectionFilter.includes(section)) return false
  if (route.minConfidence != null && context.confidence[route.confidenceKey ?? 'overall'] < route.minConfidence) return false
  return true
}

function renderAuthoredSoundDrawingPerformance(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): boolean {
  const runtimeMode = params.soundDrawingRuntimeMode ?? 'live'
  const publishesProductionDiagnostics = runtimeMode === 'live'
  const previousContext = soundDrawingPerformanceContextMap.get(ctx) ?? null
  let temporalState = soundDrawingPerformanceTemporalStateMap.get(ctx)
  if (!temporalState) {
    temporalState = { identity: '' }
    soundDrawingPerformanceTemporalStateMap.set(ctx, temporalState)
  }
  const performance = resolveSoundDrawingPerformanceFrame({
    frame,
    settings: params.soundDrawingPerformanceSettings,
    manualOscillator: params.oscillator,
    previousContext,
    temporalState,
  })
  if (!performance) {
    soundDrawingPerformanceContextMap.delete(ctx)
    disposeSoundDrawingBehaviorRuntime(temporalState)
    soundDrawingPerformanceTemporalStateMap.delete(ctx)
    if (authoredTrailIdentityMap.has(ctx)) {
      clearSoundDrawingTrail(ctx, frame.W, frame.H, preset.palette.background)
    }
    authoredTrailIdentityMap.delete(ctx)
    disposeLivingRibbonCanvasRuntimes(ctx)
    if (publishesProductionDiagnostics) clearSharedPerformanceDiagnostics('soundDrawing')
    return false
  }
  soundDrawingPerformanceContextMap.set(ctx, performance.context)

  const { W, H } = frame
  const trailCanvas = getTrail(ctx, W, H)
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) {
    disposeLivingRibbonCanvasRuntimes(ctx)
    renderSafeAuthoredFallback(ctx, frame, preset, params)
    if (publishesProductionDiagnostics) {
      publishSharedPerformanceDiagnostics(
        createSharedPerformanceDiagnostics(performance.context, {
        engine: 'soundDrawing',
        performanceShow: performance.showName,
        scene: performance.sceneId,
        motifOrComposition: `4-bar ${performance.context.performanceFourBarBlockIndex + 1}`,
        activeLayers: [],
        activeEventEnvelopes: [],
        recentActions: performance.appliedActionReasons,
        continuousRoutes: [],
        lockedParameters: [],
        fallbackState: 'Canvas2D trail context unavailable; safe harmonic fallback rendered',
        resourceLimitDecisions: ['Living Ribbon runtime disposed because the authored trail context was unavailable'],
        }),
      )
    }
    return true
  }

  const ribbonResetRevision = params.soundDrawingRibbonResetRevision ?? 0
  const previousRibbonResetRevision = livingRibbonResetSeenMap.get(ctx)
  let ribbonResetApplied = false
  if (previousRibbonResetRevision === undefined) {
    livingRibbonResetSeenMap.set(ctx, ribbonResetRevision)
  } else if (previousRibbonResetRevision !== ribbonResetRevision) {
    synchronizeSoundDrawingBehaviorRuntime(temporalState, 'manual')
    resetLivingRibbonCanvasRuntimes(ctx, `${performance.deterministicIdentity}:manual-reset:${ribbonResetRevision}`)
    clearSoundDrawingTrail(ctx, W, H, preset.palette.background)
    livingRibbonResetSeenMap.set(ctx, ribbonResetRevision)
    ribbonResetApplied = true
  }

  const ribbonSettings = params.soundDrawingPerformanceSettings.livingRibbon
  const preparation = prepareLivingRibbonCanvasFrame({
    ownerContext: ctx,
    frame,
    performance,
    quality: ribbonSettings.quality,
    mode: runtimeMode,
    pointDensity: ribbonSettings.pointDensity,
    sparkAmount: ribbonSettings.sparkAmount,
  })
  const nextTrailIdentity = authoredTrailIdentity(performance, params)
  const previousTrailIdentity = authoredTrailIdentityMap.get(ctx)
  const enteringAuthoredPerformance = previousTrailIdentity === undefined
  const sourceOrGeneratorChanged = previousTrailIdentity !== undefined && previousTrailIdentity !== nextTrailIdentity
  authoredTrailIdentityMap.set(ctx, nextTrailIdentity)
  if (
    enteringAuthoredPerformance ||
    sourceOrGeneratorChanged ||
    preparation.clearTrail ||
    ribbonResetApplied ||
    performance.context.trackReplacementDetected ||
    performance.context.seekDetected ||
    performance.context.loopWrapDetected ||
    frame.timingDiscontinuity
  ) {
    clearSoundDrawingTrail(ctx, W, H, preset.palette.background)
  }

  const activeSourceTrail =
    performance.layers.find((layer) => layer.source.kind !== 'generated')?.sourceTrailStrength ?? 0.5
  const authoredPersistence = clamp(
    performance.global.trailPersistence * 0.78 + activeSourceTrail * 0.16 + performance.global.feedbackAmount * 0.12,
    0,
    0.98,
  )
  const livingRibbonActive = performance.layers.some(
    (layer) => layer.enabled && layer.source.kind === 'generated' && layer.generator === 'livingRibbon',
  )
  const livingRibbonTrailDetail = preparation.qualityBudget.trailDetail
  const decayRate = clamp(
    ((1 - authoredPersistence) * 0.28 + params.trailDecay * 0.04) / (livingRibbonActive ? livingRibbonTrailDetail : 1),
    0.02,
    0.32,
  )
  fadeTrail(trailCanvas, decayRate)

  const livingRibbonFailures = [...preparation.diagnostics]
  for (const layer of performance.layers) {
    const result = renderPerformanceLayer(ctx, tctx, frame, preset, params, performance, layer, sectionType)
    if (result.fallbackReason) livingRibbonFailures.push(result.fallbackReason)
  }

  ctx.save()
  try {
    // Always clear the presentation canvas completely. backgroundFade controls
    // authored trace visibility, not whether stale pixels survive a seek/reset.
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = preset.palette.background
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = clamp(performance.global.backgroundFade, 0, 1)
    ctx.drawImage(trailCanvas, 0, 0)
  } finally {
    ctx.restore()
  }

  const activeEventEnvelopes = performance.appliedActionReasons.filter((reason) =>
    SOUND_DRAWING_DIAGNOSTIC_EVENT_REASONS.has(reason),
  )
  const lockedParameters = Object.entries(params.soundDrawingPerformanceSettings?.locks ?? {})
    .filter(([, locked]) => locked)
    .map(([key]) => key)
  const resourceLimitDecisions: string[] = []
  const sourceFailureDecisions: string[] = []
  for (const layer of performance.layers) {
    if (
      layer.source.kind === 'text' &&
      (params.oscillator.textSource ?? 'static') === 'static' &&
      !params.oscillator.text.trim()
    ) {
      sourceFailureDecisions.push('Active text source is empty')
    }
    if (layer.source.kind === 'svg' && layer.source.renderMode === 'original-artwork') {
      const entry = getSvgVisualEntry(layer.source.svgId)
      if (entry?.error) sourceFailureDecisions.push(`SVG artwork failed: ${entry.error}`)
      else if (!entry?.loaded) sourceFailureDecisions.push('SVG artwork is not available in the render cache')
    }
    if (layer.source.kind === 'svg' && layer.source.renderMode === 'traced-path') {
      const sourceOscillator = buildPerformanceOscillator(
        params.oscillator,
        layer,
        params.soundDrawingPerformanceSettings.motionIntensity,
      )
      if (
        !hasSvgGlyphPoints(sourceOscillator, {
          ...params,
          oscillator: sourceOscillator,
        })
      ) {
        sourceFailureDecisions.push('SVG traced path is unavailable; generated supporting layers remain active')
      }
    }
  }
  if (performance.layers.length >= MAX_SOUND_DRAWING_PERFORMANCE_LAYERS)
    resourceLimitDecisions.push('Layer budget reached')
  if (performance.layers.some((layer) => layer.traceCount >= MAX_SOUND_DRAWING_PERFORMANCE_TRACES))
    resourceLimitDecisions.push('Trace budget reached')
  if (performance.layers.some((layer) => layer.particleCount >= MAX_SOUND_DRAWING_PERFORMANCE_PARTICLES))
    resourceLimitDecisions.push('Particle budget reached')
  const ribbonDiagnostics = getLivingRibbonCanvasDiagnostics(ctx)
  const activeRibbonRuntime = ribbonDiagnostics.runtimes[0] ?? null
  const activeRibbonLayer = performance.layers.find((layer) => usesLivingRibbonCanvasRenderer(layer)) ?? null
  const ribbonFallbackState = livingRibbonActive
    ? [
        !performance.context.capabilities.sections ? 'section fallback' : null,
        !performance.context.capabilities.stemCurves ? 'stem fallback' : null,
        !performance.context.capabilities.lyrics ? 'vocal/lyric fallback' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'advanced capabilities active'
    : null
  if (livingRibbonActive) {
    resourceLimitDecisions.push(
      `Living Ribbon quality ${preparation.qualityBudget.requested} → ${preparation.qualityBudget.resolved} (${preparation.qualityBudget.pointCount} points, ${runtimeMode})`,
    )
  }
  if (publishesProductionDiagnostics) {
    publishSharedPerformanceDiagnostics(
      createSharedPerformanceDiagnostics(performance.context, {
      engine: 'soundDrawing',
      performanceShow: performance.showName,
      scene: performance.sceneId,
      motifOrComposition: `4-bar ${performance.context.performanceFourBarBlockIndex + 1}`,
        activeLayers: performance.layers
          .filter((layer) => layer.enabled)
          .map(
            (layer) =>
              `${layer.role}:${layer.source.kind}:${layer.source.kind === 'generated' ? layer.generator : layer.identityProfile}`,
          ),
      activeEventEnvelopes,
      recentActions: performance.appliedActionReasons,
        continuousRoutes: performance.layers.flatMap((layer) =>
          layer.modulationRoutes
            .filter((route) => soundDrawingRouteIsActive(route, performance.context, params.soundDrawingPerformanceSettings))
            .map((route) => route.id),
        ),
      lockedParameters,
        fallbackState:
          livingRibbonFailures[0] ??
          performance.sourceFallbackState ??
          sourceFailureDecisions[0] ??
          (performance.fallbackUsed ? 'Safe authored fallback active' : null),
      resourceLimitDecisions: [
        ...resourceLimitDecisions,
        ...sourceFailureDecisions,
          ...livingRibbonFailures.map((reason) => `Living Ribbon fallback: ${reason}`),
        `Source ${performance.activeSourceKind} / ${performance.activeIdentityProfile} / ${performance.activeTreatment}`,
        `Contour ${performance.appliedContourDeformation.toFixed(4)} of ${performance.contourBudget.toFixed(4)} (requested ${performance.requestedContourDeformation.toFixed(4)})`,
        ...(performance.readabilityClampApplied ? ['Readability clamp applied'] : []),
          ...performance.supportingGeneratedLayers.map((id) => `Supporting layer ${id}`),
      ],
        engineDetails: livingRibbonActive
          ? [
              { label: 'Ribbon Scene', value: performance.sceneId },
              {
                label: 'Ribbon Routes',
                value: String(
                  activeRibbonLayer?.modulationRoutes.filter((route) =>
                    soundDrawingRouteIsActive(route, performance.context, params.soundDrawingPerformanceSettings),
                  ).length ?? 0,
                ),
              },
              {
                label: 'Ribbon Impulses',
                value: activeRibbonRuntime?.recentImpulses.slice(-4).join(', ') || 'None',
              },
              {
                label: 'Ribbon Controls',
                value: activeRibbonRuntime
                  ? `drv ${activeRibbonRuntime.normalizedControls.drive.toFixed(2)} · ten ${activeRibbonRuntime.normalizedControls.tension.toFixed(2)} · tur ${activeRibbonRuntime.normalizedControls.turbulence.toFixed(2)} · wid ${activeRibbonRuntime.normalizedControls.widthTarget.toFixed(2)}`
                  : 'Unavailable',
              },
              {
                label: 'Ribbon Capability',
                value: ribbonFallbackState ?? 'Not active',
              },
              {
                label: 'Ribbon Quality',
                value: `${preparation.qualityBudget.requested} → ${preparation.qualityBudget.resolved}`,
              },
              {
                label: 'Ribbon Structure',
                value: activeRibbonRuntime?.structuralSignature ?? 'Unavailable',
              },
              {
                label: 'Ribbon Locks',
                value: lockedParameters.filter((key) => key.startsWith('ribbon')).join(', ') || 'None',
              },
              {
                label: 'Ribbon Recovery',
                value: `reset ${ribbonDiagnostics.resetCount} · finite ${ribbonDiagnostics.finiteRecoveryCount}`,
              },
            ]
          : [],
      }),
    )
  }
  return true
}

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

  const trailRevisionKey = `${params.soundDrawingTrailResetRevision ?? 0}:${_sdTrailResetRevision}`
  resetTrailForRevisionIfNeeded(ctx, W, H, preset.palette.background, trailRevisionKey)

  if (renderAuthoredSoundDrawingPerformance(ctx, frame, preset, params, sectionType)) return

  authoredTrailIdentityMap.delete(ctx)
  disposeLivingRibbonCanvasRuntimes(ctx)

  // If clips are active for this frame, render through clip pipeline instead
  if (_sdClips.length > 0) {
    renderSoundDrawingClips(ctx, frame, preset, params, sectionType, _sdLayers, _sdClips)
    return
  }

  // Unified SVG runtime path. Legacy media-backed settings are resolved at the
  // compatibility boundary and follow the same selectedSvgId/render-mode lifecycle.
  const svgSource = resolveUnifiedSvgSource(osc)
  if (svgSource?.mediaId) {
    const wantsOriginal =
      svgSource.renderMode === 'originalArtwork' || (svgSource.renderMode === 'auto' && !hasSvgGlyphPoints(osc, params))
    if (wantsOriginal) {
      renderOriginalArtwork(ctx, frame, preset, params, svgSource.mediaId)
      return
    }
  }

  // Route to pathScope for any non-classic source; otherwise honour classicMode
  let mode: ScopeMode
  if (osc.sourceType === 'classic') {
    if (osc.autoSectionMode || osc.classicMode === 'sectionAuto') {
      mode = modeForSection(sectionType)
    } else {
      mode = scopeModeForClassicMode(osc.classicMode)
    }
  } else {
    mode = 'pathScope'
  }

  const trailCanvas = getTrail(ctx, W, H)
  const tctx        = trailCanvas.getContext('2d')
  if (!tctx) return

  // Fade trail (frame-rate independent; erases toward zero energy under additive blending)
  const dtSeconds = tickTrailDeltaSeconds(ctx, frame.t)
  fadeTrail(trailCanvas, computeSoundDrawingTrailDecayAlpha(params.trailDecay, dtSeconds))

  // Draw new scope frame onto trail canvas
  switch (mode) {
    case 'professionalScope':
      // Falls through to the legacy waveform when stereo capture is unavailable
      // (AudioWorklet unsupported, module blocked, or the ring not yet filled).
      // The professional modes are an enhancement, never a hard requirement for
      // the engine to render.
      if (drawProfessionalScopeOnTrail(tctx, ctx, W, H, dpr, frame, preset, params, intMul)) break
      drawWaveformOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE)
      break
    case 'lissajous':
      drawLissajousOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE)
      break
    case 'radialScope':
      drawRadialScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE)
      break
    case 'spiralScope':
      drawSpiralScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE)
      break
    case 'pathScope':
      drawPathScopeOnTrail(
        tctx, W, H, dpr, frame, preset, params, intMul, sectionType, 'global',
        SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE,
      )
      break
    default:
      drawWaveformOnTrail(tctx, W, H, dpr, frame, preset, params, intMul, SOUND_DRAWING_DEFAULT_TRACE_BLEND_MODE)
  }

  // Composite trail onto main canvas
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(trailCanvas, 0, 0)
}

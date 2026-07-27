// Shared Canvas2D rasterizer for vector-beam segments (see VectorBeamTypes.ts).
//
// Resolves each segment's rendered appearance through the SAME beam-optics and
// color-science pipeline the laser module uses to author its scene frames
// (LaserDmxBeamOptics / LaserDmxColorScience), so a Sound Drawing trace and a
// galvo scan path desaturate toward white under overlap/high-energy the same
// way. This module is a leaf consumer of laserDmx/ — it never imports
// SoundDrawingRenderer.ts or anything under soundDrawing/, so no cycle can form.
import type { VectorBeamColor, VectorBeamPoint, VectorBeamSegment } from './VectorBeamTypes'
import {
  resolveLaserDmxBeamOpticalProfile,
  type LaserDmxBeamOpticalProfile,
} from '../renderers/laserDmx/LaserDmxBeamOptics'
import {
  applyLaserDmxBoundedHighlightWhitening,
  linearChannelToSrgb,
  resolveLaserDmxHighlightWhitening,
  srgbChannelToLinear,
} from '../renderers/laserDmx/LaserDmxColorScience'
import type { LaserDmxSceneColor } from '../renderers/laserDmx/LaserDmxSceneFrame'

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/**
 * On-screen spacing (px) between consecutive beam samples at which
 * `velocityRatio` reads 0.5. Mirrors the WebGL vectorscope geometry builder's
 * own VELOCITY_REFERENCE_SPACING (which works in -1..1 XY space, hence the
 * different absolute value) so both stacks use the same falloff shape.
 */
const VECTOR_BEAM_VELOCITY_REFERENCE_SPACING_PX = 6

/**
 * Derives an inverse-velocity ratio (0..1, low velocity = high value) from the
 * on-screen distance a beam travels in one sample step. Used for point sources
 * that carry no measured pre-resample velocity signal (built-in shapes, SVG):
 * closely-spaced samples mean a slow-moving beam and therefore a brighter,
 * longer-dwelled stroke.
 */
export function velocityRatioFromSpacingPx(spacingPx: number): number {
  const s = Math.max(0, Number.isFinite(spacingPx) ? spacingPx : 0)
  return VECTOR_BEAM_VELOCITY_REFERENCE_SPACING_PX / (VECTOR_BEAM_VELOCITY_REFERENCE_SPACING_PX + s)
}

// A vector/oscilloscope beam has no lens, iris, or fixture housing — it is
// always in tight focus with a single, narrow ray. 'laser' plus these fixed
// values give resolveLaserDmxBeamOpticalProfile the closest physical analogue
// available among existing fixture kinds.
const VECTOR_BEAM_FIXTURE_KIND = 'laser' as const
const VECTOR_BEAM_FOCUS = 1
const VECTOR_BEAM_SPREAD_DEG = 2
const VECTOR_BEAM_VISUAL_ROLE = 'primary' as const

/** Resolves the shared optical profile (width/scatter/opacity/coreIntensity) for a given 0..1 exposure. */
export function resolveVectorBeamOpticalProfile(exposure: number): LaserDmxBeamOpticalProfile {
  return resolveLaserDmxBeamOpticalProfile({
    fixtureKind: VECTOR_BEAM_FIXTURE_KIND,
    intensity: clamp01(exposure),
    focus: VECTOR_BEAM_FOCUS,
    spreadDeg: VECTOR_BEAM_SPREAD_DEG,
    visualRole: VECTOR_BEAM_VISUAL_ROLE,
  })
}

function toLinear(color: VectorBeamColor): LaserDmxSceneColor {
  return {
    r: srgbChannelToLinear(color.r),
    g: srgbChannelToLinear(color.g),
    b: srgbChannelToLinear(color.b),
    a: color.a,
  }
}

function whitenedCssColor(linearBase: LaserDmxSceneColor, energy: number, coreEnergy: number, alpha: number): string {
  const mix = resolveLaserDmxHighlightWhitening(energy, coreEnergy)
  const whitened = applyLaserDmxBoundedHighlightWhitening(linearBase, mix)
  const r = Math.round(clamp01(linearChannelToSrgb(whitened.r)) * 255)
  const g = Math.round(clamp01(linearChannelToSrgb(whitened.g)) * 255)
  const b = Math.round(clamp01(linearChannelToSrgb(whitened.b)) * 255)
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`
}

/**
 * Brightness floor for a segment swept at maximum velocity (velocityRatio = 0).
 * Kept identical to the WebGL vectorscope scene's own `mix(0.4, 1.0, v_velocityRatio)`
 * so the Canvas2D and WebGL stacks agree on how strongly beam speed dims a stroke.
 */
const VECTOR_BEAM_VELOCITY_BRIGHTNESS_MIN = 0.4

/**
 * Combined 0..1 exposure driver.
 *
 * Three physical contributions, all multiplicative:
 *  - `density`: the segment's own base exposure.
 *  - `dwellWeight`: extra exposure at cusps/corners, where the beam lingers.
 *  - `velocityRatio`: inverse-velocity brightness — a real beam deposits energy
 *    in proportion to dwell time, so fast sweeps read dim and slow ones read
 *    bright. This is the dominant reason reference oscilloscope footage shows
 *    bright knots at turning points and dim fast runs; without it a trace
 *    renders as a uniformly-lit polyline.
 *
 * `velocityRatio` is 0..1 with LOW velocity = HIGH value, so it maps directly
 * onto brightness (1 = slow = full brightness).
 */
export function resolveVectorBeamSegmentExposure(segment: VectorBeamSegment, masterIntensity = 1): number {
  const dwellTerm = 0.55 + clamp01(segment.dwellWeight) * 0.45
  const velocityTerm =
    VECTOR_BEAM_VELOCITY_BRIGHTNESS_MIN +
    (1 - VECTOR_BEAM_VELOCITY_BRIGHTNESS_MIN) * clamp01(segment.velocityRatio)
  return clamp01(segment.density * dwellTerm * velocityTerm * clamp01(masterIntensity))
}

export interface VectorBeamAppearance {
  coreWidthPx: number
  coreColor: string
  haloWidthPx: number
  haloColor: string
}

export interface ResolveVectorBeamAppearanceOptions {
  /** Base stroke width in px before optics-driven core/halo scaling. Default 1. */
  baseWidthPx?: number
  /** Master intensity multiplier (0..1), e.g. the caller's overall trace/layer alpha. Default 1. */
  intensity?: number
  /** Overrides the segment's own density-derived exposure (used by the rasterizer's bucketed batching). */
  exposureOverride?: number
}

/**
 * Resolves a single segment's rendered core+halo stroke appearance via the
 * shared beam-optics/color-science pipeline. Pure — no canvas access — so it's
 * directly unit-testable.
 *
 * Core: high local energy, strongly whitened toward the fixture's natural white
 * point (reference: a cyan base core reads close to white-cyan). Halo: much
 * lower local energy (scattered, not concentrated light) — whitening mostly
 * fades and the surviving color reverts toward its natural, saturated hue,
 * while staying dim (reference: readable but faint 40-100px out).
 */
export function resolveVectorBeamSegmentAppearance(
  segment: VectorBeamSegment,
  options: ResolveVectorBeamAppearanceOptions = {},
): VectorBeamAppearance {
  const baseWidthPx = options.baseWidthPx ?? 1
  const exposure = options.exposureOverride ?? resolveVectorBeamSegmentExposure(segment, options.intensity ?? 1)
  const optical = resolveVectorBeamOpticalProfile(exposure)
  const linearBase = toLinear(segment.color)
  const coreEnergy = optical.coreIntensity

  const coreWidthPx = clamp(baseWidthPx * optical.width, 0.3, baseWidthPx * 3)
  const haloWidthPx = clamp(baseWidthPx * optical.scatterEnvelopeWidth * 0.6, coreWidthPx * 1.6, baseWidthPx * 14)

  const coreAlpha = clamp01(optical.coreIntensity * exposure * segment.color.a)
  const coreColor = whitenedCssColor(linearBase, exposure * 1.3, coreEnergy, coreAlpha)

  const haloEnergy = exposure * 0.22
  const haloAlpha = clamp01(optical.opacity * exposure * 0.3 * segment.color.a)
  const haloColor = whitenedCssColor(linearBase, haloEnergy, coreEnergy, haloAlpha)

  return { coreWidthPx, coreColor, haloWidthPx, haloColor }
}

const APPEARANCE_BUCKETS = 12

function connects(a: VectorBeamPoint, b: VectorBeamPoint): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01
}

export interface RasterizeVectorBeamSegmentsOptions {
  blendMode?: GlobalCompositeOperation
  baseWidthPx?: number
  intensity?: number
}

/**
 * The ONE shared rasterizer every vector-beam trace draws through. Quantizes
 * each segment's exposure into a small number of buckets and batches
 * consecutive, connected, same-bucket segments into a single path per stroke
 * pass (halo then core), so segment-level dwell/velocity fidelity doesn't cost
 * one stroke() call per segment — a smoothly-varying oscillator signal
 * typically produces a handful of runs, not hundreds.
 */
export function rasterizeVectorBeamSegments(
  tctx: CanvasRenderingContext2D,
  segments: readonly VectorBeamSegment[],
  options: RasterizeVectorBeamSegmentsOptions = {},
): void {
  if (segments.length === 0) return
  const intensity = clamp01(options.intensity ?? 1)
  const baseWidthPx = options.baseWidthPx ?? 1
  const buckets = segments.map(segment =>
    Math.round(resolveVectorBeamSegmentExposure(segment, intensity) * APPEARANCE_BUCKETS),
  )

  tctx.save()
  tctx.globalCompositeOperation = options.blendMode ?? 'lighter'
  tctx.lineCap = 'round'
  tctx.lineJoin = 'round'

  let i = 0
  while (i < segments.length) {
    let j = i
    while (
      j + 1 < segments.length &&
      buckets[j + 1] === buckets[i] &&
      connects(segments[j].target, segments[j + 1].origin)
    ) {
      j += 1
    }
    const representative = segments[Math.floor((i + j) / 2)]
    const appearance = resolveVectorBeamSegmentAppearance(representative, {
      baseWidthPx,
      exposureOverride: buckets[i] / APPEARANCE_BUCKETS,
    })
    strokeRun(tctx, segments, i, j, appearance.haloWidthPx, appearance.haloColor)
    strokeRun(tctx, segments, i, j, appearance.coreWidthPx, appearance.coreColor)
    i = j + 1
  }

  tctx.restore()
}

function strokeRun(
  tctx: CanvasRenderingContext2D,
  segments: readonly VectorBeamSegment[],
  fromIndex: number,
  toIndex: number,
  width: number,
  color: string,
): void {
  tctx.lineWidth = width
  tctx.strokeStyle = color
  tctx.beginPath()
  tctx.moveTo(segments[fromIndex].origin.x, segments[fromIndex].origin.y)
  for (let s = fromIndex; s <= toIndex; s++) tctx.lineTo(segments[s].target.x, segments[s].target.y)
  tctx.stroke()
}

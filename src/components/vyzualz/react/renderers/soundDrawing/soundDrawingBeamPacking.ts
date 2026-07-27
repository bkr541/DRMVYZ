import { GEOMETRY_SEGMENT_FLOAT_STRIDE } from '../../shaders/runtime/GeometryPass'
import type { VectorBeamSegment } from '../../vectorBeam/VectorBeamTypes'

// ── soundDrawingBeamPacking ───────────────────────────────────────────────────
//
// Bridge from the renderer-agnostic `VectorBeamSegment` model to the instanced
// per-segment attribute layout `GeometryPass` uploads.
//
// This module is what makes the rendering contract's "Canvas2D and WebGL paths
// for the same engine must consume the same resolved semantic frame" literally
// true for Sound Drawing. Both paths start from the identical
// `VectorBeamSegment[]` that `buildVectorBeamSegmentsFromPoints` produces —
// same corner-dwell, same inverse-velocity exposure, same colour. The Canvas2D
// rasterizer strokes them; this packs the very same array for the GPU. Neither
// path re-derives beam optics, so they cannot drift apart.
//
// Hot-path contract: callers own and reuse the `into` buffer, sized via
// `requiredBeamSegmentFloats()`. This module never allocates.

/** Floats needed to pack `segmentCount` segments. */
export function requiredBeamSegmentFloats(segmentCount: number): number {
  return Math.max(0, segmentCount) * GEOMETRY_SEGMENT_FLOAT_STRIDE
}

export interface BeamPackViewport {
  /** Canvas backing-store width in pixels. */
  width: number
  /** Canvas backing-store height in pixels. */
  height: number
}

export interface BeamPackResult {
  /** Segments actually written. May be fewer than supplied if `into` is short. */
  segmentCount: number
  /**
   * Largest `historyWeight` across packed segments.
   *
   * `GeometryPass`'s 11-float layout has no history channel, and widening a
   * shared layout for one consumer would cost every other scene a vertex
   * attribute. Persistence is a full-frame property rather than a per-segment
   * one, so the aggregate travels alongside the buffer and drives the
   * persistence pass's uniform instead.
   */
  maxHistoryWeight: number
}

/**
 * Packs screen-space beam segments into the instanced geometry layout.
 *
 * Coordinates convert from canvas pixels to the isotropic world space the
 * vectorscope vertex shader expects: −1..1 vertically, and horizontally scaled
 * by aspect so the shader's `clipPos.x /= uAspect` restores square units. Doing
 * it here rather than in the shader keeps a circular figure circular on any
 * canvas shape, which is the whole point of a vectorscope display.
 *
 * Y is negated because canvas pixel Y grows downward while clip space grows
 * upward. Segments are already in canvas pixel space by the time they reach
 * this function, so this is the single place the flip happens.
 */
export function packVectorBeamSegments(
  segments: readonly VectorBeamSegment[],
  viewport: BeamPackViewport,
  into: Float32Array,
): BeamPackResult {
  const width = viewport.width
  const height = viewport.height
  if (!(width > 0) || !(height > 0)) return { segmentCount: 0, maxHistoryWeight: 0 }

  const capacity = Math.floor(into.length / GEOMETRY_SEGMENT_FLOAT_STRIDE)
  const count = Math.min(segments.length, capacity)

  const aspect = width / height
  const invWidth = 1 / width
  const invHeight = 1 / height

  let maxHistoryWeight = 0
  let write = 0

  for (let i = 0; i < count; i++) {
    const segment = segments[i]

    const originX = ((segment.origin.x * invWidth) * 2 - 1) * aspect
    const originY = 1 - segment.origin.y * invHeight * 2
    const targetX = ((segment.target.x * invWidth) * 2 - 1) * aspect
    const targetY = 1 - segment.target.y * invHeight * 2

    // A non-finite coordinate would propagate through the vertex shader and
    // blank the whole draw call, so degenerate segments are skipped rather than
    // uploaded. Rejecting here keeps the GPU path's NaN policy identical to the
    // signal core's.
    if (
      !Number.isFinite(originX) || !Number.isFinite(originY) ||
      !Number.isFinite(targetX) || !Number.isFinite(targetY)
    ) {
      continue
    }

    const base = write * GEOMETRY_SEGMENT_FLOAT_STRIDE
    into[base] = originX
    into[base + 1] = originY
    into[base + 2] = targetX
    into[base + 3] = targetY
    into[base + 4] = finite(segment.color.r)
    into[base + 5] = finite(segment.color.g)
    into[base + 6] = finite(segment.color.b)
    into[base + 7] = finite(segment.color.a)
    into[base + 8] = clamp01(segment.density)
    into[base + 9] = clamp01(segment.dwellWeight)
    into[base + 10] = clamp01(segment.velocityRatio)

    const history = clamp01(segment.historyWeight)
    if (history > maxHistoryWeight) maxHistoryWeight = history

    write++
  }

  return { segmentCount: write, maxHistoryWeight }
}

/**
 * Value to supply as the geometry pass's `uHaloWidthPx` uniform.
 *
 * Shader contract, which is easy to get wrong: the vertex shader offsets by
 * `a_corner.y * uHaloWidthPx` where `a_corner.y` is ±0.5, so this uniform is the
 * quad's FULL width in pixels, not a half-width. The fragment shader then
 * measures `distAcross` in quad-relative units (0 at the centreline, 1 at the
 * edge) and evaluates both the core and halo Gaussians against it.
 *
 * The consequence worth stating explicitly: the beam profile scales *with* the
 * quad. Widening the quad widens the halo proportionally — it does not expose
 * more of a fixed-size Gaussian's tail. So this returns the halo diameter the
 * look calls for, and nothing here can be used to pad away edge clipping. See
 * `BEAM_PROFILE_EDGE_RESIDUAL`.
 */
export function resolveBeamHaloWidthPx(coreWidthPx: number, haloScale: number): number {
  const core = Math.max(0, finite(coreWidthPx))
  const scale = Math.max(1, finite(haloScale) || 1)
  return Math.max(1, core * scale)
}

/**
 * Fragment intensity the stock beam profile still has at the quad edge,
 * as a fraction of its centreline peak.
 *
 * Because the profile is quad-relative, this residual is a constant — the halo
 * term is `exp(-1) * 0.35 ≈ 0.047` at the edge against a peak of ≈1.35, and no
 * choice of quad width changes it. It therefore shows as a faint hard-edged band
 * running parallel to every beam.
 *
 * Recorded here rather than silently tolerated because it is a real artifact the
 * renderer work has to resolve, and it cannot be fixed by any caller of this
 * module: it needs the fragment shader to taper the profile to zero at the quad
 * boundary (a smoothstep against `distAcross`, or a steeper halo exponent).
 */
export const BEAM_PROFILE_EDGE_RESIDUAL = 0.0474 / 1.35

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

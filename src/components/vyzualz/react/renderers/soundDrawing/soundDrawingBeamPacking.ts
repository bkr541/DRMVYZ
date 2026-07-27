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
 * Screen-space quad half-width the geometry pass must expand to, in pixels.
 *
 * The fragment shader draws core and halo as nested Gaussians measured across
 * the quad, so the quad has to be wide enough to contain the widest term it
 * will evaluate. Too narrow and the halo is sliced off with a visible straight
 * edge along the beam; the padding term covers the Gaussian's tail rather than
 * only its nominal radius.
 */
export function resolveBeamQuadHalfWidthPx(
  coreWidthPx: number,
  haloWidthPx: number,
): number {
  const core = Math.max(0, finite(coreWidthPx))
  const halo = Math.max(core, finite(haloWidthPx))
  // 1.5x covers the Gaussian tail down to a visually negligible level; a tighter
  // bound clips the halo, a looser one wastes fill rate on empty pixels.
  return Math.max(1, halo * 1.5)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

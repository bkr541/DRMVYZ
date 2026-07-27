import { GEOMETRY_SEGMENT_FLOAT_STRIDE } from '../runtime/GeometryPass'

// ── soundDrawingVectorscopeGeometry ───────────────────────────────────────────
//
// Pure, GL-free CPU-side segment builder: turns one frame of two-channel XY
// waveform samples (see ShaderWaveformTextureXY) into the per-instance
// GeometryPass attribute layout (origin, target, color, density, dwellWeight,
// velocityRatio), so the Sound Drawing vectorscope scene's geometry pass has
// something to draw.
//
// Mirrors the same two physical ideas the Canvas2D Sound Drawing engine
// already uses (corner dwell from turn angle, inverse-velocity brightness
// from local point spacing) but is reimplemented fresh here — this module is
// GLSL/WebGL-side and intentionally has no dependency on the Canvas2D
// renderers/vectorBeam code, which is a separate rendering stack.
//
// Hot-path contract: callers own and reuse the `into` Float32Array (sized via
// requiredSegmentFloats()) across frames; this module never allocates.

export interface SoundDrawingVectorscopeColor {
  r: number
  g: number
  b: number
  a: number
}

/** Reference XY-space spacing (in the same units as the sample amplitudes, nominally -1..1) at which velocityRatio = 0.5. */
const VELOCITY_REFERENCE_SPACING = 0.08

/** Minimum vector length before a segment's turn angle is considered meaningful (avoids NaN from near-zero-length direction vectors). */
const MIN_DIRECTION_LENGTH = 1e-6

export function requiredSegmentFloats(maxSampleCount: number): number {
  return Math.max(0, maxSampleCount - 1) * GEOMETRY_SEGMENT_FLOAT_STRIDE
}

function turnAngleDeg(dx1: number, dy1: number, dx2: number, dy2: number): number {
  const len1 = Math.hypot(dx1, dy1)
  const len2 = Math.hypot(dx2, dy2)
  if (len1 < MIN_DIRECTION_LENGTH || len2 < MIN_DIRECTION_LENGTH) return 0
  const cos = Math.max(-1, Math.min(1, (dx1 * dx2 + dy1 * dy2) / (len1 * len2)))
  return (Math.acos(cos) * 180) / Math.PI
}

function velocityRatioFromSpacing(spacing: number): number {
  return VELOCITY_REFERENCE_SPACING / (VELOCITY_REFERENCE_SPACING + spacing)
}

/**
 * Build segments connecting consecutive (channelA[i], channelB[i]) samples.
 *
 * @param channelA     X samples for this frame (nominally -1..1).
 * @param channelB     Y samples for this frame (nominally -1..1).
 * @param sampleCount  Number of valid samples in channelA/channelB (may be
 *                     less than their allocated length).
 * @param color        Flat base color stamped onto every emitted segment —
 *                     per-segment appearance variation comes from
 *                     density/dwellWeight/velocityRatio in the shader, not
 *                     per-segment color here.
 * @param into         Preallocated, reused output buffer — must have at
 *                     least requiredSegmentFloats(sampleCount) floats.
 * @returns            Number of segments written (sampleCount - 1, clamped to ≥0).
 */
export function buildSoundDrawingVectorscopeSegments(
  channelA: Float32Array,
  channelB: Float32Array,
  sampleCount: number,
  color: SoundDrawingVectorscopeColor,
  into: Float32Array,
): number {
  const n = Math.max(0, Math.min(sampleCount, channelA.length, channelB.length))
  const segmentCount = Math.max(0, n - 1)
  const required = requiredSegmentFloats(n)
  if (into.length < required) {
    throw new Error(`[soundDrawingVectorscopeGeometry] output buffer too small: need ${required} floats, got ${into.length}`)
  }

  let prevDx = 0
  let prevDy = 0

  for (let i = 0; i < segmentCount; i++) {
    const ox = channelA[i]
    const oy = channelB[i]
    const tx = channelA[i + 1]
    const ty = channelB[i + 1]

    const dx = tx - ox
    const dy = ty - oy
    const spacing = Math.hypot(dx, dy)

    const turnDeg = i === 0 ? 0 : turnAngleDeg(prevDx, prevDy, dx, dy)
    const dwellWeight = Math.max(0, Math.min(1, turnDeg / 180))
    const velocityRatio = Math.max(0, Math.min(1, velocityRatioFromSpacing(spacing)))
    const amplitude = (Math.abs(ox) + Math.abs(oy)) / 2
    const density = Math.max(0, Math.min(1, 0.6 + 0.4 * amplitude))

    const base = i * GEOMETRY_SEGMENT_FLOAT_STRIDE
    into[base] = ox
    into[base + 1] = oy
    into[base + 2] = tx
    into[base + 3] = ty
    into[base + 4] = color.r
    into[base + 5] = color.g
    into[base + 6] = color.b
    into[base + 7] = color.a
    into[base + 8] = density
    into[base + 9] = dwellWeight
    into[base + 10] = velocityRatio

    prevDx = dx
    prevDy = dy
  }

  return segmentCount
}

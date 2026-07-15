import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'

export type LaserDmxDepthMode = 'continuous-slices' | 'binary-fallback'

export interface LaserDmxDepthQualityPolicy {
  mode: LaserDmxDepthMode
  sliceCount: number
  maxSegmentsPerBeam: number
  plumePrecision: number
  temporalStability: number
}

export interface LaserDmxDepthSegment {
  sliceIndex: number
  t0: number
  t1: number
  centerDepth: number
  frontDepth: number
  rearDepth: number
}

const QUALITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxDepthQualityPolicy>> = Object.freeze({
  low: { mode: 'continuous-slices', sliceCount: 3, maxSegmentsPerBeam: 3, plumePrecision: 0.35, temporalStability: 0.35 },
  medium: { mode: 'continuous-slices', sliceCount: 5, maxSegmentsPerBeam: 5, plumePrecision: 0.62, temporalStability: 0.58 },
  high: { mode: 'continuous-slices', sliceCount: 7, maxSegmentsPerBeam: 7, plumePrecision: 0.82, temporalStability: 0.78 },
  ultra: { mode: 'continuous-slices', sliceCount: 9, maxSegmentsPerBeam: 9, plumePrecision: 1, temporalStability: 1 },
  auto: { mode: 'continuous-slices', sliceCount: 5, maxSegmentsPerBeam: 5, plumePrecision: 0.68, temporalStability: 0.64 },
})

const FALLBACK_POLICY: LaserDmxDepthQualityPolicy = Object.freeze({
  mode: 'binary-fallback',
  sliceCount: 2,
  maxSegmentsPerBeam: 2,
  plumePrecision: 0.2,
  temporalStability: 0.2,
})

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

export function resolveLaserDmxDepthQualityPolicy(
  quality: LaserDmxShowDirectorWebGLQuality,
  continuousDepthAvailable = true,
): LaserDmxDepthQualityPolicy {
  return continuousDepthAvailable ? QUALITY_POLICIES[quality] : FALLBACK_POLICY
}

export function resolveLaserDmxDepthSliceIndex(depth: number, sliceCount: number): number {
  const count = Math.max(1, Math.round(sliceCount))
  const normalized = clamp01((clamp(depth, -1, 1) + 1) * 0.5)
  return Math.min(count - 1, Math.floor(normalized * count))
}

/** OpenGL clip depth runs from -1 near to +1 far, so translucent slices composite far to near. */
export function resolveLaserDmxDepthTraversal(sliceCount: number): number[] {
  const count = Math.max(1, Math.round(sliceCount))
  return Array.from({ length: count }, (_, index) => count - index - 1)
}

/**
 * Splits a projected camera-depth interval at slice boundaries. Returned slices
 * are ordered from the authored segment origin toward its target. A minute
 * overlap hides precision cracks while preserving the original center line.
 */
export function splitLaserDmxDepthInterval(
  startDepth: number,
  endDepth: number,
  policy: Pick<LaserDmxDepthQualityPolicy, 'sliceCount' | 'maxSegmentsPerBeam'>,
): LaserDmxDepthSegment[] {
  const count = Math.max(1, Math.round(policy.sliceCount))
  const maxSegments = Math.max(1, Math.round(policy.maxSegmentsPerBeam))
  const start = clamp(startDepth, -1, 1)
  const end = clamp(endDepth, -1, 1)
  const delta = end - start
  if (Math.abs(delta) < 1e-6) {
    const sliceIndex = resolveLaserDmxDepthSliceIndex((start + end) * 0.5, count)
    return [{ sliceIndex, t0: 0, t1: 1, centerDepth: (start + end) * 0.5, frontDepth: Math.min(start, end), rearDepth: Math.max(start, end) }]
  }

  const cuts = [0, 1]
  for (let boundaryIndex = 1; boundaryIndex < count; boundaryIndex += 1) {
    const boundary = -1 + boundaryIndex * (2 / count)
    const t = (boundary - start) / delta
    if (t > 1e-5 && t < 1 - 1e-5) cuts.push(t)
  }
  cuts.sort((a, b) => a - b)

  const raw: LaserDmxDepthSegment[] = []
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const t0 = cuts[index]!
    const t1 = cuts[index + 1]!
    const centerT = (t0 + t1) * 0.5
    const centerDepth = start + delta * centerT
    raw.push({
      sliceIndex: resolveLaserDmxDepthSliceIndex(centerDepth, count),
      t0,
      t1,
      centerDepth,
      frontDepth: Math.min(start + delta * t0, start + delta * t1),
      rearDepth: Math.max(start + delta * t0, start + delta * t1),
    })
  }
  if (raw.length <= maxSegments) return raw

  // Bounded degradation: merge neighbouring segments without changing order.
  const merged: LaserDmxDepthSegment[] = []
  for (let index = 0; index < maxSegments; index += 1) {
    const from = Math.floor(index * raw.length / maxSegments)
    const to = Math.max(from, Math.floor((index + 1) * raw.length / maxSegments) - 1)
    const first = raw[from]!
    const last = raw[to]!
    const t0 = first.t0
    const t1 = last.t1
    const centerDepth = start + delta * ((t0 + t1) * 0.5)
    merged.push({
      sliceIndex: resolveLaserDmxDepthSliceIndex(centerDepth, count),
      t0,
      t1,
      centerDepth,
      frontDepth: Math.min(first.frontDepth, last.frontDepth),
      rearDepth: Math.max(first.rearDepth, last.rearDepth),
    })
  }
  return merged
}

export function resolveLaserDmxDepthExtinction(input: {
  layerDensity: number
  localPlumeDensity: number
  segmentDepth: number
  layerDepth: number
  extinction: number
}): number {
  const behind = clamp01((input.segmentDepth - input.layerDepth) * 2.2 + 0.5)
  const density = clamp01(input.layerDensity + input.localPlumeDensity * 1.35)
  return clamp01(1 - Math.exp(-density * behind * clamp(input.extinction, 0, 4)))
}

export function resolveLaserDmxPartialPlumeAttenuation(input: {
  segmentDepth: number
  plumeDepth: number
  radialProximity: number
  plumeDensity: number
  precision: number
}): number {
  const depthFalloff = Math.exp(-Math.abs(input.segmentDepth - input.plumeDepth) * (2.4 + input.precision * 3.6))
  const local = clamp01(input.radialProximity) * clamp01(input.plumeDensity) * depthFalloff
  return clamp01(local * (0.34 + clamp01(input.precision) * 0.42))
}

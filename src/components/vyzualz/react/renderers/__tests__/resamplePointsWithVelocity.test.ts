import { describe, it, expect } from 'vitest'
import { resamplePointsWithVelocity, resamplePoints } from '../oscillatorPathUtils'
import type { OscillatorGlyphPoint } from '../../ReactTypes'

function pt(x: number, y: number): OscillatorGlyphPoint {
  return { x, y, pathIndex: 0, progress: 0 }
}

describe('resamplePointsWithVelocity', () => {
  it('returns the same points as resamplePoints (same positions/count)', () => {
    const source = [pt(0, 0), pt(1, 0), pt(2, 0), pt(3, 0), pt(4, 0)]
    const { points } = resamplePointsWithVelocity(source, 10)
    const plain = resamplePoints(source, 10)
    expect(points).toHaveLength(plain.length)
    for (let i = 0; i < points.length; i++) {
      expect(points[i].x).toBeCloseTo(plain[i].x, 10)
      expect(points[i].y).toBeCloseTo(plain[i].y, 10)
    }
  })

  it('returns a velocityRatio array of the same length as the resampled points', () => {
    const source = [pt(0, 0), pt(1, 0), pt(2, 0), pt(3, 0)]
    const { points, velocityRatio } = resamplePointsWithVelocity(source, 16)
    expect(velocityRatio).toHaveLength(points.length)
  })

  it('values are normalized to 0..1', () => {
    // Densely-packed points at the start, sparse at the end — a corner-like distribution.
    const source = [
      pt(0, 0), pt(0.05, 0), pt(0.1, 0), pt(0.15, 0), pt(0.2, 0),
      pt(1.2, 0), pt(2.2, 0), pt(3.2, 0),
    ]
    const { velocityRatio } = resamplePointsWithVelocity(source, 20)
    for (const r of velocityRatio) {
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...velocityRatio)).toBeCloseTo(1, 10)
  })

  it('dense original spacing (a cusp) yields a higher ratio than sparse spacing (a straight run)', () => {
    // Left half: 5 points packed into [0, 0.2] (dense — a corner). Right half: 5 points
    // spread across [0.2, 4.2] (sparse — a long straight run). Equal point counts on
    // each side so the resample doesn't just concentrate all output there by other means.
    const source: OscillatorGlyphPoint[] = [
      pt(0, 0), pt(0.05, 0), pt(0.1, 0), pt(0.15, 0), pt(0.2, 0),
      pt(1.2, 0), pt(2.2, 0), pt(3.2, 0), pt(4.2, 0),
    ]
    const { velocityRatio } = resamplePointsWithVelocity(source, 40)
    const denseRegionRatios = velocityRatio.slice(0, 2)   // near arc-length 0, in the dense cluster
    const sparseRegionRatios = velocityRatio.slice(-2)    // near the end, in the sparse run
    const avgDense = denseRegionRatios.reduce((a, b) => a + b, 0) / denseRegionRatios.length
    const avgSparse = sparseRegionRatios.reduce((a, b) => a + b, 0) / sparseRegionRatios.length
    expect(avgDense).toBeGreaterThan(avgSparse)
  })

  it('a perfectly uniform source produces a uniform (near-1) velocityRatio everywhere', () => {
    const source = Array.from({ length: 20 }, (_, i) => pt(i * 0.5, 0))
    const { velocityRatio } = resamplePointsWithVelocity(source, 30)
    for (const r of velocityRatio) expect(r).toBeCloseTo(1, 5)
  })

  it('does not recompute from the (uniform) resampled output — dense input signal survives resampling to a different target count', () => {
    const source: OscillatorGlyphPoint[] = [
      pt(0, 0), pt(0.02, 0), pt(0.04, 0), pt(0.06, 0), pt(0.08, 0),
      pt(2, 0), pt(4, 0), pt(6, 0),
    ]
    const { velocityRatio: ratio8 } = resamplePointsWithVelocity(source, 8)
    const { velocityRatio: ratio64 } = resamplePointsWithVelocity(source, 64)
    // Both resolutions should still show a brighter (higher-ratio) region near the dense
    // cluster than near the sparse tail, regardless of how many output points there are.
    expect(ratio8[0]).toBeGreaterThan(ratio8[ratio8.length - 1])
    expect(ratio64[0]).toBeGreaterThan(ratio64[ratio64.length - 1])
  })

  it('handles fewer than 2 source points by returning ratio 1 for every output point', () => {
    const { points, velocityRatio } = resamplePointsWithVelocity([pt(0, 0)], 5)
    expect(points).toHaveLength(5)
    expect(velocityRatio).toEqual([1, 1, 1, 1, 1])
  })

  it('handles targetCount of 0 by returning empty arrays', () => {
    const { points, velocityRatio } = resamplePointsWithVelocity([pt(0, 0), pt(1, 0)], 0)
    expect(points).toEqual([])
    expect(velocityRatio).toEqual([])
  })

  it('handles a zero-length source path (all points identical) without producing NaN', () => {
    const source = [pt(2, 2), pt(2, 2), pt(2, 2)]
    const { velocityRatio } = resamplePointsWithVelocity(source, 6)
    for (const r of velocityRatio) expect(Number.isFinite(r)).toBe(true)
  })
})

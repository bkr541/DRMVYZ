import { describe, it, expect } from 'vitest'
import {
  buildSoundDrawingVectorscopeSegments,
  requiredSegmentFloats,
} from '../soundDrawingVectorscopeGeometry'
import { GEOMETRY_SEGMENT_FLOAT_STRIDE } from '../../runtime/GeometryPass'

const WHITE = { r: 1, g: 1, b: 1, a: 1 }

function circleChannels(sampleCount: number, radius = 0.5): { a: Float32Array; b: Float32Array } {
  const a = new Float32Array(sampleCount)
  const b = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    const t = (i / sampleCount) * Math.PI * 2
    a[i] = Math.cos(t) * radius
    b[i] = Math.sin(t) * radius
  }
  return { a, b }
}

describe('requiredSegmentFloats', () => {
  it('is (sampleCount - 1) * GEOMETRY_SEGMENT_FLOAT_STRIDE', () => {
    expect(requiredSegmentFloats(10)).toBe(9 * GEOMETRY_SEGMENT_FLOAT_STRIDE)
  })

  it('never goes negative for a sampleCount of 0 or 1', () => {
    expect(requiredSegmentFloats(0)).toBe(0)
    expect(requiredSegmentFloats(1)).toBe(0)
  })
})

describe('buildSoundDrawingVectorscopeSegments', () => {
  it('emits sampleCount - 1 segments for a simple line', () => {
    const a = new Float32Array([0, 0.1, 0.2, 0.3])
    const b = new Float32Array([0, 0, 0, 0])
    const into = new Float32Array(requiredSegmentFloats(4))
    const count = buildSoundDrawingVectorscopeSegments(a, b, 4, WHITE, into)
    expect(count).toBe(3)
  })

  it('returns 0 segments for 0 or 1 samples', () => {
    const into = new Float32Array(0)
    expect(buildSoundDrawingVectorscopeSegments(new Float32Array(0), new Float32Array(0), 0, WHITE, into)).toBe(0)
    expect(buildSoundDrawingVectorscopeSegments(new Float32Array([0.1]), new Float32Array([0.2]), 1, WHITE, into)).toBe(0)
  })

  it('writes origin/target matching consecutive sample pairs', () => {
    const a = new Float32Array([0.1, 0.2, 0.3])
    const b = new Float32Array([-0.1, -0.2, -0.3])
    const into = new Float32Array(requiredSegmentFloats(3))
    buildSoundDrawingVectorscopeSegments(a, b, 3, WHITE, into)

    // Segment 0: origin (a[0],b[0]) -> target (a[1],b[1])
    expect(into[0]).toBeCloseTo(0.1)
    expect(into[1]).toBeCloseTo(-0.1)
    expect(into[2]).toBeCloseTo(0.2)
    expect(into[3]).toBeCloseTo(-0.2)

    // Segment 1 starts where segment 0 ended.
    const seg1Base = GEOMETRY_SEGMENT_FLOAT_STRIDE
    expect(into[seg1Base]).toBeCloseTo(0.2)
    expect(into[seg1Base + 1]).toBeCloseTo(-0.2)
    expect(into[seg1Base + 2]).toBeCloseTo(0.3)
    expect(into[seg1Base + 3]).toBeCloseTo(-0.3)
  })

  it('stamps the given flat color onto every segment', () => {
    const color = { r: 0.2, g: 0.4, b: 0.6, a: 0.8 }
    const { a, b } = circleChannels(16)
    const into = new Float32Array(requiredSegmentFloats(16))
    const count = buildSoundDrawingVectorscopeSegments(a, b, 16, color, into)
    for (let i = 0; i < count; i++) {
      const base = i * GEOMETRY_SEGMENT_FLOAT_STRIDE
      expect(into[base + 4]).toBeCloseTo(color.r)
      expect(into[base + 5]).toBeCloseTo(color.g)
      expect(into[base + 6]).toBeCloseTo(color.b)
      expect(into[base + 7]).toBeCloseTo(color.a)
    }
  })

  it('all density/dwellWeight/velocityRatio outputs stay within [0,1]', () => {
    const { a, b } = circleChannels(64)
    const into = new Float32Array(requiredSegmentFloats(64))
    const count = buildSoundDrawingVectorscopeSegments(a, b, 64, WHITE, into)
    for (let i = 0; i < count; i++) {
      const base = i * GEOMETRY_SEGMENT_FLOAT_STRIDE
      const density = into[base + 8]
      const dwellWeight = into[base + 9]
      const velocityRatio = into[base + 10]
      expect(density).toBeGreaterThanOrEqual(0)
      expect(density).toBeLessThanOrEqual(1)
      expect(dwellWeight).toBeGreaterThanOrEqual(0)
      expect(dwellWeight).toBeLessThanOrEqual(1)
      expect(velocityRatio).toBeGreaterThanOrEqual(0)
      expect(velocityRatio).toBeLessThanOrEqual(1)
    }
  })

  it('the first segment has dwellWeight 0 (no incoming direction to turn from)', () => {
    const { a, b } = circleChannels(16)
    const into = new Float32Array(requiredSegmentFloats(16))
    buildSoundDrawingVectorscopeSegments(a, b, 16, WHITE, into)
    expect(into[9]).toBe(0) // dwellWeight of segment 0
  })

  it('a sharp reversal produces a higher dwellWeight than a smooth curve', () => {
    // Smooth curve: samples along a circle.
    const smooth = circleChannels(32)
    const smoothInto = new Float32Array(requiredSegmentFloats(32))
    buildSoundDrawingVectorscopeSegments(smooth.a, smooth.b, 32, WHITE, smoothInto)
    const smoothMidDwell = smoothInto[10 * GEOMETRY_SEGMENT_FLOAT_STRIDE + 9]

    // Sharp reversal: goes out then immediately back (a full direction flip at sample 1).
    const a = new Float32Array([0, 0.3, 0])
    const b = new Float32Array([0, 0, 0])
    const sharpInto = new Float32Array(requiredSegmentFloats(3))
    buildSoundDrawingVectorscopeSegments(a, b, 3, WHITE, sharpInto)
    const sharpDwell = sharpInto[1 * GEOMETRY_SEGMENT_FLOAT_STRIDE + 9] // segment 1's dwellWeight

    expect(sharpDwell).toBeGreaterThan(smoothMidDwell)
    expect(sharpDwell).toBeCloseTo(1, 1) // a full reversal (180°) should be near-maximal dwell
  })

  it('closely spaced (slow) samples produce a higher velocityRatio than widely spaced (fast) samples', () => {
    const slow = new Float32Array(requiredSegmentFloats(3))
    buildSoundDrawingVectorscopeSegments(
      new Float32Array([0, 0.01, 0.02]), new Float32Array([0, 0, 0]), 3, WHITE, slow,
    )
    const fast = new Float32Array(requiredSegmentFloats(3))
    buildSoundDrawingVectorscopeSegments(
      new Float32Array([0, 0.9, -0.9]), new Float32Array([0, 0, 0]), 3, WHITE, fast,
    )
    const slowVelocity = slow[10]   // segment 0's velocityRatio
    const fastVelocity = fast[10]
    expect(slowVelocity).toBeGreaterThan(fastVelocity)
  })

  it('throws when the output buffer is too small (fail loud rather than silently truncate)', () => {
    const into = new Float32Array(1)
    expect(() => buildSoundDrawingVectorscopeSegments(
      new Float32Array([0, 0.1, 0.2]), new Float32Array([0, 0, 0]), 3, WHITE, into,
    )).toThrow()
  })

  it('never allocates a new typed array internally (writes only into the provided buffer)', () => {
    const { a, b } = circleChannels(512)
    const into = new Float32Array(requiredSegmentFloats(512))
    const before = into.buffer
    buildSoundDrawingVectorscopeSegments(a, b, 512, WHITE, into)
    expect(into.buffer).toBe(before)
  })
})

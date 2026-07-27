import { describe, expect, it } from 'vitest'
import { GEOMETRY_SEGMENT_FLOAT_STRIDE } from '../../../shaders/runtime/GeometryPass'
import {
  packVectorBeamSegments,
  requiredBeamSegmentFloats,
  resolveBeamQuadHalfWidthPx,
} from '../soundDrawingBeamPacking'
import type { VectorBeamSegment } from '../../../vectorBeam/VectorBeamTypes'

const VIEWPORT = { width: 800, height: 400 }

function segment(overrides: Partial<VectorBeamSegment> = {}): VectorBeamSegment {
  return {
    origin: { x: 0, y: 0 },
    target: { x: 100, y: 100 },
    color: { r: 0.25, g: 0.5, b: 0.75, a: 1 },
    density: 1,
    dwellWeight: 0.5,
    velocityRatio: 0.5,
    historyWeight: 0.5,
    ...overrides,
  }
}

function buffer(segmentCount: number): Float32Array {
  return new Float32Array(requiredBeamSegmentFloats(segmentCount))
}

/** Reads one packed segment back out as named fields. */
function unpack(data: Float32Array, index: number) {
  const b = index * GEOMETRY_SEGMENT_FLOAT_STRIDE
  return {
    originX: data[b], originY: data[b + 1],
    targetX: data[b + 2], targetY: data[b + 3],
    r: data[b + 4], g: data[b + 5], b: data[b + 6], a: data[b + 7],
    density: data[b + 8], dwellWeight: data[b + 9], velocityRatio: data[b + 10],
  }
}

describe('buffer sizing', () => {
  it('matches the shared geometry stride', () => {
    expect(requiredBeamSegmentFloats(10)).toBe(10 * GEOMETRY_SEGMENT_FLOAT_STRIDE)
    expect(requiredBeamSegmentFloats(0)).toBe(0)
    expect(requiredBeamSegmentFloats(-5)).toBe(0)
  })
})

describe('coordinate conversion', () => {
  it('maps the canvas centre to the world origin', () => {
    const data = buffer(1)
    packVectorBeamSegments(
      [segment({ origin: { x: 400, y: 200 }, target: { x: 400, y: 200 } })],
      VIEWPORT, data,
    )
    const s = unpack(data, 0)
    expect(s.originX).toBeCloseTo(0, 6)
    expect(s.originY).toBeCloseTo(0, 6)
  })

  it('flips Y so canvas-down becomes clip-up', () => {
    const data = buffer(1)
    // Top of canvas (y=0) must become +1; bottom (y=height) must become -1.
    packVectorBeamSegments(
      [segment({ origin: { x: 400, y: 0 }, target: { x: 400, y: 400 } })],
      VIEWPORT, data,
    )
    const s = unpack(data, 0)
    expect(s.originY).toBeCloseTo(1, 6)
    expect(s.targetY).toBeCloseTo(-1, 6)
  })

  it('scales X by aspect so the shader division restores square units', () => {
    const data = buffer(1)
    // 800x400 is aspect 2. The right edge maps to +1 * aspect = +2, which the
    // vertex shader divides back to +1.
    packVectorBeamSegments(
      [segment({ origin: { x: 0, y: 200 }, target: { x: 800, y: 200 } })],
      VIEWPORT, data,
    )
    const s = unpack(data, 0)
    expect(s.originX).toBeCloseTo(-2, 6)
    expect(s.targetX).toBeCloseTo(2, 6)
  })

  it('keeps a circle circular on a non-square canvas', () => {
    // The packed world space is the isotropic one: a pixel-space circle must
    // have a constant radius here. The shader then divides X by aspect to reach
    // clip space, which is deliberately anisotropic because the viewport is —
    // that division is what puts equal pixel distances on screen in both axes.
    const radiusPx = 100
    const points = 64
    const segments: VectorBeamSegment[] = []
    for (let i = 0; i < points; i++) {
      const a0 = (i / points) * Math.PI * 2
      const a1 = ((i + 1) / points) * Math.PI * 2
      segments.push(segment({
        origin: { x: 400 + Math.cos(a0) * radiusPx, y: 200 + Math.sin(a0) * radiusPx },
        target: { x: 400 + Math.cos(a1) * radiusPx, y: 200 + Math.sin(a1) * radiusPx },
      }))
    }
    const data = buffer(points)
    packVectorBeamSegments(segments, VIEWPORT, data)

    for (let i = 0; i < points; i++) {
      const s = unpack(data, i)
      const radius = Math.hypot(s.originX, s.originY)
      expect(radius).toBeCloseTo(radiusPx / (VIEWPORT.height / 2), 5)
    }
  })

  it('places equal pixel distances equally on screen after the shader division', () => {
    // The end-to-end property the aspect factor exists to guarantee: a circle
    // that is round in pixels lands round in viewport pixels.
    const radiusPx = 100
    const data = buffer(2)
    packVectorBeamSegments(
      [
        // Rightmost point of the circle, then topmost.
        segment({ origin: { x: 400 + radiusPx, y: 200 }, target: { x: 400 + radiusPx, y: 200 } }),
        segment({ origin: { x: 400, y: 200 - radiusPx }, target: { x: 400, y: 200 - radiusPx } }),
      ],
      VIEWPORT, data,
    )
    const aspect = VIEWPORT.width / VIEWPORT.height
    const right = unpack(data, 0)
    const top = unpack(data, 1)

    // Clip space, as the vertex shader computes it, then back to viewport pixels.
    const rightPx = (right.originX / aspect) * (VIEWPORT.width / 2)
    const topPx = top.originY * (VIEWPORT.height / 2)
    expect(rightPx).toBeCloseTo(radiusPx, 5)
    expect(topPx).toBeCloseTo(radiusPx, 5)
  })
})

describe('attribute packing', () => {
  it('writes colour and beam-optics channels in the shared layout order', () => {
    const data = buffer(1)
    packVectorBeamSegments(
      [segment({ color: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 }, density: 0.6, dwellWeight: 0.7, velocityRatio: 0.8 })],
      VIEWPORT, data,
    )
    const s = unpack(data, 0)
    expect(s.r).toBeCloseTo(0.1, 6)
    expect(s.g).toBeCloseTo(0.2, 6)
    expect(s.b).toBeCloseTo(0.3, 6)
    expect(s.a).toBeCloseTo(0.4, 6)
    expect(s.density).toBeCloseTo(0.6, 6)
    expect(s.dwellWeight).toBeCloseTo(0.7, 6)
    expect(s.velocityRatio).toBeCloseTo(0.8, 6)
  })

  it('clamps beam-optics channels into their shader-assumed range', () => {
    const data = buffer(1)
    packVectorBeamSegments(
      [segment({ density: 5, dwellWeight: -2, velocityRatio: Number.NaN })],
      VIEWPORT, data,
    )
    const s = unpack(data, 0)
    expect(s.density).toBe(1)
    expect(s.dwellWeight).toBe(0)
    expect(s.velocityRatio).toBe(0)
  })

  it('reports the largest history weight for the persistence pass', () => {
    const data = buffer(3)
    const result = packVectorBeamSegments(
      [segment({ historyWeight: 0.2 }), segment({ historyWeight: 0.9 }), segment({ historyWeight: 0.4 })],
      VIEWPORT, data,
    )
    expect(result.maxHistoryWeight).toBeCloseTo(0.9, 6)
  })
})

describe('robustness', () => {
  it('skips non-finite segments instead of uploading a NaN that blanks the draw', () => {
    const data = buffer(3)
    const result = packVectorBeamSegments(
      [
        segment(),
        segment({ origin: { x: Number.NaN, y: 0 } }),
        segment({ target: { x: 0, y: Number.POSITIVE_INFINITY } }),
      ],
      VIEWPORT, data,
    )
    expect(result.segmentCount).toBe(1)
    for (let i = 0; i < GEOMETRY_SEGMENT_FLOAT_STRIDE; i++) {
      expect(Number.isFinite(data[i])).toBe(true)
    }
  })

  it('packs surviving segments contiguously so the draw count stays correct', () => {
    const data = buffer(3)
    const result = packVectorBeamSegments(
      [
        segment({ origin: { x: Number.NaN, y: 0 } }),
        segment({ density: 0.25 }),
        segment({ density: 0.75 }),
      ],
      VIEWPORT, data,
    )
    expect(result.segmentCount).toBe(2)
    // The rejected segment must not leave a hole the instanced draw would read.
    expect(unpack(data, 0).density).toBeCloseTo(0.25, 6)
    expect(unpack(data, 1).density).toBeCloseTo(0.75, 6)
  })

  it('never writes past the caller-owned buffer', () => {
    const data = buffer(2)
    const result = packVectorBeamSegments(
      [segment(), segment(), segment(), segment()],
      VIEWPORT, data,
    )
    expect(result.segmentCount).toBe(2)
    expect(data.length).toBe(requiredBeamSegmentFloats(2))
  })

  it('returns nothing for a degenerate viewport', () => {
    const data = buffer(1)
    expect(packVectorBeamSegments([segment()], { width: 0, height: 400 }, data).segmentCount).toBe(0)
    expect(packVectorBeamSegments([segment()], { width: 800, height: 0 }, data).segmentCount).toBe(0)
  })

  it('allocates nothing on repeated packs into the same buffer', () => {
    const data = buffer(2)
    const segments = [segment(), segment()]
    const first = packVectorBeamSegments(segments, VIEWPORT, data)
    const snapshot = Float32Array.from(data)
    const second = packVectorBeamSegments(segments, VIEWPORT, data)
    expect(second.segmentCount).toBe(first.segmentCount)
    expect(Array.from(data)).toEqual(Array.from(snapshot))
  })
})

describe('beam quad sizing', () => {
  it('expands wide enough to contain the halo Gaussian tail', () => {
    // Too narrow and the halo is sliced off with a straight edge along the beam.
    expect(resolveBeamQuadHalfWidthPx(2, 10)).toBeGreaterThan(10)
  })

  it('never returns less than the core width', () => {
    expect(resolveBeamQuadHalfWidthPx(12, 4)).toBeGreaterThanOrEqual(12)
  })

  it('stays positive for degenerate input', () => {
    expect(resolveBeamQuadHalfWidthPx(0, 0)).toBeGreaterThan(0)
    expect(resolveBeamQuadHalfWidthPx(Number.NaN, Number.NaN)).toBeGreaterThan(0)
  })
})

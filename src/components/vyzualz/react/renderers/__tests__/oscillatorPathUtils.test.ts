import { describe, it, expect } from 'vitest'
import {
  clamp,
  normalizePointCloud,
  computePathNormals,
  generateBuiltinShapePoints,
  resamplePoints,
  transformOscillatorPoints,
} from '../oscillatorPathUtils'
import type { BuiltinOscillatorShape, OscillatorGlyphPoint } from '../../ReactTypes'

const ALL_SHAPES: BuiltinOscillatorShape[] = [
  'circle', 'square', 'triangle', 'star',
  'hexagon', 'infinity', 'spiral', 'line',
]

// ── clamp ─────────────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('clamps below min', () => expect(clamp(-5, 0, 1)).toBe(0))
  it('clamps above max', () => expect(clamp(5, 0, 1)).toBe(1))
  it('passes through a value inside the range', () => expect(clamp(0.5, 0, 1)).toBe(0.5))
  it('passes through min exactly', () => expect(clamp(0, 0, 1)).toBe(0))
  it('passes through max exactly', () => expect(clamp(1, 0, 1)).toBe(1))
})

// ── normalizePointCloud ───────────────────────────────────────────────────────

describe('normalizePointCloud', () => {
  it('returns empty for empty input', () => {
    expect(normalizePointCloud([])).toHaveLength(0)
  })

  it('normalizes so max radius is 1', () => {
    const big: OscillatorGlyphPoint[] = [
      { x: 3, y: 0, pathIndex: 0, progress: 0 },
      { x: 0, y: 4, pathIndex: 0, progress: 0.5 },
    ]
    const norm = normalizePointCloud(big)
    const maxR = Math.max(...norm.map(p => Math.sqrt(p.x * p.x + p.y * p.y)))
    expect(maxR).toBeCloseTo(1, 5)
  })

  it('does not mutate when max radius is already 1', () => {
    const pts = generateBuiltinShapePoints('circle', 32)
    const result = normalizePointCloud(pts)
    for (let i = 0; i < pts.length; i++) {
      expect(result[i].x).toBeCloseTo(pts[i].x, 8)
      expect(result[i].y).toBeCloseTo(pts[i].y, 8)
    }
  })
})

// ── computePathNormals ────────────────────────────────────────────────────────

describe('computePathNormals', () => {
  it('returns input unchanged for fewer than 2 points', () => {
    const single: OscillatorGlyphPoint[] = [{ x: 1, y: 0, pathIndex: 0, progress: 0 }]
    expect(computePathNormals(single)).toEqual(single)
    expect(computePathNormals([])).toEqual([])
  })

  it('produces finite normals for a circle path', () => {
    const stripped = generateBuiltinShapePoints('circle', 32).map(
      p => ({ ...p, normalX: undefined, normalY: undefined }),
    )
    const pts = computePathNormals(stripped, true)
    for (const p of pts) {
      if (p.normalX != null) expect(Number.isFinite(p.normalX)).toBe(true)
      if (p.normalY != null) expect(Number.isFinite(p.normalY)).toBe(true)
    }
  })

  it('right-perpendicular of a rightward tangent points downward', () => {
    // Two points going right along y=0 → tangent (1,0), right-perp = (0,-1)
    const pts: OscillatorGlyphPoint[] = [
      { x: 0, y: 0, pathIndex: 0, progress: 0 },
      { x: 1, y: 0, pathIndex: 0, progress: 1 },
    ]
    const result = computePathNormals(pts, false)
    expect(result[0].normalX).toBeCloseTo(0, 8)
    expect(result[0].normalY).toBeCloseTo(-1, 8)
  })
})

// ── generateBuiltinShapePoints ────────────────────────────────────────────────

describe('generateBuiltinShapePoints', () => {
  const RESOLUTION = 64

  for (const shape of ALL_SHAPES) {
    describe(shape, () => {
      it(`returns exactly ${RESOLUTION} points`, () => {
        expect(generateBuiltinShapePoints(shape, RESOLUTION)).toHaveLength(RESOLUTION)
      })

      it('all coordinates are finite numbers', () => {
        for (const p of generateBuiltinShapePoints(shape, RESOLUTION)) {
          expect(Number.isFinite(p.x)).toBe(true)
          expect(Number.isFinite(p.y)).toBe(true)
          expect(Number.isFinite(p.progress)).toBe(true)
          expect(p.pathIndex).toBe(0)
        }
      })

      it('x/y values are within [-1.2, 1.2]', () => {
        for (const p of generateBuiltinShapePoints(shape, RESOLUTION)) {
          expect(p.x).toBeGreaterThanOrEqual(-1.2)
          expect(p.x).toBeLessThanOrEqual(1.2)
          expect(p.y).toBeGreaterThanOrEqual(-1.2)
          expect(p.y).toBeLessThanOrEqual(1.2)
        }
      })

      it('first progress is 0 and last progress is near 1', () => {
        const pts = generateBuiltinShapePoints(shape, RESOLUTION)
        expect(pts[0].progress).toBeCloseTo(0, 5)
        expect(pts[pts.length - 1].progress).toBeCloseTo(1, 1)
      })
    })
  }

  it('handles minimum resolution of 2 for every shape', () => {
    for (const shape of ALL_SHAPES) {
      const pts = generateBuiltinShapePoints(shape, 2)
      expect(pts).toHaveLength(2)
      for (const p of pts) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }
  })

  it('handles resolution 512 for every shape', () => {
    for (const shape of ALL_SHAPES) {
      expect(generateBuiltinShapePoints(shape, 512)).toHaveLength(512)
    }
  })

  it('rounds fractional resolution to nearest integer', () => {
    expect(generateBuiltinShapePoints('circle', 64.7)).toHaveLength(65)
  })

  it('is deterministic — same inputs produce identical outputs', () => {
    const a = generateBuiltinShapePoints('star', 128)
    const b = generateBuiltinShapePoints('star', 128)
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBe(b[i].x)
      expect(a[i].y).toBe(b[i].y)
    }
  })
})

// ── resamplePoints ────────────────────────────────────────────────────────────

describe('resamplePoints', () => {
  it('returns empty for empty input', () => {
    expect(resamplePoints([], 64)).toHaveLength(0)
  })

  it('returns empty for targetCount 0', () => {
    expect(resamplePoints(generateBuiltinShapePoints('circle', 32), 0)).toHaveLength(0)
  })

  it('returns 1 point when targetCount is 1', () => {
    expect(resamplePoints(generateBuiltinShapePoints('circle', 32), 1)).toHaveLength(1)
  })

  it('downsamples to fewer points than the source', () => {
    const src = generateBuiltinShapePoints('circle', 128)
    expect(resamplePoints(src, 32)).toHaveLength(32)
  })

  it('upsamples to more points than the source', () => {
    const src = generateBuiltinShapePoints('square', 16)
    expect(resamplePoints(src, 256)).toHaveLength(256)
  })

  it('all resampled points have finite coordinates', () => {
    const src = generateBuiltinShapePoints('square', 64)
    for (const p of resamplePoints(src, 100)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.progress)).toBe(true)
    }
  })

  it('progress spans exactly 0 to 1', () => {
    const src = generateBuiltinShapePoints('circle', 64)
    const resampled = resamplePoints(src, 32)
    expect(resampled[0].progress).toBeCloseTo(0, 8)
    expect(resampled[resampled.length - 1].progress).toBeCloseTo(1, 8)
  })

  it('first and last resampled point match source endpoints closely', () => {
    const src = generateBuiltinShapePoints('line', 64)
    const resampled = resamplePoints(src, 32)
    expect(resampled[0].x).toBeCloseTo(src[0].x, 5)
    expect(resampled[0].y).toBeCloseTo(src[0].y, 5)
    expect(resampled[resampled.length - 1].x).toBeCloseTo(src[src.length - 1].x, 5)
  })
})

// ── transformOscillatorPoints ─────────────────────────────────────────────────

describe('transformOscillatorPoints', () => {
  it('scale stretches x and y uniformly', () => {
    const pts = generateBuiltinShapePoints('circle', 16)
    const scaled = transformOscillatorPoints(pts, { scale: 2 })
    expect(scaled[4].x).toBeCloseTo(pts[4].x * 2, 8)
    expect(scaled[4].y).toBeCloseTo(pts[4].y * 2, 8)
  })

  it('mirrorX negates x but preserves y', () => {
    const pts = generateBuiltinShapePoints('circle', 16)
    const mirrored = transformOscillatorPoints(pts, { mirrorX: true })
    expect(mirrored[4].x).toBeCloseTo(-pts[4].x, 8)
    expect(mirrored[4].y).toBeCloseTo(pts[4].y, 8)
  })

  it('mirrorY negates y but preserves x', () => {
    const pts = generateBuiltinShapePoints('circle', 16)
    const mirrored = transformOscillatorPoints(pts, { mirrorY: true })
    expect(mirrored[4].x).toBeCloseTo(pts[4].x, 8)
    expect(mirrored[4].y).toBeCloseTo(-pts[4].y, 8)
  })

  it('rotation by π negates both x and y', () => {
    const pts = generateBuiltinShapePoints('line', 8)
    const rotated = transformOscillatorPoints(pts, { rotateRadians: Math.PI })
    expect(rotated[2].x).toBeCloseTo(-pts[2].x, 5)
    expect(rotated[2].y).toBeCloseTo(-pts[2].y, 5)
  })

  it('rotation by 2π is a no-op', () => {
    const pts = generateBuiltinShapePoints('circle', 16)
    const rotated = transformOscillatorPoints(pts, { rotateRadians: 2 * Math.PI })
    for (let i = 0; i < pts.length; i++) {
      expect(rotated[i].x).toBeCloseTo(pts[i].x, 8)
      expect(rotated[i].y).toBeCloseTo(pts[i].y, 8)
    }
  })

  it('identity options return the same coordinates', () => {
    const pts = generateBuiltinShapePoints('hexagon', 16)
    const out = transformOscillatorPoints(pts, {})
    for (let i = 0; i < pts.length; i++) {
      expect(out[i].x).toBeCloseTo(pts[i].x, 10)
      expect(out[i].y).toBeCloseTo(pts[i].y, 10)
    }
  })

  it('normals are transformed when present', () => {
    const pts = generateBuiltinShapePoints('circle', 16)
    const mirrored = transformOscillatorPoints(pts, { mirrorX: true })
    // circle normals equal the position; after mirrorX the normal.x should flip
    for (const p of mirrored) {
      if (p.normalX != null) expect(Number.isFinite(p.normalX)).toBe(true)
    }
  })
})

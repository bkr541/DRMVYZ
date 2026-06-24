import { describe, it, expect } from 'vitest'
import { resamplePoints } from './oscillatorPathUtils'
import type { OscillatorGlyphPoint } from '../ReactTypes'

// ── helpers ───────────────────────────────────────────────────────────────────

function makePt(
  x: number, y: number,
  overrides: Partial<OscillatorGlyphPoint> = {},
): OscillatorGlyphPoint {
  return { x, y, pathIndex: 0, progress: 0, ...overrides }
}

/** Horizontal line of n points at y=0, x from 0 to 1. */
function hLine(n: number, overrides: Partial<OscillatorGlyphPoint> = {}): OscillatorGlyphPoint[] {
  return Array.from({ length: n }, (_, i) => makePt(i / (n - 1), 0, overrides))
}

// ── localProgress ─────────────────────────────────────────────────────────────

describe('resamplePoints — localProgress', () => {
  it('sets localProgress 0→1 across the resampled output', () => {
    const pts = hLine(10)
    const out = resamplePoints(pts, 5)
    expect(out[0].localProgress).toBeCloseTo(0, 10)
    expect(out[4].localProgress).toBeCloseTo(1, 10)
    for (let i = 0; i < out.length; i++) {
      expect(out[i].localProgress).toBeCloseTo(i / 4, 10)
    }
  })

  it('localProgress matches progress (both are per-contour 0→1)', () => {
    const pts = hLine(20)
    const out = resamplePoints(pts, 8)
    for (const p of out) {
      expect(p.localProgress).toBeCloseTo(p.progress, 10)
    }
  })

  it('sets localProgress=0 when targetCount=1 (single-source edge case)', () => {
    const out = resamplePoints([makePt(0.5, 0.5)], 1)
    expect(out[0].localProgress).toBe(0)
  })

  it('sets localProgress=0 when points.length=1 and targetCount=3', () => {
    const out = resamplePoints([makePt(0, 0)], 3)
    expect(out[0].localProgress).toBeCloseTo(0, 10)
    expect(out[1].localProgress).toBeCloseTo(0.5, 10)
    expect(out[2].localProgress).toBeCloseTo(1, 10)
  })

  it('sets localProgress correctly when all source points are coincident (zero totalLen)', () => {
    const pts = [makePt(1, 1), makePt(1, 1), makePt(1, 1)]
    const out = resamplePoints(pts, 4)
    expect(out[0].localProgress).toBeCloseTo(0, 10)
    expect(out[3].localProgress).toBeCloseTo(1, 10)
  })
})

// ── characterIndex preservation ───────────────────────────────────────────────

describe('resamplePoints — characterIndex preservation', () => {
  it('preserves characterIndex from source points', () => {
    const pts = hLine(6, { characterIndex: 2 })
    const out = resamplePoints(pts, 4)
    for (const p of out) {
      expect(p.characterIndex).toBe(2)
    }
  })

  it('preserves characterIndex=0 (not treated as falsy)', () => {
    const pts = hLine(4, { characterIndex: 0 })
    const out = resamplePoints(pts, 3)
    for (const p of out) {
      expect(p.characterIndex).toBe(0)
    }
  })

  it('leaves characterIndex undefined when source has none', () => {
    const pts = hLine(4)
    const out = resamplePoints(pts, 3)
    for (const p of out) {
      expect(p.characterIndex).toBeUndefined()
    }
  })

  it('carries characterIndex through zero-length (coincident) source', () => {
    const pts = [makePt(0, 0, { characterIndex: 5 }), makePt(0, 0, { characterIndex: 5 })]
    const out = resamplePoints(pts, 3)
    for (const p of out) {
      expect(p.characterIndex).toBe(5)
    }
  })

  it('carries characterIndex through single-source-point expansion', () => {
    const out = resamplePoints([makePt(0, 0, { characterIndex: 3 })], 4)
    for (const p of out) {
      expect(p.characterIndex).toBe(3)
    }
  })
})

// ── glyphIndex preservation ───────────────────────────────────────────────────

describe('resamplePoints — glyphIndex preservation', () => {
  it('preserves glyphIndex from source points', () => {
    const pts = hLine(5, { glyphIndex: 1 })
    const out = resamplePoints(pts, 6)
    for (const p of out) {
      expect(p.glyphIndex).toBe(1)
    }
  })

  it('preserves glyphIndex=0 (not treated as falsy)', () => {
    const pts = hLine(4, { glyphIndex: 0 })
    const out = resamplePoints(pts, 4)
    for (const p of out) {
      expect(p.glyphIndex).toBe(0)
    }
  })

  it('leaves glyphIndex undefined when source has none', () => {
    const pts = hLine(4)
    const out = resamplePoints(pts, 4)
    for (const p of out) {
      expect(p.glyphIndex).toBeUndefined()
    }
  })

  it('carries glyphIndex through single-source-point expansion', () => {
    const out = resamplePoints([makePt(0, 0, { glyphIndex: 7 })], 2)
    for (const p of out) {
      expect(p.glyphIndex).toBe(7)
    }
  })
})

// ── combined metadata (both fields set) ──────────────────────────────────────

describe('resamplePoints — combined metadata', () => {
  it('preserves both characterIndex and glyphIndex together', () => {
    const pts = hLine(8, { characterIndex: 1, glyphIndex: 2 })
    const out = resamplePoints(pts, 5)
    for (const p of out) {
      expect(p.characterIndex).toBe(1)
      expect(p.glyphIndex).toBe(2)
    }
  })

  it('output count matches targetCount regardless of metadata', () => {
    const pts = hLine(10, { characterIndex: 0, glyphIndex: 0 })
    expect(resamplePoints(pts, 7)).toHaveLength(7)
    expect(resamplePoints(pts, 1)).toHaveLength(1)
    expect(resamplePoints(pts, 20)).toHaveLength(20)
  })

  it('does not mutate source points', () => {
    const pts = hLine(4, { characterIndex: 3, glyphIndex: 1 })
    const before = pts.map(p => ({ ...p }))
    resamplePoints(pts, 6)
    pts.forEach((p, i) => {
      expect(p.characterIndex).toBe(before[i].characterIndex)
      expect(p.glyphIndex).toBe(before[i].glyphIndex)
      expect(p.x).toBe(before[i].x)
      expect(p.y).toBe(before[i].y)
    })
  })
})

// ── pre-existing behaviour unchanged ─────────────────────────────────────────

describe('resamplePoints — pre-existing behaviour', () => {
  it('interpolates x/y positions along arc length', () => {
    const pts = [makePt(0, 0), makePt(1, 0), makePt(2, 0)]
    const out = resamplePoints(pts, 3)
    expect(out[0].x).toBeCloseTo(0, 5)
    expect(out[1].x).toBeCloseTo(1, 5)
    expect(out[2].x).toBeCloseTo(2, 5)
  })

  it('preserves pathIndex from source', () => {
    const pts = hLine(4, { pathIndex: 3 })
    const out = resamplePoints(pts, 3)
    for (const p of out) expect(p.pathIndex).toBe(3)
  })

  it('returns empty array when given empty input', () => {
    expect(resamplePoints([], 5)).toEqual([])
  })

  it('returns empty array when targetCount is 0', () => {
    expect(resamplePoints(hLine(4), 0)).toEqual([])
  })
})

/**
 * Tests for textGlyphUtils — the canvas-rasterisation path.
 *
 * assembleCharacterPoints is a pure function (no DOM) so tests run in the
 * default node environment.  textToGlyphPoints requires document and is
 * exercised only via the fallback-in-node smoke test at the bottom.
 */
import { describe, it, expect } from 'vitest'
import { assembleCharacterPoints, CHAR_PAD, textToGlyphPoints } from './textGlyphUtils'
import type { OscillatorGlyphPoint } from '../ReactTypes'

// ── Test helpers ──────────────────────────────────────────────────────────────

const CANVAS_HEIGHT = 128
const CANVAS_MID    = CANVAS_HEIGHT / 2

/**
 * Synthetic edge pixels for one character.
 * Produces a horizontal bar at y=canvasMid of `count` pixels, starting at
 * x=CHAR_PAD (the reference origin inside the per-char canvas).
 * Also adds rows at y=CANVAS_MID-10 and y=CANVAS_MID+10 so the y-range is
 * non-zero, making height-normalisation exercisable.
 */
function makeEdges(count: number, yOffset = 0): [number, number][] {
  const edges: [number, number][] = []
  for (let i = 0; i < count; i++) {
    edges.push([CHAR_PAD + i, CANVAS_MID + yOffset - 10])
    edges.push([CHAR_PAD + i, CANVAS_MID + yOffset])
    edges.push([CHAR_PAD + i, CANVAS_MID + yOffset + 10])
  }
  return edges
}

function distinctValues<T>(pts: OscillatorGlyphPoint[], key: keyof OscillatorGlyphPoint): T[] {
  return [...new Set(pts.map(p => p[key] as T))]
}

function pointsFor(pts: OscillatorGlyphPoint[], charIdx: number): OscillatorGlyphPoint[] {
  return pts.filter(p => p.characterIndex === charIdx)
}

// ── Repeated letters ──────────────────────────────────────────────────────────

describe('assembleCharacterPoints — repeated letters', () => {
  it('two identical chars produce different characterIndex values', () => {
    const chars      = ['A', 'A']
    const charWidths = [50, 50]
    const edges      = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)

    expect(pointsFor(pts, 0).length).toBeGreaterThan(0)
    expect(pointsFor(pts, 1).length).toBeGreaterThan(0)
  })

  it('two identical chars share the same glyphIndex', () => {
    const chars      = ['A', 'A']
    const charWidths = [50, 50]
    const edges      = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)

    const expectedGlyph = 'A'.codePointAt(0)
    expect(pts.every(p => p.glyphIndex === expectedGlyph)).toBe(true)
  })

  it('two identical chars get different pathIndex values', () => {
    const chars      = ['A', 'A']
    const charWidths = [50, 50]
    const edges      = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)

    const paths = distinctValues<number>(pts, 'pathIndex')
    expect(paths).toHaveLength(2)
  })

  it('three repeated chars each get a unique pathIndex', () => {
    const chars      = ['X', 'X', 'X']
    const charWidths = [40, 40, 40]
    const edges      = makeEdges(15)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edges, edges, edges], CANVAS_HEIGHT, 64)

    const paths = distinctValues<number>(pts, 'pathIndex')
    expect(paths).toHaveLength(3)
  })

  it('glyphIndex is the Unicode codePoint of the character', () => {
    const chars      = ['B', 'B']
    const charWidths = [50, 50]
    const edges      = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)

    expect(pts.every(p => p.glyphIndex === 'B'.codePointAt(0))).toBe(true)
  })

  it('mixed chars each carry their own glyphIndex', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 60]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(25)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edgesA, edgesB], CANVAS_HEIGHT, 64)

    expect(pointsFor(pts, 0).every(p => p.glyphIndex === 'A'.codePointAt(0))).toBe(true)
    expect(pointsFor(pts, 1).every(p => p.glyphIndex === 'B'.codePointAt(0))).toBe(true)
  })
})

// ── Space handling ────────────────────────────────────────────────────────────

describe('assembleCharacterPoints — spaces', () => {
  it('space char (empty edge list) produces no points', () => {
    const chars      = ['A', ' ', 'B']
    const charWidths = [50, 20, 60]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edgesA, [], edgesB], CANVAS_HEIGHT, 64)

    expect(pointsFor(pts, 1)).toHaveLength(0)
  })

  it('characterIndex for char after space reflects position in Array.from(text)', () => {
    const chars      = ['A', ' ', 'B']
    const charWidths = [50, 20, 60]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edgesA, [], edgesB], CANVAS_HEIGHT, 64)

    expect(pointsFor(pts, 0).length).toBeGreaterThan(0)  // 'A'
    expect(pointsFor(pts, 2).length).toBeGreaterThan(0)  // 'B'
    // characterIndex 1 ('space') must be absent
    expect(pts.some(p => p.characterIndex === 1)).toBe(false)
  })

  it('pathIndex values skip the space slot (no gap in counter)', () => {
    // A=pathIndex 0, B=pathIndex 1 — space consumes no counter slot
    const chars      = ['A', ' ', 'B']
    const charWidths = [50, 20, 60]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edgesA, [], edgesB], CANVAS_HEIGHT, 64)

    const paths = distinctValues<number>(pts, 'pathIndex').sort((a, b) => a - b)
    expect(paths).toEqual([0, 1])
  })

  it('multiple consecutive spaces are all skipped', () => {
    const chars      = ['A', ' ', ' ', 'B']
    const charWidths = [50, 20, 20, 60]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)
    const pts = assembleCharacterPoints(chars, charWidths, 0, [edgesA, [], [], edgesB], CANVAS_HEIGHT, 64)

    expect(pts.some(p => p.characterIndex === 1 || p.characterIndex === 2)).toBe(false)
    expect(pointsFor(pts, 0).length).toBeGreaterThan(0)
    expect(pointsFor(pts, 3).length).toBeGreaterThan(0)
  })

  it('space-only text (all empty edge lists) returns empty array', () => {
    const chars      = [' ', ' ']
    const charWidths = [20, 20]
    const pts = assembleCharacterPoints(chars, charWidths, 0, [[], []], CANVAS_HEIGHT, 64)
    expect(pts).toHaveLength(0)
  })
})

// ── Letter spacing ────────────────────────────────────────────────────────────

describe('assembleCharacterPoints — letter spacing', () => {
  it('positive gap shifts second character to the right', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 50]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)

    const ptsGap0  = assembleCharacterPoints(chars, charWidths, 0,  [edgesA, edgesB], CANVAS_HEIGHT, 64)
    const ptsGap20 = assembleCharacterPoints(chars, charWidths, 20, [edgesA, edgesB], CANVAS_HEIGHT, 64)

    const bMeanX = (pts: OscillatorGlyphPoint[]) =>
      pts.filter(p => p.characterIndex === 1).reduce((s, p) => s + p.x, 0) /
      pts.filter(p => p.characterIndex === 1).length

    // After normalization the absolute values shift, but B's mean x should be
    // further right relative to A's mean x when gap is larger.
    const aMean0 = ptsGap0.filter(p => p.characterIndex === 0).reduce((s, p) => s + p.x, 0)
      / ptsGap0.filter(p => p.characterIndex === 0).length
    const bMean0 = bMeanX(ptsGap0)
    const aMean20 = ptsGap20.filter(p => p.characterIndex === 0).reduce((s, p) => s + p.x, 0)
      / ptsGap20.filter(p => p.characterIndex === 0).length
    const bMean20 = bMeanX(ptsGap20)

    const separation0  = bMean0  - aMean0
    const separation20 = bMean20 - aMean20
    expect(separation20).toBeGreaterThan(separation0)
  })

  it('negative gap shifts second character to the left (tighter spacing)', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 50]
    const edgesA = makeEdges(20)
    const edgesB = makeEdges(20)

    const ptsGap0  = assembleCharacterPoints(chars, charWidths, 0,   [edgesA, edgesB], CANVAS_HEIGHT, 64)
    const ptsNeg   = assembleCharacterPoints(chars, charWidths, -10, [edgesA, edgesB], CANVAS_HEIGHT, 64)

    const separation = (pts: OscillatorGlyphPoint[]) => {
      const aMean = pts.filter(p => p.characterIndex === 0).reduce((s, p) => s + p.x, 0)
        / pts.filter(p => p.characterIndex === 0).length
      const bMean = pts.filter(p => p.characterIndex === 1).reduce((s, p) => s + p.x, 0)
        / pts.filter(p => p.characterIndex === 1).length
      return bMean - aMean
    }

    expect(separation(ptsNeg)).toBeLessThan(separation(ptsGap0))
  })

  it('gap=0 and gap=0 produce identical separations (deterministic)', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 50]
    const edges      = makeEdges(20)
    const a = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)
    const b = assembleCharacterPoints(chars, charWidths, 0, [edges, edges], CANVAS_HEIGHT, 64)
    expect(a.map(p => p.x)).toEqual(b.map(p => p.x))
  })

  it('single character: gap has no effect on output', () => {
    const chars      = ['A']
    const charWidths = [50]
    const edges      = makeEdges(20)
    const pts0  = assembleCharacterPoints(chars, charWidths, 0,  [edges], CANVAS_HEIGHT, 64)
    const pts20 = assembleCharacterPoints(chars, charWidths, 20, [edges], CANVAS_HEIGHT, 64)
    // Same x-values (word of one char; gap is applied between chars, not after last)
    expect(pts0.map(p => p.x.toFixed(6))).toEqual(pts20.map(p => p.x.toFixed(6)))
  })
})

// ── localProgress ─────────────────────────────────────────────────────────────

describe('assembleCharacterPoints — localProgress', () => {
  it('each character\'s points span localProgress 0→1', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 60]
    const pts = assembleCharacterPoints(
      chars, charWidths, 0,
      [makeEdges(30), makeEdges(30)],
      CANVAS_HEIGHT, 64,
    )
    for (const ci of [0, 1]) {
      const cPts = pointsFor(pts, ci)
      const lp = cPts.map(p => p.localProgress ?? -1)
      expect(Math.min(...lp)).toBeCloseTo(0, 5)
      expect(Math.max(...lp)).toBeCloseTo(1, 5)
    }
  })

  it('localProgress resets per character (second char starts at 0)', () => {
    const chars      = ['A', 'B']
    const charWidths = [50, 60]
    const pts = assembleCharacterPoints(
      chars, charWidths, 0,
      [makeEdges(30), makeEdges(30)],
      CANVAS_HEIGHT, 64,
    )
    const bFirst = pts.filter(p => p.characterIndex === 1)
      .reduce((mn, p) => Math.min(mn, p.localProgress ?? 1), 1)
    expect(bFirst).toBeCloseTo(0, 5)
  })
})

// ── pathIndex uniqueness ──────────────────────────────────────────────────────

describe('assembleCharacterPoints — pathIndex', () => {
  it('each active character gets a unique pathIndex', () => {
    const chars      = ['A', 'B', 'C']
    const charWidths = [50, 60, 55]
    const pts = assembleCharacterPoints(
      chars, charWidths, 0,
      [makeEdges(20), makeEdges(20), makeEdges(20)],
      CANVAS_HEIGHT, 64,
    )
    const paths = distinctValues<number>(pts, 'pathIndex')
    expect(paths).toHaveLength(3)
    expect(new Set(paths).size).toBe(3)
  })

  it('pathIndex values are non-negative integers starting from 0', () => {
    const chars      = ['X', 'Y']
    const charWidths = [40, 40]
    const pts = assembleCharacterPoints(
      chars, charWidths, 0,
      [makeEdges(20), makeEdges(20)],
      CANVAS_HEIGHT, 64,
    )
    const paths = distinctValues<number>(pts, 'pathIndex').sort((a, b) => a - b)
    expect(paths).toEqual([0, 1])
  })
})

// ── Normalization ─────────────────────────────────────────────────────────────

describe('assembleCharacterPoints — whole-word normalization', () => {
  it('y-extent is normalized to approximately [-1, 1]', () => {
    const edges = makeEdges(20)
    const pts = assembleCharacterPoints(['A'], [50], 0, [edges], CANVAS_HEIGHT, 64)
    const ys = pts.map(p => p.y)
    expect(Math.min(...ys)).toBeCloseTo(-1, 3)
    expect(Math.max(...ys)).toBeCloseTo(1, 3)
  })

  it('wider multi-char text extends beyond x=[-1, 1] (aspect ratio preserved)', () => {
    const edges = makeEdges(20)
    const pts = assembleCharacterPoints(
      ['A', 'B', 'C', 'D'],
      [80, 80, 80, 80],
      0,
      [edges, edges, edges, edges],
      CANVAS_HEIGHT, 256,
    )
    const xs = pts.map(p => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2)
  })

  it('normalization is applied across all characters together (not per-char)', () => {
    // If normalization were per-char, each character would independently span [-1,1].
    // With whole-word normalization, narrower chars span a smaller x-range.
    const edgesWide   = makeEdges(20)   // standard width
    const edgesNarrow = makeEdges(5)    // fewer pixels → narrower span

    const pts = assembleCharacterPoints(
      ['A', 'B'],
      [80, 20],  // A is much wider than B
      0,
      [edgesWide, edgesNarrow],
      CANVAS_HEIGHT, 128,
    )
    const aXRange = Math.max(...pointsFor(pts, 0).map(p => p.x)) - Math.min(...pointsFor(pts, 0).map(p => p.x))
    const bXRange = Math.max(...pointsFor(pts, 1).map(p => p.x)) - Math.min(...pointsFor(pts, 1).map(p => p.x))
    // A occupies more horizontal space than B after whole-word normalization
    expect(aXRange).toBeGreaterThan(bXRange)
  })
})

// ── Normals ───────────────────────────────────────────────────────────────────

describe('assembleCharacterPoints — normals', () => {
  it('all output points have normalX and normalY', () => {
    const pts = assembleCharacterPoints(['A'], [50], 0, [makeEdges(20)], CANVAS_HEIGHT, 64)
    expect(pts.every(p => p.normalX != null && p.normalY != null)).toBe(true)
  })
})

// ── Resolution distribution ───────────────────────────────────────────────────

describe('assembleCharacterPoints — proportional resolution', () => {
  it('total output point count is approximately equal to requested resolution', () => {
    const edges = makeEdges(30)
    const pts = assembleCharacterPoints(
      ['A', 'B'], [50, 50], 0, [edges, edges], CANVAS_HEIGHT, 100,
    )
    // Each char allocated ~50 points; with max(2,...) rounding, ≥ 100
    expect(pts.length).toBeGreaterThanOrEqual(100)
    // Should not be wildly over-allocated
    expect(pts.length).toBeLessThan(200)
  })

  it('larger edge lists receive more resolution points', () => {
    const smallEdges = makeEdges(10)
    const largeEdges = makeEdges(30)
    const pts = assembleCharacterPoints(
      ['A', 'B'], [50, 50], 0, [smallEdges, largeEdges], CANVAS_HEIGHT, 80,
    )
    // B has 3× more raw pixels → should get more output points
    expect(pointsFor(pts, 1).length).toBeGreaterThan(pointsFor(pts, 0).length)
  })
})

// ── Smoke test: textToGlyphPoints falls back in node environment ──────────────

describe('textToGlyphPoints — node-environment fallback', () => {
  it('returns circle fallback points when document is unavailable', () => {
    // Default vitest environment is node, so document is undefined.
    const pts = textToGlyphPoints('Hello', 64)
    expect(pts.length).toBeGreaterThan(0)
    // Circle fallback: no characterIndex metadata
    expect(pts.every(p => p.characterIndex === undefined)).toBe(true)
  })

  it('returns circle fallback for empty string', () => {
    const pts = textToGlyphPoints('', 64)
    expect(pts.length).toBeGreaterThan(0)
  })

  it('returns circle fallback for whitespace-only string', () => {
    const pts = textToGlyphPoints('   ', 64)
    expect(pts.length).toBeGreaterThan(0)
  })
})

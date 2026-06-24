import { describe, it, expect } from 'vitest'
import * as opentype from 'opentype.js'
import { textToOpenTypeGlyphPoints } from './fontGlyphUtils'
import type { OscillatorGlyphPoint } from '../ReactTypes'

// ── Mock font builder ─────────────────────────────────────────────────────────

type GlyphSpec = { index: number; advance: number; contours: number }

/**
 * Builds a minimal opentype.Font stand-in whose charToGlyph returns synthetic
 * glyphs.  Each contour is a distinct non-degenerate square so sampleGlyphPaths
 * produces the right number of closed contours.
 *
 * The squares are spread horizontally (200 font-units apart) so bounding boxes
 * don't overlap, which keeps the centering / normalization logic exercisable.
 */
function makeMockFont(charMap: Record<string, GlyphSpec>): opentype.Font {
  const defaultSpec: GlyphSpec = { index: 999, advance: 400, contours: 1 }

  function makeGlyphObj(spec: GlyphSpec) {
    return {
      index:        spec.index,
      advanceWidth: spec.advance,
      getPath(x: number, y: number, fontSize: number) {
        const s = fontSize / 1000
        const cmds: Array<Record<string, unknown>> = []
        for (let i = 0; i < spec.contours; i++) {
          // 100×100 square per contour, staggered so they don't collapse
          const ox = x + i * 200 * s
          const oy = y
          cmds.push(
            { type: 'M', x: ox,           y: oy           },
            { type: 'L', x: ox + 100 * s, y: oy           },
            { type: 'L', x: ox + 100 * s, y: oy + 100 * s },
            { type: 'L', x: ox,           y: oy + 100 * s },
            { type: 'Z' },
          )
        }
        return { commands: cmds }
      },
    }
  }

  return {
    unitsPerEm: 1000,
    charToGlyph(char: string) {
      return makeGlyphObj(charMap[char] ?? defaultSpec)
    },
    getKerningValue: () => 0,
  } as unknown as opentype.Font
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function distinctValues<T>(pts: OscillatorGlyphPoint[], key: keyof OscillatorGlyphPoint): T[] {
  return [...new Set(pts.map(p => p[key] as T))]
}

function pointsForChar(pts: OscillatorGlyphPoint[], ci: number): OscillatorGlyphPoint[] {
  return pts.filter(p => p.characterIndex === ci)
}

// ── characterIndex identity ───────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — characterIndex', () => {
  it('single-character text: all points have characterIndex=0', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 1 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 64)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts.every(p => p.characterIndex === 0)).toBe(true)
  })

  it('multi-character text: points partitioned by character position', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 600, contours: 1 },
      B: { index: 66, advance: 550, contours: 1 },
    })
    const pts = textToOpenTypeGlyphPoints(font, 'AB', 128)
    const charIndices = distinctValues<number>(pts, 'characterIndex')
    expect(charIndices.sort()).toEqual([0, 1])
  })

  it('characterIndex matches Array.from(text) position', () => {
    const font = makeMockFont({
      X: { index: 88, advance: 500, contours: 1 },
      Y: { index: 89, advance: 500, contours: 1 },
      Z: { index: 90, advance: 500, contours: 1 },
    })
    const pts = textToOpenTypeGlyphPoints(font, 'XYZ', 128)
    expect(pointsForChar(pts, 0).length).toBeGreaterThan(0)  // X
    expect(pointsForChar(pts, 1).length).toBeGreaterThan(0)  // Y
    expect(pointsForChar(pts, 2).length).toBeGreaterThan(0)  // Z
  })
})

// ── Multi-contour letter identity (the key guarantee) ────────────────────────

describe('textToOpenTypeGlyphPoints — multi-contour letter identity', () => {
  it('a letter with 2 contours: all points share characterIndex, but pathIndex is distinct per contour', () => {
    const font = makeMockFont({ O: { index: 79, advance: 600, contours: 2 } })
    const pts = textToOpenTypeGlyphPoints(font, 'O', 128)

    // Every point belongs to character 0
    expect(pts.every(p => p.characterIndex === 0)).toBe(true)

    // Exactly 2 distinct pathIndex values (outer contour + hole)
    const paths = distinctValues<number>(pts, 'pathIndex')
    expect(paths).toHaveLength(2)
  })

  it('a letter with 3 contours: pathIndex values are all distinct from each other', () => {
    const font = makeMockFont({ B: { index: 66, advance: 600, contours: 3 } })
    const pts = textToOpenTypeGlyphPoints(font, 'B', 128)

    expect(pts.every(p => p.characterIndex === 0)).toBe(true)

    const paths = distinctValues<number>(pts, 'pathIndex')
    expect(paths).toHaveLength(3)

    // All three pathIndex values are numerically distinct
    expect(new Set(paths).size).toBe(3)
  })

  it('two different letters: no pathIndex is shared between them', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 550, contours: 2 },  // 2 contours: pathIndex 0, 1
      B: { index: 66, advance: 600, contours: 3 },  // 3 contours: pathIndex 2, 3, 4
    })
    const pts = textToOpenTypeGlyphPoints(font, 'AB', 256)

    const aPaths = new Set(pointsForChar(pts, 0).map(p => p.pathIndex))
    const bPaths = new Set(pointsForChar(pts, 1).map(p => p.pathIndex))

    // A produces exactly 2 contours, B exactly 3
    expect(aPaths.size).toBe(2)
    expect(bPaths.size).toBe(3)

    // No overlap between A's and B's pathIndex sets
    for (const pi of aPaths) expect(bPaths.has(pi)).toBe(false)
  })

  it('multi-char multi-contour: total unique pathIndex count equals sum of contours', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 550, contours: 2 },
      B: { index: 66, advance: 600, contours: 3 },
      C: { index: 67, advance: 500, contours: 1 },
    })
    const pts = textToOpenTypeGlyphPoints(font, 'ABC', 256)
    const totalPaths = distinctValues<number>(pts, 'pathIndex')
    expect(totalPaths).toHaveLength(6)  // 2 + 3 + 1
  })
})

// ── glyphIndex ────────────────────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — glyphIndex', () => {
  it('all points for a character carry that character\'s font glyph index', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 600, contours: 2 },
      B: { index: 66, advance: 550, contours: 1 },
    })
    const pts = textToOpenTypeGlyphPoints(font, 'AB', 128)

    const aGlyphIndices = distinctValues<number>(pointsForChar(pts, 0), 'glyphIndex')
    const bGlyphIndices = distinctValues<number>(pointsForChar(pts, 1), 'glyphIndex')

    expect(aGlyphIndices).toEqual([65])
    expect(bGlyphIndices).toEqual([66])
  })

  it('repeated character: both instances share glyphIndex but differ in characterIndex', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 1 } })
    const pts = textToOpenTypeGlyphPoints(font, 'AA', 128)

    expect(pointsForChar(pts, 0).every(p => p.glyphIndex === 65)).toBe(true)
    expect(pointsForChar(pts, 1).every(p => p.glyphIndex === 65)).toBe(true)

    // Two distinct characters → two distinct characterIndex values
    expect(distinctValues<number>(pts, 'characterIndex').sort()).toEqual([0, 1])
  })

  it('all contours of a multi-contour letter share the same glyphIndex', () => {
    const font = makeMockFont({ O: { index: 79, advance: 600, contours: 3 } })
    const pts = textToOpenTypeGlyphPoints(font, 'O', 128)
    const glyphIndices = distinctValues<number>(pts, 'glyphIndex')
    expect(glyphIndices).toEqual([79])
  })
})

// ── Space / zero-contour character handling ───────────────────────────────────

describe('textToOpenTypeGlyphPoints — space and zero-contour characters', () => {
  it('space character emits no points but surrounding characters are correctly indexed', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 600, contours: 1 },
      ' ': { index: 3,  advance: 250, contours: 0 },
      B: { index: 66, advance: 550, contours: 1 },
    })
    // 'A B': Array.from gives ['A'=0, ' '=1, 'B'=2]
    const pts = textToOpenTypeGlyphPoints(font, 'A B', 128)

    // Space (charIdx=1) contributes no points
    expect(pointsForChar(pts, 1)).toHaveLength(0)

    // A (charIdx=0) and B (charIdx=2) both contribute points
    expect(pointsForChar(pts, 0).length).toBeGreaterThan(0)
    expect(pointsForChar(pts, 2).length).toBeGreaterThan(0)
  })

  it('space-only text (after trim removes all content) falls back to circle', () => {
    const font = makeMockFont({ ' ': { index: 3, advance: 250, contours: 0 } })
    // trim() removes leading/trailing spaces; '  ' trims to ''
    const pts = textToOpenTypeGlyphPoints(font, '   ', 64)
    // Falls back to circle (pathIndex 0 only, no characterIndex)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts.every(p => p.characterIndex === undefined)).toBe(true)
  })
})

// ── localProgress ─────────────────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — localProgress per contour', () => {
  it('each contour has localProgress spanning 0→1', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 2 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 128)

    const paths = distinctValues<number>(pts, 'pathIndex')
    for (const pi of paths) {
      const cPts = pts.filter(p => p.pathIndex === pi)
      const progValues = cPts.map(p => p.localProgress ?? -1)
      expect(Math.min(...progValues)).toBeCloseTo(0, 5)
      expect(Math.max(...progValues)).toBeCloseTo(1, 5)
    }
  })

  it('localProgress does not bleed across contours (each contour resets to 0)', () => {
    const font = makeMockFont({ B: { index: 66, advance: 600, contours: 3 } })
    const pts = textToOpenTypeGlyphPoints(font, 'B', 128)

    const paths = distinctValues<number>(pts, 'pathIndex')
    // Every contour must have at least one point near localProgress=0
    for (const pi of paths) {
      const cPts = pts.filter(p => p.pathIndex === pi)
      expect(Math.min(...cPts.map(p => p.localProgress ?? 1))).toBeCloseTo(0, 5)
    }
  })
})

// ── Centering and normalization ───────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — centering and height normalization', () => {
  it('bounding box is centered on the origin (midpoint ≈ 0)', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 1 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 128)
    const xs = pts.map(p => p.x)
    const ys = pts.map(p => p.y)
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2
    const midY = (Math.min(...ys) + Math.max(...ys)) / 2
    expect(midX).toBeCloseTo(0, 3)
    expect(midY).toBeCloseTo(0, 3)
  })

  it('y-extent is normalized to approximately [-1, 1]', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 1 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 128)
    const ys = pts.map(p => p.y)
    expect(Math.min(...ys)).toBeCloseTo(-1, 3)
    expect(Math.max(...ys)).toBeCloseTo(1, 3)
  })

  it('wider text extends beyond x=[-1,1] (aspect ratio preserved)', () => {
    const font = makeMockFont({
      A: { index: 65, advance: 600, contours: 1 },
      B: { index: 66, advance: 600, contours: 1 },
      C: { index: 67, advance: 600, contours: 1 },
      D: { index: 68, advance: 600, contours: 1 },
    })
    const pts = textToOpenTypeGlyphPoints(font, 'ABCD', 256)
    const xs = pts.map(p => p.x)
    // Wide text: x range > 2 (the y normalization scale makes text wider than tall)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(2)
  })
})

// ── Normals ───────────────────────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — normals', () => {
  it('all points carry normalX and normalY', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 1 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 128)
    expect(pts.every(p => p.normalX != null && p.normalY != null)).toBe(true)
  })

  it('normals are unit length (within floating-point tolerance)', () => {
    const font = makeMockFont({ A: { index: 65, advance: 600, contours: 2 } })
    const pts = textToOpenTypeGlyphPoints(font, 'A', 128)
    for (const p of pts) {
      if (p.normalX == null || p.normalY == null) continue
      const len = Math.sqrt(p.normalX ** 2 + p.normalY ** 2)
      expect(len).toBeCloseTo(1, 5)
    }
  })
})

// ── Fallback behaviour ────────────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints — fallback', () => {
  it('empty string falls back to circle points', () => {
    const font = makeMockFont({})
    const pts = textToOpenTypeGlyphPoints(font, '', 64)
    expect(pts.length).toBeGreaterThan(0)
    expect(pts.every(p => p.characterIndex === undefined)).toBe(true)
  })

  it('whitespace-only string falls back to circle points', () => {
    const font = makeMockFont({ ' ': { index: 3, advance: 250, contours: 0 } })
    const pts = textToOpenTypeGlyphPoints(font, '   ', 64)
    expect(pts.length).toBeGreaterThan(0)
  })
})

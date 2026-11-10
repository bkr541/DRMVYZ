import { describe, expect, it } from 'vitest'
import {
  buildXyScopeLayout,
  contourPerimeter,
  flattenXyScopePath,
  getDefaultXyScopeFont,
  resampleXyScopeContour,
  type XyScopeFontSource,
  type XyScopePathCommand,
} from './XyScopeGeometry'

const square: XyScopePathCommand[] = [
  { type: 'M', x: 0, y: 0 }, { type: 'L', x: 100, y: 0 }, { type: 'L', x: 100, y: 100 }, { type: 'L', x: 0, y: 100 }, { type: 'Z' },
]

function syntheticFont(glyphs: Record<string, XyScopePathCommand[]>, capHeight = 100): XyScopeFontSource {
  return {
    id: 'synthetic', unitsPerEm: 1000, capHeight,
    getGlyph: character => (glyphs[character] ? { advance: 120, commands: glyphs[character] } : null),
  }
}

describe('flattenXyScopePath', () => {
  it('flattens straight and curved commands into closed contours', () => {
    const [contour] = flattenXyScopePath(square)
    expect(contour).toEqual([0, 0, 100, 0, 100, 100, 0, 100])
    const curved = flattenXyScopePath([
      { type: 'M', x: 0, y: 0 }, { type: 'Q', x1: 50, y1: 100, x: 100, y: 0 }, { type: 'L', x: 0, y: 0 }, { type: 'Z' },
    ])
    expect(curved).toHaveLength(1)
    expect(curved[0].length / 2).toBeGreaterThan(8)
  })

  it('drops open or degenerate fragments and starts a new contour at each move', () => {
    expect(flattenXyScopePath([{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 1, y: 1 }, { type: 'Z' }])).toEqual([])
    const two = flattenXyScopePath([...square, { type: 'M', x: 200, y: 0 }, { type: 'L', x: 300, y: 0 }, { type: 'L', x: 300, y: 100 }, { type: 'Z' }])
    expect(two).toHaveLength(2)
  })
})

describe('resampleXyScopeContour', () => {
  it('keeps every sharp corner of a square as a point', () => {
    const [contour] = flattenXyScopePath(square)
    const points = resampleXyScopeContour(contour, 10)
    for (const corner of [[0, 0], [100, 0], [100, 100], [0, 100]]) {
      expect(points.some(([x, y]) => Math.abs(x - corner[0]) < 1e-6 && Math.abs(y - corner[1]) < 1e-6)).toBe(true)
    }
    expect(points.length).toBeGreaterThanOrEqual(38)
    expect(points.length).toBeLessThanOrEqual(44)
  })

  it('spaces points evenly along an edge', () => {
    const [contour] = flattenXyScopePath(square)
    const points = resampleXyScopeContour(contour, 25)
    const bottom = points.filter(([, y]) => y === 0).map(([x]) => x).sort((a, b) => a - b)
    expect(bottom).toEqual([0, 25, 50, 75, 100])
  })

  it('returns nothing for a degenerate contour', () => {
    expect(resampleXyScopeContour([0, 0, 1, 1], 5)).toEqual([])
  })
})

describe('buildXyScopeLayout', () => {
  const input = { text: 'DRMVYZ', font: getDefaultXyScopeFont(), width: 1000, height: 700, size: 0.84, letterSpacing: 0.024, minPieceSize: 0.07 }

  it('lays the default font out as six letters with counters kept as separate contours', () => {
    const layout = buildXyScopeLayout(input)
    expect(layout.glyphs.map(glyph => glyph.character).join('')).toBe('DRMVYZ')
    const d = layout.glyphs[0]
    expect(d.starts.length - 1).toBe(2) // outer shape and counter
    expect(d.starts[d.starts.length - 1]).toBe(d.count)
  })

  it('is deterministic and centres the word on the stage', () => {
    const a = buildXyScopeLayout(input)
    const b = buildXyScopeLayout(input)
    expect(a.glyphs.map(glyph => glyph.centerX)).toEqual(b.glyphs.map(glyph => glyph.centerX))
    expect(Array.from(a.glyphs[1].x.slice(0, 40))).toEqual(Array.from(b.glyphs[1].x.slice(0, 40)))
    const first = a.glyphs[0].centerX
    const last = a.glyphs[a.glyphs.length - 1].centerX
    expect(Math.abs(first + last)).toBeLessThan(30)
    expect(first).toBeLessThan(0)
    expect(last).toBeGreaterThan(0)
  })

  it('gives every point a unit normal and an arc fraction in range', () => {
    const layout = buildXyScopeLayout(input)
    for (const glyph of layout.glyphs) {
      for (let i = 0; i < glyph.count; i += 1) {
        expect(Math.hypot(glyph.nx[i], glyph.ny[i])).toBeCloseTo(1, 4)
        expect(glyph.s[i]).toBeGreaterThanOrEqual(0)
        expect(glyph.s[i]).toBeLessThan(1)
      }
      expect(glyph.s[glyph.count - 1]).toBeGreaterThan(0.9)
    }
  })

  it('keeps the point count bounded and fits the word inside the stage', () => {
    const layout = buildXyScopeLayout(input)
    expect(layout.totalPoints).toBeGreaterThan(1000)
    expect(layout.totalPoints).toBeLessThanOrEqual(12000)
    for (const glyph of layout.glyphs) {
      for (let i = 0; i < glyph.count; i += 1) {
        expect(Math.abs(glyph.centerX + glyph.x[i])).toBeLessThan(500)
        expect(Math.abs(glyph.y[i])).toBeLessThan(350)
      }
    }
  })

  it('ignores specks below the minimum piece size', () => {
    const speck: XyScopePathCommand[] = [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 2, y: 0 }, { type: 'L', x: 2, y: 2 }, { type: 'L', x: 0, y: 2 }, { type: 'Z' }]
    const font = syntheticFont({ A: [...square, ...speck.map(c => (c.type === 'Z' ? c : { ...c, x: (c as { x: number }).x + 300 }))] })
    const kept = buildXyScopeLayout({ ...input, text: 'A', font, minPieceSize: 0.5 })
    const all = buildXyScopeLayout({ ...input, text: 'A', font, minPieceSize: 0 })
    expect(kept.glyphs[0].starts.length - 1).toBe(1)
    expect(all.glyphs[0].starts.length - 1).toBe(2)
  })

  it('skips characters the font lacks and returns an empty layout when nothing can be drawn', () => {
    expect(buildXyScopeLayout({ ...input, text: 'D\u0001R' }).glyphs.length).toBeLessThanOrEqual(2)
    expect(buildXyScopeLayout({ ...input, text: '   ' }).glyphs).toHaveLength(0)
    expect(buildXyScopeLayout({ ...input, text: '' }).totalPoints).toBe(0)
    expect(buildXyScopeLayout({ ...input, width: 0 }).totalPoints).toBe(0)
  })

  it('exposes consistent perimeters', () => {
    const [contour] = flattenXyScopePath(square)
    expect(contourPerimeter(contour)).toBe(400)
  })
})

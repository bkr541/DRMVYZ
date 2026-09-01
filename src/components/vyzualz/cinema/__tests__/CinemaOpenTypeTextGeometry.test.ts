import { describe, expect, it } from 'vitest'
import type * as opentype from 'opentype.js'

import {
  CinemaOpenTypeTextMeshCache,
  compileCinemaOpenTypeText,
  createCinemaOpenTypeTextMeshKey,
} from '../CinemaOpenTypeTextGeometry'

type Command =
  | { type: 'M' | 'L'; x: number; y: number }
  | { type: 'Q'; x: number; y: number; x1: number; y1: number }
  | { type: 'C'; x: number; y: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'Z' }

interface GlyphFixture {
  index: number
  advanceWidth: number
  commands: Command[]
}

function rectangle(x0: number, y0: number, x1: number, y1: number): Command[] {
  return [
    { type: 'M', x: x0, y: y0 },
    { type: 'L', x: x1, y: y0 },
    { type: 'L', x: x1, y: y1 },
    { type: 'L', x: x0, y: y1 },
    { type: 'Z' },
  ]
}

function triangle(points: readonly [number, number][]): Command[] {
  return [
    { type: 'M', x: points[0][0], y: points[0][1] },
    { type: 'L', x: points[1][0], y: points[1][1] },
    { type: 'L', x: points[2][0], y: points[2][1] },
    { type: 'Z' },
  ]
}

function fixtureFont(): opentype.Font {
  const donut = [...rectangle(0, 0, 600, 1000), ...rectangle(180, 220, 420, 780)]
  const glyphs: Record<string, GlyphFixture> = {
    '.notdef': { index: 0, advanceWidth: 600, commands: rectangle(0, 0, 500, 1000) },
    ' ': { index: 1, advanceWidth: 320, commands: [] },
    A: {
      index: 2,
      advanceWidth: 620,
      commands: [
        ...triangle([[0, 0], [310, 1000], [620, 0]]),
        ...triangle([[220, 300], [310, 620], [400, 300]]),
      ],
    },
    B: {
      index: 3,
      advanceWidth: 620,
      commands: [
        ...rectangle(0, 0, 600, 1000),
        ...rectangle(180, 120, 430, 420),
        ...rectangle(180, 580, 430, 880),
      ],
    },
    D: { index: 4, advanceWidth: 640, commands: donut },
    O: { index: 5, advanceWidth: 650, commands: donut },
    P: { index: 6, advanceWidth: 610, commands: donut },
    R: { index: 7, advanceWidth: 640, commands: donut },
    V: { index: 8, advanceWidth: 620, commands: triangle([[0, 1000], [310, 0], [620, 1000]]) },
    i: { index: 9, advanceWidth: 280, commands: [...rectangle(60, 0, 220, 650), ...rectangle(60, 800, 220, 1000)] },
    S: {
      index: 10,
      advanceWidth: 620,
      commands: [
        { type: 'M', x: 0, y: 0 },
        { type: 'C', x1: 650, y1: 50, x2: 650, y2: 500, x: 300, y: 500 },
        { type: 'Q', x1: -50, y1: 500, x: 0, y: 1000 },
        { type: 'L', x: 600, y: 1000 },
        { type: 'L', x: 600, y: 0 },
        { type: 'Z' },
      ],
    },
  }

  const makeGlyph = (fixture: GlyphFixture) => ({
    index: fixture.index,
    advanceWidth: fixture.advanceWidth,
    getPath(x: number, y: number, fontSize: number) {
      const scale = fontSize / 1000
      return {
        commands: fixture.commands.map(command => {
          switch (command.type) {
            case 'Z':
              return { type: 'Z' as const }
            case 'M':
            case 'L':
              return { type: command.type, x: x + command.x * scale, y: y + command.y * scale }
            case 'Q':
              return {
                type: 'Q' as const,
                x: x + command.x * scale,
                y: y + command.y * scale,
                x1: x + command.x1 * scale,
                y1: y + command.y1 * scale,
              }
            case 'C':
              return {
                type: 'C' as const,
                x: x + command.x * scale,
                y: y + command.y * scale,
                x1: x + command.x1 * scale,
                y1: y + command.y1 * scale,
                x2: x + command.x2 * scale,
                y2: y + command.y2 * scale,
              }
          }
        }),
      }
    },
  })

  return {
    unitsPerEm: 1000,
    ascender: 1000,
    charToGlyph(character: string) {
      return makeGlyph(glyphs[character] ?? glyphs['.notdef']) as unknown as opentype.Glyph
    },
    getKerningValue(left: opentype.Glyph, right: opentype.Glyph) {
      return left.index === glyphs.A.index && right.index === glyphs.V.index ? -100 : 0
    },
  } as unknown as opentype.Font
}

function compile(text: string, overrides: Partial<Parameters<typeof compileCinemaOpenTypeText>[0]> = {}) {
  return compileCinemaOpenTypeText({
    font: fixtureFont(),
    fontIdentity: 'fixture-font',
    text,
    ...overrides,
  })
}

describe('Cinema OpenType true 3D text compiler', () => {
  it('compiles DROP into real indexed solid glyph geometry with front, back, and side surfaces', () => {
    const result = compile('DROP')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.mesh).not.toBeNull()
    expect(result.value.shape?.components).toHaveLength(4)
    expect(result.value.mesh?.surfaces.front.indexCount).toBeGreaterThan(0)
    expect(result.value.mesh?.surfaces.back.indexCount).toBeGreaterThan(0)
    expect(result.value.mesh?.surfaces.sides.indexCount).toBeGreaterThan(0)
    expect(new Set(Array.from(result.value.mesh?.positions ?? []).filter((_, index) => index % 3 === 2))).toEqual(new Set([0.5, -0.5]))
  })

  it('preserves interior holes for O, A, B, D, P, and R', () => {
    const result = compile('OABDPR')
    expect(result.ok).toBe(true)
    if (!result.ok || !result.value.shape) return
    const holesByGlyph = result.value.shape.components.map(component =>
      component.regions.reduce((sum, region) => sum + region.holes.length, 0),
    )
    expect(holesByGlyph).toEqual([1, 1, 2, 1, 1, 1])
  })

  it('preserves disconnected regions inside one glyph component', () => {
    const result = compile('i')
    expect(result.ok).toBe(true)
    if (!result.ok || !result.value.shape) return
    expect(result.value.shape.components).toHaveLength(1)
    expect(result.value.shape.components[0].regions).toHaveLength(2)
    expect(result.value.glyphs[0].componentId).toBe(result.value.shape.components[0].id)
  })

  it('reuses kerning and character-spacing layout semantics', () => {
    const kerned = compile('AV')
    const spaced = compile('AV', { letterSpacing: 10 })
    expect(kerned.ok).toBe(true)
    expect(spaced.ok).toBe(true)
    if (!kerned.ok || !spaced.ok) return
    const kernedDelta = kerned.value.glyphs[1].localOrigin[0] - kerned.value.glyphs[0].localOrigin[0]
    const spacedDelta = spaced.value.glyphs[1].localOrigin[0] - spaced.value.glyphs[0].localOrigin[0]
    // A/V advance 620 each, kerning -100, at the compiler's internal font size
    // (160) scaled to font units (620-100)*160/1000 = 83.2 world units, then
    // normalized by 2/height where height is the glyphs' 1000-unit em box
    // scaled to 160 world units: 83.2 * (2/160) = 1.04. letterSpacing (10) is
    // applied unscaled in world units before that same normalization:
    // (83.2+10) * (2/160) = 1.165.
    expect(kernedDelta).toBeCloseTo(1.04, 6)
    expect(spacedDelta).toBeCloseTo(1.165, 6)
  })

  it('preserves multiline line identity, line spacing, and alignment', () => {
    const centered = compile('OO\nO', { alignment: 'center', lineHeight: 1.5 })
    const left = compile('OO\nO', { alignment: 'left', lineHeight: 1.5 })
    expect(centered.ok).toBe(true)
    expect(left.ok).toBe(true)
    if (!centered.ok || !left.ok) return
    expect(centered.value.glyphs.map(glyph => glyph.lineIndex)).toEqual([0, 0, 1])
    expect(centered.value.glyphs[2].localOrigin[1]).toBeGreaterThan(centered.value.glyphs[0].localOrigin[1])
    expect(centered.value.glyphs[2].localOrigin[0]).toBeGreaterThan(left.value.glyphs[2].localOrigin[0])
  })

  it('treats empty and whitespace-only text as a valid empty source instead of fabricating geometry', () => {
    for (const text of ['', '   ', '\n\t\n']) {
      const result = compile(text)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.value.shape).toBeNull()
      expect(result.value.mesh).toBeNull()
      expect(result.value.glyphs).toEqual([])
    }
  })

  it('keeps missing-glyph identity explicit through the font notdef glyph', () => {
    const result = compile('Ω')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.glyphs[0].glyphIndex).toBe(0)
    expect(result.value.glyphs[0].componentId).not.toBeNull()
    expect(result.value.mesh).not.toBeNull()
  })

  it('flattens curves deterministically for stable source and tessellation settings', () => {
    const first = compile('S', { tessellation: { curveTolerance: 0.25, maxCurveDepth: 10 } })
    const second = compile('S', { tessellation: { curveTolerance: 0.25, maxCurveDepth: 10 } })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.value.cacheKey).toBe(second.value.cacheKey)
    expect(first.value.shape).toEqual(second.value.shape)
    expect(Array.from(first.value.mesh?.indices ?? [])).toEqual(Array.from(second.value.mesh?.indices ?? []))
  })

  it('exposes stable per-glyph identity and local bounds', () => {
    const result = compile('DROP')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.glyphs.map(glyph => glyph.id)).toEqual([
      'glyph:0:font:4',
      'glyph:1:font:7',
      'glyph:2:font:5',
      'glyph:3:font:6',
    ])
    for (const glyph of result.value.glyphs) {
      expect(glyph.localBounds).not.toBeNull()
      expect(glyph.localBounds?.size[0]).toBeGreaterThan(0)
      expect(glyph.localBounds?.size[1]).toBeGreaterThan(0)
    }
  })
})

describe('Cinema OpenType CPU mesh cache', () => {
  it('hits stable structural requests and invalidates text, font revision, layout, and tessellation changes', () => {
    const font = fixtureFont()
    const cache = new CinemaOpenTypeTextMeshCache(8)
    const base = { font, fontIdentity: 'font-asset-1', fontRevision: 7, text: 'DROP' }
    expect(cache.getOrCompile(base).ok).toBe(true)
    expect(cache.getOrCompile({ ...base }).ok).toBe(true)
    expect(cache.getStats()).toEqual({ entries: 1, buildCount: 1, hitCount: 1 })

    expect(cache.getOrCompile({ ...base, text: 'DROPS' }).ok).toBe(true)
    expect(cache.getOrCompile({ ...base, fontRevision: 8 }).ok).toBe(true)
    expect(cache.getOrCompile({ ...base, letterSpacing: 5 }).ok).toBe(true)
    expect(cache.getOrCompile({ ...base, tessellation: { curveTolerance: 0.2 } }).ok).toBe(true)
    expect(cache.getStats().buildCount).toBe(5)
    expect(cache.getStats().entries).toBe(5)
  })

  it('does not encode runtime transform or material state into topology identity', () => {
    const request = { font: fixtureFont(), fontIdentity: 'font-asset-1', text: 'DROP' }
    const key = createCinemaOpenTypeTextMeshKey(request)
    expect(key).toBe(createCinemaOpenTypeTextMeshKey({ ...request }))
    expect(key).not.toContain('position')
    expect(key).not.toContain('rotation')
    expect(key).not.toContain('material')
    expect(key).not.toContain('camera')
  })
})

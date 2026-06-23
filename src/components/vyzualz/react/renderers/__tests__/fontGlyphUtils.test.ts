import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OscillatorFontAsset } from '../../ReactTypes'

// ── Mock opentype.js before any source imports ────────────────────────────────
// vi.mock is hoisted; the factory must be self-contained.

vi.mock('opentype.js', () => ({
  parse: vi.fn(),
}))

import * as opentypeModule from 'opentype.js'
import {
  inspectFontFile,
  parseOpenTypeFontFromAsset,
  storeFontRuntime,
  hasFontRuntime,
  getFontFromCache,
  getBufferFromCache,
  evictFontFromCache,
  textToOpenTypeGlyphPoints,
} from '../fontGlyphUtils'

// ── Types ─────────────────────────────────────────────────────────────────────

type MockPathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' }

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeBuffer(bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer as ArrayBuffer
}

function makeMockFont(pathCommands: MockPathCommand[] = [
  { type: 'M', x: 0,   y: 0   },
  { type: 'L', x: 100, y: 0   },
  { type: 'L', x: 100, y: 100 },
  { type: 'Z' },
]) {
  return {
    names: {
      fullName:   { en: 'Test Font Full' },
      fontFamily: { en: 'Test Family' },
    },
    unitsPerEm: 1000,
    getPaths: vi.fn(() => [{ commands: pathCommands }]),
  }
}

function makeFontAsset(id = 'font-abc'): OscillatorFontAsset {
  return {
    id,
    name:        'Test Font',
    fileName:    'test.ttf',
    storagePath: `font-assets/user-1/${id}.ttf`,
    mimeType:    'font/ttf',
    fileSize:    1024,
    createdAt:   new Date().toISOString(),
    parseError:  null,
  }
}

function makeMockFile(name: string, bytes: number[], size?: number): File {
  const buffer = makeBuffer(bytes)
  return {
    name,
    size:        size ?? bytes.length,
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  } as unknown as File
}

// ── inspectFontFile ───────────────────────────────────────────────────────────

describe('inspectFontFile', () => {
  beforeEach(() => {
    vi.mocked(opentypeModule.parse).mockClear()
  })

  it('throws for non-ttf/otf files', async () => {
    const file = makeMockFile('track.mp3', [1, 2, 3])
    await expect(inspectFontFile(file)).rejects.toThrow('Only .ttf and .otf fonts are supported')
  })

  it('throws for files over 2 MB', async () => {
    const file = makeMockFile('big.ttf', [1, 2, 3], 2 * 1024 * 1024 + 1)
    await expect(inspectFontFile(file)).rejects.toThrow('Font file too large')
  })

  it('throws when opentype.parse fails', async () => {
    vi.mocked(opentypeModule.parse).mockImplementationOnce(() => { throw new Error('bad data') })
    const file = makeMockFile('broken.ttf', [0, 1, 2, 3])
    await expect(inspectFontFile(file)).rejects.toThrow('Failed to parse font: bad data')
  })

  it('returns metadata extracted from the font tables', async () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(opentypeModule.parse).mockReturnValueOnce(mockFont as any)
    const file = makeMockFile('MyFont.ttf', [1, 2, 3, 4])
    const result = await inspectFontFile(file)
    expect(result.name).toBe('Test Font Full')
    expect(result.fontFamilyName).toBe('Test Family')
    expect(result.fileName).toBe('MyFont.ttf')
    expect(result.mimeType).toBe('font/ttf')
    expect(result.fileSize).toBe(4)
  })

  it('sets mimeType to font/otf for .otf files', async () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(opentypeModule.parse).mockReturnValueOnce(mockFont as any)
    const file = makeMockFile('MyFont.otf', [1, 2, 3, 4])
    const result = await inspectFontFile(file)
    expect(result.mimeType).toBe('font/otf')
  })

  it('returns the raw ArrayBuffer and parsed font', async () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(opentypeModule.parse).mockReturnValueOnce(mockFont as any)
    const file = makeMockFile('MyFont.ttf', [10, 20, 30])
    const result = await inspectFontFile(file)
    expect(result.buffer).toBeInstanceOf(ArrayBuffer)
    expect(result.font).toBe(mockFont)
  })

  it('populates the runtime cache so parseOpenTypeFontFromAsset works immediately', async () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(opentypeModule.parse).mockReturnValueOnce(mockFont as any)
    const file = makeMockFile('CacheFont.ttf', [5, 6, 7, 8])
    const result = await inspectFontFile(file)

    const asset = makeFontAsset(result.id)
    expect(() => parseOpenTypeFontFromAsset(asset)).not.toThrow()
    expect(parseOpenTypeFontFromAsset(asset)).toBe(mockFont)
  })
})

// ── font runtime cache helpers ────────────────────────────────────────────────

describe('font runtime cache', () => {
  const ID = 'cache-test-id'

  beforeEach(() => {
    evictFontFromCache(ID)
  })

  it('hasFontRuntime returns false before storing', () => {
    expect(hasFontRuntime(ID)).toBe(false)
  })

  it('hasFontRuntime returns true after storeFontRuntime', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime(ID, font as any)
    expect(hasFontRuntime(ID)).toBe(true)
  })

  it('getFontFromCache returns undefined before storing', () => {
    expect(getFontFromCache(ID)).toBeUndefined()
  })

  it('getFontFromCache returns the stored font', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime(ID, font as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getFontFromCache(ID)).toBe(font as any)
  })

  it('getBufferFromCache returns undefined when no buffer was stored', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime(ID, font as any)  // no buffer argument
    expect(getBufferFromCache(ID)).toBeUndefined()
  })

  it('getBufferFromCache returns the stored buffer', () => {
    const font = makeMockFont()
    const buf = makeBuffer([1, 2, 3])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime(ID, font as any, buf)
    expect(getBufferFromCache(ID)).toBe(buf)
  })

  it('evictFontFromCache removes font and buffer', () => {
    const font = makeMockFont()
    const buf = makeBuffer([9, 8, 7])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime(ID, font as any, buf)
    evictFontFromCache(ID)
    expect(hasFontRuntime(ID)).toBe(false)
    expect(getFontFromCache(ID)).toBeUndefined()
    expect(getBufferFromCache(ID)).toBeUndefined()
  })
})

// ── parseOpenTypeFontFromAsset ────────────────────────────────────────────────

describe('parseOpenTypeFontFromAsset', () => {
  it('throws a descriptive error when font is not in the runtime cache', () => {
    const asset = makeFontAsset('font-not-loaded')
    evictFontFromCache('font-not-loaded')
    expect(() => parseOpenTypeFontFromAsset(asset)).toThrow('font data is not loaded')
  })

  it('returns the cached font without calling opentype.parse', () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime('font-preloaded', mockFont as any)
    const asset = makeFontAsset('font-preloaded')
    vi.mocked(opentypeModule.parse).mockClear()

    const result = parseOpenTypeFontFromAsset(asset)
    expect(result).toBe(mockFont)
    expect(vi.mocked(opentypeModule.parse)).not.toHaveBeenCalled()
  })

  it('returns the same reference on repeated calls', () => {
    const mockFont = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storeFontRuntime('font-repeat', mockFont as any)
    const asset = makeFontAsset('font-repeat')
    expect(parseOpenTypeFontFromAsset(asset)).toBe(parseOpenTypeFontFromAsset(asset))
  })
})

// ── textToOpenTypeGlyphPoints ─────────────────────────────────────────────────

describe('textToOpenTypeGlyphPoints', () => {
  it('returns finite normalized points for a simple triangle contour', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(font as any, 'A', 64)

    expect(pts.length).toBeGreaterThan(0)
    for (const p of pts) {
      expect(isFinite(p.x)).toBe(true)
      expect(isFinite(p.y)).toBe(true)
    }
  })

  it('all points have x,y in [-1,1] after normalization', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(font as any, 'B', 128)

    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1 + 1e-9)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('returns circle fallback for empty text', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(font as any, '   ', 64)

    const indices = new Set(pts.map(p => p.pathIndex))
    expect(indices.size).toBe(1)
    expect(indices.has(0)).toBe(true)
  })

  it('returns circle fallback when font.getPaths throws', () => {
    const brokenFont = { ...makeMockFont(), getPaths: vi.fn(() => { throw new Error('parse error') }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(brokenFont as any, 'X', 64)
    expect(pts.length).toBeGreaterThan(0)
    for (const p of pts) {
      expect(isFinite(p.x)).toBe(true)
      expect(isFinite(p.y)).toBe(true)
    }
  })

  it('two-contour glyph produces at least 2 distinct pathIndex values', () => {
    const twoContourFont = makeMockFont([
      { type: 'M', x: 0,  y: 0   },
      { type: 'L', x: 100, y: 0  },
      { type: 'L', x: 100, y: 100 },
      { type: 'Z' },
      { type: 'M', x: 20, y: 20  },
      { type: 'L', x: 80, y: 20  },
      { type: 'L', x: 80, y: 80  },
      { type: 'Z' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(twoContourFont as any, 'O', 128)
    const indices = new Set(pts.map(p => p.pathIndex))
    expect(indices.size).toBeGreaterThanOrEqual(2)
  })

  it('cubic bezier commands produce multiple points per command', () => {
    const cubicFont = makeMockFont([
      { type: 'M', x: 0,   y: 0 },
      { type: 'C', x1: 0, y1: 50, x2: 100, y2: 50, x: 100, y: 0 },
      { type: 'Z' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(cubicFont as any, 'C', 64)
    expect(pts.length).toBeGreaterThan(4)
  })

  it('quadratic bezier commands produce multiple points per command', () => {
    const quadFont = makeMockFont([
      { type: 'M', x: 0,   y: 0 },
      { type: 'Q', x1: 50, y1: 80, x: 100, y: 0 },
      { type: 'Z' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(quadFont as any, 'Q', 64)
    expect(pts.length).toBeGreaterThan(4)
  })

  it('progress field spans [0,1] within each contour', () => {
    const font = makeMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(font as any, 'P', 64)
    const sorted = [...pts].sort((a, b) => a.progress - b.progress)
    expect(sorted[0].progress).toBeCloseTo(0, 5)
    expect(sorted[sorted.length - 1].progress).toBeCloseTo(1, 5)
  })
})

// ── Height normalization preserves aspect ratio ───────────────────────────────

describe('textToOpenTypeGlyphPoints — height-normalised aspect ratio', () => {
  it('wide glyph has larger x-range than y-range after normalisation', () => {
    const wideRectFont = makeMockFont([
      { type: 'M', x: 0,   y: 0   },
      { type: 'L', x: 400, y: 0   },
      { type: 'L', x: 400, y: 100 },
      { type: 'L', x: 0,   y: 100 },
      { type: 'Z' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(wideRectFont as any, 'W', 128)

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    expect(maxX - minX).toBeGreaterThan(maxY - minY)
  })

  it('height is normalised to approximately [-1, 1] for a wide rectangle', () => {
    const wideRectFont = makeMockFont([
      { type: 'M', x: 0,   y: 0   },
      { type: 'L', x: 400, y: 0   },
      { type: 'L', x: 400, y: 100 },
      { type: 'L', x: 0,   y: 100 },
      { type: 'Z' },
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pts = textToOpenTypeGlyphPoints(wideRectFont as any, 'W', 128)

    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(-1 - 1e-9)
      expect(p.y).toBeLessThanOrEqual(1 + 1e-9)
    }
  })
})

// ── Letter-spacing unit conversion ───────────────────────────────────────────
//
// opentype.js font.getPaths() expects letterSpacing in **em units** — it
// multiplies the value by fontSize internally.  The UI slider and the canvas
// fallback use pixel-equivalent units (same absolute-pixel convention as the
// CSS letter-spacing pixel value).  The fix converts by dividing by fontSize.
//
// These tests use a spacing-aware mock: getPaths() returns two rectangles whose
// horizontal gap matches the pixel gap that opentype would produce
// (letterSpacingEm × fontSize).  This lets us verify both the argument passed
// to getPaths AND the resulting normalised x-range.

/** Internal font size fixed in fontGlyphUtils (must stay in sync with source). */
const OPENTYPE_FONT_SIZE = 160

function makeSpacingAwareMockFont() {
  return {
    names: {
      fullName:   { en: 'Spacing Font' },
      fontFamily: { en: 'Spacing Family' },
    },
    unitsPerEm: 1000,
    // getPaths is called with letterSpacingEm (already converted).
    // We simulate two 100×100 rectangles with a pixel gap = letterSpacingEm × fontSize.
    getPaths: vi.fn(
      (
        _text: string,
        _x: number, _y: number,
        fontSize: number,
        options: { letterSpacing?: number },
      ) => {
        const gap = (options?.letterSpacing ?? 0) * fontSize
        return [
          {
            commands: [
              { type: 'M', x: 0,           y: 0   },
              { type: 'L', x: 100,          y: 0   },
              { type: 'L', x: 100,          y: 100 },
              { type: 'L', x: 0,            y: 100 },
              { type: 'Z' },
              { type: 'M', x: 100 + gap,    y: 0   },
              { type: 'L', x: 200 + gap,    y: 0   },
              { type: 'L', x: 200 + gap,    y: 100 },
              { type: 'L', x: 100 + gap,    y: 100 },
              { type: 'Z' },
            ],
          },
        ]
      },
    ),
  }
}

function xRange(pts: ReturnType<typeof textToOpenTypeGlyphPoints>): number {
  let minX = Infinity, maxX = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
  }
  return maxX - minX
}

function yRange(pts: ReturnType<typeof textToOpenTypeGlyphPoints>): number {
  let minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return maxY - minY
}

describe('textToOpenTypeGlyphPoints — letter-spacing unit conversion', () => {
  it('passes letterSpacing divided by fontSize to font.getPaths', () => {
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textToOpenTypeGlyphPoints(font as any, 'AB', 64, { letterSpacing: OPENTYPE_FONT_SIZE })

    expect(font.getPaths).toHaveBeenCalledWith(
      'AB', 0, 0,
      OPENTYPE_FONT_SIZE,
      expect.objectContaining({ letterSpacing: 1.0 }),  // 160 / 160
    )
  })

  it('zero spacing calls getPaths with letterSpacing 0', () => {
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textToOpenTypeGlyphPoints(font as any, 'AB', 64, { letterSpacing: 0 })

    expect(font.getPaths).toHaveBeenCalledWith(
      'AB', 0, 0, OPENTYPE_FONT_SIZE,
      expect.objectContaining({ letterSpacing: 0 }),
    )
  })

  it('zero spacing produces narrower x-range than moderate spacing', () => {
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsZero     = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsModerate = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 80 })

    expect(xRange(ptsModerate)).toBeGreaterThan(xRange(ptsZero))
  })

  it('higher spacing produces wider x-range than moderate spacing', () => {
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsModerate = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 80  })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsHigh     = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 240 })

    expect(xRange(ptsHigh)).toBeGreaterThan(xRange(ptsModerate))
  })

  it('spacing increases x-range proportionally without changing y-range', () => {
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsZero = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 0   })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ptsHigh = textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 160 })

    // y-range is height-normalised to [-1,1] and must not change with spacing
    expect(yRange(ptsHigh)).toBeCloseTo(yRange(ptsZero), 6)

    // x-range must increase (two rects move further apart)
    expect(xRange(ptsHigh)).toBeGreaterThan(xRange(ptsZero))
  })

  it('x-range increases monotonically across zero → moderate → high spacing', () => {
    const font = makeSpacingAwareMockFont()
    const run = (spacing: number) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      xRange(textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: spacing }))

    const w0   = run(0)
    const w80  = run(80)
    const w240 = run(240)

    expect(w80).toBeGreaterThan(w0)
    expect(w240).toBeGreaterThan(w80)
  })

  it('no extreme x-range jump between zero and moderate spacing', () => {
    // Without the fix, letterSpacing=80 would be passed as 80 em → 80×160=12800px gap,
    // producing x-range >> 100× the zero-spacing case.
    // With the fix, 80/160=0.5 em → 80px gap, so x-range grows by a modest fraction.
    const font = makeSpacingAwareMockFont()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w0  = xRange(textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 0  }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w80 = xRange(textToOpenTypeGlyphPoints(font as any, 'AB', 128, { letterSpacing: 80 }))

    // Ratio should be modest (< 5×), never the 80×+ that the unfixed code produced.
    expect(w80 / w0).toBeLessThan(5)
    expect(w80 / w0).toBeGreaterThan(1)
  })
})

// ── SoundDrawingRenderer does not import fontGlyphUtils ───────────────────────

describe('SoundDrawingRenderer import guard', () => {
  it('does not re-export textToOpenTypeGlyphPoints (renderer must not call it)', async () => {
    const mod = await import('../SoundDrawingRenderer')
    expect((mod as Record<string, unknown>).textToOpenTypeGlyphPoints).toBeUndefined()
  })
})

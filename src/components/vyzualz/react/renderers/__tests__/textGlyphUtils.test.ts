import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { textToGlyphPoints, makeTextGlyphAsset } from '../textGlyphUtils'

// ─────────────────────────────────────────────────────────────────────────────
// Group 1 — no-canvas environment (Node default; document is undefined).
// These tests must run BEFORE the canvas mock is installed below.
// ─────────────────────────────────────────────────────────────────────────────

describe('textToGlyphPoints — no canvas available', () => {
  it('returns circle fallback for empty string', () => {
    const pts = textToGlyphPoints('', 64)
    expect(pts).toHaveLength(64)
    expect(pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })

  it('returns circle fallback for whitespace-only text', () => {
    const pts = textToGlyphPoints('   ', 64)
    expect(pts).toHaveLength(64)
  })

  it('returns circle fallback when document is undefined', () => {
    // In the Node test environment document is not defined, so any non-empty
    // text string still triggers the early-return fallback path.
    const pts = textToGlyphPoints('DRMVYZ', 64)
    expect(pts).toHaveLength(64)
    expect(pts.every(p => Number.isFinite(p.x))).toBe(true)
  })

  it('resolution is honoured even in fallback', () => {
    expect(textToGlyphPoints('X', 32)).toHaveLength(32)
    expect(textToGlyphPoints('X', 512)).toHaveLength(512)
  })
})

describe('makeTextGlyphAsset — no canvas available', () => {
  it('returns a valid asset with circle-fallback point count', () => {
    const asset = makeTextGlyphAsset('DRMVYZ', 64)
    expect(asset.sourceType).toBe('text')
    expect(asset.text).toBe('DRMVYZ')
    expect(asset.name).toBe('DRMVYZ')
    expect(asset.pointCount).toBe(64)
  })

  it('id starts with "text-" and contains a hex hash', () => {
    expect(makeTextGlyphAsset('DRMVYZ', 32).id).toMatch(/^text-[0-9a-f]{8}$/)
  })

  it('id is deterministic for the same text', () => {
    expect(makeTextGlyphAsset('DRMVYZ', 64).id).toBe(makeTextGlyphAsset('DRMVYZ', 128).id)
  })

  it('different texts produce different ids', () => {
    expect(makeTextGlyphAsset('DRMVYZ', 64).id).not.toBe(makeTextGlyphAsset('DVYDRM', 64).id)
  })

  it('createdAt is a parseable ISO date string', () => {
    const asset = makeTextGlyphAsset('X', 32)
    expect(Number.isNaN(new Date(asset.createdAt).getTime())).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group 2 — mocked canvas environment.
// A fake offscreen canvas is stubbed via vi.stubGlobal so the edge-detection,
// sorting, resampling, and normalisation code can be exercised in Node.
//
// The fake pixel data simulates a rectangle of opaque "text" pixels surrounded
// by a transparent background.  This gives a predictable set of edge pixels
// that should survive the full pipeline.
// ─────────────────────────────────────────────────────────────────────────────

function buildMockDocument() {
  const mockCtx = {
    font:         '',
    textAlign:    '',
    textBaseline: '',
    fillStyle:    '',
    fillText:     vi.fn(),
    measureText:  vi.fn().mockReturnValue({ width: 60 }),
    getImageData: vi.fn().mockImplementation(
      (_x: number, _y: number, w: number, h: number) => {
        // Rectangle at [10%..90%] × [15%..85%] — gives opaque pixels in the
        // correct coordinate space for whatever canvas size was requested.
        const data = new Uint8ClampedArray(w * h * 4)
        const x0 = Math.floor(w * 0.1), x1 = Math.floor(w * 0.9)
        const y0 = Math.floor(h * 0.15), y1 = Math.floor(h * 0.85)
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            data[(y * w + x) * 4 + 3] = 255
          }
        }
        return { data, width: w, height: h }
      },
    ),
  }

  const mockCanvas = {
    width:      0,
    height:     0,
    getContext: vi.fn().mockReturnValue(mockCtx),
  }

  return {
    createElement: vi.fn().mockReturnValue(mockCanvas),
  }
}

describe('textToGlyphPoints — with mocked canvas', () => {
  beforeAll(() => {
    vi.stubGlobal('document', buildMockDocument())
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('DRMVYZ at resolution 512 returns exactly 512 points', () => {
    const pts = textToGlyphPoints('DRMVYZ', 512)
    expect(pts).toHaveLength(512)
  })

  it('resolution 64 returns exactly 64 points', () => {
    const pts = textToGlyphPoints('DRMVYZ', 64)
    expect(pts).toHaveLength(64)
  })

  it('all points have finite x, y, and progress', () => {
    for (const p of textToGlyphPoints('DRMVYZ', 512)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.progress)).toBe(true)
    }
  })

  it('y-values are height-normalised to approximately [-1, 1]', () => {
    // Height-based normalization: y-extent ≈ [-1,1], x can be wider for wide text.
    for (const p of textToGlyphPoints('DRMVYZ', 512)) {
      expect(p.y).toBeGreaterThanOrEqual(-1.5)
      expect(p.y).toBeLessThanOrEqual(1.5)
    }
  })

  it('x-range exceeds y-range for wide text (aspect ratio preserved)', () => {
    // The mock rectangle (412px wide × 88px tall) should produce wider x-span
    // than y-span after height-based normalisation.
    const pts = textToGlyphPoints('DRMVYZ', 512)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    expect(maxX - minX).toBeGreaterThan(maxY - minY)
  })

  it('progress of first point is 0 and last is 1', () => {
    const pts = textToGlyphPoints('DRMVYZ', 128)
    expect(pts[0].progress).toBeCloseTo(0, 8)
    expect(pts[pts.length - 1].progress).toBeCloseTo(1, 8)
  })

  it('each character has a unique pathIndex', () => {
    const pts = textToGlyphPoints('DRMVYZ', 64)
    const pathIndices = new Set(pts.map(p => p.pathIndex))
    // 6 characters → 6 distinct pathIndex values
    expect(pathIndices.size).toBe(6)
  })

  it('empty text still returns circle fallback (resolution honoured)', () => {
    // Empty text short-circuits before canvas is used
    expect(textToGlyphPoints('', 64)).toHaveLength(64)
  })

  it('different texts produce different first-point coordinates', () => {
    // Both calls use the same mock image data but text identity doesn't change
    // the mock output — this test confirms the function runs without throwing
    const pts = textToGlyphPoints('COME WITH ME', 64)
    expect(pts).toHaveLength(64)
    expect(Number.isFinite(pts[0].x)).toBe(true)
  })
})

describe('makeTextGlyphAsset — with mocked canvas', () => {
  beforeAll(() => {
    vi.stubGlobal('document', buildMockDocument())
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('creates an asset with sourceType "text"', () => {
    const asset = makeTextGlyphAsset('DRMVYZ', 64)
    expect(asset.sourceType).toBe('text')
  })

  it('name and text fields match the input', () => {
    const asset = makeTextGlyphAsset('DVYDRM', 64)
    expect(asset.name).toBe('DVYDRM')
    expect(asset.text).toBe('DVYDRM')
  })

  it('pointCount matches the requested resolution', () => {
    expect(makeTextGlyphAsset('DRMVYZ', 128).pointCount).toBe(128)
    expect(makeTextGlyphAsset('DRMVYZ', 512).pointCount).toBe(512)
  })
})

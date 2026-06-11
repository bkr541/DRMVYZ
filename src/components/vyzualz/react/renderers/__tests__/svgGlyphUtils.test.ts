import { describe, it, expect } from 'vitest'
import {
  hashString,
  isSvgContent,
  extractSvgPathData,
  sampleSvgPathData,
  parseSvgToGlyphPoints,
  makeSvgGlyphAsset,
} from '../svgGlyphUtils'

// ── SVG fixtures ──────────────────────────────────────────────────────────────
// Note: tests run in the Node environment — DOMParser is unavailable, so
// extractSvgPathData uses its regex fallback for all fixtures below.

const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" />
</svg>`

const TRIANGLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 50 10 L 90 90 L 10 90 Z" />
</svg>`

const TWO_PATH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 10 10 L 50 10 L 50 50 L 10 50 Z" />
  <path d="M 60 60 L 90 60 L 90 90 L 60 90 Z" />
</svg>`

// SVG with only non-path primitives — no <path> elements to extract
const NO_PATH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="10" y="10" width="80" height="80" />
</svg>`

const INVALID_SVG = 'not valid xml at all !@#$%'

// ── isSvgContent ──────────────────────────────────────────────────────────────

describe('isSvgContent', () => {
  it('accepts a normal lowercase svg document', () => {
    expect(isSvgContent('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>')).toBe(true)
  })

  it('accepts an uppercase SVG tag', () => {
    expect(isSvgContent('<SVG xmlns="http://www.w3.org/2000/svg"><PATH d="M0 0" /></SVG>')).toBe(true)
  })

  it('accepts mixed-case Svg tag', () => {
    expect(isSvgContent('<Svg viewBox="0 0 100 100"></Svg>')).toBe(true)
  })

  it('accepts svg with leading whitespace', () => {
    expect(isSvgContent('   \n<svg><path d="M0 0"/></svg>')).toBe(true)
  })

  it('rejects plain text', () => {
    expect(isSvgContent('Hello, world!')).toBe(false)
  })

  it('rejects HTML that is not SVG', () => {
    expect(isSvgContent('<html><body><p>not svg</p></body></html>')).toBe(false)
  })

  it('rejects XML that is not SVG', () => {
    expect(isSvgContent('<?xml version="1.0"?><root><item/></root>')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isSvgContent('')).toBe(false)
  })

  it('rejects whitespace-only input', () => {
    expect(isSvgContent('   \n\t  ')).toBe(false)
  })
})

// ── hashString ────────────────────────────────────────────────────────────────

describe('hashString', () => {
  it('returns an 8-character lowercase hex string', () => {
    expect(hashString('hello')).toMatch(/^[0-9a-f]{8}$/)
    expect(hashString('DRMVYZ')).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic for the same input', () => {
    expect(hashString('test')).toBe(hashString('test'))
    expect(hashString('')).toBe(hashString(''))
  })

  it('produces different values for different inputs', () => {
    expect(hashString('abc')).not.toBe(hashString('xyz'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })

  it('handles empty string without throwing', () => {
    expect(() => hashString('')).not.toThrow()
    expect(hashString('')).toMatch(/^[0-9a-f]{8}$/)
  })
})

// ── extractSvgPathData ────────────────────────────────────────────────────────

describe('extractSvgPathData', () => {
  it('extracts a single path d attribute from a square SVG', () => {
    const paths = extractSvgPathData(SQUARE_SVG)
    expect(paths).toHaveLength(1)
    expect(paths[0]).toContain('M')
    expect(paths[0]).toContain('L')
  })

  it('extracts two path d attributes from a two-path SVG', () => {
    const paths = extractSvgPathData(TWO_PATH_SVG)
    expect(paths).toHaveLength(2)
  })

  it('returns an empty array when no <path> elements exist', () => {
    expect(extractSvgPathData(NO_PATH_SVG)).toHaveLength(0)
  })

  it('returns an empty array for an empty string', () => {
    expect(extractSvgPathData('')).toHaveLength(0)
  })

  it('returns an empty array for completely invalid SVG', () => {
    expect(extractSvgPathData(INVALID_SVG)).toHaveLength(0)
  })

  it('returns an empty array for SVG with empty d attribute', () => {
    const svg = `<svg><path d="" /></svg>`
    expect(extractSvgPathData(svg)).toHaveLength(0)
  })
})

// ── sampleSvgPathData ─────────────────────────────────────────────────────────

describe('sampleSvgPathData', () => {
  const SQUARE_PATH = 'M 10 10 L 90 10 L 90 90 L 10 90 Z'
  const TRIANGLE_PATH = 'M 50 10 L 90 90 L 10 90 Z'

  it('returns exactly the requested number of points', () => {
    expect(sampleSvgPathData(SQUARE_PATH, 32, 0)).toHaveLength(32)
    expect(sampleSvgPathData(SQUARE_PATH, 1,  0)).toHaveLength(1)
    expect(sampleSvgPathData(SQUARE_PATH, 128, 0)).toHaveLength(128)
  })

  it('returns an empty array for resolution 0', () => {
    expect(sampleSvgPathData(SQUARE_PATH, 0, 0)).toHaveLength(0)
  })

  it('returns an empty array for empty path data', () => {
    expect(sampleSvgPathData('', 32, 0)).toHaveLength(0)
  })

  it('all coordinates are finite numbers', () => {
    for (const p of sampleSvgPathData(SQUARE_PATH, 32, 0)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.progress)).toBe(true)
    }
  })

  it('progress spans 0 to 1 for multi-point samples', () => {
    const pts = sampleSvgPathData(SQUARE_PATH, 16, 0)
    expect(pts[0].progress).toBeCloseTo(0, 8)
    expect(pts[pts.length - 1].progress).toBeCloseTo(1, 8)
  })

  it('single-point sample has progress 0', () => {
    const pts = sampleSvgPathData(SQUARE_PATH, 1, 0)
    expect(pts[0].progress).toBe(0)
  })

  it('assigns the given pathIndex to every point', () => {
    for (const p of sampleSvgPathData(SQUARE_PATH, 8, 3)) {
      expect(p.pathIndex).toBe(3)
    }
  })

  it('works for triangle path data', () => {
    const pts = sampleSvgPathData(TRIANGLE_PATH, 24, 0)
    expect(pts).toHaveLength(24)
    for (const p of pts) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})

// ── parseSvgToGlyphPoints ─────────────────────────────────────────────────────

describe('parseSvgToGlyphPoints', () => {
  const RESOLUTION = 64

  it('returns exactly resolution points for a single-path SVG', () => {
    expect(parseSvgToGlyphPoints(SQUARE_SVG, RESOLUTION)).toHaveLength(RESOLUTION)
  })

  it('returns exactly resolution points for a triangle SVG', () => {
    expect(parseSvgToGlyphPoints(TRIANGLE_SVG, RESOLUTION)).toHaveLength(RESOLUTION)
  })

  it('returns exactly resolution points for a two-path SVG', () => {
    expect(parseSvgToGlyphPoints(TWO_PATH_SVG, RESOLUTION)).toHaveLength(RESOLUTION)
  })

  it('falls back to a circle when no <path> elements exist', () => {
    expect(parseSvgToGlyphPoints(NO_PATH_SVG, RESOLUTION)).toHaveLength(RESOLUTION)
  })

  it('falls back to a circle for completely invalid SVG', () => {
    expect(parseSvgToGlyphPoints(INVALID_SVG, RESOLUTION)).toHaveLength(RESOLUTION)
  })

  it('all points have finite x, y, and progress', () => {
    for (const p of parseSvgToGlyphPoints(SQUARE_SVG, RESOLUTION)) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(Number.isFinite(p.progress)).toBe(true)
    }
  })

  it('normalized x/y values are within [-1.2, 1.2]', () => {
    for (const p of parseSvgToGlyphPoints(SQUARE_SVG, RESOLUTION)) {
      expect(p.x).toBeGreaterThanOrEqual(-1.2)
      expect(p.x).toBeLessThanOrEqual(1.2)
      expect(p.y).toBeGreaterThanOrEqual(-1.2)
      expect(p.y).toBeLessThanOrEqual(1.2)
    }
  })

  it('triangle points are within [-1.2, 1.2]', () => {
    for (const p of parseSvgToGlyphPoints(TRIANGLE_SVG, RESOLUTION)) {
      expect(p.x).toBeGreaterThanOrEqual(-1.2)
      expect(p.x).toBeLessThanOrEqual(1.2)
      expect(p.y).toBeGreaterThanOrEqual(-1.2)
      expect(p.y).toBeLessThanOrEqual(1.2)
    }
  })

  it('two-path SVG preserves both pathIndex values', () => {
    const pts = parseSvgToGlyphPoints(TWO_PATH_SVG, RESOLUTION)
    const indices = new Set(pts.map(p => p.pathIndex))
    expect(indices.has(0)).toBe(true)
    expect(indices.has(1)).toBe(true)
  })

  it('works with odd resolution that does not divide evenly across paths', () => {
    const pts = parseSvgToGlyphPoints(TWO_PATH_SVG, 65)
    expect(pts).toHaveLength(65)
  })

  it('works with resolution 1', () => {
    const pts = parseSvgToGlyphPoints(SQUARE_SVG, 1)
    expect(pts).toHaveLength(1)
    expect(Number.isFinite(pts[0].x)).toBe(true)
  })
})

// ── makeSvgGlyphAsset ─────────────────────────────────────────────────────────

describe('makeSvgGlyphAsset', () => {
  it('returns an asset with sourceType "svgGlyph"', () => {
    expect(makeSvgGlyphAsset('My Glyph', SQUARE_SVG, 64).sourceType).toBe('svgGlyph')
  })

  it('stores the rawSvg on the asset', () => {
    expect(makeSvgGlyphAsset('G', SQUARE_SVG, 64).rawSvg).toBe(SQUARE_SVG)
  })

  it('uses the provided name', () => {
    expect(makeSvgGlyphAsset('Test Name', SQUARE_SVG, 64).name).toBe('Test Name')
  })

  it('pointCount matches the requested resolution', () => {
    expect(makeSvgGlyphAsset('G', SQUARE_SVG, 64).pointCount).toBe(64)
    expect(makeSvgGlyphAsset('G', SQUARE_SVG, 32).pointCount).toBe(32)
  })

  it('id starts with "glyph-" followed by a hex hash', () => {
    expect(makeSvgGlyphAsset('G', SQUARE_SVG, 64).id).toMatch(/^glyph-[0-9a-f]{8}$/)
  })

  it('id is deterministic — same SVG always produces the same id', () => {
    const a = makeSvgGlyphAsset('Alice', SQUARE_SVG, 64)
    const b = makeSvgGlyphAsset('Bob',   SQUARE_SVG, 128)
    expect(a.id).toBe(b.id)
  })

  it('different SVGs produce different ids', () => {
    const a = makeSvgGlyphAsset('G', SQUARE_SVG,   64)
    const b = makeSvgGlyphAsset('G', TRIANGLE_SVG, 64)
    expect(a.id).not.toBe(b.id)
  })

  it('createdAt is a parseable ISO date string', () => {
    const asset = makeSvgGlyphAsset('G', SQUARE_SVG, 32)
    expect(Number.isNaN(new Date(asset.createdAt).getTime())).toBe(false)
  })
})

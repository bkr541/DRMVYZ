import { describe, expect, it } from 'vitest'
import {
  collapseNearDuplicateSwatches,
  extractPaletteFromRgba,
  generatePaletteCandidates,
} from '../paletteExtraction'
import { contrastRatio, normalizeHexColor, readableTextColor } from '../paletteColorSpace'

function pixels(colors: Array<[number, number, number, number]>, repeat = 1): Uint8ClampedArray {
  return new Uint8ClampedArray(Array.from({ length: repeat }, () => colors).flat(2))
}

function repeatedColor(color: [number, number, number, number], count: number): number[] {
  return Array.from({ length: count }, () => color).flat()
}

describe('deterministic palette extraction', () => {
  it('returns identical analysis for identical pixels', () => {
    const rgba = pixels([[255, 0, 0, 255], [0, 0, 255, 255]], 40)
    expect(extractPaletteFromRgba(rgba, 10, 8)).toEqual(extractPaletteFromRgba(rgba, 10, 8))
  })

  it('collapses near-duplicate perceptual colors', () => {
    const collapsed = collapseNearDuplicateSwatches([
      { hex: '#FF0000', weight: 0.5, population: 10, chroma: 0.25 },
      { hex: '#FE0201', weight: 0.4, population: 8, chroma: 0.24 },
      { hex: '#0000FF', weight: 0.1, population: 2, chroma: 0.31 },
    ])
    expect(collapsed).toHaveLength(2)
    expect(collapsed.reduce((sum, swatch) => sum + swatch.weight, 0)).toBeCloseTo(1)
  })

  it('ignores nearly transparent pixels', () => {
    const rgba = pixels([[0, 255, 0, 5], [255, 0, 0, 255]], 60)
    const result = extractPaletteFromRgba(rgba, 12, 10)
    expect(result.swatches[0]?.hex).toBe('#FF0000')
    expect(result.metadata.ignoredTransparentPixels).toBeGreaterThan(0)
  })


  it('handles fully transparent artwork without inventing extracted swatches', () => {
    const result = extractPaletteFromRgba(
      new Uint8ClampedArray(repeatedColor([20, 40, 60, 0], 16)),
      4,
      4,
    )
    expect(result.swatches).toEqual([])
    expect(result.metadata.sampledPixels).toBe(0)
    expect(result.metadata.ignoredTransparentPixels).toBe(16)
    expect(result.metadata.warnings).toContain('No opaque pixels were available for palette analysis.')
  })

  it('prevents a huge white background from burying useful artwork colors', () => {
    const raw = [...repeatedColor([255, 255, 255, 255], 90), ...repeatedColor([255, 0, 0, 255], 10)]
    const result = extractPaletteFromRgba(new Uint8ClampedArray(raw), 10, 10)
    expect(result.candidates.faithful.primary).toBe('#FF0000')
  })

  it('prevents a huge black background from burying useful artwork colors', () => {
    const raw = [...repeatedColor([0, 0, 0, 255], 90), ...repeatedColor([0, 200, 255, 255], 10)]
    const result = extractPaletteFromRgba(new Uint8ClampedArray(raw), 10, 10)
    expect(result.candidates.faithful.primary).not.toBe('#000000')
  })

  it('uses tonal derivatives for monochrome logos', () => {
    const raw = [...repeatedColor([255, 255, 255, 255], 70), ...repeatedColor([30, 30, 30, 255], 30)]
    const result = extractPaletteFromRgba(new Uint8ClampedArray(raw), 10, 10)
    expect(result.metadata.isMonochrome).toBe(true)
    for (const color of Object.values(result.candidates.stageVibrant)) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1)
    }
  })

  it('generates all semantic roles and all candidates', () => {
    const candidates = generatePaletteCandidates([
      { hex: '#00AEEF', weight: 0.5, population: 50, chroma: 0.18 },
      { hex: '#7B2CFF', weight: 0.3, population: 30, chroma: 0.21 },
      { hex: '#101020', weight: 0.2, population: 20, chroma: 0.02 },
    ])
    expect(Object.keys(candidates)).toEqual(['faithful', 'stageVibrant', 'highContrast'])
    expect(Object.keys(candidates.faithful)).toEqual(['primary', 'secondary', 'accent', 'background', 'highlight', 'text'])
  })

  it('selects contrast-safe black or white text', () => {
    for (const background of ['#080B12', '#F5F5F5', '#7B2CFF']) {
      const text = readableTextColor(background)
      expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('normalizes invalid and shorthand colors', () => {
    expect(normalizeHexColor('abc')).toBe('#AABBCC')
    expect(normalizeHexColor('not-a-color', '#123456')).toBe('#123456')
  })
})

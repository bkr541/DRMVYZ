import { describe, it, expect } from 'vitest'
import { analyzeSvgCapabilities, resolveSvgRenderMode } from '../svgCapabilityAnalysis'

// ── analyzeSvgCapabilities ────────────────────────────────────────────────────

describe('analyzeSvgCapabilities', () => {
  it('returns isValidSvg: false for empty input', () => {
    const result = analyzeSvgCapabilities('')
    expect(result.isValidSvg).toBe(false)
    expect(result.hasVectorGeometry).toBe(false)
  })

  it('returns isValidSvg: false for non-SVG input', () => {
    const result = analyzeSvgCapabilities('<html><body></body></html>')
    expect(result.isValidSvg).toBe(false)
  })

  it('detects a simple path as vector geometry', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <path d="M 10 10 L 90 90 L 10 90 Z"/>
    </svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.isValidSvg).toBe(true)
    expect(result.hasVectorGeometry).toBe(true)
    expect(result.reactivePathCompatible).toBe(true)
    expect(result.recommendedRenderMode).toBe('reactivePath')
  })

  it('detects a rect as vector geometry', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.hasVectorGeometry).toBe(true)
    expect(result.supportedVectorElementCount).toBeGreaterThan(0)
  })

  it('detects a circle as vector geometry', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.hasVectorGeometry).toBe(true)
  })

  it('detects embedded raster in a data: URI image', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image href="data:image/png;base64,iVBORw0KGgo=" width="100" height="100"/>
    </svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.hasEmbeddedRaster).toBe(true)
  })

  it('marks raster-only SVG as not reactivePathCompatible', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <image href="data:image/png;base64,iVBORw0KGgo=" width="100" height="100"/>
    </svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.reactivePathCompatible).toBe(false)
    expect(result.recommendedRenderMode).toBe('originalArtwork')
  })

  it('detects text elements', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.hasTextElements).toBe(true)
    expect(result.recommendedRenderMode).toBe('originalArtwork')
  })

  it('detects complex features: linearGradient', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient></defs>
      <path d="M0 0 L100 100" fill="url(#g)"/>
    </svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.hasComplexFeatures).toBe(true)
    expect(result.recommendedRenderMode).toBe('originalArtwork')
  })

  it('recommends reactivePath for a clean geometric SVG', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="80"/>
      <rect x="20" y="20" width="160" height="160"/>
    </svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.recommendedRenderMode).toBe('reactivePath')
    expect(result.reactivePathCompatible).toBe(true)
    expect(result.originalArtworkCompatible).toBe(true)
  })

  it('is always originalArtworkCompatible for valid SVG', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.originalArtworkCompatible).toBe(true)
  })

  it('handles an SVG with no drawable content', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><defs></defs></svg>`
    const result = analyzeSvgCapabilities(svg)
    expect(result.isValidSvg).toBe(true)
    expect(result.hasVectorGeometry).toBe(false)
    expect(result.recommendedRenderMode).toBe('originalArtwork')
  })
})

// ── resolveSvgRenderMode ──────────────────────────────────────────────────────

describe('resolveSvgRenderMode', () => {
  const reactiveCapabilities = {
    isValidSvg: true,
    hasVectorGeometry: true,
    hasEmbeddedRaster: false,
    hasExternalRaster: false,
    hasTextElements: false,
    hasComplexFeatures: false,
    supportedVectorElementCount: 2,
    unsupportedElementTypes: [],
    reactivePathCompatible: true,
    originalArtworkCompatible: true,
    recommendedRenderMode: 'reactivePath' as const,
  }

  const rasterOnlyCapabilities = {
    isValidSvg: true,
    hasVectorGeometry: false,
    hasEmbeddedRaster: true,
    hasExternalRaster: false,
    hasTextElements: false,
    hasComplexFeatures: false,
    supportedVectorElementCount: 0,
    unsupportedElementTypes: [],
    reactivePathCompatible: false,
    originalArtworkCompatible: true,
    recommendedRenderMode: 'originalArtwork' as const,
  }

  it('auto picks reactivePath when capability supports it', () => {
    expect(resolveSvgRenderMode('auto', reactiveCapabilities)).toBe('reactivePath')
  })

  it('auto picks originalArtwork for raster-only SVG', () => {
    expect(resolveSvgRenderMode('auto', rasterOnlyCapabilities)).toBe('originalArtwork')
  })

  it('originalArtwork overrides capability', () => {
    expect(resolveSvgRenderMode('originalArtwork', reactiveCapabilities)).toBe('originalArtwork')
  })

  it('reactivePath uses capability — falls back if not compatible', () => {
    expect(resolveSvgRenderMode('reactivePath', rasterOnlyCapabilities)).toBe('originalArtwork')
    expect(resolveSvgRenderMode('reactivePath', reactiveCapabilities)).toBe('reactivePath')
  })
})

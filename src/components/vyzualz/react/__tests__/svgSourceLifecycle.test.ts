import { describe, expect, it } from 'vitest'
import { DEFAULT_OSCILLATOR_SETTINGS } from '../ReactTypes'
import type { OscillatorGlyphAsset, OscillatorSettings } from '../ReactTypes'
import { getSvgGlyphCacheKey } from '../renderers/svgGlyphUtils'
import {
  buildUnifiedSvgStatus,
  getSvgGlyphAssetId,
  isUnifiedSvgMediaItem,
  normalizeUnifiedSvgSettings,
  resolveSvgUiCapabilities,
} from '../svgSourceLifecycle'

function settings(patch: Partial<OscillatorSettings>): OscillatorSettings {
  return { ...DEFAULT_OSCILLATOR_SETTINGS, ...patch }
}

describe('unified SVG compatibility boundaries', () => {
  it('converts media-backed legacy selections to the unified source model', () => {
    const visual = normalizeUnifiedSvgSettings(settings({
      sourceType: 'svgVisual',
      selectedSvgVisualId: 'media-visual',
    }))
    expect(visual.sourceType).toBe('svg')
    expect(visual.selectedSvgId).toBe('media-visual')
    expect(visual.svgRenderMode).toBe('originalArtwork')

    const glyph = normalizeUnifiedSvgSettings(settings({
      sourceType: 'svgGlyph',
      selectedGlyphId: 'glyph-media:media-glyph',
    }))
    expect(glyph.sourceType).toBe('svg')
    expect(glyph.selectedSvgId).toBe('media-glyph')
    expect(glyph.svgRenderMode).toBe('reactivePath')
  })



  it('derives Original Artwork controls from unified and legacy settings', () => {
    const unifiedArtwork = resolveSvgUiCapabilities(settings({
      sourceType: 'svg',
      selectedSvgId: 'media-artwork',
      svgRenderMode: 'originalArtwork',
    }))
    expect(unifiedArtwork).toEqual({
      isSvgSource: true,
      isOriginalArtwork: true,
      supportsPointPathControls: false,
    })

    const legacyArtwork = resolveSvgUiCapabilities(settings({
      sourceType: 'svgVisual',
      selectedSvgVisualId: 'legacy-artwork',
    }))
    expect(legacyArtwork).toEqual(unifiedArtwork)

    expect(resolveSvgUiCapabilities(settings({
      sourceType: 'svg',
      selectedSvgId: 'media-path',
      svgRenderMode: 'reactivePath',
    })).supportsPointPathControls).toBe(true)


    const autoArtwork = settings({
      sourceType: 'svg',
      selectedSvgId: 'media-auto',
      svgRenderMode: 'auto',
    })
    expect(resolveSvgUiCapabilities(autoArtwork, 0).isOriginalArtwork).toBe(true)
    expect(resolveSvgUiCapabilities(autoArtwork, 12).supportsPointPathControls).toBe(true)
  })
  it('preserves non-media legacy glyph libraries until they are imported', () => {
    const custom = normalizeUnifiedSvgSettings(settings({
      sourceType: 'svgGlyph',
      selectedGlyphId: 'custom-uploaded-glyph',
      selectedSvgId: 'stale-media-selection',
    }))
    expect(custom.sourceType).toBe('svgGlyph')
    expect(custom.selectedGlyphId).toBe('custom-uploaded-glyph')
  })
})

describe('SVG media filtering', () => {
  it('does not accept a file solely because its name ends in .svg', () => {
    expect(isUnifiedSvgMediaItem({
      id: 'fake',
      name: 'renamed.svg',
      mediaRole: 'background_image',
      mimeType: 'image/png',
    })).toBe(false)
  })

  it('rejects content-inspected image-wrapped SVG media', () => {
    expect(isUnifiedSvgMediaItem({
      id: 'wrapped',
      name: 'wrapped.svg',
      mediaRole: 'svg',
      mimeType: 'image/svg+xml',
      metadata: {
        svgValidation: {
          isValidSvg: true,
          hasVectorGeometry: false,
          hasEmbeddedRaster: true,
          hasExternalRaster: false,
          reactivePathCompatible: false,
        },
      },
    })).toBe(false)
  })

  it('accepts a validated vector SVG and keeps legacy role-only libraries compatible', () => {
    expect(isUnifiedSvgMediaItem({
      id: 'vector',
      name: 'vector.asset',
      mediaRole: 'svg',
      mimeType: 'application/octet-stream',
      metadata: {
        svgValidation: {
          isValidSvg: true,
          hasVectorGeometry: true,
          hasEmbeddedRaster: false,
          hasExternalRaster: false,
          reactivePathCompatible: true,
        },
      },
    })).toBe(true)

    expect(isUnifiedSvgMediaItem({
      id: 'legacy',
      name: 'legacy-library-item',
      mediaRole: 'svg',
      mimeType: null,
    })).toBe(true)
  })
})

describe('unified SVG status model', () => {
  it('reports selected name, mode, point count, and loading state from unified IDs', () => {
    const osc = settings({
      sourceType: 'svg',
      selectedSvgId: 'media-1',
      svgRenderMode: 'auto',
      pathResolution: 512,
    })
    const asset: OscillatorGlyphAsset = {
      id: getSvgGlyphAssetId('media-1'),
      name: 'Stage Logo',
      sourceType: 'svgGlyph',
      rawSvg: '<svg><path d="M0 0L1 1"/></svg>',
      contentHash: 'hash',
      pointCount: 2,
      createdAt: '2026-06-27T00:00:00.000Z',
    }
    const key = getSvgGlyphCacheKey(asset.id, 512, asset.contentHash)
    const status = buildUnifiedSvgStatus(
      osc,
      [asset],
      { [key]: [
        { x: 0, y: 0, pathIndex: 0, progress: 0 },
        { x: 1, y: 1, pathIndex: 0, progress: 1 },
      ] },
      [{ id: 'media-1', name: 'stage-logo.svg', title: 'Stage Logo', mediaRole: 'svg' }],
      {
        id: 'media-1', loading: true, image: null, objectUrl: null,
        loaded: false, error: null, width: 0, height: 0,
      },
    )

    expect(status).toMatchObject({
      mediaId: 'media-1',
      assetName: 'Stage Logo',
      renderMode: 'auto',
      renderModeLabel: 'Auto',
      resolvedMode: 'reactivePath',
      pointCount: 2,
      loading: true,
    })


    const beforeMediaHydrates = buildUnifiedSvgStatus(
      osc,
      [asset],
      { [key]: [] },
      [],
      null,
    )
    expect(beforeMediaHydrates?.assetName).toBe('Stage Logo')
  })
})

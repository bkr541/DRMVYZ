import { beforeEach, describe, expect, it } from 'vitest'
import type { ActiveBrandKitData } from '../BrandKitTypes'
import {
  normalizeBrandKitEngineRules,
  normalizeBrandKitRow,
} from '../brandKitNormalization'
import {
  BRAND_KIT_CACHE_VERSION,
  brandKitCacheKey,
  readBrandKitCache,
  writeBrandKitCache,
} from '../brandKitStore'
import { mergeMediaMetadata } from '../mediaPaletteMetadata'

const activeFixture: ActiveBrandKitData = {
  kit: {
    id: 'kit-1', userId: 'user-a', name: 'Main',
    palette: { primary: '#112233', secondary: '#223344', accent: '#334455', background: '#000000', highlight: '#FFFFFF', text: '#FFFFFF' },
    extractedPalette: null, extractionMetadata: null, defaultStrength: 0.75,
    engineRules: {}, presetRules: {}, useForAppAccent: false, autoApply: true,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  },
  assets: [],
}

describe('Brand Kit normalization and cache', () => {
  beforeEach(() => localStorage.clear())

  it('normalizes malformed persisted JSON instead of trusting it', () => {
    const kit = normalizeBrandKitRow({
      id: 'kit-1', user_id: 'user-a', name: '',
      palette: { primary: 'bad', background: '#fff' },
      extracted_palette: ['invalid'], extraction_metadata: null,
      default_strength: 9, engine_rules: { laserDmx: { mode: 'nonsense', strength: -3 } },
      preset_rules: 'bad', use_for_app_accent: true, auto_apply: true,
      created_at: '', updated_at: '',
    })
    expect(kit.name).toBe('Brand Kit')
    expect(kit.palette.background).toBe('#FFFFFF')
    expect(kit.defaultStrength).toBe(1)
    expect(kit.engineRules.laserDmx).toEqual({ mode: 'hybrid', strength: 0 })
    expect(kit.extractedPalette).toBeNull()
  })

  it('drops unknown engine rules and clamps valid rules', () => {
    expect(normalizeBrandKitEngineRules({
      laserDmx: { mode: 'brand', strength: 0.4, preserveTriggerSemantics: false, semanticRoleMapping: { bass: 'accent', invalid: 'primary' } },
      reactiveConstellation: { mode: 'custom', strength: 2, customPalette: { primary: '#abc' } },
      unknownEngine: { mode: 'brand', strength: 1 },
    })).toEqual({
      laserDmx: { mode: 'brand', strength: 0.4, preserveTriggerSemantics: false, semanticRoleMapping: { bass: 'accent' } },
      reactiveConstellation: {
        mode: 'custom', strength: 1,
        customPalette: expect.objectContaining({ primary: '#AABBCC' }),
      },
    })
  })

  it('rejects malformed cache versions', () => {
    localStorage.setItem(brandKitCacheKey('user-a'), JSON.stringify({ version: BRAND_KIT_CACHE_VERSION + 1, userId: 'user-a', active: activeFixture }))
    expect(readBrandKitCache('user-a')).toBeNull()
    expect(localStorage.getItem(brandKitCacheKey('user-a'))).toBeNull()
  })

  it('rewrites cached Brand Kit data after removing only the retired Neon rule', () => {
    const stale = structuredClone(activeFixture)
    stale.kit.engineRules = {
      neonLattice: { mode: 'brand', strength: 0.8 },
      oscilloscope: { mode: 'hybrid', strength: 0.6 },
    } as unknown as typeof stale.kit.engineRules
    localStorage.setItem(brandKitCacheKey('user-a'), JSON.stringify({
      version: BRAND_KIT_CACHE_VERSION,
      userId: 'user-a',
      active: stale,
    }))

    expect(readBrandKitCache('user-a')?.kit.engineRules).toEqual({
      oscilloscope: { mode: 'hybrid', strength: 0.6 },
    })
    expect(localStorage.getItem(brandKitCacheKey('user-a'))).not.toContain('neonLattice')
  })

  it('isolates active-kit cache by user', () => {
    writeBrandKitCache('user-a', activeFixture)
    expect(readBrandKitCache('user-a')?.kit.id).toBe('kit-1')
    expect(readBrandKitCache('user-b')).toBeNull()
  })


  it('rejects a cached active kit owned by a different user', () => {
    localStorage.setItem(brandKitCacheKey('user-b'), JSON.stringify({
      version: BRAND_KIT_CACHE_VERSION,
      userId: 'user-b',
      active: activeFixture,
    }))
    expect(readBrandKitCache('user-b')).toBeNull()
  })

  it('projects cache data so transient URLs and browser objects are never persisted', () => {
    const unsafeFixture = {
      ...activeFixture,
      assets: [{
        id: 'asset-1', brandKitId: 'kit-1', mediaItemId: 'media-1', role: 'primaryLogo',
        sortOrder: 0, isPaletteSource: true,
        presentation: { previewUrl: 'blob:preview', alignment: 'center' },
        createdAt: '', updatedAt: '',
        media: {
          id: 'media-1', userId: 'user-a', name: 'logo.svg', storagePath: 'user-a/logo.svg',
          thumbnailPath: null, mimeType: 'image/svg+xml', mediaRole: 'svg',
          metadata: { dominantColors: ['#112233'], signedUrl: 'https://secret.example' },
          objectUrl: 'blob:media',
        },
      }],
    } as unknown as ActiveBrandKitData
    writeBrandKitCache('user-a', unsafeFixture)
    const serialized = localStorage.getItem(brandKitCacheKey('user-a')) ?? ''
    expect(serialized).not.toContain('blob:')
    expect(serialized).not.toContain('secret.example')
    const cached = readBrandKitCache('user-a')
    expect(cached?.assets[0]?.presentation).toEqual({
      enabled: false, placement: 'bottom-right', scale: 0.18, opacity: 0.82, margin: 0.04,
      blendMode: 'source-over', glowMode: 'none', visibility: 'always', preserveOriginalColors: true,
    })
    expect(cached?.assets[0]?.media?.metadata).toEqual({ dominantColors: ['#112233'] })
  })

  it('merges palette metadata without destroying existing SVG validation', () => {
    const svgValidation = {
      isValidSvg: true, hasVectorGeometry: true, hasEmbeddedRaster: false,
      hasExternalRaster: false, reactivePathCompatible: true,
    }
    const merged = mergeMediaMetadata(
      { svgValidation, loopable: true, dominantColors: ['#111111'] },
      { dominantColors: ['#FF0000'], analyzedAt: 123 },
    )
    expect(merged.svgValidation).toEqual(svgValidation)
    expect(merged.loopable).toBe(true)
    expect(merged.dominantColors).toEqual(['#FF0000'])
  })

  it('clears a previous non-fatal diagnostic when analysis succeeds', () => {
    const merged = mergeMediaMetadata(
      { paletteAnalysisError: { algorithmVersion: 'old', attemptedAt: '', message: 'failed' } },
      {
        paletteAnalysis: {
          swatches: [],
          candidates: {
            faithful: activeFixture.kit.palette,
            stageVibrant: activeFixture.kit.palette,
            highContrast: activeFixture.kit.palette,
          },
          metadata: {
            algorithmVersion: 'v1', analyzedAt: '', sourceWidth: 1, sourceHeight: 1,
            sampledPixels: 1, ignoredTransparentPixels: 0, isMonochrome: true, warnings: [],
          },
        },
      },
    )
    expect(merged.paletteAnalysisError).toBeUndefined()
    expect(merged.paletteAnalysis?.metadata.algorithmVersion).toBe('v1')
  })
})

/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrandKit } from '../../../../../features/personalization/BrandKitTypes'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import {
  CanvasFracturesImagePaletteCache,
  normalizeCanvasFracturesRoleWeights,
  packCanvasFracturesEffectParams,
  resolveCanvasFracturesEffectAssignment,
  resolveCanvasFracturesFallbackEffect,
  resolveCanvasFracturesPalette,
  SAFE_CANVAS_FRACTURES_ROLE_WEIGHTS,
} from './CanvasFracturesEffects'
import type { CanvasFracturesEffectSettings } from './CanvasFracturesTypes'

const weights = {
  clean: 0.3,
  glow: 0.15,
  outline: 0.15,
  glitch: 0.1,
  luma: 0.1,
  displacement: 0.1,
  texture: 0.1,
} as const

const effectSettings: CanvasFracturesEffectSettings = {
  intensity: 0.8,
  outlineIntensity: 0.7,
  outlineThickness: 0.6,
  bloomIntensity: 0.5,
  rgbSplit: 0.4,
  lumaMode: 'band',
  lumaThreshold: 0.55,
  displacement: 0.3,
  pixelation: 0.2,
  scanlines: 0.15,
  noise: 0.1,
  quality: 'high',
  colorSourceMode: 'manualOverride',
  manualPrimaryColor: '#112233',
  manualSupportingColor: '#AABBCC',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Canvas Fractures core effects', () => {
  it('assigns stable per-fragment roles and directions from identical identities', () => {
    const input = {
      presetId: 'canvas-fractures',
      sourceIdentity: 'media:stable',
      topologyIdentity: 'topology:12',
      fragmentId: 'fragment:5',
      variationSeed: 44,
      roleWeights: weights,
    }
    expect(resolveCanvasFracturesEffectAssignment(input)).toEqual(resolveCanvasFracturesEffectAssignment(input))
    expect(resolveCanvasFracturesEffectAssignment({ ...input, fragmentId: 'fragment:6' })).not.toEqual(
      resolveCanvasFracturesEffectAssignment(input),
    )
  })

  it('normalizes positive weights and falls back safely when every weight is zero', () => {
    const normalized = normalizeCanvasFracturesRoleWeights(weights)
    expect(Object.values(normalized).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8)
    expect(normalizeCanvasFracturesRoleWeights({
      clean: 0,
      glow: 0,
      outline: 0,
      glitch: 0,
      luma: 0,
      displacement: 0,
      texture: 0,
    })).toEqual(SAFE_CANVAS_FRACTURES_ROLE_WEIGHTS)
  })

  it('resolves image, Brand Kit, manual, and empty Brand Kit colors without duplicating Brand Kit state', () => {
    const brandKit = {
      palette: {
        primary: '#010203',
        secondary: '#112233',
        accent: '#223344',
        background: '#000000',
        highlight: '#ABCDEF',
        text: '#FFFFFF',
      },
    } as BrandKit
    const snapshot = JSON.stringify(brandKit)
    expect(resolveCanvasFracturesPalette({
      mode: 'imageSampled',
      manualPrimary: '#000000',
      manualSupporting: '#000000',
      sampled: ['#AA0000', '#00BB00', '#0000CC'],
    })).toMatchObject({ primary: '#AA0000', supporting: '#00BB00', accent: '#0000CC', source: 'imageSampled' })
    expect(resolveCanvasFracturesPalette({
      mode: 'brandKit',
      manualPrimary: '#000000',
      manualSupporting: '#000000',
      brandKit,
    })).toMatchObject({ primary: '#010203', supporting: '#112233', accent: '#ABCDEF', source: 'brandKit' })
    expect(resolveCanvasFracturesPalette({
      mode: 'manualOverride',
      manualPrimary: '#123456',
      manualSupporting: '#654321',
    })).toMatchObject({ primary: '#123456', supporting: '#654321', source: 'manualOverride' })
    expect(resolveCanvasFracturesPalette({
      mode: 'brandKit',
      manualPrimary: '#000000',
      manualSupporting: '#000000',
      brandKit: null,
    }).source).toBe('fallback')
    expect(JSON.stringify(brandKit)).toBe(snapshot)
  })

  it('packs renderer parameters without losing role, luma, quality, direction, or colors', () => {
    const assignment = resolveCanvasFracturesEffectAssignment({
      presetId: 'canvas-fractures',
      sourceIdentity: 'source',
      topologyIdentity: 'topology',
      fragmentId: 'fragment',
      variationSeed: 1,
      roleWeights: { clean: 0, glow: 0, outline: 1, glitch: 0, luma: 0, displacement: 0, texture: 0 },
    })
    const packed = packCanvasFracturesEffectParams({
      assignment,
      settings: effectSettings,
      palette: { primary: '#FF0000', supporting: '#00FF00', accent: '#0000FF', source: 'manualOverride' },
    })
    expect(packed).toMatchObject({ role: 1, lumaMode: 2, quality: 2, intensity: 0.8 })
    expect(packed.primary).toEqual([1, 0, 0])
    expect(Math.hypot(packed.directionX, packed.directionY)).toBeCloseTo(1, 6)
  })

  it('caches source sampling by identity, revision, and dimensions while ignoring transparent pixels', () => {
    const drawImage = vi.fn()
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray([
        0, 255, 0, 0,
        240, 16, 16, 255,
        ...new Array(32 * 32 * 4 - 8).fill(0),
      ]),
    }))
    vi.stubGlobal('OffscreenCanvas', class {
      width: number
      height: number
      constructor(width: number, height: number) { this.width = width; this.height = height }
      getContext() { return { clearRect: vi.fn(), drawImage, getImageData } }
    })
    const cache = new CanvasFracturesImagePaletteCache()
    const image = document.createElement('img')
    Object.defineProperties(image, {
      naturalWidth: { value: 100 },
      naturalHeight: { value: 50 },
    })
    const first = cache.sample(image, 'media-a', 1)
    const second = cache.sample(image, 'media-a', 1)
    const revised = cache.sample(image, 'media-a', 2)
    expect(first[0]).toBe('#F01010')
    expect(second).toEqual(first)
    expect(revised).toEqual(first)
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(cache.size).toBe(2)
  })

  it('returns a safe empty sample for tainted or unreadable sources', () => {
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(_width: number, _height: number) {}
      getContext() {
        return {
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          getImageData: vi.fn(() => { throw new DOMException('tainted') }),
        }
      }
    })
    const cache = new CanvasFracturesImagePaletteCache()
    const image = document.createElement('img')
    Object.defineProperties(image, {
      naturalWidth: { value: 100 },
      naturalHeight: { value: 50 },
    })
    expect(cache.sample(image, 'tainted', 1)).toEqual([])
  })

  it('changes treatment distribution without changing topology or layout identity', () => {
    const base = {
      presetId: 'canvas-fractures' as const,
      sourceIdentity: 'weight-source',
      mediaType: 'image' as const,
      mediaRevision: 1,
      variationSeed: 19,
      topologyRevision: 0,
      layoutRevision: 0,
      mode: 'mixed' as const,
      intensity: 0.5,
      focusProtection: 0.7,
      focusX: 0.5,
      focusY: 0.5,
      composition: 0.4,
      placementMode: 'balanced' as const,
      quality: 'low' as const,
      anchorMode: 'fullyFragmented' as const,
    }
    const clean = generateCanvasFracturesPlan({
      ...base,
      effectRoleWeights: { clean: 1, glow: 0, outline: 0, glitch: 0, luma: 0, displacement: 0, texture: 0 },
    })
    const outline = generateCanvasFracturesPlan({
      ...base,
      effectRoleWeights: { clean: 0, glow: 0, outline: 1, glitch: 0, luma: 0, displacement: 0, texture: 0 },
    })
    expect(clean.topologyIdentity).toBe(outline.topologyIdentity)
    expect(clean.layoutIdentity).toBe(outline.layoutIdentity)
    expect(clean.id).not.toBe(outline.id)
    expect(clean.fragments.every(fragment => fragment.effectRole === 'clean')).toBe(true)
    expect(outline.fragments.every(fragment => fragment.effectRole === 'outline')).toBe(true)
  })

  it('integrates role assignment into the real planner without changing topology across repeated inputs', () => {
    const input = {
      presetId: 'canvas-fractures' as const,
      sourceIdentity: 'integration-source',
      mediaType: 'svg' as const,
      mediaRevision: 3,
      variationSeed: 144,
      topologyRevision: 0,
      layoutRevision: 0,
      mode: 'mixed' as const,
      intensity: 0.4,
      focusProtection: 0.7,
      focusX: 0.5,
      focusY: 0.5,
      composition: 0.4,
      placementMode: 'balanced' as const,
      quality: 'low' as const,
      anchorMode: 'fullyFragmented' as const,
      effectRoleWeights: weights,
    }
    const first = generateCanvasFracturesPlan(input)
    const second = generateCanvasFracturesPlan(input)
    expect(second.topologyIdentity).toBe(first.topologyIdentity)
    expect(second.fragments.map(fragment => fragment.effectAssignment)).toEqual(
      first.fragments.map(fragment => fragment.effectAssignment),
    )
  })

  it('selects a safe clean fallback for unsupported fallback roles', () => {
    expect(resolveCanvasFracturesFallbackEffect('texture')).toBe('texture')
    expect(resolveCanvasFracturesFallbackEffect('not-real' as never)).toBe('clean')
  })
})

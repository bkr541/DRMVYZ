import { describe, expect, it } from 'vitest'
import type { CinematicWorldConfig } from '../../../components/vyzualz/react/CinematicWorldConfig'
import { DEFAULT_REACT_PRESETS, type ReactPalette, type ReactPreset } from '../../../components/vyzualz/react/ReactTypes'
import { fingerprintReactPresetThumbnail } from '../../../components/vyzualz/react/renderers/ReactPresetThumbnailRenderer'
import type { BrandKit } from '../BrandKitTypes'
import { resolveBrandedReactPreset } from '../resolveBrandedReactPreset'

const BRAND: ReactPalette = {
  primary: '#FF3366', secondary: '#20D6A7', accent: '#7C5CFF',
  background: '#05070A', highlight: '#FFE66D', text: '#F7FAFC',
}

function makeKit(id: string, palette: ReactPalette = BRAND): BrandKit {
  return {
    id, userId: 'user-a', name: id, palette,
    extractedPalette: null, extractionMetadata: null, defaultStrength: 1,
    engineRules: {
      oscilloscope: { mode: 'brand', strength: 1 },
      neonLattice: { mode: 'brand', strength: 1 },
      cinematicPortal: { mode: 'brand', strength: 1 },
    },
    presetRules: {}, useForAppAccent: false, autoApply: true,
    createdAt: '', updatedAt: '',
  }
}

function presetFor(engine: ReactPreset['engine']): ReactPreset {
  const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === engine)
  if (!preset) throw new Error(`Missing ${engine} fixture`)
  return preset
}

describe('ReactView Brand Kit boundary', () => {
  it('resolves the effective ReactView preset while preserving cinematic overrides', () => {
    const preset = presetFor('cinematicPortal')
    const originalConfig = preset.cinematicConfig
    if (!originalConfig) throw new Error('Cinematic fixture is missing configuration')
    const override: CinematicWorldConfig = {
      ...structuredClone(originalConfig),
      seed: originalConfig.seed + 17,
      cameraRig: 'orbit',
    }
    const result = resolveBrandedReactPreset(preset, { [preset.id]: override }, makeKit('kit-a'))

    expect(result?.palette).toEqual(BRAND)
    expect(result?.cinematicConfig?.seed).toBe(override.seed)
    expect(result?.cinematicConfig?.cameraRig).toBe('orbit')
    expect(preset.cinematicConfig).toEqual(originalConfig)
  })

  it('delivers the effective palette to Sound Drawing', () => {
    const result = resolveBrandedReactPreset(presetFor('oscilloscope'), {}, makeKit('kit-a'))
    expect(result?.engine).toBe('oscilloscope')
    expect(result?.palette).toEqual(BRAND)
  })

  it('delivers the effective palette to Neon Lattice', () => {
    const result = resolveBrandedReactPreset(presetFor('neonLattice'), {}, makeKit('kit-a'))
    expect(result?.engine).toBe('neonLattice')
    expect(result?.palette).toEqual(BRAND)
  })

  it('delivers the Cinematic Worlds palette to Reactive Constellation', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.cinematicConfig?.worldMode === 'reactiveConstellation')
    if (!preset) throw new Error('Missing Reactive Constellation fixture')
    const result = resolveBrandedReactPreset(preset, {}, makeKit('kit-a'))
    expect(result?.cinematicConfig?.worldMode).toBe('reactiveConstellation')
    expect(result?.palette).toEqual(BRAND)
  })

  it('keeps Sound Drawing SVG original-color mode unchanged', () => {
    const base = presetFor('oscilloscope')
    const preset: ReactPreset = {
      ...base,
      id: 'svg-original-color-test',
      oscillatorSettings: {
        ...base.oscillatorSettings,
        sourceType: 'svgGlyph',
        svgUseReactPalette: false,
      },
    }
    const result = resolveBrandedReactPreset(preset, {}, makeKit('kit-a'))
    expect(result?.palette).toEqual(BRAND)
    expect(result?.oscillatorSettings?.svgUseReactPalette).toBe(false)
  })

  it('keeps the thumbnail fingerprint stable when a kit switch resolves to the same effective palette', () => {
    const preset = presetFor('oscilloscope')
    const brandedA = resolveBrandedReactPreset(preset, {}, makeKit('kit-a')) as ReactPreset
    const brandedB = resolveBrandedReactPreset(preset, {}, makeKit('kit-b')) as ReactPreset
    expect(fingerprintReactPresetThumbnail(brandedA)).toBe(fingerprintReactPresetThumbnail(brandedB))
  })

  it('switches effective identity without mutating preset or Cinematic World state', () => {
    const preset = presetFor('cinematicPortal')
    const original = structuredClone(preset)
    const config = preset.cinematicConfig
    if (!config) throw new Error('Cinematic fixture is missing configuration')
    const override = { ...structuredClone(config), seed: config.seed + 9 }
    const overrides = { [preset.id]: override }
    const kitA = makeKit('kit-a')
    const kitB = makeKit('kit-b', { ...BRAND, primary: '#00E5FF' })

    const brandedA = resolveBrandedReactPreset(preset, overrides, kitA)
    const brandedB = resolveBrandedReactPreset(preset, overrides, kitB)

    expect(brandedA?.id).toBe(preset.id)
    expect(brandedB?.id).toBe(preset.id)
    expect(brandedA?.cinematicConfig).toEqual(override)
    expect(brandedB?.cinematicConfig).toEqual(override)
    expect(brandedA?.palette.primary).not.toBe(brandedB?.palette.primary)
    expect(preset).toEqual(original)
    expect(overrides[preset.id]).toEqual(override)
  })

  it('changes the thumbnail fingerprint when Brand Kits produce different effective palettes', () => {
    const preset = presetFor('oscilloscope')
    const kitA = makeKit('kit-a')
    const kitB = makeKit('kit-b', {
      primary: '#00E5FF', secondary: '#2979FF', accent: '#18FFFF',
      background: '#020617', highlight: '#B2EBF2', text: '#FFFFFF',
    })
    const brandedA = resolveBrandedReactPreset(preset, {}, kitA) as ReactPreset
    const brandedB = resolveBrandedReactPreset(preset, {}, kitB) as ReactPreset
    expect(fingerprintReactPresetThumbnail(brandedA)).not.toBe(fingerprintReactPresetThumbnail(brandedB))
  })
})

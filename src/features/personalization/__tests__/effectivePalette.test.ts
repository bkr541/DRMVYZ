import { describe, expect, it } from 'vitest'
import type { ReactPalette, ReactPreset } from '../../../components/vyzualz/react/ReactTypes'
import { DEFAULT_REACT_PRESETS } from '../../../components/vyzualz/react/ReactTypes'
import type { BrandKit } from '../BrandKitTypes'
import { resolveEffectivePalette, resolveEffectiveReactPreset } from '../effectivePalette'

const ORIGINAL: ReactPalette = {
  primary: '#2244AA',
  secondary: '#66AADD',
  accent: '#FF8844',
  background: '#050811',
  highlight: '#CDE7FF',
  text: '#F7FAFC',
}

const BRAND: ReactPalette = {
  primary: '#FF3366',
  secondary: '#20D6A7',
  accent: '#7C5CFF',
  background: '#05070A',
  highlight: '#FFE66D',
  text: '#F7FAFC',
}

function makeKit(patch: Partial<BrandKit> = {}): BrandKit {
  return {
    id: 'kit-a',
    userId: 'user-a',
    name: 'Main Kit',
    palette: { ...BRAND },
    extractedPalette: null,
    extractionMetadata: null,
    defaultStrength: 0.72,
    engineRules: {},
    presetRules: {},
    useForAppAccent: false,
    autoApply: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  }
}

function resolve(kit: BrandKit, patch: Partial<Parameters<typeof resolveEffectivePalette>[0]> = {}) {
  return resolveEffectivePalette({
    basePalette: ORIGINAL,
    brandKit: kit,
    engineId: 'oscilloscope',
    presetId: 'preset-a',
    ...patch,
  })
}

describe('effective Brand Kit palette resolution', () => {
  it('returns exact original palette values in original mode', () => {
    const result = resolve(makeKit({ engineRules: { oscilloscope: { mode: 'original', strength: 1 } } }))
    expect(result).toEqual(ORIGINAL)
  })

  it('returns exact original palette values when strength is zero', () => {
    const result = resolve(makeKit({ engineRules: { oscilloscope: { mode: 'brand', strength: 0 } } }))
    expect(result).toEqual(ORIGINAL)
  })

  it('maps semantic Brand Kit roles in brand mode', () => {
    const result = resolve(makeKit({ engineRules: { oscilloscope: { mode: 'brand', strength: 1 } } }))
    expect(result).toEqual(BRAND)
  })

  it('uses strength as a perceptual blend in brand mode', () => {
    const result = resolve(makeKit({ engineRules: { oscilloscope: { mode: 'brand', strength: 0.5 } } }))
    expect(result).not.toEqual(ORIGINAL)
    expect(result).not.toEqual(BRAND)
  })

  it('is deterministic in hybrid mode', () => {
    const kit = makeKit({ engineRules: { oscilloscope: { mode: 'hybrid', strength: 0.63 } } })
    expect(resolve(kit)).toEqual(resolve(kit))
  })

  it('preserves recognizable differences between distinct base palettes in hybrid mode', () => {
    const kit = makeKit({ engineRules: { oscilloscope: { mode: 'hybrid', strength: 0.8 } } })
    const warm = resolve(kit)
    const icy = resolve(kit, {
      basePalette: {
        primary: '#8DEBFF', secondary: '#4477FF', accent: '#F0FBFF',
        background: '#010714', highlight: '#B7F3FF', text: '#FFFFFF',
      },
      presetId: 'preset-icy',
    })
    expect(warm).not.toEqual(icy)
    expect(warm.primary).not.toBe(icy.primary)
    expect(warm.background).not.toBe(icy.background)
  })

  it('gives a per-preset custom palette precedence over the engine rule', () => {
    const presetPalette: ReactPalette = {
      primary: '#11AA55', secondary: '#22BB66', accent: '#33CC77',
      background: '#020805', highlight: '#99FFBB', text: '#FFFFFF',
    }
    const kit = makeKit({
      engineRules: { oscilloscope: { mode: 'brand', strength: 1 } },
      presetRules: { 'preset-a': { mode: 'custom', strength: 1, palette: presetPalette } },
    })
    expect(resolve(kit)).toEqual(presetPalette)
  })

  it('uses the per-engine custom palette when no preset override exists', () => {
    const enginePalette: ReactPalette = {
      primary: '#E040FB', secondary: '#7C4DFF', accent: '#FF80AB',
      background: '#09000D', highlight: '#F8BBD0', text: '#FFFFFF',
    }
    const kit = makeKit({
      engineRules: { oscilloscope: { mode: 'custom', strength: 1, customPalette: enginePalette } },
    })
    expect(resolve(kit)).toEqual(enginePalette)
  })

  it('applies Brand Kit palette resolution to LaserDMX in brand mode', () => {
    const kit = makeKit({ engineRules: { laserDmx: { mode: 'brand', strength: 1 } } })
    const result = resolve(kit, { engineId: 'laserDmx' })
    expect(result).toEqual(BRAND)
  })


  it('applies native Brand Kit palette resolution to the Shader ENGINE', () => {
    const kit = makeKit({ engineRules: { shaderPads: { mode: 'brand', strength: 1 } } })
    const result = resolve(kit, { engineId: 'shaderPads' })
    expect(result).toEqual(BRAND)
  })

  it('falls back safely for an invalid rule', () => {
    const kit = makeKit({
      engineRules: { oscilloscope: { mode: 'invalid', strength: Number.NaN } as never },
    })
    expect(resolve(kit)).toEqual(ORIGINAL)
  })

  it('does not mutate built-in preset definitions or input palettes', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.engine === 'oscilloscope') as ReactPreset
    const presetSnapshot = structuredClone(preset)
    const kit = makeKit({ engineRules: { oscilloscope: { mode: 'hybrid', strength: 0.75 } } })
    const kitSnapshot = structuredClone(kit)

    const result = resolveEffectiveReactPreset(preset, kit)

    expect(result).not.toBe(preset)
    expect(result.palette).not.toBe(preset.palette)
    expect(preset).toEqual(presetSnapshot)
    expect(kit).toEqual(kitSnapshot)
  })
})

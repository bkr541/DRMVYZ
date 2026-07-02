import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeNeonLatticeSettings } from '../../NeonLatticeConfig'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../../ReactTypes'
import {
  neonLatticeQualityLimits,
  resolveNeonLatticeLinePasses,
} from '../NeonLatticeRenderer'
import { paletteColorForRole } from '../neonLatticeUtils'

function settings(overrides: Partial<typeof DEFAULT_NEON_LATTICE_SETTINGS> = {}) {
  return normalizeNeonLatticeSettings({
    ...DEFAULT_NEON_LATTICE_SETTINGS,
    ...overrides,
  })
}

describe('Patch 4 visual finish normalization', () => {
  it('clamps widths, intensities, bloom, and quality values to finite production ranges', () => {
    const normalized = normalizeNeonLatticeSettings({
      ...DEFAULT_NEON_LATTICE_SETTINGS,
      coreWidth: Number.POSITIVE_INFINITY,
      bodyWidth: -4,
      haloWidth: 100,
      coreIntensity: -1,
      bodyIntensity: 99,
      haloIntensity: Number.NaN,
      haloFalloff: 2,
      bloomSpread: 0,
      bloomGain: 12,
      lineFlicker: -3,
      chordBloomBoost: 8,
      phraseFlashStrength: 3,
      qualityTier: 'impossible',
    })

    expect(normalized.coreWidth).toBe(DEFAULT_NEON_LATTICE_SETTINGS.coreWidth)
    expect(normalized.bodyWidth).toBe(0.1)
    expect(normalized.haloWidth).toBe(32)
    expect(normalized.coreIntensity).toBe(0)
    expect(normalized.bodyIntensity).toBe(2)
    expect(normalized.haloIntensity).toBe(DEFAULT_NEON_LATTICE_SETTINGS.haloIntensity)
    expect(normalized.haloFalloff).toBe(1)
    expect(normalized.bloomSpread).toBe(0.25)
    expect(normalized.bloomGain).toBe(2)
    expect(normalized.lineFlicker).toBe(0)
    expect(normalized.chordBloomBoost).toBe(1)
    expect(normalized.phraseFlashStrength).toBe(1)
    expect(normalized.qualityTier).toBe('high')
  })

  it('restores persisted Patch 4 fields without introducing a parallel settings shape', () => {
    const restored = normalizeNeonLatticeSettings({
      compositionMode: 'hybrid',
      laneAssignmentMode: 'outsideIn',
      chordSize: 7,
      coreWidth: 0.8,
      bodyWidth: 2.1,
      haloWidth: 9,
      bloomGain: 0.75,
      qualityTier: 'medium',
      cyanStrikePaletteRole: 'accent',
    })

    expect(restored).toMatchObject({
      compositionMode: 'hybrid',
      laneAssignmentMode: 'outsideIn',
      chordSize: 7,
      coreWidth: 0.8,
      bodyWidth: 2.1,
      haloWidth: 9,
      bloomGain: 0.75,
      qualityTier: 'medium',
      cyanStrikePaletteRole: 'accent',
    })
    expect(Object.keys(restored).sort()).toEqual(Object.keys(DEFAULT_NEON_LATTICE_SETTINGS).sort())
  })
})

describe('Patch 4 multipass line rendering', () => {
  it('scales halo passes and expensive budgets by quality tier', () => {
    expect(neonLatticeQualityLimits('low')).toEqual({
      maxSegments: 20,
      maxFlares: 8,
      maxPulses: 14,
      maxChordSize: 4,
      haloPasses: 1,
      bloomScale: 0.25,
    })
    expect(neonLatticeQualityLimits('medium')).toMatchObject({ maxChordSize: 8, haloPasses: 2 })
    expect(neonLatticeQualityLimits('high')).toMatchObject({ maxChordSize: 16, haloPasses: 3 })

    const lowPasses = resolveNeonLatticeLinePasses(settings({ qualityTier: 'low' }), 2, 1, 1, 1, false)
    const highPasses = resolveNeonLatticeLinePasses(settings({ qualityTier: 'high' }), 2, 1, 1, 1, false)
    expect(lowPasses).toHaveLength(3)
    expect(highPasses).toHaveLength(5)
  })

  it('keeps dense chord passes finite, ordered, and brightness-clamped', () => {
    const passes = resolveNeonLatticeLinePasses(settings({
      qualityTier: 'high',
      coreWidth: 8,
      bodyWidth: 16,
      haloWidth: 32,
      coreIntensity: 2,
      bodyIntensity: 2,
      haloIntensity: 1,
      haloFalloff: 1,
      chordBloomBoost: 1,
    }), 5, 3, 4, 3, true)

    expect(passes.length).toBeGreaterThan(2)
    expect(passes.every(pass => Number.isFinite(pass.width) && pass.width > 0)).toBe(true)
    expect(passes.every(pass => Number.isFinite(pass.alpha) && pass.alpha > 0 && pass.alpha <= 1)).toBe(true)
    expect(passes[passes.length - 1]).toMatchObject({ color: 'white', composite: 'source-over', alpha: 1 })
    expect(passes[passes.length - 2]?.alpha).toBeLessThanOrEqual(0.88)
    expect(passes.slice(0, -2).every(pass => pass.alpha <= 0.55)).toBe(true)
  })

  it('can preserve a palette-hot center instead of a white-hot center', () => {
    const passes = resolveNeonLatticeLinePasses(settings({ highlightCenterHot: false }), 1, 1, 0.8, 1, false)
    expect(passes[passes.length - 1]?.color).toBe('palette')
  })
})

describe('Patch 4 semantic palette and capture path', () => {
  it('resolves every semantic role, including background, from the supplied palette', () => {
    const palette = {
      primary: '1,2,3',
      secondary: '4,5,6',
      accent: '7,8,9',
      highlight: '10,11,12',
      background: '13,14,15',
    }
    expect(paletteColorForRole(palette, 'primary')).toBe('1,2,3')
    expect(paletteColorForRole(palette, 'secondary')).toBe('4,5,6')
    expect(paletteColorForRole(palette, 'accent')).toBe('7,8,9')
    expect(paletteColorForRole(palette, 'highlight')).toBe('10,11,12')
    expect(paletteColorForRole(palette, 'background')).toBe('13,14,15')
    expect(paletteColorForRole({ ...palette, background: undefined }, 'background')).toBe('1,2,3')
  })

  it('keeps the legacy strike ID but removes the fixed cyan RGB dependency', () => {
    const source = readFileSync(new URL('../NeonLatticeRenderer.ts', import.meta.url), 'utf8')
    expect(source).toContain("case 'cyanStrike'")
    expect(source).toContain('paletteRgb[settings.cyanStrikePaletteRole]')
    expect(source).not.toContain('74,199,219')
    expect(source).not.toContain('0,255,255')
  })

  it('draws essential finish passes and bloom into canvas contexts rather than DOM overlays', () => {
    const source = readFileSync(new URL('../NeonLatticeRenderer.ts', import.meta.url), 'utf8')
    expect(source).toContain('ctx.stroke()')
    expect(source).toContain('ctx.drawImage(bloomCanvas')
    expect(source).toContain("ctx.globalCompositeOperation = pass.composite")
    expect(source).not.toContain('document.createElement(\'div\')')
  })
})

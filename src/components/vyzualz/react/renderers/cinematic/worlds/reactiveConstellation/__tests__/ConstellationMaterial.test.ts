import { describe, expect, it } from 'vitest'
import {
  constellationDitherKeepsFragment,
  constellationDitherThreshold,
  parseConstellationColor,
  resolveConstellationPalette,
} from '../ConstellationMaterial'
import {
  REACTIVE_CONSTELLATION_FRAGMENT_SOURCE,
} from '../ConstellationShaders'

function finiteColor(color: { r: number; g: number; b: number }): boolean {
  return [color.r, color.g, color.b].every(value => Number.isFinite(value) && value >= 0 && value <= 1)
}

describe('Reactive Constellation crystalline material utilities', () => {
  it('parses supported colors safely and falls back for malformed palette values', () => {
    expect(parseConstellationColor('#0af', { r: 1, g: 1, b: 1 })).toEqual({ r: 0, g: 170 / 255, b: 1 })
    expect(parseConstellationColor('not-a-color', { r: 2, g: -1, b: Number.NaN }))
      .toEqual({ r: 1, g: 0, b: 0 })

    const resolved = resolveConstellationPalette({
      primary: 'broken',
      secondary: '#61d6aa',
      accent: '#ffffff',
      background: '#020906',
    })
    for (const color of Object.values(resolved)) expect(finiteColor(color)).toBe(true)
    expect(Math.max(resolved.background.r, resolved.background.g, resolved.background.b)).toBeLessThanOrEqual(0.055)
  })

  it('derives beam identity from each active palette instead of forcing red', () => {
    const crimson = resolveConstellationPalette({
      primary: '#ff315f', secondary: '#b84fc9', accent: '#ffd6e4', background: '#090108',
    })
    const cyan = resolveConstellationPalette({
      primary: '#32d6ff', secondary: '#2764ff', accent: '#e9ffff', background: '#01050d',
    })
    const emerald = resolveConstellationPalette({
      primary: '#42e6a4', secondary: '#12766f', accent: '#eaffca', background: '#020906',
    })

    expect(crimson.beamCore.r).toBeGreaterThan(crimson.beamCore.g)
    expect(cyan.beamCore.b).toBeGreaterThan(cyan.beamCore.r)
    expect(emerald.beamCore.g).toBeGreaterThan(emerald.beamCore.r)
    expect(cyan.beamCore).not.toEqual(crimson.beamCore)
    expect(emerald.beamAccent).not.toEqual(crimson.beamAccent)
  })

  it('preserves Brand Kit palette authority instead of applying the authored crimson colors downstream', () => {
    const brandKit = {
      primary: '#0bd3ff',
      secondary: '#3d5afe',
      accent: '#d8fff8',
      background: '#010914',
    }
    const snapshot = JSON.stringify(brandKit)
    const resolved = resolveConstellationPalette(brandKit)

    expect(resolved.primary.b).toBeGreaterThan(resolved.primary.r)
    expect(resolved.beamCore.b).toBeGreaterThan(resolved.beamCore.r)
    expect(resolved.beamAccent).not.toEqual({ r: 1, g: 0, b: 0 })
    expect(JSON.stringify(brandKit)).toBe(snapshot)
  })

  it('uses deterministic ordered coverage whose density rises monotonically with opacity', () => {
    const thresholds = Array.from({ length: 16 }, (_, index) => constellationDitherThreshold(index % 4, Math.floor(index / 4)))
    expect(new Set(thresholds).size).toBe(16)
    expect(Math.min(...thresholds)).toBeGreaterThan(0)
    expect(Math.max(...thresholds)).toBeLessThan(1)

    const kept = (alpha: number) => Array.from({ length: 16 }, (_, index) =>
      constellationDitherKeepsFragment(alpha, index % 4, Math.floor(index / 4)))
      .filter(Boolean).length
    expect(kept(0.2)).toBeLessThan(kept(0.5))
    expect(kept(0.5)).toBeLessThan(kept(0.9))
    expect(kept(0)).toBe(0)
    expect(kept(1)).toBe(16)
  })

  it('keeps the controlled face and emissive passes explicit in the shader contract', () => {
    expect(REACTIVE_CONSTELLATION_FRAGMENT_SOURCE).toContain('orderedDither4x4')
    expect(REACTIVE_CONSTELLATION_FRAGMENT_SOURCE).toContain('if (uPassMode < 0.5)')
    expect(REACTIVE_CONSTELLATION_FRAGMENT_SOURCE).toContain('uFacetContrast')
    expect(REACTIVE_CONSTELLATION_FRAGMENT_SOURCE).toContain('uInternalGlow')
    expect(REACTIVE_CONSTELLATION_FRAGMENT_SOURCE).toContain('uWireframeAmount')
  })
})

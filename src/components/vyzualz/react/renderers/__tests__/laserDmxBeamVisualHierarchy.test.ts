import { describe, expect, it } from 'vitest'
import { LASER_DMX_BEAM_VISUAL_PROFILES } from '../LaserDmxBeamMatrixRenderer'

describe('LaserDMX semantic beam visual hierarchy', () => {
  it('keeps hero, primary, secondary, and texture rays visually ordered', () => {
    const { hero, primary, secondary, texture } = LASER_DMX_BEAM_VISUAL_PROFILES

    expect(hero.bodyAlpha).toBeGreaterThan(primary.bodyAlpha)
    expect(primary.bodyAlpha).toBeGreaterThan(secondary.bodyAlpha)
    expect(secondary.bodyAlpha).toBeGreaterThan(texture.bodyAlpha)
    expect(hero.coreAlpha).toBeGreaterThan(primary.coreAlpha)
    expect(primary.coreAlpha).toBeGreaterThan(secondary.coreAlpha)
    expect(secondary.coreAlpha).toBeGreaterThan(texture.coreAlpha)
    expect(hero.glowWidth).toBeGreaterThan(primary.glowWidth)
    expect(primary.glowWidth).toBeGreaterThan(secondary.glowWidth)
    expect(secondary.glowWidth).toBeGreaterThan(texture.glowWidth)
    expect(hero.bodyAlpha / texture.bodyAlpha).toBeGreaterThanOrEqual(2)
  })

  it('uses saturated ordinary cores and a bounded white-hot impact profile', () => {
    const { hero, primary, secondary, texture, impact } = LASER_DMX_BEAM_VISUAL_PROFILES

    expect(primary.coreWhiteMix).toBeLessThan(0.25)
    expect(secondary.coreWhiteMix).toBeLessThan(primary.coreWhiteMix)
    expect(texture.coreWhiteMix).toBe(0)
    expect(impact.coreWhiteMix).toBeGreaterThan(hero.coreWhiteMix)
    expect(impact.bodyAlpha).toBeGreaterThanOrEqual(hero.bodyAlpha)
    expect(Math.max(...Object.values(LASER_DMX_BEAM_VISUAL_PROFILES).map(profile => profile.sourceRadius))).toBeLessThan(4)
    expect(impact.sourceRadius).toBeGreaterThan(hero.sourceRadius)
  })
})

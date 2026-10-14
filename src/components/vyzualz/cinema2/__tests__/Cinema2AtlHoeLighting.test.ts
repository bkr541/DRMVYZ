import { describe, expect, it } from 'vitest'

import { resolveCinema2AtlHoeCityLighting } from '../modules/atlHoe/Cinema2AtlHoeLighting'
import { CINEMA2_ATL_HOE_PATTERN_IDS, type Cinema2AtlHoePatternSignals } from '../modules/atlHoe/Cinema2AtlHoePatternEngine'

const silent: Cinema2AtlHoePatternSignals = Object.freeze({
  energy: 0, sub: 0, bass: 0, mid: 0, high: 0, flux: 0,
  kick: 0, snare: 0, transient: 0, downbeat: 0, phrase: 0, build: 0, drop: 0,
})
const withSignal = (signal: keyof Cinema2AtlHoePatternSignals): Cinema2AtlHoePatternSignals => ({ ...silent, [signal]: 1 })

describe('ATL HOE city performance lighting', () => {
  it('gives all four hero buildings independent horizontal and vertical choreography at Stage-readable widths', () => {
    const city = resolveCinema2AtlHoeCityLighting('skyline-rise', 13.25, 'active', withSignal('mid'))
    expect(new Set(city.heroVerticalFronts).size).toBe(4)
    expect(new Set(city.heroHorizontalFronts).size).toBe(4)
    expect(Math.min(...city.heroVerticalWidths)).toBeGreaterThanOrEqual(0.1)
    expect(Math.min(...city.heroHorizontalWidths)).toBeGreaterThanOrEqual(0.1)
    expect(city.heroGains.every(gain => gain >= 0.3)).toBe(true)
  })

  it('maps frequency and event responsibilities to separate city component families', () => {
    const base = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', silent)
    const bass = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', withSignal('bass'))
    const mid = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', withSignal('mid'))
    const high = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', withSignal('high'))
    const kick = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', withSignal('kick'))
    const transient = resolveCinema2AtlHoeCityLighting('city-pulse', 8, 'active', withSignal('transient'))
    expect(bass.roadGain).toBeGreaterThan(base.roadGain)
    expect(bass.lowFacadeGain).toBeGreaterThan(base.lowFacadeGain)
    expect(mid.heroGains.every((gain, index) => gain > base.heroGains[index])).toBe(true)
    expect(high.crownGain).toBeGreaterThan(base.crownGain)
    expect(high.windowSparkle).toBeGreaterThan(base.windowSparkle)
    expect(kick.streetlightGain).toBeGreaterThan(base.streetlightGain)
    expect(transient.foliageGain).toBeGreaterThan(base.foliageGain)
    expect(transient.foliageThreshold).toBeLessThan(base.foliageThreshold)
  })

  it('keeps the city readable without the sign in every program and makes road lighting meaningful in at least three', () => {
    let roadPrograms = 0
    for (const pattern of CINEMA2_ATL_HOE_PATTERN_IDS) {
      const city = resolveCinema2AtlHoeCityLighting(pattern, 10.5, 'active', {
        ...silent, energy: 0.65, sub: 0.72, bass: 0.78, mid: 0.6, high: 0.55, flux: 0.48,
        kick: 0.75, snare: 0.55, transient: 0.62, downbeat: 0.7, phrase: 0.6,
      })
      expect(Math.max(...city.heroGains), pattern).toBeGreaterThanOrEqual(0.55)
      expect(Math.max(city.streetlightGain, city.roadGain, city.crownGain, city.foliageGain), pattern).toBeGreaterThanOrEqual(0.55)
      if (city.roadGain >= 0.65) roadPrograms += 1
    }
    expect(roadPrograms).toBeGreaterThanOrEqual(3)
  })

  it('drives independent physical spill groups and preserves a staged drop afterglow', () => {
    const rest = resolveCinema2AtlHoeCityLighting('city-pulse', 16, 'rest', silent).environment
    const bass = resolveCinema2AtlHoeCityLighting('city-pulse', 16, 'active', withSignal('bass')).environment
    const transient = resolveCinema2AtlHoeCityLighting('city-pulse', 16, 'active', withSignal('transient')).environment
    const impact = resolveCinema2AtlHoeCityLighting('storm-takeover', 16, 'drop', withSignal('drop')).environment
    const afterglow = resolveCinema2AtlHoeCityLighting('storm-takeover', 17, 'recovery', { ...silent, drop: 0.55 }).environment
    expect(bass.signSpill).toBeGreaterThan(rest.signSpill)
    expect(Math.max(...bass.roadPools)).toBeGreaterThan(Math.max(...rest.roadPools))
    expect(transient.foliageRim).toBeGreaterThan(rest.foliageRim)
    expect(impact.crownFlash).toBe(1)
    expect(impact.dropAfterglow).toBe(1)
    expect(afterglow.dropAfterglow).toBeGreaterThan(0.7)
    expect(afterglow.dropAfterglow).toBeLessThan(impact.dropAfterglow)
  })
})

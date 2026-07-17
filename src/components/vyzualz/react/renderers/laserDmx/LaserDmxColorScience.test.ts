import { describe, expect, it } from 'vitest'
import {
  LASER_DMX_FIXTURE_CALIBRATIONS,
  applyLaserDmxBoundedHighlightWhitening,
  calibrateLaserDmxChannels,
  mixLaserDmxLinearColors,
  parseLaserDmxSrgbHex,
  resolveLaserDmxHighlightWhitening,
  srgbChannelToLinear,
} from './LaserDmxColorScience'

describe('LaserDMX calibrated linear-light color science', () => {
  it('converts sRGB channels into linear optical energy', () => {
    expect(srgbChannelToLinear(0.5)).toBeCloseTo(0.214041, 5)
    expect(parseLaserDmxSrgbHex('#808080').r).toBeCloseTo(0.215861, 5)
  })

  it('mixes intersections in linear light', () => {
    const mixed = mixLaserDmxLinearColors([
      parseLaserDmxSrgbHex('#ff0000'),
      parseLaserDmxSrgbHex('#00ff00'),
    ])
    expect(mixed.r).toBeCloseTo(1)
    expect(mixed.g).toBeCloseTo(1)
    expect(mixed.b).toBe(0)
  })

  it('applies bounded fixture calibration including white-channel energy', () => {
    const calibrated = calibrateLaserDmxChannels(
      { red: 160, green: 90, blue: 30, white: 64 },
      LASER_DMX_FIXTURE_CALIBRATIONS.rgbwCamera,
    )
    expect(calibrated.r).toBeGreaterThan(calibrated.b)
    expect(calibrated.g).toBeGreaterThan(0)
    expect(Math.max(calibrated.r, calibrated.g, calibrated.b)).toBeLessThanOrEqual(1.45)
  })

  it('preserves saturated dim beams and whitens only exposed highlights', () => {
    expect(resolveLaserDmxHighlightWhitening(0.3, 0.9)).toBe(0)
    const mix = resolveLaserDmxHighlightWhitening(2.2, 1)
    const highlighted = applyLaserDmxBoundedHighlightWhitening({ r: 0, g: 1, b: 0.02, a: 1 }, mix)
    expect(mix).toBeGreaterThan(0)
    expect(highlighted.r).toBeGreaterThan(0)
    expect(highlighted.g).toBeGreaterThan(highlighted.r)
  })

  it('preserves the black floor', () => {
    expect(applyLaserDmxBoundedHighlightWhitening({ r: 0, g: 0, b: 0, a: 1 }, 0)).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })
})

import { describe, expect, it } from 'vitest'
import { deriveElectricStormColors } from './ElectricStormColor'
import { electricStormWorldDefinition } from './ElectricStormWorld'
import { ElectricStormStrikeGenerator, ELECTRIC_STORM_MAX_ACTIVE_STRIKES } from './ElectricStormStrikeGenerator'

function maxChannel(color: { r: number; g: number; b: number }): number {
  return Math.max(color.r, color.g, color.b)
}

describe('Electric Storm Stage 1 world', () => {
  it('derives bounded hue-aware body, glow, branch, and partially white-hot core colors', () => {
    for (const color of ['#4aa7ff', '#ff365f', '#39e68d', '#b45cff']) {
      const derived = deriveElectricStormColors(color)
      for (const value of Object.values(derived).flatMap(rgb => [rgb.r, rgb.g, rgb.b])) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      // >= rather than >: a body color that already saturates a channel to
      // 1.0 (e.g. the default #4aa7ff, blue = 1.0) can't legally go any
      // brighter on that channel within [0,1] RGB. The shader's own uCore
      // multiplier (1.55x) is what produces the actual over-bright/bloom
      // look at render time.
      expect(maxChannel(derived.core)).toBeGreaterThanOrEqual(maxChannel(derived.body))
      expect(derived.core).not.toEqual({ r: 1, g: 1, b: 1 })
      expect(derived.glow).not.toEqual(derived.body)
      expect(derived.branch).not.toEqual(derived.body)
    }
  })

  it('keeps strike descriptors bounded and stable between scheduling buckets', () => {
    const generator = new ElectricStormStrikeGenerator()
    const first = generator.update(4, 1, 12345)
    const sameBucket = generator.update(4.01, 1, 12345)
    expect(sameBucket).toEqual(first)
    expect(first.length).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    for (const strike of first) {
      expect(Math.hypot(strike.start.x - strike.end.x, strike.start.y - strike.end.y)).toBeGreaterThanOrEqual(0.72)
      expect(strike.durationSec).toBeGreaterThan(0)
      expect(strike.intensity).toBeGreaterThan(0)
    }
    const later = generator.update(5, 1, 12345)
    expect(later.length).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    generator.reset()
    expect(generator.update(4, 1, 12345)).toEqual(first)
  })

  it('uses the real fullscreen WebGL production definition with no 3D or audio modulation contract', () => {
    expect(electricStormWorldDefinition.id).toBe('electricStorm')
    expect(electricStormWorldDefinition.backend).toBe('webgl2')
    expect(electricStormWorldDefinition.capabilities.supportsFullscreenPasses).toBe(true)
    expect(electricStormWorldDefinition.capabilities.supportsGeometryPasses).toBe(false)
    expect(electricStormWorldDefinition.capabilities.cameraRigs).toEqual(['locked'])
    expect(electricStormWorldDefinition.capabilities.modulationTargets).toEqual([])
  })
})

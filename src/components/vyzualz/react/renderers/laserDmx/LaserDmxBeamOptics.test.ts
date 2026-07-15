import { describe, expect, it } from 'vitest'
import {
  createLaserDmxFanRayParameters,
  resolveLaserDmxBeamStructure,
  resolveLaserDmxWhiteHotMix,
  selectDeterministicLaserDmxRayIndices,
} from './LaserDmxBeamOptics'

describe('LaserDMX beam optics', () => {
  it('creates coherent symmetric fan spacing with optional deterministic curves', () => {
    const linear = createLaserDmxFanRayParameters(5, 40, 'linear')
    expect(linear.map(ray => ray.offsetDeg)).toEqual([-20, -10, 0, 10, 20])
    expect(linear.map(ray => ray.spacingT)).toEqual([-0.5, -0.25, 0, 0.25, 0.5])

    const centerWeighted = createLaserDmxFanRayParameters(5, 40, 'centerWeighted')
    expect(centerWeighted[0]?.offsetDeg).toBeCloseTo(-20, 8)
    expect(centerWeighted[2]?.offsetDeg).toBe(0)
    expect(centerWeighted[4]?.offsetDeg).toBeCloseTo(20, 8)
    expect(Math.abs(centerWeighted[1]?.offsetDeg ?? 0)).toBeLessThan(10)
  })

  it('preserves fan edges and center during deterministic budget thinning', () => {
    expect(selectDeterministicLaserDmxRayIndices(9, 5)).toEqual([0, 2, 4, 6, 8])
    expect(selectDeterministicLaserDmxRayIndices(9, 3)).toEqual([0, 4, 8])
    expect(selectDeterministicLaserDmxRayIndices(9, 1)).toEqual([4])
    expect(selectDeterministicLaserDmxRayIndices(9, 0)).toEqual([])
  })

  it('keeps dim beams colored and introduces white-hot energy only at high intensity', () => {
    const dim = resolveLaserDmxWhiteHotMix(0.35, 0.45)
    const medium = resolveLaserDmxWhiteHotMix(0.78, 0.8)
    const hot = resolveLaserDmxWhiteHotMix(1, 1)
    expect(dim).toBe(0)
    expect(medium).toBeGreaterThan(dim)
    expect(hot).toBeGreaterThan(medium)
    expect(hot).toBeCloseTo(1, 8)
  })

  it('classifies coherent fan, bank, mirror, cross, and layered structures', () => {
    expect(resolveLaserDmxBeamStructure({ targetMode: 'fan', spreadDeg: 24, rayCount: 5 })).toBe('narrowFan')
    expect(resolveLaserDmxBeamStructure({ targetMode: 'fan', spreadDeg: 60, rayCount: 7 })).toBe('wideFan')
    expect(resolveLaserDmxBeamStructure({ targetMode: 'fixed', spreadDeg: 0, rayCount: 4 })).toBe('parallelBank')
    expect(resolveLaserDmxBeamStructure({ targetMode: 'mirror', spreadDeg: 30, rayCount: 2 })).toBe('mirroredFan')
    expect(resolveLaserDmxBeamStructure({ targetMode: 'cross', spreadDeg: 30, rayCount: 2 })).toBe('crossBank')
    expect(resolveLaserDmxBeamStructure({ targetMode: 'fan', spreadDeg: 30, rayCount: 5, distinctDepthPlanes: 3 })).toBe('layeredFan')
  })
})

import { describe, expect, it } from 'vitest'
import {
  resolveLaserDmxDepthExtinction,
  resolveLaserDmxDepthQualityPolicy,
  resolveLaserDmxDepthSliceIndex,
  resolveLaserDmxDepthTraversal,
  resolveLaserDmxPartialPlumeAttenuation,
  splitLaserDmxDepthInterval,
} from './LaserDmxDepthCompositing'

describe('LaserDMX continuous depth compositing', () => {
  it('scales bounded slice count and precision by quality', () => {
    expect(resolveLaserDmxDepthQualityPolicy('low').sliceCount).toBe(3)
    expect(resolveLaserDmxDepthQualityPolicy('medium').sliceCount).toBe(5)
    expect(resolveLaserDmxDepthQualityPolicy('high').sliceCount).toBe(7)
    expect(resolveLaserDmxDepthQualityPolicy('ultra').sliceCount).toBe(9)
    expect(resolveLaserDmxDepthQualityPolicy('ultra', false)).toMatchObject({ mode: 'binary-fallback', sliceCount: 2 })
  })

  it('segments one beam across several depth ranges without gaps', () => {
    const segments = splitLaserDmxDepthInterval(-0.92, 0.88, resolveLaserDmxDepthQualityPolicy('high'))
    expect(segments.length).toBeGreaterThan(3)
    expect(segments[0]?.t0).toBe(0)
    expect(segments[segments.length - 1]?.t1).toBe(1)
    for (let index = 1; index < segments.length; index += 1) {
      expect(segments[index]?.t0).toBeCloseTo(segments[index - 1]!.t1, 8)
    }
    expect(new Set(segments.map(segment => segment.sliceIndex)).size).toBeGreaterThan(3)
  })

  it('maps near-to-far OpenGL clip depth monotonically', () => {
    const indices = [-1, -0.5, 0, 0.5, 1].map(depth => resolveLaserDmxDepthSliceIndex(depth, 5))
    expect(indices).toEqual([0, 1, 2, 3, 4])
  })

  it('composites translucent slices from far to near', () => {
    expect(resolveLaserDmxDepthTraversal(5)).toEqual([4, 3, 2, 1, 0])
  })

  it('veils rear light more than near light', () => {
    const rear = resolveLaserDmxDepthExtinction({ layerDensity: 0.4, localPlumeDensity: 0.2, segmentDepth: 0.8, layerDepth: -0.35, extinction: 1.4 })
    const front = resolveLaserDmxDepthExtinction({ layerDensity: 0.4, localPlumeDensity: 0.2, segmentDepth: -0.7, layerDepth: -0.35, extinction: 1.4 })
    expect(rear).toBeGreaterThan(front)
  })

  it('attenuates only beam portions near a CO2 plume in depth', () => {
    const through = resolveLaserDmxPartialPlumeAttenuation({ segmentDepth: 0.1, plumeDepth: 0.12, radialProximity: 0.9, plumeDensity: 1, precision: 1 })
    const elsewhere = resolveLaserDmxPartialPlumeAttenuation({ segmentDepth: -0.8, plumeDepth: 0.12, radialProximity: 0.9, plumeDensity: 1, precision: 1 })
    expect(through).toBeGreaterThan(0.4)
    expect(elsewhere).toBeLessThan(through * 0.2)
  })
})

import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorOpticalPrimitiveType,
} from '../../ReactTypes'
import { buildLaserDmxOpticalPrimitivePlan } from './LaserDmxOpticalPrimitives'

function plan(primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>) {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', `primitive-${primitiveType}`, 0)
  fixture.semanticKey = `primitive-${primitiveType}`
  fixture.optics = {
    ...fixture.optics,
    primitiveType,
    rayCount: 9,
    fanWidth: 72,
  }
  return buildLaserDmxOpticalPrimitivePlan({
    fixture,
    origin: { x: 0.5, y: 0.2, z: 0 },
    allocatedRayCount: 9,
    audioTimeSec: 12.5,
    beatIndex: 40,
    phraseIndex: 2,
    occurrenceSeed: 7,
  })
}

describe('LaserDMX professional optical primitives', () => {
  it('builds evenly ordered coherent fan geometry from one source', () => {
    const result = plan('fan')
    expect(result.coherent).toBe(true)
    expect(result.sourceCount).toBe(1)
    expect(result.rays).toHaveLength(9)
    expect(result.rays.map(ray => ray.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(result.rays.map(ray => ray.spacingT)).toEqual([...result.rays.map(ray => ray.spacingT)].sort((a, b) => a - b))
    expect(new Set(result.rays.map(ray => `${ray.target.x.toFixed(4)}:${ray.target.y.toFixed(4)}`)).size).toBe(9)
  })

  it('supports deterministic 16-ray High and 24-ray Ultra professional hero fans', () => {
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'professional-hero-fan', 0)
    fixture.optics = { ...fixture.optics, primitiveType: 'fan', rayCount: 24, fanWidth: 120 }
    const build = (allocatedRayCount: number) => buildLaserDmxOpticalPrimitivePlan({
      fixture,
      origin: { x: 0.5, y: 0.15, z: 0 },
      allocatedRayCount,
      audioTimeSec: 9,
      beatIndex: 32,
      phraseIndex: 2,
      occurrenceSeed: 11,
    })
    const high = build(16)
    const ultra = build(24)
    expect(high.rays).toHaveLength(16)
    expect(ultra.rays).toHaveLength(24)
    expect(build(24)).toEqual(ultra)
    expect(high.rays[0]?.spacingT).toBe(-0.5)
    expect(high.rays[high.rays.length - 1]?.spacingT).toBe(0.5)
    expect(ultra.rays[0]?.spacingT).toBe(-0.5)
    expect(ultra.rays[ultra.rays.length - 1]?.spacingT).toBe(0.5)
  })

  it('assigns multiple deterministic depth planes to layered professional structures', () => {
    for (const primitive of ['layeredFan', 'tunnel', 'mirroredCorridor', 'rotatingLattice'] as const) {
      const first = plan(primitive)
      const second = plan(primitive)
      expect(second).toEqual(first)
      expect(first.depthPlaneCount, primitive).toBeGreaterThan(1)
      expect(first.rays.every(ray => ray.target.x >= 0 && ray.target.x <= 1 && ray.target.y >= 0 && ray.target.y <= 1)).toBe(true)
    }
  })

  it('places canopy and rake structures on deliberate invisible air layers', () => {
    const canopy = plan('canopy')
    const rake = plan('audienceRake')
    expect(new Set(canopy.rays.map(ray => ray.target.depthLayer))).toEqual(new Set(['upperAir']))
    expect(new Set(rake.rays.map(ray => ray.target.depthLayer))).toEqual(new Set(['cameraFacingAir']))
  })

  it('enforces the allocated beam budget without changing deterministic edge selection order', () => {
    const fixture = createDefaultLaserDmxShowDirectorFixture('laser', 'budgeted-fan', 0)
    fixture.optics = { ...fixture.optics, primitiveType: 'layeredFan', rayCount: 12, fanWidth: 100 }
    const result = buildLaserDmxOpticalPrimitivePlan({
      fixture,
      origin: { x: 0.5, y: 0.15, z: 0 },
      allocatedRayCount: 5,
      audioTimeSec: 4,
      beatIndex: 16,
      phraseIndex: 1,
      occurrenceSeed: 2,
    })
    expect(result.rays).toHaveLength(5)
    expect(result.rays.every(ray => ray.count === 5)).toBe(true)
  })

  it('generates bounded deterministic geometry for every supported named primitive', () => {
    const primitives: readonly Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>[] = [
      'fan', 'layeredFan', 'parallelBank', 'crossBank', 'sheet', 'tunnel', 'canopy', 'audienceRake',
      'diamondPlane', 'mirroredCorridor', 'rotatingLattice', 'apertureBurst', 'scannerWave', 'washCone',
      'blinderBank', 'strobeField', 'co2Burst',
    ]
    for (const primitive of primitives) {
      const first = plan(primitive)
      const second = plan(primitive)
      expect(second, primitive).toEqual(first)
      expect(first.rays.length, primitive).toBeGreaterThan(0)
      expect(first.rays.length, primitive).toBeLessThanOrEqual(9)
      expect(first.rays.every(ray => (
        ray.target.x >= 0 && ray.target.x <= 1
        && ray.target.y >= 0 && ray.target.y <= 1
        && ray.target.z >= -1 && ray.target.z <= 1
      )), primitive).toBe(true)
    }
  })

  it('creates distinct geometry families instead of random endpoint networks', () => {
    const signatures = (['fan', 'parallelBank', 'crossBank', 'sheet', 'diamondPlane', 'scannerWave', 'apertureBurst'] as const)
      .map(primitive => JSON.stringify(plan(primitive).rays.map(ray => [
        Number(ray.target.x.toFixed(3)),
        Number(ray.target.y.toFixed(3)),
        Number(ray.target.z.toFixed(3)),
      ])))
    expect(new Set(signatures).size).toBe(signatures.length)
  })
})

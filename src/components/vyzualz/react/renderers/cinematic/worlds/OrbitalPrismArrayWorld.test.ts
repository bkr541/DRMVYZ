import { describe, expect, it } from 'vitest'
import {
  createOrbitalPrismComposition,
  ORBITAL_PRISM_MAX_PARTICLES,
  ORBITAL_PRISM_MAX_SHARDS,
  ORBITAL_PRISM_RING_COUNT,
  resolveOrbitalPrismQualityCounts,
} from './OrbitalPrismArrayWorld'

describe('Orbital Prism Array composition', () => {
  it('reconstructs the same bounded composition from the same seed', () => {
    const first = createOrbitalPrismComposition(49001)
    const second = createOrbitalPrismComposition(49001)

    expect(Array.from(first.crystalInstances)).toEqual(Array.from(second.crystalInstances))
    expect(Array.from(first.ringInstances)).toEqual(Array.from(second.ringInstances))
    expect(Array.from(first.particles)).toEqual(Array.from(second.particles))
    expect(first.shardCount).toBe(ORBITAL_PRISM_MAX_SHARDS)
    expect(first.particleCount).toBe(ORBITAL_PRISM_MAX_PARTICLES)
  })

  it('changes the seeded shard and particle layout without changing the authored three-ring composition', () => {
    const first = createOrbitalPrismComposition(49001)
    const second = createOrbitalPrismComposition(49002)

    expect(Array.from(first.crystalInstances)).not.toEqual(Array.from(second.crystalInstances))
    expect(Array.from(first.particles)).not.toEqual(Array.from(second.particles))
    expect(Array.from(first.ringInstances)).toEqual(Array.from(second.ringInstances))
    expect(first.ringInstances).toHaveLength(ORBITAL_PRISM_RING_COUNT * 13)
  })

  it('keeps quality-scaled geometry inside the authored live-VJ bounds', () => {
    expect(resolveOrbitalPrismQualityCounts('low')).toEqual({ shardCount: 12, particleCount: 56 })
    expect(resolveOrbitalPrismQualityCounts('high')).toEqual({ shardCount: 16, particleCount: 108 })
    expect(resolveOrbitalPrismQualityCounts('ultra')).toEqual({ shardCount: ORBITAL_PRISM_MAX_SHARDS, particleCount: ORBITAL_PRISM_MAX_PARTICLES })
  })
})

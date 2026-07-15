import { describe, expect, it } from 'vitest'
import { createDefaultLaserDmxShowDirectorFixture } from './ReactTypes'
import {
  createLaserDmxShowDirectorBeamBudgetReport,
  estimateLaserDmxShowDirectorFixtureBeamDemand,
  LASER_DMX_FAN_DENSITY_POLICIES,
} from './LaserDmxShowDirectorBeamBudget'

function professionalFan(id: string, rayCount = 24) {
  const fixture = createDefaultLaserDmxShowDirectorFixture('laser', id, 0)
  fixture.semanticKey = id
  fixture.label = id
  fixture.beam.targetMode = 'fan'
  fixture.beam.beamSpread = 120
  fixture.optics = { ...fixture.optics, primitiveType: 'fan', fanWidth: 120, rayCount }
  return fixture
}

describe('LaserDMX quality-aware Show Director beam budgeting', () => {
  it('scales qualified hero fan density from low through ultra without raising support to hero limits', () => {
    const hero = professionalFan('festival-hero')
    const support = professionalFan('support-bank')
    expect(estimateLaserDmxShowDirectorFixtureBeamDemand(hero, { quality: 'low', role: 'heroImpact' })).toBe(8)
    expect(estimateLaserDmxShowDirectorFixtureBeamDemand(hero, { quality: 'medium', role: 'heroImpact' })).toBe(12)
    expect(estimateLaserDmxShowDirectorFixtureBeamDemand(hero, { quality: 'high', role: 'heroImpact' })).toBe(16)
    expect(estimateLaserDmxShowDirectorFixtureBeamDemand(hero, { quality: 'ultra', role: 'heroImpact' })).toBe(24)
    expect(estimateLaserDmxShowDirectorFixtureBeamDemand(support, { quality: 'ultra', role: 'secondaryFan' }))
      .toBe(LASER_DMX_FAN_DENSITY_POLICIES.ultra.supportLimit)
  })

  it('keeps mirrored primary banks balanced and removes detail texture first under pressure', () => {
    const left = professionalFan('hero-left', 20)
    const right = professionalFan('hero-right', 20)
    const texture = professionalFan('texture-lattice', 20)
    const report = createLaserDmxShowDirectorBeamBudgetReport(
      [texture, right, left],
      {
        [left.id]: 'primaryArchitecture',
        [right.id]: 'primaryArchitecture',
        [texture.id]: 'detailLattice',
      },
      34,
      'ultra',
    )
    const byId = new Map(report.fixtures.map(item => [item.fixtureId, item]))
    expect(byId.get(left.id)?.allocatedDemand).toBe(17)
    expect(byId.get(right.id)?.allocatedDemand).toBe(17)
    expect(byId.get(texture.id)?.allocatedDemand).toBe(0)
    expect(report.boundedDemand).toBe(34)
    expect(report.overBudget).toBe(true)
  })

  it('is deterministic regardless of incoming fixture order', () => {
    const fixtures = [professionalFan('fan-c'), professionalFan('fan-a'), professionalFan('fan-b')]
    const roles = Object.fromEntries(fixtures.map(fixture => [fixture.id, 'primaryArchitecture' as const]))
    const first = createLaserDmxShowDirectorBeamBudgetReport(fixtures, roles, 31, 'high')
    const second = createLaserDmxShowDirectorBeamBudgetReport([...fixtures].reverse(), roles, 31, 'high')
    expect(second.fixtures).toEqual(first.fixtures)
  })
})

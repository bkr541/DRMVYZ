import { describe, expect, it } from 'vitest'
import { Cinema2RandomService } from '../runtime/Cinema2RandomService'
import {
  CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT,
  CINEMA2_AFTERHOURS_MAX_BEAMS,
  CINEMA2_AFTERHOURS_RIG,
  CINEMA2_AFTERHOURS_TOPOLOGY_CATALOG,
  CINEMA2_AFTERHOURS_TOPOLOGY_IDS,
  allocateCinema2AfterhoursFixtures,
  generateCinema2AfterhoursBeamFrame,
  getCinema2AfterhoursMirrorFixture,
  resolveCinema2AfterhoursBeamCount,
  type Cinema2AfterhoursTopologyId,
} from '../modules/afterhours'

function random(seed: string | number = 'afterhours-domain') {
  return new Cinema2RandomService({
    presetId: 'drmvyz.cinema2.afterhours-domain-test',
    revision: 1,
    stateKey: '{"stage":"foundation"}',
    mode: 'deterministic',
    seed,
  })
}

function frame(
  topologyId: Cinema2AfterhoursTopologyId,
  overrides: Partial<Parameters<typeof generateCinema2AfterhoursBeamFrame>[0]> = {},
) {
  return generateCinema2AfterhoursBeamFrame({
    topologyId,
    beamCount: 16,
    symmetry: true,
    sideLasers: true,
    topLasers: true,
    random: random(),
    variationKey: 'representative',
    ...overrides,
  })
}

function finite3(value: readonly number[]) {
  return value.length === 3 && value.every(component => Number.isFinite(component))
}

describe('Cinema 2.0 Afterhours 2.0 Stage 1 domain', () => {
  it('installs exactly 32 stable world-space fixtures across the required banks', () => {
    expect(CINEMA2_AFTERHOURS_RIG.fixtures).toHaveLength(CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT)
    expect(CINEMA2_AFTERHOURS_RIG.banks.bottom).toHaveLength(10)
    expect(CINEMA2_AFTERHOURS_RIG.banks.left).toHaveLength(6)
    expect(CINEMA2_AFTERHOURS_RIG.banks.right).toHaveLength(6)
    expect(CINEMA2_AFTERHOURS_RIG.banks.overhead).toHaveLength(10)
    expect(new Set(CINEMA2_AFTERHOURS_RIG.fixtures.map(candidate => candidate.id)).size).toBe(32)
    expect(CINEMA2_AFTERHOURS_RIG.pairs.bottom).toHaveLength(5)
    expect(CINEMA2_AFTERHOURS_RIG.pairs.side).toHaveLength(6)
    expect(CINEMA2_AFTERHOURS_RIG.pairs.overhead).toHaveLength(5)
    expect(CINEMA2_AFTERHOURS_RIG.fixtures.every(candidate => finite3(candidate.positionWorld))).toBe(true)
    expect(CINEMA2_AFTERHOURS_RIG.fixtures.every(candidate => finite3(candidate.mountDirectionWorld))).toBe(true)
  })

  it('keeps every mirror link reciprocal and every pair physically bilateral', () => {
    for (const candidate of CINEMA2_AFTERHOURS_RIG.fixtures) {
      const mirror = getCinema2AfterhoursMirrorFixture(candidate)
      expect(mirror.id).toBe(candidate.mirrorFixtureId)
      expect(mirror.mirrorFixtureId).toBe(candidate.id)
      expect(mirror.pairId).toBe(candidate.pairId)
      expect(mirror.positionWorld[0]).toBeCloseTo(-candidate.positionWorld[0], 10)
      expect(mirror.positionWorld[1]).toBeCloseTo(candidate.positionWorld[1], 10)
      expect(mirror.positionWorld[2]).toBeCloseTo(candidate.positionWorld[2], 10)
    }
  })

  it('preserves exactly the eight approved topology families with no additions', () => {
    expect(CINEMA2_AFTERHOURS_TOPOLOGY_CATALOG.map(candidate => candidate.id)).toEqual(CINEMA2_AFTERHOURS_TOPOLOGY_IDS)
    expect(CINEMA2_AFTERHOURS_TOPOLOGY_IDS).toEqual([
      'wideFan', 'splitWings', 'crossCanopy', 'diamondStar',
      'chevronRoof', 'radialCrown', 'sparseArchitecture', 'fullRig',
    ])
  })

  it('normalizes invalid Beam Count values and never allocates beyond the hard ceiling', () => {
    expect(resolveCinema2AfterhoursBeamCount(Number.NaN)).toBe(2)
    expect(resolveCinema2AfterhoursBeamCount(-999)).toBe(2)
    expect(resolveCinema2AfterhoursBeamCount(3.6)).toBe(4)
    expect(resolveCinema2AfterhoursBeamCount(999)).toBe(CINEMA2_AFTERHOURS_MAX_BEAMS)

    for (const beamCount of [2, 3, 7, 8, 15, 16, 999]) {
      const allocated = allocateCinema2AfterhoursFixtures({
        topologyId: 'fullRig', beamCount, symmetry: false, sideLasers: true, topLasers: true,
      })
      expect(allocated.activeBeamCount).toBeLessThanOrEqual(resolveCinema2AfterhoursBeamCount(beamCount))
      expect(allocated.activeBeamCount).toBeLessThanOrEqual(CINEMA2_AFTERHOURS_MAX_BEAMS)
    }
  })

  it('keeps symmetry valid when each optional bank family is recruited', () => {
    for (const input of [
      { topologyId: 'wideFan' as const, beamCount: 10, symmetry: true, sideLasers: false, topLasers: false },
      { topologyId: 'splitWings' as const, beamCount: 12, symmetry: true, sideLasers: true, topLasers: false },
      { topologyId: 'chevronRoof' as const, beamCount: 12, symmetry: true, sideLasers: false, topLasers: true },
    ]) {
      const allocated = allocateCinema2AfterhoursFixtures(input)
      for (const fixture of allocated.fixtures) {
        expect(allocated.fixtures.some(candidate => candidate.id === fixture.mirrorFixtureId)).toBe(true)
      }
    }
  })

  it('treats odd symmetric Beam Count as a ceiling and keeps only complete mirror pairs', () => {
    const odd = allocateCinema2AfterhoursFixtures({
      topologyId: 'wideFan', beamCount: 7, symmetry: true, sideLasers: true, topLasers: true,
    })
    expect(odd.requestedBeamCount).toBe(7)
    expect(odd.activeBeamCount).toBe(6)
    expect(odd.fixtures).toHaveLength(6)
    for (const fixture of odd.fixtures) {
      expect(odd.fixtures.some(candidate => candidate.id === fixture.mirrorFixtureId)).toBe(true)
    }
  })

  it('makes Symmetry OFF observably asymmetric while remaining deterministic', () => {
    const input = { topologyId: 'fullRig' as const, beamCount: 7, symmetry: false, sideLasers: true, topLasers: true }
    const first = allocateCinema2AfterhoursFixtures(input)
    const second = allocateCinema2AfterhoursFixtures(input)
    expect(first).toEqual(second)
    expect(first.activeBeamCount).toBe(7)
    expect(first.fixtures.some(fixture => !first.fixtures.some(candidate => candidate.id === fixture.mirrorFixtureId))).toBe(true)
  })

  it('obeys side and overhead authorization independently', () => {
    const bottomOnly = allocateCinema2AfterhoursFixtures({
      topologyId: 'fullRig', beamCount: 16, symmetry: false, sideLasers: false, topLasers: false,
    })
    expect(bottomOnly.fixtures.every(candidate => candidate.bank === 'bottom')).toBe(true)
    expect(bottomOnly.activeBeamCount).toBe(10)

    const topButNoSides = allocateCinema2AfterhoursFixtures({
      topologyId: 'chevronRoof', beamCount: 16, symmetry: false, sideLasers: false, topLasers: true,
    })
    expect(topButNoSides.fixtures.some(candidate => candidate.bank === 'overhead')).toBe(true)
    expect(topButNoSides.fixtures.some(candidate => candidate.bank === 'left' || candidate.bank === 'right')).toBe(false)

    const sidesButNoTop = allocateCinema2AfterhoursFixtures({
      topologyId: 'splitWings', beamCount: 16, symmetry: false, sideLasers: true, topLasers: false,
    })
    expect(sidesButNoTop.fixtures.some(candidate => candidate.bank === 'left' || candidate.bank === 'right')).toBe(true)
    expect(sidesButNoTop.fixtures.some(candidate => candidate.bank === 'overhead')).toBe(false)
  })

  it('generates finite non-zero world-space beams for every topology', () => {
    for (const topologyId of CINEMA2_AFTERHOURS_TOPOLOGY_IDS) {
      const beams = frame(topologyId)
      expect(beams.length).toBeGreaterThan(0)
      expect(beams.length).toBeLessThanOrEqual(CINEMA2_AFTERHOURS_MAX_BEAMS)
      for (const beam of beams) {
        expect(finite3(beam.originWorld)).toBe(true)
        expect(finite3(beam.targetWorld)).toBe(true)
        expect(finite3(beam.directionWorld)).toBe(true)
        expect(beam.lengthWorld).toBeGreaterThan(0.1)
        expect(Math.hypot(...beam.directionWorld)).toBeCloseTo(1, 8)
        expect(beam.targetWorld[2]).toBeGreaterThan(beam.originWorld[2])
      }
    }
  })

  it('mirrors symmetric world geometry exactly across the stage center plane', () => {
    const beams = frame('diamondStar', { beamCount: 10 })
    for (const beam of beams) {
      expect(beam.symmetry).not.toBeNull()
      const mirror = beams.find(candidate => candidate.symmetry?.pairId === beam.symmetry?.pairId && candidate.fixtureId !== beam.fixtureId)
      expect(mirror).toBeDefined()
      expect(mirror!.originWorld[0]).toBeCloseTo(-beam.originWorld[0], 10)
      expect(mirror!.targetWorld[0]).toBeCloseTo(-beam.targetWorld[0], 10)
      expect(mirror!.targetWorld[1]).toBeCloseTo(beam.targetWorld[1], 10)
      expect(mirror!.targetWorld[2]).toBeCloseTo(beam.targetWorld[2], 10)
      expect(mirror!.directionWorld[0]).toBeCloseTo(-beam.directionWorld[0], 10)
      expect(mirror!.directionWorld[1]).toBeCloseTo(beam.directionWorld[1], 10)
      expect(mirror!.directionWorld[2]).toBeCloseTo(beam.directionWorld[2], 10)
    }
  })

  it('replays identical geometry for identical shared-random inputs and varies only when the variation identity changes', () => {
    const base = {
      topologyId: 'radialCrown' as const,
      beamCount: 12,
      symmetry: false,
      sideLasers: true,
      topLasers: true,
      random: random('shared-seed'),
    }
    const first = generateCinema2AfterhoursBeamFrame({ ...base, variationKey: 'phrase:4' })
    const second = generateCinema2AfterhoursBeamFrame({ ...base, random: random('shared-seed'), variationKey: 'phrase:4' })
    const changed = generateCinema2AfterhoursBeamFrame({ ...base, random: random('shared-seed'), variationKey: 'phrase:5' })
    expect(first).toEqual(second)
    expect(changed).not.toEqual(first)
  })

  it('keeps sparseArchitecture deliberately sparse even when Beam Count is higher', () => {
    const beams = frame('sparseArchitecture', { beamCount: 16, symmetry: false })
    expect(beams).toHaveLength(4)
  })
})

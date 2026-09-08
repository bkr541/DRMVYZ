import { describe, expect, it } from 'vitest'
import {
  AFTERHOURS_VIRTUAL_STAGE_RIG,
  allocateAfterhoursRigFixtures,
  getAfterhoursMirrorFixture,
} from './AfterhoursVirtualStageRig'

function allocation(beamCount: number, sideLasers = true, topLasers = true) {
  return allocateAfterhoursRigFixtures({ beamCount, sideLasers, topLasers })
}

describe('Afterhours Stage 3 virtual stage rig', () => {
  it('defines stable lower, mirrored wing, and overhead fixture identities around a deliberate centre aperture', () => {
    const rig = AFTERHOURS_VIRTUAL_STAGE_RIG
    expect(rig.id).toBe('afterhours-virtual-stage-v1')
    expect(rig.banks.lower).toHaveLength(10)
    expect(rig.banks.leftWing).toHaveLength(3)
    expect(rig.banks.rightWing).toHaveLength(3)
    expect(rig.banks.overhead).toHaveLength(6)
    expect(new Set(rig.fixtures.map(fixture => fixture.id)).size).toBe(rig.fixtures.length)

    for (const fixture of rig.fixtures) {
      const mirror = getAfterhoursMirrorFixture(fixture)
      expect(mirror.mirrorFixtureId).toBe(fixture.id)
      expect(mirror.position.x).toBeCloseTo(1 - fixture.position.x, 9)
      expect(mirror.position.y).toBeCloseTo(fixture.position.y, 9)
      expect(Number.isFinite(fixture.homeHeadingDeg)).toBe(true)
    }

    expect(rig.fixtures.some(fixture => (
      fixture.position.x > rig.centerAperture.minX && fixture.position.x < rig.centerAperture.maxX
    ))).toBe(false)
  })

  it('uses explicit low-count priority instead of array-order starvation', () => {
    expect(allocation(2).map(fixture => fixture.role)).toEqual(['lower', 'lower'])
    expect(allocation(4).map(fixture => fixture.role)).toEqual(['lower', 'lower', 'leftWing', 'rightWing'])
    expect(new Set(allocation(6).map(fixture => fixture.role))).toEqual(new Set(['lower', 'leftWing', 'rightWing', 'overhead']))
  })

  it('allocates exact literal budgets at 2/4/8/10/max and recruits every enabled bank by eight beams', () => {
    for (const beamCount of [2, 4, 8, 10, 16]) {
      expect(allocation(beamCount)).toHaveLength(beamCount)
    }
    const eight = allocation(8)
    expect(new Set(eight.map(fixture => fixture.bank))).toEqual(new Set(['bottom', 'left', 'right', 'top']))
  })

  it('honours the complete Side/Top toggle matrix without reshuffling into disabled banks', () => {
    const cases = [
      { sideLasers: false, topLasers: false, expected: new Set(['bottom']) },
      { sideLasers: true, topLasers: false, expected: new Set(['bottom', 'left', 'right']) },
      { sideLasers: false, topLasers: true, expected: new Set(['bottom', 'top']) },
      { sideLasers: true, topLasers: true, expected: new Set(['bottom', 'left', 'right', 'top']) },
    ] as const

    for (const testCase of cases) {
      const fixtures = allocation(8, testCase.sideLasers, testCase.topLasers)
      expect(new Set(fixtures.map(fixture => fixture.bank))).toEqual(testCase.expected)
    }
  })

  it('keeps side-wing roles balanced for every odd/even budget and mirrors every complete pair', () => {
    for (let beamCount = 2; beamCount <= 16; beamCount += 1) {
      const fixtures = allocation(beamCount)
      const leftWing = fixtures.filter(fixture => fixture.role === 'leftWing').length
      const rightWing = fixtures.filter(fixture => fixture.role === 'rightWing').length
      expect(leftWing).toBe(rightWing)

      const pairedCount = beamCount - (beamCount % 2)
      for (let index = 0; index < pairedCount; index += 2) {
        expect(fixtures[index + 1].id).toBe(fixtures[index].mirrorFixtureId)
      }
      if (beamCount % 2 === 1) expect(fixtures[beamCount - 1].role).toBe('lower')
    }
  })

  it('reconstructs the same fixture identities and positions across repeated allocation/re-entry', () => {
    const a = allocation(10).map(fixture => ({ id: fixture.id, position: fixture.position }))
    const b = allocation(10).map(fixture => ({ id: fixture.id, position: fixture.position }))
    expect(b).toEqual(a)
  })

  it('cycles stable lower pairs only after the fixed bank is exhausted', () => {
    const fixtures = allocation(16, false, false)
    expect(new Set(fixtures.slice(0, 10).map(fixture => fixture.id)).size).toBe(10)
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBeLessThan(fixtures.length)
    for (let index = 0; index < fixtures.length; index += 2) {
      expect(fixtures[index + 1].id).toBe(fixtures[index].mirrorFixtureId)
    }
  })
})

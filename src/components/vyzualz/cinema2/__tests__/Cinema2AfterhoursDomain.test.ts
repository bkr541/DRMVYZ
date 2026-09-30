import { describe, expect, it } from 'vitest'
import {
  CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT,
  CINEMA2_AFTERHOURS_MAX_LASERS,
  CINEMA2_AFTERHOURS_MIN_LASERS,
  CINEMA2_AFTERHOURS_RIG,
  getCinema2AfterhoursMirrorFixture,
  resolveCinema2AfterhoursLaserLimit,
} from '../modules/afterhours'

function finite3(value: readonly number[]) {
  return value.length === 3 && value.every(component => Number.isFinite(component))
}

describe('Cinema 2.0 Afterhours 2.0 rig', () => {
  it('installs 46 stable world-space lasers: floor, top and mid-height rows, two side towers and two centre points', () => {
    const rig = CINEMA2_AFTERHOURS_RIG
    expect(rig.fixtures).toHaveLength(CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT)
    expect(CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT).toBe(46)
    expect(rig.banks.bottom).toHaveLength(10)
    expect(rig.banks.overhead).toHaveLength(10)
    expect(rig.banks.mid).toHaveLength(8)
    expect(rig.banks.left).toHaveLength(8)
    expect(rig.banks.right).toHaveLength(8)
    expect(rig.banks.center).toHaveLength(2)
    expect(new Set(rig.fixtures.map(candidate => candidate.id)).size).toBe(46)
    expect(rig.pairs.bottom).toHaveLength(5)
    expect(rig.pairs.overhead).toHaveLength(5)
    expect(rig.pairs.mid).toHaveLength(4)
    expect(rig.pairs.side).toHaveLength(8)
    expect(rig.pairs.center).toHaveLength(2)
    expect(rig.fixtures.every(candidate => finite3(candidate.positionWorld))).toBe(true)
    expect(rig.fixtures.every(candidate => finite3(candidate.mountDirectionWorld))).toBe(true)
  })

  it('stacks the rows at distinct heights so each row gives its own looks', () => {
    const heightOf = (bank: keyof typeof CINEMA2_AFTERHOURS_RIG.banks) => CINEMA2_AFTERHOURS_RIG.banks[bank][0]!.positionWorld[1]
    expect(heightOf('bottom')).toBeLessThan(heightOf('mid'))
    expect(heightOf('mid')).toBeLessThan(heightOf('overhead'))
    const sideHeights = CINEMA2_AFTERHOURS_RIG.banks.left.map(candidate => candidate.positionWorld[1])
    expect(Math.min(...sideHeights)).toBeLessThan(heightOf('mid'))
    expect(Math.max(...sideHeights)).toBeGreaterThan(heightOf('mid'))
  })

  it('keeps every mirror link reciprocal and every pair physically bilateral; centre lasers mirror themselves', () => {
    for (const candidate of CINEMA2_AFTERHOURS_RIG.fixtures) {
      const mirror = getCinema2AfterhoursMirrorFixture(candidate)
      expect(getCinema2AfterhoursMirrorFixture(mirror).id).toBe(candidate.id)
      expect(mirror.positionWorld[0]).toBeCloseTo(-candidate.positionWorld[0], 6)
      expect(mirror.positionWorld[1]).toBeCloseTo(candidate.positionWorld[1], 6)
      expect(mirror.pairIndex).toBe(candidate.pairIndex)
      if (candidate.bank === 'center') {
        expect(mirror.id).toBe(candidate.id)
        expect(candidate.mirrorSide).toBe('center')
      } else {
        expect(mirror.mirrorSide).not.toBe(candidate.mirrorSide)
      }
    }
  })

  it('numbers row pairs from the centre outward', () => {
    for (const bank of ['bottom', 'overhead', 'mid'] as const) {
      const byPair = [...CINEMA2_AFTERHOURS_RIG.banks[bank]].sort((a, b) => a.pairIndex - b.pairIndex)
      const distances = byPair.map(candidate => Math.abs(candidate.positionWorld[0]))
      expect(distances).toEqual([...distances].sort((a, b) => a - b))
    }
  })

  it('clamps Laser Count to the installed rig', () => {
    expect(resolveCinema2AfterhoursLaserLimit(0)).toBe(CINEMA2_AFTERHOURS_MIN_LASERS)
    expect(resolveCinema2AfterhoursLaserLimit(999)).toBe(CINEMA2_AFTERHOURS_MAX_LASERS)
    expect(resolveCinema2AfterhoursLaserLimit(Number.NaN)).toBe(CINEMA2_AFTERHOURS_MAX_LASERS)
    expect(resolveCinema2AfterhoursLaserLimit(12.4)).toBe(12)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES,
  createCinema2MainframeLightingDiagnosticFrame,
  parseCinema2MainframeLightingDiagnosticFamily,
} from '../modules/mainframe/Cinema2MainframeLightingDiagnostic'

const targets: Record<string, readonly number[]> = {
  circuits: [1], radars: [4], chips: [5], terminals: [2], indicators: [3], logo: [6, 7, 8],
}

describe('Mainframe P0-01 dev-only semantic lighting probe', () => {
  it('recognizes only the six explicit, case-sensitive lighting families', () => {
    expect(CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES).toHaveLength(6)
    for (const family of CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES) {
      expect(parseCinema2MainframeLightingDiagnosticFamily(family)).toBe(family)
    }
    for (const invalid of [null, '', 'board', 'all', 'logoStar', 'RADARS']) {
      expect(parseCinema2MainframeLightingDiagnosticFamily(invalid)).toBeNull()
    }
  })

  it('ignites only its own GLB system IDs, without a song, chase, or fake impulses', () => {
    for (const family of CINEMA2_MAINFRAME_LIGHTING_DIAGNOSTIC_FAMILIES) {
      const frame = createCinema2MainframeLightingDiagnosticFrame(family)
      expect(frame.active).toBe(true)
      expect(frame.systemGains).toHaveLength(9)
      expect(frame.systemGains.flatMap((gain, id) => gain === 1 ? [id] : [])).toEqual(targets[family])
      expect(frame.systemGains.every(gain => gain === 0 || gain === 1)).toBe(true)
      expect(frame.chaseGain).toBe(0)
      expect(frame.bankWeights).toEqual([0, 0, 0, 0])
      expect(frame.regionWeights).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
      expect(Object.values(frame.impulses).every(value => value === 0)).toBe(true)
      expect(Object.values(frame.signals).filter((value): value is number => typeof value === 'number').every(value => value === 0)).toBe(true)
      expect(frame.signals.section).toBe('unknown')
    }
  })
})

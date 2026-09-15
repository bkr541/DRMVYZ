import { describe, expect, it } from 'vitest'

import { CINEMA2_INTERLOCK_RIG } from '../modules/interlock/Cinema2InterlockRig'
import {
  CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID,
  CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS,
  normalizeCinema2InterlockSegmentProgramId,
  resolveCinema2InterlockCellCenters,
  resolveCinema2InterlockCellCount,
  resolveCinema2InterlockSegmentIntensity,
  resolveCinema2InterlockSegmentPhase,
  type Cinema2InterlockSegmentProgramId,
} from '../modules/interlock/Cinema2InterlockSegments'

function intensity(program: Cinema2InterlockSegmentProgramId, cellIndex: number, overrides: Partial<Parameters<typeof resolveCinema2InterlockSegmentIntensity>[0]> = {}) {
  return resolveCinema2InterlockSegmentIntensity({
    program,
    cellIndex,
    cellCount: 24,
    phase: 0.31,
    litDensity: 0.65,
    segmentFade: 0.32,
    segmentAfterglow: 0.18,
    segmentEnergy: 0.62,
    segmentImpact: 0.8,
    segmentDirectionBias: 0,
    segmentBankPhase: 0,
    direction: 1,
    bankIndex: 0,
    fixtureOrder: 0,
    ...overrides,
  })
}

describe('Cinema 2.0 Interlock segmented LED domain', () => {
  it('normalizes all nine stable programs and falls back to Center Out', () => {
    expect(CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS).toHaveLength(9)
    for (const program of CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS) {
      expect(normalizeCinema2InterlockSegmentProgramId(program)).toBe(program)
    }
    expect(normalizeCinema2InterlockSegmentProgramId('unknown')).toBe(CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID)
    expect(normalizeCinema2InterlockSegmentProgramId(null)).toBe(CINEMA2_INTERLOCK_DEFAULT_SEGMENT_PROGRAM_ID)
  })

  it('maps fixture banks to stable 24/32/48 cell densities without changing the 28-fixture rig', () => {
    expect(CINEMA2_INTERLOCK_RIG.fixtures).toHaveLength(28)
    const counts = new Map(CINEMA2_INTERLOCK_RIG.fixtures.map(fixture => [fixture.bank, resolveCinema2InterlockCellCount(fixture)]))
    expect(counts.get('inner')).toBe(24)
    expect(counts.get('middle')).toBe(32)
    expect(counts.get('outer')).toBe(48)
    expect(counts.get('edge')).toBe(48)

    for (const count of [24, 32, 48]) {
      const centers = resolveCinema2InterlockCellCenters(count)
      expect(centers).toHaveLength(count)
      expect(centers[0]).toBeCloseTo(0.5 / count)
      expect(centers[centers.length - 1]).toBeCloseTo((count - 0.5) / count)
      expect(centers.every((value, index) => index === 0 || value > centers[index - 1]!)).toBe(true)
    }
  })

  it('keeps phase deterministic, finite, frame-rate independent, and stationary at zero speed', () => {
    expect(resolveCinema2InterlockSegmentPhase(99, 0)).toBe(0)
    expect(resolveCinema2InterlockSegmentPhase(Number.NaN, 0.5)).toBe(0)
    expect(resolveCinema2InterlockSegmentPhase(4.25, 0.5)).toBe(resolveCinema2InterlockSegmentPhase(4.25, 0.5))
    expect(resolveCinema2InterlockSegmentPhase(4.25, 0.5)).toBeGreaterThanOrEqual(0)
    expect(resolveCinema2InterlockSegmentPhase(4.25, 0.5)).toBeLessThan(1)
  })

  it('produces finite bounded deterministic intensity for every program and boundary phase', () => {
    for (const program of CINEMA2_INTERLOCK_SEGMENT_PROGRAM_IDS) {
      for (const phase of [0, 0.5, 0.999999, -100, 1e9]) {
        const first = intensity(program, 7, { phase })
        const second = intensity(program, 7, { phase })
        expect(Number.isFinite(first), `${program}/${phase}`).toBe(true)
        expect(first).toBeGreaterThanOrEqual(0)
        expect(first).toBeLessThanOrEqual(1)
        expect(first).toBe(second)
      }
    }
  })

  it('falsifies direction, symmetry, parity, meter, ripple, and impact behavior at focused cells', () => {
    expect(intensity('forwardChase', 2)).not.toBe(intensity('reverseChase', 2))
    expect(intensity('forwardChase', 2, { direction: 1 })).not.toBe(intensity('forwardChase', 2, { direction: -1 }))

    const leftCenterOut = intensity('centerOut', 4, { phase: 0.4 })
    const rightCenterOut = intensity('centerOut', 19, { phase: 0.4 })
    expect(leftCenterOut).toBeCloseTo(rightCenterOut, 10)
    const leftEdgeIn = intensity('edgeIn', 3, { phase: 0.32 })
    const rightEdgeIn = intensity('edgeIn', 20, { phase: 0.32 })
    expect(leftEdgeIn).toBeCloseTo(rightEdgeIn, 10)

    expect(intensity('alternating', 2, { phase: 0.25 })).toBeGreaterThan(intensity('alternating', 3, { phase: 0.25 }))
    expect(intensity('alternating', 2, { phase: 0.75 })).toBeLessThan(intensity('alternating', 3, { phase: 0.75 }))

    expect(intensity('audioMeterFill', 2, { segmentEnergy: 0.9 })).toBeGreaterThan(intensity('audioMeterFill', 20, { segmentEnergy: 0.2 }))
    expect(intensity('bankRipple', 5, { bankIndex: 0 })).not.toBe(intensity('bankRipple', 5, { bankIndex: 3 }))
    expect(intensity('impactBurst', 8, { segmentImpact: 1 })).toBeGreaterThan(intensity('impactBurst', 8, { segmentImpact: 0 }))
  })
})

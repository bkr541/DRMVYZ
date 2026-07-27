import { describe, expect, it } from 'vitest'
import {
  applyVectorBeamScannerKinematics,
  VECTOR_BEAM_SCANNER_KINEMATICS_DISABLED,
  type VectorBeamScannerKinematicsSettings,
} from '../VectorBeamScannerKinematics'
import type { VectorBeamSegment } from '../VectorBeamTypes'

function segment(overrides: Partial<VectorBeamSegment> = {}): VectorBeamSegment {
  return {
    origin: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
    color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    density: 1,
    dwellWeight: 0.5,
    velocityRatio: 0.5,
    historyWeight: 1,
    ...overrides,
  }
}

const ENABLED: VectorBeamScannerKinematicsSettings = {
  enabled: true,
  cornerDwellMicros: 64,
  blankingDelayMicros: 18,
  maxAngularVelocityDegPerSec: 18_000,
}

describe('VECTOR_BEAM_SCANNER_KINEMATICS_DISABLED', () => {
  it('is disabled by default', () => {
    expect(VECTOR_BEAM_SCANNER_KINEMATICS_DISABLED.enabled).toBe(false)
  })
})

describe('applyVectorBeamScannerKinematics', () => {
  it('is a no-op (returns the same array) when disabled', () => {
    const segments = [segment()]
    const result = applyVectorBeamScannerKinematics(segments, VECTOR_BEAM_SCANNER_KINEMATICS_DISABLED)
    expect(result).toBe(segments)
  })

  it('is a no-op for an empty segment array even when enabled', () => {
    const result = applyVectorBeamScannerKinematics([], ENABLED)
    expect(result).toEqual([])
  })

  it('when enabled, throttles velocityRatio for a segment whose travel exceeds the sustainable angular velocity', () => {
    const fastSegment = segment({ target: { x: 5000, y: 0 }, velocityRatio: 1 })
    const [result] = applyVectorBeamScannerKinematics(
      [fastSegment],
      { ...ENABLED, maxAngularVelocityDegPerSec: 1 },
    )
    expect(result.velocityRatio).toBeLessThan(fastSegment.velocityRatio)
  })

  it('when enabled, leaves velocityRatio close to unthrottled for travel well within sustainable velocity', () => {
    const slowSegment = segment({ target: { x: 1, y: 0 }, velocityRatio: 1 })
    const [result] = applyVectorBeamScannerKinematics(
      [slowSegment],
      { ...ENABLED, maxAngularVelocityDegPerSec: 1_000_000 },
    )
    expect(result.velocityRatio).toBeCloseTo(slowSegment.velocityRatio, 1)
  })

  it('when enabled, dims density toward blanked for a very sharp corner (dwellWeight > 0.92)', () => {
    const sharpCorner = segment({ dwellWeight: 0.98, density: 1 })
    const [result] = applyVectorBeamScannerKinematics([sharpCorner], ENABLED)
    expect(result.density).toBeLessThan(sharpCorner.density)
  })

  it('when enabled, does not blank a gentle corner (dwellWeight below the blanking threshold)', () => {
    const gentleCorner = segment({ dwellWeight: 0.3, density: 1 })
    const [result] = applyVectorBeamScannerKinematics([gentleCorner], ENABLED)
    expect(result.density).toBe(gentleCorner.density)
  })

  it('when enabled with blankingDelayMicros = 0, never blanks regardless of corner sharpness', () => {
    const sharpCorner = segment({ dwellWeight: 1, density: 1 })
    const [result] = applyVectorBeamScannerKinematics(
      [sharpCorner],
      { ...ENABLED, blankingDelayMicros: 0 },
    )
    expect(result.density).toBe(sharpCorner.density)
  })

  it('preserves origin, target, and color unchanged', () => {
    const original = segment()
    const [result] = applyVectorBeamScannerKinematics([original], ENABLED)
    expect(result.origin).toEqual(original.origin)
    expect(result.target).toEqual(original.target)
    expect(result.color).toEqual(original.color)
  })

  it('all outputs stay within valid 0..1 bounds', () => {
    const segments = [
      segment({ dwellWeight: 1, velocityRatio: 1, density: 1 }),
      segment({ dwellWeight: 0, velocityRatio: 0, density: 0 }),
    ]
    const results = applyVectorBeamScannerKinematics(segments, ENABLED)
    for (const r of results) {
      expect(r.dwellWeight).toBeGreaterThanOrEqual(0)
      expect(r.dwellWeight).toBeLessThanOrEqual(1)
      expect(r.velocityRatio).toBeGreaterThanOrEqual(0)
      expect(r.velocityRatio).toBeLessThanOrEqual(1)
      expect(r.density).toBeGreaterThanOrEqual(0)
    }
  })
})

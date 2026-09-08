import { describe, expect, it } from 'vitest'
import {
  AFTERHOURS_MAX_BEAMS,
  generateAfterhoursBeams,
  isAfterhoursViewportExit,
  type AfterhoursBeamGenerationSettings,
} from './AfterhoursBeamGeometry'
import { blendAfterhoursBeamFrames } from './AfterhoursBeamMorph'

const BEAM_BASE: AfterhoursBeamGenerationSettings = {
  pattern: 'wideFan',
  symmetry: true,
  sideLasers: false,
  topLasers: false,
  beamCount: 8,
  spread: 0.65,
  accentMix: 0.25,
}

describe('Afterhours Stage 5/6 — deterministic beam-frame morphing', () => {
  const genA = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'wideFan', beamCount: 8 }, { variation: 0 })
  const genB = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'wideFan', beamCount: 8 }, { variation: 1 })

  it('returns the previous frame exactly at transition 0 and the next frame exactly at transition 1', () => {
    const at0 = blendAfterhoursBeamFrames(genA, genB, 0)
    const at1 = blendAfterhoursBeamFrames(genA, genB, 1)
    for (let i = 0; i < AFTERHOURS_MAX_BEAMS; i += 1) {
      if (genA[i].active) {
        expect(at0[i].target.x).toBeCloseTo(genA[i].target.x, 9)
        expect(at0[i].target.y).toBeCloseTo(genA[i].target.y, 9)
      }
      if (genB[i].active) {
        expect(at1[i].target.x).toBeCloseTo(genB[i].target.x, 9)
        expect(at1[i].target.y).toBeCloseTo(genB[i].target.y, 9)
      }
    }
  })

  it('never interpolates a fixed emitter origin and re-projects every mid-morph ray to the viewport edge', () => {
    for (const t of [0.15, 0.4, 0.6, 0.85]) {
      const blended = blendAfterhoursBeamFrames(genA, genB, t)
      for (let i = 0; i < AFTERHOURS_MAX_BEAMS; i += 1) {
        const beam = blended[i]
        if (!beam.active) continue
        expect(beam.origin === genA[i].origin || beam.origin === genB[i].origin).toBe(true)
        expect(beam.target).toBe(beam.endpoint)
        expect(isAfterhoursViewportExit(beam.endpoint)).toBe(true)
        expect(Math.hypot(beam.direction.x, beam.direction.y)).toBeCloseTo(1, 8)
        expect(beam.weight).toBeGreaterThan(0)
        expect(beam.weight).toBeLessThanOrEqual(1)
      }
    }
  })

  it('fades membership in and out by weight rather than teleporting a slot', () => {
    const few = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'wideFan', beamCount: 4 }, { variation: 0 })
    const many = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'wideFan', beamCount: 10 }, { variation: 0 })
    const midIn = blendAfterhoursBeamFrames(few, many, 0.5)
    const midOut = blendAfterhoursBeamFrames(many, few, 0.5)
    expect(midIn[7].active).toBe(true)
    expect(midIn[7].weight).toBeGreaterThan(0)
    expect(midIn[7].weight).toBeLessThan(1)
    expect(midOut[7].weight).toBeGreaterThan(0)
    expect(midOut[7].weight).toBeLessThan(1)
    expect(midIn[15].active).toBe(false)
    expect(midIn[15].weight).toBe(0)
  })
})

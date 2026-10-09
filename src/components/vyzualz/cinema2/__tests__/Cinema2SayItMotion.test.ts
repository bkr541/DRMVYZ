import { describe, expect, it } from 'vitest'
import { cinema2SayItGlyphBoundingRadius } from '../modules/sayIt/Cinema2SayItTextLayout'
import {
  CINEMA2_SAY_IT_MOTION_DIRECTIONS,
  CINEMA2_SAY_IT_MOTION_PROGRAMS,
  CINEMA2_SAY_IT_PROOF_TEXT,
  cinema2SayItIsExactlyAssembled,
  resolveCinema2SayItGlyphPoses,
} from '../modules/sayIt/Cinema2SayItMotion'

const OPTIONS = Object.freeze({ cycleSeconds: 8, motionAmount: 1, spread: 1 })

describe('Cinema 2.0 SAY IT motion', () => {
  it('uses the exact Step-1 proof phrase and returns to its authored transforms', () => {
    expect(CINEMA2_SAY_IT_PROOF_TEXT).toBe('SAY IT')
    expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(0, OPTIONS))).toBe(true)
    expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(7.6, OPTIONS))).toBe(true)
    expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(8, OPTIONS))).toBe(true)
  })

  it('moves and rotates every glyph independently during the excursion', () => {
    const poses = resolveCinema2SayItGlyphPoses(4, OPTIONS)
    expect(cinema2SayItIsExactlyAssembled(poses)).toBe(false)
    expect(poses).toHaveLength(5)
    expect(poses.every(pose => pose.rotation.some(value => Math.abs(value) > 0.01))).toBe(true)
    expect(new Set(poses.map(pose => pose.rotation.join(':'))).size).toBe(5)
    expect(new Set(poses.map(pose => pose.position.join(':'))).size).toBe(5)
  })

  it('is deterministic and Motion Amount zero is a true lock-off', () => {
    const first = resolveCinema2SayItGlyphPoses(3.125, OPTIONS)
    const second = resolveCinema2SayItGlyphPoses(3.125, OPTIONS)
    expect(second).toEqual(first)
    expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(3.125, { ...OPTIONS, motionAmount: 0 }))).toBe(true)
  })

  it('provides five distinct programs that preserve the exact assembly holds', () => {
    const signatures = CINEMA2_SAY_IT_MOTION_PROGRAMS.map(program => {
      const poses = resolveCinema2SayItGlyphPoses(4, { ...OPTIONS, program, randomSeed: 19 })
      expect(cinema2SayItIsExactlyAssembled(poses)).toBe(false)
      expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(0, { ...OPTIONS, program }))).toBe(true)
      expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(7.6, { ...OPTIONS, program }))).toBe(true)
      expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(8, { ...OPTIONS, program }))).toBe(true)
      return JSON.stringify(poses.map(pose => [pose.position, pose.rotation]))
    })
    expect(new Set(signatures).size).toBe(CINEMA2_SAY_IT_MOTION_PROGRAMS.length)
  })

  it('applies deterministic delay order, direction, axis weights and random seeds', () => {
    const options = { ...OPTIONS, program: 'scatter' as const, direction: 'random' as const, glyphDelay: 0.012, randomSeed: 41 }
    const first = resolveCinema2SayItGlyphPoses(3.4, options)
    expect(resolveCinema2SayItGlyphPoses(3.4, options)).toEqual(first)
    expect(resolveCinema2SayItGlyphPoses(3.4, { ...options, randomSeed: 42 })).not.toEqual(first)

    const yOnly = resolveCinema2SayItGlyphPoses(4, { ...options, axisWeights: [0, 1, 0] })
    expect(yOnly.every(pose => pose.rotation[0] === 0 && pose.rotation[2] === 0)).toBe(true)
    expect(yOnly.some(pose => Math.abs(pose.rotation[1]) > Math.PI * 2)).toBe(true)

    const forward = resolveCinema2SayItGlyphPoses(2.7, { ...OPTIONS, direction: 'forward', glyphDelay: 0.02 })
    const reverse = resolveCinema2SayItGlyphPoses(2.7, { ...OPTIONS, direction: 'reverse', glyphDelay: 0.02 })
    expect(forward).not.toEqual(reverse)
  })

  it('bounds reduced motion and exposes an unconditional lock-off', () => {
    const full = resolveCinema2SayItGlyphPoses(4, { ...OPTIONS, safety: 'full' })
    const reduced = resolveCinema2SayItGlyphPoses(4, { ...OPTIONS, safety: 'reduced' })
    const maximumRotation = (poses: ReturnType<typeof resolveCinema2SayItGlyphPoses>) => Math.max(...poses.flatMap(pose => pose.rotation.map(Math.abs)))
    const maximumTravel = (poses: ReturnType<typeof resolveCinema2SayItGlyphPoses>) => Math.max(...poses.map((pose, index) => {
      const origin = resolveCinema2SayItGlyphPoses(0, OPTIONS)[index]!.position
      return Math.hypot(pose.position[0] - origin[0], pose.position[1] - origin[1], pose.position[2] - origin[2])
    }))
    expect(maximumRotation(reduced)).toBeLessThan(maximumRotation(full))
    expect(maximumTravel(reduced)).toBeLessThan(maximumTravel(full))
    expect(cinema2SayItIsExactlyAssembled(resolveCinema2SayItGlyphPoses(4, { ...OPTIONS, safety: 'lockoff' }))).toBe(true)
  })

  it('keeps solid letters from overlapping while they tumble', () => {
    const radii = [...'SAYIT'].map(character => cinema2SayItGlyphBoundingRadius(character.codePointAt(0)!, 1))
    for (const program of CINEMA2_SAY_IT_MOTION_PROGRAMS) {
      for (const direction of CINEMA2_SAY_IT_MOTION_DIRECTIONS) {
        for (let time = 0; time <= 8; time += 0.1) {
          const poses = resolveCinema2SayItGlyphPoses(time, { ...OPTIONS, program, direction, randomSeed: 7 })
          poses.forEach((a, i) => poses.slice(i + 1).forEach((b, offset) => {
            const j = i + 1 + offset
            const turned = Math.max(...a.rotation.map(Math.abs), ...b.rotation.map(Math.abs)) > 0.6
            if (!turned) return
            const distance = Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])
            expect(distance, `${program}/${direction} t=${time.toFixed(1)} ${a.character}${b.character}`).toBeGreaterThanOrEqual(radii[i]! + radii[j]! - 5e-3)
          }))
        }
      }
    }
  })
})

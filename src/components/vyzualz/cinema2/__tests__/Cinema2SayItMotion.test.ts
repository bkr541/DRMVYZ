import { describe, expect, it } from 'vitest'
import {
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
})

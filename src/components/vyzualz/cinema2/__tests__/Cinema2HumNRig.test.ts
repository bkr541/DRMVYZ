import { describe, expect, it } from 'vitest'
import { CINEMA2_HUMN_BONE, CINEMA2_HUMN_BONE_COUNT, CINEMA2_HUMN_BONE_PIVOTS } from '../modules/humn/Cinema2HumNMesh'
import { CINEMA2_HUMN_NEUTRAL_POSE, type Cinema2HumNPerformancePose } from '../modules/humn/Cinema2HumNPerformance'
import { createCinema2HumNRigState, evaluateCinema2HumNRig, type Cinema2HumNRigInput } from '../modules/humn/Cinema2HumNRig'

function pose(overrides: Partial<Cinema2HumNPerformancePose>): Cinema2HumNPerformancePose {
  return { ...CINEMA2_HUMN_NEUTRAL_POSE, ...overrides }
}

function evaluate(input: Partial<Cinema2HumNRigInput>) {
  const state = createCinema2HumNRigState()
  evaluateCinema2HumNRig({ beat: 0, motion: 0, beatEnvelope: 0, pose: CINEMA2_HUMN_NEUTRAL_POSE, ...input }, state)
  return state
}

/** Where a bind-pose point ends up under one bone's skinning matrix. */
function transform(matrices: Float32Array, bone: number, point: readonly number[]): [number, number, number] {
  const o = bone * 16
  return [0, 1, 2].map(row => matrices[o + row]! * point[0]! + matrices[o + 4 + row]! * point[1]! + matrices[o + 8 + row]! * point[2]! + matrices[o + 12 + row]!) as [number, number, number]
}

describe('HUM:N pose rig', () => {
  it('leaves every bone at the identity in the neutral pose with no motion', () => {
    const { skinMatrices } = evaluate({})
    for (let bone = 0; bone < CINEMA2_HUMN_BONE_COUNT; bone += 1) {
      for (let element = 0; element < 16; element += 1) {
        expect(skinMatrices[bone * 16 + element]).toBeCloseTo(element % 5 === 0 ? 1 : 0, 5)
      }
    }
  })

  it('is deterministic: the same input gives the same matrices', () => {
    const a = evaluate({ beat: 3.3, motion: 0.7, beatEnvelope: 0.4, pose: pose({ reach: 0.5, lookYaw: 0.3 }) })
    const b = evaluate({ beat: 3.3, motion: 0.7, beatEnvelope: 0.4, pose: pose({ reach: 0.5, lookYaw: 0.3 }) })
    expect(Array.from(a.skinMatrices)).toEqual(Array.from(b.skinMatrices))
  })

  it('moves with the beat only when there is motion, more with more motion, and repeats every two bars', () => {
    const still = evaluate({ beat: 2.7, motion: 0 })
    expect(Array.from(still.skinMatrices)).toEqual(Array.from(evaluate({ beat: 0, motion: 0 }).skinMatrices))
    const head = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.head]!
    const tip: readonly number[] = [head[0], head[1] + 0.25, head[2]]
    const offset = (beat: number, motion: number) => {
      const p = transform(evaluate({ beat, motion }).skinMatrices, CINEMA2_HUMN_BONE.head, tip)
      return Math.hypot(p[0] - tip[0], p[1] - tip[1], p[2] - tip[2])
    }
    expect(offset(2.7, 0.3)).toBeGreaterThan(0.001)
    expect(offset(2.7, 1)).toBeGreaterThan(offset(2.7, 0.3))
    // The longest idle cycle is 16 beats (spine sway over four bars); beats 16 apart pose the figure identically.
    const a = evaluate({ beat: 1.25, motion: 0.8 })
    const b = evaluate({ beat: 1.25 + 48, motion: 0.8 })
    for (let index = 0; index < a.skinMatrices.length; index += 1) expect(b.skinMatrices[index]).toBeCloseTo(a.skinMatrices[index]!, 4)
  })

  it('dips the body on the beat envelope', () => {
    const rootPivot = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.root]!
    const withHit = transform(evaluate({ beat: 1, motion: 1, beatEnvelope: 1 }).skinMatrices, CINEMA2_HUMN_BONE.root, rootPivot)
    const without = transform(evaluate({ beat: 1, motion: 1, beatEnvelope: 0 }).skinMatrices, CINEMA2_HUMN_BONE.root, rootPivot)
    expect(withHit[1]).toBeLessThan(without[1])
  })

  it('reach puts the left hand out toward the camera and up to the shoulder, with the body pushed in', () => {
    const wrist = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.leftHand]!
    const reached = transform(evaluate({ pose: pose({ reach: 1 }) }).skinMatrices, CINEMA2_HUMN_BONE.leftHand, wrist)
    expect(reached[2]).toBeGreaterThan(0.45)
    expect(reached[1]).toBeGreaterThan(0.35)
    const half = transform(evaluate({ pose: pose({ reach: 0.5 }) }).skinMatrices, CINEMA2_HUMN_BONE.leftHand, wrist)
    expect(half[2]).toBeGreaterThan(0.1)
    expect(half[2]).toBeLessThan(reached[2])
    // The other arm stays at the side.
    const right = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.rightHand]!
    const rightWrist = transform(evaluate({ pose: pose({ reach: 1 }) }).skinMatrices, CINEMA2_HUMN_BONE.rightHand, right)
    expect(rightWrist[1]).toBeLessThan(0.2)
  })

  it('head grab lifts both hands up beside the head', () => {
    const state = evaluate({ pose: pose({ headGrab: 1 }) })
    for (const bone of [CINEMA2_HUMN_BONE.leftHand, CINEMA2_HUMN_BONE.rightHand]) {
      const wrist = transform(state.skinMatrices, bone, CINEMA2_HUMN_BONE_PIVOTS[bone]!)
      expect(wrist[1]).toBeGreaterThan(0.55)
    }
  })

  it('lunge drives the whole figure toward the camera and shock rocks it back', () => {
    const chest = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.spine]!
    expect(transform(evaluate({ pose: pose({ lunge: 1 }) }).skinMatrices, CINEMA2_HUMN_BONE.root, chest)[2]).toBeGreaterThan(0.28)
    expect(transform(evaluate({ pose: pose({ shock: 1 }) }).skinMatrices, CINEMA2_HUMN_BONE.root, chest)[2]).toBeLessThan(-0.05)
    expect(evaluate({ pose: pose({ lunge: 1 }) }).rootZ).toBeGreaterThan(0.28)
  })

  it('look turns the head toward the viewer\'s right, body turn twists the chest, and both are bounded', () => {
    const head = CINEMA2_HUMN_BONE_PIVOTS[CINEMA2_HUMN_BONE.head]!
    const nose: readonly number[] = [head[0], head[1] + 0.1, head[2] + 0.12]
    const looked = transform(evaluate({ pose: pose({ lookYaw: 1 }) }).skinMatrices, CINEMA2_HUMN_BONE.head, nose)
    expect(looked[0]).toBeGreaterThan(0.05)
    const other = transform(evaluate({ pose: pose({ lookYaw: -1 }) }).skinMatrices, CINEMA2_HUMN_BONE.head, nose)
    expect(other[0]).toBeLessThan(-0.05)
    const beyond = evaluate({ pose: pose({ lookYaw: 5, bodyTurn: 5 }) })
    const clamped = evaluate({ pose: pose({ lookYaw: 1, bodyTurn: 1 }) })
    expect(Array.from(beyond.skinMatrices)).toEqual(Array.from(clamped.skinMatrices))
  })

  it('keeps every matrix finite for extreme input', () => {
    const state = evaluate({ beat: 1e6, motion: 1, beatEnvelope: 1, pose: pose({ reach: 1, shock: 1, headGrab: 1, lunge: 1, lookYaw: 1, bodyTurn: 1, nod: 1 }) })
    for (const value of state.skinMatrices) expect(Number.isFinite(value)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import {
  CINEMA2_AFTERHOURS_RE_AIM_MIN_TRAVEL,
  Cinema2AfterhoursBeamBlanker,
  cinema2AfterhoursMoveDurationSec,
} from '../modules/afterhours/Cinema2AfterhoursBeamBlanker'
import type { Cinema2AfterhoursRenderBeam } from '../modules/afterhours/Cinema2AfterhoursRenderer'

const beam = (fixtureId: string, target: readonly [number, number, number]): Cinema2AfterhoursRenderBeam => ({
  fixtureId,
  originWorld: [0, 0, 0],
  targetWorld: target,
  intensity: 1,
  alpha: 1,
  color: [0.4, 1, 1, 1],
  width: 1,
})

const FRAME = 1 / 60
const litFrames = (blanker: Cinema2AfterhoursBeamBlanker, target: readonly [number, number, number], frames: number) =>
  Array.from({ length: frames }, () => blanker.apply([beam('a', target)], FRAME).length)

describe('Afterhours beam blanker', () => {
  it('switches a lit laser off the moment it is told to move, and back on at the new point', () => {
    const blanker = new Cinema2AfterhoursBeamBlanker()
    expect(blanker.apply([beam('a', [0, 2, 10])], FRAME)).toHaveLength(1)
    const distance = 8
    const gap = cinema2AfterhoursMoveDurationSec(distance)
    // The frame it is told to move is already dark, it stays dark while it travels, then it is lit again at B and never moves while lit.
    const frames = litFrames(blanker, [distance, 2, 10], Math.ceil(gap / FRAME) + 4)
    expect(frames[0]).toBe(0)
    const darkFrames = frames.findIndex(count => count === 1)
    expect(darkFrames).toBeGreaterThan(0)
    expect(darkFrames * FRAME).toBeGreaterThanOrEqual(gap - FRAME)
    expect(darkFrames * FRAME).toBeLessThanOrEqual(gap + FRAME)
    expect(frames.slice(darkFrames).every(count => count === 1)).toBe(true)
    // When it comes back it is exactly at B, not partway along a sweep.
    expect(blanker.apply([beam('a', [distance, 2, 10])], FRAME)[0]!.targetWorld).toEqual([distance, 2, 10])
  })

  it('never draws a beam between its old and new point: lit beams are only ever at a commanded aim', () => {
    const blanker = new Cinema2AfterhoursBeamBlanker()
    blanker.apply([beam('a', [0, 2, 10])], FRAME)
    const seen = new Set<number>()
    for (let frame = 0; frame < 20; frame += 1) {
      for (const lit of blanker.apply([beam('a', [10, 2, 10])], FRAME)) seen.add(lit.targetWorld[0])
    }
    expect([...seen]).toEqual([10])
  })

  it('takes longer to cross a bigger distance, within a short, fast range', () => {
    expect(cinema2AfterhoursMoveDurationSec(2)).toBeLessThan(cinema2AfterhoursMoveDurationSec(12))
    expect(cinema2AfterhoursMoveDurationSec(0)).toBeGreaterThanOrEqual(0.03)
    expect(cinema2AfterhoursMoveDurationSec(500)).toBeLessThanOrEqual(0.1)
  })

  it('leaves a laser lit while it follows a continuous sweep, which moves a little each frame', () => {
    const blanker = new Cinema2AfterhoursBeamBlanker()
    const step = CINEMA2_AFTERHOURS_RE_AIM_MIN_TRAVEL * 0.4
    const counts = Array.from({ length: 30 }, (_, frame) => blanker.apply([beam('a', [frame * step, 2, 10])], FRAME).length)
    expect(counts.every(count => count === 1)).toBe(true)
  })

  it('has a laser that was dark simply come on at its aim, with no blanking gap', () => {
    const blanker = new Cinema2AfterhoursBeamBlanker()
    blanker.apply([beam('a', [0, 2, 10])], FRAME)
    expect(blanker.apply([], FRAME)).toHaveLength(0)
    expect(blanker.apply([beam('a', [9, 2, 10])], FRAME)).toHaveLength(1)
  })

  it('restarts the trip when told to move again mid-travel, keeps beams of one laser apart, holds when time stands still, and resets', () => {
    const blanker = new Cinema2AfterhoursBeamBlanker()
    blanker.apply([beam('a', [0, 2, 10]), beam('a', [4, 2, 10])], FRAME)
    // Only the second beam of the fan moves: the first stays lit.
    const moved = blanker.apply([beam('a', [0, 2, 10]), beam('a', [12, 2, 10])], FRAME)
    expect(moved.map(lit => lit.targetWorld[0])).toEqual([0])
    // No time passes (paused): it stays dark rather than finishing its trip.
    const paused = blanker.apply([beam('a', [0, 2, 10]), beam('a', [12, 2, 10])], 0)
    expect(paused).toHaveLength(1)
    blanker.reset()
    expect(blanker.apply([beam('a', [0, 2, 10]), beam('a', [12, 2, 10])], FRAME)).toHaveLength(2)
  })
})

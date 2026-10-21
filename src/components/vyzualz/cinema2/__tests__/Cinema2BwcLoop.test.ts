import { describe, expect, it } from 'vitest'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'
import {
  BWC_LOOP,
  BWC_LOOP_HOOD_S,
  BWC_LOOP_LENGTH,
  BWC_LOOP_LENGTH_A,
  BWC_LOOP_LENGTH_B,
  BWC_LOOP_LENGTH_C,
  BWC_LOOP_PITCH,
  BWC_TURN,
  Cinema2BwcConveyorClock,
  bwcLoopAdvance,
  bwcLoopGlsl,
  bwcLoopItemKind,
  bwcTurnGlsl,
  wrapBwcLoopPhase,
} from '../modules/bwc/Cinema2BwcLoop'

interface FrameOptions {
  bpm?: number | null
  hostSync?: boolean
  paused?: boolean
  trackId?: string | null
  contextGeneration?: number
}

/** A frame `dt` seconds after the last, at transport time `t`. */
function frame(timeSec: number, deltaSec: number, options: FrameOptions = {}): Readonly<Cinema2ModuleFrameReadContext> {
  const bpm = options.bpm === undefined ? 120 : options.bpm
  return {
    elapsedTimeSec: timeSec,
    deltaTimeSec: deltaSec,
    contextGeneration: options.contextGeneration ?? 1,
    audio: { rhythm: { bpm: { available: bpm !== null, value: bpm } } },
    transport: {
      timeSec,
      trackId: options.trackId === undefined ? 'track-1' : options.trackId,
      bpm,
      bpmSync: options.hostSync ?? true,
      animationActive: true,
      paused: options.paused ?? false,
    },
  } as unknown as Readonly<Cinema2ModuleFrameReadContext>
}

/** Runs the clock for `seconds` of playback in 1/60 s frames and returns the metres it moved. */
function run(clock: Cinema2BwcConveyorClock, seconds: number, bpmSync: boolean, speed: number, options: FrameOptions = {}, startSec = 0): number {
  const before = clock.resolve(frame(startSec, 0, options), bpmSync, speed)
  let phase = before
  let travelled = 0
  const steps = Math.round(seconds * 60)
  for (let i = 1; i <= steps; i += 1) {
    const next = clock.resolve(frame(startSec + i / 60, 1 / 60, options), bpmSync, speed)
    let delta = next - phase
    if (delta < -BWC_LOOP_LENGTH / 2) delta += BWC_LOOP_LENGTH
    travelled += delta
    phase = next
  }
  return travelled
}

describe('BWC production line geometry', () => {
  it('is one closed loop of exactly the item count, so spacing is even across the join', () => {
    expect(BWC_LOOP_LENGTH).toBeCloseTo(BWC_LOOP_LENGTH_A + BWC_LOOP_LENGTH_B + BWC_LOOP_LENGTH_C, 9)
    expect(BWC_LOOP_PITCH * BWC_LOOP.count).toBeCloseTo(BWC_LOOP_LENGTH, 9)
    // The pitch stays close to the 1.28 m can spacing the belt was first built around, so cans and creatures read at a familiar density.
    expect(BWC_LOOP_PITCH).toBeGreaterThan(1.2)
    expect(BWC_LOOP_PITCH).toBeLessThan(1.4)
  })

  it('joins the belt, the half-circle turn and the walk end to end', () => {
    expect(BWC_LOOP_LENGTH_A).toBeCloseTo(BWC_LOOP.spawnZ - BWC_TURN.cz, 9)
    expect(BWC_LOOP_LENGTH_B).toBeCloseTo(Math.PI * BWC_TURN.r, 9)
    expect(BWC_LOOP_LENGTH_C).toBeCloseTo(BWC_LOOP.exitZ - BWC_TURN.cz, 9)
    // The turn's radius is half the distance between the belt and walk centre lines, and it is centred between them.
    expect(BWC_TURN.cx - BWC_TURN.r).toBeCloseTo(BWC_LOOP.beltX, 9)
    expect(BWC_TURN.cx + BWC_TURN.r).toBeCloseTo(BWC_LOOP.walkX, 9)
  })

  it('turns cans into creatures at the hood: cans before its centre, creatures after', () => {
    expect(BWC_LOOP_HOOD_S).toBeCloseTo(BWC_LOOP.spawnZ - BWC_LOOP.hoodCenterZ, 9)
    expect(bwcLoopItemKind(0)).toBe('can')
    expect(bwcLoopItemKind(BWC_LOOP_HOOD_S - 0.01)).toBe('can')
    expect(bwcLoopItemKind(BWC_LOOP_HOOD_S + 0.01)).toBe('creature')
    expect(bwcLoopItemKind(BWC_LOOP_LENGTH - 0.01)).toBe('creature')
  })

  it('hands the shader the same numbers', () => {
    const glsl = `${bwcTurnGlsl()}\n${bwcLoopGlsl()}`
    expect(glsl).toContain(`#define TURN_CZ ${BWC_TURN.cz}`)
    expect(glsl).toContain(`const float LOOP_COUNT = ${BWC_LOOP.count}.0;`)
    expect(glsl).toContain(`const float LOOP_PITCH = ${Number(BWC_LOOP_PITCH.toFixed(6))};`)
    expect(glsl).toContain('const float LOOP_ENTER_CLIP = -2.73;')
    expect(glsl).toContain('const float LOOP_EXIT_CLIP = -4.37;')
  })
})

describe('BWC production line visibility at its ends', () => {
  // The preset camera, as the shader builds it.
  const camera = [4.55, 3.18, 8.85] as const
  const target = [-0.48, 2.22, -3.05] as const
  const focal = 2.22
  const sub = (a: readonly number[], b: readonly number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
  const unit = (a: readonly number[]) => { const l = Math.hypot(a[0]!, a[1]!, a[2]!); return [a[0]! / l, a[1]! / l, a[2]! / l] }
  const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]
  const forward = unit(sub(target, camera))
  const right = unit(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)

  /** Whether any sampled point of an upright box is inside the frame for a frame `aspect` wide. */
  function anyPointInFrame(center: readonly number[], half: readonly number[], yRange: readonly [number, number], aspect: number): boolean {
    for (let i = 0; i <= 4; i += 1) for (let j = 0; j <= 4; j += 1) for (let k = 0; k <= 4; k += 1) {
      const point = [center[0]! + half[0]! * (i / 2 - 1), yRange[0] + (yRange[1] - yRange[0]) * (j / 4), center[2]! + half[2]! * (k / 2 - 1)]
      const v = sub(point, camera)
      const depth = dot(v, forward)
      if (depth <= 0) continue
      const x = (focal * dot(v, right)) / depth
      const y = (focal * dot(v, up)) / depth
      if (Math.abs(x) <= aspect && Math.abs(y) <= 1) return true
    }
    return false
  }

  const aspects = [1.6, 16 / 9, 2, 21 / 9]
  const can = { half: [0.2, 0, 0.2], y: [BWC_LOOP.beltTopY, BWC_LOOP.beltTopY + 1.0] as const }
  // A creature is a body of revolution about 0.35 m in radius at placement scale (flat arms spread sideways, so 0.75 m across) and 1.51 m tall.
  const creature = { half: [0.75, 0, 0.35], y: [BWC_LOOP.walkTopY, BWC_LOOP.walkTopY + 1.51] as const }

  it.each(aspects)('keeps a can out of frame where it spawns on the belt, at aspect %s', aspect => {
    expect(anyPointInFrame([BWC_LOOP.beltX, 0, BWC_LOOP.spawnZ], can.half, can.y, aspect)).toBe(false)
  })

  it.each(aspects)('keeps a creature out of frame where it leaves the walk, at aspect %s', aspect => {
    expect(anyPointInFrame([BWC_LOOP.walkX, 0, BWC_LOOP.exitZ], creature.half, creature.y, aspect)).toBe(false)
  })

  it('does show items a little way in from either end (the checks above are not vacuous)', () => {
    expect(anyPointInFrame([BWC_LOOP.beltX, 0, BWC_LOOP.spawnZ - 4 * BWC_LOOP_PITCH], can.half, can.y, 16 / 9)).toBe(true)
    expect(anyPointInFrame([BWC_LOOP.walkX, 0, BWC_LOOP.exitZ - 2 * BWC_LOOP_PITCH], creature.half, creature.y, 16 / 9)).toBe(true)
  })
})

describe('BWC conveyor clock', () => {
  it('moves one slot every two beats with BPM Sync on, at any analysed tempo', () => {
    // 120 BPM: two beats are one second, so one slot (a pitch) per second.
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: 120 })).toBeCloseTo(4 * BWC_LOOP_PITCH, 1)
    // 60 BPM: two beats are two seconds, so half the rate. 180 BPM: one and a half times.
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: 60 })).toBeCloseTo(2 * BWC_LOOP_PITCH, 1)
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: 180 })).toBeCloseTo(6 * BWC_LOOP_PITCH, 1)
  })

  it('free-runs at the 120 BPM rate with BPM Sync off, whatever the tempo', () => {
    const slow = run(new Cinema2BwcConveyorClock(), 4, false, 1, { bpm: 60 })
    const fast = run(new Cinema2BwcConveyorClock(), 4, false, 1, { bpm: 180 })
    expect(slow).toBeCloseTo(4 * BWC_LOOP_PITCH, 1)
    expect(fast).toBeCloseTo(slow, 6)
  })

  it('makes a perceptibly different line between Sync ON and Sync OFF at a non-reference tempo', () => {
    const on = run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: 150 })
    const off = run(new Cinema2BwcConveyorClock(), 4, false, 1, { bpm: 150 })
    expect(on / off).toBeCloseTo(1.25, 1)
  })

  it('does not sync when the Audio Dock Sync is off, so the two toggles never fight', () => {
    const hostOff = run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: 60, hostSync: false })
    expect(hostOff).toBeCloseTo(4 * BWC_LOOP_PITCH, 1)
  })

  it('falls back to the free-run rate when no tempo is known', () => {
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 1, { bpm: null })).toBeCloseTo(4 * BWC_LOOP_PITCH, 1)
  })

  it('scales with Conveyor Speed, and stops at 0', () => {
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 0.5, { bpm: 120 })).toBeCloseTo(2 * BWC_LOOP_PITCH, 1)
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 2, { bpm: 120 })).toBeCloseTo(8 * BWC_LOOP_PITCH, 1)
    expect(run(new Cinema2BwcConveyorClock(), 4, true, 0, { bpm: 120 })).toBe(0)
  })

  it('changes only the rate when the speed or BPM Sync changes, never the position', () => {
    const clock = new Cinema2BwcConveyorClock()
    let phase = clock.resolve(frame(0, 0, { bpm: 150 }), true, 1)
    for (let i = 1; i <= 60; i += 1) phase = clock.resolve(frame(i / 60, 1 / 60, { bpm: 150 }), true, 1)
    const beforeToggle = phase
    const afterSpeed = clock.resolve(frame(61 / 60, 1 / 60, { bpm: 150 }), true, 2)
    expect(afterSpeed - beforeToggle).toBeCloseTo(bwcLoopAdvance(1 / 60 * 1.25, 2), 6)
    const afterSync = clock.resolve(frame(62 / 60, 1 / 60, { bpm: 150 }), false, 2)
    expect(afterSync - afterSpeed).toBeCloseTo(bwcLoopAdvance(1 / 60, 2), 6)
  })

  it('holds still while paused and resumes from the same place', () => {
    const clock = new Cinema2BwcConveyorClock()
    clock.resolve(frame(0, 0), true, 1)
    const moving = clock.resolve(frame(0.5, 0.5), true, 1)
    const paused = clock.resolve(frame(1, 0.5, { paused: true }), true, 1)
    expect(paused).toBeCloseTo(moving, 9)
    expect(clock.resolve(frame(1.5, 0.5), true, 1)).toBeGreaterThan(paused)
  })

  it('restarts at zero on a track change, a seek back, and re-entry', () => {
    const clock = new Cinema2BwcConveyorClock()
    clock.resolve(frame(0, 0), true, 1)
    expect(clock.resolve(frame(3, 3), true, 1)).toBeGreaterThan(0)
    expect(clock.resolve(frame(3.1, 0.1, { trackId: 'track-2' }), true, 1)).toBe(0)
    clock.resolve(frame(5, 1.9, { trackId: 'track-2' }), true, 1)
    expect(clock.resolve(frame(1, 0, { trackId: 'track-2' }), true, 1)).toBe(0)
    clock.resolve(frame(2, 1, { trackId: 'track-2' }), true, 1)
    clock.reset()
    expect(clock.resolve(frame(10, 0, { trackId: 'track-2' }), true, 1)).toBe(0)
  })

  it('wraps the phase to the loop length without a jump in spacing', () => {
    expect(wrapBwcLoopPhase(BWC_LOOP_LENGTH + 0.25)).toBeCloseTo(0.25, 9)
    expect(wrapBwcLoopPhase(-0.25)).toBeCloseTo(BWC_LOOP_LENGTH - 0.25, 9)
    const clock = new Cinema2BwcConveyorClock()
    clock.resolve(frame(0, 0), true, 2)
    let max = 0
    let phase = 0
    for (let i = 1; i <= 60 * 60; i += 1) {
      phase = clock.resolve(frame(i / 60, 1 / 60), true, 2)
      max = Math.max(max, phase)
    }
    expect(max).toBeLessThan(BWC_LOOP_LENGTH)
  })
})

import { describe, expect, it } from 'vitest'
import { AFTERHOURS_DEFAULTS, AFTERHOURS_PATTERN_CHANGES, type AfterhoursPatternChange } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import {
  AFTERHOURS_MAX_BEAMS,
  generateAfterhoursBeams,
  isAfterhoursViewportExit,
  type AfterhoursBeamGenerationSettings,
} from './AfterhoursBeamGeometry'
import { AfterhoursPatternDirector, blendAfterhoursBeamFrames } from './AfterhoursPatternDirector'

type ScheduleClock = 'bar' | 'bar4' | 'bar8' | 'phrase'

function directorFrame(input: {
  frameIndex?: number
  deltaTimeSec?: number
  playing?: boolean
  timingDiscontinuity?: boolean
  clock?: ScheduleClock
  clockEventId?: string
  barPhase?: number
  drop?: boolean
  dropEventId?: string
  hasCanonical?: boolean
  bpm?: number
} = {}): CinematicFrameContext {
  const frameIndex = input.frameIndex ?? 0
  const clockEntry = (name: ScheduleClock) => {
    const isTarget = input.clock === name
    return {
      available: true,
      spanBeats: name === 'bar' ? 4 : name === 'bar4' ? 16 : 32,
      index: isTarget ? frameIndex : 0,
      phase: name === 'bar' ? (input.barPhase ?? 0) : 0,
      hit: isTarget,
      eventId: isTarget ? (input.clockEventId ?? `${name}-${frameIndex}`) : null,
    }
  }
  const frame: Record<string, unknown> = {
    frameIndex,
    deltaTimeSec: input.deltaTimeSec ?? 1 / 60,
    transportTimeSec: frameIndex / 60,
    timingDiscontinuity: input.timingDiscontinuity ?? false,
    isPlaying: input.playing ?? true,
    beat: { hit: false, downbeat: false, barIndex: -1, barProgress: 0, bpm: input.bpm ?? 0 },
    musicalAudio: { isPlaying: input.playing ?? true, values: { overallEnergy: 0.4 } },
  }
  if (input.hasCanonical !== false) {
    frame.canonicalMusic = {
      impulses: {
        beat: { active: false, eventId: null },
        downbeat: { active: false, eventId: null },
        kick: { active: false, eventId: null },
        snare: { active: false, eventId: null },
        transient: { active: false, eventId: null },
        sectionStart: { active: false, eventId: null },
        dropStart: { active: input.drop ?? false, eventId: input.drop ? (input.dropEventId ?? `drop-${frameIndex}`) : null },
      },
      clocks: {
        // The director only schedules against bar/bar4/bar8/phrase + dropStart.
        beat: { available: true, spanBeats: 1, index: 0, phase: 0, hit: false, eventId: null },
        beat2: { available: true, spanBeats: 2, index: 0, phase: 0, hit: false, eventId: null },
        beat4: { available: true, spanBeats: 4, index: 0, phase: 0, hit: false, eventId: null },
        bar: clockEntry('bar'),
        bar4: clockEntry('bar4'),
        bar8: clockEntry('bar8'),
        phrase: clockEntry('phrase'),
      },
      section: { id: 'section-a', type: 'verse', progress: 0.4 },
    }
  }
  return frame as unknown as CinematicFrameContext
}

const cfg = (patternChange: AfterhoursPatternChange, blackoutAmount = 0, bpmSync = false) => ({ pattern: AFTERHOURS_DEFAULTS.pattern, patternChange, blackoutAmount, bpmSync })

const BEAM_BASE: AfterhoursBeamGenerationSettings = {
  pattern: 'fan',
  symmetry: true,
  sideLasers: false,
  topLasers: false,
  beamCount: 8,
  spread: 0.65,
  accentMix: 0.25,
}

describe('Afterhours Stage 5 — Pattern Change scheduler', () => {
  it('covers exactly the six MVP cadence options and defaults to Off', () => {
    expect(AFTERHOURS_PATTERN_CHANGES).toEqual(['off', 'bar', 'bar4', 'bar8', 'phrase', 'drop'])
    expect(AFTERHOURS_DEFAULTS.patternChange).toBe('off')
  })

  it('normalizes an unknown cadence to Off and never advances', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('sometimes' as AfterhoursPatternChange)
    for (let i = 1; i < 8; i += 1) {
      const state = director.update({ frame: directorFrame({ frameIndex: i, clock: 'bar', clockEventId: `bar-${i}` }), settings: s })
      expect(state.variation).toBe(0)
      expect(state.transition).toBe(1) // never enters a morph
    }
  })

  it('Off consumes nothing even when every boundary fires', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('off')
    director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1', drop: true, dropEventId: 'd1' }), settings: s })
    const state = director.update({ frame: directorFrame({ frameIndex: 2, clock: 'phrase', clockEventId: 'p1' }), settings: s })
    expect(state.variation).toBe(0)
    expect(state.previousVariation).toBe(0)
  })

  it('advances once per boundary for every cadence and changes the topology family', () => {
    for (const [cadence, clock] of [['bar', 'bar'], ['bar4', 'bar4'], ['bar8', 'bar8'], ['phrase', 'phrase']] as const) {
      const director = new AfterhoursPatternDirector()
      const s = cfg(cadence)
      const first = director.update({ frame: directorFrame({ frameIndex: 1, clock, clockEventId: `${clock}-a` }), settings: s })
      expect(first.variation).toBe(1)
      expect(first.previousPattern).toBe('fan')
      expect(first.pattern).toBe('split')
      expect(first.transition).toBe(0) // a boundary just started a morph
      // Same identity on the next frame -> no second advance, morph advancing.
      const held = director.update({ frame: directorFrame({ frameIndex: 2, clock, clockEventId: `${clock}-a` }), settings: s })
      expect(held.variation).toBe(1)
      expect(held.transition).toBeGreaterThan(0)
      // Fresh identity -> next variation.
      const next = director.update({ frame: directorFrame({ frameIndex: 3, clock, clockEventId: `${clock}-b` }), settings: s })
      expect(next.variation).toBe(2)
      expect(next.previousPattern).toBe('split')
      expect(next.pattern).toBe('random')
    }
  })

  it('Drop cadence advances on the canonical drop-start impulse identity', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('drop')
    expect(director.update({ frame: directorFrame({ frameIndex: 1, drop: true, dropEventId: 'd1' }), settings: s }).variation).toBe(1)
    expect(director.update({ frame: directorFrame({ frameIndex: 2, drop: true, dropEventId: 'd1' }), settings: s }).variation).toBe(1)
    expect(director.update({ frame: directorFrame({ frameIndex: 3, drop: true, dropEventId: 'd2' }), settings: s }).variation).toBe(2)
  })

  it('Pattern Change = Drop with no drop events never advances', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('drop')
    for (let i = 1; i < 30; i += 1) {
      director.update({ frame: directorFrame({ frameIndex: i, clock: 'bar', clockEventId: `bar-${i}` }), settings: s })
    }
    expect(director.update({ frame: directorFrame({ frameIndex: 30 }), settings: s }).variation).toBe(0)
  })

  it('does not fabricate a bar counter when the canonical clock is unavailable', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar')
    for (let i = 1; i < 20; i += 1) {
      director.update({ frame: directorFrame({ frameIndex: i, hasCanonical: false }), settings: s })
    }
    expect(director.update({ frame: directorFrame({ frameIndex: 20, hasCanonical: false }), settings: s }).variation).toBe(0)
  })

  it('does not advance while transport is stopped', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar')
    const state = director.update({ frame: directorFrame({ frameIndex: 1, playing: false, clock: 'bar', clockEventId: 'bar-1' }), settings: s })
    expect(state.variation).toBe(0)
    expect(state.transition).toBe(1) // stopped transport never enters a morph
  })
})

describe('Afterhours Stage 5 — deterministic variation sequence', () => {
  it('replays the identical variation sequence from reset for the same canonical input', () => {
    const run = () => {
      const director = new AfterhoursPatternDirector()
      const s = cfg('bar')
      const seq: number[] = []
      for (let i = 1; i < 12; i += 1) {
        const state = director.update({ frame: directorFrame({ frameIndex: i, clock: 'bar', clockEventId: `bar-${i}` }), settings: s })
        seq.push(state.variation)
      }
      return seq
    }
    expect(run()).toEqual(run())
    expect(run()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('keeps the ordinal bounded across a long run', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar')
    let state = director.update({ frame: directorFrame({ frameIndex: 0, clock: 'bar', clockEventId: 'bar-0' }), settings: s })
    for (let i = 1; i < 5000; i += 1) {
      state = director.update({ frame: directorFrame({ frameIndex: i, clock: 'bar', clockEventId: `bar-${i}` }), settings: s })
    }
    expect(Number.isFinite(state.variation)).toBe(true)
    expect(state.variation).toBeGreaterThanOrEqual(0)
    expect(state.variation).toBeLessThan(0x40000000)
  })

  it('switching cadence keeps the current variation but honours the next new-cadence boundary', () => {
    const director = new AfterhoursPatternDirector()
    director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: cfg('bar') })
    const afterSwitch = director.update({ frame: directorFrame({ frameIndex: 2, clock: 'phrase', clockEventId: 'p1' }), settings: cfg('phrase') })
    expect(afterSwitch.variation).toBe(2)
  })
})

describe('Afterhours Stage 5 — transition interpolation', () => {
  it('starts settled, drops to 0 on a boundary, and ramps back to 1 within the bounded interval', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar')
    expect(director.update({ frame: directorFrame({ frameIndex: 0 }), settings: s }).transition).toBe(1)
    const onHit = director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: s })
    expect(onHit.transition).toBe(0)
    expect(onHit.previousVariation).toBe(0)
    expect(onHit.variation).toBe(1)
    let last = 0
    for (let i = 2; i < 60; i += 1) {
      last = director.update({ frame: directorFrame({ frameIndex: i }), settings: s }).transition
      expect(last).toBeGreaterThanOrEqual(0)
      expect(last).toBeLessThanOrEqual(1)
    }
    expect(last).toBe(1)
  })

  it('seek during a morph snaps the transition to settled with no stale previous state', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar')
    director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: s })
    const seeked = director.update({ frame: directorFrame({ frameIndex: 2, timingDiscontinuity: true }), settings: s })
    expect(seeked.transition).toBe(1)
    expect(seeked.previousVariation).toBe(seeked.variation)
  })

  it('BPM Sync ON scales the morph interval to musical time; a faster tempo settles in fewer seconds', () => {
    const settleFrames = (bpmSync: boolean, bpm: number) => {
      const director = new AfterhoursPatternDirector()
      const s = { pattern: AFTERHOURS_DEFAULTS.pattern, patternChange: 'bar' as AfterhoursPatternChange, blackoutAmount: 0, bpmSync }
      director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1', bpm }), settings: s })
      let frames = 0
      for (let i = 2; i < 400; i += 1) {
        frames += 1
        if (director.update({ frame: directorFrame({ frameIndex: i, bpm }), settings: s }).transition >= 1) break
      }
      return frames
    }
    // OFF -> the fixed 0.5 s ramp regardless of tempo.
    expect(settleFrames(false, 120)).toBe(settleFrames(false, 174))
    // ON -> a fast tempo makes MORPH_BEATS elapse sooner, so it settles quicker.
    expect(settleFrames(true, 174)).toBeLessThan(settleFrames(true, 90))
    // Still bounded: an extreme tempo can't collapse or stretch the morph away.
    const fast = settleFrames(true, 300) / 60
    const slow = settleFrames(true, 30) / 60
    expect(fast).toBeGreaterThanOrEqual(0.18 - 1 / 60)
    expect(slow).toBeLessThanOrEqual(1.2 + 1 / 60)
  })

  it('with no tempo available, BPM Sync ON falls back to the fixed wall-clock ramp', () => {
    const withGrid = new AfterhoursPatternDirector()
    const withoutGrid = new AfterhoursPatternDirector()
    const on = { pattern: AFTERHOURS_DEFAULTS.pattern, patternChange: 'bar' as AfterhoursPatternChange, blackoutAmount: 0, bpmSync: true }
    withGrid.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'b1', bpm: 0 }), settings: on })
    withoutGrid.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'b1', bpm: 0 }), settings: { ...on, bpmSync: false } })
    let a = 0
    let b = 0
    for (let i = 2; i < 60; i += 1) {
      a = withGrid.update({ frame: directorFrame({ frameIndex: i, bpm: 0 }), settings: on }).transition
      b = withoutGrid.update({ frame: directorFrame({ frameIndex: i, bpm: 0 }), settings: { ...on, bpmSync: false } }).transition
    }
    expect(a).toBeCloseTo(b, 9)
  })
})

describe('Afterhours Stage 5 — blendAfterhoursBeamFrames', () => {
  const genA = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'fan', beamCount: 8 }, { variation: 0 })
  const genB = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'fan', beamCount: 8 }, { variation: 1 })

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
        // Origin is one of the two frozen source origins, not a lerp of them.
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
    const few = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'fan', beamCount: 4 }, { variation: 0 })
    const many = generateAfterhoursBeams({ ...BEAM_BASE, pattern: 'fan', beamCount: 10 }, { variation: 0 })
    const midIn = blendAfterhoursBeamFrames(few, many, 0.5)
    const midOut = blendAfterhoursBeamFrames(many, few, 0.5)
    // A slot present only in `many` fades in (weight < 1); the same slot retiring fades out.
    expect(midIn[7].active).toBe(true)
    expect(midIn[7].weight).toBeGreaterThan(0)
    expect(midIn[7].weight).toBeLessThan(1)
    expect(midOut[7].weight).toBeGreaterThan(0)
    expect(midOut[7].weight).toBeLessThan(1)
    // Fully inactive slots collapse to zero weight and zeroed geometry.
    expect(midIn[15].active).toBe(false)
    expect(midIn[15].weight).toBe(0)
  })
})

describe('Afterhours Stage 2 — deliberate blackouts', () => {
  it('Blackout Amount 0 produces no blackout even on its canonical cue', () => {
    const director = new AfterhoursPatternDirector()
    const state = director.update({
      frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }),
      settings: cfg('off', 0),
    })
    expect(state.blackout).toBe(0)
  })

  it('maps blackout depth literally and reaches an exact full blackout at 100%', () => {
    const partial = new AfterhoursPatternDirector().update({
      frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }),
      settings: cfg('off', 0.25),
    })
    const full = new AfterhoursPatternDirector().update({
      frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }),
      settings: cfg('off', 1),
    })
    expect(partial.blackout).toBe(0.25)
    expect(full.blackout).toBe(1)
  })

  it('holds briefly and then releases the event-aligned blackout without latching', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('off', 1)
    expect(director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: s }).blackout).toBe(1)
    let last = 1
    for (let i = 2; i < 120; i += 1) {
      last = director.update({ frame: directorFrame({ frameIndex: i }), settings: s }).blackout
    }
    expect(last).toBeLessThan(0.01)
  })

  it('uses Pattern Change cadence when enabled instead of a hard-coded bar-tail dip', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar4', 1)
    const ordinaryBar = director.update({
      frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }),
      settings: s,
    })
    expect(ordinaryBar.blackout).toBe(0)
    const bar4 = director.update({
      frame: directorFrame({ frameIndex: 2, clock: 'bar4', clockEventId: 'bar4-1' }),
      settings: s,
    })
    expect(bar4.blackout).toBe(1)
  })

  it('releases the blackout on seek and stays finite when music is unavailable', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('off', 1)
    director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: s })
    const seeked = director.update({ frame: directorFrame({ frameIndex: 2, timingDiscontinuity: true }), settings: s })
    expect(seeked.blackout).toBe(0)
    const noMusic = director.update({ frame: directorFrame({ frameIndex: 3, hasCanonical: false }), settings: s })
    expect(Number.isFinite(noMusic.blackout)).toBe(true)
    expect(noMusic.blackout).toBe(0)
  })
})

describe('Afterhours Stage 5 — reset', () => {
  it('reset() clears the variation ordinal, the morph, the consumed id, and the blackout', () => {
    const director = new AfterhoursPatternDirector()
    const s = cfg('bar', 0.8)
    for (let i = 1; i < 6; i += 1) {
      director.update({ frame: directorFrame({ frameIndex: i, clock: 'bar', clockEventId: `bar-${i}`, barPhase: 0.99 }), settings: s })
    }
    director.reset()
    const after = director.update({ frame: directorFrame({ frameIndex: 1, clock: 'bar', clockEventId: 'bar-1' }), settings: s })
    expect(after.variation).toBe(1)
    expect(after.previousVariation).toBe(0)
    expect(after.transition).toBe(0)
  })
})

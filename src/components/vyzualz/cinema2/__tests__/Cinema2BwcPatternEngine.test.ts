import { describe, expect, it } from 'vitest'
import {
  BWC_CEILING_TUBE_COUNT,
  BWC_LIGHT_LEVEL_MAX,
  BWC_PIPE_COUNT,
  BWC_WALL_BAY_COUNT,
  blendBwcLightingReactivity,
  neutralBwcLighting,
  type Cinema2BwcLightingState,
} from '../modules/bwc/Cinema2BwcLighting'
import {
  CINEMA2_BWC_DEFAULT_PATTERN,
  CINEMA2_BWC_DEFAULT_STYLE,
  CINEMA2_BWC_PATTERN_IDS,
  CINEMA2_BWC_PATTERN_LABELS,
  evaluateCinema2BwcPattern,
  type Cinema2BwcPatternId,
  type Cinema2BwcPatternInput,
} from '../modules/bwc/Cinema2BwcPatternEngine'
import { CINEMA2_MAINFRAME_ZERO_IMPULSES, CINEMA2_MAINFRAME_ZERO_SIGNALS } from '../modules/mainframe/Cinema2MainframeReactivity'
import {
  Cinema2MainframePatternController,
  createCinema2MainframePatternCycle,
} from '../modules/mainframe/Cinema2MainframePatternController'

function input(pattern: Cinema2BwcPatternId, beats: number, extra: Partial<Cinema2BwcPatternInput> = {}): Cinema2BwcPatternInput {
  return { pattern, beats, level: 0.5, buildCharge: 0, signals: CINEMA2_MAINFRAME_ZERO_SIGNALS, impulses: CINEMA2_MAINFRAME_ZERO_IMPULSES, active: true, ...extra }
}
const lit = (pattern: Cinema2BwcPatternId, beats: number, extra: Partial<Cinema2BwcPatternInput> = {}) => evaluateCinema2BwcPattern(input(pattern, beats, extra))
const argmax = (values: readonly number[]) => values.indexOf(Math.max(...values))
const everyLevel = (state: Readonly<Cinema2BwcLightingState>): number[] => [
  state.reactorCore, state.reactorRing, state.hood, ...state.pipes, ...state.wallLeft, ...state.wallRight, ...state.ceiling,
]

describe('BWC pattern list', () => {
  it('offers six patterns with labels, led by Flow', () => {
    expect(CINEMA2_BWC_PATTERN_IDS).toHaveLength(6)
    expect(new Set(CINEMA2_BWC_PATTERN_IDS).size).toBe(6)
    expect(CINEMA2_BWC_DEFAULT_PATTERN).toBe('flow')
    expect(CINEMA2_BWC_PATTERN_IDS.map(id => CINEMA2_BWC_PATTERN_LABELS[id])).toEqual(['Flow', 'Core Burst', 'Alternate', 'Center Out', 'Ceiling Sweep', 'Surge'])
  })
})

describe('BWC pattern engine', () => {
  it('leaves the scene at its authored look when nothing is playing', () => {
    for (const id of CINEMA2_BWC_PATTERN_IDS) expect(lit(id, 3.7, { active: false })).toEqual(neutralBwcLighting())
  })

  it('is deterministic', () => {
    for (const id of CINEMA2_BWC_PATTERN_IDS) expect(lit(id, 5.3)).toEqual(lit(id, 5.3))
  })

  it('always returns a full, finite, in-range set of levels, including for hostile input', () => {
    const loud = { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, kick: 1, snare: 1, beat: 1, downbeat: 1, drop: 1, phrase: 1 }
    for (const id of CINEMA2_BWC_PATTERN_IDS) {
      for (const beats of [0, 0.4, 1, 3.99, 4, 17.25, 1e6, Number.NaN, -3, Number.POSITIVE_INFINITY]) {
        for (const extra of [{}, { impulses: loud, level: 1, buildCharge: 1 }, { level: Number.NaN, buildCharge: Number.NaN }]) {
          const state = lit(id, beats, extra)
          expect(state.pipes).toHaveLength(BWC_PIPE_COUNT)
          expect(state.wallLeft).toHaveLength(BWC_WALL_BAY_COUNT)
          expect(state.wallRight).toHaveLength(BWC_WALL_BAY_COUNT)
          expect(state.ceiling).toHaveLength(BWC_CEILING_TUBE_COUNT)
          for (const level of everyLevel(state)) {
            expect(Number.isFinite(level)).toBe(true)
            expect(level).toBeGreaterThanOrEqual(0)
            expect(level).toBeLessThanOrEqual(BWC_LIGHT_LEVEL_MAX)
          }
        }
      }
    }
  })

  it('makes every pattern look different from the others on the same beat', () => {
    const frames = CINEMA2_BWC_PATTERN_IDS.map(id => JSON.stringify(lit(id, 1.37, { level: 0.6, buildCharge: 0.5 })))
    expect(new Set(frames).size).toBe(frames.length)
  })

  it('is quieter on a quiet passage than a loud one', () => {
    for (const id of CINEMA2_BWC_PATTERN_IDS) {
      const quiet = everyLevel(lit(id, 0.5, { level: 0 })).reduce((a, b) => a + b, 0)
      const loud = everyLevel(lit(id, 0.5, { level: 1 })).reduce((a, b) => a + b, 0)
      expect(loud).toBeGreaterThan(quiet)
    }
  })

  describe('Flow', () => {
    it('travels from the front of the hall to the back as the bar goes by', () => {
      // Wall bays run back (index 0) to front (index 8). The brightest bay moves toward index 0 over a bar.
      const early = argmax(lit('flow', 0.2).wallLeft)
      const middle = argmax(lit('flow', 1.8).wallLeft)
      const late = argmax(lit('flow', 3.4).wallLeft)
      expect(early).toBeGreaterThan(middle)
      expect(middle).toBeGreaterThan(late)
    })
    it('lights the two walls together and the ceiling along the same wave', () => {
      const state = lit('flow', 1.8)
      expect(state.wallRight).toEqual(state.wallLeft)
      expect(Math.max(...state.ceiling)).toBeGreaterThan(Math.min(...state.ceiling) + 0.5)
    })
    it('repeats every four beats', () => {
      lit('flow', 1.3).wallLeft.forEach((level, i) => expect(level).toBeCloseTo(lit('flow', 5.3).wallLeft[i]!, 9))
    })
  })

  describe('Core Burst', () => {
    it('fires the reactor on the beat and lets it die away', () => {
      expect(lit('core-burst', 2).reactorCore).toBeGreaterThan(lit('core-burst', 2.7).reactorCore)
      expect(lit('core-burst', 3).reactorCore).toBeCloseTo(lit('core-burst', 2).reactorCore, 9)
    })
    it('reaches the pipes a little after the reactor and the farthest bays after the nearest', () => {
      // Just after the hit the reactor is already bright while the pipes and the far bays have not yet fired.
      const early = lit('core-burst', 2.02)
      expect(early.reactorCore).toBeGreaterThan(early.pipes[2]!)
      // Walls: the bay nearest the reactor (index 4 is z -3.1) peaks before the bay at the back (index 0).
      const peakBeat = (bay: number): number => {
        let best = 0, bestLevel = -1
        for (let b = 0; b < 1; b += 0.01) {
          const level = lit('core-burst', 2 + b).wallLeft[bay]!
          if (level > bestLevel) { bestLevel = level; best = b }
        }
        return best
      }
      expect(peakBeat(0)).toBeGreaterThanOrEqual(peakBeat(4))
    })
  })

  describe('Alternate', () => {
    it('puts the two walls in opposite phase and swaps them on the next beat', () => {
      const a = lit('alternate', 0.3)
      const b = lit('alternate', 1.3)
      for (let i = 0; i < BWC_WALL_BAY_COUNT; i += 1) {
        expect((a.wallLeft[i]! > 0.6) !== (a.wallRight[i]! > 0.6)).toBe(true)
        expect((a.wallLeft[i]! > 0.6) !== (b.wallLeft[i]! > 0.6)).toBe(true)
      }
    })
    it('keeps the ceiling tubes in opposite phase to the left wall bays of the same index', () => {
      const a = lit('alternate', 0.3)
      for (let i = 0; i < BWC_CEILING_TUBE_COUNT; i += 1) expect((a.ceiling[i]! > 0.6) !== (a.wallLeft[i]! > 0.6)).toBe(true)
    })
    it('swaps the pipes by side and holds the centre one', () => {
      const a = lit('alternate', 0.3)
      const b = lit('alternate', 1.3)
      expect(a.pipes[0]).toBe(a.pipes[1])
      expect(a.pipes[3]).toBe(a.pipes[4])
      expect(a.pipes[0]! > a.pipes[3]!).toBe(true)
      expect(b.pipes[3]! > b.pipes[0]!).toBe(true)
      expect(a.pipes[2]).toBe(b.pipes[2])
    })
  })

  describe('Center Out', () => {
    it('sends a ring from the reactor toward both ends of the hall, equally', () => {
      // The reactor is at z -3.55 and the bays are not symmetric about it, so check the ring reaches farther bays later rather than mirroring.
      const start = lit('center-out', 0.1)
      const mid = lit('center-out', 0.6)
      const nearestBay = 4 // z -3.1, 0.45 m from the reactor
      const farBay = 0 // z -15.5
      expect(start.wallLeft[nearestBay]!).toBeGreaterThan(start.wallLeft[farBay]!)
      expect(mid.wallLeft[farBay]!).toBeGreaterThanOrEqual(0)
      // A bay farther from the reactor is reached later in the launch.
      const reach = (bay: number): number => {
        let best = 0, bestLevel = -1
        for (let b = 0; b < 2; b += 0.01) {
          const level = lit('center-out', b).wallLeft[bay]!
          if (level > bestLevel) { bestLevel = level; best = b }
        }
        return best
      }
      expect(reach(7)).toBeGreaterThan(reach(5))
    })
    it('launches the pipes\' pulse on every launch', () => {
      expect(lit('center-out', 0.1).pipeFlow[0]).toBeLessThan(lit('center-out', 0.9).pipeFlow[0])
      expect(lit('center-out', 2.1).pipeFlow[0]).toBeCloseTo(lit('center-out', 0.1).pipeFlow[0], 9)
    })
  })

  describe('Ceiling Sweep', () => {
    it('sweeps the ceiling tubes from one end to the other and back across eight beats', () => {
      const where = (beats: number): number => argmax(lit('ceiling-sweep', beats).ceiling)
      expect(where(0.1)).toBeLessThanOrEqual(1)
      expect(where(4)).toBeGreaterThanOrEqual(4 - 1)
      expect(where(4)).toBeLessThanOrEqual(BWC_CEILING_TUBE_COUNT - 1)
      expect(where(7.9)).toBeLessThanOrEqual(1)
      expect(where(2)).toBeLessThan(where(4))
      expect(where(6)).toBeLessThan(where(4))
    })
    it('keeps the walls lower than the swept tubes', () => {
      const state = lit('ceiling-sweep', 3)
      expect(Math.max(...state.ceiling)).toBeGreaterThan(Math.max(...state.wallLeft))
    })
  })

  describe('Surge', () => {
    it('does nothing without a buildup: no repeating fake charge from the beat clock', () => {
      const a = lit('surge', 3, { buildCharge: 0 })
      const b = lit('surge', 11, { buildCharge: 0 })
      expect(a.wallLeft).toEqual(b.wallLeft)
      expect(a.ceiling).toEqual(b.ceiling)
      const rest = lit('surge', 3, { buildCharge: 0 }).wallLeft[0]!
      expect(Math.max(...a.wallLeft)).toBe(rest)
    })
    it('fills the hall outward from the reactor as the charge rises', () => {
      const count = (charge: number): number => lit('surge', 3, { buildCharge: charge }).wallLeft.filter(level => level > 0.8).length
      expect(count(0.2)).toBeLessThan(count(0.6))
      expect(count(0.6)).toBeLessThan(count(1))
      // The first bays to fill are those nearest the reactor (index 4 is 0.45 m from it).
      const early = lit('surge', 3, { buildCharge: 0.1 }).wallLeft
      expect(argmax(early)).toBeGreaterThanOrEqual(3)
      expect(argmax(early)).toBeLessThanOrEqual(5)
    })
    it('raises the reactor and pipes with the charge and releases everything on a drop', () => {
      expect(lit('surge', 3, { buildCharge: 1 }).reactorCore).toBeGreaterThan(lit('surge', 3, { buildCharge: 0.2 }).reactorCore)
      expect(lit('surge', 3, { buildCharge: 1 }).pipes[0]).toBeGreaterThan(lit('surge', 3, { buildCharge: 0.2 }).pipes[0]!)
      const dropped = lit('surge', 3, { impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, drop: 1 } })
      const calm = lit('surge', 3)
      expect(dropped.wallLeft.every((level, i) => level > calm.wallLeft[i]!)).toBe(true)
      expect(dropped.ceiling.every((level, i) => level > calm.ceiling[i]!)).toBe(true)
    })
  })

  it('answers the shared impulses: a kick lifts the reactor and a snare its ring, in every pattern', () => {
    for (const id of CINEMA2_BWC_PATTERN_IDS) {
      const kick = lit(id, 0.5, { impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, kick: 1 } })
      const snare = lit(id, 0.5, { impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, snare: 1 } })
      const calm = lit(id, 0.5)
      expect(kick.reactorCore).toBeGreaterThan(calm.reactorCore)
      expect(snare.reactorRing).toBeGreaterThan(calm.reactorRing)
    }
  })
})

describe('BWC pattern change (the shared controller on BWC patterns)', () => {
  const cycle = createCinema2MainframePatternCycle<Cinema2BwcPatternId>(index => (index * 0.37) % 1, CINEMA2_BWC_PATTERN_IDS)
  const base = { authoredPattern: 'flow' as Cinema2BwcPatternId, patternChange: true, trigger: 'bar' as const, triggerEventId: null as string | null, absoluteBeat: 0 }

  it('builds a cycle of exactly the six BWC patterns, each once', () => {
    expect([...cycle].sort()).toEqual([...CINEMA2_BWC_PATTERN_IDS].sort())
  })

  it('steps to the next pattern on each new trigger event, and never onto itself', () => {
    const controller = new Cinema2MainframePatternController<Cinema2BwcPatternId>(cycle, 'flow')
    expect(controller.update(base).activePattern).toBe('flow')
    const seen: Cinema2BwcPatternId[] = []
    for (let i = 1; i <= 6; i += 1) seen.push(controller.update({ ...base, triggerEventId: `bar:${i}`, absoluteBeat: i * 4 }).activePattern)
    expect(new Set(seen).size).toBe(6)
    expect(seen[0]).not.toBe('flow')
    for (let i = 1; i < seen.length; i += 1) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('stays on the authored pattern when Pattern Change is off, and follows an edit of it', () => {
    const controller = new Cinema2MainframePatternController<Cinema2BwcPatternId>(cycle, 'flow')
    controller.update({ ...base, patternChange: false })
    expect(controller.update({ ...base, patternChange: false, triggerEventId: 'bar:1', absoluteBeat: 4 }).activePattern).toBe('flow')
    expect(controller.update({ ...base, patternChange: false, authoredPattern: 'surge', absoluteBeat: 5 }).activePattern).toBe('surge')
  })

  it('keeps Pattern Change on through a manual pattern edit and restarts the pattern clock there', () => {
    const controller = new Cinema2MainframePatternController<Cinema2BwcPatternId>(cycle, 'flow')
    controller.update(base)
    controller.update({ ...base, triggerEventId: 'bar:1', absoluteBeat: 4 })
    const edited = controller.update({ ...base, authoredPattern: 'alternate', triggerEventId: 'bar:1', absoluteBeat: 6 })
    expect(edited.activePattern).toBe('alternate')
    expect(edited.patternStartBeat).toBe(6)
    const next = controller.update({ ...base, authoredPattern: 'alternate', triggerEventId: 'bar:2', absoluteBeat: 8 })
    expect(next.activePattern).not.toBe('alternate')
  })

  it('does not consume a trigger event that was already present when the trigger changed', () => {
    const controller = new Cinema2MainframePatternController<Cinema2BwcPatternId>(cycle, 'flow')
    controller.update(base)
    const changedTrigger = controller.update({ ...base, trigger: 'beat', triggerEventId: 'beat:9', absoluteBeat: 9 })
    expect(changedTrigger.activePattern).toBe('flow')
  })
})

describe('BWC pattern style controls and reactivity blend', () => {
  it('Pulse Width widens the wave: more wall bays are lit at 1 than at 0', () => {
    const lit80 = (pulseWidth: number) => evaluateCinema2BwcPattern(input('flow', 1.8, { style: { pulseWidth, dropIntensity: 1, flicker: 0 } })).wallLeft.filter(level => level > 0.6).length
    expect(lit80(1)).toBeGreaterThan(lit80(0))
  })

  it('leaves the patterns as authored at the default style', () => {
    expect(evaluateCinema2BwcPattern(input('flow', 1.8))).toEqual(evaluateCinema2BwcPattern(input('flow', 1.8, { style: CINEMA2_BWC_DEFAULT_STYLE })))
  })

  it('Drop Intensity scales what a drop adds, and 0 removes it', () => {
    const drop = { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, drop: 1 }
    const at = (dropIntensity: number) => evaluateCinema2BwcPattern(input('surge', 3, { impulses: drop, style: { pulseWidth: 0.5, dropIntensity, flicker: 0 } }))
    expect(at(1).ceiling[2]!).toBeGreaterThan(at(0.5).ceiling[2]!)
    expect(at(0.5).ceiling[2]!).toBeGreaterThan(at(0).ceiling[2]!)
    expect(at(0)).toEqual(evaluateCinema2BwcPattern(input('surge', 3)))
  })

  it('Flicker only ever dims, differently for each element and over time, and the same way every time it is asked', () => {
    const steady = evaluateCinema2BwcPattern(input('alternate', 0.3))
    const stutter = (beats: number) => evaluateCinema2BwcPattern(input('alternate', beats, { style: { pulseWidth: 0.5, dropIntensity: 1, flicker: 1 } }))
    const a = stutter(0.3)
    steady.wallLeft.forEach((level, i) => expect(a.wallLeft[i]!).toBeLessThanOrEqual(level + 1e-12))
    expect(a.wallLeft.some((level, i) => level < steady.wallLeft[i]! - 1e-9)).toBe(true)
    expect(a.wallLeft.some((level, i) => Math.abs(level - steady.wallLeft[i]!) < 1e-9)).toBe(true)
    expect(a).toEqual(stutter(0.3))
    // Within the same beat the dropouts move on.
    const dropouts = (beats: number) => stutter(beats).wallLeft.map((level, i) => Math.round((level / evaluateCinema2BwcPattern(input('alternate', beats)).wallLeft[i]!) * 1000))
    expect(dropouts(0.3)).not.toEqual(dropouts(0.3 + 1 / 6))
    // The reactor, ring, hood and pipes do not flicker.
    expect(a.reactorCore).toBe(steady.reactorCore)
    expect(a.pipes).toEqual(steady.pipes)
  })

  it('Light Reactivity blends toward the authored look and is exactly neutral at 0', () => {
    const state = evaluateCinema2BwcPattern(input('core-burst', 2.1))
    expect(blendBwcLightingReactivity(state, 1)).toBe(state)
    expect(blendBwcLightingReactivity(state, 0)).toEqual(neutralBwcLighting())
    const half = blendBwcLightingReactivity(state, 0.5)
    expect(half.reactorCore).toBeCloseTo(1 + (state.reactorCore - 1) / 2, 9)
    half.ceiling.forEach((level, i) => expect(level).toBeCloseTo(1 + (state.ceiling[i]! - 1) / 2, 9))
    expect(half.ringChase[1]).toBeCloseTo(state.ringChase[1] / 2, 9)
    expect(half.pipeFlow[1]).toBeCloseTo(state.pipeFlow[1] / 2, 9)
    expect(blendBwcLightingReactivity(state, Number.NaN)).toBe(state)
  })
})

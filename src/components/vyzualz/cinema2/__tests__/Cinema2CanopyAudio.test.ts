import { describe, expect, it } from 'vitest'
import { CANOPY_PATTERN_IDS, type CanopyPatternId } from '../modules/canopy/Cinema2CanopyDomain'
import type { CanopyFrameOptions } from './Cinema2CanopyTestUtils'
import { canopyCue, canopyFrame, setupCanopy } from './Cinema2CanopyTestUtils'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../presets/Cinema2AfterhoursPreset'

const STEP = 1 / 60
const TRIGGERS = CINEMA2_AFTERHOURS_TRIGGER_OPTIONS.map(option => option.value)

/** The frame on which `trigger` has a new qualifying event with this id, and the cue the choreography runtime would deliver with it. */
function triggerEvent(trigger: string, id: string, time: number): { options: Partial<CanopyFrameOptions>; cues: { kind: string; eventId: string }[] } {
  switch (trigger) {
    case 'beat': return { options: { events: [{ kind: 'beat', id }] }, cues: [canopyCue('beat', id)] }
    case 'kick': return { options: { events: [{ kind: 'kick', id }] }, cues: [canopyCue('kick', id)] }
    case 'snare': return { options: { events: [{ kind: 'snare', id }] }, cues: [canopyCue('snare', id)] }
    case 'downbeat': return { options: { events: [{ kind: 'downbeat', id }] }, cues: [canopyCue('downbeat', id)] }
    case 'beat2': case 'beat4': return { options: { events: [{ kind: 'beat', id }], beatIndex: 8 }, cues: [canopyCue('beat', id)] }
    case 'bar': return { options: { fourBeat: id }, cues: [canopyCue('fourBeat', id)] }
    case 'bar4': case 'bar8': return { options: { fourBeat: id, barIndex: 8 }, cues: [canopyCue('fourBeat', id)] }
    case 'phrase': return { options: { phrase: id }, cues: [canopyCue('phrase', id)] }
    default: return { options: { dropMoment: id }, cues: [canopyCue('drop', id)] }
  }
}

/** Plays `seconds` of ordinary frames (no events) starting at `from`; returns the time reached. */
function play(h: ReturnType<typeof setupCanopy>, from: number, seconds: number, options: Partial<CanopyFrameOptions> = {}): number {
  let t = from
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) { t += STEP; h.update(canopyFrame({ time: t, ...options })) }
  return t
}

describe('CANOPY Pattern Change and Trigger', () => {
  it('never advances with Pattern Change off, whatever the trigger and however many events arrive', () => {
    for (const trigger of TRIGGERS) {
      const h = setupCanopy({ pattern: 'crown', patternChange: false, trigger })
      let t = play(h, 0, 0.5)
      for (let n = 0; n < 6; n += 1) {
        const event = triggerEvent(trigger, `${trigger}-${n}`, t)
        t += 0.5
        h.update(canopyFrame({ time: t, ...event.options }), event.cues)
        t = play(h, t, 0.1)
      }
      expect(h.inspect().activePattern, trigger).toBe('crown')
    }
  })

  it('advances exactly once for a new qualifying event on each of the 11 triggers, and not again for the same identity', () => {
    for (const trigger of TRIGGERS) {
      const h = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger })
      let t = play(h, 0, 0.5)
      expect(h.inspect().activePattern, trigger).toBe('waterfall')
      const first = triggerEvent(trigger, `${trigger}-A`, t)
      t += STEP
      h.update(canopyFrame({ time: t, ...first.options }), first.cues)
      const afterFirst = h.inspect().activePattern
      expect(afterFirst, `${trigger} advanced`).not.toBe('waterfall')
      // The same identity delivered again on the next frames never advances a second time.
      for (let n = 0; n < 5; n += 1) { t += STEP; h.update(canopyFrame({ time: t, ...first.options }), first.cues) }
      expect(h.inspect().activePattern, `${trigger} duplicate`).toBe(afterFirst)
      // A new identity advances again, and never to the pattern just shown.
      const second = triggerEvent(trigger, `${trigger}-B`, t)
      // Drops closer than 1.25 s are one impact to the shared drop coordinator, so the second event comes a little later.
      t += 2
      h.update(canopyFrame({ time: t, ...second.options }), second.cues)
      expect(h.inspect().activePattern, `${trigger} second`).not.toBe(afterFirst)
    }
  })

  it('does not advance on a beat that does not qualify for the selected trigger', () => {
    for (const [trigger, options] of [['beat2', { beatIndex: 7 }], ['beat4', { beatIndex: 6 }], ['bar4', { barIndex: 5 }], ['bar8', { barIndex: 4 }]] as const) {
      const h = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger })
      const t = play(h, 0, 0.5)
      const event = triggerEvent(trigger, 'off-beat', t)
      h.update(canopyFrame({ time: t + STEP, ...event.options, ...options }), event.cues)
      expect(h.inspect().activePattern, trigger).toBe('waterfall')
    }
  })

  it('never repeats the pattern it just showed and visits all six in turn', () => {
    const h = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    let t = play(h, 0, 0.3)
    const seen: CanopyPatternId[] = ['waterfall']
    for (let n = 0; n < 12; n += 1) {
      t += 0.25
      h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: `kick-${n}` }] }), [canopyCue('kick', `kick-${n}`)])
      seen.push(h.inspect().activePattern)
      t = play(h, t, 0.05)
    }
    seen.slice(1).forEach((pattern, index) => expect(pattern).not.toBe(seen[index]))
    expect(new Set(seen)).toEqual(new Set(CANOPY_PATTERN_IDS))
  })

  it('shows a manually chosen Pattern at once, keeps Pattern Change on, and is not stolen by the event already present', () => {
    const h = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    let t = play(h, 0, 0.5)
    // A kick is live on the very frame the user picks Crown.
    h.values.set('pattern', 'crown')
    t += STEP
    h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'live-kick' }] }), [canopyCue('kick', 'live-kick')])
    expect(h.inspect().activePattern).toBe('crown')
    expect(h.values.get('patternChange')).toBe(true)
    for (let n = 0; n < 5; n += 1) { t += STEP; h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'live-kick' }] }), [canopyCue('kick', 'live-kick')]) }
    expect(h.inspect().activePattern).toBe('crown')
    // The next fresh kick advances from the manual choice.
    t += 0.4
    h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'next-kick' }] }), [canopyCue('kick', 'next-kick')])
    expect(h.inspect().activePattern).not.toBe('crown')
  })

  it('shows a manually chosen Pattern at once with Pattern Change off, too', () => {
    const h = setupCanopy({ pattern: 'waterfall', patternChange: false })
    play(h, 0, 0.3)
    for (const pattern of CANOPY_PATTERN_IDS) {
      h.values.set('pattern', pattern)
      h.update(canopyFrame({ time: 0.5 }))
      expect(h.inspect().activePattern).toBe(pattern)
      expect(h.inspect().authoredPattern).toBe(pattern)
    }
  })

  it('does not advance when Pattern Change is switched on or the Trigger is edited while an event is live', () => {
    const h = setupCanopy({ pattern: 'waterfall', patternChange: false, trigger: 'kick' })
    let t = play(h, 0, 0.5)
    const live = { events: [{ kind: 'kick' as const, id: 'held-kick' }, { kind: 'snare' as const, id: 'held-snare' }] }
    t += STEP; h.update(canopyFrame({ time: t, ...live }), [canopyCue('kick', 'held-kick'), canopyCue('snare', 'held-snare')])
    h.values.set('patternChange', true)
    t += STEP; h.update(canopyFrame({ time: t, ...live }))
    expect(h.inspect().activePattern).toBe('waterfall')
    h.values.set('trigger', 'snare')
    t += STEP; h.update(canopyFrame({ time: t, ...live }))
    expect(h.inspect().activePattern).toBe('waterfall')
  })

  it('keeps the authored Pattern, Pattern Change and Trigger values untouched while it advances, with or without Auto Performance', () => {
    for (const autoPerformance of [false, true]) {
      const h = setupCanopy({ pattern: 'checkerLift', patternChange: true, trigger: 'kick', autoPerformance })
      let t = play(h, 0, 0.3)
      for (let n = 0; n < 4; n += 1) { t += 0.3; h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: `k${n}` }], build: 0.9 }), [canopyCue('kick', `k${n}`)]) }
      expect(h.inspect().activePattern).not.toBe('checkerLift')
      expect(h.values.get('pattern')).toBe('checkerLift')
      expect(h.values.get('patternChange')).toBe(true)
      expect(h.values.get('trigger')).toBe('kick')
    }
  })

  it('makes no pattern override under Auto Performance: a build and a drop leave the base pattern on stage', () => {
    const h = setupCanopy({ pattern: 'crown', patternChange: false, autoPerformance: true })
    let t = play(h, 0, 0.3, { build: 0.9 })
    t += STEP
    h.update(canopyFrame({ time: t, build: 1, dropMoment: 'big-drop' }), [canopyCue('drop', 'big-drop')])
    expect(h.inspect().activePattern).toBe('crown')
  })
})

describe('CANOPY transport, resets and timing', () => {
  it('does not advance, and does not catch up, across a pause and a resume', () => {
    const h = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    let t = play(h, 0, 0.5)
    for (let n = 0; n < 10; n += 1) { t += STEP; h.update(canopyFrame({ time: t, paused: true, events: [{ kind: 'kick', id: `paused-${n}` }] }), [canopyCue('kick', `paused-${n}`)]) }
    expect(h.inspect().activePattern).toBe('waterfall')
    t += STEP; h.update(canopyFrame({ time: t, events: [] }))
    expect(h.inspect().activePattern).toBe('waterfall')
  })

  it('freezes the pattern phase while paused and resumes from the same phase', () => {
    const h = setupCanopy({ pattern: 'crosswave' })
    let t = play(h, 0, 1)
    const before = h.inspect().drive!.phase
    for (let n = 0; n < 30; n += 1) { t += STEP; h.update(canopyFrame({ time: t, paused: true })) }
    expect(h.inspect().drive!.phase).toBeCloseTo(before, 6)
    t += STEP; h.update(canopyFrame({ time: t }))
    expect(Math.abs(h.inspect().drive!.phase - before)).toBeLessThan(0.1)
  })

  it('differs between BPM Sync on and off at a non-reference tempo, and both stay finite and monotonic', () => {
    const run = (bpmSync: boolean) => {
      const h = setupCanopy({ pattern: 'crosswave', bpmSync })
      const phases: number[] = []
      let t = 0
      for (let i = 0; i < 480; i += 1) { t += STEP; h.update(canopyFrame({ time: t, bpm: 148 })); phases.push(h.inspect().drive!.phase) }
      return phases
    }
    const on = run(true)
    const off = run(false)
    // 8 seconds at 148 BPM is about 19.7 beats on the grid, but exactly 16 beats at the 120 BPM free-run rate.
    expect(on[on.length - 1]!).toBeGreaterThan(18)
    expect(off[off.length - 1]!).toBeGreaterThan(15)
    expect(off[off.length - 1]!).toBeLessThan(17)
    expect(on[on.length - 1]! - off[off.length - 1]!).toBeGreaterThan(2)
    for (const phases of [on, off]) phases.forEach((phase, index) => { expect(Number.isFinite(phase)).toBe(true); if (index) expect(phase).toBeGreaterThanOrEqual(phases[index - 1]! - 1e-6) })
  })

  it('keeps kick and snare hits live with BPM Sync off', () => {
    const h = setupCanopy({ pattern: 'checkerLift', bpmSync: false, motionAmount: 1 })
    let t = play(h, 0, 0.5)
    const calm = h.inspect().hang
    t += STEP
    h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'k' }] }), [canopyCue('kick', 'k')])
    const hit = h.inspect().hang
    expect(hit.some((value, index) => value < calm[index]! - 0.01)).toBe(true)
  })

  it('switches BPM Sync without a jump in the phase', () => {
    const h = setupCanopy({ pattern: 'crosswave', bpmSync: true })
    let t = play(h, 0, 2, { bpm: 148 })
    const before = h.inspect().drive!.phase
    h.values.set('bpmSync', false)
    t += STEP; h.update(canopyFrame({ time: t, bpm: 148 }))
    const after = h.inspect().drive!.phase
    expect(Math.abs(after - before)).toBeLessThan(0.3)
  })

  it('scales the phase by Motion Speed, and does not jump when the speed is edited', () => {
    const slow = setupCanopy({ pattern: 'crosswave', motionSpeed: 0.5 }); play(slow, 0, 4)
    const fast = setupCanopy({ pattern: 'crosswave', motionSpeed: 2 }); play(fast, 0, 4)
    expect(fast.inspect().drive!.phase).toBeGreaterThan(slow.inspect().drive!.phase * 3.5)
    const h = setupCanopy({ pattern: 'crosswave', motionSpeed: 1 })
    const t = play(h, 0, 2)
    const before = h.inspect().drive!.phase
    h.values.set('motionSpeed', 2)
    h.update(canopyFrame({ time: t + STEP }))
    expect(Math.abs(h.inspect().drive!.phase - before)).toBeLessThan(0.1)
  })

  it('resets the runtime selection on a track change, a seek back and a context change, without advancing on the reset frame', () => {
    const advance = (h: ReturnType<typeof setupCanopy>) => {
      let t = play(h, 0, 0.3)
      t += 0.3; h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'adv' }] }), [canopyCue('kick', 'adv')])
      expect(h.inspect().activePattern).not.toBe('waterfall')
      return t
    }
    const h1 = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    const t1 = advance(h1)
    h1.update(canopyFrame({ time: t1 + STEP, trackId: 'another-track', events: [{ kind: 'kick', id: 'new-track-kick' }] }), [canopyCue('kick', 'new-track-kick')])
    expect(h1.inspect().activePattern).toBe('waterfall')
    const h2 = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    const t2 = advance(h2)
    h2.update(canopyFrame({ time: Math.max(0, t2 - 3), events: [{ kind: 'kick', id: 'seek-kick' }] }), [canopyCue('kick', 'seek-kick')])
    expect(h2.inspect().activePattern).toBe('waterfall')
    const h3 = setupCanopy({ pattern: 'waterfall', patternChange: true, trigger: 'kick' })
    const t3 = advance(h3)
    h3.update(canopyFrame({ time: t3 + STEP, generation: 2, events: [{ kind: 'kick', id: 'ctx-kick' }] }), [canopyCue('kick', 'ctx-kick')])
    expect(h3.inspect().activePattern).toBe('waterfall')
  })

  it('clears the hit envelopes on a seek back, so no stale kick or drop lingers', () => {
    const h = setupCanopy({ pattern: 'checkerLift', motionAmount: 1 })
    let t = play(h, 0, 5)
    t += STEP; h.update(canopyFrame({ time: t, events: [{ kind: 'kick', id: 'k' }], dropMoment: 'd' }), [canopyCue('kick', 'k'), canopyCue('drop', 'd')])
    expect(h.inspect().drive!.impulses.kick).toBeGreaterThan(0.3)
    h.update(canopyFrame({ time: 1 }))
    expect(h.inspect().drive!.impulses.kick).toBe(0)
    expect(h.inspect().drive!.impulses.drop).toBe(0)
  })

  it('stands in the formation\'s rest shape with no track, reacts to nothing, and invents no hits', () => {
    const h = setupCanopy({ pattern: 'crosswave', motionAmount: 1 })
    let t = 0
    for (let i = 0; i < 120; i += 1) { t += STEP; h.update(canopyFrame({ time: t, stopped: true })) }
    const first = h.inspect()
    expect(first.drive!.musicActive).toBe(false)
    expect(first.drive!.phase).toBe(0)
    expect(Object.values(first.drive!.impulses).every(value => value === 0)).toBe(true)
    for (let i = 0; i < 120; i += 1) { t += STEP; h.update(canopyFrame({ time: t, stopped: true })) }
    const second = h.inspect()
    expect(second.hang.every((value, index) => value === first.hang[index])).toBe(true)
    expect(Math.max(...Array.from(second.emission))).toBeLessThan(0.5)
    // Choosing another Pattern still changes the rod heights at once, so a formation can be judged without music.
    h.values.set('pattern', 'crown')
    h.update(canopyFrame({ time: t + STEP, stopped: true }))
    for (let i = 0; i < 60; i += 1) { t += STEP; h.update(canopyFrame({ time: t, stopped: true })) }
    expect(h.inspect().hang.some((value, index) => Math.abs(value - first.hang[index]!) > 0.05)).toBe(true)
  })

  it('crossfades a changed pattern rather than cutting to it', () => {
    const h = setupCanopy({ pattern: 'waterfall', motionAmount: 1 })
    let t = play(h, 0, 1)
    const before = h.inspect().hang
    h.values.set('pattern', 'downpour')
    t += STEP; h.update(canopyFrame({ time: t }))
    const first = h.inspect()
    expect(first.drive!.previous?.pattern).toBe('waterfall')
    expect(first.drive!.blend).toBeLessThan(0.2)
    expect(Math.max(...Array.from(first.hang).map((value, index) => Math.abs(value - before[index]!)))).toBeLessThan(0.1)
    t = play(h, t, 0.6)
    expect(h.inspect().drive!.previous).toBeNull()
    expect(h.inspect().drive!.blend).toBe(1)
  })
})

describe('CANOPY musical response', () => {
  const baseline = (overrides = {}) => { const h = setupCanopy({ pattern: 'checkerLift', motionAmount: 1, ...overrides }); const t = play(h, 0, 0.5); return { h, t, calm: h.inspect() } }

  it('moves different rods for a kick, a snare and a downbeat, and lights the ones that moved', () => {
    const rose = (kind: 'kick' | 'snare' | 'downbeat') => {
      const { h, t, calm } = baseline()
      h.update(canopyFrame({ time: t + STEP, events: [{ kind, id: kind }] }), [canopyCue(kind, kind)])
      const hit = h.inspect()
      return { moved: Array.from(hit.hang).flatMap((value, index) => (value < calm.hang[index]! - 1e-4 ? [index] : [])), lit: Array.from(hit.emission).flatMap((value, index) => (value > calm.emission[index]! + 1e-4 ? [index] : [])) }
    }
    const kick = rose('kick'); const snare = rose('snare'); const downbeat = rose('downbeat')
    expect(kick.moved.length).toBeGreaterThan(8); expect(snare.moved.length).toBeGreaterThan(8); expect(downbeat.moved.length).toBeGreaterThan(8)
    expect(kick.moved.filter(index => snare.moved.includes(index))).toEqual([])
    expect(downbeat.moved).not.toEqual(kick.moved)
    for (const hit of [kick, snare, downbeat]) expect(hit.lit.length).toBeGreaterThanOrEqual(hit.moved.length)
  })

  it('moves the rods, not only their light, for bass and for sub', () => {
    const { h, t, calm } = baseline()
    h.update(canopyFrame({ time: t + STEP, bands: { bass: 1, sub: 1 }, energy: 0.9 }))
    const loud = h.inspect()
    expect(Math.max(...Array.from(loud.hang).map((value, index) => Math.abs(value - calm.hang[index]!)))).toBeGreaterThan(0.01)
  })

  it('reacts to mid and to high with different results: mid moves alternate columns, high shimmers the light', () => {
    const next = (bands: { mid?: number; high?: number }) => { const { h, t } = baseline({ pattern: 'crown' }); h.update(canopyFrame({ time: t + STEP, bands })); return h.inspect() }
    const control = next({}); const mid = next({ mid: 1 }); const high = next({ high: 1 })
    expect(Math.max(...Array.from(mid.hang).map((value, index) => Math.abs(value - control.hang[index]!)))).toBeGreaterThan(0.002)
    expect(Math.max(...Array.from(high.hang).map((value, index) => Math.abs(value - control.hang[index]!)))).toBeLessThan(1e-6)
    expect(Array.from(high.emission).some((value, index) => Math.abs(value - control.emission[index]!) > 0.001)).toBe(true)
  })

  it('compresses the height range through a build and releases the whole array on a drop', () => {
    const spread = (hang: Float32Array) => Math.max(...Array.from(hang)) - Math.min(...Array.from(hang))
    const relaxed = baseline({ pattern: 'crown' })
    const built = baseline({ pattern: 'crown' })
    built.h.update(canopyFrame({ time: built.t + STEP, build: 1 }))
    expect(spread(built.h.inspect().hang)).toBeLessThan(spread(relaxed.calm.hang))
    const dropped = baseline({ pattern: 'downpour' })
    dropped.h.update(canopyFrame({ time: dropped.t + STEP, dropMoment: 'drop-1' }), [canopyCue('drop', 'drop-1')])
    const lowered = Array.from(dropped.h.inspect().hang).filter((value, index) => value > dropped.calm.hang[index]! + 0.05)
    expect(lowered.length).toBeGreaterThan(40)
  })

  it('calms the secondary bank for vocals and leans the formation on a phrase', () => {
    const { h, t, calm } = baseline({ pattern: 'waterfall' })
    h.update(canopyFrame({ time: t + STEP, vocal: 1 }))
    const vocal = h.inspect()
    expect(Array.from(vocal.emission).some((value, index) => value < calm.emission[index]! - 1e-4)).toBe(true)
    const p = baseline({ pattern: 'waterfall' })
    p.h.update(canopyFrame({ time: p.t + STEP, phrase: 'ph-1' }), [canopyCue('phrase', 'ph-1')])
    expect(p.h.inspect().drive!.impulses.phrase).toBeGreaterThan(0.1)
    expect(p.h.inspect().hang.some((value, index) => Math.abs(value - p.calm.hang[index]!) > 0.002)).toBe(true)
  })

  it('lets every hit decay back to the authored base', () => {
    const { h, t, calm } = baseline()
    h.update(canopyFrame({ time: t + STEP, events: [{ kind: 'kick', id: 'k' }, { kind: 'snare', id: 's' }, { kind: 'downbeat', id: 'd' }], dropMoment: 'x' }), [canopyCue('kick', 'k'), canopyCue('snare', 's'), canopyCue('downbeat', 'd'), canopyCue('drop', 'x')])
    play(h, t, 6)
    const settled = h.inspect()
    expect(Object.values(settled.drive!.impulses).every(value => value < 0.01)).toBe(true)
    expect(settled.accent.every(value => value < 0.01)).toBe(true)
    void calm
  })

  it('applies the Visual Director as a small scale on hits, never a replacement', () => {
    const liftWith = (director: { impact: number; intensity: number } | null) => {
      const { h, t, calm } = baseline()
      h.update(canopyFrame({ time: t + STEP, events: [{ kind: 'kick', id: 'k' }], director }), [canopyCue('kick', 'k')])
      return Math.max(...Array.from(h.inspect().hang).map((value, index) => calm.hang[index]! - value))
    }
    const none = liftWith(null); const strong = liftWith({ impact: 1, intensity: 1 }); const weak = liftWith({ impact: 0, intensity: 0 })
    expect(strong).toBeGreaterThan(weak)
    expect(strong / none).toBeLessThan(1.25)
    expect(weak / none).toBeGreaterThan(0.75)
  })
})

describe('CANOPY authority', () => {
  const loud = (h: ReturnType<typeof setupCanopy>) => {
    const t = play(h, 0, 0.5)
    h.update(canopyFrame({ time: t + STEP, build: 1, bands: { sub: 1, bass: 1, mid: 1, high: 1 }, energy: 1, events: [{ kind: 'kick', id: 'k' }, { kind: 'snare', id: 's' }, { kind: 'downbeat', id: 'd' }], dropMoment: 'x' }),
      [canopyCue('kick', 'k'), canopyCue('snare', 's'), canopyCue('downbeat', 'd'), canopyCue('drop', 'x')])
    return h.inspect()
  }

  it('keeps hard zeros hard under Auto Performance: Motion Amount 0 and Master Intensity 0', () => {
    const still = setupCanopy({ pattern: 'checkerLift', motionAmount: 0, autoPerformance: true })
    const quiet = setupCanopy({ pattern: 'checkerLift', motionAmount: 0, autoPerformance: false })
    const a = loud(still); const b = (() => { play(quiet, 0, 0.5); return quiet.inspect() })()
    expect(Math.max(...Array.from(a.hang).map((value, index) => Math.abs(value - b.hang[index]!)))).toBeLessThan(0.06)
    const dark = loud(setupCanopy({ pattern: 'checkerLift', masterIntensity: 0, autoPerformance: true }))
    expect(Array.from(dark.emission).every(value => value === 0)).toBe(true)
  })

  it('leaves Rows, Columns and the spacing to the user: nothing in the music changes the rod count', () => {
    const h = setupCanopy({ rows: 6, columns: 5 })
    expect(loud(h)).toMatchObject({ rows: 6, columns: 5, rodCount: 30 })
  })

  it('rebuilds the array at once when Rows or Columns change, and keeps every rod\'s state sized to it', () => {
    const h = setupCanopy({ rows: 8, columns: 8 })
    play(h, 0, 0.2)
    expect(h.inspect().hang).toHaveLength(64)
    h.values.set('rows', 12); h.values.set('columns', 4)
    h.update(canopyFrame({ time: 1 }))
    expect(h.inspect()).toMatchObject({ rows: 12, columns: 4, rodCount: 48 })
    expect(h.inspect().hang).toHaveLength(48)
    expect(h.inspect().emission).toHaveLength(48)
  })

  it('ignores a cue it does not recognise and does not queue the same delivery twice', () => {
    const h = setupCanopy({ pattern: 'checkerLift', motionAmount: 1 })
    const t = play(h, 0, 0.5)
    h.instance.handleAction!('other', { eventId: 'x', payload: { kind: 'kick' } } as never)
    h.instance.handleAction!('musicalCue', { eventId: 'y', payload: { kind: 'not-a-kind' } } as never)
    h.instance.handleAction!('musicalCue', { eventId: 'z', payload: null } as never)
    h.update(canopyFrame({ time: t + STEP }))
    expect(h.inspect().drive!.impulses.kick).toBe(0)
  })

  it('releases its state when disposed', () => {
    const h = setupCanopy()
    loud(h)
    h.instance.lifecycle.dispose()
    h.update(canopyFrame({ time: 9, stopped: true }))
    expect(h.inspect().drive!.musicActive).toBe(false)
  })
})

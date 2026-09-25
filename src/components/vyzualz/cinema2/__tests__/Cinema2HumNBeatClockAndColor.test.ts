import { describe, expect, it } from 'vitest'
import { Cinema2HumNAutoColor, cinema2HumNPitchClass, hsvToRgb } from '../modules/humn/Cinema2HumNAutoColor'
import { Cinema2BeatClock } from '../modules/Cinema2BeatClock'
import type { Cinema2ModuleFrameReadContext } from '../modules/Cinema2ModuleContracts'

interface FrameOptions {
  dt?: number
  elapsed?: number
  bpm?: number | null
  beatIndex?: number
  beatPhase?: number
  paused?: boolean
  hasAudio?: boolean
  key?: string | null
  mode?: 'major' | 'minor' | null
  chord?: string | null
  chordChanged?: boolean
  centroid?: number
  energy?: number
  sectionId?: string
  drop?: number
  bar?: number
}

const signal = <T,>(value: T, available = true) => ({ available, value })

function frame(options: FrameOptions = {}): Readonly<Cinema2ModuleFrameReadContext> {
  const hasAudio = options.hasAudio ?? true
  return {
    deltaTimeSec: options.dt ?? 1 / 30,
    elapsedTimeSec: options.elapsed ?? 0,
    contextGeneration: 1,
    transport: { animationActive: !options.paused, paused: options.paused ?? false, bpm: null, timeSec: options.elapsed ?? 0, trackId: 't', bpmSync: false },
    audio: hasAudio
      ? {
          rhythm: {
            bpm: signal(options.bpm ?? null, options.bpm != null),
            beatIndex: signal(options.beatIndex ?? 0, options.beatIndex != null),
            beatPhase: signal(options.beatPhase ?? 0, options.beatIndex != null),
            barIndex: signal(options.bar ?? 0),
          },
          features: {
            spectralCentroid: signal(options.centroid ?? 0.5, options.centroid != null),
            overallEnergy: signal(options.energy ?? 0.2),
          },
          harmonic: signal({ key: options.key ?? null, mode: options.mode ?? null, chord: options.chord ?? null, chordChanged: options.chordChanged ?? false }, options.key != null),
          structure: {
            section: signal({ id: options.sectionId ?? 's1' }),
            dropConfidence: signal(options.drop ?? 0),
          },
          discontinuity: { generation: 0 },
        }
      : null,
  } as unknown as Readonly<Cinema2ModuleFrameReadContext>
}

describe('shared beat clock', () => {
  it('free-runs at 120 BPM when BPM Sync is off, whatever the track tempo', () => {
    const clock = new Cinema2BeatClock()
    clock.update(frame({ elapsed: 0, bpm: 160 }), false)
    let state = clock.getState()
    for (let index = 0; index < 60; index += 1) state = clock.update(frame({ elapsed: index / 30, bpm: 160 }), false)
    expect(state.locked).toBe(false)
    expect(state.beats).toBeCloseTo(60 / 30 * 2, 1)
  })

  it('runs at the track tempo when locked, and faster tracks advance faster', () => {
    const run = (bpm: number) => {
      const clock = new Cinema2BeatClock()
      let state = clock.update(frame({ elapsed: 0, bpm }), true)
      for (let index = 0; index < 90; index += 1) state = clock.update(frame({ elapsed: index / 30, bpm }), true)
      return state
    }
    const slow = run(90)
    const fast = run(150)
    expect(slow.locked).toBe(true)
    expect(fast.beats / slow.beats).toBeCloseTo(150 / 90, 1)
  })

  it('does not lock without a tempo, and does not depend on the dock Sync at all', () => {
    const clock = new Cinema2BeatClock()
    expect(clock.update(frame({ bpm: null }), true).locked).toBe(false)
    expect(clock.update(frame({ bpm: 128 }), true).locked).toBe(true)
  })

  it('stands still while paused', () => {
    const clock = new Cinema2BeatClock()
    clock.update(frame({ bpm: 120, elapsed: 5 }), true)
    const before = clock.update(frame({ bpm: 120, elapsed: 5.03 }), true).beats
    const paused = clock.update(frame({ bpm: 120, elapsed: 5.06, paused: true }), true).beats
    expect(paused).toBe(before)
  })

  it('eases toward the beat grid instead of snapping when the grid jumps (a seek or a track change)', () => {
    const clock = new Cinema2BeatClock()
    let state = clock.update(frame({ bpm: 120, elapsed: 0, beatIndex: 0, beatPhase: 0 }), true)
    for (let index = 0; index < 30; index += 1) state = clock.update(frame({ bpm: 120, elapsed: index / 30, beatIndex: index / 15, beatPhase: 0 }), true)
    const before = state.beats
    const after = clock.update(frame({ bpm: 120, elapsed: 1.05, beatIndex: 60, beatPhase: 0.5 }), true).beats
    expect(Math.abs(after - before)).toBeLessThan(0.2)
  })
})

describe('HUM:N Auto Color', () => {
  it('reads key names', () => {
    expect(cinema2HumNPitchClass('C')).toBe(0)
    expect(cinema2HumNPitchClass('F#')).toBe(6)
    expect(cinema2HumNPitchClass('Bb')).toBe(10)
    expect(cinema2HumNPitchClass('A minor')).toBe(9)
    expect(cinema2HumNPitchClass('')).toBeNull()
    expect(cinema2HumNPitchClass(null)).toBeNull()
    expect(cinema2HumNPitchClass('H')).toBeNull()
  })

  const settle = (options: FrameOptions, frames = 200) => {
    const color = new Cinema2HumNAutoColor()
    for (let index = 0; index < frames; index += 1) color.update(frame({ ...options, elapsed: index / 30 }))
    return color.getPalette()
  }

  it('gives different palettes for different keys and for major versus minor', () => {
    const c = settle({ key: 'C', mode: 'major' })
    const g = settle({ key: 'G', mode: 'major' })
    const cMinor = settle({ key: 'C', mode: 'minor' })
    expect(Math.abs(c.hue - g.hue)).toBeGreaterThan(20)
    expect(Math.abs(c.hue - cMinor.hue)).toBeGreaterThan(60)
    expect(c.colors[0]).not.toEqual(g.colors[0])
  })

  it('is deterministic', () => {
    const a = settle({ key: 'D', mode: 'major', energy: 0.3, centroid: 0.7 })
    const b = settle({ key: 'D', mode: 'major', energy: 0.3, centroid: 0.7 })
    expect(a).toEqual(b)
  })

  it('spreads the three colors further apart and saturates them when the music is louder', () => {
    const quiet = settle({ key: 'C', mode: 'major', energy: 0.02 })
    const loud = settle({ key: 'C', mode: 'major', energy: 0.6 })
    expect(loud.spread).toBeGreaterThan(quiet.spread + 30)
    expect(loud.saturation).toBeGreaterThan(quiet.saturation)
  })

  it('brighter sound tilts the palette', () => {
    const dark = settle({ key: 'C', mode: 'major', centroid: 0.1 })
    const bright = settle({ key: 'C', mode: 'major', centroid: 0.9 })
    expect(bright.hue).not.toBeCloseTo(dark.hue, 0)
  })

  it('steps the palette on a section change, and slews there instead of cutting', () => {
    const color = new Cinema2HumNAutoColor()
    for (let index = 0; index < 120; index += 1) color.update(frame({ key: 'C', mode: 'major', sectionId: 's1', elapsed: index / 30 }))
    const before = color.getPalette().hue
    const first = color.update(frame({ key: 'C', mode: 'major', sectionId: 's2', elapsed: 4 })).hue
    expect(Math.abs(((first - before + 540) % 360) - 180)).toBeLessThan(12)
    for (let index = 0; index < 200; index += 1) color.update(frame({ key: 'C', mode: 'major', sectionId: 's2', elapsed: 4 + index / 30 }))
    const after = color.getPalette().hue
    expect(Math.abs(((after - before + 540) % 360) - 180)).toBeGreaterThan(20)
  })

  it('never moves faster than the hue slew limit', () => {
    const color = new Cinema2HumNAutoColor()
    color.update(frame({ key: 'C', mode: 'major', sectionId: 's1' }))
    let previous = color.getPalette().hue
    for (let index = 0; index < 60; index += 1) {
      const hue = color.update(frame({ key: index < 30 ? 'C' : 'F#', mode: 'major', sectionId: `s${index}`, elapsed: index / 30 })).hue
      const step = Math.abs(((hue - previous + 540) % 360) - 180)
      expect(step).toBeLessThan(70 / 30 + 0.5)
      previous = hue
    }
  })

  it('turns slowly on its own with no audio and stays a valid colour', () => {
    const color = new Cinema2HumNAutoColor()
    const first = color.update(frame({ hasAudio: false })).hue
    for (let index = 0; index < 90; index += 1) color.update(frame({ hasAudio: false }))
    expect(color.getPalette().hue).not.toBeCloseTo(first, 0)
    for (const channel of color.getPalette().colors.flat()) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })

  it('converts hue to RGB', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([1, 0, 0])
    expect(hsvToRgb(120, 1, 1)).toEqual([0, 1, 0])
    expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 1])
    expect(hsvToRgb(90, 0, 0.5)).toEqual([0.5, 0.5, 0.5])
  })
})

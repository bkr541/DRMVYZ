import { describe, expect, it } from 'vitest'
import { Cinema2AudioIntelligenceBridge, type Cinema2AudioIntelligenceFrame } from '../audio/Cinema2AudioIntelligenceBridge'
import { CINEMA2_MOOD_PATHS, Cinema2MoodChooser, Cinema2MoodConductor, hashIndex, type Cinema2MoodFrame } from '../conductor/Cinema2MoodConductor'
import { Cinema2VisualDirector, type Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'
import { ifritMusicFixture, type IfritFixtureOptions } from '../../../../test/support/IfritMusicFixture'

interface Options extends Partial<IfritFixtureOptions> { section?: string; discontinuity?: 'seek' | 'source-change' }

/** One shared audio source feeds a director and a conductor, exactly as the runtime does. */
function stage() {
  let serial = 0
  let published = ifritMusicFixture({ frameId: 0, timeSec: 0 })
  let meta = { sequence: 0, publishedAtMs: 0 }
  const director = new Cinema2VisualDirector()
  const conductor = new Cinema2MoodConductor()
  // One persistent bridge, as in the runtime: a new bridge per frame would report a discontinuity every time.
  const bridge = new Cinema2AudioIntelligenceBridge({
    getFrame: () => published,
    getPublicationMeta: () => ({ sequence: meta.sequence, publishedAtMs: meta.publishedAtMs, publisherId: 'mood-test', kind: 'frame' as const }),
  })
  const frame = (timeSec: number, options: Options = {}, dt = 1 / 30): { mood: Readonly<Cinema2MoodFrame> | null; audio: Readonly<Cinema2AudioIntelligenceFrame>; director: Readonly<Cinema2VisualDirectorFrame> } => {
    serial += 1
    const base = ifritMusicFixture({ frameId: serial, timeSec, energy: .5, bass: .5, ...options })
    published = options.section ? { ...base, section: { ...base.section, type: options.section as never } } : base
    meta = { sequence: serial, publishedAtMs: timeSec * 1000 }
    const captured = bridge.capture(serial)
    const audio = options.discontinuity ? { ...captured, discontinuity: { ...captured.discontinuity, occurred: true, reason: options.discontinuity, generation: captured.discontinuity.generation + 1 } } as Cinema2AudioIntelligenceFrame : captured
    const directorFrame = director.capture(audio)
    return { mood: conductor.capture(audio, directorFrame, dt), audio, director: directorFrame }
  }
  /** Runs `seconds` of the same music, one frame per 1/30 s, and returns the last mood. */
  const run = (from: number, seconds: number, options: Options = {}) => {
    let last: Readonly<Cinema2MoodFrame> | null = null
    for (let i = 0; i < seconds * 30; i++) last = frame(from + i / 30, options).mood
    return last!
  }
  return { frame, run, conductor }
}

describe('Cinema 2.0 Mood Conductor', () => {
  it('is null without audio or a director, so nothing is invented', () => {
    const conductor = new Cinema2MoodConductor()
    expect(conductor.capture(null, null, 1 / 60)).toBeNull()
    const { audio } = stage().frame(10)
    expect(conductor.capture(audio, null, 1 / 60)).toBeNull()
  })

  it('reads the director and the audio features into smoothed, bounded values', () => {
    const s = stage()
    const loud = s.run(10, 4, { energy: .9, tension: .8, build: .9, section: 'build' })
    const quiet = stage().run(10, 4, { energy: .1, tension: .05, build: 0, section: 'breakdown' })
    for (const key of Object.values(CINEMA2_MOOD_PATHS)) { expect(loud[key], key).toBeGreaterThanOrEqual(0); expect(loud[key], key).toBeLessThanOrEqual(1) }
    expect(loud.energy).toBeGreaterThan(quiet.energy + .2)
    expect(loud.tension).toBeGreaterThan(quiet.tension + .3)
    expect(loud.build).toBeGreaterThan(quiet.build + .3)
    expect(loud.activity).toBeGreaterThan(quiet.activity + .2)
  })

  it('feels calm in a breakdown, tense in a build, and peaks on a drop, from the section and the signal', () => {
    const calm = stage().run(10, 5, { energy: .15, section: 'breakdown' })
    expect(calm.structured).toBe(true)
    expect(calm.feel).toBe('calm')
    expect(calm.calm).toBeGreaterThan(.7)
    const tense = stage().run(10, 5, { energy: .6, tension: .8, build: .8, section: 'preDrop' })
    expect(tense.feel).toBe('tense')
    expect(tense.tense).toBeGreaterThan(.7)
    const s = stage()
    s.run(10, 2, { energy: .7, section: 'drop' })
    const peak = s.run(12, 2, { energy: .95, section: 'drop' })
    expect(peak.feel).toBe('peak')
    expect(peak.peak).toBeGreaterThan(.45)
    // The weights melt from one passage into the next rather than jumping.
    const t = stage(); t.run(10, 5, { section: 'breakdown' })
    const next = t.frame(15 + 1 / 30, { section: 'drop' }).mood!
    expect(next.calm).toBeGreaterThan(.5)
    expect(next.peak).toBeLessThan(.5)
  })

  it('lands a drop as a shock that rises at once and falls over about two seconds, on the canonical drop event', () => {
    const s = stage()
    s.run(10, 3, { energy: .5 })
    const hit = s.frame(13, { event: 'drop', eventId: 77, energy: .9 }).mood!
    expect(hit.drop).toEqual({ occurred: true, eventId: expect.stringContaining('drop') })
    expect(hit.shock).toBeGreaterThanOrEqual(.75)
    expect(hit.boundary).toMatchObject({ kind: 'drop' })
    expect(hit.feel).toBe('peak')
    const later = s.run(13 + 1 / 30, 1, { energy: .9 })
    expect(later.shock).toBeLessThan(hit.shock)
    expect(later.drop.occurred).toBe(false)
    const gone = s.run(14.1, 6.9, { energy: .9 })
    expect(gone.shock).toBeLessThan(.02)
    // A second hit is a new shock, not an echo of the first.
    const again = s.frame(21, { event: 'drop', eventId: 78, energy: .9 }).mood!
    expect(again.shock).toBeGreaterThanOrEqual(.75)
    expect(again.boundary!.id).not.toBe(hit.boundary!.id)
  })

  it('reports a section change and a phrase as boundaries, once each, and a drop outranks them', () => {
    const s = stage()
    s.run(10, 1, { sectionStart: 0 })
    const change = s.frame(11.1, { sectionStart: 20 }).mood!
    expect(change.boundary).toMatchObject({ kind: 'section' })
    const none = s.frame(11.1 + 1 / 30, { sectionStart: 20 }).mood!
    expect(none.boundary).toBeNull()
    s.run(11.1 + 2 / 30, .8, { sectionStart: 20 })
    const phrase = s.frame(12, { sectionStart: 20, event: 'phrase', eventId: 5 }).mood!
    expect(phrase.boundary).toMatchObject({ kind: 'phrase' })
    s.run(12 + 1 / 30, .9, { sectionStart: 20 })
    const both = s.frame(13, { sectionStart: 40, event: 'drop', eventId: 6 }).mood!
    expect(both.boundary).toMatchObject({ kind: 'drop' })
  })

  it('holds still while the transport is paused (no time passes), and starts again after a seek, loop or track change', () => {
    const s = stage()
    s.run(10, 3, { energy: .8, tension: .6 })
    const a = s.frame(13.1, { energy: .8, tension: .6 }, 0).mood!
    const b = s.frame(13.1, { energy: .1, tension: .0 }, 0).mood!
    expect(b.energy).toBeCloseTo(a.energy, 9)
    expect(b.tension).toBeCloseTo(a.tension, 9)
    const reset = s.frame(2, { energy: .1, discontinuity: 'seek' }).mood!
    expect(reset.shock).toBe(0)
    expect(reset.energy).toBeLessThan(a.energy * .5)
  })

  it('is deterministic: the same music always gives the same mood', () => {
    const play = () => { const s = stage(); const out: number[] = []; for (let i = 0; i < 150; i++) { const m = s.frame(10 + i / 30, { energy: .5 + .4 * Math.sin(i / 20), event: i === 90 ? 'drop' : null, eventId: 3 }).mood!; out.push(m.activity, m.shock, m.calm) } return out }
    expect(play()).toEqual(play())
  })
})

describe('Cinema 2.0 Mood Chooser', () => {
  const options = { calm: ['a', 'b'], driving: ['c', 'd', 'e'], tense: ['f', 'g'], peak: ['h', 'i', 'j'] } as const
  const withBoundary = (kind: 'drop' | 'section' | 'phrase' | null, id: string, feel: Cinema2MoodFrame['feel'] = 'driving'): Cinema2MoodFrame => ({
    version: 1, structured: true, energy: .5, tension: .2, build: 0, momentum: .3, complexity: .3, brightness: .5, activity: .5, calm: 0, drive: .5, tense: 0, peak: 0, shock: 0, feel,
    section: { id: 's', type: 'verse', progress: .3 }, drop: { occurred: kind === 'drop', eventId: kind === 'drop' ? id : null }, boundary: kind ? { id, kind } : null,
  })

  it('does nothing without a mood or between boundaries', () => {
    const c = new Cinema2MoodChooser<string>({ options })
    expect(c.update(null, 'c', 1, 'seed')).toBeNull()
    expect(c.update(withBoundary(null, ''), 'c', 1, 'seed')).toBeNull()
  })

  it('chooses from the options that suit the feel, never repeats the current one, and is repeatable', () => {
    const run = (seed: string) => {
      const c = new Cinema2MoodChooser<string>({ options, minHoldSec: 0 })
      let current: string | null = 'c'; const picks: string[] = []
      for (let i = 0; i < 20; i++) { const next = c.update(withBoundary('phrase', `p${i}`, 'driving'), current, 5, seed); if (next) { picks.push(next); current = next } }
      return picks
    }
    const a = run('t1')
    expect(a.length).toBe(20)
    expect(a.every(p => ['c', 'd', 'e'].includes(p))).toBe(true)
    for (let i = 1; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1])
    expect(run('t1')).toEqual(a)
    expect(run('t2')).not.toEqual(a)
    const c = new Cinema2MoodChooser<string>({ options })
    expect(['h', 'i', 'j']).toContain(c.update(withBoundary('drop', 'd1', 'peak'), 'c', 5, 'x'))
  })

  it('holds a choice for its minimum time unless a drop lands', () => {
    const c = new Cinema2MoodChooser<string>({ options, minHoldSec: 4 })
    expect(c.update(withBoundary('phrase', 'p1'), 'c', 5, 's')).not.toBeNull()
    expect(c.update(withBoundary('phrase', 'p2'), 'd', 1, 's')).toBeNull()
    expect(c.update(withBoundary('drop', 'd1', 'peak'), 'd', 1, 's')).not.toBeNull()
    expect(c.update(withBoundary('phrase', 'p3'), 'h', 4.5, 's')).not.toBeNull()
  })

  it('has a stable hash', () => {
    expect(hashIndex(5, 'abc')).toBe(hashIndex(5, 'abc'))
    expect(hashIndex(1, 'x')).toBe(0)
    expect(new Set(Array.from({ length: 50 }, (_, i) => hashIndex(5, `k${i}`))).size).toBe(5)
  })
})

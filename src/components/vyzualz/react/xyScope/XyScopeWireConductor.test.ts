import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { conductColor, NEUTRAL_MOOD, WIRE_DRIVEN_KEYS, WireConductor, type ConductorInput, type WireMood } from './XyScopeWireConductor'
import { deriveWireMood, emptyWireCue } from './XyScopeWireCues'
import { NO_BOUNDARIES } from './XyScopeWireDirector'
import { WireEngine, type WireTick } from './XyScopeWireEngine'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { WIRE_DEFAULTS, WIRE_RANGES, type WireNumberKey, type WireValues } from './XyScopeWireSettings'
/** The figure alone: no background, and no transition when the figure changes (these tests are about the figure). */
const NOBG: WireValues = { ...WIRE_DEFAULTS, background: 'none', transition: 'cut' }

const mood = (over: Partial<WireMood> = {}): WireMood => ({ ...NEUTRAL_MOOD, ...over })
const calmMood = mood({ energy: .15, level: .15, tension: .05, complexity: .1, brightness: .35, sectionType: 'breakdown', structured: true, sectionProgress: .4, phraseIndex: 3, phraseProgress: .3, keyIndex: 9, minor: true, confidence: .8 })
const dropMood = mood({ energy: .95, level: .9, tension: .85, build: .9, drop: .95, complexity: .8, flux: .8, brightness: .7, sectionType: 'drop', structured: true, sectionProgress: .2, phraseIndex: 4, phraseProgress: .1, keyIndex: 9, minor: true, confidence: .9 })

function conduct(m: WireMood, over: Partial<ConductorInput> = {}, seconds = 4, conductor = new WireConductor()) {
  let out = conductor.update({ dt: 1 / 60, playing: true, auto: true, mood: m, base: WIRE_DEFAULTS, boundaries: NO_BOUNDARIES, drop: false, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false, ...over })
  for (let f = 1; f < seconds * 60; f++) out = conductor.update({ dt: 1 / 60, playing: true, auto: true, mood: m, base: WIRE_DEFAULTS, boundaries: NO_BOUNDARIES, drop: false, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false, ...over })
  return out
}

describe('the conductor (Auto Performance)', () => {
  it('passes the user\'s values through untouched when Auto Performance is off', () => {
    const out = new WireConductor().update({ dt: 1 / 60, playing: true, auto: false, mood: dropMood, base: WIRE_DEFAULTS, boundaries: NO_BOUNDARIES, drop: true, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false })
    expect(out.driving).toBe(false)
    expect(out.values).toEqual(WIRE_DEFAULTS)
    expect(out.figure).toBe(WIRE_DEFAULTS.figure)
  })

  it('moves only the controls it is allowed to, and never the safety limits, master controls, scene change, seed, scan or background', () => {
    const out = conduct(dropMood, { drop: true, boundaries: { section: true, phrase: true, bar4: true, bar8: true, id: 'section:drop' } })
    for (const key of Object.keys(WIRE_DEFAULTS) as (keyof WireValues)[]) {
      if (WIRE_DRIVEN_KEYS.includes(key)) continue
      expect(out.values[key], `${key} is manual`).toBe(WIRE_DEFAULTS[key])
    }
    for (const key of ['intensity', 'audioReactivity', 'bpmSync', 'flashLimit', 'readableFloor', 'maxDisplacement', 'minReadable', 'attack', 'release', 'sceneEvery', 'seed', 'scan', 'backgroundColor'] as const) {
      expect(WIRE_DRIVEN_KEYS.includes(key), key).toBe(false)
    }
  })

  it('drives most of the instrument: a drop moves at least twenty of the controls away from the user\'s values', () => {
    const out = conduct(dropMood, { drop: true, boundaries: { section: true, phrase: true, bar4: true, bar8: true, id: 'section:drop' } })
    const moved = WIRE_DRIVEN_KEYS.filter(key => out.values[key] !== WIRE_DEFAULTS[key])
    expect(moved.length).toBeGreaterThanOrEqual(20)
  })

  it('keeps every driven value inside its control\'s own range, whatever the mood', () => {
    for (const m of [calmMood, dropMood, mood({ energy: 4, tension: 4, drop: 4, complexity: 4, brightness: 9, flux: 9 }), mood()]) {
      const out = conduct(m, { drop: true, boundaries: { section: true, phrase: true, bar4: false, bar8: true, id: 'x' } }, 3)
      for (const key of Object.keys(WIRE_RANGES) as WireNumberKey[]) {
        const [lo, hi] = WIRE_RANGES[key]
        const value = out.values[key]
        // Spin may be negative (a reversed turn); its size is bounded.
        const size = key === 'spin' ? Math.abs(value) : value
        expect(size, key).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(size, key).toBeLessThanOrEqual(hi + 1e-9)
      }
      expect(out.values.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(out.values.glowColor).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('is wilder, bigger and brighter on a drop than in a calm breakdown', () => {
    const calm = conduct(calmMood), drop = conduct(dropMood, { drop: true })
    expect(drop.values.chaos).toBeGreaterThan(calm.values.chaos + .25)
    expect(drop.values.waveDepth).toBeGreaterThan(calm.values.waveDepth)
    expect(drop.values.waveAmount).toBeGreaterThan(calm.values.waveAmount)
    expect(Math.abs(drop.values.spin)).toBeGreaterThan(Math.abs(calm.values.spin))
    expect(drop.values.glow).toBeGreaterThan(calm.values.glow)
    expect(drop.values.kickResponse).toBeGreaterThan(calm.values.kickResponse)
    expect(drop.values.trail).toBeLessThan(calm.values.trail)
    expect(drop.feel).toBe('PEAK')
    expect(calm.feel).toBe('CALM')
  })

  it('shows more of a bright track\'s detail and its high band than a dark one\'s', () => {
    const dark = conduct(mood({ energy: .6, complexity: .5, brightness: .1 })), bright = conduct(mood({ energy: .6, complexity: .5, brightness: .9 }))
    expect(bright.values.waveDetail).toBeGreaterThan(dark.values.waveDetail)
    expect(bright.values.airResponse).toBeGreaterThan(dark.values.airResponse)
    expect(dark.values.bassResponse).toBeGreaterThan(bright.values.bassResponse)
    expect(bright.values.waveOscillator).toBeGreaterThan(dark.values.waveOscillator)
  })

  it('turns the colour by the key and by the mode, and leaves it alone when the key is not known', () => {
    const keyed = (keyIndex: number | null, minor: boolean | null) => conduct(mood({ ...calmMood, keyIndex, minor }), {}, 8).values.color
    expect(keyed(null, null)).toBe(conduct(mood({ ...calmMood, keyIndex: null, minor: null }), {}, 8).values.color)
    expect(keyed(0, false)).not.toBe(keyed(6, false))
    expect(keyed(3, false)).not.toBe(keyed(3, true))
    expect(conductColor('#7df08e', 0, .5, .3)).toBe('#7df08e')
  })

  it('chooses a figure on a musical boundary and not between them: calm stays cubes, a tense peak moves to the tesseract', () => {
    const conductor = new WireConductor()
    const calm = conduct(calmMood, { boundaries: NO_BOUNDARIES }, 8, conductor)
    expect(calm.figure).toBe('cubes')
    // No boundary: the figure does not change however the mood moves.
    expect(conduct(dropMood, { boundaries: NO_BOUNDARIES }, 8, conductor).figure).toBe('cubes')
    // A confident drop is a boundary.
    expect(conduct(dropMood, { drop: true, boundaries: { section: true, phrase: false, bar4: false, bar8: false, id: 'section:drop' } }, 1, conductor).figure).toBe('tesseract')
  })

  it('is deterministic: the same track, seed and boundaries make the same choices, and another seed may not', () => {
    const run = (seed: number) => {
      const c = new WireConductor(), figures: string[] = []
      for (let phrase = 0; phrase < 12; phrase++) {
        const m = mood({ ...dropMood, tension: .45 + .05 * (phrase % 3), complexity: .55, phraseIndex: phrase, sectionType: phrase % 2 ? 'verse' : 'build' })
        figures.push(conduct(m, { seed, boundaries: { section: true, phrase: true, bar4: true, bar8: true, id: `p${phrase}` } }, 7, c).figure)
      }
      return figures.join(',')
    }
    expect(run(7)).toBe(run(7))
    expect(run(7).length).toBeGreaterThan(0)
  })

  it('never changes the figure faster than every few seconds, even on a flurry of boundaries', () => {
    const c = new WireConductor(), changes: number[] = []
    let last = c.update({ dt: 1 / 60, playing: true, auto: true, mood: dropMood, base: WIRE_DEFAULTS, boundaries: NO_BOUNDARIES, drop: false, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false }).figure
    for (let f = 0; f < 60 * 12; f++) {
      const m = f % 120 < 60 ? dropMood : calmMood
      const out = c.update({ dt: 1 / 60, playing: true, auto: true, mood: m, base: WIRE_DEFAULTS, boundaries: { section: f % 20 === 0, phrase: false, bar4: true, bar8: false, id: `b${f}` }, drop: false, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false })
      if (out.figure !== last) { changes.push(f / 60); last = out.figure }
    }
    for (let i = 1; i < changes.length; i++) expect(changes[i] - changes[i - 1]).toBeGreaterThanOrEqual(5.9)
  })

  it('on a live microphone (no sections, phrases or key) works from the signal alone and invents none of them', () => {
    const features = { ...emptyFeatures(), level: .8, flux: .7, bass: .3, mid: .5, air: .8 }
    const m = deriveWireMood(null, features, true)
    expect(m.structured).toBe(false)
    expect(m.sectionType).toBeNull()
    expect(m.keyIndex).toBeNull()
    expect(m.phraseIndex).toBe(0)
    const out = conduct(m)
    expect(out.values.chaos).toBeGreaterThan(WIRE_DEFAULTS.chaos * .9)
    expect(out.values.color).toBe(conduct(m, { seed: 99 }).values.color)
  })

  it('returns to the user\'s values exactly after Auto Performance is switched off', () => {
    const c = new WireConductor()
    conduct(dropMood, {}, 3, c)
    const off = c.update({ dt: 1 / 60, playing: true, auto: false, mood: dropMood, base: WIRE_DEFAULTS, boundaries: NO_BOUNDARIES, drop: false, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false })
    expect(off.values).toEqual(WIRE_DEFAULTS)
  })

  it('settles back toward the user\'s values in silence, not away from them', () => {
    const c = new WireConductor()
    conduct(dropMood, {}, 3, c)
    const quiet = conduct(NEUTRAL_MOOD, { playing: false }, 6, c)
    expect(quiet.values.chaos).toBeLessThanOrEqual(WIRE_DEFAULTS.chaos)
    expect(quiet.values.glow).toBeLessThan(WIRE_DEFAULTS.glow)
  })
})

describe('the mood from the shared analysis', () => {
  function context(over: Partial<SharedPerformanceContext> & { harmonic?: Partial<SharedPerformanceContext['intelligence']['harmonic']> } = {}): SharedPerformanceContext {
    const base = createSharedPerformanceFallbackContext(10)
    const { harmonic, ...rest } = over
    return { ...base, ...rest, capabilities: { ...base.capabilities, sections: true, beatGrid: true, liveBands: true, ...rest.capabilities }, intelligence: { ...base.intelligence, harmonic: { ...base.intelligence.harmonic, ...harmonic } } }
  }

  it('reads everything: track-relative energy, tension, build, drop, complexity, the section and phrase, the key and the tempo', () => {
    const m = deriveWireMood(context({ trackRelativeEnergy: .7, energy: .5, tension: .6, buildProgress: .4, dropImpact: .3, complexity: .8, spectralFlux: .2, sectionType: 'build', sectionProgress: .5, phraseIndex: 5, phraseProgress: .25, bpm: 126, harmonic: { key: 'F#', mode: 'minor', keyConfidence: .9 } }), null, true)
    expect(m).toMatchObject({ energy: .7, level: .5, tension: .6, build: .4, drop: .3, complexity: .8, flux: .2, sectionType: 'build', sectionProgress: .5, phraseIndex: 5, phraseProgress: .25, tempo: 126, keyIndex: 6, minor: true, structured: true })
  })

  it('drops the key when it is not confident, and the sections when there are none', () => {
    const unsure = deriveWireMood(context({ harmonic: { key: 'C', mode: 'major', keyConfidence: .1 } }), null, true)
    expect(unsure.keyIndex).toBeNull()
    expect(unsure.minor).toBeNull()
    const none = deriveWireMood(context({ capabilities: { sections: false, beatGrid: false } as SharedPerformanceContext['capabilities'], sectionType: 'drop' }), null, true)
    expect(none.structured).toBe(false)
    expect(none.sectionType).toBeNull()
    expect(deriveWireMood(context(), null, false)).toEqual(NEUTRAL_MOOD)
  })
})

describe('Auto Performance in the engine', () => {
  const tick = (over: Partial<WireTick> = {}): WireTick => ({ dt: 1 / 60, reading: loud(0), cue: emptyWireCue(), values: NOBG, auto: false, discontinuity: false, ...over })

  it('draws the user\'s own values when off, and the music\'s when on', () => {
    const off = new WireEngine(), on = new WireEngine()
    for (let f = 0; f < 180; f++) {
      off.tick(tick({ reading: loud(f), mood: dropMood }))
      on.tick(tick({ reading: loud(f), mood: dropMood, auto: true }))
    }
    expect(off.effective).toEqual(NOBG)
    expect(on.effective.chaos).toBeGreaterThan(off.effective.chaos)
    expect(on.effective.glow).not.toBe(off.effective.glow)
    expect(on.feel).toBe('PEAK')
    expect(on.mood.drop).toBeGreaterThan(.5)
  })

  it('changes the figure it draws on a drop, and the new figure is the one on screen', () => {
    const engine = new WireEngine()
    for (let f = 0; f < 600; f++) engine.tick(tick({ reading: loud(f), mood: calmMood, auto: true }))
    expect(engine.figure).toBe('cubes')
    for (let f = 0; f < 120; f++) engine.tick(tick({ reading: loud(f), mood: dropMood, auto: true, cue: { ...emptyWireCue(), drop: f === 0, boundaries: { section: f === 0, phrase: false, bar4: false, bar8: false, id: f === 0 ? 'section:drop' : '' }, gridConfident: true } }))
    expect(engine.figure).toBe('tesseract')
    expect(engine.shape.id).toBe('tesseract')
  })
})

function emptyFeatures() { return { level: 0, bass: 0, mid: 0, air: 0, flux: 0, sub: 0, lowMid: 0 } as unknown as Parameters<typeof deriveWireMood>[1] & object }
function loud(frame: number): WireReading {
  const swing = .5 + .5 * Math.sin(frame / 60 * 7)
  return {
    ...silentReading(), playing: true, confidence: .9,
    features: { sub: swing, bass: swing, lowMid: swing, mid: swing * .8, air: swing * .6, flux: swing, level: .4 + swing * .5 },
    available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
    hits: { kick: frame % 30 === 0 ? 1 : 0, snare: frame % 60 === 30 ? .9 : 0, hat: 0 },
  }
}

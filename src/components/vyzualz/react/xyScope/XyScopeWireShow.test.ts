import { describe, expect, it } from 'vitest'
import { NEUTRAL_MOOD, WireConductor, type WireMood } from './XyScopeWireConductor'
import { emptyWireCue, type WireCue } from './XyScopeWireCues'
import { emitBackground, WIRE_BACKGROUND_LAYERS, WIRE_BACKGROUND_OPTIONS, WireBackgroundPath, type WireBackgroundDrive, type WireBackgroundId } from './XyScopeWireBackground'
import { NO_BOUNDARIES } from './XyScopeWireDirector'
import { WireEngine, type WireTick } from './XyScopeWireEngine'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { DEFAULT_WIRE_RULES, MAX_WIRE_RULES, NO_EVENTS, normalizeWireRules, WireFx, WIRE_REACTION_OPTIONS, WIRE_TRIGGER_OPTIONS, type WireRule } from './XyScopeWireReactions'
import { verticesOfGroups } from './XyScopeWireShape'
import { WIRE_DEFAULTS, type WireValues } from './XyScopeWireSettings'
import { glitchAmount, shatterAmount, shatterDirection, WIRE_TRANSITION_KINDS, WIRE_TRANSITION_OPTIONS, zoomAmount, zoomFade, zoomScale } from './XyScopeWireTransitions'

/** The figure alone: no background, and a cut when the figure changes (these tests choose what they want on top). */
const PLAIN: WireValues = { ...WIRE_DEFAULTS, background: 'none', transition: 'cut' }

function loud(frame: number, level = 1): WireReading {
  const swing = (.5 + .5 * Math.sin(frame / 60 * 7)) * level
  return {
    ...silentReading(), playing: true, confidence: .9,
    features: { sub: swing, bass: swing, lowMid: swing, mid: swing * .8, air: swing * .6, flux: swing, level: .35 + swing * .5 },
    available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
    hits: { kick: frame % 30 === 0 ? 1 : 0, snare: frame % 60 === 30 ? .9 : 0, hat: 0 },
  }
}
const tick = (over: Partial<WireTick> = {}): WireTick => ({ dt: 1 / 60, reading: loud(0), cue: emptyWireCue(), values: PLAIN, auto: false, discontinuity: false, ...over })
type Internals = { zoom: number; fade: number; glitch: number; base: Float32Array; transition: { active: boolean } }
const internals = (e: WireEngine) => e as unknown as Internals
const maxGap = (a: Float32Array, b: Float32Array, vertices: number) => { let m = 0; for (let i = 0; i < vertices * 3; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m }
const coreRadius = (e: WireEngine) => { let m = 0; for (let i = 0; i < e.shape.groups[0].vertexCount; i++) m = Math.max(m, Math.hypot(e.base[i * 3], e.base[i * 3 + 1], e.base[i * 3 + 2])); return m }
const maxRadius = (e: WireEngine) => { let m = 0; const n = verticesOfGroups(e.shape, 1 + e.effective.satellites); for (let i = 0; i < n; i++) m = Math.max(m, Math.hypot(e.base[i * 3], e.base[i * 3 + 1], e.base[i * 3 + 2])); return m }

/** An engine that has played for a second on the given figure. */
function playing(over: Partial<WireValues> = {}, frames = 60): WireEngine {
  const e = new WireEngine()
  for (let f = 0; f < frames; f++) e.tick(tick({ reading: loud(f), values: { ...PLAIN, satellites: 2, ...over } }))
  return e
}

describe('transitions', () => {
  it('has four styles, plus a cut and Auto, and the curves start whole, peak at the swap and end whole', () => {
    expect(WIRE_TRANSITION_KINDS).toEqual(['shatter', 'morph', 'glitch', 'zoom'])
    expect(WIRE_TRANSITION_OPTIONS.map(o => o.value)).toEqual(['cut', 'shatter', 'morph', 'glitch', 'zoom', 'auto'])
    expect(shatterAmount(0)).toBe(0)
    expect(shatterAmount(.42)).toBeCloseTo(1, 6)
    expect(shatterAmount(1)).toBe(0)
    expect(zoomAmount(0)).toBe(0); expect(zoomAmount(.5)).toBeCloseTo(1, 6); expect(zoomAmount(1)).toBe(0)
    expect(zoomScale(.5)).toBeCloseTo(6, 6); expect(zoomFade(.5)).toBeLessThan(.2); expect(zoomFade(0)).toBe(1); expect(zoomFade(1)).toBe(1)
    expect(glitchAmount(0)).toBe(1); expect(glitchAmount(1)).toBe(0); expect(glitchAmount(.5)).toBeGreaterThan(0)
  })

  it('flings each corner in its own repeatable direction', () => {
    const a = new Float32Array(3), b = new Float32Array(3), c = new Float32Array(3)
    shatterDirection(5, a); shatterDirection(5, b); shatterDirection(6, c)
    expect(Array.from(a)).toEqual(Array.from(b))
    expect(Array.from(a)).not.toEqual(Array.from(c))
    expect(Math.hypot(a[0], a[1], a[2])).toBeCloseTo(1, 5)
  })

  it('cuts to the new figure at once when the style is None, growing it in', () => {
    const e = playing({ figure: 'cubes' })
    e.tick(tick({ reading: loud(61), values: { ...PLAIN, satellites: 2, figure: 'solids' } }))
    expect(e.shape.id).toBe('solids')
    expect(e.transitionKind).toBeNull()
  })

  it('shatters: the corners fly apart, the figure swaps at the top, everything re-forms exactly on the new figure', () => {
    const e = playing({ figure: 'cubes' }), cut = playing({ figure: 'cubes' })
    const values: WireValues = { ...PLAIN, satellites: 2, figure: 'solids', transition: 'shatter' }
    let peak = 0, swappedAt = -1, sawKind = false
    for (let f = 61; f < 61 + 60 * 4; f++) {
      e.tick(tick({ reading: loud(f), values })); cut.tick(tick({ reading: loud(f), values: { ...values, transition: 'cut' } }))
      peak = Math.max(peak, maxRadius(e) - maxRadius(cut))
      if (e.transitionKind === 'shatter') sawKind = true
      if (swappedAt < 0 && e.shape.id === 'solids') swappedAt = f - 61
    }
    expect(sawKind).toBe(true)
    expect(peak).toBeGreaterThan(1.5) // flung well outside where the clean figure is
    expect(swappedAt).toBeGreaterThan(15) // the swap comes about 0.42 of the way through, not at the start
    expect(swappedAt).toBeLessThan(40)
    expect(e.transitionKind).toBeNull()
    expect(maxGap(e.base, cut.base, verticesOfGroups(e.shape, 3))).toBeLessThan(1e-4)
  })

  it('morphs: the new figure\'s corners start where the old figure\'s were and settle on their own places', () => {
    const e = playing({ figure: 'cubes' }), cut = playing({ figure: 'cubes' })
    const old = Float32Array.from(e.base)
    const values: WireValues = { ...PLAIN, satellites: 2, figure: 'solids', transition: 'morph' }
    e.tick(tick({ reading: loud(61), values })); cut.tick(tick({ reading: loud(61), values: { ...values, transition: 'cut' } }))
    expect(e.shape.id).toBe('solids')
    expect(e.transitionKind).toBe('morph')
    const n = 8 * 3 // the first cube's corners
    expect(maxGap(e.base, old, 8)).toBeLessThan(.15) // still where the old corners were
    expect(maxGap(cut.base, old, 8)).toBeGreaterThan(.4) // a cut puts them elsewhere at once
    for (let f = 62; f < 62 + 60 * 3; f++) { e.tick(tick({ reading: loud(f), values })); cut.tick(tick({ reading: loud(f), values: { ...values, transition: 'cut' } })) }
    expect(e.transitionKind).toBeNull()
    expect(maxGap(e.base, cut.base, verticesOfGroups(e.shape, 3))).toBeLessThan(1e-4)
    expect(n).toBeGreaterThan(0)
  })

  it('zooms through: the figure swells past the screen and fades at the swap, then the new one arrives from afar', () => {
    const e = playing({ figure: 'cubes' })
    const values: WireValues = { ...PLAIN, satellites: 2, figure: 'tesseract', transition: 'zoom' }
    let biggest = 1, dimmest = 1
    for (let f = 61; f < 61 + 60 * 3; f++) { e.tick(tick({ reading: loud(f), values })); biggest = Math.max(biggest, internals(e).zoom); dimmest = Math.min(dimmest, internals(e).fade) }
    expect(biggest).toBeGreaterThan(5)
    expect(dimmest).toBeLessThan(.3)
    expect(internals(e).zoom).toBe(1)
    expect(internals(e).fade).toBe(1)
    expect(e.shape.id).toBe('tesseract')
  })

  it('glitches: the picture tears for a moment, then is exactly whole again', () => {
    const e = playing({ figure: 'cubes' })
    const values: WireValues = { ...PLAIN, satellites: 2, figure: 'solids', transition: 'glitch' }
    let torn = 0
    for (let f = 61; f < 61 + 90; f++) { e.tick(tick({ reading: loud(f), values })); torn = Math.max(torn, internals(e).glitch) }
    expect(torn).toBeGreaterThan(.5)
    expect(internals(e).glitch).toBe(0)
    const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
    for (let k = 0; k < 500; k++) { e.signal(e.letters[0], 0, k / 500, 0, 0, out); expect(Number.isFinite(out.x)).toBe(true) }
  })

  it('Auto uses all four styles in turn', () => {
    const e = playing({ figure: 'cubes' })
    const seen = new Set<string>()
    let figure: WireValues['figure'] = 'cubes'
    for (let round = 0; round < 8; round++) {
      figure = figure === 'cubes' ? 'solids' : 'cubes'
      for (let f = 0; f < 60 * 2; f++) { e.tick(tick({ reading: loud(f), values: { ...PLAIN, satellites: 2, figure, transition: 'auto' } })); if (e.transitionKind) seen.add(e.transitionKind) }
    }
    expect([...seen].sort()).toEqual(['glitch', 'morph', 'shatter', 'zoom'])
  })

  it('never runs two at once: a second request waits until the first has finished', () => {
    const e = playing({ figure: 'cubes' })
    const values: WireValues = { ...PLAIN, satellites: 2, figure: 'solids', transition: 'shatter' }
    e.tick(tick({ values })); e.fx.fire('zoom', 1); e.fx.fire('glitch', 1)
    e.tick(tick({ values }))
    expect(e.transitionKind).toBe('shatter')
    expect(e.fx.transitions).toHaveLength(0) // requests that arrive mid-transition are dropped, not queued up
    expect(internals(e).transition.active).toBe(true)
  })
})

describe('reactions', () => {
  it('has a trigger for each kind of audio intelligence and a reaction for each thing the figure can do', () => {
    expect(WIRE_TRIGGER_OPTIONS.map(o => o.value)).toEqual(expect.arrayContaining(['kick', 'snare', 'hat', 'beat', 'downbeat', 'bar4', 'bar8', 'phrase', 'section', 'drop', 'buildStart', 'chord', 'energyPeak', 'bassPeak']))
    expect(WIRE_REACTION_OPTIONS.map(o => o.value)).toEqual(expect.arrayContaining(['punch', 'flash', 'shockwave', 'spinKick', 'colorPulse', 'echoBurst', 'starBurst', 'bgPulse', 'shatter', 'morph', 'glitch', 'zoom']))
    // The default show reacts to drums, the grid, the structure and the harmony.
    const triggers = new Set(DEFAULT_WIRE_RULES.map(r => r.trigger))
    for (const t of ['kick', 'snare', 'beat', 'downbeat', 'bar4', 'phrase', 'section', 'drop', 'buildStart', 'chord', 'energyPeak']) expect(triggers.has(t as never), t).toBe(true)
  })

  it('reads stored rules safely: defaults for a non-list, junk dropped, ids made unique, amounts clamped, a list capped, and an emptied list kept', () => {
    expect(normalizeWireRules(undefined)).toEqual(DEFAULT_WIRE_RULES)
    expect(normalizeWireRules('x')).toEqual(DEFAULT_WIRE_RULES)
    expect(normalizeWireRules([])).toEqual([])
    const out = normalizeWireRules([
      { id: 'a', trigger: 'kick', reaction: 'punch', amount: 9, every: 3 }, { id: 'a', trigger: 'drop', reaction: 'nothing' }, { trigger: 'bogus', reaction: 'flash' }, null,
      { id: 'a', trigger: 'beat', reaction: 'flash', amount: -2, every: 4, enabled: false },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ id: 'a', amount: 1.5, every: 1, enabled: true })
    expect(out[1]).toMatchObject({ amount: 0, every: 4, enabled: false })
    expect(new Set(out.map(r => r.id)).size).toBe(2)
    expect(normalizeWireRules(Array.from({ length: 40 }, () => ({ trigger: 'kick', reaction: 'punch' })))).toHaveLength(MAX_WIRE_RULES)
  })

  const rule = (over: Partial<WireRule> = {}): WireRule => ({ id: 'r', enabled: true, trigger: 'kick', reaction: 'punch', amount: 1, every: 1, ...over })

  it('fires a rule when its trigger happens, at the strength asked for, and says what it did', () => {
    const fx = new WireFx()
    fx.apply([rule()], { ...NO_EVENTS, kick: 1 })
    expect(fx.punch).toBeCloseTo(1, 6)
    expect(fx.lastFired).toBe('Kick → Camera punch')
    expect(fx.fired).toBe(1)
    const soft = new WireFx(); soft.apply([rule({ amount: .5 })], { ...NO_EVENTS, kick: 1 })
    expect(soft.punch).toBeCloseTo(.5, 6)
    const none = new WireFx(); none.apply([rule({ trigger: 'snare' })], { ...NO_EVENTS, kick: 1 })
    expect(none.punch).toBe(0)
    const off = new WireFx(); off.apply([rule({ enabled: false })], { ...NO_EVENTS, kick: 1 })
    expect(off.punch).toBe(0)
  })

  it('fires on every Nth time with "How Often"', () => {
    const fx = new WireFx(), fired: number[] = []
    for (let i = 0; i < 8; i++) { fx.punch = 0; fx.apply([rule({ every: 4 })], { ...NO_EVENTS, kick: 1 }); if (fx.punch > 0) fired.push(i) }
    expect(fired).toEqual([0, 4])
  })

  it('does nothing at Audio Reactivity zero and hits softer below one', () => {
    const off = new WireFx(); off.apply([rule()], { ...NO_EVENTS, kick: 1 }, 0)
    expect(off.punch).toBe(0)
    const half = new WireFx(); half.apply([rule()], { ...NO_EVENTS, kick: 1 }, .5)
    expect(half.punch).toBeCloseTo(.5, 6)
  })

  it('does each reaction: the envelopes, the rings (at most three) and the transition requests', () => {
    const fx = new WireFx()
    for (const reaction of ['punch', 'flash', 'spinKick', 'colorPulse', 'echoBurst', 'starBurst', 'bgPulse'] as const) fx.fire(reaction, 1)
    expect(fx.punch).toBe(1); expect(fx.flash).toBe(1); expect(fx.spin).toBeGreaterThan(.5); expect(Math.abs(fx.hue)).toBeGreaterThan(30)
    expect(fx.echo).toBe(1); expect(fx.stars).toBe(1); expect(fx.background).toBe(1)
    for (let i = 0; i < 5; i++) fx.fire('shockwave', 1)
    expect(fx.rings).toHaveLength(3)
    for (const kind of WIRE_TRANSITION_KINDS) fx.fire(kind, 1)
    expect(fx.transitions.map(t => t.kind)).toEqual(['shatter', 'morph', 'glitch', 'zoom'])
    for (let i = 0; i < 1500; i++) fx.step(1 / 60)
    expect([fx.punch, fx.flash, fx.spin, fx.hue, fx.echo, fx.stars, fx.background]).toEqual([0, 0, 0, 0, 0, 0, 0])
    expect(fx.rings).toHaveLength(0)
  })

  it('alternates the colour pulse\'s direction so repeated pulses do not drift one way', () => {
    const fx = new WireFx(); fx.fire('colorPulse', 1); const first = fx.hue; fx.fire('colorPulse', 1)
    expect(Math.sign(fx.hue)).toBe(-Math.sign(first))
  })

  it('detects builds, energy peaks and bass peaks once as they rise, and re-arms only after they fall', () => {
    const fx = new WireFx()
    const hits = (build: number, energy: number, bass: number) => { const e = fx.detect({}, build, energy, bass); return [e.buildStart, e.energyPeak, e.bassPeak] }
    expect(hits(0, 0, 0)).toEqual([0, 0, 0])
    expect(hits(.35, .9, .9)).toEqual([1, 1, 1])
    expect(hits(.5, .95, .95)).toEqual([0, 0, 0]) // still up: no repeat
    expect(hits(.2, .7, .6)).toEqual([0, 0, 0]) // not yet low enough to re-arm
    expect(hits(.05, .4, .3)).toEqual([0, 0, 0]) // re-armed
    expect(hits(.4, .9, .9)).toEqual([1, 1, 1])
  })

  it('does what the default rules say in the engine: a kick punches the figure, a drop shatters it and sends stars and a ring, a section tears it', () => {
    const base = playing({ figure: 'cubes' })
    const baseSize = coreRadius(base)
    const kicked = playing({ figure: 'cubes' })
    kicked.tick(tick({ reading: { ...loud(61), hits: { kick: 1, snare: 0, hat: 0 } }, values: { ...PLAIN, satellites: 2 } }))
    expect(kicked.fx.punch).toBeGreaterThan(.3)
    expect(coreRadius(kicked)).toBeGreaterThan(baseSize * 1.1)

    const dropped = playing({ figure: 'cubes' })
    dropped.tick(tick({ reading: loud(61), cue: { ...emptyWireCue(), drop: true }, values: { ...PLAIN, satellites: 2 } }))
    dropped.tick(tick({ reading: loud(62), values: { ...PLAIN, satellites: 2 } }))
    expect(dropped.transitionKind).toBe('shatter')
    expect(dropped.fx.stars).toBeGreaterThan(.5)
    expect(dropped.fx.rings.length).toBeGreaterThan(0)
    expect(dropped.fx.flash).toBeGreaterThan(.3)

    const sectioned = playing({ figure: 'cubes' })
    sectioned.tick(tick({ reading: loud(61), cue: { ...emptyWireCue(), boundaries: { ...NO_BOUNDARIES, section: true, id: 'section:x' } }, values: { ...PLAIN, satellites: 2 } }))
    expect(sectioned.transitionKind).toBe('glitch')
  })

  it('uses the user\'s own rules, and an empty list does nothing at all', () => {
    const custom: WireRule[] = [{ id: 'mine', enabled: true, trigger: 'hat', reaction: 'echoBurst', amount: 1, every: 1 }]
    const e = new WireEngine()
    e.tick(tick({ reading: { ...loud(0), hits: { kick: 1, snare: 0, hat: 1 } }, rules: custom }))
    expect(e.fx.echo).toBeGreaterThan(.5)
    expect(e.fx.punch).toBe(0) // the default kick rule is not in the list
    const empty = new WireEngine()
    empty.tick(tick({ reading: { ...loud(0), hits: { kick: 1, snare: 1, hat: 1 } }, rules: [] }))
    expect(empty.fx.fired).toBe(0)
  })

  it('does not react at Audio Reactivity zero (the clean figure stays clean)', () => {
    const e = new WireEngine()
    for (let f = 0; f < 90; f++) e.tick(tick({ reading: loud(f), values: { ...PLAIN, audioReactivity: 0 }, cue: { ...emptyWireCue(), drop: f === 40 } }))
    expect(e.fx.fired).toBe(0)
    expect(e.transitionKind).toBeNull()
  })
})

describe('backgrounds', () => {
  const drive = (over: Partial<WireBackgroundDrive> = {}): WireBackgroundDrive => ({ flow: 3.3, turn: 5, pulse: 0, bass: 0, mid: .25, burst: 0, amount: .6, tilt: .3, perspective: .45, ...over })
  const draw = (id: WireBackgroundId, d = drive(), burst = 0) => { const out = new WireBackgroundPath(); emitBackground(out, id, d, burst); return out }

  it('offers none, the four layers, and all of them together', () => {
    expect(WIRE_BACKGROUND_OPTIONS.map(o => o.value)).toEqual(['none', 'tunnel', 'floor', 'shells', 'stars', 'all'])
    expect(WIRE_BACKGROUND_LAYERS).toEqual(['tunnel', 'floor', 'shells', 'stars'])
  })

  it('draws nothing for None or at zero brightness, and something finite and on the stage for every layer', () => {
    expect(draw('none').count).toBe(0)
    for (const id of WIRE_BACKGROUND_LAYERS) expect(draw(id, drive({ amount: 0 })).count, id).toBe(0)
    for (const id of [...WIRE_BACKGROUND_LAYERS, 'all'] as const) {
      const out = draw(id)
      expect(out.count, id).toBeGreaterThan(10)
      for (let i = 0; i < out.count; i++) {
        expect(Number.isFinite(out.x[i]) && Number.isFinite(out.y[i]) && Number.isFinite(out.gain[i]), `${id} ${i}`).toBe(true)
        expect(Math.abs(out.x[i]), id).toBeLessThan(2.4)
        expect(Math.abs(out.y[i]), id).toBeLessThan(2.4)
        expect(out.gain[i], id).toBeLessThanOrEqual(.6)
      }
      // Every line ends, so the beam never joins two shapes with a visible stroke.
      expect(out.end[out.count - 1]).toBe(1)
    }
  })

  it('is repeatable and moves with the flow clock', () => {
    for (const id of WIRE_BACKGROUND_LAYERS) {
      const a = draw(id), b = draw(id), later = draw(id, drive({ flow: 3.9, turn: 5.8 }))
      expect(Array.from(a.x.slice(0, a.count))).toEqual(Array.from(b.x.slice(0, b.count)))
      const moved = Array.from(a.x.slice(0, Math.min(a.count, later.count))).some((x, i) => Math.abs(x - later.x[i]) > 1e-4) || a.count !== later.count
      expect(moved, id).toBe(true)
    }
  })

  it('reacts: the bass lifts the floor, the pulse swells the tunnel, the mids twist it, a burst sends the stars flying', () => {
    const rows = (d: WireBackgroundDrive) => { const o = draw('floor', d); return Array.from(o.y.slice(0, o.count)) }
    expect(rows(drive({ bass: 1 })).some((y, i) => Math.abs(y - rows(drive())[i]) > .02)).toBe(true)
    const size = (d: WireBackgroundDrive) => { const o = draw('tunnel', d); let m = 0; for (let i = 0; i < o.count; i++) m += Math.hypot(o.x[i], o.y[i]); return m }
    expect(size(drive({ pulse: 1 }))).toBeGreaterThan(size(drive()) * 1.02)
    const xs = (d: WireBackgroundDrive) => { const o = draw('tunnel', d); return Array.from(o.x.slice(0, o.count)) }
    expect(xs(drive({ mid: 1 })).some((x, i) => Math.abs(x - xs(drive({ mid: 0 }))[i]) > .01)).toBe(true)
    const stars = (burst: number, flow: number) => { const o = draw('stars', drive({ burst }), flow); return Array.from(o.x.slice(0, o.count)) }
    expect(stars(1, 4).some((x, i) => Math.abs(x - stars(0, 0)[i]) > .05)).toBe(true)
  })

  it('draws every layer with the figure in the engine: dim, finite, on the stage, with blank hops between lines', () => {
    for (const background of [...WIRE_BACKGROUND_LAYERS, 'all'] as const) {
      const e = playing({ figure: 'solids', background, backgroundAmount: .8 }, 90)
      expect(e.bg.count, background).toBeGreaterThan(10)
      const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
      let blanked = 0, brightest = 0
      for (let k = 0; k < 6000; k++) {
        e.signal(e.letters[0], 0, k / 6000, 0, 0, out)
        expect(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.energy)).toBe(true)
        expect(Math.abs(out.x)).toBeLessThan(2.6)
        if (out.z === 0) blanked++
        else brightest = Math.max(brightest, out.energy)
      }
      expect(blanked, background).toBeGreaterThan(0)
      expect(brightest, background).toBeLessThan(30)
    }
  })

  it('keeps the figure bright with a background behind it', () => {
    const peak = (background: WireValues['background']) => {
      const e = playing({ figure: 'cubes', background, backgroundAmount: .6 }, 90)
      const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
      let total = 0
      for (let k = 0; k < 6000; k++) { e.signal(e.letters[0], 0, k / 6000, 0, 0, out); total += out.energy }
      return total
    }
    // Everything the beam draws adds light; the figure itself is not dimmed to nothing by the extra lines.
    expect(peak('all')).toBeGreaterThan(peak('none') * .8)
  })
})

describe('Auto Performance chooses everything', () => {
  const mood = (over: Partial<WireMood> = {}): WireMood => ({ ...NEUTRAL_MOOD, ...over })
  const calm = mood({ energy: .15, level: .15, tension: .05, complexity: .1, brightness: .35, sectionType: 'breakdown', structured: true, phraseIndex: 3, confidence: .8 })
  const tense = mood({ energy: .65, level: .6, tension: .8, build: .7, complexity: .55, brightness: .6, sectionType: 'build', structured: true, phraseIndex: 4, confidence: .8 })
  const groove = mood({ energy: .6, level: .55, tension: .2, complexity: .4, brightness: .5, sectionType: 'verse', structured: true, phraseIndex: 5, confidence: .8 })
  const peak = mood({ energy: .95, level: .9, tension: .85, build: .9, drop: .95, complexity: .8, flux: .8, brightness: .7, sectionType: 'drop', structured: true, phraseIndex: 6, confidence: .9 })

  function run(moods: WireMood[], seconds = 5, seed = 7, rounds = 30) {
    const c = new WireConductor(), backgrounds = new Set<string>(), transitions = new Set<string>()
    for (let r = 0; r < rounds; r++) {
      const m = moods[r % moods.length]
      const drop = m === peak
      for (let f = 0; f < seconds * 60; f++) {
        const out = c.update({
          dt: 1 / 60, playing: true, auto: true, mood: m, base: PLAIN, drop: drop && f === 0, gridConfident: true, trackIdentity: 't', seed, discontinuity: false,
          boundaries: f === 0 ? { section: true, phrase: true, bar4: true, bar8: true, id: `b${r}` } : NO_BOUNDARIES,
        })
        backgrounds.add(out.values.background); transitions.add(out.values.transition)
      }
    }
    return { backgrounds, transitions }
  }

  it('picks among all four background layers and all four transitions as the music changes', () => {
    const { backgrounds, transitions } = run([calm, groove, tense, peak])
    for (const layer of WIRE_BACKGROUND_LAYERS) expect(backgrounds.has(layer), layer).toBe(true)
    expect([...transitions].sort()).toEqual(['glitch', 'morph', 'shatter', 'zoom'])
  })

  it('suits them to the passage: shells for a calm breakdown, the tunnel for a tense build, more of everything at a peak', () => {
    const only = (m: WireMood) => run([m], 6, 7, 8).backgrounds
    expect(only(calm).has('shells')).toBe(true)
    expect(only(tense).has('tunnel')).toBe(true)
    expect([...run([peak], 6, 7, 8).backgrounds].some(b => b === 'all' || b === 'stars')).toBe(true)
  })

  it('is repeatable: the same track, seed and boundaries make the same choices', () => {
    const sig = (seed: number) => { const { backgrounds, transitions } = run([calm, tense, peak, groove], 5, seed, 12); return `${[...backgrounds]}|${[...transitions]}` }
    expect(sig(7)).toBe(sig(7))
  })

  it('hits much harder when a drop lands than it sits at afterwards: the shock goes well past the sustained peak, then falls back', () => {
    const c = new WireConductor()
    const step = (m: WireMood, drop: boolean) => c.update({ dt: 1 / 60, playing: true, auto: true, mood: m, base: PLAIN, drop, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false, boundaries: drop ? { section: true, phrase: true, bar4: true, bar8: true, id: 'drop' } : NO_BOUNDARIES })
    for (let f = 0; f < 180; f++) step(calm, false)
    const before = step(calm, false).values
    let hit = step(peak, true)
    for (let f = 0; f < 12; f++) hit = step(peak, false)
    const calmChaos = before.chaos, calmGlow = before.glow
    expect(hit.shock).toBeGreaterThan(.6)
    expect(hit.values.chaos).toBeGreaterThanOrEqual(.95)
    expect(hit.values.waveDepth).toBeGreaterThan(.45)
    expect(hit.values.glow).toBeGreaterThan(calmGlow * 2.2)
    expect(Math.abs(hit.values.spin)).toBeGreaterThan(1.2)
    expect(hit.values.chaos).toBeGreaterThan(calmChaos + .5)
    expect(hit.values.satellites).toBeGreaterThanOrEqual(3)
    expect(hit.values.backgroundAmount).toBeGreaterThan(before.backgroundAmount * 1.8)
    let later = hit
    for (let f = 0; f < 60 * 8; f++) later = step(peak, false)
    expect(later.shock).toBeLessThan(.05)
    expect(Math.abs(hit.values.spin)).toBeGreaterThan(Math.abs(later.values.spin) + .3)
    expect(hit.values.waveDepth).toBeGreaterThan(later.values.waveDepth + .05)
    expect(later.values.chaos).toBeLessThanOrEqual(.91) // the sustained peak is capped for readability
  })

  it('leaves the user\'s background and transition alone when Auto Performance is off', () => {
    const c = new WireConductor()
    const out = c.update({ dt: 1 / 60, playing: true, auto: false, mood: peak, base: { ...PLAIN, background: 'tunnel', transition: 'zoom' }, drop: true, gridConfident: true, trackIdentity: 't', seed: 7, discontinuity: false, boundaries: NO_BOUNDARIES })
    expect(out.values.background).toBe('tunnel')
    expect(out.values.transition).toBe('zoom')
  })
})

describe('the build pulse', () => {
  it('swells the figure in time with the beat, faster and harder as the build climbs, and not at all with no build', () => {
    const pulses = (build: number) => {
      const e = new WireEngine(); const seen: number[] = []
      for (let f = 0; f < 360; f++) {
        e.tick(tick({ reading: loud(f), mood: { ...NEUTRAL_MOOD, build, energy: .6 }, values: { ...PLAIN, bpmSync: true }, cue: { ...emptyWireCue(), bpm: 120, bpmValid: true, absoluteBeat: f / 60 * 2 } as WireCue }))
        seen.push(e.pulse)
      }
      return seen
    }
    const none = pulses(0), early = pulses(.4), late = pulses(.95)
    expect(Math.max(...none)).toBe(0)
    expect(Math.max(...early)).toBeGreaterThan(.1)
    expect(Math.max(...late)).toBeGreaterThan(Math.max(...early))
    const peaks = (xs: number[]) => xs.filter((x, i) => i > 0 && x > xs[i - 1] + .08).length
    expect(peaks(late)).toBeGreaterThan(peaks(early))
  })
})

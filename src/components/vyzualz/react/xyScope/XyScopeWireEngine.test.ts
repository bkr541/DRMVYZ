import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { emptyOsc1Features, type Osc1Features } from './XyScopeOsc1Engine'
import { buildWireReading, deriveWireCue, emptyWireCue, type WireCue } from './XyScopeWireCues'
import { WireEngine, type WireTick } from './XyScopeWireEngine'
import { NO_BOUNDARIES } from './XyScopeWireDirector'
import { silentReading, type WireReading } from './XyScopeWireModulation'
import { shapeHash, verticesOfGroups } from './XyScopeWireShape'
import { CUBES_PRESET_ID, SOLIDS_PRESET_ID, TESSERACT_PRESET_ID, DEFAULT_WIRE_SETTINGS, normalizeWireSettings, normalizeWireValues, WIRE_DEFAULTS, type WireValues } from './XyScopeWireSettings'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings, XY_SCOPE_PRESETS } from './XyScopeSettings'
/** The figure alone: no background, and no transition when the figure changes (these tests are about the figure). */
const NOBG: WireValues = { ...WIRE_DEFAULTS, background: 'none', transition: 'cut' }

type Overrides = Omit<Partial<SharedPerformanceContext>, 'boundaries' | 'capabilities' | 'confidence'> & {
  boundaries?: Partial<SharedPerformanceContext['boundaries']>
  capabilities?: Partial<SharedPerformanceContext['capabilities']>
  confidence?: Partial<SharedPerformanceContext['confidence']>
}
function context(over: Overrides = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(10)
  const { boundaries, capabilities, confidence, ...rest } = over
  return { ...base, ...rest, boundaries: { ...base.boundaries, ...boundaries }, capabilities: { ...base.capabilities, ...capabilities }, confidence: { ...base.confidence, ...confidence } }
}

const live = (over: Partial<WireReading> = {}, level = .7): WireReading => ({
  ...silentReading(), playing: true, confidence: .9,
  features: { sub: level, bass: level, lowMid: level, mid: level, air: level, flux: level, level },
  available: { sub: true, bass: true, lowMid: true, mid: true, air: true, flux: true, level: true },
  ...over,
})
const tick = (over: Partial<WireTick> = {}): WireTick => ({ dt: 1 / 60, reading: live(), cue: emptyWireCue(), values: NOBG, auto: false, discontinuity: false, ...over })
/** A pulsing, kick-driven track: features swing and a kick lands every half second. */
function track(frame: number): WireReading {
  const swing = .5 + .5 * Math.sin(frame / 60 * 7)
  const hit = frame % 30 === 0
  return live({ features: { sub: swing, bass: swing, lowMid: swing, mid: swing * .8, air: swing * .6, flux: swing, level: .4 + swing * .5 }, hits: { kick: hit ? 1 : 0, snare: frame % 60 === 30 ? .9 : 0, hat: 0 } })
}
function run(engine: WireEngine, frames: number, over: (frame: number) => Partial<WireTick> = () => ({}), reading = track) {
  for (let f = 0; f < frames; f++) engine.tick(tick({ reading: reading(f), ...over(f) }))
}
/** One scan of the beam path. */
function scan(engine: WireEngine, samples = 3000) {
  const out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
  const points: { x: number; y: number; z: number; energy: number }[] = []
  for (let k = 0; k < samples; k++) { engine.signal(engine.letters[0], 0, k / samples, 0, 0, out); points.push({ x: out.x, y: out.y, z: out.z, energy: out.energy }) }
  return points
}
const maxGap = (a: Float32Array, b: Float32Array, vertices: number) => { let m = 0; for (let i = 0; i < vertices * 3; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m }

describe('WIREFRAME settings', () => {
  it('defaults to the safe, readable figure and clamps and rounds stored values', () => {
    expect(DEFAULT_WIRE_SETTINGS.autoPerformance).toBe(false)
    expect(WIRE_DEFAULTS.flashLimit).toBe(true)
    expect(WIRE_DEFAULTS.readableFloor).toBe(.72)
    expect(WIRE_DEFAULTS.backgroundColor).toBe('#000000')
    expect(normalizeWireSettings(undefined)).toEqual({ ...DEFAULT_WIRE_SETTINGS, values: WIRE_DEFAULTS })
    expect(normalizeWireValues({ satellites: 9.4, duplicates: 0, seed: 12.6, spread: 0, color: 'green', hiddenEdges: 'x', travel: 'dim', sceneEvery: 'bar4', flashLimit: 'no', glowColor: '#ABCDEF' }))
      .toMatchObject({ satellites: 4, duplicates: 1, seed: 13, spread: .6, color: WIRE_DEFAULTS.color, hiddenEdges: 'dim', travel: 'dim', sceneEvery: 'bar4', flashLimit: true, glowColor: '#abcdef' })
  })

  it('is its own source: choosing CUBES switches the engine, the two agree, and it offers one preset per figure', () => {
    const next = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, CUBES_PRESET_ID)
    expect(next.sourceMode).toBe('wire')
    expect(next.presetId).toBe('cubes')
    expect(normalizeXyScopeSettings({ ...next, presetId: 'conversation' }).presetId).toBe('cubes')
    expect(normalizeXyScopeSettings({ ...next, sourceMode: 'oscillator' }).presetId).toBe('conversation')
    expect(XY_SCOPE_PRESETS.filter(preset => preset.source === 'wire').map(preset => preset.id)).toEqual(['cubes', 'solids', 'tesseract'])
    expect(normalizeXyScopeSettings({ sourceMode: 'wire' }).wire).toEqual({ ...DEFAULT_WIRE_SETTINGS, values: WIRE_DEFAULTS })
  })
})

describe('WIREFRAME figures and presets', () => {
  it('has a preset per figure: choosing one switches the engine and the figure, and keeps the rest of the user\'s settings', () => {
    const tuned = { ...DEFAULT_XY_SCOPE_SETTINGS, wire: { ...DEFAULT_XY_SCOPE_SETTINGS.wire, values: { ...NOBG, chaos: .8, color: '#ff00aa' } } }
    for (const [id, figure] of [[SOLIDS_PRESET_ID, 'solids'], [TESSERACT_PRESET_ID, 'tesseract'], [CUBES_PRESET_ID, 'cubes']] as const) {
      const next = applyXyScopePreset(tuned, id)
      expect(next.sourceMode).toBe('wire')
      expect(next.presetId).toBe(id)
      expect(next.wire.values.figure).toBe(figure)
      expect(next.wire.values.chaos).toBe(.8)
      expect(next.wire.values.color).toBe('#ff00aa')
      // A saved project keeps whichever WIREFRAME preset it had.
      expect(normalizeXyScopeSettings(next).presetId).toBe(id)
    }
    // Leaving WIREFRAME forgets its preset, like every other instrument.
    expect(normalizeXyScopeSettings({ ...applyXyScopePreset(tuned, SOLIDS_PRESET_ID), sourceMode: 'oscillator' }).presetId).toBe('conversation')
  })

  it('makes every preset a whole show: its own figure, background and transition, with the default reactions', () => {
    const looks = [[CUBES_PRESET_ID, 'cubes', 'floor', 'glitch'], [SOLIDS_PRESET_ID, 'solids', 'shells', 'morph'], [TESSERACT_PRESET_ID, 'tesseract', 'tunnel', 'zoom']] as const
    for (const [id, figure, background, transition] of looks) {
      const next = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, id)
      expect(next.wire.values).toMatchObject({ figure, background, transition })
      expect(next.wire.values.backgroundAmount).toBeGreaterThan(0)
      expect(next.wire.rules.length).toBeGreaterThan(8)
    }
    // Choosing a preset keeps the user's own reactions.
    const mine = { ...DEFAULT_XY_SCOPE_SETTINGS, wire: { ...DEFAULT_XY_SCOPE_SETTINGS.wire, rules: [] } }
    expect(applyXyScopePreset(mine, SOLIDS_PRESET_ID).wire.rules).toEqual([])
  })

  it('stores the background, the transition and the rules, and cleans them on the way in', () => {
    expect(normalizeWireValues({ background: 'stars', transition: 'zoom' })).toMatchObject({ background: 'stars', transition: 'zoom' })
    expect(normalizeWireValues({ background: 'lava', transition: 'wipe', backgroundAmount: 4 })).toMatchObject({ background: 'floor', transition: 'glitch', backgroundAmount: 1 })
    expect(normalizeWireSettings({ rules: [{ id: 'x', trigger: 'drop', reaction: 'shatter', amount: 1 }, { trigger: 'nope', reaction: 'flash' }] }).rules).toEqual([{ id: 'x', enabled: true, trigger: 'drop', reaction: 'shatter', amount: 1, every: 1 }])
    expect(normalizeWireSettings({}).rules.length).toBeGreaterThan(8)
    expect(normalizeWireSettings({ rules: [] }).rules).toEqual([])
  })

  it('clamps and defaults the new controls: the figure, the oscillator mix and chaos', () => {
    expect(WIRE_DEFAULTS).toMatchObject({ figure: 'cubes', chaos: .5, waveOscillator: .6 })
    expect(normalizeWireValues({ figure: 'torus', chaos: 9, waveOscillator: -3, waveDepth: 5 })).toMatchObject({ figure: 'cubes', chaos: 1, waveOscillator: 0, waveDepth: .6 })
    expect(normalizeWireValues({ figure: 'tesseract' }).figure).toBe('tesseract')
  })
})

describe('WIREFRAME cues (what the figure is told about the music)', () => {
  it('knows nothing of sections on a context with no analysed track, so a live microphone never has any', () => {
    const cue = deriveWireCue(context({ capabilities: { sections: false, beatGrid: true }, bpm: 124 }), null)
    expect(cue.structure).toBeNull()
    expect(cue.bpmValid).toBe(true)
  })

  it('reads structure from an analysed track and names each boundary once', () => {
    const analysed = context({ analysisIdentity: 'a:1', sectionConfidence: .9, buildProgress: .6, capabilities: { sections: true, beatGrid: true }, bpm: 128, barIndex: 8, boundaries: { eightBarBoundary: true, fourBarBoundary: true } })
    const cue = deriveWireCue(analysed, null)
    expect(cue.structure?.confidence).toBeGreaterThan(.55)
    expect(cue.structure?.build).toBeGreaterThanOrEqual(.6)
    expect(cue.boundaries.bar8 && cue.boundaries.bar4).toBe(true)
    expect(cue.boundaries.id).toBe('bar8:8|bar4:8')
    expect(deriveWireCue(context({ barIndex: 9 }), null).boundaries.id).toBe('')
  })

  it('detects a drop and a new phrase by comparing with the frame before', () => {
    const before = context({ dropOccurrence: 1, phraseIndex: 2 })
    expect(deriveWireCue(context({ dropOccurrence: 2, phraseIndex: 3 }), before)).toMatchObject({ drop: true, boundaries: { phrase: true, id: 'phrase:3' } })
    expect(deriveWireCue(context({ dropOccurrence: 1, phraseIndex: 2 }), before)).toMatchObject({ drop: false, boundaries: { phrase: false } })
    expect(deriveWireCue(context({ dropOccurrence: 2 }), null).drop).toBe(false)
  })

  it('does not call a beat grid reliable without evidence for it', () => {
    expect(deriveWireCue(context({ capabilities: { beatGrid: false }, confidence: { grid: .9, rhythm: .9 } }), null).gridConfident).toBe(false)
    expect(deriveWireCue(context({ capabilities: { beatGrid: true }, confidence: { grid: .2, rhythm: .2 } }), null).gridConfident).toBe(false)
    expect(deriveWireCue(context({ capabilities: { beatGrid: true }, confidence: { grid: .8, rhythm: .2 } }), null).gridConfident).toBe(true)
    expect(deriveWireCue(null, null)).toEqual(emptyWireCue())
  })

  it('marks features unavailable rather than zero when they are not measurements, and says nothing while stopped', () => {
    const features: Osc1Features = { ...emptyOsc1Features(), bass: .6, mid: .4, level: .5 }
    const fromStereo = buildWireReading(null, features, { kick: 1, snare: 0, hat: 0 }, true)
    expect(fromStereo.available).toMatchObject({ bass: true, sub: false, lowMid: false })
    expect(fromStereo.hits.kick).toBe(0) // events come from the shared analysis only
    expect(buildWireReading(null, features, { kick: 0, snare: 0, hat: 0 }, false).playing).toBe(false)
    const shared = buildWireReading(context({ capabilities: { liveBands: false, rhythmEvents: false } }), null, { kick: 0, snare: 0, hat: 0 }, true)
    expect(shared.available).toMatchObject({ bass: false, flux: false, level: true })
  })
})

describe('the WIREFRAME engine', () => {
  const settled = () => { const engine = new WireEngine(); run(engine, 3); return engine }

  it('never touches its shape: the cubes hash the same after a long, loud, Auto Performance show', () => {
    const engine = new WireEngine()
    const hash = shapeHash(engine.shape)
    run(engine, 60 * 20, f => ({ auto: true, values: { ...NOBG, satellites: 4, duplicates: 3 }, cue: { ...emptyWireCue(), bpm: 128, bpmValid: true, gridConfident: true, trackIdentity: 't', boundaries: f % 480 === 0 ? { ...NO_BOUNDARIES, bar8: true, bar4: true, id: `bar8:${f}` } : NO_BOUNDARIES } }))
    expect(shapeHash(engine.shape)).toBe(hash)
  })

  it('keeps every corner within the anchor bound and the figure above its readability floor, however loud', () => {
    const engine = new WireEngine()
    const values: WireValues = { ...NOBG, maxDisplacement: .1, readableFloor: .78, bassResponse: 2, kickResponse: 2, midResponse: 2, lowMidResponse: 2, airResponse: 2, satellites: 4 }
    for (let f = 0; f < 60 * 8; f++) {
      engine.tick(tick({ values, reading: track(f) }))
      for (let k = 0; k < 5; k++) {
        const g = engine.shape.groups[k], scale = k === 0 ? 1 : .42
        for (let i = 0; i < 8; i++) {
          const v = (g.vertexStart + i) * 3
          const d = Math.hypot(engine.deformed[v] - engine.base[v], engine.deformed[v + 1] - engine.base[v + 1], engine.deformed[v + 2] - engine.base[v + 2])
          // The placement swells a satellite a little (its breathing is placement, not deformation), so measure against its largest size.
          expect(d).toBeLessThanOrEqual(.1 * engine.shape.edgeLength * scale * 1.2 + 1e-6)
        }
      }
      expect(engine.readability.score).toBeGreaterThanOrEqual(.78 - 1e-6)
    }
  })

  it('recovers exactly: once the music stops, every corner is back where it is placed', () => {
    const engine = new WireEngine()
    run(engine, 60 * 5)
    expect(maxGap(engine.deformed, engine.base, 24)).toBeGreaterThan(1e-3) // it really was deformed
    run(engine, 60 * 4, () => ({ reading: { ...silentReading(), playing: false } }), () => ({ ...silentReading(), playing: false }))
    expect(maxGap(engine.deformed, engine.base, verticesOfGroups(engine.shape, 1 + engine.effective.satellites))).toBe(0)
    expect(engine.readability.score).toBe(1)
    expect(engine.weight).toBe(1)
  })

  it('draws the clean figure at Audio Reactivity zero, whatever the music does', () => {
    const engine = new WireEngine()
    run(engine, 60 * 5, () => ({ values: { ...NOBG, audioReactivity: 0 } }))
    expect(maxGap(engine.deformed, engine.base, verticesOfGroups(engine.shape, 1 + engine.effective.satellites))).toBe(0)
    expect(engine.beamWidthBoost).toBe(0)
  })

  it('is deterministic: two engines fed the same music draw the same picture', () => {
    const a = new WireEngine(), b = new WireEngine()
    const over = (f: number): Partial<WireTick> => ({ auto: true, values: { ...NOBG, duplicates: 2 }, cue: { ...emptyWireCue(), bpm: 120, bpmValid: true, gridConfident: true, trackIdentity: 't', boundaries: f % 240 === 0 ? { ...NO_BOUNDARIES, bar8: true, id: `bar8:${f}` } : NO_BOUNDARIES } })
    run(a, 600, over); run(b, 600, over)
    expect(scan(a)).toEqual(scan(b))
    expect(a.sceneId).toBe(b.sceneId)
  })

  it('lays out one finite, continuous beam path inside the stage', () => {
    const engine = new WireEngine()
    run(engine, 90, () => ({ values: { ...NOBG, satellites: 4, perspective: 1 } }))
    const points = scan(engine)
    expect(points.length).toBeGreaterThan(0)
    for (const p of points) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.energy)).toBe(true)
      expect(Math.abs(p.x)).toBeLessThan(1.3)
      expect(Math.abs(p.y)).toBeLessThan(1.3)
    }
    // No jumps inside a stroke: lit neighbours are close together.
    let lit = 0
    for (let i = 1; i < points.length; i++) {
      if (points[i].z > 0 && points[i - 1].z > 0) { lit++; expect(Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)).toBeLessThan(.2) }
    }
    expect(lit).toBeGreaterThan(points.length / 2)
  })

  it('blanks the travel between cubes by default, dims it, or shows it', () => {
    const energyOf = (travel: WireValues['travel']) => { const e = settled(); e.tick(tick({ values: { ...NOBG, travel, satellites: 2 } })); return scan(e, 6000) }
    const blank = energyOf('blank'), dim = energyOf('dim'), visible = energyOf('visible')
    expect(blank.some(p => p.z === 0)).toBe(true)
    expect(dim.every(p => p.z > 0)).toBe(true)
    expect(visible.every(p => p.z > 0)).toBe(true)
    // The travel adds light: none when blanked, a little when dimmed, as much as an edge when visible.
    const total = (points: typeof blank) => points.reduce((sum, p) => sum + (p.z > 0 ? p.energy : 0), 0)
    expect(total(blank)).toBeLessThan(total(dim))
    expect(total(dim)).toBeLessThan(total(visible))
  })

  it('draws more of the beam for echoes and the source outline, which stay fainter than the figure', () => {
    const one = settled(); one.tick(tick({ values: { ...NOBG, duplicates: 1, outline: false } }))
    const more = settled(); more.tick(tick({ values: { ...NOBG, duplicates: 3, outline: true } }))
    expect(more.pointCount).toBeGreaterThan(one.pointCount * 3)
    // A longer path is brightened to keep each line as bright as before (one beam shares every scan); once that is divided out, the
    // echoes and the outline are never brighter than the figure.
    const brightest = (e: WireEngine) => Math.max(...scan(e, 4000).map(p => p.energy)) / e.energyScale
    expect(more.energyScale).toBeGreaterThan(one.energyScale)
    expect(brightest(more)).toBeLessThanOrEqual(brightest(one) * 1.001)
  })

  it('fades edges that are farther away and dims the ones hidden behind the figure', () => {
    const spread = (over: Partial<WireValues>) => { const e = settled(); e.tick(tick({ values: { ...NOBG, satellites: 0, outline: false, ...over } })); const en = scan(e, 4000).filter(p => p.z > 0).map(p => p.energy); return Math.max(...en) / Math.min(...en) }
    expect(spread({ depthCue: 0, hiddenEdges: 'show' })).toBeLessThan(spread({ depthCue: 1, hiddenEdges: 'show' }))
    expect(spread({ depthCue: 0, hiddenEdges: 'show' })).toBeLessThan(spread({ depthCue: 0, hiddenEdges: 'dim' }))
  })

  it('locks its turning to the track\'s beats with BPM Sync, and turns at a steady tempo without it', () => {
    const phaseOf = (e: WireEngine) => (e as unknown as { phase: number }).phase
    /** A beat grid at `bpm`: the cue's position in beats follows the clock, as the shared analysis reports it. */
    const turned = (bpm: number, sync: boolean, grid = true) => {
      const e = new WireEngine()
      for (let i = 0; i < 240; i++) e.tick(tick({ values: { ...NOBG, bpmSync: sync, spin: 1 }, cue: { ...emptyWireCue(), bpm, bpmValid: grid, absoluteBeat: grid ? i / 60 * bpm / 60 : null } }))
      return phaseOf(e)
    }
    expect(turned(160, true)).toBeGreaterThan(turned(80, true) * 1.9)
    // Locked: a full turn takes sixteen beats of the track, whatever the tempo.
    expect(turned(160, true)).toBeCloseTo(4 * 160 / 60 / 16, 1)
    expect(turned(80, true)).toBeCloseTo(4 * 80 / 60 / 16, 1)
    // Off: a steady tempo whatever the track.
    expect(turned(160, false)).toBeCloseTo(turned(80, false), 9)
    // A tempo that is only a guess (no beat grid) is not followed.
    expect(turned(180, true, false)).toBeCloseTo(turned(80, false), 9)
  })

  it('follows the beat grid\'s position, not just its tempo: a late grid pulls the figure back into step', () => {
    const phaseOf = (e: WireEngine) => (e as unknown as { phase: number }).phase
    const e = new WireEngine()
    for (let i = 0; i < 120; i++) e.tick(tick({ values: { ...NOBG, spin: 1 }, cue: { ...emptyWireCue(), bpm: 120, bpmValid: true, absoluteBeat: i / 60 * 2 } }))
    const before = phaseOf(e)
    // The grid says the track is a beat further on than the clock thought (the track was nudged): the figure catches up.
    for (let i = 120; i < 150; i++) e.tick(tick({ values: { ...NOBG, spin: 1 }, cue: { ...emptyWireCue(), bpm: 120, bpmValid: true, absoluteBeat: i / 60 * 2 + 1 } }))
    expect(phaseOf(e) - before).toBeGreaterThan(30 / 60 * 2 / 16 + .02)
  })

  it('holds perfectly still when no music is playing, and turns only while it plays', () => {
    const phaseOf = (e: WireEngine) => (e as unknown as { phase: number }).phase
    const e = new WireEngine()
    for (let i = 0; i < 120; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, spin: 2 } }))
    expect(phaseOf(e)).toBe(0)
    expect(e.motion).toBe(0)
    const still = Float32Array.from(e.base)
    for (let i = 0; i < 60; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, spin: 2 } }))
    expect(maxGap(e.base, still, 24)).toBe(0)
    // It moves while the track plays, and comes to a halt again when it stops (easing, not freezing mid-frame).
    for (let i = 0; i < 120; i++) e.tick(tick({ reading: track(i), values: { ...NOBG, spin: 2 } }))
    expect(phaseOf(e)).toBeGreaterThan(.05)
    for (let i = 0; i < 240; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, spin: 2 } }))
    const stopped = phaseOf(e)
    for (let i = 0; i < 60; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, spin: 2 } }))
    expect(phaseOf(e)).toBe(stopped)
    expect(e.motion).toBe(0)
  })

  it('stops the figure\'s slow motion (breathing, tumbling, wandering) with the music too', () => {
    const e = new WireEngine()
    for (let i = 0; i < 120; i++) e.tick(tick({ reading: track(i), values: { ...NOBG, satellites: 2, chaos: 1 } }))
    for (let i = 0; i < 300; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, satellites: 2, chaos: 1 } }))
    const still = Float32Array.from(e.base)
    for (let i = 0; i < 180; i++) e.tick(tick({ reading: silentReading(), values: { ...NOBG, satellites: 2, chaos: 1 } }))
    expect(maxGap(e.base, still, 24)).toBe(0)
  })

  it('spaces out brightness accents with Flash Limit, and lets them through without it', () => {
    const accents = (flashLimit: boolean) => {
      const e = new WireEngine(); let peak = 0, triggers = 0, previous = 0
      for (let f = 0; f < 120; f++) {
        // A snare every 6 frames (10 a second).
        e.tick(tick({ values: { ...NOBG, flashLimit }, reading: live({ hits: { kick: 0, snare: f % 6 === 0 ? 1 : 0, hat: 0 } }) }))
        peak = Math.max(peak, e.targets.brightness)
        if (e.targets.brightness > previous + .05) triggers++
        previous = e.targets.brightness
      }
      return { peak, triggers }
    }
    const limited = accents(true), free = accents(false)
    expect(limited.triggers).toBeLessThanOrEqual(8) // about four a second over two seconds
    expect(free.triggers).toBeGreaterThan(limited.triggers)
    const brightest = (flashLimit: boolean) => {
      const e = new WireEngine()
      e.tick(tick({ values: { ...NOBG, flashLimit, outline: false }, reading: live({ hits: { kick: 0, snare: 1, hat: 0 } }) }))
      return Math.max(...scan(e, 3000).map(p => p.energy))
    }
    const plain = (() => { const e = new WireEngine(); e.tick(tick({ values: { ...NOBG, outline: false } })); return Math.max(...scan(e, 3000).map(p => p.energy)) })()
    expect(brightest(true)).toBeLessThanOrEqual(plain * 1.36)
    expect(brightest(false)).toBeGreaterThan(brightest(true))
  })

  it('starts again from the readable figure after a seek, and when reset', () => {
    const engine = new WireEngine()
    run(engine, 60 * 4)
    engine.tick(tick({ discontinuity: true, reading: silentReading() }))
    expect(engine.state === 'READABLE' || engine.state === 'REST').toBe(true)
    expect(engine.abstract).toBe(0)
    engine.reset()
    expect(engine.lastEvent).toBe('—')
    expect(engine.weight).toBe(1)
  })

  it('on a live microphone shows no section scenes and no abstraction even with Auto Performance on and drops arriving', () => {
    const engine = new WireEngine()
    const liveCue: WireCue = { ...emptyWireCue(), bpm: 128, bpmValid: true, gridConfident: false, structure: null, drop: true }
    for (let f = 0; f < 60 * 12; f++) engine.tick(tick({ auto: true, reading: track(f), cue: { ...liveCue, boundaries: f % 120 === 0 ? { section: true, phrase: true, bar4: true, bar8: true, id: `x:${f}` } : NO_BOUNDARIES }, values: { ...NOBG, sceneEvery: 'phrase' } }))
    expect(engine.sceneId).toBe('base')
    expect(engine.abstract).toBe(0)
    expect(['BUILD', 'ABSTRACT', 'REASSEMBLE']).not.toContain(engine.state)
  })

  it('on an analysed track breaks apart on a confident drop and reassembles to the exact figure', () => {
    const engine = new WireEngine()
    const cue = (build: number, drop: boolean): WireCue => ({ ...emptyWireCue(), bpm: 128, bpmValid: true, gridConfident: true, structure: { confidence: .85, build }, drop, trackIdentity: 't' })
    for (let f = 0; f < 120; f++) engine.tick(tick({ auto: true, reading: track(f), cue: cue(.8, false) }))
    engine.tick(tick({ auto: true, reading: track(121), cue: cue(.8, true) }))
    expect(engine.state).toBe('ABSTRACT')
    let peak = 0
    for (let f = 0; f < 60 * 8; f++) { engine.tick(tick({ auto: true, reading: track(f), cue: cue(.05, false) })); peak = Math.max(peak, engine.abstract) }
    expect(peak).toBeGreaterThan(.9)
    expect(engine.state).toBe('READABLE')
    expect(engine.abstract).toBe(0)
    // Silence, and the cubes sit exactly where the unabstracted placement puts them.
    for (let f = 0; f < 60 * 3; f++) engine.tick(tick({ auto: true, reading: silentReading(), cue: cue(.05, false) }))
    expect(maxGap(engine.deformed, engine.base, verticesOfGroups(engine.shape, 1 + engine.effective.satellites))).toBe(0)
  })
})

describe('the edges carry the live audio waveform', () => {
  type Internals = { clock: Float32Array; rest: Float32Array; kinds: number[]; ripple: Float32Array; edgeOf: Int16Array; reversed: Uint8Array; px: Float32Array; py: Float32Array; routeFor(cubes: number): { edge: Int16Array } }
  const internals = (e: WireEngine) => e as unknown as Internals
  const sine = (cycles: number) => Float32Array.from({ length: 512 }, (_, i) => Math.sin(2 * Math.PI * cycles * i / 511))
  /** An engine fed a loud, pulsing track with a real captured waveform. */
  function driven(over: Partial<WireValues> = {}, wave: Float32Array = sine(6), frames = 90) {
    const e = new WireEngine()
    e.hasWave = true; e.wave = wave
    run(e, frames, () => ({ values: { ...NOBG, satellites: 0, outline: false, ...over } }))
    return e
  }
  /** The beam position on segment `s` at fraction `p` of the edge (the rests at each end are skipped). */
  function at(e: WireEngine, s: number, p: number) {
    const i = internals(e), out = { x: 0, y: 0, z: 0, energy: 0, q: 0 }
    const u = i.clock[s] + (i.clock[s + 1] - i.clock[s]) * (i.rest[s] + p * (1 - 2 * i.rest[s]))
    e.signal(e.letters[0], 0, u, 0, 0, out)
    return { x: out.x, y: out.y }
  }
  const rippled = (e: WireEngine) => [...internals(e).ripple.keys()].filter(s => internals(e).kinds[s] === 0 && internals(e).ripple[s] > 0)

  it('ripples every edge with the waveform, pins the corners, and keeps the ripple inside Wave Depth', () => {
    const rippling = driven(), straight = driven({ waveAmount: 0 })
    const segments = rippled(rippling)
    expect(segments.length).toBeGreaterThan(10)
    let deepest = 0
    for (const s of segments) {
      const i = internals(rippling), length = Math.hypot(i.px[(s + 1) % rippling.pointCount] - i.px[s], i.py[(s + 1) % rippling.pointCount] - i.py[s])
      for (const p of [0, 1]) { const a = at(rippling, s, p), b = at(straight, s, p); expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-5) }
      for (const p of [.15, .3, .5, .7, .85]) {
        const a = at(rippling, s, p), b = at(straight, s, p), d = Math.hypot(a.x - b.x, a.y - b.y)
        deepest = Math.max(deepest, d)
        expect(d).toBeLessThanOrEqual(WIRE_DEFAULTS.waveDepth * length * 1.001 + 1e-6)
      }
    }
    expect(deepest).toBeGreaterThan(.004) // it really does move the lines
    expect(rippled(straight)).toHaveLength(0)
  })

  it('follows the captured waveform sample for sample, sideways to the edge', () => {
    // With the oscillators and chaos off, a line is exactly the captured waveform.
    const wave = sine(5), e = driven({ waveOscillator: 0, chaos: 0 }, wave), straight = driven({ waveAmount: 0, waveOscillator: 0, chaos: 0 }, wave)
    const i = internals(e)
    for (const s of rippled(e).slice(0, 12)) {
      const n = (s + 1) % e.pointCount
      for (const p of [.2, .45, .8]) {
        const a = at(e, s, p), b = at(straight, s, p)
        const q = i.reversed[s] ? 1 - p : p
        const expected = i.ripple[s] * wave[Math.floor(((q * WIRE_DEFAULTS.waveDetail + i.edgeOf[s] * .173) % 1) * 511)] * e.waveGain * Math.sin(Math.PI * q)
        const offset = Math.hypot(a.x - b.x, a.y - b.y)
        expect(offset).toBeCloseTo(Math.abs(expected), 5)
        const dx = i.px[n] - i.px[s], dy = i.py[n] - i.py[s]
        expect(Math.abs((a.x - b.x) * dx + (a.y - b.y) * dy)).toBeLessThan(1e-5 * Math.hypot(dx, dy) + 1e-9)
      }
    }
  })

  it('gives each direction of edge its own band: bass on x, mids on y, highs on z', () => {
    const axes = (feature: 'bass' | 'mid' | 'air') => {
      const e = new WireEngine(); e.hasWave = true; e.wave = sine(4)
      for (let f = 0; f < 120; f++) {
        const swing = .5 + .5 * Math.sin(f / 60 * 7)
        const features = { sub: 0, bass: 0, lowMid: 0, mid: 0, air: 0, flux: 0, level: .3, [feature]: swing }
        e.tick(tick({ reading: live({ features }), values: { ...NOBG, satellites: 0 } }))
      }
      return [...e.rippleAxis]
    }
    const bass = axes('bass'), mid = axes('mid'), air = axes('air')
    expect(bass[0]).toBeGreaterThan(bass[1]); expect(bass[0]).toBeGreaterThan(bass[2])
    expect(mid[1]).toBeGreaterThan(mid[0]); expect(mid[1]).toBeGreaterThan(mid[2])
    expect(air[2]).toBeGreaterThan(air[0]); expect(air[2]).toBeGreaterThan(air[1])
  })

  it('draws exactly straight lines when the music stops, or at Wave Amount or Audio Reactivity zero', () => {
    const e = new WireEngine(); e.hasWave = true; e.wave = sine(6)
    let strongest = 0
    for (let f = 0; f < 90; f++) { e.tick(tick({ reading: track(f), values: { ...NOBG, satellites: 0, outline: false } })); strongest = Math.max(strongest, ...e.rippleAxis) }
    expect(strongest).toBeGreaterThan(.4)
    run(e, 60 * 4, () => ({ values: { ...NOBG, satellites: 0, outline: false } }), () => ({ ...silentReading(), playing: false }))
    expect([...e.rippleAxis]).toEqual([0, 0, 0])
    expect(rippled(e)).toHaveLength(0)
    for (const over of [{ waveAmount: 0 }, { audioReactivity: 0 }]) expect(rippled(driven(over))).toHaveLength(0)
  })

  it('builds a stand-in waveform from the analysed bands when there is no capture, and none for silence', () => {
    const e = new WireEngine()
    run(e, 90, () => ({ values: { ...NOBG, satellites: 0 } }))
    const spread = (w: Float32Array) => Math.max(...w) - Math.min(...w)
    expect(spread(e.wave)).toBeGreaterThan(.5)
    expect(rippled(e).length).toBeGreaterThan(5)
    run(e, 10, () => ({ values: { ...NOBG, satellites: 0 } }), () => ({ ...silentReading(), playing: false }))
    expect(spread(e.wave)).toBe(0)
  })

  it('draws a retraced edge as the same curve both times', () => {
    const e = driven(), i = internals(e), route = i.routeFor(1)
    const steps = new Map<number, number[]>()
    route.edge.forEach((edge, s) => { if (edge >= 0) steps.set(edge, [...(steps.get(edge) ?? []), s]) })
    const twice = [...steps.values()].filter(list => list.length === 2)
    expect(twice).toHaveLength(4)
    for (const [first, second] of twice) {
      // Drawn the same way twice or in opposite directions, it is the same curve.
      const opposite = i.reversed[first] !== i.reversed[second]
      for (const p of [.2, .5, .8]) {
        const a = at(e, first, p), b = at(e, second, opposite ? 1 - p : p)
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-4)
      }
    }
  })
})

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { BeatClock, REFERENCE_BPM } from './XyScopeBeatClock'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { emptyOsc1Features, osc1ModeSettings, type Osc1Features } from './XyScopeOsc1Engine'
import { createOsc1GlyphSource } from './XyScopeOsc1Glyphs'
import { scaleOsc1Times } from './XyScopeOsc1Performance'
import { DEFAULT_OSC1_SETTINGS, normalizeOsc1Settings } from './XyScopeOsc1Settings'
import { Osc2Engine, OSC2_DEFAULTS } from './XyScopeOsc2Engine'
import { DEFAULT_OSC2_SETTINGS, normalizeOsc2Settings } from './XyScopeOsc2Settings'
import { OctaEngine } from './XyScopeOctaEngine'
import { DEFAULT_OCTA_SETTINGS, normalizeOctaSettings, OCTA_DEFAULTS } from './XyScopeOctaSettings'
import { XY_SCOPE_PARAMETERS, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings, resolveXyScopeParameters, getXyScopeParameterDefinition } from './XyScopeSettings'
import { STANDARD_AUTO_KEYS, StandardAutoPerformance } from './XyScopeStandardPerformance'
import { XyScopeRuntime } from './XyScopeRuntime'
import { DEFAULT_TEXT_V2_SETTINGS, normalizeTextV2Settings } from './XyScopeTextV2Settings'
import { TEXT_V2_IDLE_PLAN } from './XyScopeTextV2Plan'
import { TEXT_V2_MANUAL_CONTROLS, type TextV2PerformanceFrame } from './XyScopeTextV2Performance'
import { XyScopeTextV2Trajectory } from './XyScopeTextV2Trajectory'

describe('BPM Sync: the shared beat clock', () => {
  const grid = (beat: number, bpm = 120, over: Partial<Parameters<BeatClock['step']>[1]> = {}) => ({ playing: true, sync: true, bpm, absoluteBeat: beat, ...over })

  it('is the plain frame time at a steady tempo when BPM Sync is off, or there is no beat grid (a guessed tempo is never followed)', () => {
    const clock = new BeatClock()
    expect(clock.step(1 / 60, { playing: true, sync: false, bpm: 140, absoluteBeat: 10 })).toEqual({ motionDt: 1 / 60, tempoScale: 1, locked: false, beats: 0 })
    expect(clock.step(1 / 60, { playing: true, sync: true, bpm: null, absoluteBeat: null })).toMatchObject({ motionDt: 1 / 60, tempoScale: 1, locked: false })
    expect(clock.step(1 / 60, { playing: true, sync: true, bpm: 0, absoluteBeat: 5 }).locked).toBe(false)
  })

  it('counts the beats that played: a full second at 120 BPM is two beats, which is 1.2 s of reference-tempo motion', () => {
    const clock = new BeatClock()
    let total = 0, beats = 0
    for (let f = 0; f < 61; f++) { const frame = clock.step(1 / 60, grid(f / 60 * 2)); total += frame.motionDt; beats += frame.beats }
    expect(beats).toBeCloseTo(2, 1)
    expect(total).toBeCloseTo(2 * 60 / REFERENCE_BPM, 1)
  })

  it('runs faster on a faster track and slower on a slower one, and scales musical times the opposite way', () => {
    const run = (bpm: number) => { const c = new BeatClock(); let total = 0, scale = 1; for (let f = 0; f < 121; f++) { const frame = c.step(1 / 60, grid(f / 60 * bpm / 60, bpm)); total += frame.motionDt; scale = frame.tempoScale } return { total, scale } }
    const slow = run(80), fast = run(160)
    expect(fast.total).toBeGreaterThan(slow.total * 1.9)
    expect(fast.scale).toBeCloseTo(100 / 160, 6)
    expect(slow.scale).toBeCloseTo(100 / 80, 6)
  })

  it('holds still when the music stops, and picks the grid up again afterwards without a jump', () => {
    const clock = new BeatClock()
    for (let f = 0; f < 30; f++) clock.step(1 / 60, grid(f / 60 * 2))
    for (let f = 0; f < 30; f++) expect(clock.step(1 / 60, grid(1, 120, { playing: false })).motionDt).toBe(0)
    const resumed = clock.step(1 / 60, grid(1.1))
    expect(resumed.motionDt).toBe(0) // the first frame back only finds its place
    expect(clock.step(1 / 60, grid(1.13)).beats).toBeLessThan(.2)
  })

  it('follows the grid\'s position: a late grid pulls it into step and a seek (a jump of more than two beats) snaps', () => {
    const clock = new BeatClock()
    let beats = 0
    for (let f = 0; f < 60; f++) beats += clock.step(1 / 60, grid(f / 60 * 2)).beats
    const before = beats
    for (let f = 60; f < 90; f++) beats += clock.step(1 / 60, grid(f / 60 * 2 + 1)).beats
    expect(beats - before).toBeGreaterThan(30 / 60 * 2 + .1)
    const seek = clock.step(1 / 60, grid(400))
    expect(seek.beats).toBeGreaterThan(300) // it snapped, so the engines see the jump as a discontinuity they already handle
  })
})

describe('BPM Sync: every engine that gained it', () => {
  const loud: Osc1Features = { ...emptyOsc1Features(), level: .7, bass: .8, mid: .4, air: .3, flux: .4, spectrum: [.9, .7, .5, .4, .3, .3, .2, .1], onsets: [.8, .5, .1, 0, 0, 0, 0, 0] }

  it('defaults to on in all four, and cleans a stored value', () => {
    expect(DEFAULT_TEXT_V2_SETTINGS.bpmSync).toBe(true)
    expect(DEFAULT_OSC1_SETTINGS.bpmSync).toBe(true)
    expect(DEFAULT_OSC2_SETTINGS.bpmSync).toBe(true)
    expect(DEFAULT_OCTA_SETTINGS.bpmSync).toBe(true)
    expect(normalizeTextV2Settings({ bpmSync: false }).bpmSync).toBe(false)
    expect(normalizeOsc1Settings({ bpmSync: false }).bpmSync).toBe(false)
    expect(normalizeOsc2Settings({ bpmSync: false }).bpmSync).toBe(false)
    expect(normalizeOctaSettings({ bpmSync: false }).bpmSync).toBe(false)
    for (const normalize of [normalizeTextV2Settings, normalizeOsc1Settings, normalizeOsc2Settings, normalizeOctaSettings]) expect(normalize({ bpmSync: 'yes' }).bpmSync).toBe(true)
    expect(normalizeXyScopeSettings({ octa: { bpmSync: false } }).octa.bpmSync).toBe(false)
  })

  it('OSC 2: the camera sweep and the terrain scroll advance by the clock, so they stop with it and go faster with a faster track', () => {
    const make = () => { const e = new Osc2Engine(createOsc1GlyphSource(getDefaultXyScopeFont())); e.setSettings({ ...OSC2_DEFAULTS }, true); e.setText('AB'); e.waveL = new Float32Array(2048).map((_, i) => Math.sin(i / 20) * .4); e.waveR = e.waveL; return e }
    const phaseOf = (e: Osc2Engine) => (e as unknown as { phase: number }).phase
    const steady = make(), fast = make(), still = make()
    for (let k = 0; k < 300; k++) { steady.tick(1 / 60, loud, true); fast.tick(1 / 60, loud, true, { motionDt: 2 / 60 }); still.tick(1 / 60, loud, true, { motionDt: 0 }) }
    expect(phaseOf(still)).toBe(0)
    expect(phaseOf(fast)).toBeCloseTo(phaseOf(steady) * 2, 6)
    // With no clock given, nothing changes from how it always ran.
    const unchanged = make(); for (let k = 0; k < 300; k++) unchanged.tick(1 / 60, loud, true, { motionDt: 1 / 60 })
    expect(phaseOf(unchanged)).toBeCloseTo(phaseOf(steady), 9)
  })

  it('OCTA: the turn and tumble advance by the clock, and Energy Response follows the tempo', () => {
    const spinOf = (e: OctaEngine) => (e as unknown as { spin: number }).spin
    const run = (clock?: { motionDt: number; tempoScale: number }) => { const e = new OctaEngine(); for (let k = 0; k < 300; k++) e.tick(1 / 60, { ...emptyOsc1Features(), level: .1, bass: .1, mid: .1 }, true, OCTA_DEFAULTS, 0, clock); return e }
    const steady = run(), fast = run({ motionDt: 2 / 60, tempoScale: 1 }), still = run({ motionDt: 0, tempoScale: 1 })
    expect(spinOf(still)).toBe(0)
    expect(spinOf(fast)).toBeCloseTo(spinOf(steady) * 2, 6)
    // A slower tempo (a larger scale) makes the energy follow the music more slowly.
    const energyAfter = (tempoScale: number) => { const e = new OctaEngine(); e.tick(1 / 60, { ...emptyOsc1Features(), level: 1, bass: 1, mid: 1 }, true, OCTA_DEFAULTS, 0, { motionDt: 1 / 60, tempoScale }); return (e as unknown as { energy: number }).energy }
    expect(energyAfter(.6)).toBeGreaterThan(energyAfter(1.6))
  })

  it('OSC 1: Attack and Release follow the tempo (a faster track reacts faster), stay in range, and are untouched at a scale of one', () => {
    const base = osc1ModeSettings(0)
    expect(scaleOsc1Times(base, 1)).toBe(base)
    const fast = scaleOsc1Times(base, 100 / 160), slow = scaleOsc1Times(base, 100 / 70)
    expect(fast.attack).toBeLessThan(base.attack); expect(fast.release).toBeLessThan(base.release)
    expect(slow.attack).toBeGreaterThan(base.attack); expect(slow.release).toBeGreaterThan(base.release)
    expect(scaleOsc1Times(base, 1000).release).toBeLessThanOrEqual(800)
    expect(scaleOsc1Times(base, .0001).attack).toBeGreaterThanOrEqual(8)
    expect(scaleOsc1Times(base, 100 / 160).color).toBe(base.color)
  })

  it('Text V2: the word\'s departure is counted in the track\'s beats with BPM Sync, and at a steady tempo without it', () => {
    const frame = (): TextV2PerformanceFrame => ({ controls: { ...TEXT_V2_MANUAL_CONTROLS }, weights: new Float32Array([1, 0, 0, 0, 0]), style: 'contour', state: 'Groove', level: .8, bass: .7, mid: .5, high: .4, impact: .4, amount: 1, phase: 'groove', plan: { ...TEXT_V2_IDLE_PLAN, intent: 'depart' }, wordEventId: 'phrase:1' } as unknown as TextV2PerformanceFrame)
    const progressAfter = (bpm: number, sync: boolean) => {
      const c = createSharedPerformanceFallbackContext(0); c.bpm = bpm; c.confidence.rhythm = .9
      const t = new XyScopeTextV2Trajectory()
      let step = t.update(frame(), c, true, true, 1 / 60, sync)
      for (let i = 0; i < 20; i++) step = t.update(frame(), { ...c, wordEventId: undefined } as unknown as SharedPerformanceContext, false, true, 1 / 60, sync)
      return step.morph
    }
    expect(progressAfter(180, true)).toBeGreaterThan(progressAfter(60, true))
    expect(progressAfter(180, false)).toBeCloseTo(progressAfter(60, false), 9)
  })
})

describe('Auto Performance for the standard presets', () => {
  const base = resolveXyScopeParameters(DEFAULT_XY_SCOPE_SETTINGS)
  type Overrides = Omit<Partial<SharedPerformanceContext>, 'boundaries' | 'capabilities'> & { boundaries?: Partial<SharedPerformanceContext['boundaries']>; capabilities?: Partial<SharedPerformanceContext['capabilities']> }
  function context(over: Overrides = {}): SharedPerformanceContext {
    const c = createSharedPerformanceFallbackContext(10)
    const { boundaries, capabilities, ...rest } = over
    return { ...c, analysisIdentity: 'track', ...rest, boundaries: { ...c.boundaries, ...boundaries }, capabilities: { ...c.capabilities, sections: true, beatGrid: true, ...capabilities } }
  }
  const calm = context({ trackRelativeEnergy: .15, energy: .15, buildProgress: 0, dropImpact: 0, sectionType: 'breakdown', sectionIdentity: 'a', phraseIndex: 1 })
  const drop = context({ trackRelativeEnergy: .95, energy: .9, buildProgress: .9, tension: .8, dropImpact: .95, sectionType: 'drop', sectionIdentity: 'b', phraseIndex: 2, dropOccurrence: 1 })
  const run = (auto: StandardAutoPerformance, ctx: SharedPerformanceContext | null, seconds = 4, level = .6) => { let out = base; for (let f = 0; f < seconds * 60; f++) out = auto.update({ dt: 1 / 60, playing: true, base, context: ctx, level }); return out }

  it('is a toggle in Master Controls of the standard presets, off by default, and resolved for the runtime', () => {
    const def = getXyScopeParameterDefinition('autoPerformance')!
    expect(def).toMatchObject({ kind: 'toggle', group: 'master-controls', default: false, label: 'Auto Performance' })
    expect(XY_SCOPE_PARAMETERS.filter(p => p.group === 'master-controls').map(p => p.id)).toEqual(expect.arrayContaining(['bpmSync', 'autoPerformance']))
    expect(base.autoPerformance).toBe(false)
    expect(resolveXyScopeParameters(normalizeXyScopeSettings({ parameters: { autoPerformance: true } })).autoPerformance).toBe(true)
  })

  it('uses the user\'s values exactly when nothing is playing, and starts clean after it stops', () => {
    const auto = new StandardAutoPerformance()
    run(auto, drop, 3)
    expect(auto.update({ dt: 1 / 60, playing: false, base, context: null, level: 0 })).toBe(base)
    expect(auto.feel).toBe('LISTENING')
  })

  it('moves only the values it is meant to, each inside its own control\'s range', () => {
    const out = run(new StandardAutoPerformance(), drop, 3)
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      if ((STANDARD_AUTO_KEYS as readonly string[]).includes(key) || key === 'pattern' || key === 'patternChange') continue
      expect(out[key], `${key} is the user's`).toBe(base[key])
    }
    for (const id of ['intensity', 'motionAmount', 'formResponse', 'vibration', 'dissolveDepth', 'glow'] as const) {
      const def = getXyScopeParameterDefinition(id)!
      if (def.kind === 'slider') { expect(out[id]).toBeGreaterThanOrEqual(def.min); expect(out[id]).toBeLessThanOrEqual(def.max) }
    }
    expect(out.trailMs).toBeGreaterThanOrEqual(40); expect(out.trailMs).toBeLessThanOrEqual(300)
    expect(out.answerDelayMs).toBeGreaterThanOrEqual(0); expect(out.transitionBeats).toBeGreaterThanOrEqual(.5); expect(out.transitionBeats).toBeLessThanOrEqual(4)
    expect(out.audioReactivity).toBe(base.audioReactivity); expect(out.bpmSync).toBe(base.bpmSync); expect(out.beamColor).toBe(base.beamColor)
  })

  it('opens the scene on a drop and calms it in a breakdown, from the music\'s own evidence', () => {
    const a = new StandardAutoPerformance(), b = new StandardAutoPerformance()
    const quiet = run(a, calm, 4, .15), hit = run(b, drop, 4, .9)
    expect(a.feel).toBe('CALM'); expect(b.feel).toBe('DROP')
    expect(hit.motionAmount).toBeGreaterThan(quiet.motionAmount + .15)
    expect(hit.glow).toBeGreaterThan(quiet.glow * 1.3)
    expect(hit.formResponse).toBeGreaterThan(quiet.formResponse)
    expect(hit.intensity).toBeGreaterThan(quiet.intensity)
    expect(hit.trailMs).toBeLessThan(quiet.trailMs)
    expect(hit.transitionBeats).toBeLessThan(quiet.transitionBeats)
    expect(hit.answerDelayMs).toBeLessThan(quiet.answerDelayMs)
  })

  it('leaves a value the user set to zero at zero (zero motion stays the readable word)', () => {
    const still = { ...base, motionAmount: 0 }
    const auto = new StandardAutoPerformance()
    let out = still
    for (let f = 0; f < 240; f++) out = auto.update({ dt: 1 / 60, playing: true, base: still, context: drop, level: .9 })
    expect(out.motionAmount).toBe(0)
  })

  it('chooses the pattern on a musical boundary only, from those that suit the passage, and never repeats it', () => {
    const auto = new StandardAutoPerformance()
    expect(run(auto, calm, 6).pattern).toBe(base.pattern) // no boundary yet: the user's pattern
    // A drop lands: it picks from the drop patterns.
    const picked = auto.update({ dt: 1 / 60, playing: true, base, context: { ...drop, dropOccurrence: 2 }, level: .9 })
    expect(['pinwheel', 'rosette', 'scope', 'ring']).toContain(picked.pattern)
    expect(picked.patternChange).toBe(false)
    // Between boundaries it holds.
    const held = run(auto, { ...drop, dropOccurrence: 2 }, 3)
    expect(held.pattern).toBe(picked.pattern)
  })

  it('is repeatable and never picks the pattern it is already showing', () => {
    const sequence = (seed: number) => {
      const auto = new StandardAutoPerformance(), seen: string[] = []
      let ctx = { ...calm, deterministicVariationSeed: seed }
      run(auto, ctx, 1)
      for (let phrase = 2; phrase < 14; phrase++) {
        ctx = { ...ctx, phraseIndex: phrase, sectionIdentity: `s${phrase}` }
        const out = run(auto, ctx, 5)
        seen.push(out.pattern)
      }
      return seen
    }
    expect(sequence(7)).toEqual(sequence(7))
    const s = sequence(7)
    for (let i = 1; i < s.length; i++) expect(s[i]).not.toBe(s[i - 1])
    expect(new Set(s).size).toBeGreaterThan(2)
  })

  it('never invents sections for a live microphone: with no context the pattern stays the user\'s and only the signal moves the values', () => {
    const auto = new StandardAutoPerformance()
    const loud = run(auto, null, 6, .9), soft = run(new StandardAutoPerformance(), null, 6, .05)
    expect(loud.pattern).toBe(base.pattern)
    expect(auto.mapped).toBe(false)
    expect(loud.motionAmount).toBeGreaterThan(soft.motionAmount)
  })
})

describe('Auto Performance in the standard runtime', () => {
  beforeEach(() => {
    vi.stubGlobal('Path2D', class { moveTo() {} lineTo() {} })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
      return { canvas: this, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', globalCompositeOperation: 'source-over', setTransform: vi.fn(), fillRect: vi.fn(), stroke: vi.fn() } as unknown as CanvasRenderingContext2D
    })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  function drive(autoPerformance: boolean) {
    const runtime = new XyScopeRuntime(document.createElement('canvas')); runtime.resize(900, 600, 1)
    runtime.setSettings(normalizeXyScopeSettings({ ...DEFAULT_XY_SCOPE_SETTINGS, parameters: { ...DEFAULT_XY_SCOPE_SETTINGS.parameters, autoPerformance, patternChange: false, pattern: 'word' } }), null)
    const c = createSharedPerformanceFallbackContext(10)
    const ctx = { ...c, bpm: 120, analysisIdentity: 'track', trackRelativeEnergy: .95, energy: .9, buildProgress: .9, dropImpact: .95, sectionType: 'drop' as const, sectionIdentity: 'b', capabilities: { ...c.capabilities, sections: true, beatGrid: true } }
    let t = 0
    for (let f = 0; f < 240; f++) { t += 1 / 60; runtime.renderFrame({ nowSec: t, context: ctx, fresh: f % 2 === 0, stereo: null, playing: true }) }
    // A drop lands, so Auto Performance may choose a pattern; the runtime reports the pattern it is performing.
    t += 1 / 60; runtime.renderFrame({ nowSec: t, context: { ...ctx, dropOccurrence: ctx.dropOccurrence + 1 }, fresh: true, stereo: null, playing: true })
    for (let f = 0; f < 60; f++) { t += 1 / 60; runtime.renderFrame({ nowSec: t, context: { ...ctx, dropOccurrence: ctx.dropOccurrence + 1 }, fresh: f % 2 === 0, stereo: null, playing: true }) }
    return runtime
  }

  it('lets the music choose the pattern at a drop when it is on, and keeps the user\'s pattern when it is off', () => {
    const on = drive(true), off = drive(false)
    expect(off.getStatus().pattern).toBe('word')
    expect(['pinwheel', 'rosette', 'scope', 'ring']).toContain(on.getStatus().pattern)
  })
})

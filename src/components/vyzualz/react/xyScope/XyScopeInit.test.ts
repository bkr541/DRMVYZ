import { describe, expect, it } from 'vitest'
import { emptyOsc1Features, type Osc1Features } from './XyScopeOsc1Engine'
import { InitEngine, initLayoutSlots, initPickTargets, initRandom, initStreamPlan, INIT_TRACE_POINTS } from './XyScopeInitEngine'
import { initTracePoints } from './XyScopeInitRenderer'
import { InitAutoPerformance } from './XyScopeInitPerformance'
import { DEFAULT_INIT_SETTINGS, INIT_DEFAULTS, normalizeInitSettings, normalizeInitValues } from './XyScopeInitSettings'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

const features: Osc1Features = { ...emptyOsc1Features(), level: .6, bass: .7, mid: .5, air: .3, onsets: [.9, .8, 0, 0, .7, 0, 0, 0] }
/** A 2048-sample stereo tone: 440 Hz left, 880 Hz right at 48 kHz. */
function tone(): { left: Float32Array; right: Float32Array; sampleRate: number } {
  const left = new Float32Array(2048), right = new Float32Array(2048)
  for (let i = 0; i < 2048; i++) { left[i] = .5 * Math.sin(2 * Math.PI * 440 * i / 48000); right[i] = .5 * Math.sin(2 * Math.PI * 880 * i / 48000) }
  return { left, right, sampleRate: 48000 }
}
const horizontal = (s: { ay: number; by: number }) => Math.abs(s.ay - s.by) < 1e-9

describe('INIT settings', () => {
  it('defaults to one oscillator, BPM Sync on and Auto Performance off, and clamps stored values', () => {
    expect(DEFAULT_INIT_SETTINGS).toMatchObject({ oscillators: 1, bpmSync: true, autoPerformance: false })
    expect(normalizeInitSettings(undefined)).toEqual({ ...DEFAULT_INIT_SETTINGS, values: INIT_DEFAULTS })
    expect(normalizeInitSettings({ oscillators: 7 }).oscillators).toBe(3)
    expect(normalizeInitSettings({ oscillators: 0 }).oscillators).toBe(1)
    expect(normalizeInitSettings({ oscillators: 2 }).oscillators).toBe(2)
    const values = normalizeInitValues({ intensity: 9, glide: -4, layout: 'sideways', signal: 'channels', freeEndpoints: 'yes', color1: 'red', changeEvery: '8' })
    expect(values).toMatchObject({ intensity: 2, glide: 0, layout: 'stacked', signal: 'channels', freeEndpoints: false, color1: INIT_DEFAULTS.color1, changeEvery: '8' })
  })

  it('is an instrument preset of the OSCILATOR source: choosing INIT switches the engine and the two agree', () => {
    const next = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, 'init')
    expect(next.sourceMode).toBe('init')
    expect(next.presetId).toBe('init')
    expect(normalizeXyScopeSettings({ ...next, presetId: 'conversation' }).presetId).toBe('init')
    // Leaving the engine (the OSCILATOR card, or another preset) never keeps the INIT preset id.
    expect(normalizeXyScopeSettings({ ...next, sourceMode: 'oscillator' }).presetId).toBe('conversation')
    expect(applyXyScopePreset(next, 'storm').sourceMode).toBe('oscillator')
  })
})

describe('INIT layout', () => {
  it('stacks horizontal lines in rows, splits them into columns, or overlays them', () => {
    const stacked = initLayoutSlots('stacked', 3, .9)
    expect(stacked.map(s => s.ay)).toEqual([...stacked.map(s => s.ay)].sort((a, b) => a - b))
    expect(new Set(stacked.map(s => s.ay.toFixed(3))).size).toBe(3)
    expect(stacked.every(horizontal)).toBe(true)
    const side = initLayoutSlots('side', 3, .9)
    expect(side.every(s => s.ay === 0)).toBe(true)
    expect(side[0].bx).toBeLessThan(side[1].ax)
    expect(side[1].bx).toBeLessThan(side[2].ax)
    const overlay = initLayoutSlots('overlay', 3, .9)
    expect(new Set(overlay.map(s => `${s.ax}|${s.ay}|${s.bx}|${s.by}`)).size).toBe(1)
    expect(initLayoutSlots('stacked', 1, .9)[0].ay).toBe(0)
  })

  it('keeps lines horizontal until Free Endpoints is on, and picks diagonals for Omnidirectional', () => {
    const rand = initRandom(7)
    expect(initPickTargets('stacked', 3, .9, false, rand).every(horizontal)).toBe(true)
    let tilted = 0
    for (let n = 0; n < 8; n++) tilted += initPickTargets('stacked', 3, .9, true, rand).filter(s => !horizontal(s)).length
    expect(tilted).toBeGreaterThan(16)
    let diagonals = 0
    for (let n = 0; n < 8; n++) for (const s of initPickTargets('omni', 3, .9, false, rand)) {
      if (!horizontal(s) && Math.abs(s.ax - s.bx) > .05) diagonals++
      for (const v of [s.ax, s.ay, s.bx, s.by]) expect(Math.abs(v)).toBeLessThanOrEqual(.96)
    }
    expect(diagonals).toBeGreaterThan(12)
  })

  it('picks the same positions for the same seed', () => {
    expect(initPickTargets('omni', 3, .9, false, initRandom(42))).toEqual(initPickTargets('omni', 3, .9, false, initRandom(42)))
    expect(initPickTargets('omni', 3, .9, false, initRandom(42))).not.toEqual(initPickTargets('omni', 3, .9, false, initRandom(43)))
  })
})

describe('INIT endpoints over time', () => {
  const values = { layout: 'omni' as const, freeEndpoints: false, span: .9, changeEvery: '4' as const, glide: 0 }
  it('re-picks only when the beat crosses a Change Every boundary', () => {
    const engine = new InitEngine()
    engine.update(1 / 60, 0, 3, values)
    const first = engine.repicks
    engine.update(1 / 60, 1.5, 3, values)
    engine.update(1 / 60, 3.9, 3, values)
    expect(engine.repicks).toBe(first)
    engine.update(1 / 60, 4.1, 3, values)
    expect(engine.repicks).toBe(first + 1)
    // A track that is paused (the beat stands still) never moves the lines.
    for (let i = 0; i < 50; i++) engine.update(1 / 60, 4.1, 3, values)
    expect(engine.repicks).toBe(first + 1)
  })

  it('glides toward the new targets and snaps when Glide is zero', () => {
    const engine = new InitEngine()
    const glide = { ...values, glide: 800 }
    engine.update(1 / 60, 0, 3, glide)
    const before = { ...engine.scopes[0] }
    engine.update(1 / 60, 4.5, 3, glide)
    const target = engine.targetStates[0]
    const moved = Math.hypot(engine.scopes[0].ax - before.ax, engine.scopes[0].ay - before.ay)
    const remaining = Math.hypot(target.ax - engine.scopes[0].ax, target.ay - engine.scopes[0].ay)
    expect(moved).toBeGreaterThan(0)
    expect(remaining).toBeGreaterThan(0)
    for (let i = 0; i < 600; i++) engine.update(1 / 60, 4.5, 3, glide)
    expect(engine.scopes[0].ax).toBeCloseTo(target.ax, 3)
    const snap = new InitEngine()
    snap.update(1 / 60, 0, 2, values); snap.update(1 / 60, 4.5, 2, values)
    expect(snap.scopes[1].bx).toBeCloseTo(snap.targetStates[1].bx, 9)
  })

  it('returns to horizontal lines as soon as the layout stops being random', () => {
    const engine = new InitEngine()
    engine.update(1 / 60, 0, 2, values)
    engine.update(1 / 60, 0, 2, { ...values, layout: 'stacked' })
    expect(engine.targetStates.every(horizontal)).toBe(true)
  })

  it('only works on as many scopes as are shown', () => {
    const engine = new InitEngine()
    engine.update(1 / 60, 0, 1, { ...values, layout: 'stacked' })
    expect(engine.targetStates).toHaveLength(1)
    engine.update(1 / 60, 0, 3, { ...values, layout: 'stacked' })
    expect(engine.targetStates).toHaveLength(3)
  })
})

describe('INIT signals', () => {
  it('assigns bands, channels or timebase zooms per scope count', () => {
    expect(initStreamPlan('bands', 3).map(p => p.stream)).toEqual(['low', 'mid', 'high'])
    expect(initStreamPlan('bands', 2).map(p => p.stream)).toEqual(['low', 'rest'])
    expect(initStreamPlan('channels', 2).map(p => p.stream)).toEqual(['left', 'right'])
    expect(initStreamPlan('channels', 3).map(p => p.stream)).toEqual(['left', 'right', 'full'])
    expect(initStreamPlan('timebase', 3).map(p => p.zoom)).toEqual([1, .5, .25])
    expect(initStreamPlan('bands', 1).map(p => p.stream)).toEqual(['full'])
  })

  it('draws left and right as different waveforms, and zoomed timebases as fewer cycles', () => {
    const engine = new InitEngine()
    const pcm = tone()
    engine.sample(1 / 60, 2, { ...INIT_DEFAULTS, signal: 'channels', window: 12 }, features, pcm, 'stereo')
    const crossings = (wave: Float32Array) => { let n = 0; for (let i = 1; i < wave.length; i++) if (wave[i - 1] <= 0 && wave[i] > 0) n++; return n }
    expect(crossings(engine.waves[1])).toBeGreaterThan(crossings(engine.waves[0]))
    const zoom = new InitEngine()
    zoom.sample(1 / 60, 3, { ...INIT_DEFAULTS, signal: 'timebase', window: 12 }, features, pcm, 'stereo')
    expect(crossings(zoom.waves[0])).toBeGreaterThan(crossings(zoom.waves[2]))
  })

  it('splits frequency bands: a 440 Hz tone lives in the mid trace, not the low or high one', () => {
    const engine = new InitEngine()
    const pcm = tone()
    pcm.right.set(pcm.left)
    engine.sample(1 / 60, 3, { ...INIT_DEFAULTS, signal: 'bands', window: 12 }, features, pcm, 'stereo')
    const peak = (wave: Float32Array) => Math.max(...wave.map(Math.abs))
    expect(peak(engine.waves[1])).toBeGreaterThan(peak(engine.waves[0]))
    expect(peak(engine.waves[1])).toBeGreaterThan(peak(engine.waves[2]))
  })

  it('draws flat lines with no signal, a band-driven stand-in with shared analysis, and zero with Audio Reactivity at zero', () => {
    const engine = new InitEngine()
    engine.sample(1 / 60, 3, INIT_DEFAULTS, features, null, 'none')
    expect(engine.waves.every(wave => Math.max(...wave.map(Math.abs)) === 0)).toBe(true)
    engine.sample(1 / 60, 3, INIT_DEFAULTS, features, null, 'shared')
    expect(Math.max(...engine.waves[0].map(Math.abs))).toBeGreaterThan(Math.max(...engine.waves[2].map(Math.abs)))
    engine.sample(1 / 60, 3, { ...INIT_DEFAULTS, audioReactivity: 0 }, features, tone(), 'stereo')
    expect(engine.waves.every(wave => Math.max(...wave.map(Math.abs)) === 0)).toBe(true)
  })

  it('pulses on kicks and snares, scaled by their response and decaying afterwards', () => {
    const engine = new InitEngine()
    engine.sample(1 / 60, 1, INIT_DEFAULTS, features, null, 'shared')
    expect(engine.kickPulse).toBeCloseTo(.9 * INIT_DEFAULTS.kickResponse, 2)
    expect(engine.snarePulse).toBeCloseTo(.7 * INIT_DEFAULTS.snareResponse, 2)
    const kick = engine.kickPulse
    for (let i = 0; i < 30; i++) engine.sample(1 / 60, 1, INIT_DEFAULTS, emptyOsc1Features(), null, 'shared')
    expect(engine.kickPulse).toBeLessThan(kick / 3)
  })
})

describe('INIT trace geometry', () => {
  it('runs a straight line from its start to its end, carrying the waveform along the normal', () => {
    const engine = new InitEngine()
    engine.scopes[0] = { ax: -.5, ay: 0, bx: .5, by: 0 }
    engine.waves[0].fill(0)
    const out = new Float32Array(INIT_TRACE_POINTS * 2)
    initTracePoints(engine, 0, 1000, 500, .5, out)
    expect(out[0]).toBeCloseTo(500 - .5 * 470, 3)
    expect(out[(INIT_TRACE_POINTS - 1) * 2]).toBeCloseTo(500 + .5 * 470, 3)
    expect(out[1]).toBeCloseTo(250, 3)
    engine.waves[0].fill(1)
    initTracePoints(engine, 0, 1000, 500, .5, out)
    expect(out[1]).not.toBeCloseTo(250, 1)
    // A vertical line carries the wave sideways.
    engine.scopes[0] = { ax: 0, ay: -.5, bx: 0, by: .5 }
    initTracePoints(engine, 0, 1000, 500, .5, out)
    expect(out[0]).not.toBeCloseTo(500, 1)
  })
})

describe('INIT Auto Performance', () => {
  it('opens up on drops and leaves unrelated values alone', () => {
    const auto = new InitAutoPerformance()
    let calm = INIT_DEFAULTS, loud = INIT_DEFAULTS
    for (let i = 0; i < 400; i++) calm = auto.update(1 / 60, { ...features, level: .05 }, { build: 0, drop: 0 }, INIT_DEFAULTS)
    const dropAuto = new InitAutoPerformance()
    for (let i = 0; i < 400; i++) loud = dropAuto.update(1 / 60, { ...features, level: .9 }, { build: .3, drop: 1 }, INIT_DEFAULTS)
    expect(loud.waveHeight).toBeGreaterThan(calm.waveHeight)
    expect(loud.glow).toBeGreaterThan(calm.glow)
    expect(loud.layout).toBe(INIT_DEFAULTS.layout)
    expect(loud.changeEvery).toBe(INIT_DEFAULTS.changeEvery)
    expect(loud.color1).toBe(INIT_DEFAULTS.color1)
    expect(loud.waveHeight).toBeLessThanOrEqual(1)
  })
})

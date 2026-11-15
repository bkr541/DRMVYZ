import { describe, expect, it } from 'vitest'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { emptyOsc1Features, type Osc1Features } from './XyScopeOsc1Engine'
import { createOsc1GlyphSource } from './XyScopeOsc1Glyphs'
import { Osc2Engine, OSC2_DEFAULTS, OSC2_RANGES } from './XyScopeOsc2Engine'
import { DEFAULT_OSC2_SETTINGS, normalizeOsc2Settings } from './XyScopeOsc2Settings'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

const loud: Osc1Features = {
  ...emptyOsc1Features(), level: .7, bass: .8, mid: .4, air: .3, flux: .4, balance: .3, peakL: .8, peakR: .6, crest: .3,
  spectrum: [.9, .7, .5, .4, .3, .3, .2, .1], onsets: [.8, .5, .1, 0, 0, 0, 0, 0],
}
function makeEngine(text = 'DRMVYZ') {
  const engine = new Osc2Engine(createOsc1GlyphSource(getDefaultXyScopeFont()))
  engine.setSettings({ ...OSC2_DEFAULTS }, true)
  engine.setText(text)
  engine.waveL = new Float32Array(2048).map((_, i) => Math.sin(i / 20) * .4)
  engine.waveR = engine.waveL
  return engine
}
const out = () => ({ x: 0, y: 0, z: 0, energy: 0, q: 0 })

describe('OSC 2 3D scene', () => {
  it('builds one stream per letter plus a terrain and a floor stream', () => {
    const e = makeEngine('AB')
    expect(e.streams.map(s => s.kind)).toEqual(['letter', 'letter', 'terrain', 'floor'])
    expect(e.absolute).toBe(true)
    expect(e.fitWidth).toBeGreaterThan(2)
  })

  it('produces finite, bounded projections for every stream under loud audio', () => {
    const e = makeEngine()
    for (let k = 0; k < 120; k++) e.tick(1 / 60, loud, true)
    e.streams.forEach((stream, i) => {
      for (let j = 0; j < 400; j++) {
        const p = e.signal(stream, i, j / 400, 0, 0, out())
        expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.energy)).toBe(true)
        expect(Math.abs(p.x)).toBeLessThan(40)
        expect(Math.abs(p.y)).toBeLessThan(40)
      }
    })
  })

  it('puts the contour slices at different depths, so the letter is a solid and perspective changes its size', () => {
    const e = makeEngine('I')
    const scales = new Set<number>()
    for (let layer = 0; layer < OSC2_DEFAULTS.layers; layer++) scales.add(Math.round(e.signal(e.streams[0], 0, (layer + .25) / OSC2_DEFAULTS.layers, 0, 0, out()).q * 1000))
    expect(scales.size).toBe(OSC2_DEFAULTS.layers)
  })

  it('lets a frequency region push its slice forward only while that band is active', () => {
    const quiet = makeEngine('I'), active = makeEngine('I')
    for (let k = 0; k < 120; k++) { quiet.tick(1 / 60, emptyOsc1Features(), true); active.tick(1 / 60, loud, true) }
    const sample = (engine: Osc2Engine) => engine.signal(engine.streams[0], 0, .02, 0, 0, out()).q
    expect(sample(active)).toBeGreaterThan(sample(quiet))
  })

  it('swings the camera with the music and settles straight-on when paused', () => {
    const e = makeEngine()
    let moved = 0
    for (let k = 0; k < 600; k++) { e.tick(1 / 60, loud, true); moved = Math.max(moved, Math.abs(e.yaw)) }
    expect(moved).toBeGreaterThan(.05)
    for (let k = 0; k < 600; k++) e.tick(1 / 60, loud, false)
    expect(Math.abs(e.yaw)).toBeLessThan(1e-3)
  })

  it('draws no terrain at zero height and no floor when it is turned off, and is deterministic', () => {
    const e = makeEngine()
    e.setSettings({ ...OSC2_DEFAULTS, terrain: 0 }, false)
    const terrain = e.streams.findIndex(s => s.kind === 'terrain'), floor = e.streams.findIndex(s => s.kind === 'floor')
    expect(e.signal(e.streams[terrain], terrain, .3, 0, 0, out()).z).toBe(0)
    expect(e.signal(e.streams[floor], floor, .3, 0, 0, out()).z).toBe(0)
    const a = makeEngine(), b = makeEngine()
    for (let k = 0; k < 100; k++) { a.tick(1 / 60, loud, true); b.tick(1 / 60, loud, true) }
    expect(a.signal(a.streams[0], 0, .4, 0, 0, out())).toEqual(b.signal(b.streams[0], 0, .4, 0, 0, out()))
  })
})

describe('OSC 2 settings and preset', () => {
  it('normalizes corrupt values to legal ones', () => {
    const s = normalizeOsc2Settings({ autoPerformance: 1, values: { layers: 99, distance: -3, color: 'nope', terrain: 'x' }, resetSignals: -5 })
    expect(s.values.layers).toBe(OSC2_RANGES.layers[1])
    expect(s.values.distance).toBe(OSC2_RANGES.distance[0])
    expect(s.values.color).toBe(OSC2_DEFAULTS.color)
    expect(s.values.terrain).toBe(OSC2_DEFAULTS.terrain)
    expect(s.autoPerformance).toBe(false)
    expect(s.resetSignals).toBe(0)
    expect(normalizeOsc2Settings(undefined)).toEqual(DEFAULT_OSC2_SETTINGS)
  })
  it('switches engine with the preset and keeps both in agreement', () => {
    const on = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, 'osc2')
    expect(on.sourceMode).toBe('osc2')
    expect(on.presetId).toBe('osc2')
    expect(applyXyScopePreset(on, 'osc1').sourceMode).toBe('osc1')
    expect(applyXyScopePreset(on, 'storm').sourceMode).toBe('text')
    expect(normalizeXyScopeSettings({ ...on, sourceMode: 'svg' }).presetId).toBe('conversation')
    expect(normalizeXyScopeSettings({ ...on, presetId: 'conversation' }).presetId).toBe('osc2')
  })
})

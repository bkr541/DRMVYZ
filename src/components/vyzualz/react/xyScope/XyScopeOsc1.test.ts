import { describe, expect, it } from 'vitest'
import { getDefaultXyScopeFont } from './XyScopeGeometry'
import { Osc1Analyzer } from './XyScopeOsc1Analysis'
import { compileOsc1Glyph, emptyOsc1Features, Osc1Engine, Osc1Phosphor, OSC1_MODES, osc1ModeSettings, type Osc1Features } from './XyScopeOsc1Engine'
import { createOsc1GlyphSource } from './XyScopeOsc1Glyphs'
import { Osc1Conductor, OSC1_RANGES, osc1StructureFromContext, type Osc1StructureFrame } from './XyScopeOsc1Performance'
import { DEFAULT_OSC1_SETTINGS, normalizeOsc1Settings } from './XyScopeOsc1Settings'
import { applyXyScopePreset, DEFAULT_XY_SCOPE_SETTINGS, normalizeXyScopeSettings } from './XyScopeSettings'

const glyphs = createOsc1GlyphSource(getDefaultXyScopeFont())
const full: Osc1Features = {
  ...emptyOsc1Features(), level: .65, bass: .7, mid: .48, air: .32, flux: .18, centroid: .4, flatness: .12, width: .35, correlation: .25, balance: .1,
  dominant: .3, roughness: .24, peakL: .8, peakR: .6, crest: .4, spectrum: [.8, .7, .5, .4, .35, .3, .2, .1], onsets: [.1, .08, .04, .02, .01, 0, 0, 0],
}
function makeEngine(text = 'DVYDRM', mode = 0) {
  const engine = new Osc1Engine(glyphs)
  engine.setText(text)
  engine.setMode(mode, osc1ModeSettings(mode))
  return engine
}
const point = (e: Osc1Engine, i = 0, u = .19, pass = 0) => ({ ...e.signal(e.letters[i], i, u, pass, 0) })
function settle(e: Osc1Engine, f = full, n = 600) { for (let k = 0; k < n; k++) e.tick(1 / 120, f, true) }
function basePoint(e: Osc1Engine, i: number, u: number) {
  const saved = e.s
  e.s = { ...saved, motion: 0, depth: 0 }
  const p = point(e, i, u)
  e.s = saved
  return p
}

describe('OSC 1 glyph source', () => {
  it('maps the app font into the Text Lab glyph space (cap height 1, centred on x = .5, y down)', () => {
    const h = glyphs('H')!
    const xs = h.paths.flatMap(path => path.map(p => p[0])), ys = h.paths.flatMap(path => path.map(p => p[1]))
    expect(Math.min(...ys)).toBeCloseTo(0, 2)
    expect(Math.max(...ys)).toBeCloseTo(1, 2)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(.5, 1)
    expect(h.advance).toBeGreaterThan(.4)
    const o = glyphs('O')!
    expect(o.paths.length).toBeGreaterThanOrEqual(2)
    for (const path of o.paths) expect(path.at(-1)).toEqual(path[0])
  })
  it('compiles closed contours with blanked retraces between strokes', () => {
    const table = compileOsc1Glyph(glyphs('O'))!
    expect(table.length).toBe(1536 * 3)
    let blanked = 0
    for (let i = 2; i < table.length; i += 3) if (table[i] === 0) blanked++
    expect(blanked).toBeGreaterThan(0)
    expect(compileOsc1Glyph(glyphs(' '))).toBeNull()
  })
})

describe('OSC 1 engine (ported from XY / Text Lab 05)', () => {
  it('only extends outward, inside the legibility envelope, in all five response systems', () => {
    for (let mode = 0; mode < 5; mode++) {
      const e = makeEngine('DVYDRM', mode)
      e.s.readability = 100
      settle(e)
      let changes = 0
      for (let i = 0; i < e.letters.length; i++) for (let j = 0; j < 256; j++) {
        const u = j / 256, a = basePoint(e, i, u), b = point(e, i, u)
        expect(b.z).toBe(a.z)
        for (const key of ['x', 'y'] as const) {
          expect(Number.isFinite(b[key])).toBe(true)
          expect(Math.abs(b[key]) + 1e-7).toBeGreaterThanOrEqual(Math.abs(a[key]))
          expect(Math.abs(b[key])).toBeLessThanOrEqual(Math.abs(a[key]) * 1.380001 + 1e-7)
          expect(a[key] * b[key]).toBeGreaterThanOrEqual(0)
        }
        if (Math.hypot(b.x - a.x, b.y - a.y) > .01) changes++
      }
      expect(changes).toBeGreaterThan(100)
      const before = point(e)
      settle(e, full, 120)
      const after = point(e)
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(1e-7)
      for (let k = 0; k < 1200; k++) e.tick(1 / 120, emptyOsc1Features(), false)
      const quiet = point(e), clean = basePoint(e, 0, .19)
      expect(Math.hypot(quiet.x - clean.x, quiet.y - clean.y)).toBeLessThan(1e-7)
    }
  })

  it('lets the current spectrum change the geometry and maps opposing bands to opposing lobes', () => {
    const e = makeEngine()
    settle(e)
    const initial = point(e)
    settle(e, { ...full, bass: .05, air: .9, flux: .6, spectrum: [0, 0, 0, 0, 0, .3, .8, 1], onsets: [0, 0, 0, 0, 0, .2, .6, .7] })
    expect(Math.hypot(initial.x - point(e).x, initial.y - point(e).y)).toBeGreaterThan(.005)

    const d = makeEngine()
    d.letters[0].focus = 'level'
    d.s = { ...d.s, depth: 0 }
    const low = { ...full, flux: 0, onsets: new Array(8).fill(0), spectrum: [1, 0, 0, 0, 0, 0, 0, 0] }
    const opposite = { ...low, spectrum: [0, 0, 0, 0, 1, 0, 0, 0] }
    const lobes = () => {
      let right = 0, left = 0
      for (let j = 0; j < 512; j++) { const p = point(d, 0, j / 512); if (p.x > .1) right += p.q; if (p.x < -.1) left += p.q }
      return { right, left }
    }
    settle(d, low)
    const a = lobes()
    expect(a.right).toBeGreaterThan(a.left * 1.5)
    settle(d, opposite)
    const b = lobes()
    expect(b.left).toBeGreaterThan(b.right * 1.5)
  })

  it('uses PCM magnitude for detail, honours zero controls and zero letter gain, and is deterministic', () => {
    const w = makeEngine('DVYDRM', 2)
    w.waveL = new Float32Array(2048); w.waveR = new Float32Array(2048)
    settle(w)
    const quiet = point(w)
    w.waveL.fill(.7); w.waveR.fill(.5)
    const loud = point(w)
    expect(Math.hypot(quiet.x - loud.x, quiet.y - loud.y)).toBeGreaterThan(.005)
    w.s = { ...w.s, motion: 0, depth: 0 }
    expect(point(w).x).toBe(basePoint(w, 0, .19).x)
    w.setMode(4, osc1ModeSettings(4))
    w.letters[0].gain = 0
    expect(point(w).x).toBe(basePoint(w, 0, .19).x)
    expect(point(w).y).toBe(basePoint(w, 0, .19).y)
    const a = makeEngine(), b = makeEngine()
    for (let i = 0; i < 120; i++) { const f = { ...full, bass: .3 + .2 * Math.sin(i * .13) }; a.tick(1 / 120, f, true); b.tick(1 / 120, f, true) }
    expect(point(a)).toEqual(point(b))
  })

  it('keeps per-letter settings by position when the text or font changes', () => {
    const e = makeEngine('AB')
    e.letters[1].gain = .4
    e.setText('ABC')
    expect(e.letters[1].gain).toBe(.4)
    expect(e.letters[2].gain).toBe(1)
    e.setFont(glyphs)
    expect(e.letters).toHaveLength(3)
  })

  it('phosphor deposits dwell energy and decays', () => {
    const p = new Osc1Phosphor(100, 60)
    for (let i = 0; i < 20; i++) p.deposit(20, 20, .3)
    p.segment(40, 20, 70, 20, 6, 1)
    expect(p.energy[2020]).toBeGreaterThan(p.energy[2050] * 10)
    const energy = p.energy[2020]
    p.image(.1, 100, '#57efb7', 60)
    expect(p.energy[2020]).toBeLessThan(energy)
  })
})

describe('OSC 1 audio analysis', () => {
  const tone = (hz: number, amp: number, rate = 48000) => Float32Array.from({ length: 2048 }, (_, i) => Math.sin(i * Math.PI * 2 * hz / rate) * amp)
  it('reads level, correlation and the right frequency region from a mono tone', () => {
    const analyzer = new Osc1Analyzer()
    const wave = tone(220, .3)
    analyzer.load(wave, wave)
    const m = analyzer.measure(.016, 48000)
    expect(m.correlation).toBeGreaterThan(.999)
    expect(m.width).toBeLessThan(1e-6)
    expect(m.level).toBeGreaterThan(.5)
    expect(m.peakL).toBeGreaterThan(.29)
    expect(m.waveStart).toBeGreaterThan(0)
    // 220 Hz sits in the 180–400 Hz region (index 2), far above the 35–80 Hz region.
    expect(m.spectrum[2]).toBeGreaterThan(m.spectrum[0] * 5)
    expect(m.onsets[2]).toBeGreaterThan(.1)
  })
  it('reads inverted stereo as anti-correlated with a left-heavy balance', () => {
    const analyzer = new Osc1Analyzer()
    const left = tone(220, .3), right = left.map(v => v * -.3)
    analyzer.load(left, right)
    const m = analyzer.measure(.016, 48000)
    expect(m.correlation).toBeLessThan(-.999)
    expect(m.balance).toBeLessThan(0)
    expect(m.peakL).toBeGreaterThan(m.peakR * 3)
  })
  it('reports silence as empty and accepts shorter or longer windows', () => {
    const analyzer = new Osc1Analyzer()
    analyzer.load(new Float32Array(2048), new Float32Array(2048))
    const silent = analyzer.measure(.016, 48000)
    expect(silent.level).toBe(0)
    expect(silent.flux).toBe(0)
    analyzer.load(tone(440, .4).subarray(0, 512), tone(440, .4).subarray(0, 512))
    expect(analyzer.measure(.016, 48000).level).toBeGreaterThan(0)
    analyzer.load(new Float32Array(4096).fill(.1), new Float32Array(4096).fill(.1))
    expect(analyzer.timeL).toHaveLength(2048)
  })
})

describe('OSC 1 Auto Performance conductor', () => {
  const base = osc1ModeSettings(0)
  const calm: Osc1Features = { ...emptyOsc1Features(), level: .15, bass: .12, mid: .17, air: .03, correlation: 1, spectrum: [.12, .1, .15, .1, .05, .03, .02, .01], onsets: new Array(8).fill(0) }
  const strong: Osc1Features = { ...calm, level: .85, bass: .9, mid: .5, air: .7, flux: .8, width: .8, correlation: -.6, balance: .4, centroid: .7, flatness: .5, roughness: .65, dominant: .8, crest: .5, peakL: .9, peakR: .8, spectrum: [.9, .7, .4, .5, .8, .9, .6, .7], onsets: [.8, .5, .2, .1, .3, .4, .2, .5] }
  const structure = (values: Partial<Osc1StructureFrame>): Osc1StructureFrame => ({ energy: .8, bass: .8, mid: .4, air: .5, flux: .4, build: 0, drop: 0, breakdown: 0, confidence: .8, ...values })
  const ctx = (mode: number, s: Osc1StructureFrame | null = null) => ({ structure: s, mode, base, letterCount: 6 })

  it('performs all sixteen controls in every response system, within their legal ranges', () => {
    for (let mode = 0; mode < 5; mode++) {
      const c = new Osc1Conductor()
      let a = c.update(1 / 60, calm, ctx(mode))
      for (let n = 0; n < 360; n++) a = c.update(1 / 60, calm, ctx(mode))
      let b = a
      for (let n = 0; n < 240; n++) b = c.update(1 / 60, strong, ctx(mode, structure({ drop: 1 })))
      for (const [key, [lo, hi]] of Object.entries(OSC1_RANGES)) {
        const v = (b.settings as unknown as Record<string, number>)[key], w = (a.settings as unknown as Record<string, number>)[key]
        expect(Number.isFinite(v) && v >= lo && v <= hi).toBe(true)
        expect(Math.abs(w - v)).toBeGreaterThan(.02)
      }
      expect(b.letters).toHaveLength(6)
      expect(b.letters.every(l => l.gain >= .4 && l.gain <= 1.4 && l.offset >= 0 && l.offset < Math.PI)).toBe(true)
      expect(b.state).toBe('DROP')
      expect(b.settings.color).toMatch(/^#[0-9a-f]{6}$/)
      for (let n = 0; n < 600; n++) b = c.update(1 / 60, strong, ctx(mode, structure({ drop: 1 })))
      const stable = { ...b.settings } as unknown as Record<string, number>
      for (let n = 0; n < 180; n++) b = c.update(1 / 60, strong, ctx(mode, structure({ drop: 1 })))
      for (const key of Object.keys(OSC1_RANGES)) expect(Math.abs((b.settings as unknown as Record<string, number>)[key] - stable[key])).toBeLessThan(1e-8)
      c.reset()
      let build = c.update(1 / 60, strong, ctx(mode, structure({ build: .9 })))
      for (let n = 0; n < 240; n++) build = c.update(1 / 60, strong, ctx(mode, structure({ build: .9 })))
      expect(build.state).toBe('BUILD')
      expect(build.settings.axisY).toBeLessThan(b.settings.axisY - 30)
      c.reset()
      expect(c.update(1 / 60, calm, ctx(mode, structure({ breakdown: 1 }))).state).toBe('BREAKDOWN')
      c.reset()
      const silent = c.update(1 / 60, emptyOsc1Features(), ctx(mode, structure({ drop: 1 })))
      expect(silent.state).toBe('SILENCE')
      expect(silent.drop).toBe(0)
    }
    expect(base.motion).toBe(osc1ModeSettings(0).motion)
  })

  it('is deterministic and falls back to live evidence without structure', () => {
    const a = new Osc1Conductor(), b = new Osc1Conductor()
    for (let n = 0; n < 120; n++) { const x = { ...strong, bass: n / 120 }; expect(a.update(.016, x, ctx(0))).toEqual(b.update(.016, x, ctx(0))) }
    expect(a.update(.016, strong, ctx(0)).mapped).toBe(false)
  })

  it('re-focuses each letter on the dominant region without wrap jumps', () => {
    const c = new Osc1Conductor()
    let out = c.update(.016, calm, ctx(0))
    const before = out.letters.filter(l => l.focus === 'air').length
    for (let i = 0; i < 60; i++) out = c.update(.016, { ...strong, bass: .01, mid: .01, air: 1, onsets: [0, 0, 0, 0, 0, .8, 1, .8] }, ctx(0))
    expect(out.letters.filter(l => l.focus === 'air').length).toBeGreaterThan(before)
  })

  it('derives structural evidence only when an analysed track backs the shared context', () => {
    expect(osc1StructureFromContext(null)).toBeNull()
  })
})

describe('OSC 1 settings and preset', () => {
  it('has five response systems with their own colours and ranges', () => {
    expect(OSC1_MODES).toHaveLength(5)
    expect(new Set(OSC1_MODES.map(mode => mode.color)).size).toBe(5)
    expect(DEFAULT_OSC1_SETTINGS.presets[2].harmonics).toBe(95)
  })
  it('normalizes corrupt values to legal ones', () => {
    const s = normalizeOsc1Settings({ mode: 99, autoPerformance: 'yes', presets: [{ motion: 9999, color: 'red' }], letters: [{ gain: -4, offset: 99, focus: 'nope' }], letterIndex: 500 })
    expect(s.mode).toBe(4)
    expect(s.autoPerformance).toBe(false)
    expect(s.presets).toHaveLength(5)
    expect(s.presets[0].motion).toBe(100)
    expect(s.presets[0].color).toBe('#57efb7')
    expect(s.letters[0]).toEqual({ gain: 0, offset: Math.PI * 2, focus: 'auto' })
    expect(s.letterIndex).toBe(15)
  })
  it('selecting the OSC 1 preset switches the engine; any other preset leaves it', () => {
    const on = applyXyScopePreset(DEFAULT_XY_SCOPE_SETTINGS, 'osc1')
    expect(on.sourceMode).toBe('osc1')
    expect(on.presetId).toBe('osc1')
    expect(on.text).toBe(DEFAULT_XY_SCOPE_SETTINGS.text)
    const off = applyXyScopePreset(on, 'storm')
    expect(off.sourceMode).toBe('text')
    expect(off.presetId).toBe('storm')
    // Moving to another source never leaves OSC 1 highlighted.
    expect(normalizeXyScopeSettings({ ...on, sourceMode: 'svg' }).presetId).toBe('conversation')
  })
})

// Sound Drawing XY › OSC 1: the directional oscilloscope-text engine, ported 1:1 from XY / TEXT LAB 05.
// Letter contours stay anchored; current frequency regions, transients, stereo and PCM only ever stretch them
// outward. No free-running letter oscillators, springs, rotation or noise: the same input history gives the same
// geometry. Every constant below is the Text Lab's, so the preset behaves exactly like the lab.

export const OSC1_BAND_COUNT = 8
/** Frequency region edges in Hz, bass first. */
export const OSC1_BAND_EDGES = [35, 80, 180, 400, 900, 2500, 5000, 8000, 11500] as const
const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

export type Osc1Focus = 'auto' | 'level' | 'bass' | 'mid' | 'air'

/** The sixteen visual controls the Auto Performance conductor performs. */
export interface Osc1Controls {
  motion: number
  depth: number
  readability: number
  rotation: number
  correlation: number
  axisX: number
  axisY: number
  shear: number
  attack: number
  release: number
  sensitivity: number
  intensity: number
  persistence: number
  width: number
  scan: number
  harmonics: number
}
export type Osc1ControlKey = keyof Osc1Controls
export interface Osc1Settings extends Osc1Controls { color: string }

export const OSC1_DEFAULTS: Readonly<Osc1Controls> = Object.freeze({
  motion: 88, depth: 90, readability: 80, rotation: 70, correlation: 75, axisX: 100, axisY: 100, shear: 48,
  attack: 12, release: 145, sensitivity: 72, intensity: 70, persistence: 65, width: 1.2, scan: 76, harmonics: 65,
})

export interface Osc1Mode {
  name: string
  color: string
  tag: string
  desc: string
  settings: Partial<Osc1Controls>
}

export const OSC1_MODES: readonly Osc1Mode[] = Object.freeze([
  { name: 'Band / deflection', color: '#57efb7', tag: 'FREQUENCY → OUTWARD DEFLECTION', desc: 'Current frequency bands stretch different regions of each anchored contour outward. Low and high frequencies excite different directions; attacks add short, stronger extensions.', settings: {} },
  { name: 'Stereo / vectors', color: '#73ddff', tag: 'STEREO → AXIS EXTENSION', desc: 'Left/right waveform peaks, stereo balance, and correlation change the horizontal and vertical extent independently. Letter centers stay fixed; the audio opens the contours outward.', settings: { correlation: 95, shear: 70 } },
  { name: 'Harmonic / fans', color: '#b6a0ff', tag: 'WAVEFORM → CONTOUR FANS', desc: 'Triggered live waveform samples open localized contour fans. Frequency energy selects the directions, and sampled waveform magnitude determines the outward detail on each scan.', settings: { harmonics: 95, persistence: 95, rotation: 45 } },
  { name: 'Transient / burst', color: '#ffc781', tag: 'SPECTRAL ATTACK → DIRECTIONAL BURST', desc: 'New spectral energy drives fast directional expansions, followed by a damped return to the original letter. There is no repeating burst sequence; every excursion follows the current signal.', settings: { attack: 8, release: 110, persistence: 48, depth: 100, sensitivity: 90 } },
  { name: 'Resonance / rays', color: '#ff9fc4', tag: 'SPECTRUM → RADIAL EXTENSION', desc: 'Narrow spectral lobes pull selected contour regions into outward rays. Dominant frequency, waveform shape, and stereo information change the extension while legibility keeps the word intact.', settings: { harmonics: 80, depth: 100, rotation: 30, release: 185 } },
])

export function osc1ModeSettings(index: number): Osc1Settings {
  const mode = OSC1_MODES[Math.max(0, Math.min(OSC1_MODES.length - 1, index))]
  return { ...OSC1_DEFAULTS, ...mode.settings, color: mode.color }
}

/** One glyph in the Text Lab's normalised space: contours in a unit box centred on x = .5, y down, cap height 1. */
export interface Osc1Glyph { paths: number[][][]; advance: number }

/** Resamples closed contours into a 1536-entry parametric table of [x, y, lit]; z = 0 marks a blanked retrace. */
export function compileOsc1Glyph(entry: Osc1Glyph | null | undefined, N = 1536): Float32Array | null {
  const strokes = entry?.paths
  if (!strokes?.length) return null
  const seg: Array<{ a: number[]; b: number[]; z: number; start: number; end: number }> = []
  let total = 0
  const add = (a: number[], b: number[], z: number, w: number) => { seg.push({ a, b, z, start: total, end: total + w }); total += w }
  for (let i = 0; i < strokes.length; i++) {
    const p = strokes[i]
    for (let j = 0; j < p.length - 1; j++) {
      const a = p[j], b = p[j + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1])
      add(a, a, 1, .0015)
      add(a, b, 1, Math.max(.0002, len))
    }
    const a = p[p.length - 1], b = strokes[(i + 1) % strokes.length][0]
    add(a, b, 0, .035 + Math.hypot(a[0] - b[0], a[1] - b[1]) * .05)
  }
  const table = new Float32Array(N * 3)
  let j = 0
  for (let i = 0; i < N; i++) {
    const d = i / N * total
    while (j < seg.length - 1 && d > seg[j].end) j++
    const s = seg[j], u = (d - s.start) / Math.max(.00001, s.end - s.start)
    table[i * 3] = mix(s.a[0], s.b[0], u) - .5
    table[i * 3 + 1] = mix(s.a[1], s.b[1], u) - .5
    table[i * 3 + 2] = s.z
  }
  return table
}

/** Live audio descriptors the engine consumes (the Text Lab's feature set). */
export interface Osc1Features {
  level: number; bass: number; mid: number; air: number; flux: number; centroid: number; flatness: number
  width: number; correlation: number; balance: number; dominant: number; roughness: number
  peakL: number; peakR: number; crest: number
  spectrum?: ArrayLike<number>
  onsets?: ArrayLike<number>
  waveStart?: number
}
type ScalarKey = Exclude<keyof Osc1Features, 'spectrum' | 'onsets' | 'waveStart'>
const SCALAR_KEYS: readonly ScalarKey[] = ['level', 'bass', 'mid', 'air', 'flux', 'centroid', 'flatness', 'width', 'correlation', 'balance', 'dominant', 'roughness', 'peakL', 'peakR', 'crest']

export function emptyOsc1Features(): Osc1Features {
  return { level: 0, bass: 0, mid: 0, air: 0, flux: 0, centroid: 0, flatness: 0, width: 0, correlation: 0, balance: 0, dominant: 0, roughness: 0, peakL: 0, peakR: 0, crest: 0 }
}

export interface Osc1Letter {
  char: string
  table: Float32Array | null
  advance: number
  gain: number
  offset: number
  focus: Osc1Focus
  scanPhase: number
  response: number
  shock: number
  lastLit: boolean
  lastX: number
  lastY: number
}
export interface Osc1Signal { x: number; y: number; z: number; energy: number; q: number }

export class Osc1Engine {
  mode = 0
  s: Osc1Settings = osc1ModeSettings(0)
  f: Osc1Features = emptyOsc1Features()
  readonly bands = new Float32Array(OSC1_BAND_COUNT)
  readonly onsets = new Float32Array(OSC1_BAND_COUNT)
  letters: Osc1Letter[] = []
  playing = false
  waveL: Float32Array | null = null
  waveR: Float32Array | null = null
  waveStart = 0
  beamSamples = 0
  private readonly tables = new Map<string, Float32Array | null>()

  constructor(private glyphFor: (char: string) => Osc1Glyph | null) {}

  private table(char: string): Float32Array | null {
    if (!this.tables.has(char)) this.tables.set(char, compileOsc1Glyph(this.glyphFor(char)))
    return this.tables.get(char) ?? null
  }

  /** Drops compiled glyph tables (a font change) and rebuilds the letters, keeping per-letter settings by index. */
  setFont(glyphFor: (char: string) => Osc1Glyph | null): void {
    this.glyphFor = glyphFor
    this.tables.clear()
    this.setText(this.letters.map(l => l.char).join(''))
  }

  setText(text: string): void {
    const old = this.letters
    this.letters = [...text].map((char, i) => ({
      char,
      table: this.table(char),
      advance: this.glyphFor(char)?.advance || .35,
      gain: old[i]?.gain ?? 1, offset: old[i]?.offset ?? 0, focus: old[i]?.focus ?? 'auto',
      scanPhase: i * .137, response: 0, shock: 0, lastLit: false, lastX: 0, lastY: 0,
    }))
    this.reset()
  }

  reset(): void {
    this.f = emptyOsc1Features()
    this.bands.fill(0)
    this.onsets.fill(0)
    this.waveStart = 0
    for (const l of this.letters) { l.response = 0; l.shock = 0; l.lastLit = false }
  }

  setMode(i: number, s: Osc1Settings): void { this.mode = i; this.s = s }

  tick(dt: number, features: Osc1Features, playing: boolean): void {
    this.playing = playing
    const input = playing ? features : emptyOsc1Features(), s = this.s
    const f = this.f as unknown as Record<ScalarKey, number>
    for (const k of SCALAR_KEYS) {
      const raw = (input as unknown as Record<ScalarKey, number>)[k]
      const v = Number.isFinite(raw) ? raw : 0
      const tau = v > f[k] ? s.attack / 1000 : s.release / 1000
      f[k] = mix(f[k], v, 1 - Math.exp(-dt / Math.max(.004, tau)))
    }
    for (let k = 0; k < OSC1_BAND_COUNT; k++) {
      const fallback = [input.bass, input.bass, input.mid, input.mid, input.mid, input.air, input.air, input.air][k]
      const v = playing ? clamp(features.spectrum?.[k] ?? fallback) : 0
      const hit = playing ? clamp(features.onsets?.[k] ?? v * input.flux) : 0
      this.bands[k] = mix(this.bands[k], v, 1 - Math.exp(-dt / Math.max(.004, (v > this.bands[k] ? s.attack : s.release) / 1000)))
      // Fast attack, non-oscillating exponential release. No spring overshoot or autonomous phase.
      this.onsets[k] = Math.max(hit, this.onsets[k] * Math.exp(-dt / (s.release / 1000)))
    }
    this.waveStart = playing ? (features.waveStart || 0) : 0
    const state = this.f
    for (let i = 0; i < this.letters.length; i++) {
      const l = this.letters[i], focus = l.focus === 'auto' ? (['bass', 'mid', 'air'] as const)[i % 3] : l.focus
      l.response = clamp((state[focus as ScalarKey] || 0) * .8 + state.level * .2)
      l.shock = clamp(state.flux * (.35 + s.sensitivity / 100) * (.25 + l.response * .75))
    }
  }

  signal(l: Osc1Letter, i: number, u: number, scanPass = 0, _sampleOffset = 0, out: Osc1Signal = { x: 0, y: 0, z: 0, energy: 0, q: 0 }): Osc1Signal {
    const table = l.table
    if (!table) { out.z = 0; return out }
    const N = table.length / 3, p = ((u % 1) + 1) % 1 * N, k = Math.floor(p) % N, j = (k + 1) % N, t = p - Math.floor(p), a = k * 3, b = j * 3
    const bx = mix(table[a], table[b], t), by = mix(table[a + 1], table[b + 1], t), z = table[a + 2] && table[b + 2] ? 1 : 0
    const s = this.s, f = this.f, active = clamp(f.level * 3), motion = s.motion / 100 * l.gain, depth = s.depth / 100 * l.gain, detail = s.harmonics / 100
    const angle = Math.atan2(by, bx), focus = l.focus === 'auto' ? (['bass', 'mid', 'air'] as const)[i % 3] : l.focus
    let field = 0, burst = 0, norm = 0
    // Eight fixed frequency-to-direction mappings. Neighbouring bands overlap smoothly.
    // The offset rotates this mapping; no angle is advanced by elapsed time.
    const sharp = this.mode === 4 ? 12 : mix(9, 2, clamp(s.rotation / 140))
    for (let band = 0; band < OSC1_BAND_COUNT; band++) {
      const direction = -band * TAU / 8 + l.offset
      const weight = Math.exp((Math.cos(angle - direction) - 1) * sharp)
      const group = band < 2 ? 'bass' : band < 5 ? 'mid' : 'air'
      const focusWeight = focus === 'level' ? 1 : group === focus ? 1 : .3
      field += weight * this.bands[band] * focusWeight
      burst += weight * this.onsets[band] * focusWeight
      norm += weight
    }
    field /= Math.max(norm, .01)
    burst /= Math.max(norm, .01)
    // Trigger-aligned PCM controls outward extent, never additive X/Y wobble.
    let wl = 0, wr = 0
    if (this.waveL?.length && this.waveR?.length && active > .001) {
      const n = Math.min(this.waveL.length, this.waveR.length), phase = ((angle / TAU + l.offset / TAU) % 1 + 1) % 1
      const index = (this.waveStart + Math.floor(phase * Math.min(768, n - 1))) % n
      wl = Math.abs(this.waveL[index])
      wr = Math.abs(this.waveR[index])
    }
    const wave = clamp((wl + wr) * 1.7), attack = clamp(burst * (.4 + s.sensitivity / 100) + l.shock * .08)
    let extension = motion * active * (field * .65 + l.response * .1) + depth * active * attack * 1.7
    let ex = 1, ey = 1
    if (this.mode === 1) {
      const coupling = s.correlation / 100, stereo = 1 - f.correlation
      ex = .6 + f.peakL * .8 + wl * .5 + stereo * .12
      ey = .6 + f.peakR * .8 + wr * .5 + stereo * .12
      ex = mix(ex, (ex + ey) / 2, coupling * .35)
      ey = mix(ey, ex, coupling * .35)
    } else if (this.mode === 2) {
      extension *= .7 + detail * wave * 1.8
      extension *= 1 + (scanPass % 3) * .11 * detail * wave
    } else if (this.mode === 3) {
      extension = motion * active * field * .18 + depth * active * attack * 2.6
    } else if (this.mode === 4) {
      extension *= .6 + wave * detail * 2 + f.crest * .2
    } else {
      extension *= .85 + wave * detail * .65
    }
    // Positive radial/axis gain: the original contour is an invariant inner boundary.
    // Readability bounds the outer envelope, never switches off signal response.
    const maxExtension = mix(1.35, .38, clamp(s.readability / 100))
    const bias = s.shear / 100 * f.balance * .4, coupling = s.correlation / 100
    ex *= 1 + bias
    ey *= 1 - bias
    const radial = mix(.65, 1, coupling)
    const bounded = (v: number) => maxExtension * (1 - Math.exp(-Math.max(0, v) / maxExtension))
    const dx = bounded(extension * ex * radial), dy = bounded(extension * ey)
    out.x = bx * (1 + dx) * s.axisX / 100
    out.y = by * (1 + dy) * s.axisY / 100
    out.z = z
    out.energy = 1 + active * .18 + attack * (this.mode === 3 ? 1.9 : .65)
    out.q = Math.max(dx, dy)
    return out
  }
}

/** Energy raster with exponential phosphor decay and a hot-core transfer curve. */
export class Osc1Phosphor {
  w = 0
  h = 0
  energy = new Float32Array(0)
  rgba = new Uint8ClampedArray(0)
  deposits = 0
  constructor(w: number, h: number) { this.resize(w, h) }
  resize(w: number, h: number): void {
    this.w = w; this.h = h
    this.energy = new Float32Array(w * h)
    this.rgba = new Uint8ClampedArray(w * h * 4)
    this.deposits = 0
  }
  clear(): void { this.energy.fill(0) }
  deposit(x: number, y: number, e: number, width = 1): void {
    const ix = Math.floor(x), iy = Math.floor(y)
    if (ix < 1 || iy < 1 || ix >= this.w - 2 || iy >= this.h - 2) return
    const fx = x - ix, fy = y - iy, k = iy * this.w + ix, b = this.energy
    b[k] += e * (1 - fx) * (1 - fy)
    b[k + 1] += e * fx * (1 - fy)
    b[k + this.w] += e * (1 - fx) * fy
    b[k + this.w + 1] += e * fx * fy
    if (width > 1.2) {
      const halo = e * Math.min(.24, (width - 1) * .13)
      b[k - 1] += halo; b[k + 2] += halo; b[k - this.w] += halo; b[k + 2 * this.w] += halo
    }
    this.deposits++
  }
  segment(ax: number, ay: number, bx: number, by: number, energy: number, width: number): void {
    const distance = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(distance * 1.1))
    if (distance > this.w * .2) return
    const e = energy / steps
    for (let k = 1; k <= steps; k++) { const t = k / steps; this.deposit(mix(ax, bx, t), mix(ay, by, t), e, width) }
  }
  image(dt: number, persistence: number, color: string, intensity: number): Uint8ClampedArray {
    const tau = Math.max(.012, persistence / 1000), decay = Math.exp(-dt / tau)
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)), gain = .35 + intensity / 100 * 1.15
    const b = this.energy, out = this.rgba
    for (let i = 0; i < b.length; i++) {
      let e = b[i] * decay
      if (e < .0001) e = 0
      b[i] = Math.min(e, 20)
      const lum = 1 - Math.exp(-e * gain), hot = clamp((e * gain - 1.6) * .13), k = i * 4
      out[k] = lum * mix(rgb[0], 235, hot)
      out[k + 1] = lum * mix(rgb[1], 255, hot)
      out[k + 2] = lum * mix(rgb[2], 246, hot)
      out[k + 3] = 255
    }
    return out
  }
}

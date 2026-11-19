// Sound Drawing XY › OSC 2: the oscilloscope as a 3D environment. The beam still draws everything as one moving
// phosphor point, but its path now lives in 3D and is projected through a perspective camera:
//   • each letter is a stack of contour slices (a wireframe solid); every slice belongs to one of the eight
//     frequency regions, so bass pushes its slice forward and swells it while highs shiver at the back;
//   • behind the word, the live waveform is drawn as rows of terrain that scroll into the distance
//     (a "ridgeline" of the last moments of signal), over an optional floor grid;
//   • the camera sweeps around the word with the music, dollies on kicks and settles straight-on when paused.
// Nothing is random: the same input history gives the same picture.

import { OSC1_BAND_COUNT, compileOsc1Glyph, emptyOsc1Features, type Osc1Features, type Osc1Glyph, type Osc1Signal } from './XyScopeOsc1Engine'
import type { PhasePortal } from './XyScopePhasePortal'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

export interface Osc2Controls {
  /** Slice spread front to back, in letter heights. */
  depth: number
  /** Contour slices per letter (2–8). */
  layers: number
  /** Camera distance in letter heights. */
  distance: number
  /** Half-width of the camera sweep in degrees. */
  orbitRange: number
  /** How quickly the sweep advances with the music, 0–1. */
  orbitSpeed: number
  /** Camera elevation in degrees. */
  elevation: number
  /** How strongly the bands push and swell their slices. */
  audioDepth: number
  /** Camera push-in on kicks. */
  kickDolly: number
  /** Height of the waveform terrain, 0 hides it. */
  terrain: number
  intensity: number
  persistence: number
  width: number
  scan: number
}
export type Osc2ControlKey = keyof Osc2Controls
export interface Osc2Settings extends Osc2Controls { color: string }

export const OSC2_DEFAULTS: Readonly<Osc2Settings> = Object.freeze({
  depth: .5, layers: 5, distance: 6.5, orbitRange: 26, orbitSpeed: .4, elevation: 16, audioDepth: 1, kickDolly: .6, terrain: .7,
  intensity: 80, persistence: 95, width: 1.2, scan: 60, color: '#7fd0ff',
})
export const OSC2_RANGES: Readonly<Record<Osc2ControlKey, readonly [number, number]>> = Object.freeze({
  depth: [.05, 1.2], layers: [2, 8], distance: [2.6, 9], orbitRange: [0, 85], orbitSpeed: [0, 1], elevation: [-30, 60], audioDepth: [0, 2],
  kickDolly: [0, 1], terrain: [0, 1], intensity: [10, 100], persistence: [20, 250], width: [.6, 3], scan: [8, 180],
})

const TERRAIN_ROWS = 10
const TERRAIN_POINTS = 48
const FLOOR_Y = .78
const FLOOR_LINES_X = 9
const FLOOR_LINES_Z = 9

type StreamKind = 'letter' | 'floor' | 'terrain' | 'portal'
export interface Osc2Stream {
  kind: StreamKind
  char: string
  /** Letter contour, or a placeholder so the shared beam scanner treats every stream as drawable. */
  table: Float32Array | null
  advance: number
  /** World x of the letter's centre. */
  centre: number
  scanPhase: number
  lastLit: boolean
  lastX: number
  lastY: number
  /** Scan frequency multiplier relative to the Beam scan control. */
  rate: number
}
const PLACEHOLDER = new Float32Array(3)

export class Osc2Engine {
  /** Tells the shared scanner the streams carry absolute screen positions. */
  readonly absolute = true
  /** Width of the word in letter heights, so the stage fits it (at least a few letters wide). */
  get fitWidth(): number { return Math.max(this.portal ? 5 : 3, this.wordWidth * 1.25) }
  get anchorY(): number | undefined { return this.portal ? .59 : undefined }
  get sampleRate(): number | undefined { return this.portal ? 36_000 : undefined }
  s: Osc2Settings = { ...OSC2_DEFAULTS }
  floor = true
  streams: Osc2Stream[] = []
  /** Alias the scanner reads. */
  get letters(): Osc2Stream[] { return this.streams }
  f: Osc1Features = emptyOsc1Features()
  readonly bands = new Float32Array(OSC1_BAND_COUNT)
  readonly onsets = new Float32Array(OSC1_BAND_COUNT)
  waveL: Float32Array | null = null
  waveR: Float32Array | null = null
  waveStart = 0
  beamSamples = 0
  playing = false
  yaw = 0
  pitch = 0
  dolly = 0
  strafe = 0
  private phase = 0
  private sweep = 0
  private rowClock = 0
  private portal: PhasePortal | null = null
  private wordWidth = 0
  private wordTop = -.5
  private wordBottom = .5
  private wordLeft = 0
  private wordRight = 0
  private terrainHasCapture = true
  private readonly rows: Float32Array[] = Array.from({ length: TERRAIN_ROWS }, () => new Float32Array(TERRAIN_POINTS))
  private text = ''
  private readonly tables = new Map<string, Float32Array | null>()

  constructor(private glyphFor: (char: string) => Osc1Glyph | null) {}

  private table(char: string): Float32Array | null {
    if (!this.tables.has(char)) this.tables.set(char, compileOsc1Glyph(this.glyphFor(char)))
    return this.tables.get(char) ?? null
  }

  setFont(glyphFor: (char: string) => Osc1Glyph | null): void {
    this.glyphFor = glyphFor
    this.tables.clear()
    const text = this.text
    this.text = '\u0000'
    this.setText(text)
  }

  setText(text: string): void {
    if (text === this.text && this.streams.length) return
    this.text = text
    const letters = [...text]
    const advance = (char: string) => this.glyphFor(char)?.advance || .35
    const total = letters.reduce((sum, char) => sum + advance(char) + .3, 0)
    this.wordWidth = total
    this.wordTop = -.5
    this.wordBottom = .5
    this.wordLeft = -total / 2
    this.wordRight = total / 2
    let cursor = -total / 2
    const streams: Osc2Stream[] = letters.map((char, i) => {
      const a = advance(char)
      const stream: Osc2Stream = { kind: 'letter', char, table: this.table(char), advance: a, centre: cursor + (a + .3) / 2, scanPhase: i * .137, lastLit: false, lastX: 0, lastY: 0, rate: 1 }
      if (this.portal && stream.table) {
        for (let p = 0; p < stream.table.length; p += 3) {
          if (!stream.table[p + 2]) continue
          this.wordLeft = Math.min(this.wordLeft, stream.centre + stream.table[p])
          this.wordRight = Math.max(this.wordRight, stream.centre + stream.table[p])
          this.wordTop = Math.min(this.wordTop, stream.table[p + 1])
          this.wordBottom = Math.max(this.wordBottom, stream.table[p + 1])
        }
      }
      cursor += a + .3
      return stream
    })
    const env = (kind: StreamKind, rate: number): Osc2Stream => ({ kind, char: '', table: PLACEHOLDER, advance: 0, centre: 0, scanPhase: kind === 'floor' ? .31 : .62, lastLit: false, lastX: 0, lastY: 0, rate })
    streams.push(env('terrain', 1), env('floor', .8))
    if (this.portal) streams.push(env('portal', .76))
    this.streams = streams
    this.reset()
  }

  setPhasePortal(portal: PhasePortal | null): void {
    if (portal === this.portal) return
    this.portal = portal
    this.streams = []
    this.phase = this.sweep = this.strafe = 0
    this.setText(this.text)
  }

  reset(): void {
    this.f = emptyOsc1Features()
    this.bands.fill(0)
    this.onsets.fill(0)
    this.waveStart = 0
    this.dolly = 0
    this.rowClock = 0
    for (const row of this.rows) row.fill(0)
    for (const s of this.streams) s.lastLit = false
  }

  setSettings(s: Osc2Settings, floor: boolean): void { this.s = s; this.floor = floor }

  /** `clock.motionDt` is the time the camera sweep and the terrain scroll advance by (the track's beats with BPM Sync); envelopes stay in real time. */
  tick(dt: number, features: Osc1Features, playing: boolean, clock: { motionDt: number } = { motionDt: dt }, terrainHasCapture = true): void {
    this.playing = playing
    this.terrainHasCapture = terrainHasCapture
    const input = playing ? features : emptyOsc1Features()
    const f = this.f as unknown as Record<string, number>
    for (const key of ['level', 'bass', 'mid', 'air', 'flux', 'width', 'correlation', 'balance', 'peakL', 'peakR', 'crest'] as const) {
      const raw = (input as unknown as Record<string, number>)[key]
      const v = Number.isFinite(raw) ? raw : 0
      f[key] = mix(f[key], v, 1 - Math.exp(-dt / (v > f[key] ? .03 : .18)))
    }
    for (let k = 0; k < OSC1_BAND_COUNT; k++) {
      const fallback = [input.bass, input.bass, input.mid, input.mid, input.mid, input.air, input.air, input.air][k]
      const v = playing ? clamp(features.spectrum?.[k] ?? fallback) : 0
      const hit = playing ? clamp(features.onsets?.[k] ?? v * input.flux) : 0
      this.bands[k] = mix(this.bands[k], v, 1 - Math.exp(-dt / (v > this.bands[k] ? .025 : .16)))
      this.onsets[k] = Math.max(hit, this.onsets[k] * Math.exp(-dt / .18))
    }
    this.waveStart = playing ? (features.waveStart || 0) : 0

    // Camera: a sweep whose pace follows the music's level, settling straight-on in silence and when paused.
    const s = this.s, level = playing ? this.f.level : 0
    this.phase += clock.motionDt * s.orbitSpeed * 1.4 * (.15 + level * 1.6)
    const range = playing ? s.orbitRange * clamp(level * 4) : 0
    this.sweep = mix(this.sweep, range, 1 - Math.exp(-dt / .4))
    this.yaw = Math.sin(this.phase) * this.sweep * Math.PI / 180
    this.pitch = s.elevation * Math.PI / 180
    // Kicks push the camera in with a fast attack and a damped return.
    const kick = Math.max(this.onsets[0], this.onsets[1] * .8)
    this.dolly = Math.max(kick, this.dolly * Math.exp(-dt / .22))
    this.strafe = mix(this.strafe, this.f.balance * .5 * Math.min(1, s.audioDepth), 1 - Math.exp(-dt / .3))

    // Terrain: the newest moment of waveform enters the front row, older rows recede.
    if (playing && terrainHasCapture && this.waveL?.length) {
      this.rowClock += clock.motionDt
      if (this.rowClock >= .07) {
        this.rowClock %= .07
        const oldest = this.rows.pop()!
        const n = this.waveL.length, span = Math.min(768, n - 1)
        for (let i = 0; i < TERRAIN_POINTS; i++) oldest[i] = this.waveL[(this.waveStart + Math.floor(i / (TERRAIN_POINTS - 1) * span)) % n]
        this.rows.unshift(oldest)
      }
    } else {
      const decay = Math.exp(-dt * 3)
      for (const row of this.rows) for (let i = 0; i < TERRAIN_POINTS; i++) row[i] *= decay
    }
  }

  private project(x: number, y: number, z: number, out: Osc1Signal): void {
    const s = this.s, dist = s.distance * (1 - this.dolly * s.kickDolly * .22)
    const cx = x - this.strafe, cy = y
    const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw), cosP = Math.cos(this.pitch), sinP = Math.sin(this.pitch)
    const x1 = cx * cosY + z * sinY, z1 = -cx * sinY + z * cosY
    const y1 = cy * cosP - z1 * sinP, z2 = cy * sinP + z1 * cosP
    const scale = s.distance / Math.max(.4, dist - z2)
    out.x = x1 * scale
    out.y = y1 * scale
    // Nearer points burn brighter, as on a real scope; the far terrain fades into the dark.
    out.energy = clamp(scale, .35, 1.7) * (1 + this.f.level * .2)
    out.q = scale
  }

  private backdrop(out: Osc1Signal, gain: number): Osc1Signal {
    if (this.portal) {
      const clearance = Math.max(this.wordLeft - out.x, out.x - this.wordRight, this.wordTop - out.y, out.y - this.wordBottom)
      const visibility = this.wordWidth ? clamp((clearance - .07) / .2) : 1
      out.energy *= visibility * gain
      if (visibility === 0) out.z = 0
    }
    return out
  }

  signal(l: Osc2Stream, i: number, u: number, _pass = 0, _offset = 0, out: Osc1Signal = { x: 0, y: 0, z: 0, energy: 0, q: 0 }): Osc1Signal {
    const s = this.s
    const phase = ((u % 1) + 1) % 1
    if (l.kind === 'portal' && this.portal) {
      this.portal.signal(phase, out)
      return this.backdrop(out, 1)
    }
    if (l.kind === 'letter') {
      const table = l.table
      if (!table) { out.z = 0; return out }
      const layers = Math.max(2, Math.min(8, Math.round(s.layers)))
      // Phase Portal spends half of each letter sweep on its stationary face.
      const lp = this.portal ? (phase < .5 ? phase * 2 : 1 + (phase * 2 - 1) * (layers - 1)) : phase * layers
      const layer = Math.min(layers - 1, Math.floor(lp)), v = lp - layer
      const N = table.length / 3, p = v * N, k = Math.floor(p) % N, j = (k + 1) % N, t = p - Math.floor(p), a = k * 3, b = j * 3
      const bx = mix(table[a], table[b], t), by = mix(table[a + 1], table[b + 1], t)
      const lit = table[a + 2] && table[b + 2] ? 1 : 0
      if (this.portal && layer === 0) {
        out.x = l.centre + bx
        out.y = by
        out.z = lit
        out.energy = 2
        out.q = 1
        return out
      }
      // Slice 0 is the front. Each slice answers one frequency region, rotated per letter so neighbours differ.
      const frac = layer / (layers - 1)
      const band = (Math.round(frac * 7) + (i % 8)) % 8
      const react = s.audioDepth * (this.bands[band] + this.onsets[band] * .6)
      const swell = 1 + react * .3
      const z = (.5 - frac) * s.depth + react * .35
      this.project(l.centre + bx * swell, by * swell, z, out)
      out.z = lit
      if (this.portal) out.energy *= .31
      return out
    }
    if (l.kind === 'floor') {
      out.z = 0
      if (!this.floor) return out
      const lines = FLOOR_LINES_X + FLOOR_LINES_Z, lp = phase * lines, line = Math.min(lines - 1, Math.floor(lp)), v = lp - line
      let x: number, z: number
      if (line < FLOOR_LINES_X) { x = (line / (FLOOR_LINES_X - 1) - .5) * 9; z = mix(3, -8, v) }
      else { z = mix(2.5, -8, (line - FLOOR_LINES_X) / (FLOOR_LINES_Z - 1)); x = mix(-4.5, 4.5, v) }
      this.project(x, FLOOR_Y, z, out)
      out.energy *= .9
      out.z = v > .01 && v < .99 ? 1 : 0
      return this.backdrop(out, .27)
    }
    // Terrain: the last moments of the waveform as rows receding behind the word.
    out.z = 0
    if (s.terrain <= 0 || (this.portal && !this.terrainHasCapture)) return out
    const lp = phase * TERRAIN_ROWS, row = Math.min(TERRAIN_ROWS - 1, Math.floor(lp)), v = lp - row
    const idx = v * (TERRAIN_POINTS - 1), i0 = Math.floor(idx), i1 = Math.min(TERRAIN_POINTS - 1, i0 + 1)
    const sample = mix(this.rows[row][i0], this.rows[row][i1], idx - i0)
    const taper = Math.sqrt(Math.max(0, Math.sin(v * Math.PI)))
    const x = (v - .5) * 7, z = -1.4 - row * .55
    this.project(x, FLOOR_Y - sample * taper * s.terrain * 2.4, z, out)
    out.energy *= (1 - row / TERRAIN_ROWS * .7) * 1.6
    out.z = v > .02 && v < .98 ? 1 : 0
    return this.backdrop(out, .52)
  }
}

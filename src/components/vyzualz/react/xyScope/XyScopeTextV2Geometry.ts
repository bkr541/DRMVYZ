import type { XyScopeGlyphGeometry, XyScopeLayout } from './XyScopeGeometry'
import { createXyScopePointBuffers, type XyScopeScopeFrame } from './XyScopeMotion'
import { TEXT_V2_IDLE_PLAN } from './XyScopeTextV2Plan'
import type { TextV2PerformanceFrame } from './XyScopeTextV2Performance'
import type { XyScopeTextV2Settings } from './XyScopeTextV2Settings'
import type { TextV2TrajectoryFrame } from './XyScopeTextV2Trajectory'

export const TEXT_V2_BEAM_SAMPLES = 3072
export const TEXT_V2_WORD_SAMPLES = 2304
const FIELD_CHANNELS = 3
const FIELD_SAMPLES = (TEXT_V2_BEAM_SAMPLES - TEXT_V2_WORD_SAMPLES) / FIELD_CHANNELS
const TAU = Math.PI * 2
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x))

/** A filtered, signed signal sample. The carrier remains coherent when the signal is complex. */
function signedSample(samples: Float32Array, u: number, gain: number): number {
  const p = clamp(u, 0, 1) * (samples.length - 1), a = Math.floor(p), mix = p - a
  let left = 0, right = 0
  for (let j = -4; j <= 4; j++) {
    left += samples[clamp(a + j, 0, samples.length - 1)]
    right += samples[clamp(a + j + 1, 0, samples.length - 1)]
  }
  return Math.tanh((left + (right - left) * mix) * gain / 9)
}
interface Stroke { x: number[]; y: number[]; distances: number[]; length: number; center: number; letter: number; height: number }

/** One fixed-size XY stream. Font outlines are just one target formation of these same samples. */
export class XyScopeTextV2BeamPath {
  readonly buffer = createXyScopePointBuffers(TEXT_V2_BEAM_SAMPLES)
  readonly glyph: XyScopeGlyphGeometry = {
    character: 'XY', centerX: 0, heightPx: 1, count: TEXT_V2_BEAM_SAMPLES,
    starts: [0, TEXT_V2_BEAM_SAMPLES], closed: [false],
    x: new Float32Array(TEXT_V2_BEAM_SAMPLES), y: new Float32Array(TEXT_V2_BEAM_SAMPLES),
    nx: new Float32Array(TEXT_V2_BEAM_SAMPLES), ny: new Float32Array(TEXT_V2_BEAM_SAMPLES),
    s: Float32Array.from({ length: TEXT_V2_BEAM_SAMPLES }, (_, i) => i / (TEXT_V2_BEAM_SAMPLES - 1)),
  }
  private wordGaps = new Float32Array(TEXT_V2_BEAM_SAMPLES)
  private centers = new Float32Array(TEXT_V2_WORD_SAMPLES)
  private letters = new Uint16Array(TEXT_V2_WORD_SAMPLES)
  private heights = new Float32Array(TEXT_V2_WORD_SAMPLES)
  private plan = { ...TEXT_V2_IDLE_PLAN }
  private initialized = false
  private letterCount = 1
  private slots = 1
  private cycle = -1
  private groupingMix = 0
  private hasWord = false

  /** Replaces the lettering target only; current oscillator positions and stream length are untouched. */
  setLayout(layout: XyScopeLayout): void {
    this.letterCount = Math.max(1, layout.glyphs.length)
    this.hasWord = layout.totalPoints > 0
    const strokes: Stroke[] = []
    for (let letter = 0; letter < layout.glyphs.length; letter++) {
      const glyph = layout.glyphs[letter]
      for (let c = 0; c < glyph.starts.length - 1; c++) {
        const from = glyph.starts[c], to = glyph.starts[c + 1]
        const x: number[] = [], y: number[] = [], distances = [0]
        for (let i = from; i <= to; i++) {
          const j = i === to ? from : i
          x.push(glyph.centerX + glyph.x[j]); y.push(glyph.y[j])
          if (i > from) distances.push(distances.at(-1)! + Math.hypot(x.at(-1)! - x.at(-2)!, y.at(-1)! - y.at(-2)!))
        }
        const length = distances.at(-1) ?? 0
        if (length > 0) strokes.push({ x, y, distances, length, center: glyph.centerX, letter, height: glyph.heightPx })
      }
    }
    this.wordGaps.fill(0)
    this.glyph.x.fill(0); this.glyph.y.fill(0)
    if (!strokes.length) { this.glyph.x.fill(0); this.glyph.y.fill(0); this.wordGaps.fill(1); return }
    const total = strokes.reduce((sum, stroke) => sum + stroke.length, 0)
    let write = 0, accumulated = 0
    for (let c = 0; c < strokes.length; c++) {
      const stroke = strokes[c]
      accumulated += stroke.length
      const end = c === strokes.length - 1 ? TEXT_V2_WORD_SAMPLES : Math.round(accumulated / total * TEXT_V2_WORD_SAMPLES)
      const count = end - write
      let cursor = 1
      for (let i = 0; i < count; i++) {
        const distance = i / Math.max(1, count - 1) * stroke.length
        while (cursor < stroke.distances.length - 1 && stroke.distances[cursor] < distance) cursor++
        const span = stroke.distances[cursor] - stroke.distances[cursor - 1]
        const u = span > 0 ? (distance - stroke.distances[cursor - 1]) / span : 0
        const index = write + i
        const dx = stroke.x[cursor] - stroke.x[cursor - 1], dy = stroke.y[cursor] - stroke.y[cursor - 1]
        const magnitude = Math.max(.001, Math.hypot(dx, dy))
        this.glyph.nx[index] = -dy / magnitude; this.glyph.ny[index] = dx / magnitude
        this.centers[index] = stroke.center; this.letters[index] = stroke.letter; this.heights[index] = stroke.height
        this.glyph.x[write + i] = stroke.x[cursor - 1] + (stroke.x[cursor] - stroke.x[cursor - 1]) * u
        this.glyph.y[write + i] = stroke.y[cursor - 1] + (stroke.y[cursor] - stroke.y[cursor - 1]) * u
      }
      if (count > 0) this.wordGaps[end - 1] = 1
      write = end
    }
  }

  render(scope: XyScopeScopeFrame, frame: TextV2PerformanceFrame, trajectory: TextV2TrajectoryFrame,
    settings: XyScopeTextV2Settings, width: number, height: number, dt: number): void {
    if (trajectory.cycle !== this.cycle) { this.cycle = trajectory.cycle; this.slots = this.letterCount }
    // Numeric oscillator targets glide between evidence decisions instead of jumping at a beat.
    const ease = this.initialized ? 1 - Math.exp(-Math.max(0, dt) / .32) : 1
    for (const key of ['ratioX', 'ratioY', 'petals', 'skew', 'centerX', 'centerY', 'spread', 'field', 'grouping', 'drift'] as const) {
      this.plan[key] += (frame.plan[key] - this.plan[key]) * ease
    }
    this.initialized = true
    const p = this.plan
    const targetMix = settings.grouping === 'letters' ? 1 : settings.grouping === 'word' ? 0 : p.grouping
    this.groupingMix += (targetMix - this.groupingMix) * (1 - Math.exp(-dt / .12))
    const morph = trajectory.morph, c = frame.controls, weights = frame.weights
    const phase = frame.phase * TAU, drive = Math.min(1.5, frame.amount)
    const real = scope.source !== 'fallback'
    const detail = (.07 + settings.abstraction * .2) * drive
    const radiusX = width * (.29 + p.spread * .12) * c.xScale
    const radiusY = height * (.26 + p.spread * .14) * c.yScale
    const slots = this.slots
    const slotRadius = Math.min(width * .39 / slots, height * .24)
    for (let i = 0; i < TEXT_V2_WORD_SAMPLES; i++) {
      const u = i / (TEXT_V2_WORD_SAMPLES - 1)
      const slot = Math.min(slots - 1, Math.floor(u * slots)), local = Math.min(1, u * slots - slot)
      const channelPhase = slot * (1.1 + p.skew * .3) + c.channelOffset
      const signed = real ? signedSample(scope.trace, u, scope.traceGain) : Math.sin(TAU * u * 3 + phase) * frame.mid
      const side = real ? signedSample(scope.cloudX, u, scope.cloudGain) : Math.cos(TAU * u * 2 - phase) * frame.high
      let wordX = 0, wordY = 0, letterX = 0, letterY = 0
      for (let group = 0; group < 2; group++) {
        const a = TAU * (group === 0 ? u : local)
        const band = group === 0 ? frame.level : slot % 3 === 0 ? frame.bass : slot % 3 === 1 ? frame.mid : frame.high
        const spin = phase * (.05 + p.drift * .11) + (group === 1 ? channelPhase : 0)
        const rx = p.ratioX + (group === 1 ? slot % 2 : 0), ry = p.ratioY + (group === 1 ? slot % 3 * .5 : 0)
        const signal = signed * Math.sin(a / 2) ** 2 * detail * c.waveformDetail
        const radial = .88 + band * .15 + frame.impact * .2
        const orbitX = Math.cos(a + spin) * radial
        const orbitY = Math.sin(a + spin) * (.66 + .2 * Math.sin(p.skew)) * radial
        const weaveX = Math.sin(rx * a + spin + p.skew + side * c.stereoCoupling * .3)
        const weaveY = Math.sin(ry * a - spin * .5) * .87
        const ribbons = .12 + band * .32 * c.accentFolds
        const harmonicX = (Math.cos(a + spin) + ribbons * Math.cos(p.petals * a - spin)) / (1 + ribbons)
        const harmonicY = (Math.sin(a + spin) - ribbons * Math.sin(p.petals * a - spin)) / (1 + ribbons)
        const pulse = 1 + (.03 + .2 * frame.impact) * Math.sin((p.petals + 2) * a + phase)
        const impactX = Math.cos(a + spin) * pulse, impactY = Math.sin(a + spin) * pulse * .8
        const foldX = Math.sin(rx * a + spin), foldY = Math.sin((ry + .5) * a - spin) * (.6 + .2 * c.crossModulation)
        // Independent channels have distinct band focus and cross-modulation, not repeated copies of one curve.
        const extra = group === 1 ? .15 + band * .2 : 0
        const x0 = (orbitX * weights[0] + weaveX * weights[1] + harmonicX * weights[2] + impactX * weights[3] + foldX * weights[4]) * (1 - extra) + weaveX * extra + signal * c.deflection
        const y0 = (orbitY * weights[0] + weaveY * weights[1] + harmonicY * weights[2] + impactY * weights[3] + foldY * weights[4]) * (1 - extra) + harmonicY * extra + signal + side * detail * c.crossModulation
        const turn = c.angle * .25 + (group === 1 ? Math.sin(channelPhase) * .35 : 0)
        const x = x0 * Math.cos(turn) - y0 * Math.sin(turn), y = x0 * Math.sin(turn) + y0 * Math.cos(turn)
        if (group === 0) {
          wordX = x * radiusX + width * p.centerX * .45
          wordY = y * radiusY + height * p.centerY * .45
        } else {
          const spread = .72 + p.spread * .16
          const centerY = Math.sin(channelPhase + phase * .035) * height * (.1 + p.spread * .12)
          letterX = ((slot + .5) / slots - .5) * width * spread + x * slotRadius * (.75 + band * .3)
          letterY = centerY + y * slotRadius * (.9 + c.channelDepth * .15)
        }
      }
      const targetX = wordX * (1 - this.groupingMix) + letterX * this.groupingMix
      const targetY = wordY * (1 - this.groupingMix) + letterY * this.groupingMix
      // Font contours are driven by the same signed signal even while the word remains readable.
      const letter = this.letters[i], center = this.centers[i], h = this.heights[i]
      const band = letter % 3 === 0 ? frame.bass : letter % 3 === 1 ? frame.mid : frame.high
      const pulse = drive * (.035 + frame.bass * .055 + frame.impact * .12)
      const localScale = 1 + pulse + band * drive * .04 * Math.sin(phase * .6 + letter)
      const vibration = (signed * (.018 + c.deflection * .035) + side * .014 * c.crossModulation) * h * drive
      const sway = Math.sin(phase * .28 + letter * .9) * band * drive * h * .025
      const fold = Math.sin(this.glyph.y[i] / Math.max(1, h) * TAU * (1 + frame.mid) + phase * .8 + letter * .5)
        * h * drive * (.01 + settings.abstraction * .035) * (frame.mid * .4 + frame.impact) * c.accentFolds
      const nativeX = fold + center * (1 + pulse * .25) + (this.glyph.x[i] - center) * localScale + this.glyph.nx[i] * vibration
      const nativeY = this.glyph.y[i] * localScale + this.glyph.ny[i] * vibration + sway
      const localMorph = clamp(morph + Math.sin(letter * 1.7 + p.skew) * .1 * 4 * morph * (1 - morph), 0, 1)
      this.buffer.x[i] = clamp(nativeX * (1 - localMorph) + targetX * localMorph, -width * .47, width * .47)
      this.buffer.y[i] = clamp(nativeY * (1 - localMorph) + targetY * localMorph, -height * .47, height * .47)
      this.buffer.form[i] = morph; this.buffer.dissolved[i] = 0
      const slotBreak = i < TEXT_V2_WORD_SAMPLES - 1 && Math.floor((i + 1) / (TEXT_V2_WORD_SAMPLES - 1) * slots) !== Math.floor(u * slots)
      this.buffer.gap[i] = !this.hasWord ? 1 : Math.max(this.wordGaps[i] * (1 - morph), slotBreak ? this.groupingMix * morph : 0)
    }
    this.buffer.gap[TEXT_V2_WORD_SAMPLES - 1] = 1
    // Three lifted signal channels share the beam stream. They fill the surrounding stage with
    // coherent sweeps/orbits, opening on musical energy rather than adding a random line cloud.
    for (let channel = 0; channel < FIELD_CHANNELS; channel++) {
      const start = TEXT_V2_WORD_SAMPLES + channel * FIELD_SAMPLES
      const active = drive > .02 && p.field > .18 + channel * .19
      const turn = p.skew * .16 + phase * .035 + channel * TAU / 3
      for (let j = 0; j < FIELD_SAMPLES; j++) {
        const i = start + j, u = j / (FIELD_SAMPLES - 1), a = u * TAU
        const signal = real ? signedSample(channel === 1 ? scope.cloudX : scope.trace, u, scope.traceGain) : Math.sin(a * 3 + phase) * frame.level
        const wobble = signal * (.02 + frame.high * .045) * drive
        const radius = .34 + .035 * channel + frame.bass * .025
        const orbitX = Math.cos(a + turn) * (radius + wobble)
        const orbitY = Math.sin(a + turn) * (radius + wobble) + Math.sin(p.petals * a - phase * .1) * .025 * frame.mid
        const sweepX = (u - .5) * .87
        const sweepY = Math.sin(u * Math.PI * (1 + p.ratioY * .16) + phase * .08 + p.skew + channel) * .37 + wobble
        // The event changes the field geometry too: it is not an always-on ring decoration.
        const fieldMix = settings.autoPerformance ? Math.sin(p.skew + channel * 1.7) ** 2 : channel === 1 ? 1 : 0
        const x = orbitX * (1 - fieldMix) + sweepX * fieldMix
        const y = orbitY * (1 - fieldMix) + sweepY * fieldMix
        this.buffer.x[i] = active ? clamp(x * width, -width * .47, width * .47) : 0
        this.buffer.y[i] = active ? clamp(y * height, -height * .47, height * .47) : 0
        this.buffer.form[i] = morph
        this.buffer.dissolved[i] = .45 + (1 - p.field) * .3
        this.buffer.gap[i] = !active || j === FIELD_SAMPLES - 1 ? 1 : 0
      }
    }
  }
}

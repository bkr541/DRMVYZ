// A pattern is a complete beam performance, including departure from lettering,
// a full-field figure and the beam drawing its way back into the word. The beam is
// never blanked between the word and the figure: like a real scope, the trace
// stays lit and travels continuously from one to the other. The letters never bob
// or sway: each one, in turn, slowly turns into its own chaotic sine trace (the
// way a scope's beam would draw it) before the trace joins the figure, and the
// figure returns to the word by the same route. Pattern Change chooses
// another performance; it never enables or disables the current one.
import type { XyScopeGlyphGeometry } from './XyScopeGeometry'
import type { XyScopePointBuffers } from './XyScopeMotion'
import { computeXyScopeFormPoint, xyScopeFormBreak, type XyScopeFormDrive, type XyScopePattern } from './XyScopePatterns'

const TAU = Math.PI * 2
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t) }
export type XyScopeChoreographyPhase = 'word' | 'depart' | 'figure' | 'redraw'

export interface XyScopeChoreographyFrame {
  pattern: XyScopePattern
  /** Advances independently of pattern selection. */
  beat: number
  /** Transport/motion gate, eased to zero to settle back to the readable word. */
  amount: number
  width: number
  height: number
  transitionBeats: number
  answerDelayBeats: number
  drive: XyScopeFormDrive
}

/** Where the performance is in its phrase: the word, the departure into the figure, the figure, and the return (`redraw`) back into the word. */
export function xyScopeChoreographyPhrase(beat: number, transitionBeats: number) {
  const length = 8 + transitionBeats * 4
  const visit = Math.floor(Math.max(0, beat) / length)
  const progress = (Math.max(0, beat) % length) / length
  const phase: XyScopeChoreographyPhase = progress < 0.12 ? 'word' : progress < 0.44 ? 'depart'
    : progress < 0.66 ? 'figure' : progress < 0.88 ? 'redraw' : 'word'
  return { length, visit, progress, phase, morph: xyScopeMorph(progress, 0), redraw: clamp((progress - 0.66) / 0.22) }
}

/** How far the beam is from the letters' sine traces toward the figure (0 = traces, 1 = figure); `delay` staggers a letter's share of it. */
export function xyScopeMorph(progress: number, delay: number): number {
  return progress < 0.66 ? smooth((progress - 0.3 - delay) / 0.14) : progress < 0.8 ? 1 - smooth((progress - 0.66 - delay) / 0.12) : 0
}

/** How far a letter has turned into its own chaotic sine trace (0 = the letter, 1 = the trace); `delay` makes the letters turn one after another. */
export function xyScopeSineAmount(progress: number, delay: number): number {
  return progress < 0.5 ? smooth((progress - 0.12 - delay) / 0.18) : progress < 0.78 ? 1 : 1 - smooth((progress - 0.78 - delay) / 0.1)
}

/** Chaotic sine sets, one per variant: irregular, non-harmonic frequencies so no two traces repeat. */
const SINE_SETS: readonly (readonly [number, number, number])[] = [[2.1, 5.3, 11.7], [3.4, 8.9, 17.3], [1.6, 6.1, 13.9], [2.7, 7.4, 19.1]]

/**
 * A letter point's place on its own chaotic sine trace: the letter's outline unrolled left to right across its width, carrying a sum of
 * non-harmonic sines (frequency-modulated, drifting with the free-running clock, swelling with the music) plus the live triggered trace.
 */
function sineTrace(glyph: XyScopeGlyphGeometry, i: number, index: number, width: number, frame: XyScopeChoreographyFrame, out: { x: number; y: number }): void {
  const d = frame.drive, u = glyph.s[i], t = d.time
  const [f1, f2, f3] = SINE_SETS[(d.variation + index) % SINE_SETS.length]
  const phase = index * 1.7 + TAU * d.phase * 0.35
  const bend = 0.35 * Math.sin(TAU * 0.7 * u + t * 0.9 + index)
  const level = 0.55 + 0.45 * Math.min(1, d.bass * 0.6 + d.mid * 0.5 + d.high * 0.3 + d.kick * 0.4)
  const chaos = Math.sin(TAU * (f1 * u + bend) + phase + t * 1.1) * 0.55
    + Math.sin(TAU * (f2 * u) - phase * 0.6 - t * 1.9 + 0.4 * Math.sin(TAU * 1.3 * u + t * 0.6)) * 0.3
    + Math.sin(TAU * (f3 * u) + phase * 1.3 + t * 3.1) * 0.15
  const j = Math.min(d.trace.length - 1, Math.max(0, Math.floor(u * d.trace.length)))
  const real = d.trace[j] * d.traceGain
  out.x = glyph.centerX + (u - 0.5) * width * 1.12
  out.y = (chaos * level * 0.8 + real * 0.35) * glyph.heightPx * 0.5
}

const point = { x: 0, y: 0 }

/** Coherent oscillator paths in stage coordinates. No per-point randomness. */
function performancePoint(pattern: XyScopePattern, u: number, visit: number, frame: XyScopeChoreographyFrame) {
  const d = frame.drive
  const spin = TAU * d.phase
  let x: number, y: number
  if (pattern === 'word') {
    if (visit % 3 === 0) {
      // A travelling ribbon traces all four sides, then turns back into letters.
      const angle = TAU * u + spin * 0.4
      const c = Math.cos(angle), s = Math.sin(angle)
      const detail = 1 + 0.025 * d.high * Math.sin(angle * 12 + spin)
      x = Math.sign(c) * Math.sqrt(Math.abs(c)) * frame.width * 0.43 * detail * (0.92 + 0.08 * Math.cos(spin * 0.4))
      y = Math.sign(s) * Math.sqrt(Math.abs(s)) * frame.height * 0.4 * detail * (0.93 + 0.07 * Math.sin(spin * 0.5))
    } else if (visit % 3 === 1) {
      // Off-centre nested orbits emerge after the one-letter-at-a-time passage.
      const angle = TAU * u * 4 + spin * 0.5
      const radius = 0.12 + 0.8 * u
      x = (Math.cos(angle) * radius * 0.32 + 0.1 * Math.sin(spin * 0.2)) * frame.width
      y = Math.sin(angle) * radius * frame.height * 0.4
    } else {
      // A diagonal signal sweeps from one corner to the opposite corner.
      const j = Math.min(d.trace.length - 1, Math.floor(u * d.trace.length))
      x = (u - 0.5) * frame.width * 0.9
      y = -(u - 0.5) * frame.height * 0.78 + d.trace[j] * d.traceGain * frame.height * 0.08
    }
  } else {
    computeXyScopeFormPoint(pattern, u, d, point)
    const nx = point.x / Math.max(1, d.radius), ny = point.y / Math.max(1, d.radius)
    if (pattern === 'waveform') {
      const a = (visit % 4) * Math.PI / 4 + Math.sin(spin * 0.15) * 0.15
      const x0 = (u - 0.5) * 2, y0 = ny * 0.65
      x = (x0 * Math.cos(a) - y0 * Math.sin(a)) * frame.width * 0.43
      y = (x0 * Math.sin(a) + y0 * Math.cos(a)) * frame.height * 0.4
    } else if (pattern === 'scope') {
      x = (nx * 0.25 + Math.sin(spin * 0.35) * 0.16) * frame.width
      y = (ny * 0.3 + Math.cos(spin * 0.35) * 0.12) * frame.height
    } else {
      const scale = pattern === 'weave' ? 0.32 : 0.4
      x = nx * frame.width * scale
      y = ny * frame.height * scale
    }
  }
  point.x = Math.max(-frame.width * 0.47, Math.min(frame.width * 0.47, x))
  point.y = Math.max(-frame.height * 0.47, Math.min(frame.height * 0.47, y))
  return point
}

/** Reuses the letter's beam points: at the figure stage NO stationary word is drawn. */
export function applyXyScopeBeamChoreography(
  glyph: XyScopeGlyphGeometry, index: number, count: number,
  globalOffset: number, globalTotal: number, buffer: XyScopePointBuffers,
  frame: XyScopeChoreographyFrame,
): void {
  const phrase = xyScopeChoreographyPhrase(frame.beat, frame.transitionBeats)
  const amount = frame.amount
  const delay = Math.min(0.05, index * frame.answerDelayBeats / phrase.length)
  const morph = xyScopeMorph(phrase.progress, delay) * amount
  // Letters turn into their traces one after another, left to right, each one slowly.
  const turn = index / Math.max(1, count - 1) * 0.04
  const sine = xyScopeSineAmount(phrase.progress, turn) * amount
  let minX = Infinity, maxX = -Infinity
  if (sine > 0) for (let i = 0; i < glyph.count; i += 1) { minX = Math.min(minX, glyph.x[i]); maxX = Math.max(maxX, glyph.x[i]) }
  const width = Math.max(1, maxX - minX)
  const trace = { x: 0, y: 0 }

  for (let i = 0; i < glyph.count; i += 1) {
    const u = (globalOffset + i) / Math.max(1, globalTotal - 1)
    const target = performancePoint(frame.pattern, u, phrase.visit, frame)
    let x = buffer.x[i], y = buffer.y[i]
    if (sine > 0) {
      sineTrace(glyph, i, index, width, frame, trace)
      x = x * (1 - sine) + trace.x * sine
      y = y * (1 - sine) + trace.y * sine
    }
    buffer.x[i] = x * (1 - morph) + target.x * morph
    buffer.y[i] = y * (1 - morph) + target.y * morph
    buffer.form[i] = Math.max(morph, sine)
    // The beam is lit throughout the move between the word and the figure.
    let visibility = 1
    if (frame.pattern === 'word' && phrase.visit % 3 === 0 && morph > 0.998) {
      // The beam actually travels around the perimeter, leaving two trailing
      // arcs, rather than continuously repainting a stationary border.
      const behindHead = ((frame.drive.phase * 2 + phrase.progress - u) % 1 + 1) % 1
      if (behindHead > 0.24 && (behindHead < 0.5 || behindHead > 0.74)) visibility *= 1 - amount
    }
    let gap = (1 - visibility) / 1.2
    if (frame.pattern !== 'word' && xyScopeFormBreak(frame.pattern, u, Math.min(1, u + 1 / globalTotal), frame.drive.variation)) gap = Math.max(gap, morph)
    buffer.gap[i] = Math.max(buffer.gap[i], gap)
    buffer.dissolved[i] *= 1 - Math.max(morph, sine)
  }
}

// A pattern is a complete beam performance, including departure from lettering,
// a full-field figure, blanking and a new word drawing. Pattern Change chooses
// another performance; it never enables or disables the current one.
import type { XyScopeGlyphGeometry } from './XyScopeGeometry'
import type { XyScopePointBuffers } from './XyScopeMotion'
import { computeXyScopeFormPoint, xyScopeFormBreak, type XyScopeFormDrive, type XyScopePattern } from './XyScopePatterns'

const TAU = Math.PI * 2
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t) }
export type XyScopeChoreographyPhase = 'word' | 'depart' | 'figure' | 'fade' | 'blank' | 'redraw'

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

export function xyScopeChoreographyPhrase(beat: number, transitionBeats: number) {
  const length = 8 + transitionBeats * 4
  const visit = Math.floor(Math.max(0, beat) / length)
  const progress = (Math.max(0, beat) % length) / length
  const phase: XyScopeChoreographyPhase = progress < 0.12 ? 'word' : progress < 0.44 ? 'depart'
    : progress < 0.66 ? 'figure' : progress < 0.76 ? 'fade' : progress < 0.8 ? 'blank' : progress < 0.94 ? 'redraw' : 'word'
  const morph = progress < 0.76 ? smooth((progress - 0.28) / 0.16) : 0
  const visibility = progress < 0.66 ? 1 : progress < 0.76 ? 1 - smooth((progress - 0.66) / 0.1)
    : progress < 0.8 ? 0 : 1
  return { length, visit, progress, phase, morph, visibility, redraw: clamp((progress - 0.8) / 0.14) }
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
  const morph = (phrase.progress < 0.76 ? smooth((phrase.progress - 0.28 - delay) / 0.16) : 0) * amount
  const departure = smooth((phrase.progress - 0.12) / 0.1) * (1 - smooth((phrase.progress - 0.28) / 0.16)) * amount
  const focusPass = frame.pattern === 'word' && phrase.visit % 3 === 1
  const ordered = clamp((phrase.progress - 0.12) / 0.24) * Math.max(1, count)
  const featured = Math.min(count - 1, Math.floor(ordered))
  const local = ordered - Math.floor(ordered)
  const focus = focusPass ? smooth(local / 0.2) * (1 - smooth((local - 0.8) / 0.2)) * departure : 0
  const wave = Math.sin(TAU * (frame.beat / 4 - index / Math.max(1, count)))

  for (let i = 0; i < glyph.count; i += 1) {
    const u = (globalOffset + i) / Math.max(1, globalTotal - 1)
    const target = performancePoint(frame.pattern, u, phrase.visit, frame)
    let x = buffer.x[i], y = buffer.y[i]
    if (focusPass) {
      if (index === featured) {
        const scale = 1 + (Math.min(2.4, frame.height * 0.48 / Math.max(1, glyph.heightPx)) - 1) * focus
        x = (x - glyph.centerX) * scale + glyph.centerX * (1 - focus)
        y *= scale
      }
    } else {
      y += wave * frame.height * 0.13 * departure
      x += Math.sin(TAU * frame.beat / 8 + index) * frame.width * 0.025 * departure
    }
    buffer.x[i] = x * (1 - morph) + target.x * morph
    buffer.y[i] = y * (1 - morph) + target.y * morph
    buffer.form[i] = morph
    let visibility = 1 - amount * (1 - phrase.visibility)
    if (focusPass && index !== featured) visibility *= 1 - focus * (1 - morph)
    if (phrase.phase === 'redraw') visibility *= 1 - amount * (1 - smooth((phrase.redraw - u) * 24))
    if (phrase.phase === 'blank') visibility = 1 - amount
    if (frame.pattern === 'word' && phrase.visit % 3 === 0 && morph > 0.998) {
      // The beam actually travels around the perimeter, leaving two trailing
      // arcs, rather than continuously repainting a stationary border.
      const behindHead = ((frame.drive.phase * 2 + phrase.progress - u) % 1 + 1) % 1
      if (behindHead > 0.24 && (behindHead < 0.5 || behindHead > 0.74)) visibility *= 1 - amount
    }
    let gap = (1 - visibility) / 1.2
    if (frame.pattern !== 'word' && xyScopeFormBreak(frame.pattern, u, Math.min(1, u + 1 / globalTotal), frame.drive.variation)) gap = Math.max(gap, morph)
    buffer.gap[i] = Math.max(buffer.gap[i], gap)
    buffer.dissolved[i] *= 1 - morph
  }
}

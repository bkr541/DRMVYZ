// Sound Drawing XY: the choreography patterns. A pattern is a form the whole word can be in. `word` is the letters
// themselves; every other pattern is an oscillator figure drawn by the same beam, so the letters dissolve along
// their outlines into a waveform or an XY oscillator, perform as it, and are then drawn again.
//
// Each form is a pure function of a position `g` in [0, 1) along the whole word (letters left to right, each letter
// along its outline) and a drive describing the music. No randomness and no hidden state: the same inputs always
// give the same point, so seeks and loops are deterministic.

export const XY_SCOPE_PATTERN_IDS = ['word', 'waveform', 'scope', 'ring', 'rosette', 'weave', 'pinwheel'] as const
export type XyScopePattern = typeof XY_SCOPE_PATTERN_IDS[number]
export type XyScopeFormPattern = Exclude<XyScopePattern, 'word'>

export const XY_SCOPE_PATTERN_LABELS: Readonly<Record<XyScopePattern, string>> = Object.freeze({
  word: 'Word',
  waveform: 'Waveform',
  scope: 'Stereo Scope',
  ring: 'Ring',
  rosette: 'Rosette',
  weave: 'Weave',
  pinwheel: 'Pinwheel',
})

export const XY_SCOPE_PATTERN_OPTIONS = Object.freeze(XY_SCOPE_PATTERN_IDS.map(value => Object.freeze({ value, label: XY_SCOPE_PATTERN_LABELS[value] })))

/** The order Pattern Change steps through. The word comes back at the end of every cycle. */
export const XY_SCOPE_PATTERN_CYCLE: readonly XyScopePattern[] = XY_SCOPE_PATTERN_IDS

export function isXyScopePattern(value: unknown): value is XyScopePattern {
  return typeof value === 'string' && (XY_SCOPE_PATTERN_IDS as readonly string[]).includes(value)
}

export function xyScopePatternIndex(pattern: XyScopePattern): number {
  return XY_SCOPE_PATTERN_IDS.indexOf(pattern)
}

export interface XyScopeFormDrive {
  /** Continuous rotation phase, in cycles. Beat-locked with BPM Sync, free-running otherwise. */
  phase: number
  /** Radius of one centred figure, px. */
  radius: number
  /** Half the span of the waveform trace, px, and its vertical scale. */
  halfWidth: number
  halfHeight: number
  /** 0..1 music levels, already scaled by Audio Reactivity and Form Response. */
  bass: number
  mid: number
  high: number
  kick: number
  snare: number
  /** Changes each time a pattern is entered, so repeat visits show a different variant (petal count, ratio, arms). */
  variation: number
  /** The live scope window: mid/side trace and its gain. */
  cloudX: Float32Array
  cloudY: Float32Array
  cloudGain: number
  /** The smoothed mid-signal trace the Waveform pattern draws, and its gain. */
  trace: Float32Array
  traceGain: number
}

export interface XyScopePoint { x: number; y: number }

const TAU = Math.PI * 2
const WEAVE_RATIOS: ReadonlyArray<readonly [number, number]> = [[3, 2], [5, 4], [4, 3], [5, 3], [7, 5]]
const ROSETTE_PETALS = [5, 6, 7] as const
const PINWHEEL_ARMS = [6, 5, 7] as const

function waveform(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const n = d.trace.length
  const f = Math.min(n - 1.001, Math.max(0, g * (n - 1)))
  const i = Math.floor(f)
  const v = (d.trace[i] + (d.trace[i + 1] - d.trace[i]) * (f - i)) * d.traceGain
  out.x = (g - 0.5) * 2 * d.halfWidth
  out.y = -v * d.halfHeight
}

function scope(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const n = d.cloudX.length
  const j = Math.min(n - 1, Math.floor(g * n))
  out.x = d.cloudX[j] * d.cloudGain * d.radius * 1.35
  out.y = -d.cloudY[j] * d.cloudGain * d.radius
}

function ring(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const theta = TAU * g + TAU * d.phase * 0.15
  const teeth = 20 + 6 * (d.variation % 3)
  const depth = 0.015 + 0.06 * d.high + 0.05 * d.snare
  const squash = 0.62 + 0.38 * Math.abs(Math.cos(TAU * d.phase * 0.11))
  const r = d.radius * (1 + 0.1 * d.kick + 0.16 * d.bass) * (1 + depth * Math.sin(teeth * theta + TAU * d.phase * 0.7))
  const tilt = TAU * d.phase * 0.05 + 0.6
  const x0 = r * Math.cos(theta)
  const y0 = r * Math.sin(theta) * squash
  out.x = x0 * Math.cos(tilt) - y0 * Math.sin(tilt)
  out.y = x0 * Math.sin(tilt) + y0 * Math.cos(tilt)
}

function weave(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const [a, b] = WEAVE_RATIOS[d.variation % WEAVE_RATIOS.length]
  const theta = TAU * g
  const delta = TAU * d.phase * 0.06 + 0.7
  const r = d.radius * (1 + 0.1 * d.kick + 0.14 * d.bass)
  out.x = r * 1.15 * Math.sin(a * theta + delta)
  out.y = r * Math.sin(b * theta)
}

function rosette(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const petals = ROSETTE_PETALS[d.variation % ROSETTE_PETALS.length]
  const a = 0.46 + 0.2 * d.mid
  const theta = TAU * g
  // Two rotating phasors: the second turns at a different speed, which is what draws the spiral arms.
  const spin = TAU * d.phase * 0.08
  const epi = TAU * d.phase * 0.3
  let x = Math.cos(theta) + a * Math.cos(-(petals - 1) * theta) + 0.12 * Math.cos((petals + 1) * theta + epi)
  let y = Math.sin(theta) + a * Math.sin(-(petals - 1) * theta) + 0.12 * Math.sin((petals + 1) * theta + epi)
  const r = d.radius * (1 + 0.08 * d.kick + 0.12 * d.bass) / (1 + a + 0.12)
  const c = Math.cos(spin)
  const s = Math.sin(spin)
  const rx = x * c - y * s
  y = x * s + y * c
  x = rx
  out.x = x * r
  out.y = y * r
}

function pinwheel(g: number, d: XyScopeFormDrive, out: XyScopePoint): void {
  const arms = PINWHEEL_ARMS[d.variation % PINWHEEL_ARMS.length]
  const scaled = Math.min(arms - 1e-6, g * arms)
  const arm = Math.floor(scaled)
  const u = scaled - arm
  const alpha = TAU * arm / arms + TAU * d.phase * 0.12
  const hub = 0.6 * d.radius * (1 + 0.1 * d.kick)
  const radius = 0.36 * d.radius * (1 + 0.25 * d.mid)
  const beta = alpha + Math.PI * (0.425 + 1.15 * u) + Math.PI * 0.5
  out.x = hub * Math.cos(alpha) + radius * Math.cos(beta)
  out.y = hub * Math.sin(alpha) + radius * Math.sin(beta)
}

const FORMS: Readonly<Record<XyScopeFormPattern, (g: number, d: XyScopeFormDrive, out: XyScopePoint) => void>> = Object.freeze({
  waveform, scope, ring, rosette, weave, pinwheel,
})

/**
 * True when the line from point `gA` to the next point `gB` is a hand-over between separate strokes of the form
 * (the gap between two pinwheel arms) rather than part of the figure. The beam lifts there, as a real scope blanks
 * between strokes, so separate arms stay separate.
 */
export function xyScopeFormBreak(pattern: XyScopeFormPattern, gA: number, gB: number, variation: number): boolean {
  if (pattern !== 'pinwheel') return false
  const arms = PINWHEEL_ARMS[variation % PINWHEEL_ARMS.length]
  return Math.floor(Math.min(arms - 1e-6, gA * arms)) !== Math.floor(Math.min(arms - 1e-6, gB * arms))
}

/** Position of point `g` (0..1 along the whole word) in the given form, px from the stage centre. */
export function computeXyScopeFormPoint(pattern: XyScopeFormPattern, g: number, drive: XyScopeFormDrive, out: XyScopePoint): void {
  FORMS[pattern](g, drive, out)
}

export function createXyScopeFormDrive(): XyScopeFormDrive {
  return {
    phase: 0, radius: 200, halfWidth: 400, halfHeight: 120,
    bass: 0, mid: 0, high: 0, kick: 0, snare: 0, variation: 0,
    cloudX: new Float32Array(512), cloudY: new Float32Array(512), cloudGain: 1,
    trace: new Float32Array(512), traceGain: 1,
  }
}

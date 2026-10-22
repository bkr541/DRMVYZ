import { canopyHash, type CanopyPatternId } from './Cinema2CanopyDomain'
import type { CanopyFixture } from './Cinema2CanopyLayout'

/**
 * The six formations. Each is a pure function of a rod's place in the array and a phase in beats, so the same inputs always give the same
 * rod heights. `offset` is the normalized height of the rod's cap: -1 is lifted to the top of its travel, +1 hangs as low as it goes.
 *
 * A sample is the time-independent shape (`rest`, the formation at phase 0) plus a `motion` part that Motion Amount scales, so Motion Amount 0
 * leaves the formation standing and only stops it moving.
 */
export interface CanopyPatternSample {
  rest: number
  motion: number
  /** 0..1: how strongly the formation singles this rod out right now; the rod's light follows it. */
  glow: number
}

export interface CanopyPatternContext {
  /** Beats since this pattern took the stage (already scaled by Motion Speed). */
  phase: number
  rows: number
  columns: number
  /** On mirrors the formation about the array's centre line; off lets it lean. */
  symmetry: boolean
  /** A phrase boundary leans the formation sideways for a moment (0..1). */
  skew: number
}

const TAU = Math.PI * 2
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const fract = (x: number) => x - Math.floor(x)

/** A square wave between -1 and +1 that eases across each edge; the first half-period is already settled at +1. */
function easedSquare(cycles: number, edge: number): number {
  const index = Math.floor(cycles)
  if (index <= 0) return 1
  const sign = index % 2 === 0 ? 1 : -1
  return -sign + 2 * sign * smooth(0, edge, fract(cycles))
}

interface RawSample { offset: number; glow: number }

function waterfall(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  const fv = f.rowFromFront / Math.max(1, c.rows - 1)
  const lean = c.symmetry ? 0 : 0.35 * (f.u + 1) + c.skew * 1.2 * f.u
  const wave = fract(phase / 8) * (c.rows + 2) - 1
  const k = f.rowFromFront + lean - wave
  const bump = Math.exp(-(k * k) / (2 * 0.85 * 0.85))
  out.offset = -0.55 + 1.1 * fv + 0.75 * bump
  out.glow = bump
}

function crosswave(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  const u = (c.symmetry ? Math.abs(f.u) : f.u) + c.skew * 0.6 * f.v
  const a = Math.sin(Math.PI * 1.1 * (u + f.v) - TAU * phase / 8)
  const b = Math.sin(Math.PI * 1.1 * (u - f.v) + TAU * phase / 8)
  out.offset = 0.8 * (a + b) / 2
  out.glow = Math.min(1, Math.abs(a + b) / 2 + 0.15)
}

function crown(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  let r = f.radius
  if (!c.symmetry) {
    const du = f.u - 0.3 - c.skew * 0.3
    const dv = f.v + 0.2
    r = Math.min(1, Math.sqrt(du * du + dv * dv) / 1.6)
  }
  const bowl = 0.7 - 1.4 * smooth(0.1, 0.95, r)
  const breath = 0.22 * Math.sin(TAU * phase / 8 - r * Math.PI * 1.5) * (0.4 + 0.6 * (1 - r))
  out.offset = bowl + breath
  out.glow = 1 - r
}

function splitWings(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  const wing = smooth(-0.18, 0.18, f.u) * 2 - 1
  const sw = easedSquare(phase / 4, 0.25)
  const rightSwap = c.symmetry || wing <= 0 ? sw : easedSquare((phase - 1) / 4, 0.25)
  const swap = wing <= 0 ? sw : rightSwap
  const ripple = 0.18 * Math.sin(TAU * phase / 4 + f.v * Math.PI + (c.symmetry ? 0 : wing > 0 ? 0.9 : 0))
  out.offset = 0.6 * wing * swap - wing * ripple
  out.glow = 0.5 + 0.5 * wing * swap
}

function checkerLift(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  const parity = (f.row + f.column) % 2 === 0 ? 1 : -1
  const tier = easedSquare(phase / 2, 0.3)
  out.offset = 0.55 * parity * tier + (c.symmetry ? 0 : 0.25 * f.v)
  out.glow = 0.5 + 0.5 * parity * tier
}

function downpour(f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample): void {
  const stagger = (c.symmetry ? f.radius : (f.u + 1) / 2) * 0.05 + c.skew * 0.03 * f.v
  const cycle = Math.max(0, fract(phase / 8) - stagger)
  const curve = smooth(0, 0.45, cycle) * (1 - smooth(0.62, 1, cycle))
  out.offset = -0.6 + 1.2 * curve + (f.jitter - 0.5) * 0.16
  out.glow = curve
}

const EVALUATORS: Readonly<Record<CanopyPatternId, (f: CanopyFixture, c: CanopyPatternContext, phase: number, out: RawSample) => void>> = Object.freeze({
  waterfall, crosswave, crown, splitWings, checkerLift, downpour,
})

const scratchRest: RawSample = { offset: 0, glow: 0 }
const scratchLive: RawSample = { offset: 0, glow: 0 }
const restContext: CanopyPatternContext = { phase: 0, rows: 0, columns: 0, symmetry: true, skew: 0 }

/** Pure: no clock, no random source. `out` is overwritten so a frame allocates nothing per rod. */
export function evaluateCanopyPattern(
  pattern: CanopyPatternId,
  fixture: Readonly<CanopyFixture>,
  context: Readonly<CanopyPatternContext>,
  out: CanopyPatternSample = { rest: 0, motion: 0, glow: 0 },
): CanopyPatternSample {
  const evaluate = EVALUATORS[pattern]
  restContext.rows = context.rows
  restContext.columns = context.columns
  restContext.symmetry = context.symmetry
  evaluate(fixture, restContext, 0, scratchRest)
  evaluate(fixture, context, Math.max(0, context.phase), scratchLive)
  out.rest = scratchRest.offset
  out.motion = scratchLive.offset - scratchRest.offset
  out.glow = scratchLive.glow
  return out
}

/** Jitter-free 0..1 hash of the fixture used by callers that need a stable per-rod phase. */
export const canopyFixtureSeed = (fixture: Readonly<CanopyFixture>, salt = 0): number => canopyHash(fixture.index, salt)

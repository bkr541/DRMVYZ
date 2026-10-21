import type { Cinema2MainframeImpulses, Cinema2MainframeSignals } from '../mainframe/Cinema2MainframeReactivity'
import {
  BWC_CEILING_TUBE_COUNT,
  BWC_CEILING_TUBE_FIRST,
  BWC_CEILING_TUBE_PITCH,
  BWC_PIPE_COUNT,
  BWC_WALL_BAY_COUNT,
  BWC_WALL_BAY_FIRST,
  BWC_WALL_BAY_PITCH,
  clampBwcLightLevel,
  neutralBwcLighting,
  type Cinema2BwcLightingState,
} from './Cinema2BwcLighting'

/**
 * The six BWC lighting programs. Each one turns the musical clock and the audio into a level for every lit element (see
 * Cinema2BwcLighting), and does it from where the element stands in the hall: how far it is from the reactor, how far along the line.
 *
 * - Flow: a wave travels the way the production line does, from the front of the hall through the reactor to the back.
 * - Core Burst: the reactor fires on every beat and the light runs out through the pipes, then the walls and ceiling, a beat-fraction behind.
 * - Alternate: the two walls, the ceiling tubes and the pipes swap sides on the beat.
 * - Center Out: rings of light leave the reactor and cross the hall every two beats.
 * - Ceiling Sweep: the ceiling tubes sweep from end to end and back while everything else stays low.
 * - Surge: the lights fill outward from the reactor as a buildup charges, and release together on a drop. It does nothing without a buildup.
 */
export const CINEMA2_BWC_PATTERN_IDS = Object.freeze(['flow', 'core-burst', 'alternate', 'center-out', 'ceiling-sweep', 'surge'] as const)
export type Cinema2BwcPatternId = typeof CINEMA2_BWC_PATTERN_IDS[number]
export const CINEMA2_BWC_DEFAULT_PATTERN: Cinema2BwcPatternId = 'flow'
export const CINEMA2_BWC_PATTERN_LABELS: Readonly<Record<Cinema2BwcPatternId, string>> = Object.freeze({
  flow: 'Flow', 'core-burst': 'Core Burst', alternate: 'Alternate', 'center-out': 'Center Out', 'ceiling-sweep': 'Ceiling Sweep', surge: 'Surge',
})

/** The Effects-group controls that shape every pattern. The defaults leave the patterns exactly as authored. */
export interface Cinema2BwcPatternStyle {
  /** 0..1; 0.5 is the authored width of the travelling waves (Flow, Center Out, Ceiling Sweep) and of Surge's fill edge. */
  readonly pulseWidth: number
  /** 0..1 scale on how hard a drop lights the hall. */
  readonly dropIntensity: number
  /** 0..1 how often the wall panels and ceiling tubes cut out and stutter, each on its own. 0 keeps them steady. */
  readonly flicker: number
}
export const CINEMA2_BWC_DEFAULT_STYLE: Readonly<Cinema2BwcPatternStyle> = Object.freeze({ pulseWidth: 0.5, dropIntensity: 1, flicker: 0 })

export interface Cinema2BwcPatternInput {
  readonly pattern: Cinema2BwcPatternId
  /** Beats since the pattern started. */
  readonly beats: number
  /** Overall musical energy, 0..1. */
  readonly level: number
  /** How far a detected buildup has charged, 0..1; 0 when none is confidently detected. */
  readonly buildCharge: number
  readonly signals: Readonly<Cinema2MainframeSignals>
  readonly impulses: Cinema2MainframeImpulses
  /** False when nothing is playing: the scene then keeps its authored, unchoreographed look. */
  readonly active: boolean
  readonly style?: Readonly<Cinema2BwcPatternStyle>
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number): number => value - Math.floor(value)
/** A smooth bump of unit height and half-width `width` centred on 0. */
const bump = (offset: number, width: number): number => { const t = Math.max(0, 1 - Math.abs(offset) / width); return t * t * (3 - 2 * t) }
/** A hit at phase 0 that dies away over the beat. */
const decay = (phase: number, rate: number): number => Math.exp(-rate * fract(phase))
const triangle = (phase: number): number => 1 - Math.abs(2 * fract(phase) - 1)

/** A repeatable pseudo-random number in [0, 1) from a seed; the same seed always gives the same number. */
const hash = (seed: number): number => fract(Math.sin(seed * 12.9898 + 78.233) * 43758.5453)

/** Where each element stands, along the hall (0 at the back wall, 1 at the front) and by distance from the reactor (0 at it, 1 at the ends). */
const HALL_Z_MIN = -15.5
const HALL_Z_MAX = 9.5
const REACTOR_Z = -3.55
const REACTOR_REACH = 12.5
const alongHall = (z: number): number => clamp01((z - HALL_Z_MIN) / (HALL_Z_MAX - HALL_Z_MIN))
const fromReactor = (z: number): number => clamp01(Math.abs(z - REACTOR_Z) / REACTOR_REACH)
const wallZ = Array.from({ length: BWC_WALL_BAY_COUNT }, (_, i) => (i + BWC_WALL_BAY_FIRST) * BWC_WALL_BAY_PITCH)
const ceilingZ = Array.from({ length: BWC_CEILING_TUBE_COUNT }, (_, i) => (i + BWC_CEILING_TUBE_FIRST) * BWC_CEILING_TUBE_PITCH - 0.64)
const REACTOR_ALONG = alongHall(REACTOR_Z)
/** Which side of the hall each pipe runs to, in the shader's pipe order: A and B to the left wall, C straight up, D and E to the right wall. */
const PIPE_SIDE = Object.freeze([-1, -1, 0, 1, 1] as const)

interface Draft {
  core: number
  ring: number
  hood: number
  ringChase: [number, number]
  pipes: number[]
  pipeFlow: [number, number]
  wallLeft: number[]
  wallRight: number[]
  ceiling: number[]
}

/** Levels leave the engine already clamped to the range the renderer accepts, so a pile-up of impulses cannot ask for more. */
function freeze(draft: Draft): Readonly<Cinema2BwcLightingState> {
  const levels = (values: readonly number[]): readonly number[] => Object.freeze(values.map(clampBwcLightLevel))
  return Object.freeze({
    reactorCore: clampBwcLightLevel(draft.core), reactorRing: clampBwcLightLevel(draft.ring), hood: clampBwcLightLevel(draft.hood),
    ringChase: Object.freeze(draft.ringChase) as readonly [number, number],
    pipes: levels(draft.pipes), pipeFlow: Object.freeze(draft.pipeFlow) as readonly [number, number],
    wallLeft: levels(draft.wallLeft), wallRight: levels(draft.wallRight), ceiling: levels(draft.ceiling),
  })
}

/** Pure and deterministic: the same input always gives the same levels, and nothing reads the clock or a random source. */
export function evaluateCinema2BwcPattern(input: Readonly<Cinema2BwcPatternInput>): Readonly<Cinema2BwcLightingState> {
  if (!input.active) return neutralBwcLighting()
  const { signals: s, impulses: e } = input
  const beats = Number.isFinite(input.beats) ? Math.max(0, input.beats) : 0
  const level = clamp01(input.level)
  const charge = clamp01(input.buildCharge)
  // What an unlit element rests at: dim, but rising with the music so a quiet passage is darker than a loud one.
  const rest = 0.14 + 0.3 * level
  const style = input.style ?? CINEMA2_BWC_DEFAULT_STYLE
  const width = 0.5 + clamp01(style.pulseWidth)
  const drop = clamp01(e.drop) * clamp01(style.dropIntensity)
  const draft: Draft = {
    core: 0.6 + 0.4 * level, ring: 0.6 + 0.3 * level, hood: rest + 0.3,
    ringChase: [fract(beats / 4), 0.7], pipes: Array(BWC_PIPE_COUNT).fill(0.55 + 0.35 * s.bass),
    pipeFlow: [fract(beats / 2), 0.8],
    wallLeft: Array(BWC_WALL_BAY_COUNT).fill(rest), wallRight: Array(BWC_WALL_BAY_COUNT).fill(rest), ceiling: Array(BWC_CEILING_TUBE_COUNT).fill(rest),
  }
  const eachWall = (fn: (z: number, index: number, side: 0 | 1) => number): void => {
    for (let i = 0; i < BWC_WALL_BAY_COUNT; i += 1) {
      draft.wallLeft[i] = fn(wallZ[i]!, i, 0)
      draft.wallRight[i] = fn(wallZ[i]!, i, 1)
    }
  }
  const eachCeiling = (fn: (z: number, index: number) => number): void => {
    for (let i = 0; i < BWC_CEILING_TUBE_COUNT; i += 1) draft.ceiling[i] = fn(ceilingZ[i]!, i)
  }

  switch (input.pattern) {
    case 'flow': {
      // Front to back, a little over one hall length per bar.
      const front = 1.12 - fract(beats / 4) * 1.3
      const wave = (z: number): number => bump(alongHall(z) - front, 0.16 * width)
      eachWall((z) => rest + wave(z) * (0.95 + 0.5 * e.downbeat))
      eachCeiling((z) => rest + wave(z) * (1 + 0.4 * e.beat))
      draft.core = 0.62 + 0.5 * level + 0.5 * e.kick + 0.6 * drop
      draft.ring = 0.7 + 0.5 * level + 0.4 * e.snare
      draft.hood = rest + 0.3 + 0.9 * bump(REACTOR_ALONG - front, 0.12 * width)
      draft.pipes = draft.pipes.map(() => 0.65 + 0.5 * s.bass + 0.4 * e.kick)
      break
    }
    case 'core-burst': {
      // Every beat the reactor fires; the light reaches the pipes a quarter beat later and each wall bay and tube later still.
      const hit = (delay: number): number => decay(beats - delay, 3.2)
      draft.core = 0.4 + 1.1 * hit(0) + 0.5 * e.kick + 0.3 * level + 0.6 * drop
      draft.ring = 0.4 + 0.9 * hit(0.1) + 0.4 * e.snare
      draft.hood = rest + 0.2 + 0.9 * hit(0.15)
      draft.pipes = draft.pipes.map((_, i) => 0.3 + 0.35 * s.bass + 1.1 * hit(PIPE_SIDE[i] === 0 ? 0.25 : 0.3))
      draft.pipeFlow = [Math.min(1, fract(beats) * 1.6), 1]
      draft.ringChase = [fract(beats * 2), 0.9]
      eachWall((z) => rest + (0.55 + 0.4 * e.downbeat) * hit(0.5 * fromReactor(z) + 0.4))
      eachCeiling((z) => rest + (0.6 + 0.4 * e.beat) * hit(0.5 * fromReactor(z) + 0.45))
      break
    }
    case 'alternate': {
      const parity = Math.floor(beats) % 2
      const flash = 0.55 + 0.55 * decay(beats, 2.2)
      eachWall((_z, i, side) => ((i + parity + side) % 2 === 0 ? rest + flash : rest))
      eachCeiling((_z, i) => ((i + parity) % 2 === 0 ? rest : rest + flash))
      // A and B ride the left wall and D and E the right; the centre pipe holds.
      draft.pipes = PIPE_SIDE.map(side => (side === 0 ? 0.7 + 0.3 * s.bass
        : ((side < 0 ? 0 : 1) + parity) % 2 === 0 ? 0.3 + 0.35 * s.bass + 0.9 * decay(beats, 2.2) : 0.3 + 0.35 * s.bass))
      draft.core = 0.7 + 0.4 * level + 0.5 * e.kick + 0.6 * drop
      draft.ring = 0.55 + 0.4 * level + 0.7 * e.snare
      draft.hood = rest + 0.3 + 0.6 * e.beat
      draft.pipeFlow = [0, 0]
      draft.ringChase = [fract(beats / 8), 0.4]
      break
    }
    case 'center-out': {
      // Two rings in flight, half a launch apart, each crossing the hall in two beats.
      const launch = fract(beats / 2)
      const rings = (z: number): number => Math.max(bump(fromReactor(z) - launch * 1.2, 0.16 * width), 0.7 * bump(fromReactor(z) - fract(beats / 2 + 0.5) * 1.2, 0.16 * width))
      eachWall((z) => rest + rings(z) * (0.95 + 0.4 * e.beat))
      eachCeiling((z) => rest + rings(z) * (1 + 0.4 * e.beat))
      draft.core = 0.55 + 0.35 * level + 0.9 * decay(beats / 2, 3) + 0.5 * e.kick + 0.6 * drop
      draft.ring = 0.6 + 0.9 * decay(beats / 2, 3) + 0.4 * e.snare
      draft.hood = rest + 0.3 + 0.7 * decay(beats / 2, 3)
      draft.pipeFlow = [launch, 1]
      draft.ringChase = [fract(beats), 0.8]
      break
    }
    case 'ceiling-sweep': {
      // End to end and back every eight beats.
      const position = triangle(beats / 8)
      eachCeiling((z) => rest + bump(alongHall(z) - position, 0.2 * width) * (1.05 + 0.4 * e.beat))
      eachWall((z) => rest * 0.8 + 0.45 * bump(alongHall(z) - position, 0.3 * width) + 0.25 * e.downbeat)
      draft.core = 0.55 + 0.5 * level + 0.4 * e.kick + 0.6 * drop
      draft.ring = 0.55 + 0.4 * level + 0.4 * e.snare
      draft.hood = rest + 0.25
      draft.pipes = draft.pipes.map(() => 0.4 + 0.4 * s.bass + 0.4 * s.high)
      draft.pipeFlow = [0, 0]
      draft.ringChase = [position, 0.8]
      break
    }
    case 'surge': {
      // The buildup fills the hall outward from the reactor. Only a detected buildup does this, so a track without one stays at rest.
      const strobe = charge > 0.8 ? 0.5 * (1 - fract(beats * 2)) * (charge - 0.8) / 0.2 : 0
      const filled = (z: number): number => clamp01((charge * 1.1 - fromReactor(z)) / (0.18 * width))
      eachWall((z) => rest + filled(z) * (0.9 + strobe) + 1.1 * drop)
      eachCeiling((z) => rest + filled(z) * (0.95 + strobe) + 1.1 * drop)
      draft.core = 0.45 + 1.1 * charge + strobe + 0.5 * e.kick + 1.2 * drop
      draft.ring = 0.45 + 1.0 * charge + 0.3 * e.snare + 1.0 * drop
      draft.hood = rest + 0.3 + 0.7 * charge + 0.8 * drop
      draft.pipes = draft.pipes.map(() => 0.3 + 1.0 * charge + 0.35 * s.bass + 1.0 * drop)
      draft.pipeFlow = [charge, charge > 0.02 ? 1 : 0]
      draft.ringChase = [fract(beats / 2), 0.3 + 0.6 * charge]
      break
    }
  }
  // Flicker: each wall panel and ceiling tube drops out on its own for a moment, about six times a beat, chosen by a repeatable hash.
  const flicker = clamp01(style.flicker)
  if (flicker > 0) {
    const step = Math.floor(beats * 6)
    const stutter = (index: number, salt: number): number => (hash(index * 7.31 + salt * 19.7 + step * 1.618) < flicker * 0.4 ? 0.12 : 1)
    draft.wallLeft = draft.wallLeft.map((level, i) => level * stutter(i, 1))
    draft.wallRight = draft.wallRight.map((level, i) => level * stutter(i, 2))
    draft.ceiling = draft.ceiling.map((level, i) => level * stutter(i, 3))
  }
  return freeze(draft)
}

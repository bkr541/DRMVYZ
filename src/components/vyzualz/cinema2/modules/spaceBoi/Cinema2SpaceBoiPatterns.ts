import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'

/**
 * Space Boi's programs. Each one poses the whole scene from the shared beat position: the figure's head, body and two arms, the three bands of
 * ripples in the water, the four planets, the three small moons and the stars. Beats are the shared musical clock; a pose never reads audio itself.
 *
 * Numbers are in the module's own units: angles in radians, lifts in scene units (the figure is about 3.9 tall), scales and levels as multipliers
 * where 1 is exactly the authored look. A level above 1 is brighter than the authored ink (it blooms), below 1 fades the ink toward the void.
 */
export const CINEMA2_SPACE_BOI_PATTERNS = Object.freeze([
  Object.freeze({ value: 'stargazing', label: 'Stargazing' }),
  Object.freeze({ value: 'reach', label: 'Reach' }),
  Object.freeze({ value: 'conductor', label: 'Conductor' }),
  Object.freeze({ value: 'planet-waltz', label: 'Planet Waltz' }),
  Object.freeze({ value: 'tide-pulse', label: 'Tide Pulse' }),
  Object.freeze({ value: 'look-around', label: 'Look Around' }),
  Object.freeze({ value: 'ascension', label: 'Ascension' }),
  Object.freeze({ value: 'supernova', label: 'Supernova' }),
] as const)
export type Cinema2SpaceBoiPattern = typeof CINEMA2_SPACE_BOI_PATTERNS[number]['value']
export const CINEMA2_SPACE_BOI_PATTERN_IDS: readonly Cinema2SpaceBoiPattern[] = Object.freeze(CINEMA2_SPACE_BOI_PATTERNS.map(pattern => pattern.value))
export const CINEMA2_SPACE_BOI_DEFAULT_PATTERN: Cinema2SpaceBoiPattern = 'stargazing'
export const CINEMA2_SPACE_BOI_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS

/** Right ringed planet, big left planet, small dark left planet, small dark planet behind the figure's right shoulder. */
export const SPACE_BOI_PLANET_COUNT = 4
export const SPACE_BOI_MOON_COUNT = 3

export interface SpaceBoiPose {
  /** [yaw, pitch, roll]: yaw turns the head toward the viewer's right, pitch tips it up, roll leans it toward the right shoulder. */
  readonly head: readonly [number, number, number]
  /** [sway, bob, breath]: sway leans the body toward the viewer's right, bob lifts it out of the water (negative sinks it in), breath stretches it. */
  readonly body: readonly [number, number, number]
  /** Per arm [left, right] as the viewer sees them. `raise` swings the arm out and up from its shoulder (about 1.57 is level); `forward` swings it toward the viewer. */
  readonly arms: { readonly raise: readonly [number, number]; readonly forward: readonly [number, number] }
  /** The three bands of ripples: the wide outer water, the small ring at the figure and the ring round the hands. */
  readonly ripples: { readonly scale: readonly [number, number, number]; readonly level: readonly [number, number, number] }
  readonly planets: { readonly lift: readonly number[]; readonly scale: readonly number[]; readonly level: readonly number[] }
  readonly moons: readonly number[]
  readonly stars: { readonly level: number; readonly spin: number }
  /** The figure's own lines. */
  readonly figure: number
}

const TAU = Math.PI * 2
const fract = (value: number) => value - Math.floor(value)
const smooth = (edge0: number, edge1: number, value: number) => { const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }
/** An accent that jumps to 1 on the beat and decays. */
const hit = (beats: number, rate = 5) => Math.exp(-fract(beats) * rate)
const each = <T>(count: number, make: (index: number) => T): T[] => Array.from({ length: count }, (_, index) => make(index))
const planets = (lift: (k: number) => number, scale: (k: number) => number, level: (k: number) => number) => ({ lift: each(SPACE_BOI_PLANET_COUNT, lift), scale: each(SPACE_BOI_PLANET_COUNT, scale), level: each(SPACE_BOI_PLANET_COUNT, level) })

const REST: SpaceBoiPose = Object.freeze({
  head: Object.freeze([0, 0, 0]) as readonly [number, number, number],
  body: Object.freeze([0, 0, 0]) as readonly [number, number, number],
  arms: Object.freeze({ raise: Object.freeze([0, 0]) as readonly [number, number], forward: Object.freeze([0, 0]) as readonly [number, number] }),
  ripples: Object.freeze({ scale: Object.freeze([1, 1, 1]) as readonly [number, number, number], level: Object.freeze([1, 1, 1]) as readonly [number, number, number] }),
  planets: Object.freeze({ lift: Object.freeze([0, 0, 0, 0]), scale: Object.freeze([1, 1, 1, 1]), level: Object.freeze([1, 1, 1, 1]) }),
  moons: Object.freeze([1, 1, 1]),
  stars: Object.freeze({ level: 1, spin: 0 }),
  figure: 1,
})
export const SPACE_BOI_REST_POSE = REST

/** Where the head turns to look at each planet in Look Around, in the order it visits them: [yaw, pitch, planet]. */
const LOOK_TARGETS: ReadonlyArray<readonly [number, number, number]> = [[-.8, .12, 2], [-.55, .38, 1], [.4, .42, 3], [.85, .2, 0]]

export function evaluateSpaceBoiPattern(pattern: Cinema2SpaceBoiPattern, beats: number): SpaceBoiPose {
  switch (pattern) {
    // The authored picture with a slow breath: he looks up at the planets and hardly moves. At beat 0 this is exactly the model as authored.
    case 'stargazing': {
      const slow = Math.sin(beats * Math.PI / 4), breath = Math.sin(beats * Math.PI / 2)
      return {
        ...REST, head: [.05 * slow, .035 * Math.sin(beats * Math.PI / 2), .02 * slow], body: [.01 * slow, 0, .008 * breath],
        ripples: { scale: [1 + .008 * breath, 1 + .012 * breath, 1 + .01 * breath], level: [1, 1, 1] }, stars: { level: 1, spin: .004 },
      }
    }
    // He reaches toward the sky over eight beats and lowers his arms again; the planets drift closer and brighten as he lifts.
    case 'reach': {
      const phase = fract(beats / 8), up = smooth(0, .4, phase) - smooth(.6, 1, phase), rightLate = smooth(.06, .46, phase) - smooth(.64, 1, phase)
      return {
        ...REST, head: [0, .3 * up, .05 * up], body: [0, .06 * up, .02 * up],
        arms: { raise: [2 * up, 2 * rightLate], forward: [.25 * up, .25 * rightLate] },
        planets: planets(() => .3 * up, () => 1 + .12 * up, () => 1 + .3 * up), moons: [1 + .4 * up, 1 + .4 * up, 1 + .4 * up],
        stars: { level: 1 + .3 * up, spin: .01 + .02 * up }, ripples: { scale: [1, 1 + .05 * up, 1], level: [1, 1 + .2 * up, 1] },
      }
    }
    // He conducts: the arms take the beat in turn, the head nods on it, and each planet answers on its own beat of the bar.
    case 'conductor': {
      const index = Math.floor(beats), leftTurn = index % 2 === 0, strike = hit(beats), glide = smooth(0, .3, fract(beats))
      const active = (left: boolean) => left === leftTurn
      return {
        ...REST, head: [(leftTurn ? -.14 : .14) * glide, -.12 * strike, (leftTurn ? -.05 : .05) * glide], body: [(leftTurn ? -.03 : .03) * glide, -.07 * strike, 0],
        arms: { raise: [active(true) ? .7 + 1 * strike : .15, active(false) ? .7 + 1 * strike : .15], forward: [active(true) ? .2 * strike : 0, active(false) ? .2 * strike : 0] },
        planets: planets(k => k === index % 4 ? .18 * strike : 0, k => k === index % 4 ? 1 + .35 * strike : 1, k => k === index % 4 ? 1 + .6 * strike : 1),
        moons: [1 + .5 * hit(beats + 1), 1 + .5 * hit(beats + 2), 1 + .5 * hit(beats + 3)], stars: { level: 1 + .2 * strike, spin: .01 },
        ripples: { scale: [1, 1, 1 + .15 * strike], level: [1, 1, 1 + .5 * strike] },
      }
    }
    // The planets circle one another over eight beats while he sways and holds his arms out to balance.
    case 'planet-waltz': {
      const phase = beats / 8 * TAU, sway = Math.sin(beats * Math.PI / 4)
      return {
        ...REST, head: [.12 * sway, .12, .08 * sway], body: [.09 * sway, 0, 0], arms: { raise: [.6 + .3 * sway, .6 - .3 * sway], forward: [.05, .05] },
        planets: planets(k => .38 * Math.sin(phase + k * Math.PI / 2), k => 1 + .1 * Math.sin(phase + k * Math.PI / 2 + 1), k => .85 + .3 * (.5 + .5 * Math.sin(phase + k * Math.PI / 2))),
        moons: each(SPACE_BOI_MOON_COUNT, j => .7 + .7 * (.5 + .5 * Math.sin(phase + j * 2))), stars: { level: 1, spin: .02 }, ripples: { scale: [1, 1, 1], level: [1, 1, 1] },
      }
    }
    // A ripple leaves him once every bar and spreads out through the water while he sinks a little and rises again.
    case 'tide-pulse': {
      const phase = fract(beats / 4), ring = 1 - phase
      return {
        ...REST, head: [0, .08 * ring, 0], body: [0, -.12 * Math.exp(-phase * 3), -.01 * ring], arms: { raise: [.3 * ring, .3 * ring], forward: [0, 0] },
        ripples: { scale: [1 + .24 * phase, 1 + .5 * phase, 1 + .32 * phase], level: [1 - .55 * phase + .6 * Math.exp(-phase * 9), 1 - .65 * phase + .7 * Math.exp(-phase * 9), 1 - .5 * phase + .6 * Math.exp(-phase * 9)] },
        planets: planets(() => 0, () => 1, () => .85 + .25 * Math.exp(-phase * 4)), moons: [1, 1, 1], stars: { level: 1 + .1 * ring, spin: .008 },
      }
    }
    // The head turns to look at each planet in turn, two beats each; the planet he looks at brightens and swells.
    case 'look-around': {
      const slot = Math.floor(beats / 2) % LOOK_TARGETS.length, next = (slot + 1) % LOOK_TARGETS.length, eased = smooth(.55, 1, fract(beats / 2))
      const at = LOOK_TARGETS[slot]!, to = LOOK_TARGETS[next]!, mix = (a: number, b: number) => a + (b - a) * eased
      const gaze = (k: number) => (at[2] === k ? 1 - eased : 0) + (to[2] === k ? eased : 0)
      const side = mix(at[0], to[0])
      return {
        ...REST, head: [side, mix(at[1], to[1]), .08 * side], body: [.03 * side, 0, 0], arms: { raise: [side < 0 ? .5 : .12, side > 0 ? .5 : .12], forward: [0, 0] },
        planets: planets(k => .12 * gaze(k), k => 1 + .14 * gaze(k), k => .9 + .9 * gaze(k)), moons: [1, 1, 1], stars: { level: 1, spin: .006 }, ripples: { scale: [1, 1, 1], level: [1, 1, 1] },
      }
    }
    // A build over sixteen beats: his arms climb and tremble, the planets rise and swell, the stars fill the sky, and the water begins to shake.
    case 'ascension': {
      const phase = (beats % 16) / 16, climb = smooth(0, .85, phase), tremble = .04 * phase * Math.sin(beats * 7)
      return {
        ...REST, head: [0, .45 * climb, .03 * tremble * 10], body: [tremble, .3 * climb, .015 * phase], arms: { raise: [2.2 * climb + tremble, 2.2 * climb - tremble], forward: [.3 * climb, .3 * climb] },
        ripples: { scale: [1 + .12 * phase * Math.sin(beats * Math.PI), 1 + .2 * phase * Math.sin(beats * Math.PI + 1), 1 + .15 * phase * Math.sin(beats * Math.PI + 2)], level: [1 + .6 * phase, 1 + .6 * phase, 1 + .6 * phase] },
        planets: planets(() => .6 * climb, () => 1 + .3 * climb, () => 1 + .8 * phase), moons: [1 + 1.2 * phase, 1 + 1.2 * phase, 1 + 1.2 * phase], stars: { level: 1 + 1.2 * phase, spin: .02 + .06 * phase },
        figure: 1 + .25 * phase,
      }
    }
    // A drop: twice a beat the arms are thrown up and the planets, stars and water flash on alternate halves of the beat, decaying fast.
    case 'supernova': {
      const half = Math.floor(beats * 2) % 2 === 0, strike = Math.exp(-fract(beats * 2) * 5)
      return {
        ...REST, head: [0, .35 * strike, 0], body: [0, .15 * strike, 0],
        arms: { raise: half ? [.3 + 2.1 * strike, .3 + 2.1 * strike] : [.3 + .5 * strike, .3 + .5 * strike], forward: [half ? .3 * strike : 0, half ? .3 * strike : 0] },
        ripples: { scale: [1 + .5 * strike, 1 + .8 * strike, 1 + .6 * strike], level: [1 + 1.4 * strike, 1 + 1.4 * strike, 1 + 1.4 * strike] },
        planets: planets(k => (k % 2 === 0) === half ? .25 * strike : 0, k => (k % 2 === 0) === half ? 1 + .6 * strike : 1, k => (k % 2 === 0) === half ? 1 + 1.2 * strike : .8),
        moons: [half ? 1 + 1.4 * strike : .8, half ? .8 : 1 + 1.4 * strike, half ? 1 + 1.4 * strike : .8], stars: { level: 1 + 1.6 * strike, spin: .05 }, figure: 1 + .3 * strike,
      }
    }
  }
}

type Numeric = number | readonly Numeric[] | { readonly [key: string]: Numeric }
function lerp<T extends Numeric>(from: T, to: T, t: number): T {
  if (typeof from === 'number') return (from + ((to as number) - from) * t) as T
  if (Array.isArray(from)) return (from as readonly Numeric[]).map((value, index) => lerp(value, (to as readonly Numeric[])[index]!, t)) as unknown as T
  return Object.fromEntries(Object.entries(from as Record<string, Numeric>).map(([key, value]) => [key, lerp(value, (to as Record<string, Numeric>)[key]!, t)])) as T
}

/** The pose `t` of the way from one program's to another's, for easing in a program change. */
export function blendSpaceBoiPoses(from: SpaceBoiPose, to: SpaceBoiPose, t: number): SpaceBoiPose {
  return lerp(from as unknown as Numeric, to as unknown as Numeric, t) as unknown as SpaceBoiPose
}

import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'

/**
 * CHAMBER's light programs. Each one sets how bright every glowing element is, from the shared beat position: the ring around the platform (12 arcs),
 * the radial floor ticks (8), the four corner beacons, the lamps on the device's two arms (3 per arm), and the lamp under the device. A level multiplies
 * the element's authored emission, so 1 is exactly the original look. Cells are ordered by angle around the platform, so one program runs the same way
 * round all the rings. The room's added fixtures (blades, scan rings, light shaft, wash lights) are driven by the same programs.
 */
export const CINEMA2_CHAMBER_PATTERNS = Object.freeze([
  Object.freeze({ value: 'standby', label: 'Standby' }),
  Object.freeze({ value: 'ring-chase', label: 'Ring Chase' }),
  Object.freeze({ value: 'pulse-ripple', label: 'Pulse Ripple' }),
  Object.freeze({ value: 'sentinel-sweep', label: 'Sentinel Sweep' }),
  Object.freeze({ value: 'countdown', label: 'Countdown' }),
  Object.freeze({ value: 'core-breath', label: 'Core Breath' }),
  Object.freeze({ value: 'charge-ring', label: 'Charge Ring' }),
  Object.freeze({ value: 'lockdown-flash', label: 'Lockdown Flash' }),
] as const)
export type Cinema2ChamberPattern = typeof CINEMA2_CHAMBER_PATTERNS[number]['value']
export const CINEMA2_CHAMBER_PATTERN_IDS: readonly Cinema2ChamberPattern[] = Object.freeze(CINEMA2_CHAMBER_PATTERNS.map(pattern => pattern.value))
export const CINEMA2_CHAMBER_DEFAULT_PATTERN: Cinema2ChamberPattern = 'standby'
export const CINEMA2_CHAMBER_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS

export const CHAMBER_RING_CELLS = 12
export const CHAMBER_TICK_CELLS = 8
export const CHAMBER_BEACON_CELLS = 4
/** Three lamps on the left arm, then three on the right. */
export const CHAMBER_LAMP_CELLS = 6
/** The room's own fixtures, added to the chamber: seven light blades standing in an arc behind the model, four rings on the floor round the platform (innermost first), one light shaft down from the lamp, and a wash light either side (left, right). */
export const CHAMBER_BLADE_CELLS = 7
export const CHAMBER_SCAN_CELLS = 4
export const CHAMBER_WASH_CELLS = 2

/**
 * How far each of the device's two arms hangs from its ceiling mount, in radians: `swing` tilts the arm out (positive) or in, `twist` turns it about its
 * own bracket. [left, right]. Standby leaves both at zero, which is the model exactly as authored.
 */
export interface ChamberArms { readonly swing: readonly [number, number]; readonly twist: readonly [number, number] }

export interface ChamberLevels {
  readonly ring: readonly number[]
  readonly ticks: readonly number[]
  readonly beacons: readonly number[]
  readonly lamps: readonly number[]
  readonly core: number
  readonly arms: ChamberArms
  readonly blades: readonly number[]
  readonly scan: readonly number[]
  readonly shaft: number
  readonly wash: readonly number[]
}

const fract = (value: number) => value - Math.floor(value)
const smooth = (edge0: number, edge1: number, value: number) => { const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }
/** Distance travelled behind a head moving round a circle, in turns (0 at the head, then growing); the head's own trail. */
const behind = (head: number, position: number) => fract(head - position)
const comet = (head: number, position: number, tail: number, floor: number, peak: number) => floor + (peak - floor) * Math.exp(-behind(head, position) / tail) * (behind(head, position) < .5 ? 1 : 0)
const pulseAt = (phase: number, center: number, width: number) => { const d = Math.abs(fract(phase - center + .5) - .5); return Math.exp(-((d / width) ** 2)) }
const cells = (count: number, level: (index: number, position: number) => number) => Array.from({ length: count }, (_, index) => level(index, index / count))
const lampSide = (index: number) => index < 3 ? 0 : 1

const NO_ARMS: ChamberArms = Object.freeze({ swing: Object.freeze([0, 0]) as readonly [number, number], twist: Object.freeze([0, 0]) as readonly [number, number] })
const arms = (swing: [number, number], twist: [number, number]): ChamberArms => ({ swing, twist })
/** What the added fixtures do when no program plays: they idle as faint hardware, so the room has depth without pulling the eye off the model. */
const IDLE = Object.freeze({
  blades: Object.freeze(Array<number>(CHAMBER_BLADE_CELLS).fill(.16)), scan: Object.freeze(Array<number>(CHAMBER_SCAN_CELLS).fill(.1)),
  shaft: .12, wash: Object.freeze(Array<number>(CHAMBER_WASH_CELLS).fill(.2)),
})
const REST: ChamberLevels = Object.freeze({
  ...IDLE,
  ring: Object.freeze(Array<number>(CHAMBER_RING_CELLS).fill(1)), ticks: Object.freeze(Array<number>(CHAMBER_TICK_CELLS).fill(1)),
  beacons: Object.freeze(Array<number>(CHAMBER_BEACON_CELLS).fill(1)), lamps: Object.freeze(Array<number>(CHAMBER_LAMP_CELLS).fill(1)), core: 1, arms: NO_ARMS,
})

type CoreLevels = Omit<ChamberLevels, 'blades' | 'scan' | 'shaft' | 'wash'>
type FixtureLevels = Pick<ChamberLevels, 'blades' | 'scan' | 'shaft' | 'wash'>

export function evaluateChamberPattern(pattern: Cinema2ChamberPattern, beats: number): ChamberLevels {
  return { ...evaluateCoreLevels(pattern, beats), ...evaluateFixtureLevels(pattern, beats) }
}

/**
 * The added fixtures follow the same beat as the original elements. The blades stand left to right, the floor rings innermost first, the shaft hangs from the
 * lamp under the device, and the wash lights stand either side of the model. Each program gives them a part that reads as its own: a sweep, a climb, a pulse
 * out from the lamp, a side-to-side exchange, a count, a breath, a fill or a flash.
 */
function evaluateFixtureLevels(pattern: Cinema2ChamberPattern, beats: number): FixtureLevels {
  const blades = (level: (index: number, position: number) => number) => cells(CHAMBER_BLADE_CELLS, (index) => level(index, index / (CHAMBER_BLADE_CELLS - 1)))
  const scan = (level: (index: number, position: number) => number) => cells(CHAMBER_SCAN_CELLS, (index) => level(index, index / (CHAMBER_SCAN_CELLS - 1)))
  const wash = (left: number, right: number) => [left, right] as const
  switch (pattern) {
    case 'standby': return IDLE
    case 'ring-chase': {
      const sweep = 1 - Math.abs(2 * fract(beats / 4) - 1), beat = Math.exp(-fract(beats) * 4), left = Math.floor(beats) % 2 === 0
      return {
        blades: blades((_, p) => .1 + 1.8 * Math.exp(-Math.abs(p - sweep) / .16)),
        scan: scan((_, p) => comet(fract(beats / 2), p * .75, .18, .1, 1.8)),
        shaft: .2 + .9 * beat, wash: wash(left ? .15 + 1.3 * beat : .15, left ? .15 : .15 + 1.3 * beat),
      }
    }
    case 'pulse-ripple': {
      const phase = fract(beats / 4)
      return {
        blades: blades(() => .1 + 1.9 * pulseAt(phase, .95, .09)),
        scan: scan((_, p) => .08 + 1.8 * pulseAt(phase, .12 + p * .24, .08)),
        shaft: .1 + 1.9 * pulseAt(phase, 0, .09), wash: wash(.15 + 1.6 * pulseAt(phase, .3, .09), .15 + 1.6 * pulseAt(phase, .3, .09)),
      }
    }
    case 'sentinel-sweep': {
      const left = Math.floor(beats) % 2 === 0, ease = smooth(0, .25, fract(beats))
      return {
        blades: blades((index) => index === 3 ? .45 : ((index < 3) === left ? .2 + 1.5 * ease : .12 * (1 - ease) + .1)),
        scan: scan((index) => (index % 2 === 0) === left ? .15 + .9 * ease : .12),
        shaft: .3, wash: wash(left ? .2 + 1.5 * ease : .12, left ? .12 : .2 + 1.5 * ease),
      }
    }
    case 'countdown': {
      const step = beats % 8, lit = Math.floor(step), flash = Math.exp(-fract(beats) * 5), half = Math.floor(lit / 2)
      return {
        blades: blades((index) => index < lit ? 1.3 : index === lit ? .3 + 1.7 * flash : .06),
        scan: scan((index) => index < half ? 1.4 : index === half ? .3 + 1.6 * flash : .06),
        shaft: lit >= 7 ? .3 + 1.8 * flash : .08, wash: wash(.2 + .7 * flash, .2 + .7 * flash),
      }
    }
    case 'core-breath': {
      const breath = .5 + .5 * Math.sin(beats * Math.PI / 2 - Math.PI / 2)
      return { blades: blades(() => .25 + .9 * breath), scan: scan(() => .15 + .8 * breath), shaft: .15 + 1.5 * breath, wash: wash(.3 + .9 * breath, .3 + .9 * breath) }
    }
    case 'charge-ring': {
      const progress = (beats % 16) / 16, spark = Math.exp(-fract(beats * 2) * 4)
      return {
        blades: blades((_, p) => p <= progress ? 1.3 + .5 * smooth(0, .2, progress) : .06 + (p - progress < .16 ? .9 * spark : 0)),
        scan: scan((_, p) => p <= progress ? 1.4 : .06), shaft: .1 + 1.8 * progress * (.8 + .2 * spark), wash: wash(.2 + 1.5 * progress, .2 + 1.5 * progress),
      }
    }
    case 'lockdown-flash': {
      const half = Math.floor(beats * 2) % 2 === 0, hit = Math.exp(-fract(beats * 2) * 5), on = .08 + 2 * hit, off = .08
      return { blades: blades(() => half ? on : off), scan: scan(() => half ? on : off), shaft: half ? off : on, wash: wash(half ? on : off, half ? off : on) }
    }
  }
}

function evaluateCoreLevels(pattern: Cinema2ChamberPattern, beats: number): CoreLevels {
  switch (pattern) {
    case 'standby': return REST
    // One bright comet runs round the ring every four beats, the floor marks light as it passes, the lamps flick on each beat.
    case 'ring-chase': {
      const head = fract(beats / 4), beat = Math.exp(-fract(beats) * 4)
      return {
        ring: cells(CHAMBER_RING_CELLS, (_, p) => comet(head, p, .12, .12, 2)),
        ticks: cells(CHAMBER_TICK_CELLS, (_, p) => comet(head, p, .16, .1, 1.8)),
        beacons: cells(CHAMBER_BEACON_CELLS, (_, p) => comet(head, p, .2, .15, 1.6)),
        lamps: cells(CHAMBER_LAMP_CELLS, () => .35 + 1.1 * beat), core: .7 + .5 * beat,
        arms: arms([.06 * (.5 + .5 * Math.sin(beats * Math.PI / 2)), .06 * (.5 + .5 * Math.sin(beats * Math.PI / 2))], [.2 * Math.sin(beats * Math.PI / 4), -.2 * Math.sin(beats * Math.PI / 4)]),
      }
    }
    // A ripple leaves the lamp under the device every four beats and travels outward: lamp, arm lamps, ring, floor ticks, beacons.
    case 'pulse-ripple': {
      const phase = fract(beats / 4)
      return {
        ring: cells(CHAMBER_RING_CELLS, () => .15 + 1.8 * pulseAt(phase, .5, .09)),
        ticks: cells(CHAMBER_TICK_CELLS, () => .1 + 1.9 * pulseAt(phase, .72, .09)),
        beacons: cells(CHAMBER_BEACON_CELLS, () => .1 + 1.9 * pulseAt(phase, .9, .09)),
        lamps: cells(CHAMBER_LAMP_CELLS, () => .15 + 1.85 * pulseAt(phase, .25, .09)), core: .2 + 1.9 * pulseAt(phase, 0, .09),
        arms: arms([.12 * pulseAt(phase, .25, .09), .12 * pulseAt(phase, .25, .09)], [.25 * pulseAt(phase, .25, .09), -.25 * pulseAt(phase, .25, .09)]),
      }
    }
    // The two arms take turns, every beat: the active arm's lamps blaze and half the ring (the side it faces) follows.
    case 'sentinel-sweep': {
      const left = Math.floor(beats) % 2 === 0, ease = smooth(0, .25, fract(beats)), active = (side: number) => (side === 0) === left
      const facing = (p: number) => (Math.cos(p * Math.PI * 2) < 0) === left ? 1 : 0
      return {
        ring: cells(CHAMBER_RING_CELLS, (_, p) => .2 + 1.3 * facing(p) * ease + .2 * (1 - ease)),
        ticks: cells(CHAMBER_TICK_CELLS, (_, p) => .15 + 1.4 * facing(p) * ease),
        beacons: cells(CHAMBER_BEACON_CELLS, (_, p) => .15 + 1.4 * facing(p) * ease),
        lamps: cells(CHAMBER_LAMP_CELLS, index => active(lampSide(index)) ? .3 + 1.5 * ease : .25 + .55 * (1 - ease)), core: .8,
        arms: arms([active(0) ? .14 * ease : 0, active(1) ? .14 * ease : 0], [active(0) ? .3 * ease : 0, active(1) ? -.3 * ease : 0]),
      }
    }
    // The floor marks light one by one across eight beats, like a countdown, then go dark together; the ring holds low.
    case 'countdown': {
      const step = beats % 8, lit = Math.floor(step), flash = Math.exp(-fract(beats) * 5)
      return {
        ring: cells(CHAMBER_RING_CELLS, () => .4), ticks: cells(CHAMBER_TICK_CELLS, index => index < lit ? 1.5 : index === lit ? .3 + 1.7 * flash : .08),
        beacons: cells(CHAMBER_BEACON_CELLS, (index) => lit >= (index + 1) * 2 ? 1.5 : .1), lamps: cells(CHAMBER_LAMP_CELLS, () => .6 + .6 * flash), core: .5 + 1.2 * flash, arms: NO_ARMS,
      }
    }
    // Everything breathes together every four beats; the lamp under the device breathes hardest.
    case 'core-breath': {
      const breath = .5 + .5 * Math.sin(beats * Math.PI / 2 - Math.PI / 2)
      return {
        ring: cells(CHAMBER_RING_CELLS, () => .5 + .9 * breath), ticks: cells(CHAMBER_TICK_CELLS, () => .35 + 1.2 * breath),
        beacons: cells(CHAMBER_BEACON_CELLS, () => .35 + 1.2 * breath), lamps: cells(CHAMBER_LAMP_CELLS, () => .5 + 1.1 * breath), core: .25 + 1.75 * breath,
        arms: arms([.08 * breath, .08 * breath], [0, 0]),
      }
    }
    // A build: the ring fills round over sixteen beats, the marks come up as it passes, and the lamps and core climb.
    case 'charge-ring': {
      const progress = (beats % 16) / 16, spark = Math.exp(-fract(beats * 2) * 4)
      return {
        ring: cells(CHAMBER_RING_CELLS, (_, p) => p <= progress ? 1.3 + .5 * smooth(0, .2, progress) : .08 + (p - progress < .08 ? 1.2 * spark : 0)),
        ticks: cells(CHAMBER_TICK_CELLS, (_, p) => p <= progress ? 1.4 : .08), beacons: cells(CHAMBER_BEACON_CELLS, (_, p) => p <= progress ? 1.5 : .08),
        lamps: cells(CHAMBER_LAMP_CELLS, () => .3 + 1.6 * progress), core: .3 + 1.7 * progress * (.8 + .2 * spark),
        arms: arms([.14 * progress, .14 * progress], [.3 * progress, -.3 * progress]),
      }
    }
    // A drop: every beat the ring and marks slam on while the lamps and core go dark, and on the next half beat it swaps, decaying fast.
    case 'lockdown-flash': {
      const half = Math.floor(beats * 2) % 2 === 0, hit = Math.exp(-fract(beats * 2) * 5)
      const on = .08 + 2 * hit, off = .08
      return {
        ring: cells(CHAMBER_RING_CELLS, () => half ? on : off), ticks: cells(CHAMBER_TICK_CELLS, () => half ? on : off),
        beacons: cells(CHAMBER_BEACON_CELLS, () => half ? off : on), lamps: cells(CHAMBER_LAMP_CELLS, () => half ? off : on), core: half ? off : on * .9,
        arms: arms([half ? .12 * hit : 0, half ? 0 : .12 * hit], [half ? .3 * hit : 0, half ? 0 : -.3 * hit]),
      }
    }
  }
}

export function blendChamberLevels(from: ChamberLevels, to: ChamberLevels, t: number): ChamberLevels {
  const mix = (a: number, b: number) => a + (b - a) * t
  const list = (a: readonly number[], b: readonly number[]) => a.map((value, index) => mix(value, b[index]!))
  return { ring: list(from.ring, to.ring), ticks: list(from.ticks, to.ticks), beacons: list(from.beacons, to.beacons), lamps: list(from.lamps, to.lamps), core: mix(from.core, to.core),
    blades: list(from.blades, to.blades), scan: list(from.scan, to.scan), shaft: mix(from.shaft, to.shaft), wash: list(from.wash, to.wash),
    arms: { swing: [mix(from.arms.swing[0], to.arms.swing[0]), mix(from.arms.swing[1], to.arms.swing[1])], twist: [mix(from.arms.twist[0], to.arms.twist[0]), mix(from.arms.twist[1], to.arms.twist[1])] } }
}

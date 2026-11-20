import { CINEMA2_AFTERHOURS_TRIGGER_IDS } from '../Cinema2AfterhoursNativeModule'

/**
 * Wireframe Portal programs. Each one moves the 28 bays as kinetic parts (they push out, turn, pull in, ripple or blast apart and reassemble), sets how
 * brightly each bay's core burns, and aims the beam rig. Everything is a pure function of the beat position, so the shared Pattern controller, the
 * Trigger and Auto Performance can switch programs and the scene blends between them.
 */
export const WIREFRAME_PORTAL_PATTERNS = Object.freeze([
  Object.freeze({ value: 'lattice', label: 'Lattice' }),
  Object.freeze({ value: 'extrude', label: 'Extrude' }),
  Object.freeze({ value: 'rotor', label: 'Rotor' }),
  Object.freeze({ value: 'fold', label: 'Fold' }),
  Object.freeze({ value: 'ripple', label: 'Ripple' }),
  Object.freeze({ value: 'detonate', label: 'Detonate' }),
] as const)
export type WireframePortalPattern = typeof WIREFRAME_PORTAL_PATTERNS[number]['value']
export const WIREFRAME_PORTAL_PATTERN_IDS: readonly WireframePortalPattern[] = Object.freeze(WIREFRAME_PORTAL_PATTERNS.map(pattern => pattern.value))
export const WIREFRAME_PORTAL_DEFAULT_PATTERN: WireframePortalPattern = 'lattice'
export const WIREFRAME_PORTAL_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
/** Beats a program takes to ease into the next. */
export const WIREFRAME_PORTAL_TRANSITION_BEATS = 2

type Vec3 = readonly [number, number, number]

/** One bay's pose: an offset from its grid place (world units), a rotation about its own centre (radians), a scale, and its core's brightness. */
export interface WireframePortalBayPose {
  readonly offset: Vec3
  readonly rotate: Vec3
  readonly scale: number
  readonly core: number
}

/** One beam's aim: a unit direction in world space, how much light it carries and how wide it opens. */
export interface WireframePortalBeamPose {
  readonly direction: Vec3
  readonly power: number
  readonly width: number
}

export interface WireframePortalBayInput {
  /** Grid cell of the bay. */
  readonly cell: Vec3
  readonly index: number
  readonly count: number
  /** The bay's unit direction away from the structure's centre, and its position along it. */
  readonly outward: Vec3
  /** The grid axis (0, 1, 2) the bay sits furthest along, and its sign. */
  readonly axis: number
  readonly sign: number
  /** Position along the structure that a travelling wave rides on. */
  readonly drift: number
}

const REST_BAY: WireframePortalBayPose = Object.freeze({ offset: [0, 0, 0] as Vec3, rotate: [0, 0, 0] as Vec3, scale: 1, core: 1 })

const hash = (a: number, b = 0) => { const value = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return value - Math.floor(value) }
const fract = (value: number) => value - Math.floor(value)
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => value * value * (3 - 2 * value)
const scale3 = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const axisVector = (axis: number, sign: number): Vec3 => [axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0]
const normalize = (v: Vec3): Vec3 => { const length = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / length, v[1] / length, v[2] / length] }
const aboutAxis = (axis: number, angle: number): Vec3 => [axis === 0 ? angle : 0, axis === 1 ? angle : 0, axis === 2 ? angle : 0]

/** How the bay moves in a program. `blast` (0 to 1) is the drop channel: it blows every bay outward whatever program is playing. */
export function evaluateWireframePortalBay(pattern: WireframePortalPattern, beats: number, bay: WireframePortalBayInput, blast = 0): WireframePortalBayPose {
  const slow = beats * Math.PI / 4
  const beat = (1 - fract(beats)) ** 2
  const bar = fract(beats / 4)
  let pose: WireframePortalBayPose
  switch (pattern) {
    // The structure breathes: every bay rocks a little and its core swells in a slow wave through the lattice.
    case 'lattice':
      pose = {
        offset: scale3(bay.outward, .06 * Math.sin(slow * .5 + bay.drift)), rotate: [.03 * Math.sin(slow * .5 + bay.index), .03 * Math.cos(slow * .5 + bay.index * 1.3), 0],
        scale: 1, core: .55 + .45 * Math.sin(slow - bay.drift * .8) ** 2,
      }
      break
    // Every beat the bays punch out along their own axis and fall back, so the whole structure pumps open and shut.
    case 'extrude':
      pose = { offset: scale3(axisVector(bay.axis, bay.sign), 1.15 * beat + .12), rotate: [0, 0, 0], scale: 1 + .06 * beat, core: .5 + 1.3 * beat }
      break
    // Waves of bays turn a quarter turn about their own axes, one after another, once a bar.
    case 'rotor': {
      const local = smooth(clamp01(bar * 1.7 - (bay.drift * .12 + .5) * .5 + .15))
      const turns = Math.floor(beats / 4) + local
      pose = { offset: [0, 0, 0], rotate: aboutAxis(bay.index % 3, turns * Math.PI / 2), scale: 1 - .05 * Math.sin(local * Math.PI), core: .5 + 1.4 * Math.sin(local * Math.PI) }
      break
    }
    // The bays are drawn in toward the middle and shudder on every beat, with their cores ramping hotter: a build.
    case 'fold':
      pose = {
        offset: scale3(bay.outward, -(.42 + .1 * beat)), rotate: [(hash(bay.index, 1) - .5) * .06 * beat, (hash(bay.index, 2) - .5) * .06 * beat, 0],
        scale: .94, core: .7 + .8 * beat + .5 * Math.sin(slow * .5 + bay.index) ** 2,
      }
      break
    // A wave of height runs through the lattice, tilting each bay as it passes.
    case 'ripple': {
      const wave = Math.sin(beats * Math.PI / 2 - bay.drift * .9)
      pose = { offset: [0, .7 * wave, 0], rotate: [0, 0, .16 * wave], scale: 1, core: .4 + 1.2 * Math.max(0, wave) ** 2 }
      break
    }
    // Once a bar the structure blows apart along random lines, spinning, and pulls back together before the next: a drop.
    case 'detonate': {
      const burst = Math.exp(-bar * 3.6)
      const spin = (bar > .02 ? 1 : 0) * burst
      pose = {
        offset: add3(scale3(bay.outward, 2.4 * burst), [(hash(bay.index, 3) - .5) * 1.2 * burst, (hash(bay.index, 4) - .5) * 1.2 * burst, (hash(bay.index, 5) - .5) * 1.2 * burst]),
        rotate: [(hash(bay.index, 6) - .5) * 4 * spin, (hash(bay.index, 7) - .5) * 4 * spin, (hash(bay.index, 8) - .5) * 4 * spin], scale: 1 + .12 * burst, core: .5 + 2 * burst,
      }
      break
    }
    default: pose = REST_BAY
  }
  if (blast <= 0) return pose
  return {
    offset: add3(pose.offset, add3(scale3(bay.outward, 2.2 * blast), [(hash(bay.index, 9) - .5) * blast, (hash(bay.index, 10) - .5) * blast, (hash(bay.index, 11) - .5) * blast])),
    rotate: add3(pose.rotate, [(hash(bay.index, 12) - .5) * 3 * blast, (hash(bay.index, 13) - .5) * 3 * blast, (hash(bay.index, 14) - .5) * 3 * blast]),
    scale: pose.scale + .1 * blast, core: pose.core + 2 * blast,
  }
}

export interface WireframePortalBeamInput {
  readonly index: number
  readonly count: number
  /** Unit direction from the structure's centre out to the fixture. */
  readonly outward: Vec3
}

/** Where a beam points and how much light it carries in a program. */
export function evaluateWireframePortalBeam(pattern: WireframePortalPattern, beats: number, beam: WireframePortalBeamInput, blast = 0): WireframePortalBeamPose {
  const slow = beats * Math.PI / 4
  const beat = (1 - fract(beats)) ** 2
  const bar = fract(beats / 4)
  const side = beam.index % 2 === 0 ? 1 : -1
  const azimuth = Math.atan2(beam.outward[0], beam.outward[2])
  const aim = (yaw: number, pitch: number): Vec3 => normalize([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)])
  let result: WireframePortalBeamPose
  switch (pattern) {
    // A slow fan: the beams drift across the structure like searchlights.
    case 'lattice': result = { direction: aim(azimuth + .9 * Math.sin(slow * .35 + beam.index * .6), .25 + .2 * Math.sin(slow * .25 + beam.index)), power: .55, width: .8 }; break
    // The beams flare outward and open on every beat.
    case 'extrude': result = { direction: aim(azimuth + side * .12, .18 + .1 * beat), power: .45 + 1.1 * beat, width: .8 + 1.1 * beat }; break
    // Two counter-rotating crowns of beams sweep around the structure.
    case 'rotor': result = { direction: aim(slow * .5 * side + beam.index * .5, .32 + .12 * Math.sin(slow + beam.index)), power: 1, width: .9 }; break
    // Every beam closes on the core of the structure and tightens: a build.
    case 'fold': result = { direction: aim(azimuth + Math.PI + side * (.15 - .1 * bar), -.1 + .08 * Math.sin(slow + beam.index)), power: .5 + 1.1 * bar, width: 1.2 - .7 * bar }; break
    // A sweep runs fixture to fixture, so the beams rise and fall in a wave.
    case 'ripple': {
      const wave = Math.sin(beats * Math.PI / 2 - beam.index * .8)
      result = { direction: aim(azimuth + .2 * wave * side, .15 + .7 * (wave * .5 + .5)), power: .35 + .9 * Math.max(0, wave), width: .8 }
      break
    }
    // Every beam fires out at once on the bar and falls back.
    case 'detonate': {
      const burst = Math.exp(-bar * 3.6)
      result = { direction: aim(azimuth + (hash(beam.index, 1) - .5) * 1.6, -.1 + hash(beam.index, 2) * .9), power: .3 + 2 * burst, width: .7 + 1.6 * burst }
      break
    }
    default: result = { direction: [0, 1, 0], power: .5, width: 1 }
  }
  if (blast <= 0) return result
  return { direction: result.direction, power: result.power + 2.2 * blast, width: result.width + 1.4 * blast }
}

export function blendWireframePortalBay(from: WireframePortalBayPose, to: WireframePortalBayPose, t: number): WireframePortalBayPose {
  const mix = (a: number, b: number) => a + (b - a) * t
  const mix3 = (a: Vec3, b: Vec3): Vec3 => [mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])]
  return { offset: mix3(from.offset, to.offset), rotate: mix3(from.rotate, to.rotate), scale: mix(from.scale, to.scale), core: mix(from.core, to.core) }
}

export function blendWireframePortalBeam(from: WireframePortalBeamPose, to: WireframePortalBeamPose, t: number): WireframePortalBeamPose {
  const mix = (a: number, b: number) => a + (b - a) * t
  return {
    direction: normalize([mix(from.direction[0], to.direction[0]), mix(from.direction[1], to.direction[1]), mix(from.direction[2], to.direction[2])]),
    power: mix(from.power, to.power), width: mix(from.width, to.width),
  }
}

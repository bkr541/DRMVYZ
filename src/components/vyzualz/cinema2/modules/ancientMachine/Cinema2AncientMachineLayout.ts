import { ANCIENT_MACHINE_GANTRY_DEPTHS } from './Cinema2AncientMachineShaft'

export const CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS = 16

export type Cinema2AncientMachinePartKind = 'metal' | 'glyph' | 'internal-light' | 'tooth' | 'plate' | 'shaft-debris'

export interface Cinema2AncientMachineLayoutConfig {
  ringCount: number
  segmentsPerRing: number
  glyphsPerRing: number
  outerRadius: number
  mechanicalDepth: number
}

export interface Cinema2AncientMachineInstance {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
  rotationZ: number
  tilt?: readonly [number, number]
  kind: Cinema2AncientMachinePartKind
  ringIndex: number
  group: number
  random: number
}

export interface Cinema2AncientMachineLayout {
  config: Readonly<Cinema2AncientMachineLayoutConfig>
  instances: readonly Readonly<Cinema2AncientMachineInstance>[]
}

export const CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG: Readonly<Cinema2AncientMachineLayoutConfig> = Object.freeze({
  ringCount: 8,
  segmentsPerRing: 36,
  glyphsPerRing: 18,
  outerRadius: 4.35,
  mechanicalDepth: 1.1,
})

const KIND_VALUE: Readonly<Record<Cinema2AncientMachinePartKind, number>> = Object.freeze({
  metal: 0,
  glyph: 1,
  'internal-light': 2,
  tooth: 3,
  plate: 4,
  'shaft-debris': 5,
})

export function buildCinema2AncientMachineLayout(
  config: Partial<Cinema2AncientMachineLayoutConfig> = {},
): Readonly<Cinema2AncientMachineLayout> {
  const resolved = Object.freeze({
    ringCount: config.ringCount ?? CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG.ringCount,
    segmentsPerRing: config.segmentsPerRing ?? CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG.segmentsPerRing,
    glyphsPerRing: config.glyphsPerRing ?? CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG.glyphsPerRing,
    outerRadius: config.outerRadius ?? CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG.outerRadius,
    mechanicalDepth: config.mechanicalDepth ?? CINEMA2_ANCIENT_MACHINE_LAYOUT_CONFIG.mechanicalDepth,
  })
  const instances: Cinema2AncientMachineInstance[] = []

  for (let ring = 0; ring < resolved.ringCount; ring += 1) {
    const t = resolved.ringCount <= 1 ? 0 : ring / (resolved.ringCount - 1)
    const radius = 1.05 + t * (resolved.outerRadius - 1.05)
    const z = -t * resolved.mechanicalDepth
    const circumference = Math.PI * 2 * radius
    const segmentLength = circumference / resolved.segmentsPerRing * 0.82
    for (let segment = 0; segment < resolved.segmentsPerRing; segment += 1) {
      const angle = segment / resolved.segmentsPerRing * Math.PI * 2
      instances.push(makeInstance(
        [Math.cos(angle) * radius, Math.sin(angle) * radius, z],
        [segmentLength, 0.16 + (ring % 3) * 0.045, 0.22 + t * 0.12],
        angle + Math.PI * 0.5,
        ring % 3 === 1 && segment % 3 === 0 ? 'tooth' : 'metal',
        ring,
        segment % 4,
      ))
    }

    const glyphRadius = radius - 0.16
    for (let glyph = 0; glyph < resolved.glyphsPerRing; glyph += 1) {
      const angle = (glyph + (ring % 2) * 0.5) / resolved.glyphsPerRing * Math.PI * 2
      instances.push(makeInstance(
        [Math.cos(angle) * glyphRadius, Math.sin(angle) * glyphRadius, z + 0.16],
        [0.16 + (glyph % 3) * 0.04, 0.052, 0.075],
        angle + Math.PI * 0.5,
        ring % 2 === 0 ? 'glyph' : 'internal-light',
        ring,
        glyph % 4,
      ))
    }
  }

  for (let pin = 0; pin < 12; pin += 1) {
    const angle = pin / 12 * Math.PI * 2
    instances.push(makeInstance(
      [Math.cos(angle) * 4.72, Math.sin(angle) * 4.72, -0.54],
      [0.72, 0.34, 0.7],
      angle,
      'plate',
      pin % resolved.ringCount,
      pin % 4,
    ))
  }

  return Object.freeze({ config: resolved, instances: Object.freeze(instances.map(instance => Object.freeze(instance))) })
}

export function packCinema2AncientMachineInstances(instances: readonly Readonly<Cinema2AncientMachineInstance>[]): Float32Array {
  const packed = new Float32Array(instances.length * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  instances.forEach((value, index) => {
    packed.set([
      ...value.center, value.size[0], value.size[1], value.size[2], value.rotationZ, KIND_VALUE[value.kind],
      value.ringIndex, value.group, value.random, 0, value.tilt?.[0] ?? 0, value.tilt?.[1] ?? 0, 0, 0,
    ], index * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  })
  return packed
}

/** Jittered three-dimensional placement within each clear bay, from one end of the shaft to the other. */
export function buildCinema2AncientMachineShaftDebris(): Cinema2AncientMachineInstance[] {
  const boundaries = [-31, ...ANCIENT_MACHINE_GANTRY_DEPTHS, 31]
  const instances: Cinema2AncientMachineInstance[] = []
  const countPerBay = 54
  for (let bay = 0; bay < boundaries.length - 1; bay += 1) {
    const start = boundaries[bay] + .92
    const end = boundaries[bay + 1] - .92
    for (let block = 0; block < countPerBay; block += 1) {
      const seed = bay * countPerBay + block
      const z = start + (end - start) * (block + hash(seed * 8 + 1)) / countPerBay
      const angle = seed * 2.39996323 + (hash(seed * 8 + 2) - .5) * .65
      const inner = Math.abs(z) < 3.7 ? 5.65 : 1.8
      const radius = inner + (13.55 - inner) * Math.pow(hash(seed * 8 + 3), 1.12)
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      const orbitRadius = Math.hypot(x, z + .4)
      // Give the catwalks, central supports and the inspection camera space.
      if (Math.abs(x) > 5.15 && Math.abs(x) < 8.9 && y > -5.2 && y < -2.05) continue
      if (Math.abs(z + 2.7) < .95 && Math.abs(y) < .9) continue
      if (Math.abs(orbitRadius - 12.48) < 1.22 && Math.abs(y - 1.75) < 1.42) continue
      const scale = .58 + hash(seed * 8 + 4) * 1.13
      const length = scale * (.39 + .31 * hash(seed * 8 + 5))
      const instance = makeInstance([x, y, z], [length, scale * .28, scale * .35], angle, 'shaft-debris', 0, 0)
      instance.tilt = [(hash(seed * 8 + 6) - .5) * 2.4, (hash(seed * 8 + 7) - .5) * 2.4]
      instances.push(instance)
    }
  }
  return instances
}

function makeInstance(
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  rotationZ: number,
  kind: Cinema2AncientMachinePartKind,
  ringIndex: number,
  group: number,
): Cinema2AncientMachineInstance {
  return { center, size, rotationZ, kind, ringIndex, group, random: hash(ringIndex * 97 + group * 29 + center[0] * 11.3 + center[1] * 7.1) }
}

function hash(value: number): number {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

import { ANCIENT_MACHINE_COLLAR_CENTER_Z, ANCIENT_MACHINE_GANTRY_DEPTHS } from './Cinema2AncientMachineShaft'

export const CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS = 16
export const ANCIENT_MACHINE_CORE_RADIUS = 2.04
export const ANCIENT_MACHINE_CORE_MAX_RADIUS = 2.88

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

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

export const CINEMA2_ANCIENT_MACHINE_PART_CODES: Readonly<Record<Cinema2AncientMachinePartKind, number>> = Object.freeze({
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
  const outerRadius = Math.max(ANCIENT_MACHINE_CORE_MAX_RADIUS + .67, resolved.outerRadius)
  const innerRadius = Math.max(ANCIENT_MACHINE_CORE_MAX_RADIUS + .67, outerRadius - resolved.mechanicalDepth)

  for (let ring = 0; ring < resolved.ringCount; ring += 1) {
    const t = resolved.ringCount <= 1 ? 0 : ring / (resolved.ringCount - 1)
    const layerRadius = innerRadius + t * (outerRadius - innerRadius)
    const segments: Cinema2AncientMachineInstance[] = []
    for (let segment = 0; segment < resolved.segmentsPerRing; segment += 1) {
      const seed = ring * resolved.segmentsPerRing + segment
      const radius = layerRadius + (hash(seed * 3 + 1) - .5) * .22
      const phase = ring * 2.21 + (hash(seed * 3 + 2) - .5) * .5
      const brick = makeInstance(
        crystalShellPoint(segment + (hash(seed * 3 + 5) - .5) * .66, resolved.segmentsPerRing, radius, phase),
        [(.50 + t * .24) * (.83 + hash(seed * 3 + 3) * .34), .23 + (ring % 3) * .045, .24 + t * .12],
        (hash(seed * 3 + 4) - .5) * Math.PI,
        ring % 3 === 1 && segment % 3 === 0 ? 'tooth' : 'metal',
        ring,
        segment % 4,
      )
      segments.push(brick)
      instances.push(brick)
    }

    for (let glyph = 0; glyph < resolved.glyphsPerRing; glyph += 1) {
      const brick = segments[Math.floor(glyph / resolved.glyphsPerRing * segments.length)]
      if (!brick) break
      const [x, y, z] = brick.center
      const collarZ = ANCIENT_MACHINE_COLLAR_CENTER_Z
      const scale = 1 + (brick.size[2] / 2 + .025) / Math.hypot(x, y, z - collarZ)
      const lamp = makeInstance(
        [x * scale, y * scale, collarZ + (z - collarZ) * scale],
        [brick.size[0] * .55, .062, .058],
        brick.rotationZ, ring % 2 === 0 ? 'glyph' : 'internal-light',
        ring,
        brick.group,
      )
      lamp.random = brick.random
      instances.push(lamp)
    }
  }

  for (let pin = 0; pin < 12; pin += 1) {
    const angle = pin * GOLDEN_ANGLE
    instances.push(makeInstance(
      crystalShellPoint(pin, 12, outerRadius + .08, 1.35),
      [.82, .40, .45],
      angle,
      'plate',
      pin % resolved.ringCount,
      pin % 4,
    ))
  }

  return Object.freeze({ config: resolved, instances: Object.freeze(instances.map(instance => Object.freeze(instance))) })
}

function crystalShellPoint(index: number, count: number, radius: number, phase: number): Cinema2AncientMachineInstance['center'] {
  const y = 1 - 2 * (index + .5) / count
  const circle = Math.sqrt(1 - y * y) * radius
  const angle = index * GOLDEN_ANGLE + phase
  return [Math.cos(angle) * circle, y * radius, ANCIENT_MACHINE_COLLAR_CENTER_Z + Math.sin(angle) * circle]
}

export function packCinema2AncientMachineInstances(instances: readonly Readonly<Cinema2AncientMachineInstance>[]): Float32Array {
  const packed = new Float32Array(instances.length * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  instances.forEach((value, index) => {
    packed.set([
      ...value.center, value.size[0], value.size[1], value.size[2], value.rotationZ, CINEMA2_ANCIENT_MACHINE_PART_CODES[value.kind],
      value.ringIndex, value.group, value.random, 0, value.tilt?.[0] ?? 0, value.tilt?.[1] ?? 0, 0, 0,
    ], index * CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
  })
  return packed
}

/** Stratified debris throughout the chamber, with small gaps at solid structures. */
export function buildCinema2AncientMachineShaftDebris(): Cinema2AncientMachineInstance[] {
  const boundaries = [-31, ...ANCIENT_MACHINE_GANTRY_DEPTHS, 31]
  const instances: Cinema2AncientMachineInstance[] = []
  const radius = 14
  const cellsAcross = 29
  const cellSize = radius * 2 / cellsAcross
  let seed = 0
  for (let bay = 0; bay < boundaries.length - 1; bay += 1) {
    const start = boundaries[bay] + .82
    const end = boundaries[bay + 1] - .82
    const slices = Math.ceil((end - start) / cellSize)
    for (let slice = 0; slice < slices; slice += 1) {
      for (let row = 0; row < cellsAcross; row += 1) {
        for (let column = 0; column < cellsAcross; column += 1) {
          seed += 9
          const x = (column + hash(seed)) * cellSize - radius
          const y = (row + hash(seed + 1)) * cellSize - radius
          const z = start + (slice + hash(seed + 2)) * (end - start) / slices
          const shaftRadius = Math.hypot(x, y)
          if (shaftRadius >= radius) continue
          // Leave room for the crystal and its own shell of bricks.
          if (Math.hypot(x, y, z - ANCIENT_MACHINE_COLLAR_CENTER_Z) < 4.75) continue
          if (Math.abs(x) > 5.3 && Math.abs(x) < 8.65 && y > -5.05 && y < -2.25) continue
          if (Math.abs(z - ANCIENT_MACHINE_COLLAR_CENTER_Z) < .55 && Math.abs(y) < .52 && Math.abs(x) > 4.9 && Math.abs(x) < 8.8) continue
          const orbitRadius = Math.hypot(x, z + .4)
          if (Math.abs(orbitRadius - 12.48) < 1.22 && Math.abs(y - 1.75) < 1.42) continue

          // Small pieces provide density at depth. Fewer large blocks give foreground parallax.
          const sizeRank = hash(seed + 3)
          const scale = sizeRank < .027 ? .78 + .81 * hash(seed + 4) : .18 + .5 * Math.pow(sizeRank, 1.65)
          const length = scale * (.43 + .33 * hash(seed + 5))
          const angle = hash(seed + 6) * Math.PI * 2
          const instance = makeInstance([x, y, z], [length, scale * .30, scale * .38], angle, 'shaft-debris', 0, 0)
          instance.tilt = [(hash(seed + 7) - .5) * 2.4, (hash(seed + 8) - .5) * 2.4]
          instances.push(instance)
        }
      }
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

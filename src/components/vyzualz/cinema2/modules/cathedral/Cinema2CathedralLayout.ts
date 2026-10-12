export const CINEMA2_CATHEDRAL_INSTANCE_FLOATS = 16

export type Cinema2CathedralPartKind = 'structure' | 'primary-light' | 'accent-light' | 'spark' | 'rail'

export interface Cinema2CathedralLayoutConfig {
  archCount: number
  archSegments: number
  aisleHalfWidth: number
  columnHeight: number
  archHeight: number
  spacing: number
  depth: number
  transitionRoomLength: number
  transitionRoomHalfWidth: number
  transitionRoomHeight: number
}

export interface Cinema2CathedralInstance {
  center: readonly [number, number, number]
  size: readonly [number, number, number]
  rotationZ: number
  kind: Cinema2CathedralPartKind
  archIndex: number
  group: number
  random: number
  zone: 'aisle' | 'transition-room'
}

export interface Cinema2CathedralLayout {
  config: Readonly<Cinema2CathedralLayoutConfig>
  instances: readonly Readonly<Cinema2CathedralInstance>[]
  repeatDistance: number
}

export const CINEMA2_CATHEDRAL_LAYOUT_CONFIG: Readonly<Cinema2CathedralLayoutConfig> = Object.freeze({
  archCount: 18,
  archSegments: 10,
  aisleHalfWidth: 3.25,
  columnHeight: 3.25,
  archHeight: 2.7,
  spacing: 4.6,
  depth: 0.34,
  transitionRoomLength: 24,
  transitionRoomHalfWidth: 6.8,
  transitionRoomHeight: 6.1,
})

const KIND_VALUE: Readonly<Record<Cinema2CathedralPartKind, number>> = Object.freeze({
  structure: 0,
  'primary-light': 1,
  'accent-light': 2,
  spark: 3,
  rail: 4,
})

export function buildCinema2CathedralLayout(
  config: Partial<Cinema2CathedralLayoutConfig> = {},
): Readonly<Cinema2CathedralLayout> {
  const resolved = Object.freeze({
    archCount: config.archCount ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.archCount,
    archSegments: config.archSegments ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.archSegments,
    aisleHalfWidth: config.aisleHalfWidth ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.aisleHalfWidth,
    columnHeight: config.columnHeight ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.columnHeight,
    archHeight: config.archHeight ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.archHeight,
    spacing: config.spacing ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.spacing,
    depth: config.depth ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.depth,
    transitionRoomLength: config.transitionRoomLength ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.transitionRoomLength,
    transitionRoomHalfWidth: config.transitionRoomHalfWidth ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.transitionRoomHalfWidth,
    transitionRoomHeight: config.transitionRoomHeight ?? CINEMA2_CATHEDRAL_LAYOUT_CONFIG.transitionRoomHeight,
  })
  const instances: Cinema2CathedralInstance[] = []

  for (let archIndex = 0; archIndex < resolved.archCount; archIndex += 1) {
    const z = -archIndex * resolved.spacing
    const columnY = -1.35 + resolved.columnHeight * 0.5
    for (const side of [-1, 1] as const) {
      instances.push(instance(
        [side * resolved.aisleHalfWidth, columnY, z],
        [0.42, resolved.columnHeight, resolved.depth],
        0,
        'structure',
        archIndex,
        side < 0 ? 0 : 1,
      ))
      instances.push(instance(
        [side * (resolved.aisleHalfWidth - 0.34), columnY, z + 0.12],
        [0.075, resolved.columnHeight * 0.94, resolved.depth * 0.42],
        0,
        archIndex % 3 === 0 ? 'accent-light' : 'primary-light',
        archIndex,
        side < 0 ? 0 : 1,
      ))
    }

    for (const side of [-1, 1] as const) {
      for (let segment = 0; segment < resolved.archSegments; segment += 1) {
        const start = pointedArchPoint(resolved, side, segment / resolved.archSegments)
        const end = pointedArchPoint(resolved, side, (segment + 1) / resolved.archSegments)
        const center: readonly [number, number, number] = [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5, z]
        const dx = end[0] - start[0]
        const dy = end[1] - start[1]
        const length = Math.hypot(dx, dy)
        const angle = Math.atan2(dy, dx)
        instances.push(instance(center, [length + 0.08, 0.38, resolved.depth], angle, 'structure', archIndex, segment + (side > 0 ? resolved.archSegments : 0)))
        if (segment % 2 === archIndex % 2) {
          instances.push(instance(
            [center[0] * 0.965, center[1] - 0.03, z + 0.13],
            [length * 0.82, 0.065, resolved.depth * 0.38],
            angle,
            segment === resolved.archSegments - 1 ? 'accent-light' : 'primary-light',
            archIndex,
            segment + (side > 0 ? resolved.archSegments : 0),
          ))
        }
      }
    }

    for (const side of [-1, 1] as const) {
      instances.push(instance(
        [side * (resolved.aisleHalfWidth + 0.85), -1.26, z - resolved.spacing * 0.48],
        [0.18, 0.18, resolved.spacing * 0.92],
        0,
        'rail',
        archIndex,
        side < 0 ? 0 : 1,
      ))
    }
  }

  appendTransitionRoom(instances, resolved)

  const sparkCount = 72
  for (let index = 0; index < sparkCount; index += 1) {
    const randomA = hash(index * 3 + 1)
    const randomB = hash(index * 3 + 2)
    const randomC = hash(index * 3 + 3)
    instances.push(instance(
      [(randomA * 2 - 1) * resolved.aisleHalfWidth * 0.86, -0.8 + randomB * 5.2, -randomC * resolved.archCount * resolved.spacing],
      [0.025 + randomB * 0.045, 0.025 + randomB * 0.045, 0.025 + randomB * 0.045],
      randomA * Math.PI,
      'spark',
      Math.floor(randomC * resolved.archCount),
      index % 4,
      randomA,
    ))
  }

  return Object.freeze({
    config: resolved,
    instances: Object.freeze(instances.map(value => Object.freeze(value))),
    repeatDistance: resolved.archCount * resolved.spacing + resolved.transitionRoomLength,
  })
}

export function packCinema2CathedralInstances(instances: readonly Readonly<Cinema2CathedralInstance>[]): Float32Array {
  const packed = new Float32Array(instances.length * CINEMA2_CATHEDRAL_INSTANCE_FLOATS)
  for (let index = 0; index < instances.length; index += 1) {
    const value = instances[index]
    const offset = index * CINEMA2_CATHEDRAL_INSTANCE_FLOATS
    packed.set([
      ...value.center, value.size[0],
      value.size[1], value.size[2], value.rotationZ, KIND_VALUE[value.kind],
      value.archIndex, value.group, value.random, 0,
      0, 0, 0, 0,
    ], offset)
  }
  return packed
}

function pointedArchPoint(config: Readonly<Cinema2CathedralLayoutConfig>, side: -1 | 1, t: number): readonly [number, number] {
  const eased = Math.sin(t * Math.PI * 0.5)
  const x = side * config.aisleHalfWidth * (1 - eased)
  const y = -1.35 + config.columnHeight + config.archHeight * Math.pow(eased, 1.28)
  return [x, y]
}

function instance(
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  rotationZ: number,
  kind: Cinema2CathedralPartKind,
  archIndex: number,
  group: number,
  random = hash(archIndex * 37 + group * 13),
  zone: Cinema2CathedralInstance['zone'] = 'aisle',
): Cinema2CathedralInstance {
  return { center, size, rotationZ, kind, archIndex, group, random, zone }
}

function appendTransitionRoom(
  instances: Cinema2CathedralInstance[],
  config: Readonly<Cinema2CathedralLayoutConfig>,
): void {
  const roomStartZ = -config.archCount * config.spacing
  const bayCount = 6
  const baySpacing = config.transitionRoomLength / bayCount
  const floorY = -1.26
  const ceilingY = floorY + config.transitionRoomHeight
  const halfWidth = config.transitionRoomHalfWidth
  const roomGroupBase = config.archCount

  for (let bay = 0; bay < bayCount; bay += 1) {
    const z = roomStartZ - (bay + 0.5) * baySpacing
    const groupIndex = roomGroupBase + bay
    for (const side of [-1, 1] as const) {
      instances.push(instance(
        [side * halfWidth, floorY + config.transitionRoomHeight * 0.5, z],
        [0.46, config.transitionRoomHeight, baySpacing * 0.82],
        0, 'structure', groupIndex, side < 0 ? 0 : 1, undefined, 'transition-room',
      ))
      instances.push(instance(
        [side * (halfWidth - 0.28), floorY + config.transitionRoomHeight * 0.5, z + baySpacing * 0.22],
        [0.075, config.transitionRoomHeight * 0.76, 0.14],
        0, bay % 3 === 2 ? 'accent-light' : 'primary-light', groupIndex, side < 0 ? 0 : 1, undefined, 'transition-room',
      ))
      for (let row = 0; row < 3; row += 1) {
        instances.push(instance(
          [side * (halfWidth - 0.25), floorY + 1.15 + row * 1.65, z],
          [0.07, 0.07, baySpacing * 0.7],
          0, row === 1 ? 'accent-light' : 'primary-light', groupIndex, row + (side > 0 ? 3 : 0), undefined, 'transition-room',
        ))
      }
    }
    instances.push(instance([0, ceilingY, z], [halfWidth * 2, 0.34, 0.38], 0, 'structure', groupIndex, 6, undefined, 'transition-room'))
    instances.push(instance([0, floorY - 0.04, z], [halfWidth * 2, 0.24, 0.38], 0, 'structure', groupIndex, 7, undefined, 'transition-room'))
    for (const x of [-3.6, 0, 3.6]) {
      instances.push(instance([x, ceilingY - 0.22, z + 0.18], [1.8, 0.075, 0.14], 0, 'primary-light', groupIndex, 8 + Math.round(x), undefined, 'transition-room'))
    }
  }

  const roomCenterZ = roomStartZ - config.transitionRoomLength * 0.5
  for (const [index, x, y] of [
    [-halfWidth + 0.55, floorY + 0.5], [halfWidth - 0.55, floorY + 0.5],
    [-halfWidth + 0.55, ceilingY - 0.5], [halfWidth - 0.55, ceilingY - 0.5],
    [-2.3, ceilingY - 0.42], [2.3, ceilingY - 0.42],
    [-2.3, floorY + 0.32], [2.3, floorY + 0.32],
  ].map(([x, y], index) => [index, x, y] as const)) {
    instances.push(instance(
      [x, y, roomCenterZ], [0.09, 0.09, config.transitionRoomLength * 0.9], 0,
      index % 3 === 0 ? 'accent-light' : 'primary-light', roomGroupBase + bayCount, index, undefined, 'transition-room',
    ))
  }

  const thresholdZ = roomStartZ - config.transitionRoomLength + 0.5
  const openingHalfWidth = config.aisleHalfWidth + 0.25
  const openingHeight = -1.35 + config.columnHeight + config.archHeight
  for (const side of [-1, 1] as const) {
    instances.push(instance([side * openingHalfWidth, (floorY + openingHeight) * 0.5, thresholdZ], [0.42, openingHeight - floorY, 0.5], 0, 'structure', roomGroupBase + bayCount + 1, side < 0 ? 0 : 1, undefined, 'transition-room'))
    instances.push(instance([side * (openingHalfWidth - 0.3), (floorY + openingHeight) * 0.5, thresholdZ + 0.28], [0.075, openingHeight - floorY - 0.4, 0.12], 0, 'accent-light', roomGroupBase + bayCount + 1, side < 0 ? 0 : 1, undefined, 'transition-room'))
  }
  instances.push(instance([0, openingHeight, thresholdZ], [openingHalfWidth * 2, 0.42, 0.5], 0, 'structure', roomGroupBase + bayCount + 1, 2, undefined, 'transition-room'))
  instances.push(instance([0, openingHeight - 0.28, thresholdZ + 0.28], [openingHalfWidth * 1.82, 0.075, 0.12], 0, 'primary-light', roomGroupBase + bayCount + 1, 2, undefined, 'transition-room'))
  instances.push(instance([0, floorY, thresholdZ], [openingHalfWidth * 2, 0.24, 0.5], 0, 'structure', roomGroupBase + bayCount + 1, 3, undefined, 'transition-room'))
}

function hash(value: number): number {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

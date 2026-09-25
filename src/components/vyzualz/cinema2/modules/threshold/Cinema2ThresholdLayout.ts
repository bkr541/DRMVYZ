/**
 * Threshold monolith layout: one repeating stretch of environment, generated deterministically.
 *
 * The world is a single "lap" of `THRESHOLD_PERIOD` units along -Z, three scenes in a row:
 *   1. Corridor - two rows of standing monoliths receding into fog, LED faces turned toward the aisle.
 *   2. Hanging field - large monoliths floating at varied heights, slightly tilted, faces toward the viewer.
 *   3. Ring - tilted panels arranged around the flight path, faces turned inward.
 * The lap is periodic: the camera rig translates by one period per lap and the renderer draws neighbouring
 * copies, so the flight through all three scenes is endless with no seam.
 *
 * Coordinates: the camera flies toward -Z, so a distance `d` along the lap is world z = -d. A box's LED face
 * is its local +Z face; `yaw` (about Y) turns it, and its local +Y is up.
 */

export const THRESHOLD_PERIOD = 180
export const THRESHOLD_ZONE_CORRIDOR = 0
export const THRESHOLD_ZONE_FIELD = 1
export const THRESHOLD_ZONE_RING = 2

/** 0 = plain dark body, 1 = primary LED screen, 2 = accent (support) LED screen. */
export type ThresholdRole = 0 | 1 | 2

export interface ThresholdInstance {
  /** Box center. */
  position: readonly [number, number, number]
  /** Face width (local X), height (local Y), thickness (local Z), all in world units. */
  size: readonly [number, number, number]
  /** Euler angles in radians, applied as Ry(yaw) * Rx(pitch) * Rz(roll). */
  rotation: readonly [yaw: number, pitch: number, roll: number]
  role: ThresholdRole
  /** Running index along the lap; alternating rows drive the beat parity pattern. */
  row: number
  zone: 0 | 1 | 2
  /** Stable 0..1 hash; a panel is lit once the "arc" reaches its rank, so the set opens up as a build climbs. */
  rank: number
  /** 0 = left of the flight path, 1 = right (or, for hanging/ring panels, by sign of x). */
  side: 0 | 1
}

export const THRESHOLD_INSTANCE_FLOATS = 16

/** Deterministic PRNG (mulberry32) so the layout is identical on every run and machine. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CORRIDOR_LENGTH = 84
const FIELD_END = 132
const RING_CENTER = 156
const RING_RADIUS = 26
const CORRIDOR_HALF_WIDTH = 14

export function buildThresholdLayout(seed = 1337): readonly ThresholdInstance[] {
  const random = createRandom(seed)
  const range = (min: number, max: number) => min + (max - min) * random()
  const instances: ThresholdInstance[] = []
  let row = 0

  // 1 - Corridor: pairs every 12 units. Each pair has a tall LED slab per side, a taller dark slab behind it and a
  // small accent panel between the mains, so the rows read as a colonnade of towers with support screens.
  for (let index = 0; index < 6; index += 1) {
    const distance = 20 + index * 13
    for (const sign of [-1, 1] as const) {
      const yaw = sign < 0 ? Math.PI / 2 : -Math.PI / 2
      const side = sign < 0 ? 0 : 1
      const mainHeight = range(14, 22)
      instances.push({
        position: [sign * CORRIDOR_HALF_WIDTH, mainHeight / 2, -distance],
        size: [3.6, mainHeight, 1.4],
        rotation: [yaw, 0, 0],
        role: 1, row, zone: THRESHOLD_ZONE_CORRIDOR, rank: random(), side,
      })
      const rearHeight = range(24, 32)
      instances.push({
        position: [sign * (CORRIDOR_HALF_WIDTH + 9), rearHeight / 2, -(distance + range(-3, 3))],
        size: [4.6, rearHeight, 1.6],
        rotation: [yaw, 0, 0],
        role: index % 3 === 1 ? 1 : 0, row, zone: THRESHOLD_ZONE_CORRIDOR, rank: random(), side,
      })
      instances.push({
        position: [sign * (CORRIDOR_HALF_WIDTH - 2), 2.9, -(distance + 6.5)],
        size: [1.3, 5.8, 0.6],
        rotation: [yaw, 0, 0],
        role: 2, row: row + 1, zone: THRESHOLD_ZONE_CORRIDOR, rank: random(), side,
      })
    }
    row += 1
  }

  // 2 - Hanging field: floating slabs spread across x and height, facing back toward the camera.
  const fieldCount = 14
  for (let index = 0; index < fieldCount; index += 1) {
    const distance = CORRIDOR_LENGTH + 2 + (index / (fieldCount - 1)) * (FIELD_END - CORRIDOR_LENGTH - 4) + range(-1.5, 1.5)
    const sign = index % 2 === 0 ? -1 : 1
    const x = sign * range(10, 26)
    const height = range(8, 15)
    const width = range(3, 5.5)
    const roleRoll = random()
    instances.push({
      position: [x, range(6, 15) + height / 2, -distance],
      size: [width, height, 1.6],
      rotation: [range(-0.5, 0.5) + sign * 0.35, range(-0.06, 0.06), range(-0.1, 0.1)],
      role: roleRoll < 0.7 ? 1 : roleRoll < 0.85 ? 2 : 0,
      row, zone: THRESHOLD_ZONE_FIELD, rank: random(), side: sign < 0 ? 0 : 1,
    })
    row += 1
  }

  // 3 - Ring: ten large panels around the flight path, leaning outward at the top, faces turned inward,
  // with a smaller accent panel between each pair on an inner radius.
  const ringCount = 10
  const lean = -0.2
  for (let index = 0; index < ringCount; index += 1) {
    const angle = (index / ringCount) * Math.PI * 2
    const height = 20
    const thickness = 1.2
    const width = 6
    // Keep the lower edge on the floor while the panel leans back.
    const centerY = (height / 2) * Math.cos(lean) + (thickness / 2) * Math.abs(Math.sin(lean))
    instances.push({
      position: [Math.sin(angle) * RING_RADIUS, centerY, -(RING_CENTER + Math.cos(angle) * RING_RADIUS)],
      size: [width, height, thickness],
      rotation: [-angle, lean, 0],
      role: 1, row, zone: THRESHOLD_ZONE_RING, rank: random(), side: Math.sin(angle) < 0 ? 0 : 1,
    })
    const innerAngle = angle + Math.PI / ringCount
    const innerRadius = RING_RADIUS - 7
    instances.push({
      position: [Math.sin(innerAngle) * innerRadius, 3.4, -(RING_CENTER + Math.cos(innerAngle) * innerRadius)],
      size: [1.4, 6.8, 0.6],
      rotation: [-innerAngle, 0, 0],
      role: 2, row: row + 1, zone: THRESHOLD_ZONE_RING, rank: random(), side: Math.sin(innerAngle) < 0 ? 0 : 1,
    })
    row += 1
  }

  return Object.freeze(instances.map(instance => Object.freeze(instance)))
}

/** Packs instances into the vertex layout: four `vec4` attributes per instance (64 bytes). */
export function packThresholdInstances(instances: readonly ThresholdInstance[]): Float32Array {
  const data = new Float32Array(instances.length * THRESHOLD_INSTANCE_FLOATS)
  instances.forEach((instance, index) => {
    const o = index * THRESHOLD_INSTANCE_FLOATS
    // i0: center xyz + width
    data[o] = instance.position[0]
    data[o + 1] = instance.position[1]
    data[o + 2] = instance.position[2]
    data[o + 3] = instance.size[0]
    // i1: height, thickness, yaw, pitch
    data[o + 4] = instance.size[1]
    data[o + 5] = instance.size[2]
    data[o + 6] = instance.rotation[0]
    data[o + 7] = instance.rotation[1]
    // i2: roll, role, row, rank
    data[o + 8] = instance.rotation[2]
    data[o + 9] = instance.role
    data[o + 10] = instance.row
    data[o + 11] = instance.rank
    // i3: side, zone (two reserved)
    data[o + 12] = instance.side
    data[o + 13] = instance.zone
  })
  return data
}

/** Which copies of the lap to draw for a camera at world z: the current one and its neighbours. */
export function thresholdPeriodIndices(cameraZ: number): readonly number[] {
  // `|| 0` folds -0 (camera exactly at the origin) into 0.
  const lap = Math.floor(-cameraZ / THRESHOLD_PERIOD) || 0
  return Object.freeze([lap - 1, lap, lap + 1])
}

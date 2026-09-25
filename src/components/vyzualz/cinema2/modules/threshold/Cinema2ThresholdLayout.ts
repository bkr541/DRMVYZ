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

export const THRESHOLD_PERIOD = 216
export const THRESHOLD_ZONE_CORRIDOR = 0
export const THRESHOLD_ZONE_FIELD = 1
export const THRESHOLD_ZONE_RING = 2

/**
 * 0 = plain dark body, 1 = primary LED screen, 2 = accent (support) LED screen,
 * 3 = housing tower (dark body that catches its screen's light), 4 = frame / plinth metal around a screen.
 */
export type ThresholdRole = 0 | 1 | 2 | 3 | 4

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
  /** Lowest quality tier that draws this instance: 0 = low (default), 1 = medium, 2 = high. Detail beyond the base layout is gated by tier. */
  minTier?: ThresholdTier
}

export type ThresholdTier = 0 | 1 | 2

/**
 * Per-tier instance budgets, per lap copy: boxes (towers, screens, structure) and smoke puffs. The layout is checked against these when the
 * module is created, so adding detail can never silently blow a tier's vertex budget.
 */
export const THRESHOLD_INSTANCE_BUDGETS: Readonly<Record<'low' | 'medium' | 'high', Readonly<{ boxes: number; puffs: number }>>> = Object.freeze({
  low: Object.freeze({ boxes: 200, puffs: 30 }),
  medium: Object.freeze({ boxes: 320, puffs: 60 }),
  high: Object.freeze({ boxes: 420, puffs: 120 }),
})

export const THRESHOLD_TIER_BY_QUALITY: Readonly<Record<'low' | 'medium' | 'high', ThresholdTier>> = Object.freeze({ low: 0, medium: 1, high: 2 })

/** A soft ground-smoke billboard (see `buildThresholdSmoke`). Positions are lap-local, like box instances. */
export interface ThresholdPuff {
  position: readonly [number, number, number]
  /** World size of the billboard's width; height is `size * stretch`. */
  size: number
  stretch: number
  /** 0..1: picks the sprite cell and the starting angle. */
  seed: number
  /** Turn rate in radians per second (sign gives direction). */
  spin: number
  /** Peak opacity before fog and distance fades. */
  alpha: number
  /** The screen this smoke belongs to lights it: same row/rank/side as the pair. */
  row: number
  rank: number
  side: 0 | 1
  minTier: ThresholdTier
}

export const THRESHOLD_PUFF_FLOATS = 12

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

/**
 * Corridor geometry other passes need to line up with the screens (the reflective floor's glare places its emitters from these):
 * distance of the first pair along the lap, spacing, number of pairs, |x| of the screens, and the screen's centre height and size.
 */
export const THRESHOLD_CORRIDOR = Object.freeze({
  first: 24, spacing: 13.3, pairs: 7, halfWidth: 26, screenCenterY: 19.5, screenWidth: 7, screenHeight: 36,
})

/** Corridor pairs: evenly spaced, identical on both sides. */
const CORRIDOR_PAIRS = 7
const CORRIDOR_FIRST = 24
const CORRIDOR_SPACING = 13.3
const CORRIDOR_HALF_WIDTH = 26
const PANEL_WIDTH = 7
const PANEL_HEIGHT = 36
/** The screens sit slightly above the floor, on a plinth, like the reference's tower bases. */
const PANEL_CENTER_Y = 19.5
const PANEL_THICKNESS = 1.6
/** Housing tower behind each corridor screen: its front face touches the screen's back face and it stands on the floor. */
export const THRESHOLD_HOUSING_SIZE = Object.freeze([10.5, 46, 11] as const)
/** Screen window in the housing's normalized local coordinates (used for the light spill on the tower). */
export const THRESHOLD_HOUSING_WINDOW = Object.freeze({
  halfWidth: (PANEL_WIDTH / 2 + 0.9) / THRESHOLD_HOUSING_SIZE[0],
  halfHeight: (PANEL_HEIGHT / 2 + 0.9) / THRESHOLD_HOUSING_SIZE[1],
  centerY: (PANEL_CENTER_Y - THRESHOLD_HOUSING_SIZE[1] / 2) / THRESHOLD_HOUSING_SIZE[1],
})
const FIELD_START = 106
const FIELD_END = 150
export const THRESHOLD_RING_CENTER = 184
const RING_RADIUS = 26

export function buildThresholdLayout(seed = 1337, options: Readonly<{ extras?: boolean }> = {}): readonly ThresholdInstance[] {
  const random = createRandom(seed)
  const range = (min: number, max: number) => min + (max - min) * random()
  const instances: ThresholdInstance[] = []
  let row = 0

  // 1 - Corridor: an evenly spaced, perfectly mirrored colonnade. Both panels of a pair share height and rank, so the
  // rows open, dim and flash symmetrically; perspective alone makes the row shrink toward the vanishing point.
  for (let index = 0; index < CORRIDOR_PAIRS; index += 1) {
    const distance = CORRIDOR_FIRST + index * CORRIDOR_SPACING
    // Far pairs open last as the arc climbs.
    const rank = 0.04 + 0.92 * (index / (CORRIDOR_PAIRS - 1))
    for (const sign of [-1, 1] as const) {
      const yaw = sign < 0 ? Math.PI / 2 : -Math.PI / 2
      const base = { row, zone: 0 as const, rank, side: (sign < 0 ? 0 : 1) as 0 | 1, rotation: [yaw, 0, 0] as const }
      // |x| of the screen's back face; everything behind it is housing.
      const backX = CORRIDOR_HALF_WIDTH + PANEL_THICKNESS / 2
      const frontX = CORRIDOR_HALF_WIDTH - PANEL_THICKNESS / 2
      instances.push({
        ...base, position: [sign * CORRIDOR_HALF_WIDTH, PANEL_CENTER_Y, -distance], size: [PANEL_WIDTH, PANEL_HEIGHT, PANEL_THICKNESS], role: 1,
      })
      // Housing tower.
      instances.push({
        ...base, role: 3, size: THRESHOLD_HOUSING_SIZE,
        position: [sign * (backX + THRESHOLD_HOUSING_SIZE[2] / 2), THRESHOLD_HOUSING_SIZE[1] / 2, -distance],
      })
      // Bezel: four bars that stand a little proud of the screen face.
      const bar = 0.9
      const barDepth = 2.2
      const barX = sign * (frontX - 0.5 + barDepth / 2)
      const top = PANEL_CENTER_Y + PANEL_HEIGHT / 2
      const bottom = PANEL_CENTER_Y - PANEL_HEIGHT / 2
      const half = PANEL_WIDTH / 2
      for (const offset of [-1, 1] as const) {
        instances.push({ ...base, role: 4, size: [bar, PANEL_HEIGHT + 2 * bar, barDepth], position: [barX, PANEL_CENTER_Y, -distance + offset * (half + bar / 2)] })
      }
      instances.push({ ...base, role: 4, size: [PANEL_WIDTH, bar, barDepth], position: [barX, top + bar / 2, -distance] })
      instances.push({ ...base, role: 4, size: [PANEL_WIDTH, bar, barDepth], position: [barX, bottom - bar / 2, -distance] })
      // Plinth under the screen, reaching a little further into the aisle, with two small status lights.
      const plinthHeight = bottom - bar
      const plinthDepth = THRESHOLD_HOUSING_SIZE[2] + 2
      instances.push({
        ...base, role: 4, size: [THRESHOLD_HOUSING_SIZE[0] + 2, plinthHeight, plinthDepth],
        position: [sign * (backX + THRESHOLD_HOUSING_SIZE[2] - plinthDepth / 2), plinthHeight / 2, -distance],
      })
      for (const offset of [-1, 1] as const) {
        instances.push({
          ...base, role: 2, size: [0.8, 0.3, 0.3],
          position: [sign * (backX + THRESHOLD_HOUSING_SIZE[2] - plinthDepth - 0.1), plinthHeight / 2, -distance + offset * 4.6],
        })
      }
    }
    row += 1
  }

  // 2 - Hanging field: floating slabs spread across x and height, facing back toward the camera.
  const fieldCount = 14
  for (let index = 0; index < fieldCount; index += 1) {
    const distance = FIELD_START + (index / (fieldCount - 1)) * (FIELD_END - FIELD_START) + range(-1.5, 1.5)
    const sign = index % 2 === 0 ? -1 : 1
    const x = sign * range(12, 30)
    const height = range(14, 24)
    const width = range(4, 6.5)
    const roleRoll = random()
    instances.push({
      position: [x, range(8, 20) + height / 2, -distance],
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
    const height = 26
    const thickness = 1.4
    const width = 6.5
    // Keep the lower edge on the floor while the panel leans back.
    const centerY = (height / 2) * Math.cos(lean) + (thickness / 2) * Math.abs(Math.sin(lean))
    instances.push({
      position: [Math.sin(angle) * RING_RADIUS, centerY, -(THRESHOLD_RING_CENTER + Math.cos(angle) * RING_RADIUS)],
      size: [width, height, thickness],
      rotation: [-angle, lean, 0],
      role: 1, row, zone: THRESHOLD_ZONE_RING, rank: random(), side: Math.sin(angle) < 0 ? 0 : 1,
    })
    const innerAngle = angle + Math.PI / ringCount
    const innerRadius = RING_RADIUS - 7
    instances.push({
      position: [Math.sin(innerAngle) * innerRadius, 3.4, -(THRESHOLD_RING_CENTER + Math.cos(innerAngle) * innerRadius)],
      size: [1.4, 6.8, 0.6],
      rotation: [-innerAngle, 0, 0],
      role: 2, row: row + 1, zone: THRESHOLD_ZONE_RING, rank: random(), side: Math.sin(innerAngle) < 0 ? 0 : 1,
    })
    row += 1
  }

  if (options.extras !== false) instances.push(...buildThresholdDetail(seed))
  return Object.freeze(instances.map(instance => Object.freeze(instance)))
}

/** |x| of the outer face of a corridor housing tower. */
const HOUSING_OUTER_X = CORRIDOR_HALF_WIDTH + PANEL_THICKNESS / 2 + THRESHOLD_HOUSING_SIZE[2]
const OVERHEAD_TOP_Y = 56
const OVERHEAD_BOTTOM_Y = 52.4
const OVERHEAD_HALF_SPAN = 40

/**
 * Detail beyond the hero colonnade, appended after the base layout so the base instances (and their indices) never change. It uses its own
 * seeded stream, so the layout is identical run to run and the base scatter is untouched:
 *  - an outer rank of taller dark towers, staggered half a step behind the housings (medium and up), which gives the corridor depth through
 *    the gaps between the housings;
 *  - overhead structure: cross beams, longitudinal rails (medium and up), lower chords, struts and hanging cables (high), a faint ceiling
 *    the reference has and the volumetric light and shadows can rake across.
 * Everything is role 0 (plain dark body), z-sorted so lap chunks cull well.
 */
export function buildThresholdDetail(seed = 1337): readonly ThresholdInstance[] {
  const random = createRandom((seed ^ 0x9e3779b9) >>> 0)
  const range = (min: number, max: number) => min + (max - min) * random()
  const out: ThresholdInstance[] = []
  const base = { role: 0 as const, zone: 0 as const, rotation: [0, 0, 0] as const }
  let row = 0
  for (let index = 0; index <= CORRIDOR_PAIRS; index += 1) {
    const distance = CORRIDOR_FIRST + (index - 0.5) * CORRIDOR_SPACING
    const rank = 0.04 + 0.92 * (Math.min(index, CORRIDOR_PAIRS - 1) / (CORRIDOR_PAIRS - 1))
    for (const sign of [-1, 1] as const) {
      const height = range(56, 74)
      const width = range(11, 14)
      out.push({
        ...base, row, rank, side: (sign < 0 ? 0 : 1) as 0 | 1, minTier: 1,
        position: [sign * (HOUSING_OUTER_X + range(7, 13) + width / 2), height / 2, -distance + range(-1.5, 1.5)],
        size: [width, height, range(11, 14)],
      })
    }
    row += 1
  }

  const beamZ = (index: number) => -(CORRIDOR_FIRST + (index - 0.5) * CORRIDOR_SPACING)
  for (let index = 0; index <= CORRIDOR_PAIRS; index += 1) {
    const z = beamZ(index)
    const shared = { ...base, row: index, rank: 0.5, side: 0 as const }
    out.push({ ...shared, minTier: 1, position: [0, OVERHEAD_TOP_Y, z], size: [OVERHEAD_HALF_SPAN * 2, 1.5, 1.5] })
    out.push({ ...shared, minTier: 2, position: [0, OVERHEAD_BOTTOM_Y, z], size: [OVERHEAD_HALF_SPAN * 2, 1, 1] })
    for (const x of [-OVERHEAD_HALF_SPAN + 1, -20, 0, 20, OVERHEAD_HALF_SPAN - 1]) {
      out.push({ ...shared, minTier: 2, position: [x, (OVERHEAD_TOP_Y + OVERHEAD_BOTTOM_Y) / 2, z], size: [0.7, OVERHEAD_TOP_Y - OVERHEAD_BOTTOM_Y, 0.7] })
    }
    for (let cable = 0; cable < 3; cable += 1) {
      const length = range(7, 18)
      out.push({ ...shared, minTier: 2, position: [range(-30, 30), OVERHEAD_BOTTOM_Y - length / 2, z + range(-2, 2)], size: [0.25, length, 0.25] })
    }
  }
  const railLength = (CORRIDOR_PAIRS + 0.5) * CORRIDOR_SPACING
  for (const x of [-14, 14]) {
    out.push({ ...base, row: 0, rank: 0.5, side: (x < 0 ? 0 : 1) as 0 | 1, minTier: 1, position: [x, OVERHEAD_TOP_Y - 1.2, -(CORRIDOR_FIRST - CORRIDOR_SPACING + railLength / 2)], size: [1.1, 1.1, railLength + CORRIDOR_SPACING] })
  }
  // Nearest last, so chunks (consecutive instances) cover compact z ranges; the long rails stay where they are.
  return out.sort((left, right) => left.position[2] - right.position[2])
}

/**
 * Ground smoke: soft billboards at the tower bases (two per side of every pair on every tier, more on medium and high), which the
 * screens light. Sorted farthest first (most negative z), so drawing the buffer in order composes back to front.
 */
export function buildThresholdSmoke(seed = 1337): readonly ThresholdPuff[] {
  const random = createRandom((seed ^ 0x85ebca6b) >>> 0)
  const range = (min: number, max: number) => min + (max - min) * random()
  const puffs: ThresholdPuff[] = []
  for (let index = 0; index < CORRIDOR_PAIRS; index += 1) {
    const distance = CORRIDOR_FIRST + index * CORRIDOR_SPACING
    const rank = 0.04 + 0.92 * (index / (CORRIDOR_PAIRS - 1))
    const make = (x: number, y: number, z: number, size: number, alpha: number, minTier: ThresholdTier, side: 0 | 1): ThresholdPuff => ({
      position: [x, y, z], size, stretch: range(0.55, 0.8), seed: random(), spin: range(0.02, 0.06) * (random() < 0.5 ? -1 : 1), alpha, row: index, rank, side, minTier,
    })
    for (const sign of [-1, 1] as const) {
      const side = (sign < 0 ? 0 : 1) as 0 | 1
      for (let n = 0; n < 2; n += 1) puffs.push(make(sign * range(15, 24), range(2.2, 5), -distance + range(-5.5, 5.5), range(15, 22), range(0.5, 0.7), 0, side))
      puffs.push(make(sign * range(8, 14), range(1.6, 3.4), -distance + range(-6, 6), range(18, 26), range(0.4, 0.55), 1, side))
    }
    for (let n = 0; n < 2; n += 1) puffs.push(make(range(-6, 6), range(1.2, 2.8), -distance + range(-6.5, 6.5), range(20, 30), range(0.3, 0.42), 2, (n % 2) as 0 | 1))
  }
  return Object.freeze(puffs.sort((left, right) => left.position[2] - right.position[2]).map(puff => Object.freeze(puff)))
}

/** Packs smoke puffs: three `vec4`s per puff (48 bytes). */
export function packThresholdPuffs(puffs: readonly ThresholdPuff[]): Float32Array {
  const data = new Float32Array(puffs.length * THRESHOLD_PUFF_FLOATS)
  puffs.forEach((puff, index) => {
    const o = index * THRESHOLD_PUFF_FLOATS
    data.set([puff.position[0], puff.position[1], puff.position[2], puff.size], o)
    data.set([puff.stretch, puff.seed, puff.spin, puff.alpha], o + 4)
    data.set([puff.row, puff.rank, puff.side, puff.minTier], o + 8)
  })
  return data
}

export function countThresholdInstances(instances: readonly Readonly<{ minTier?: ThresholdTier }>[], tier: ThresholdTier): number {
  return instances.filter(instance => (instance.minTier ?? 0) <= tier).length
}

/** A run of consecutive instances with its lap-local z extent, used to skip chunks that are behind the camera or beyond the view distance. */
export interface ThresholdChunk {
  start: number
  count: number
  zMin: number
  zMax: number
}

export const THRESHOLD_CHUNK_SIZE = 24

export function buildThresholdChunks(instances: readonly ThresholdInstance[], chunkSize = THRESHOLD_CHUNK_SIZE): readonly ThresholdChunk[] {
  const chunks: ThresholdChunk[] = []
  for (let start = 0; start < instances.length; start += chunkSize) {
    const slice = instances.slice(start, start + chunkSize)
    let zMin = Infinity
    let zMax = -Infinity
    for (const instance of slice) {
      // A rotated box reaches at most half its diagonal from its centre.
      const reach = Math.hypot(instance.size[0], instance.size[1], instance.size[2]) / 2
      zMin = Math.min(zMin, instance.position[2] - reach)
      zMax = Math.max(zMax, instance.position[2] + reach)
    }
    chunks.push({ start, count: slice.length, zMin, zMax })
  }
  return Object.freeze(chunks)
}

/**
 * The instance ranges of one lap copy that can be seen from a camera at world z `cameraZ`: chunks whose world z extent intersects
 * `[cameraZ - viewFar, cameraZ + margin]`. Adjacent visible chunks are merged into one draw range.
 */
export function visibleThresholdRanges(
  chunks: readonly ThresholdChunk[],
  lap: number,
  period: number,
  cameraZ: number,
  viewFar: number,
  margin: number,
): readonly { start: number; count: number }[] {
  const ranges: { start: number; count: number }[] = []
  const shift = lap * period
  for (const chunk of chunks) {
    if (chunk.zMax - shift < cameraZ - viewFar || chunk.zMin - shift > cameraZ + margin) continue
    const last = ranges[ranges.length - 1]
    if (last && last.start + last.count === chunk.start) last.count += chunk.count
    else ranges.push({ start: chunk.start, count: chunk.count })
  }
  return ranges
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
    // i3: side, zone, minimum quality tier (one reserved)
    data[o + 12] = instance.side
    data[o + 13] = instance.zone
    data[o + 14] = instance.minTier ?? 0
  })
  return data
}

/** Which copies of the lap to draw for a camera at world z: the current one and its neighbours. */
export function thresholdPeriodIndices(cameraZ: number): readonly number[] {
  // `|| 0` folds -0 (camera exactly at the origin) into 0.
  const lap = Math.floor(-cameraZ / THRESHOLD_PERIOD) || 0
  return Object.freeze([lap - 1, lap, lap + 1])
}

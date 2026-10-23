import { evaluateCinema2BlockshiftPattern } from './Cinema2BlockshiftPatterns'
import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_BLOCKSHIFT_BLOCK_COUNT, CINEMA2_BLOCKSHIFT_BLOCKS, CINEMA2_BLOCKSHIFT_DEFAULTS, CINEMA2_BLOCKSHIFT_PALETTE, CINEMA2_BLOCKSHIFT_MODEL_SCALE, CINEMA2_BLOCKSHIFT_MAX_RADIUS,
  validateCinema2BlockshiftGeometry, type Cinema2BlockshiftInstance, type Cinema2BlockshiftPattern,
} from './Cinema2BlockshiftDomain'

export const CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS = 12
export interface Cinema2BlockshiftLayoutOptions {
  blockSize: number
  spread: number
  depth: number
  rotationRange: number
  pattern: Cinema2BlockshiftPattern
  phase: number
}

/** Viewer-centered field. Peripheral cropping and objects behind the camera are intentional. */
export function buildCinema2BlockshiftLayout(options: Partial<Cinema2BlockshiftLayoutOptions> = {}): readonly Readonly<Cinema2BlockshiftInstance>[] {
  const { blockSize, spread, depth, pattern, rotationRange, phase } = { ...CINEMA2_BLOCKSHIFT_DEFAULTS, pattern: 'stagger' as const, rotationRange: 16, phase: 0, ...options }
  validateCinema2BlockshiftGeometry(blockSize, spread, depth)
  if (!Number.isFinite(rotationRange) || rotationRange < 0 || rotationRange > 45) throw new Error('BLOCKSHIFT rotationRange must be between 0 and 45 degrees.')
  const size = blockSize * CINEMA2_BLOCKSHIFT_MODEL_SCALE
  if (!Number.isFinite(phase)) throw new Error('BLOCKSHIFT phase must be finite.')
  const instances = evaluateCinema2BlockshiftPattern(pattern, phase, size, depth, rotationRange)
  const safe = constrainCinema2BlockshiftLayout(instances)
  // Spread is applied after safety, so it cannot be canceled by collision clearance.
  const lateralSpread = 1 + (spread - 0.5) * 0.4
  const depthSpread = 1 + (spread - 0.5) * 0.12
  return constrainCinema2BlockshiftLayout(safe.map(block => ({ ...block, position: block.position.map((value, axis) => value * (axis === 2 ? depthSpread : lateralSpread)) as unknown as Cinema2Vector3 })))
}

/** Conservative extents of the actual XYZ rotation used by the native shader. */
export function cinema2BlockshiftHalfExtents(block: Readonly<Cinema2BlockshiftInstance>): readonly number[] {
  const [x, y, z] = block.rotation, sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z)
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ].map(row => row.reduce((sum, value) => sum + Math.abs(value), 0) * block.size / 2)
}

/** Camera-centered clearance is also applied to interpolated poses; no separate collision engine. */
export function constrainCinema2BlockshiftLayout(instances: readonly Readonly<Cinema2BlockshiftInstance>[]): readonly Readonly<Cinema2BlockshiftInstance>[] {
  const clearance = 1.5
  // Separate transformed model AABBs along at least one axis. Bounding spheres unnecessarily pushed
  // every formation apart as Size grew, leaving large gaps around the actual cube geometry.
  const halfExtents = instances.map(cinema2BlockshiftHalfExtents)
  // Stable near-first priority: growing a rear cube must not shrink every foreground cube on screen.
  const priority = [0, 3, 5, 6, 7, 8, 1, 2, 9, 10, 11, 12, 13, 14, 4]
  const placed: Cinema2BlockshiftInstance[] = [], result = [...instances]
  for (const index of priority) {
    const block = instances[index]!, initialDistance = Math.hypot(...block.position)
    if (!Number.isFinite(initialDistance) || initialDistance < 1e-8) throw new Error('BLOCKSHIFT requires finite observer-relative positions.')
    const ray = block.position.map(n => n / initialDistance)
    const radius = Math.sqrt(3) * block.size / 2
    let distance = Math.max(initialDistance, radius + 2.5)
    // Each AABB excludes one interval along this ray. Moving past that interval cannot re-enter it.
    for (let pass = 0; pass <= placed.length; pass++) {
      let changed = false
      for (const other of placed) {
        const sums = halfExtents[index]!.map((n, a) => n + halfExtents[other.index]![a]! + clearance)
        if (ray.some((n, a) => Math.abs(n * distance - other.position[a]!) >= sums[a]! - 1e-9)) continue
        const exit = Math.min(...ray.map((n, a) => Math.abs(n) > 1e-9 ? (Math.sign(n) * other.position[a]! + sums[a]!) / Math.abs(n) : Infinity))
        distance = Math.max(distance, exit + 1e-8); changed = true
      }
      if (!changed) break
    }
    const position = Object.freeze(ray.map(n => n * distance)) as unknown as Cinema2Vector3
    if (!position.every(Number.isFinite) || distance + radius > CINEMA2_BLOCKSHIFT_MAX_RADIUS) throw new Error('BLOCKSHIFT layout exceeds its finite framing envelope.')
    const safe = Object.freeze({ ...block, position, rotation: Object.freeze(block.rotation) })
    result[index] = safe; placed.push(safe)
  }
  return Object.freeze(result)
}

/** Center/size, edge RGB/emission, local Euler XYZ/stable LED block index. Reuses the caller's fixed-size buffer. */
export function packCinema2BlockshiftInstances(
  instances: readonly Readonly<Cinema2BlockshiftInstance>[],
  palette: Readonly<typeof CINEMA2_BLOCKSHIFT_PALETTE> = CINEMA2_BLOCKSHIFT_PALETTE,
  packed: Float32Array = new Float32Array(CINEMA2_BLOCKSHIFT_BLOCK_COUNT * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS),
): Float32Array {
  if (instances.length !== CINEMA2_BLOCKSHIFT_BLOCK_COUNT || packed.length !== CINEMA2_BLOCKSHIFT_BLOCK_COUNT * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS) throw new Error('BLOCKSHIFT requires exactly fifteen permanent instances.')
  instances.forEach((block, index) => {
    if (block.index !== index || block.id !== CINEMA2_BLOCKSHIFT_BLOCKS[index]!.id) throw new Error('BLOCKSHIFT instance identity/order changed.')
    packed.set([...block.position, block.size, ...palette[block.edgeRole].slice(0, 3), 1, ...block.rotation, block.index], index * CINEMA2_BLOCKSHIFT_INSTANCE_FLOATS)
  })
  return packed
}

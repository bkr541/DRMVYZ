import type { IfritComponentPose } from './Cinema2IfritMechanics'
import type { IfritShardPose } from './Cinema2IfritShatter'

/** 16 floats per instance: three matrix rows (3x3 rotation·scale and a translation each), then (cut start, cut end, corner flag, illumination). */
export const IFRIT_INSTANCE_FLOATS = 16
export const IFRIT_INSTANCE_BYTES = IFRIT_INSTANCE_FLOATS * 4

/** Writes one part's world matrix (R = Rz·Ry·Rx, columns scaled by `scale`) at `offset`. */
export function writeIfritInstance(
  target: Float32Array, offset: number, position: readonly [number, number, number], rotation: readonly [number, number, number],
  scale: readonly [number, number, number], illumination: number, cutStart = 0, cutEnd = 0, corner = 0,
): void {
  const [rx, ry, rz] = rotation
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz)
  const [kx, ky, kz] = scale
  target[offset] = cz * cy * kx; target[offset + 1] = (cz * sy * sx - sz * cx) * ky; target[offset + 2] = (cz * sy * cx + sz * sx) * kz; target[offset + 3] = position[0]
  target[offset + 4] = sz * cy * kx; target[offset + 5] = (sz * sy * sx + cz * cx) * ky; target[offset + 6] = (sz * sy * cx - cz * sx) * kz; target[offset + 7] = position[1]
  target[offset + 8] = -sy * kx; target[offset + 9] = cy * sx * ky; target[offset + 10] = cy * cx * kz; target[offset + 11] = position[2]
  target[offset + 12] = cutStart; target[offset + 13] = cutEnd; target[offset + 14] = corner; target[offset + 15] = illumination
}
/** Packs the poses of one kind into `target` (capacity in instances is `target.length / 16`; extra poses are dropped). Returns the instance count. */
export function packIfritComponents(poses: readonly IfritComponentPose[], kind: IfritComponentPose['kind'], target: Float32Array): number {
  const capacity = Math.floor(target.length / IFRIT_INSTANCE_FLOATS)
  let count = 0
  for (const pose of poses) {
    if (pose.kind !== kind || !pose.visible || count >= capacity) continue
    writeIfritInstance(target, count * IFRIT_INSTANCE_FLOATS, pose.position, pose.rotation, pose.scale, pose.illumination)
    count++
  }
  return count
}
export function packIfritShards(shards: readonly IfritShardPose[], target: Float32Array): number {
  const capacity = Math.floor(target.length / IFRIT_INSTANCE_FLOATS)
  let count = 0
  for (const shard of shards) {
    if (!shard.visible || count >= capacity) continue
    writeIfritInstance(target, count * IFRIT_INSTANCE_FLOATS, shard.position, shard.rotation, shard.scale, shard.illumination, shard.cutStart, shard.cutEnd, shard.corner ? 1 : 0)
    count++
  }
  return count
}

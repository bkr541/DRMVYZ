import { IfritMeshBuilder, type IfritMesh } from './Cinema2IfritMechanicsGeometry'

/**
 * One shard mesh shared by every edge section: the portal beam's own cross-section (dark red body, three orange contour strips) along local x
 * from -0.5 to 0.5. The vertex shader slants the two ends by the section's cuts (so whole sections tile exactly) and the instance scale sets its
 * length and thickness. The corner links (role 5) are drawn only on the first section of an edge. Dimensions match `buildIfritGeometry()`.
 */
export const IFRIT_SHARD_BODY_HALF_WIDTH = 0.06
export const IFRIT_SHARD_CONTOUR_OFFSET = 0.0606
export function buildIfritShardMesh(): IfritMesh {
  const b = new IfritMeshBuilder()
  b.box([0, 0, 0], [0.5, 0.06, 0.15], 0)
  for (const y of [-IFRIT_SHARD_CONTOUR_OFFSET, IFRIT_SHARD_CONTOUR_OFFSET]) b.box([0, y, 0.17], [0.5, 0.0225, 0.0225], 1)
  b.box([0, IFRIT_SHARD_CONTOUR_OFFSET, -0.17], [0.5, 0.0225, 0.0225], 1)
  b.box([-0.5, 0, 0.19], [0.014, IFRIT_SHARD_CONTOUR_OFFSET, 0.02], 5)
  b.box([-0.5, IFRIT_SHARD_CONTOUR_OFFSET, 0.01], [0.014, 0.02, 0.18], 5)
  return b.build()
}

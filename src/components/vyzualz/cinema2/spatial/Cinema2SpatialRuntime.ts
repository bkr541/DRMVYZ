import type {
  Cinema2CoordinateSpace,
  Cinema2ModuleId,
  Cinema2SceneNodeId,
  Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2FinalValueResolver, Cinema2TargetHandle, Cinema2TargetId } from '../parameters/Cinema2TargetRuntime'
import {
  createCinema2Transform3DMatrix,
  multiplyCinema2Matrix4,
  type Cinema2CompiledSceneGraph,
  type Cinema2Matrix4,
} from '../scene/Cinema2SceneGraph'

export interface Cinema2ResolvedSpatialNode {
  id: Cinema2SceneNodeId
  moduleId: Cinema2ModuleId | null
  coordinateSpace: Cinema2CoordinateSpace
  visible: boolean
  local: Readonly<{
    position: Cinema2Vector3
    rotation: Cinema2Vector3
    scale: Cinema2Vector3
    matrix: Cinema2Matrix4
  }>
  worldMatrix: Cinema2Matrix4
  worldPosition: Cinema2Vector3
}

interface SpatialTargetSet {
  visible: Cinema2TargetId | null
  position: Cinema2TargetId | null
  rotation: Cinema2TargetId | null
  scale: Cinema2TargetId | null
}

const IDENTITY_POSITION = Object.freeze([0, 0, 0]) as Cinema2Vector3
const IDENTITY_ROTATION = Object.freeze([0, 0, 0]) as Cinema2Vector3
const IDENTITY_SCALE = Object.freeze([1, 1, 1]) as Cinema2Vector3

/**
 * Runtime spatial resolver for Scene Graph nodes.
 *
 * The compiled Scene Graph remains immutable authored structure. This service
 * resolves the canonical scene-node targets each frame, composes parent
 * transforms, and exposes the final world matrix used by render providers.
 */
export class Cinema2SpatialRuntime {
  private readonly targetsByNode = new Map<Cinema2SceneNodeId, SpatialTargetSet>()
  private readonly nodeById = new Map<Cinema2SceneNodeId, Readonly<Cinema2CompiledSceneGraph['nodes'][number]>>()
  private disposed = false

  constructor(
    private readonly scene: Readonly<Cinema2CompiledSceneGraph>,
    targetHandles: readonly Readonly<Cinema2TargetHandle>[],
    private readonly resolver: Cinema2FinalValueResolver,
  ) {
    for (const node of scene.nodes) this.nodeById.set(node.id, node)
    for (const node of scene.nodes) {
      this.targetsByNode.set(node.id, {
        visible: findTarget(targetHandles, node.id, 'visible'),
        position: findTarget(targetHandles, node.id, 'transform.position'),
        rotation: findTarget(targetHandles, node.id, 'transform.rotation'),
        scale: findTarget(targetHandles, node.id, 'transform.scale'),
      })
    }
  }

  resolveNode(nodeId: Cinema2SceneNodeId): Readonly<Cinema2ResolvedSpatialNode> | null {
    if (this.disposed) return null
    return this.resolveNodeInternal(nodeId, new Map())
  }

  resolveModuleNodes(moduleId: Cinema2ModuleId): readonly Readonly<Cinema2ResolvedSpatialNode>[] {
    if (this.disposed) return Object.freeze([])
    const cache = new Map<Cinema2SceneNodeId, Readonly<Cinema2ResolvedSpatialNode>>()
    return Object.freeze(this.scene.nodes
      .filter(node => node.moduleId === moduleId)
      .map(node => this.resolveNodeInternal(node.id, cache))
      .filter((node): node is Readonly<Cinema2ResolvedSpatialNode> => node != null))
  }

  dispose(): void {
    this.disposed = true
    this.targetsByNode.clear()
  }

  private resolveNodeInternal(
    nodeId: Cinema2SceneNodeId,
    cache: Map<Cinema2SceneNodeId, Readonly<Cinema2ResolvedSpatialNode>>,
  ): Readonly<Cinema2ResolvedSpatialNode> | null {
    const cached = cache.get(nodeId)
    if (cached) return cached
    const node = this.nodeById.get(nodeId)
    if (!node) return null
    const parent = node.parentId ? this.resolveNodeInternal(node.parentId, cache) : null
    const targets = this.targetsByNode.get(nodeId)
    const position = resolveVec3(this.resolver, targets?.position, node.localTransform.position ?? IDENTITY_POSITION)
    const rotation = resolveVec3(this.resolver, targets?.rotation, node.localTransform.rotation ?? IDENTITY_ROTATION)
    const scale = resolveVec3(this.resolver, targets?.scale, node.localTransform.scale ?? IDENTITY_SCALE)
    const localMatrix = createCinema2Transform3DMatrix(position, rotation, scale)
    const worldMatrix = parent ? multiplyCinema2Matrix4(parent.worldMatrix, localMatrix) : localMatrix
    const ownVisible = resolveBoolean(this.resolver, targets?.visible, node.visible)
    const result = Object.freeze({
      id: node.id,
      moduleId: node.moduleId,
      coordinateSpace: node.coordinateSpace,
      visible: (parent?.visible ?? true) && ownVisible,
      local: Object.freeze({ position, rotation, scale, matrix: localMatrix }),
      worldMatrix,
      worldPosition: Object.freeze([worldMatrix[12], worldMatrix[13], worldMatrix[14]]) as Cinema2Vector3,
    })
    cache.set(nodeId, result)
    return result
  }
}

function findTarget(
  targets: readonly Readonly<Cinema2TargetHandle>[],
  ownerId: Cinema2SceneNodeId,
  property: string,
): Cinema2TargetId | null {
  return targets.find(target => target.kind === 'scene-node' && target.ownerId === ownerId && target.property === property)?.id ?? null
}

function resolveVec3(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null | undefined,
  fallback: Cinema2Vector3,
): Cinema2Vector3 {
  if (!targetId) return freezeVector3(fallback)
  const result = resolver.resolve(targetId)
  const value = result.ok ? result.value : undefined
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    return freezeVector3(fallback)
  }
  return Object.freeze([value[0] as number, value[1] as number, value[2] as number]) as Cinema2Vector3
}

function resolveBoolean(
  resolver: Cinema2FinalValueResolver,
  targetId: Cinema2TargetId | null | undefined,
  fallback: boolean,
): boolean {
  if (!targetId) return fallback
  const result = resolver.resolve(targetId)
  return result.ok && typeof result.value === 'boolean' ? result.value : fallback
}

function freezeVector3(value: Cinema2Vector3): Cinema2Vector3 {
  return Object.freeze([value[0], value[1], value[2]]) as Cinema2Vector3
}

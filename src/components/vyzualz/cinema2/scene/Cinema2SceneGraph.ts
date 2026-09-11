import {
  isCinema2StableId,
  type Cinema2CameraId,
  type Cinema2CoordinateSpace,
  type Cinema2LayerBlendMode,
  type Cinema2LayerDepthPolicy,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2MediaSlotId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2SceneNodeId,
  type Cinema2SceneNodeKind,
  type Cinema2TransformManifest,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_SCENE_GRAPH_PLAN_VERSION = 1 as const

export type Cinema2Matrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export interface Cinema2LocalTransform {
  position: Cinema2Vector3
  rotation: Cinema2Vector3
  scale: Cinema2Vector3
  matrix: Cinema2Matrix4
}

export interface Cinema2ResolvedTransform {
  /** Resolved origin in the node's inherited coordinate space. */
  position: Cinema2Vector3
  /** Authoritative parent-composed matrix. */
  matrix: Cinema2Matrix4
}

export interface Cinema2CompiledSceneNode {
  id: Cinema2SceneNodeId
  kind: Cinema2SceneNodeKind
  parentId: Cinema2SceneNodeId | null
  coordinateSpace: Cinema2CoordinateSpace
  visible: boolean
  effectiveVisible: boolean
  moduleId: Cinema2ModuleId | null
  mediaSlotId: Cinema2MediaSlotId | null
  layerIds: readonly Cinema2LayerId[]
  targetedByCameraIds: readonly Cinema2CameraId[]
  targetedByLightIds: readonly Cinema2LightId[]
  localTransform: Readonly<Cinema2LocalTransform>
  resolvedTransform: Readonly<Cinema2ResolvedTransform>
}

export interface Cinema2CompiledLayerDefinition {
  id: Cinema2LayerId
  label: string
  sourceNodeId: Cinema2SceneNodeId
  role: string | null
  visible: boolean
  opacity: number
  blendMode: Cinema2LayerBlendMode
  depthPolicy: Cinema2LayerDepthPolicy
  order: number
  compositionIndex: number
}

/**
 * Immutable, renderer-independent scene view. It deliberately contains no
 * framebuffer, render-target, pass, WebGL or resource scheduling state.
 */
export interface Cinema2CompiledSceneGraph {
  version: typeof CINEMA2_SCENE_GRAPH_PLAN_VERSION
  rootNodeIds: readonly Cinema2SceneNodeId[]
  traversalOrder: readonly Cinema2SceneNodeId[]
  nodeIds: readonly Cinema2SceneNodeId[]
  nodes: readonly Readonly<Cinema2CompiledSceneNode>[]
  layerOrder: readonly Cinema2LayerId[]
  layers: readonly Readonly<Cinema2CompiledLayerDefinition>[]
}

export interface Cinema2SceneGraphDiagnostic {
  code: string
  message: string
  path: string
}

export type Cinema2SceneGraphCompilationResult =
  | { ok: true; plan: Readonly<Cinema2CompiledSceneGraph>; diagnostics: readonly [] }
  | { ok: false; plan: null; diagnostics: readonly Cinema2SceneGraphDiagnostic[] }

interface IndexedNode {
  node: NonNullable<Cinema2NativePresetManifest['scene']>['nodes'][number]
  index: number
}

const COORDINATE_SPACES = new Set<Cinema2CoordinateSpace>(['screen', 'normalized-screen', 'world'])
const BLEND_MODES = new Set<Cinema2LayerBlendMode>(['normal', 'add', 'screen', 'multiply'])
const DEPTH_POLICIES = new Set<Cinema2LayerDepthPolicy>(['disabled', 'read-only', 'read-write'])
const DEFAULT_COORDINATE_SPACE: Cinema2CoordinateSpace = 'normalized-screen'
const IDENTITY_POSITION: Cinema2Vector3 = Object.freeze([0, 0, 0])
const IDENTITY_ROTATION: Cinema2Vector3 = Object.freeze([0, 0, 0])
const IDENTITY_SCALE: Cinema2Vector3 = Object.freeze([1, 1, 1])

/**
 * Compiles spatial hierarchy and layer composition only. Coordinate spaces do
 * not silently convert: a child either inherits its parent's space or declares
 * the same space. Cross-space composition must be introduced by an explicit
 * future engine conversion boundary rather than guessed here.
 */
export function compileCinema2SceneGraph(manifest: Cinema2NativePresetManifest): Cinema2SceneGraphCompilationResult {
  const diagnostics: Cinema2SceneGraphDiagnostic[] = []
  const authoredNodes = Array.isArray(manifest.scene?.nodes) ? manifest.scene.nodes : []
  const authoredLayers = Array.isArray(manifest.layers) ? manifest.layers : []
  const nodesById = new Map<Cinema2SceneNodeId, IndexedNode>()
  const moduleIds = new Set(Array.isArray(manifest.modules) ? manifest.modules.map(module => module.id) : [])
  const mediaSlotIds = new Set(Array.isArray(manifest.mediaSlots) ? manifest.mediaSlots.map(slot => slot.id) : [])

  for (const [index, node] of authoredNodes.entries()) {
    if (!isPlainObject(node) || !isCinema2StableId(node.id) || nodesById.has(node.id as Cinema2SceneNodeId)) continue
    const authored = node as unknown as NonNullable<Cinema2NativePresetManifest['scene']>['nodes'][number]
    nodesById.set(authored.id, { node: authored, index })
  }
  validateNodes(authoredNodes, nodesById, moduleIds, mediaSlotIds, diagnostics)
  validateRoots(manifest, nodesById, diagnostics)
  validateLayers(authoredLayers, nodesById, diagnostics)
  validateSpatialTargets(manifest, nodesById, diagnostics)
  validateParentCycles(nodesById, diagnostics)
  validateResolvedCoordinateSpaces(nodesById, diagnostics)

  if (diagnostics.length > 0) {
    return { ok: false, plan: null, diagnostics: freezeDiagnostics(diagnostics) }
  }

  const rootNodeIds = resolveRootIds(manifest, nodesById)
  const childrenByParent = buildChildrenIndex(nodesById)
  const traversalOrder = resolveTraversalOrder(rootNodeIds, childrenByParent)
  const layerDefinitions = compileLayers(authoredLayers)
  const layerIdsByNode = new Map<Cinema2SceneNodeId, Cinema2LayerId[]>()
  for (const layer of layerDefinitions) {
    const assignLayerToSubtree = (nodeId: Cinema2SceneNodeId) => {
      const memberships = layerIdsByNode.get(nodeId) ?? []
      memberships.push(layer.id)
      layerIdsByNode.set(nodeId, memberships)
      for (const childId of childrenByParent.get(nodeId) ?? []) assignLayerToSubtree(childId)
    }
    assignLayerToSubtree(layer.sourceNodeId)
  }
  const cameraTargets = collectCameraTargets(manifest)
  const lightTargets = collectLightTargets(manifest)

  const resolvedNodes = new Map<Cinema2SceneNodeId, Cinema2CompiledSceneNode>()
  for (const nodeId of traversalOrder) {
    const authored = nodesById.get(nodeId)?.node
    if (!authored) continue
    const parentId = authored.parent?.$ref ?? null
    const parent = parentId == null ? null : resolvedNodes.get(parentId) ?? null
    const coordinateSpace = authored.coordinateSpace ?? parent?.coordinateSpace ?? DEFAULT_COORDINATE_SPACE
    const localTransform = compileTransform(authored.transform)
    const resolvedMatrix = parent == null
      ? localTransform.matrix
      : multiplyMatrix4(parent.resolvedTransform.matrix, localTransform.matrix)
    const resolvedTransform: Cinema2ResolvedTransform = deepFreeze({
      position: Object.freeze([resolvedMatrix[12], resolvedMatrix[13], resolvedMatrix[14]]) as Cinema2Vector3,
      matrix: resolvedMatrix,
    })
    const node = deepFreeze({
      id: authored.id,
      kind: authored.kind,
      parentId,
      coordinateSpace,
      visible: authored.visible ?? true,
      effectiveVisible: (parent?.effectiveVisible ?? true) && (authored.visible ?? true),
      moduleId: authored.module?.$ref ?? null,
      mediaSlotId: authored.media?.$ref ?? null,
      layerIds: Object.freeze([...(layerIdsByNode.get(authored.id) ?? [])]),
      targetedByCameraIds: Object.freeze([...(cameraTargets.get(authored.id) ?? [])].sort(compareStrings)),
      targetedByLightIds: Object.freeze([...(lightTargets.get(authored.id) ?? [])].sort(compareStrings)),
      localTransform,
      resolvedTransform,
    }) as Cinema2CompiledSceneNode
    resolvedNodes.set(nodeId, node)
  }

  const nodes = traversalOrder.map(id => resolvedNodes.get(id)).filter((node): node is Cinema2CompiledSceneNode => node != null)
  const plan = deepFreeze({
    version: CINEMA2_SCENE_GRAPH_PLAN_VERSION,
    rootNodeIds,
    traversalOrder,
    nodeIds: traversalOrder,
    nodes,
    layerOrder: layerDefinitions.map(layer => layer.id),
    layers: layerDefinitions,
  }) as Readonly<Cinema2CompiledSceneGraph>
  return { ok: true, plan, diagnostics: [] }
}

function validateNodes(
  nodes: readonly NonNullable<Cinema2NativePresetManifest['scene']>['nodes'][number][],
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  moduleIds: ReadonlySet<Cinema2ModuleId>,
  mediaSlotIds: ReadonlySet<Cinema2MediaSlotId>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  for (const [index, node] of nodes.entries()) {
    if (!isPlainObject(node)) continue
    const base = `$.scene.nodes[${index}]`
    if (!['group', 'module', 'media', 'primitive'].includes(String(node.kind))) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `Unsupported scene node kind "${String(node.kind)}".`, `${base}.kind`))
    } else if (node.kind === 'module') {
      if (node.module == null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A module scene node must reference a module.', `${base}.module`))
      if (node.media != null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A module scene node cannot also reference media.', `${base}.media`))
    } else if (node.kind === 'media') {
      if (node.media == null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A media scene node must reference a media slot.', `${base}.media`))
      if (node.module != null) diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', 'A media scene node cannot also reference a module.', `${base}.module`))
    } else if (node.module != null || node.media != null) {
      diagnostics.push(error('CINEMA2_PRESET_COMBINATION_INVALID', `${node.kind} scene nodes cannot reference modules or media slots.`, base))
    }
    if (node.visible != null && typeof node.visible !== 'boolean') {
      diagnostics.push(error('CINEMA2_SCENE_VISIBILITY_INVALID', 'Scene node visible must be a boolean when authored.', `${base}.visible`))
    }
    if (node.parent != null && !hasRef(nodesById, node.parent.$ref)) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown scene parent reference "${String(node.parent.$ref)}".`, `${base}.parent`))
    }
    if (node.coordinateSpace != null && !COORDINATE_SPACES.has(node.coordinateSpace)) {
      diagnostics.push(error('CINEMA2_SCENE_COORDINATE_SPACE_INVALID', `Unsupported coordinate space "${String(node.coordinateSpace)}".`, `${base}.coordinateSpace`))
    }
    validateTransform(node.transform, `${base}.transform`, diagnostics)
    if (node.module != null && !moduleIds.has(node.module.$ref)) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown module reference "${String(node.module.$ref)}".`, `${base}.module`))
    }
    if (node.media != null && !mediaSlotIds.has(node.media.$ref)) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown media slot reference "${String(node.media.$ref)}".`, `${base}.media`))
    }
  }
}

function validateRoots(
  manifest: Cinema2NativePresetManifest,
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  if (!Array.isArray(manifest.scene?.roots)) return
  const seen = new Set<Cinema2SceneNodeId>()
  for (const [index, root] of manifest.scene.roots.entries()) {
    const path = `$.scene.roots[${index}]`
    const node = nodesById.get(root?.$ref)
    if (!node) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown scene root reference "${String(root?.$ref)}".`, path))
      continue
    }
    if (seen.has(root.$ref)) {
      diagnostics.push(error('CINEMA2_SCENE_ROOT_DUPLICATE', `Scene root "${root.$ref}" is declared more than once.`, path))
      continue
    }
    seen.add(root.$ref)
    if (node.node.parent != null) {
      diagnostics.push(error('CINEMA2_SCENE_ROOT_HAS_PARENT', `Scene root "${root.$ref}" cannot also declare a parent.`, path))
    }
  }
  for (const [id, node] of nodesById) {
    if (node.node.parent == null && !seen.has(id)) {
      diagnostics.push(error('CINEMA2_SCENE_ROOT_OMITTED', `Parentless scene node "${id}" must be listed when $.scene.roots is authored.`, '$.scene.roots'))
    }
  }
}

function validateLayers(
  layers: readonly NonNullable<Cinema2NativePresetManifest['layers']>[number][],
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  for (const [index, layer] of layers.entries()) {
    if (!isPlainObject(layer)) continue
    const base = `$.layers[${index}]`
    if (typeof layer.label !== 'string' || layer.label.trim().length === 0) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_LABEL_INVALID', 'Layer label must be a non-empty string.', `${base}.label`))
    }
    if (!layer.source || !hasRef(nodesById, layer.source.$ref)) {
      diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown scene node reference "${String(layer.source?.$ref)}".`, `${base}.source`))
    }
    if (layer.role != null && (typeof layer.role !== 'string' || layer.role.trim().length === 0)) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_ROLE_INVALID', 'Layer role must be a non-empty string when authored.', `${base}.role`))
    }
    if (layer.visible != null && typeof layer.visible !== 'boolean') {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_VISIBILITY_INVALID', 'Layer visible must be a boolean when authored.', `${base}.visible`))
    }
    if (layer.opacity != null && (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1)) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_OPACITY_INVALID', 'Layer opacity must be a finite number from 0 through 1.', `${base}.opacity`))
    }
    if (layer.blendMode != null && !BLEND_MODES.has(layer.blendMode)) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_BLEND_INVALID', `Unsupported layer blend mode "${String(layer.blendMode)}".`, `${base}.blendMode`))
    }
    if (layer.depthPolicy != null && !DEPTH_POLICIES.has(layer.depthPolicy)) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_DEPTH_POLICY_INVALID', `Unsupported layer depth policy "${String(layer.depthPolicy)}".`, `${base}.depthPolicy`))
    }
    if (layer.order != null && !Number.isInteger(layer.order)) {
      diagnostics.push(error('CINEMA2_SCENE_LAYER_ORDER_INVALID', 'Layer order must be an integer when authored.', `${base}.order`))
    }
  }
}

function validateSpatialTargets(
  manifest: Cinema2NativePresetManifest,
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  if (Array.isArray(manifest.cameras)) {
    for (const [index, camera] of manifest.cameras.entries()) {
      if (!isPlainObject(camera)) continue
      const authored = camera as unknown as NonNullable<Cinema2NativePresetManifest['cameras']>[number]
      const base = `$.cameras[${index}]`
      validateTransform(authored.transform, `${base}.transform`, diagnostics)
      if (authored.target != null) validateVector3(authored.target, `${base}.target`, diagnostics)
      if (authored.targetNode != null && !hasRef(nodesById, authored.targetNode.$ref)) {
        diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown camera target scene node "${String(authored.targetNode.$ref)}".`, `${base}.targetNode`))
      }
      if (authored.target != null && authored.targetNode != null) {
        diagnostics.push(error('CINEMA2_SCENE_CAMERA_TARGET_AMBIGUOUS', 'Camera may author either target coordinates or targetNode, not both.', base))
      }
    }
  }
  if (Array.isArray(manifest.lighting?.lights)) {
    for (const [index, light] of manifest.lighting.lights.entries()) {
      if (!isPlainObject(light)) continue
      const authored = light as unknown as NonNullable<NonNullable<Cinema2NativePresetManifest['lighting']>['lights']>[number]
      const base = `$.lighting.lights[${index}]`
      validateTransform(authored.transform, `${base}.transform`, diagnostics)
      if (authored.targetNode != null && !hasRef(nodesById, authored.targetNode.$ref)) {
        diagnostics.push(error('CINEMA2_PRESET_REFERENCE_MISSING', `Unknown light target scene node "${String(authored.targetNode.$ref)}".`, `${base}.targetNode`))
      }
    }
  }
}

function validateResolvedCoordinateSpaces(
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  const resolved = new Map<Cinema2SceneNodeId, Cinema2CoordinateSpace>()
  const resolving = new Set<Cinema2SceneNodeId>()
  const resolve = (nodeId: Cinema2SceneNodeId): Cinema2CoordinateSpace | null => {
    const existing = resolved.get(nodeId)
    if (existing != null) return existing
    if (resolving.has(nodeId)) return null
    const indexed = nodesById.get(nodeId)
    if (!indexed) return null
    resolving.add(nodeId)
    const parentId = indexed.node.parent?.$ref
    const parentSpace = parentId == null ? null : resolve(parentId)
    resolving.delete(nodeId)
    if (parentId != null && parentSpace == null) return null
    const ownSpace = indexed.node.coordinateSpace
    if (ownSpace != null && parentSpace != null && ownSpace !== parentSpace) {
      diagnostics.push(error(
        'CINEMA2_SCENE_COORDINATE_SPACE_MISMATCH',
        `Scene child "${nodeId}" cannot compose ${ownSpace} coordinates under inherited ${parentSpace} parent space without an explicit conversion boundary.`,
        `$.scene.nodes[${indexed.index}].coordinateSpace`,
      ))
      return null
    }
    const value = ownSpace ?? parentSpace ?? DEFAULT_COORDINATE_SPACE
    resolved.set(nodeId, value)
    return value
  }
  for (const nodeId of [...nodesById.keys()].sort(compareStrings)) resolve(nodeId)
}

function validateParentCycles(
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  const visiting = new Set<Cinema2SceneNodeId>()
  const visited = new Set<Cinema2SceneNodeId>()
  const visit = (nodeId: Cinema2SceneNodeId): boolean => {
    if (visited.has(nodeId)) return false
    if (visiting.has(nodeId)) {
      diagnostics.push(error('CINEMA2_SCENE_PARENT_CYCLE', `Scene parent hierarchy contains a cycle involving "${nodeId}".`, '$.scene.nodes'))
      return true
    }
    visiting.add(nodeId)
    const parentId = nodesById.get(nodeId)?.node.parent?.$ref
    if (parentId != null && nodesById.has(parentId) && visit(parentId)) return true
    visiting.delete(nodeId)
    visited.add(nodeId)
    return false
  }
  for (const nodeId of [...nodesById.keys()].sort(compareStrings)) {
    if (visit(nodeId)) return
  }
}

function validateTransform(
  transform: Cinema2TransformManifest | undefined,
  path: string,
  diagnostics: Cinema2SceneGraphDiagnostic[],
): void {
  if (transform == null) return
  if (transform.position != null) validateVector3(transform.position, `${path}.position`, diagnostics)
  if (transform.rotation != null) validateVector3(transform.rotation, `${path}.rotation`, diagnostics)
  if (transform.scale != null) validateVector3(transform.scale, `${path}.scale`, diagnostics)
}

function validateVector3(value: unknown, path: string, diagnostics: Cinema2SceneGraphDiagnostic[]): void {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    diagnostics.push(error('CINEMA2_SCENE_TRANSFORM_INVALID', `${path} must contain exactly three finite numbers.`, path))
  }
}

function resolveRootIds(
  manifest: Cinema2NativePresetManifest,
  nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>,
): readonly Cinema2SceneNodeId[] {
  if (Array.isArray(manifest.scene?.roots)) return Object.freeze(manifest.scene.roots.map(root => root.$ref))
  return Object.freeze([...nodesById.values()]
    .filter(({ node }) => node.parent == null)
    .map(({ node }) => node.id)
    .sort(compareStrings))
}

function buildChildrenIndex(nodesById: ReadonlyMap<Cinema2SceneNodeId, IndexedNode>): Map<Cinema2SceneNodeId, Cinema2SceneNodeId[]> {
  const children = new Map<Cinema2SceneNodeId, Cinema2SceneNodeId[]>()
  for (const { node } of nodesById.values()) {
    const parentId = node.parent?.$ref
    if (parentId == null) continue
    const values = children.get(parentId) ?? []
    values.push(node.id)
    children.set(parentId, values)
  }
  for (const values of children.values()) values.sort(compareStrings)
  return children
}

function resolveTraversalOrder(
  rootIds: readonly Cinema2SceneNodeId[],
  childrenByParent: ReadonlyMap<Cinema2SceneNodeId, readonly Cinema2SceneNodeId[]>,
): readonly Cinema2SceneNodeId[] {
  const order: Cinema2SceneNodeId[] = []
  const visit = (id: Cinema2SceneNodeId) => {
    order.push(id)
    for (const child of childrenByParent.get(id) ?? []) visit(child)
  }
  for (const root of rootIds) visit(root)
  return Object.freeze(order)
}

function compileLayers(layers: readonly NonNullable<Cinema2NativePresetManifest['layers']>[number][]): readonly Cinema2CompiledLayerDefinition[] {
  return Object.freeze(layers
    .map((layer, index) => ({ layer, index, order: layer.order ?? index }))
    .sort((left, right) => left.order - right.order || left.index - right.index || compareStrings(left.layer.id, right.layer.id))
    .map(({ layer, order }, compositionIndex) => deepFreeze({
      id: layer.id,
      label: layer.label,
      sourceNodeId: layer.source.$ref,
      role: layer.role?.trim() || null,
      visible: layer.visible ?? true,
      opacity: layer.opacity ?? 1,
      blendMode: layer.blendMode ?? 'normal',
      depthPolicy: layer.depthPolicy ?? 'disabled',
      order,
      compositionIndex,
    })))
}

function collectCameraTargets(manifest: Cinema2NativePresetManifest): Map<Cinema2SceneNodeId, Cinema2CameraId[]> {
  const targets = new Map<Cinema2SceneNodeId, Cinema2CameraId[]>()
  if (!Array.isArray(manifest.cameras)) return targets
  for (const camera of manifest.cameras) {
    const nodeId = camera.targetNode?.$ref
    if (nodeId == null) continue
    const values = targets.get(nodeId) ?? []
    values.push(camera.id)
    targets.set(nodeId, values)
  }
  return targets
}

function collectLightTargets(manifest: Cinema2NativePresetManifest): Map<Cinema2SceneNodeId, Cinema2LightId[]> {
  const targets = new Map<Cinema2SceneNodeId, Cinema2LightId[]>()
  if (!Array.isArray(manifest.lighting?.lights)) return targets
  for (const light of manifest.lighting.lights) {
    const nodeId = light.targetNode?.$ref
    if (nodeId == null) continue
    const values = targets.get(nodeId) ?? []
    values.push(light.id)
    targets.set(nodeId, values)
  }
  return targets
}

function compileTransform(transform: Cinema2TransformManifest | undefined): Readonly<Cinema2LocalTransform> {
  const position = freezeVector3(transform?.position ?? IDENTITY_POSITION)
  const rotation = freezeVector3(transform?.rotation ?? IDENTITY_ROTATION)
  const scale = freezeVector3(transform?.scale ?? IDENTITY_SCALE)
  const matrix = multiplyMatrix4(
    multiplyMatrix4(
      multiplyMatrix4(
        multiplyMatrix4(translationMatrix(position), rotationZMatrix(rotation[2])),
        rotationYMatrix(rotation[1]),
      ),
      rotationXMatrix(rotation[0]),
    ),
    scaleMatrix(scale),
  )
  return deepFreeze({ position, rotation, scale, matrix })
}

function translationMatrix([x, y, z]: Cinema2Vector3): Cinema2Matrix4 {
  return Object.freeze([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]) as Cinema2Matrix4
}

function scaleMatrix([x, y, z]: Cinema2Vector3): Cinema2Matrix4 {
  return Object.freeze([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]) as Cinema2Matrix4
}

function rotationXMatrix(radians: number): Cinema2Matrix4 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return Object.freeze([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]) as Cinema2Matrix4
}

function rotationYMatrix(radians: number): Cinema2Matrix4 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return Object.freeze([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]) as Cinema2Matrix4
}

function rotationZMatrix(radians: number): Cinema2Matrix4 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return Object.freeze([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]) as Cinema2Matrix4
}

function multiplyMatrix4(left: Cinema2Matrix4, right: Cinema2Matrix4): Cinema2Matrix4 {
  const result = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0
      for (let k = 0; k < 4; k += 1) value += left[k * 4 + row] * right[column * 4 + k]
      result[column * 4 + row] = normalizeSignedZero(value)
    }
  }
  return Object.freeze(result) as unknown as Cinema2Matrix4
}

function freezeVector3(value: Cinema2Vector3): Cinema2Vector3 {
  return Object.freeze([value[0], value[1], value[2]]) as Cinema2Vector3
}

function hasRef<T extends string>(values: ReadonlyMap<T, unknown>, id: unknown): id is T {
  return typeof id === 'string' && values.has(id as T)
}

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}

function error(code: string, message: string, path: string): Cinema2SceneGraphDiagnostic {
  return { code, message, path }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function freezeDiagnostics(diagnostics: readonly Cinema2SceneGraphDiagnostic[]): readonly Cinema2SceneGraphDiagnostic[] {
  return deepFreeze(diagnostics.map(diagnostic => ({ ...diagnostic })))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T): T {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return value
}

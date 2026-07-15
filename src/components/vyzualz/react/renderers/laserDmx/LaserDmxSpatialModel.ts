import type {
  LaserDmxShowDirectorBeamTarget,
  LaserDmxShowDirectorDepthLayer,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorFixtureKind,
} from '../../ReactTypes'

export type LaserDmxSceneDepthZoneId = Exclude<LaserDmxShowDirectorDepthLayer, 'auto'>
export type LaserDmxDepthAssignmentSource = 'explicitCoordinate' | 'explicitLayer' | 'inferred'

export interface LaserDmxSpatialVec3 {
  x: number
  y: number
  z: number
}

export interface LaserDmxSceneDepthZone {
  id: LaserDmxSceneDepthZoneId
  label: string
  centerZ: number
  minZ: number
  maxZ: number
  verticalBand: 'full' | 'upper' | 'lower'
  visible: false
}

export interface LaserDmxDepthAssignment {
  zoneId: LaserDmxSceneDepthZoneId
  z: number
  source: LaserDmxDepthAssignmentSource
  reason: string
}

export interface LaserDmxFrontLockedCameraLike {
  locked: true
  position: LaserDmxSpatialVec3
  target: LaserDmxSpatialVec3
  up: LaserDmxSpatialVec3
  fieldOfViewDeg: number
  nearClipDistance: number
  farClipDistance: number
  perspectiveStrength: number
  referenceAspectRatio: number
}

export type LaserDmxMat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]

export interface LaserDmxProjectedPoint {
  x: number
  y: number
  clipDepth: number
  cameraDepth: number
  perspectiveScale: number
  visible: boolean
}

export interface LaserDmxClippedSceneSegment {
  origin: LaserDmxSpatialVec3
  target: LaserDmxSpatialVec3
  originT: number
  targetT: number
}

export const LASER_DMX_SCENE_DEPTH_ZONES: readonly LaserDmxSceneDepthZone[] = Object.freeze([
  Object.freeze({ id: 'cameraFacingAir', label: 'Camera-Facing Air', centerZ: 0.78, minZ: 0.64, maxZ: 0.92, verticalBand: 'full', visible: false }),
  Object.freeze({ id: 'frontAir', label: 'Front Air', centerZ: 0.48, minZ: 0.28, maxZ: 0.68, verticalBand: 'full', visible: false }),
  Object.freeze({ id: 'midAir', label: 'Mid Air', centerZ: 0, minZ: -0.24, maxZ: 0.24, verticalBand: 'full', visible: false }),
  Object.freeze({ id: 'deepAir', label: 'Deep Air', centerZ: -0.52, minZ: -0.74, maxZ: -0.3, verticalBand: 'full', visible: false }),
  Object.freeze({ id: 'upperAir', label: 'Upper Air', centerZ: -0.28, minZ: -0.58, maxZ: 0.02, verticalBand: 'upper', visible: false }),
  Object.freeze({ id: 'lowerAir', label: 'Lower Air', centerZ: 0.26, minZ: 0.02, maxZ: 0.52, verticalBand: 'lower', visible: false }),
])

const ZONE_BY_ID = new Map(LASER_DMX_SCENE_DEPTH_ZONES.map(zone => [zone.id, zone]))
const EPSILON = 1e-6

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function zone(id: LaserDmxSceneDepthZoneId): LaserDmxSceneDepthZone {
  return ZONE_BY_ID.get(id) ?? LASER_DMX_SCENE_DEPTH_ZONES[2]
}

function nearestZoneId(z: number): LaserDmxSceneDepthZoneId {
  let nearest = LASER_DMX_SCENE_DEPTH_ZONES[0]
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const candidate of LASER_DMX_SCENE_DEPTH_ZONES) {
    const distance = Math.abs(candidate.centerZ - z)
    if (distance < nearestDistance) {
      nearest = candidate
      nearestDistance = distance
    }
  }
  return nearest.id
}

function normalizeSemanticText(fixture: LaserDmxShowDirectorFixture): string {
  return `${fixture.semanticKey ?? ''} ${fixture.label} ${fixture.groupId ?? ''}`.trim().toLowerCase()
}

function semanticFamily(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(left|right|outer|inner|center|centre|port|starboard)\b/g, '')
    .replace(/(^|[-_\s])(l|r)(?=$|[-_\s])/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function stableOrdinal(fixture: LaserDmxShowDirectorFixture): number {
  const family = semanticFamily(fixture.semanticKey ?? fixture.label)
  const identity = fixture.linkedPairId || family || fixture.id
  let hash = 2166136261
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hasAny(text: string, terms: readonly string[]): boolean {
  return terms.some(term => text.includes(term))
}

function assignmentForZone(
  zoneId: LaserDmxSceneDepthZoneId,
  source: LaserDmxDepthAssignmentSource,
  reason: string,
  trim = 0,
): LaserDmxDepthAssignment {
  const definition = zone(zoneId)
  return {
    zoneId,
    z: clamp(definition.centerZ + trim, -1, 1),
    source,
    reason,
  }
}

function explicitCoordinateAssignment(value: number, reason: string): LaserDmxDepthAssignment {
  const z = clamp(value, -1, 1)
  return {
    zoneId: nearestZoneId(z),
    z,
    source: 'explicitCoordinate',
    reason,
  }
}

function inferredFixtureZone(
  fixture: LaserDmxShowDirectorFixture,
  normalizedY: number,
): LaserDmxSceneDepthZoneId {
  const semantic = normalizeSemanticText(fixture)
  if (hasAny(semantic, ['low rake', 'low-rake', 'low', 'floor', 'lower'])) return 'lowerAir'
  if (hasAny(semantic, ['camera-facing', 'camera facing', 'audience rake', 'audience-rake'])) return 'cameraFacingAir'
  if (hasAny(semantic, ['front', 'rake', 'audience'])) return normalizedY > 0.62 ? 'lowerAir' : 'frontAir'
  if (hasAny(semantic, ['rear', 'back', 'diamond'])) return 'deepAir'
  if (hasAny(semantic, ['ceiling', 'canopy', 'roof', 'upper', 'sky'])) return 'upperAir'
  if (hasAny(semantic, ['corridor', 'cage', 'tunnel', 'mirror'])) {
    const sequence: readonly LaserDmxSceneDepthZoneId[] = ['frontAir', 'midAir', 'deepAir']
    return sequence[stableOrdinal(fixture) % sequence.length]
  }

  switch (fixture.kind) {
    case 'videoWall': return 'deepAir'
    case 'ledBar': return 'midAir'
    case 'ledTube': return normalizedY < 0.36 ? 'upperAir' : 'midAir'
    case 'strobe':
    case 'blinder': return 'frontAir'
    case 'parWash': return normalizedY > 0.65 ? 'lowerAir' : 'frontAir'
    case 'co2Jet': return 'lowerAir'
    case 'haze': return 'midAir'
    case 'movingHead': return normalizedY < 0.32 ? 'upperAir' : 'midAir'
    case 'laser':
    default:
      if (fixture.beam.targetMode === 'mirror' || fixture.beam.targetMode === 'cross') {
        const sequence: readonly LaserDmxSceneDepthZoneId[] = ['frontAir', 'midAir', 'deepAir']
        return sequence[stableOrdinal(fixture) % sequence.length]
      }
      return 'midAir'
  }
}

export function resolveLaserDmxFixtureDepth(
  fixture: LaserDmxShowDirectorFixture,
  normalizedY: number,
): LaserDmxDepthAssignment {
  if (fixture.depthLayer && fixture.depthLayer !== 'auto') {
    return assignmentForZone(fixture.depthLayer, 'explicitLayer', `Fixture layer is ${fixture.depthLayer}.`, finite(fixture.z) * 0.12)
  }
  if (Math.abs(finite(fixture.z)) > EPSILON) {
    return explicitCoordinateAssignment(fixture.z, 'Fixture carries an authored continuous Z coordinate.')
  }
  const zoneId = inferredFixtureZone(fixture, normalizedY)
  return assignmentForZone(zoneId, 'inferred', `Inferred ${zoneId} from fixture role, type, and authored composition.`)
}

export interface ResolveLaserDmxTargetDepthInput {
  fixture: LaserDmxShowDirectorFixture
  target: LaserDmxShowDirectorBeamTarget
  targetIndex: number
  origin: LaserDmxSpatialVec3
  normalizedTarget: Pick<LaserDmxSpatialVec3, 'x' | 'y'>
}

function inferredTargetZone(input: ResolveLaserDmxTargetDepthInput): LaserDmxSceneDepthZoneId {
  const { fixture, targetIndex, origin, normalizedTarget } = input
  const semantic = normalizeSemanticText(fixture)

  if (hasAny(semantic, ['low rake', 'low-rake', 'low', 'floor', 'lower'])) return 'lowerAir'
  if (hasAny(semantic, ['camera-facing', 'camera facing', 'audience rake', 'audience-rake'])) return 'cameraFacingAir'
  if (hasAny(semantic, ['rear', 'back', 'diamond'])) return 'deepAir'
  if (hasAny(semantic, ['ceiling', 'canopy', 'roof', 'upper', 'sky'])) return 'upperAir'

  if (fixture.beam.targetMode === 'mirror' || fixture.beam.targetMode === 'cross'
    || hasAny(semantic, ['corridor', 'cage', 'tunnel', 'mirror'])) {
    const sequence: readonly LaserDmxSceneDepthZoneId[] = ['frontAir', 'midAir', 'deepAir']
    return sequence[(stableOrdinal(fixture) + targetIndex) % sequence.length]
  }

  if (fixture.beam.targetMode === 'fan') {
    if (hasAny(semantic, ['front', 'rake', 'audience'])) return 'frontAir'
    return origin.z > 0.35 ? 'frontAir' : origin.z < -0.3 ? 'deepAir' : 'midAir'
  }

  if (fixture.kind === 'movingHead') {
    const deltaY = normalizedTarget.y - origin.y
    if (deltaY > 0.18) return 'lowerAir'
    if (deltaY < -0.18) return 'upperAir'
    return normalizedTarget.x < 0.18 || normalizedTarget.x > 0.82 ? 'deepAir' : 'midAir'
  }

  if (fixture.kind === 'videoWall') return 'deepAir'
  if (fixture.kind === 'ledBar' || fixture.kind === 'ledTube') return 'midAir'
  if (fixture.kind === 'parWash') return normalizedTarget.y > 0.62 ? 'lowerAir' : 'frontAir'
  if (fixture.kind === 'co2Jet') return 'lowerAir'
  return 'midAir'
}

export function resolveLaserDmxTargetDepth(input: ResolveLaserDmxTargetDepthInput): LaserDmxDepthAssignment {
  const { fixture, target } = input
  if (target.depthLayer && target.depthLayer !== 'auto') {
    return assignmentForZone(target.depthLayer, 'explicitLayer', `Beam target layer is ${target.depthLayer}.`, finite(target.z) * 0.12)
  }
  if (target.z != null) {
    return explicitCoordinateAssignment(target.z, 'Beam target carries an authored continuous Z coordinate.')
  }
  if (fixture.beam.targetDepthLayer && fixture.beam.targetDepthLayer !== 'auto') {
    return assignmentForZone(
      fixture.beam.targetDepthLayer,
      'explicitLayer',
      `Fixture target layer is ${fixture.beam.targetDepthLayer}.`,
      finite(fixture.beam.targetZ) * 0.12,
    )
  }
  if (Math.abs(finite(fixture.beam.targetZ)) > EPSILON) {
    return explicitCoordinateAssignment(fixture.beam.targetZ ?? 0, 'Fixture beam carries an authored target Z coordinate.')
  }
  const zoneId = inferredTargetZone(input)
  return assignmentForZone(zoneId, 'inferred', `Inferred ${zoneId} from target mode, fixture role, and beam direction.`)
}

export function normalizeLaserDmxDirection(origin: LaserDmxSpatialVec3, target: LaserDmxSpatialVec3): LaserDmxSpatialVec3 {
  const x = target.x - origin.x
  const y = target.y - origin.y
  const z = target.z - origin.z
  const length = Math.hypot(x, y, z)
  if (length <= EPSILON) return { x: 0, y: 0, z: -1 }
  return { x: x / length, y: y / length, z: z / length }
}

export function resolveLaserDmxFixtureOrientation(
  fixture: Pick<LaserDmxShowDirectorFixture, 'rotation'>,
  origin: LaserDmxSpatialVec3,
  primaryTarget?: LaserDmxSpatialVec3,
): LaserDmxSpatialVec3 {
  if (primaryTarget) return normalizeLaserDmxDirection(origin, primaryTarget)
  const radians = finite(fixture.rotation) * Math.PI / 180
  return { x: Math.cos(radians), y: Math.sin(radians), z: 0 }
}

export function resolveLaserDmxDepthRange(origin: LaserDmxSpatialVec3, target: LaserDmxSpatialVec3): { minZ: number; maxZ: number } {
  return { minZ: Math.min(origin.z, target.z), maxZ: Math.max(origin.z, target.z) }
}

function subtract(a: LaserDmxSpatialVec3, b: LaserDmxSpatialVec3): LaserDmxSpatialVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: LaserDmxSpatialVec3, b: LaserDmxSpatialVec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: LaserDmxSpatialVec3, b: LaserDmxSpatialVec3): LaserDmxSpatialVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function normalize(value: LaserDmxSpatialVec3, fallback: LaserDmxSpatialVec3): LaserDmxSpatialVec3 {
  const length = Math.hypot(value.x, value.y, value.z)
  if (!Number.isFinite(length) || length <= EPSILON) return fallback
  return { x: value.x / length, y: value.y / length, z: value.z / length }
}

function multiplyMat4(a: LaserDmxMat4, b: LaserDmxMat4): LaserDmxMat4 {
  const out = new Array<number>(16).fill(0)
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let value = 0
      for (let index = 0; index < 4; index += 1) {
        value += a[row * 4 + index] * b[index * 4 + column]
      }
      out[row * 4 + column] = value
    }
  }
  return out as unknown as LaserDmxMat4
}

function transformMat4(matrix: LaserDmxMat4, point: LaserDmxSpatialVec3): [number, number, number, number] {
  return [
    matrix[0] * point.x + matrix[1] * point.y + matrix[2] * point.z + matrix[3],
    matrix[4] * point.x + matrix[5] * point.y + matrix[6] * point.z + matrix[7],
    matrix[8] * point.x + matrix[9] * point.y + matrix[10] * point.z + matrix[11],
    matrix[12] * point.x + matrix[13] * point.y + matrix[14] * point.z + matrix[15],
  ]
}

function cameraBasis(camera: LaserDmxFrontLockedCameraLike): {
  forward: LaserDmxSpatialVec3
  right: LaserDmxSpatialVec3
  up: LaserDmxSpatialVec3
} {
  const forward = normalize(subtract(camera.target, camera.position), { x: 0, y: 0, z: -1 })
  const right = normalize(cross(forward, camera.up), { x: 1, y: 0, z: 0 })
  return {
    forward,
    right,
    up: normalize(cross(right, forward), { x: 0, y: 1, z: 0 }),
  }
}

export function createLaserDmxViewMatrix(camera: LaserDmxFrontLockedCameraLike): LaserDmxMat4 {
  const basis = cameraBasis(camera)
  return [
    basis.right.x, basis.right.y, basis.right.z, -dot(basis.right, camera.position),
    basis.up.x, basis.up.y, basis.up.z, -dot(basis.up, camera.position),
    -basis.forward.x, -basis.forward.y, -basis.forward.z, dot(basis.forward, camera.position),
    0, 0, 0, 1,
  ]
}

function createAspectModelMatrix(aspectRatio: number): LaserDmxMat4 {
  const aspect = clamp(aspectRatio, 0.5, 4)
  return [
    aspect, 0, 0, 0.5 * (1 - aspect),
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]
}

function cameraFocusDepth(camera: LaserDmxFrontLockedCameraLike): number {
  const view = createLaserDmxViewMatrix(camera)
  const target = transformMat4(view, camera.target)
  return Math.max(EPSILON, -target[2])
}

export function createLaserDmxPerspectiveProjectionMatrix(
  camera: LaserDmxFrontLockedCameraLike,
  aspectRatio = camera.referenceAspectRatio,
): LaserDmxMat4 {
  const aspect = clamp(aspectRatio, 0.5, 4)
  const near = Math.max(EPSILON, Math.min(camera.nearClipDistance, camera.farClipDistance - EPSILON))
  const far = Math.max(near + EPSILON, camera.farClipDistance)
  const f = 1 / Math.tan(clamp(camera.fieldOfViewDeg, 5, 80) * Math.PI / 360)
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), (2 * far * near) / (near - far),
    0, 0, -1, 0,
  ]
}

export function createLaserDmxOrthographicProjectionMatrix(
  camera: LaserDmxFrontLockedCameraLike,
  aspectRatio = camera.referenceAspectRatio,
): LaserDmxMat4 {
  const aspect = clamp(aspectRatio, 0.5, 4)
  const near = Math.max(EPSILON, Math.min(camera.nearClipDistance, camera.farClipDistance - EPSILON))
  const far = Math.max(near + EPSILON, camera.farClipDistance)
  const halfHeight = Math.max(0.01, Math.tan(clamp(camera.fieldOfViewDeg, 5, 80) * Math.PI / 360) * cameraFocusDepth(camera))
  const halfWidth = halfHeight * aspect
  return [
    1 / halfWidth, 0, 0, 0,
    0, 1 / halfHeight, 0, 0,
    0, 0, -2 / (far - near), -(far + near) / (far - near),
    0, 0, 0, 1,
  ]
}

export function laserDmxCameraDepth(
  camera: LaserDmxFrontLockedCameraLike,
  point: LaserDmxSpatialVec3,
): number {
  return dot(cameraBasis(camera).forward, subtract(point, camera.position))
}

function projectWithMatrix(matrix: LaserDmxMat4, point: LaserDmxSpatialVec3): { x: number; y: number; z: number; valid: boolean } {
  const [x, y, z, w] = transformMat4(matrix, point)
  if (!Number.isFinite(w) || Math.abs(w) <= EPSILON) return { x: 0, y: 0, z: 1, valid: false }
  const invW = 1 / w
  const projected = { x: x * invW, y: y * invW, z: z * invW, valid: true }
  projected.valid = Number.isFinite(projected.x) && Number.isFinite(projected.y) && Number.isFinite(projected.z)
  return projected
}

export function projectLaserDmxScenePoint(
  camera: LaserDmxFrontLockedCameraLike,
  point: LaserDmxSpatialVec3,
  aspectRatio = camera.referenceAspectRatio,
): LaserDmxProjectedPoint {
  const aspect = clamp(aspectRatio, 0.5, 4)
  const model = createAspectModelMatrix(aspect)
  const viewModel = multiplyMat4(createLaserDmxViewMatrix(camera), model)
  const perspective = projectWithMatrix(
    multiplyMat4(createLaserDmxPerspectiveProjectionMatrix(camera, aspect), viewModel),
    point,
  )
  const orthographic = projectWithMatrix(
    multiplyMat4(createLaserDmxOrthographicProjectionMatrix(camera, aspect), viewModel),
    point,
  )
  const blend = clamp(camera.perspectiveStrength, 0, 1)
  const cameraDepth = laserDmxCameraDepth(camera, point)
  const focusDepth = cameraFocusDepth(camera)
  const perspectiveScale = clamp((1 - blend) + blend * focusDepth / Math.max(EPSILON, cameraDepth), 0.5, 2)
  const ndcX = orthographic.x + (perspective.x - orthographic.x) * blend
  const ndcY = orthographic.y + (perspective.y - orthographic.y) * blend
  const clipDepth = orthographic.z + (perspective.z - orthographic.z) * blend
  const depthVisible = cameraDepth >= camera.nearClipDistance - EPSILON
    && cameraDepth <= camera.farClipDistance + EPSILON
  const valid = orthographic.valid && perspective.valid
    && Number.isFinite(ndcX) && Number.isFinite(ndcY) && Number.isFinite(clipDepth)
  return {
    x: valid ? 0.5 + ndcX * 0.5 : 0.5,
    y: valid ? 0.5 + ndcY * 0.5 : 0.5,
    clipDepth: valid ? clamp(clipDepth, -1, 1) : 1,
    cameraDepth,
    perspectiveScale,
    visible: valid && depthVisible,
  }
}

function interpolatePoint(a: LaserDmxSpatialVec3, b: LaserDmxSpatialVec3, t: number): LaserDmxSpatialVec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

/** Clips a scene segment against the locked camera's true near and far planes. */
export function clipLaserDmxSceneSegment(
  camera: LaserDmxFrontLockedCameraLike,
  origin: LaserDmxSpatialVec3,
  target: LaserDmxSpatialVec3,
): LaserDmxClippedSceneSegment | null {
  const originDepth = laserDmxCameraDepth(camera, origin)
  const targetDepth = laserDmxCameraDepth(camera, target)
  if (!Number.isFinite(originDepth) || !Number.isFinite(targetDepth)) return null
  const delta = targetDepth - originDepth
  let originT = 0
  let targetT = 1

  const clipLower = (minimum: number): boolean => {
    if (originDepth >= minimum && targetDepth >= minimum) return true
    if (originDepth < minimum && targetDepth < minimum) return false
    if (Math.abs(delta) <= EPSILON) return false
    const t = clamp((minimum - originDepth) / delta, 0, 1)
    if (originDepth < minimum) originT = Math.max(originT, t)
    else targetT = Math.min(targetT, t)
    return originT <= targetT + EPSILON
  }
  const clipUpper = (maximum: number): boolean => {
    if (originDepth <= maximum && targetDepth <= maximum) return true
    if (originDepth > maximum && targetDepth > maximum) return false
    if (Math.abs(delta) <= EPSILON) return false
    const t = clamp((maximum - originDepth) / delta, 0, 1)
    if (originDepth > maximum) originT = Math.max(originT, t)
    else targetT = Math.min(targetT, t)
    return originT <= targetT + EPSILON
  }

  if (!clipLower(camera.nearClipDistance) || !clipUpper(camera.farClipDistance)) return null
  return {
    origin: interpolatePoint(origin, target, originT),
    target: interpolatePoint(origin, target, targetT),
    originT,
    targetT,
  }
}

export function laserDmxDepthSegmentVisible(
  camera: LaserDmxFrontLockedCameraLike,
  minZ: number,
  maxZ: number,
): boolean {
  const center = { x: 0.5, y: 0.5 }
  return clipLaserDmxSceneSegment(camera, { ...center, z: minZ }, { ...center, z: maxZ }) != null
}

export function laserDmxDepthSortValue(origin: LaserDmxSpatialVec3, target: LaserDmxSpatialVec3): number {
  return (origin.z + target.z) * 0.5
}

export function stableLaserDmxDepthOrder<T extends { id: string; sortDepth: number }>(
  items: readonly T[],
  direction: 'frontToBack' | 'backToFront',
): string[] {
  return [...items]
    .sort((a, b) => {
      const depthDelta = direction === 'frontToBack' ? b.sortDepth - a.sortDepth : a.sortDepth - b.sortDepth
      return Math.abs(depthDelta) > EPSILON ? depthDelta : a.id.localeCompare(b.id)
    })
    .map(item => item.id)
}

export function fixtureKindHasStableStagePlane(kind: LaserDmxShowDirectorFixtureKind): boolean {
  return kind === 'ledBar' || kind === 'ledTube' || kind === 'videoWall'
}

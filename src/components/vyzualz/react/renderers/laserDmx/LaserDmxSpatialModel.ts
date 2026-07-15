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
  nearClipZ: number
  farClipZ: number
  depthParallax: number
}

export interface LaserDmxProjectedPoint {
  x: number
  y: number
  clipDepth: number
  visible: boolean
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

export function projectLaserDmxScenePoint(
  camera: LaserDmxFrontLockedCameraLike,
  point: LaserDmxSpatialVec3,
): LaserDmxProjectedPoint {
  const near = Math.max(camera.nearClipZ, camera.farClipZ + EPSILON)
  const far = Math.min(camera.farClipZ, near - EPSILON)
  const depthUnit = clamp((point.z - far) / (near - far), 0, 1)
  return {
    x: point.x,
    y: point.y + point.z * camera.depthParallax,
    clipDepth: 1 - depthUnit * 2,
    visible: point.z <= near + EPSILON && point.z >= far - EPSILON,
  }
}

export function laserDmxDepthSegmentVisible(
  camera: LaserDmxFrontLockedCameraLike,
  minZ: number,
  maxZ: number,
): boolean {
  return maxZ >= camera.farClipZ && minZ <= camera.nearClipZ
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

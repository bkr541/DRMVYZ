/**
 * LaserDMX production-rig domain and compatibility foundation.
 *
 * This module deliberately keeps hardware transmission out of scope. It owns
 * serializable rig contracts, capability declarations, fixture-profile
 * validation, legacy Spatial Fixtures normalization, deterministic
 * serialization, and the virtual output contract consumed by the renderer.
 */

import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxFixture,
  LaserDmxFixtureFrame,
  LaserDmxProfileId,
  LaserDmxSettings,
} from './ReactTypes'

export const LASER_DMX_SETTINGS_SCHEMA_VERSION = 1
export const LASER_DMX_FIXTURE_SCHEMA_VERSION = 1
export const LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION = 1
export const LASER_DMX_PRODUCTION_RIG_SCHEMA_VERSION = 2
export const LASER_DMX_STAGE_SCHEMA_VERSION = 1

export type ProductionFixtureKind =
  | 'laserProjector'
  | 'movingHeadBeam'
  | 'movingHeadSpot'
  | 'movingHeadWash'
  | 'strobe'
  | 'blinder'
  | 'ledBar'
  | 'hazer'
  | 'fogger'
  | 'cryoJet'

export type ProductionColorSystem =
  | { mode: 'rgb' }
  | { mode: 'rgbw' }
  | { mode: 'colorWheel'; slots: readonly string[] }
  | { mode: 'fixedWhite'; colorTemperatureKelvin?: number }

export interface ProductionPanTiltCapability {
  panRangeDeg: number
  tiltRangeDeg: number
  continuousPan?: boolean
  continuousTilt?: boolean
}

export interface ProductionRangeCapability {
  min: number
  max: number
}

export interface ProductionAtmosphericCapability {
  medium: 'haze' | 'fog' | 'cryo'
  variableOutput: boolean
}

export interface ProductionTriggerCapability {
  momentary: boolean
  cooldownMs: number
}

/**
 * A fixture exposes only the controls declared here. UI and renderer code must
 * query this contract instead of inferring behavior from the fixture kind.
 */
export interface ProductionFixtureCapabilities {
  color?: ProductionColorSystem
  dimmer?: true
  shutter?: true
  strobe?: ProductionRangeCapability
  panTilt?: ProductionPanTiltCapability
  zoom?: ProductionRangeCapability
  focus?: ProductionRangeCapability
  iris?: ProductionRangeCapability
  gobo?: { slots: readonly string[]; rotation?: boolean }
  prism?: { facets: readonly number[]; rotation?: boolean }
  frost?: ProductionRangeCapability
  beamPattern?: { programmable: boolean; patternIds?: readonly string[] }
  atmosphericOutput?: ProductionAtmosphericCapability
  trigger?: ProductionTriggerCapability
}

export type ProductionFixtureCapabilityOverride = Partial<ProductionFixtureCapabilities>

export interface ProductionStageVector3 {
  x: number
  y: number
  z: number
}

export interface ProductionStageOrientation {
  /** Canonical aerospace-style rotations in degrees. */
  yawDeg: number
  pitchDeg: number
  rollDeg: number
  /** Compatibility aliases retained for Patch 1 consumers. */
  panDeg: number
  tiltDeg: number
}

export interface ProductionStageTransform {
  position: ProductionStageVector3
  orientation: ProductionStageOrientation
}

/**
 * Coordinate convention used by every spatial rig helper and renderer:
 * - origin: centre of the downstage floor edge
 * - +X: stage right from the performer's perspective
 * - +Y: upward
 * - +Z: upstage, away from the audience
 * - audience locations normally use negative Z
 * - yaw rotates around +Y, pitch around +X, roll around +Z
 * Units are metres and angles are degrees.
 */
export const PRODUCTION_STAGE_COORDINATE_CONVENTION = 'centerDownstageFloor+xStageRight+yUp+zUpstage' as const
export type ProductionStageOriginConvention = typeof PRODUCTION_STAGE_COORDINATE_CONVENTION

export interface ProductionStageDimensions {
  width: number
  height: number
  depth: number
}

export interface ProductionFloorPlane {
  enabled: boolean
  elevation: number
  width: number
  depth: number
}

export interface ProductionAudienceRegion {
  enabled: boolean
  center: ProductionStageVector3
  size: ProductionStageVector3
}

export interface ProductionMountingSurface {
  id: string
  name: string
  kind: 'trussLine' | 'mountingPlane'
  start: ProductionStageVector3
  end: ProductionStageVector3
  width?: number
  height?: number
}

export interface ProductionCameraView {
  id: string
  name: string
  position: ProductionStageVector3
  target: ProductionStageVector3
  fieldOfViewDeg: number
  near: number
  far: number
}

export interface ProductionSpatialZone {
  id: string
  name: string
  kind: 'safe' | 'excluded'
  shape: 'box' | 'sphere'
  center: ProductionStageVector3
  size: ProductionStageVector3
}

export type ProductionRenderQualityTier = 'low' | 'medium' | 'high'

export interface ProductionStageModel {
  schemaVersion: number
  originConvention: ProductionStageOriginConvention
  dimensions: ProductionStageDimensions
  floor: ProductionFloorPlane
  audience: ProductionAudienceRegion
  mountingSurfaces: ProductionMountingSurface[]
  camera: ProductionCameraView
  savedCameraViews: ProductionCameraView[]
  activeCameraViewId: string
  spatialZones: ProductionSpatialZone[]
  editor: {
    guidesVisible: boolean
    qualityTier: ProductionRenderQualityTier
  }
}

export interface ProductionVenueTemplate {
  id: 'compactClub' | 'mediumStage' | 'wideFestivalStage'
  label: string
  description: string
  stage: ProductionStageModel
  targets: ProductionTarget[]
}

export interface ProductionTargetPoint {
  id: string
  name: string
  kind: 'point'
  position: ProductionStageVector3
}

export interface ProductionTargetZone {
  id: string
  name: string
  kind: 'zone'
  shape: 'box' | 'sphere' | 'plane'
  center: ProductionStageVector3
  size: ProductionStageVector3
}

export type ProductionTarget = ProductionTargetPoint | ProductionTargetZone

export interface ProductionColorState {
  red?: number
  green?: number
  blue?: number
  white?: number
  wheelSlot?: number
  fixedWhiteIntensity?: number
}

/** Capability-keyed state. Unsupported properties remain absent. */
export interface ProductionFixturePropertyState {
  dimmer?: number
  shutterOpen?: boolean
  strobeRate?: number
  color?: ProductionColorState
  panDeg?: number
  tiltDeg?: number
  zoom?: number
  focus?: number
  iris?: number
  goboIndex?: number
  goboRotation?: number
  prismFacets?: number
  prismRotation?: number
  frost?: number
  beamPatternId?: string
  atmosphericOutput?: number
  triggered?: boolean
}

export interface ProductionFixtureInstance {
  schemaVersion: number
  id: string
  name: string
  enabled: boolean
  kind: ProductionFixtureKind
  profileId: string
  groupIds: string[]
  transform: ProductionStageTransform
  targetId: string | null
  properties: ProductionFixturePropertyState
  capabilityOverrides?: ProductionFixtureCapabilityOverride
  compatibility?: {
    source: 'laserDmxSpatialFixtures' | 'productionRig'
    sourceSchemaVersion?: number
    validationErrors?: string[]
  }
}

export interface ProductionFixtureGroup {
  id: string
  name: string
  fixtureIds: string[]
  parentGroupId?: string | null
  tags?: string[]
}

export interface ProductionLookFixtureState {
  fixtureId: string
  properties: ProductionFixturePropertyState
  transitionMs?: number
}

export interface ProductionLook {
  id: string
  name: string
  description?: string
  fixtureStates: ProductionLookFixtureState[]
  groupStates?: Array<{
    groupId: string
    properties: ProductionFixturePropertyState
    transitionMs?: number
  }>
}

export type ProductionCueAction =
  | { type: 'activateLook'; lookId: string; transitionMs?: number }
  | { type: 'setFixtureProperties'; fixtureId: string; properties: ProductionFixturePropertyState; transitionMs?: number }
  | { type: 'setGroupProperties'; groupId: string; properties: ProductionFixturePropertyState; transitionMs?: number }
  | { type: 'triggerFixture'; fixtureId: string; intensity?: number }
  | { type: 'blackout'; enabled: boolean }
  | { type: 'wait'; durationMs: number }

export interface ProductionCompoundCue {
  id: string
  name: string
  enabled: boolean
  actions: ProductionCueAction[]
  quantize?: 'none' | 'beat' | 'bar' | 'phrase'
}

export interface ProductionRendererCapabilities {
  id: string
  virtualOnly: boolean
  fixtureKinds: readonly ProductionFixtureKind[]
  supportsBeamPaths: boolean
  supportsVolumetrics: boolean
  supportsAtmospherics: boolean
  supportsCompoundCues: boolean
  supportsHardwareOutput: boolean
}

export interface ProductionOutputAdapterCapabilities {
  id: string
  label: string
  adapterKind: 'virtualRenderer' | 'hardwareDmx'
  enabled: boolean
  canTransmit: boolean
  transports: readonly ('none' | 'artNet' | 'sacn' | 'usbDmx')[]
  fixtureKinds: readonly ProductionFixtureKind[]
}

export interface ProductionFixtureOutputFrame {
  fixtureId: string
  profileId: string
  fixtureKind: ProductionFixtureKind
  channels: Record<string, number>
  visual?: LaserDmxFixtureFrame['visual']
}

export interface ProductionOutputFrame {
  schemaVersion: number
  rigId: string
  timestampSec: number
  rendererId: string
  adapterId: string
  fixtures: ProductionFixtureOutputFrame[]
}

export interface ProductionRig {
  schemaVersion: number
  id: string
  name: string
  stage: ProductionStageModel
  fixtures: ProductionFixtureInstance[]
  groups: ProductionFixtureGroup[]
  targets: ProductionTarget[]
  looks: ProductionLook[]
  cues: ProductionCompoundCue[]
  rendererCapabilities: ProductionRendererCapabilities
  outputAdapterCapabilities: ProductionOutputAdapterCapabilities
}

const DEFAULT_CAMERA_VIEW_ID = 'camera:front-house'

function cloneStageVector(value: ProductionStageVector3): ProductionStageVector3 {
  return { x: value.x, y: value.y, z: value.z }
}

function makeCameraView(
  id: string,
  name: string,
  position: ProductionStageVector3,
  target: ProductionStageVector3,
  fieldOfViewDeg = 48,
): ProductionCameraView {
  return { id, name, position, target, fieldOfViewDeg, near: 0.1, far: 250 }
}

export function createDefaultProductionStageModel(): ProductionStageModel {
  const front = makeCameraView(DEFAULT_CAMERA_VIEW_ID, 'Front of House', { x: 0, y: 5.5, z: -17 }, { x: 0, y: 3.2, z: 4 })
  const booth = makeCameraView('camera:booth', 'DJ Booth', { x: 0, y: 2.1, z: 1.1 }, { x: 0, y: 2.4, z: 7 }, 62)
  const left = makeCameraView('camera:left-wing', 'Stage Left Wing', { x: -8.5, y: 4.2, z: 1 }, { x: 0, y: 3, z: 4.5 }, 55)
  return {
    schemaVersion: LASER_DMX_STAGE_SCHEMA_VERSION,
    originConvention: PRODUCTION_STAGE_COORDINATE_CONVENTION,
    dimensions: { width: 14, height: 8, depth: 9 },
    floor: { enabled: true, elevation: 0, width: 14, depth: 9 },
    audience: { enabled: true, center: { x: 0, y: 0, z: -8 }, size: { x: 18, y: 0.1, z: 14 } },
    mountingSurfaces: [
      { id: 'truss:front', name: 'Front Truss', kind: 'trussLine', start: { x: -6, y: 6.5, z: 1.5 }, end: { x: 6, y: 6.5, z: 1.5 } },
      { id: 'truss:rear', name: 'Rear Truss', kind: 'trussLine', start: { x: -6, y: 6.5, z: 7.5 }, end: { x: 6, y: 6.5, z: 7.5 } },
    ],
    camera: front,
    savedCameraViews: [front, booth, left],
    activeCameraViewId: front.id,
    spatialZones: [
      { id: 'zone:audience-safe', name: 'Audience safe volume', kind: 'safe', shape: 'box', center: { x: 0, y: 1.5, z: -5 }, size: { x: 16, y: 3, z: 8 } },
    ],
    editor: { guidesVisible: true, qualityTier: 'high' },
  }
}

function normalizeStageVector(raw: unknown, fallback: ProductionStageVector3): ProductionStageVector3 {
  const value = isRecord(raw) ? raw : {}
  return {
    x: finiteOr(value.x, fallback.x),
    y: finiteOr(value.y, fallback.y),
    z: finiteOr(value.z, fallback.z),
  }
}

function normalizeCameraView(raw: unknown, fallback: ProductionCameraView): ProductionCameraView {
  const value = isRecord(raw) ? raw : {}
  return {
    ...fallback,
    ...value,
    id: stringOr(value.id, fallback.id),
    name: stringOr(value.name, fallback.name),
    position: normalizeStageVector(value.position, fallback.position),
    target: normalizeStageVector(value.target, fallback.target),
    fieldOfViewDeg: Math.max(10, Math.min(120, finiteOr(value.fieldOfViewDeg, fallback.fieldOfViewDeg))),
    near: Math.max(0.01, finiteOr(value.near, fallback.near)),
    far: Math.max(1, finiteOr(value.far, fallback.far)),
  }
}

export function normalizeProductionStageModel(raw: unknown): ProductionStageModel {
  const fallback = createDefaultProductionStageModel()
  if (!isRecord(raw)) return fallback
  const dimensions = isRecord(raw.dimensions) ? raw.dimensions : {}
  const floor = isRecord(raw.floor) ? raw.floor : {}
  const audience = isRecord(raw.audience) ? raw.audience : {}
  const editor = isRecord(raw.editor) ? raw.editor : {}
  const savedRaw = Array.isArray(raw.savedCameraViews) ? raw.savedCameraViews : []
  const savedCameraViews = savedRaw.length > 0
    ? savedRaw.map((view, index) => normalizeCameraView(view, fallback.savedCameraViews[index] ?? fallback.camera))
    : fallback.savedCameraViews.map(view => ({ ...view, position: cloneStageVector(view.position), target: cloneStageVector(view.target) }))
  const requestedActive = stringOr(raw.activeCameraViewId, fallback.activeCameraViewId)
  const activeCameraViewId = savedCameraViews.some(view => view.id === requestedActive)
    ? requestedActive
    : savedCameraViews[0]?.id ?? fallback.activeCameraViewId
  const active = savedCameraViews.find(view => view.id === activeCameraViewId) ?? fallback.camera
  return {
    ...fallback,
    ...raw,
    schemaVersion: LASER_DMX_STAGE_SCHEMA_VERSION,
    originConvention: PRODUCTION_STAGE_COORDINATE_CONVENTION,
    dimensions: {
      width: Math.max(1, finiteOr(dimensions.width, fallback.dimensions.width)),
      height: Math.max(1, finiteOr(dimensions.height, fallback.dimensions.height)),
      depth: Math.max(1, finiteOr(dimensions.depth, fallback.dimensions.depth)),
    },
    floor: {
      ...fallback.floor,
      ...floor,
      enabled: booleanOr(floor.enabled, fallback.floor.enabled),
      elevation: finiteOr(floor.elevation, fallback.floor.elevation),
      width: Math.max(1, finiteOr(floor.width, finiteOr(dimensions.width, fallback.floor.width))),
      depth: Math.max(1, finiteOr(floor.depth, finiteOr(dimensions.depth, fallback.floor.depth))),
    },
    audience: {
      ...fallback.audience,
      ...audience,
      enabled: booleanOr(audience.enabled, fallback.audience.enabled),
      center: normalizeStageVector(audience.center, fallback.audience.center),
      size: normalizeStageVector(audience.size, fallback.audience.size),
    },
    mountingSurfaces: (Array.isArray(raw.mountingSurfaces) ? raw.mountingSurfaces : fallback.mountingSurfaces).map((surface, index) => {
      const value = isRecord(surface) ? surface : {}
      const base = fallback.mountingSurfaces[index] ?? fallback.mountingSurfaces[0]
      return {
        ...base,
        ...value,
        id: stringOr(value.id, `mount:${index + 1}`),
        name: stringOr(value.name, `Mount ${index + 1}`),
        kind: value.kind === 'mountingPlane' ? 'mountingPlane' as const : 'trussLine' as const,
        start: normalizeStageVector(value.start, base.start),
        end: normalizeStageVector(value.end, base.end),
        ...(isFiniteNumber(value.width) ? { width: Math.max(0, value.width) } : {}),
        ...(isFiniteNumber(value.height) ? { height: Math.max(0, value.height) } : {}),
      }
    }),
    camera: normalizeCameraView(raw.camera, active),
    savedCameraViews,
    activeCameraViewId,
    spatialZones: (Array.isArray(raw.spatialZones) ? raw.spatialZones : fallback.spatialZones).map((zone, index) => {
      const value = isRecord(zone) ? zone : {}
      const size = normalizeStageVector(value.size, { x: 1, y: 1, z: 1 })
      return {
        id: stringOr(value.id, `zone:${index + 1}`),
        name: stringOr(value.name, `Zone ${index + 1}`),
        kind: value.kind === 'excluded' ? 'excluded' as const : 'safe' as const,
        shape: value.shape === 'sphere' ? 'sphere' as const : 'box' as const,
        center: normalizeStageVector(value.center, { x: 0, y: 0, z: 0 }),
        size: { x: Math.max(0.01, Math.abs(size.x)), y: Math.max(0.01, Math.abs(size.y)), z: Math.max(0.01, Math.abs(size.z)) },
      }
    }),
    editor: {
      guidesVisible: booleanOr(editor.guidesVisible, fallback.editor.guidesVisible),
      qualityTier: editor.qualityTier === 'low' || editor.qualityTier === 'medium' ? editor.qualityTier : 'high',
    },
  }
}

export function setActiveProductionCameraView(stageInput: unknown, cameraViewId: string): ProductionStageModel {
  const stage = normalizeProductionStageModel(stageInput)
  const view = stage.savedCameraViews.find(candidate => candidate.id === cameraViewId)
  if (!view) return stage
  return { ...stage, activeCameraViewId: view.id, camera: { ...view, position: cloneStageVector(view.position), target: cloneStageVector(view.target) } }
}

export function legacyNormalizedToStageVector(
  point: { x: number; y: number; z: number },
  stageInput: unknown,
): ProductionStageVector3 {
  const stage = normalizeProductionStageModel(stageInput)
  return {
    x: (finiteOr(point.x, 0.5) - 0.5) * stage.dimensions.width,
    y: (1 - finiteOr(point.y, 0.5)) * stage.dimensions.height,
    z: ((finiteOr(point.z, 0) + 1) * 0.5) * stage.dimensions.depth,
  }
}

export function stageVectorToLegacyNormalized(
  point: ProductionStageVector3,
  stageInput: unknown,
): ProductionStageVector3 {
  const stage = normalizeProductionStageModel(stageInput)
  return {
    x: point.x / stage.dimensions.width + 0.5,
    y: 1 - point.y / stage.dimensions.height,
    z: point.z / stage.dimensions.depth * 2 - 1,
  }
}

export function normalizeProductionStageTransform(raw: unknown, fallback: ProductionStageTransform): ProductionStageTransform {
  const value = isRecord(raw) ? raw : {}
  const orientation = isRecord(value.orientation) ? value.orientation : {}
  const yawDeg = finiteOr(orientation.yawDeg, finiteOr(orientation.panDeg, fallback.orientation.yawDeg))
  const pitchDeg = finiteOr(orientation.pitchDeg, finiteOr(orientation.tiltDeg, fallback.orientation.pitchDeg))
  return {
    position: normalizeStageVector(value.position, fallback.position),
    orientation: {
      yawDeg,
      pitchDeg,
      rollDeg: finiteOr(orientation.rollDeg, fallback.orientation.rollDeg),
      panDeg: yawDeg,
      tiltDeg: pitchDeg,
    },
  }
}

export function resolveLaserDmxFixtureStageTransform(
  fixture: LaserDmxFixture,
  stageInput: unknown,
): ProductionStageTransform {
  const fallback: ProductionStageTransform = {
    position: legacyNormalizedToStageVector({
      x: fixture.position.originX,
      y: fixture.position.originY,
      z: fixture.position.originZ,
    }, stageInput),
    orientation: {
      yawDeg: fixture.position.pan,
      pitchDeg: fixture.position.tilt,
      rollDeg: fixture.position.rotation,
      panDeg: fixture.position.pan,
      tiltDeg: fixture.position.tilt,
    },
  }
  return normalizeProductionStageTransform(fixture.stageTransform, fallback)
}

function createVenueStage(
  dimensions: ProductionStageDimensions,
  cameraZ: number,
  trussY: number,
): ProductionStageModel {
  const base = createDefaultProductionStageModel()
  const front = makeCameraView(DEFAULT_CAMERA_VIEW_ID, 'Front of House', { x: 0, y: dimensions.height * 0.62, z: cameraZ }, { x: 0, y: dimensions.height * 0.38, z: dimensions.depth * 0.48 })
  const widthInset = dimensions.width * 0.42
  const rearZ = dimensions.depth * 0.82
  return normalizeProductionStageModel({
    ...base,
    dimensions,
    floor: { ...base.floor, width: dimensions.width, depth: dimensions.depth },
    audience: { ...base.audience, center: { x: 0, y: 0, z: cameraZ * 0.48 }, size: { x: dimensions.width * 1.4, y: 0.1, z: Math.abs(cameraZ) * 0.9 } },
    mountingSurfaces: [
      { id: 'truss:front', name: 'Front Truss', kind: 'trussLine', start: { x: -widthInset, y: trussY, z: dimensions.depth * 0.18 }, end: { x: widthInset, y: trussY, z: dimensions.depth * 0.18 } },
      { id: 'truss:rear', name: 'Rear Truss', kind: 'trussLine', start: { x: -widthInset, y: trussY, z: rearZ }, end: { x: widthInset, y: trussY, z: rearZ } },
    ],
    camera: front,
    savedCameraViews: [
      front,
      makeCameraView('camera:booth', 'DJ Booth', { x: 0, y: 2.1, z: dimensions.depth * 0.18 }, { x: 0, y: dimensions.height * 0.35, z: dimensions.depth * 0.9 }, 62),
      makeCameraView('camera:left-wing', 'Stage Left Wing', { x: -dimensions.width * 0.64, y: dimensions.height * 0.48, z: dimensions.depth * 0.25 }, { x: 0, y: dimensions.height * 0.4, z: dimensions.depth * 0.55 }, 55),
    ],
    activeCameraViewId: front.id,
    spatialZones: [
      { id: 'zone:audience-safe', name: 'Audience safe volume', kind: 'safe', shape: 'box', center: { x: 0, y: 1.5, z: -Math.abs(cameraZ) * 0.28 }, size: { x: dimensions.width * 1.25, y: 3, z: Math.abs(cameraZ) * 0.45 } },
      { id: 'zone:performer-exclusion', name: 'Performer exclusion', kind: 'excluded', shape: 'box', center: { x: 0, y: 1.2, z: dimensions.depth * 0.32 }, size: { x: dimensions.width * 0.32, y: 2.4, z: dimensions.depth * 0.22 } },
    ],
  })
}

function createVenueTargets(dimensions: ProductionStageDimensions): ProductionTarget[] {
  return [
    { id: 'target:center-stage', name: 'Center Stage', kind: 'point', position: { x: 0, y: dimensions.height * 0.32, z: dimensions.depth * 0.48 } },
    { id: 'target:dance-floor', name: 'Dance Floor', kind: 'zone', shape: 'box', center: { x: 0, y: 1.4, z: -dimensions.depth * 0.28 }, size: { x: dimensions.width * 0.8, y: 2.8, z: dimensions.depth * 0.45 } },
    { id: 'target:stage-fan', name: 'Stage Fan', kind: 'zone', shape: 'plane', center: { x: 0, y: dimensions.height * 0.44, z: dimensions.depth * 0.7 }, size: { x: dimensions.width * 0.85, y: dimensions.height * 0.55, z: 0.1 } },
  ]
}

export const PRODUCTION_VENUE_TEMPLATES: readonly ProductionVenueTemplate[] = [
  { id: 'compactClub', label: 'Compact Club', description: '8 × 5 × 5 m club stage with a close audience and two trusses.', stage: createVenueStage({ width: 8, height: 5, depth: 5 }, -10, 4.2), targets: createVenueTargets({ width: 8, height: 5, depth: 5 }) },
  { id: 'mediumStage', label: 'Medium Stage', description: '14 × 8 × 9 m stage suitable for theatres and mid-size rooms.', stage: createVenueStage({ width: 14, height: 8, depth: 9 }, -17, 6.5), targets: createVenueTargets({ width: 14, height: 8, depth: 9 }) },
  { id: 'wideFestivalStage', label: 'Wide Festival Stage', description: '28 × 14 × 15 m festival deck with wide truss spans and deep audience sightlines.', stage: createVenueStage({ width: 28, height: 14, depth: 15 }, -34, 11.5), targets: createVenueTargets({ width: 28, height: 14, depth: 15 }) },
] as const

export function getProductionVenueTemplate(templateId: string): ProductionVenueTemplate | null {
  return PRODUCTION_VENUE_TEMPLATES.find(template => template.id === templateId) ?? null
}

export function applyProductionVenueTemplate(
  settingsInput: unknown,
  templateId: string,
): LaserDmxSettings {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const template = getProductionVenueTemplate(templateId)
  if (!template) return settings
  const stage = normalizeProductionStageModel(template.stage)
  const frontTruss = stage.mountingSurfaces.find(surface => surface.id === 'truss:front') ?? stage.mountingSurfaces[0]
  const count = Math.max(1, settings.fixtures.length)
  const fixtures = settings.fixtures.map((fixture, index) => {
    const fraction = count === 1 ? 0.5 : index / (count - 1)
    const position = frontTruss
      ? {
          x: frontTruss.start.x + (frontTruss.end.x - frontTruss.start.x) * fraction,
          y: frontTruss.start.y + (frontTruss.end.y - frontTruss.start.y) * fraction,
          z: frontTruss.start.z + (frontTruss.end.z - frontTruss.start.z) * fraction,
        }
      : { x: 0, y: stage.dimensions.height * 0.8, z: stage.dimensions.depth * 0.2 }
    const legacy = stageVectorToLegacyNormalized(position, stage)
    return normalizeLegacyLaserDmxFixture({
      ...fixture,
      targetId: template.targets[0]?.id ?? null,
      stageTransform: {
        position,
        orientation: { yawDeg: 0, pitchDeg: -12, rollDeg: 0, panDeg: 0, tiltDeg: -12 },
      },
      position: {
        ...fixture.position,
        originX: legacy.x,
        originY: legacy.y,
        originZ: legacy.z,
      },
    }, index)
  })
  return normalizeLaserDmxSettings({
    ...settings,
    productionStage: stage,
    productionTargets: template.targets.map(target => JSON.parse(JSON.stringify(target)) as ProductionTarget),
    fixtures,
  })
}

export const ALL_PRODUCTION_FIXTURE_KINDS: readonly ProductionFixtureKind[] = [
  'laserProjector',
  'movingHeadBeam',
  'movingHeadSpot',
  'movingHeadWash',
  'strobe',
  'blinder',
  'ledBar',
  'hazer',
  'fogger',
  'cryoJet',
]

export const LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES: ProductionRendererCapabilities = {
  id: 'laserDmxVirtualRenderer',
  virtualOnly: true,
  // Patch 1 compiles existing laser profiles only. Later renderers can advertise
  // additional kinds without changing the rig document contract.
  fixtureKinds: ['laserProjector'],
  supportsBeamPaths: true,
  supportsVolumetrics: true,
  supportsAtmospherics: true,
  supportsCompoundCues: false,
  supportsHardwareOutput: false,
}

/** Hardware output remains explicitly disabled until a later patch. */
export const LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES: ProductionOutputAdapterCapabilities = {
  id: 'laserDmxVirtualOutput',
  label: 'Virtual renderer only',
  adapterKind: 'virtualRenderer',
  enabled: true,
  canTransmit: false,
  transports: ['none'],
  fixtureKinds: ['laserProjector'],
}

/**
 * Capability templates for every production fixture kind. They are domain
 * defaults, not hardware profiles, and therefore contain no vendor addresses.
 */
export const PRODUCTION_FIXTURE_KIND_CAPABILITIES: Readonly<Record<ProductionFixtureKind, ProductionFixtureCapabilities>> = {
  laserProjector: {
    color: { mode: 'rgb' }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 }, panTilt: { panRangeDeg: 360, tiltRangeDeg: 180 },
    zoom: { min: 0, max: 1 }, focus: { min: 0, max: 1 },
    beamPattern: { programmable: true },
  },
  movingHeadBeam: {
    color: { mode: 'colorWheel', slots: ['open'] }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 }, panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 },
    zoom: { min: 0, max: 1 }, focus: { min: 0, max: 1 }, iris: { min: 0, max: 1 },
    gobo: { slots: ['open'], rotation: true }, prism: { facets: [3, 8], rotation: true },
    frost: { min: 0, max: 1 }, beamPattern: { programmable: false },
  },
  movingHeadSpot: {
    color: { mode: 'colorWheel', slots: ['open'] }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 }, panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 },
    zoom: { min: 0, max: 1 }, focus: { min: 0, max: 1 }, iris: { min: 0, max: 1 },
    gobo: { slots: ['open'], rotation: true }, prism: { facets: [3], rotation: true },
    frost: { min: 0, max: 1 }, beamPattern: { programmable: false },
  },
  movingHeadWash: {
    color: { mode: 'rgbw' }, dimmer: true, shutter: true, strobe: { min: 0, max: 1 },
    panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 }, zoom: { min: 0, max: 1 },
    frost: { min: 0, max: 1 },
  },
  strobe: {
    color: { mode: 'fixedWhite', colorTemperatureKelvin: 6500 }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 }, trigger: { momentary: false, cooldownMs: 0 },
  },
  blinder: {
    color: { mode: 'fixedWhite', colorTemperatureKelvin: 3200 }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 },
  },
  ledBar: {
    color: { mode: 'rgbw' }, dimmer: true, shutter: true, strobe: { min: 0, max: 1 },
    beamPattern: { programmable: true, patternIds: ['pixels'] },
  },
  hazer: {
    atmosphericOutput: { medium: 'haze', variableOutput: true },
    trigger: { momentary: false, cooldownMs: 0 },
  },
  fogger: {
    atmosphericOutput: { medium: 'fog', variableOutput: true },
    trigger: { momentary: true, cooldownMs: 5000 },
  },
  cryoJet: {
    atmosphericOutput: { medium: 'cryo', variableOutput: false },
    trigger: { momentary: true, cooldownMs: 3000 },
  },
}

export type ProductionChannelSource =
  | 'dimmer'
  | 'shutter'
  | 'strobe'
  | 'red'
  | 'green'
  | 'blue'
  | 'white'
  | 'pan'
  | 'tilt'
  | 'zoom'
  | 'rotation'
  | 'scanSpeed'
  | 'pathComplexity'
  | 'zero'

export interface ProductionChannelDefinition {
  channel: number
  source: ProductionChannelSource
  label: string
}

export interface ProductionFixtureProfile {
  schemaVersion: number
  id: LaserDmxProfileId
  label: string
  fixtureKind: ProductionFixtureKind
  capabilities: ProductionFixtureCapabilities
  channels: readonly ProductionChannelDefinition[]
}

const RGB_LASER_CAPABILITIES: ProductionFixtureCapabilities = {
  ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.laserProjector,
}

const RGBW_LASER_CAPABILITIES: ProductionFixtureCapabilities = {
  ...RGB_LASER_CAPABILITIES,
  color: { mode: 'rgbw' },
}

const baseRgbChannels: readonly ProductionChannelDefinition[] = [
  { channel: 1, source: 'dimmer', label: 'Dimmer' },
  { channel: 2, source: 'shutter', label: 'Shutter' },
  { channel: 3, source: 'strobe', label: 'Strobe' },
  { channel: 4, source: 'red', label: 'Red' },
  { channel: 5, source: 'green', label: 'Green' },
  { channel: 6, source: 'blue', label: 'Blue' },
  { channel: 7, source: 'pan', label: 'Pan' },
  { channel: 8, source: 'tilt', label: 'Tilt' },
  { channel: 9, source: 'zoom', label: 'Zoom' },
  { channel: 10, source: 'zero', label: 'Reserved' },
  { channel: 11, source: 'scanSpeed', label: 'Scan speed' },
]

export const LASER_DMX_FIXTURE_PROFILES: Readonly<Record<LaserDmxProfileId, ProductionFixtureProfile>> = {
  genericRgbLaser: {
    schemaVersion: 1,
    id: 'genericRgbLaser',
    label: 'RGB Laser',
    fixtureKind: 'laserProjector',
    capabilities: RGB_LASER_CAPABILITIES,
    channels: baseRgbChannels,
  },
  genericRgbwLaser: {
    schemaVersion: 1,
    id: 'genericRgbwLaser',
    label: 'RGBW Laser',
    fixtureKind: 'laserProjector',
    capabilities: RGBW_LASER_CAPABILITIES,
    channels: [
      ...baseRgbChannels.slice(0, 9),
      { channel: 10, source: 'zero', label: 'Reserved' },
      { channel: 11, source: 'scanSpeed', label: 'Scan speed' },
      { channel: 12, source: 'white', label: 'White' },
    ],
  },
  scannerLaser: {
    schemaVersion: 1,
    id: 'scannerLaser',
    label: 'Scanner',
    fixtureKind: 'laserProjector',
    capabilities: {
      ...RGB_LASER_CAPABILITIES,
      beamPattern: { programmable: true, patternIds: ['scanner'] },
    },
    channels: [
      ...baseRgbChannels.slice(0, 8),
      { channel: 9, source: 'rotation', label: 'Pattern rotation' },
      { channel: 10, source: 'zero', label: 'Reserved' },
      { channel: 11, source: 'scanSpeed', label: 'Scan speed' },
      { channel: 12, source: 'zoom', label: 'Zoom' },
    ],
  },
  multiPatternLaser: {
    schemaVersion: 1,
    id: 'multiPatternLaser',
    label: 'Multi-Pattern',
    fixtureKind: 'laserProjector',
    capabilities: {
      ...RGBW_LASER_CAPABILITIES,
      beamPattern: { programmable: true, patternIds: ['multiPattern'] },
      gobo: { slots: ['open', 'pattern'], rotation: true },
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'strobe', label: 'Strobe' },
      { channel: 4, source: 'red', label: 'Red' },
      { channel: 5, source: 'green', label: 'Green' },
      { channel: 6, source: 'blue', label: 'Blue' },
      { channel: 7, source: 'white', label: 'White' },
      { channel: 8, source: 'pan', label: 'Pan' },
      { channel: 9, source: 'tilt', label: 'Tilt' },
      { channel: 10, source: 'rotation', label: 'Pattern rotation' },
      { channel: 11, source: 'zero', label: 'Reserved' },
      { channel: 12, source: 'scanSpeed', label: 'Scan speed' },
      { channel: 13, source: 'zoom', label: 'Zoom' },
      { channel: 14, source: 'pathComplexity', label: 'Pattern complexity' },
    ],
  },
}

export type ProductionRigDiagnosticCode =
  | 'invalidPosition'
  | 'missingProfile'
  | 'duplicateFixtureId'
  | 'fixtureOutsideStageBounds'
  | 'unresolvedTarget'

export interface ProductionRigDiagnostic {
  code: ProductionRigDiagnosticCode
  severity: 'error' | 'warning'
  fixtureId?: string
  message: string
}

function hasInvalidAuthoredPosition(rawFixture: unknown): boolean {
  if (!isRecord(rawFixture)) return false
  const legacy = isRecord(rawFixture.position) ? rawFixture.position : null
  const transform = isRecord(rawFixture.stageTransform) ? rawFixture.stageTransform : null
  const stagePosition = transform && isRecord(transform.position) ? transform.position : null
  const authored = [
    ...(legacy ? [legacy.originX, legacy.originY, legacy.originZ] : []),
    ...(stagePosition ? [stagePosition.x, stagePosition.y, stagePosition.z] : []),
  ].filter(value => value !== undefined)
  return authored.some(value => typeof value !== 'number' || !Number.isFinite(value))
}

export function diagnoseProductionRig(settingsInput: unknown): ProductionRigDiagnostic[] {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const stage = normalizeProductionStageModel(settings.productionStage)
  const diagnostics: ProductionRigDiagnostic[] = []
  const seen = new Set<string>()
  const targets = new Set((settings.productionTargets ?? []).map(target => target.id))
  const rawFixtures = isRecord(settingsInput) && Array.isArray(settingsInput.fixtures)
    ? settingsInput.fixtures
    : []
  for (const [fixtureIndex, fixture] of settings.fixtures.entries()) {
    if (seen.has(fixture.id)) {
      diagnostics.push({ code: 'duplicateFixtureId', severity: 'error', fixtureId: fixture.id, message: `Duplicate fixture ID “${fixture.id}”.` })
    }
    seen.add(fixture.id)
    if (!getLaserDmxFixtureProfile(fixture.dmx.profileId)) {
      diagnostics.push({ code: 'missingProfile', severity: 'error', fixtureId: fixture.id, message: `${fixture.name} references missing profile “${fixture.dmx.profileId}”.` })
    }
    const transform = resolveLaserDmxFixtureStageTransform(fixture, stage)
    const { x, y, z } = transform.position
    if (hasInvalidAuthoredPosition(rawFixtures[fixtureIndex]) || ![x, y, z].every(Number.isFinite)) {
      diagnostics.push({ code: 'invalidPosition', severity: 'error', fixtureId: fixture.id, message: `${fixture.name} has an invalid stage position; normalization used safe fallback coordinates.` })
    }
    const halfWidth = stage.dimensions.width / 2
    if (x < -halfWidth || x > halfWidth || y < 0 || y > stage.dimensions.height || z < 0 || z > stage.dimensions.depth) {
      diagnostics.push({ code: 'fixtureOutsideStageBounds', severity: 'warning', fixtureId: fixture.id, message: `${fixture.name} is outside the ${stage.dimensions.width} × ${stage.dimensions.height} × ${stage.dimensions.depth} m stage bounds.` })
    }
    if (fixture.targetId && !targets.has(fixture.targetId)) {
      diagnostics.push({ code: 'unresolvedTarget', severity: 'error', fixtureId: fixture.id, message: `${fixture.name} references unresolved target “${fixture.targetId}”.` })
    }
  }
  return diagnostics
}

export interface ProductionValidationIssue {
  severity: 'error' | 'warning'
  path: string
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Distinguishes an actual persisted Spatial Fixtures document from unrelated or
 * deliberately minimal objects used by older migration callers. This keeps the
 * store migration additive instead of interpreting every object named
 * `laserDmxSettings` as a complete document.
 */
export function isPersistedLaserDmxSettingsDocument(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (isFiniteNumber(value.schemaVersion) || typeof value.rigId === 'string') return true

  const fixtures = Array.isArray(value.fixtures) ? value.fixtures : []
  if (fixtures.some(fixture => (
    isRecord(fixture) &&
    isRecord(fixture.dmx) &&
    isRecord(fixture.position) &&
    isRecord(fixture.color) &&
    isRecord(fixture.beam) &&
    isRecord(fixture.path)
  ))) return true

  const documentKeys = [
    'selectedFixtureId', 'hazeAmount', 'beamPersistence', 'glowAmount',
    'globalBeamWidth', 'globalStrobeRate', 'safetyClamp', 'backgroundFade',
  ]
  return documentKeys.filter(key => key in value).length >= 3
}

/** Same guard for the established Beam Matrix document boundary. */
export function isPersistedLaserDmxBeamMatrixDocument(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (isFiniteNumber(value.schemaVersion)) return true
  const documentKeys = [
    'selectedBeamIds', 'selectedGroupId', 'grid', 'playback', 'fog',
    'modulationRoutes', 'cues', 'activeCueId', 'editor',
  ]
  return documentKeys.filter(key => key in value).length >= 2
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isFixtureKind(value: unknown): value is ProductionFixtureKind {
  return typeof value === 'string' && ALL_PRODUCTION_FIXTURE_KINDS.includes(value as ProductionFixtureKind)
}

function validateRange(
  range: ProductionRangeCapability | undefined,
  path: string,
  issues: ProductionValidationIssue[],
): void {
  if (!range) return
  if (!isFiniteNumber(range.min) || !isFiniteNumber(range.max) || range.min > range.max) {
    issues.push({ severity: 'error', path, message: 'Capability range must contain finite min/max values with min <= max' })
  }
}

export function validateFixtureCapabilities(
  capabilities: ProductionFixtureCapabilities,
  path = 'capabilities',
): ProductionValidationIssue[] {
  const issues: ProductionValidationIssue[] = []
  if (capabilities.color?.mode === 'colorWheel' && capabilities.color.slots.length === 0) {
    issues.push({ severity: 'error', path: `${path}.color.slots`, message: 'Color-wheel fixtures require at least one slot' })
  }
  if (capabilities.color?.mode === 'fixedWhite') {
    const kelvin = capabilities.color.colorTemperatureKelvin
    if (kelvin !== undefined && (!isFiniteNumber(kelvin) || kelvin < 1000 || kelvin > 20000)) {
      issues.push({ severity: 'error', path: `${path}.color.colorTemperatureKelvin`, message: 'Color temperature must be between 1000K and 20000K' })
    }
  }
  validateRange(capabilities.strobe, `${path}.strobe`, issues)
  validateRange(capabilities.zoom, `${path}.zoom`, issues)
  validateRange(capabilities.focus, `${path}.focus`, issues)
  validateRange(capabilities.iris, `${path}.iris`, issues)
  validateRange(capabilities.frost, `${path}.frost`, issues)
  if (capabilities.panTilt) {
    if (!isFiniteNumber(capabilities.panTilt.panRangeDeg) || capabilities.panTilt.panRangeDeg <= 0) {
      issues.push({ severity: 'error', path: `${path}.panTilt.panRangeDeg`, message: 'Pan range must be a positive finite number' })
    }
    if (!isFiniteNumber(capabilities.panTilt.tiltRangeDeg) || capabilities.panTilt.tiltRangeDeg <= 0) {
      issues.push({ severity: 'error', path: `${path}.panTilt.tiltRangeDeg`, message: 'Tilt range must be a positive finite number' })
    }
  }
  if (capabilities.trigger && (!isFiniteNumber(capabilities.trigger.cooldownMs) || capabilities.trigger.cooldownMs < 0)) {
    issues.push({ severity: 'error', path: `${path}.trigger.cooldownMs`, message: 'Trigger cooldown must be a non-negative finite number' })
  }
  if (capabilities.gobo && capabilities.gobo.slots.length === 0) {
    issues.push({ severity: 'error', path: `${path}.gobo.slots`, message: 'Gobo capability requires at least one slot' })
  }
  if (capabilities.prism && capabilities.prism.facets.some(value => !Number.isInteger(value) || value < 2)) {
    issues.push({ severity: 'error', path: `${path}.prism.facets`, message: 'Prism facet counts must be integers greater than one' })
  }
  return issues
}

export function validateFixtureProfile(profile: unknown): ProductionValidationIssue[] {
  const issues: ProductionValidationIssue[] = []
  if (!isRecord(profile)) {
    return [{ severity: 'error', path: 'profile', message: 'Fixture profile must be an object' }]
  }
  if (typeof profile.id !== 'string' || profile.id.length === 0) {
    issues.push({ severity: 'error', path: 'profile.id', message: 'Fixture profile ID is required' })
  }
  if (!isFixtureKind(profile.fixtureKind)) {
    issues.push({ severity: 'error', path: 'profile.fixtureKind', message: `Unsupported fixture kind "${String(profile.fixtureKind)}"` })
  }
  if (!isRecord(profile.capabilities)) {
    issues.push({ severity: 'error', path: 'profile.capabilities', message: 'Fixture capabilities are required' })
  } else {
    issues.push(...validateFixtureCapabilities(profile.capabilities as ProductionFixtureCapabilities, 'profile.capabilities'))
  }
  if (!Array.isArray(profile.channels) || profile.channels.length === 0) {
    issues.push({ severity: 'error', path: 'profile.channels', message: 'At least one channel definition is required' })
  } else {
    const channels = new Set<number>()
    for (const [index, raw] of profile.channels.entries()) {
      if (!isRecord(raw) || !Number.isInteger(raw.channel) || (raw.channel as number) < 1 || (raw.channel as number) > 512) {
        issues.push({ severity: 'error', path: `profile.channels[${index}].channel`, message: 'Channel must be an integer from 1 to 512' })
        continue
      }
      const channel = raw.channel as number
      if (channels.has(channel)) {
        issues.push({ severity: 'error', path: `profile.channels[${index}].channel`, message: `Duplicate channel ${channel}` })
      }
      channels.add(channel)
      const source = raw.source as ProductionChannelSource
      const capabilities = isRecord(profile.capabilities)
        ? profile.capabilities as ProductionFixtureCapabilities
        : {}
      const sourceSupported =
        source === 'zero' ||
        source === 'dimmer' && Boolean(capabilities.dimmer) ||
        source === 'shutter' && Boolean(capabilities.shutter) ||
        source === 'strobe' && Boolean(capabilities.strobe) ||
        (source === 'red' || source === 'green' || source === 'blue') &&
          (capabilities.color?.mode === 'rgb' || capabilities.color?.mode === 'rgbw') ||
        source === 'white' && capabilities.color?.mode === 'rgbw' ||
        (source === 'pan' || source === 'tilt') && Boolean(capabilities.panTilt) ||
        source === 'zoom' && Boolean(capabilities.zoom) ||
        source === 'rotation' && Boolean(capabilities.beamPattern) ||
        (source === 'scanSpeed' || source === 'pathComplexity') && Boolean(capabilities.beamPattern)
      if (!sourceSupported) {
        issues.push({
          severity: 'error',
          path: `profile.channels[${index}].source`,
          message: `Channel source "${String(raw.source)}" is not supported by the declared capabilities`,
        })
      }
    }
  }
  return issues
}

export function getLaserDmxFixtureProfile(profileId: unknown): ProductionFixtureProfile | null {
  if (typeof profileId !== 'string') return null
  return LASER_DMX_FIXTURE_PROFILES[profileId as LaserDmxProfileId] ?? null
}

export function resolveLaserDmxFixtureCapabilities(
  fixture: Pick<LaserDmxFixture, 'dmx' | 'capabilityOverrides'>,
): ProductionFixtureCapabilities | null {
  const profile = getLaserDmxFixtureProfile(fixture.dmx.profileId)
  if (!profile) return null
  return {
    ...profile.capabilities,
    ...(fixture.capabilityOverrides ?? {}),
  }
}

export interface ProductionChannelValues {
  dimmer: number
  shutter: number
  strobe: number
  red: number
  green: number
  blue: number
  white: number
  pan: number
  tilt: number
  zoom: number
  rotation: number
  scanSpeed: number
  pathComplexity: number
  zero: number
}

export function compileProfileChannels(
  profileId: unknown,
  values: ProductionChannelValues,
): Record<string, number> | null {
  const profile = getLaserDmxFixtureProfile(profileId)
  if (!profile) return null
  const channels: Record<string, number> = {}
  for (const definition of profile.channels) {
    channels[`ch${definition.channel}`] = values[definition.source]
  }
  return channels
}

function normalizeFixtureCapabilityOverrides(
  overrides: unknown,
): ProductionFixtureCapabilityOverride | undefined {
  return isRecord(overrides)
    ? overrides as ProductionFixtureCapabilityOverride
    : undefined
}

function defaultFixtureFallback(index: number): LaserDmxFixture {
  return {
    schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
    fixtureKind: 'laserProjector',
    id: `laser-fixture-recovered-${index + 1}`,
    name: `Recovered Laser ${index + 1}`,
    enabled: true,
    dmx: { universe: 1, startAddress: Math.min(497, 1 + index * 16), profileId: 'genericRgbLaser', channelMode: 'basic' },
    position: { originX: 0.5, originY: 0.85, originZ: 0, targetX: 0.5, targetY: 0.5, targetZ: 0, pan: 0, tilt: 0, rotation: 0, mirrorX: false, mirrorY: false },
    color: { mode: 'fixed', red: 0, green: 255, blue: 220, white: 0, alpha: 1, paletteId: '', colorCycleSpeed: 0.5 },
    beam: { dimmer: 1, shutterOpen: true, width: 1, zoom: 1, focus: 1, strobeRate: 0, flickerAmount: 0 },
    path: { kind: 'fan', scale: 1, rotation: 0, offsetX: 0, offsetY: 0, scanSpeed: 0.45, phaseOffset: 0, pointCount: 18, spread: 0.6, radius: 0.4, complexity: 0.4, smoothing: 0, pathProgress: 0 },
    modulationRoutes: [],
  }
}

function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeLegacyLaserDmxFixture(raw: unknown, index = 0): LaserDmxFixture {
  const fallback = defaultFixtureFallback(index)
  if (!isRecord(raw)) return fallback

  const rawDmx = isRecord(raw.dmx) ? raw.dmx : {}
  const rawPosition = isRecord(raw.position) ? raw.position : {}
  const rawColor = isRecord(raw.color) ? raw.color : {}
  const rawBeam = isRecord(raw.beam) ? raw.beam : {}
  const rawPath = isRecord(raw.path) ? raw.path : {}
  const rawProfileId = rawDmx.profileId
  const profile = getLaserDmxFixtureProfile(rawProfileId)
  const capabilityOverrides = normalizeFixtureCapabilityOverrides(raw.capabilityOverrides)
  const resolvedCapabilities = profile
    ? { ...profile.capabilities, ...(capabilityOverrides ?? {}) }
    : null
  const validationErrors = profile
    ? [
        ...validateFixtureProfile(profile),
        ...(resolvedCapabilities ? validateFixtureCapabilities(resolvedCapabilities, 'fixture.capabilities') : []),
      ].filter(issue => issue.severity === 'error').map(issue => issue.message)
    : [`Unknown fixture profile "${String(rawProfileId)}"`]
  const compatibility = isRecord(raw.compatibility) ? raw.compatibility : {}

  return {
    ...fallback,
    ...raw,
    schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
    fixtureKind: isFixtureKind(raw.fixtureKind)
      ? raw.fixtureKind
      : (profile?.fixtureKind ?? 'laserProjector'),
    id: stringOr(raw.id, fallback.id),
    name: stringOr(raw.name, fallback.name),
    enabled: booleanOr(raw.enabled, fallback.enabled),
    dmx: {
      ...fallback.dmx,
      ...rawDmx,
      universe: Math.max(1, Math.round(finiteOr(rawDmx.universe, fallback.dmx.universe))),
      startAddress: Math.max(1, Math.min(512, Math.round(finiteOr(rawDmx.startAddress, fallback.dmx.startAddress)))),
      profileId: stringOr(rawProfileId, fallback.dmx.profileId) as LaserDmxProfileId,
      channelMode: rawDmx.channelMode === 'extended' ? 'extended' : 'basic',
    },
    position: {
      ...fallback.position,
      ...rawPosition,
      originX: finiteOr(rawPosition.originX, fallback.position.originX),
      originY: finiteOr(rawPosition.originY, fallback.position.originY),
      originZ: finiteOr(rawPosition.originZ, fallback.position.originZ),
      targetX: finiteOr(rawPosition.targetX, fallback.position.targetX),
      targetY: finiteOr(rawPosition.targetY, fallback.position.targetY),
      targetZ: finiteOr(rawPosition.targetZ, fallback.position.targetZ),
      pan: finiteOr(rawPosition.pan, fallback.position.pan),
      tilt: finiteOr(rawPosition.tilt, fallback.position.tilt),
      rotation: finiteOr(rawPosition.rotation, fallback.position.rotation),
      mirrorX: booleanOr(rawPosition.mirrorX, fallback.position.mirrorX),
      mirrorY: booleanOr(rawPosition.mirrorY, fallback.position.mirrorY),
    },
    color: {
      ...fallback.color,
      ...rawColor,
      mode: rawColor.mode === 'palette' || rawColor.mode === 'music' ? rawColor.mode : 'fixed',
      red: finiteOr(rawColor.red, fallback.color.red),
      green: finiteOr(rawColor.green, fallback.color.green),
      blue: finiteOr(rawColor.blue, fallback.color.blue),
      white: finiteOr(rawColor.white, fallback.color.white),
      alpha: finiteOr(rawColor.alpha, fallback.color.alpha),
      paletteId: typeof rawColor.paletteId === 'string' ? rawColor.paletteId : fallback.color.paletteId,
      colorCycleSpeed: finiteOr(rawColor.colorCycleSpeed, fallback.color.colorCycleSpeed),
    },
    beam: {
      ...fallback.beam,
      ...rawBeam,
      dimmer: finiteOr(rawBeam.dimmer, fallback.beam.dimmer),
      shutterOpen: booleanOr(rawBeam.shutterOpen, fallback.beam.shutterOpen),
      width: finiteOr(rawBeam.width, fallback.beam.width),
      zoom: finiteOr(rawBeam.zoom, fallback.beam.zoom),
      focus: finiteOr(rawBeam.focus, fallback.beam.focus),
      strobeRate: finiteOr(rawBeam.strobeRate, fallback.beam.strobeRate),
      flickerAmount: finiteOr(rawBeam.flickerAmount, fallback.beam.flickerAmount),
    },
    path: {
      ...fallback.path,
      ...rawPath,
      kind: typeof rawPath.kind === 'string' ? rawPath.kind as LaserDmxFixture['path']['kind'] : fallback.path.kind,
      scale: finiteOr(rawPath.scale, fallback.path.scale),
      rotation: finiteOr(rawPath.rotation, fallback.path.rotation),
      offsetX: finiteOr(rawPath.offsetX, fallback.path.offsetX),
      offsetY: finiteOr(rawPath.offsetY, fallback.path.offsetY),
      scanSpeed: finiteOr(rawPath.scanSpeed, fallback.path.scanSpeed),
      phaseOffset: finiteOr(rawPath.phaseOffset, fallback.path.phaseOffset),
      pointCount: finiteOr(rawPath.pointCount, fallback.path.pointCount),
      spread: finiteOr(rawPath.spread, fallback.path.spread),
      radius: finiteOr(rawPath.radius, fallback.path.radius),
      complexity: finiteOr(rawPath.complexity, fallback.path.complexity),
      smoothing: finiteOr(rawPath.smoothing, fallback.path.smoothing),
      pathProgress: finiteOr(rawPath.pathProgress, fallback.path.pathProgress),
      ...(Array.isArray(rawPath.customPoints) ? { customPoints: rawPath.customPoints as Array<{ x: number; y: number }> } : {}),
    },
    modulationRoutes: Array.isArray(raw.modulationRoutes)
      ? raw.modulationRoutes as LaserDmxFixture['modulationRoutes']
      : fallback.modulationRoutes,
    capabilityOverrides,
    targetId: typeof raw.targetId === 'string' ? raw.targetId : null,
    ...(isRecord(raw.stageTransform) ? { stageTransform: raw.stageTransform as unknown as ProductionStageTransform } : {}),
    compatibility: {
      ...compatibility,
      source: 'laserDmxSpatialFixtures',
      sourceSchemaVersion: isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 0,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    },
  }
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeProductionTarget(raw: unknown, index: number): ProductionTarget | null {
  if (!isRecord(raw)) return null
  const id = stringOr(raw.id, `target:${index + 1}`)
  const name = stringOr(raw.name, `Target ${index + 1}`)
  if (raw.kind === 'zone') {
    const size = normalizeStageVector(raw.size, { x: 1, y: 1, z: 1 })
    return {
      ...raw,
      id,
      name,
      kind: 'zone',
      shape: raw.shape === 'sphere' || raw.shape === 'plane' ? raw.shape : 'box',
      center: normalizeStageVector(raw.center, { x: 0, y: 1, z: 0 }),
      size: {
        x: Math.max(0.01, Math.abs(size.x)),
        y: Math.max(0.01, Math.abs(size.y)),
        z: Math.max(0.01, Math.abs(size.z)),
      },
    }
  }
  return {
    ...raw,
    id,
    name,
    kind: 'point',
    position: normalizeStageVector(raw.position, { x: 0, y: 1, z: 0 }),
  }
}

export function normalizeLaserDmxSettings(raw: unknown): LaserDmxSettings {
  const fallback: LaserDmxSettings = {
    schemaVersion: LASER_DMX_SETTINGS_SCHEMA_VERSION,
    rigId: 'laser-dmx-spatial-rig',
    rigName: 'LaserDMX Spatial Rig',
    selectedFixtureId: null,
    masterDimmer: 0.85,
    blackout: false,
    hazeAmount: 0.55,
    beamPersistence: 0.72,
    glowAmount: 0.7,
    globalBeamWidth: 1,
    globalStrobeRate: 0,
    safetyClamp: 0.85,
    backgroundFade: 0.18,
    showFixtureOrigins: false,
    showPathPoints: false,
    showDmxDebug: false,
    fixtures: [],
    productionStage: createDefaultProductionStageModel(),
    productionGroups: [],
    productionTargets: [],
    productionLooks: [],
    productionCues: [],
  }
  if (!isRecord(raw)) return fallback
  const productionStage = normalizeProductionStageModel(raw.productionStage)
  const fixtures = normalizeArray<unknown>(raw.fixtures)
    .map(normalizeLegacyLaserDmxFixture)
    .map(fixture => ({
      ...fixture,
      stageTransform: resolveLaserDmxFixtureStageTransform(fixture, productionStage),
    }))
  const selectedFixtureId = typeof raw.selectedFixtureId === 'string' && fixtures.some(fixture => fixture.id === raw.selectedFixtureId)
    ? raw.selectedFixtureId
    : (fixtures[0]?.id ?? null)

  return {
    ...fallback,
    ...raw,
    schemaVersion: LASER_DMX_SETTINGS_SCHEMA_VERSION,
    rigId: stringOr(raw.rigId, fallback.rigId ?? 'laser-dmx-spatial-rig'),
    rigName: stringOr(raw.rigName, fallback.rigName ?? 'LaserDMX Spatial Rig'),
    selectedFixtureId,
    masterDimmer: finiteOr(raw.masterDimmer, fallback.masterDimmer),
    blackout: booleanOr(raw.blackout, fallback.blackout),
    hazeAmount: finiteOr(raw.hazeAmount, fallback.hazeAmount),
    beamPersistence: finiteOr(raw.beamPersistence, fallback.beamPersistence),
    glowAmount: finiteOr(raw.glowAmount, fallback.glowAmount),
    globalBeamWidth: finiteOr(raw.globalBeamWidth, fallback.globalBeamWidth),
    globalStrobeRate: finiteOr(raw.globalStrobeRate, fallback.globalStrobeRate),
    safetyClamp: finiteOr(raw.safetyClamp, fallback.safetyClamp),
    backgroundFade: finiteOr(raw.backgroundFade, fallback.backgroundFade),
    showFixtureOrigins: booleanOr(raw.showFixtureOrigins, false),
    showPathPoints: booleanOr(raw.showPathPoints, false),
    showDmxDebug: booleanOr(raw.showDmxDebug, false),
    fixtures,
    productionStage,
    productionGroups: normalizeArray<ProductionFixtureGroup>(raw.productionGroups),
    productionTargets: normalizeArray<unknown>(raw.productionTargets)
      .map(normalizeProductionTarget)
      .filter((target): target is ProductionTarget => target !== null),
    productionLooks: normalizeArray<ProductionLook>(raw.productionLooks),
    productionCues: normalizeArray<ProductionCompoundCue>(raw.productionCues),
  }
}

export function normalizeLaserDmxBeamMatrixSettings(raw: unknown): LaserDmxBeamMatrixSettings {
  if (!isRecord(raw)) return { schemaVersion: LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION } as LaserDmxBeamMatrixSettings
  return {
    ...raw,
    schemaVersion: LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION,
  } as unknown as LaserDmxBeamMatrixSettings
}

const TRANSIENT_LASER_DMX_KEYS = new Set([
  'runtime',
  'outputFrame',
  'lastCompiledFrame',
  'adapterState',
  'diagnostics',
])

function omitTransientKeys<T extends Record<string, unknown>>(value: T): T {
  const sanitized = { ...value }
  for (const key of TRANSIENT_LASER_DMX_KEYS) delete sanitized[key]
  return sanitized
}

/** Removes known runtime/output fields while preserving unknown authored fields. */
export function sanitizeLaserDmxSettingsForPersistence(raw: unknown): LaserDmxSettings {
  const normalized = normalizeLaserDmxSettings(raw)
  return omitTransientKeys(normalized as unknown as Record<string, unknown>) as unknown as LaserDmxSettings
}

export function sanitizeLaserDmxBeamMatrixForPersistence(raw: unknown): LaserDmxBeamMatrixSettings {
  const normalized = normalizeLaserDmxBeamMatrixSettings(raw)
  return omitTransientKeys(normalized as unknown as Record<string, unknown>) as unknown as LaserDmxBeamMatrixSettings
}

function buildFixturePropertyState(
  fixture: LaserDmxFixture,
  capabilities: ProductionFixtureCapabilities | null,
): ProductionFixturePropertyState {
  if (!capabilities) return {}
  const properties: ProductionFixturePropertyState = {}
  if (capabilities.dimmer) properties.dimmer = fixture.beam.dimmer
  if (capabilities.shutter) properties.shutterOpen = fixture.beam.shutterOpen
  if (capabilities.strobe) properties.strobeRate = fixture.beam.strobeRate
  if (capabilities.color?.mode === 'rgb' || capabilities.color?.mode === 'rgbw') {
    properties.color = {
      red: fixture.color.red,
      green: fixture.color.green,
      blue: fixture.color.blue,
      ...(capabilities.color.mode === 'rgbw' ? { white: fixture.color.white } : {}),
    }
  }
  if (capabilities.panTilt) {
    properties.panDeg = fixture.position.pan
    properties.tiltDeg = fixture.position.tilt
  }
  if (capabilities.zoom) properties.zoom = fixture.beam.zoom
  if (capabilities.focus) properties.focus = fixture.beam.focus
  if (capabilities.beamPattern) properties.beamPatternId = fixture.path.kind
  return properties
}

export function buildProductionRig(settingsInput: unknown): ProductionRig {
  const settings = normalizeLaserDmxSettings(settingsInput)
  const stage = normalizeProductionStageModel(settings.productionStage)
  const generatedTargets: ProductionTargetPoint[] = settings.fixtures.map(fixture => ({
    id: `target:${fixture.id}`,
    name: `${fixture.name} target`,
    kind: 'point',
    position: legacyNormalizedToStageVector({
      x: fixture.position.targetX,
      y: fixture.position.targetY,
      z: fixture.position.targetZ,
    }, stage),
  }))
  const explicitTargetIds = new Set((settings.productionTargets ?? []).map(target => target.id))
  const targets = [
    ...(settings.productionTargets ?? []),
    ...generatedTargets.filter(target => !explicitTargetIds.has(target.id)),
  ]

  const groupIdsByFixture = new Map<string, string[]>()
  for (const group of settings.productionGroups ?? []) {
    for (const fixtureId of group.fixtureIds) {
      groupIdsByFixture.set(fixtureId, [...(groupIdsByFixture.get(fixtureId) ?? []), group.id])
    }
  }

  return {
    schemaVersion: LASER_DMX_PRODUCTION_RIG_SCHEMA_VERSION,
    id: settings.rigId ?? 'laser-dmx-spatial-rig',
    name: settings.rigName ?? 'LaserDMX Spatial Rig',
    stage,
    fixtures: settings.fixtures.map(fixture => {
      const profile = getLaserDmxFixtureProfile(fixture.dmx.profileId)
      const capabilities = resolveLaserDmxFixtureCapabilities(fixture)
      const validationErrors = fixture.compatibility?.validationErrors ?? (profile ? [] : [`Unknown fixture profile "${String(fixture.dmx.profileId)}"`])
      return {
        schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
        id: fixture.id,
        name: fixture.name,
        enabled: fixture.enabled && validationErrors.length === 0,
        kind: fixture.fixtureKind ?? profile?.fixtureKind ?? 'laserProjector',
        profileId: fixture.dmx.profileId,
        groupIds: groupIdsByFixture.get(fixture.id) ?? [],
        transform: resolveLaserDmxFixtureStageTransform(fixture, stage),
        targetId: fixture.targetId ?? `target:${fixture.id}`,
        properties: buildFixturePropertyState(fixture, capabilities),
        capabilityOverrides: fixture.capabilityOverrides,
        compatibility: {
          source: 'laserDmxSpatialFixtures',
          sourceSchemaVersion: fixture.schemaVersion ?? 0,
          ...(validationErrors.length > 0 ? { validationErrors } : {}),
        },
      }
    }),
    groups: settings.productionGroups ?? [],
    targets,
    looks: settings.productionLooks ?? [],
    cues: settings.productionCues ?? [],
    rendererCapabilities: LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES,
    outputAdapterCapabilities: LASER_DMX_OUTPUT_ADAPTER_CAPABILITIES,
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, canonicalize(value[key])]),
  )
}

export function serializeLaserDmxSettings(settings: unknown): string {
  return JSON.stringify(canonicalize(sanitizeLaserDmxSettingsForPersistence(settings)))
}

export function deserializeLaserDmxSettings(serialized: string): LaserDmxSettings {
  return normalizeLaserDmxSettings(JSON.parse(serialized) as unknown)
}

export function createProductionOutputFrame(
  rig: ProductionRig,
  timestampSec: number,
  fixtures: LaserDmxFixtureFrame[],
): ProductionOutputFrame {
  const rigFixtures = new Map(rig.fixtures.map(fixture => [fixture.id, fixture]))
  return {
    schemaVersion: LASER_DMX_PRODUCTION_RIG_SCHEMA_VERSION,
    rigId: rig.id,
    timestampSec,
    rendererId: rig.rendererCapabilities.id,
    adapterId: rig.outputAdapterCapabilities.id,
    fixtures: fixtures.map(frame => {
      const fixture = rigFixtures.get(frame.fixtureId)
      return {
        fixtureId: frame.fixtureId,
        profileId: fixture?.profileId ?? 'unknown',
        fixtureKind: fixture?.kind ?? 'laserProjector',
        channels: frame.channels,
        visual: frame.visual,
      }
    }),
  }
}

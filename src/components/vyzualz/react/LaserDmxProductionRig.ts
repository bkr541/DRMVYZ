/**
 * LaserDMX production-rig domain and compatibility foundation.
 *
 * This module deliberately keeps hardware transmission out of scope. It owns
 * serializable rig contracts, capability declarations, fixture-profile
 * validation, legacy LaserDMX rig normalization, deterministic
 * serialization, and the virtual output contract consumed by the renderer.
 */

import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxFixture,
  LaserDmxFixtureFrame,
  LaserDmxProfileId,
  LaserDmxSettings,
} from './ReactTypes'

export const LASER_DMX_SETTINGS_SCHEMA_VERSION = 7
export const LASER_DMX_FIXTURE_SCHEMA_VERSION = 4
export const LASER_DMX_BEAM_MATRIX_SCHEMA_VERSION = 2
export const LASER_DMX_PRODUCTION_RIG_SCHEMA_VERSION = 9
export const LASER_DMX_STAGE_SCHEMA_VERSION = 2

export type ProductionFixtureKind =
  | 'laserProjector'
  | 'movingHeadBeam'
  | 'movingHeadSpot'
  | 'movingHeadWash'
  | 'staticWash'
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
  | { mode: 'fixedColor'; color: string; label?: string }

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

export interface ProductionWashCapability {
  spread: ProductionRangeCapability
  softness: ProductionRangeCapability
  atmosphericVolume: boolean
}

export interface ProductionPixelCapability {
  maxSegments: number
  supportsWholeBar: boolean
  supportsSegmentPatterns: boolean
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
  wash?: ProductionWashCapability
  pixels?: ProductionPixelCapability
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
  /** Compatibility aliases retained for earlier saved rigs and integrations. */
  panDeg: number
  tiltDeg: number
}

export interface ProductionStageTransform {
  position: ProductionStageVector3
  orientation: ProductionStageOrientation
}

/**
 * Coordinate convention used by every metre-based stage helper and renderer:
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
export type ProductionAtmosphereQualityTier = 'low' | 'medium' | 'high'
export type ProductionAtmosphericRetriggerPolicy = 'restart' | 'ignoreWhileActive' | 'extend'

export interface ProductionPersistentHazeSettings {
  enabled: boolean
  baseDensity: number
  heightDistribution: number
  turbulence: number
  diffusion: number
  driftSpeed: number
  driftDirectionDeg: number
  ventilation: number
  beamScatter: number
}

export interface ProductionAtmosphereSettings {
  persistentHaze: ProductionPersistentHazeSettings
  qualityTier: ProductionAtmosphereQualityTier
  maxParticleBudget: number
  retainBaseHazeOnClear: boolean
}

export interface ProductionAtmosphericFixtureSettings {
  /** Arming is authored/persisted; triggerRequestId remains transient command state. */
  armed: boolean
  outputLevel: number
  outputDurationSec: number
  plumeVelocity: number
  spread: number
  density: number
  turbulence: number
  driftSpeed: number
  driftDirectionDeg: number
  dissipation: number
  retriggerPolicy: ProductionAtmosphericRetriggerPolicy
  warmupSec: number
  cooldownSec: number
  height: number
  seed: number
  triggerRequestId: number
  orientationMode: 'vertical' | 'fixtureOrientation'
}

export interface ProductionStageModel {
  schemaVersion: number
  originConvention: ProductionStageOriginConvention
  dimensions: ProductionStageDimensions
  /** Presentation-only magnification applied after the authored camera framing. */
  previewZoom: number
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
  colorWheelSlot?: number
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
  flashPatternId?: ProductionFlashPatternId
  washSpread?: number
  washSoftness?: number
  pixelSegmentCount?: number
}

export type ProductionWhiteAccentPolicy = 'off' | 'impactOnly' | 'continuous'

export interface ProductionFixtureColorPolicy {
  whiteAccentPolicy: ProductionWhiteAccentPolicy
  whiteAccentIntensity: number
  preserveFixedColor: boolean
}

export type ProductionFlashPatternId =
  | 'singleHit'
  | 'doubleHit'
  | 'tripleHit'
  | 'sustainedStrobe'
  | 'quarterBeatBurst'
  | 'eighthNoteBurst'
  | 'rampUpBuildStrobe'
  | 'alternatingLeftRight'
  | 'centerOutFlash'
  | 'randomizedFlicker'
  | 'fullStageWhiteout'
  | 'flashThenBlackout'

export type ProductionFlashQuantize = 'none' | 'beat' | 'eighth' | 'sixteenth' | 'bar'
export type ProductionFlashRepeatMode = 'once' | 'count' | 'loop'
export type ProductionFlashRetriggerPolicy = 'restart' | 'ignoreWhileActive' | 'queueNextQuantized'
export type ProductionFlashEnvelopeCurve = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface ProductionFlashEnvelope {
  attack: number
  hold: number
  release: number
  curve: ProductionFlashEnvelopeCurve
}

export interface ProductionFlashRepeatRule {
  mode: ProductionFlashRepeatMode
  count: number
  intervalBeats: number
}

export interface ProductionFlashPatternSettings {
  enabled: boolean
  pattern: ProductionFlashPatternId
  triggerTimeSec: number
  durationBeats: number
  rateHz: number
  dutyCycle: number
  intensity: number
  envelope: ProductionFlashEnvelope
  repeat: ProductionFlashRepeatRule
  quantize: ProductionFlashQuantize
  retriggerPolicy: ProductionFlashRetriggerPolicy
  whiteAccent: boolean
  seed: number
}

export type ProductionChaseOrder = 'forward' | 'reverse' | 'alternate' | 'centerOut' | 'outsideIn' | 'randomized'

export interface ProductionChaseSettings {
  enabled: boolean
  order: ProductionChaseOrder
  stepBeats: number
  width: number
  seed: number
}

export interface ProductionWashSettings {
  spread: number
  softness: number
  atmosphericIntensity: number
}

export type ProductionLedBarMode = 'wholeBar' | 'segments'
export type ProductionLedBarPattern = 'solid' | 'alternating' | 'gradient' | 'chase' | 'sparkle'

export interface ProductionLedBarSettings {
  mode: ProductionLedBarMode
  segmentCount: number
  pattern: ProductionLedBarPattern
  secondaryColor: { red: number; green: number; blue: number; white: number }
  chase: ProductionChaseSettings
}

export interface ProductionVisualComfortSettings {
  disableStrobe: boolean
  maxFlashHz: number
  warningThresholdHz: number
  maxContinuousFlashSec: number
}

export type ProductionMovingHeadEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface ProductionMovingHeadSettings {
  /** Manual home pose, used whenever target tracking is disabled or unavailable. */
  panDeg: number
  tiltDeg: number
  panSpeedDegPerSec: number
  tiltSpeedDegPerSec: number
  easing: ProductionMovingHeadEasing
  targetTracking: boolean
  prePositionWhileShuttered: boolean
  /** Monotonic explicit snap action token. Normal runtime movement is interpolated. */
  snapRequestId: number
  colorWheelSlot: number
  iris: number
  frost: number
  goboIndex: number
  goboRotation: number
  prismFacets: number
  prismRotation: number
}

export type ProductionGroupMovementGenerator =
  | 'mirroredFan'
  | 'fanOpen'
  | 'fanClose'
  | 'centerOutSpread'
  | 'outsideInCollapse'
  | 'crossfire'
  | 'tunnel'
  | 'ceilingCanopy'
  | 'crowdScan'
  | 'pendulum'
  | 'figureEight'
  | 'panWave'
  | 'tiltWave'
  | 'alternatingBanks'
  | 'staticAerialHold'

export type ProductionMovementSymmetry = 'none' | 'mirrorPairs' | 'centerMirror' | 'alternatingBanks'
export type ProductionMovementDirection = 'forward' | 'reverse' | 'alternate'
export type ProductionMovementQuantize = 'none' | 'beat' | 'bar' | 'phrase'

export interface ProductionGroupMovementConfig {
  enabled: boolean
  generator: ProductionGroupMovementGenerator
  speed: number
  amplitude: number
  panAmplitudeDeg: number
  tiltAmplitudeDeg: number
  centerPoint: ProductionStageVector3
  spreadDeg: number
  direction: ProductionMovementDirection
  phaseOffset: number
  phaseSpread: number
  symmetry: ProductionMovementSymmetry
  quantize: ProductionMovementQuantize
  durationBeats: number
  snap: boolean
  easing: ProductionMovingHeadEasing
  prePositionWhileShuttered: boolean
}

export const DEFAULT_PRODUCTION_FIXTURE_COLOR_POLICY: ProductionFixtureColorPolicy = {
  whiteAccentPolicy: 'impactOnly',
  whiteAccentIntensity: 1,
  preserveFixedColor: true,
}

export const DEFAULT_PRODUCTION_FLASH_PATTERN: ProductionFlashPatternSettings = {
  enabled: false,
  pattern: 'singleHit',
  triggerTimeSec: 0,
  durationBeats: 1,
  rateHz: 8,
  dutyCycle: 0.35,
  intensity: 1,
  envelope: { attack: 0, hold: 0.7, release: 0.3, curve: 'easeOut' },
  repeat: { mode: 'once', count: 1, intervalBeats: 4 },
  quantize: 'beat',
  retriggerPolicy: 'restart',
  whiteAccent: true,
  seed: 1,
}

export const DEFAULT_PRODUCTION_CHASE: ProductionChaseSettings = {
  enabled: false,
  order: 'forward',
  stepBeats: 0.5,
  width: 1,
  seed: 1,
}

export const DEFAULT_PRODUCTION_WASH_SETTINGS: ProductionWashSettings = {
  spread: 0.72,
  softness: 0.72,
  atmosphericIntensity: 0.65,
}

export const DEFAULT_PRODUCTION_LED_BAR_SETTINGS: ProductionLedBarSettings = {
  mode: 'wholeBar',
  segmentCount: 8,
  pattern: 'solid',
  secondaryColor: { red: 255, green: 255, blue: 255, white: 0 },
  chase: { ...DEFAULT_PRODUCTION_CHASE },
}

export const PRODUCTION_ATMOSPHERE_PARTICLE_BUDGETS: Readonly<Record<ProductionAtmosphereQualityTier, number>> = {
  low: 80,
  medium: 180,
  high: 360,
}

export const DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS: ProductionAtmosphereSettings = {
  persistentHaze: {
    enabled: true,
    baseDensity: 0.45,
    heightDistribution: 0.62,
    turbulence: 0.25,
    diffusion: 0.68,
    driftSpeed: 0.12,
    driftDirectionDeg: 18,
    ventilation: 0.18,
    beamScatter: 0.72,
  },
  qualityTier: 'medium',
  maxParticleBudget: 180,
  retainBaseHazeOnClear: true,
}

export const DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS: ProductionAtmosphericFixtureSettings = {
  armed: true,
  outputLevel: 0.7,
  outputDurationSec: 1.8,
  plumeVelocity: 3.5,
  spread: 0.55,
  density: 0.75,
  turbulence: 0.35,
  driftSpeed: 0.18,
  driftDirectionDeg: 12,
  dissipation: 0.65,
  retriggerPolicy: 'ignoreWhileActive',
  warmupSec: 0,
  cooldownSec: 3,
  height: 4.5,
  seed: 1,
  triggerRequestId: 0,
  orientationMode: 'fixtureOrientation',
}

export const DEFAULT_PRODUCTION_VISUAL_COMFORT: ProductionVisualComfortSettings = {
  disableStrobe: false,
  maxFlashHz: 12,
  warningThresholdHz: 7,
  maxContinuousFlashSec: 4,
}

export const DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS: ProductionMovingHeadSettings = {
  panDeg: 0,
  tiltDeg: -35,
  panSpeedDegPerSec: 180,
  tiltSpeedDegPerSec: 140,
  easing: 'easeInOut',
  targetTracking: true,
  prePositionWhileShuttered: true,
  snapRequestId: 0,
  colorWheelSlot: 0,
  iris: 1,
  frost: 0,
  goboIndex: 0,
  goboRotation: 0,
  prismFacets: 0,
  prismRotation: 0,
}

export const DEFAULT_PRODUCTION_GROUP_MOVEMENT: ProductionGroupMovementConfig = {
  enabled: false,
  generator: 'staticAerialHold',
  speed: 1,
  amplitude: 1,
  panAmplitudeDeg: 55,
  tiltAmplitudeDeg: 28,
  centerPoint: { x: 0, y: 1.8, z: -4 },
  spreadDeg: 45,
  direction: 'forward',
  phaseOffset: 0,
  phaseSpread: 0.125,
  symmetry: 'mirrorPairs',
  quantize: 'bar',
  durationBeats: 4,
  snap: false,
  easing: 'easeInOut',
  prePositionWhileShuttered: true,
}

function isMovingHeadEasing(value: unknown): value is ProductionMovingHeadEasing {
  return value === 'linear' || value === 'easeIn' || value === 'easeOut' || value === 'easeInOut'
}

export function normalizeProductionAtmosphereSettings(value: unknown): ProductionAtmosphereSettings {
  const raw = isRecord(value) ? value : {}
  const haze = isRecord(raw.persistentHaze) ? raw.persistentHaze : {}
  const qualityTier: ProductionAtmosphereQualityTier = raw.qualityTier === 'low' || raw.qualityTier === 'high'
    ? raw.qualityTier
    : 'medium'
  return {
    persistentHaze: {
      enabled: booleanOr(haze.enabled, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.enabled),
      baseDensity: Math.max(0, Math.min(1, finiteOr(haze.baseDensity, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.baseDensity))),
      heightDistribution: Math.max(0, Math.min(1, finiteOr(haze.heightDistribution, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.heightDistribution))),
      turbulence: Math.max(0, Math.min(1, finiteOr(haze.turbulence, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.turbulence))),
      diffusion: Math.max(0, Math.min(1, finiteOr(haze.diffusion, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.diffusion))),
      driftSpeed: Math.max(0, Math.min(2, finiteOr(haze.driftSpeed, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.driftSpeed))),
      driftDirectionDeg: finiteOr(haze.driftDirectionDeg, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.driftDirectionDeg),
      ventilation: Math.max(0, Math.min(1, finiteOr(haze.ventilation, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.ventilation))),
      beamScatter: Math.max(0, Math.min(1, finiteOr(haze.beamScatter, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze.beamScatter))),
    },
    qualityTier,
    maxParticleBudget: Math.max(16, Math.min(2000, Math.round(finiteOr(raw.maxParticleBudget, DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.maxParticleBudget)))),
    retainBaseHazeOnClear: booleanOr(raw.retainBaseHazeOnClear, true),
  }
}

export function normalizeProductionAtmosphericFixtureSettings(
  value: unknown,
  medium: 'haze' | 'fog' | 'cryo' = 'fog',
): ProductionAtmosphericFixtureSettings {
  const raw = isRecord(value) ? value : {}
  const defaults = {
    ...DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
    outputDurationSec: medium === 'cryo' ? 0.9 : medium === 'haze' ? 9999 : 2.2,
    plumeVelocity: medium === 'cryo' ? 7.5 : medium === 'haze' ? 0.4 : 3.2,
    spread: medium === 'cryo' ? 0.38 : medium === 'haze' ? 0.9 : 0.62,
    dissipation: medium === 'cryo' ? 0.9 : medium === 'haze' ? 0.18 : 0.62,
    cooldownSec: medium === 'cryo' ? 3 : medium === 'haze' ? 0 : 5,
    height: medium === 'cryo' ? 6 : medium === 'haze' ? 2.5 : 4.5,
  }
  const retriggerPolicy: ProductionAtmosphericRetriggerPolicy = raw.retriggerPolicy === 'restart' || raw.retriggerPolicy === 'extend'
    ? raw.retriggerPolicy
    : 'ignoreWhileActive'
  return {
    armed: booleanOr(raw.armed, defaults.armed),
    outputLevel: Math.max(0, Math.min(1, finiteOr(raw.outputLevel, defaults.outputLevel))),
    outputDurationSec: Math.max(0.05, Math.min(60, finiteOr(raw.outputDurationSec, defaults.outputDurationSec))),
    plumeVelocity: Math.max(0, Math.min(30, finiteOr(raw.plumeVelocity, defaults.plumeVelocity))),
    spread: Math.max(0.02, Math.min(4, finiteOr(raw.spread, defaults.spread))),
    density: Math.max(0, Math.min(1, finiteOr(raw.density, defaults.density))),
    turbulence: Math.max(0, Math.min(1, finiteOr(raw.turbulence, defaults.turbulence))),
    driftSpeed: Math.max(0, Math.min(5, finiteOr(raw.driftSpeed, defaults.driftSpeed))),
    driftDirectionDeg: finiteOr(raw.driftDirectionDeg, defaults.driftDirectionDeg),
    dissipation: Math.max(0, Math.min(1, finiteOr(raw.dissipation, defaults.dissipation))),
    retriggerPolicy,
    warmupSec: Math.max(0, Math.min(30, finiteOr(raw.warmupSec, defaults.warmupSec))),
    cooldownSec: Math.max(0, Math.min(120, finiteOr(raw.cooldownSec, defaults.cooldownSec))),
    height: Math.max(0.1, Math.min(30, finiteOr(raw.height, defaults.height))),
    seed: Math.round(finiteOr(raw.seed, defaults.seed)),
    triggerRequestId: Math.max(0, Math.round(finiteOr(raw.triggerRequestId, 0))),
    orientationMode: raw.orientationMode === 'vertical' ? 'vertical' : medium === 'cryo' ? 'vertical' : 'fixtureOrientation',
  }
}

export function normalizeProductionMovingHeadSettings(value: unknown): ProductionMovingHeadSettings {
  const raw = isRecord(value) ? value : {}
  return {
    panDeg: finiteOr(raw.panDeg, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.panDeg),
    tiltDeg: finiteOr(raw.tiltDeg, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.tiltDeg),
    panSpeedDegPerSec: Math.max(1, finiteOr(raw.panSpeedDegPerSec, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.panSpeedDegPerSec)),
    tiltSpeedDegPerSec: Math.max(1, finiteOr(raw.tiltSpeedDegPerSec, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.tiltSpeedDegPerSec)),
    easing: isMovingHeadEasing(raw.easing) ? raw.easing : DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.easing,
    targetTracking: booleanOr(raw.targetTracking, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.targetTracking),
    prePositionWhileShuttered: booleanOr(raw.prePositionWhileShuttered, DEFAULT_PRODUCTION_MOVING_HEAD_SETTINGS.prePositionWhileShuttered),
    snapRequestId: Math.max(0, Math.round(finiteOr(raw.snapRequestId, booleanOr(raw.snapOnNextFrame, false) ? 1 : 0))),
    colorWheelSlot: Math.max(0, Math.round(finiteOr(raw.colorWheelSlot, 0))),
    iris: Math.max(0, Math.min(1, finiteOr(raw.iris, 1))),
    frost: Math.max(0, Math.min(1, finiteOr(raw.frost, 0))),
    goboIndex: Math.max(0, Math.round(finiteOr(raw.goboIndex, 0))),
    goboRotation: finiteOr(raw.goboRotation, 0),
    prismFacets: Math.max(0, Math.round(finiteOr(raw.prismFacets, 0))),
    prismRotation: finiteOr(raw.prismRotation, 0),
  }
}

const FLASH_PATTERNS: readonly ProductionFlashPatternId[] = [
  'singleHit', 'doubleHit', 'tripleHit', 'sustainedStrobe', 'quarterBeatBurst',
  'eighthNoteBurst', 'rampUpBuildStrobe', 'alternatingLeftRight', 'centerOutFlash',
  'randomizedFlicker', 'fullStageWhiteout', 'flashThenBlackout',
]
const FLASH_QUANTIZE: readonly ProductionFlashQuantize[] = ['none', 'beat', 'eighth', 'sixteenth', 'bar']
const FLASH_REPEAT_MODES: readonly ProductionFlashRepeatMode[] = ['once', 'count', 'loop']
const FLASH_RETRIGGER_POLICIES: readonly ProductionFlashRetriggerPolicy[] = ['restart', 'ignoreWhileActive', 'queueNextQuantized']
const CHASE_ORDERS: readonly ProductionChaseOrder[] = ['forward', 'reverse', 'alternate', 'centerOut', 'outsideIn', 'randomized']

export function normalizeProductionFixtureColorPolicy(value: unknown): ProductionFixtureColorPolicy {
  const raw = isRecord(value) ? value : {}
  const whiteAccentPolicy = raw.whiteAccentPolicy === 'off' || raw.whiteAccentPolicy === 'continuous'
    ? raw.whiteAccentPolicy
    : 'impactOnly'
  return {
    whiteAccentPolicy,
    whiteAccentIntensity: Math.max(0, Math.min(1, finiteOr(raw.whiteAccentIntensity, 1))),
    preserveFixedColor: booleanOr(raw.preserveFixedColor, true),
  }
}

export function normalizeProductionFlashPattern(value: unknown): ProductionFlashPatternSettings {
  const raw = isRecord(value) ? value : {}
  const rawEnvelope = isRecord(raw.envelope) ? raw.envelope : {}
  const rawRepeat = isRecord(raw.repeat) ? raw.repeat : {}
  const pattern = typeof raw.pattern === 'string' && FLASH_PATTERNS.includes(raw.pattern as ProductionFlashPatternId)
    ? raw.pattern as ProductionFlashPatternId
    : DEFAULT_PRODUCTION_FLASH_PATTERN.pattern
  const quantize = typeof raw.quantize === 'string' && FLASH_QUANTIZE.includes(raw.quantize as ProductionFlashQuantize)
    ? raw.quantize as ProductionFlashQuantize
    : DEFAULT_PRODUCTION_FLASH_PATTERN.quantize
  const retriggerPolicy = typeof raw.retriggerPolicy === 'string' && FLASH_RETRIGGER_POLICIES.includes(raw.retriggerPolicy as ProductionFlashRetriggerPolicy)
    ? raw.retriggerPolicy as ProductionFlashRetriggerPolicy
    : DEFAULT_PRODUCTION_FLASH_PATTERN.retriggerPolicy
  const repeatMode = typeof rawRepeat.mode === 'string' && FLASH_REPEAT_MODES.includes(rawRepeat.mode as ProductionFlashRepeatMode)
    ? rawRepeat.mode as ProductionFlashRepeatMode
    : DEFAULT_PRODUCTION_FLASH_PATTERN.repeat.mode
  const curve = rawEnvelope.curve === 'linear' || rawEnvelope.curve === 'easeIn' || rawEnvelope.curve === 'easeInOut'
    ? rawEnvelope.curve
    : 'easeOut'
  return {
    enabled: booleanOr(raw.enabled, DEFAULT_PRODUCTION_FLASH_PATTERN.enabled),
    pattern,
    triggerTimeSec: Math.max(0, finiteOr(raw.triggerTimeSec, DEFAULT_PRODUCTION_FLASH_PATTERN.triggerTimeSec)),
    durationBeats: Math.max(0.0625, Math.min(128, finiteOr(raw.durationBeats, DEFAULT_PRODUCTION_FLASH_PATTERN.durationBeats))),
    rateHz: Math.max(0.1, Math.min(60, finiteOr(raw.rateHz, DEFAULT_PRODUCTION_FLASH_PATTERN.rateHz))),
    dutyCycle: Math.max(0.02, Math.min(0.98, finiteOr(raw.dutyCycle, DEFAULT_PRODUCTION_FLASH_PATTERN.dutyCycle))),
    intensity: Math.max(0, Math.min(1, finiteOr(raw.intensity, DEFAULT_PRODUCTION_FLASH_PATTERN.intensity))),
    envelope: {
      attack: Math.max(0, Math.min(1, finiteOr(rawEnvelope.attack, DEFAULT_PRODUCTION_FLASH_PATTERN.envelope.attack))),
      hold: Math.max(0, Math.min(1, finiteOr(rawEnvelope.hold, DEFAULT_PRODUCTION_FLASH_PATTERN.envelope.hold))),
      release: Math.max(0, Math.min(1, finiteOr(rawEnvelope.release, DEFAULT_PRODUCTION_FLASH_PATTERN.envelope.release))),
      curve,
    },
    repeat: {
      mode: repeatMode,
      count: Math.max(1, Math.min(256, Math.round(finiteOr(rawRepeat.count, DEFAULT_PRODUCTION_FLASH_PATTERN.repeat.count)))),
      intervalBeats: Math.max(0.0625, Math.min(256, finiteOr(rawRepeat.intervalBeats, DEFAULT_PRODUCTION_FLASH_PATTERN.repeat.intervalBeats))),
    },
    quantize,
    retriggerPolicy,
    whiteAccent: booleanOr(raw.whiteAccent, DEFAULT_PRODUCTION_FLASH_PATTERN.whiteAccent),
    seed: Math.round(finiteOr(raw.seed, DEFAULT_PRODUCTION_FLASH_PATTERN.seed)),
  }
}

export function normalizeProductionChase(value: unknown): ProductionChaseSettings {
  const raw = isRecord(value) ? value : {}
  const order = typeof raw.order === 'string' && CHASE_ORDERS.includes(raw.order as ProductionChaseOrder)
    ? raw.order as ProductionChaseOrder
    : DEFAULT_PRODUCTION_CHASE.order
  return {
    enabled: booleanOr(raw.enabled, DEFAULT_PRODUCTION_CHASE.enabled),
    order,
    stepBeats: Math.max(0.0625, Math.min(64, finiteOr(raw.stepBeats, DEFAULT_PRODUCTION_CHASE.stepBeats))),
    width: Math.max(1, Math.min(64, Math.round(finiteOr(raw.width, DEFAULT_PRODUCTION_CHASE.width)))),
    seed: Math.round(finiteOr(raw.seed, DEFAULT_PRODUCTION_CHASE.seed)),
  }
}

export function normalizeProductionWashSettings(value: unknown): ProductionWashSettings {
  const raw = isRecord(value) ? value : {}
  return {
    spread: Math.max(0, Math.min(1, finiteOr(raw.spread, DEFAULT_PRODUCTION_WASH_SETTINGS.spread))),
    softness: Math.max(0, Math.min(1, finiteOr(raw.softness, DEFAULT_PRODUCTION_WASH_SETTINGS.softness))),
    atmosphericIntensity: Math.max(0, Math.min(1, finiteOr(raw.atmosphericIntensity, DEFAULT_PRODUCTION_WASH_SETTINGS.atmosphericIntensity))),
  }
}

export function normalizeProductionLedBarSettings(value: unknown, maxSegments = 32): ProductionLedBarSettings {
  const raw = isRecord(value) ? value : {}
  const secondary = isRecord(raw.secondaryColor) ? raw.secondaryColor : {}
  const mode = raw.mode === 'segments' ? 'segments' : 'wholeBar'
  const pattern = raw.pattern === 'alternating' || raw.pattern === 'gradient' || raw.pattern === 'chase' || raw.pattern === 'sparkle'
    ? raw.pattern
    : 'solid'
  return {
    mode,
    segmentCount: Math.max(1, Math.min(maxSegments, Math.round(finiteOr(raw.segmentCount, DEFAULT_PRODUCTION_LED_BAR_SETTINGS.segmentCount)))),
    pattern,
    secondaryColor: {
      red: Math.max(0, Math.min(255, Math.round(finiteOr(secondary.red, 255)))),
      green: Math.max(0, Math.min(255, Math.round(finiteOr(secondary.green, 255)))),
      blue: Math.max(0, Math.min(255, Math.round(finiteOr(secondary.blue, 255)))),
      white: Math.max(0, Math.min(255, Math.round(finiteOr(secondary.white, 0)))),
    },
    chase: normalizeProductionChase(raw.chase),
  }
}

export function normalizeProductionVisualComfort(value: unknown): ProductionVisualComfortSettings {
  const raw = isRecord(value) ? value : {}
  const maxFlashHz = Math.max(1, Math.min(30, finiteOr(raw.maxFlashHz, DEFAULT_PRODUCTION_VISUAL_COMFORT.maxFlashHz)))
  return {
    disableStrobe: booleanOr(raw.disableStrobe, DEFAULT_PRODUCTION_VISUAL_COMFORT.disableStrobe),
    maxFlashHz,
    warningThresholdHz: Math.max(1, Math.min(maxFlashHz, finiteOr(raw.warningThresholdHz, DEFAULT_PRODUCTION_VISUAL_COMFORT.warningThresholdHz))),
    maxContinuousFlashSec: Math.max(0.5, Math.min(30, finiteOr(raw.maxContinuousFlashSec, DEFAULT_PRODUCTION_VISUAL_COMFORT.maxContinuousFlashSec))),
  }
}

const GROUP_MOVEMENT_GENERATORS: readonly ProductionGroupMovementGenerator[] = [
  'mirroredFan', 'fanOpen', 'fanClose', 'centerOutSpread', 'outsideInCollapse',
  'crossfire', 'tunnel', 'ceilingCanopy', 'crowdScan', 'pendulum', 'figureEight',
  'panWave', 'tiltWave', 'alternatingBanks', 'staticAerialHold',
]

export function normalizeProductionGroupMovement(value: unknown): ProductionGroupMovementConfig {
  const raw = isRecord(value) ? value : {}
  const generator = typeof raw.generator === 'string' && GROUP_MOVEMENT_GENERATORS.includes(raw.generator as ProductionGroupMovementGenerator)
    ? raw.generator as ProductionGroupMovementGenerator
    : DEFAULT_PRODUCTION_GROUP_MOVEMENT.generator
  const direction = raw.direction === 'reverse' || raw.direction === 'alternate' ? raw.direction : 'forward'
  const symmetry = raw.symmetry === 'none' || raw.symmetry === 'centerMirror' || raw.symmetry === 'alternatingBanks'
    ? raw.symmetry
    : 'mirrorPairs'
  const quantize = raw.quantize === 'none' || raw.quantize === 'beat' || raw.quantize === 'phrase'
    ? raw.quantize
    : 'bar'
  return {
    enabled: booleanOr(raw.enabled, DEFAULT_PRODUCTION_GROUP_MOVEMENT.enabled),
    generator,
    speed: Math.max(0, Math.min(16, finiteOr(raw.speed, DEFAULT_PRODUCTION_GROUP_MOVEMENT.speed))),
    amplitude: Math.max(0, Math.min(2, finiteOr(raw.amplitude, DEFAULT_PRODUCTION_GROUP_MOVEMENT.amplitude))),
    panAmplitudeDeg: Math.max(0, Math.min(270, finiteOr(raw.panAmplitudeDeg, DEFAULT_PRODUCTION_GROUP_MOVEMENT.panAmplitudeDeg))),
    tiltAmplitudeDeg: Math.max(0, Math.min(180, finiteOr(raw.tiltAmplitudeDeg, DEFAULT_PRODUCTION_GROUP_MOVEMENT.tiltAmplitudeDeg))),
    centerPoint: normalizeStageVector(raw.centerPoint, DEFAULT_PRODUCTION_GROUP_MOVEMENT.centerPoint),
    spreadDeg: Math.max(0, Math.min(270, finiteOr(raw.spreadDeg, DEFAULT_PRODUCTION_GROUP_MOVEMENT.spreadDeg))),
    direction,
    phaseOffset: finiteOr(raw.phaseOffset, DEFAULT_PRODUCTION_GROUP_MOVEMENT.phaseOffset),
    phaseSpread: finiteOr(raw.phaseSpread, DEFAULT_PRODUCTION_GROUP_MOVEMENT.phaseSpread),
    symmetry,
    quantize,
    durationBeats: Math.max(0.25, Math.min(128, finiteOr(raw.durationBeats, DEFAULT_PRODUCTION_GROUP_MOVEMENT.durationBeats))),
    snap: booleanOr(raw.snap, DEFAULT_PRODUCTION_GROUP_MOVEMENT.snap),
    easing: isMovingHeadEasing(raw.easing) ? raw.easing : DEFAULT_PRODUCTION_GROUP_MOVEMENT.easing,
    prePositionWhileShuttered: booleanOr(raw.prePositionWhileShuttered, DEFAULT_PRODUCTION_GROUP_MOVEMENT.prePositionWhileShuttered),
  }
}

export interface ProductionFixturePatch {
  universe: number
  startAddress: number
  channelFootprint: number
}

export interface ProductionFixtureInstance {
  schemaVersion: number
  id: string
  name: string
  enabled: boolean
  kind: ProductionFixtureKind
  profileId: string
  patch: ProductionFixturePatch
  groupIds: string[]
  transform: ProductionStageTransform
  targetId: string | null
  properties: ProductionFixturePropertyState
  capabilityOverrides?: ProductionFixtureCapabilityOverride
  compatibility?: {
    source: 'legacyLaserDmxRig' | 'productionRig'
    sourceSchemaVersion?: number
    validationErrors?: string[]
    migrationNotes?: string[]
  }
}

export interface ProductionFixtureGroup {
  id: string
  name: string
  fixtureIds: string[]
  parentGroupId?: string | null
  tags?: string[]
  movement?: ProductionGroupMovementConfig
  chase?: ProductionChaseSettings
}

export type ProductionLookOmissionMode = 'preserve' | 'resetIncluded'
export type ProductionLookTransitionMode =
  | 'cut'
  | 'linearFade'
  | 'easedFade'
  | 'crossfade'
  | 'blackout'
  | 'shutteredPrePosition'
  | 'colorOnly'
  | 'movementOnly'

export type ProductionLookTransitionEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export interface ProductionLookTransitionSettings {
  mode: ProductionLookTransitionMode
  durationMs: number
  easing: ProductionLookTransitionEasing
  /** Discrete/non-interpolable properties switch at this normalized point. */
  switchPoint: number
  blackoutHoldMs: number
  revealOutput: boolean
  fixtureFamilyDurationsMs: Partial<Record<ProductionFixtureKind, number>>
}

export interface ProductionLookScope {
  fixtureIds: string[]
  fixtureKinds: ProductionFixtureKind[]
  groupIds: string[]
  includeGlobal: boolean
  includeAtmosphere: boolean
  includeStage: boolean
}

export interface ProductionLookGlobalState {
  masterDimmer?: number
  blackout?: boolean
  hazeAmount?: number
  beamPersistence?: number
  glowAmount?: number
  globalBeamWidth?: number
  globalStrobeRate?: number
  safetyClamp?: number
  backgroundFade?: number
}

export interface ProductionLookAtmosphereState {
  settings?: ProductionAtmosphereSettings
  /** Fog/cryo fixtures can be armed by a look without firing a burst. */
  armedFixtureIds?: string[]
}

export interface ProductionLookStageState {
  camera?: ProductionCameraView
  activeCameraViewId?: string
}

export interface ProductionLookColorAssignment {
  mode?: LaserDmxFixture['color']['mode']
  paletteId?: string
  colorCycleSpeed?: number
}

export interface ProductionLookFixtureState {
  fixtureId: string
  properties: ProductionFixturePropertyState
  transitionMs?: number
  enabled?: boolean
  armed?: boolean
  /** Palette identity stays authored; Brand Kit resolution still occurs at render time. */
  colorAssignment?: ProductionLookColorAssignment
  movingHead?: ProductionMovingHeadSettings
  flashPattern?: ProductionFlashPatternSettings
  wash?: ProductionWashSettings
  ledBar?: ProductionLedBarSettings
  atmosphericMedium?: ProductionAtmosphericCapability['medium']
  atmospheric?: ProductionAtmosphericFixtureSettings
}

export interface ProductionLookGroupState {
  groupId: string
  properties: ProductionFixturePropertyState
  transitionMs?: number
  movement?: ProductionGroupMovementConfig
  chase?: ProductionChaseSettings
}

export interface ProductionLook {
  schemaVersion?: number
  id: string
  name: string
  description?: string
  /** Partial looks preserve omitted state unless resetIncluded is explicit. */
  omissionMode: ProductionLookOmissionMode
  scope: ProductionLookScope
  fixtureStates: ProductionLookFixtureState[]
  groupStates: ProductionLookGroupState[]
  global?: ProductionLookGlobalState
  atmosphere?: ProductionLookAtmosphereState
  stage?: ProductionLookStageState
  transition: ProductionLookTransitionSettings
  source?: 'authored' | 'beamMatrixConversion' | 'migration'
  createdAt?: string
  updatedAt?: string
}

export const DEFAULT_PRODUCTION_LOOK_TRANSITION: ProductionLookTransitionSettings = {
  mode: 'easedFade',
  durationMs: 600,
  easing: 'easeInOut',
  switchPoint: 0.5,
  blackoutHoldMs: 120,
  revealOutput: true,
  fixtureFamilyDurationsMs: {},
}

export const DEFAULT_PRODUCTION_LOOK_SCOPE: ProductionLookScope = {
  fixtureIds: [],
  fixtureKinds: [],
  groupIds: [],
  includeGlobal: true,
  includeAtmosphere: true,
  includeStage: false,
}

export type ProductionCueQuantize = 'none' | 'beat' | 'eighth' | 'sixteenth' | 'bar' | 'phrase' | 'section'
export type ProductionCueRetriggerPolicy = 'oncePerPass' | 'restart' | 'ignoreWhileActive' | 'allow'
export type ProductionCueCancellationBehavior = 'cancelOnSeek' | 'restoreOnExit' | 'holdUntilChanged' | 'complete'
export type ProductionCueActionExecution = 'simultaneous' | 'sequential'
export type ProductionCueSubdivision = 1 | 2 | 4 | 8 | 16
export type ProductionCueSectionType =
  | 'intro' | 'verse' | 'build' | 'preDrop' | 'drop' | 'breakdown' | 'bridge' | 'outro' | 'unknown'

export type ProductionChoreographyProfileId =
  | 'melodicBass'
  | 'heavyDubstep'
  | 'hybridTrap'
  | 'house'
  | 'techno'
  | 'openFormat'
  | 'custom'

export type ProductionChoreographyVariationMode = 'locked' | 'controlled'
export type ProductionManualOverridePrecedence = 'authoredFirst' | 'manualFirst'

/**
 * Genre-oriented tuning consumed by the automatic choreography layer. It is
 * deliberately expressed in musical events already published by Music
 * Intelligence; it does not own a BPM detector, beat clock, or section model.
 */
export interface ProductionChoreographyProfile {
  id: ProductionChoreographyProfileId
  label: string
  description: string
  phraseLength: 8 | 16 | 32
  beatPulseEvery: number
  downbeatAccentChance: number
  phraseMovementChance: number
  impactThreshold: number
  impactCooldownSec: number
  recoverySec: number
  maxTransientFamilies: number
  sectionIntensity: Partial<Record<ProductionCueSectionType, number>>
  beatFamilies: ProductionFixtureKind[]
  kickFamilies: ProductionFixtureKind[]
  snareFamilies: ProductionFixtureKind[]
  impactFamilies: ProductionFixtureKind[]
  movementGenerators: ProductionGroupMovementGenerator[]
}

export interface ProductionChoreographySettings {
  enabled: boolean
  profileId: ProductionChoreographyProfileId
  intensity: number
  fixtureFamilyParticipation: Record<ProductionFixtureKind, boolean>
  automaticLookChanges: boolean
  automaticMovementChanges: boolean
  impactSensitivity: number
  blackoutFrequency: number
  whiteImpactIntensity: number
  allowStrobe: boolean
  allowAtmospherics: boolean
  /** Authored cues always outrank automation. This controls manual-vs-authored order. */
  manualOverridePrecedence: ProductionManualOverridePrecedence
  manualOverrideHoldMs: number
  seed: number
  variationMode: ProductionChoreographyVariationMode
  variationAmount: number
  customProfile?: Partial<ProductionChoreographyProfile>
}

export const DEFAULT_PRODUCTION_CHOREOGRAPHY_PARTICIPATION: Readonly<Record<ProductionFixtureKind, boolean>> = {
  laserProjector: true,
  movingHeadBeam: true,
  movingHeadSpot: true,
  movingHeadWash: true,
  staticWash: true,
  strobe: true,
  blinder: true,
  ledBar: true,
  hazer: true,
  fogger: true,
  cryoJet: true,
}

export const DEFAULT_PRODUCTION_CHOREOGRAPHY: ProductionChoreographySettings = {
  enabled: true,
  profileId: 'openFormat',
  intensity: 0.65,
  fixtureFamilyParticipation: { ...DEFAULT_PRODUCTION_CHOREOGRAPHY_PARTICIPATION },
  automaticLookChanges: true,
  automaticMovementChanges: true,
  impactSensitivity: 0.55,
  blackoutFrequency: 0.2,
  whiteImpactIntensity: 0.9,
  allowStrobe: false,
  allowAtmospherics: false,
  manualOverridePrecedence: 'authoredFirst',
  manualOverrideHoldMs: 1200,
  seed: 1,
  variationMode: 'locked',
  variationAmount: 0.25,
}

export type ProductionCueTiming =
  | { mode: 'absolute'; timeSec: number }
  | {
      mode: 'musical'
      bar: number
      beat: number
      subdivision: ProductionCueSubdivision
      subdivisionIndex: number
    }
  | {
      mode: 'sectionRelative'
      sectionId?: string
      sectionType?: ProductionCueSectionType
      occurrence: number
      offsetBars: number
      offsetBeats: number
      subdivision: ProductionCueSubdivision
      subdivisionIndex: number
      offsetSec: number
    }
  | { mode: 'manual' }

export interface ProductionCueActionBase {
  /** Stable within the parent cue so diagnostics and runtime state survive reorder. */
  id: string
  /** Array order is authoritative. Sequential actions start after the preceding action. */
  execution: ProductionCueActionExecution
  delayMs?: number
  durationMs?: number
  transitionMs?: number
}

export type ProductionCueAction =
  | (ProductionCueActionBase & { type: 'activateLook'; lookId: string })
  | (ProductionCueActionBase & { type: 'fadeToLook'; lookId: string })
  | (ProductionCueActionBase & { type: 'blackout' })
  | (ProductionCueActionBase & { type: 'reveal' })
  | (ProductionCueActionBase & {
      type: 'setFixtureProperty'
      fixtureId?: string
      groupId?: string
      properties: ProductionFixturePropertyState
    })
  | (ProductionCueActionBase & { type: 'moveToTarget'; fixtureId?: string; groupId?: string; targetId: string; snap?: boolean })
  | (ProductionCueActionBase & { type: 'runMovementEffect'; groupId: string; movement: ProductionGroupMovementConfig })
  | (ProductionCueActionBase & { type: 'stopMovementEffect'; groupId: string })
  | (ProductionCueActionBase & { type: 'startChase'; groupId: string; chase: ProductionChaseSettings })
  | (ProductionCueActionBase & { type: 'stopChase'; groupId: string })
  | (ProductionCueActionBase & { type: 'pulse'; fixtureId?: string; groupId?: string; intensity: number })
  | (ProductionCueActionBase & {
      type: 'strobeBurst'
      fixtureId?: string
      groupId?: string
      pattern: ProductionFlashPatternId
      rateHz?: number
      intensity?: number
    })
  | (ProductionCueActionBase & { type: 'blinderHit'; fixtureId?: string; groupId?: string; intensity: number })
  | (ProductionCueActionBase & { type: 'fogBurst'; fixtureId?: string; groupId?: string; intensity: number })
  | (ProductionCueActionBase & { type: 'cryoBurst'; fixtureId?: string; groupId?: string; intensity: number })
  | (ProductionCueActionBase & {
      type: 'paletteChange'
      fixtureId?: string
      groupId?: string
      paletteId?: string
      color?: ProductionColorState
    })
  | (ProductionCueActionBase & { type: 'fanOpen'; groupId: string; movement?: Partial<ProductionGroupMovementConfig> })
  | (ProductionCueActionBase & { type: 'fanClose'; groupId: string; movement?: Partial<ProductionGroupMovementConfig> })
  | (ProductionCueActionBase & { type: 'gateFixtureGroup'; groupId: string; open: boolean })
  | (ProductionCueActionBase & {
      type: 'triggerLegacyBeamAction'
      legacyCueId?: string
      targetType: 'beam' | 'group'
      targetId: string
      action: 'gate' | 'trigger'
      /** Preserves musical legacy gate length without baking in a fallback BPM. */
      legacyDurationBeats?: number
    })

export interface ProductionCompoundCue {
  schemaVersion?: number
  id: string
  label: string
  description?: string
  enabled: boolean
  timing: ProductionCueTiming
  quantize: ProductionCueQuantize
  durationMs?: number
  transitionMs?: number
  priority: number
  retriggerPolicy: ProductionCueRetriggerPolicy
  cancellationBehavior: ProductionCueCancellationBehavior
  /** Optional default target used by newly inserted actions and UI summaries. */
  fixtureGroupIds: string[]
  manualOnly: boolean
  actions: ProductionCueAction[]
  source?: 'authored' | 'legacyBeamMigration' | 'preset'
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
  patch: ProductionFixturePatch
  channels: Record<string, number>
  visual?: LaserDmxFixtureFrame['visual']
}

export interface ProductionOutputFrame {
  schemaVersion: number
  rigId: string
  timestampSec: number
  rendererId: string
  adapterId: string
  /** Renderer brightness remains independent from any hardware master applied by an adapter. */
  intensityDomains: { preview: 'renderer'; hardware: 'adapter' }
  safetyMetadata: {
    audienceRegionEnabled: boolean
    exclusionZoneIds: string[]
    validationOnly: true
  }
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

export type ProductionPresetComplexity = 'low' | 'medium' | 'high' | 'extreme'

export interface ProductionPresetFixtureRequirement {
  fixtureKind: ProductionFixtureKind
  minimumCount: number
  optional?: boolean
  /** Ordered fixture-family substitutes used only for safe virtual adaptation. */
  fallbackKinds?: ProductionFixtureKind[]
}

export interface ProductionPresetCapabilityRequirement {
  id: string
  label: string
  fixtureKinds: ProductionFixtureKind[]
  optional?: boolean
}

export interface ProductionPresetMetadata {
  schemaVersion: 1
  fixtureFamilyBadges: ProductionFixtureKind[]
  complexity: ProductionPresetComplexity
  styleTags: string[]
  requiredCapabilities: ProductionPresetCapabilityRequirement[]
  rigRequirements: ProductionPresetFixtureRequirement[]
  palettePolicy: 'authored' | 'brandKitAdaptable'
  /** White remains reserved for impact fixtures even when a Brand Kit is active. */
  reserveWhiteForImpacts: boolean
  thumbnail: {
    framing: 'clubLowCeiling' | 'festivalWide' | 'aerialCanopy' | 'cathedralWide'
    activeLookId: string
  }
  performanceActionIds: string[]
  referenceVideoIds: string[]
}

export type ProductionPresetCompatibilityMode = 'full' | 'adapted' | 'partial' | 'unavailable'

export interface ProductionPresetCompatibilityDiagnostic {
  code: 'missingFixtureFamily' | 'fallbackFixtureFamily' | 'missingCapability' | 'noPlayableFixtures'
  severity: 'info' | 'warning' | 'error'
  message: string
  fixtureKind?: ProductionFixtureKind
  fallbackKind?: ProductionFixtureKind
}

export interface ProductionPresetCompatibilityResult {
  mode: ProductionPresetCompatibilityMode
  availableFixtureCounts: Partial<Record<ProductionFixtureKind, number>>
  missingRequiredKinds: ProductionFixtureKind[]
  adaptedKinds: Partial<Record<ProductionFixtureKind, ProductionFixtureKind>>
  diagnostics: ProductionPresetCompatibilityDiagnostic[]
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
    previewZoom: 1.6,
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
    editor: { guidesVisible: false, qualityTier: 'high' },
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
    previewZoom: Math.max(0.5, Math.min(3, finiteOr(raw.previewZoom, fallback.previewZoom))),
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
  'staticWash',
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
  fixtureKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadSpot', 'movingHeadWash', 'staticWash', 'strobe', 'blinder', 'ledBar', 'hazer', 'fogger', 'cryoJet'],
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
  fixtureKinds: ['laserProjector', 'movingHeadBeam', 'movingHeadSpot', 'movingHeadWash', 'staticWash', 'strobe', 'blinder', 'ledBar', 'hazer', 'fogger', 'cryoJet'],
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
    wash: { spread: { min: 0, max: 1 }, softness: { min: 0, max: 1 }, atmosphericVolume: true },
  },
  staticWash: {
    color: { mode: 'rgbw' }, dimmer: true, shutter: true,
    wash: { spread: { min: 0, max: 1 }, softness: { min: 0, max: 1 }, atmosphericVolume: true },
  },
  strobe: {
    color: { mode: 'fixedWhite', colorTemperatureKelvin: 6500 }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 }, trigger: { momentary: false, cooldownMs: 0 },
  },
  blinder: {
    color: { mode: 'fixedColor', color: '#FFD09A', label: 'Tungsten amber' }, dimmer: true, shutter: true,
    strobe: { min: 0, max: 1 },
    wash: { spread: { min: 0.35, max: 1 }, softness: { min: 0.4, max: 1 }, atmosphericVolume: true },
  },
  ledBar: {
    color: { mode: 'rgbw' }, dimmer: true, shutter: true, strobe: { min: 0, max: 1 },
    pixels: { maxSegments: 32, supportsWholeBar: true, supportsSegmentPatterns: true },
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
  | 'focus'
  | 'iris'
  | 'frost'
  | 'colorWheel'
  | 'gobo'
  | 'goboRotation'
  | 'prism'
  | 'prismRotation'
  | 'rotation'
  | 'scanSpeed'
  | 'pathComplexity'
  | 'atmosphericOutput'
  | 'trigger'
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

const movingHeadCoreChannels: readonly ProductionChannelDefinition[] = [
  { channel: 1, source: 'pan', label: 'Pan' },
  { channel: 2, source: 'tilt', label: 'Tilt' },
  { channel: 3, source: 'dimmer', label: 'Dimmer' },
  { channel: 4, source: 'shutter', label: 'Shutter' },
  { channel: 5, source: 'strobe', label: 'Strobe' },
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
  genericMovingHeadBeam: {
    schemaVersion: 1,
    id: 'genericMovingHeadBeam',
    label: 'Virtual Moving-Head Beam',
    fixtureKind: 'movingHeadBeam',
    capabilities: {
      color: { mode: 'colorWheel', slots: ['open', 'red', 'green', 'blue', 'cyan', 'magenta', 'amber', 'white'] },
      dimmer: true,
      shutter: true,
      strobe: { min: 0, max: 1 },
      panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 },
      zoom: { min: 0, max: 1 },
      focus: { min: 0, max: 1 },
      iris: { min: 0, max: 1 },
      frost: { min: 0, max: 1 },
      gobo: { slots: ['open', 'dots', 'bars', 'triangle', 'star'], rotation: true },
      prism: { facets: [3, 8], rotation: true },
    },
    channels: [
      ...movingHeadCoreChannels,
      { channel: 6, source: 'colorWheel', label: 'Color wheel' },
      { channel: 7, source: 'gobo', label: 'Gobo' },
      { channel: 8, source: 'goboRotation', label: 'Gobo rotation' },
      { channel: 9, source: 'prism', label: 'Prism' },
      { channel: 10, source: 'prismRotation', label: 'Prism rotation' },
      { channel: 11, source: 'zoom', label: 'Zoom' },
      { channel: 12, source: 'focus', label: 'Focus' },
      { channel: 13, source: 'iris', label: 'Iris' },
      { channel: 14, source: 'frost', label: 'Frost' },
    ],
  },
  genericMovingHeadSpot: {
    schemaVersion: 1,
    id: 'genericMovingHeadSpot',
    label: 'Virtual Moving-Head Spot',
    fixtureKind: 'movingHeadSpot',
    capabilities: {
      color: { mode: 'colorWheel', slots: ['open', 'red', 'green', 'blue', 'cyan', 'magenta', 'amber', 'white'] },
      dimmer: true,
      shutter: true,
      strobe: { min: 0, max: 1 },
      panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 },
      zoom: { min: 0, max: 1 },
      focus: { min: 0, max: 1 },
      iris: { min: 0, max: 1 },
      frost: { min: 0, max: 1 },
      gobo: { slots: ['open', 'breakup', 'window', 'star', 'rings'], rotation: true },
      prism: { facets: [3], rotation: true },
    },
    channels: [
      ...movingHeadCoreChannels,
      { channel: 6, source: 'colorWheel', label: 'Color wheel' },
      { channel: 7, source: 'gobo', label: 'Gobo' },
      { channel: 8, source: 'goboRotation', label: 'Gobo rotation' },
      { channel: 9, source: 'zoom', label: 'Zoom' },
      { channel: 10, source: 'focus', label: 'Focus' },
      { channel: 11, source: 'iris', label: 'Iris' },
      { channel: 12, source: 'frost', label: 'Frost' },
      { channel: 13, source: 'prism', label: 'Prism' },
      { channel: 14, source: 'prismRotation', label: 'Prism rotation' },
    ],
  },
  genericMovingHeadWash: {
    schemaVersion: 1,
    id: 'genericMovingHeadWash',
    label: 'Virtual Moving-Head Wash',
    fixtureKind: 'movingHeadWash',
    capabilities: {
      color: { mode: 'rgbw' },
      dimmer: true,
      shutter: true,
      strobe: { min: 0, max: 1 },
      panTilt: { panRangeDeg: 540, tiltRangeDeg: 270 },
      zoom: { min: 0, max: 1 },
      frost: { min: 0, max: 1 },
      wash: { spread: { min: 0, max: 1 }, softness: { min: 0, max: 1 }, atmosphericVolume: true },
    },
    channels: [
      ...movingHeadCoreChannels,
      { channel: 6, source: 'red', label: 'Red' },
      { channel: 7, source: 'green', label: 'Green' },
      { channel: 8, source: 'blue', label: 'Blue' },
      { channel: 9, source: 'white', label: 'White' },
      { channel: 10, source: 'zoom', label: 'Zoom' },
      { channel: 11, source: 'frost', label: 'Frost' },
    ],
  },
  genericStaticWash: {
    schemaVersion: 1,
    id: 'genericStaticWash',
    label: 'Virtual Static Wash',
    fixtureKind: 'staticWash',
    capabilities: {
      ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.staticWash,
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'red', label: 'Red' },
      { channel: 4, source: 'green', label: 'Green' },
      { channel: 5, source: 'blue', label: 'Blue' },
      { channel: 6, source: 'white', label: 'White' },
    ],
  },
  genericWhiteStrobe: {
    schemaVersion: 1,
    id: 'genericWhiteStrobe',
    label: 'Virtual White Strobe',
    fixtureKind: 'strobe',
    capabilities: {
      ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.strobe,
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'strobe', label: 'Flash rate' },
    ],
  },
  genericRgbwStrobe: {
    schemaVersion: 1,
    id: 'genericRgbwStrobe',
    label: 'Virtual RGBW Strobe',
    fixtureKind: 'strobe',
    capabilities: {
      color: { mode: 'rgbw' },
      dimmer: true,
      shutter: true,
      strobe: { min: 0, max: 1 },
      trigger: { momentary: false, cooldownMs: 0 },
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'strobe', label: 'Flash rate' },
      { channel: 4, source: 'red', label: 'Red' },
      { channel: 5, source: 'green', label: 'Green' },
      { channel: 6, source: 'blue', label: 'Blue' },
      { channel: 7, source: 'white', label: 'White' },
    ],
  },
  genericAudienceBlinder: {
    schemaVersion: 1,
    id: 'genericAudienceBlinder',
    label: 'Virtual Audience Blinder',
    fixtureKind: 'blinder',
    capabilities: {
      ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.blinder,
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'strobe', label: 'Flash rate' },
    ],
  },
  genericLedBar: {
    schemaVersion: 1,
    id: 'genericLedBar',
    label: 'Virtual LED Pixel Bar',
    fixtureKind: 'ledBar',
    capabilities: {
      ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.ledBar,
    },
    channels: [
      { channel: 1, source: 'dimmer', label: 'Dimmer' },
      { channel: 2, source: 'shutter', label: 'Shutter' },
      { channel: 3, source: 'strobe', label: 'Flash rate' },
      { channel: 4, source: 'red', label: 'Red' },
      { channel: 5, source: 'green', label: 'Green' },
      { channel: 6, source: 'blue', label: 'Blue' },
      { channel: 7, source: 'white', label: 'White' },
    ],
  },
  genericHazer: {
    schemaVersion: 1,
    id: 'genericHazer',
    label: 'Virtual Hazer',
    fixtureKind: 'hazer',
    capabilities: { ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.hazer },
    channels: [{ channel: 1, source: 'atmosphericOutput', label: 'Haze output' }],
  },
  genericFogger: {
    schemaVersion: 1,
    id: 'genericFogger',
    label: 'Virtual Fog Emitter',
    fixtureKind: 'fogger',
    capabilities: { ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.fogger },
    channels: [
      { channel: 1, source: 'atmosphericOutput', label: 'Fog output' },
      { channel: 2, source: 'trigger', label: 'Virtual trigger' },
    ],
  },
  genericCryoJet: {
    schemaVersion: 1,
    id: 'genericCryoJet',
    label: 'Virtual CO₂-Style Jet',
    fixtureKind: 'cryoJet',
    capabilities: { ...PRODUCTION_FIXTURE_KIND_CAPABILITIES.cryoJet },
    channels: [{ channel: 1, source: 'trigger', label: 'Virtual trigger' }],
  },
}

export type ProductionRigDiagnosticCode =
  | 'invalidPosition'
  | 'missingProfile'
  | 'duplicateFixtureId'
  | 'fixtureOutsideStageBounds'
  | 'unresolvedTarget'
  | 'invalidEmitterParameters'
  | 'excessiveParticleBudget'
  | 'cooldownConflict'
  | 'unsupportedRendererCapability'

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

function hasInvalidAtmosphericParameters(rawFixture: unknown): boolean {
  if (!isRecord(rawFixture) || !isRecord(rawFixture.atmospheric)) return false
  const atmospheric = rawFixture.atmospheric
  const bounded: Array<[string, number, number]> = [
    ['outputLevel', 0, 1],
    ['outputDurationSec', 0.05, 60],
    ['plumeVelocity', 0, 30],
    ['spread', 0.02, 4],
    ['density', 0, 1],
    ['turbulence', 0, 1],
    ['driftSpeed', 0, 5],
    ['dissipation', 0, 1],
    ['warmupSec', 0, 30],
    ['cooldownSec', 0, 120],
    ['height', 0.1, 30],
    ['triggerRequestId', 0, Number.MAX_SAFE_INTEGER],
  ]
  if (bounded.some(([key, min, max]) => key in atmospheric && (!isFiniteNumber(atmospheric[key]) || atmospheric[key] < min || atmospheric[key] > max))) return true
  if ('driftDirectionDeg' in atmospheric && !isFiniteNumber(atmospheric.driftDirectionDeg)) return true
  if ('seed' in atmospheric && !isFiniteNumber(atmospheric.seed)) return true
  if ('orientationMode' in atmospheric && atmospheric.orientationMode !== 'vertical' && atmospheric.orientationMode !== 'fixtureOrientation') return true
  if ('retriggerPolicy' in atmospheric && atmospheric.retriggerPolicy !== 'restart' && atmospheric.retriggerPolicy !== 'ignoreWhileActive' && atmospheric.retriggerPolicy !== 'extend') return true
  return false
}

export function diagnoseProductionRig(
  settingsInput: unknown,
  rendererCapabilities: ProductionRendererCapabilities = LASER_DMX_VIRTUAL_RENDERER_CAPABILITIES,
): ProductionRigDiagnostic[] {
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
  const atmosphere = normalizeProductionAtmosphereSettings(settings.atmosphere)
  const tierBudget = PRODUCTION_ATMOSPHERE_PARTICLE_BUDGETS[atmosphere.qualityTier]
  if (atmosphere.maxParticleBudget > tierBudget) {
    diagnostics.push({
      code: 'excessiveParticleBudget',
      severity: 'warning',
      message: `Atmosphere particle budget ${atmosphere.maxParticleBudget} exceeds the ${atmosphere.qualityTier}-tier limit of ${tierBudget}; rendering will clamp to the tier limit.`,
    })
  }
  for (const [fixtureIndex, fixture] of settings.fixtures.entries()) {
    if (fixture.fixtureKind !== 'hazer' && fixture.fixtureKind !== 'fogger' && fixture.fixtureKind !== 'cryoJet') continue
    const medium = fixture.fixtureKind === 'hazer' ? 'haze' : fixture.fixtureKind === 'fogger' ? 'fog' : 'cryo'
    const emitter = normalizeProductionAtmosphericFixtureSettings(fixture.atmospheric, medium)
    if (hasInvalidAtmosphericParameters(rawFixtures[fixtureIndex]) || emitter.density <= 0 || emitter.spread <= 0 || emitter.height <= 0) {
      diagnostics.push({
        code: 'invalidEmitterParameters',
        severity: 'error',
        fixtureId: fixture.id,
        message: `${fixture.name} has invalid or unusable emitter parameters; safe normalized values will be used.`,
      })
    }
    const profileCooldownSec = (getLaserDmxFixtureProfile(fixture.dmx.profileId)?.capabilities.trigger?.cooldownMs ?? 0) / 1000
    if (fixture.fixtureKind !== 'hazer' && emitter.cooldownSec < Math.max(profileCooldownSec, emitter.outputDurationSec * 0.25)) {
      diagnostics.push({
        code: 'cooldownConflict',
        severity: 'warning',
        fixtureId: fixture.id,
        message: `${fixture.name} cooldown is shorter than its profile or burst-duration guard.`,
      })
    }
    if (!rendererCapabilities.supportsAtmospherics || !rendererCapabilities.fixtureKinds.includes(fixture.fixtureKind)) {
      diagnostics.push({
        code: 'unsupportedRendererCapability',
        severity: 'error',
        fixtureId: fixture.id,
        message: `${fixture.name} requires atmospheric rendering support that the active renderer does not declare.`,
      })
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
 * Distinguishes an actual persisted legacy LaserDMX rig document from unrelated or
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

export function isMovingHeadFixtureKind(value: ProductionFixtureKind | undefined): value is 'movingHeadBeam' | 'movingHeadSpot' | 'movingHeadWash' {
  return value === 'movingHeadBeam' || value === 'movingHeadSpot' || value === 'movingHeadWash'
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
  if (capabilities.color?.mode === 'fixedColor' && !/^#[0-9a-f]{6}$/i.test(capabilities.color.color)) {
    issues.push({ severity: 'error', path: `${path}.color.color`, message: 'Fixed color must be a six-digit hex color' })
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
  if (capabilities.wash) {
    validateRange(capabilities.wash.spread, `${path}.wash.spread`, issues)
    validateRange(capabilities.wash.softness, `${path}.wash.softness`, issues)
  }
  if (capabilities.pixels && (!Number.isInteger(capabilities.pixels.maxSegments) || capabilities.pixels.maxSegments < 1 || capabilities.pixels.maxSegments > 512)) {
    issues.push({ severity: 'error', path: `${path}.pixels.maxSegments`, message: 'Pixel segment count must be an integer between 1 and 512' })
  }
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
        source === 'colorWheel' && capabilities.color?.mode === 'colorWheel' ||
        (source === 'pan' || source === 'tilt') && Boolean(capabilities.panTilt) ||
        source === 'zoom' && Boolean(capabilities.zoom) ||
        source === 'focus' && Boolean(capabilities.focus) ||
        source === 'iris' && Boolean(capabilities.iris) ||
        source === 'frost' && Boolean(capabilities.frost) ||
        (source === 'gobo' || source === 'goboRotation') && Boolean(capabilities.gobo) ||
        (source === 'prism' || source === 'prismRotation') && Boolean(capabilities.prism) ||
        source === 'rotation' && Boolean(capabilities.beamPattern) ||
        (source === 'scanSpeed' || source === 'pathComplexity') && Boolean(capabilities.beamPattern) ||
        source === 'atmosphericOutput' && Boolean(capabilities.atmosphericOutput) ||
        source === 'trigger' && Boolean(capabilities.trigger)
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
  focus?: number
  iris?: number
  frost?: number
  colorWheel?: number
  gobo?: number
  goboRotation?: number
  prism?: number
  prismRotation?: number
  rotation: number
  scanSpeed: number
  pathComplexity: number
  atmosphericOutput?: number
  trigger?: number
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
    channels[`ch${definition.channel}`] = values[definition.source] ?? 0
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
  const declaredFixtureKind = isFixtureKind(raw.fixtureKind) ? raw.fixtureKind : null
  // A registered profile is the capability and fixture-family source of truth.
  // Older persisted data may contain a stale duplicated fixtureKind field.
  const fixtureKind = profile?.fixtureKind ?? declaredFixtureKind ?? 'laserProjector'
  const existingMigrationNotes = Array.isArray(compatibility.migrationNotes)
    ? compatibility.migrationNotes.filter((note): note is string => typeof note === 'string')
    : []
  const kindMigrationNote = profile && declaredFixtureKind && declaredFixtureKind !== profile.fixtureKind
    ? `Repaired fixture kind "${declaredFixtureKind}" to match profile "${profile.id}" (${profile.fixtureKind}).`
    : null

  return {
    ...fallback,
    ...raw,
    schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
    fixtureKind,
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
    ...(isMovingHeadFixtureKind(fixtureKind)
      ? { movingHead: normalizeProductionMovingHeadSettings(raw.movingHead) }
      : { movingHead: undefined }),
    ...(isRecord(raw.colorPolicy)
      ? { colorPolicy: normalizeProductionFixtureColorPolicy(raw.colorPolicy) }
      : { colorPolicy: undefined }),
    ...(resolvedCapabilities?.strobe ? { flashPattern: normalizeProductionFlashPattern(raw.flashPattern) } : { flashPattern: undefined }),
    ...(resolvedCapabilities?.wash ? { wash: normalizeProductionWashSettings(raw.wash) } : { wash: undefined }),
    ...(resolvedCapabilities?.pixels ? { ledBar: normalizeProductionLedBarSettings(raw.ledBar, resolvedCapabilities.pixels.maxSegments) } : { ledBar: undefined }),
    ...(resolvedCapabilities?.atmosphericOutput
      ? { atmospheric: normalizeProductionAtmosphericFixtureSettings(raw.atmospheric, resolvedCapabilities.atmosphericOutput.medium) }
      : { atmospheric: undefined }),
    ...(isRecord(raw.stageTransform) ? { stageTransform: raw.stageTransform as unknown as ProductionStageTransform } : {}),
    compatibility: {
      ...compatibility,
      source: 'legacyLaserDmxRig',
      sourceSchemaVersion: isFiniteNumber(compatibility.sourceSchemaVersion)
        ? compatibility.sourceSchemaVersion
        : (isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : 0),
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      migrationNotes: kindMigrationNote
        ? [...new Set([...existingMigrationNotes, kindMigrationNote])]
        : (existingMigrationNotes.length > 0 ? existingMigrationNotes : undefined),
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


const PRODUCTION_LOOK_TRANSITION_MODES: readonly ProductionLookTransitionMode[] = [
  'cut', 'linearFade', 'easedFade', 'crossfade', 'blackout', 'shutteredPrePosition', 'colorOnly', 'movementOnly',
]
const PRODUCTION_LOOK_EASINGS: readonly ProductionLookTransitionEasing[] = ['linear', 'easeIn', 'easeOut', 'easeInOut']

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : []
}

function normalizeProductionColorState(value: unknown): ProductionColorState | undefined {
  if (!isRecord(value)) return undefined
  const color: ProductionColorState = {}
  if (isFiniteNumber(value.red)) color.red = Math.max(0, Math.min(255, value.red))
  if (isFiniteNumber(value.green)) color.green = Math.max(0, Math.min(255, value.green))
  if (isFiniteNumber(value.blue)) color.blue = Math.max(0, Math.min(255, value.blue))
  if (isFiniteNumber(value.white)) color.white = Math.max(0, Math.min(255, value.white))
  if (isFiniteNumber(value.wheelSlot)) color.wheelSlot = Math.max(0, Math.round(value.wheelSlot))
  if (isFiniteNumber(value.fixedWhiteIntensity)) color.fixedWhiteIntensity = Math.max(0, Math.min(1, value.fixedWhiteIntensity))
  return Object.keys(color).length > 0 ? color : undefined
}

export function normalizeProductionFixturePropertyState(value: unknown): ProductionFixturePropertyState {
  const raw = isRecord(value) ? value : {}
  const result: ProductionFixturePropertyState = {}
  const unitKeys: Array<keyof ProductionFixturePropertyState> = [
    'dimmer', 'strobeRate', 'zoom', 'focus', 'iris', 'frost', 'atmosphericOutput', 'washSpread', 'washSoftness',
  ]
  for (const key of unitKeys) {
    if (isFiniteNumber(raw[key])) (result as Record<string, unknown>)[key] = Math.max(0, Math.min(1, raw[key] as number))
  }
  const numericKeys: Array<keyof ProductionFixturePropertyState> = [
    'panDeg', 'tiltDeg', 'goboRotation', 'prismRotation', 'colorWheelSlot', 'goboIndex', 'prismFacets', 'pixelSegmentCount',
  ]
  for (const key of numericKeys) {
    if (isFiniteNumber(raw[key])) (result as Record<string, unknown>)[key] = raw[key]
  }
  if (typeof raw.shutterOpen === 'boolean') result.shutterOpen = raw.shutterOpen
  if (typeof raw.triggered === 'boolean') result.triggered = raw.triggered
  if (typeof raw.beamPatternId === 'string') result.beamPatternId = raw.beamPatternId
  if (typeof raw.flashPatternId === 'string' && FLASH_PATTERNS.includes(raw.flashPatternId as ProductionFlashPatternId)) {
    result.flashPatternId = raw.flashPatternId as ProductionFlashPatternId
  }
  const color = normalizeProductionColorState(raw.color)
  if (color) result.color = color
  return result
}

export function normalizeProductionLookTransition(value: unknown): ProductionLookTransitionSettings {
  const raw = isRecord(value) ? value : {}
  const mode = typeof raw.mode === 'string' && PRODUCTION_LOOK_TRANSITION_MODES.includes(raw.mode as ProductionLookTransitionMode)
    ? raw.mode as ProductionLookTransitionMode
    : DEFAULT_PRODUCTION_LOOK_TRANSITION.mode
  const easing = typeof raw.easing === 'string' && PRODUCTION_LOOK_EASINGS.includes(raw.easing as ProductionLookTransitionEasing)
    ? raw.easing as ProductionLookTransitionEasing
    : DEFAULT_PRODUCTION_LOOK_TRANSITION.easing
  const familyDurations = isRecord(raw.fixtureFamilyDurationsMs) ? raw.fixtureFamilyDurationsMs : {}
  const fixtureFamilyDurationsMs: Partial<Record<ProductionFixtureKind, number>> = {}
  for (const kind of ALL_PRODUCTION_FIXTURE_KINDS) {
    if (isFiniteNumber(familyDurations[kind])) fixtureFamilyDurationsMs[kind] = Math.max(0, Math.min(60000, familyDurations[kind] as number))
  }
  return {
    mode,
    durationMs: Math.max(0, Math.min(60000, finiteOr(raw.durationMs, DEFAULT_PRODUCTION_LOOK_TRANSITION.durationMs))),
    easing,
    switchPoint: Math.max(0, Math.min(1, finiteOr(raw.switchPoint, DEFAULT_PRODUCTION_LOOK_TRANSITION.switchPoint))),
    blackoutHoldMs: Math.max(0, Math.min(10000, finiteOr(raw.blackoutHoldMs, DEFAULT_PRODUCTION_LOOK_TRANSITION.blackoutHoldMs))),
    revealOutput: booleanOr(raw.revealOutput, DEFAULT_PRODUCTION_LOOK_TRANSITION.revealOutput),
    fixtureFamilyDurationsMs,
  }
}

export function normalizeProductionLook(value: unknown, index = 0): ProductionLook {
  const raw = isRecord(value) ? value : {}
  const rawScope = isRecord(raw.scope) ? raw.scope : {}
  const scope: ProductionLookScope = {
    fixtureIds: normalizeStringArray(rawScope.fixtureIds),
    fixtureKinds: Array.isArray(rawScope.fixtureKinds)
      ? [...new Set(rawScope.fixtureKinds.filter(isFixtureKind))]
      : [],
    groupIds: normalizeStringArray(rawScope.groupIds),
    includeGlobal: booleanOr(rawScope.includeGlobal, true),
    includeAtmosphere: booleanOr(rawScope.includeAtmosphere, true),
    includeStage: booleanOr(rawScope.includeStage, false),
  }
  const fixtureStates = normalizeArray<unknown>(raw.fixtureStates).flatMap(entry => {
    if (!isRecord(entry)) return []
    const fixtureId = stringOr(entry.fixtureId, '')
    if (!fixtureId) return []
    const colorAssignmentRaw = isRecord(entry.colorAssignment) ? entry.colorAssignment : null
    const colorMode = colorAssignmentRaw?.mode === 'palette' || colorAssignmentRaw?.mode === 'music' || colorAssignmentRaw?.mode === 'fixed'
      ? colorAssignmentRaw.mode as LaserDmxFixture['color']['mode']
      : undefined
    return [{
      fixtureId,
      properties: normalizeProductionFixturePropertyState(entry.properties),
      ...(isFiniteNumber(entry.transitionMs) ? { transitionMs: Math.max(0, Math.min(60000, entry.transitionMs)) } : {}),
      ...(typeof entry.enabled === 'boolean' ? { enabled: entry.enabled } : {}),
      ...(typeof entry.armed === 'boolean' ? { armed: entry.armed } : {}),
      ...(colorAssignmentRaw ? {
        colorAssignment: {
          ...(colorMode ? { mode: colorMode } : {}),
          ...(typeof colorAssignmentRaw.paletteId === 'string' ? { paletteId: colorAssignmentRaw.paletteId } : {}),
          ...(isFiniteNumber(colorAssignmentRaw.colorCycleSpeed)
            ? { colorCycleSpeed: Math.max(0, Math.min(8, colorAssignmentRaw.colorCycleSpeed)) }
            : {}),
        },
      } : {}),
      ...(entry.movingHead ? { movingHead: normalizeProductionMovingHeadSettings(entry.movingHead) } : {}),
      ...(entry.flashPattern ? { flashPattern: normalizeProductionFlashPattern(entry.flashPattern) } : {}),
      ...(entry.wash ? { wash: normalizeProductionWashSettings(entry.wash) } : {}),
      ...(entry.ledBar ? { ledBar: normalizeProductionLedBarSettings(entry.ledBar) } : {}),
      ...(entry.atmospheric ? {
        atmosphericMedium: entry.atmosphericMedium === 'haze' || entry.atmosphericMedium === 'cryo' ? entry.atmosphericMedium : 'fog',
        atmospheric: normalizeProductionAtmosphericFixtureSettings(
          entry.atmospheric,
          entry.atmosphericMedium === 'haze' || entry.atmosphericMedium === 'cryo' ? entry.atmosphericMedium : 'fog',
        ),
      } : {}),
    } satisfies ProductionLookFixtureState]
  })
  const groupStates = normalizeArray<unknown>(raw.groupStates).flatMap(entry => {
    if (!isRecord(entry)) return []
    const groupId = stringOr(entry.groupId, '')
    if (!groupId) return []
    return [{
      groupId,
      properties: normalizeProductionFixturePropertyState(entry.properties),
      ...(isFiniteNumber(entry.transitionMs) ? { transitionMs: Math.max(0, Math.min(60000, entry.transitionMs)) } : {}),
      ...(entry.movement ? { movement: normalizeProductionGroupMovement(entry.movement) } : {}),
      ...(entry.chase ? { chase: normalizeProductionChase(entry.chase) } : {}),
    } satisfies ProductionLookGroupState]
  })
  const global = isRecord(raw.global) ? {
    ...(isFiniteNumber(raw.global.masterDimmer) ? { masterDimmer: Math.max(0, Math.min(1, raw.global.masterDimmer)) } : {}),
    ...(typeof raw.global.blackout === 'boolean' ? { blackout: raw.global.blackout } : {}),
    ...(isFiniteNumber(raw.global.hazeAmount) ? { hazeAmount: Math.max(0, Math.min(1, raw.global.hazeAmount)) } : {}),
    ...(isFiniteNumber(raw.global.beamPersistence) ? { beamPersistence: Math.max(0, Math.min(1, raw.global.beamPersistence)) } : {}),
    ...(isFiniteNumber(raw.global.glowAmount) ? { glowAmount: Math.max(0, Math.min(1, raw.global.glowAmount)) } : {}),
    ...(isFiniteNumber(raw.global.globalBeamWidth) ? { globalBeamWidth: Math.max(0.2, Math.min(8, raw.global.globalBeamWidth)) } : {}),
    ...(isFiniteNumber(raw.global.globalStrobeRate) ? { globalStrobeRate: Math.max(0, Math.min(1, raw.global.globalStrobeRate)) } : {}),
    ...(isFiniteNumber(raw.global.safetyClamp) ? { safetyClamp: Math.max(0, Math.min(1, raw.global.safetyClamp)) } : {}),
    ...(isFiniteNumber(raw.global.backgroundFade) ? { backgroundFade: Math.max(0, Math.min(1, raw.global.backgroundFade)) } : {}),
  } satisfies ProductionLookGlobalState : undefined
  const rawAtmosphere = isRecord(raw.atmosphere) ? raw.atmosphere : null
  const atmosphere = rawAtmosphere ? {
    ...(rawAtmosphere.settings ? { settings: normalizeProductionAtmosphereSettings(rawAtmosphere.settings) } : {}),
    ...(Array.isArray(rawAtmosphere.armedFixtureIds) ? { armedFixtureIds: normalizeStringArray(rawAtmosphere.armedFixtureIds) } : {}),
  } satisfies ProductionLookAtmosphereState : undefined
  const rawStage = isRecord(raw.stage) ? raw.stage : null
  const stage = rawStage ? {
    ...(isRecord(rawStage.camera) ? { camera: normalizeCameraView(rawStage.camera, createDefaultProductionStageModel().camera) } : {}),
    ...(typeof rawStage.activeCameraViewId === 'string' ? { activeCameraViewId: rawStage.activeCameraViewId } : {}),
  } satisfies ProductionLookStageState : undefined
  const source = raw.source === 'beamMatrixConversion' || raw.source === 'migration'
    ? raw.source
    : 'authored'
  return {
    schemaVersion: 1,
    id: stringOr(raw.id, `production-look:${index + 1}`),
    name: stringOr(raw.name, `Look ${index + 1}`),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    omissionMode: raw.omissionMode === 'resetIncluded' ? 'resetIncluded' : 'preserve',
    scope,
    fixtureStates,
    groupStates,
    ...(global && Object.keys(global).length > 0 ? { global } : {}),
    ...(atmosphere && Object.keys(atmosphere).length > 0 ? { atmosphere } : {}),
    ...(stage && Object.keys(stage).length > 0 ? { stage } : {}),
    transition: normalizeProductionLookTransition(raw.transition),
    source,
    ...(typeof raw.createdAt === 'string' ? { createdAt: raw.createdAt } : {}),
    ...(typeof raw.updatedAt === 'string' ? { updatedAt: raw.updatedAt } : {}),
  }
}


const PRODUCTION_CUE_QUANTIZE: readonly ProductionCueQuantize[] = ['none', 'beat', 'eighth', 'sixteenth', 'bar', 'phrase', 'section']
const PRODUCTION_CUE_RETRIGGER: readonly ProductionCueRetriggerPolicy[] = ['oncePerPass', 'restart', 'ignoreWhileActive', 'allow']
const PRODUCTION_CUE_CANCELLATION: readonly ProductionCueCancellationBehavior[] = ['cancelOnSeek', 'restoreOnExit', 'holdUntilChanged', 'complete']
const PRODUCTION_CUE_SECTION_TYPES: readonly ProductionCueSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown']
const PRODUCTION_CUE_SUBDIVISIONS: readonly ProductionCueSubdivision[] = [1, 2, 4, 8, 16]

function normalizeProductionCueTiming(value: unknown): ProductionCueTiming {
  const raw = isRecord(value) ? value : {}
  if (raw.mode === 'manual') return { mode: 'manual' }
  if (raw.mode === 'absolute') {
    return { mode: 'absolute', timeSec: Math.max(0, finiteOr(raw.timeSec, finiteOr(raw.startSec, 0))) }
  }
  if (raw.mode === 'sectionRelative') {
    const subdivision = PRODUCTION_CUE_SUBDIVISIONS.includes(raw.subdivision as ProductionCueSubdivision)
      ? raw.subdivision as ProductionCueSubdivision
      : 1
    const sectionType = typeof raw.sectionType === 'string' && PRODUCTION_CUE_SECTION_TYPES.includes(raw.sectionType as ProductionCueSectionType)
      ? raw.sectionType as ProductionCueSectionType
      : undefined
    return {
      mode: 'sectionRelative',
      ...(typeof raw.sectionId === 'string' && raw.sectionId ? { sectionId: raw.sectionId } : {}),
      ...(sectionType ? { sectionType } : {}),
      occurrence: Math.max(1, Math.round(finiteOr(raw.occurrence, 1))),
      offsetBars: Math.max(-10000, Math.min(10000, Math.round(finiteOr(raw.offsetBars, 0)))),
      offsetBeats: Math.max(-64, Math.min(64, finiteOr(raw.offsetBeats, 0))),
      subdivision,
      subdivisionIndex: Math.max(0, Math.min(subdivision - 1, Math.round(finiteOr(raw.subdivisionIndex, 0)))),
      offsetSec: finiteOr(raw.offsetSec, 0),
    }
  }
  const subdivision = PRODUCTION_CUE_SUBDIVISIONS.includes(raw.subdivision as ProductionCueSubdivision)
    ? raw.subdivision as ProductionCueSubdivision
    : 1
  return {
    mode: 'musical',
    bar: Math.max(1, Math.round(finiteOr(raw.bar, finiteOr(raw.startBar, 1)))),
    beat: Math.max(1, Math.round(finiteOr(raw.beat, finiteOr(raw.startBeat, 1)))),
    subdivision,
    subdivisionIndex: Math.max(0, Math.min(subdivision - 1, Math.round(finiteOr(raw.subdivisionIndex, 0)))),
  }
}

function cueActionBase(raw: Record<string, unknown>, fallbackId: string): ProductionCueActionBase {
  return {
    id: stringOr(raw.id, fallbackId),
    execution: raw.execution === 'sequential' ? 'sequential' : 'simultaneous',
    ...(isFiniteNumber(raw.delayMs) ? { delayMs: Math.max(0, Math.min(600000, raw.delayMs)) } : {}),
    ...(isFiniteNumber(raw.durationMs) ? { durationMs: Math.max(0, Math.min(600000, raw.durationMs)) } : {}),
    ...(isFiniteNumber(raw.transitionMs) ? { transitionMs: Math.max(0, Math.min(600000, raw.transitionMs)) } : {}),
  }
}

function normalizeProductionChoreographyCustomProfile(value: unknown): Partial<ProductionChoreographyProfile> | undefined {
  if (!isRecord(value)) return undefined
  const result: Partial<ProductionChoreographyProfile> = {}
  if (typeof value.label === 'string' && value.label.trim()) result.label = value.label.trim()
  if (typeof value.description === 'string') result.description = value.description.trim()
  if (value.phraseLength === 8 || value.phraseLength === 16 || value.phraseLength === 32) result.phraseLength = value.phraseLength
  if (isFiniteNumber(value.beatPulseEvery)) result.beatPulseEvery = Math.max(1, Math.min(32, Math.round(value.beatPulseEvery)))
  if (isFiniteNumber(value.downbeatAccentChance)) result.downbeatAccentChance = Math.max(0, Math.min(1, value.downbeatAccentChance))
  if (isFiniteNumber(value.phraseMovementChance)) result.phraseMovementChance = Math.max(0, Math.min(1, value.phraseMovementChance))
  if (isFiniteNumber(value.impactThreshold)) result.impactThreshold = Math.max(0, Math.min(1, value.impactThreshold))
  if (isFiniteNumber(value.impactCooldownSec)) result.impactCooldownSec = Math.max(0.1, Math.min(30, value.impactCooldownSec))
  if (isFiniteNumber(value.recoverySec)) result.recoverySec = Math.max(0.05, Math.min(30, value.recoverySec))
  if (isFiniteNumber(value.maxTransientFamilies)) result.maxTransientFamilies = Math.max(1, Math.min(4, Math.round(value.maxTransientFamilies)))

  if (isRecord(value.sectionIntensity)) {
    const sectionIntensity: Partial<Record<ProductionCueSectionType, number>> = {}
    const sectionTypes: readonly ProductionCueSectionType[] = [
      'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
    ]
    for (const section of sectionTypes) {
      if (isFiniteNumber(value.sectionIntensity[section])) {
        sectionIntensity[section] = Math.max(0, Math.min(1, value.sectionIntensity[section]))
      }
    }
    result.sectionIntensity = sectionIntensity
  }

  const normalizeFamilies = (candidate: unknown): ProductionFixtureKind[] | undefined => Array.isArray(candidate)
    ? [...new Set(candidate.filter(isFixtureKind))]
    : undefined
  const beatFamilies = normalizeFamilies(value.beatFamilies)
  const kickFamilies = normalizeFamilies(value.kickFamilies)
  const snareFamilies = normalizeFamilies(value.snareFamilies)
  const impactFamilies = normalizeFamilies(value.impactFamilies)
  if (beatFamilies) result.beatFamilies = beatFamilies
  if (kickFamilies) result.kickFamilies = kickFamilies
  if (snareFamilies) result.snareFamilies = snareFamilies
  if (impactFamilies) result.impactFamilies = impactFamilies
  if (Array.isArray(value.movementGenerators)) {
    result.movementGenerators = [...new Set(value.movementGenerators.filter((generator): generator is ProductionGroupMovementGenerator =>
      typeof generator === 'string' && GROUP_MOVEMENT_GENERATORS.includes(generator as ProductionGroupMovementGenerator),
    ))]
  }
  return result
}

export function normalizeProductionChoreographySettings(value: unknown): ProductionChoreographySettings {
  const raw = isRecord(value) ? value : {}
  const participationRaw = isRecord(raw.fixtureFamilyParticipation) ? raw.fixtureFamilyParticipation : {}
  const fixtureFamilyParticipation = { ...DEFAULT_PRODUCTION_CHOREOGRAPHY_PARTICIPATION }
  for (const kind of ALL_PRODUCTION_FIXTURE_KINDS) {
    fixtureFamilyParticipation[kind] = booleanOr(
      participationRaw[kind],
      DEFAULT_PRODUCTION_CHOREOGRAPHY_PARTICIPATION[kind],
    )
  }
  const profileIds: readonly ProductionChoreographyProfileId[] = [
    'melodicBass', 'heavyDubstep', 'hybridTrap', 'house', 'techno', 'openFormat', 'custom',
  ]
  const profileId = typeof raw.profileId === 'string' && profileIds.includes(raw.profileId as ProductionChoreographyProfileId)
    ? raw.profileId as ProductionChoreographyProfileId
    : DEFAULT_PRODUCTION_CHOREOGRAPHY.profileId
  const variationMode: ProductionChoreographyVariationMode = raw.variationMode === 'controlled' ? 'controlled' : 'locked'
  const manualOverridePrecedence: ProductionManualOverridePrecedence = raw.manualOverridePrecedence === 'manualFirst'
    ? 'manualFirst'
    : 'authoredFirst'
  const customProfile = normalizeProductionChoreographyCustomProfile(raw.customProfile)
  return {
    enabled: booleanOr(raw.enabled, DEFAULT_PRODUCTION_CHOREOGRAPHY.enabled),
    profileId,
    intensity: Math.max(0, Math.min(1, finiteOr(raw.intensity, DEFAULT_PRODUCTION_CHOREOGRAPHY.intensity))),
    fixtureFamilyParticipation,
    automaticLookChanges: booleanOr(raw.automaticLookChanges, DEFAULT_PRODUCTION_CHOREOGRAPHY.automaticLookChanges),
    automaticMovementChanges: booleanOr(raw.automaticMovementChanges, DEFAULT_PRODUCTION_CHOREOGRAPHY.automaticMovementChanges),
    impactSensitivity: Math.max(0, Math.min(1, finiteOr(raw.impactSensitivity, DEFAULT_PRODUCTION_CHOREOGRAPHY.impactSensitivity))),
    blackoutFrequency: Math.max(0, Math.min(1, finiteOr(raw.blackoutFrequency, DEFAULT_PRODUCTION_CHOREOGRAPHY.blackoutFrequency))),
    whiteImpactIntensity: Math.max(0, Math.min(1, finiteOr(raw.whiteImpactIntensity, DEFAULT_PRODUCTION_CHOREOGRAPHY.whiteImpactIntensity))),
    allowStrobe: booleanOr(raw.allowStrobe, DEFAULT_PRODUCTION_CHOREOGRAPHY.allowStrobe),
    allowAtmospherics: booleanOr(raw.allowAtmospherics, DEFAULT_PRODUCTION_CHOREOGRAPHY.allowAtmospherics),
    manualOverridePrecedence,
    manualOverrideHoldMs: Math.max(0, Math.min(30000, finiteOr(raw.manualOverrideHoldMs, DEFAULT_PRODUCTION_CHOREOGRAPHY.manualOverrideHoldMs))),
    seed: Math.max(1, Math.min(2147483647, Math.round(finiteOr(raw.seed, DEFAULT_PRODUCTION_CHOREOGRAPHY.seed)))),
    variationMode,
    variationAmount: Math.max(0, Math.min(1, finiteOr(raw.variationAmount, DEFAULT_PRODUCTION_CHOREOGRAPHY.variationAmount))),
    ...(customProfile ? { customProfile } : {}),
  }
}

export function normalizeProductionCueAction(value: unknown, cueId: string, index = 0): ProductionCueAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  const raw = value
  const base = cueActionBase(raw, `${cueId}:action:${index + 1}`)
  const fixtureId = typeof raw.fixtureId === 'string' && raw.fixtureId ? raw.fixtureId : undefined
  const groupId = typeof raw.groupId === 'string' && raw.groupId ? raw.groupId : undefined
  const intensity = Math.max(0, Math.min(1, finiteOr(raw.intensity, 1)))
  switch (raw.type) {
    case 'activateLook':
    case 'fadeToLook':
      return { ...base, type: raw.type, lookId: stringOr(raw.lookId, '') }
    case 'blackout':
      return raw.enabled === false ? { ...base, type: 'reveal' } : { ...base, type: 'blackout' }
    case 'reveal':
      return { ...base, type: 'reveal' }
    case 'setFixtureProperty':
    case 'setFixtureProperties':
      return { ...base, type: 'setFixtureProperty', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), properties: normalizeProductionFixturePropertyState(raw.properties) }
    case 'setGroupProperties':
      return { ...base, type: 'setFixtureProperty', groupId: stringOr(raw.groupId, ''), properties: normalizeProductionFixturePropertyState(raw.properties) }
    case 'moveToTarget':
      return { ...base, type: 'moveToTarget', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), targetId: stringOr(raw.targetId, ''), ...(typeof raw.snap === 'boolean' ? { snap: raw.snap } : {}) }
    case 'runMovementEffect':
      return { ...base, type: 'runMovementEffect', groupId: stringOr(raw.groupId, ''), movement: normalizeProductionGroupMovement(raw.movement) }
    case 'stopMovementEffect':
      return { ...base, type: 'stopMovementEffect', groupId: stringOr(raw.groupId, '') }
    case 'startChase':
    case 'setGroupChase':
      return { ...base, type: 'startChase', groupId: stringOr(raw.groupId, ''), chase: normalizeProductionChase(raw.chase) }
    case 'stopChase':
      return { ...base, type: 'stopChase', groupId: stringOr(raw.groupId, '') }
    case 'pulse':
    case 'triggerFixture':
      return { ...base, type: 'pulse', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), intensity }
    case 'strobeBurst':
    case 'triggerFlashPattern': {
      const pattern = typeof raw.pattern === 'string' && FLASH_PATTERNS.includes(raw.pattern as ProductionFlashPatternId)
        ? raw.pattern as ProductionFlashPatternId
        : 'singleHit'
      const overrides = isRecord(raw.overrides) ? raw.overrides : {}
      return {
        ...base,
        type: 'strobeBurst',
        ...(fixtureId ? { fixtureId } : {}),
        ...(groupId ? { groupId } : {}),
        pattern,
        ...(isFiniteNumber(raw.rateHz) || isFiniteNumber(overrides.rateHz) ? { rateHz: Math.max(0.1, Math.min(60, finiteOr(raw.rateHz, finiteOr(overrides.rateHz, 12)))) } : {}),
        ...(isFiniteNumber(raw.intensity) || isFiniteNumber(overrides.intensity) ? { intensity } : {}),
      }
    }
    case 'blinderHit':
      return { ...base, type: 'blinderHit', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), intensity }
    case 'fogBurst':
    case 'triggerAtmosphere':
      return { ...base, type: 'fogBurst', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), intensity }
    case 'cryoBurst':
      return { ...base, type: 'cryoBurst', ...(fixtureId ? { fixtureId } : {}), ...(groupId ? { groupId } : {}), intensity }
    case 'paletteChange':
      return {
        ...base,
        type: 'paletteChange',
        ...(fixtureId ? { fixtureId } : {}),
        ...(groupId ? { groupId } : {}),
        ...(typeof raw.paletteId === 'string' ? { paletteId: raw.paletteId } : {}),
        ...(normalizeProductionColorState(raw.color) ? { color: normalizeProductionColorState(raw.color)! } : {}),
      }
    case 'fanOpen':
    case 'fanClose':
      return { ...base, type: raw.type, groupId: stringOr(raw.groupId, ''), ...(isRecord(raw.movement) ? { movement: raw.movement as Partial<ProductionGroupMovementConfig> } : {}) }
    case 'gateFixtureGroup':
      return { ...base, type: 'gateFixtureGroup', groupId: stringOr(raw.groupId, ''), open: booleanOr(raw.open, true) }
    case 'triggerLegacyBeamAction':
      return {
        ...base,
        type: 'triggerLegacyBeamAction',
        ...(typeof raw.legacyCueId === 'string' ? { legacyCueId: raw.legacyCueId } : {}),
        targetType: raw.targetType === 'beam' ? 'beam' : 'group',
        targetId: stringOr(raw.targetId, ''),
        action: raw.action === 'trigger' ? 'trigger' : 'gate',
        ...(isFiniteNumber(raw.legacyDurationBeats) ? { legacyDurationBeats: Math.max(0, raw.legacyDurationBeats) } : {}),
      }
    default:
      return null
  }
}

export function normalizeProductionCompoundCue(value: unknown, index = 0): ProductionCompoundCue {
  const raw = isRecord(value) ? value : {}
  const id = stringOr(raw.id, `production-cue:${index + 1}`)
  const timingSource = isRecord(raw.timing)
    ? raw.timing
    : raw.quantize === 'manual' || raw.manualOnly === true
      ? { mode: 'manual' }
      : { mode: 'musical', bar: 1, beat: 1, subdivision: 1, subdivisionIndex: 0 }
  const actions: ProductionCueAction[] = []
  let pendingLegacyWaitMs = 0
  normalizeArray<unknown>(raw.actions).forEach((actionValue, actionIndex) => {
    if (isRecord(actionValue) && actionValue.type === 'wait') {
      pendingLegacyWaitMs += Math.max(0, Math.min(600000, finiteOr(actionValue.durationMs, 0)))
      return
    }
    const action = normalizeProductionCueAction(actionValue, id, actionIndex)
    if (!action) return
    if (pendingLegacyWaitMs > 0) {
      action.execution = 'sequential'
      action.delayMs = (action.delayMs ?? 0) + pendingLegacyWaitMs
      pendingLegacyWaitMs = 0
    }
    actions.push(action)
  })
  const quantize = typeof raw.quantize === 'string' && PRODUCTION_CUE_QUANTIZE.includes(raw.quantize as ProductionCueQuantize)
    ? raw.quantize as ProductionCueQuantize
    : 'none'
  const retriggerPolicy = typeof raw.retriggerPolicy === 'string' && PRODUCTION_CUE_RETRIGGER.includes(raw.retriggerPolicy as ProductionCueRetriggerPolicy)
    ? raw.retriggerPolicy as ProductionCueRetriggerPolicy
    : 'oncePerPass'
  const cancellationBehavior = typeof raw.cancellationBehavior === 'string' && PRODUCTION_CUE_CANCELLATION.includes(raw.cancellationBehavior as ProductionCueCancellationBehavior)
    ? raw.cancellationBehavior as ProductionCueCancellationBehavior
    : 'cancelOnSeek'
  return {
    schemaVersion: 2,
    id,
    label: stringOr(raw.label, stringOr(raw.name, `Cue ${index + 1}`)),
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    enabled: booleanOr(raw.enabled, true),
    timing: normalizeProductionCueTiming(timingSource),
    quantize,
    ...(isFiniteNumber(raw.durationMs) ? { durationMs: Math.max(0, Math.min(600000, raw.durationMs)) } : {}),
    ...(isFiniteNumber(raw.transitionMs) ? { transitionMs: Math.max(0, Math.min(600000, raw.transitionMs)) } : {}),
    priority: Math.round(finiteOr(raw.priority, 0)),
    retriggerPolicy,
    cancellationBehavior,
    fixtureGroupIds: normalizeStringArray(raw.fixtureGroupIds),
    manualOnly: booleanOr(raw.manualOnly, false) || (isRecord(timingSource) && timingSource.mode === 'manual'),
    actions,
    source: raw.source === 'legacyBeamMigration' || raw.source === 'preset' ? raw.source : 'authored',
  }
}

export function normalizeLaserDmxSettings(raw: unknown): LaserDmxSettings {
  const fallback: LaserDmxSettings = {
    schemaVersion: LASER_DMX_SETTINGS_SCHEMA_VERSION,
    rigId: 'laser-dmx-legacy-rig',
    rigName: 'LaserDMX Legacy Rig',
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
    visualComfort: { ...DEFAULT_PRODUCTION_VISUAL_COMFORT },
    atmosphere: {
      ...DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS,
      persistentHaze: { ...DEFAULT_PRODUCTION_ATMOSPHERE_SETTINGS.persistentHaze },
    },
    fixtures: [],
    productionStage: createDefaultProductionStageModel(),
    productionGroups: [],
    productionTargets: [],
    productionLooks: [],
    activeProductionLookId: null,
    productionLookTransitionDefaults: { ...DEFAULT_PRODUCTION_LOOK_TRANSITION, fixtureFamilyDurationsMs: {} },
    productionCues: [],
    choreography: { ...DEFAULT_PRODUCTION_CHOREOGRAPHY, fixtureFamilyParticipation: { ...DEFAULT_PRODUCTION_CHOREOGRAPHY_PARTICIPATION } },
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
  const productionLooks = normalizeArray<unknown>(raw.productionLooks).map(normalizeProductionLook)
  const activeProductionLookId = typeof raw.activeProductionLookId === 'string'
    && productionLooks.some(look => look.id === raw.activeProductionLookId)
    ? raw.activeProductionLookId
    : null

  return {
    ...fallback,
    ...raw,
    schemaVersion: LASER_DMX_SETTINGS_SCHEMA_VERSION,
    rigId: stringOr(raw.rigId, fallback.rigId ?? 'laser-dmx-legacy-rig'),
    rigName: stringOr(raw.rigName, fallback.rigName ?? 'LaserDMX Legacy Rig'),
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
    visualComfort: normalizeProductionVisualComfort(raw.visualComfort),
    atmosphere: normalizeProductionAtmosphereSettings(raw.atmosphere),
    runtime: isRecord(raw.runtime)
      ? { ...raw.runtime, atmosphereClearRequestId: Math.max(0, Math.round(finiteOr(raw.runtime.atmosphereClearRequestId, 0))) }
      : undefined,
    fixtures,
    productionStage,
    productionGroups: normalizeArray<ProductionFixtureGroup>(raw.productionGroups).map((group, index) => ({
      ...group,
      id: typeof group.id === 'string' && group.id.length > 0 ? group.id : `fixture-group:${index + 1}`,
      name: typeof group.name === 'string' && group.name.length > 0 ? group.name : `Fixture Group ${index + 1}`,
      fixtureIds: Array.isArray(group.fixtureIds) ? group.fixtureIds.filter((value): value is string => typeof value === 'string') : [],
      ...(group.movement ? { movement: normalizeProductionGroupMovement(group.movement) } : {}),
      ...(group.chase ? { chase: normalizeProductionChase(group.chase) } : {}),
    })),
    productionTargets: normalizeArray<unknown>(raw.productionTargets)
      .map(normalizeProductionTarget)
      .filter((target): target is ProductionTarget => target !== null),
    productionLooks,
    activeProductionLookId,
    productionLookTransitionDefaults: normalizeProductionLookTransition(raw.productionLookTransitionDefaults),
    productionCues: normalizeArray<unknown>(raw.productionCues).map(normalizeProductionCompoundCue),
    choreography: normalizeProductionChoreographySettings(raw.choreography),
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
  const fixtures = normalized.fixtures.map(fixture => fixture.atmospheric
    ? { ...fixture, atmospheric: { ...fixture.atmospheric, triggerRequestId: 0 } }
    : fixture)
  return omitTransientKeys({ ...normalized, fixtures } as unknown as Record<string, unknown>) as unknown as LaserDmxSettings
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
    properties.panDeg = fixture.movingHead?.panDeg ?? fixture.position.pan
    properties.tiltDeg = fixture.movingHead?.tiltDeg ?? fixture.position.tilt
  }
  if (capabilities.color?.mode === 'colorWheel') properties.colorWheelSlot = fixture.movingHead?.colorWheelSlot ?? 0
  if (capabilities.zoom) properties.zoom = fixture.beam.zoom
  if (capabilities.focus) properties.focus = fixture.beam.focus
  if (capabilities.iris) properties.iris = fixture.movingHead?.iris ?? 1
  if (capabilities.frost) properties.frost = fixture.movingHead?.frost ?? 0
  if (capabilities.gobo) {
    properties.goboIndex = fixture.movingHead?.goboIndex ?? 0
    if (capabilities.gobo.rotation) properties.goboRotation = fixture.movingHead?.goboRotation ?? 0
  }
  if (capabilities.prism) {
    properties.prismFacets = fixture.movingHead?.prismFacets ?? 0
    if (capabilities.prism.rotation) properties.prismRotation = fixture.movingHead?.prismRotation ?? 0
  }
  if (capabilities.beamPattern) properties.beamPatternId = fixture.path.kind
  if (capabilities.strobe && fixture.flashPattern) properties.flashPatternId = fixture.flashPattern.pattern
  if (capabilities.wash && fixture.wash) {
    properties.washSpread = fixture.wash.spread
    properties.washSoftness = fixture.wash.softness
  }
  if (capabilities.pixels && fixture.ledBar) properties.pixelSegmentCount = fixture.ledBar.segmentCount
  if (capabilities.atmosphericOutput && fixture.atmospheric) {
    properties.atmosphericOutput = fixture.atmospheric.outputLevel
    properties.triggered = fixture.atmospheric.triggerRequestId > 0
  }
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
    id: settings.rigId ?? 'laser-dmx-legacy-rig',
    name: settings.rigName ?? 'LaserDMX Legacy Rig',
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
        kind: profile?.fixtureKind ?? fixture.fixtureKind ?? 'laserProjector',
        profileId: fixture.dmx.profileId,
        patch: {
          universe: fixture.dmx.universe,
          startAddress: fixture.dmx.startAddress,
          channelFootprint: profile ? Math.max(0, ...profile.channels.map(channel => channel.channel)) : 0,
        },
        groupIds: groupIdsByFixture.get(fixture.id) ?? [],
        transform: resolveLaserDmxFixtureStageTransform(fixture, stage),
        targetId: fixture.targetId ?? `target:${fixture.id}`,
        properties: buildFixturePropertyState(fixture, capabilities),
        capabilityOverrides: fixture.capabilityOverrides,
        compatibility: {
          source: 'legacyLaserDmxRig',
          sourceSchemaVersion: fixture.schemaVersion ?? 0,
          ...(validationErrors.length > 0 ? { validationErrors } : {}),
          ...(fixture.compatibility?.migrationNotes?.length
            ? { migrationNotes: fixture.compatibility.migrationNotes }
            : {}),
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
    intensityDomains: { preview: 'renderer', hardware: 'adapter' },
    safetyMetadata: {
      audienceRegionEnabled: rig.stage.audience.enabled,
      exclusionZoneIds: rig.stage.spatialZones.filter(zone => zone.kind === 'excluded').map(zone => zone.id),
      validationOnly: true,
    },
    fixtures: fixtures.map(frame => {
      const fixture = rigFixtures.get(frame.fixtureId)
      return {
        fixtureId: frame.fixtureId,
        profileId: fixture?.profileId ?? 'unknown',
        fixtureKind: fixture?.kind ?? 'laserProjector',
        patch: fixture?.patch ?? {
          universe: frame.universe,
          startAddress: frame.startAddress,
          channelFootprint: Object.keys(frame.channels).length,
        },
        channels: frame.channels,
        visual: frame.visual,
      }
    }),
  }
}

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
export const LASER_DMX_PRODUCTION_RIG_SCHEMA_VERSION = 1

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
  panDeg: number
  tiltDeg: number
  rollDeg: number
}

export interface ProductionStageTransform {
  position: ProductionStageVector3
  orientation: ProductionStageOrientation
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
  fixtures: ProductionFixtureInstance[]
  groups: ProductionFixtureGroup[]
  targets: ProductionTarget[]
  looks: ProductionLook[]
  cues: ProductionCompoundCue[]
  rendererCapabilities: ProductionRendererCapabilities
  outputAdapterCapabilities: ProductionOutputAdapterCapabilities
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
    productionGroups: [],
    productionTargets: [],
    productionLooks: [],
    productionCues: [],
  }
  if (!isRecord(raw)) return fallback
  const fixtures = normalizeArray<unknown>(raw.fixtures).map(normalizeLegacyLaserDmxFixture)
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
    productionGroups: normalizeArray<ProductionFixtureGroup>(raw.productionGroups),
    productionTargets: normalizeArray<ProductionTarget>(raw.productionTargets),
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
  const generatedTargets: ProductionTargetPoint[] = settings.fixtures.map(fixture => ({
    id: `target:${fixture.id}`,
    name: `${fixture.name} target`,
    kind: 'point',
    position: {
      x: fixture.position.targetX,
      y: fixture.position.targetY,
      z: fixture.position.targetZ,
    },
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
        transform: {
          position: {
            x: fixture.position.originX,
            y: fixture.position.originY,
            z: fixture.position.originZ,
          },
          orientation: {
            panDeg: fixture.position.pan,
            tiltDeg: fixture.position.tilt,
            rollDeg: fixture.position.rotation,
          },
        },
        targetId: `target:${fixture.id}`,
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

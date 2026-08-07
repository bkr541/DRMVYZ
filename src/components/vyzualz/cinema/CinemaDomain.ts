import type {
  CinemaActionId,
  CinemaAssetBindingId,
  CinemaAssetId,
  CinemaCameraId,
  CinemaCollectionId,
  CinemaCompositionId,
  CinemaCompositionInstanceId,
  CinemaControlPointId,
  CinemaConnectionId,
  CinemaEnumOptionId,
  CinemaEventId,
  CinemaModulationRouteId,
  CinemaModulationSourceId,
  CinemaNodeId,
  CinemaNodeTypeId,
  CinemaParameterId,
  CinemaParameterPath,
  CinemaPerformanceRuleId,
  CinemaPortId,
} from './CinemaIdentifiers'

export const CINEMA_COMPOSITION_SCHEMA_ID = 'drmvyz.cinema.composition' as const
export const CINEMA_COMPOSITION_SCHEMA_VERSION = 3 as const
export const CINEMA_PACKAGE_SCHEMA_ID = 'drmvyz.cinema.package' as const
export const CINEMA_PACKAGE_SCHEMA_VERSION = 3 as const

export type CinemaJsonPrimitive = string | number | boolean | null
export type CinemaJsonValue = CinemaJsonPrimitive | CinemaJsonObject | readonly CinemaJsonValue[]
export interface CinemaJsonObject { readonly [key: string]: CinemaJsonValue }

/** Runtime guard for the exact JSON subset allowed in persisted Cinema contracts. */
export function isCinemaJsonValue(value: unknown): value is CinemaJsonValue {
  try {
    return isCinemaJsonValueInternal(value, new Set<object>())
  } catch {
    return false
  }
}

function isCinemaJsonValueInternal(value: unknown, ancestors: Set<object>): value is CinemaJsonValue {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (ancestors.has(value)) return false

  const prototype = Object.getPrototypeOf(value)
  if (Array.isArray(value)) {
    ancestors.add(value)
    const ownKeys = Reflect.ownKeys(value)
    const validKeys = Object.keys(value).length === value.length
      && ownKeys.every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)))
    const valid = validKeys && value.every(entry => isCinemaJsonValueInternal(entry, ancestors))
    ancestors.delete(value)
    return valid
  }
  if (prototype !== Object.prototype && prototype !== null) return false

  ancestors.add(value)
  const valid = Reflect.ownKeys(value).every(key => (
    typeof key === 'string'
    && Object.prototype.propertyIsEnumerable.call(value, key)
    && isCinemaJsonValueInternal((value as Record<string, unknown>)[key], ancestors)
  ))
  ancestors.delete(value)
  return valid
}

export type CinemaVector2 = readonly [number, number]
export type CinemaVector3 = readonly [number, number, number]
export type CinemaVector4 = readonly [number, number, number, number]
export type CinemaColor = CinemaVector4

export interface CinemaGradientStop {
  id: CinemaControlPointId
  position: number
  color: CinemaColor
}

export interface CinemaCurvePoint {
  id: CinemaControlPointId
  position: number
  value: number
  interpolation?: 'step' | 'linear' | 'smooth'
}

export interface CinemaAssetReference {
  assetId: CinemaAssetId
  role: CinemaAssetRole
}

export type CinemaParameterValue =
  | CinemaJsonPrimitive
  | CinemaVector2
  | CinemaVector3
  | CinemaVector4
  | readonly CinemaGradientStop[]
  | readonly CinemaCurvePoint[]
  | CinemaAssetReference

export type CinemaParameterControlHint =
  | 'slider'
  | 'number'
  | 'text'
  | 'toggle'
  | 'select'
  | 'button'
  | 'color'
  | 'gradient'
  | 'vector'
  | 'curve'
  | 'texture'
  | 'asset-picker'

export interface CinemaParameterUiHints {
  control?: CinemaParameterControlHint
  order?: number
  precision?: number
  compact?: boolean
  placeholder?: string
  helpText?: string
}

export type CinemaMasterBindingOperation = 'scale' | 'add' | 'replace'

export interface CinemaMasterParameterBinding {
  masterParameterId: CinemaParameterId
  /** Scale is the default influence operation when omitted. */
  operation?: CinemaMasterBindingOperation
  /** Blend strength in the inclusive 0..1 range. */
  influence?: number
}

export interface CinemaParameterBase {
  id: CinemaParameterId
  label: string
  description?: string
  group?: string
  advanced?: boolean
  modulatable?: boolean
  ui?: CinemaParameterUiHints
  /** Optional registry metadata. Master parameters themselves must not declare a master binding. */
  masterBinding?: CinemaMasterParameterBinding
}

export interface CinemaFloatParameterDefinition extends CinemaParameterBase {
  type: 'float'
  default: number
  min: number
  max: number
  step?: number
  unit?: string
  logarithmic?: boolean
}

export interface CinemaIntegerParameterDefinition extends CinemaParameterBase {
  type: 'integer'
  default: number
  min: number
  max: number
  step?: number
  unit?: string
}

export interface CinemaBooleanParameterDefinition extends CinemaParameterBase {
  type: 'boolean'
  default: boolean
}

export interface CinemaStringParameterDefinition extends CinemaParameterBase {
  type: 'string'
  default: string
  minLength?: number
  maxLength?: number
  multiline?: boolean
}

export interface CinemaEnumParameterDefinition extends CinemaParameterBase {
  type: 'enum'
  default: CinemaEnumOptionId
  options: readonly { id: CinemaEnumOptionId; label: string }[]
}

export interface CinemaTriggerParameterDefinition extends CinemaParameterBase {
  type: 'trigger'
  modulatable?: false
}

export interface CinemaColorParameterDefinition extends CinemaParameterBase {
  type: 'color'
  default: CinemaColor
  brandRole?: CinemaBrandRole
  /** Exact is protected from authored/transient recoloring; derived may continue through the resolver; free ignores Brand Kit. */
  brandPolicy?: CinemaBrandColorPolicy
}

export interface CinemaGradientParameterDefinition extends CinemaParameterBase {
  type: 'gradient'
  default: readonly CinemaGradientStop[]
}

export interface CinemaVectorParameterDefinition extends CinemaParameterBase {
  type: 'vector2' | 'vector3'
  default: CinemaVector2 | CinemaVector3
  min?: CinemaVector2 | CinemaVector3
  max?: CinemaVector2 | CinemaVector3
  step?: CinemaVector2 | CinemaVector3
}

export interface CinemaCurveParameterDefinition extends CinemaParameterBase {
  type: 'curve'
  default: readonly CinemaCurvePoint[]
}

export interface CinemaTextureParameterDefinition extends CinemaParameterBase {
  type: 'texture'
  default: CinemaAssetReference | null
  acceptedRoles: readonly CinemaAssetRole[]
}

export interface CinemaAssetParameterDefinition extends CinemaParameterBase {
  /** `asset` is retained as a Stage 1 compatibility alias. New schemas should use `asset-reference`. */
  type: 'asset' | 'asset-reference'
  default: CinemaAssetReference | null
  acceptedRoles: readonly CinemaAssetRole[]
}

export type CinemaParameterDefinition =
  | CinemaFloatParameterDefinition
  | CinemaIntegerParameterDefinition
  | CinemaBooleanParameterDefinition
  | CinemaStringParameterDefinition
  | CinemaEnumParameterDefinition
  | CinemaTriggerParameterDefinition
  | CinemaColorParameterDefinition
  | CinemaGradientParameterDefinition
  | CinemaVectorParameterDefinition
  | CinemaCurveParameterDefinition
  | CinemaTextureParameterDefinition
  | CinemaAssetParameterDefinition

export type CinemaParameterValues = Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>

export type CinemaNodeFamily =
  | 'shader'
  | 'procedural'
  | 'media'
  | 'logo'
  | 'text'
  | 'lyrics'
  | 'effect'
  | 'mixer'
  | 'camera'
  | 'control'
  | 'output'

export type CinemaPortDataType =
  | 'color-texture'
  | 'mask-texture'
  | 'depth-texture'
  | 'geometry'
  | 'camera'
  | 'scalar'
  | 'vector2'
  | 'vector3'
  | 'color'
  | 'event'
  | 'asset'
  | 'any'

export interface CinemaPortDefinition {
  id: CinemaPortId
  label: string
  direction: 'input' | 'output'
  dataType: CinemaPortDataType
  cardinality?: 'one' | 'many'
  required?: boolean
  accepts?: readonly CinemaPortDataType[]
}

export interface CinemaNodeDefinition {
  id: CinemaNodeId
  typeId: CinemaNodeTypeId
  typeVersion: number
  family: CinemaNodeFamily
  label?: string
  enabled: boolean
  opacity: number
  parameterValues: CinemaParameterValues
  assetBindingIds?: readonly CinemaAssetBindingId[]
  metadata?: CinemaJsonObject
}

export interface CinemaConnectionEndpoint {
  nodeId: CinemaNodeId
  portId: CinemaPortId
}

export interface CinemaConnectionDefinition {
  id: CinemaConnectionId
  from: CinemaConnectionEndpoint
  to: CinemaConnectionEndpoint
  enabled: boolean
  metadata?: CinemaJsonObject
}

export type CinemaAssetRole =
  | 'logo'
  | 'image'
  | 'video'
  | 'album-artwork'
  | 'mask'
  | 'material'
  | 'displacement'
  | 'environment'
  | 'lyric-background'
  | 'node-output'
  | 'font'
  | 'audio'

export type CinemaBrandColorPolicy = 'exact' | 'derived' | 'free'

export type CinemaBrandRole =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'background'
  | 'foreground'
  | 'highlight'
  | 'shadow'

export interface CinemaAssetBindingDefinition {
  id: CinemaAssetBindingId
  assetId: CinemaAssetId
  role: CinemaAssetRole
  fit: 'contain' | 'cover' | 'stretch' | 'none'
  crop?: readonly [number, number, number, number]
  position?: CinemaVector2
  scale?: CinemaVector2
  rotationRadians?: number
  preserveOriginalColors: boolean
  colorizeWithBrandRole?: CinemaBrandRole
  /** Controls whether Brand Kit colorization is protected, derivable, or freely replaceable. */
  brandColorPolicy?: CinemaBrandColorPolicy
  opacity: number
  blendMode: CinemaBlendMode
}

export type CinemaBlendMode =
  | 'normal'
  | 'add'
  | 'screen'
  | 'multiply'
  | 'lighten'
  | 'darken'
  | 'difference'
  | 'overlay'
  | 'masked'

export type CinemaCameraMode = 'locked' | 'dolly' | 'orbit' | 'fly' | 'handheld' | 'path' | 'auto-director'

export interface CinemaCameraPoseDefinition {
  position?: CinemaVector3
  rotation?: CinemaVector3
  target?: CinemaVector3
  fovDegrees?: number
  rollRadians?: number
  near?: number
  far?: number
}

export interface CinemaCameraSafeRangeDefinition {
  minPosition: CinemaVector3
  maxPosition: CinemaVector3
  minFovDegrees: number
  maxFovDegrees: number
  minNear: number
  maxFar: number
}

export interface CinemaCameraInvalidRegionDefinition {
  id: string
  shape: 'box' | 'sphere'
  center: CinemaVector3
  size?: CinemaVector3
  radius?: number
  fallbackPosition?: CinemaVector3
}

export interface CinemaCameraAuthoredShotDefinition extends CinemaCameraPoseDefinition {
  id: string
  label?: string
  mode: Exclude<CinemaCameraMode, 'auto-director'>
  sections?: readonly string[]
  weight?: number
  minimumDurationSec?: number
  path?: readonly CinemaCameraPoseDefinition[]
  metadata?: CinemaJsonObject
}

export interface CinemaCameraResourceDefinition {
  id: CinemaCameraId
  label: string
  mode: CinemaCameraMode
  parameterValues: CinemaParameterValues
  path?: readonly CinemaCameraPoseDefinition[]
  safeRange?: CinemaCameraSafeRangeDefinition
  invalidRegions?: readonly CinemaCameraInvalidRegionDefinition[]
  authoredShots?: readonly CinemaCameraAuthoredShotDefinition[]
  metadata?: CinemaJsonObject
}

export type CinemaModulationMode = 'add' | 'multiply' | 'replace' | 'trigger'
export type CinemaMusicalQuantization = 'none' | 'beat' | '2-beats' | 'bar' | '4-bars' | '8-bars' | 'phrase' | 'section'

export interface CinemaModulationCondition {
  sectionTypes?: readonly string[]
  vocalsActive?: boolean
  buildActive?: boolean
  dropActive?: boolean
  playing?: boolean
}

export interface CinemaModulationRouteDefinition {
  id: CinemaModulationRouteId
  sourceId: CinemaModulationSourceId
  destination: CinemaParameterPath
  mode: CinemaModulationMode
  amount: number
  offset?: number
  inputRange?: readonly [number, number]
  outputRange?: readonly [number, number]
  attackMs?: number
  releaseMs?: number
  smoothing?: number
  curve?: readonly CinemaCurvePoint[]
  quantization?: CinemaMusicalQuantization
  condition?: CinemaModulationCondition
  clamp?: readonly [number, number]
  enabled: boolean
}

export const CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION = 1 as const
export const CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION = 1 as const

export type CinemaPerformanceEventCondition =
  | 'beat'
  | 'bar'
  | 'phrase'
  | 'sectionStart'
  | 'dropStart'
  | 'lyricCue'
  | 'lyricWord'
  | 'manual'
  | CinemaEventId

export interface CinemaPerformanceCondition {
  schemaVersion: typeof CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION
  event?: CinemaPerformanceEventCondition
  sectionTypes?: readonly string[]
  minimumEnergy?: number
  maximumEnergy?: number
  vocalsActive?: boolean
  playing?: boolean
  buildActive?: boolean
  dropActive?: boolean
  manualActionIds?: readonly CinemaActionId[]
  toggleActionId?: CinemaActionId
  toggleState?: boolean
}

export interface CinemaPerformanceDuration {
  value: number
  unit: 'beats' | 'bars'
}

export interface CinemaPerformanceActionBase {
  schemaVersion: typeof CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION
  id: CinemaActionId
}

export type CinemaPerformanceAction =
  | (CinemaPerformanceActionBase & {
      type: 'set-parameter'
      destination: CinemaParameterPath
      value: CinemaParameterValue
      duration?: CinemaPerformanceDuration
    })
  | (CinemaPerformanceActionBase & {
      type: 'trigger-parameter'
      destination: CinemaParameterPath
    })
  | (CinemaPerformanceActionBase & {
      type: 'set-node-enabled'
      nodeId: CinemaNodeId
      enabled: boolean
      duration?: CinemaPerformanceDuration
    })
  | (CinemaPerformanceActionBase & {
      type: 'set-effect-enabled'
      nodeId: CinemaNodeId
      enabled: boolean
      duration?: CinemaPerformanceDuration
    })
  | (CinemaPerformanceActionBase & {
      type: 'select-camera'
      cameraId: CinemaCameraId
      duration?: CinemaPerformanceDuration
    })
  | (CinemaPerformanceActionBase & {
      type: 'set-palette'
      colors: Readonly<Partial<Record<CinemaBrandRole, CinemaColor>>>
      duration?: CinemaPerformanceDuration
    })
  | (CinemaPerformanceActionBase & { type: 'resetNodeState'; nodeId: CinemaNodeId })
  | (CinemaPerformanceActionBase & { type: 'resetFeedback'; nodeId: CinemaNodeId })
  | (CinemaPerformanceActionBase & { type: 'reseedSimulation'; nodeId: CinemaNodeId })
  | (CinemaPerformanceActionBase & { type: 'clearTrailHistory'; nodeId: CinemaNodeId })
  | (CinemaPerformanceActionBase & { type: 'emit-event'; eventId: CinemaEventId; payload?: CinemaJsonObject })

export interface CinemaPerformanceRuleDefinition {
  schemaVersion: typeof CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION
  id: CinemaPerformanceRuleId
  label: string
  priority: number
  enabled: boolean
  condition: CinemaPerformanceCondition
  actions: readonly CinemaPerformanceAction[]
}

export interface CinemaCompositionMetadata {
  name: string
  description?: string
  tags?: readonly string[]
  author?: string
  createdAt?: string
  updatedAt?: string
  provenance?: CinemaJsonObject
}

export interface CinemaCompositionDefinition {
  schemaId: typeof CINEMA_COMPOSITION_SCHEMA_ID
  schemaVersion: typeof CINEMA_COMPOSITION_SCHEMA_VERSION
  id: CinemaCompositionId
  revision: number
  metadata: CinemaCompositionMetadata
  nodes: readonly CinemaNodeDefinition[]
  connections: readonly CinemaConnectionDefinition[]
  outputNodeId: CinemaNodeId
  masterParameters: readonly CinemaParameterDefinition[]
  masterValues: CinemaParameterValues
  cameras: readonly CinemaCameraResourceDefinition[]
  assetBindings: readonly CinemaAssetBindingDefinition[]
  modulationRoutes: readonly CinemaModulationRouteDefinition[]
  performanceRules: readonly CinemaPerformanceRuleDefinition[]
}

export interface CinemaNodeParameterOverride {
  nodeId: CinemaNodeId
  values: CinemaParameterValues
}

export interface CinemaCameraParameterOverride {
  cameraId: CinemaCameraId
  values: CinemaParameterValues
}

export type CinemaAssetBindingOverrideValues = Partial<Pick<CinemaAssetBindingDefinition,
  'assetId' | 'fit' | 'crop' | 'position' | 'scale' | 'rotationRadians' | 'preserveOriginalColors' | 'colorizeWithBrandRole' | 'brandColorPolicy' | 'opacity' | 'blendMode'
>>

export interface CinemaAssetBindingOverride {
  bindingId: CinemaAssetBindingId
  values: CinemaAssetBindingOverrideValues
}

export interface CinemaCompositionInstance {
  id: CinemaCompositionInstanceId
  compositionId: CinemaCompositionId
  label: string
  revision: number
  masterOverrides: CinemaParameterValues
  nodeOverrides: readonly CinemaNodeParameterOverride[]
  cameraOverrides: readonly CinemaCameraParameterOverride[]
  assetBindingOverrides: readonly CinemaAssetBindingOverride[]
  metadata?: CinemaJsonObject
}

export interface CinemaCollectionDefinition {
  id: CinemaCollectionId
  label: string
  compositionIds: readonly CinemaCompositionId[]
  metadata?: CinemaJsonObject
}

export interface CinemaPackageDefinition {
  schemaId: typeof CINEMA_PACKAGE_SCHEMA_ID
  schemaVersion: typeof CINEMA_PACKAGE_SCHEMA_VERSION
  exportedAt: string
  compositions: readonly CinemaCompositionDefinition[]
  instances: readonly CinemaCompositionInstance[]
  collections: readonly CinemaCollectionDefinition[]
  assetIds: readonly CinemaAssetId[]
  migrationProvenance?: readonly {
    fromSchemaVersion: number
    toSchemaVersion: number
    migratedAt: string
  }[]
}

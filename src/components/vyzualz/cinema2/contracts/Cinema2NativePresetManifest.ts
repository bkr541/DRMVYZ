/**
 * Native authored preset contract for the Cinema 2.0 sibling engine.
 *
 * This file intentionally contains authored/serializable data only. Runtime
 * resources, compiled plans, GPU handles, simulations, envelopes and resolved
 * modulation state belong to later engine stages.
 */

export const CINEMA2_NATIVE_PRESET_SCHEMA_ID = 'drmvyz.cinema2.native-preset' as const
export const CINEMA2_NATIVE_PRESET_SCHEMA_VERSION = 1 as const

declare const CINEMA2_STABLE_ID: unique symbol

export type Cinema2StableId<Kind extends string = string> = string & {
  readonly [CINEMA2_STABLE_ID]: Kind
}

export type Cinema2PresetId = Cinema2StableId<'preset'>
export type Cinema2ParameterId = Cinema2StableId<'parameter'>
export type Cinema2MediaSlotId = Cinema2StableId<'media-slot'>
export type Cinema2ModuleId = Cinema2StableId<'module'>
export type Cinema2ModuleTypeId = Cinema2StableId<'module-type'>
export type Cinema2SceneNodeId = Cinema2StableId<'scene-node'>
export type Cinema2LayerId = Cinema2StableId<'layer'>
export type Cinema2CameraId = Cinema2StableId<'camera'>
export type Cinema2LightId = Cinema2StableId<'light'>
export type Cinema2RenderPassId = Cinema2StableId<'render-pass'>
export type Cinema2EffectId = Cinema2StableId<'effect'>
export type Cinema2EffectTypeId = Cinema2StableId<'effect-type'>
export type Cinema2ChoreographyRuleId = Cinema2StableId<'choreography-rule'>
export type Cinema2ChoreographyActionId = Cinema2StableId<'choreography-action'>
export type Cinema2VariationId = Cinema2StableId<'variation'>
export type Cinema2OutputId = Cinema2StableId<'output'>

export interface Cinema2Reference<Kind extends string> {
  readonly $ref: Cinema2StableId<Kind>
}

export type Cinema2ParameterRef = Cinema2Reference<'parameter'>
export type Cinema2MediaSlotRef = Cinema2Reference<'media-slot'>
export type Cinema2ModuleRef = Cinema2Reference<'module'>
export type Cinema2SceneNodeRef = Cinema2Reference<'scene-node'>
export type Cinema2LayerRef = Cinema2Reference<'layer'>
export type Cinema2CameraRef = Cinema2Reference<'camera'>
export type Cinema2LightRef = Cinema2Reference<'light'>
export type Cinema2RenderPassRef = Cinema2Reference<'render-pass'>
export type Cinema2EffectRef = Cinema2Reference<'effect'>
export type Cinema2VariationRef = Cinema2Reference<'variation'>

export type Cinema2JsonPrimitive = string | number | boolean | null
export type Cinema2JsonValue = Cinema2JsonPrimitive | Cinema2JsonObject | readonly Cinema2JsonValue[]
export interface Cinema2JsonObject { readonly [key: string]: Cinema2JsonValue }

export type Cinema2Vector2 = readonly [number, number]
export type Cinema2Vector3 = readonly [number, number, number]
export type Cinema2Vector4 = readonly [number, number, number, number]
export type Cinema2Color = Cinema2Vector4

/** Spatial vocabulary shared by all Cinema 2.0 scene nodes.
 *
 * - `screen`: positions are expressed in output pixels.
 * - `normalized-screen`: positions are dimensionless normalized output coordinates.
 * - `world`: positions are renderer-independent world units reserved for native 3D.
 *
 * Child nodes inherit their parent's space when omitted. Cross-space parent-child
 * composition is invalid until an explicit conversion boundary exists.
 */
export type Cinema2CoordinateSpace = 'screen' | 'normalized-screen' | 'world'

export interface Cinema2TransformManifest {
  /** Position units are defined by the owning node's coordinate space. */
  position?: Cinema2Vector3
  /** Euler rotation in radians, applied X then Y then Z. */
  rotation?: Cinema2Vector3
  /** Unitless local scale. */
  scale?: Cinema2Vector3
}

/**
 * Engine/service capabilities that an authored preset may depend on.
 *
 * Availability is resolved by a future compiler/runtime boundary. The authored
 * requirement never implies that unavailable audio data should be fabricated.
 */
export const CINEMA2_CAPABILITY_IDS = [
  'render.webgl2',
  'render.depth',
  'render.hdr',
  'render.history',
  'scene.2d',
  'scene.3d',
  'camera.world',
  'lighting',
  'media.image',
  'media.video',
  'media.svg',
  'audio.transport',
  'audio.spectrum',
  'audio.waveform',
  'audio.bands',
  'audio.features',
  'music.beat',
  'music.downbeat',
  'music.bar',
  'music.phrase',
  'music.section',
  'music.vocal-presence',
  'music.build',
  'music.drop',
  'visual-director.significance',
] as const

export type Cinema2CapabilityId = typeof CINEMA2_CAPABILITY_IDS[number]
export type Cinema2CapabilityRequirementMode = 'required' | 'optional'

export interface Cinema2CapabilityRequirement {
  id: Cinema2CapabilityId
  requirement: Cinema2CapabilityRequirementMode
  /** Human-readable authored rationale; it is not a runtime fallback value. */
  purpose?: string
}

export interface Cinema2PresetMetadataManifest {
  name: string
  description?: string
  author?: string
  tags?: readonly string[]
  metadata?: Cinema2JsonObject
}

export type Cinema2ParameterType =
  | 'float'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'color'
  | 'trigger'
  | 'string'
  | 'text'
  | 'vec2'
  | 'vec3'
  | 'media'
  | 'status'
  | 'meter'

export type Cinema2ParameterExposure = 'primary' | 'advanced' | 'hidden' | 'diagnostic'
export type Cinema2ParameterPersistenceScope = 'preset' | 'user' | 'runtime-only'
export type Cinema2ParameterResetMode = 'authored-default' | 'none'

export interface Cinema2ParameterOptionManifest {
  value: string
  label: string
}

export type Cinema2ParameterConditionManifest =
  | {
      kind: 'parameter-equals'
      parameterId: Cinema2ParameterId
      value: Cinema2JsonValue
    }
  | {
      kind: 'parameter-not-equals'
      parameterId: Cinema2ParameterId
      value: Cinema2JsonValue
    }
  | {
      kind: 'capability-available'
      capability: Cinema2CapabilityId
    }

/**
 * Native Cinema 2.0 authored parameter definition. This is descriptive schema,
 * not resolved runtime modulation state. Presets/modules may contribute these
 * definitions without modifying an engine-wide creative parameter catalog.
 */
export interface Cinema2ParameterManifest {
  id: Cinema2ParameterId
  label: string
  description?: string
  type: Cinema2ParameterType
  /**
   * Authored reset value. `defaults.parameterValues` may override this at the
   * preset envelope. Trigger parameters intentionally omit a default value.
   */
  defaultValue?: Cinema2JsonValue
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: readonly Cinema2ParameterOptionManifest[]
  section?: string
  group?: string
  order?: number
  exposure?: Cinema2ParameterExposure
  visibleWhen?: readonly Cinema2ParameterConditionManifest[]
  enabledWhen?: readonly Cinema2ParameterConditionManifest[]
  capabilities?: readonly Cinema2CapabilityRequirement[]
  modulatable?: boolean
  choreographable?: boolean
  automatable?: boolean
  persistence?: Cinema2ParameterPersistenceScope
  reset?: Cinema2ParameterResetMode
  /** Optional media-slot binding for `media` parameters. */
  mediaSlot?: Cinema2MediaSlotRef
  metadata?: Cinema2JsonObject
}

export type Cinema2MediaKind = 'image' | 'video' | 'svg'

export interface Cinema2MediaSlotManifest {
  id: Cinema2MediaSlotId
  label: string
  accepts: readonly Cinema2MediaKind[]
  required?: boolean
  metadata?: Cinema2JsonObject
}

export interface Cinema2ModuleManifest {
  id: Cinema2ModuleId
  typeId: Cinema2ModuleTypeId
  version: number
  enabled?: boolean
  capabilities?: readonly Cinema2CapabilityRequirement[]
  parameters?: Readonly<Record<string, Cinema2JsonValue>>
  media?: Readonly<Record<string, Cinema2MediaSlotRef>>
  config?: Cinema2JsonObject
}

export type Cinema2SceneNodeKind = 'group' | 'module' | 'media' | 'primitive'

export interface Cinema2SceneNodeManifest {
  id: Cinema2SceneNodeId
  kind: Cinema2SceneNodeKind
  parent?: Cinema2SceneNodeRef
  module?: Cinema2ModuleRef
  media?: Cinema2MediaSlotRef
  /** Root default is normalized-screen; children inherit the parent when omitted. */
  coordinateSpace?: Cinema2CoordinateSpace
  transform?: Cinema2TransformManifest
  visible?: boolean
  config?: Cinema2JsonObject
}

/** Scene Graph: authored hierarchy and spatial composition only. */
export interface Cinema2SceneManifest {
  nodes: readonly Cinema2SceneNodeManifest[]
  roots?: readonly Cinema2SceneNodeRef[]
}

export type Cinema2LayerBlendMode = 'normal' | 'add' | 'screen' | 'multiply'
export type Cinema2LayerDepthPolicy = 'disabled' | 'read-only' | 'read-write'

export interface Cinema2LayerManifest {
  id: Cinema2LayerId
  label: string
  source: Cinema2SceneNodeRef
  /** Optional semantic hint. Roles never define mandatory engine slots. */
  role?: string
  visible?: boolean
  opacity?: number
  blendMode?: Cinema2LayerBlendMode
  /** Declarative depth metadata only; Stage 05 does not execute depth/framebuffer policy. */
  depthPolicy?: Cinema2LayerDepthPolicy
  order?: number
  metadata?: Cinema2JsonObject
}

export type Cinema2CameraProjection = 'perspective' | 'orthographic'

export interface Cinema2CameraManifest {
  id: Cinema2CameraId
  label: string
  projection: Cinema2CameraProjection
  transform?: Cinema2TransformManifest
  target?: Cinema2Vector3
  /** Optional scene-node target; mutually exclusive with authored target coordinates. */
  targetNode?: Cinema2SceneNodeRef
  fovDegrees?: number
  near?: number
  far?: number
  config?: Cinema2JsonObject
}

export type Cinema2LightType = 'ambient' | 'directional' | 'point' | 'spot'

export interface Cinema2LightManifest {
  id: Cinema2LightId
  type: Cinema2LightType
  color?: Cinema2Color
  intensity?: number
  transform?: Cinema2TransformManifest
  /** Optional scene-node target for directional/spot-style orientation consumers. */
  targetNode?: Cinema2SceneNodeRef
  config?: Cinema2JsonObject
}

export interface Cinema2LightingManifest {
  lights: readonly Cinema2LightManifest[]
  config?: Cinema2JsonObject
}

export interface Cinema2FogManifest {
  mode: 'linear' | 'exponential'
  color?: Cinema2Color
  density?: number
  near?: number
  far?: number
}

export interface Cinema2EnvironmentManifest {
  backgroundColor?: Cinema2Color
  fog?: Cinema2FogManifest
  exposure?: number
  config?: Cinema2JsonObject
}

export type Cinema2RenderPassKind = 'scene' | 'effect' | 'composite' | 'output'

export interface Cinema2RenderPassManifest {
  id: Cinema2RenderPassId
  kind: Cinema2RenderPassKind
  dependsOn?: readonly Cinema2RenderPassRef[]
  scene?: Cinema2SceneNodeRef
  layers?: readonly Cinema2LayerRef[]
  effect?: Cinema2EffectRef
  config?: Cinema2JsonObject
}

/**
 * Render Graph: authored frame-production topology only. It is intentionally
 * separate from Cinema2SceneManifest. A preset may omit this entire object and
 * let a future compiler synthesize the trivial topology.
 */
export interface Cinema2RenderManifest {
  passes: readonly Cinema2RenderPassManifest[]
  outputPass?: Cinema2RenderPassRef
  config?: Cinema2JsonObject
}

export interface Cinema2EffectManifest {
  id: Cinema2EffectId
  typeId: Cinema2EffectTypeId
  version: number
  enabled?: boolean
  parameters?: Readonly<Record<string, Cinema2JsonValue>>
  config?: Cinema2JsonObject
}

export type Cinema2ChoreographySignal =
  | 'continuous'
  | 'beat'
  | 'downbeat'
  | 'bar'
  | 'phrase'
  | 'section-change'
  | 'build'
  | 'drop'
  | 'vocal-presence'

export interface Cinema2ChoreographySourceManifest {
  signal: Cinema2ChoreographySignal
  capability: Cinema2CapabilityId
  threshold?: number
  config?: Cinema2JsonObject
}

export type Cinema2WritableTargetRef =
  | { kind: 'parameter'; ref: Cinema2ParameterRef }
  | { kind: 'module'; ref: Cinema2ModuleRef; property: string }
  | { kind: 'scene-node'; ref: Cinema2SceneNodeRef; property: string }
  | { kind: 'camera'; ref: Cinema2CameraRef; property: string }
  | { kind: 'light'; ref: Cinema2LightRef; property: string }
  | { kind: 'effect'; ref: Cinema2EffectRef; property: string }

export type Cinema2ChoreographyOperation = 'set' | 'add' | 'multiply' | 'trigger'

export interface Cinema2ChoreographyActionManifest {
  id: Cinema2ChoreographyActionId
  target: Cinema2WritableTargetRef
  operation: Cinema2ChoreographyOperation
  value?: Cinema2JsonValue
  durationBeats?: number
  config?: Cinema2JsonObject
}

export interface Cinema2ChoreographyRuleManifest {
  id: Cinema2ChoreographyRuleId
  priority: number
  source: Cinema2ChoreographySourceManifest
  actions: readonly Cinema2ChoreographyActionManifest[]
  enabled?: boolean
  config?: Cinema2JsonObject
}

export interface Cinema2ChoreographyManifest {
  rules: readonly Cinema2ChoreographyRuleManifest[]
  config?: Cinema2JsonObject
}

export interface Cinema2VariationManifest {
  id: Cinema2VariationId
  label: string
  parameterValues?: Readonly<Record<string, Cinema2JsonValue>>
  moduleOverrides?: Readonly<Record<string, Cinema2JsonObject>>
  config?: Cinema2JsonObject
}

export interface Cinema2PresetDefaultsManifest {
  variation?: Cinema2VariationRef
  camera?: Cinema2CameraRef
  parameterValues?: Readonly<Record<string, Cinema2JsonValue>>
  config?: Cinema2JsonObject
}

export type Cinema2OutputColorSpace = 'srgb' | 'linear-srgb' | 'display-p3'
export type Cinema2OutputAlphaMode = 'opaque' | 'premultiplied' | 'straight'

export interface Cinema2OutputManifest {
  id?: Cinema2OutputId
  renderPass?: Cinema2RenderPassRef
  colorSpace?: Cinema2OutputColorSpace
  alphaMode?: Cinema2OutputAlphaMode
  config?: Cinema2JsonObject
}

/**
 * One native, versioned Cinema 2.0 preset shape. Optional subsystems stay truly
 * optional so a minimal preset is not forced to author unused engine domains.
 */
export interface Cinema2NativePresetManifest {
  schemaId: typeof CINEMA2_NATIVE_PRESET_SCHEMA_ID
  schemaVersion: typeof CINEMA2_NATIVE_PRESET_SCHEMA_VERSION
  id: Cinema2PresetId
  revision: number
  metadata: Cinema2PresetMetadataManifest
  capabilities?: readonly Cinema2CapabilityRequirement[]
  parameters?: readonly Cinema2ParameterManifest[]
  mediaSlots?: readonly Cinema2MediaSlotManifest[]
  modules?: readonly Cinema2ModuleManifest[]
  scene?: Cinema2SceneManifest
  layers?: readonly Cinema2LayerManifest[]
  cameras?: readonly Cinema2CameraManifest[]
  lighting?: Cinema2LightingManifest
  environment?: Cinema2EnvironmentManifest
  render?: Cinema2RenderManifest
  effects?: readonly Cinema2EffectManifest[]
  choreography?: Cinema2ChoreographyManifest
  variations?: readonly Cinema2VariationManifest[]
  defaults?: Cinema2PresetDefaultsManifest
  output?: Cinema2OutputManifest
}

export type Cinema2ManifestDiagnosticCode =
  | 'CINEMA2_MANIFEST_NOT_OBJECT'
  | 'CINEMA2_MANIFEST_SCHEMA_ID_UNSUPPORTED'
  | 'CINEMA2_MANIFEST_SCHEMA_VERSION_UNSUPPORTED'
  | 'CINEMA2_MANIFEST_ID_INVALID'
  | 'CINEMA2_MANIFEST_REVISION_INVALID'
  | 'CINEMA2_MANIFEST_METADATA_INVALID'

export interface Cinema2ManifestDiagnostic {
  code: Cinema2ManifestDiagnosticCode
  message: string
  path: string
}

export type Cinema2ManifestIdentityValidation =
  | { ok: true; manifest: Cinema2NativePresetManifest; diagnostics: readonly [] }
  | { ok: false; manifest: null; diagnostics: readonly Cinema2ManifestDiagnostic[] }

const LOCAL_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/
const NAMESPACED_ID_PATTERN = /^[a-z][a-z0-9-]*(?:[.:/][a-z][a-z0-9-]*)+$/

export function isCinema2StableId(value: unknown): value is Cinema2StableId {
  return typeof value === 'string' && LOCAL_ID_PATTERN.test(value)
}

export function isCinema2NamespacedId(value: unknown): value is Cinema2StableId {
  return typeof value === 'string' && NAMESPACED_ID_PATTERN.test(value)
}

export function cinema2StableId<Id extends Cinema2StableId>(value: string): Id {
  if (!isCinema2StableId(value)) {
    throw new TypeError(`Invalid Cinema 2.0 stable ID "${value}".`)
  }
  return value as Id
}

export function cinema2NamespacedId<Id extends Cinema2StableId>(value: string): Id {
  if (!isCinema2NamespacedId(value)) {
    throw new TypeError(`Invalid Cinema 2.0 namespaced ID "${value}".`)
  }
  return value as Id
}

export function cinema2Ref<Kind extends string>(id: Cinema2StableId<Kind>): Cinema2Reference<Kind> {
  return Object.freeze({ $ref: id })
}

/**
 * Stage-02A boundary validation only: schema/version identity and the minimum
 * authored envelope. Full graph/reference/capability validation belongs to the
 * native preset compiler in a later stage.
 */
export function validateCinema2NativePresetManifestIdentity(value: unknown): Cinema2ManifestIdentityValidation {
  const diagnostics: Cinema2ManifestDiagnostic[] = []
  if (!isPlainObject(value)) {
    return {
      ok: false,
      manifest: null,
      diagnostics: [{
        code: 'CINEMA2_MANIFEST_NOT_OBJECT',
        message: 'Cinema 2.0 native preset manifest must be a plain object.',
        path: '$',
      }],
    }
  }

  if (value.schemaId !== CINEMA2_NATIVE_PRESET_SCHEMA_ID) {
    diagnostics.push({
      code: 'CINEMA2_MANIFEST_SCHEMA_ID_UNSUPPORTED',
      message: `Unsupported Cinema 2.0 native preset schema "${String(value.schemaId)}".`,
      path: '$.schemaId',
    })
  }
  if (value.schemaVersion !== CINEMA2_NATIVE_PRESET_SCHEMA_VERSION) {
    diagnostics.push({
      code: 'CINEMA2_MANIFEST_SCHEMA_VERSION_UNSUPPORTED',
      message: `Unsupported Cinema 2.0 native preset schema version "${String(value.schemaVersion)}".`,
      path: '$.schemaVersion',
    })
  }
  if (!isCinema2NamespacedId(value.id)) {
    diagnostics.push({
      code: 'CINEMA2_MANIFEST_ID_INVALID',
      message: 'Cinema 2.0 native preset ID must be a lowercase namespaced stable ID.',
      path: '$.id',
    })
  }
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) {
    diagnostics.push({
      code: 'CINEMA2_MANIFEST_REVISION_INVALID',
      message: 'Cinema 2.0 native preset revision must be a positive integer.',
      path: '$.revision',
    })
  }
  if (!isPlainObject(value.metadata) || typeof value.metadata.name !== 'string' || value.metadata.name.trim().length === 0) {
    diagnostics.push({
      code: 'CINEMA2_MANIFEST_METADATA_INVALID',
      message: 'Cinema 2.0 native preset metadata must include a non-empty name.',
      path: '$.metadata',
    })
  }

  if (diagnostics.length > 0) return { ok: false, manifest: null, diagnostics }
  return { ok: true, manifest: value as unknown as Cinema2NativePresetManifest, diagnostics: [] }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Neutral native manifest used by the production Cinema 2.0 registry/runtime
 * path until keeper presets are registered in a later stage. It intentionally
 * carries no creative preset behavior or future subsystem requirements.
 */
const CINEMA2_FOUNDATION_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('foundation-root')
const CINEMA2_FOUNDATION_LAYER_ID = cinema2StableId<Cinema2LayerId>('foundation-layer')

export const CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.foundation'),
  revision: 1,
  metadata: Object.freeze({ name: 'Cinema 2.0 Foundation' }),
  scene: Object.freeze({
    nodes: Object.freeze([{
      id: CINEMA2_FOUNDATION_ROOT_NODE_ID,
      kind: 'group' as const,
      coordinateSpace: 'normalized-screen' as const,
      visible: true,
    }]),
  }),
  layers: Object.freeze([{
    id: CINEMA2_FOUNDATION_LAYER_ID,
    label: 'Foundation',
    source: cinema2Ref(CINEMA2_FOUNDATION_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  }]),
})

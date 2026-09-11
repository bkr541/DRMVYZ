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

export interface Cinema2TransformManifest {
  position?: Cinema2Vector3
  rotation?: Cinema2Vector3
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
  | 'vec2'
  | 'vec3'
  | 'text'

export interface Cinema2ParameterOptionManifest {
  value: string
  label: string
}

export interface Cinema2ParameterManifest {
  id: Cinema2ParameterId
  label: string
  type: Cinema2ParameterType
  defaultValue?: Cinema2JsonValue
  min?: number
  max?: number
  step?: number
  options?: readonly Cinema2ParameterOptionManifest[]
  modulatable?: boolean
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

export interface Cinema2LayerManifest {
  id: Cinema2LayerId
  label: string
  source: Cinema2SceneNodeRef
  enabled?: boolean
  opacity?: number
  blendMode?: Cinema2LayerBlendMode
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
 * Minimal authored manifest used only to prove the native contract is reachable
 * from the existing Stage-01 production runtime. It is not a preset registry,
 * compiler input API, or meaningful visual preset.
 */
export const CINEMA2_RUNTIME_FOUNDATION_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.foundation'),
  revision: 1,
  metadata: Object.freeze({ name: 'Cinema 2.0 Foundation' }),
})

import type {
  CinemaCameraMode,
  CinemaCameraResourceDefinition,
  CinemaCompositionDefinition,
  CinemaParameterDefinition,
} from './CinemaDomain'
import type { CinemaNodeTypeId, CinemaParameterId } from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type {
  CinemaCameraCapabilityDescriptor,
  CinemaCameraControl,
  CinemaNodeTypeDefinition,
  CinemaParameterCapabilityDescriptor,
  CinemaParameterSupportMode,
} from './CinemaRendererContracts'
import {
  CINEMA_CAMERA_PARAMETER_IDS,
  createCinemaCameraParameterSchemas,
} from './CinemaCameraRuntime'
import {
  isCinemaCameraCapabilityCompatible,
  isCinemaComposerCameraAssignedToNode,
} from './CinemaComposerStage19'

const LEGACY_UNVERIFIED_REASON = 'This renderer does not declare a verified Inspector parameter consumer.'
const CAPABILITY_MAP_CACHE = new WeakMap<object, ReadonlyMap<CinemaParameterId, Readonly<CinemaParameterCapabilityDescriptor>>>()

type ResolvedCameraMode = Exclude<CinemaCameraMode, 'auto-director'>

interface CinemaCameraParameterRequirement {
  mode: ResolvedCameraMode
  controls: readonly CinemaCameraControl[]
}

const CAMERA_PARAMETER_REQUIREMENTS = new Map<CinemaParameterId, readonly CinemaCameraParameterRequirement[]>([
  [CINEMA_CAMERA_PARAMETER_IDS.position, requirements(['locked', 'dolly', 'fly', 'handheld'], ['position'])],
  [CINEMA_CAMERA_PARAMETER_IDS.rotation, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['rotation'])],
  [CINEMA_CAMERA_PARAMETER_IDS.target, requirements(['orbit'], ['target'])],
  [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['fov'])],
  [CINEMA_CAMERA_PARAMETER_IDS.rollRadians, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['roll'])],
  [CINEMA_CAMERA_PARAMETER_IDS.near, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['near'])],
  [CINEMA_CAMERA_PARAMETER_IDS.far, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['far'])],
  [CINEMA_CAMERA_PARAMETER_IDS.orbitRadius, requirements(['orbit'], ['position', 'orbit'])],
  [CINEMA_CAMERA_PARAMETER_IDS.orbitSpeed, requirements(['orbit'], ['position', 'orbit', 'speed'])],
  [CINEMA_CAMERA_PARAMETER_IDS.orbitElevation, requirements(['orbit'], ['position', 'orbit'])],
  [CINEMA_CAMERA_PARAMETER_IDS.dollyRange, requirements(['dolly'], ['dolly'])],
  [CINEMA_CAMERA_PARAMETER_IDS.dollySpeed, requirements(['dolly'], ['dolly', 'speed'])],
  [CINEMA_CAMERA_PARAMETER_IDS.flySpeed, requirements(['fly', 'path'], ['position', 'speed'])],
  [CINEMA_CAMERA_PARAMETER_IDS.banking, requirements(['orbit', 'fly'], ['banking'])],
  [CINEMA_CAMERA_PARAMETER_IDS.shake, requirements(['handheld'], ['shake'])],
  [CINEMA_CAMERA_PARAMETER_IDS.beatPunch, requirements(['locked', 'dolly', 'handheld'], ['beat-punch'])],
  [CINEMA_CAMERA_PARAMETER_IDS.handheld, requirements(['handheld'], ['handheld'])],
  [CINEMA_CAMERA_PARAMETER_IDS.focusDistance, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['depth-of-field'])],
  [CINEMA_CAMERA_PARAMETER_IDS.aperture, requirements(['locked', 'dolly', 'orbit', 'fly', 'handheld', 'path'], ['depth-of-field'])],
])

/**
 * Renderer-owned parameter capability contract. Definitions that omit metadata
 * are treated conservatively: their parameters remain persisted, but are not
 * exposed as editable Inspector controls until a runtime consumer is verified.
 */
export function createCinemaParameterCapabilities(
  parameters: readonly CinemaParameterDefinition[],
  support: Exclude<CinemaParameterSupportMode, 'unsupported'> = 'live',
): readonly CinemaParameterCapabilityDescriptor[] {
  return parameters.map(parameter => ({ parameterId: parameter.id, support }))
}

export function createCinemaParameterCapabilityMap(
  definition: Readonly<CinemaNodeTypeDefinition>,
): ReadonlyMap<CinemaParameterId, Readonly<CinemaParameterCapabilityDescriptor>> {
  const cacheable = Object.isFrozen(definition)
  const cached = cacheable ? CAPABILITY_MAP_CACHE.get(definition) : undefined
  if (cached) return cached
  const declared = definition.parameterCapabilities ?? []
  const parameterIds = new Set(definition.parameters.map(parameter => parameter.id))
  const byId = new Map<CinemaParameterId, Readonly<CinemaParameterCapabilityDescriptor>>()
  for (const capability of declared) {
    if (parameterIds.has(capability.parameterId)) byId.set(capability.parameterId, capability)
  }
  if (cacheable) CAPABILITY_MAP_CACHE.set(definition, byId)
  return byId
}

export function getCinemaParameterCapability(
  definition: Readonly<CinemaNodeTypeDefinition>,
  parameterId: CinemaParameterId,
): Readonly<CinemaParameterCapabilityDescriptor> {
  return createCinemaParameterCapabilityMap(definition).get(parameterId) ?? {
    parameterId,
    support: 'unsupported',
    reason: LEGACY_UNVERIFIED_REASON,
  }
}

export function getCinemaSupportedParameterSchemas(
  definition: Readonly<CinemaNodeTypeDefinition>,
): readonly CinemaParameterDefinition[] {
  const capabilities = createCinemaParameterCapabilityMap(definition)
  return definition.parameters.filter(parameter => {
    const capability = capabilities.get(parameter.id)
    return capability != null && capability.support !== 'unsupported'
  })
}

export function getCinemaUnsupportedParameterSchemas(
  definition: Readonly<CinemaNodeTypeDefinition>,
): readonly CinemaParameterDefinition[] {
  const supportedIds = new Set(getCinemaSupportedParameterSchemas(definition).map(parameter => parameter.id))
  return definition.parameters.filter(parameter => !supportedIds.has(parameter.id))
}

/**
 * A composition-level master is editable only when an enabled node exposes a
 * verified parameter consumer bound to that master. This keeps master support
 * renderer-driven and makes preset switches deterministic without preset-ID
 * policy in React.
 */
export function getCinemaSupportedMasterParameterSchemas(
  composition: Readonly<CinemaCompositionDefinition>,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
): readonly CinemaParameterDefinition[] {
  const definitionByTypeId = new Map<CinemaNodeTypeId, Readonly<CinemaNodeTypeDefinition>>()
  for (const entry of definitions) definitionByTypeId.set(entry.id, entry.definition)
  const supportedMasterIds = new Set<CinemaParameterId>()
  for (const node of composition.nodes) {
    if (!node.enabled) continue
    const definition = definitionByTypeId.get(node.typeId)
    if (!definition) continue
    const capabilities = createCinemaParameterCapabilityMap(definition)
    for (const parameter of definition.parameters) {
      const masterId = parameter.masterBinding?.masterParameterId
      if (!masterId) continue
      const capability = capabilities.get(parameter.id)
      if (capability && capability.support !== 'unsupported') supportedMasterIds.add(masterId)
    }
  }
  return composition.masterParameters.filter(parameter => supportedMasterIds.has(parameter.id))
}

/**
 * Builds the Inspector-facing camera schema from the same renderer capability
 * descriptors used by Stage 2. The canonical camera schema remains untouched
 * for persistence, modulation, and runtime resolution; this projection only
 * advertises values that are applicable to the resource's active mode and have
 * a verified consumer on at least one enabled, assigned shared-camera node.
 */
export function createCinemaSupportedCameraParameterSchemaMap(
  composition: Readonly<CinemaCompositionDefinition>,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
): Readonly<Record<string, readonly Readonly<CinemaParameterDefinition>[]>> {
  const definitionByTypeId = new Map<CinemaNodeTypeId, Readonly<CinemaNodeTypeDefinition>>()
  for (const entry of definitions) definitionByTypeId.set(entry.id, entry.definition)
  const result: Record<string, readonly Readonly<CinemaParameterDefinition>[]> = {}

  for (const camera of composition.cameras) {
    const consumers = composition.nodes.flatMap(node => {
      if (!node.enabled || !isCinemaComposerCameraAssignedToNode(camera, node.id)) return []
      const definition = definitionByTypeId.get(node.typeId)
      if (!definition || !isCinemaCameraCapabilityCompatible(definition.capabilities.camera.mode)) return []
      return [definition.capabilities.camera]
    })
    result[camera.id] = getCinemaSupportedCameraParameterSchemas(camera, consumers)
  }

  return Object.freeze(result)
}

export function getCinemaSupportedCameraParameterSchemas(
  camera: Readonly<CinemaCameraResourceDefinition>,
  consumers: readonly Readonly<CinemaCameraCapabilityDescriptor>[],
): readonly Readonly<CinemaParameterDefinition>[] {
  if (consumers.length === 0) return Object.freeze([])
  const modes = getCinemaCameraResolvedModes(camera)
  const schemas = createCinemaCameraParameterSchemas(camera)
  return Object.freeze(schemas.filter(schema => {
    const modeRequirements = CAMERA_PARAMETER_REQUIREMENTS.get(schema.id)
    if (!modeRequirements) return false
    return modeRequirements.some(requirement => (
      modes.includes(requirement.mode)
      && consumers.some(consumer => requirement.controls.every(control => consumer.controls.includes(control)))
    ))
  }))
}

export function getCinemaCameraResolvedModes(
  camera: Readonly<CinemaCameraResourceDefinition>,
): readonly ResolvedCameraMode[] {
  if (camera.mode !== 'auto-director') return Object.freeze([camera.mode])
  const modes = [...new Set((camera.authoredShots ?? []).map(shot => shot.mode))]
  return Object.freeze(modes.length > 0 ? modes : ['locked'])
}

function requirements(
  modes: readonly ResolvedCameraMode[],
  controls: readonly CinemaCameraControl[],
): readonly CinemaCameraParameterRequirement[] {
  return modes.map(mode => Object.freeze({ mode, controls: Object.freeze([...controls]) }))
}

import type { CinemaCompositionDefinition, CinemaParameterDefinition } from './CinemaDomain'
import type { CinemaNodeTypeId, CinemaParameterId } from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type { CinemaNodeTypeDefinition, CinemaParameterCapabilityDescriptor, CinemaParameterSupportMode } from './CinemaRendererContracts'

const LEGACY_UNVERIFIED_REASON = 'This renderer does not declare a verified Inspector parameter consumer.'
const CAPABILITY_MAP_CACHE = new WeakMap<object, ReadonlyMap<CinemaParameterId, Readonly<CinemaParameterCapabilityDescriptor>>>()

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
  const byId = new Map<CinemaParameterId, Readonly<CinemaParameterCapabilityDescriptor>>()
  for (const capability of declared) byId.set(capability.parameterId, capability)
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

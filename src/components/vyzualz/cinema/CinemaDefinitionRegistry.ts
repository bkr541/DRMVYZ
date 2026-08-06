import {
  createCinemaNodeDefinitionRegistry,
  type CinemaNodeRegistryEntry,
} from './CinemaNodeRegistry'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type { CinemaRuntimeNodeRegistry } from './CinemaRuntimeNodeRegistry'

/**
 * Builds runtime-neutral node-definition metadata from persisted Cinema
 * definitions without importing the foundation/adapters or creating renderers.
 */
export function createCinemaDefinitionRegistryFromPersistedDefinitions(
  definitions: readonly CinemaPersistedDefinition[],
  runtimeRegistry: CinemaRuntimeNodeRegistry,
) {
  const registrations: CinemaNodeRegistryEntry[] = definitions.map(definition => ({
    definition: definition.definition,
    rendererPlugin: {
      id: definition.rendererPluginId,
      available: runtimeRegistry.hasPlugin(definition.rendererPluginId),
    },
    source: definition.source,
    ...(definition.feedback ? { feedback: definition.feedback } : {}),
    quality: definition.quality,
  }))
  return createCinemaNodeDefinitionRegistry(registrations)
}

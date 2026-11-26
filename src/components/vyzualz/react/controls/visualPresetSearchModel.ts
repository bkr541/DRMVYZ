import { applyPresetMetadata, type PresetMetadataRow } from '../../../../features/presetCatalog/presetMetadata'
import type { PresetOrganization } from '../../../../features/presetOrganization/presetOrganizationDb'
import type { FilterPreset } from '../layoutLab/presetFilterStudyData'
import { resolvePresetDiscoveryMetadata, type PresetDiscoverySource } from '../presetDiscovery'

export type VisualPresetSource = PresetDiscoverySource & { id: string }

/** Only decorate the current engine's actual card sources; metadata never adds a preset to a browser. */
export function buildVisualPresetRecords(engineId: string, sources: readonly VisualPresetSource[], metadata: ReadonlyMap<string, PresetMetadataRow>,
  organizations: Readonly<Record<string, PresetOrganization>>, collections: readonly { id: string; name: string }[]): FilterPreset[] {
  // Preset Manager calls the legacy oscillator engine soundDrawing; its runtime scope is still oscilloscope.
  const organizationEngine = engineId === 'oscilloscope' ? 'soundDrawing' : engineId
  const byId = new Map(collections.map(collection => [collection.id, collection.name]))
  const shipped = sources.map(source => ({ id: `${organizationEngine}:${source.id}`, artworkId: source.id, name: source.name,
    description: source.description ?? '', ...resolvePresetDiscoveryMetadata(source, engineId) }))
  return applyPresetMetadata(shipped, metadata).map(preset => {
    const organization = organizations[preset.id]
    return { ...preset, id: preset.artworkId, favorite: false,
      tags: [...new Set([...preset.tags, ...(organization?.tags ?? [])])],
      collections: (organization?.collectionIds ?? []).flatMap(id => byId.has(id) ? [{ id, name: byId.get(id)! }] : []) }
  })
}

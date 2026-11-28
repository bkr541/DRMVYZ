import type { Cinema2NativePresetManifest } from '../cinema2/contracts/Cinema2NativePresetManifest'
import { useState } from 'react'
import { cinema2NativePresetRegistry, type Cinema2PresetId } from '../cinema2'
import { usePresetScopeFilter } from '../../../features/presetCatalog/presetCatalogStore'
import { VisualPresetSearch } from './controls/VisualPresetSearch'
import { useVisualPresetSearch } from './controls/useVisualPresetSearch'
import { ReactPresetCard } from './ReactPresetCard'
import { resolvePresetDiscoveryMetadata } from './presetDiscovery'

const CINEMA2_PRESET_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#61d6aa']

export interface Cinema2PresetsPanelProps {
  activePresetId: Cinema2PresetId
  onSelectPreset: (presetId: Cinema2PresetId) => void
  /** Optional isolated catalog for design previews; production uses the shared registry. */
  catalog?: { presets: readonly Cinema2NativePresetManifest[]; userIds: ReadonlySet<string> }
}

/** Native Cinema 2.0 preset browser backed directly by the engine registry. */
export function Cinema2PresetsPanel({ activePresetId, onSelectPreset, catalog }: Cinema2PresetsPanelProps) {
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const inScope = usePresetScopeFilter('cinema2', scope)
  const scoped = (catalog?.presets ?? cinema2NativePresetRegistry.list()).filter(manifest => !manifest.metadata.tags?.includes('internal'))
  const search = useVisualPresetSearch('cinema2', scoped.map(manifest => ({ id: manifest.id, ...manifest.metadata,
    ...resolvePresetDiscoveryMetadata(manifest.metadata, 'cinematic') })), scope, setScope,
    id => catalog ? catalog.userIds.has(id) === (scope === 'user') : inScope(id), 'cinema2', id => onSelectPreset(id as Cinema2PresetId))
  const query = search.query
  const needle = query.trim()
  const presets = search.sortByName(scoped.filter(manifest => search.matchingIds.has(manifest.id)), manifest => manifest.id, manifest => manifest.metadata.name)

  return (
    <section className="rv-engine-panel-list rv-engine-panel-list--rail-presets" aria-label="Cinema 2.0 presets" data-preset-scope={scope}>
      <VisualPresetSearch {...search.searchProps} ariaLabel="Search Cinema 2.0 presets" />
      <div className="rv-preset-scroll">
        <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2" data-cinema2-preset-grid="true">
          {presets.map((manifest, index) => (
            <ReactPresetCard
              key={manifest.id}
              id={manifest.id}
              engineId="cinema2"
              title={search.recordsById.get(manifest.id)?.name ?? manifest.metadata.name}
              description={manifest.metadata.description ?? manifest.metadata.name}
              palette={[{ color: CINEMA2_PRESET_TONES[index % CINEMA2_PRESET_TONES.length] }]}
              isActive={manifest.id === activePresetId}
              activateLabel={`Load ${manifest.metadata.name}`}
              onActivate={() => onSelectPreset(manifest.id)}
              dataAttributes={{ 'data-cinema2-preset-id': manifest.id }}
            />
          ))}
          {presets.length === 0 && (
            <div className="rv-ctrl-info">
              {needle ? `No Cinema 2.0 presets match “${query}”.` : scope === 'user' ? 'No user presets yet.' : 'No Cinema 2.0 presets.'}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

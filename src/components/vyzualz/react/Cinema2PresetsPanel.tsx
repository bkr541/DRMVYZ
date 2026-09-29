import { useState } from 'react'
import { cinema2NativePresetRegistry, type Cinema2PresetId } from '../cinema2'
import { PresetSearchRow } from './controls/PresetSearchRow'
import { PanelSubtabs } from './PanelSubtabs'
import { ReactPresetCard } from './ReactPresetCard'

const CINEMA2_PRESET_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#61d6aa']

export interface Cinema2PresetsPanelProps {
  activePresetId: Cinema2PresetId
  onSelectPreset: (presetId: Cinema2PresetId) => void
}

/** Native Cinema 2.0 preset browser backed directly by the engine registry. */
export function Cinema2PresetsPanel({ activePresetId, onSelectPreset }: Cinema2PresetsPanelProps) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const needle = query.trim().toLowerCase()
  const presets = cinema2NativePresetRegistry.list().filter(manifest => {
    if (manifest.metadata.tags?.includes('internal')) return false
    const text = `${manifest.metadata.name} ${manifest.metadata.description ?? ''} ${(manifest.metadata.tags ?? []).join(' ')}`.toLowerCase()
    return text.includes(needle)
  })

  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema 2.0 presets" data-preset-scope={scope}>
      <PanelSubtabs
        value={scope}
        options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]}
        onChange={setScope}
        ariaLabel="Preset scope"
      />
      <PresetSearchRow
        query={query}
        onQueryChange={setQuery}
        ariaLabel="Search Cinema 2.0 presets"
      />
      {scope === 'system' && (
      <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2" data-cinema2-preset-grid="true">
        {presets.map((manifest, index) => (
          <ReactPresetCard
            key={manifest.id}
            id={manifest.id}
            title={manifest.metadata.name}
            description={manifest.metadata.description ?? manifest.metadata.name}
            palette={[{ color: CINEMA2_PRESET_TONES[index % CINEMA2_PRESET_TONES.length] }]}
            isActive={manifest.id === activePresetId}
            activateLabel={`Load ${manifest.metadata.name}`}
            onActivate={() => onSelectPreset(manifest.id)}
            dataAttributes={{ 'data-cinema2-preset-id': manifest.id }}
          />
        ))}
        {presets.length === 0 && <div className="rv-ctrl-info">No Cinema 2.0 presets match “{query}”.</div>}
      </div>
      )}
    </section>
  )
}

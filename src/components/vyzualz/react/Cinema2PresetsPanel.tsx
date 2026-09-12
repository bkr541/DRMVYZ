import { useState, type CSSProperties } from 'react'
import { cinema2NativePresetRegistry, type Cinema2PresetId } from '../cinema2'
import { PresetSearchRow } from './controls/PresetSearchRow'

const CINEMA2_PRESET_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#61d6aa']

export interface Cinema2PresetsPanelProps {
  activePresetId: Cinema2PresetId
  onSelectPreset: (presetId: Cinema2PresetId) => void
}

/** Native Cinema 2.0 preset browser backed directly by the engine registry. */
export function Cinema2PresetsPanel({ activePresetId, onSelectPreset }: Cinema2PresetsPanelProps) {
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const needle = query.trim().toLowerCase()
  const presets = cinema2NativePresetRegistry.list().filter(manifest => {
    if (manifest.metadata.tags?.includes('internal')) return false
    const text = `${manifest.metadata.name} ${manifest.metadata.description ?? ''} ${(manifest.metadata.tags ?? []).join(' ')}`.toLowerCase()
    return text.includes(needle)
  })

  return (
    <section className="rv-cinema-panel-list" aria-label="Cinema 2.0 presets">
      <PresetSearchRow
        query={query}
        onQueryChange={setQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        ariaLabel="Search Cinema 2.0 presets"
      />
      <div className={`rv-cinema-preset-grid${viewMode === 'list' ? ' rv-cinema-preset-grid--list' : ''}`} data-cinema2-preset-grid="true">
        {presets.map((manifest, index) => {
          const active = manifest.id === activePresetId
          return (
            <button
              type="button"
              key={manifest.id}
              className={`rv-cinema-preset-tile${active ? ' is-active' : ''}`}
              aria-pressed={active}
              data-cinema2-preset-id={manifest.id}
              title={manifest.metadata.description}
              onClick={() => onSelectPreset(manifest.id)}
            >
              <span
                className="rv-cinema-preset-tile-thumb"
                style={{ '--rv-preset-tone': CINEMA2_PRESET_TONES[index % CINEMA2_PRESET_TONES.length] } as CSSProperties}
                aria-hidden="true"
              />
              <span className="rv-cinema-preset-tile-name">{manifest.metadata.name}</span>
            </button>
          )
        })}
        {presets.length === 0 && <div className="rv-ctrl-info">No Cinema 2.0 presets match “{query}”.</div>}
      </div>
    </section>
  )
}

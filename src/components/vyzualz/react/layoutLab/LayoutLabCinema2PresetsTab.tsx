import { useState } from 'react'
import { cinema2NativePresetRegistry } from '../../cinema2'
import { PresetSearchRow } from '../controls/PresetSearchRow'
import { PanelSubtabs } from '../PanelSubtabs'
import { presetMatchesDiscoveryQuery, resolvePresetDiscoveryMetadata } from '../presetDiscovery'
import { ReactPresetCard } from '../ReactPresetCard'

// ── Layout Lab · PRESETS tab · Cinema 2.0 ───────────────────────────────────
//
// A disconnected mockup of the Inspector's PRESETS tab with Cinema 2.0 active (Cinema2PresetsPanel): SYSTEM / USER,
// the search row and the two-column poster grid. It lists the presets Cinema 2.0 really ships (read from the engine
// registry, excluding the internal ones, exactly as the production panel does) through the same SYSTEM / USER subtabs,
// search row, discovery matching and preset card. It differs in being local only: the production panel also
// reads the account's preset catalog, which would call the backend, and loading a preset only moves the highlight
// here, so no scene is loaded and nothing is saved.

const CINEMA2_PRESET_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#61d6aa']
const ACTIVE_PRESET_NAME = 'Electric Storm'

export function LayoutLabCinema2PresetsTab() {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const [activeId, setActiveId] = useState<string | null>(null)
  const needle = query.trim().toLowerCase()
  // Every shipped Cinema 2.0 preset is a system preset; the user scope has none in this mockup.
  const presets = scope === 'user' ? [] : cinema2NativePresetRegistry.list().filter(manifest => {
    if (manifest.metadata.tags?.includes('internal')) return false
    return presetMatchesDiscoveryQuery(needle, {
      ...manifest.metadata,
      ...resolvePresetDiscoveryMetadata(manifest.metadata, 'cinematic'),
    })
  })
  const active = activeId ?? presets.find(manifest => manifest.metadata.name === ACTIVE_PRESET_NAME)?.id ?? null

  return (
    <section className="rv-engine-panel-list rv-engine-panel-list--rail-presets" aria-label="Cinema 2.0 presets" data-preset-scope={scope}>
      <PanelSubtabs
        value={scope}
        options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]}
        onChange={setScope}
        ariaLabel="Preset scope"
      />
      <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search Cinema 2.0 presets" />
      <div className="rv-preset-scroll">
        <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2" data-cinema2-preset-grid="true">
          {presets.map((manifest, index) => (
            <ReactPresetCard
              key={manifest.id}
              id={manifest.id}
              title={manifest.metadata.name}
              description={manifest.metadata.description ?? manifest.metadata.name}
              palette={[{ color: CINEMA2_PRESET_TONES[index % CINEMA2_PRESET_TONES.length]! }]}
              isActive={manifest.id === active}
              activateLabel={`Load ${manifest.metadata.name}`}
              onActivate={() => setActiveId(manifest.id)}
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

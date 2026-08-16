import { useState, type CSSProperties } from 'react'
import { getReactEngineIconComponent } from '../reactEngineIcons'
import { ReactPresetCard } from '../ReactPresetCard'

// ── SoundDrawingPresetsMockup ──────────────────────────────────────────────
//
// Disconnected copy of ReactPresetsPanel.tsx's layout for Sound Drawing
// (right rail, PRESETS tab) — engine header, library-view tabs (Current
// Engine / Favorites / All Engines), and the shared Spotlight preset card
// (ReactPresetCard, same component the real panel renders). Cards use
// static sample data and a flat color swatch in place of
// ReactPresetThumbnail, which renders a live canvas preview of the actual
// oscillator settings — that's a real renderer, out of scope for a mockup.

type LibraryView = 'current' | 'favorites' | 'all'

const LIBRARY_VIEW_LABELS: Record<LibraryView, string> = {
  current: 'Current Engine',
  favorites: 'Favorites',
  all: 'All Engines',
}

interface MockPreset {
  id: string
  name: string
  description: string
  modeHint: string
  swatch: string
}

const MOCK_PRESETS: MockPreset[] = [
  { id: 'p1', name: 'Waveform Classic', description: 'The default live waveform trace.', modeHint: 'Waveform', swatch: '#4ac7db' },
  { id: 'p2', name: 'Radial Pulse', description: 'A radial scope that blooms outward on bass hits.', modeHint: 'Radial Scope', swatch: '#61d6aa' },
  { id: 'p3', name: 'Neon Spiral', description: 'A spiral trace with a slow hue drift.', modeHint: 'Spiral Scope', swatch: '#b84fc9' },
  { id: 'p4', name: 'Title Card', description: 'Static text source styled for track intros.', modeHint: '"DRMVYZ"', swatch: '#d8b95a' },
]

function SoundDrawingPresetCardMockup({
  preset,
  isActive,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: {
  preset: MockPreset
  isActive: boolean
  isFavorite: boolean
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  return (
    <ReactPresetCard
      id={preset.id}
      title={preset.name}
      description={preset.description}
      thumbnail={<div style={{ width: '100%', height: '100%', background: preset.swatch } as CSSProperties} />}
      chips={[{ label: preset.modeHint }]}
      palette={[{ color: preset.swatch }]}
      isActive={isActive}
      isFavorite={isFavorite}
      activateLabel={`Load ${preset.name}`}
      onActivate={() => onSelect(preset.id)}
      onToggleFavorite={() => onToggleFavorite(preset.id)}
    />
  )
}

export function SoundDrawingPresetsMockup() {
  const [libraryView, setLibraryView] = useState<LibraryView>('current')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const SoundDrawingIcon = getReactEngineIconComponent('oscilloscope')

  const toggleFavorite = (id: string) => {
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visiblePresets = libraryView === 'favorites'
    ? MOCK_PRESETS.filter(preset => favoriteIds.has(preset.id))
    : MOCK_PRESETS

  const cardProps = {
    activePresetId,
    onSelect: setActivePresetId,
    favoriteIds,
    onToggleFavorite: toggleFavorite,
  }

  return (
    <div className="rv-presets-panel">
      <header className="rv-preset-library-header">
        <div className="rv-preset-library-engine">
          <span aria-hidden="true">{SoundDrawingIcon ? <SoundDrawingIcon /> : '〜'}</span>
          <div>
            <strong>Sound Drawing</strong>
            <small>{visiblePresets.length} presets for the selected engine</small>
          </div>
        </div>
        <div className="rv-preset-library-views" role="tablist" aria-label="Preset library filter">
          {(Object.keys(LIBRARY_VIEW_LABELS) as LibraryView[]).map(view => (
            <button
              key={view}
              type="button"
              role="tab"
              className={libraryView === view ? 'is-active' : ''}
              aria-selected={libraryView === view}
              onClick={() => setLibraryView(view)}
            >
              {LIBRARY_VIEW_LABELS[view]}
              {view === 'favorites' && favoriteIds.size > 0 ? ` ${favoriteIds.size}` : ''}
            </button>
          ))}
        </div>
      </header>

      <p className="rv-presets-hint">
        {libraryView === 'current'
          ? 'Sound Drawing presets only. Use All Engines to browse other engines.'
          : libraryView === 'favorites'
            ? 'Star presets from any engine to keep them together here.'
            : 'Selecting another engine’s preset switches that engine and loads the look.'}
      </p>

      <div className="rv-sound-drawing-presets-help drm-help-overlay-anchor">
        {visiblePresets.length === 0 ? (
          <div className="rv-preset-library-empty">
            <strong>No favorite presets yet</strong>
            <span>Choose ☆ on a preset to pin it here.</span>
          </div>
        ) : libraryView === 'all' ? (
          <div className="rv-preset-group">
            <div className="rv-preset-group-hdr">
              <span className="rv-preset-group-hdr-icon" style={{ color: visiblePresets[0].swatch }} aria-hidden="true">
                {SoundDrawingIcon ? <SoundDrawingIcon /> : '〜'}
              </span>
              <span className="rv-preset-group-hdr-label">Sound Drawing</span>
              <span className="rv-preset-group-hdr-count">{visiblePresets.length}</span>
            </div>
            <div className="rv-preset-group-cards" data-preset-grid>
              {visiblePresets.map(preset => (
                <SoundDrawingPresetCardMockup
                  key={preset.id}
                  preset={preset}
                  isActive={preset.id === activePresetId}
                  isFavorite={favoriteIds.has(preset.id)}
                  onSelect={cardProps.onSelect}
                  onToggleFavorite={cardProps.onToggleFavorite}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>
            {visiblePresets.map(preset => (
              <SoundDrawingPresetCardMockup
                key={preset.id}
                preset={preset}
                isActive={preset.id === activePresetId}
                isFavorite={favoriteIds.has(preset.id)}
                onSelect={cardProps.onSelect}
                onToggleFavorite={cardProps.onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

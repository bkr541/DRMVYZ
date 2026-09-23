import { MockEngineDropdown } from './MockEngineDropdown'
import { Cinema2StillPreview } from './Cinema2StillPreview'
import type { Cinema2MockState } from './useCinema2MockState'
import type { LayoutLabEngineId } from './layoutLabEngineCatalog'

// ── Cinema2StillsFilmstripMockup ────────────────────────────────────────────
//
// Left rail, Cinema 2.0 engine. Empty until a concept preset is selected in
// the right rail's PRESETS tab; once one is, shows its 10 stills as a
// clickable contact sheet — click one to load it into the center preview.

export function Cinema2StillsFilmstripMockup({
  engineId,
  onSelectEngine,
  state,
}: {
  engineId: LayoutLabEngineId
  onSelectEngine: (id: LayoutLabEngineId) => void
  state: Cinema2MockState
}) {
  return (
    <div className="rv-left-workspace-shell" data-description-density="compact">
      <section className="rv-context-workspace">
        <header className="rv-context-workspace-header">
          <MockEngineDropdown engineId={engineId} onSelect={onSelectEngine} />
        </header>
        <div className="rv-left-tab-body">
          {!state.selectedPreset ? (
            <div className="rv-ctrl-info ll-c2-stills-empty">Select a preset in the right panel to preview its stills.</div>
          ) : (
            <div className="ll-c2-stills-panel">
              <div className="ll-c2-stills-heading">
                <span className="ll-c2-stills-heading-name">{state.selectedPreset.name}</span>
                <span className="ll-c2-stills-heading-count">{state.selectedPreset.stills.length} stills</span>
              </div>
              <div className="ll-c2-stills-grid" role="list" aria-label="Concept stills (mockup)">
                {state.selectedPreset.stills.map(still => {
                  const active = state.selectedStill?.id === still.id
                  return (
                    <button
                      type="button"
                      key={still.id}
                      className={`ll-c2-still-tile${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => state.selectStill(still.id)}
                    >
                      <span className="ll-c2-still-tile-frame">
                        <Cinema2StillPreview still={still} uid={`llfs-${still.id}`} />
                      </span>
                      <span className="ll-c2-still-tile-label">{still.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

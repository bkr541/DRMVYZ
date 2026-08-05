import { useState } from 'react'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../reactEngineCatalog'
import { getReactEngineIconComponent } from '../reactEngineIcons'
import type { ReactEngineId } from '../ReactTypes'

// Shared by LayoutLabMockup (generic engines) and SoundDrawingMockup (the
// Sound Drawing full-fidelity preview) so both use the exact same dropdown
// instead of two drifting copies.

function MockEngineIcon({ engineId, glyph }: { engineId: ReactEngineId, glyph: string }) {
  const IconComponent = getReactEngineIconComponent(engineId)
  return IconComponent ? <IconComponent /> : <>{glyph}</>
}

export function MockEngineDropdown({
  engineId,
  onSelect,
}: {
  engineId: ReactEngineId
  onSelect: (id: ReactEngineId) => void
}) {
  const [open, setOpen] = useState(false)
  const activeEngine = REACT_ENGINE_CATALOG[engineId]

  return (
    <div className="rv-engine-dropdown">
      <button
        type="button"
        className="rv-engine-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected engine: ${activeEngine.label}`}
        onClick={() => setOpen(value => !value)}
      >
        <span className="rv-engine-dropdown-copy">
          <span className="rv-engine-dropdown-eyebrow">Engine</span>
          <span className="rv-engine-dropdown-label">{activeEngine.label}</span>
          <span className="rv-engine-dropdown-description">{activeEngine.description}</span>
        </span>
        <span className="rv-engine-dropdown-icon" aria-hidden="true">
          <MockEngineIcon engineId={engineId} glyph={activeEngine.icon} />
        </span>
      </button>

      {open && (
        <div className="rv-engine-dropdown-menu" role="listbox" aria-label="Engine (mockup)">
          {REACT_ENGINE_IDS.map(id => {
            const engine = REACT_ENGINE_CATALOG[id]
            const active = id === engineId
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                className={`rv-engine-dropdown-option${active ? ' is-active' : ''}`}
                onClick={() => {
                  onSelect(id)
                  setOpen(false)
                }}
              >
                <span className="rv-engine-dropdown-option-icon" aria-hidden="true">
                  <MockEngineIcon engineId={id} glyph={engine.icon} />
                </span>
                <span className="rv-engine-dropdown-option-copy">
                  <span>{engine.label}</span>
                  <small className="rv-control-helper-copy">{engine.description}</small>
                </span>
                {active && <span className="rv-engine-dropdown-option-check" aria-hidden="true">✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

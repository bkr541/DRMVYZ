import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactEngineId } from './ReactTypes'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'
import { getReactEngineIconComponent } from './reactEngineIcons'

function ReactEngineIcon({ engineId, glyph }: { engineId: ReactEngineId, glyph: string }) {
  const IconComponent = getReactEngineIconComponent(engineId)
  return IconComponent ? <IconComponent /> : <>{glyph}</>
}

/**
 * Header-level engine-family switcher. The old vertical ENGINE column is now a
 * compact dropdown inside the active engine card so the left React rail keeps
 * its authoring width without carrying a separate middle navigation column.
 */
export function ReactEngineBrowser() {
  const { activeReactEngineId, selectReactEngine } = useReactStore(useShallow(state => ({
    activeReactEngineId: state.activeReactEngineId,
    selectReactEngine: state.selectReactEngine,
  })))
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeEngine = REACT_ENGINE_CATALOG[activeReactEngineId]

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (engineId: ReactEngineId) => {
    if (engineId !== activeReactEngineId) {
      selectReactEngine(engineId)
    }
    setOpen(false)
  }

  return (
    <div className="rv-engine-dropdown" ref={rootRef}>
      <button
        type="button"
        className="rv-engine-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected React engine: ${activeEngine.label}`}
        title="Choose React engine"
        onClick={() => setOpen(value => !value)}
      >
        <span className="rv-engine-dropdown-copy">
          <span className="rv-engine-dropdown-eyebrow">Engine</span>
          <span className="rv-engine-dropdown-label">{activeEngine.label}</span>
          <span className="rv-engine-dropdown-description">{activeEngine.description}</span>
        </span>
        <span className="rv-engine-dropdown-icon" aria-hidden="true">
          <ReactEngineIcon engineId={activeReactEngineId} glyph={activeEngine.icon} />
        </span>
      </button>

      {open && (
        <div className="rv-engine-dropdown-menu" role="listbox" aria-label="React visual engines">
          {REACT_ENGINE_IDS.map(engineId => {
            const engine = REACT_ENGINE_CATALOG[engineId]
            const active = engineId === activeReactEngineId
            return (
              <button
                key={engineId}
                type="button"
                role="option"
                aria-selected={active}
                className={`rv-engine-dropdown-option${active ? ' is-active' : ''}`}
                onClick={() => handleSelect(engineId)}
              >
                <span className="rv-engine-dropdown-option-icon" aria-hidden="true">
                  <ReactEngineIcon engineId={engineId} glyph={engine.icon} />
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

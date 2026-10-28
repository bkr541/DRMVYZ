import { AppIcon } from '../../shared/icons/AppIcon'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactEngineId } from './ReactTypes'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'
import { getReactEngineIconComponent } from './reactEngineIcons'

function ReactEngineIcon({ engineId }: { engineId: ReactEngineId }) {
  const IconComponent = getReactEngineIconComponent(engineId)
  return <IconComponent />
}

/**
 * Engine-family switcher shared by the React header and rail previews.
 */
export function ReactEngineBrowser({ presetName = null, placement = 'rail' }: {
  placement?: 'rail' | 'header'
  /** The active engine's selected preset, shown under the engine name (Cinema 2.0 and CANVAS). */
  presetName?: string | null
} = {}) {
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
    <div className={`rv-engine-dropdown${placement === 'header' ? ' rv-engine-dropdown--header' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="rv-engine-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected React engine: ${activeEngine.label}${presetName ? `, preset ${presetName}` : ''}`}
        title="Choose React engine"
        onClick={() => setOpen(value => !value)}
      >
        <span className="rv-engine-dropdown-glow" aria-hidden="true" />
        <span className="rv-engine-dropdown-icon" aria-hidden="true">
          <ReactEngineIcon engineId={activeReactEngineId} />
        </span>
        <span className="rv-engine-dropdown-copy">
          <span className="rv-engine-dropdown-eyebrow">Engine</span>
          <span className="rv-engine-dropdown-label">{activeEngine.label}</span>
          {presetName && <span className="rv-engine-dropdown-preset">{presetName}</span>}
        </span>
      </button>

      {open && (
        <div className="rv-engine-dropdown-menu" role="listbox" aria-label="React visual engines">
          {REACT_ENGINE_IDS.map((engineId, index) => {
            const engine = REACT_ENGINE_CATALOG[engineId]
            const active = engineId === activeReactEngineId
            return (
              <button
                key={engineId}
                type="button"
                role="option"
                aria-selected={active}
                className={`rv-engine-dropdown-option${active ? ' is-active' : ''}`}
                style={{ '--rv-engine-i': index } as CSSProperties}
                onClick={() => handleSelect(engineId)}
              >
                <span className="rv-engine-dropdown-option-icon" aria-hidden="true">
                  <ReactEngineIcon engineId={engineId} />
                </span>
                <span className="rv-engine-dropdown-option-copy">
                  <span>{engine.label}</span>
                  <small className="rv-control-helper-copy">{engine.description}</small>
                </span>
                {active && <span className="rv-engine-dropdown-option-check" aria-hidden="true"><AppIcon kind="check" size={14} /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

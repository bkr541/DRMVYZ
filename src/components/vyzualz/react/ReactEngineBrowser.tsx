import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'

/**
 * Persistent engine-family switcher. Engine selection is deliberately kept
 * outside the contextual authoring workspace so changing the machine and
 * editing the machine are no longer mixed in one scrolling panel.
 */
export function ReactEngineBrowser() {
  const { activeReactEngineId, selectReactEngine } = useReactStore(useShallow(state => ({
    activeReactEngineId: state.activeReactEngineId,
    selectReactEngine: state.selectReactEngine,
  })))

  return (
    <nav className="rv-engine-browser" aria-label="React visual engines">
      <div className="rv-engine-browser-heading" aria-hidden="true">ENG</div>
      <div className="rv-engine-browser-list">
        {REACT_ENGINE_IDS.map(engineId => {
          const engine = REACT_ENGINE_CATALOG[engineId]
          const active = engineId === activeReactEngineId
          return (
            <button
              key={engineId}
              type="button"
              className={`rv-engine-browser-item${active ? ' rv-engine-browser-item--active' : ''}`}
              onClick={() => selectReactEngine(engineId)}
              aria-pressed={active}
              aria-label={`${engine.label} engine${active ? ', selected' : ''}`}
              title={`${engine.label}: ${engine.description}`}
            >
              <span className="rv-engine-browser-icon" aria-hidden="true">{engine.icon}</span>
              <span className="rv-engine-browser-label">{engine.shortLabel}</span>
              {active && <span className="rv-engine-browser-active-dot" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

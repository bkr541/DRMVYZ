import { ENGINE_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'
import { AppIcon } from '../../shared/icons/AppIcon'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactEngineId } from './ReactTypes'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'
import { ReactEngineBlueprint } from './ReactEngineBlueprint'

/** Decorative blueprint geometry for the Cinema engine identity. */
function Cinema2EngineBlueprint() {
  return (
    <svg viewBox="0 0 140 150" fill="none" focusable="false">
      <g stroke="currentColor" strokeWidth={ENGINE_BLUEPRINT_STROKE_WIDTH}>
        <path d="M70 2 138 40 138 116 70 154 2 116 2 40Z" fill="currentColor" fillOpacity=".04" />
        <path d="M2 40 70 78 138 40M70 78V154M70 2V40M2 116 70 78 138 116" />
        <path d="M2 47 70 85 138 47M131 44V112L70 147M9 44V112L70 147" opacity=".5" />
        <path d="M40 48 70 31 100 48 70 65ZM40 48V53L70 70 100 53V48M70 65V70" fill="currentColor" fillOpacity=".12" />
        <path d="M70 2V154M2 40 138 116M138 40 2 116" strokeDasharray="4 3" opacity=".35" />
        <path d="M24 27V130M116 27V130M2 66 116 130M24 130 138 66" opacity=".2" />
      </g>
    </svg>
  )
}

function EngineCardContents({ engineId, presetName }: { engineId: ReactEngineId; presetName?: string | null }) {
  return (
    <>
      <span className="rv-engine-dropdown-icon" aria-hidden="true">
        {engineId === 'cinema2' ? <Cinema2EngineBlueprint /> : <ReactEngineBlueprint engineId={engineId} />}
      </span>
      <span className="rv-engine-dropdown-copy">
        <span className="rv-engine-dropdown-eyebrow">Engine</span>
        <span className="rv-engine-dropdown-label">{REACT_ENGINE_CATALOG[engineId].label}</span>
        {/* Reserve the preset line so every engine shares Cinema's text positions. */}
        <span className="rv-engine-dropdown-preset" title={presetName || undefined} aria-hidden={!presetName || undefined}>
          {presetName && (
            <span className="rv-engine-dropdown-preset-echoes" aria-hidden="true">
              {[0, 1, 2].map(index => <span className="rv-engine-dropdown-preset-echo" key={index}>{presetName}</span>)}
            </span>
          )}
          <span className="rv-engine-dropdown-preset-value">{presetName || '\u00a0'}</span>
        </span>
      </span>
    </>
  )
}

/**
 * Engine-family switcher shown above the tab row of the React left window.
 */
export function ReactEngineBrowser({ presetName = null }: {
  /** The active engine's selected preset, shown under the engine name (Cinema 2.0 and CANVAS). */
  presetName?: string | null
} = {}) {
  const { activeReactEngineId, selectReactEngine } = useReactStore(useShallow(state => ({
    activeReactEngineId: state.activeReactEngineId,
    selectReactEngine: state.selectReactEngine,
  })))
  const [open, setOpen] = useState(false)
  const [menuMaxHeight, setMenuMaxHeight] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const activeEngine = REACT_ENGINE_CATALOG[activeReactEngineId]

  useLayoutEffect(() => {
    if (!open) return
    const root = rootRef.current
    const rail = root?.closest('.vz-inspector-inner')
    if (!root || !rail) return

    const updateMenuHeight = () => {
      const bottom = Math.min(rail.getBoundingClientRect().bottom, window.innerHeight)
      // Leave 8px between the trigger and menu, and 8px at the window's bottom.
      setMenuMaxHeight(Math.max(0, bottom - root.getBoundingClientRect().bottom - 16))
    }
    updateMenuHeight()
    const observer = new ResizeObserver(updateMenuHeight)
    observer.observe(rail)
    observer.observe(root)
    window.addEventListener('resize', updateMenuHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateMenuHeight)
    }
  }, [open])

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
    <div className="rv-engine-dropdown" data-engine={activeReactEngineId} ref={rootRef}>
      <button
        type="button"
        className="rv-engine-dropdown-trigger rv-engine-card"
        data-engine={activeReactEngineId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Selected React engine: ${activeEngine.label}${presetName ? `, preset ${presetName}` : ''}`}
        title="Choose React engine"
        onClick={() => setOpen(value => !value)}
      >
        <EngineCardContents engineId={activeReactEngineId} presetName={presetName} />
      </button>

      {open && (
        <div className="rv-engine-dropdown-menu" role="listbox" aria-label="React visual engines" style={{ maxHeight: menuMaxHeight }}>
          {REACT_ENGINE_IDS.map(engineId => {
            const engine = REACT_ENGINE_CATALOG[engineId]
            const active = engineId === activeReactEngineId
            return (
              <button
                key={engineId}
                type="button"
                role="option"
                aria-selected={active}
                className={`rv-engine-dropdown-option rv-engine-card${active ? ' is-active' : ''}`}
                data-engine={engineId}
                title={engine.description}
                onClick={() => handleSelect(engineId)}
              >
                <EngineCardContents engineId={engineId} presetName={active ? presetName : null} />
                {active && <span className="rv-engine-dropdown-option-check" aria-hidden="true"><AppIcon kind="check" size={14} /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

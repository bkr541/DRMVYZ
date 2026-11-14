import { ENGINE_BLUEPRINT_STROKE_WIDTH } from './blueprintDrawing'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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

export function ReactEngineCardContents({ engineId, presetName, pixelLabel = false }: {
  engineId: ReactEngineId
  presetName?: string | null
  pixelLabel?: boolean
}) {
  const label = REACT_ENGINE_CATALOG[engineId].label
  return (
    <>
      <span className="rv-engine-dropdown-icon" aria-hidden="true">
        {engineId === 'cinema2' ? <Cinema2EngineBlueprint /> : <ReactEngineBlueprint engineId={engineId} />}
      </span>
      <span className="rv-engine-dropdown-copy">
        <span className="rv-engine-dropdown-eyebrow">Engine</span>
        <span className="rv-engine-dropdown-label">
          {pixelLabel ? (
            <>
              <span className="sr-only">{label}</span>
              <svg className="rv-engine-dropdown-pixel-label" viewBox="0 0 41 7" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
                <path fillRule="evenodd" d="M0 0h4v1h1v3H4v1H1v2H0ZM1 1v3h3V1Z" />
                <path d="M6 0h5v1H9v5h2v1H6V6h2V1H6Z" />
                <path d="M12 0h1v2h1v1h1V2h1V0h1v2h-1v1h-1v1h1v1h1v2h-1V5h-1V4h-1v1h-1v2h-1V5h1V4h1V3h-1V2h-1Z" />
                <path d="M19 0h4v1h-4v5h3V4h-2V3h3v3h-1v1h-3V6h-1V1h1Z" />
                <path fillRule="evenodd" d="M24 0h4v1h1v2h-1v1h-1v1h1v1h1v1h-1V6h-1V5h-1V4h-1v3h-1Zm1 1v2h3V1Z" />
                <path d="M30 0h5v1h-2v5h2v1h-5V6h2V1h-2Z" />
                <path fillRule="evenodd" d="M36 0h3v1h1v1h1v3h-1v1h-1v1h-3Zm1 1v5h2V5h1V2h-1V1Z" />
              </svg>
            </>
          ) : label}
        </span>
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
export function ReactEngineBrowser({ presetName = null, engineId, onEngineChange, boundarySelector = '.vz-inspector-inner' }: {
  /** The active engine's selected preset, shown under the engine name (Cinema 2.0 and CANVAS). */
  presetName?: string | null
  /** Controlled mode for store-free hosts (the Mobile Preview mockup): the engine shown, and what choosing another does. */
  engineId?: ReactEngineId
  onEngineChange?: (engineId: ReactEngineId) => void
  /** The container the open menu must fit inside; defaults to the inspector rail. */
  boundarySelector?: string
} = {}) {
  const store = useReactStore(useShallow(state => ({
    activeReactEngineId: state.activeReactEngineId,
    selectReactEngine: state.selectReactEngine,
  })))
  const activeReactEngineId = engineId ?? store.activeReactEngineId
  const selectReactEngine = onEngineChange ?? store.selectReactEngine
  const [open, setOpen] = useState(false)
  const [closingEngine, setClosingEngine] = useState(activeReactEngineId)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const activeEngine = REACT_ENGINE_CATALOG[activeReactEngineId]
  const close = useCallback(() => {
    // Keep the displayed list stable during the exit, even after selection changes.
    setClosingEngine(activeReactEngineId)
    setOpen(false)
  }, [activeReactEngineId])

  useLayoutEffect(() => {
    const trigger = triggerRef.current
    const popover = popoverRef.current
    if (!trigger || !popover) return
    if (!open) {
      popover.hidePopover()
      return
    }
    const rail = trigger.closest(boundarySelector)
    // The trigger may live in another window (the Mobile Preview), so listen and measure on its own window.
    const win = trigger.ownerDocument.defaultView ?? window

    const updatePosition = () => {
      const { left, top, right, bottom, width } = trigger.getBoundingClientRect()
      const railBottom = Math.min(rail?.getBoundingClientRect().bottom ?? win.innerHeight, win.innerHeight)
      popover.style.setProperty('--rv-engine-trigger-left', `${left}px`)
      popover.style.setProperty('--rv-engine-trigger-top', `${top}px`)
      popover.style.setProperty('--rv-engine-trigger-right', `${right}px`)
      popover.style.setProperty('--rv-engine-trigger-bottom', `${bottom}px`)
      popover.style.setProperty('--rv-engine-trigger-width', `${width}px`)
      popover.style.setProperty('--rv-engine-menu-height', `${Math.max(0, railBottom - bottom - 16)}px`)
    }
    updatePosition()
    popover.showPopover()
    const observer = new ResizeObserver(updatePosition)
    if (rail) observer.observe(rail)
    observer.observe(trigger)
    win.addEventListener('resize', updatePosition)
    win.addEventListener('scroll', updatePosition, true)
    return () => {
      observer.disconnect()
      win.removeEventListener('resize', updatePosition)
      win.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, boundarySelector])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      close()
      triggerRef.current?.focus({ preventScroll: true })
    }

    const win = triggerRef.current?.ownerDocument.defaultView ?? window
    win.addEventListener('keydown', handleKeyDown)
    return () => win.removeEventListener('keydown', handleKeyDown)
  }, [close, open])

  const listedEngines = REACT_ENGINE_IDS.filter(engineId => engineId !== (open ? activeReactEngineId : closingEngine))
  // The installed React DOM types omit these native attributes.
  const popoverAttributes = { popover: 'manual', inert: !open }

  return (
    <div className="rv-engine-dropdown" data-engine={activeReactEngineId} onBlur={event => {
      if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close()
    }}>
      <button
        type="button"
        className="rv-engine-dropdown-trigger rv-engine-card"
        ref={triggerRef}
        data-engine={activeReactEngineId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Selected React engine: ${activeEngine.label}${presetName ? `, preset ${presetName}` : ''}`}
        title="Choose React engine"
        onClick={() => open ? close() : setOpen(true)}
      >
        <ReactEngineCardContents engineId={activeReactEngineId} presetName={presetName} />
      </button>

      <div className="rv-engine-dropdown-popover" {...popoverAttributes} ref={popoverRef}>
        <div className="rv-engine-dropdown-scrim" aria-hidden="true" onClick={close} />
        <div className="rv-engine-dropdown-menu" role="listbox" aria-label="React visual engines" id={menuId}>
          {listedEngines.map((engineId, index) => (
            <button
              key={engineId}
              style={{ '--rv-engine-option-index': index } as React.CSSProperties}
              type="button"
              role="option"
              aria-selected={false}
              className="rv-engine-dropdown-option rv-engine-card"
              data-engine={engineId}
              title={REACT_ENGINE_CATALOG[engineId].description}
              onClick={() => {
                close()
                selectReactEngine(engineId)
                triggerRef.current?.focus({ preventScroll: true })
              }}
            >
              <ReactEngineCardContents engineId={engineId} pixelLabel={engineId === 'pixGrid'} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { REACT_ENGINE_CATALOG } from '../../reactEngineCatalog'
import { getReactEngineIconComponent } from '../../reactEngineIcons'
import { type EngineChoiceId, type RadialEngineVariant } from './engineChoices'
import { DialFanOverlay } from './DialFanOverlay'
import { OrbitOverlay } from './OrbitOverlay'
import { RotaryOverlay } from './RotaryOverlay'
import './radialEngine.css'

const OVERLAYS = { dial: DialFanOverlay, orbit: OrbitOverlay, rotary: RotaryOverlay }

/**
 * The engine card as a radial selector. The card keeps production's markup and classes; activating it opens one of three
 * pop-out designs (a dial with a fanned label list, an orbiting arc of keys, or a rotary wheel). The choice is local to
 * the Lab: it changes the card's identity but, like the rest of the disconnected study, loads no engine.
 * The overlay is portaled into the card's own document so it also works inside Layout Lab's separate window.
 */
export function LayoutLabRadialEngine({ variant, initial = 'cinema2' }: { variant: RadialEngineVariant; initial?: EngineChoiceId }) {
  const [engine, setEngine] = useState<EngineChoiceId>(initial)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const entry = REACT_ENGINE_CATALOG[engine]
  const EngineIcon = getReactEngineIconComponent(engine)
  const preset = engine === 'cinema2' ? 'Electric Storm' : 'Preview only'
  const open = anchor !== null

  const close = useCallback((restoreFocus = true) => {
    setAnchor(null)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])
  const select = useCallback((id: EngineChoiceId) => { setEngine(id); close() }, [close])

  useEffect(() => {
    if (!open) return
    const doc = triggerRef.current?.ownerDocument
    if (!doc) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest('[data-radial-engine-overlay], .rv-engine-dropdown-trigger')) return
      close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    doc.addEventListener('pointerdown', onPointerDown, true)
    doc.addEventListener('keydown', onKeyDown)
    return () => { doc.removeEventListener('pointerdown', onPointerDown, true); doc.removeEventListener('keydown', onKeyDown) }
  }, [open, close])

  const Overlay = OVERLAYS[variant]
  const doc = triggerRef.current?.ownerDocument
  return (
    <div className="rv-engine-dropdown" data-radial-engine={variant}>
      <button
        ref={triggerRef}
        type="button"
        className="rv-engine-dropdown-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Selected React engine: ${entry.label}, ${engine === 'cinema2' ? 'preset Electric Storm' : 'preview only'}. Open the radial engine selector.`}
        onClick={() => setAnchor(current => current ? null : triggerRef.current!.getBoundingClientRect())}
      >
        <span className="rv-engine-dropdown-glow" aria-hidden="true" />
        <span className="rv-engine-dropdown-icon" aria-hidden="true"><EngineIcon /></span>
        <span className="rv-engine-dropdown-copy">
          <span className="rv-engine-dropdown-eyebrow">Engine</span>
          <span className="rv-engine-dropdown-label">{entry.label}</span>
          <span className="rv-engine-dropdown-preset">{preset}</span>
        </span>
        <span className="ler-trigger-mark" aria-hidden="true"><i /><i /><i /></span>
      </button>
      {anchor && doc && createPortal(<Overlay value={engine} anchor={anchor} viewport={{ width: doc.defaultView?.innerWidth ?? 1440, height: doc.defaultView?.innerHeight ?? 900 }} onSelect={select} onClose={close} />, doc.body)}
    </div>
  )
}


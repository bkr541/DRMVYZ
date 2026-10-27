import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ENGINE_CHOICES, type EngineOverlayProps } from './engineChoices'
import { polar, wrap } from './radialGeometry'

const RADIUS = 150, START = 50, END = 150

/**
 * I — Orbit. The engine card is the hub: round keys spring out from its icon along a dashed half-orbit to the right,
 * each trailing a label pill, with a cyan ring tracking the key under focus and its description beneath the arc.
 */
export function OrbitOverlay({ value, anchor, viewport, onSelect }: EngineOverlayProps) {
  const count = ENGINE_CHOICES.length
  const [active, setActive] = useState(Math.max(0, ENGINE_CHOICES.findIndex(entry => entry.id === value)))
  const [spread, setSpread] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = rootRef.current
    node?.focus()
    const view = node?.ownerDocument.defaultView
    const frame = view?.requestAnimationFrame(() => setSpread(true))
    return () => { if (frame !== undefined) view?.cancelAnimationFrame(frame) }
  }, [])
  const hub = { x: anchor.left + 48, y: Math.max(RADIUS + 20, Math.min(anchor.top + 46, viewport.height - RADIUS - 100)) }
  const angleAt = (index: number) => START + ((END - START) * index) / (count - 1)
  const arcStart = polar(0, 0, RADIUS, START), arcEnd = polar(0, 0, RADIUS, END)
  const onKeyDown = (event: KeyboardEvent) => {
    const move = (delta: number) => { event.preventDefault(); setActive(index => wrap(index + delta, count)) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(1)
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(-1)
    else if (event.key === 'Enter' && event.target === rootRef.current) { event.preventDefault(); onSelect(ENGINE_CHOICES[active]!.id) }
  }
  const selected = ENGINE_CHOICES[active]!
  return (
    <div ref={rootRef} className="ler ler-orbit" data-radial-engine-overlay data-spread={spread} role="dialog" aria-label="Choose React engine" tabIndex={-1} onKeyDown={onKeyDown}
      style={{ left: hub.x, top: hub.y }}>
      <svg className="ler-orbit-track" style={{ left: -RADIUS - 40, top: -RADIUS - 40 }} width={RADIUS * 2 + 80} height={RADIUS * 2 + 80} viewBox={`${-RADIUS - 40} ${-RADIUS - 40} ${RADIUS * 2 + 80} ${RADIUS * 2 + 80}`} aria-hidden="true">
        <path d={`M${arcStart.x} ${arcStart.y}A${RADIUS} ${RADIUS} 0 0 1 ${arcEnd.x} ${arcEnd.y}`} />
      </svg>
      <div role="menu" aria-label="Engines">
        {ENGINE_CHOICES.map((entry, index) => {
          const point = polar(0, 0, RADIUS, angleAt(index))
          return (
            <button key={entry.id} type="button" role="menuitemradio" aria-checked={entry.id === value} tabIndex={index === active ? 0 : -1}
              className="ler-orbit-key" data-active={index === active} data-current={entry.id === value}
              style={{ '--x': `${point.x}px`, '--y': `${point.y}px`, '--i': index } as CSSProperties}
              onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => onSelect(entry.id)}>
              <span className="ler-orbit-disc"><AppIcon kind={entry.icon} size={20} /></span>
              <span className="ler-orbit-label">{entry.label}</span>
            </button>
          )
        })}
      </div>
      <p className="ler-orbit-caption" style={{ top: Math.round(-RADIUS * Math.cos((END * Math.PI) / 180)) + 40 }} aria-live="polite"><b>{selected.label}</b>{selected.description}</p>
    </div>
  )
}

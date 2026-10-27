import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ENGINE_CHOICES, type EngineOverlayProps } from './engineChoices'
import { polar, sectorPath, wrap } from './radialGeometry'

const SIZE = 300, C = SIZE / 2, HUB = 66, INNER = 82, OUTER = 138, GAP = 4

const STACK_LEFT = SIZE + 24, STACK_WIDTH = 256, STACK_HEIGHT = SIZE, CAPTION_TOP = SIZE + 18

/**
 * H — Dial fan. A rotary dial hangs from the dotted mark at the right end of the engine card, tethered to it and growing
 * out of it: a ring of engine sectors around a knurled white hub. The sector under focus lifts out and a leader line runs
 * to its label, which sits at the centre of a fanned stack of labels that recede with distance.
 */
export function DialFanOverlay({ value, origin, viewport, onSelect }: EngineOverlayProps) {
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
  const step = 360 / count
  // The ring's upper-right rim sits just below and left of the mark; the label stack runs out to the right.
  const left = Math.max(8, Math.min(origin.x - SIZE + 28, viewport.width - STACK_LEFT - STACK_WIDTH - 8))
  const top = Math.max(8, Math.min(origin.y + 30, viewport.height - CAPTION_TOP - 96))
  const spot = { x: origin.x - left, y: origin.y - top }
  const rim = polar(C, C, OUTER + 14, 48)
  const mid = active * step
  const tip = polar(C, C, OUTER + 10, mid)
  const onKeyDown = (event: KeyboardEvent) => {
    const move = (delta: number) => { event.preventDefault(); setActive(index => wrap(index + delta, count)) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(1)
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(-1)
    else if (event.key === 'Home') { event.preventDefault(); setActive(0) }
    else if (event.key === 'End') { event.preventDefault(); setActive(count - 1) }
    else if (event.key === 'Enter' && event.target === rootRef.current) { event.preventDefault(); onSelect(ENGINE_CHOICES[active]!.id) }
  }
  const selected = ENGINE_CHOICES[active]!
  return (
    <div ref={rootRef} className="ler ler-dial" data-radial-engine-overlay data-spread={spread} role="dialog" aria-label="Choose React engine" tabIndex={-1} style={{ left, top, transformOrigin: `${spot.x}px ${spot.y}px` }} onKeyDown={onKeyDown}>
      <svg className="ler-tether" width={SIZE} height={SIZE} aria-hidden="true">
        <path d={`M${spot.x} ${spot.y}C${spot.x} ${(spot.y + rim.y) / 2} ${rim.x} ${(spot.y + rim.y) / 2} ${rim.x} ${rim.y}`} />
        <circle cx={spot.x} cy={spot.y} r="4.5" />
      </svg>
      <svg className="ler-dial-ring" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={C} cy={C} r={OUTER + 14} className="ler-dial-bezel" />
        {ENGINE_CHOICES.map((entry, index) => {
          const from = index * step - step / 2 + GAP / 2, to = index * step + step / 2 - GAP / 2
          const lift = index === active ? polar(0, 0, 7, index * step) : { x: 0, y: 0 }
          const icon = polar(C, C, (INNER + OUTER) / 2, index * step)
          return (
            <g key={entry.id} className="ler-dial-sector" data-active={index === active} data-current={entry.id === value} transform={`translate(${lift.x} ${lift.y})`}
              onPointerEnter={() => setActive(index)} onClick={() => onSelect(entry.id)}>
              <path d={sectorPath(C, C, INNER, OUTER, from, to)} />
              <foreignObject x={icon.x - 13} y={icon.y - 13} width="26" height="26"><div className="ler-dial-glyph"><AppIcon kind={entry.icon} size={22} /></div></foreignObject>
            </g>
          )
        })}
        <path className="ler-dial-leader" d={`M${tip.x} ${tip.y}L${SIZE - 6} ${C}L${SIZE + 10} ${C}`} />
        <circle cx={C} cy={C} r={HUB + 9} className="ler-dial-well" />
        <circle cx={C} cy={C} r={HUB} className="ler-dial-knob" />
        <circle cx={C} cy={C} r={HUB - 8} className="ler-dial-knurl" />
        <circle cx={C} cy={C} r={HUB - 14} className="ler-dial-face" />
      </svg>
      <span className="ler-dial-hub" aria-hidden="true"><AppIcon kind={selected.icon} size={26} /></span>
      <div className="ler-dial-stack" role="menu" aria-label="Engines">
        {ENGINE_CHOICES.map((entry, index) => {
          const offset = index - active
          const hidden = Math.abs(offset) > 2
          return (
            <button key={entry.id} type="button" role="menuitemradio" aria-checked={entry.id === value} tabIndex={index === active ? 0 : -1} disabled={hidden}
              className="ler-dial-label" data-active={index === active} style={{ '--o': offset, '--a': Math.abs(offset), '--i': index } as CSSProperties}
              onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => onSelect(entry.id)}>
              <span className="ler-disc"><AppIcon kind={entry.icon} size={19} /></span>
              <span className="ler-pill">{entry.label}{entry.id === value && <AppIcon kind="check" size={14} />}</span>
            </button>
          )
        })}
      </div>
      <p className="ler-caption ler-dial-caption" aria-live="polite"><b>{selected.label}</b>{selected.description}</p>
    </div>
  )
}

import { useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from 'react'
import { AppIcon } from '../../../../shared/icons/AppIcon'
import { ENGINE_CHOICES, type EngineOverlayProps } from './engineChoices'
import { polar, sectorPath } from './radialGeometry'

const SIZE = 420, C = SIZE / 2, RING_IN = 118, RING_OUT = 176, HOLE = 108, TICKS = 72

/**
 * K — Rotary. A centred modal wheel: the engine ring turns under a fixed pointer at the top, so the engine under focus is
 * always the one at 12 o'clock. Turn with arrows, the scroll wheel or by clicking a wedge; confirm with the centre key.
 */
export function RotaryOverlay({ value, onSelect, onClose }: EngineOverlayProps) {
  const count = ENGINE_CHOICES.length
  const step = 360 / count
  const [index, setIndex] = useState(Math.max(0, ENGINE_CHOICES.findIndex(entry => entry.id === value)))
  // Rotation accumulates so the wheel always turns the short way round instead of unwinding.
  const [turn, setTurn] = useState(-index * step)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { rootRef.current?.focus() }, [])
  const focusIndex = (next: number) => {
    const delta = ((next - index + count * 3 + count / 2) % count) - count / 2
    setIndex(((next % count) + count) % count)
    setTurn(current => current - delta * step)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); focusIndex(index + 1) }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); focusIndex(index - 1) }
    else if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') { event.preventDefault(); onSelect(ENGINE_CHOICES[index]!.id) }
  }
  const onWheel = (event: WheelEvent) => { if (Math.abs(event.deltaY) > 2) focusIndex(index + (event.deltaY > 0 ? 1 : -1)) }
  const selected = ENGINE_CHOICES[index]!
  return (
    <div className="ler ler-rotary" data-radial-engine-overlay>
      <div className="ler-rotary-backdrop" onClick={() => onClose()} />
      <div ref={rootRef} className="ler-rotary-wheel" role="dialog" aria-modal="true" aria-label="Choose React engine" tabIndex={-1} onKeyDown={onKeyDown} onWheel={onWheel}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <circle cx={C} cy={C} r={C - 4} className="ler-rotary-case" />
          <g className="ler-rotary-ring" style={{ transform: `rotate(${turn}deg)`, transformOrigin: `${C}px ${C}px` }}>
            {Array.from({ length: TICKS }, (_, tick) => {
              const a = polar(C, C, C - 12, (tick * 360) / TICKS), b = polar(C, C, C - (tick % 6 === 0 ? 26 : 19), (tick * 360) / TICKS)
              return <line key={tick} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={tick % 6 === 0 ? 'ler-rotary-tick ler-rotary-tick--major' : 'ler-rotary-tick'} />
            })}
            {ENGINE_CHOICES.map((entry, i) => {
              const mid = i * step
              const label = polar(C, C, (RING_IN + RING_OUT) / 2 + 14, mid), icon = polar(C, C, (RING_IN + RING_OUT) / 2 - 16, mid)
              return (
                <g key={entry.id} className="ler-rotary-wedge" data-active={i === index} data-current={entry.id === value} onClick={() => focusIndex(i)}>
                  <path d={sectorPath(C, C, RING_IN, RING_OUT, mid - step / 2 + 1.5, mid + step / 2 - 1.5)} />
                  <g transform={`rotate(${mid} ${icon.x} ${icon.y})`}><foreignObject x={icon.x - 11} y={icon.y - 11} width="22" height="22"><div className="ler-rotary-glyph"><AppIcon kind={entry.icon} size={20} /></div></foreignObject></g>
                  <text x={label.x} y={label.y} transform={`rotate(${mid} ${label.x} ${label.y})`} textAnchor="middle" dominantBaseline="middle">{entry.shortLabel}</text>
                </g>
              )
            })}
          </g>
          <path className="ler-rotary-pointer" d={`M${C - 11} 6L${C + 11} 6L${C} 30Z`} />
          <circle cx={C} cy={C} r={HOLE} className="ler-rotary-hole" />
        </svg>
        <div className="ler-rotary-center">
          <span className="ler-rotary-icon" aria-hidden="true"><AppIcon kind={selected.icon} size={30} /></span>
          <strong>{selected.label}</strong>
          <p aria-live="polite">{selected.description}</p>
          <button type="button" className="ler-rotary-confirm" onClick={() => onSelect(selected.id)}>{selected.id === value ? 'Keep engine' : 'Select engine'}</button>
        </div>
        <button type="button" className="ler-rotary-close" aria-label="Close engine selector" onClick={() => onClose()}><AppIcon kind="close" size={16} /></button>
      </div>
    </div>
  )
}

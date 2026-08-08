import { useEffect, useRef, useState, type CSSProperties } from 'react'

// ── layoutLabWinningControls ────────────────────────────────────────────────
//
// Layout Lab / Template engine only. The specific dropdown, slider, and
// toggle treatments chosen as winners from this page's style galleries —
// Underline (DropdownStyleGallery), Bubble Reveal (SliderStyleGallery), and
// Icon Morph (ToggleStyleGallery) — extracted into reusable, prop-driven
// controls so both their own gallery demo and the Dual Rail collapsible
// group demo render the identical real control, not separate copies.

function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (event: PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return
      onClose()
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [open, onClose])
  return ref
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`lldd-chevron${open ? ' lldd-chevron--open' : ''}`} focusable="false" aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  )
}

// Winner — Underline dropdown: borderless, animated underline, accent-bar menu rows
export interface UnderlineDropdownControlProps {
  eyebrow?: string
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  ariaLabel?: string
}

export function UnderlineDropdownControl({ eyebrow, value, onChange, options, ariaLabel }: UnderlineDropdownControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useOutsideClose(open, () => setOpen(false))

  return (
    <div className="lldd-underline" ref={rootRef}>
      <button
        type="button"
        className={`lldd-underline-trigger${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
      >
        {eyebrow != null && <span className="lldd-underline-eyebrow">{eyebrow}</span>}
        <span className="lldd-underline-value">{value}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="lldd-underline-menu" role="listbox">
          {options.map(option => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={`lldd-underline-option${option === value ? ' is-active' : ''}`}
              onClick={() => { onChange(option); setOpen(false) }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Winner — Bubble reveal slider: dragging pops a menu-styled value bubble above the thumb
export interface BubbleRevealSliderControlProps {
  eyebrow?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  ariaLabel?: string
}

export function BubbleRevealSliderControl({ eyebrow, value, onChange, min = 0, max = 100, ariaLabel }: BubbleRevealSliderControlProps) {
  const [active, setActive] = useState(false)
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <div className="lls-bubble">
      {eyebrow != null && <span className="lls-bubble-eyebrow">{eyebrow}</span>}
      <div className="lls-bubble-track-wrap">
        {active && (
          <span className="lls-bubble-pop" style={{ left: `${pct}%` }}>{Math.round(pct)}%</span>
        )}
        <input
          type="range"
          className="lls-bubble-track"
          min={min}
          max={max}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          onPointerDown={() => setActive(true)}
          onPointerUp={() => setActive(false)}
          onFocus={() => setActive(true)}
          onBlur={() => setActive(false)}
          style={{ '--lls-pct': `${pct}%` } as CSSProperties}
          aria-label={ariaLabel}
        />
      </div>
    </div>
  )
}

// Winner — Icon morph toggle: a circular ring fades into a drawn-in checkmark when on
export interface IconMorphToggleControlProps {
  value: boolean
  onChange: (value: boolean) => void
  ariaLabel?: string
}

export function IconMorphToggleControl({ value, onChange, ariaLabel }: IconMorphToggleControlProps) {
  return (
    <button type="button" className={`llt-morph${value ? ' is-on' : ''}`} onClick={() => onChange(!value)} aria-pressed={value} aria-label={ariaLabel}>
      <svg viewBox="0 0 20 20" className="llt-morph-icon" aria-hidden="true">
        <circle cx="10" cy="10" r="8" className="llt-morph-ring" />
        <path d="M6 10.5l2.5 2.5L14 7" className="llt-morph-check" />
      </svg>
    </button>
  )
}

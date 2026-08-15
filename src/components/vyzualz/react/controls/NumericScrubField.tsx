import { useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import './canonicalControls.css'

// ── NumericScrubField ────────────────────────────────────────────────────
//
// Canonical DRMVYZ numeric input from Layout Lab's "Drag Scrubber" winner.
// Drag anywhere on the bar for fast, approximate adjustment with a live
// fill bar, or double-click the number (or press Enter) to swap in a real
// text input for exact keyboard entry — the same "drag for feel,
// double-click for precision" pattern the production BPM field established.

export interface NumericScrubFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  disabled?: boolean
  id?: string
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function NumericScrubField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  id,
  className = '',
}: NumericScrubFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const scrubFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const raw = min + fraction * (max - min)
    onChange(clamp(Math.round(raw / step) * step, min, max))
  }

  const startEditing = () => {
    setDraft(String(value))
    setIsEditing(true)
  }

  const commitEditing = () => {
    const next = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(next)) onChange(clamp(next, min, max))
    setIsEditing(false)
  }

  const pct = Math.round(((value - min) / (max - min)) * 100)

  return (
    <div className={`dv-scrub-field${className ? ` ${className}` : ''}`}>
      <span className="dv-scrub-field-label">{label}</span>
      <div
        className={`dv-scrub${isEditing ? ' is-editing' : ''}${disabled ? ' is-disabled' : ''}`}
        style={{ '--dv-scrub-fill': `${pct}%` } as CSSProperties}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled || undefined}
        tabIndex={isEditing || disabled ? -1 : 0}
        onPointerDown={event => {
          if (isEditing || disabled) return
          event.currentTarget.setPointerCapture(event.pointerId)
          scrubFromPointer(event)
        }}
        onPointerMove={event => {
          if (isEditing || disabled || event.buttons !== 1) return
          scrubFromPointer(event)
        }}
        onKeyDown={event => {
          if (isEditing || disabled) return
          if (event.key === 'ArrowRight') onChange(clamp(value + step, min, max))
          if (event.key === 'ArrowLeft') onChange(clamp(value - step, min, max))
          if (event.key === 'Enter') startEditing()
        }}
      >
        <span className="dv-scrub-fill" aria-hidden="true" />
        {isEditing ? (
          <input
            id={id}
            type="number"
            className="dv-scrub-edit-input"
            value={draft}
            autoFocus
            onFocus={event => event.currentTarget.select()}
            onChange={event => setDraft(event.target.value)}
            onPointerDown={event => event.stopPropagation()}
            onBlur={commitEditing}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); commitEditing() }
              if (event.key === 'Escape') { event.preventDefault(); setIsEditing(false) }
            }}
          />
        ) : (
          <span
            className="dv-scrub-value"
            id={id}
            onPointerDown={event => event.stopPropagation()}
            onDoubleClick={() => { if (!disabled) startEditing() }}
          >
            {value}
          </span>
        )}
        {unit && <span className="dv-scrub-unit">{unit}</span>}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

// ── DropdownStyleGallery ───────────────────────────────────────────────────
//
// Layout Lab / Template engine only. A dropdown treatment shown here so
// restyling the app's real dropdowns (Dropdown, rv-engine-dropdown,
// ReactControlRows' SelectRow, etc.) can be judged against a real
// alternative instead of an imagined one. Fully local, disconnected — its
// own open state, its own selection — styled in the app's existing
// cyan/dark palette.

const SAMPLE_OPTIONS = ['Classic Scope', 'Radial Scope', 'Spiral Scope', 'Pro Scope']

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

// Borderless, animated underline, left-accent-bar menu rows
function UnderlineDropdown() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(SAMPLE_OPTIONS[1])
  const rootRef = useOutsideClose(open, () => setOpen(false))

  return (
    <div className="lldd-underline" ref={rootRef}>
      <button type="button" className={`lldd-underline-trigger${open ? ' is-open' : ''}`} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <span className="lldd-underline-eyebrow">Mode</span>
        <span className="lldd-underline-value">{value}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="lldd-underline-menu" role="listbox">
          {SAMPLE_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              className={`lldd-underline-option${option === value ? ' is-active' : ''}`}
              onClick={() => { setValue(option); setOpen(false) }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DropdownStyleGallery() {
  return (
    <div className="lldd-gallery">
      <div className="lldd-gallery-row">
        <div className="lldd-gallery-copy">
          <span className="lldd-gallery-title">02 · Underline</span>
          <span className="lldd-gallery-blurb">Borderless trigger, animated underline, accent-bar option rows.</span>
        </div>
        <div className="lldd-gallery-sample">
          <UnderlineDropdown />
        </div>
      </div>
    </div>
  )
}

import { useId, useState, type ReactNode } from 'react'
import './DualRailCollapsible.css'

// ── DualRailCollapsible ──────────────────────────────────────────────────
//
// Drop-in replacement for ReactControlRows' Collapsible — same
// label/defaultOpen/children props — styled after Layout Lab's "Dual Rail"
// collapsible-group gallery entry: Progress Rail's climbing hover fill and
// solid accent mirrored on both edges, framing a two-tone header/body split
// borrowed from Cinema's Master parameters card. Owns its own open state.

export interface DualRailCollapsibleProps {
  label: string
  defaultOpen?: boolean
  children: ReactNode
}

export function DualRailCollapsible({ label, defaultOpen = true, children }: DualRailCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className={`drc-group${open ? ' is-open' : ''}`}>
      <span className="drc-fill-left" aria-hidden="true" />
      <span className="drc-fill-right" aria-hidden="true" />
      <button
        type="button"
        className="drc-header"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span>{label}</span>
        <span className="drc-arrow" aria-hidden="true">▾</span>
      </button>
      {open && <div id={contentId} className="drc-body">{children}</div>}
    </div>
  )
}

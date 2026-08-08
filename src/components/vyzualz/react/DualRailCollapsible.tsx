import { useId, useState, type ReactNode } from 'react'
import './DualRailCollapsible.css'

// ── DualRailCollapsible ──────────────────────────────────────────────────
//
// Canonical DRMVYZ parent/group treatment. This is the production source of
// truth for Layout Lab → Template's “Tab Crest” group (name kept for the
// existing prop/consumer contract) and supports both self-managed and
// externally-controlled disclosure state.

export interface DualRailCollapsibleProps {
  label: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerAccessory?: ReactNode
  title?: string
}

export function DualRailCollapsible({
  label,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className = '',
  bodyClassName = '',
  headerAccessory,
  title,
}: DualRailCollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const contentId = useId()

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <div className={`drc-group${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="drc-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        title={title}
      >
        <span>{label}</span>
        {headerAccessory != null && <span className="drc-header-accessory">{headerAccessory}</span>}
        <span className="drc-arrow" aria-hidden="true">▾</span>
      </button>
      {open && <div id={contentId} className={`drc-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>}
    </div>
  )
}

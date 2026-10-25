import { AppIcon } from '../../shared/icons/AppIcon'
import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { groupHeaderIconKind } from './groupHeaderIcon'
import './DualRailCollapsible.css'

// ── DualRailCollapsible ──────────────────────────────────────────────────
//
// Canonical DRMVYZ parent/group treatment. This is the production source of
// truth for Layout Lab → Template's “Step Indent” group (name kept for the
// existing prop/consumer contract) and supports both self-managed and
// externally-controlled disclosure state.

export interface DualRailCollapsibleProps {
  label: ReactNode
  /** Decorative glyph left of the label. Parent (top-level) groups get one chosen from the label when omitted;
   *  nested groups never do. Pass `false` to suppress it on a parent. */
  icon?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
  bodyClassName?: string
  headerClassName?: string
  headerAccessory?: ReactNode
  title?: string
}

/** How many reusable groups enclose this one; 0 is a parent group, anything deeper is a nested group. */
const GroupDepthContext = createContext(0)

export function DualRailCollapsible({
  label,
  icon,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  headerAccessory,
  title,
}: DualRailCollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const contentId = useId()
  const depth = useContext(GroupDepthContext)
  const headerIcon = icon === false ? null
    : icon ?? (depth === 0 ? <AppIcon kind={groupHeaderIconKind(label)} size={15} color="currentColor" /> : null)

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <div className={`drc-group${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`drc-header${headerClassName ? ` ${headerClassName}` : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        title={title}
      >
        <span className={headerIcon != null ? 'drc-header-label' : undefined}>
          {headerIcon != null && <span className="drc-header-icon" aria-hidden="true">{headerIcon}</span>}
          {headerIcon != null ? <span>{label}</span> : label}
        </span>
        {headerAccessory != null && <span className="drc-header-accessory">{headerAccessory}</span>}
        <span className="drc-arrow" aria-hidden="true"><AppIcon kind="chevronDown" size={14} /></span>
      </button>
      {open && (
        <div id={contentId} className={`drc-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          <GroupDepthContext.Provider value={depth + 1}>{children}</GroupDepthContext.Provider>
        </div>
      )}
    </div>
  )
}

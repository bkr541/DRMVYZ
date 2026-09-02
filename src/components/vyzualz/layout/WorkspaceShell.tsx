import { useState, type ReactNode } from 'react'
import { WorkspaceRail } from './WorkspaceRail'

// ── WorkspaceShell ─────────────────────────────────────────────────────────
//
// Canonical DRMVYZ full-view chrome: a fixed-height header over a symmetric
// three-pane body — collapsible left rail · center stage · collapsible right
// rail. Layout, padding, rail widths and surface colours come from the
// shared `workspaceShell.css` block (lifted from the Media Manager view), so
// a new surface matches the established sizing without re-deriving numbers.
//
// Rail collapse is self-managed by default; pass `defaultLeftCollapsed` /
// `defaultRightCollapsed` for the initial state. A view that needs to drive
// collapse from external state (URL, store) should compose `WorkspaceRail` +
// `.vz-content` directly instead.

export interface WorkspaceShellProps {
  /** Header content — feature supplies its own left-group / right-group
   *  markup. Rendered inside the shared `.ws-shell-header` box. Omit for a
   *  headerless surface. */
  header?: ReactNode
  left: ReactNode
  center: ReactNode
  right: ReactNode
  /** Accessible label for the left rail `<aside>`. */
  leftLabel?: string
  /** Accessible label for the right rail `<aside>`. */
  rightLabel?: string
  defaultLeftCollapsed?: boolean
  defaultRightCollapsed?: boolean
  /** Extra class on the outer `.ws-shell` element. */
  className?: string
  /** Extra class on the `.ws-shell-body.vz-content` grid element. */
  bodyClassName?: string
}

export function WorkspaceShell({
  header,
  left,
  center,
  right,
  leftLabel = 'Left rail',
  rightLabel = 'Right rail',
  defaultLeftCollapsed = false,
  defaultRightCollapsed = false,
  className = '',
  bodyClassName = '',
}: WorkspaceShellProps) {
  const [leftCollapsed, setLeftCollapsed] = useState(defaultLeftCollapsed)
  const [rightCollapsed, setRightCollapsed] = useState(defaultRightCollapsed)

  return (
    <div className={`ws-shell${className ? ` ${className}` : ''}`}>
      {header != null && <header className="ws-shell-header">{header}</header>}

      <div
        className={`ws-shell-body vz-content${bodyClassName ? ` ${bodyClassName}` : ''}`}
        data-left-collapsed={leftCollapsed ? 'true' : 'false'}
        data-right-collapsed={rightCollapsed ? 'true' : 'false'}
      >
        <WorkspaceRail
          side="left"
          label={leftLabel}
          collapsed={leftCollapsed}
          onToggleCollapsed={() => setLeftCollapsed(value => !value)}
        >
          {left}
        </WorkspaceRail>

        <div className="ws-shell-stage">{center}</div>

        <WorkspaceRail
          side="right"
          label={rightLabel}
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed(value => !value)}
        >
          {right}
        </WorkspaceRail>
      </div>
    </div>
  )
}

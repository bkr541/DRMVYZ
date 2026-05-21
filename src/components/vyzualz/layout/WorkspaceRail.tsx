import type { ReactNode } from 'react'

type WorkspaceRailProps = {
  side: 'left' | 'right'
  label: string
  collapsed?: boolean
  onToggleCollapsed?: () => void
  children: ReactNode
  className?: string
}

export function WorkspaceRail({
  side,
  label,
  collapsed = false,
  onToggleCollapsed,
  children,
  className = '',
}: WorkspaceRailProps) {
  const sideClass = side === 'left' ? 'vz-inspector--left' : 'vz-inspector--right'

  return (
    <aside
      className={`vz-inspector ${sideClass}${collapsed ? ' vz-inspector--collapsed' : ''}${className ? ` ${className}` : ''}`}
      aria-label={label}
    >
      {onToggleCollapsed && (
        <button
          type="button"
          className={`vz-inspector-toggle vz-inspector-toggle--${side}`}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? `Expand ${side} inspector` : `Collapse ${side} inspector`}
          aria-expanded={!collapsed}
        >
          {side === 'left'
            ? (collapsed ? '›' : '‹')
            : (collapsed ? '‹' : '›')}
        </button>
      )}

      <div
        className="vz-inspector-inner"
        aria-hidden={collapsed ? 'true' : undefined}
      >
        {children}
      </div>
    </aside>
  )
}

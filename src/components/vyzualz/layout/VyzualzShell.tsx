import type { ReactNode } from 'react'

type VyzualzShellProps = {
  sidebar?: ReactNode
  topBar: ReactNode
  leftRail: ReactNode
  stage: ReactNode
  rightRail: ReactNode
  bottomBar?: ReactNode
  dock?: ReactNode
  className?: string
  isLeftInspectorCollapsed?: boolean
  isRightInspectorCollapsed?: boolean
}

export function VyzualzShell({
  sidebar,
  topBar,
  leftRail,
  stage,
  rightRail,
  bottomBar,
  dock,
  className = '',
  isLeftInspectorCollapsed = false,
  isRightInspectorCollapsed = false,
}: VyzualzShellProps) {
  return (
    <div className={`az-root${className ? ` ${className}` : ''}`}>
      <div className="az-shell">
        {sidebar}
        <div className="vz-main">
          {topBar}
          <div
            className="vz-content"
            data-left-collapsed={isLeftInspectorCollapsed ? 'true' : 'false'}
            data-right-collapsed={isRightInspectorCollapsed ? 'true' : 'false'}
          >
            {leftRail}
            {stage}
            {rightRail}
          </div>
          {bottomBar}
        </div>
      </div>
      {dock}
    </div>
  )
}

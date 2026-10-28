import type { ReactNode } from 'react'
import './HeaderControlGroup.css'

interface HeaderControlGroupProps {
  label: string
  className?: string
  children: ReactNode
}

/** Left-aligned page actions; status controls remain at the right of the header. */
export function HeaderControlGroup({ label, className = '', children }: HeaderControlGroupProps) {
  return (
    <div className={`vz-header-group${className ? ` ${className}` : ''}`} role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

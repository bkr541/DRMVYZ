import type { ReactNode } from 'react'
import './HeaderControlGroup.css'

interface HeaderControlGroupProps {
  /** Accessible name for the toolbar, e.g. "Lyric Manager controls". */
  label: string
  className?: string
  children: ReactNode
}

/**
 * The single control group every page header carries: it floats in the exact
 * horizontal middle of the header row (independent of how wide the heading or
 * the profile cluster on either side is) and holds the page's buttons, toggles
 * and status. The profile icon, Track Timeline button and Layout Lab button stay
 * outside it, at the right of the header.
 */
export function HeaderControlGroup({ label, className = '', children }: HeaderControlGroupProps) {
  return (
    <div className={`vz-header-group${className ? ` ${className}` : ''}`} role="toolbar" aria-label={label}>
      {children}
    </div>
  )
}

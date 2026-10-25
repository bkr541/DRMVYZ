import type { ReactNode } from 'react'
import './RailWindowHeader.css'

export type RailWindowHeaderSide = 'left' | 'right'

export interface RailWindowHeaderProps {
  /** currentColor glyph rendered before the label. */
  icon: ReactNode
  label: ReactNode
  /** Which rail this header lives in — controls the outer-edge sheen direction
   *  (left rail sheens toward the left edge, right rail toward the right). */
  side: RailWindowHeaderSide
  /** Header-aligned action buttons (e.g. IconChipButton) rendered flush-right. */
  actions?: ReactNode
  className?: string
}

/**
 * Canonical DRMVYZ rail window title bar: a two-tier dark slate surface
 * with light text/icons and a slight darker sheen toward the rail's outer
 * edge. The bottom border separates it from the content without casting
 * a shadow over tab rows below. Render it as the first,
 * unpadded child of a WorkspaceRail (or any zero-padding container) so it
 * sits flush/edge-to-edge with the rail's true corners.
 */
export function RailWindowHeader({ icon, label, side, actions, className = '' }: RailWindowHeaderProps) {
  return (
    <div className={`rw-window-header rw-window-header--${side}${className ? ` ${className}` : ''}`}>
      {icon}
      <span className="rw-window-header-label">{label}</span>
      {actions && <span className="rw-window-header-actions">{actions}</span>}
    </div>
  )
}

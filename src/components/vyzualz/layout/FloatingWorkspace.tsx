import type { HTMLAttributes } from 'react'

/** Explicit slot names; the individual workspace owns their placement. */
export type WorkspaceSlot =
  | 'header'
  | 'navigation'
  | 'left'
  | 'stage'
  | 'right'
  | 'lower'
  | 'audio'
  | 'tools'

/** Opt-in visual contract only. Never inserted by a legacy WorkspaceShell. */
export function FloatingWorkspaceFrame({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`fw-workspace${className ? ` ${className}` : ''}`}
      data-workspace-layout="floating"
    />
  )
}

type WorkspaceRegionProps = HTMLAttributes<HTMLDivElement> & { slot: WorkspaceSlot }

/** Names a layout region without prescribing a grid, clipping or content. */
export function WorkspaceRegion({ slot, className = '', ...props }: WorkspaceRegionProps) {
  return (
    <div
      {...props}
      className={`fw-region${className ? ` ${className}` : ''}`}
      data-workspace-slot={slot}
    />
  )
}

/** An optional visual boundary, intentionally without overflow or positioning. */
export function WorkspaceSurface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`fw-surface${className ? ` ${className}` : ''}`} />
}

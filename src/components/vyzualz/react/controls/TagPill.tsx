import type { ReactNode } from 'react'
import './canonicalControls.css'

// ── TagPill ───────────────────────────────────────────────────────────────
//
// The one pill for tags, collections, packs and other short user-chosen labels:
// a rounded outline with the label and, when it can be removed, a round × at the
// end. It is the Admin Console's tag pill, now used everywhere a tag or a
// collection is shown. Omit `onRemove` for a display-only pill.

export interface TagPillProps {
  label: ReactNode
  onRemove?: () => void
  /** Prefix of the remove button's accessible name: "Remove tag" gives "Remove tag cinematic". */
  removeLabel?: string
  disabled?: boolean
  className?: string
}

export function TagPill({ label, onRemove, removeLabel = 'Remove', disabled = false, className = '' }: TagPillProps) {
  return (
    <span className={`dv-tag-pill${onRemove ? '' : ' dv-tag-pill--static'}${className ? ` ${className}` : ''}`}>
      <span className="dv-tag-pill-label">{label}</span>
      {onRemove && (
        <button type="button" className="dv-tag-pill-remove" disabled={disabled} aria-label={typeof label === 'string' ? `${removeLabel} ${label}` : removeLabel} onClick={onRemove}>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  )
}

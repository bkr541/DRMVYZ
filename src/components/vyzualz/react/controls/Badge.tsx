import type { ReactNode } from 'react'
import './canonicalControls.css'

// ── Badge ─────────────────────────────────────────────────────────────────
//
// Canonical DRMVYZ tag/genre/category label from Layout Lab's "Removable
// Capsule" winner. Arbitrary tone color (not a fixed enum, since tags/genres
// need per-item color coding), with an optional dismiss (×) button — omit
// `onRemove` for a plain display-only badge.

export interface BadgeProps {
  label: ReactNode
  tone: string
  onRemove?: () => void
  removeLabel?: string
  className?: string
}

export function Badge({
  label,
  tone,
  onRemove,
  removeLabel = 'Remove',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`dv-badge${className ? ` ${className}` : ''}`}
      style={{ borderColor: `${tone}4d`, color: tone }}
    >
      <span className="dv-badge-dot" style={{ background: tone }} aria-hidden="true" />
      {label}
      {onRemove && (
        <button
          type="button"
          className="dv-badge-remove"
          style={{ color: tone }}
          aria-label={typeof label === 'string' ? `${removeLabel} ${label}` : removeLabel}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  )
}

import type { ReactNode } from 'react'
import './canonicalControls.css'

// ── NoticeCard ────────────────────────────────────────────────────────────
//
// Canonical DRMVYZ warning/notification treatment. Production source of
// truth for Layout Lab → Template's "Inline Flag" notice style: a thin
// tone-colored accent line, a small icon, an optional title, and body copy.

export type NoticeCardTone = 'info' | 'warning' | 'error' | 'success'

export interface NoticeCardProps {
  title?: ReactNode
  tone?: NoticeCardTone
  role?: 'status' | 'alert'
  ariaLabel?: string
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
  children: ReactNode
}

function NoticeCardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function NoticeCard({
  title,
  tone = 'info',
  role = 'status',
  ariaLabel,
  onDismiss,
  dismissLabel = 'Dismiss',
  className = '',
  children,
}: NoticeCardProps) {
  return (
    <div className={`dv-notice${className ? ` ${className}` : ''}`} data-tone={tone} role={role} aria-label={ariaLabel}>
      <div className="dv-notice-hdr">
        <span className="dv-notice-icon"><NoticeCardIcon /></span>
        {title != null && <strong className="dv-notice-title">{title}</strong>}
        {onDismiss && (
          <button type="button" className="dv-notice-dismiss" onClick={onDismiss} aria-label={dismissLabel}>
            ×
          </button>
        )}
      </div>
      <div className="dv-notice-body">{children}</div>
    </div>
  )
}

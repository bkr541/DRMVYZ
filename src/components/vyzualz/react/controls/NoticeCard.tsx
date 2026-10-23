import { AppIcon } from '../../../shared/icons/AppIcon'
import type { ReactNode } from 'react'
import './canonicalControls.css'

// ── NoticeCard ────────────────────────────────────────────────────────────
//
// Canonical DRMVYZ warning/notification treatment. Production source of
// truth for Layout Lab → Template's "Inline Flag" notice style: a thin
// tone-colored accent line, a small icon, a required title, and body copy.

export type NoticeCardTone = 'info' | 'warning' | 'error' | 'success'

export interface NoticeCardProps {
  title: ReactNode
  tone?: NoticeCardTone
  role?: 'status' | 'alert'
  ariaLabel?: string
  onDismiss?: () => void
  dismissLabel?: string
  onOpen?: () => void
  openLabel?: string
  className?: string
  children?: ReactNode
}

function NoticeCardIcon() {
  return <AppIcon kind="info" />
}

export function NoticeCard({
  title,
  tone = 'info',
  role = 'status',
  ariaLabel,
  onDismiss,
  dismissLabel = 'Dismiss',
  onOpen,
  openLabel = 'Open',
  className = '',
  children,
}: NoticeCardProps) {
  return (
    <div className={`dv-notice${className ? ` ${className}` : ''}`} data-tone={tone} role={role} aria-label={ariaLabel}>
      <div className="dv-notice-hdr">
        <span className="dv-notice-icon"><NoticeCardIcon /></span>
        <strong className="dv-notice-title">{title}</strong>
        {onDismiss && (
          <button type="button" className="dv-notice-dismiss" onClick={onDismiss} aria-label={dismissLabel}>
            <AppIcon kind="close" size={12} />
          </button>
        )}
      </div>
      {children != null && <div className="dv-notice-body">{children}</div>}
      {onOpen && (
        <div className="dv-notice-actions">
          <button type="button" className="dv-notice-open" onClick={onOpen} aria-label={openLabel} title={openLabel}>
            <AppIcon kind="open" size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

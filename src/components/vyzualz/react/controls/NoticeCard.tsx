import { AppIcon } from '../../../shared/icons/AppIcon'
import { Children, Fragment, isValidElement, type ReactNode } from 'react'
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
  /** Supporting explanation; empty or action-only content receives visible fallback copy. */
  children?: ReactNode
}

/** Empty fragments, conditional branches and action-only content are not supporting copy. */
export function hasNoticeText(node: ReactNode): boolean {
  return Children.toArray(node).some(child => {
    if (typeof child === 'string') return child.trim().length > 0
    if (typeof child === 'number') return true
    if (!isValidElement<{ children?: ReactNode }>(child)) return false
    if (child.type === Fragment) return hasNoticeText(child.props.children)
    // Custom components/icons may render nothing; never count an action as explanatory text.
    return typeof child.type === 'string' && !['button', 'svg', 'input', 'img', 'select'].includes(child.type)
      && hasNoticeText(child.props.children)
  })
}

const FALLBACK_COPY: Record<NoticeCardTone, { title: string; body: string }> = {
  info: { title: 'Status update', body: 'Review the related workspace for details about this status.' },
  success: { title: 'Action completed', body: 'The requested action completed successfully.' },
  warning: { title: 'Review required', body: 'Review the related settings before continuing with this action.' },
  error: { title: 'Action needs attention', body: 'Review the related workspace and resolve this issue before trying again.' },
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
        <strong className="dv-notice-title">{hasNoticeText(title) ? title : FALLBACK_COPY[tone].title}</strong>
        {onDismiss && (
          <button type="button" className="dv-notice-dismiss" onClick={onDismiss} aria-label={dismissLabel}>
            <AppIcon kind="close" size={12} />
          </button>
        )}
      </div>
      <div className="dv-notice-body">{!hasNoticeText(children) && <>{FALLBACK_COPY[tone].body}{' '}</>}{children}</div>
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

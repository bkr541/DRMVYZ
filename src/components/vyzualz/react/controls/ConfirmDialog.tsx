import { useId, type ReactNode } from 'react'
import { IconChipButton } from './IconChipButton'
import { NoticeCard, type NoticeCardTone } from './NoticeCard'
import './canonicalControls.css'

export interface ConfirmDialogProps {
  title: string
  message: ReactNode
  /** Optional NoticeCard content rendered between the message and the
   * Cancel/confirm row — e.g. clarifying what else the action affects.
   * Omitted by default; most confirmations don't need one. */
  notice?: ReactNode
  noticeTone?: NoticeCardTone
  noticeTitle?: ReactNode
  confirmLabel?: string
  busyLabel?: string
  cancelLabel?: string
  busy?: boolean
  /** Styles the confirm button in the canonical destructive-action red.
   * Defaults to true since nearly every confirmation in the app guards a
   * delete or other irreversible change; pass false for a neutral confirm. */
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

// Same circle-and-line glyph as NoticeCard's canonical warning icon, sized
// up into a badge above the title — the Layout Lab "Centered Icon Focus"
// winner (DeleteConfirmDialogStyleGallery.tsx, Concept 03).
function ConfirmDialogIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Canonical DRMVYZ confirmation dialog — one backdrop + centered card with
 * an icon badge, title, message, and Cancel/confirm button pair, all
 * centered (Layout Lab / Template's "Centered Icon Focus" winner). Use this
 * instead of building another local "are you sure" modal or window.confirm()
 * wherever a real in-app dialog (custom title, custom button labels) is
 * needed. */
export function ConfirmDialog({
  title,
  message,
  notice,
  noticeTone = 'warning',
  noticeTitle = 'Heads up',
  confirmLabel = 'Delete',
  busyLabel = 'Working…',
  cancelLabel = 'Cancel',
  busy = false,
  danger = true,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const headingId = useId()
  return (
    <div
      className="dv-confirm-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="dv-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) onCancel()
        }}
      >
        <span className="dv-confirm-icon" aria-hidden="true"><ConfirmDialogIcon /></span>
        <h2 id={headingId}>{title}</h2>
        <p>{message}</p>
        {notice && (
          <NoticeCard tone={noticeTone} title={noticeTitle} role="status">
            {notice}
          </NoticeCard>
        )}
        <div className="dv-confirm-actions">
          <IconChipButton type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</IconChipButton>
          <IconChipButton
            type="button"
            className={danger ? 'dv-icon-chip--danger' : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}

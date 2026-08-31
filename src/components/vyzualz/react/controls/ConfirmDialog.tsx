import { useId, type ReactNode } from 'react'
import { IconChipButton } from './IconChipButton'
import './canonicalControls.css'

export interface ConfirmDialogProps {
  title: string
  message: ReactNode
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

/** Canonical DRMVYZ confirmation dialog — one backdrop + centered card with
 * a title, message, and Cancel/confirm button pair. Use this instead of
 * building another local "are you sure" modal or window.confirm() wherever
 * a real in-app dialog (custom title, custom button labels) is needed. */
export function ConfirmDialog({
  title,
  message,
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
        <h2 id={headingId}>{title}</h2>
        <p>{message}</p>
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

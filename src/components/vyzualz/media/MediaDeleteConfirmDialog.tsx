import { useId } from 'react'
import { IconChipButton } from '../react/controls/IconChipButton'

interface MediaDeleteConfirmDialogProps {
  /** Number of media items the pending delete would remove. */
  count: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Shared confirmation dialog for deleting one or more media items — used by
 * both the library's right-click Delete action and the inspector's Delete
 * Media button so the two entry points stay identical. */
export function MediaDeleteConfirmDialog({ count, busy = false, onCancel, onConfirm }: MediaDeleteConfirmDialogProps) {
  const headingId = useId()
  const message = count > 1
    ? `Are you sure you're wanting to delete all ${count} media items?`
    : "Are you sure you're wanting to delete this media item?"

  return (
    <div
      className="mmv-confirm-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        className="mmv-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) onCancel()
        }}
      >
        <h2 id={headingId}>{count > 1 ? 'Delete Media Items' : 'Delete Media Item'}</h2>
        <p>{message}</p>
        <div className="mmv-confirm-actions">
          <IconChipButton type="button" onClick={onCancel} disabled={busy}>Cancel</IconChipButton>
          <IconChipButton type="button" className="dv-icon-chip--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}

import { ConfirmDialog } from '../react/controls/ConfirmDialog'

interface MediaDeleteConfirmDialogProps {
  /** Number of media items the pending delete would remove. */
  count: number
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Media-specific wrapper around the canonical ConfirmDialog — just supplies
 * the count-based title/message so both the library's right-click Delete
 * action and the inspector's Delete Media button stay identical. */
export function MediaDeleteConfirmDialog({ count, busy = false, onCancel, onConfirm }: MediaDeleteConfirmDialogProps) {
  const message = count > 1
    ? <>Are you sure you're wanting to delete all <span className="dv-confirm-count-danger">{count}</span> media items?</>
    : "Are you sure you're wanting to delete this media item?"

  return (
    <ConfirmDialog
      title={count > 1 ? 'Delete Media Items' : 'Delete Media Item'}
      message={message}
      notice="Deleted media will not be available to use within DRMVYZ. Anywhere that the deleted media was present will show as missing media."
      busy={busy}
      busyLabel="Deleting…"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

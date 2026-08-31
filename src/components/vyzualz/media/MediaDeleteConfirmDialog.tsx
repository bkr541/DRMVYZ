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
    ? `Are you sure you're wanting to delete all ${count} media items?`
    : "Are you sure you're wanting to delete this media item?"

  return (
    <ConfirmDialog
      title={count > 1 ? 'Delete Media Items' : 'Delete Media Item'}
      message={message}
      busy={busy}
      busyLabel="Deleting…"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

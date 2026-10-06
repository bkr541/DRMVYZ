import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'

interface Props {
  trackTitle: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmTrackDeleteDialog({ trackTitle, busy = false, onConfirm, onCancel }: Props) {
  if (!trackTitle) return null
  return (
    <ConfirmDialog
      title="Delete Track"
      message={`Are you sure you're wanting to delete "${trackTitle}"?`}
      notice="All of its lyric versions and cues will be permanently deleted, and the audio file will be removed from storage. This cannot be undone."
      confirmLabel="Delete Track"
      busy={busy}
      busyLabel="Deleting…"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

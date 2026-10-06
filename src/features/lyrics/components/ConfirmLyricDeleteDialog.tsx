import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'

interface Props {
  title: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmLyricDeleteDialog({ title, busy = false, onConfirm, onCancel }: Props) {
  if (!title) return null
  return (
    <ConfirmDialog
      title="Delete Lyric Version"
      message={`Are you sure you're wanting to delete "${title}"?`}
      notice="All of its cues will be permanently deleted. The audio track will remain in your library."
      confirmLabel="Delete Version"
      busy={busy}
      busyLabel="Deleting…"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

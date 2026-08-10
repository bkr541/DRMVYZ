import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'

interface Props {
  title: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmLyricDeleteDialog({ title, busy = false, onConfirm, onCancel }: Props) {
  if (!title) return null
  return (
    <div className="lmv-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <div className="lmv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lmv-delete-title">
        <div id="lmv-delete-title" className="lmv-dialog-title">Delete lyric version?</div>
        <p className="lmv-dialog-copy">
          “{title}” and all of its cues will be permanently deleted. The audio track will remain in your library.
        </p>
        <div className="lmv-dialog-actions">
          <IconChipButton onClick={onCancel} disabled={busy}>Cancel</IconChipButton>
          <IconChipButton className="lmv-btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete Version'}
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}

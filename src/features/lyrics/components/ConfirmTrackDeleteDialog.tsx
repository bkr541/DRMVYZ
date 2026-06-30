interface Props {
  trackTitle: string | null
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmTrackDeleteDialog({ trackTitle, busy = false, onConfirm, onCancel }: Props) {
  if (!trackTitle) return null
  return (
    <div className="lmv-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <div className="lmv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lmv-track-delete-title">
        <div id="lmv-track-delete-title" className="lmv-dialog-title">Delete track?</div>
        <p className="lmv-dialog-copy">
          "{trackTitle}" and all of its lyric versions and cues will be permanently deleted. The audio file will also be removed from storage. This cannot be undone.
        </p>
        <div className="lmv-dialog-actions">
          <button className="lmv-btn lmv-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="lmv-btn lmv-btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete Track'}
          </button>
        </div>
      </div>
    </div>
  )
}

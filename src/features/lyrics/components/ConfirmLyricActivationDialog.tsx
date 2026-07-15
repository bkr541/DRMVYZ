interface Props {
  targetTitle: string | null
  currentTitle: string | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmLyricActivationDialog({ targetTitle, currentTitle, busy, onCancel, onConfirm }: Props) {
  if (!targetTitle) return null
  return (
    <div className="lmv-dialog-backdrop" role="presentation">
      <section className="lmv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lmv-activate-title">
        <h2 id="lmv-activate-title">Replace active lyric version?</h2>
        <p>
          “{targetTitle}” will become the runtime version for this track
          {currentTitle ? ` and replace “${currentTitle}”.` : '.'}
        </p>
        <div className="lmv-dialog-actions">
          <button className="lmv-btn lmv-btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="lmv-btn lmv-btn--primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Activating…' : 'Make Active'}
          </button>
        </div>
      </section>
    </div>
  )
}

import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'

interface Props {
  open: boolean
  busy?: boolean
  message?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedLyricChangesDialog({
  open, busy = false, message, onSave, onDiscard, onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="lmv-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onCancel()
    }}>
      <div className="lmv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lmv-unsaved-title">
        <div id="lmv-unsaved-title" className="lmv-dialog-title">Unsaved lyric changes</div>
        <p className="lmv-dialog-copy">
          {message ?? 'Save your changes before continuing, discard them, or cancel and stay here.'}
        </p>
        <div className="lmv-dialog-actions">
          <IconChipButton onClick={onCancel} disabled={busy}>Cancel</IconChipButton>
          <IconChipButton className="lmv-btn--danger" onClick={onDiscard} disabled={busy}>Discard</IconChipButton>
          <IconChipButton tone="primary" onClick={onSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </IconChipButton>
        </div>
      </div>
    </div>
  )
}

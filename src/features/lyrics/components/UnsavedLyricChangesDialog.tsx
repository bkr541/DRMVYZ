import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'

interface Props {
  open: boolean
  busy?: boolean
  message?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedLyricChangesDialog({ open, busy = false, message, onSave, onDiscard, onCancel }: Props) {
  if (!open) return null
  return <ConfirmDialog
    title="Unsaved lyric changes"
    message={message ?? 'Save your changes before continuing, discard them, or cancel and stay here.'}
    confirmLabel="Save"
    busyLabel="Saving…"
    busy={busy}
    danger={false}
    iconTone="neutral"
    confirmTone="primary"
    secondary={{ label: 'Discard', danger: true, onClick: onDiscard }}
    onCancel={onCancel}
    onConfirm={onSave}
  />
}

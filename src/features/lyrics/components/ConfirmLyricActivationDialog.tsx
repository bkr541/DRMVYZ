import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'

interface Props {
  targetTitle: string | null
  currentTitle: string | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmLyricActivationDialog({ targetTitle, currentTitle, busy, onCancel, onConfirm }: Props) {
  if (!targetTitle) return null
  return <ConfirmDialog
    title="Replace active lyric version?"
    message={`“${targetTitle}” will become the runtime version for this track${currentTitle ? ` and replace “${currentTitle}”.` : '.'}`}
    confirmLabel="Make Active"
    busyLabel="Activating…"
    busy={busy}
    danger={false}
    iconTone="neutral"
    confirmTone="primary"
    dismissible={false}
    onCancel={onCancel}
    onConfirm={onConfirm}
  />
}

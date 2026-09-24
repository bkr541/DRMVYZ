import { useEffect } from 'react'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { selectMediaEditDirty, useMediaEditStore } from '../../../stores/mediaEditStore'

interface UnsavedMediaChangesDialogProps {
  open: boolean
  /** Stay where you are; edits are kept. */
  onCancel: () => void
  /** Carry on to the requested destination — after Discard, or once a Save has succeeded. */
  onProceed: () => void
}

/**
 * The Media Manager counterpart of UnsavedLyricChangesDialog. It owns the
 * decision, never the navigation: Save only lets the caller proceed once the
 * real save has persisted, and a failed save keeps the dialog (and the edits) open.
 */
export function UnsavedMediaChangesDialog({ open, onCancel, onProceed }: UnsavedMediaChangesDialogProps) {
  const busy = useMediaEditStore(state => state.busy !== 'idle')
  const error = useMediaEditStore(state => state.error)
  const dirty = useMediaEditStore(selectMediaEditDirty)

  // A save that finished (from this dialog, or one that was already running)
  // leaves nothing to lose, so the requested navigation can go ahead.
  useEffect(() => {
    if (open && !busy && !dirty) onProceed()
  }, [open, busy, dirty, onProceed])

  if (!open) return null
  return (
    <ConfirmDialog
      title="Unsaved changes"
      message="You have unsaved media changes. If you continue, those changes will be lost."
      confirmLabel="Save"
      busyLabel="Saving…"
      busy={busy}
      allowCancelWhileBusy
      danger={false}
      confirmTone="primary"
      secondary={{
        label: 'Discard Changes',
        danger: true,
        // Discarding leaves nothing to lose, which is what lets the effect above proceed.
        onClick: () => { useMediaEditStore.getState().discard() },
      }}
      notice={error ?? undefined}
      noticeTone="error"
      noticeTitle="Save failed"
      onCancel={onCancel}
      onConfirm={() => { void useMediaEditStore.getState().save() }}
    />
  )
}

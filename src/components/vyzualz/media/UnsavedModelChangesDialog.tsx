import { useEffect } from 'react'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { selectModelCanSave, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
export function UnsavedModelChangesDialog({ open, onCancel, onProceed }: { open: boolean; onCancel(): void; onProceed(): void }) {
  const dirty = useModelEditorStore(s => s.dirty), status = useModelEditorStore(s => s.status), error = useModelEditorStore(s => s.error)
  const canSave = useModelEditorStore(selectModelCanSave), busy = status === 'saving' || status === 'deleting'
  useEffect(() => { if (open && !dirty && !busy) onProceed() }, [open, dirty, busy, onProceed])
  if (!open) return null
  return <ConfirmDialog title="Unsaved model" message="Save your model changes before continuing?" confirmLabel="Save" confirmDisabled={!canSave} danger={false} confirmTone="primary" busy={busy} busyLabel="Saving model…" allowCancelWhileBusy
    notice={error ?? undefined} noticeTitle="Save failed" noticeTone="error"
    secondary={{ label: 'Discard Changes', danger: true, onClick: () => useModelEditorStore.getState().reset() }}
    onCancel={onCancel} onConfirm={() => { void useModelEditorStore.getState().save() }} />
}

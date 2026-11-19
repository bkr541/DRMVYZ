import { useEffect } from 'react'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { selectBuiltinModelNeedsExport, selectModelCanSave, selectModelEditorNeedsGuard, useModelEditorStore } from '../../../features/models/state/modelEditorStore'
export function UnsavedModelChangesDialog({ open, onCancel, onProceed }: { open: boolean; onCancel(): void; onProceed(): void }) {
  const needsExport = useModelEditorStore(selectBuiltinModelNeedsExport), blocked = useModelEditorStore(selectModelEditorNeedsGuard)
  const error = useModelEditorStore(s => needsExport ? s.builtinExportError : s.builtinModel ? s.builtinOrganizationError : s.error)
  const canSave = useModelEditorStore(selectModelCanSave)
  const busy = useModelEditorStore(s => s.status === 'saving' || s.status === 'deleting' || s.builtinExporting)
  useEffect(() => { if (open && !blocked) onProceed() }, [open, blocked, onProceed])
  if (!open) return null
  return <ConfirmDialog title="Unsaved model" message={needsExport ? 'Download your edited model before continuing?' : 'Save your model changes before continuing?'}
    confirmLabel={needsExport ? 'Download Edited GLB' : 'Save'} confirmDisabled={!needsExport && !canSave} danger={false} confirmTone="primary" busy={busy} busyLabel={needsExport ? 'Preparing GLB…' : 'Saving model…'} allowCancelWhileBusy
    notice={error ?? undefined} noticeTitle={needsExport ? 'GLB download failed' : 'Save failed'} noticeTone="error"
    secondary={{ label: 'Discard Changes', danger: true, onClick: () => useModelEditorStore.getState().reset() }}
    onCancel={onCancel} onConfirm={() => {
      const state = useModelEditorStore.getState()
      if (needsExport) void state.download('glb')
      else void state.save()
    }} />
}

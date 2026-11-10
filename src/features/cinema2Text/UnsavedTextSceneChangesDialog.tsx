import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../../components/vyzualz/react/controls/ConfirmDialog'
import { useTextSceneNavigation } from './textSceneNavigation'

/** Uses the same dialog, actions, notice and typography as Media Manager's unsaved edits. */
export function UnsavedTextSceneChangesDialog({ error }: { error: string | null }) {
  const navigation = useTextSceneNavigation()
  const root = useRef<HTMLDivElement>(null)
  const open = navigation.pending !== null
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    root.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [open])
  if (!open) return null
  return createPortal(<div ref={root} data-text-scene-unsaved="true" onKeyDown={event => {
    if (event.key !== 'Tab') return
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const first = buttons[0], last = buttons.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <ConfirmDialog
      title="Unsaved changes"
      message="You have unsaved text scene changes. If you continue, those changes will be lost."
      confirmLabel="Save"
      danger={false}
      confirmTone="primary"
      secondary={{ label: 'Discard Changes', danger: true, onClick: navigation.discardAndProceed }}
      notice={navigation.error ?? error ?? undefined}
      noticeTone="error"
      noticeTitle="Save failed"
      onCancel={navigation.cancel}
      onConfirm={navigation.saveAndProceed}
    />
  </div>, document.body)
}

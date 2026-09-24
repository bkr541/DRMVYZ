import { useId, useState } from 'react'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { MAX_MEDIA_NAME_LENGTH, validateMediaName } from '../../../features/media/edit/mediaEditOutput'

interface SaveAsMediaDialogProps {
  initialName: string
  busy: boolean
  /** A failure from the last attempt; the dialog stays open so the user can retry or cancel. */
  error: string | null
  onCancel: () => void
  onSubmit: (name: string) => void
}

export function SaveAsMediaDialog({ initialName, busy, error, onCancel, onSubmit }: SaveAsMediaDialogProps) {
  const inputId = useId()
  const [name, setName] = useState(initialName)
  const [touched, setTouched] = useState(false)
  const validation = validateMediaName(name)
  const validationError = touched && !validation.ok ? validation.error : null

  const submit = () => {
    setTouched(true)
    // `busy` also blocks a double click from creating two assets.
    if (busy || !validation.ok) return
    onSubmit(validation.name)
  }

  return (
    <ConfirmDialog
      title="Save As"
      message="Save the edited result as a new media item. The original stays exactly as it is."
      confirmLabel="Save As"
      busyLabel="Saving…"
      busy={busy}
      danger={false}
      confirmTone="primary"
      iconTone="neutral"
      notice={error ?? undefined}
      noticeTone="error"
      noticeTitle="Save failed"
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="mmi-saveas-field">
        <label className="rv-ctrl-label" htmlFor={inputId}>Name</label>
        <DreamVizTextInput
          id={inputId}
          autoFocus
          value={name}
          maxLength={MAX_MEDIA_NAME_LENGTH + 20}
          disabled={busy}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? `${inputId}-error` : undefined}
          onChange={event => { setName(event.target.value); setTouched(true) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
        />
        {validationError && <span id={`${inputId}-error`} className="mmi-saveas-error" role="alert">{validationError}</span>}
      </div>
    </ConfirmDialog>
  )
}

import { useId, useState } from 'react'
import { ConfirmDialog } from '../react/controls/ConfirmDialog'
import { DreamVizTextInput } from '../react/controls/DreamVizTextInput'
import { TagsCollectionsGroup } from './MediaManagerInspector'

export interface SaveAsInput {
  name: string
  tags: string[]
  collectionIds: string[]
}

export interface SaveAsPopoverProps {
  /** What is being copied. */
  description: string
  /** The new item starts as a copy of these. */
  initial: SaveAsInput
  /** The title field's label ("Title" for every media type). */
  nameLabel?: string
  /** Returns the reason a title is not acceptable, or null. */
  validateName: (name: string) => string | null
  busy: boolean
  /** A failure from the last attempt; the popover stays open so it can be retried or cancelled. */
  error: string | null
  onCancel: () => void
  onSubmit: (input: SaveAsInput) => void
}

/**
 * The Save As popover for every media type that can be copied. It is the application's standard centered popover (the same one the app's other
 * confirmations use) and asks for the new item's title, tags and collections, starting from the current item's. It does not save anything itself:
 * the page decides what a copy is for each type. Mount it only while it is open, so each opening starts fresh from `initial`.
 */
export function SaveAsPopover({ description, initial, nameLabel = 'Title', validateName, busy, error, onCancel, onSubmit }: SaveAsPopoverProps) {
  const inputId = useId()
  const [name, setName] = useState(initial.name)
  const [tags, setTags] = useState(initial.tags)
  const [collectionIds, setCollectionIds] = useState(initial.collectionIds)
  const [touched, setTouched] = useState(false)
  const problem = validateName(name)
  const shown = touched ? problem : null
  const submit = () => {
    setTouched(true)
    // `busy` also stops a double press from creating two copies.
    if (busy || problem) return
    onSubmit({ name: name.trim(), tags, collectionIds })
  }
  return (
    <ConfirmDialog
      title="Save As"
      message={description}
      confirmLabel="Save As"
      busyLabel="Saving…"
      busy={busy}
      danger={false}
      confirmTone="primary"
      iconTone="neutral"
      notice={error ?? undefined}
      noticeTone="error"
      noticeTitle="Save failed"
      onCancel={() => { if (!busy) onCancel() }}
      onConfirm={submit}
    >
      <div className="mmi-saveas-field">
        <label className="rv-ctrl-label" htmlFor={inputId}>{nameLabel}</label>
        <DreamVizTextInput
          id={inputId}
          autoFocus
          value={name}
          maxLength={220}
          disabled={busy}
          aria-invalid={shown ? true : undefined}
          aria-describedby={shown ? `${inputId}-error` : undefined}
          onChange={event => { setName(event.target.value); setTouched(true) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
        />
        {shown && <span id={`${inputId}-error`} className="mmi-saveas-error" role="alert">{shown}</span>}
      </div>
      <TagsCollectionsGroup idPrefix={`saveas-${inputId.replace(/[^a-zA-Z0-9_-]/g, '')}`} tags={tags} onTagsChange={setTags} collectionIds={collectionIds} onCollectionIdsChange={setCollectionIds} disabled={busy} />
    </ConfirmDialog>
  )
}

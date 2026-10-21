import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'

interface Props {
  open: boolean
  documentTitle: string
  /** The revision the server holds now, when the save reported it. */
  serverRevision?: number
  /** The revision the edits were started from. */
  yourRevision?: number
  busy?: 'reload' | 'copy' | null
  onReloadLatest: () => void
  onSaveAsNewVersion: () => void
}

/**
 * A save was refused because the lyric version was saved from somewhere else in the meantime. Nothing can be saved over it, so the
 * user chooses: take the server's version (their unsaved edits are dropped) or keep their edits as a new version. The dialog cannot be
 * dismissed, because every later save of this version would be refused until one of the two is chosen.
 */
export function LyricConflictDialog({
  open,
  documentTitle,
  serverRevision,
  yourRevision,
  busy = null,
  onReloadLatest,
  onSaveAsNewVersion,
}: Props) {
  if (!open) return null
  const revisions = serverRevision !== undefined && yourRevision !== undefined
    ? ` (the server is on revision ${serverRevision}; your edits started from ${yourRevision})`
    : ''
  return (
    <ConfirmDialog
      title="This lyric version was changed elsewhere"
      message={`“${documentTitle || 'This lyric version'}” was saved from another tab or device after you opened it${revisions}, so your edits can’t be saved over it. Reload the latest version and your unsaved edits are discarded, or save your edits as a new version and leave the other one as it is.`}
      cancelLabel="Reload Latest"
      confirmLabel="Save as New Version"
      busyLabel="Saving…"
      busy={busy !== null}
      danger={false}
      confirmTone="primary"
      iconTone="neutral"
      dismissible={false}
      onCancel={onReloadLatest}
      onConfirm={onSaveAsNewVersion}
    />
  )
}

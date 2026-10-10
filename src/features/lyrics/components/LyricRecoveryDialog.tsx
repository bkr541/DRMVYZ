import { ConfirmDialog } from '../../../components/vyzualz/react/controls/ConfirmDialog'
import type { LyricCue, LyricDocument } from '../../../types/lyrics'
import {
  describeLyricRecoveryDifferences,
  recoveryConflictsWithServer,
  type LyricRecoveryRecord,
} from '../../../lib/lyricDraftRecovery'

interface Props {
  recovery: LyricRecoveryRecord | null
  document: LyricDocument | null
  canonicalCues: LyricCue[]
  reviewing: boolean
  busy?: boolean
  onRestore: () => void
  onReview: () => void
  onDiscard: () => void
}

export function LyricRecoveryDialog({
  recovery,
  document,
  canonicalCues,
  reviewing,
  busy = false,
  onRestore,
  onReview,
  onDiscard,
}: Props) {
  if (!recovery) return null
  const conflict = recoveryConflictsWithServer(recovery, document)
  const differences = describeLyricRecoveryDifferences(recovery, document, canonicalCues)
  const title = conflict ? 'Recovered lyric draft conflicts with the server' : 'Recovered lyric draft available'
  const message = `DRMVYZ found local lyric edits from ${new Date(recovery.lastEditAt).toLocaleString()}${conflict
    ? `. The server advanced from revision ${recovery.baseServerRevision ?? 'none'} to ${document?.revision ?? 'none'}, so neither version will be overwritten automatically.`
    : '. Restore them as unsaved local changes, review the differences, or discard only this recovery copy.'}`

  return (
    <ConfirmDialog
      title={title}
      message={message}
      cancelLabel="Discard Recovery"
      cancelDanger
      dismissible={false}
      secondary={{ label: reviewing ? 'Hide Review' : 'Review', onClick: onReview, pressed: reviewing }}
      confirmLabel="Restore as Unsaved"
      busyLabel="Restoring…"
      busy={busy}
      danger={false}
      confirmTone="primary"
      iconTone={conflict ? 'danger' : 'neutral'}
      onCancel={onDiscard}
      onConfirm={onRestore}
    >
      {reviewing && (
        <div className="lmv-recovery-review" aria-label="Recovered lyric differences">
          <strong>Recovery review</strong>
          <ul>
            {differences.map(difference => <li key={difference}>{difference}</li>)}
          </ul>
        </div>
      )}
    </ConfirmDialog>
  )
}

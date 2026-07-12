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

  return (
    <div className="lmv-dialog-backdrop" role="presentation">
      <div className="lmv-dialog" role="alertdialog" aria-modal="true" aria-labelledby="lmv-recovery-title">
        <div id="lmv-recovery-title" className="lmv-dialog-title">
          {conflict ? 'Recovered lyric draft conflicts with the server' : 'Recovered lyric draft available'}
        </div>
        <p className="lmv-dialog-copy">
          DRMVYZ found local lyric edits from {new Date(recovery.lastEditAt).toLocaleString()}.
          {conflict
            ? ` The server advanced from revision ${recovery.baseServerRevision ?? 'none'} to ${document?.revision ?? 'none'}, so neither version will be overwritten automatically.`
            : ' Restore them as unsaved local changes, review the differences, or discard only this recovery copy.'}
        </p>
        {reviewing && (
          <div className="lmv-recovery-review" aria-label="Recovered lyric differences">
            <strong>Recovery review</strong>
            <ul>
              {differences.map(difference => <li key={difference}>{difference}</li>)}
            </ul>
          </div>
        )}
        <div className="lmv-dialog-actions">
          <button className="lmv-btn lmv-btn--danger" onClick={onDiscard} disabled={busy}>Discard Recovery</button>
          <button className="lmv-btn lmv-btn--ghost" onClick={onReview} disabled={busy} aria-pressed={reviewing}>
            {reviewing ? 'Hide Review' : 'Review'}
          </button>
          <button className="lmv-btn lmv-btn--primary" onClick={onRestore} disabled={busy}>Restore as Unsaved</button>
        </div>
      </div>
    </div>
  )
}

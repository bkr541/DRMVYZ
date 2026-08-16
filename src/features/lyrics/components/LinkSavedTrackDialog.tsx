import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import type { Track } from '../../../types'
import type { SavedTrackLinkCandidate } from '../services/savedTrackLinking'

interface LinkSavedTrackDialogProps {
  runtimeTrack: Track | null
  candidates: readonly SavedTrackLinkCandidate[]
  selectedTrackId: string | null
  loading: boolean
  confirming: boolean
  error: string | null
  onSelect: (trackId: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds)) return 'Duration unavailable'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function LinkSavedTrackDialog({
  runtimeTrack,
  candidates,
  selectedTrackId,
  loading,
  confirming,
  error,
  onSelect,
  onConfirm,
  onCancel,
}: LinkSavedTrackDialogProps) {
  if (!runtimeTrack) return null
  const selected = candidates.find(candidate => candidate.track.dbId === selectedTrackId) ?? null

  return (
    <div className="lmv-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !confirming) onCancel()
    }}>
      <section className="lmv-dialog lmv-link-track-dialog" role="dialog" aria-modal="true" aria-labelledby="lmv-link-track-title">
        <h2 id="lmv-link-track-title">Link to Saved Track</h2>
        <p>
          Choose the saved User Media track that represents <strong>{runtimeTrack.displayName || runtimeTrack.name}</strong>.
          Suggestions are possible matches only. DRMVYZ will not link a filename automatically.
        </p>

        {loading ? (
          <div className="lmv-link-track-state" role="status">Searching saved tracks…</div>
        ) : error ? (
          <NoticeCard tone="error" role="alert" title="Saved track lookup failed">{error}</NoticeCard>
        ) : candidates.length === 0 ? (
          <div className="lmv-link-track-state">No saved candidates were found. Import this audio file through Media Manager first.</div>
        ) : (
          <div className="lmv-link-track-candidates" role="radiogroup" aria-label="Possible saved track matches">
            {candidates.map((candidate, index) => {
              const checked = candidate.track.dbId === selectedTrackId
              return (
                <label key={candidate.track.dbId} className={`lmv-link-track-candidate${checked ? ' lmv-link-track-candidate--selected' : ''}`}>
                  <input
                    type="radio"
                    name="saved-track-link"
                    value={candidate.track.dbId}
                    checked={checked}
                    onChange={() => onSelect(candidate.track.dbId)}
                  />
                  <span className="lmv-link-track-candidate-main">
                    <strong>{candidate.track.title || candidate.track.fileName}</strong>
                    <span>{candidate.track.artist || 'Unknown artist'} · {formatDuration(candidate.track.durationSec)}</span>
                    <em>{index === 0 ? 'Top possible match' : 'Possible match'} · {candidate.signals.join(' · ')}</em>
                    {candidate.durationMismatch && <b>Duration mismatch. Verify this is the same recording before linking.</b>}
                  </span>
                </label>
              )
            })}
          </div>
        )}

        <div className="lmv-dialog-actions">
          <IconChipButton onClick={onCancel} disabled={confirming}>Cancel</IconChipButton>
          <IconChipButton
            tone="primary"
            onClick={onConfirm}
            disabled={!selected || loading || confirming}
          >
            {confirming ? 'Linking…' : 'Confirm and Reload Saved Track'}
          </IconChipButton>
        </div>
      </section>
    </div>
  )
}

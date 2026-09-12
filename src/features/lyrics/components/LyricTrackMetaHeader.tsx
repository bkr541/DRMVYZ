import { useRef } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { useMountTransition } from '../../../hooks/useMountTransition'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { formatDuration, trackInitials } from '../utils/lyricManagerFormat'

interface Props {
  track: LyricManagerTrack | null
  openVersionTitle: string | null
  activeVersionTitle: string | null
  loading: boolean
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  onLoadTrack: () => void
  onTogglePlayback: () => void
}

/**
 * Always-visible artwork + title/artist/key/bpm/genre/duration row at the
 * top of the center column — replaces "Track Information" in Document
 * Workspace, since that's now redundant with this row. There is no
 * artwork/cover-image field anywhere in the data model (verified: neither
 * LyricManagerTrack/SavedAudioTrack nor the audio_tracks table has one), so
 * the artwork slot reuses the existing trackInitials() placeholder
 * treatment rather than a real image — real artwork storage is a separate,
 * later change.
 */
export function LyricTrackMetaHeader({
  track,
  openVersionTitle,
  activeVersionTitle,
  loading,
  selectedTrackLoaded,
  selectedTrackPlaying,
  onLoadTrack,
  onTogglePlayback,
}: Props) {
  const hasTrack = Boolean(track)
  const emptyPhase = useMountTransition(!hasTrack, 200)
  const filledPhase = useMountTransition(hasTrack, 200)

  const lastTrackRef = useRef<LyricManagerTrack | null>(track)
  if (track) lastTrackRef.current = track
  const displayTrack = track ?? lastTrackRef.current

  return (
    <section className="lmv-track-meta-header" aria-label="Track metadata">
      {emptyPhase !== 'unmounted' && (
        <div className={`lmv-track-state lmv-track-state--${emptyPhase}`}>Select a track from the library to inspect lyric versions, edit timed cues, and preview the document in the visualizer.</div>
      )}
      {filledPhase !== 'unmounted' && displayTrack && (
        <div className={`lmv-track-meta-fill lmv-track-meta-fill--${filledPhase}`}>
          <div className="lmv-track-art" aria-hidden="true"><span>{trackInitials(displayTrack)}</span></div>

          <div className="lmv-track-meta-identity">
            <div className="lmv-track-card-topline">
              <span className="lmv-track-title">{displayTrack.title || displayTrack.fileName}</span>
              <span className="lmv-track-state-badges">
                <StatusBadge tone="selected">Selected</StatusBadge>
                {selectedTrackLoaded && <StatusBadge tone="loaded">Loaded</StatusBadge>}
                {selectedTrackPlaying && <StatusBadge tone="playing">Playing</StatusBadge>}
              </span>
            </div>
            <span className="lmv-track-artist">{displayTrack.artist || 'Unknown artist'}</span>
          </div>

          <div className="lmv-track-meta-chips" aria-label="Track details">
            <span className="lmv-track-meta-chip"><span className="lmv-track-meta-chip-label">Key</span><span className="lmv-track-meta-chip-value">{displayTrack.musicalKey || '—'}</span></span>
            <span className="lmv-track-meta-chip"><span className="lmv-track-meta-chip-label">BPM</span><span className="lmv-track-meta-chip-value">{displayTrack.bpm ? Math.round(displayTrack.bpm) : '—'}</span></span>
            <span className="lmv-track-meta-chip"><span className="lmv-track-meta-chip-label">Genre</span><span className="lmv-track-meta-chip-value">{displayTrack.genre || '—'}</span></span>
            <span className="lmv-track-meta-chip"><span className="lmv-track-meta-chip-label">Duration</span><span className="lmv-track-meta-chip-value">{formatDuration(displayTrack.durationSec)}</span></span>
          </div>

          <dl className="lmv-workflow-status-grid lmv-track-info-versions">
            <div><dt>Open version</dt><dd>{openVersionTitle ?? 'None'}</dd></div>
            <div><dt>Active version</dt><dd className={activeVersionTitle ? 'lmv-status-good' : 'lmv-status-missing'}>{activeVersionTitle ?? 'None'}</dd></div>
          </dl>

          <div className="lmv-track-hero-actions">
            <IconChipButton onClick={onLoadTrack} disabled={loading}>
              {loading ? 'Loading…' : selectedTrackLoaded ? 'Reload deck' : 'Load deck'}
            </IconChipButton>
            <IconChipButton tone="primary" onClick={onTogglePlayback} disabled={!selectedTrackLoaded}>
              {selectedTrackPlaying ? 'Pause' : 'Preview'}
            </IconChipButton>
          </div>
        </div>
      )}
    </section>
  )
}

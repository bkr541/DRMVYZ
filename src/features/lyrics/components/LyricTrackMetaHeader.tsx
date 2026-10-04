import { useRef } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { DropdownSelect } from '../../../components/shared/Dropdown/Dropdown'
import { useMountTransition } from '../../../hooks/useMountTransition'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { formatDuration, trackInitials } from '../utils/lyricManagerFormat'

export interface LyricHeaderVersion {
  id: string
  title: string
}

interface Props {
  track: LyricManagerTrack | null
  /** Saved versions of the track, for the OPEN selector. */
  versions: LyricHeaderVersion[]
  /** The version open in the editor (null for an unsaved draft). */
  openVersionId: string | null
  openVersionTitle: string | null
  activeVersionTitle: string | null
  loading: boolean
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  onLoadTrack: () => void
  /** Opens another saved version through the owner's guarded (unsaved-changes aware) handler. */
  onOpenVersion: (versionId: string) => void
}

/**
 * Compact track strip at the top of the center workspace: artwork, title/artist, a single metadata line, and
 * the two version concepts side by side — OPEN (what the editor has open; selectable) and ACTIVE (the
 * persisted production version; read-only here — activation stays in the Versions list / Save + Make
 * Active). There is no artwork field in the data model (neither LyricManagerTrack nor audio_tracks has
 * one), so the artwork slot keeps the trackInitials() placeholder.
 */
export function LyricTrackMetaHeader({
  track,
  versions,
  openVersionId,
  openVersionTitle,
  activeVersionTitle,
  loading,
  selectedTrackLoaded,
  selectedTrackPlaying,
  onLoadTrack,
  onOpenVersion,
}: Props) {
  const hasTrack = Boolean(track)
  const emptyPhase = useMountTransition(!hasTrack, 200)
  const filledPhase = useMountTransition(hasTrack, 200)

  const lastTrackRef = useRef<LyricManagerTrack | null>(track)
  if (track) lastTrackRef.current = track
  const displayTrack = track ?? lastTrackRef.current

  const meta = displayTrack
    ? [
        displayTrack.bpm ? `${Math.round(displayTrack.bpm)} BPM` : null,
        displayTrack.musicalKey || null,
        displayTrack.durationSec ? formatDuration(displayTrack.durationSec) : null,
        displayTrack.genre || null,
      ].filter(Boolean)
    : []

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
              <span className="lmv-track-artist">{displayTrack.artist || 'Unknown artist'}</span>
              <span className="lmv-track-state-badges">
                {selectedTrackLoaded && <StatusBadge tone="loaded">Loaded</StatusBadge>}
                {selectedTrackPlaying && <StatusBadge tone="playing">Playing</StatusBadge>}
              </span>
            </div>
            <div className="lmv-track-meta-line" aria-label="Track details">{meta.join(' • ')}</div>
          </div>

          <div className="lmv-track-meta-versions">
            <div className="lmv-track-meta-version">
              <span className="lmv-track-meta-version-label" id="lmv-open-version-label">Open</span>
              {versions.length > 0 ? (
                <DropdownSelect
                  className="lmv-select lmv-track-meta-version-select"
                  aria-labelledby="lmv-open-version-label"
                  value={openVersionId ?? ''}
                  onChange={event => { if (event.target.value && event.target.value !== openVersionId) onOpenVersion(event.target.value) }}
                >
                  {!openVersionId && <option value="" disabled>{openVersionTitle ?? 'Unsaved draft'}</option>}
                  {versions.map(version => <option key={version.id} value={version.id}>{version.title}</option>)}
                </DropdownSelect>
              ) : (
                <span className="lmv-track-meta-version-value">{openVersionTitle ?? 'Unsaved draft'}</span>
              )}
            </div>
            <div className="lmv-track-meta-version">
              <span className="lmv-track-meta-version-label">Active</span>
              <span className={`lmv-track-meta-version-value ${activeVersionTitle ? 'lmv-status-good' : 'lmv-status-missing'}`}>
                {activeVersionTitle ?? 'None'}
              </span>
            </div>
          </div>

          {!selectedTrackLoaded && (
            <IconChipButton className="lmv-track-meta-load" onClick={onLoadTrack} disabled={loading}>
              {loading ? 'Loading…' : 'Load deck'}
            </IconChipButton>
          )}
        </div>
      )}
    </section>
  )
}

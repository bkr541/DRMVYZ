import { useRef } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { SelectRow } from '../../../components/vyzualz/react/ReactControlRows'
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
  loading: boolean
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  onLoadTrack: () => void
  /** Opens another saved version through the owner's guarded (unsaved-changes aware) handler. */
  onOpenVersion: (versionId: string) => void
}

/**
 * Compact track strip at the top of the center workspace: artwork, title/artist, a single metadata line, and
 * the OPEN selector (the version the editor has open) in the shared right-rail dropdown. The ACTIVE version is
 * not repeated here: the Versions list shows it, and activation stays there / in Save + Make Active. There is no artwork field in the data model (neither LyricManagerTrack nor audio_tracks has
 * one), so the artwork slot keeps the trackInitials() placeholder.
 */
export function LyricTrackMetaHeader({
  track,
  versions,
  openVersionId,
  openVersionTitle,
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
            {versions.length > 0 ? (
              <SelectRow
                label="Open"
                value={openVersionId ?? ''}
                placeholder={openVersionTitle ?? 'Unsaved draft'}
                onChange={value => { if (value && value !== openVersionId) onOpenVersion(value) }}
                options={versions.map(version => ({ value: version.id, label: version.title }))}
              />
            ) : (
              <div className="rv-ctrl-row">
                <span className="rv-ctrl-label-cluster"><span className="rv-ctrl-label">Open</span></span>
                <span className="lmv-track-meta-version-value">{openVersionTitle ?? 'Unsaved draft'}</span>
              </div>
            )}
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

import { useRef, type ReactNode } from 'react'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { StatusBadge } from '../../../components/vyzualz/react/controls/StatusBadge'
import { useMountTransition } from '../../../hooks/useMountTransition'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { formatDuration, trackInitials } from '../utils/lyricManagerFormat'

interface Props {
  track: LyricManagerTrack | null
  loading: boolean
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  onLoadTrack: () => void
  /** Audio controls docked into the strip beside the track information (see LyricTimelineToolbar). */
  controls?: ReactNode
}

/**
 * Compact track strip in the center workspace: artwork, title/artist and a single metadata line, with the audio controls docked beside
 * them when given (identity on the left, transport and levels on the right, as in a now-playing bar). Which
 * lyric version is open or active is shown (and changed) in the Versions list, not here. There is no artwork field in the data model (neither LyricManagerTrack nor audio_tracks has
 * one), so the artwork slot keeps the trackInitials() placeholder.
 */
export function LyricTrackMetaHeader({
  track,
  loading,
  selectedTrackLoaded,
  selectedTrackPlaying,
  onLoadTrack,
  controls,
}: Props) {
  const hasTrack = Boolean(track)
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
      {filledPhase !== 'unmounted' && displayTrack && (
        controls ? (
          // Docked: one slim deck row. Title with its state LEDs and the artist beneath, BPM and key as stacked readouts, then the audio
          // controls; Load deck leads them while the deck is empty. The duration is the scrubber's total, so it is not repeated here.
          <div className={`lmv-track-meta-fill lmv-track-meta-fill--${filledPhase} lmv-track-meta-fill--docked`}>
            <div className="lmv-track-art" aria-hidden="true"><span>{trackInitials(displayTrack)}</span></div>

            <div className="lmv-track-meta-identity">
              <div className="lmv-track-deck-title">
                <span className="lmv-track-title" title={displayTrack.title || displayTrack.fileName}>{displayTrack.title || displayTrack.fileName}</span>
                {selectedTrackLoaded && <span className="lmv-track-led lmv-track-led--loaded" role="img" aria-label="Loaded" title="Loaded" />}
                {selectedTrackPlaying && <span className="lmv-track-led lmv-track-led--playing" role="img" aria-label="Playing" title="Playing" />}
              </div>
              <div className="lmv-track-byline">{[displayTrack.artist || 'Unknown artist', displayTrack.genre].filter(Boolean).join(' • ')}</div>
            </div>

            {(displayTrack.bpm || displayTrack.musicalKey) && (
              <div className="lmv-track-meta-line lmv-track-specs" aria-label="Track details">
                {displayTrack.bpm ? <span className="lmv-track-spec"><b>{Math.round(displayTrack.bpm)}</b> <i>BPM</i></span> : null}
                {displayTrack.musicalKey ? <span className="lmv-track-spec"><b>{displayTrack.musicalKey}</b> <i>Key</i></span> : null}
              </div>
            )}

            <div className="lmv-track-meta-controls">
              {!selectedTrackLoaded && (
                <IconChipButton className="lmv-track-meta-load" onClick={onLoadTrack} disabled={loading}>
                  {loading ? 'Loading…' : 'Load deck'}
                </IconChipButton>
              )}
              {controls}
            </div>
          </div>
        ) : (
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

            {!selectedTrackLoaded && (
              <IconChipButton className="lmv-track-meta-load" onClick={onLoadTrack} disabled={loading}>
                {loading ? 'Loading…' : 'Load deck'}
              </IconChipButton>
            )}
          </div>
        )
      )}
    </section>
  )
}

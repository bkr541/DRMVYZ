import { Delete02Icon } from 'hugeicons-react'
import type { LyricManagerTrack } from '../lyricManagerTypes'

interface Props {
  tracks: LyricManagerTrack[]
  selectedTrackId: string | null
  loadedAudioTrackId: string | null
  playingAudioTrackId: string | null
  search: string
  loading: boolean
  error: string | null
  hasMore: boolean
  onSearchChange: (value: string) => void
  onSelectTrack: (track: LyricManagerTrack) => void
  onDeleteTrack: (track: LyricManagerTrack) => void
  onLoadMore: () => void
  onUpload: () => void
  onRetry: () => void
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function trackInitials(track: LyricManagerTrack): string {
  const source = `${track.title || track.fileName || ''} ${track.artist || ''}`.trim()
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '♪'
}

export function LyricTrackBrowser({
  tracks,
  selectedTrackId,
  loadedAudioTrackId,
  playingAudioTrackId,
  search,
  loading,
  error,
  hasMore,
  onSearchChange,
  onSelectTrack,
  onDeleteTrack,
  onLoadMore,
  onUpload,
  onRetry,
}: Props) {
  return (
    <section className="lmv-track-browser" aria-label="Stored audio tracks">
      <div className="lmv-track-browser-head">
        <div>
          <div className="lmv-track-browser-title">TRACK LIBRARY</div>
          <div className="lmv-track-browser-subtitle">Select or upload a track.</div>
        </div>
        <div className="lmv-track-browser-actions">
          <button className="lmv-icon-btn" onClick={onUpload} aria-label="Upload track" title="Upload track"><span className="lmv-sr-label">Upload Track</span>⇧</button>
          <button className="lmv-icon-btn" type="button" aria-label="Filter tracks" title="Filter tracks">▽</button>
        </div>
      </div>

      <div className="lmv-track-search-wrap">
        <input
          className="lmv-input lmv-track-search"
          type="search"
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search title or artist…"
          aria-label="Search tracks by title or artist"
        />
      </div>

      {error && (
        <div className="lmv-track-state lmv-track-state--error">
          <span>{error}</span>
          <button className="lmv-btn lmv-btn--ghost" onClick={onRetry}>Retry</button>
        </div>
      )}

      {!error && !loading && tracks.length === 0 && (
        <div className="lmv-track-state">
          {search.trim()
            ? 'No stored tracks match that title or artist.'
            : 'No stored audio tracks yet. Upload one to begin.'}
        </div>
      )}

      <div className="lmv-track-grid">
        {tracks.map(track => {
          const selected = selectedTrackId === track.dbId
          const loaded = loadedAudioTrackId === track.dbId
          const playing = playingAudioTrackId === track.dbId
          return (
            <div key={track.dbId} className="lmv-track-card-wrap">
              <button
                type="button"
                className={`lmv-track-card${selected ? ' lmv-track-card--selected' : ''}`}
                onClick={() => onSelectTrack(track)}
                aria-pressed={selected}
              >
                <span className="lmv-track-card-art" aria-hidden="true">{trackInitials(track)}</span>
                <span className="lmv-track-card-main">
                  <span className="lmv-track-card-topline">
                    <span className="lmv-track-title">{track.title || track.fileName}</span>
                    {playing ? <span className="lmv-playing-badge">Playing</span> : loaded ? <span className="lmv-loaded-badge">Loaded</span> : null}
                  </span>
                  <span className="lmv-track-artist">{track.artist || 'Unknown artist'}</span>
                  <span className="lmv-track-meta">
                    <span>{formatDuration(track.durationSec)}</span>
                    <span>{track.bpm ? `${Math.round(track.bpm)} BPM` : 'BPM —'}</span>
                    <span>{track.musicalKey || 'Key —'}</span>
                    <span>{formatDate(track.createdAt)}</span>
                  </span>
                  <span className="lmv-track-lyrics-row">
                    <span className={track.lyricVersionCount > 0 ? 'lmv-track-has-lyrics' : 'lmv-track-no-lyrics'}>
                      {track.lyricVersionCount > 0
                        ? `${track.lyricVersionCount} lyric version${track.lyricVersionCount === 1 ? '' : 's'}`
                        : 'No lyrics'}
                    </span>
                    <span className="lmv-track-active-doc">
                      {track.activeLyricDocumentName ? `Active: ${track.activeLyricDocumentName}` : 'No active version'}
                    </span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="lmv-track-delete-btn"
                onClick={() => onDeleteTrack(track)}
                title="Delete track and all lyric versions"
                aria-label={`Delete ${track.title || track.fileName} and all lyric versions`}
              >
                <Delete02Icon size={12} color="currentColor" />
              </button>
            </div>
          )
        })}
      </div>

      {loading && <div className="lmv-track-state">Loading tracks…</div>}
      {!loading && hasMore && (
        <button className="lmv-btn lmv-btn--ghost lmv-load-more" onClick={onLoadMore}>Load More</button>
      )}
    </section>
  )
}

import { useMemo, useState } from 'react'
import { Delete02Icon } from 'hugeicons-react'
import { Dropdown } from '../../../components/shared/Dropdown/Dropdown'
import { ContextActionMenu } from '../../../components/vyzualz/context-menu/ContextActionMenu'
import type { LyricManagerTrack } from '../lyricManagerTypes'


export type LyricTrackFilter =
  | 'all'
  | 'has-versions'
  | 'has-active'
  | 'no-active'
  | 'loaded'
  | 'needs-review'

const TRACK_FILTER_LABELS: Record<LyricTrackFilter, string> = {
  all: 'All Tracks',
  'has-versions': 'Has Lyric Versions',
  'has-active': 'Has Active Lyrics',
  'no-active': 'No Active Lyrics',
  loaded: 'Loaded Track',
  'needs-review': 'Tracks Needing Review',
}

export function filterLyricManagerTracks(
  tracks: readonly LyricManagerTrack[],
  filter: LyricTrackFilter,
  loadedAudioTrackId: string | null,
  search = '',
): LyricManagerTrack[] {
  const query = search.trim().toLocaleLowerCase()
  return tracks.filter(track => {
    const matchesSearch = !query || `${track.title} ${track.fileName} ${track.artist ?? ''}`.toLocaleLowerCase().includes(query)
    if (!matchesSearch) return false
    if (filter === 'has-versions') return track.lyricVersionCount > 0
    if (filter === 'has-active') return Boolean(track.activeLyricDocumentId)
    if (filter === 'no-active') return !track.activeLyricDocumentId
    if (filter === 'loaded') return track.dbId === loadedAudioTrackId
    if (filter === 'needs-review') return track.needsReview === true
    return true
  })
}

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
  onLoadTrack: (track: LyricManagerTrack, autoplay: boolean) => void
  onOpenActiveLyrics: (track: LyricManagerTrack) => void
  onOpenAiExtract: (track: LyricManagerTrack) => void
  onMakeOpenVersionActive: (track: LyricManagerTrack) => void
  canMakeOpenVersionActive: (track: LyricManagerTrack) => boolean
  onDeleteTrack: (track: LyricManagerTrack) => void
  onLoadMore: () => void
  onUpload: () => void
  onRetry: () => void
}

interface TrackMenuState {
  track: LyricManagerTrack
  x: number
  y: number
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
  onLoadTrack,
  onOpenActiveLyrics,
  onOpenAiExtract,
  onMakeOpenVersionActive,
  canMakeOpenVersionActive,
  onDeleteTrack,
  onLoadMore,
  onUpload,
  onRetry,
}: Props) {
  const [menu, setMenu] = useState<TrackMenuState | null>(null)
  const [filter, setFilter] = useState<LyricTrackFilter>('all')
  const visibleTracks = useMemo(
    () => filterLyricManagerTracks(tracks, filter, loadedAudioTrackId, search),
    [filter, loadedAudioTrackId, search, tracks],
  )

  const openMenu = (track: LyricManagerTrack, x: number, y: number) => {
    setMenu({ track, x, y })
  }

  return (
    <section className="lmv-track-browser" aria-label="Stored audio tracks">
      <div className="lmv-track-browser-head">
        <div>
          <div className="lmv-track-browser-title">TRACK LIBRARY</div>
          <div className="lmv-track-browser-subtitle">Select, double-click to load, or right-click for actions.</div>
        </div>
        <div className="lmv-track-browser-actions">
          <button className="lmv-icon-btn" onClick={onUpload} aria-label="Upload track" title="Upload track"><span className="lmv-sr-label">Upload Track</span>⇧</button>
          <Dropdown
            id="lyric-track-filter"
            value={filter}
            options={(Object.entries(TRACK_FILTER_LABELS) as Array<[LyricTrackFilter, string]>).map(([value, label]) => ({ value, label }))}
            onChange={value => setFilter(value as LyricTrackFilter)}
            ariaLabel={`Filter tracks: ${TRACK_FILTER_LABELS[filter]}`}
            menuLabel="Track Library Filters"
            title={`Filter tracks: ${TRACK_FILTER_LABELS[filter]}`}
            size="dense"
            menuWidth={220}
            showDescriptions={false}
            className="lmv-track-filter-dropdown"
          />
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

      {!error && !loading && visibleTracks.length === 0 && (
        <div className="lmv-track-state">
          {search.trim()
            ? 'No stored tracks match the current search and filter.'
            : filter !== 'all'
              ? `No loaded tracks match “${TRACK_FILTER_LABELS[filter]}”.${hasMore ? ' Load more tracks to continue filtering.' : ''}`
              : 'No stored audio tracks yet. Upload one to begin.'}
        </div>
      )}

      <div className="lmv-track-grid">
        {visibleTracks.map(track => {
          const selected = selectedTrackId === track.dbId
          const loaded = loadedAudioTrackId === track.dbId
          const playing = playingAudioTrackId === track.dbId
          return (
            <div key={track.dbId} className="lmv-track-card-wrap">
              <button
                type="button"
                className={`lmv-track-card${selected ? ' lmv-track-card--selected' : ''}`}
                onClick={() => onSelectTrack(track)}
                onDoubleClick={() => onLoadTrack(track, false)}
                onContextMenu={event => {
                  event.preventDefault()
                  openMenu(track, event.clientX, event.clientY)
                }}
                onKeyDown={event => {
                  if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
                  event.preventDefault()
                  const rect = event.currentTarget.getBoundingClientRect()
                  openMenu(track, rect.left + 24, rect.top + 24)
                }}
                aria-pressed={selected}
                aria-haspopup="menu"
              >
                <span className="lmv-track-card-art" aria-hidden="true">{trackInitials(track)}</span>
                <span className="lmv-track-card-main">
                  <span className="lmv-track-card-topline">
                    <span className="lmv-track-title">{track.title || track.fileName}</span>
                    <span className="lmv-track-state-badges">
                      {selected && <span className="lmv-selected-badge">Selected</span>}
                      {loaded && <span className="lmv-loaded-badge">Loaded</span>}
                      {playing && <span className="lmv-playing-badge">Playing</span>}
                    </span>
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

      <div className="lmv-track-filter-summary" aria-live="polite">{visibleTracks.length} shown · {TRACK_FILTER_LABELS[filter]}</div>
      {loading && <div className="lmv-track-state">Loading tracks…</div>}
      {!loading && hasMore && (
        <button className="lmv-btn lmv-btn--ghost lmv-load-more" onClick={onLoadMore}>Load More</button>
      )}

      {menu && (
        <ContextActionMenu
          x={menu.x}
          y={menu.y}
          ariaLabel={`Actions for ${menu.track.title || menu.track.fileName}`}
          header={{
            title: menu.track.title || menu.track.fileName,
            subtitle: menu.track.artist || 'Unknown artist',
          }}
          onClose={() => setMenu(null)}
          items={[
            { id: 'load', label: 'Load Track', onSelect: () => onLoadTrack(menu.track, false) },
            { id: 'load-play', label: 'Load and Play', onSelect: () => onLoadTrack(menu.track, true) },
            {
              id: 'open-active',
              label: 'Open Active Lyrics',
              onSelect: () => onOpenActiveLyrics(menu.track),
            },
            { id: 'extract', label: 'AI Extract Lyrics', onSelect: () => onOpenAiExtract(menu.track) },
            ...(canMakeOpenVersionActive(menu.track) ? [{
              id: 'make-active',
              label: 'Make Active Version',
              onSelect: () => onMakeOpenVersionActive(menu.track),
            }] : []),
            {
              id: 'delete',
              label: 'Delete Track',
              dividerBefore: true,
              danger: true,
              onSelect: () => onDeleteTrack(menu.track),
            },
          ]}
        />
      )}
    </section>
  )
}

import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { useMemo, useState } from 'react'
import { LyricSearchFilterRow } from './LyricSearchFilterRow'
import { AudioTrackCard } from '../../../components/vyzualz/media/AudioTrackCard'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { trackInitials } from '../utils/lyricManagerFormat'


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
  onRetry: () => void
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
  onRetry,
}: Props) {
  const [filter, setFilter] = useState<LyricTrackFilter>('all')
  const visibleTracks = useMemo(
    () => filterLyricManagerTracks(tracks, filter, loadedAudioTrackId, search),
    [filter, loadedAudioTrackId, search, tracks],
  )

  return (
    <section className="lmv-track-browser" aria-label="Stored audio tracks">
      <div className="lmv-track-library-body">
      <LyricSearchFilterRow
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search title or artist…"
        searchAriaLabel="Search tracks by title or artist"
        filterId="lyric-track-filter"
        filterValue={filter}
        filterOptions={(Object.entries(TRACK_FILTER_LABELS) as Array<[LyricTrackFilter, string]>).map(([value, label]) => ({ value, label }))}
        onFilterChange={value => setFilter(value as LyricTrackFilter)}
        filterAriaLabel={`Filter tracks: ${TRACK_FILTER_LABELS[filter]}`}
        filterMenuLabel="Track Library Filters"
      />

      {error && (
        <NoticeCard tone="error" role="alert" title="Track browser error">
          {error}{' '}
          <IconChipButton onClick={onRetry}>Retry</IconChipButton>
        </NoticeCard>
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
        {visibleTracks.map(track => (
          <AudioTrackCard
            key={track.dbId}
            track={track}
            onSelect={() => onSelectTrack(track)}
            onLoad={() => onLoadTrack(track, false)}
            loading={false}
            loaded={loadedAudioTrackId === track.dbId}
            playing={playingAudioTrackId === track.dbId}
            canLoad
            canOpenLyrics
            isActive={selectedTrackId === track.dbId}
            selectedBadge
            directAiExtract
            onOpenAiExtract={() => onOpenAiExtract(track)}
            actionsInOverflow
            artwork={<span>{trackInitials(track)}</span>}
            onOpenActiveLyrics={track.activeLyricDocumentId ? () => onOpenActiveLyrics(track) : undefined}
            onMakeActiveVersion={canMakeOpenVersionActive(track) ? () => onMakeOpenVersionActive(track) : undefined}
            canRemove
            // The Lyric Manager owns the delete confirmation (ConfirmTrackDeleteDialog); the card never deletes directly.
            confirmRemove={false}
            onRemove={() => onDeleteTrack(track)}
          />
        ))}
      </div>

      {loading && <div className="lmv-track-state">Loading tracks…</div>}
      {!loading && hasMore && (
        <IconChipButton className="lmv-load-more" onClick={onLoadMore}>Load More</IconChipButton>
      )}
      </div>
    </section>
  )
}

import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { Collapsible } from '../../../components/vyzualz/react/ReactControlRows'
import { useMemo, useState } from 'react'
import { UnderlineDropdown } from '../../../components/vyzualz/react/controls/UnderlineDropdown'
import { AudioTrackCard } from '../../../components/vyzualz/media/AudioTrackCard'
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
  onOpenAiExtract,
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
      <Collapsible label="Track Library" defaultOpen bodyClassName="lmv-track-library-body">
      <div className="lmv-track-search-row">
        <div className="lmv-track-search-wrap">
          <svg className="lmv-track-search-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <DreamVizTextInput
            className="lmv-input lmv-track-search"
            type="search"
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search title or artist…"
            aria-label="Search tracks by title or artist"
          />
        </div>
        <UnderlineDropdown
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
            canRemove={false}
            isActive={selectedTrackId === track.dbId}
            selectedBadge
            directAiExtract
            onOpenAiExtract={() => onOpenAiExtract(track)}
          />
        ))}
      </div>

      {loading && <div className="lmv-track-state">Loading tracks…</div>}
      {!loading && hasMore && (
        <IconChipButton className="lmv-load-more" onClick={onLoadMore}>Load More</IconChipButton>
      )}
      </Collapsible>
    </section>
  )
}

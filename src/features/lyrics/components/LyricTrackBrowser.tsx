import { DrawerNotice } from '../../../components/vyzualz/shared/DrawerNotice'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { LyricSearchFilterRow } from './LyricSearchFilterRow'
import { AudioTrackCard } from '../../../components/vyzualz/media/AudioTrackCard'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'
import { DOC_FILTERS, LyricDocumentSidebar, type DocFilter } from './LyricDocumentSidebar'


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

/** The selected track's lyric versions (plus any unattached legacy documents), shown in place of the track list. */
export interface LyricTrackBrowserVersions {
  documents: LyricDocumentVersion[]
  legacyDocuments?: LyricDocumentVersion[]
  loading: boolean
  openDocumentId: string | null
  onSelectDocument: (doc: LyricDocumentVersion) => void
  onDuplicateDocument: (doc: LyricDocumentVersion) => void
  onRenameDocument: (doc: LyricDocumentVersion, title: string) => void
  onActivateDocument: (doc: LyricDocumentVersion) => void
  onDeleteDocument: (doc: LyricDocumentVersion) => void
  onNewDocument: () => void
  onImportDocument: () => void
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
  versions?: LyricTrackBrowserVersions
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
  versions,
}: Props) {
  const [filter, setFilter] = useState<LyricTrackFilter>('all')
  const visibleTracks = useMemo(
    () => filterLyricManagerTracks(tracks, filter, loadedAudioTrackId, search),
    [filter, loadedAudioTrackId, search, tracks],
  )

  // Selecting a track only selects it. Its lyric versions replace the list once the user opens them from the row's lyrics
  // icon; `versionsOpenId` is that request, and it ends when the track is deselected or another one is selected.
  const [versionsOpenId, setVersionsOpenId] = useState<string | null>(null)
  const versionsSeenRef = useRef(false)
  useEffect(() => {
    if (versionsOpenId === null) {
      versionsSeenRef.current = false
    } else if (selectedTrackId === versionsOpenId) {
      versionsSeenRef.current = true
    } else if (versionsSeenRef.current) {
      versionsSeenRef.current = false
      setVersionsOpenId(null)
    }
  }, [selectedTrackId, versionsOpenId])

  // A track whose versions are open (and that has versions, or unattached legacy documents, to show) replaces the list.
  const versionsTrack = versions && selectedTrackId && selectedTrackId === versionsOpenId
    ? tracks.find(track => track.dbId === selectedTrackId)
    : undefined
  const showVersions = Boolean(versions && versionsTrack
    && (versionsTrack.lyricVersionCount > 0 || versions.documents.length > 0 || (versions.legacyDocuments?.length ?? 0) > 0))

  const inVersions = Boolean(versions && versionsTrack && showVersions)

  // The versions have their own search and filter, in the track search row's slot: the tabs above and this row stay
  // put when the view changes, and only the cards below swap.
  const [versionSearch, setVersionSearch] = useState('')
  const [versionFilter, setVersionFilter] = useState<DocFilter>('all')
  useEffect(() => {
    setVersionSearch('')
    setVersionFilter('all')
  }, [versionsOpenId])

  return (
    <section
      className={`lmv-track-browser${inVersions ? ' lmv-track-browser--versions' : ''}`}
      aria-label={inVersions && versionsTrack ? `Lyric versions for ${versionsTrack.title}` : 'Stored audio tracks'}
    >
      <div className="lmv-track-library-body">
      {inVersions ? (
        <LyricSearchFilterRow
          searchValue={versionSearch}
          onSearchChange={setVersionSearch}
          searchPlaceholder="Search versions…"
          searchAriaLabel="Search lyric versions"
          filterId="lyric-version-filter"
          filterValue={versionFilter}
          filterOptions={DOC_FILTERS.map(item => ({ value: item.id, label: item.label }))}
          onFilterChange={value => setVersionFilter(value as DocFilter)}
          filterAriaLabel={`Filter versions: ${DOC_FILTERS.find(item => item.id === versionFilter)?.label ?? 'All'}`}
          filterMenuLabel="Lyric Version Filters"
          filterMenuWidth={180}
        />
      ) : (
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
      )}

      {inVersions && versions && versionsTrack ? (
        <div className="lmv-track-view" key="versions">
          <div className="lmv-versions-head">
            <button
              type="button"
              className="lmv-versions-back"
              aria-label={`Back to tracks from ${versionsTrack.title}`}
              onClick={() => setVersionsOpenId(null)}
            >
              <AppIcon kind="left" size={14} color="currentColor" />
              <span className="lmv-versions-back-copy">
                <span className="lmv-versions-back-title">{versionsTrack.title}</span>
                {versionsTrack.artist && <span className="lmv-versions-back-artist">{versionsTrack.artist}</span>}
              </span>
            </button>
            <IconChipButton
              icon={<AppIcon kind="fileAdd" size={14} color="currentColor" />}
              onClick={versions.onNewDocument}
              title="New version"
              aria-label="New lyric version"
            />
            <IconChipButton
              icon={<AppIcon kind="fileImport" size={14} color="currentColor" />}
              onClick={versions.onImportDocument}
              title="Import version"
              aria-label="Import lyric version"
            />
          </div>
          <LyricDocumentSidebar
            documents={versions.documents}
            legacyDocuments={versions.legacyDocuments}
            loading={versions.loading}
            openDocumentId={versions.openDocumentId}
            hasSelectedTrack
            search={versionSearch}
            filter={versionFilter}
            onSelectDocument={versions.onSelectDocument}
            onDuplicateDocument={versions.onDuplicateDocument}
            onRenameDocument={versions.onRenameDocument}
            onActivateDocument={versions.onActivateDocument}
            onDeleteDocument={versions.onDeleteDocument}
          />
        </div>
      ) : (
      <div className="lmv-track-view" key="tracks">
      {error && (
        <DrawerNotice tone="error" role="alert" title="Track browser error">
          {error}{' '}
          <IconChipButton onClick={onRetry}>Retry</IconChipButton>
        </DrawerNotice>
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
          const hasVersions = track.lyricVersionCount > 0 || Boolean(track.activeLyricDocumentId)
          // Unattached legacy documents are only listed with the selected track's versions.
          const showsLegacyDocuments = selected && (versions?.legacyDocuments?.length ?? 0) > 0
          return (
            <div key={track.dbId} className="lmv-track-group">
              <AudioTrackCard
                track={track}
                onSelect={() => { setVersionsOpenId(null); onSelectTrack(track) }}
                onLoad={() => onLoadTrack(track, false)}
                loading={false}
                loaded={loadedAudioTrackId === track.dbId}
                loadedDot
                playing={playingAudioTrackId === track.dbId}
                canLoad
                canOpenLyrics
                isActive={selected}
                selectedBadge
                onOpenAiExtract={() => onOpenAiExtract(track)}
                actionsInOverflow
                listRow
                artistFirst
                metadataIcons
                onOpenActiveLyrics={hasVersions || showsLegacyDocuments
                  ? () => {
                      setVersionsOpenId(track.dbId)
                      if (hasVersions) onOpenActiveLyrics(track)
                    }
                  : undefined}
                onMakeActiveVersion={canMakeOpenVersionActive(track) ? () => onMakeOpenVersionActive(track) : undefined}
                canRemove
                // The Lyric Manager owns the delete confirmation (ConfirmTrackDeleteDialog); the card never deletes directly.
                confirmRemove={false}
                onRemove={() => onDeleteTrack(track)}
              />
            </div>
          )
        })}
      </div>

      {loading && <div className="lmv-track-state">Loading tracks…</div>}
      {!loading && hasMore && (
        <IconChipButton className="lmv-load-more" onClick={onLoadMore}>Load More</IconChipButton>
      )}
      </div>
      )}
      </div>
    </section>
  )
}

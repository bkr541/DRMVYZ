import { useMemo, useState } from 'react'
import { LyricTrackBrowser } from '../../../../features/lyrics/components/LyricTrackBrowser'
import type { LyricDocumentVersion, LyricManagerTrack } from '../../../../features/lyrics/lyricManagerTypes'
import { LTR_DOCUMENTS, LTR_LEGACY_DOCUMENTS, LTR_MORE_TRACKS, LTR_TRACKS } from './layoutLabLyricTracksFixture'

// ── Layout Lab · right window · TRACKS ──────────────────────────────────────
//
// The Lyric Manager's Tracks tab, mounted unchanged: production's `LyricTrackBrowser` (the search field and filter
// dropdown, the track list of `AudioTrackCard` rows with their Selected / Loaded / Playing badges, Load, AI Extract and
// overflow actions, the selected track's lyric versions nested in its card with their New / Import version actions, the
// unattached legacy documents, and Load More) inside the same `.lmv-workspace-tab-panel` the Lyric Manager hosts it in.
// Production scopes the tab's spacing and row bleed under `.lmv-left-rail`, so the wrapper carries that class and the
// workbench CSS clears the rail's own chrome (border, thread, background). Only the data and the handlers differ: the
// placeholder library in layoutLabLyricTracksFixture.ts, with selection, loading, search, filtering, open / make active,
// rename, duplicate, New / Import version and Load More held in local state. Every record starts collapsed and plain; clicking one selects it and clicking it again collapses it. Deleting a track or a version and
// the AI Extract hand-off do nothing here (production confirms and deletes, or switches tab). Nothing is saved.

let nextDocumentNumber = 100

export function LayoutLabLyricTracksTab() {
  const [tracks, setTracks] = useState<LyricManagerTrack[]>(LTR_TRACKS)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  // Every record starts collapsed and plain: nothing selected, loaded or playing until clicked.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [documents, setDocuments] = useState(LTR_DOCUMENTS)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)

  const selectedDocuments = useMemo(() => (selectedId ? documents[selectedId] ?? [] : []), [documents, selectedId])
  const patchDocuments = (trackId: string, update: (docs: LyricDocumentVersion[]) => LyricDocumentVersion[]) =>
    setDocuments(current => ({ ...current, [trackId]: update(current[trackId] ?? []) }))
  const addDocument = (fields: Partial<LyricDocumentVersion> & Pick<LyricDocumentVersion, 'title' | 'sourceType'>) => {
    if (!selectedId) return
    const id = `lab-doc-${(nextDocumentNumber += 1)}`
    const now = new Date().toISOString()
    const created = { ...selectedDocuments[0]!, isActive: false, cueCount: 0, documentReviewStatus: null, createdAt: now, updatedAt: now, ...fields, id } as LyricDocumentVersion
    patchDocuments(selectedId, docs => [...docs, created])
    setOpenDocumentId(id)
  }

  return (
    <div className="lmv-left-rail ll-lyric-tracks">
      <div className="lmv-workspace-tab-panel" role="tabpanel" aria-label="Tracks panel">
        <LyricTrackBrowser
          tracks={tracks}
          selectedTrackId={selectedId}
          loadedAudioTrackId={loadedId}
          playingAudioTrackId={playingId}
          search={search}
          loading={false}
          error={null}
          hasMore={hasMore}
          onSearchChange={setSearch}
          // Clicking a record selects it (wash, cyan left bar, its versions open in the card); clicking it again collapses it.
          onSelectTrack={track => {
            if (selectedId === track.dbId) {
              setSelectedId(null)
              setOpenDocumentId(null)
              return
            }
            setSelectedId(track.dbId)
            setOpenDocumentId((documents[track.dbId] ?? []).find(item => item.isActive)?.id ?? null)
          }}
          // Production loads without playing; here Load on the loaded track also toggles Playing, so both badges can be reviewed.
          onLoadTrack={track => {
            if (loadedId === track.dbId) { setPlayingId(current => (current === track.dbId ? null : track.dbId)); return }
            setLoadedId(track.dbId)
            setPlayingId(null)
          }}
          onOpenActiveLyrics={track => { setSelectedId(track.dbId); setOpenDocumentId(track.activeLyricDocumentId) }}
          onOpenAiExtract={() => {}}
          onMakeOpenVersionActive={track => patchDocuments(track.dbId, docs => docs.map(item => ({ ...item, isActive: item.id === openDocumentId })))}
          canMakeOpenVersionActive={track => selectedId === track.dbId && !!openDocumentId
            && selectedDocuments.some(item => item.id === openDocumentId && !item.isActive)}
          onDeleteTrack={() => {}}
          onLoadMore={() => { setTracks(current => [...current, ...LTR_MORE_TRACKS]); setHasMore(false) }}
          onRetry={() => {}}
          versions={{
            documents: selectedDocuments,
            legacyDocuments: LTR_LEGACY_DOCUMENTS,
            loading: false,
            openDocumentId,
            onSelectDocument: item => setOpenDocumentId(item.id),
            onDuplicateDocument: item => addDocument({ ...item, title: `${item.title} (copy)`, isActive: false, documentReviewStatus: null }),
            onRenameDocument: (item, title) => selectedId && patchDocuments(selectedId, docs => docs.map(entry => entry.id === item.id ? { ...entry, title } : entry)),
            onActivateDocument: item => selectedId && patchDocuments(selectedId, docs => docs.map(entry => ({ ...entry, isActive: entry.id === item.id }))),
            onDeleteDocument: () => {},
            onNewDocument: () => addDocument({ title: 'Untitled lyric version', sourceType: 'manual', language: null }),
            onImportDocument: () => addDocument({ title: 'Imported lyric version', sourceType: 'json_import', cueCount: 12 }),
          }}
        />
      </div>
    </div>
  )
}

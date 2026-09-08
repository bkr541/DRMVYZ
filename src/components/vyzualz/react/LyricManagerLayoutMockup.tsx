import { useMemo, useState } from 'react'
import { AudioWave02Icon, SubtitleIcon } from 'hugeicons-react'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { RailTabs } from '../layout/RailTabs'
import { AudioTrackCard } from '../media/AudioTrackCard'
import { LyricDocumentSidebar } from '../../../features/lyrics/components/LyricDocumentSidebar'
import type { LyricDocumentVersion } from '../../../features/lyrics/lyricManagerTypes'
import { Collapsible } from './ReactControlRows'
import { DreamVizTextInput } from './controls/DreamVizTextInput'
import { IconChipButton } from './controls/IconChipButton'
import { IconMorphToggle } from './controls/IconMorphToggle'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import {
  createLyricManagerLayoutDocumentFixtures,
  createLyricManagerLayoutTrackFixtures,
} from './LyricManagerLayoutMockup.fixtures'

type TrackWorkspaceTab = 'tracks' | 'import' | 'ai-extract'

const TRACK_WORKSPACE_TABS: Array<{ id: TrackWorkspaceTab; label: string }> = [
  { id: 'tracks', label: 'Tracks' },
  { id: 'import', label: 'Import' },
  { id: 'ai-extract', label: 'AI Extract' },
]

function createFixtureVersion(trackId: string, index: number): LyricDocumentVersion {
  const now = new Date().toISOString()
  return {
    id: `mockup-${trackId}-${index}-${Date.now()}`,
    userId: 'lyric-layout-mockup-user',
    audioTrackId: trackId,
    visualSessionId: null,
    title: 'Untitled Version',
    artist: 'DVYDRM',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: false,
    metadata: { language: 'en', reviewStatus: 'unreviewed', mockupFixture: true },
    revision: 1,
    createdAt: now,
    updatedAt: now,
    cueCount: 0,
    language: 'en',
    documentReviewStatus: 'unreviewed',
  }
}

// ── LyricManagerLayoutMockup ───────────────────────────────────────────────
//
// A disconnected layout/interaction preview. Stage 1 intentionally populates
// only the left rail. All track/version data and mutations stay component-local;
// no production stores, persistence, transcription, or audio-engine actions are
// mounted here.

export function LyricManagerLayoutMockup() {
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [workspaceTab, setWorkspaceTab] = useState<TrackWorkspaceTab>('tracks')
  const [trackSearch, setTrackSearch] = useState('')
  const [tracks] = useState(createLyricManagerLayoutTrackFixtures)
  const [documentsByTrackId, setDocumentsByTrackId] = useState(createLyricManagerLayoutDocumentFixtures)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)

  const selectedTrack = tracks.find(track => track.dbId === selectedTrackId) ?? null
  const selectedDocuments = selectedTrackId ? documentsByTrackId[selectedTrackId] ?? [] : []
  const filteredTracks = useMemo(() => {
    const query = trackSearch.trim().toLocaleLowerCase()
    if (!query) return tracks
    return tracks.filter(track => (
      `${track.title} ${track.artist ?? ''} ${track.fileName} ${track.genre ?? ''} ${track.musicalKey ?? ''}`
        .toLocaleLowerCase()
        .includes(query)
    ))
  }, [trackSearch, tracks])

  const selectTrack = (trackId: string) => {
    const documents = documentsByTrackId[trackId] ?? []
    setSelectedTrackId(trackId)
    setOpenDocumentId(documents.find(document => document.isActive)?.id ?? documents[0]?.id ?? null)
  }

  const updateDocuments = (
    trackId: string,
    updater: (documents: LyricDocumentVersion[]) => LyricDocumentVersion[],
  ) => {
    setDocumentsByTrackId(current => ({
      ...current,
      [trackId]: updater(current[trackId] ?? []),
    }))
  }

  const handleNewDocument = () => {
    if (!selectedTrackId) return
    const nextDocument = createFixtureVersion(selectedTrackId, selectedDocuments.length + 1)
    updateDocuments(selectedTrackId, documents => [...documents, nextDocument])
    setOpenDocumentId(nextDocument.id)
  }

  const handleDuplicateDocument = (document: LyricDocumentVersion) => {
    if (!selectedTrackId) return
    const duplicate: LyricDocumentVersion = {
      ...document,
      id: `mockup-${document.id}-copy-${Date.now()}`,
      title: `${document.title} Copy`,
      isActive: false,
      metadata: { ...document.metadata, duplicatedFrom: document.id, mockupFixture: true },
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    updateDocuments(selectedTrackId, documents => [...documents, duplicate])
    setOpenDocumentId(duplicate.id)
  }

  const handleRenameDocument = (document: LyricDocumentVersion, title: string) => {
    if (!selectedTrackId) return
    updateDocuments(selectedTrackId, documents => documents.map(candidate => (
      candidate.id === document.id
        ? { ...candidate, title, updatedAt: new Date().toISOString() }
        : candidate
    )))
  }

  const handleActivateDocument = (document: LyricDocumentVersion) => {
    if (!selectedTrackId) return
    updateDocuments(selectedTrackId, documents => documents.map(candidate => ({
      ...candidate,
      isActive: candidate.id === document.id,
      updatedAt: candidate.id === document.id ? new Date().toISOString() : candidate.updatedAt,
    })))
  }

  const handleDeleteDocument = (document: LyricDocumentVersion) => {
    if (!selectedTrackId) return
    const remaining = selectedDocuments.filter(candidate => candidate.id !== document.id)
    updateDocuments(selectedTrackId, () => remaining)
    if (openDocumentId === document.id) {
      setOpenDocumentId(remaining.find(candidate => candidate.isActive)?.id ?? remaining[0]?.id ?? null)
    }
  }

  return (
    <main className="mmv-root" aria-label="Lyric Manager layout mockup">
      <header className="lmv-header">
        <div className="lmv-header-left">
          <div className="lmv-header-title-group">
            <span className="lmv-header-title">LYRIC MANAGER</span>
            <span className="lmv-header-subtitle">
              Select or upload a track, then manage its lyric versions
            </span>
          </div>
        </div>

        <div className="lmv-header-right">
          <label className="lmv-toggle-row" title="Show or hide active lyrics in the visualizer">
            <span className="lmv-toggle-label">Show Lyrics</span>
            <IconMorphToggle
              checked={false}
              onCheckedChange={() => {}}
              className="lmv-toggle-track"
              aria-label="Show Lyrics"
            />
          </label>

          <IconChipButton onClick={() => {}} disabled title="Save lyric document">
            Save
          </IconChipButton>

          <IconChipButton
            tone="primary"
            onClick={() => {}}
            disabled
            title="Save this version and make it the active runtime version"
          >
            Save + Make Active
          </IconChipButton>

          <VyzualzHeaderActions />
        </div>
      </header>

      <section className="mmv-workspace" aria-label="Lyric Manager layout workspace">
        <div
          className="vz-content mmv-content"
          data-left-collapsed={leftCollapsed ? 'true' : 'false'}
          data-right-collapsed={rightCollapsed ? 'true' : 'false'}
        >
          <WorkspaceRail
            side="left"
            label="Lyric Manager layout — left rail"
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed(value => !value)}
            className="lmv-mockup-left-rail"
          >
            <div
              className="lmv-mockup-left-shell"
              data-has-selected-track={selectedTrack ? 'true' : 'false'}
            >
              <section className="lmv-mockup-track-workspace" aria-label="Track Workspace">
                <div className="lmv-mockup-rail-title">
                  <AudioWave02Icon size={15} color="currentColor" aria-hidden="true" />
                  <span>Track Workspace</span>
                </div>

                <RailTabs
                  tabs={TRACK_WORKSPACE_TABS}
                  activeTab={workspaceTab}
                  onChange={setWorkspaceTab}
                  ariaLabel="Track Workspace"
                  className="lmv-mockup-workspace-tabs"
                  variant="underline"
                />

                <div
                  className="lmv-mockup-track-panel"
                  role="tabpanel"
                  aria-label={`${TRACK_WORKSPACE_TABS.find(tab => tab.id === workspaceTab)?.label ?? 'Tracks'} workspace`}
                >
                  {workspaceTab === 'tracks' && (
                    <Collapsible label="Track Library" defaultOpen bodyClassName="lmv-mockup-track-library-body">
                      <DreamVizTextInput
                        className="lmv-input lmv-mockup-track-search"
                        type="search"
                        value={trackSearch}
                        onChange={event => setTrackSearch(event.target.value)}
                        placeholder="Search title, artist, genre…"
                        aria-label="Search fixture tracks"
                      />

                      <div className="vz-track-list lmv-mockup-track-list">
                        {filteredTracks.map(track => (
                          <AudioTrackCard
                            key={track.id}
                            track={track}
                            onLoad={() => {}}
                            loading={false}
                            loaded={false}
                            playing={false}
                            canLoad={false}
                            canOpenLyrics={false}
                            canRemove={false}
                            isActive={track.dbId === selectedTrackId}
                            onSelect={() => selectTrack(track.dbId)}
                          />
                        ))}
                        {filteredTracks.length === 0 && (
                          <div className="lmv-mockup-empty-state">No fixture tracks match this search.</div>
                        )}
                      </div>
                    </Collapsible>
                  )}
                  {workspaceTab !== 'tracks' && <div className="lmv-mockup-empty-tab" />}
                </div>
              </section>

              {selectedTrack && (
                <section className="lmv-mockup-lyric-management" aria-label="Lyric Management">
                  <div className="lmv-mockup-rail-title">
                    <SubtitleIcon size={15} color="currentColor" aria-hidden="true" />
                    <span>Lyric Management</span>
                  </div>

                  <LyricDocumentSidebar
                    documents={selectedDocuments}
                    loading={false}
                    openDocumentId={openDocumentId}
                    hasSelectedTrack
                    actionsVisibleForOpenDocumentOnly
                    onSelectDocument={document => setOpenDocumentId(document.id)}
                    onNewDocument={handleNewDocument}
                    onDuplicateDocument={handleDuplicateDocument}
                    onRenameDocument={handleRenameDocument}
                    onActivateDocument={handleActivateDocument}
                    onDeleteDocument={handleDeleteDocument}
                    onImportDocument={() => setWorkspaceTab('import')}
                  />
                </section>
              )}
            </div>
          </WorkspaceRail>

          <div className="mmv-stage-area" aria-label="Lyric Manager layout — visualizer" />

          <WorkspaceRail
            side="right"
            label="Lyric Manager layout — right rail"
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed(value => !value)}
          >
            {null}
          </WorkspaceRail>
        </div>
      </section>
    </main>
  )
}

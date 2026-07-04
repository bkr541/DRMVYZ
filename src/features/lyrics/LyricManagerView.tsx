import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useLyricsStore } from '../../stores/lyricsStore'
import {
  deleteLyricDocument,
  getFullLyricDocument,
  updateLyricDocument,
} from '../../lib/lyricsDb'
import { deleteAudioTrack, deleteAudioFiles } from '../../lib/audioDb'
import { useAudioStore } from '../../stores/audioStore'
import type { SavedAudioTrack } from '../../stores/audioStore'
import { useSharedAudio } from '../../context/AudioEngineContext'
import type { LyricSectionType } from '../../types/lyrics'
import type { LyricDocumentImportResult } from './utils/lyricDocumentImport'
import type {
  LyricDocumentVersion,
  LyricManagerTrack,
} from './lyricManagerTypes'
import {
  getLegacyLyricDocumentVersions,
  getLyricDocumentVersionsForTracks,
  loadLyricManagerTrackPage,
} from './services/lyricManagerData'
import { LyricManagerHeader } from './components/LyricManagerHeader'
import { LyricTrackBrowser } from './components/LyricTrackBrowser'
import { LyricDocumentSidebar } from './components/LyricDocumentSidebar'
import { ManualLyricEditor } from './components/ManualLyricEditor'
import { JsonLyricImporter } from './components/JsonLyricImporter'
import { AiLyricExtractor } from './components/AiLyricExtractor'
import { LyricPreviewPanel } from './components/LyricPreviewPanel'
import { UnsavedLyricChangesDialog } from './components/UnsavedLyricChangesDialog'
import { ConfirmLyricDeleteDialog } from './components/ConfirmLyricDeleteDialog'
import { ConfirmTrackDeleteDialog } from './components/ConfirmTrackDeleteDialog'
import { MediaUploadModal } from '../../components/vyzualz/MediaUploadModal'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'

type WorkflowTab = 'manual' | 'json' | 'ai'

interface Props {
  onBack: () => void
}

const PAGE_SIZE = 18

const TAB_LABELS: { id: WorkflowTab; label: string }[] = [
  { id: 'manual', label: 'Timeline' },
  { id: 'json', label: 'Import' },
  { id: 'ai', label: 'AI Extract' },
]

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatMsClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '0:00.00'
  const safe = Math.max(0, Math.round(ms))
  const mins = Math.floor(safe / 60_000)
  const secs = Math.floor((safe % 60_000) / 1_000)
  const hundredths = Math.floor((safe % 1_000) / 10)
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`
}

function formatUpdatedDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString()
}

function trackInitials(track: LyricManagerTrack | null): string {
  if (!track) return '♪'
  const source = `${track.title || track.fileName || ''} ${track.artist || ''}`.trim()
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || '♪'
}

function toLyricSectionType(type: string): LyricSectionType {
  if (type === 'preDrop') return 'build'
  if (
    type === 'intro' || type === 'verse' || type === 'build' ||
    type === 'drop' || type === 'breakdown' || type === 'bridge' || type === 'outro'
  ) return type
  return 'unknown'
}

function uploadedTrackToManager(track: SavedAudioTrack): LyricManagerTrack {
  return {
    ...track,
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  }
}

function mergeTracks(
  current: LyricManagerTrack[],
  incoming: LyricManagerTrack[],
): LyricManagerTrack[] {
  const merged = new Map(current.map((track) => [track.dbId, track]))
  for (const track of incoming) merged.set(track.dbId, track)
  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

function SelectedTrackHero({
  track,
  activeDocumentTitle,
  selectedTrackLoaded,
  selectedTrackPlaying,
  loading,
  onLoadTrack,
  onTogglePlayback,
}: {
  track: LyricManagerTrack | null
  activeDocumentTitle: string | null
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  loading: boolean
  onLoadTrack: () => void
  onTogglePlayback: () => void
}) {
  if (!track) {
    return (
      <section className="lmv-track-hero lmv-track-hero--empty" aria-label="Selected track">
        <div className="lmv-track-art lmv-track-art--empty">♪</div>
        <div className="lmv-track-hero-main">
          <span className="lmv-kicker">No track selected</span>
          <h2>Select a track from the library</h2>
          <p>Pick a stored audio track to inspect lyric versions, edit timed cues, and preview the document in the visualizer.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="lmv-track-hero" aria-label="Selected track">
      <div className="lmv-track-art" aria-hidden="true">
        <span>{trackInitials(track)}</span>
      </div>

      <div className="lmv-track-hero-main">
        <div className="lmv-track-title-row">
          <h2>{track.title || track.fileName}</h2>
          <span className="lmv-favorite-star" aria-hidden="true">☆</span>
          {selectedTrackPlaying && <span className="lmv-playing-badge">Playing</span>}
          {!selectedTrackPlaying && selectedTrackLoaded && <span className="lmv-loaded-badge">Loaded</span>}
        </div>
        <p>{track.artist || 'Unknown artist'}</p>
        {activeDocumentTitle && (
          <span className="lmv-active-version-pill">Active version: {activeDocumentTitle}</span>
        )}
      </div>

      <div className="lmv-track-hero-stats" aria-label="Track details">
        <div className="lmv-track-stat"><strong>{formatDuration(track.durationSec)}</strong><span>Duration</span></div>
        <div className="lmv-track-stat"><strong>{track.bpm ? `${Math.round(track.bpm)} BPM` : '—'}</strong><span>Tempo</span></div>
        <div className="lmv-track-stat"><strong>{track.musicalKey || '—'}</strong><span>Key</span></div>
        <div className="lmv-track-stat"><strong>{formatUpdatedDate(track.createdAt)}</strong><span>Updated</span></div>
      </div>

      <div className="lmv-track-hero-actions">
        <button
          className="lmv-btn lmv-btn--ghost"
          onClick={onLoadTrack}
          disabled={loading}
        >
          {loading ? 'Loading…' : selectedTrackLoaded ? 'Reload deck' : 'Load deck'}
        </button>
        <button
          className="lmv-btn lmv-btn--primary"
          onClick={onTogglePlayback}
          disabled={!selectedTrackLoaded}
        >
          {selectedTrackPlaying ? 'Pause' : 'Preview'}
        </button>
      </div>
    </section>
  )
}

function ExtractionConsoleSummary({
  selectedTrack,
  documentCount,
  cueCount,
  documentsLoading,
  activeTab,
}: {
  selectedTrack: LyricManagerTrack | null
  documentCount: number
  cueCount: number
  documentsLoading: boolean
  activeTab: WorkflowTab
}) {
  const steps = [
    { label: selectedTrack ? 'Track selected' : 'Select a track', done: !!selectedTrack },
    { label: documentsLoading ? 'Loading lyric versions' : documentCount > 0 ? 'Lyric versions loaded' : 'Create or import lyrics', done: documentCount > 0 },
    { label: cueCount > 0 ? 'Timed cues available' : 'Add timed cues', done: cueCount > 0 },
    { label: activeTab === 'ai' ? 'Groq extraction console open' : 'Review and save changes', done: cueCount > 0 },
  ]

  const [open, setOpen] = useState(true)
  const bodyId = 'lmv-extraction-console-panel'

  return (
    <section className={`lmv-panel-card lmv-right-section lmv-extraction-console${open ? ' lmv-right-section--open' : ' lmv-right-section--closed'}`} aria-label="Lyric workflow console">
      <button
        type="button"
        className="lmv-right-section-header"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="lmv-right-section-title">Extraction Console</span>
        <span className="lmv-right-section-arrow" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={bodyId} className="lmv-right-section-body">
          <div className="lmv-console-steps">
            {steps.map((step, index) => (
              <div className="lmv-console-step" key={step.label}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <em className={step.done ? 'lmv-console-ok' : 'lmv-console-pending'}>{step.done ? '✓' : '○'}</em>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function LyricTransportBar({
  selectedTrack,
  selectedTrackLoaded,
  selectedTrackPlaying,
  currentTimeMs,
  durationMs,
  volume,
  bpm,
  musicalKey,
  onTogglePlayback,
  onVolumeChange,
}: {
  selectedTrack: LyricManagerTrack | null
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  currentTimeMs: number | null
  durationMs: number
  volume: number
  bpm: number | null
  musicalKey: string | null
  onTogglePlayback: () => void
  onVolumeChange: (volume: number) => void
}) {
  const safeDuration = Math.max(0, durationMs)
  const safeCurrent = Math.min(safeDuration, Math.max(0, currentTimeMs ?? 0))

  return (
    <footer className="lmv-transport-bar" aria-label="Lyric preview transport">
      <div className="lmv-transport-left">
        <button className="lmv-transport-chip" type="button">↻ Loop</button>
        <button className="lmv-transport-chip" type="button">⌕ Snap</button>
        <button className="lmv-transport-chip" type="button">⇄ Compare: Off</button>
      </div>

      <div className="lmv-transport-center">
        <button className="lmv-transport-icon" type="button" disabled>⏮</button>
        <button className="lmv-transport-icon" type="button" disabled={!selectedTrackLoaded} onClick={onTogglePlayback}>
          {selectedTrackPlaying ? 'Ⅱ' : '▶'}
        </button>
        <button className="lmv-transport-icon" type="button" disabled>⏭</button>
        <div className="lmv-transport-time">
          <strong>{formatMsClock(safeCurrent)}</strong>
          <span>/ {selectedTrack ? formatDuration((safeDuration || (selectedTrack.durationSec ?? 0) * 1000) / 1000) : '0:00'}</span>
        </div>
      </div>

      <div className="lmv-transport-right">
        <label className="lmv-volume-control">
          <span>♬</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={Number.isFinite(volume) ? volume : 0.8}
            onChange={event => onVolumeChange(Number(event.target.value))}
            aria-label="Preview volume"
          />
        </label>
        <div className="lmv-mini-select"><span>BPM</span><strong>{bpm ? Math.round(bpm) : '—'}</strong></div>
        <div className="lmv-mini-select"><span>Key</span><strong>{musicalKey || '—'}</strong></div>
      </div>
    </footer>
  )
}

export function LyricManagerView({ onBack }: Props) {
  const {
    lyricsEnabled,
    setLyricsEnabled,
    activeDocument,
    activeDocumentId,
    cues: storeCues,
    setCues,
    selectedCueId,
    selectCue,
    isLoading,
    isSaving,
    error,
    setError,
    draftTitle,
    draftArtist,
    globalOffsetMs,
    setDraftTitle,
    setDraftArtist,
    setGlobalOffsetMs,
    updateDraftDefaultStyle,
    updateDraftDefaultAnimation,
    updateDraftDefaultEffects,
    saveActiveLyricDocument,
    setActiveDocument,
    loadLyricDocument,
    setDraftSourceMeta,
    activateLyricDocument,
    beginEditorSession,
    endEditorSession,
    editorDirty,
    markEditorDirty,
    preserveDraftForNextEditorExit,
  } = useLyricsStore()

  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine
  const getSignedUrl = useAudioStore((state) => state.getSignedUrl)

  const [currentAudioTimeMs, setCurrentAudioTimeMs] = useState<number | null>(null)
  const [tracks, setTracks] = useState<LyricManagerTrack[]>([])
  const [trackTotal, setTrackTotal] = useState(0)
  const [trackSearch, setTrackSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [tracksLoading, setTracksLoading] = useState(false)
  const [tracksError, setTracksError] = useState<string | null>(null)
  const [selectedTrack, setSelectedTrack] = useState<LyricManagerTrack | null>(
    null,
  )
  const [documents, setDocuments] = useState<LyricDocumentVersion[]>([])
  const [legacyDocuments, setLegacyDocuments] = useState<
    LyricDocumentVersion[]
  >([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<WorkflowTab>('manual')
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [pendingTransition, setPendingTransition] = useState<{
    message: string
    action: () => void | Promise<void>
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LyricDocumentVersion | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [trackDeleteTarget, setTrackDeleteTarget] = useState<LyricManagerTrack | null>(null)
  const [trackDeleting, setTrackDeleting] = useState(false)
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false)
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false)
  const loadGeneration = useRef(0)

  useEffect(() => {
    beginEditorSession()
    return () => endEditorSession()
  }, [beginEditorSession, endEditorSession])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!useLyricsStore.getState().editorDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const currentEngine = engineRef.current
      setCurrentAudioTimeMs(
        currentEngine.duration > 0
          ? Math.round(currentEngine.currentTime * 1000)
          : null,
      )
    }, 200)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(trackSearch.trim()), 250)
    return () => clearTimeout(id)
  }, [trackSearch])

  const showStatus = useCallback((message: string) => {
    setStatusMsg(message)
    window.setTimeout(() => setStatusMsg(null), 3000)
  }, [])

  const prepareTrackDraft = useCallback(
    (
      track: LyricManagerTrack,
      dirty = false,
      activateOnSave = track.activeLyricDocumentId === null,
    ) => {
      setActiveDocument(null, [], track.dbId)
      useLyricsStore.setState({
        draftTitle: track.title,
        draftArtist: track.artist ?? '',
        draftSourceType: null,
        draftSourceFormat: null,
        draftRawSourceText: null,
        draftMetadata: null,
        editorDirty: dirty,
        draftActivateOnSave: activateOnSave,
      })
      selectCue(null)
    },
    [selectCue, setActiveDocument],
  )

  const loadTracks = useCallback(
    async (reset: boolean) => {
      if (!supabaseConfigured) {
        setTracksError('Supabase is not configured.')
        return
      }
      const generation = ++loadGeneration.current
      setTracksLoading(true)
      setTracksError(null)
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) throw new Error('Sign in to view stored audio tracks.')
        const offset = reset ? 0 : tracks.length
        const page = await loadLyricManagerTrackPage(data.user.id, {
          offset,
          limit: PAGE_SIZE,
          search: debouncedSearch,
        })
        if (generation !== loadGeneration.current) return
        setTrackTotal(page.total)
        setTracks((current) =>
          reset ? page.tracks : mergeTracks(current, page.tracks),
        )
      } catch (loadError) {
        if (generation !== loadGeneration.current) return
        setTracksError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load stored tracks.',
        )
      } finally {
        if (generation === loadGeneration.current) setTracksLoading(false)
      }
    },
    [debouncedSearch, tracks.length],
  )

  useEffect(() => {
    void loadTracks(true)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      try {
        setLegacyDocuments(await getLegacyLyricDocumentVersions(data.user.id))
      } catch {
        // Legacy documents are supplementary; track-first loading should still work.
      }
    })
  }, [])

  const refreshDocuments = useCallback(
    async (track: LyricManagerTrack, selectPreferred = false) => {
      setDocumentsLoading(true)
      try {
        const nextDocuments = await getLyricDocumentVersionsForTracks([
          track.dbId,
        ])
        setDocuments(nextDocuments)
        setTracks((current) =>
          current.map((item) => {
            if (item.dbId !== track.dbId) return item
            const active =
              nextDocuments.find((document) => document.isActive) ?? null
            return {
              ...item,
              lyricVersionCount: nextDocuments.length,
              activeLyricDocumentId: active?.id ?? null,
              activeLyricDocumentName: active?.title ?? null,
            }
          }),
        )

        if (selectPreferred) {
          const preferred =
            nextDocuments.find((document) => document.isActive) ??
            nextDocuments[0]
          if (preferred) await loadLyricDocument(preferred.id)
          else prepareTrackDraft(track, false)
        }
        return nextDocuments
      } catch (documentError) {
        setError(
          documentError instanceof Error
            ? documentError.message
            : 'Failed to load lyric versions.',
        )
        return []
      } finally {
        setDocumentsLoading(false)
      }
    },
    [loadLyricDocument, prepareTrackDraft, setError],
  )

  const requestTransition = useCallback(
    (message: string, action: () => void | Promise<void>) => {
      if (!useLyricsStore.getState().editorDirty) {
        void action()
        return
      }
      setPendingTransition({ message, action })
    },
    [],
  )

  const doSave = useCallback(async (): Promise<boolean> => {
    setError(null)
    const result = await saveActiveLyricDocument(storeCues)
    if (!result?.ok) return false
    markEditorDirty(false)
    showStatus('Saved')
    if (selectedTrack) await refreshDocuments(selectedTrack)
    return true
  }, [
    storeCues,
    markEditorDirty,
    refreshDocuments,
    saveActiveLyricDocument,
    selectedTrack,
    setError,
    showStatus,
  ])

  const handleSelectTrack = useCallback(
    (track: LyricManagerTrack) => {
      if (selectedTrack?.dbId === track.dbId) return
      requestTransition(
        `Save changes before selecting “${track.title}”?`,
        async () => {
          markEditorDirty(false)
          setSelectedTrack(track)
          prepareTrackDraft(track, false)
          setActiveTab('manual')
          await refreshDocuments(track, true)
        },
      )
    },
    [
      markEditorDirty,
      prepareTrackDraft,
      refreshDocuments,
      requestTransition,
      selectedTrack?.dbId,
    ],
  )

  const handleSelectDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (document.id === activeDocumentId) return
      requestTransition(
        `Save changes before opening “${document.title}”?`,
        async () => {
          markEditorDirty(false)
          if (!document.audioTrackId) {
            setSelectedTrack(null)
            setDocuments([])
          }
          await loadLyricDocument(document.id)
          setActiveTab('manual')
        },
      )
    },
    [activeDocumentId, loadLyricDocument, markEditorDirty, requestTransition],
  )

  const handleNewDocument = useCallback(() => {
    if (!selectedTrack) return
    requestTransition(
      'Save changes before creating a blank lyric version?',
      () => {
        prepareTrackDraft(
          selectedTrack,
          true,
          !documents.some((document) => document.isActive),
        )
        setActiveTab('manual')
        showStatus('Blank lyric version ready to edit')
      },
    )
  }, [
    documents,
    prepareTrackDraft,
    requestTransition,
    selectedTrack,
    showStatus,
  ])

  const handleImportDocument = useCallback(() => {
    if (!selectedTrack) return
    requestTransition(
      'Save changes before importing a new lyric version?',
      () => {
        prepareTrackDraft(
          selectedTrack,
          true,
          !documents.some((document) => document.isActive),
        )
        setActiveTab('json')
      },
    )
  }, [documents, prepareTrackDraft, requestTransition, selectedTrack])

  const handleDuplicateDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (!selectedTrack) return
      requestTransition(
        `Save changes before duplicating “${document.title}”?`,
        async () => {
          const full = await getFullLyricDocument(document.id)
          setActiveDocument(null, full.cues, selectedTrack.dbId)
          useLyricsStore.setState({
            draftTitle: `${document.title} Copy`,
            draftArtist: document.artist,
            draftDefaultStyle: document.defaultStyle,
            draftDefaultAnimation: document.defaultAnimation,
            draftDefaultEffects: document.defaultEffects,
            globalOffsetMs: document.globalOffsetMs,
            draftSourceType: document.sourceType,
            draftSourceFormat: document.sourceFormat,
            draftRawSourceText: document.rawSourceText ?? null,
            draftMetadata: {
              ...document.metadata,
              duplicatedFrom: document.id,
            },
            editorDirty: true,
            draftActivateOnSave: false,
          })
          setActiveTab('manual')
          showStatus('Duplicated as a new draft')
        },
      )
    },
    [requestTransition, selectedTrack, setActiveDocument, showStatus],
  )

  const handleRenameDocument = useCallback(
    async (document: LyricDocumentVersion, title: string) => {
      if (document.id === activeDocumentId && editorDirty) {
        setDraftTitle(title)
        showStatus('Rename staged with unsaved changes')
        return
      }
      try {
        const updated = await updateLyricDocument(document.id, { title })
        if (document.id === activeDocumentId)
          setActiveDocument(updated, storeCues)
        if (selectedTrack) await refreshDocuments(selectedTrack)
        else {
          const { data } = await supabase.auth.getUser()
          if (data.user)
            setLegacyDocuments(
              await getLegacyLyricDocumentVersions(data.user.id),
            )
        }
        showStatus('Version renamed')
      } catch (renameError) {
        setError(
          renameError instanceof Error
            ? renameError.message
            : 'Failed to rename lyric version.',
        )
      }
    },
    [
      activeDocumentId,
      editorDirty,
      storeCues,
      refreshDocuments,
      selectedTrack,
      setActiveDocument,
      setDraftTitle,
      setError,
      showStatus,
    ],
  )

  const handleActivateDocument = useCallback(
    (document: LyricDocumentVersion) => {
      requestTransition(
        `Save changes before activating “${document.title}”?`,
        async () => {
          const result = await activateLyricDocument(document.id)
          if (!result?.ok) return
          if (selectedTrack) await refreshDocuments(selectedTrack)
          showStatus('Active lyric version updated')
        },
      )
    },
    [
      activateLyricDocument,
      refreshDocuments,
      requestTransition,
      selectedTrack,
      showStatus,
    ],
  )

  const handleRequestDelete = useCallback(
    (document: LyricDocumentVersion) => {
      const openConfirmation = () => setDeleteTarget(document)
      if (document.id === activeDocumentId) {
        requestTransition(
          `Save changes before deleting “${document.title}”?`,
          openConfirmation,
        )
      } else {
        openConfirmation()
      }
    },
    [activeDocumentId, requestTransition],
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const deletingCurrent = deleteTarget.id === activeDocumentId
      await deleteLyricDocument(deleteTarget.id)
      setDeleteTarget(null)
      markEditorDirty(false)
      if (selectedTrack) {
        const remaining = await refreshDocuments(selectedTrack)
        if (deletingCurrent) {
          const preferred =
            remaining.find((document) => document.isActive) ?? remaining[0]
          if (preferred) await loadLyricDocument(preferred.id)
          else prepareTrackDraft(selectedTrack, false)
        }
      } else {
        const { data } = await supabase.auth.getUser()
        if (data.user)
          setLegacyDocuments(await getLegacyLyricDocumentVersions(data.user.id))
        if (deletingCurrent) setActiveDocument(null, [])
      }
      showStatus('Lyric version deleted')
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete lyric version.',
      )
    } finally {
      setDeleting(false)
    }
  }, [
    activeDocumentId,
    deleteTarget,
    loadLyricDocument,
    markEditorDirty,
    prepareTrackDraft,
    refreshDocuments,
    selectedTrack,
    setActiveDocument,
    setError,
    showStatus,
  ])

  const handleRequestDeleteTrack = useCallback(
    (track: LyricManagerTrack) => {
      const openConfirmation = () => setTrackDeleteTarget(track)
      if (track.dbId === selectedTrack?.dbId && editorDirty) {
        requestTransition(
          `Save changes before deleting "${track.title}"?`,
          openConfirmation,
        )
      } else {
        openConfirmation()
      }
    },
    [editorDirty, requestTransition, selectedTrack?.dbId],
  )

  const handleConfirmDeleteTrack = useCallback(async () => {
    if (!trackDeleteTarget) return
    setTrackDeleting(true)
    try {
      const wasSelected = trackDeleteTarget.dbId === selectedTrack?.dbId
      const { error: dbError } = await deleteAudioTrack(trackDeleteTarget.dbId)
      if (dbError) {
        setError(`Track deletion failed: ${dbError}`)
        return
      }
      setTrackDeleteTarget(null)
      markEditorDirty(false)
      setTracks(current => current.filter(item => item.dbId !== trackDeleteTarget.dbId))
      setTrackTotal(current => Math.max(0, current - 1))
      if (wasSelected) {
        setSelectedTrack(null)
        setDocuments([])
        setActiveDocument(null, [])
      }
      if (trackDeleteTarget.storagePath) {
        const { error: storageError } = await deleteAudioFiles([trackDeleteTarget.storagePath])
        if (storageError) {
          showStatus('Track deleted, but audio file cleanup failed.')
          return
        }
      }
      showStatus('Track and all lyric versions deleted')
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete track.',
      )
    } finally {
      setTrackDeleting(false)
    }
  }, [
    markEditorDirty,
    selectedTrack?.dbId,
    setActiveDocument,
    setError,
    showStatus,
    trackDeleteTarget,
  ])

  const handleOpenCompletedDraft = useCallback(
    (documentId: string) => {
      requestTransition(
        'Save changes before opening the extracted lyric draft?',
        async () => {
          markEditorDirty(false)
          await loadLyricDocument(documentId)
          if (selectedTrack) await refreshDocuments(selectedTrack)
          setActiveTab('manual')
          showStatus('Extracted draft opened for review')
        },
      )
    },
    [loadLyricDocument, markEditorDirty, refreshDocuments, requestTransition, selectedTrack, showStatus],
  )

  const handleActivateCompletedDraft = useCallback(
    (documentId: string) => {
      requestTransition(
        'Save changes before activating the extracted lyric version?',
        async () => {
          const result = await activateLyricDocument(documentId)
          if (!result?.ok) return
          if (selectedTrack) await refreshDocuments(selectedTrack)
          await loadLyricDocument(documentId)
          setActiveTab('manual')
          showStatus('Extracted lyric version activated')
        },
      )
    },
    [activateLyricDocument, loadLyricDocument, refreshDocuments, requestTransition, selectedTrack, showStatus],
  )

  const applyDraftCues = useCallback((next: typeof storeCues) => setCues(next), [setCues])

  const handleImportToDraft = useCallback(
    (result: LyricDocumentImportResult) => {
      if (result.errors.length > 0) return
      applyDraftCues(result.cues)
      const patch = result.documentPatch
      if (patch.title) setDraftTitle(patch.title)
      if (patch.artist) setDraftArtist(patch.artist)
      if (patch.globalOffsetMs !== undefined)
        setGlobalOffsetMs(patch.globalOffsetMs)
      if (patch.defaultStyle) updateDraftDefaultStyle(patch.defaultStyle)
      if (patch.defaultAnimation)
        updateDraftDefaultAnimation(patch.defaultAnimation)
      if (patch.defaultEffects) updateDraftDefaultEffects(patch.defaultEffects)
      setDraftSourceMeta({
        sourceType: patch.sourceType ?? null,
        sourceFormat: patch.sourceFormat ?? null,
        rawSourceText: patch.rawSourceText ?? null,
        metadata: patch.metadata ?? null,
      })
      showStatus(`Imported ${result.cues.length} cues as a new draft`)
      setActiveTab('manual')
    },
    [
      applyDraftCues,
      setDraftArtist,
      setDraftSourceMeta,
      setDraftTitle,
      setGlobalOffsetMs,
      showStatus,
      updateDraftDefaultAnimation,
      updateDraftDefaultEffects,
      updateDraftDefaultStyle,
    ],
  )

  const handleLoadSelectedTrack = useCallback(async () => {
    if (!selectedTrack?.storagePath) return
    setLoadingTrackId(selectedTrack.dbId)
    try {
      const url = await getSignedUrl(selectedTrack.storagePath)
      if (!url)
        throw new Error('Unable to create a signed preview URL for this track.')
      const trackEntry = {
        name: selectedTrack.fileName || selectedTrack.title,
        title: selectedTrack.title,
        artist: selectedTrack.artist,
        url,
        dbId: selectedTrack.dbId,
        storagePath: selectedTrack.storagePath,
        duration: selectedTrack.durationSec,
        persistedMetadata: {
          bpm: selectedTrack.bpm,
          musicalKey: selectedTrack.musicalKey,
          genre: selectedTrack.genre,
          sampleRate: selectedTrack.sampleRate,
          channels: selectedTrack.channels,
        },
      }
      if (engine.tracks.length > 0) engine.replaceTrackUrls([trackEntry])
      else engine.addTrackUrls([trackEntry])
      if (engine.source !== 'file') engine.setSource('file')
      showStatus('Track loaded to the audio deck without starting playback')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load track preview.',
      )
    } finally {
      setLoadingTrackId(null)
    }
  }, [engine, getSignedUrl, selectedTrack, setError, showStatus])

  const handleTogglePlayback = useCallback(() => {
    if (!selectedTrack || engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus('Load the selected track to the deck before previewing it.')
      return
    }
    if (engine.isPlaying) engine.pause()
    else engine.play()
  }, [engine, selectedTrack, showStatus])

  const handlePreviewInVisualizer = useCallback(() => {
    const timedCues = storeCues.filter((cue) => cue.endMs > cue.startMs)
    if (timedCues.length === 0) {
      showStatus('Timed cues are required before previewing in the visualizer.')
      return
    }
    if (editorDirty) {
      showStatus(
        'Save or discard unsaved changes before opening the visualizer preview.',
      )
      return
    }
    if (selectedTrack && engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus(
        'Load the selected track to the deck before opening the visualizer preview.',
      )
      return
    }
    preserveDraftForNextEditorExit()
    setLyricsEnabled(true)
    onBack()
  }, [
    editorDirty,
    storeCues,
    engine.currentAudioTrackId,
    onBack,
    preserveDraftForNextEditorExit,
    selectedTrack,
    setLyricsEnabled,
    showStatus,
  ])

  const handleUploaded = useCallback(
    (uploaded: SavedAudioTrack[]) => {
      const newest = uploaded[0]
      if (!newest) return
      const managerTrack = uploadedTrackToManager(newest)
      setTracks((current) =>
        mergeTracks(current, uploaded.map(uploadedTrackToManager)),
      )
      setTrackTotal((current) => current + uploaded.length)
      requestTransition(
        `Save changes before selecting the newly uploaded track “${managerTrack.title}”?`,
        () => {
          setSelectedTrack(managerTrack)
          setDocuments([])
          prepareTrackDraft(managerTrack, false, true)
          setActiveTab('ai')
          showStatus('Track uploaded. Automatic lyric extraction is ready.')
        },
      )
    },
    [prepareTrackDraft, requestTransition, showStatus],
  )

  const selectedTrackLoaded = selectedTrack?.dbId === engine.currentAudioTrackId
  const selectedTrackPlaying = selectedTrackLoaded && engine.isPlaying
  const selectedCue = storeCues.find((cue) => cue.id === selectedCueId) ?? null
  const runtimeTrackId = selectedTrackLoaded ? engine.currentTrackId : null
  const runtimeTrackUrl = selectedTrackLoaded ? (engine.currentTrack?.url ?? null) : null
  const decodedBuffer = runtimeTrackId ? (engine.getDecodedBuffer(runtimeTrackId) ?? null) : null
  const editorDurationMs = Math.max(
    0,
    Math.round(
      selectedTrackLoaded && engine.duration > 0
        ? engine.duration * 1000
        : (selectedTrack?.durationSec ?? 0) * 1000,
    ),
  )
  const trustedBeatGridMs = selectedTrackLoaded && engine.currentAnalysisStatus === 'complete'
    ? (engine.currentEffectiveBeatGrid ?? engine.currentAnalysis?.beatGrid ?? [])
        .map((beat) => Math.round(beat.timeSec * 1000))
    : []
  const sectionOptions = selectedTrackLoaded
    ? (engine.currentAnalysis?.sections ?? []).map((section) => ({
        id: section.id,
        label: section.label,
        type: toLyricSectionType(section.type),
      }))
    : []
  const hasMore = tracks.length < trackTotal
  const selectedTrackName = selectedTrack?.title ?? null

  const editorPlaceholder = useMemo(() => {
    if (!selectedTrack && !activeDocument)
      return 'Select a track to begin editing lyrics.'
    if (selectedTrack && documents.length === 0 && !activeDocument)
      return 'This track has no lyrics yet.'
    return null
  }, [activeDocument, documents.length, selectedTrack])

  return (
    <div className="lmv-root">
      <LyricManagerHeader
        isSaving={isSaving}
        lyricsEnabled={lyricsEnabled}
        hasDocument={!!activeDocument}
        draftTitle={draftTitle}
        selectedTrackName={selectedTrackName}
        dirty={editorDirty}
        onBack={() =>
          requestTransition(
            'Save changes before leaving Lyric Manager?',
            onBack,
          )
        }
        onToggleLyricsEnabled={() => setLyricsEnabled(!lyricsEnabled)}
        onSave={() => {
          void doSave()
        }}
        onSaveAndEnable={() => {
          void doSave().then((saved) => {
            if (saved) setLyricsEnabled(true)
          })
        }}
      />

      {(error || statusMsg) && (
        <div
          className={`lmv-status-bar${error ? ' lmv-status-bar--error' : ' lmv-status-bar--ok'}`}
          role={error ? 'alert' : 'status'}
          aria-live={error ? 'assertive' : 'polite'}
        >
          {error ?? statusMsg}
          {error && (
            <button
              type="button"
              className="lmv-status-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss lyric manager error"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div
        className="lmv-body"
        data-left-collapsed={leftRailCollapsed ? 'true' : undefined}
        data-right-collapsed={rightRailCollapsed ? 'true' : undefined}
      >
        <WorkspaceRail
          side="left"
          label="Lyric Manager library and versions"
          collapsed={leftRailCollapsed}
          onToggleCollapsed={() => setLeftRailCollapsed(value => !value)}
          className="lmv-left-rail"
        >
          <LyricTrackBrowser
            tracks={tracks}
            selectedTrackId={selectedTrack?.dbId ?? null}
            loadedAudioTrackId={engine.currentAudioTrackId}
            playingAudioTrackId={
              engine.isPlaying ? engine.currentAudioTrackId : null
            }
            search={trackSearch}
            loading={tracksLoading}
            error={tracksError}
            hasMore={hasMore}
            onSearchChange={setTrackSearch}
            onSelectTrack={handleSelectTrack}
            onDeleteTrack={handleRequestDeleteTrack}
            onLoadMore={() => {
              void loadTracks(false)
            }}
            onUpload={() => setUploadOpen(true)}
            onRetry={() => {
              void loadTracks(true)
            }}
          />

          <LyricDocumentSidebar
            documents={documents}
            legacyDocuments={legacyDocuments}
            loading={documentsLoading || isLoading}
            activeDocumentId={activeDocumentId}
            hasSelectedTrack={!!selectedTrack}
            onSelectDocument={handleSelectDocument}
            onNewDocument={handleNewDocument}
            onDuplicateDocument={handleDuplicateDocument}
            onRenameDocument={handleRenameDocument}
            onActivateDocument={handleActivateDocument}
            onDeleteDocument={handleRequestDelete}
            onImportDocument={handleImportDocument}
          />
        </WorkspaceRail>

        <main className="lmv-center" aria-label="Lyric editing workspace">
          <SelectedTrackHero
            track={selectedTrack}
            activeDocumentTitle={activeDocument?.title ?? selectedTrack?.activeLyricDocumentName ?? null}
            selectedTrackLoaded={selectedTrackLoaded}
            selectedTrackPlaying={selectedTrackPlaying}
            loading={loadingTrackId === selectedTrack?.dbId}
            onLoadTrack={() => {
              void handleLoadSelectedTrack()
            }}
            onTogglePlayback={handleTogglePlayback}
          />

          <div className="lmv-tab-bar" role="tablist" aria-label="Lyric workflow">
            {TAB_LABELS.map((tab) => {
              const disabled = tab.id === 'ai'
                ? !selectedTrack
                : (!selectedTrack && !activeDocument)
              return (
                <button
                  key={tab.id}
                  id={`lyric-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`lyric-panel-${tab.id}`}
                  className={`lmv-tab-btn${activeTab === tab.id ? ' lmv-tab-btn--active' : ''}${disabled ? ' lmv-tab-btn--disabled' : ''}`}
                  onClick={() => {
                    if (!disabled) setActiveTab(tab.id)
                  }}
                  disabled={disabled}
                  title={tab.id === 'ai' && !selectedTrack ? 'Select a stored track first' : undefined}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="lmv-tab-content" id={`lyric-panel-${activeTab}`} role="tabpanel" aria-labelledby={`lyric-tab-${activeTab}`}>
            {editorPlaceholder && activeTab === 'manual' ? (
              <div className="lmv-editor-placeholder">
                <div>{editorPlaceholder}</div>
                {selectedTrack && (
                  <div className="lmv-editor-placeholder-actions">
                    <button
                      className="lmv-btn lmv-btn--primary"
                      onClick={handleNewDocument}
                    >
                      Create Blank Lyrics
                    </button>
                    <button
                      className="lmv-btn lmv-btn--ghost"
                      onClick={handleImportDocument}
                    >
                      Import Lyrics
                    </button>
                  </div>
                )}
              </div>
            ) : activeTab === 'manual' ? (
              <ManualLyricEditor
                draftTitle={draftTitle}
                draftArtist={draftArtist}
                globalOffsetMs={globalOffsetMs}
                onUpdateTitle={setDraftTitle}
                onUpdateArtist={setDraftArtist}
                onUpdateGlobalOffset={setGlobalOffsetMs}
                trackId={runtimeTrackId}
                trackUrl={runtimeTrackUrl}
                decodedBuffer={decodedBuffer}
                durationMs={editorDurationMs}
                currentAudioTimeMs={selectedTrackLoaded ? currentAudioTimeMs : null}
                onSeek={(timeMs) => {
                  if (!selectedTrackLoaded) {
                    showStatus('Load the selected track to the deck before seeking.')
                    return
                  }
                  engine.seek(timeMs / 1000)
                }}
                beatGridMs={trustedBeatGridMs}
                sections={sectionOptions}
              />
            ) : activeTab === 'json' ? (
              <JsonLyricImporter onImportToDraft={handleImportToDraft} />
            ) : (
              <AiLyricExtractor
                selectedTrack={selectedTrack}
                existingDocumentCount={documents.length}
                onOpenCompletedDraft={handleOpenCompletedDraft}
                onActivateCompletedDraft={handleActivateCompletedDraft}
              />
            )}
          </div>

        </main>

        <WorkspaceRail
          side="right"
          label="Lyric Manager preview and validation"
          collapsed={rightRailCollapsed}
          onToggleCollapsed={() => setRightRailCollapsed(value => !value)}
          className="lmv-right-rail"
        >
          <LyricPreviewPanel
            cues={storeCues}
            document={activeDocument}
            selectedCue={selectedCue}
            onPreviewInVisualizer={handlePreviewInVisualizer}
            extractionConsole={
              <ExtractionConsoleSummary
                selectedTrack={selectedTrack}
                documentCount={documents.length}
                cueCount={storeCues.length}
                documentsLoading={documentsLoading}
                activeTab={activeTab}
              />
            }
          />
        </WorkspaceRail>
      </div>

      <LyricTransportBar
        selectedTrack={selectedTrack}
        selectedTrackLoaded={selectedTrackLoaded}
        selectedTrackPlaying={selectedTrackPlaying}
        currentTimeMs={selectedTrackLoaded ? currentAudioTimeMs : null}
        durationMs={editorDurationMs}
        volume={engine.volume}
        bpm={selectedTrack?.bpm ?? null}
        musicalKey={selectedTrack?.musicalKey ?? null}
        onTogglePlayback={handleTogglePlayback}
        onVolumeChange={engine.setVolume}
      />

      <UnsavedLyricChangesDialog
        open={pendingTransition !== null}
        busy={isSaving}
        message={pendingTransition?.message}
        onCancel={() => setPendingTransition(null)}
        onDiscard={() => {
          const pending = pendingTransition
          setPendingTransition(null)
          markEditorDirty(false)
          if (pending) void pending.action()
        }}
        onSave={() => {
          const pending = pendingTransition
          void doSave().then((saved) => {
            if (!saved || !pending) return
            setPendingTransition(null)
            void pending.action()
          })
        }}
      />

      <ConfirmLyricDeleteDialog
        title={deleteTarget?.title ?? null}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDelete()
        }}
      />

      <ConfirmTrackDeleteDialog
        trackTitle={trackDeleteTarget?.title ?? trackDeleteTarget?.fileName ?? null}
        busy={trackDeleting}
        onCancel={() => setTrackDeleteTarget(null)}
        onConfirm={() => {
          void handleConfirmDeleteTrack()
        }}
      />

      {uploadOpen && (
        <MediaUploadModal
          audioOnly
          onAudioUploaded={handleUploaded}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  )
}

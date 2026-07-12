import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useLyricsStore } from '../../stores/lyricsStore'
import {
  deleteLyricDocument,
  getFullLyricDocument,
} from '../../lib/lyricsDb'
import { useAudioStore } from '../../stores/audioStore'
import type { SavedAudioTrack } from '../../stores/audioStore'
import { useSharedAudio } from '../../context/AudioEngineContext'
import type { LyricCue, LyricDocument, LyricSectionType } from '../../types/lyrics'
import { DEFAULT_TRACK_ANALYSIS_RUNTIME } from '../../types'
import type { TrackIntelligenceAnalysis, BeatMarkerMI } from '../musicIntelligence/types'
import type { LyricBeatGridStatus } from './editor/LyricCueEditor'
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
import { LyricRecoveryDialog } from './components/LyricRecoveryDialog'
import { MediaUploadModal } from '../../components/vyzualz/MediaUploadModal'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'
import type { RuntimeTrackUrlInput } from '../../audio/runtimeTrack'
import type { PerformanceAppView } from '../../components/vyzualz/appView'
import type { LyricSnapMode } from './editor/lyricCueEditorModel'
import {
  cleanupObsoleteLyricRecoveries,
  createLyricRecoveryRecord,
  deleteLyricRecoveryForDocument,
  findLyricRecovery,
  getLyricRecoveryRepository,
  lyricRecoveryKey,
  reconcileLyricRecoveryAfterCanonicalWrite,
  type LyricRecoveryRecord,
} from '../../lib/lyricDraftRecovery'

type WorkflowTab = 'manual' | 'json' | 'ai'

interface Props {
  onBack: () => void
  returnView?: PerformanceAppView
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

function formatTrackDate(value: string | null | undefined): string {
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

function beatMarkersToMs(markers: readonly BeatMarkerMI[] | null | undefined): number[] {
  return (markers ?? [])
    .map(beat => Math.round(beat.timeSec * 1000))
    .filter(ms => Number.isFinite(ms) && ms >= 0)
}

function generateBeatGridFromBpm(
  bpm: number | null | undefined,
  durationMs: number,
  offsetSec: number | null | undefined = 0,
): number[] {
  if (!bpm || !Number.isFinite(bpm) || bpm <= 0 || durationMs <= 0) return []
  const intervalMs = 60_000 / bpm
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return []
  const offsetMs = Number.isFinite(offsetSec ?? 0) ? Math.max(0, Math.round((offsetSec ?? 0) * 1000)) : 0
  const grid: number[] = []
  for (let ms = offsetMs; ms <= durationMs + intervalMs; ms += intervalMs) {
    grid.push(Math.round(ms))
    if (grid.length > 20_000) break
  }
  if (grid.length < 2 && offsetMs > 0) {
    for (let ms = offsetMs - intervalMs; ms >= 0; ms -= intervalMs) grid.unshift(Math.round(ms))
  }
  return grid.length >= 2 ? grid : []
}

function sectionOptionsFromAnalysis(analysis: TrackIntelligenceAnalysis | null | undefined) {
  return (analysis?.sections ?? []).map((section) => ({
    id: section.id,
    label: section.label,
    type: toLyricSectionType(section.type),
  }))
}

function uploadedTrackToManager(track: SavedAudioTrack): LyricManagerTrack {
  return {
    ...track,
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
    analysisPayload: null,
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

function canonicalDocumentVersion(
  document: LyricDocument,
  cues: LyricCue[],
): LyricDocumentVersion {
  const metadataValue = (key: string): string | null => {
    const value = document.metadata[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }
  return {
    ...document,
    cueCount: cues.length,
    language: metadataValue('language'),
    documentReviewStatus: metadataValue('reviewStatus') ?? metadataValue('review_status'),
  }
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
        <div className="lmv-track-stat"><strong>{formatTrackDate(track.createdAt)}</strong><span>Added</span></div>
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
  snapMode,
  onToggleSnap,
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
  snapMode: LyricSnapMode
  onToggleSnap: () => void
  onTogglePlayback: () => void
  onVolumeChange: (volume: number) => void
}) {
  const safeDuration = Math.max(0, durationMs)
  const safeCurrent = Math.min(safeDuration, Math.max(0, currentTimeMs ?? 0))

  return (
    <footer className="lmv-transport-bar" aria-label="Lyric preview transport">
      <div className="lmv-transport-left">
        <button className="lmv-transport-chip" type="button" disabled title="Loop boundaries are not defined for Lyric Manager preview." aria-label="Loop unavailable: no loop boundaries are defined">↻ Loop</button>
        <button className="lmv-transport-chip" type="button" onClick={onToggleSnap} aria-pressed={snapMode !== 'none'} title="Toggle the cue editor's canonical snap mode">⌕ Snap: {snapMode === 'none' ? 'Off' : snapMode}</button>
        <button className="lmv-transport-chip" type="button" disabled title="No lyric comparison model is available for this document." aria-label="Compare unavailable: no comparison model is available">⇄ Compare: Off</button>
      </div>

      <div className="lmv-transport-center">
        <button className="lmv-transport-icon" type="button" disabled title="Previous navigation is unavailable because no transport order is defined." aria-label="Previous unavailable">⏮</button>
        <button className="lmv-transport-icon" type="button" disabled={!selectedTrackLoaded} onClick={onTogglePlayback}>
          {selectedTrackPlaying ? 'Ⅱ' : '▶'}
        </button>
        <button className="lmv-transport-icon" type="button" disabled title="Next navigation is unavailable because no transport order is defined." aria-label="Next unavailable">⏭</button>
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

export function LyricManagerView({ onBack, returnView = 'visualizer' }: Props) {
  const {
    lyricsEnabled,
    setLyricsEnabled,
    activeDocument,
    activeDocumentId,
    activeLogicalDocumentId,
    activeWriteStatus,
    activeEditVersion,
    lastCanonicalWrite,
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
    draftDefaultStyle,
    draftDefaultAnimation,
    draftDefaultEffects,
    globalOffsetMs,
    draftSourceType,
    draftSourceFormat,
    draftRawSourceText,
    draftMetadata,
    draftActivateOnSave,
    setDraftTitle,
    setDraftArtist,
    setGlobalOffsetMs,
    updateDraftDefaultStyle,
    updateDraftDefaultAnimation,
    updateDraftDefaultEffects,
    saveActiveLyricDocument,
    saveLyricDocumentMetadata,
    setActiveDocument,
    loadLyricDocument,
    setDraftSourceMeta,
    activateLyricDocument,
    beginEditorSession,
    endEditorSession,
    setOperationAccount,
    releaseOperationResources,
    abandonActiveLyricDraft,
    abandonLyricDocument,
    editorDirty,
    markEditorDirty,
    preserveDraftForNextEditorExit,
    restoreRecoveredLyricDraft,
  } = useLyricsStore()

  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine
  const getSignedUrl = useAudioStore((state) => state.getSignedUrl)
  const removeSavedTrackByDbId = useAudioStore((state) => state.removeSavedTrackByDbId)

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
  const [recoveryCandidate, setRecoveryCandidate] = useState<LyricRecoveryRecord | null>(null)
  const [recoveryReviewing, setRecoveryReviewing] = useState(false)
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [snapMode, setSnapMode] = useState<LyricSnapMode>('none')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [audioPreviewStates, setAudioPreviewStates] = useState<Record<string, {
    status: 'idle' | 'loading' | 'ready' | 'error'
    error: string | null
  }>>({})
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
  const mountedRef = useRef(false)
  const accountIdRef = useRef<string | null>(null)
  const selectedTrackIdRef = useRef<string | null>(null)
  const selectedDocumentIntentRef = useRef(0)
  const trackListGenerationRef = useRef(0)
  const documentListGenerationRef = useRef(new Map<string, number>())
  const canonicalReconcileSequenceRef = useRef(0)
  const audioRequestRef = useRef({ generation: 0, trackId: null as string | null, accountId: null as string | null })
  const statusTimerRef = useRef<number | null>(null)
  const statusRequestRef = useRef(0)
  const recoveryReadGenerationRef = useRef(0)
  const recoveryAutosaveTimerRef = useRef<number | null>(null)
  const recoveryMutationChainRef = useRef<Promise<void>>(Promise.resolve())

  const queueRecoveryMutation = useCallback((mutation: () => Promise<void>): Promise<void> => {
    const next = recoveryMutationChainRef.current
      .catch(() => undefined)
      .then(mutation)
    recoveryMutationChainRef.current = next.catch(() => undefined)
    return next
  }, [])

  useEffect(() => {
    const documentListGenerations = documentListGenerationRef.current
    mountedRef.current = true
    beginEditorSession()
    let unsubscribe: (() => void) | undefined

    void supabase.auth.getUser().then(({ data }) => {
      if (!mountedRef.current) return
      const accountId = data.user?.id ?? null
      accountIdRef.current = accountId
      setOperationAccount(accountId)
      if (accountId && typeof indexedDB !== 'undefined') {
        void cleanupObsoleteLyricRecoveries(accountId).catch(() => undefined)
      }
    })

    const authSubscription = supabase.auth.onAuthStateChange?.((_event, session) => {
      const accountId = session?.user?.id ?? null
      if (accountIdRef.current === accountId) return
      accountIdRef.current = accountId
      recoveryReadGenerationRef.current += 1
      if (recoveryAutosaveTimerRef.current !== null) {
        window.clearTimeout(recoveryAutosaveTimerRef.current)
        recoveryAutosaveTimerRef.current = null
      }
      setRecoveryCandidate(null)
      setRecoveryReviewing(false)
      selectedDocumentIntentRef.current += 1
      trackListGenerationRef.current += 1
      documentListGenerations.clear()
      audioRequestRef.current.generation += 1
      setOperationAccount(accountId)
      setSelectedTrack(null)
      selectedTrackIdRef.current = null
      setDocuments([])
      setAudioPreviewStates({})
      setLegacyDocuments([])
      setTracks([])
      setTrackTotal(0)
    })
    unsubscribe = () => authSubscription?.data.subscription.unsubscribe()

    return () => {
      mountedRef.current = false
      recoveryReadGenerationRef.current += 1
      if (recoveryAutosaveTimerRef.current !== null) window.clearTimeout(recoveryAutosaveTimerRef.current)
      selectedDocumentIntentRef.current += 1
      trackListGenerationRef.current += 1
      documentListGenerations.clear()
      audioRequestRef.current.generation += 1
      unsubscribe?.()
      releaseOperationResources()
      endEditorSession()
    }
  }, [beginEditorSession, endEditorSession, releaseOperationResources, setOperationAccount])

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

  const clearStatus = useCallback(() => {
    statusRequestRef.current += 1
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current)
      statusTimerRef.current = null
    }
    setStatusMsg(null)
  }, [])

  const showStatus = useCallback((message: string) => {
    const request = ++statusRequestRef.current
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    setStatusMsg(message)
    statusTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current || statusRequestRef.current !== request) return
      statusTimerRef.current = null
      setStatusMsg(null)
    }, 3000)
  }, [])

  useEffect(() => () => {
    if (statusTimerRef.current !== null) window.clearTimeout(statusTimerRef.current)
    if (recoveryAutosaveTimerRef.current !== null) window.clearTimeout(recoveryAutosaveTimerRef.current)
  }, [])

  useEffect(() => {
    if (recoveryAutosaveTimerRef.current !== null) {
      window.clearTimeout(recoveryAutosaveTimerRef.current)
      recoveryAutosaveTimerRef.current = null
    }
    const accountId = accountIdRef.current
    if (!editorDirty || !accountId) return
    const logicalDocumentId = activeLogicalDocumentId
    recoveryAutosaveTimerRef.current = window.setTimeout(() => {
      recoveryAutosaveTimerRef.current = null
      const state = useLyricsStore.getState()
      if (!mountedRef.current
        || !state.editorDirty
        || state.operationAccountId !== accountId
        || state.activeLogicalDocumentId !== logicalDocumentId) return
      const recovery = createLyricRecoveryRecord({
        userId: accountId,
        trackId: state.activeAudioTrackId,
        documentId: state.activeDocumentId,
        logicalDocumentId,
      }, {
        baseServerRevision: state.activeDocument?.revision ?? null,
        cues: state.cues,
        title: state.draftTitle,
        artist: state.draftArtist,
        defaultStyle: state.draftDefaultStyle,
        defaultAnimation: state.draftDefaultAnimation,
        defaultEffects: state.draftDefaultEffects,
        globalOffsetMs: state.globalOffsetMs,
        sourceType: state.draftSourceType,
        sourceFormat: state.draftSourceFormat,
        rawSourceText: state.draftRawSourceText,
        metadata: state.draftMetadata,
        activateOnSave: state.draftActivateOnSave,
        editVersion: state.activeEditVersion,
      })
      void queueRecoveryMutation(() => getLyricRecoveryRepository().put(recovery)).catch(saveError => {
        if (!mountedRef.current
          || useLyricsStore.getState().operationAccountId !== accountId
          || useLyricsStore.getState().activeLogicalDocumentId !== logicalDocumentId) return
        setError(saveError instanceof Error
          ? `Lyric recovery autosave failed: ${saveError.message}`
          : 'Lyric recovery autosave failed. Your in-memory edits are still intact.')
      })
    }, 800)
    return () => {
      if (recoveryAutosaveTimerRef.current !== null) {
        window.clearTimeout(recoveryAutosaveTimerRef.current)
        recoveryAutosaveTimerRef.current = null
      }
    }
  }, [
    activeDocumentId,
    activeEditVersion,
    activeLogicalDocumentId,
    draftActivateOnSave,
    draftArtist,
    draftDefaultAnimation,
    draftDefaultEffects,
    draftDefaultStyle,
    draftMetadata,
    draftRawSourceText,
    draftSourceFormat,
    draftSourceType,
    draftTitle,
    editorDirty,
    globalOffsetMs,
    queueRecoveryMutation,
    setError,
    storeCues,
  ])

  useEffect(() => {
    const accountId = accountIdRef.current
    if (!accountId || isLoading || editorDirty) return
    const trackId = activeDocument?.audioTrackId ?? selectedTrackIdRef.current
    const generation = ++recoveryReadGenerationRef.current
    const identity = {
      userId: accountId,
      trackId: trackId ?? null,
      documentId: activeDocumentId,
      logicalDocumentId: activeLogicalDocumentId,
    }
    void recoveryMutationChainRef.current
      .catch(() => undefined)
      .then(() => findLyricRecovery(identity))
      .then(recovery => {
      if (!mountedRef.current
        || recoveryReadGenerationRef.current !== generation
        || accountIdRef.current !== accountId
        || useLyricsStore.getState().activeLogicalDocumentId !== activeLogicalDocumentId
        || useLyricsStore.getState().editorDirty) return
      setRecoveryCandidate(recovery)
      setRecoveryReviewing(false)
    }).catch(loadError => {
      if (!mountedRef.current || recoveryReadGenerationRef.current !== generation) return
      setError(loadError instanceof Error
        ? `Lyric recovery could not be checked: ${loadError.message}`
        : 'Lyric recovery could not be checked.')
    })
  }, [activeDocument, activeDocumentId, activeLogicalDocumentId, editorDirty, isLoading, setError])

  useEffect(() => {
    if (!lastCanonicalWrite || lastCanonicalWrite.accountId !== accountIdRef.current) return
    const accountId = lastCanonicalWrite.accountId
    if (!accountId) return
    const current = useLyricsStore.getState()
    const trackId = lastCanonicalWrite.document.audioTrackId ?? null
    const draftKey = lyricRecoveryKey({
      userId: accountId,
      trackId,
      documentId: null,
      logicalDocumentId: lastCanonicalWrite.logicalDocumentId,
    })
    const canonicalKey = lyricRecoveryKey({
      userId: accountId,
      trackId,
      documentId: lastCanonicalWrite.document.id,
      logicalDocumentId: lastCanonicalWrite.logicalDocumentId,
    })
    const hasNewerLocalEdits = current.activeLogicalDocumentId === lastCanonicalWrite.logicalDocumentId
      && current.editorDirty
      && current.activeEditVersion > lastCanonicalWrite.editVersion
    const newerRecovery = hasNewerLocalEdits
      ? createLyricRecoveryRecord({
          userId: accountId,
          trackId: current.activeAudioTrackId,
          documentId: lastCanonicalWrite.document.id,
          logicalDocumentId: lastCanonicalWrite.logicalDocumentId,
        }, {
          baseServerRevision: lastCanonicalWrite.document.revision,
          cues: current.cues,
          title: current.draftTitle,
          artist: current.draftArtist,
          defaultStyle: current.draftDefaultStyle,
          defaultAnimation: current.draftDefaultAnimation,
          defaultEffects: current.draftDefaultEffects,
          globalOffsetMs: current.globalOffsetMs,
          sourceType: current.draftSourceType,
          sourceFormat: current.draftSourceFormat,
          rawSourceText: current.draftRawSourceText,
          metadata: current.draftMetadata,
          activateOnSave: current.draftActivateOnSave,
          editVersion: current.activeEditVersion,
        })
      : null
    void queueRecoveryMutation(() => reconcileLyricRecoveryAfterCanonicalWrite({
      userId: accountId,
      trackId,
      documentId: lastCanonicalWrite.document.id,
      logicalDocumentId: lastCanonicalWrite.logicalDocumentId,
      newerRecovery,
    })).catch(reconcileError => {
      if (mountedRef.current) setError(reconcileError instanceof Error
        ? `${hasNewerLocalEdits ? 'Lyric recovery reconciliation failed' : 'Saved lyrics, but the local recovery copy could not be cleared'}: ${reconcileError.message}`
        : hasNewerLocalEdits
          ? 'Lyric recovery reconciliation failed.'
          : 'Saved lyrics, but the local recovery copy could not be cleared.')
    })
    if (!hasNewerLocalEdits) {
      setRecoveryCandidate(currentCandidate => currentCandidate
        && (currentCandidate.key === draftKey || currentCandidate.key === canonicalKey) ? null : currentCandidate)
    }
  }, [lastCanonicalWrite, queueRecoveryMutation, setError])

  const selectTrackState = useCallback((track: LyricManagerTrack | null) => {
    clearStatus()
    recoveryReadGenerationRef.current += 1
    setRecoveryCandidate(null)
    setRecoveryReviewing(false)
    const previousTrackId = audioRequestRef.current.trackId
    selectedTrackIdRef.current = track?.dbId ?? null
    selectedDocumentIntentRef.current += 1
    audioRequestRef.current.generation += 1
    audioRequestRef.current.trackId = track?.dbId ?? null
    if (previousTrackId && previousTrackId !== track?.dbId) {
      setAudioPreviewStates(current => {
        if (current[previousTrackId]?.status !== 'loading') return current
        return { ...current, [previousTrackId]: { status: 'idle', error: null } }
      })
    }
    setSelectedTrack(track)
    setDocuments([])
    setDocumentsLoading(false)
  }, [clearStatus])

  const prepareTrackDraft = useCallback(
    (
      track: LyricManagerTrack,
      dirty = false,
      activateOnSave = track.activeLyricDocumentId === null,
    ) => {
      clearStatus()
      selectedDocumentIntentRef.current += 1
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
    [clearStatus, selectCue, setActiveDocument],
  )

  const loadTracks = useCallback(
    async (reset: boolean) => {
      if (!supabaseConfigured) {
        setTracksError('Supabase is not configured.')
        return
      }
      const generation = ++trackListGenerationRef.current
      setTracksLoading(true)
      setTracksError(null)
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) throw new Error('Sign in to view stored audio tracks.')
        const accountId = data.user.id
        if (accountIdRef.current !== accountId) {
          accountIdRef.current = accountId
          setOperationAccount(accountId)
        }
        const offset = reset ? 0 : tracks.length
        const page = await loadLyricManagerTrackPage(accountId, {
          offset,
          limit: PAGE_SIZE,
          search: debouncedSearch,
        })
        if (!mountedRef.current
          || generation !== trackListGenerationRef.current
          || accountIdRef.current !== accountId) return
        const { data: currentAuth } = await supabase.auth.getUser()
        if (!mountedRef.current || currentAuth.user?.id !== accountId) return
        setTrackTotal(page.total)
        setTracks((current) => reset ? page.tracks : mergeTracks(current, page.tracks))
      } catch (loadError) {
        if (!mountedRef.current || generation !== trackListGenerationRef.current) return
        setTracksError(loadError instanceof Error ? loadError.message : 'Failed to load stored tracks.')
      } finally {
        if (mountedRef.current && generation === trackListGenerationRef.current) setTracksLoading(false)
      }
    },
    [debouncedSearch, setOperationAccount, tracks.length],
  )

  useEffect(() => {
    void loadTracks(true)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabaseConfigured) return
    let cancelled = false
    void supabase.auth.getUser().then(async ({ data }) => {
      const accountId = data.user?.id
      if (!accountId) return
      try {
        const next = await getLegacyLyricDocumentVersions(accountId)
        if (!cancelled && mountedRef.current && accountIdRef.current === accountId) setLegacyDocuments(next)
      } catch {
        // Legacy documents are supplementary; track-first loading should still work.
      }
    })
    return () => { cancelled = true }
  }, [])

  const refreshDocuments = useCallback(
    async (track: LyricManagerTrack, selectPreferred = false) => {
      const { data } = await supabase.auth.getUser()
      const accountId = data.user?.id ?? null
      if (!accountId || accountIdRef.current !== accountId) return []
      const token = (documentListGenerationRef.current.get(track.dbId) ?? 0) + 1
      documentListGenerationRef.current.set(track.dbId, token)
      const selectionIntent = selectedDocumentIntentRef.current
      const logicalDocumentAtStart = useLyricsStore.getState().activeLogicalDocumentId
      const canonicalSequenceAtStart = useLyricsStore.getState().lastCanonicalWrite?.sequence ?? 0
      if (selectedTrackIdRef.current === track.dbId) setDocumentsLoading(true)

      try {
        const loadedDocuments = await getLyricDocumentVersionsForTracks([track.dbId])
        const { data: currentAuth } = await supabase.auth.getUser()
        if (!mountedRef.current
          || currentAuth.user?.id !== accountId
          || accountIdRef.current !== accountId
          || selectedTrackIdRef.current !== track.dbId
          || documentListGenerationRef.current.get(track.dbId) !== token) return []

        let nextDocuments = loadedDocuments
        const latestWrite = useLyricsStore.getState().lastCanonicalWrite
        if (latestWrite
          && latestWrite.sequence > canonicalSequenceAtStart
          && latestWrite.accountId === accountId
          && latestWrite.document.audioTrackId === track.dbId
          && !nextDocuments.some(document => document.id === latestWrite.document.id)) {
          nextDocuments = [canonicalDocumentVersion(latestWrite.document, latestWrite.cues), ...nextDocuments]
        }

        setDocuments(nextDocuments)
        setTracks((current) => current.map((item) => {
          if (item.dbId !== track.dbId) return item
          const active = nextDocuments.find((document) => document.isActive) ?? null
          return {
            ...item,
            lyricVersionCount: nextDocuments.length,
            activeLyricDocumentId: active?.id ?? null,
            activeLyricDocumentName: active?.title ?? null,
          }
        }))

        if (selectPreferred) {
          const currentState = useLyricsStore.getState()
          const selectionStillOwned = selectedDocumentIntentRef.current === selectionIntent
            && currentState.activeLogicalDocumentId === logicalDocumentAtStart
            && !currentState.editorDirty
          if (selectionStillOwned) {
            const preferred = nextDocuments.find((document) => document.isActive) ?? nextDocuments[0]
            if (preferred) {
              selectedDocumentIntentRef.current += 1
              await loadLyricDocument(preferred.id)
            } else {
              prepareTrackDraft(track, false)
            }
          }
        }
        return nextDocuments
      } catch (documentError) {
        if (mountedRef.current
          && selectedTrackIdRef.current === track.dbId
          && documentListGenerationRef.current.get(track.dbId) === token) {
          setError(documentError instanceof Error ? documentError.message : 'Failed to load lyric versions.')
        }
        return []
      } finally {
        if (mountedRef.current
          && selectedTrackIdRef.current === track.dbId
          && documentListGenerationRef.current.get(track.dbId) === token) {
          setDocumentsLoading(false)
        }
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
    showStatus('Saved')
    if (selectedTrack) await refreshDocuments(selectedTrack)
    return true
  }, [
    storeCues,
    refreshDocuments,
    saveActiveLyricDocument,
    selectedTrack,
    setError,
    showStatus,
  ])

  const handleRestoreRecovery = useCallback(() => {
    if (!recoveryCandidate) return
    restoreRecoveredLyricDraft(recoveryCandidate)
    setRecoveryCandidate(null)
    setRecoveryReviewing(false)
    showStatus('Recovered lyric draft restored as unsaved changes')
  }, [recoveryCandidate, restoreRecoveredLyricDraft, showStatus])

  const handleDiscardRecovery = useCallback(async () => {
    if (!recoveryCandidate) return
    setRecoveryBusy(true)
    try {
      await queueRecoveryMutation(() => getLyricRecoveryRepository().delete(recoveryCandidate.key))
      setRecoveryCandidate(null)
      setRecoveryReviewing(false)
      showStatus('Local lyric recovery discarded')
    } catch (discardError) {
      setError(discardError instanceof Error
        ? `Lyric recovery could not be discarded: ${discardError.message}`
        : 'Lyric recovery could not be discarded.')
    } finally {
      if (mountedRef.current) setRecoveryBusy(false)
    }
  }, [queueRecoveryMutation, recoveryCandidate, setError, showStatus])

  const discardActiveRecovery = useCallback(async () => {
    const state = useLyricsStore.getState()
    const accountId = accountIdRef.current
    if (!accountId) return
    const key = lyricRecoveryKey({
      userId: accountId,
      trackId: state.activeAudioTrackId,
      documentId: state.activeDocumentId,
      logicalDocumentId: state.activeLogicalDocumentId,
    })
    try {
      await queueRecoveryMutation(() => getLyricRecoveryRepository().delete(key))
    } catch (discardError) {
      setError(discardError instanceof Error
        ? `Unsaved edits were discarded, but their recovery copy could not be removed: ${discardError.message}`
        : 'Unsaved edits were discarded, but their recovery copy could not be removed.')
    }
  }, [queueRecoveryMutation, setError])

  const handleSelectTrack = useCallback(
    (track: LyricManagerTrack) => {
      if (selectedTrack?.dbId === track.dbId) return
      requestTransition(
        `Save changes before selecting “${track.title}”?`,
        async () => {
          markEditorDirty(false)
          selectTrackState(track)
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
      selectTrackState,
    ],
  )

  const handleSelectDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (document.id === activeDocumentId) return
      requestTransition(
        `Save changes before opening “${document.title}”?`,
        async () => {
          clearStatus()
          markEditorDirty(false)
          selectedDocumentIntentRef.current += 1
          if (!document.audioTrackId) {
            selectTrackState(null)
            setDocuments([])
          }
          await loadLyricDocument(document.id)
          setActiveTab('manual')
        },
      )
    },
    [activeDocumentId, clearStatus, loadLyricDocument, markEditorDirty, requestTransition, selectTrackState],
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
          selectedDocumentIntentRef.current += 1
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
        const result = await saveLyricDocumentMetadata(document.id, { title })
        if (!result?.ok) return
        if (selectedTrack) await refreshDocuments(selectedTrack)
        else {
          const { data } = await supabase.auth.getUser()
          if (data.user && accountIdRef.current === data.user.id)
            setLegacyDocuments(await getLegacyLyricDocumentVersions(data.user.id))
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
      refreshDocuments,
      saveLyricDocumentMetadata,
      selectedTrack,
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
      abandonLyricDocument(deleteTarget.id)
      await deleteLyricDocument(deleteTarget.id)
      const accountId = accountIdRef.current
      if (accountId) {
        try {
          await queueRecoveryMutation(() => deleteLyricRecoveryForDocument(accountId, deleteTarget.id))
        } catch (cleanupError) {
          setError(cleanupError instanceof Error
            ? `Lyric version deleted, but local recovery cleanup failed: ${cleanupError.message}`
            : 'Lyric version deleted, but local recovery cleanup failed.')
        }
      }
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
    abandonLyricDocument,
    activeDocumentId,
    deleteTarget,
    loadLyricDocument,
    markEditorDirty,
    prepareTrackDraft,
    queueRecoveryMutation,
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
      const removed = await removeSavedTrackByDbId(trackDeleteTarget.dbId)
      if (!removed) {
        setError(useAudioStore.getState().loadError ?? 'Track deletion failed.')
        return
      }
      const cleanupPending = Boolean(useAudioStore.getState().loadError)
      setTrackDeleteTarget(null)
      markEditorDirty(false)
      setTracks(current => current.filter(item => item.dbId !== trackDeleteTarget.dbId))
      setTrackTotal(current => Math.max(0, current - 1))
      if (wasSelected) {
        selectTrackState(null)
        setDocuments([])
        setActiveDocument(null, [])
      }
      showStatus(cleanupPending
        ? 'Track removed. Storage cleanup is pending and will retry automatically.'
        : 'Track and all lyric versions deleted')
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
    removeSavedTrackByDbId,
    selectedTrack?.dbId,
    selectTrackState,
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
          clearStatus()
          markEditorDirty(false)
          selectedDocumentIntentRef.current += 1
          await loadLyricDocument(documentId)
          if (selectedTrack) await refreshDocuments(selectedTrack)
          setActiveTab('manual')
          showStatus('Extracted draft opened for review')
        },
      )
    },
    [clearStatus, loadLyricDocument, markEditorDirty, refreshDocuments, requestTransition, selectedTrack, showStatus],
  )

  const handleActivateCompletedDraft = useCallback(
    (documentId: string) => {
      requestTransition(
        'Save changes before activating the extracted lyric version?',
        async () => {
          clearStatus()
          const result = await activateLyricDocument(documentId)
          if (!result?.ok) return
          if (selectedTrack) await refreshDocuments(selectedTrack)
          selectedDocumentIntentRef.current += 1
          await loadLyricDocument(documentId)
          setActiveTab('manual')
          showStatus('Extracted lyric version activated')
        },
      )
    },
    [activateLyricDocument, clearStatus, loadLyricDocument, refreshDocuments, requestTransition, selectedTrack, showStatus],
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
    const requestedTrack = selectedTrack
    if (!requestedTrack?.storagePath) return
    const { data } = await supabase.auth.getUser()
    const requestedAccountId = data.user?.id ?? null
    if (!requestedAccountId || accountIdRef.current !== requestedAccountId) {
      setError('Sign in to load the selected track preview.')
      return
    }

    const generation = audioRequestRef.current.generation + 1
    audioRequestRef.current = {
      generation,
      trackId: requestedTrack.dbId,
      accountId: requestedAccountId,
    }
    setAudioPreviewStates(current => ({
      ...current,
      [requestedTrack.dbId]: { status: 'loading', error: null },
    }))

    try {
      const url = await getSignedUrl(requestedTrack.storagePath)
      const { data: currentAuth } = await supabase.auth.getUser()
      const stillOwned = mountedRef.current
        && audioRequestRef.current.generation === generation
        && audioRequestRef.current.trackId === requestedTrack.dbId
        && audioRequestRef.current.accountId === requestedAccountId
        && selectedTrackIdRef.current === requestedTrack.dbId
        && accountIdRef.current === requestedAccountId
        && currentAuth.user?.id === requestedAccountId
      if (!stillOwned) return
      if (!url) throw new Error('Unable to create a signed preview URL for this track.')

      const hydratedAnalysisRuntime = requestedTrack.analysisPayload
        ? {
            ...DEFAULT_TRACK_ANALYSIS_RUNTIME,
            status:          'complete' as const,
            analysis:        requestedTrack.analysisPayload,
            analysisVersion: requestedTrack.analysisPayload.analysisVersion,
            error:           null,
          }
        : null
      const trackEntry: RuntimeTrackUrlInput = {
        name: requestedTrack.fileName || requestedTrack.title,
        title: requestedTrack.title,
        artist: requestedTrack.artist,
        url,
        dbId: requestedTrack.dbId,
        storagePath: requestedTrack.storagePath,
        duration: requestedTrack.durationSec,
        persistedMetadata: {
          bpm: requestedTrack.bpm,
          musicalKey: requestedTrack.musicalKey,
          genre: requestedTrack.genre,
          sampleRate: requestedTrack.sampleRate,
          channels: requestedTrack.channels,
        },
        ...(hydratedAnalysisRuntime ? { analysisRuntime: hydratedAnalysisRuntime } : {}),
      }
      if (engine.tracks.length > 0) engine.replaceTrackUrls([trackEntry])
      else engine.addTrackUrls([trackEntry])
      if (engine.source !== 'file') engine.setSource('file')
      setAudioPreviewStates(current => ({
        ...current,
        [requestedTrack.dbId]: { status: 'ready', error: null },
      }))
      showStatus('Track loaded to the audio deck without starting playback')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load track preview.'
      const stillOwned = mountedRef.current
        && audioRequestRef.current.generation === generation
        && selectedTrackIdRef.current === requestedTrack.dbId
        && accountIdRef.current === requestedAccountId
      if (!stillOwned) return
      setAudioPreviewStates(current => ({
        ...current,
        [requestedTrack.dbId]: { status: 'error', error: message },
      }))
      setError(message)
    } finally {
      if (mountedRef.current
        && audioRequestRef.current.generation === generation
        && selectedTrackIdRef.current === requestedTrack.dbId) {
        setAudioPreviewStates(current => {
          const state = current[requestedTrack.dbId]
          if (!state || state.status !== 'loading') return current
          return { ...current, [requestedTrack.dbId]: { status: 'idle', error: null } }
        })
      }
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

  const handlePreviewInPerformanceView = useCallback(() => {
    const timedCues = storeCues.filter((cue) => cue.endMs > cue.startMs)
    if (timedCues.length === 0) {
      showStatus('Timed cues are required before previewing in the performance view.')
      return
    }
    if (editorDirty) {
      showStatus(
        'Save or discard unsaved changes before opening the performance preview.',
      )
      return
    }
    if (selectedTrack && engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus(
        'Load the selected track to the deck before opening the performance preview.',
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
          selectTrackState(managerTrack)
          setDocuments([])
          prepareTrackDraft(managerTrack, false, true)
          setActiveTab('ai')
          showStatus('Track uploaded. Automatic lyric extraction is ready.')
        },
      )
    },
    [prepareTrackDraft, requestTransition, selectTrackState, showStatus],
  )

  useEffect(() => {
    if (!lastCanonicalWrite || lastCanonicalWrite.accountId !== accountIdRef.current) return
    if (lastCanonicalWrite.sequence <= canonicalReconcileSequenceRef.current) return
    canonicalReconcileSequenceRef.current = lastCanonicalWrite.sequence
    const trackId = lastCanonicalWrite.document.audioTrackId ?? null
    if (!trackId) {
      setLegacyDocuments(current => {
        const next = canonicalDocumentVersion(lastCanonicalWrite.document, lastCanonicalWrite.cues)
        return [next, ...current.filter(document => document.id !== next.id)]
      })
      return
    }

    const next = canonicalDocumentVersion(lastCanonicalWrite.document, lastCanonicalWrite.cues)
    setTracks(current => current.map(track => {
      if (track.dbId !== trackId) return track
      const wasKnown = documents.some(document => document.id === next.id)
      return {
        ...track,
        lyricVersionCount: lastCanonicalWrite.created && !wasKnown
          ? track.lyricVersionCount + 1
          : track.lyricVersionCount,
        activeLyricDocumentId: next.isActive ? next.id : track.activeLyricDocumentId,
        activeLyricDocumentName: next.isActive ? next.title : track.activeLyricDocumentName,
      }
    }))
    if (selectedTrackIdRef.current === trackId) {
      setDocuments(current => [next, ...current.filter(document => document.id !== next.id)])
    }
  }, [documents, lastCanonicalWrite])

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
  const liveAnalysis = selectedTrackLoaded && engine.currentAnalysisStatus === 'complete'
    ? engine.currentAnalysis
    : null
  const savedAnalysis = selectedTrack?.analysisPayload ?? null
  const activeEditorAnalysis = liveAnalysis ?? savedAnalysis
  const liveBeatGridMs = selectedTrackLoaded && engine.currentAnalysisStatus === 'complete'
    ? beatMarkersToMs(engine.currentEffectiveBeatGrid ?? engine.currentAnalysis?.beatGrid ?? [])
    : []
  const savedBeatGridMs = beatMarkersToMs(savedAnalysis?.beatGrid)
  const fallbackBeatGridMs = generateBeatGridFromBpm(
    savedAnalysis?.bpm ?? selectedTrack?.bpm ?? null,
    editorDurationMs,
    savedAnalysis?.beatGridOffsetSec ?? 0,
  )
  const trustedBeatGridMs = liveBeatGridMs.length >= 2
    ? liveBeatGridMs
    : savedBeatGridMs.length >= 2
      ? savedBeatGridMs
      : fallbackBeatGridMs
  const beatGridStatus: LyricBeatGridStatus = !selectedTrack
    ? 'no-track'
    : liveBeatGridMs.length >= 2 || savedBeatGridMs.length >= 2
      ? 'trusted'
      : fallbackBeatGridMs.length >= 2
        ? 'temporary'
        : !selectedTrackLoaded
          ? 'not-loaded'
          : engine.currentAnalysisStatus === 'queued' || engine.currentAnalysisStatus === 'decoding' || engine.currentAnalysisStatus === 'analyzing'
            ? 'analyzing'
            : engine.currentAnalysisStatus === 'failed'
              ? 'failed'
              : 'missing'
  const beatGridStatusMessage = beatGridStatus === 'trusted'
    ? null
    : beatGridStatus === 'temporary'
      ? 'Beat snapping is using a temporary BPM grid. Load the deck or run analysis to replace it with detected beats.'
      : beatGridStatus === 'not-loaded'
        ? 'Load this track to the deck to enable detected beat snapping.'
        : beatGridStatus === 'analyzing'
          ? 'Analyzing beat grid… snapping will switch to detected beats when analysis completes.'
          : beatGridStatus === 'failed'
            ? 'Beat grid analysis failed. You can still use 10 ms/frame snapping, or re-load/reanalyze this track.'
            : 'No BPM or beat grid is available for this track yet.'
  const sectionOptions = sectionOptionsFromAnalysis(activeEditorAnalysis)
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
        saveStatus={activeWriteStatus}
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
            loading={selectedTrack ? audioPreviewStates[selectedTrack.dbId]?.status === 'loading' : false}
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
                beatGridStatus={beatGridStatus}
                beatGridStatusMessage={beatGridStatusMessage}
                sections={sectionOptions}
                snapMode={snapMode}
                onSnapModeChange={setSnapMode}
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
            onPreviewInVisualizer={handlePreviewInPerformanceView}
            previewDestination={returnView === 'react' ? 'React' : 'Visualizer'}
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
        snapMode={snapMode}
        onToggleSnap={() => setSnapMode(current => current === 'none' ? (trustedBeatGridMs.length >= 2 ? 'beat' : 'millisecond') : 'none')}
        onTogglePlayback={handleTogglePlayback}
        onVolumeChange={engine.setVolume}
      />

      <LyricRecoveryDialog
        recovery={recoveryCandidate}
        document={activeDocument}
        canonicalCues={storeCues}
        reviewing={recoveryReviewing}
        busy={recoveryBusy}
        onRestore={handleRestoreRecovery}
        onReview={() => setRecoveryReviewing(value => !value)}
        onDiscard={() => { void handleDiscardRecovery() }}
      />

      <UnsavedLyricChangesDialog
        open={pendingTransition !== null}
        busy={isSaving}
        message={pendingTransition?.message}
        onCancel={() => setPendingTransition(null)}
        onDiscard={() => {
          const pending = pendingTransition
          setPendingTransition(null)
          void discardActiveRecovery().finally(() => {
            abandonActiveLyricDraft()
            markEditorDirty(false)
            if (pending) void pending.action()
          })
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

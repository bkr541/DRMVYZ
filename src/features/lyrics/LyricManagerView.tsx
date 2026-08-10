import { BubbleRevealSlider } from '../../components/vyzualz/react/controls/BubbleRevealSlider'
import { NoticeCard } from '../../components/vyzualz/react/controls/NoticeCard'
import { IconChipButton } from '../../components/vyzualz/react/controls/IconChipButton'
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
import { useReactStore } from '../../stores/reactStore'
import { adaptMIAnalysis, resolveTrackSections } from '../trackIntelligence/trackMapAdapter'
import type { LyricCue, LyricDocument, LyricSectionType, LyricTranscriptionJob } from '../../types/lyrics'
import type { Track } from '../../types'
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
  loadLyricManagerTrackById,
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
import { ConfirmLyricActivationDialog } from './components/ConfirmLyricActivationDialog'
import { ConfirmTrackDeleteDialog } from './components/ConfirmTrackDeleteDialog'
import { LyricSignalPathStatus } from './components/LyricSignalPathStatus'
import { LyricWorkflowStatus } from './components/LyricWorkflowStatus'
import { LyricRecoveryDialog } from './components/LyricRecoveryDialog'
import { MediaUploadModal } from '../../components/vyzualz/MediaUploadModal'
import { WorkspaceRail } from '../../components/vyzualz/layout/WorkspaceRail'
import { UnderlineTabs } from '../../components/vyzualz/react/controls/UnderlineTabs'
import type { PerformanceAppView } from '../../components/vyzualz/appView'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import { loadSavedTrackIntoEngine, SavedTrackLoadCancelledError } from '../../audio/savedTrackLoader'
import type { LyricManagerNavigationIntent, LyricManagerWorkflow } from './lyricNavigation'
import { findSavedTrackLinkCandidates, type SavedTrackLinkCandidate } from './services/savedTrackLinking'
import { LinkSavedTrackDialog } from './components/LinkSavedTrackDialog'
import type { LyricSnapMode } from './editor/lyricCueEditorModel'
import { getRecentLyricTranscriptionJobs } from './services/lyricExtraction'
import type { LyricValidationIssue } from './utils/lyricValidation'
import { toEffectiveLyricTimeMs } from './runtime/lyricPlaybackResolver'
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
  navigationIntent?: LyricManagerNavigationIntent | null
  onNavigationIntentConsumed?: (intentId: string) => void
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

function sectionOptionsFromTimeline(sections: readonly ReactTrackSection[]) {
  return sections.map((section) => ({
    id: section.id,
    label: section.label,
    type: toLyricSectionType(section.type),
    startSec: section.startSec,
    endSec: section.endSec,
  }))
}

function uploadedTrackToManager(track: SavedAudioTrack): LyricManagerTrack {
  return {
    ...track,
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
    needsReview: false,
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
  openVersionTitle,
  activeVersionTitle,
  selectedTrackLoaded,
  selectedTrackPlaying,
  loading,
  onLoadTrack,
  onTogglePlayback,
}: {
  track: LyricManagerTrack | null
  openVersionTitle: string | null
  activeVersionTitle: string | null
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
          <span className="lmv-selected-badge">Selected</span>
          {selectedTrackLoaded && <span className="lmv-loaded-badge">Loaded</span>}
          {selectedTrackPlaying && <span className="lmv-playing-badge">Playing</span>}
        </div>
        <p>{track.artist || 'Unknown artist'}</p>
        <div className="lmv-version-status-row">
          <span className="lmv-open-version-pill">Open version: {openVersionTitle ?? 'None'}</span>
          <span className={`lmv-active-version-pill${activeVersionTitle ? '' : ' lmv-active-version-pill--empty'}`}>
            {activeVersionTitle ? `Active version: ${activeVersionTitle}` : 'No active version'}
          </span>
        </div>
      </div>

      <div className="lmv-track-hero-stats" aria-label="Track details">
        <div className="lmv-track-stat"><strong>{formatDuration(track.durationSec)}</strong><span>Duration</span></div>
        <div className="lmv-track-stat"><strong>{track.bpm ? `${Math.round(track.bpm)} BPM` : '—'}</strong><span>Tempo</span></div>
        <div className="lmv-track-stat"><strong>{track.musicalKey || '—'}</strong><span>Key</span></div>
        <div className="lmv-track-stat"><strong>{formatTrackDate(track.createdAt)}</strong><span>Added</span></div>
      </div>

      <div className="lmv-track-hero-actions">
        <IconChipButton
          onClick={onLoadTrack}
          disabled={loading}
        >
          {loading ? 'Loading…' : selectedTrackLoaded ? 'Reload deck' : 'Load deck'}
        </IconChipButton>
        <IconChipButton
          tone="primary"
          onClick={onTogglePlayback}
          disabled={!selectedTrackLoaded}
        >
          {selectedTrackPlaying ? 'Pause' : 'Preview'}
        </IconChipButton>
      </div>
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
        <button className="lmv-transport-chip" type="button" onClick={onToggleSnap} aria-pressed={snapMode !== 'none'} title="Toggle the cue editor's canonical snap mode">⌕ Snap: {snapMode === 'none' ? 'Off' : snapMode}</button>
      </div>

      <div className="lmv-transport-center">
        <button className="lmv-transport-icon" type="button" disabled={!selectedTrackLoaded} onClick={onTogglePlayback} aria-label={selectedTrackPlaying ? 'Pause lyric preview' : 'Play lyric preview'}>
          {selectedTrackPlaying ? 'Ⅱ' : '▶'}
        </button>
        <div className="lmv-transport-time">
          <strong>{formatMsClock(safeCurrent)}</strong>
          <span>/ {selectedTrack ? formatDuration((safeDuration || (selectedTrack.durationSec ?? 0) * 1000) / 1000) : '0:00'}</span>
        </div>
      </div>

      <div className="lmv-transport-right">
        <label className="lmv-volume-control">
          <span>♬</span>
          <BubbleRevealSlider
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

export function LyricManagerView({
  onBack,
  returnView = 'visualizer',
  navigationIntent = null,
  onNavigationIntentConsumed,
}: Props) {
  const {
    lyricsDisplayEnabled,
    setLyricsDisplayEnabled,
    editorDocument,
    editorDocumentId,
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
    setEditorDocument,
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
    runtimeLyricsStatus,
    runtimeAudioTrackId,
    runtimeActiveDocumentId,
  } = useLyricsStore()

  const engine = useSharedAudio()
  const engineRef = useRef(engine)
  engineRef.current = engine
  const getSignedUrl = useAudioStore((state) => state.getSignedUrl)
  const removeSavedTrackByDbId = useAudioStore((state) => state.removeSavedTrackByDbId)
  const manualTrackSectionsByTrackId = useReactStore((state) => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore((state) => state.suppressedAutoSectionsByTrackId)

  const [currentAudioTimeMs, setCurrentAudioTimeMs] = useState<number | null>(null)
  const [tracks, setTracks] = useState<LyricManagerTrack[]>([])
  const tracksRef = useRef<LyricManagerTrack[]>([])
  tracksRef.current = tracks
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
  const [navigationTarget, setNavigationTarget] = useState<{ cueId: string; wordId?: string | null; revision: number } | null>(null)
  const [latestTranscriptionJob, setLatestTranscriptionJob] = useState<LyricTranscriptionJob | null>(null)
  const [transcriptionJobLoading, setTranscriptionJobLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPurpose, setUploadPurpose] = useState<'canonical' | 'vocal_reference'>('canonical')
  const [uploadedVocalReferenceTrack, setUploadedVocalReferenceTrack] = useState<LyricManagerTrack | null>(null)
  const [linkRuntimeTrack, setLinkRuntimeTrack] = useState<Track | null>(null)
  const [linkCandidates, setLinkCandidates] = useState<SavedTrackLinkCandidate[]>([])
  const [linkSelectedTrackId, setLinkSelectedTrackId] = useState<string | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)
  const [linkConfirming, setLinkConfirming] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
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
  const [activationTarget, setActivationTarget] = useState<{
    id: string | null
    title: string
    saveCurrent: boolean
    openAfter: boolean
  } | null>(null)
  const [activationBusy, setActivationBusy] = useState(false)
  const [trackDeleteTarget, setTrackDeleteTarget] = useState<LyricManagerTrack | null>(null)
  const [trackDeleting, setTrackDeleting] = useState(false)
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false)
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false)
  const mountedRef = useRef(false)
  const accountIdRef = useRef<string | null>(null)
  const selectedTrackIdRef = useRef<string | null>(null)
  const selectedDocumentIntentRef = useRef(0)
  const handledNavigationIntentRef = useRef<string | null>(null)
  const trackListGenerationRef = useRef(0)
  const documentListGenerationRef = useRef(new Map<string, number>())
  const canonicalReconcileSequenceRef = useRef(0)
  const audioRequestRef = useRef({ generation: 0, trackId: null as string | null, accountId: null as string | null })
  const transcriptionJobRequestRef = useRef(0)
  const statusTimerRef = useRef<number | null>(null)
  const statusRequestRef = useRef(0)
  const recoveryReadGenerationRef = useRef(0)
  const recoveryAutosaveTimerRef = useRef<number | null>(null)
  const recoveryMutationChainRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    setUploadedVocalReferenceTrack(null)
  }, [selectedTrack?.dbId])

  const resolveSavedTrackForAi = useCallback(async (audioTrackId: string): Promise<LyricManagerTrack | null> => {
    const accountId = accountIdRef.current
    return accountId ? loadLyricManagerTrackById(accountId, audioTrackId) : null
  }, [])

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
        documentId: state.editorDocumentId,
        logicalDocumentId,
      }, {
        baseServerRevision: state.editorDocument?.revision ?? null,
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
    editorDocumentId,
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
    const trackId = editorDocument?.audioTrackId ?? selectedTrackIdRef.current
    const generation = ++recoveryReadGenerationRef.current
    const identity = {
      userId: accountId,
      trackId: trackId ?? null,
      documentId: editorDocumentId,
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
  }, [editorDocument, editorDocumentId, activeLogicalDocumentId, editorDirty, isLoading, setError])

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
    setNavigationTarget(null)
    setDocuments([])
    setDocumentsLoading(false)
  }, [clearStatus])

  const prepareTrackDraft = useCallback(
    (
      track: LyricManagerTrack,
      dirty = false,
      activateOnSave = false,
    ) => {
      clearStatus()
      selectedDocumentIntentRef.current += 1
      setEditorDocument(null, [], track.dbId)
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
    [clearStatus, selectCue, setEditorDocument],
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
    const request = ++transcriptionJobRequestRef.current
    setLatestTranscriptionJob(null)
    if (!selectedTrack) {
      setTranscriptionJobLoading(false)
      return
    }
    setTranscriptionJobLoading(true)
    void getRecentLyricTranscriptionJobs(selectedTrack.dbId, 1)
      .then(jobs => {
        if (!mountedRef.current || request !== transcriptionJobRequestRef.current || selectedTrackIdRef.current !== selectedTrack.dbId) return
        setLatestTranscriptionJob(jobs[0] ?? null)
      })
      .catch(() => {
        if (!mountedRef.current || request !== transcriptionJobRequestRef.current) return
        setLatestTranscriptionJob(null)
      })
      .finally(() => {
        if (mountedRef.current && request === transcriptionJobRequestRef.current) setTranscriptionJobLoading(false)
      })
  }, [selectedTrack?.dbId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const doSave = useCallback(async (makeActive?: boolean): Promise<boolean> => {
    setError(null)
    const result = await saveActiveLyricDocument(
      storeCues,
      makeActive === undefined ? undefined : { makeActive },
    )
    if (!result?.ok) return false
    showStatus(makeActive ? 'Saved and made active' : 'Saved')
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
      documentId: state.editorDocumentId,
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

  const openTrackWorkflow = useCallback((
    track: LyricManagerTrack,
    workflow: LyricManagerWorkflow,
  ) => {
    requestTransition(
      `Save changes before opening “${track.title}”?`,
      async () => {
        markEditorDirty(false)
        selectTrackState(track)
        prepareTrackDraft(track, false)
        const workflowIntent = selectedDocumentIntentRef.current
        const nextDocuments = await refreshDocuments(track, false)
        if (selectedTrackIdRef.current !== track.dbId
          || selectedDocumentIntentRef.current !== workflowIntent) return

        if (workflow === 'active-lyrics') {
          const active = nextDocuments.find(document => document.isActive) ?? null
          if (active) {
            selectedDocumentIntentRef.current += 1
            await loadLyricDocument(active.id)
            setActiveTab('manual')
          } else {
            prepareTrackDraft(track, false)
            setActiveTab('manual')
            showStatus('This saved track has no active lyric version.')
          }
          return
        }

        if (workflow === 'ai-extract') {
          const preferred = nextDocuments.find(document => document.isActive) ?? nextDocuments[0] ?? null
          if (preferred) {
            selectedDocumentIntentRef.current += 1
            await loadLyricDocument(preferred.id)
          }
          setActiveTab('ai')
          return
        }

        const preferred = nextDocuments.find(document => document.isActive) ?? nextDocuments[0] ?? null
        if (preferred) {
          selectedDocumentIntentRef.current += 1
          await loadLyricDocument(preferred.id)
        } else {
          prepareTrackDraft(track, false)
        }
        setActiveTab('manual')
      },
    )
  }, [
    loadLyricDocument,
    markEditorDirty,
    prepareTrackDraft,
    refreshDocuments,
    requestTransition,
    selectTrackState,
    showStatus,
  ])

  const handleSelectTrack = useCallback(
    (track: LyricManagerTrack) => {
      if (selectedTrack?.dbId === track.dbId) return
      openTrackWorkflow(track, 'timeline')
    },
    [openTrackWorkflow, selectedTrack?.dbId],
  )

  const handleSelectDocument = useCallback(
    (document: LyricDocumentVersion) => {
      if (document.id === editorDocumentId) return
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
    [editorDocumentId, clearStatus, loadLyricDocument, markEditorDirty, requestTransition, selectTrackState],
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
          setEditorDocument(null, full.cues, selectedTrack.dbId)
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
    [requestTransition, selectedTrack, setEditorDocument, showStatus],
  )

  const handleRenameDocument = useCallback(
    async (document: LyricDocumentVersion, title: string) => {
      if (document.id === editorDocumentId && editorDirty) {
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
      editorDocumentId,
      editorDirty,
      refreshDocuments,
      saveLyricDocumentMetadata,
      selectedTrack,
      setDraftTitle,
      setError,
      showStatus,
    ],
  )

  const performVersionActivation = useCallback(async (documentId: string, openAfter: boolean) => {
    clearStatus()
    const result = await activateLyricDocument(documentId)
    if (!result?.ok) return false
    if (selectedTrack) await refreshDocuments(selectedTrack)
    if (openAfter) {
      selectedDocumentIntentRef.current += 1
      await loadLyricDocument(documentId)
      setActiveTab('manual')
    }
    showStatus('Active lyric version updated')
    return true
  }, [activateLyricDocument, clearStatus, loadLyricDocument, refreshDocuments, selectedTrack, showStatus])

  const handleActivateDocument = useCallback(
    (document: LyricDocumentVersion) => {
      requestTransition(
        `Save changes before activating “${document.title}”?`,
        async () => {
          const currentActive = documents.find(candidate => candidate.isActive) ?? null
          if (currentActive && currentActive.id !== document.id) {
            setActivationTarget({ id: document.id, title: document.title, saveCurrent: false, openAfter: false })
            return
          }
          await performVersionActivation(document.id, false)
        },
      )
    },
    [
      documents,
      performVersionActivation,
      requestTransition,
    ],
  )

  const handleRequestDelete = useCallback(
    (document: LyricDocumentVersion) => {
      const openConfirmation = () => setDeleteTarget(document)
      if (document.id === editorDocumentId) {
        requestTransition(
          `Save changes before deleting “${document.title}”?`,
          openConfirmation,
        )
      } else {
        openConfirmation()
      }
    },
    [editorDocumentId, requestTransition],
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const deletingCurrent = deleteTarget.id === editorDocumentId
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
        if (deletingCurrent) setEditorDocument(null, [])
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
    editorDocumentId,
    deleteTarget,
    loadLyricDocument,
    markEditorDirty,
    prepareTrackDraft,
    queueRecoveryMutation,
    refreshDocuments,
    selectedTrack,
    setEditorDocument,
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
        setEditorDocument(null, [])
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
    setEditorDocument,
    setError,
    showStatus,
    trackDeleteTarget,
  ])

  const handleCompletedDraftResolved = useCallback(async () => {
    if (!selectedTrack) return
    await refreshDocuments(selectedTrack)
    const request = ++transcriptionJobRequestRef.current
    setTranscriptionJobLoading(true)
    try {
      const jobs = await getRecentLyricTranscriptionJobs(selectedTrack.dbId, 1)
      if (!mountedRef.current || request !== transcriptionJobRequestRef.current || selectedTrackIdRef.current !== selectedTrack.dbId) return
      setLatestTranscriptionJob(jobs[0] ?? null)
    } catch {
      if (mountedRef.current && request === transcriptionJobRequestRef.current) setLatestTranscriptionJob(null)
    } finally {
      if (mountedRef.current && request === transcriptionJobRequestRef.current) setTranscriptionJobLoading(false)
    }
  }, [refreshDocuments, selectedTrack])

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
          const target = documents.find(document => document.id === documentId)
          const currentActive = documents.find(document => document.isActive) ?? null
          if (currentActive && currentActive.id !== documentId) {
            setActivationTarget({
              id: documentId,
              title: target?.title ?? 'Extracted lyric version',
              saveCurrent: false,
              openAfter: true,
            })
            return
          }
          await performVersionActivation(documentId, true)
        },
      )
    },
    [documents, performVersionActivation, requestTransition],
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

  const handleLoadTrack = useCallback(async (
    requestedTrack: LyricManagerTrack,
    autoplay = false,
  ) => {
    const { data } = await supabase.auth.getUser()
    const requestedAccountId = data.user?.id ?? null
    if (!requestedAccountId || accountIdRef.current !== requestedAccountId) {
      setError('Sign in to load this saved track.')
      return false
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
      const stillOwned = () => mountedRef.current
        && audioRequestRef.current.generation === generation
        && audioRequestRef.current.trackId === requestedTrack.dbId
        && audioRequestRef.current.accountId === requestedAccountId
        && accountIdRef.current === requestedAccountId
      await loadSavedTrackIntoEngine(
        engineRef.current,
        requestedTrack,
        { getSignedUrl },
        { autoplay, shouldCommit: stillOwned },
      )
      const { data: currentAuth } = await supabase.auth.getUser()
      const currentRequestStillOwned = stillOwned()
        && currentAuth.user?.id === requestedAccountId
      if (!currentRequestStillOwned) return false
      setAudioPreviewStates(current => ({
        ...current,
        [requestedTrack.dbId]: { status: 'ready', error: null },
      }))
      showStatus(autoplay ? 'Track loaded and playback started' : 'Track loaded without starting playback')
      return true
    } catch (loadError) {
      if (loadError instanceof SavedTrackLoadCancelledError) return false
      const message = loadError instanceof Error ? loadError.message : 'Failed to load saved track.'
      const stillOwned = mountedRef.current
        && audioRequestRef.current.generation === generation
        && accountIdRef.current === requestedAccountId
      if (!stillOwned) return false
      setAudioPreviewStates(current => ({
        ...current,
        [requestedTrack.dbId]: { status: 'error', error: message },
      }))
      setError(message)
      return false
    } finally {
      if (mountedRef.current && audioRequestRef.current.generation === generation) {
        setAudioPreviewStates(current => {
          const state = current[requestedTrack.dbId]
          if (!state || state.status !== 'loading') return current
          return { ...current, [requestedTrack.dbId]: { status: 'idle', error: null } }
        })
      }
    }
  }, [getSignedUrl, setError, showStatus])

  const handleLoadSelectedTrack = useCallback(async () => {
    if (!selectedTrack) return false
    return handleLoadTrack(selectedTrack, false)
  }, [handleLoadTrack, selectedTrack])

  const handleAnalyzeSelectedTrack = useCallback(async () => {
    if (!selectedTrack) return
    let loaded = selectedTrack.dbId === engineRef.current.currentAudioTrackId
    if (!loaded) loaded = await handleLoadTrack(selectedTrack, false)
    if (!loaded) return
    const current = engineRef.current
    const runtimeTrackId = current.currentTrackId
    if (!runtimeTrackId) {
      setError('The loaded track does not have a runtime identity for analysis.')
      return
    }
    if (current.currentAnalysisStatus === 'queued' || current.currentAnalysisStatus === 'decoding' || current.currentAnalysisStatus === 'analyzing') {
      showStatus('Track analysis is already running.')
      return
    }
    if (current.currentAnalysisStatus === 'failed' || current.currentAnalysisStatus === 'not_analyzed') {
      current.retryAnalysis(runtimeTrackId)
      showStatus('Track analysis queued. Unsaved lyric edits remain open.')
      return
    }
    current.reanalyzeTrack(runtimeTrackId)
    showStatus('Fresh track analysis queued. Unsaved lyric edits remain open.')
  }, [handleLoadTrack, selectedTrack, setError, showStatus])

  const handleNavigateToValidationIssue = useCallback((issue: LyricValidationIssue) => {
    if (!issue.cueId) return
    const cue = storeCues.find(item => item.id === issue.cueId)
    if (!cue) return
    setActiveTab('manual')
    selectCue(cue.id)
    setNavigationTarget({ cueId: cue.id, wordId: issue.wordId, revision: Date.now() })
    if (selectedTrack?.dbId === engineRef.current.currentAudioTrackId) {
      const canonicalCenter = cue.endMs > cue.startMs ? cue.startMs + ((cue.endMs - cue.startMs) / 2) : cue.startMs
      const effectiveCenter = Math.max(0, toEffectiveLyricTimeMs(canonicalCenter, globalOffsetMs))
      engineRef.current.seek(effectiveCenter / 1000)
    }
  }, [globalOffsetMs, selectCue, selectedTrack?.dbId, storeCues])

  const handleTogglePlayback = useCallback(() => {
    if (!selectedTrack || engine.currentAudioTrackId !== selectedTrack.dbId) {
      showStatus('Load the selected track to the deck before previewing it.')
      return
    }
    if (engine.isPlaying) engine.pause()
    else engine.play()
  }, [engine, selectedTrack, showStatus])

  const handleOpenActiveLyrics = useCallback((track: LyricManagerTrack) => {
    openTrackWorkflow(track, 'active-lyrics')
  }, [openTrackWorkflow])

  const handleOpenAiExtract = useCallback((track: LyricManagerTrack) => {
    openTrackWorkflow(track, 'ai-extract')
  }, [openTrackWorkflow])

  const handleMakeOpenVersionActive = useCallback((track: LyricManagerTrack) => {
    if (selectedTrackIdRef.current !== track.dbId || !editorDocumentId) return
    const openVersion = documents.find(document => document.id === editorDocumentId) ?? null
    if (!openVersion || openVersion.isActive) return
    handleActivateDocument(openVersion)
  }, [documents, editorDocumentId, handleActivateDocument])

  const handleOpenLinkSavedTrack = useCallback(async () => {
    const runtimeTrack = engineRef.current.currentTrack
    if (!runtimeTrack || runtimeTrack.dbId) return
    setLinkRuntimeTrack(runtimeTrack)
    setLinkCandidates([])
    setLinkSelectedTrackId(null)
    setLinkError(null)
    setLinkLoading(true)
    try {
      const { data } = await supabase.auth.getUser()
      const accountId = data.user?.id ?? null
      if (!accountId || accountIdRef.current !== accountId) throw new Error('Sign in to search saved User Media tracks.')
      const candidates = await findSavedTrackLinkCandidates(accountId, runtimeTrack)
      if (!mountedRef.current || engineRef.current.currentTrack?.id !== runtimeTrack.id) return
      setLinkCandidates(candidates)
      setLinkSelectedTrackId(candidates.length === 1 ? candidates[0].track.dbId : null)
    } catch (linkSearchError) {
      if (mountedRef.current) {
        setLinkError(linkSearchError instanceof Error ? linkSearchError.message : 'Saved track candidates could not be loaded.')
      }
    } finally {
      if (mountedRef.current) setLinkLoading(false)
    }
  }, [])

  const handleConfirmLinkSavedTrack = useCallback(async () => {
    if (!linkRuntimeTrack || !linkSelectedTrackId) return
    setLinkConfirming(true)
    setLinkError(null)
    try {
      const { data } = await supabase.auth.getUser()
      const accountId = data.user?.id ?? null
      if (!accountId || accountIdRef.current !== accountId) throw new Error('Sign in to link this track.')
      const freshTrack = await loadLyricManagerTrackById(accountId, linkSelectedTrackId)
      if (!freshTrack) throw new Error('That saved track was deleted or is no longer accessible.')
      await loadSavedTrackIntoEngine(engineRef.current, freshTrack, { getSignedUrl })
      if (!mountedRef.current) return
      setTracks(current => mergeTracks(current, [freshTrack]))
      setLinkRuntimeTrack(null)
      setLinkCandidates([])
      setLinkSelectedTrackId(null)
      showStatus('Saved track confirmed and reloaded with its canonical identity.')
      openTrackWorkflow(freshTrack, freshTrack.activeLyricDocumentId ? 'active-lyrics' : 'timeline')
    } catch (linkError) {
      if (mountedRef.current) {
        setLinkError(linkError instanceof Error ? linkError.message : 'The saved track could not be linked.')
      }
    } finally {
      if (mountedRef.current) setLinkConfirming(false)
    }
  }, [getSignedUrl, linkRuntimeTrack, linkSelectedTrackId, openTrackWorkflow, showStatus])

  useEffect(() => {
    if (!navigationIntent || handledNavigationIntentRef.current === navigationIntent.id) return
    handledNavigationIntentRef.current = navigationIntent.id
    let cancelled = false

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const accountId = data.user?.id ?? null
        if (!accountId) throw new Error('Sign in to open this saved track in Lyric Manager.')
        const existing = tracksRef.current.find(track => track.dbId === navigationIntent.targetAudioTrackId) ?? null
        const target = existing ?? await loadLyricManagerTrackById(accountId, navigationIntent.targetAudioTrackId)
        if (cancelled || !mountedRef.current) return
        if (!target) throw new Error('That saved track is no longer available.')
        if (!existing) setTracks(current => mergeTracks(current, [target]))
        openTrackWorkflow(target, navigationIntent.workflow)
      } catch (navigationError) {
        if (!cancelled && mountedRef.current) {
          setError(navigationError instanceof Error ? navigationError.message : 'Lyric Manager navigation failed.')
        }
      } finally {
        if (!cancelled) onNavigationIntentConsumed?.(navigationIntent.id)
      }
    })()

    return () => { cancelled = true }
  }, [navigationIntent, onNavigationIntentConsumed, openTrackWorkflow, setError])

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
    setLyricsDisplayEnabled(true)
    onBack()
  }, [
    editorDirty,
    storeCues,
    engine.currentAudioTrackId,
    onBack,
    preserveDraftForNextEditorExit,
    selectedTrack,
    setLyricsDisplayEnabled,
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
      setUploadOpen(false)
      if (uploadPurpose === 'vocal_reference') {
        setUploadedVocalReferenceTrack(managerTrack)
        setUploadPurpose('canonical')
        setActiveTab('ai')
        showStatus(`“${managerTrack.title}” is selected as the vocal reference. Lyrics will remain attached to the full mix.`)
        return
      }
      setUploadPurpose('canonical')
      requestTransition(
        `Save changes before selecting the newly uploaded track “${managerTrack.title}”?`,
        () => {
          selectTrackState(managerTrack)
          setDocuments([])
          prepareTrackDraft(managerTrack, false)
          setActiveTab('ai')
          showStatus('Track uploaded. Automatic lyric extraction is ready.')
        },
      )
    },
    [prepareTrackDraft, requestTransition, selectTrackState, showStatus, uploadPurpose],
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
      setDocuments(current => [
        next,
        ...current
          .filter(document => document.id !== next.id)
          .map(document => next.isActive ? { ...document, isActive: false } : document),
      ])
    }
  }, [documents, lastCanonicalWrite])

  const activeVersionForSelectedTrack = documents.find(document => document.isActive) ?? null
  const selectedTrackLoaded = selectedTrack?.dbId === engine.currentAudioTrackId
  const selectedTrackPlaying = selectedTrackLoaded && engine.isPlaying
  const getCurrentAudioTimeMs = useCallback(
    () => selectedTrackLoaded && engine.duration > 0
      ? Math.round(engine.getCurrentTime() * 1000)
      : null,
    [engine, selectedTrackLoaded],
  )
  const deckHasPersistedIdentity = engine.currentTrack !== null && engine.currentAudioTrackId !== null
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
  const activeEditorSections = resolveTrackSections({
    analyzedSections: activeEditorAnalysis ? adaptMIAnalysis(activeEditorAnalysis) : [],
    manualSections: runtimeTrackId ? (manualTrackSectionsByTrackId[runtimeTrackId] ?? []) : [],
    suppressedIds: runtimeTrackId ? (suppressedAutoSectionsByTrackId[runtimeTrackId] ?? []) : [],
    durationSec: editorDurationMs / 1000,
  })
  const sectionOptions = sectionOptionsFromTimeline(activeEditorSections)

  useEffect(() => {
    if (!selectedTrack || !selectedTrackLoaded || engine.currentAnalysisStatus !== 'complete' || !engine.currentAnalysis) return
    const analysis = engine.currentAnalysis
    setSelectedTrack(current => current?.dbId === selectedTrack.dbId && current.analysisPayload !== analysis
      ? { ...current, analysisPayload: analysis }
      : current)
    setTracks(current => current.map(track => track.dbId === selectedTrack.dbId && track.analysisPayload !== analysis
      ? { ...track, analysisPayload: analysis }
      : track))
  }, [engine.currentAnalysis, engine.currentAnalysisStatus, selectedTrack, selectedTrackLoaded])

  const hasMore = tracks.length < trackTotal
  const selectedTrackName = selectedTrack?.title ?? null

  const editorPlaceholder = useMemo(() => {
    if (!selectedTrack && !editorDocument)
      return 'Select a track to begin editing lyrics.'
    if (selectedTrack && documents.length === 0 && !editorDocument)
      return 'This track has no lyrics yet.'
    return null
  }, [editorDocument, documents.length, selectedTrack])

  return (
    <div className="lmv-root">
      <LyricManagerHeader
        isSaving={isSaving}
        saveStatus={activeWriteStatus}
        lyricsDisplayEnabled={lyricsDisplayEnabled}
        hasDocument={!!editorDocument}
        draftTitle={draftTitle}
        selectedTrackName={selectedTrackName}
        dirty={editorDirty}
        onBack={() =>
          requestTransition(
            'Save changes before leaving Lyric Manager?',
            onBack,
          )
        }
        onToggleLyricsDisplay={() => setLyricsDisplayEnabled(!lyricsDisplayEnabled)}
        onSave={() => {
          void doSave()
        }}
        onSaveAndMakeActive={() => {
          if (activeVersionForSelectedTrack && activeVersionForSelectedTrack.id !== editorDocumentId) {
            setActivationTarget({
              id: editorDocumentId,
              title: draftTitle || 'Untitled lyric version',
              saveCurrent: true,
              openAfter: false,
            })
            return
          }
          void doSave(true)
        }}
      />

      {(error || statusMsg) && (
        <NoticeCard
          className="lmv-status-bar"
          tone={error ? 'error' : 'info'}
          role={error ? 'alert' : 'status'}
          onDismiss={error ? () => setError(null) : undefined}
          dismissLabel="Dismiss lyric manager error"
        >
          {error ?? statusMsg}
        </NoticeCard>
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
            onLoadTrack={(track, autoplay) => { void handleLoadTrack(track, autoplay) }}
            onOpenActiveLyrics={handleOpenActiveLyrics}
            onOpenAiExtract={handleOpenAiExtract}
            onMakeOpenVersionActive={handleMakeOpenVersionActive}
            canMakeOpenVersionActive={(track) => (
              selectedTrack?.dbId === track.dbId
              && !!editorDocumentId
              && documents.some(document => document.id === editorDocumentId && !document.isActive)
            )}
            onDeleteTrack={handleRequestDeleteTrack}
            onLoadMore={() => {
              void loadTracks(false)
            }}
            onUpload={() => {
              setUploadPurpose('canonical')
              setUploadOpen(true)
            }}
            onRetry={() => {
              void loadTracks(true)
            }}
          />

          <LyricDocumentSidebar
            documents={documents}
            legacyDocuments={legacyDocuments}
            loading={documentsLoading || isLoading}
            openDocumentId={editorDocumentId}
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
            openVersionTitle={editorDocument?.title ?? null}
            activeVersionTitle={activeVersionForSelectedTrack?.title ?? null}
            selectedTrackLoaded={selectedTrackLoaded}
            selectedTrackPlaying={selectedTrackPlaying}
            loading={selectedTrack ? audioPreviewStates[selectedTrack.dbId]?.status === 'loading' : false}
            onLoadTrack={() => {
              void handleLoadSelectedTrack()
            }}
            onTogglePlayback={handleTogglePlayback}
          />

          {engine.currentTrack && !engine.currentAudioTrackId && (
            <section className="lmv-local-track-link" aria-label="Local track identity">
              <div>
                <strong>Local deck file has no saved track identity</strong>
                <span>Link it explicitly to a saved User Media track so runtime lyrics can resolve safely.</span>
              </div>
              <IconChipButton onClick={() => { void handleOpenLinkSavedTrack() }}>
                Link to Saved Track
              </IconChipButton>
            </section>
          )}

          <LyricSignalPathStatus
            selectedTrack={selectedTrack}
            deckTrackPresent={engine.currentTrack !== null}
            deckTrackLoaded={selectedTrackLoaded}
            deckHasPersistedIdentity={deckHasPersistedIdentity}
            activeVersion={activeVersionForSelectedTrack}
            lyricsDisplayEnabled={lyricsDisplayEnabled}
            runtimeStatus={runtimeLyricsStatus}
            runtimeAudioTrackId={runtimeAudioTrackId}
          />

          <UnderlineTabs
            tabs={TAB_LABELS.map(tab => {
              const disabled = tab.id === 'ai'
                ? !selectedTrack
                : (!selectedTrack && !editorDocument)
              return {
                id: tab.id,
                label: tab.label,
                disabled,
                buttonId: `lyric-tab-${tab.id}`,
                ariaControls: `lyric-panel-${tab.id}`,
                title: tab.id === 'ai' && !selectedTrack ? 'Select a stored track first' : undefined,
              }
            })}
            activeTab={activeTab}
            onChange={setActiveTab}
            ariaLabel="Lyric workflow"
            className="lmv-tab-bar"
          />

          <div className="lmv-tab-content" id={`lyric-panel-${activeTab}`} role="tabpanel" aria-labelledby={`lyric-tab-${activeTab}`}>
            {editorPlaceholder && activeTab === 'manual' ? (
              <div className="lmv-editor-placeholder">
                <div>{editorPlaceholder}</div>
                {selectedTrack && (
                  <div className="lmv-editor-placeholder-actions">
                    <IconChipButton
                      tone="primary"
                      onClick={handleNewDocument}
                    >
                      Create Blank Lyrics
                    </IconChipButton>
                    <IconChipButton
                      onClick={handleImportDocument}
                    >
                      Import Lyrics
                    </IconChipButton>
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
                defaultStyle={draftDefaultStyle}
                defaultAnimation={draftDefaultAnimation}
                defaultEffects={draftDefaultEffects}
                onUpdateDefaultStyle={updateDraftDefaultStyle}
                onUpdateDefaultAnimation={updateDraftDefaultAnimation}
                onUpdateDefaultEffects={updateDraftDefaultEffects}
                trackId={runtimeTrackId}
                trackUrl={runtimeTrackUrl}
                decodedBuffer={decodedBuffer}
                durationMs={editorDurationMs}
                currentAudioTimeMs={selectedTrackLoaded ? currentAudioTimeMs : null}
                getCurrentAudioTimeMs={getCurrentAudioTimeMs}
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
                analysis={activeEditorAnalysis}
                timelineSections={activeEditorSections}
                snapMode={snapMode}
                onSnapModeChange={setSnapMode}
                onAnalyzeTrack={handleAnalyzeSelectedTrack}
                analysisActionLabel={beatGridStatus === 'failed' ? 'Retry Track Analysis' : selectedTrackLoaded ? 'Analyze Track' : 'Load & Analyze Track'}
                navigationTarget={navigationTarget}
              />
            ) : activeTab === 'json' ? (
              <JsonLyricImporter onImportToDraft={handleImportToDraft} />
            ) : (
              <AiLyricExtractor
                selectedTrack={selectedTrack}
                existingDocumentCount={documents.length}
                activeVersionId={activeVersionForSelectedTrack?.id ?? null}
                onCompletedDraftResolved={handleCompletedDraftResolved}
                onOpenCompletedDraft={handleOpenCompletedDraft}
                onActivateCompletedDraft={handleActivateCompletedDraft}
                availableTracks={tracks}
                uploadedVocalReferenceTrack={uploadedVocalReferenceTrack}
                onRequestVocalReferenceUpload={() => {
                  setUploadPurpose('vocal_reference')
                  setUploadOpen(true)
                }}
                onResolveSavedTrack={resolveSavedTrackForAi}
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
            document={editorDocument}
            selectedCue={selectedCue}
            currentAudioTimeMs={selectedTrackLoaded ? currentAudioTimeMs : null}
            isPlaying={selectedTrackPlaying}
            globalOffsetMs={globalOffsetMs}
            onNavigateToIssue={handleNavigateToValidationIssue}
            onPreviewInVisualizer={handlePreviewInPerformanceView}
            previewDestination={returnView === 'react' ? 'React' : returnView === 'showManager' ? 'Show Manager' : 'Visualizer'}
            extractionConsole={
              <LyricWorkflowStatus
                selectedTrack={selectedTrack}
                loadedTrackMatches={selectedTrackLoaded}
                activeVersion={activeVersionForSelectedTrack}
                editorDocument={editorDocument}
                cues={storeCues}
                trackMapAvailable={Boolean(activeEditorAnalysis && (trustedBeatGridMs.length >= 2 || activeEditorSections.length > 0))}
                trackMapRevision={activeEditorAnalysis?.analysisVersion ?? null}
                saveStatus={activeWriteStatus}
                saveRevision={lastCanonicalWrite?.sequence ?? null}
                runtimeAudioTrackId={runtimeAudioTrackId}
                runtimeActiveDocumentId={runtimeActiveDocumentId}
                lyricsDisplayEnabled={lyricsDisplayEnabled}
                latestJob={latestTranscriptionJob}
                jobsLoading={transcriptionJobLoading || documentsLoading}
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
        document={editorDocument}
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

      <ConfirmLyricActivationDialog
        targetTitle={activationTarget?.title ?? null}
        currentTitle={activeVersionForSelectedTrack?.title ?? null}
        busy={activationBusy}
        onCancel={() => setActivationTarget(null)}
        onConfirm={() => {
          const target = activationTarget
          if (!target) return
          setActivationBusy(true)
          const action = target.saveCurrent
            ? doSave(true)
            : target.id
              ? performVersionActivation(target.id, target.openAfter)
              : Promise.resolve(false)
          void action.finally(() => {
            setActivationBusy(false)
            setActivationTarget(null)
          })
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

      <LinkSavedTrackDialog
        runtimeTrack={linkRuntimeTrack}
        candidates={linkCandidates}
        selectedTrackId={linkSelectedTrackId}
        loading={linkLoading}
        confirming={linkConfirming}
        error={linkError}
        onSelect={setLinkSelectedTrackId}
        onConfirm={() => { void handleConfirmLinkSavedTrack() }}
        onCancel={() => {
          if (linkConfirming) return
          setLinkRuntimeTrack(null)
          setLinkCandidates([])
          setLinkSelectedTrackId(null)
          setLinkError(null)
        }}
      />

      {uploadOpen && (
        <MediaUploadModal
          audioOnly
          onAudioUploaded={handleUploaded}
          onClose={() => {
            setUploadOpen(false)
            setUploadPurpose('canonical')
          }}
        />
      )}
    </div>
  )
}

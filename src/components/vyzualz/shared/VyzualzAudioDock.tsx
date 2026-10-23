import { AppIcon } from '../../shared/icons/AppIcon'
import { BubbleRevealSlider } from '../react/controls/BubbleRevealSlider'
import { IconMorphToggle } from '../react/controls/IconMorphToggle'
import { isDockBlankSpace } from './dockBlankSpace'
import { useId, useState, useRef, useEffect, useCallback, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore, DEFAULT_PRESETS } from '../../../stores/visualStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useReactStore } from '../../../stores/reactStore'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useTapTempo } from '../hooks/useTapTempo'
import { useWaveformPeaks } from '../hooks/useWaveformPeaks'
import { useRgbWaveformAnalysis } from '../hooks/useRgbWaveformAnalysis'
import { useRgbWaveformStore } from '../../../features/waveform/rgbWaveformStorage'
import {
  createPreparedTrackInputs,
  importRekordboxXml,
  selectRekordboxUsbRoot,
  summarizeRekordboxLibrary,
  type ImportedTrackIntelligence,
  type RekordboxLibrary,
} from '../../../features/rekordboxImport'
import { guessNativeUsbRootFromFile, lookupIndexedRekordboxTracks, scanNativeRekordboxUsbRoot } from '../../../features/rekordboxImport/nativeBridge'
import { PeaksWaveformView } from '../transport/PeaksWaveformView'
import type { WaveformCueCreateRequest } from '../../../features/timeline/waveformCuePoint'
import { buildManualCueMarker } from '../../../features/timeline/manualCuePoint'
import { cueMarkerBelongsToTrack } from '../../../types/cue'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import { InfoPopover } from '../../shared/InfoPopover'
import { DrawerNotice } from './DrawerNotice'
import {
  getAudioSourcePolicySnapshot,
  getLastAudioSourcePolicyMessage,
  isShowManagerTransportReady,
  requestAudioSourceMutation,
  subscribeAudioSourcePolicy,
} from '../../../audio/audioSourcePolicy'
import { createLogger } from '../../../lib/logger'
import { usePageActivities, type AppPageId } from '../../../stores/pageActivityStore'
import { useNotifyCurrentPage } from '../../../stores/notificationStore'

const AUDIO_DOCK_COLLAPSED_STORAGE_KEY = 'drmvyz.audioDock.collapsed.v1'
const rekordboxLoadLog = createLogger('react', 'RekordboxTrackLoad')

function getRootLabel(rootPath: string): string {
  const parts = rootPath.replace(/\\/g, '/').split('/').filter(Boolean)
  return parts[parts.length - 1] ?? 'unknown'
}

function readCollapsedPreference(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(AUDIO_DOCK_COLLAPSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeCollapsedPreference(collapsed: boolean): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AUDIO_DOCK_COLLAPSED_STORAGE_KEY, String(collapsed))
  } catch {
    // Storage can be unavailable in private browsing or embedded runtimes.
  }
}


interface RekordboxHydrationSummary {
  total: number
  imported: number
  realMatches: number
  usbFallbacks: number
  cueCount: number
  primaryReason: string | null
}

function summarizePreparedRekordboxInputs(
  prepared: { imported?: ImportedTrackIntelligence }[],
): RekordboxHydrationSummary {
  const imported = prepared
    .map(input => input.imported)
    .filter((item): item is ImportedTrackIntelligence => Boolean(item))
  const realMatches = imported.filter(item => !item.matchReason.startsWith('usb-mode-'))
  const usbFallbacks = imported.length - realMatches.length
  const primary = realMatches[0] ?? imported[0] ?? null
  return {
    total: prepared.length,
    imported: imported.length,
    realMatches: realMatches.length,
    usbFallbacks,
    cueCount: imported.reduce((sum, item) => sum + item.cueMarkers.length, 0),
    primaryReason: primary?.matchReason ?? null,
  }
}

function formatRekordboxDiagnostic(summary: RekordboxHydrationSummary): string {
  const matchState = summary.realMatches > 0 ? 'yes' : 'no'
  const reason = summary.primaryReason ? ` · ${summary.primaryReason}` : ''
  return `Matched: ${matchState}${reason} · Imported cues: ${summary.cueCount}`
}

function formatRekordboxBadgeDiagnostic(summary: RekordboxHydrationSummary): string {
  const matchState = summary.realMatches > 0 ? 'yes' : 'no'
  return `Match ${matchState} · ${summary.cueCount} cue${summary.cueCount === 1 ? '' : 's'}`
}

function fmtPlayTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '--:--.--'
  const m  = Math.floor(secs / 60)
  const s  = Math.floor(secs % 60)
  const cs = Math.floor((secs % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ── BPM display helpers ───────────────────────────────────────────────────────

type BpmState =
  | { kind: 'none' }
  | { kind: 'analyzing' }
  | { kind: 'value'; bpm: number; analyzed: number | null; source: string | null }
  | { kind: 'failed'; error: string | null }
  /** Analysis completed but BPM detection specifically failed (rest of analysis is valid). */
  | { kind: 'unavailable' }

type PlaylistLoadMode = 'append' | 'replace'

function deriveBpmState(
  source:   'file' | 'microphone' | 'demo',
  hasTrack: boolean,
  status:   string,
  effectiveBpm: number | null,
  analyzedBpm:  number | null,
  bpmSource:    string | null,
  error:        string | null,
): BpmState {
  if (source === 'demo') {
    return { kind: 'value', bpm: 120, analyzed: null, source: 'demo' }
  }
  if (source === 'microphone' || !hasTrack) {
    return { kind: 'none' }
  }
  // file source with a track
  if (status === 'queued' || status === 'decoding' || status === 'analyzing') {
    return { kind: 'analyzing' }
  }
  if (status === 'complete') {
    if (effectiveBpm !== null) {
      const overrideActive = bpmSource === 'manual_override' || bpmSource === 'live_analysis'
      return {
        kind:     'value',
        bpm:      effectiveBpm,
        analyzed: overrideActive ? analyzedBpm : null,
        source:   bpmSource,
      }
    }
    // Analysis completed but BPM detection failed within it.
    return { kind: 'unavailable' }
  }
  if (status === 'failed') {
    return { kind: 'failed', error }
  }
  return { kind: 'none' }
}

export interface VyzualzAudioDockProps {
  compact?: boolean
  /** Allow the user to collapse the dock independently of Stage Focus. */
  expandable?: boolean
  deckLabel?: string
  /** Keep the waveform viewport aligned with the Track Map directly above it. */
  unifiedTimeline?: boolean
  /** Select the waveform rendering language used by this dock. */
  waveformAppearance?: 'rgb' | 'deck'
  /** Render the Rekordbox tools dropdown into this element (e.g. the top
   *  header row) instead of its default spot in the dock. State and import
   *  handlers stay owned by this component either way. Ignored when
   *  `showAudioSourceControl` is set — that consolidates Rekordbox into the
   *  same popover as the audio source selector instead. */
  rekordboxMenuPortalTarget?: HTMLElement | null
  /** Render a single compact "Source" control (audio input selector +
   *  Rekordbox tools, consolidated into one icon-button + popover) in the
   *  BPM row's empty second row instead of leaving that space unused.
   *  Callers that render their own Input dropdown elsewhere (e.g. the
   *  React view header) should stop doing so once this is enabled. */
  showAudioSourceControl?: boolean
  /** Optional action rendered in the lower reserved key immediately left of Cue. */
  lowerReservedAction?: ReactNode
  /** Header activity destination for this dock's track-analysis work. */
  activityPage?: AppPageId
}

export function VyzualzAudioDock({
  compact = false,
  expandable = false,
  deckLabel,
  unifiedTimeline = false,
  waveformAppearance = 'rgb',
  rekordboxMenuPortalTarget = null,
  showAudioSourceControl = false,
  lowerReservedAction,
  activityPage = 'react',
}: VyzualzAudioDockProps) {
  const {
    presets, activePresetId, bpmSync, toggleBpmSync, setPlaying,
    cuePoint, setCuePoint,
    waveformZoom, setWaveformZoom, cueMarkers, addCueMarker, removeCueMarker, updateCueMarker,
  } = useVisualStore(useShallow(s => ({
    presets:            s.presets,
    activePresetId:     s.activePresetId,
    bpmSync:            s.bpmSync,
    toggleBpmSync:      s.toggleBpmSync,
    setPlaying:         s.setPlaying,
    cuePoint:           s.cuePoint,
    setCuePoint:        s.setCuePoint,
    waveformZoom:       s.waveformZoom,
    setWaveformZoom:    s.setWaveformZoom,
    cueMarkers:         s.cueMarkers,
    addCueMarker:        s.addCueMarker,
    removeCueMarker:     s.removeCueMarker,
    updateCueMarker:     s.updateCueMarker,
  })))

  const preset            = presets.find(p => p.id === activePresetId) ?? presets[0] ?? DEFAULT_PRESETS[0]
  const engine            = useSharedAudio()
  const fileInputId       = useId()
  const rekordboxXmlInputId = useId()
  const rekordboxActionSelectId = useId()
  const audioSourceSelectId = useId()
  const { handleTap } = useTapTempo()

  const [collapsedByUser, setCollapsedByUser] = useState(() => (
    expandable ? readCollapsedPreference() : false
  ))
  const audioSourceTriggerRef = useRef<HTMLButtonElement>(null)
  const playlistTriggerRef = useRef<HTMLButtonElement>(null)
  const rekordboxLoadGenerationRef = useRef(0)
  const [audioSourcePopoverOpen, setAudioSourcePopoverOpen] = useState(false)
  const [playlistPopoverOpen, setPlaylistPopoverOpen] = useState(false)
  const [playlistLoadMode, setPlaylistLoadMode] = useState<PlaylistLoadMode>('replace')
  const [rekordboxLibrary, setRekordboxLibrary] = useState<RekordboxLibrary | null>(null)
  const [rekordboxStatus, setRekordboxStatus] = useState<string | null>(null)
  const [rekordboxDiagnostic, setRekordboxDiagnostic] = useState<string | null>(null)
  const [rekordboxBusy, setRekordboxBusy] = useState(false)
  const [rekordboxUsbMode, setRekordboxUsbMode] = useState(false)
  const [dismissedSourceLockAttempt, setDismissedSourceLockAttempt] = useState<number | null>(null)
  const [dismissedTrackLoadError, setDismissedTrackLoadError] = useState<string | null>(null)
  const notifyPage = useNotifyCurrentPage()
  const audioSourcePolicySnapshot = useSyncExternalStore(
    subscribeAudioSourcePolicy,
    getAudioSourcePolicySnapshot,
    getAudioSourcePolicySnapshot,
  )
  const [audioSourcePolicyAppView, , blockedAttemptIdText] = audioSourcePolicySnapshot.split('|')
  const sourceSelectionLocked = audioSourcePolicyAppView === 'showManager'
  const liveInputSelected = engine.source === 'microphone'
  const trackSourceLocked = sourceSelectionLocked || liveInputSelected
  const trackSourceLockTitle = sourceSelectionLocked
    ? 'Audio track loading is locked while in Show Manager'
    : liveInputSelected
      ? 'Audio track controls are unavailable while Live Input is selected'
      : undefined
  const sourceLockAttemptId = Number.parseInt(blockedAttemptIdText ?? '0', 10) || 0
  const sourceLockMessage = getLastAudioSourcePolicyMessage()
  const showSourceLockMessage = sourceSelectionLocked
    && sourceLockMessage !== null
    && dismissedSourceLockAttempt !== sourceLockAttemptId

  const dockCollapsed = compact || (expandable && collapsedByUser)

  useEffect(() => {
    if (!expandable) return
    writeCollapsedPreference(collapsedByUser)
  }, [collapsedByUser, expandable])


  const track    = engine.currentTrack
  const hasTrack = engine.tracks.length > 0
  const hasRekordboxCues = (track?.importedCueMarkers?.length ?? 0) > 0
  const hasRekordboxSections = Boolean(
    (track?.importedRekordboxPhrases?.length ?? 0) > 0
    || (track?.importedAnalysisSeed?.rekordboxPhrases?.length ?? 0) > 0
    || (engine.currentAnalysis?.rekordboxSourceData?.phrases.length ?? 0) > 0,
  )
  const hasRekordboxMetadata = Boolean(track?.externalMetadata && [
    track.externalMetadata.sourceTrackId,
    track.externalMetadata.title,
    track.externalMetadata.artist,
    track.externalMetadata.album,
    track.externalMetadata.genre,
    track.externalMetadata.label,
    track.externalMetadata.bpm,
    track.externalMetadata.musicalKey,
    track.externalMetadata.durationSec,
  ].some(value => value != null && value !== ''))
  const rekordboxSeed = track?.importedAnalysisSeed
  const hasRekordboxAnalysisData = Boolean(
    rekordboxSeed && (
      rekordboxSeed.bpm != null
      || rekordboxSeed.key != null
      || (rekordboxSeed.beatGrid?.length ?? 0) > 0
      || (rekordboxSeed.downbeats?.length ?? 0) > 0
      || Object.values(rekordboxSeed.featureAvailability ?? {}).some(Boolean)
    ),
  )
  const hasRekordboxData = hasRekordboxCues
    || hasRekordboxSections
    || hasRekordboxMetadata
    || hasRekordboxAnalysisData
  const sourceIndicator = liveInputSelected
    ? { kind: 'live', name: 'Live Input', tag: 'ACTIVE', description: 'Live Input active' }
    : hasRekordboxData
      ? {
          kind: 'rekordbox',
          name: 'Rekordbox',
          tag: hasRekordboxCues && hasRekordboxSections
            ? 'CUES · SECTIONS'
            : hasRekordboxCues
              ? 'CUES'
              : hasRekordboxSections
                ? 'SECTIONS'
                : 'DATA',
          description: `Rekordbox data loaded${hasRekordboxCues ? ', cues' : ''}${hasRekordboxSections ? ', sections' : ''}`,
        }
      : track
        ? { kind: 'file', name: 'Audio Track', tag: 'FILE', description: 'Audio track loaded without Rekordbox data' }
        : engine.source === 'demo'
          ? { kind: 'demo', name: 'Demo Audio', tag: 'DEMO', description: 'Demo audio source active' }
          : { kind: 'none', name: 'No Source', tag: 'OFFLINE', description: 'No audio source loaded' }
  const transportReady = isShowManagerTransportReady(engine.currentAudioTrackId)

  useEffect(() => {
    if (!sourceSelectionLocked || transportReady || !engine.isPlaying) return
    // Entering an empty Show Manager session or switching Shows must never leave
    // an unrelated pre-existing source audibly running behind the locked dock.
    engine.pause()
    setPlaying(false)
  }, [engine.isPlaying, engine.pause, setPlaying, sourceSelectionLocked, transportReady])

  const manualTrackSectionsByTrackId = useReactStore(state => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(state => state.suppressedAutoSectionsByTrackId)

  const trackId = track?.id ?? null
  const { peaks, loading: waveformPeaksLoading } = useWaveformPeaks(
    trackId,
    trackId ? engine.getDecodedBuffer(trackId) : undefined,
    track?.url ?? null,
  )

  // Trigger RGB waveform analysis whenever a track's main analysis completes
  useRgbWaveformAnalysis(engine)

  // Read the current track's RGB waveform from the store (null while analyzing)
  const currentKey = track?.analysisRuntime.analysisKey ?? ''
  const rgbWaveformEntry = useRgbWaveformStore(s => s.waveforms[currentKey])
  const rgbAnalysis = rgbWaveformEntry?.analysis ?? null
  const trackAnalysisActivity = engine.currentAnalysisStatus === 'queued'
    ? 'Preparing track analysis'
    : engine.currentAnalysisStatus === 'decoding'
      ? 'Decoding audio'
      : engine.currentAnalysisStatus === 'analyzing'
        ? 'Analyzing track'
        : false
  usePageActivities(activityPage, 'audio-dock-analysis', {
    'track-analysis': trackAnalysisActivity,
    'waveform-peaks': waveformPeaksLoading && 'Building waveform',
    'rgb-waveform': (rgbWaveformEntry?.status === 'queued' || rgbWaveformEntry?.status === 'analyzing') && 'Analyzing waveform color',
    'beat-grid': engine.currentBpmReanalysisStatus === 'reanalyzing' && 'Reanalyzing beat grid',
    'rekordbox-metadata': rekordboxBusy && 'Loading Rekordbox metadata',
  })

  // ── BPM state derivation ──────────────────────────────────────────────────
  const bpmState = deriveBpmState(
    engine.source,
    hasTrack,
    engine.currentAnalysisStatus,
    engine.currentEffectiveBpm,
    engine.currentAnalyzedBpm,
    engine.currentBpmSource,
    engine.currentAnalysisError,
  )

  const canEditBpm  = bpmState.kind === 'value' && engine.source === 'file' && !!track
  const hasOverride = bpmState.kind === 'value' && (bpmState.source === 'manual_override' || bpmState.source === 'live_analysis')

  const [bpmEditing, setBpmEditing] = useState(false)
  const [bpmDraft,   setBpmDraft]   = useState('')
  const bpmInputRef = useRef<HTMLInputElement>(null)

  // ── Stale-analysis banner state ───────────────────────────────────────────
  const [dismissedBpmForTrack, setDismissedBpmForTrack] = useState<{ trackId: string; bpm: number } | null>(null)
  const [showReanalyzeConfirm, setShowReanalyzeConfirm] = useState(false)

  const gridStale            = track?.analysisRuntime.gridStale ?? false
  const bpmReanalysisStatus  = engine.currentBpmReanalysisStatus
  const isReanalyzing        = bpmReanalysisStatus === 'reanalyzing'
  // The BPM the current grid was built from (falls back to detected bpm)
  const analysisBpm          = engine.currentAnalysis?.bpmUsedForGrid ?? engine.currentAnalysis?.bpm ?? null
  const effectiveBpm         = engine.currentEffectiveBpm
  const isComplete           = engine.currentAnalysisStatus === 'complete' && engine.currentAnalysis != null

  const autoSectionCount = resolveTrackSections({
    analyzedSections: engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : [],
    manualSections: trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : [],
    suppressedIds: trackId ? (suppressedAutoSectionsByTrackId[trackId] ?? []) : [],
    durationSec: Math.max(engine.duration, (engine.currentAnalysis?.durationMs ?? 0) / 1000),
  }).filter(section => section.provenance?.authority === 'automatic').length

  const showStaleBanner = (
    isComplete &&
    gridStale &&
    hasOverride &&
    analysisBpm !== null &&
    effectiveBpm !== null &&
    !(dismissedBpmForTrack?.trackId === track?.id && dismissedBpmForTrack?.bpm === effectiveBpm)
  )

  // Reset confirm state whenever BPM or track changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setShowReanalyzeConfirm(false) }, [effectiveBpm, track?.id])

  const startBpmEdit = () => {
    if (!canEditBpm) return
    const current = engine.currentEffectiveBpm ?? 120
    setBpmDraft(String(Math.round(current)))
    setBpmEditing(true)
    setTimeout(() => { bpmInputRef.current?.select() }, 0)
  }

  const commitBpmEdit = () => {
    const v = parseInt(bpmDraft, 10)
    if (!isNaN(v) && track) engine.setBpmOverride(track.id, Math.max(40, Math.min(300, v)))
    setBpmEditing(false)
  }

  const handleBpmStep = (delta: number) => {
    if (!canEditBpm || !track) return
    const base = engine.currentEffectiveBpm ?? 120
    engine.setBpmOverride(track.id, Math.max(40, Math.min(300, Math.round(base) + delta))
    )
  }

  const handleBpmScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEditBpm || !track) return
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    engine.setBpmOverride(track.id, Math.round(40 + fraction * (300 - 40)))
  }

  const handleClearOverride = () => {
    if (!track) return
    engine.setBpmOverride(track.id, null)
  }

  const handleRetry = () => {
    if (!track) return
    engine.retryAnalysis(track.id)
  }

  // ── Stale-banner handlers ─────────────────────────────────────────────────
  const handleKeepExisting = () => {
    if (!track || effectiveBpm === null) return
    setDismissedBpmForTrack({ trackId: track.id, bpm: effectiveBpm })
    setShowReanalyzeConfirm(false)
  }

  const handleResnap = () => {
    if (!track || effectiveBpm === null) return
    setShowReanalyzeConfirm(false)
    engine.reanalyzeWithBpmOverride(track.id, { bpm: effectiveBpm, mode: 'resnap' })
  }

  const handleReanalyzeClick = () => {
    if (!track || effectiveBpm === null) return
    if (autoSectionCount > 0) {
      setShowReanalyzeConfirm(true)
    } else {
      engine.reanalyzeWithBpmOverride(track.id, { bpm: effectiveBpm, mode: 'reanalyze' })
    }
  }

  const handleReanalyzeConfirm = () => {
    if (!track || effectiveBpm === null) return
    setShowReanalyzeConfirm(false)
    engine.reanalyzeWithBpmOverride(track.id, { bpm: effectiveBpm, mode: 'reanalyze' })
  }

  // ── File and Rekordbox input ─────────────────────────────────────────────
  /**
   * Sets the small status line beside the Rekordbox menu. Pass `outcome` for a finished import, scan or failure so the
   * result is also listed in the Notifications drawer; progress messages ("metadata loading…") stay in the status line.
   */
  const setRekordboxStatusWithDiagnostic = (
    status: string | null,
    summary?: RekordboxHydrationSummary | null,
    outcome?: { tone: 'success' | 'info' | 'warning' | 'error'; title: string },
  ) => {
    setRekordboxStatus(status)
    setRekordboxDiagnostic(summary ? formatRekordboxBadgeDiagnostic(summary) : null)
    if (outcome && status) notifyPage({ tone: outcome.tone, title: outcome.title, message: status })
  }

  const rehydrateCurrentTrackFromRekordbox = (
    library: RekordboxLibrary | null,
    options: { forceUsbMode?: boolean } = {},
  ): { summary: RekordboxHydrationSummary | null; hydrated: boolean; hadCurrentFile: boolean } => {
    if (liveInputSelected) return { summary: null, hydrated: false, hadCurrentFile: Boolean(engine.currentTrack?.sourceFile) }
    const currentTrack = engine.currentTrack
    const currentFile = currentTrack?.sourceFile
    if (!currentTrack || !currentFile) return { summary: null, hydrated: false, hadCurrentFile: false }

    const prepared = createPreparedTrackInputs([currentFile], library, options)
    const summary = summarizePreparedRekordboxInputs(prepared)
    const shouldHydrate = summary.realMatches > 0 || summary.usbFallbacks > 0
    const imported = prepared[0]?.imported
    const hydrated = Boolean(shouldHydrate && imported && engine.hydrateTrackMetadata(currentTrack.id, imported))

    return { summary, hydrated, hadCurrentFile: true }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    if (liveInputSelected) return
    const selected = Array.from(files)
    const audio = selected.filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    const skipped = selected.length - audio.length
    if (skipped > 0) {
      notifyPage({
        tone: 'warning',
        title: audio.length === 0 ? 'No audio files added' : 'Some files were skipped',
        message: audio.length === 0
          ? `${selected.length === 1 ? `"${selected[0]!.name}" is` : `Those ${selected.length} files are`} not a supported audio file. Choose MP3, WAV, AIFF, M4A, OGG or FLAC.`
          : `${skipped} file${skipped === 1 ? ' was' : 's were'} not a supported audio type and ${skipped === 1 ? 'was' : 'were'} not added.`,
      })
    }
    if (!audio.length) return
    if (!requestAudioSourceMutation()) return

    const requestId = `track-load-${++rekordboxLoadGenerationRef.current}`
    const startedAt = Date.now()
    const guessedRoot = audio.map(guessNativeUsbRootFromFile).find((root): root is string => Boolean(root))

    const mutationOptions = { notifyOnBlocked: false }
    const shouldForceUsbMode = rekordboxUsbMode || rekordboxLibrary?.source === 'rekordbox_usb'
    const candidatePrepared = rekordboxLibrary || shouldForceUsbMode
      ? createPreparedTrackInputs(audio, rekordboxLibrary, { forceUsbMode: shouldForceUsbMode })
      : null
    const candidateSummary = candidatePrepared ? summarizePreparedRekordboxInputs(candidatePrepared) : null
    // A USB-mode fallback is not metadata. Keep the fast audio load, then query
    // the persisted index instead of treating the fallback as a completed match.
    const prepared = guessedRoot && candidateSummary?.realMatches === 0 ? null : candidatePrepared
    let loadedTracks: typeof engine.tracks = []
    if (playlistLoadMode === 'replace' && engine.tracks.length > 0) {
      if (prepared) engine.replacePreparedTracks(prepared, mutationOptions)
      else loadedTracks = engine.replaceTracks(audio, mutationOptions)
    } else if (prepared) engine.addPreparedTracks(prepared, mutationOptions)
    else loadedTracks = engine.addTracks(audio, mutationOptions)
    if (engine.source !== 'file') engine.setSource('file', mutationOptions)
    rekordboxLoadLog.info('runtime track created; media readiness is reported by AudioEngine', {
      requestId,
      elapsedMs: Date.now() - startedAt,
      trackCount: audio.length,
      runtimeTrackIds: loadedTracks.map(track => track.id),
      metadataAlreadyAvailable: Boolean(prepared),
    })

    if (prepared) {
      const summary = summarizePreparedRekordboxInputs(prepared)
      const matchedPhrase = summary.realMatches > 0
        ? `Matched ${summary.realMatches}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} to Rekordbox metadata.`
        : summary.usbFallbacks > 0
          ? `No Rekordbox metadata match; marked ${summary.usbFallbacks}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} as USB Mode only.`
          : rekordboxLibrary ? 'Rekordbox library loaded, but no selected audio files matched.' : null

      setRekordboxStatusWithDiagnostic([
        matchedPhrase,
        formatRekordboxDiagnostic(summary),
      ].filter(Boolean).join(' '), summary, summary.realMatches > 0
        ? { tone: 'success', title: 'Rekordbox metadata applied' }
        : { tone: 'info', title: 'No Rekordbox match' })
      rekordboxLoadLog.info('Rekordbox metadata ready during initial audio load', {
        requestId,
        elapsedMs: Date.now() - startedAt,
        ...summary,
      })
      return
    }

    if (!guessedRoot) return

    setRekordboxBusy(true)
    setRekordboxStatusWithDiagnostic('Audio ready · Rekordbox metadata loading…')
    const metadataRequestedAt = Date.now()
    rekordboxLoadLog.info('Rekordbox indexed metadata lookup started', {
      requestId,
      rootLabel: getRootLabel(guessedRoot),
      trackCount: audio.length,
      runtimeTrackIds: loadedTracks.map(track => track.id),
    })
    void (async () => {
      const indexed = await lookupIndexedRekordboxTracks(audio)
      if (indexed?.library && indexed.hitCount > 0) {
        rekordboxLoadLog.info('Rekordbox indexed metadata lookup hit', {
          requestId,
          elapsedMs: Date.now() - metadataRequestedAt,
          lookupMs: indexed.lookupMs ?? null,
          matchedTrackCount: indexed.hitCount,
        })
        return {
          result: {
            cancelled: false,
            library: indexed.library,
            warnings: [],
            detectedPdbFiles: indexed.library.stats.detectedPdbFiles,
            detectedAnlzFiles: indexed.library.stats.detectedAnlzFiles,
            scannedRootName: indexed.selectedRootName ?? undefined,
            scannedRootPath: indexed.selectedRootPath ?? undefined,
            parserMode: 'hybrid' as const,
            diagnostics: undefined,
          },
          metadataSource: 'index' as const,
        }
      }

      rekordboxLoadLog.info('Rekordbox index miss; falling back to USB scan', {
        requestId,
        elapsedMs: Date.now() - metadataRequestedAt,
        hasIndex: Boolean(indexed?.hasIndex),
      })
      return {
        result: await scanNativeRekordboxUsbRoot(guessedRoot),
        metadataSource: 'scan' as const,
      }
    })()
      .then(({ result, metadataSource }) => {
        const bridgeReceivedAt = Date.now()
        const ipcPreparedAt = result?.diagnostics?.ipcPreparedAtEpochMs
        rekordboxLoadLog.info('Rekordbox native bridge response received', {
          requestId,
          metadataSource,
          bridgeRoundTripMs: bridgeReceivedAt - metadataRequestedAt,
          ipcDeliveryMs: typeof ipcPreparedAt === 'number' ? Math.max(0, bridgeReceivedAt - ipcPreparedAt) : null,
          nativeTimings: result?.diagnostics ?? null,
        })
        if (!result?.library || result.cancelled) {
          setRekordboxStatusWithDiagnostic('Audio ready · No readable Rekordbox metadata was found.', null, { tone: 'warning', title: 'No Rekordbox metadata found' })
          rekordboxLoadLog.warn('Rekordbox metadata scan finished without a usable library', {
            requestId,
            elapsedMs: Date.now() - startedAt,
            cancelled: Boolean(result?.cancelled),
          })
          return
        }

        if (metadataSource === 'scan') setRekordboxLibrary(result.library)
        setRekordboxUsbMode(true)
        const matchingStartedAt = Date.now()
        const hydrated = createPreparedTrackInputs(audio, result.library, { forceUsbMode: true })
        const matchingMs = Date.now() - matchingStartedAt
        const summary = summarizePreparedRekordboxInputs(hydrated)
        const hydrationStartedAt = Date.now()
        let hydratedTrackCount = 0
        hydrated.forEach((input, index) => {
          const target = loadedTracks[index]
          if (target && input.imported && engine.hydrateTrackMetadata(target.id, input.imported)) {
            hydratedTrackCount += 1
          }
        })
        const hydrationMs = Date.now() - hydrationStartedAt
        setRekordboxStatusWithDiagnostic([
          `Detected Rekordbox USB from loaded track path and parsed ${summarizeRekordboxLibrary(result.library)} with the native bridge.`,
          summary.realMatches > 0
            ? `Matched ${summary.realMatches}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} to Rekordbox metadata.`
            : `No Rekordbox metadata match; marked ${summary.usbFallbacks}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} as USB Mode only.`,
          formatRekordboxDiagnostic(summary),
        ].join(' '), summary, summary.realMatches > 0
          ? { tone: 'success', title: 'Rekordbox metadata applied' }
          : { tone: 'info', title: 'No Rekordbox match' })
        rekordboxLoadLog.info('Rekordbox metadata ready and applied in place', {
          requestId,
          elapsedMs: Date.now() - startedAt,
          hydratedTrackCount,
          parserMode: result.parserMode,
          detectedPdbFiles: result.detectedPdbFiles,
          detectedAnlzFiles: result.detectedAnlzFiles,
          metadataSource,
          bridgeRoundTripMs: bridgeReceivedAt - metadataRequestedAt,
          ipcDeliveryMs: typeof ipcPreparedAt === 'number' ? Math.max(0, bridgeReceivedAt - ipcPreparedAt) : null,
          matchingMs,
          hydrationMs,
          ...summary,
        })
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err)
        setRekordboxStatusWithDiagnostic(`Audio ready · Rekordbox metadata unavailable: ${message}`, null, { tone: 'warning', title: 'Rekordbox metadata unavailable' })
        rekordboxLoadLog.error('Rekordbox metadata scan failed after runtime track creation', {
          requestId,
          elapsedMs: Date.now() - startedAt,
          error: message,
        })
      })
      .finally(() => setRekordboxBusy(false))
  }

  const handleRekordboxXml = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (liveInputSelected) return
    setRekordboxBusy(true)
    try {
      const library = await importRekordboxXml(files)
      setRekordboxLibrary(library)
      const hydration = rehydrateCurrentTrackFromRekordbox(library, { forceUsbMode: false })

      const currentTrackMessage = hydration.hadCurrentFile
        ? hydration.hydrated && hydration.summary
          ? `Current track rehydrated from XML. ${formatRekordboxDiagnostic(hydration.summary)}.`
          : hydration.summary
            ? `Current track did not match this XML and was left unchanged. ${formatRekordboxDiagnostic(hydration.summary)}.`
            : 'Current track could not be rehydrated from XML.'
        : 'Load/replace audio to hydrate cues and metadata.'

      setRekordboxStatusWithDiagnostic(
        `Rekordbox XML ready: ${summarizeRekordboxLibrary(library)}. ${currentTrackMessage}`,
        hydration.summary,
        { tone: 'success', title: 'Rekordbox XML imported' },
      )
    } catch (err) {
      setRekordboxStatusWithDiagnostic(err instanceof Error ? err.message : String(err), null, { tone: 'error', title: 'Rekordbox XML import failed' })
    } finally {
      setRekordboxBusy(false)
    }
  }

  const handleRekordboxUsbRoot = async () => {
    if (liveInputSelected) return
    setRekordboxBusy(true)
    try {
      const result = await selectRekordboxUsbRoot()
      if (result.cancelled) {
        setRekordboxStatusWithDiagnostic('USB scan canceled. No files were loaded or replaced.', null, { tone: 'info', title: 'USB scan canceled' })
        return
      }

      setRekordboxUsbMode(true)
      if (result.library) setRekordboxLibrary(result.library)

      const hydration = rehydrateCurrentTrackFromRekordbox(result.library ?? rekordboxLibrary, { forceUsbMode: true })
      const summary = result.library ? summarizeRekordboxLibrary(result.library) : 'USB Mode armed'
      const bridgeLabel = result.usedNativeBridge
        ? `Native parser${result.parserMode ? ` (${result.parserMode})` : ''}`
        : result.usedFileSystemAccessApi
          ? 'Browser probe only; cue import requires XML or the native bridge'
          : 'USB Mode fallback only; cue import requires XML or the native bridge'
      const detection = [
        result.detectedPdbFiles > 0 ? `${result.detectedPdbFiles} export.pdb` : null,
        result.detectedAnlzFiles > 0 ? `${result.detectedAnlzFiles} ANLZ` : null,
      ].filter(Boolean).join(' · ')
      const warnings = [...result.warnings, ...(result.library?.warnings ?? [])]
      const currentTrackMessage = hydration.hadCurrentFile
        ? hydration.summary?.realMatches
          ? 'Current track matched and was rehydrated as Rekordbox USB.'
          : hydration.summary?.usbFallbacks
            ? 'Current track was marked as USB Mode only; no cue metadata was imported.'
            : 'Current track was not matched to Rekordbox USB metadata.'
        : 'Load a track to attach USB metadata mode.'
      setRekordboxStatusWithDiagnostic([
        result.scannedRootName ? `USB ${result.scannedRootName}: ${summary}.` : `${summary}.`,
        bridgeLabel,
        detection ? `Detected ${detection}.` : null,
        currentTrackMessage,
        hydration.summary ? formatRekordboxDiagnostic(hydration.summary) : null,
        warnings.length ? warnings[0] : null,
      ].filter(Boolean).join(' '), hydration.summary, { tone: warnings.length ? 'warning' : 'success', title: 'Rekordbox USB scanned' })
    } catch (err) {
      setRekordboxStatusWithDiagnostic(err instanceof Error ? err.message : String(err), null, { tone: 'error', title: 'Rekordbox USB scan failed' })
    } finally {
      setRekordboxBusy(false)
    }
  }

  const toggleRekordboxUsbMode = () => {
    if (liveInputSelected) return
    setRekordboxUsbMode(current => {
      const next = !current
      setRekordboxStatusWithDiagnostic(next
        ? 'USB Mode armed. The next loaded track will be marked as Rekordbox USB only if no XML/native match is available; cue points still require a metadata match.'
        : 'USB Mode off. New tracks load as normal local audio unless matched to RB XML.')
      return next
    })
  }

  const handleTogglePlayback = () => {
    if (engine.isPlaying) { engine.pause(); setPlaying(false) }
    else                  { engine.play();  setPlaying(true) }
  }

  const handlePreviousTrack = () => {
    engine.prev()
    setPlaying(true)
  }

  const handleNextTrack = () => {
    engine.next()
    setPlaying(true)
  }

  const handleSelectPlaylistTrack = (index: number) => {
    if (trackSourceLocked || index === engine.currentIndex) return
    engine.selectTrack(index)
    setPlaying(true)
  }

  const handleRemovePlaylistTrack = (trackId: string) => {
    if (trackSourceLocked) return
    const removingLastTrack = engine.tracks.length === 1
    engine.removeTrack(trackId)
    if (removingLastTrack) setPlaying(false)
  }

  const handleCue = () => {
    if (engine.isPlaying) setCuePoint(engine.currentTime)
    else engine.seek(cuePoint)
  }

  const activeImportedCues = track?.importedCueMarkers ?? []
  const activeManualCues = cueMarkers.filter(marker => cueMarkerBelongsToTrack(marker, track?.id))
  const activeCueMarkers = [...activeManualCues, ...activeImportedCues].sort((a, b) => a.time - b.time)

  const handleCreateCuePoint = useCallback((request: WaveformCueCreateRequest) => {
    const activeTrack = engine.currentTrack
    if (!activeTrack) return
    addCueMarker(buildManualCueMarker(request, cueMarkers, activeTrack.id))
  }, [addCueMarker, cueMarkers, engine])
  const title   = track?.displayName ?? 'No track loaded'
  const artist  = track?.artist?.trim() || (hasTrack ? '' : 'Load a track to begin')
  const vol     = engine.volume
  const volPct  = `${Math.round(vol * 100)}%`
  const canSelectPreviousTrack = !trackSourceLocked && transportReady && engine.currentIndex > 0
  const canSelectNextTrack = !trackSourceLocked
    && transportReady
    && engine.currentIndex >= 0
    && engine.currentIndex < engine.tracks.length - 1
  const trackLoadActionLabel = trackSourceLocked
    ? sourceSelectionLocked ? 'Track Locked' : 'Live Input Active'
    : hasTrack && playlistLoadMode === 'append'
      ? 'Append Track'
      : hasTrack
        ? 'Replace Track'
        : 'Add Track'

  // There is no collapse button: clicking empty dock space (padding, the gaps between and inside the cards) toggles the dock.
  const handleDockClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!expandable || compact) return
    if (!isDockBlankSpace(event.target, event.currentTarget)) return
    setCollapsedByUser(current => !current)
  }

  const dockClassName = [
    'az-dock',
    'vz-transport-dock',
    expandable ? 'vz-transport-dock--expandable' : '',
    dockCollapsed ? 'vz-transport-dock--collapsed' : '',
    compact ? 'vz-transport-dock--focus' : '',
    liveInputSelected ? 'vz-transport-dock--live-input' : '',
  ].filter(Boolean).join(' ')

  // Header-style (roomy) treatment when portaled to the header, or consolidated
  // into the audio source popover — both have space for the full label + select.
  // The default (compact, inline in the dock's own grid) is the tight variant.
  const rekordboxMenuRoomy = !!rekordboxMenuPortalTarget || showAudioSourceControl
  const rekordboxStatusMessage = rekordboxStatus?.trim() || null
  const rekordboxMenu = (
    <div
      className={rekordboxMenuRoomy ? 'vz-input-group' : 'vz-dock-rekordbox-menu'}
      aria-label="Rekordbox import tools"
      aria-busy={rekordboxBusy}
    >
      <label
        className={rekordboxMenuRoomy ? 'vz-input-label' : 'vz-dock-rekordbox-label'}
        htmlFor={rekordboxActionSelectId}
      >
        Rekordbox
      </label>
      <DropdownSelect
        id={rekordboxActionSelectId}
        className={rekordboxMenuRoomy ? 'az-select' : 'vz-dock-rekordbox-select'}
        value=""
        disabled={rekordboxBusy || trackSourceLocked}
        onChange={event => {
          const action = event.currentTarget.value
          event.currentTarget.value = ''
          if (action === 'xml') {
            document.getElementById(rekordboxXmlInputId)?.click()
          }
          if (action === 'usb') void handleRekordboxUsbRoot()
          if (action === 'mode') toggleRekordboxUsbMode()
        }}
        title={trackSourceLocked
          ? (sourceSelectionLocked
            ? 'Rekordbox source rehydration is unavailable while in Show Manager'
            : 'Rekordbox source rehydration is unavailable while Live Input is selected')
          : 'Import Rekordbox metadata or arm USB Mode. USB Mode does not import cues unless XML or the native parser matches the track.'}
      >
        <option value="">{rekordboxBusy ? 'Reading…' : rekordboxUsbMode ? 'USB Mode Armed' : 'RB Tools'}</option>
        <option value="xml">Import XML…</option>
        <option value="usb">Scan USB…</option>
        <option value="mode">{rekordboxUsbMode ? 'Turn USB Mode Off' : 'Arm USB Mode'}</option>
      </DropdownSelect>
      {rekordboxStatusMessage && (
        <span
          className="vz-dock-rekordbox-status"
          role="status"
          aria-live="polite"
          title={rekordboxDiagnostic ?? rekordboxStatusMessage}
        >
          {rekordboxStatusMessage}
        </span>
      )}
    </div>
  )

  const rekordboxPopoverMenu = (
    <div className="mum-field" aria-label="Rekordbox import tools" aria-busy={rekordboxBusy}>
      <label className="mum-field-label" htmlFor={rekordboxActionSelectId}>REKORDBOX</label>
      <UnderlineDropdown
        triggerId={rekordboxActionSelectId}
        value=""
        placeholder={rekordboxBusy ? 'Reading…' : rekordboxUsbMode ? 'USB Mode Armed' : 'RB Tools'}
        disabled={rekordboxBusy || trackSourceLocked}
        onChange={action => {
          if (action === 'xml') document.getElementById(rekordboxXmlInputId)?.click()
          if (action === 'usb') void handleRekordboxUsbRoot()
          if (action === 'mode') toggleRekordboxUsbMode()
        }}
        options={[
          { value: 'xml', label: 'Import XML…' },
          { value: 'usb', label: 'Scan USB…' },
          { value: 'mode', label: rekordboxUsbMode ? 'Turn USB Mode Off' : 'Arm USB Mode' },
        ]}
        ariaLabel="Rekordbox"
        menuLabel="Rekordbox"
        menuClassName="vz-dock-source-menu"
        size="compact"
        showDescriptions={false}
        title={trackSourceLocked
          ? (sourceSelectionLocked
            ? 'Rekordbox source rehydration is unavailable while in Show Manager'
            : 'Rekordbox source rehydration is unavailable while Live Input is selected')
          : 'Import Rekordbox metadata or arm USB Mode. USB Mode does not import cues unless XML or the native parser matches the track.'}
      />
      {rekordboxStatusMessage && (
        <span
          className="vz-dock-rekordbox-status"
          role="status"
          aria-live="polite"
          title={rekordboxDiagnostic ?? rekordboxStatusMessage}
        >
          {rekordboxStatusMessage}
        </span>
      )}
    </div>
  )

  return (
    <>
    {rekordboxMenuPortalTarget && createPortal(rekordboxMenu, rekordboxMenuPortalTarget)}
    <div
      className={dockClassName}
      data-collapsed={dockCollapsed ? 'true' : 'false'}
      data-has-deck-label={deckLabel ? 'true' : undefined}
      data-live-input-disabled={liveInputSelected ? 'true' : undefined}
      aria-disabled={liveInputSelected ? 'true' : undefined}
      onClick={handleDockClick}
    >

      {/* ── LEFT: sidebar + left-inspector footprint ─────────────────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-left vz-dock-card">
        {deckLabel && <div className="vz-dock-card-label">{deckLabel}</div>}
        {/* Playlist transport sits where the track cover used to. */}
        <div className="vz-dock-play-slot">
          <button
            type="button"
            className="vz-dock-track-nav-btn vz-dock-track-nav-btn--previous"
            title={trackSourceLocked ? trackSourceLockTitle : canSelectPreviousTrack ? 'Previous track' : 'No previous track'}
            aria-label="Previous track"
            disabled={!canSelectPreviousTrack}
            onClick={handlePreviousTrack}
          >
            <AppIcon kind="previous" size="16" />
          </button>
          <button
            type="button"
            className="az-play-btn"
            title={liveInputSelected ? trackSourceLockTitle : engine.isPlaying ? 'Pause' : 'Play'}
            aria-label={engine.isPlaying ? 'Pause' : 'Play'}
            disabled={!hasTrack || !transportReady || liveInputSelected}
            style={{ borderColor: preset.color, color: preset.color, boxShadow: `0 0 12px ${preset.color}30` }}
            onClick={handleTogglePlayback}
          >
            {engine.isPlaying
              ? <AppIcon kind="pause" size="26" />
              : <AppIcon kind="play" size="26" />
            }
          </button>
          <button
            type="button"
            className="vz-dock-track-nav-btn vz-dock-track-nav-btn--next"
            title={trackSourceLocked ? trackSourceLockTitle : canSelectNextTrack ? 'Next track' : 'No next track'}
            aria-label="Next track"
            disabled={!canSelectNextTrack}
            onClick={handleNextTrack}
          >
            <AppIcon kind="next" size="16" />
          </button>
        </div>

        <div className="vz-dock-left-body">
          <div className="vz-dock-track-row">
            <span className="vz-dock-track-title" title={title}>{title}</span>
            {artist && <span className="vz-dock-track-artist" title={artist}>{artist}</span>}
          </div>

          {/* A dedicated full-width row prevents the volume control collapsing. */}
          <div className="az-dock-volume vz-dock-volume-row">
            <span className="az-dock-vol-icon" aria-hidden="true">
              <AppIcon kind="volume" size="14" />
            </span>
            <span className="az-dock-vol-db vz-dock-vol-db">
              {vol < 0.001 ? '-∞ dB' : `${(20 * Math.log10(vol)).toFixed(1)} dB`}
            </span>
            <BubbleRevealSlider
              type="range"
              className="az-dock-vol-slider"
              aria-label="Track volume"
              title={`Track volume: ${Math.round(vol * 100)}%`}
              min={0}
              max={1}
              step={0.005}
              value={vol}
              disabled={liveInputSelected}
              onChange={e => engine.setVolume(parseFloat(e.target.value))}
              style={{ '--pct': volPct } as React.CSSProperties}
            />
          </div>
        </div>

        <label
          className="vz-dock-addtrack-btn"
          htmlFor={trackSourceLocked ? undefined : fileInputId}
          aria-disabled={trackSourceLocked}
          aria-label={trackLoadActionLabel}
          title={trackSourceLocked ? trackSourceLockTitle : hasTrack && playlistLoadMode === 'append' ? 'Append audio to playlist' : hasTrack ? `Replace: ${title}` : 'Add Track'}
          onClick={event => {
            if (!trackSourceLocked) return
            event.preventDefault()
            if (sourceSelectionLocked) requestAudioSourceMutation()
          }}
        >
          <AppIcon kind="plus" size="18" />
          <span>{trackLoadActionLabel}</span>
        </label>

      </div>
      </div>

      {/* ── CENTER: waveform + zoom buttons side by side ─────────────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-center vz-dock-card">
        <div className="vz-dock-waveform-wrap">
          <PeaksWaveformView
            engine={engine}
            cueMarkers={activeCueMarkers}
            waveformZoom={waveformZoom}
            rgbAnalysis={rgbAnalysis}
            fallbackPeaks={peaks}
            followTimelineViewport={unifiedTimeline}
            appearance={waveformAppearance}
            beatGrid={engine.currentEffectiveBeatGrid ?? engine.currentAnalysis?.beatGrid ?? null}
            onCreateCuePoint={track && !liveInputSelected ? handleCreateCuePoint : undefined}
            editableCueMarkerIds={activeManualCues.map(marker => marker.id)}
            onUpdateCuePoint={track && !liveInputSelected ? updateCueMarker : undefined}
            onDeleteCuePoint={track && !liveInputSelected ? removeCueMarker : undefined}
          />
        </div>
        <div className="vz-dock-zoom-btns">
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom * 2)} disabled={liveInputSelected || waveformZoom >= 16} title={liveInputSelected ? trackSourceLockTitle : 'Zoom in'}><AppIcon kind="plus" size={14} /></button>
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom / 2)} disabled={liveInputSelected || waveformZoom <= 1} title={liveInputSelected ? trackSourceLockTitle : 'Zoom out'}><AppIcon kind="minus" size={14} /></button>
        </div>
      </div>
      </div>

      {/* ── RIGHT: BPM + TAP / CUE / SYNC ───────────────────────────── */}
      <div className="vz-dock-region">
      <div className="vz-dock-right vz-dock-card">
        <div className="vz-dock-right-main">
        {/* Column wrapper so the stale banner sits below the BPM block */}
        <div className="vz-dock-bpm-wrap">
        <div className="vz-dock-bpm-block">
          <div className="vz-dock-bpm-track-top">
            <span className="vz-dock-bpm-block-label">BPM</span>
            {/* BPM value — five mutually exclusive states */}
            {bpmState.kind === 'value' && (
              bpmEditing ? (
                <input
                  ref={bpmInputRef}
                  className="vz-dock-bpm-block-val vz-dock-bpm-edit-input"
                  type="number"
                  min={40} max={300} step={1}
                  value={bpmDraft}
                  onChange={e => setBpmDraft(e.target.value)}
                  onBlur={commitBpmEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); commitBpmEdit() }
                    if (e.key === 'Escape') { setBpmEditing(false) }
                  }}
                />
              ) : (
                <span
                  className="vz-dock-bpm-block-val"
                  title={
                    bpmState.analyzed !== null
                      ? `Override active — analyzed: ${bpmState.analyzed.toFixed(2)} BPM`
                      : canEditBpm ? 'Double-click to edit BPM' : undefined
                  }
                  onDoubleClick={startBpmEdit}
                  style={canEditBpm ? { cursor: 'text' } : undefined}
                >
                  {bpmState.bpm.toFixed(2)}
                </span>
              )
            )}
            {bpmState.kind === 'analyzing' && (
              <span className="vz-dock-bpm-block-val vz-dock-bpm-analyzing">Analyzing…</span>
            )}
            {bpmState.kind === 'failed' && (
              <button
                className="vz-dock-bpm-block-val vz-dock-bpm-failed"
                onClick={handleRetry}
                title={bpmState.error ?? 'Analysis failed — click to retry'}
              >
                unavailable
              </button>
            )}
            {bpmState.kind === 'unavailable' && (
              <span
                className="vz-dock-bpm-block-val vz-dock-bpm-none"
                title="BPM detection failed for this track. You can set it manually by dragging the bar below or tap tempo."
              >
                BPM unavailable
              </span>
            )}
            {bpmState.kind === 'none' && (
              <span className="vz-dock-bpm-block-val vz-dock-bpm-none">--</span>
            )}

            {hasOverride && (
              <button
                className="vz-dock-bpm-reset-btn"
                onClick={handleClearOverride}
                title={`Reset to analyzed BPM${bpmState.kind === 'value' && bpmState.analyzed !== null ? ` (${bpmState.analyzed.toFixed(2)})` : ''}`}
              ><AppIcon kind="rotateLeft" size={14} /></button>
            )}
          </div>

          {/* Drag anywhere on the bar to scrub the BPM directly, instead of
              stepping it one beat at a time via chevrons. */}
          {bpmState.kind === 'value' && (
            <div
              className={`vz-dock-bpm-track-bar${canEditBpm ? '' : ' is-disabled'}`}
              onPointerDown={event => {
                if (!canEditBpm) return
                handleBpmScrub(event)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={event => { if (canEditBpm && event.buttons === 1) handleBpmScrub(event) }}
              role="slider"
              aria-label="BPM"
              aria-valuemin={40}
              aria-valuemax={300}
              aria-valuenow={Math.round(bpmState.bpm)}
              aria-disabled={!canEditBpm}
            >
              <div
                className="vz-dock-bpm-track-fill"
                style={{ width: `${Math.min(100, Math.max(0, ((bpmState.bpm - 40) / (300 - 40)) * 100))}%` }}
              />
            </div>
          )}
          {bpmState.kind !== 'value' && (
            <div
              className="vz-dock-bpm-track-bar vz-dock-bpm-track-bar--placeholder is-disabled"
              aria-hidden="true"
            />
          )}

          {/* Secondary line: analyzed BPM when override is active */}
          {bpmState.kind === 'value' && bpmState.analyzed !== null && (
            <span className="vz-dock-bpm-analyzed-label">
              analyzed {bpmState.analyzed.toFixed(2)}
            </span>
          )}

          <span
            className={`vz-dock-source-inline vz-dock-source-inline--${sourceIndicator.kind}`}
            title={sourceIndicator.description}
            aria-label={sourceIndicator.description}
            data-audio-source-kind={sourceIndicator.kind}
          >
            <i className="vz-dock-source-inline-dot" aria-hidden="true" />
            {sourceIndicator.kind === 'rekordbox'
              ? <AppIcon kind="rekordbox" size={20} />
              : <strong className="vz-dock-source-inline-name">{sourceIndicator.name}</strong>}
            <span className="vz-dock-source-inline-tag" aria-hidden="true">{sourceIndicator.tag}</span>
          </span>
        </div>

        {/* ── Stale-analysis banner ─────────────────────────────────── */}
        {showStaleBanner && analysisBpm !== null && effectiveBpm !== null && (
          <div className="vz-dock-bpm-stale">
            <div className="vz-dock-bpm-stale-info">
              <span>Grid: {analysisBpm.toFixed(0)}&thinsp;BPM</span>
              <span className="vz-dock-bpm-stale-arrow">→</span>
              <span>{effectiveBpm.toFixed(0)}&thinsp;BPM</span>
            </div>
            {isReanalyzing ? (
              <div className="vz-dock-bpm-stale-actions">
                <span className="vz-dock-bpm-stale-status"><AppIcon kind="loading" size={14} className="app-icon--spinning" /> Reanalyzing…</span>
              </div>
            ) : bpmReanalysisStatus === 'failed' ? (
              <div className="vz-dock-bpm-stale-actions">
                <span className="vz-dock-bpm-stale-status vz-dock-bpm-stale-status--err">Failed</span>
                <button className="vz-dock-bpm-stale-btn" onClick={handleKeepExisting}>Dismiss</button>
                <button className="vz-dock-bpm-stale-btn vz-dock-bpm-stale-btn--pri" onClick={handleResnap}>Re-snap</button>
              </div>
            ) : showReanalyzeConfirm ? (
              <div className="vz-dock-bpm-stale-actions">
                <span className="vz-dock-bpm-stale-confirm">
                  {autoSectionCount} auto section{autoSectionCount !== 1 ? 's' : ''} will be replaced. Manual sections kept.
                </span>
                <button className="vz-dock-bpm-stale-btn" onClick={() => setShowReanalyzeConfirm(false)}>Cancel</button>
                <button className="vz-dock-bpm-stale-btn vz-dock-bpm-stale-btn--pri" onClick={handleReanalyzeConfirm}>Confirm</button>
              </div>
            ) : (
              <div className="vz-dock-bpm-stale-actions">
                <button className="vz-dock-bpm-stale-btn" onClick={handleKeepExisting}>Keep</button>
                <button className="vz-dock-bpm-stale-btn" onClick={handleResnap}>Re-snap</button>
                <button className="vz-dock-bpm-stale-btn vz-dock-bpm-stale-btn--pri" onClick={handleReanalyzeClick}>
                  Reanalyze {effectiveBpm.toFixed(0)}
                </button>
              </div>
            )}
          </div>
        )}
        </div>{/* end vz-dock-bpm-wrap */}

        {showAudioSourceControl ? (
          <>
            <button
              ref={audioSourceTriggerRef}
              type="button"
              className="vz-dock-source-trigger"
              onClick={() => {
                setPlaylistPopoverOpen(false)
                setAudioSourcePopoverOpen(value => !value)
              }}
              aria-haspopup="dialog"
              aria-expanded={audioSourcePopoverOpen}
              aria-label="Audio source & Rekordbox"
              title="Audio source & Rekordbox"
            >
              <AppIcon kind="sliders" size="16" />
            </button>
            <InfoPopover
              open={audioSourcePopoverOpen}
              anchorRef={audioSourceTriggerRef}
              onOpenChange={setAudioSourcePopoverOpen}
              title="Audio Source"
              headerIcon={(
                <AppIcon kind="mic" />
              )}
              className="vz-dock-source-popover"
              placement="above"
              align="start"
              width={280}
            >
              <div className="vz-dock-source-popover-body">
                <div className="mum-field">
                  <label className="mum-field-label" htmlFor={audioSourceSelectId}>INPUT</label>
                  <UnderlineDropdown
                    triggerId={audioSourceSelectId}
                    value={engine.source}
                    onChange={value => engine.setSource(value as typeof engine.source)}
                    options={[
                      { value: 'file', label: 'Track Input' },
                      { value: 'microphone', label: 'Live Input' },
                      { value: 'demo', label: 'Demo Signal' },
                    ]}
                    ariaLabel="Input"
                    menuLabel="Input"
                    menuClassName="vz-dock-source-menu"
                    size="compact"
                    showDescriptions={false}
                  />
                </div>
                {rekordboxPopoverMenu}
              </div>
            </InfoPopover>
          </>
        ) : (
          !rekordboxMenuPortalTarget && rekordboxMenu
        )}
        </div>

        <div className="vz-dock-right-btns">
          <button
            className="vz-dock-tap-btn"
            onClick={handleTap}
            disabled={engine.source !== 'file' || !track}
            title={engine.source === 'file' && track ? 'Tap tempo' : 'Tap tempo (requires a file track)'}
            aria-label="Tap tempo"
          >
            <AppIcon kind="tap" className="vz-dock-action-icon" size="16" />
          </button>
          <button
            className="vz-dock-cue-btn"
            onClick={handleCue}
            title={liveInputSelected ? trackSourceLockTitle : engine.isPlaying ? 'Set cue point here' : `Jump to cue (${fmtPlayTime(cuePoint)})`}
            disabled={!hasTrack || !transportReady || liveInputSelected}
            aria-label={engine.isPlaying ? 'Set cue point here' : `Jump to cue (${fmtPlayTime(cuePoint)})`}
          >
            <span className="vz-dock-action-icon vz-dock-cue-icon" aria-hidden="true"><AppIcon kind="cue" size="100%" /></span>
          </button>
          <button
            className={`vz-dock-sync-master-btn${bpmSync ? ' vz-dock-sync-master-btn--on' : ''}`}
            onClick={toggleBpmSync}
            title={liveInputSelected ? trackSourceLockTitle : bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
            aria-label={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
            disabled={liveInputSelected}
          >
            {bpmSync && <span className="vz-dock-sync-dot" />}
            <AppIcon kind="sync" className="vz-dock-action-icon" size="16" />
          </button>
          {/* Playlist uses the upper reserved key; React uses the lower slot for Track Timeline. */}
          <div className="vz-dock-blank-group">
            <button
              ref={playlistTriggerRef}
              type="button"
              className="vz-dock-playlist-trigger"
              title="Playlist"
              aria-label="Playlist"
              aria-haspopup="dialog"
              aria-expanded={playlistPopoverOpen}
              onClick={() => {
                setAudioSourcePopoverOpen(false)
                setPlaylistPopoverOpen(value => !value)
              }}
            >
              <AppIcon kind="playlist" size="16" />
            </button>
            {lowerReservedAction ?? <div className="vz-dock-blank-btn" />}
          </div>
          <InfoPopover
            open={playlistPopoverOpen}
            anchorRef={playlistTriggerRef}
            onOpenChange={setPlaylistPopoverOpen}
            title="Playlist"
            description={engine.tracks.length === 0
              ? 'No tracks loaded'
              : `${engine.currentIndex + 1} of ${engine.tracks.length} selected`}
            headerIcon={(
              <AppIcon kind="playlist" />
            )}
            className="vz-dock-source-popover vz-dock-playlist-popover"
            placement="above"
            align="end"
            width={360}
            maxHeight={480}
          >
            <div className="vz-dock-playlist-popover-body">
              <div className="vz-dock-playlist-setting">
                <span>
                  <strong>Automatic advance</strong>
                  <small>Continue with the next track when playback ends.</small>
                </span>
                <IconMorphToggle
                  checked={engine.autoAdvance}
                  onCheckedChange={engine.setAutoAdvance}
                  className="vz-settings-seg-btn vz-dock-playlist-toggle"
                  aria-label="Automatic advance"
                  disabled={sourceSelectionLocked}
                />
              </div>

              <fieldset className="vz-dock-playlist-load-mode" disabled={trackSourceLocked}>
                <legend>New track loads</legend>
                <div className="rv-segmented-control">
                  <button
                    type="button"
                    className={playlistLoadMode === 'append' ? 'is-active' : ''}
                    aria-pressed={playlistLoadMode === 'append'}
                    onClick={() => setPlaylistLoadMode('append')}
                  >
                    Append
                  </button>
                  <button
                    type="button"
                    className={playlistLoadMode === 'replace' ? 'is-active' : ''}
                    aria-pressed={playlistLoadMode === 'replace'}
                    onClick={() => setPlaylistLoadMode('replace')}
                  >
                    Replace
                  </button>
                </div>
              </fieldset>

              <div className="vz-dock-playlist-state" aria-live="polite">
                <span>Queue</span>
                <strong>{engine.tracks.length} track{engine.tracks.length === 1 ? '' : 's'}</strong>
              </div>

              <div className="vz-dock-playlist-tracks" role="list" aria-label="Loaded tracks">
                {engine.tracks.length === 0 ? (
                  <p className="vz-dock-playlist-empty">Use Add Track to build a playlist.</p>
                ) : engine.tracks.map((playlistTrack, index) => {
                  const active = index === engine.currentIndex
                  return (
                    <div
                      key={playlistTrack.id}
                      className={`vz-dock-playlist-track${active ? ' is-active' : ''}`}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="vz-dock-playlist-select"
                        aria-current={active ? 'true' : undefined}
                        disabled={trackSourceLocked || active}
                        onClick={() => handleSelectPlaylistTrack(index)}
                      >
                        <span className="vz-dock-playlist-index">{String(index + 1).padStart(2, '0')}</span>
                        <span className="vz-dock-playlist-identity">
                          <strong>{playlistTrack.displayName || playlistTrack.name}</strong>
                          {playlistTrack.artist && <small>{playlistTrack.artist}</small>}
                        </span>
                        {active && <span className="vz-dock-playlist-active-label">Active</span>}
                      </button>
                      <button
                        type="button"
                        className="vz-dock-playlist-remove"
                        aria-label={`Remove ${playlistTrack.displayName || playlistTrack.name} from playlist`}
                        title="Remove from playlist"
                        disabled={trackSourceLocked}
                        onClick={() => handleRemovePlaylistTrack(playlistTrack.id)}
                      >
                        <AppIcon kind="delete" size="14" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </InfoPopover>
        </div>
      </div>
      </div>

      {showSourceLockMessage && (
        <DrawerNotice
          className="vz-dock-source-lock-notice"
          tone="error"
          role="alert"
          title="Show Manager audio locked"
          onDismiss={() => setDismissedSourceLockAttempt(sourceLockAttemptId)}
        >
          {sourceLockMessage}
        </DrawerNotice>
      )}

      {liveInputSelected && (
        <DrawerNotice
          className="vz-dock-source-lock-notice"
          tone="info"
          title="Live Input active"
        >
          Track and Show controls are unavailable while Live Input analyzes the default microphone. Switch the input back to Track/File to restore them.
        </DrawerNotice>
      )}

      {engine.trackLoadError && engine.trackLoadError !== dismissedTrackLoadError && (
        <DrawerNotice
          className="vz-dock-source-lock-notice"
          tone="error"
          role="alert"
          title="Track could not be played"
          onDismiss={() => setDismissedTrackLoadError(engine.trackLoadError)}
        >
          {engine.trackLoadError}
        </DrawerNotice>
      )}

      {engine.micError && (
        <DrawerNotice
          className="vz-dock-source-lock-notice"
          tone="error"
          role="alert"
          title="Live Input unavailable"
        >
          {engine.micError}
        </DrawerNotice>
      )}

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        disabled={trackSourceLocked}
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        id={rekordboxXmlInputId}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="az-upload-input"
        disabled={trackSourceLocked}
        onChange={e => handleRekordboxXml(e.target.files)}
      />
    </div>
    </>
  )
}

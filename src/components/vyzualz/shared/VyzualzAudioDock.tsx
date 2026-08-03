import { useId, useState, useRef, useEffect, useCallback } from 'react'
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
import { guessNativeUsbRootFromFile, scanNativeRekordboxUsbRoot } from '../../../features/rekordboxImport/nativeBridge'
import { PeaksWaveformView } from '../transport/PeaksWaveformView'
import type { WaveformCueCreateRequest } from '../../../features/timeline/waveformCuePoint'
import { buildManualCueMarker } from '../../../features/timeline/manualCuePoint'
import { cueMarkerBelongsToTrack } from '../../../types/cue'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

const AUDIO_DOCK_COLLAPSED_STORAGE_KEY = 'drmvyz.audioDock.collapsed.v1'

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
}

export function VyzualzAudioDock({
  compact = false,
  expandable = false,
  deckLabel,
  unifiedTimeline = false,
  waveformAppearance = 'rgb',
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
  const { handleTap } = useTapTempo()

  const [collapsedByUser, setCollapsedByUser] = useState(() => (
    expandable ? readCollapsedPreference() : false
  ))
  const [rekordboxLibrary, setRekordboxLibrary] = useState<RekordboxLibrary | null>(null)
  const [rekordboxStatus, setRekordboxStatus] = useState<string | null>(null)
  const [rekordboxDiagnostic, setRekordboxDiagnostic] = useState<string | null>(null)
  const [rekordboxBusy, setRekordboxBusy] = useState(false)
  const [rekordboxUsbMode, setRekordboxUsbMode] = useState(false)

  const dockCollapsed = compact || (expandable && collapsedByUser)

  useEffect(() => {
    if (!expandable) return
    writeCollapsedPreference(collapsedByUser)
  }, [collapsedByUser, expandable])


  const track    = engine.currentTrack
  const hasTrack = engine.tracks.length > 0
  const manualTrackSectionsByTrackId = useReactStore(state => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(state => state.suppressedAutoSectionsByTrackId)

  const trackId = track?.id ?? null
  const { peaks } = useWaveformPeaks(
    trackId,
    trackId ? engine.getDecodedBuffer(trackId) : undefined,
    track?.url ?? null,
  )

  // Trigger RGB waveform analysis whenever a track's main analysis completes
  useRgbWaveformAnalysis(engine)

  // Read the current track's RGB waveform from the store (null while analyzing)
  const currentKey = track?.analysisRuntime.analysisKey ?? ''
  const rgbAnalysis = useRgbWaveformStore(s => s.waveforms[currentKey]?.analysis ?? null)

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
  const setRekordboxStatusWithDiagnostic = (status: string | null, summary?: RekordboxHydrationSummary | null) => {
    setRekordboxStatus(status)
    setRekordboxDiagnostic(summary ? formatRekordboxBadgeDiagnostic(summary) : null)
  }

  const rehydrateCurrentTrackFromRekordbox = (
    library: RekordboxLibrary | null,
    options: { forceUsbMode?: boolean } = {},
  ): { summary: RekordboxHydrationSummary | null; replaced: boolean; hadCurrentFile: boolean } => {
    const currentFile = engine.currentTrack?.sourceFile
    if (!currentFile) return { summary: null, replaced: false, hadCurrentFile: false }

    const prepared = createPreparedTrackInputs([currentFile], library, options)
    const summary = summarizePreparedRekordboxInputs(prepared)
    const shouldReplace = summary.realMatches > 0 || summary.usbFallbacks > 0

    if (shouldReplace) {
      engine.replacePreparedTracks(prepared)
      if (engine.source !== 'file') engine.setSource('file')
    }

    return { summary, replaced: shouldReplace, hadCurrentFile: true }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (!audio.length) return

    let activeLibrary = rekordboxLibrary
    let autoNativeStatus: string | null = null

    if (!activeLibrary) {
      const guessedRoot = audio.map(guessNativeUsbRootFromFile).find((root): root is string => Boolean(root))
      if (guessedRoot) {
        setRekordboxBusy(true)
        try {
          const result = await scanNativeRekordboxUsbRoot(guessedRoot)
          if (result?.library && !result.cancelled) {
            activeLibrary = result.library
            setRekordboxLibrary(result.library)
            setRekordboxUsbMode(true)
            autoNativeStatus = `Detected Rekordbox USB from loaded track path and parsed ${summarizeRekordboxLibrary(result.library)} with the native bridge.`
          }
        } catch (err) {
          autoNativeStatus = err instanceof Error
            ? `Native Rekordbox auto-scan failed: ${err.message}`
            : `Native Rekordbox auto-scan failed: ${String(err)}`
        } finally {
          setRekordboxBusy(false)
        }
      }
    }

    const shouldForceUsbMode = rekordboxUsbMode || activeLibrary?.source === 'rekordbox_usb'
    const prepared = createPreparedTrackInputs(audio, activeLibrary, { forceUsbMode: shouldForceUsbMode })
    const summary = summarizePreparedRekordboxInputs(prepared)
    if (engine.tracks.length > 0) engine.replacePreparedTracks(prepared)
    else engine.addPreparedTracks(prepared)
    if (engine.source !== 'file') engine.setSource('file')

    if (activeLibrary || shouldForceUsbMode || autoNativeStatus) {
      const matchedPhrase = summary.realMatches > 0
        ? `Matched ${summary.realMatches}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} to Rekordbox metadata.`
        : summary.usbFallbacks > 0
          ? `No Rekordbox metadata match; marked ${summary.usbFallbacks}/${audio.length} loaded track${audio.length === 1 ? '' : 's'} as USB Mode only.`
          : activeLibrary ? 'Rekordbox library loaded, but no selected audio files matched.' : null

      setRekordboxStatusWithDiagnostic([
        autoNativeStatus,
        matchedPhrase,
        formatRekordboxDiagnostic(summary),
      ].filter(Boolean).join(' '), summary)
    }
  }

  const handleRekordboxXml = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setRekordboxBusy(true)
    try {
      const library = await importRekordboxXml(files)
      setRekordboxLibrary(library)
      const hydration = rehydrateCurrentTrackFromRekordbox(library, { forceUsbMode: false })

      const currentTrackMessage = hydration.hadCurrentFile
        ? hydration.replaced && hydration.summary
          ? `Current track rehydrated from XML. ${formatRekordboxDiagnostic(hydration.summary)}.`
          : hydration.summary
            ? `Current track did not match this XML and was left unchanged. ${formatRekordboxDiagnostic(hydration.summary)}.`
            : 'Current track could not be rehydrated from XML.'
        : 'Load/replace audio to hydrate cues and metadata.'

      setRekordboxStatusWithDiagnostic(
        `Rekordbox XML ready: ${summarizeRekordboxLibrary(library)}. ${currentTrackMessage}`,
        hydration.summary,
      )
    } catch (err) {
      setRekordboxStatusWithDiagnostic(err instanceof Error ? err.message : String(err))
    } finally {
      setRekordboxBusy(false)
    }
  }

  const handleRekordboxUsbRoot = async () => {
    setRekordboxBusy(true)
    try {
      const result = await selectRekordboxUsbRoot()
      if (result.cancelled) {
        setRekordboxStatusWithDiagnostic('USB scan canceled. No files were loaded or replaced.')
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
      ].filter(Boolean).join(' '), hydration.summary)
    } catch (err) {
      setRekordboxStatusWithDiagnostic(err instanceof Error ? err.message : String(err))
    } finally {
      setRekordboxBusy(false)
    }
  }

  const toggleRekordboxUsbMode = () => {
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
  const initial = track?.displayName?.[0]?.toUpperCase() ?? '♪'
  const title   = track?.displayName ?? 'No track loaded'
  const artist  = track?.artist?.trim() || (hasTrack ? '' : 'Load a track to begin')
  const vol     = engine.volume
  const volPct  = `${Math.round(vol * 100)}%`

  const handleDensityToggle = () => {
    if (!expandable || compact) return
    setCollapsedByUser(current => !current)
  }

  const dockClassName = [
    'az-dock',
    'vz-transport-dock',
    expandable ? 'vz-transport-dock--expandable' : '',
    dockCollapsed ? 'vz-transport-dock--collapsed' : '',
    compact ? 'vz-transport-dock--focus' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={dockClassName}
      data-collapsed={dockCollapsed ? 'true' : 'false'}
      data-has-deck-label={deckLabel ? 'true' : undefined}
    >

      {expandable && !compact && (
        <button
          type="button"
          className="vz-dock-density-toggle"
          aria-expanded={!dockCollapsed}
          aria-label={dockCollapsed ? 'Expand audio deck' : 'Collapse audio deck'}
          title={dockCollapsed ? 'Expand audio deck' : 'Collapse audio deck'}
          onClick={handleDensityToggle}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {dockCollapsed
              ? <path d="M6 14l6-6 6 6"/>
              : <path d="M6 10l6 6 6-6"/>
            }
          </svg>
        </button>
      )}

      {/* ── LEFT: sidebar + left-inspector footprint ─────────────────── */}
      <div className="vz-dock-help-region drm-help-overlay-anchor">
      <div className="vz-dock-left vz-dock-card">
        {deckLabel && <div className="vz-dock-card-label">{deckLabel}</div>}
        <label
          className="az-dock-thumb vz-dock-art"
          htmlFor={fileInputId}
          title={hasTrack ? title : 'Click to load audio'}
          style={{ cursor: 'pointer', borderColor: preset.color + '40' }}
        >
          <span className="az-dock-thumb-letter" style={{ color: preset.color + 'cc' }}>
            {hasTrack ? initial : '♪'}
          </span>
        </label>

        <div className="vz-dock-left-body">
          <div className="vz-dock-track-row">
            <span className="vz-dock-track-title" title={title}>{title}</span>
            {artist && <span className="vz-dock-track-artist" title={artist}>{artist}</span>}
          </div>

          {/* Transport receives its own full-width row instead of competing with track metadata. */}
          <div className="vz-dock-controls-row">
            <div className="az-dock-transport">
              <button className="az-transport-btn" title="Previous" disabled={!hasTrack} onClick={engine.prev}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
              </button>
              <button
                className="az-play-btn"
                title={engine.isPlaying ? 'Pause' : 'Play'}
                disabled={!hasTrack}
                style={{ borderColor: preset.color, color: preset.color, boxShadow: `0 0 12px ${preset.color}30` }}
                onClick={handleTogglePlayback}
              >
                {engine.isPlaying
                  ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                }
              </button>
              <button className="az-transport-btn" title="Next" disabled={!hasTrack} onClick={engine.next}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            </div>
          </div>

          {/* A dedicated full-width row prevents the volume control collapsing. */}
          <div className="az-dock-volume vz-dock-volume-row">
            <span className="az-dock-vol-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </span>
            <span className="az-dock-vol-db vz-dock-vol-db">
              {vol < 0.001 ? '-∞ dB' : `${(20 * Math.log10(vol)).toFixed(1)} dB`}
            </span>
            <input
              type="range"
              className="az-dock-vol-slider"
              aria-label="Track volume"
              title={`Track volume: ${Math.round(vol * 100)}%`}
              min={0}
              max={1}
              step={0.005}
              value={vol}
              onChange={e => engine.setVolume(parseFloat(e.target.value))}
              style={{ '--pct': volPct } as React.CSSProperties}
            />
          </div>
        </div>

        <label
          className="vz-dock-addtrack-btn"
          htmlFor={fileInputId}
          title={hasTrack ? `Replace: ${title}` : 'Add Track'}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>{hasTrack ? 'Replace Track' : 'Add Track'}</span>
        </label>

      </div>
      <HelpInfoTrigger
        helpId="visualizer.audioDeck.trackPlayer"
        currentValue={title}
        placement="above"
      />
      </div>

      {/* ── CENTER: waveform + zoom buttons side by side ─────────────── */}
      <div className="vz-dock-help-region drm-help-overlay-anchor">
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
            onCreateCuePoint={track ? handleCreateCuePoint : undefined}
            editableCueMarkerIds={activeManualCues.map(marker => marker.id)}
            onUpdateCuePoint={track ? updateCueMarker : undefined}
            onDeleteCuePoint={track ? removeCueMarker : undefined}
          />
        </div>
        <div className="vz-dock-zoom-btns">
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom * 2)} disabled={waveformZoom >= 16} title="Zoom in">+</button>
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom / 2)} disabled={waveformZoom <= 1} title="Zoom out">−</button>
        </div>
      </div>
      <HelpInfoTrigger
        helpId="visualizer.audioDeck.waveform"
        currentValue={`${waveformZoom}× zoom`}
        placement="above"
      />
      </div>

      {/* ── RIGHT: BPM + TAP / CUE / SYNC ───────────────────────────── */}
      <div className="vz-dock-help-region drm-help-overlay-anchor">
      <div className="vz-dock-right vz-dock-card">
        <div className="vz-dock-right-main">
        {/* Column wrapper so the stale banner sits below the BPM block */}
        <div className="vz-dock-bpm-wrap">
        <div className="vz-dock-bpm-block">
          <div className="vz-dock-bpm-block-top">
            <span className="vz-dock-bpm-block-label">BPM</span>
            {hasOverride && (
              <button
                className="vz-dock-bpm-reset-btn"
                onClick={handleClearOverride}
                title={`Reset to analyzed BPM${bpmState.kind === 'value' && bpmState.analyzed !== null ? ` (${bpmState.analyzed.toFixed(2)})` : ''}`}
              >
                ↺
              </button>
            )}
          </div>
          <div className="vz-dock-bpm-block-row">
            {/* BPM value — three mutually exclusive states */}
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
                title="BPM detection failed for this track. You can set it manually with the arrows or tap tempo."
              >
                BPM unavailable
              </span>
            )}
            {bpmState.kind === 'none' && (
              <span className="vz-dock-bpm-block-val vz-dock-bpm-none">--</span>
            )}

            <div className="vz-dock-bpm-chevrons">
              <button
                className="vz-dock-bpm-chevron"
                onClick={() => handleBpmStep(+1)}
                disabled={!canEditBpm}
                title="BPM +1"
              >
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 15l5-5 5 5z"/></svg>
              </button>
              <button
                className="vz-dock-bpm-chevron"
                onClick={() => handleBpmStep(-1)}
                disabled={!canEditBpm}
                title="BPM −1"
              >
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 9l5 5 5-5z"/></svg>
              </button>
            </div>
          </div>
          {/* Secondary line: analyzed BPM when override is active */}
          {bpmState.kind === 'value' && bpmState.analyzed !== null && (
            <span className="vz-dock-bpm-analyzed-label">
              analyzed {bpmState.analyzed.toFixed(2)}
            </span>
          )}
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
                <span className="vz-dock-bpm-stale-status">◌ Reanalyzing…</span>
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

        <div className="vz-dock-rekordbox-menu" aria-label="Rekordbox import tools">
          <label className="vz-dock-rekordbox-label" htmlFor={rekordboxActionSelectId}>
            Rekordbox
          </label>
          <DropdownSelect
            id={rekordboxActionSelectId}
            className="vz-dock-rekordbox-select"
            value=""
            disabled={rekordboxBusy}
            onChange={event => {
              const action = event.currentTarget.value
              event.currentTarget.value = ''
              if (action === 'xml') {
                document.getElementById(rekordboxXmlInputId)?.click()
              }
              if (action === 'usb') void handleRekordboxUsbRoot()
              if (action === 'mode') toggleRekordboxUsbMode()
            }}
            title="Import Rekordbox metadata or arm USB Mode. USB Mode does not import cues unless XML or the native parser matches the track."
          >
            <option value="">{rekordboxBusy ? 'Reading…' : rekordboxUsbMode ? 'USB Mode Armed' : 'RB Tools'}</option>
            <option value="xml">Import XML…</option>
            <option value="usb">Scan USB…</option>
            <option value="mode">{rekordboxUsbMode ? 'Turn USB Mode Off' : 'Arm USB Mode'}</option>
          </DropdownSelect>
        </div>
        </div>

        <div className="vz-dock-right-btns">
          <button
            className="vz-dock-tap-btn"
            onClick={handleTap}
            disabled={engine.source !== 'file' || !track}
            title={engine.source === 'file' && track ? 'Tap tempo' : 'Tap tempo (requires a file track)'}
          >
            TAP
          </button>
          <button
            className="vz-dock-cue-btn"
            onClick={handleCue}
            title={engine.isPlaying ? 'Set cue point here' : `Jump to cue (${fmtPlayTime(cuePoint)})`}
            disabled={!hasTrack}
          >
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 21V4m0 1h11l-2.5 3L16 11H5"/>
            </svg>
            <span>CUE</span>
          </button>
          <button
            className={`vz-dock-sync-master-btn${bpmSync ? ' vz-dock-sync-master-btn--on' : ''}`}
            onClick={toggleBpmSync}
            title={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
          >
            {bpmSync && <span className="vz-dock-sync-dot" />}
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.5 13.5l3-3M7.2 16.8l-1 1a3.4 3.4 0 0 1-4.8-4.8l3.2-3.2a3.4 3.4 0 0 1 4.8 0M16.8 7.2l1-1a3.4 3.4 0 0 1 4.8 4.8l-3.2 3.2a3.4 3.4 0 0 1-4.8 0"/>
            </svg>
            <span className="vz-dock-sync-master-label">SYNC</span>
          </button>
        </div>
      </div>
      <HelpInfoTrigger
        helpId="visualizer.audioDeck.tempoAndSync"
        currentValue={bpmState.kind === 'value'
          ? `${bpmState.bpm.toFixed(2)} BPM · Sync ${bpmSync ? 'on' : 'off'}`
          : `BPM ${bpmState.kind} · Sync ${bpmSync ? 'on' : 'off'}`}
        placement="above"
      />
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        id={rekordboxXmlInputId}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="az-upload-input"
        onChange={e => handleRekordboxXml(e.target.files)}
      />
    </div>
  )
}

import { useId, useState, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVisualStore, DEFAULT_PRESETS } from '../../../stores/visualStore'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useTapTempo } from '../hooks/useTapTempo'
import { useWaveformPeaks } from '../hooks/useWaveformPeaks'
import { useRgbWaveformAnalysis } from '../hooks/useRgbWaveformAnalysis'
import { useRgbWaveformStore } from '../../../features/waveform/rgbWaveformStorage'
import { PeaksWaveformView } from '../transport/PeaksWaveformView'

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

export function VyzualzAudioDock() {
  const {
    presets, activePresetId, bpmSync, toggleBpmSync, setPlaying,
    cuePoint, setCuePoint, beatGridEnabled, setBeatGridEnabled,
    waveformZoom, setWaveformZoom, cueMarkers,
  } = useVisualStore(useShallow(s => ({
    presets:            s.presets,
    activePresetId:     s.activePresetId,
    bpmSync:            s.bpmSync,
    toggleBpmSync:      s.toggleBpmSync,
    setPlaying:         s.setPlaying,
    cuePoint:           s.cuePoint,
    setCuePoint:        s.setCuePoint,
    beatGridEnabled:    s.beatGridEnabled,
    setBeatGridEnabled: s.setBeatGridEnabled,
    waveformZoom:       s.waveformZoom,
    setWaveformZoom:    s.setWaveformZoom,
    cueMarkers:         s.cueMarkers,
  })))

  const preset      = presets.find(p => p.id === activePresetId) ?? presets[0] ?? DEFAULT_PRESETS[0]
  const engine      = useSharedAudio()
  const fileInputId = useId()
  const { handleTap } = useTapTempo()

  const track    = engine.currentTrack
  const hasTrack = engine.tracks.length > 0

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

  const autoSectionCount = (engine.currentAnalysis?.sections ?? [])
    .filter(s => s.source !== 'manual' && !s.locked).length

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

  // ── File input ────────────────────────────────────────────────────────────
  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (audio.length) {
      if (engine.tracks.length > 0) engine.replaceTracks(audio)
      else engine.addTracks(audio)
      if (engine.source !== 'file') engine.setSource('file')
    }
  }

  const handleTogglePlayback = () => {
    if (engine.isPlaying) { engine.pause(); setPlaying(false) }
    else                  { engine.play();  setPlaying(true) }
  }

  const handleCue = () => {
    if (engine.isPlaying) setCuePoint(engine.currentTime)
    else engine.seek(cuePoint)
  }

  const initial = track?.displayName?.[0]?.toUpperCase() ?? '♪'
  const title   = track?.displayName ?? 'No track loaded'
  const artist  = track?.artist?.trim() || (hasTrack ? 'Local audio track' : 'Load a track to begin')
  const vol     = engine.volume
  const volPct  = `${Math.round(vol * 100)}%`

  return (
    <div className="az-dock vz-transport-dock">

      {/* ── LEFT: sidebar + left-inspector footprint ─────────────────── */}
      <div className="vz-dock-left vz-dock-card">
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
            <span className="vz-dock-track-artist" title={artist}>{artist}</span>
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

      {/* ── CENTER: waveform + zoom buttons side by side ─────────────── */}
      <div className="vz-dock-center vz-dock-card">
        <div className="vz-dock-waveform-wrap">
          <PeaksWaveformView
            engine={engine}
            cueMarkers={cueMarkers}
            waveformZoom={waveformZoom}
            rgbAnalysis={rgbAnalysis}
            fallbackPeaks={peaks}
          />
        </div>
        <div className="vz-dock-zoom-btns">
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom * 2)} disabled={waveformZoom >= 16} title="Zoom in">+</button>
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom / 2)} disabled={waveformZoom <= 1} title="Zoom out">−</button>
        </div>
      </div>

      {/* ── RIGHT: BPM + TAP / CUE / SYNC / BEATGRID ────────────────── */}
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

        <button
          className="vz-dock-tap-btn"
          onClick={handleTap}
          disabled={engine.source !== 'file' || !track}
          title={engine.source === 'file' && track ? 'Tap tempo' : 'Tap tempo (requires a file track)'}
        >
          TAP
        </button>
        </div>

        <div className="vz-dock-right-btns">
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
          <button
            className={`vz-dock-beatgrid-btn${beatGridEnabled ? ' vz-dock-beatgrid-btn--on' : ''}`}
            onClick={() => setBeatGridEnabled(!beatGridEnabled)}
            title={beatGridEnabled ? 'Beat grid: ON' : 'Beat grid: OFF'}
          >
            <svg className="vz-dock-action-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
              <rect x="3" y="3" width="4" height="4" rx="0.7"/><rect x="10" y="3" width="4" height="4" rx="0.7"/><rect x="17" y="3" width="4" height="4" rx="0.7"/>
              <rect x="3" y="10" width="4" height="4" rx="0.7"/><rect x="10" y="10" width="4" height="4" rx="0.7"/><rect x="17" y="10" width="4" height="4" rx="0.7"/>
              <rect x="3" y="17" width="4" height="4" rx="0.7"/><rect x="10" y="17" width="4" height="4" rx="0.7"/><rect x="17" y="17" width="4" height="4" rx="0.7"/>
            </svg>
            <span>GRID</span>
          </button>
        </div>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

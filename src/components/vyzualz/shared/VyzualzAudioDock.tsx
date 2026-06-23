import { useId } from 'react'
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

  const { peaks } = useWaveformPeaks(track?.url ?? null)

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
  const vol     = engine.volume
  const volPct  = `${Math.round(vol * 100)}%`

  return (
    <div className="az-dock vz-transport-dock">

      {/* ── LEFT: sidebar + left-inspector footprint ─────────────────── */}
      <div className="vz-dock-left">
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
          {/* Transport + add track + volume — single row */}
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
            <label
              className="az-transport-btn vz-dock-addtrack-btn"
              htmlFor={fileInputId}
              title={hasTrack ? `Replace: ${title}` : 'Add Track'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 18V5.58888C14.5 4.73166 14.5 4.30306 14.6805 4.04492C14.8382 3.81952 15.0817 3.669 15.3538 3.6288C15.6655 3.58276 16.0488 3.77444 16.8155 4.1578L20.5 6.00003M14.5 18C14.5 19.6569 13.1569 21 11.5 21C9.84315 21 8.5 19.6569 8.5 18C8.5 16.3432 9.84315 15 11.5 15C13.1569 15 14.5 16.3432 14.5 18ZM6.5 10V4.00003M3.5 7.00003H9.5"/>
              </svg>
            </label>
            <div className="az-dock-volume">
              <span className="az-dock-vol-icon">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </span>
              <span className="az-dock-vol-db" style={{ fontSize: 9 }}>
                {vol < 0.001 ? '-∞ dB' : `${(20 * Math.log10(vol)).toFixed(1)} dB`}
              </span>
              <input type="range" className="az-dock-vol-slider"
                min={0} max={1} step={0.005} value={vol}
                onChange={e => engine.setVolume(parseFloat(e.target.value))}
                style={{ '--pct': volPct } as React.CSSProperties}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER: waveform + zoom buttons side by side ─────────────── */}
      <div className="vz-dock-center">
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
      <div className="vz-dock-right">
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
              <span className="vz-dock-bpm-block-val" title={
                bpmState.analyzed !== null
                  ? `Override active — analyzed: ${bpmState.analyzed.toFixed(2)} BPM`
                  : undefined
              }>
                {bpmState.bpm.toFixed(2)}
              </span>
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
          >CUE</button>
          <button
            className={`vz-dock-sync-master-btn${bpmSync ? ' vz-dock-sync-master-btn--on' : ''}`}
            onClick={toggleBpmSync}
            title={bpmSync ? 'BPM Sync: ON' : 'BPM Sync: OFF'}
          >
            {bpmSync && <span className="vz-dock-sync-dot" />}
            <span className="vz-dock-sync-master-label">SYNC</span>
          </button>
          <button
            className={`vz-dock-beatgrid-btn${beatGridEnabled ? ' vz-dock-beatgrid-btn--on' : ''}`}
            onClick={() => setBeatGridEnabled(!beatGridEnabled)}
            title={beatGridEnabled ? 'Beat grid: ON' : 'Beat grid: OFF'}
          >
            GRID
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

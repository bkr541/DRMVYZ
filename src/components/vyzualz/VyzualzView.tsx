import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLyricsStore } from '../../stores/lyricsStore'
import {
  ChartHistogramIcon,
  Tv01Icon,
} from 'hugeicons-react'
import { VyzualzSidebar } from './VyzualzSidebar'
import { LyricManagerView } from '../../features/lyrics/LyricManagerView'
import { useSharedAudio }  from '../../context/AudioEngineContext'
import { useMediaStore }   from '../../stores/mediaStore'
import { useVisualStore, DEFAULT_PRESETS }  from '../../stores/visualStore'
import type { UploadedMedia } from '../../stores/mediaStore'
import type { VzSession, PresetScope } from '../../stores/visualStore'
import { getBandAvg } from '../../lib/audioModulation'
import { TrackScrubber } from '../shared/TrackScrubber'
import { TimelinePanel } from './TimelinePanel'
import { VyzualzErrorBoundary } from './VyzualzErrorBoundary'
import { isPrimaryMedia } from '../../lib/mediaRoles'
import type { RailTabOption } from './layout/RailTabs'
import { VyzualzShell }         from './layout/VyzualzShell'
import { VyzualzTopBar }        from './layout/VyzualzTopBar'
import { WorkspaceRail }        from './layout/WorkspaceRail'
import { RailTabs }             from './layout/RailTabs'
import { StageArea }            from './layout/StageArea'
import { BottomPerformanceBar } from './layout/BottomPerformanceBar'
import { MediaDeckPanel }       from './media/MediaDeckPanel'
import { VzLayersPanel }        from './layers/VzLayersPanel'
import { EffectChainPanel }     from './effects/EffectChainPanel'
import { EffectControlsPanel }  from './effects/EffectControlsPanel'
import { ModulationPanel }      from './modulation/ModulationPanel'
import { PresetStrip }          from './sessions/PresetStrip'
import { SessionPanel }         from './sessions/SessionPanel'
import { BpmInput }             from './BpmInput'
import { LiveVisualPreview }    from './stage/LiveVisualPreview'
import { VzMiniWaveform }       from './transport/VzMiniWaveform'
import { VzCueMarkerStrip }     from './transport/VzCueMarkerStrip'
import { useWaveformPeaks }     from './hooks/useWaveformPeaks'
import { OutputFrame }          from './stage/OutputFrame'
import { useVyzualzKeyboard }   from './hooks/useVyzualzKeyboard'
import { useTapTempo }          from './hooks/useTapTempo'
import { useMediaNavigation }   from './hooks/useMediaNavigation'
import { useRecorder }          from '../../hooks/useRecorder'
import { RecordingPanel }       from './recording/RecordingPanel'
import { TimelineInspectorPanel } from './timeline/TimelineInspectorPanel'
import { AddCueModal }            from './AddCueModal'

// ── AudioWaveformCanvas (real analyser) ───────────────────────────────
function AudioWaveformCanvas({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const animRef       = useRef<number>(0)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const freqBufRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    analyserRef.current  = analyser
    freqBufRef.current   = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      canvas.width  = Math.round(r.width  * devicePixelRatio)
      canvas.height = Math.round(r.height * devicePixelRatio)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      const W = canvas.width, H = canvas.height
      if (!W || !H) { animRef.current = requestAnimationFrame(frame); return }
      const dpr = devicePixelRatio
      ctx.clearRect(0, 0, W, H)
      const mid = H / 2

      const an  = analyserRef.current
      const buf = freqBufRef.current

      ctx.beginPath()
      if (an && buf) {
        an.getByteFrequencyData(buf)
        const pts = Math.min(buf.length, 120)
        for (let i = 0; i <= pts; i++) {
          const x   = (i / pts) * W
          const val = buf[Math.floor((i / pts) * buf.length)] / 255
          const amp = val * mid * 0.85
          if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
        }
      } else {
        const pts = 120
        for (let i = 0; i <= pts; i++) {
          const x   = (i / pts) * W
          const amp = (Math.sin(i * 0.18 + t * 0.04) * 0.45 + Math.sin(i * 0.07 + t * 0.02) * 0.3) * mid * 0.5
          if (i === 0) ctx.moveTo(x, mid + amp); else ctx.lineTo(x, mid + amp)
        }
      }
      ctx.strokeStyle = 'rgba(74,199,219,0.65)'
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, 'rgba(74,199,219,0.15)')
      grad.addColorStop(1, 'rgba(74,199,219,0)')
      ctx.fillStyle = grad
      ctx.fill()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="vz-waveform-mini" style={{ flex: 1, height: '26px', display: 'block' }} />
}

// ── AudioAnalyzerPanel ────────────────────────────────────────────────
const AZ_BAND_COLORS  = ['#4ac7db', '#61d6aa', '#b84fc9', '#d8b95a', '#4ac7db', '#80dfc0']
const AZ_BAND_LABELS  = ['Bass', 'Low Mids', 'Mids', 'High Mids', 'Highs', 'Vocal']
const AZ_BANDS_HZ: [number, number][] = [
  [20, 250], [250, 800], [800, 2500], [2500, 5000], [5000, 16000], [300, 3000],
]

function AudioAnalyzerPanel({ analyser }: { analyser: AnalyserNode | null }) {
  const barRefs = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 6 }, () => null))
  const valRefs = useRef<Array<HTMLSpanElement | null>>(Array.from({ length: 6 }, () => null))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBufRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef     = useRef<number>(0)

  useEffect(() => {
    analyserRef.current = analyser
    freqBufRef.current  = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    function frame() {
      const an  = analyserRef.current
      const buf = freqBufRef.current
      let bands = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05]

      if (an && buf) {
        an.getByteFrequencyData(buf)
        const sr = an.context.sampleRate
        bands = AZ_BANDS_HZ.map(([lo, hi]) => getBandAvg(buf, sr, lo, hi))
        bands[5] = Math.min(1, (bands[1] + bands[2] + bands[3]) / 2.5)
      }

      barRefs.current.forEach((el, i) => {
        if (el) { el.style.height = `${Math.max(2, bands[i] * 100)}%`; el.style.background = AZ_BAND_COLORS[i] }
      })
      valRefs.current.forEach((el, i) => {
        if (el) el.textContent = bands[i].toFixed(2)
      })
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return (
    <div className="vz-analyzer-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <ChartHistogramIcon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Audio Analyzer</span>
      </div>
      <div className="vz-analyzer-body">
        <div className="vz-band-bars">
          {AZ_BAND_LABELS.map((label, i) => (
            <div key={label} className="vz-band-col">
              <span
                ref={el => { valRefs.current[i] = el }}
                className="vz-band-bar-val"
                style={{ color: AZ_BAND_COLORS[i] }}
              >0.05</span>
              <div className="vz-band-bar-track">
                <div
                  ref={el => { barRefs.current[i] = el }}
                  className="vz-band-bar-fill"
                  style={{ height: '5%', background: AZ_BAND_COLORS[i] }}
                />
              </div>
              <span className="vz-band-bar-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── OutputModeCard ────────────────────────────────────────────────────
function OutputModeCard({ onFullscreen }: { onFullscreen: () => void }) {
  return (
    <div className="vz-output-panel">
      <div className="vz-panel-header" style={{ minHeight: 32 }}>
        <Tv01Icon size={14} color="currentColor" style={{ flexShrink: 0 }} />
        <span className="vz-panel-title">Output</span>
      </div>
      <div className="vz-output-body">
        <button className="vz-fullscreen-btn" onClick={onFullscreen}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ marginRight: 5 }}>
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
          Fullscreen Output
        </button>
        <span className="vz-hotkey-pill">F</span>
      </div>
    </div>
  )
}


// ── time formatting helpers ───────────────────────────────────────────
function fmtPlayTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return '--:--.--'
  const m  = Math.floor(secs / 60)
  const s  = Math.floor(secs % 60)
  const cs = Math.floor((secs % 1) * 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ── VyzualzDock ───────────────────────────────────────────────────────
function VyzualzDock() {
  const {
    presets, activePresetId, bpm, setBpm, bpmSync, toggleBpmSync, setPlaying,
    cuePoint, setCuePoint, beatGridEnabled, setBeatGridEnabled,
    waveformZoom, setWaveformZoom, cueMarkers,
  } = useVisualStore(useShallow(s => ({
    presets:            s.presets,
    activePresetId:     s.activePresetId,
    bpm:                s.bpm,
    setBpm:             s.setBpm,
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

  const track    = engine.tracks[engine.currentIndex] ?? null
  const hasTrack = engine.tracks.length > 0

  const { peaks } = useWaveformPeaks(track?.url ?? null)

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
  const srLabel = `${(engine.sampleRate / 1000).toFixed(1)} kHz`
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
          <VzMiniWaveform
            duration={engine.duration}
            currentTime={engine.currentTime}
            peaks={peaks}
            markers={cueMarkers}
            onSeek={hasTrack ? engine.seek : undefined}
            zoom={waveformZoom}
          />
          <div className="vz-dock-cue-overlay">
            <VzCueMarkerStrip markers={cueMarkers} currentTime={engine.currentTime} onSeek={engine.seek} />
          </div>
        </div>
        <div className="vz-dock-zoom-btns">
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom * 2)} disabled={waveformZoom >= 16} title="Zoom in">+</button>
          <button className="vz-dock-zoom-btn" onClick={() => setWaveformZoom(waveformZoom / 2)} disabled={waveformZoom <= 1} title="Zoom out">−</button>
        </div>
      </div>

      {/* ── RIGHT: BPM + TAP / CUE / SYNC / BEATGRID ────────────────── */}
      <div className="vz-dock-right">
        <div className="vz-dock-bpm-block">
          <span className="vz-dock-bpm-block-label">BPM</span>
          <div className="vz-dock-bpm-block-row">
            <span className="vz-dock-bpm-block-val">{bpm.toFixed(2)}</span>
            <div className="vz-dock-bpm-chevrons">
              <button className="vz-dock-bpm-chevron" onClick={() => setBpm(bpm + 1)} title="BPM +1">
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 15l5-5 5 5z"/></svg>
              </button>
              <button className="vz-dock-bpm-chevron" onClick={() => setBpm(bpm - 1)} title="BPM −1">
                <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor"><path d="M7 9l5 5 5-5z"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="vz-dock-right-btns">
          <button className="vz-dock-tap-btn" onClick={handleTap} title="Tap tempo">TAP</button>
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

// ── Rail tab definitions ──────────────────────────────────────────────
type LeftPanel  = 'media' | 'layers' | 'presets' | 'sessions'
type RightPanel = 'fx' | 'mod' | 'audio' | 'rec' | 'insp'

const LEFT_TABS: RailTabOption<LeftPanel>[] = [
  { id: 'media',    label: 'Media'    },
  { id: 'layers',   label: 'Layers'   },
  { id: 'presets',  label: 'Presets'  },
  { id: 'sessions', label: 'Sessions' },
]

const BASE_RIGHT_TABS: Omit<RailTabOption<RightPanel>, 'disabled'>[] = [
  { id: 'fx',    label: 'FX'    },
  { id: 'mod',   label: 'MOD'   },
  { id: 'audio', label: 'AUDIO' },
  { id: 'rec',   label: 'REC'   },
  { id: 'insp',  label: 'INSP'  },
]

// ── localStorage helpers ──────────────────────────────────────────────
function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

// ── Main view ─────────────────────────────────────────────────────────
interface Props {
  activeView: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate: (v: 'analyzer' | 'reference' | 'vyzualz') => void
}

export function VyzualzView({ activeView, onNavigate }: Props) {
  const engine = useSharedAudio()
  const analyser = engine.analyserMaster

  // App-level view: 'visualizer' (default) or 'lyrics'
  const [appView, setAppView] = useState<'visualizer' | 'lyrics'>('visualizer')

  const {
    effects, enabledFxArr,
    activeMediaId, presets, activePresetId,
    bpm, bpmSync, isPlaying, quality,
    setEffect, resetEffects, toggleFx, selectPreset, savePreset, deletePreset,
    setActiveMedia, setBpm, toggleBpmSync, setPlaying, setQuality,
    sessions, sessionsLoading, sessionSyncError,
    saveSession, loadSession, renameSession, deleteSession,
    syncSessionsFromCloud, clearSessionSyncError,
    modulationRoutes, toggleModulationRoute, setModulationRouteAmount,
    timelineEnabled, timelineClips, timelineOverlayClips, timelineEffectRegions, timelineLoop, setTimelineEnabled, scrubTimeline,
    selectedTimelineEntity,
    layerConfigs, layerItems,
    effectParams, setEffectParam,
    audioReactivityEnabled, setAudioReactivityEnabled,
  } = useVisualStore(useShallow(s => ({
    effects:                   s.effects,
    enabledFxArr:              s.enabledFxArr,
    activeMediaId:             s.activeMediaId,
    presets:                   s.presets,
    activePresetId:            s.activePresetId,
    bpm:                       s.bpm,
    bpmSync:                   s.bpmSync,
    isPlaying:                 s.isPlaying,
    quality:                   s.quality,
    setEffect:                 s.setEffect,
    resetEffects:              s.resetEffects,
    toggleFx:                  s.toggleFx,
    selectPreset:              s.selectPreset,
    savePreset:                s.savePreset,
    deletePreset:              s.deletePreset,
    setActiveMedia:            s.setActiveMedia,
    setBpm:                    s.setBpm,
    toggleBpmSync:             s.toggleBpmSync,
    setPlaying:                s.setPlaying,
    setQuality:                s.setQuality,
    sessions:                  s.sessions,
    sessionsLoading:           s.sessionsLoading,
    sessionSyncError:          s.sessionSyncError,
    saveSession:               s.saveSession,
    loadSession:               s.loadSession,
    renameSession:             s.renameSession,
    deleteSession:             s.deleteSession,
    syncSessionsFromCloud:     s.syncSessionsFromCloud,
    clearSessionSyncError:     s.clearSessionSyncError,
    modulationRoutes:          s.modulationRoutes,
    toggleModulationRoute:     s.toggleModulationRoute,
    setModulationRouteAmount:  s.setModulationRouteAmount,
    timelineEnabled:           s.timelineEnabled,
    timelineClips:             s.timelineClips,
    timelineOverlayClips:      s.timelineOverlayClips,
    timelineEffectRegions:     s.timelineEffectRegions,
    timelineLoop:              s.timelineLoop,
    setTimelineEnabled:        s.setTimelineEnabled,
    scrubTimeline:             s.scrubTimeline,
    selectedTimelineEntity:    s.selectedTimelineEntity,
    layerConfigs:              s.layerConfigs,
    layerItems:                s.layerItems,
    effectParams:              s.effectParams,
    setEffectParam:            s.setEffectParam,
    audioReactivityEnabled:    s.audioReactivityEnabled,
    setAudioReactivityEnabled: s.setAudioReactivityEnabled,
  })))

  const { items, loading, reorderItems } = useMediaStore()

  const enabledFxSet = useMemo(() => new Set(enabledFxArr), [enabledFxArr])
  // Baseline mode overrides the enabled-effects set to empty without touching the store,
  // so the user's effect configuration is fully preserved when baseline is toggled off.
  const effectiveEnabledFx = enabledFxSet

  // After Supabase load completes, restore or auto-select active media.
  // Only auto-select primary-renderable media (background, loop, other) so that
  // layer-only assets (logo, overlay, texture, etc.) are never chosen as the
  // main canvas source automatically.
  useEffect(() => {
    if (loading) return
    if (!items.length) return
    if (activeMediaId && items.some(i => i.id === activeMediaId)) return
    const primary = items.find(isPrimaryMedia)
    setActiveMedia(primary?.id ?? null)
  }, [items, activeMediaId, loading, setActiveMedia])
  const activeMedia  = items.find(i => i.id === activeMediaId) ?? null

  // One-way sync: if the audio engine stops on its own (e.g. last track ends),
  // bring visualStore.isPlaying down so the canvas drops to idle.
  useEffect(() => {
    if (!engine.isPlaying && isPlaying) setPlaying(false)
  }, [engine.isPlaying, isPlaying, setPlaying])

  const [isAddCueModalOpen, setIsAddCueModalOpen] = useState(false)

  // Inspector collapse state — persisted to localStorage
  const [isLeftInspectorCollapsed,  setIsLeftInspectorCollapsed]  = useState(() => readLS('drmvyz:vz:leftCollapsed',  false))
  const [isRightInspectorCollapsed, setIsRightInspectorCollapsed] = useState(() => readLS('drmvyz:vz:rightCollapsed', false))
  const toggleLeftInspector  = () => setIsLeftInspectorCollapsed(prev => !prev)
  const toggleRightInspector = () => setIsRightInspectorCollapsed(prev => !prev)
  useEffect(() => { localStorage.setItem('drmvyz:vz:leftCollapsed',  JSON.stringify(isLeftInspectorCollapsed))  }, [isLeftInspectorCollapsed])
  useEffect(() => { localStorage.setItem('drmvyz:vz:rightCollapsed', JSON.stringify(isRightInspectorCollapsed)) }, [isRightInspectorCollapsed])

  // Left/right panel active tab — persisted to localStorage
  const [activeLeftPanel,  setActiveLeftPanel]  = useState<LeftPanel>(() => readLS<LeftPanel>('drmvyz:vz:leftPanel',  'media'))
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanel>(() => readLS<RightPanel>('drmvyz:vz:rightPanel', 'fx'))
  useEffect(() => { localStorage.setItem('drmvyz:vz:leftPanel',  JSON.stringify(activeLeftPanel))  }, [activeLeftPanel])
  useEffect(() => { localStorage.setItem('drmvyz:vz:rightPanel', JSON.stringify(activeRightPanel)) }, [activeRightPanel])

  // Auto-switch to Inspector tab when a timeline element is selected
  useEffect(() => {
    if (selectedTimelineEntity) setActiveRightPanel('insp')
  }, [selectedTimelineEntity])

  const rightTabs = useMemo<RailTabOption<RightPanel>[]>(() =>
    BASE_RIGHT_TABS.map(t => t.id === 'insp' ? { ...t, disabled: !selectedTimelineEntity } : t),
  [selectedTimelineEntity])

  // (bass is computed directly inside BeatCanvas via analyser ref — no React state needed here)

  const canvasWrapRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  // ── Render-source toast ──────────────────────────────────────────────
  // "Has useful media source" = timeline mode with clips, OR active deck media.
  // When neither is true the canvas renders generative art — effects have no media target.
  const hasMediaSource = (timelineEnabled && timelineClips.length > 0) || activeMedia !== null

  const [sourceToast, setSourceToast] = useState<{ message: string; warn: boolean; id: number } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showSourceToast = useCallback((message: string, warn = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setSourceToast({ message, warn, id: Date.now() })
    toastTimerRef.current = setTimeout(() => setSourceToast(null), 5000)
  }, [])
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }, [])

  // Lyric state — subscribe to just the two values we render (enabled + count)

  // Show confirmation toast when the user returns from the Lyric Manager via "Preview in Visualizer"
  const prevAppViewRef = useRef<'visualizer' | 'lyrics'>(appView)
  useEffect(() => {
    if (prevAppViewRef.current === 'lyrics' && appView === 'visualizer') {
      const { lyricsEnabled: enabled, cues } = useLyricsStore.getState()
      if (enabled && cues.length > 0) {
        showSourceToast(`Previewing ${cues.length} lyric cue${cues.length !== 1 ? 's' : ''} in Visualizer`)
      }
    }
    prevAppViewRef.current = appView
  }, [appView, showSourceToast])

  // Extracted hooks
  const { handleTap }              = useTapTempo()
  const { handlePrev, handleNext } = useMediaNavigation()

  // Recording
  const recorder = useRecorder()
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const [liveFps, setLiveFps] = useState(0)

  // Guard: only thread audio into the recording when a source is actively producing signal.
  // engine.getRecordingStream() creates an AudioContext and a MediaStreamAudioDestinationNode
  // as a side effect — calling it when no source is active would produce a recording labelled
  // "Video + Audio" whose audio track is silence. Passing null instead signals video-only mode.
  const handleStartRecording = useCallback((canvas: HTMLCanvasElement) => {
    const audioStream = engine.isActive ? engine.getRecordingStream() : null
    recorder.startVideoRecording(canvas, audioStream)
  }, [engine.isActive, engine.getRecordingStream, recorder.startVideoRecording])

  const handleFullscreen = useCallback(() => {
    canvasWrapRef.current?.requestFullscreen?.().catch(() => {})
  }, [])

  const handleTogglePlayback = useCallback(() => {
    if (engine.isPlaying) {
      engine.pause()
      setPlaying(false)
    } else {
      if (!engine.tracks.length) {
        console.warn('[VYZUALZ] No audio track loaded — playback skipped')
        return
      }
      engine.play()
      setPlaying(true)
    }
  }, [engine, setPlaying])

  // Stable ref so the mount effect doesn't need syncSessionsFromCloud in its dep array.
  const syncSessionsRef = useRef(syncSessionsFromCloud)
  useEffect(() => { syncSessionsRef.current = syncSessionsFromCloud }, [syncSessionsFromCloud])

  // Sync cloud sessions exactly once on mount.
  useEffect(() => { syncSessionsRef.current() }, [])

  // Wraps toggleFx — shows a one-time guidance toast when enabling an effect
  // without a media source, so users understand what they're editing against.
  const handleToggleFx = useCallback((name: string) => {
    const isEnabling = !enabledFxArr.includes(name)
    toggleFx(name)
    if (isEnabling && !hasMediaSource) {
      showSourceToast(
        'No active media source — enable Timeline or select deck media to preview media-based effects',
        true,
      )
    }
  }, [toggleFx, enabledFxArr, hasMediaSource, showSourceToast])

  const handleSavePreset = useCallback((name: string, scope: PresetScope) => {
    savePreset(name, {
      scope,
      mediaOrder: scope.mediaOrder ? items.map(i => i.id) : undefined,
      audioSource: scope.audioSource ? (engine.source as VzSession['audioSource']) : undefined,
    })
  }, [savePreset, items, engine.source])

  const handleSelectPreset = useCallback((id: string) => {
    const scene = selectPreset(id)
    if (!scene) return
    if (scene.audioSource && engine.source !== scene.audioSource) {
      engine.setSource(scene.audioSource)
    }
    if (scene.mediaOrder?.length) {
      reorderItems(scene.mediaOrder)
    }
    const presetName = presets.find(p => p.id === id)?.name ?? 'Preset'
    if (!hasMediaSource) {
      showSourceToast(
        `${presetName} applied · No media source — enable Timeline or select deck media to preview media effects`,
        true,
      )
    } else {
      const sourceLabel = timelineEnabled
        ? 'Timeline'
        : (activeMedia?.title ?? activeMedia?.name ?? 'Deck')
      showSourceToast(`${presetName} applied · Source: ${sourceLabel}`)
    }
  }, [selectPreset, engine, reorderItems, presets, hasMediaSource, timelineEnabled, activeMedia, showSourceToast])

  const handleSaveSession = useCallback(() => {
    const name = prompt('Session name:')?.trim()
    if (!name) return
    const mediaOrder = items.map(i => i.id)
    saveSession(name, engine.source as VzSession['audioSource'], mediaOrder)
  }, [items, engine.source, saveSession])

  const handleLoadSession = useCallback((id: string) => {
    const session = loadSession(id)
    if (!session) return
    if (session.audioSource && engine.source !== session.audioSource) {
      engine.setSource(session.audioSource)
    }
    if (session.mediaOrder?.length) {
      reorderItems(session.mediaOrder)
    }
    const allIds = items.map(i => i.id)
    if (session.activeMediaId && !allIds.includes(session.activeMediaId)) {
      const savedPrimary = session.mediaOrder.find(id => {
        const item = items.find(m => m.id === id)
        return item && isPrimaryMedia(item)
      })
      const fallback = items.find(isPrimaryMedia)?.id ?? null
      setActiveMedia(savedPrimary ?? fallback)
    }
  }, [loadSession, engine, reorderItems, items, setActiveMedia])

  const handleTimelineScrub = useCallback((t: number) => {
    scrubTimeline(t)
    if (engine.source === 'file' && engine.tracks.length > 0) {
      engine.seek(t)
    }
  }, [scrubTimeline, engine])

  // Keyboard shortcuts
  useVyzualzKeyboard({
    onPlayPause:    handleTogglePlayback,
    onFullscreen:   handleFullscreen,
    presets,
    onSelectPreset: handleSelectPreset,
  })

  // ── Lyrics view ─────────────────────────────────────────────────────
  if (appView === 'lyrics') {
    return (
      <div className="az-root">
        <div className="az-shell">
          <VyzualzSidebar
            compact
            appView={appView}
            onAppViewChange={setAppView}
          />
          <LyricManagerView onBack={() => setAppView('visualizer')} />
        </div>
      </div>
    )
  }

  return (
    <>
    <VyzualzShell
      isLeftInspectorCollapsed={isLeftInspectorCollapsed}
      isRightInspectorCollapsed={isRightInspectorCollapsed}
      sidebar={
        <VyzualzSidebar
          compact
          appView={appView}
          onAppViewChange={setAppView}
        />
      }
      topBar={
        <VyzualzTopBar
          analyser={analyser}
          onSaveSession={handleSaveSession}
        />
      }
      leftRail={
        <WorkspaceRail
          side="left"
          label="VYZUALZ left inspector"
          collapsed={isLeftInspectorCollapsed}
          onToggleCollapsed={toggleLeftInspector}
        >
          <RailTabs
            tabs={LEFT_TABS}
            activeTab={activeLeftPanel}
            onChange={setActiveLeftPanel}
            ariaLabel="VYZUALZ left workspace panels"
          />
          <div className="vz-panel-body">
            {activeLeftPanel === 'media' && (
              <VyzualzErrorBoundary section="MediaDeck">
                <MediaDeckPanel activeMediaId={activeMediaId} onSelect={setActiveMedia} />
              </VyzualzErrorBoundary>
            )}
            {activeLeftPanel === 'layers' && (
              <VyzualzErrorBoundary section="Layers">
                <VzLayersPanel />
              </VyzualzErrorBoundary>
            )}
            {activeLeftPanel === 'presets' && (
              <PresetStrip
                activePresetId={activePresetId}
                presets={presets}
                onSelect={handleSelectPreset}
                onSave={handleSavePreset}
                onDelete={deletePreset}
              />
            )}
            {activeLeftPanel === 'sessions' && (
              <SessionPanel
                sessions={sessions}
                sessionsLoading={sessionsLoading}
                sessionSyncError={sessionSyncError}
                onSave={handleSaveSession}
                onLoad={handleLoadSession}
                onDelete={deleteSession}
                onRename={renameSession}
                onClearSyncError={clearSessionSyncError}
                defaultOpen
                hideToggle
              />
            )}
          </div>
        </WorkspaceRail>
      }
      stage={
        <StageArea
          preview={
            <OutputFrame>
              <VyzualzErrorBoundary section="Canvas">
                <LiveVisualPreview
                  analyser={analyser}
                  activeMedia={activeMedia}
                  effects={effects}
                  enabledFx={effectiveEnabledFx}
                  onSelectVisualizer={() => setTimelineEnabled(false)}
                  isPlaying={isPlaying}
                  onPlay={handleTogglePlayback}
                  onPause={handleTogglePlayback}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onFullscreen={handleFullscreen}
                  bpm={bpm}
                  bpmSync={bpmSync}
                  quality={quality}
                  onQualityChange={setQuality}
                  canvasWrapRef={canvasWrapRef}
                  audioTime={engine.currentTime}
                  getAudioTime={engine.getCurrentTime}
                  audioDuration={engine.duration}
                  modulationRoutes={modulationRoutes}
                  timelineEnabled={timelineEnabled}
                  onToggleTimeline={() => setTimelineEnabled(!timelineEnabled)}
                  timelineClips={timelineClips}
                  timelineOverlayClips={timelineOverlayClips}
                  timelineEffectRegions={timelineEffectRegions}
                  timelineLoop={timelineLoop}
                  mediaItems={items}
                  layerConfigs={layerConfigs}
                  layerItems={layerItems}
                  effectParams={effectParams}
                  audioReactivityEnabled={audioReactivityEnabled}
                  onCanvasReady={setOutputCanvas}
                  onLiveFps={setLiveFps}
                  stageOverlays={
                    sourceToast ? (
                      <div
                        key={sourceToast.id}
                        className={`vz-source-toast${sourceToast.warn ? ' vz-source-toast--warn' : ''}`}
                        title={sourceToast.message}
                      >
                        {sourceToast.message}
                      </div>
                    ) : null
                  }
                />
              </VyzualzErrorBoundary>
            </OutputFrame>
          }
          overlay={
            timelineEnabled ? (
              <VyzualzErrorBoundary section="Timeline">
                <TimelinePanel onScrub={handleTimelineScrub} onAddCue={() => setIsAddCueModalOpen(true)} />
              </VyzualzErrorBoundary>
            ) : undefined
          }
        />
      }
      rightRail={
        <WorkspaceRail
          side="right"
          label="VYZUALZ right inspector"
          collapsed={isRightInspectorCollapsed}
          onToggleCollapsed={toggleRightInspector}
        >
          <RailTabs
            tabs={rightTabs}
            activeTab={activeRightPanel}
            onChange={setActiveRightPanel}
            ariaLabel="VYZUALZ right workspace panels"
          />
          <div className="vz-panel-body">
            {activeRightPanel === 'fx' && (
              <>
                <EffectChainPanel enabled={enabledFxSet} onToggle={handleToggleFx} />
                <EffectControlsPanel
                  effects={effects}
                  enabledFx={enabledFxSet}
                  onChange={setEffect}
                  onReset={resetEffects}
                  effectParams={effectParams}
                  onParamChange={setEffectParam}
                  audioReactivityEnabled={audioReactivityEnabled}
                />
              </>
            )}
            {activeRightPanel === 'mod' && (
              <ModulationPanel
                routes={modulationRoutes}
                onToggle={toggleModulationRoute}
                onSetAmount={setModulationRouteAmount}
                audioReactivityEnabled={audioReactivityEnabled}
                onSetAudioReactivity={setAudioReactivityEnabled}
              />
            )}
            {activeRightPanel === 'audio' && (
              <AudioAnalyzerPanel analyser={analyser} />
            )}
            {activeRightPanel === 'rec' && (
              <RecordingPanel
                canvas={outputCanvas}
                recorderState={recorder.recorderState}
                recordingMode={recorder.recordingMode}
                recordingTime={recorder.recordingTime}
                recorderError={recorder.recorderError}
                fps={recorder.fps}
                liveFps={liveFps}
                onFpsChange={recorder.setFps}
                onStartRecording={handleStartRecording}
                onStopRecording={recorder.stopRecording}
                hasActiveProgramAudio={engine.isActive}
                onExportPng={recorder.exportPNG}
              />
            )}
            {activeRightPanel === 'insp' && (
              <TimelineInspectorPanel onSeekToLyric={handleTimelineScrub} />
            )}
          </div>
        </WorkspaceRail>
      }
      bottomBar={<BottomPerformanceBar />}
      dock={<VyzualzDock />}
    />
    <AddCueModal isOpen={isAddCueModalOpen} onClose={() => setIsAddCueModalOpen(false)} />
    </>
  )
}

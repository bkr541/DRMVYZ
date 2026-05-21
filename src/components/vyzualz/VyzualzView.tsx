import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import {
  ChartHistogramIcon,
  Tv01Icon,
} from 'hugeicons-react'
import { AnalyzerSidebar } from '../analyzer/AnalyzerSidebar'
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
import { OutputFrame }          from './stage/OutputFrame'
import { useVyzualzKeyboard }   from './hooks/useVyzualzKeyboard'
import { useTapTempo }          from './hooks/useTapTempo'
import { useMediaNavigation }   from './hooks/useMediaNavigation'

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


// ── VyzualzDock ───────────────────────────────────────────────────────
function VyzualzDock() {
  const {
    presets, activePresetId, bpm, setBpm, bpmSync, toggleBpmSync, setPlaying,
  } = useVisualStore()
  const preset = presets.find(p => p.id === activePresetId) ?? presets[0] ?? DEFAULT_PRESETS[0]
  const engine = useSharedAudio()
  const fileInputId = useId()

  const vol    = engine.volume
  const volPct = `${Math.round(vol * 100)}%`

  const track = engine.tracks[engine.currentIndex] ?? null
  const hasTrack = engine.tracks.length > 0

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

  const initial  = track?.displayName?.[0]?.toUpperCase() ?? '♪'
  const title    = track?.displayName ?? 'No track loaded'
  const srLabel  = `${(engine.sampleRate / 1000).toFixed(1)} kHz`

  return (
    <div className="az-dock">
      {/* Track info + upload */}
      <div className="az-dock-track">
        <label
          className="az-dock-thumb"
          htmlFor={fileInputId}
          title="Click to load audio"
          style={{ cursor: 'pointer', borderColor: preset.color + '40' }}
        >
          <span className="az-dock-thumb-letter" style={{ color: preset.color + 'cc' }}>
            {hasTrack ? initial : '♪'}
          </span>
        </label>
        <div className="az-dock-info">
          <span className="az-dock-title">{title}</span>
          {hasTrack && (
            <div className="az-dock-format">
              <span className="az-dock-format-tag">{srLabel}</span>
              <span className="az-dock-format-tag">Stereo</span>
            </div>
          )}
        </div>
        <label
          className="az-dock-upload-btn"
          htmlFor={fileInputId}
          title="Upload audio file"
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          Add Track
        </label>
      </div>

      {/* Transport */}
      <div className="az-dock-transport">
        <button className="az-transport-btn" title="Stop" disabled={!hasTrack}
          onClick={() => { engine.stop() }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
        </button>
        <button className="az-transport-btn" title="Previous" disabled={!hasTrack}
          onClick={engine.prev}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button
          className="az-play-btn"
          title={engine.isPlaying ? 'Pause' : 'Play'}
          disabled={!hasTrack}
          style={{ borderColor: preset.color, color: preset.color, boxShadow: `0 0 12px ${preset.color}30` }}
          onClick={() => {
            if (engine.isPlaying) {
              engine.pause()
              setPlaying(false)
            } else {
              engine.play()
              setPlaying(true)
            }
          }}
        >
          {engine.isPlaying
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          }
        </button>
        <button className="az-transport-btn" title="Next" disabled={!hasTrack}
          onClick={engine.next}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      {/* Scrubber */}
      <TrackScrubber
        currentTime={engine.currentTime}
        duration={engine.duration}
        onSeek={engine.seek}
        disabled={!hasTrack}
        accentColor={preset.color}
      />

      <div className="vz-dock-bpm-group">
        <span className="vz-dock-bpm-label">BPM</span>
        <BpmInput value={bpm} onChange={setBpm} className="vz-dock-bpm-input" />
        <button
          className={`vz-dock-sync-btn${bpmSync ? ' vz-dock-sync-btn--on' : ''}`}
          onClick={toggleBpmSync}
          title={bpmSync ? 'BPM Sync: ON — click to disable' : 'BPM Sync: OFF — click to enable'}
        >
          {bpmSync && <span className="vz-dock-sync-dot" />}
          SYNC
        </button>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => handleFiles(e.target.files)}
      />

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

      <div className="az-dock-right">
        <select className="az-dock-source-select">
          <option>Main Out</option>
        </select>
      </div>
    </div>
  )
}

// ── Rail tab definitions ──────────────────────────────────────────────
type LeftPanel  = 'media' | 'layers' | 'presets' | 'sessions'
type RightPanel = 'fx' | 'mod' | 'audio'

const LEFT_TABS: RailTabOption<LeftPanel>[] = [
  { id: 'media',    label: 'Media'    },
  { id: 'layers',   label: 'Layers'   },
  { id: 'presets',  label: 'Presets'  },
  { id: 'sessions', label: 'Sessions' },
]

const RIGHT_TABS: RailTabOption<RightPanel>[] = [
  { id: 'fx',    label: 'FX'    },
  { id: 'mod',   label: 'MOD'   },
  { id: 'audio', label: 'AUDIO' },
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
    timelineEnabled, timelineClips, timelineLoop, setTimelineEnabled, scrubTimeline,
    layerConfigs, layerItems,
  } = useVisualStore()

  const { items, loading, reorderItems } = useMediaStore()

  const enabledFxSet = useMemo(() => new Set(enabledFxArr), [enabledFxArr])

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

  // Live bass for BeatCanvas
  const [bassLive, setBassLive] = useState(0)
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
      if (an && buf) {
        an.getByteFrequencyData(buf)
        setBassLive(getBandAvg(buf, an.context.sampleRate, 20, 250))
      }
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const canvasWrapRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>

  // Extracted hooks
  const { handleTap }              = useTapTempo()
  const { handlePrev, handleNext } = useMediaNavigation()

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
  }, [selectPreset, engine, reorderItems])

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

  return (
    <VyzualzShell
      isLeftInspectorCollapsed={isLeftInspectorCollapsed}
      isRightInspectorCollapsed={isRightInspectorCollapsed}
      sidebar={<AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} compact />}
      topBar={
        <VyzualzTopBar
          analyser={analyser}
          bassLive={bassLive}
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
                  enabledFx={enabledFxSet}
                  isPlaying={isPlaying}
                  onPlay={handleTogglePlayback}
                  onPause={handleTogglePlayback}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onFullscreen={handleFullscreen}
                  bpm={bpm}
                  onBpmChange={setBpm}
                  bpmSync={bpmSync}
                  onToggleBpmSync={toggleBpmSync}
                  onTap={handleTap}
                  quality={quality}
                  onQualityChange={setQuality}
                  canvasWrapRef={canvasWrapRef}
                  audioTime={engine.currentTime}
                  modulationRoutes={modulationRoutes}
                  timelineEnabled={timelineEnabled}
                  onToggleTimeline={() => setTimelineEnabled(!timelineEnabled)}
                  timelineClips={timelineClips}
                  timelineLoop={timelineLoop}
                  mediaItems={items}
                  layerConfigs={layerConfigs}
                  layerItems={layerItems}
                />
              </VyzualzErrorBoundary>
            </OutputFrame>
          }
          overlay={
            timelineEnabled ? (
              <VyzualzErrorBoundary section="Timeline">
                <TimelinePanel onScrub={handleTimelineScrub} />
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
            tabs={RIGHT_TABS}
            activeTab={activeRightPanel}
            onChange={setActiveRightPanel}
            ariaLabel="VYZUALZ right workspace panels"
          />
          <div className="vz-panel-body">
            {activeRightPanel === 'fx' && (
              <>
                <EffectChainPanel enabled={enabledFxSet} onToggle={toggleFx} />
                <EffectControlsPanel
                  effects={effects}
                  enabledFx={enabledFxSet}
                  onChange={setEffect}
                  onReset={resetEffects}
                />
              </>
            )}
            {activeRightPanel === 'mod' && (
              <ModulationPanel
                routes={modulationRoutes}
                onToggle={toggleModulationRoute}
                onSetAmount={setModulationRouteAmount}
              />
            )}
            {activeRightPanel === 'audio' && (
              <AudioAnalyzerPanel analyser={analyser} />
            )}
          </div>
        </WorkspaceRail>
      }
      bottomBar={<BottomPerformanceBar />}
      dock={<VyzualzDock />}
    />
  )
}

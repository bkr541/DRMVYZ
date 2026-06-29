import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLyricsStore } from '../../stores/lyricsStore'
import {
  ChartHistogramIcon,
  Tv01Icon,
} from 'hugeicons-react'
import { VyzualzSidebar } from './VyzualzSidebar'
import { LyricManagerView } from '../../features/lyrics/LyricManagerView'
import { UnsavedLyricChangesDialog } from '../../features/lyrics/components/UnsavedLyricChangesDialog'
import { useSharedAudio }  from '../../context/AudioEngineContext'
import { useMediaStore }   from '../../stores/mediaStore'
import { useVisualStore }  from '../../stores/visualStore'
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
import type { EffectChainOptionRow } from '../../types/database'
import { dbListEffectChainOptions } from '../../lib/effectChainDb'
import { ModulationPanel }                  from './modulation/ModulationPanel'
import { MusicIntelligenceDiagnosticsPanel } from './modulation/MusicIntelligenceDiagnosticsPanel'
import { PresetStrip }          from './sessions/PresetStrip'
import { SessionPanel }         from './sessions/SessionPanel'
import { LiveVisualPreview }    from './stage/LiveVisualPreview'
import { OutputFrame }          from './stage/OutputFrame'
import { useVyzualzKeyboard }   from './hooks/useVyzualzKeyboard'
import { useTapTempo }          from './hooks/useTapTempo'
import { VyzualzAudioDock }     from './shared/VyzualzAudioDock'
import { useMediaNavigation }   from './hooks/useMediaNavigation'
import { useRecorder }          from '../../hooks/useRecorder'
import { RecordingPanel }       from './recording/RecordingPanel'
import { TimelineInspectorPanel } from './timeline/TimelineInspectorPanel'
import { AddCueModal }            from './AddCueModal'
import { ReactView }              from './react/ReactView'

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


// ── Rail tab definitions ──────────────────────────────────────────────
type LeftPanel  = 'media' | 'layers' | 'sessions'
type RightPanel = 'presets' | 'fx' | 'mod' | 'audio' | 'rec' | 'insp'

const LEFT_TABS: RailTabOption<LeftPanel>[] = [
  { id: 'media',    label: 'Media'    },
  { id: 'layers',   label: 'Layers'   },
  { id: 'sessions', label: 'Sessions' },
]

const BASE_RIGHT_TABS: Omit<RailTabOption<RightPanel>, 'disabled'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'fx',      label: 'FX'      },
  { id: 'mod',     label: 'MOD'     },
  { id: 'audio',   label: 'AUDIO'   },
  { id: 'rec',     label: 'REC'     },
  { id: 'insp',    label: 'INSP'    },
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

  // App-level view: 'visualizer' | 'lyrics' | 'react'
  const [appView, setAppView] = useState<'visualizer' | 'lyrics' | 'react'>('react')
  const lyricEditorDirty = useLyricsStore(state => state.editorDirty)
  const lyricEditorSaving = useLyricsStore(state => state.isSaving)
  const [pendingAppView, setPendingAppView] = useState<'visualizer' | 'react' | null>(null)

  const requestAppViewChange = useCallback((next: 'visualizer' | 'lyrics' | 'react') => {
    if (appView === 'lyrics' && next !== 'lyrics' && lyricEditorDirty) {
      setPendingAppView(next)
      return
    }
    setAppView(next)
  }, [appView, lyricEditorDirty])

  // Effect Chain catalog — loaded once from Supabase on mount
  const [effectChainOptions, setEffectChainOptions] = useState<EffectChainOptionRow[]>([])
  const [effectChainLoading, setEffectChainLoading] = useState(true)
  const [effectChainError,   setEffectChainError]   = useState<string | null>(null)

  const loadEffectChainOptions = useCallback(async () => {
    setEffectChainLoading(true)
    setEffectChainError(null)
    try {
      const result = await dbListEffectChainOptions()
      if (result.error) {
        setEffectChainOptions([])
        setEffectChainError(result.error)
      } else {
        setEffectChainOptions(result.options)
      }
    } finally {
      setEffectChainLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEffectChainOptions()
  }, [loadEffectChainOptions])

  const {
    effects, enabledFxArr,
    activeMediaId, presets, activePresetId,
    bpm, bpmSync, isPlaying, quality,
    setEffect, resetEffects, toggleFx, selectPreset, savePreset, deletePreset, clearActivePreset,
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
    clearActivePreset:         s.clearActivePreset,
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
  const [activeLeftPanel,  setActiveLeftPanel]  = useState<LeftPanel>(() => {
    const v = readLS<string>('drmvyz:vz:leftPanel', 'media')
    return (['media', 'layers', 'sessions'] as string[]).includes(v) ? (v as LeftPanel) : 'media'
  })
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
  const prevAppViewRef = useRef<'visualizer' | 'lyrics' | 'react'>(appView)
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
      <>
        <div className="az-root">
          <div className="az-shell">
            <VyzualzSidebar
              compact
              appView={appView}
              onAppViewChange={requestAppViewChange}
            />
            <LyricManagerView onBack={() => requestAppViewChange('visualizer')} />
          </div>
        </div>
        <UnsavedLyricChangesDialog
          open={pendingAppView !== null}
          busy={lyricEditorSaving}
          message="Save your lyric edits before leaving Lyric Manager?"
          onCancel={() => setPendingAppView(null)}
          onDiscard={() => {
            const next = pendingAppView
            useLyricsStore.getState().markEditorDirty(false)
            setPendingAppView(null)
            if (next) setAppView(next)
          }}
          onSave={() => {
            const next = pendingAppView
            void useLyricsStore.getState().saveActiveLyricDocument().then(result => {
              if (!result?.ok || !next) return
              useLyricsStore.getState().markEditorDirty(false)
              setPendingAppView(null)
              setAppView(next)
            })
          }}
        />
      </>
    )
  }

  // ── React performance mode view ──────────────────────────────────────
  if (appView === 'react') {
    return (
      <div className="az-root">
        <div className="az-shell">
          <VyzualzSidebar
            compact
            appView={appView}
            onAppViewChange={requestAppViewChange}
          />
          <div className="vz-main" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ReactView />
            </div>
          </div>
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
          onAppViewChange={requestAppViewChange}
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
            {activeRightPanel === 'presets' && (
              <PresetStrip
                activePresetId={activePresetId}
                presets={presets}
                onSelect={handleSelectPreset}
                onSave={handleSavePreset}
                onDelete={deletePreset}
                onClear={clearActivePreset}
              />
            )}
            {activeRightPanel === 'fx' && (
              <>
                <EffectChainPanel
                  options={effectChainOptions}
                  loading={effectChainLoading}
                  error={effectChainError}
                  enabled={enabledFxSet}
                  onToggle={handleToggleFx}
                  onRetry={loadEffectChainOptions}
                />
                <EffectControlsPanel
                  effects={effects}
                  effectOptions={effectChainOptions}
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
              <div className="vz-analyzer-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="vz-panel-header" style={{ minHeight: 32 }}>
                  <ChartHistogramIcon size={14} color="currentColor" style={{ flexShrink: 0 }} />
                  <span className="vz-panel-title">Music Intelligence</span>
                </div>
                <MusicIntelligenceDiagnosticsPanel />
              </div>
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
      dock={<VyzualzAudioDock />}
    />
    <AddCueModal isOpen={isAddCueModalOpen} onClose={() => setIsAddCueModalOpen(false)} />
    </>
  )
}

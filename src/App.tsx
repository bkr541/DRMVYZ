import { useState, useCallback, useRef } from 'react'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useModuleSystem } from './hooks/useModuleSystem'
import { usePresets } from './hooks/usePresets'
import { useRecorder } from './hooks/useRecorder'
import {
  THEME_COLORS, DEFAULT_SETTINGS, GlobalSettings,
  LayoutPreset, ModuleInstance, ModuleWidth, ModuleHeight, AudioSource
} from './types'

// Layout
import { Sidebar, type NavItem } from './components/Sidebar'
import { ModuleContainer }  from './components/ModuleContainer'
import { LayoutControls }   from './components/LayoutControls'
import { SourceSelector }   from './components/SourceSelector'

// Visualizers
import { SpectrumModule }     from './components/SpectrumModule'
import { SpectrogramModule }  from './components/SpectrogramModule'
import { WaveformModule }     from './components/WaveformModule'
import { VectorscopeModule }  from './components/VectorscopeModule'
import { OscilloscopeModule } from './components/OscilloscopeModule'
import { LoudnessModule }     from './components/LoudnessModule'
import { LRMeterModule }      from './components/LRMeterModule'
import { MidSideModule }      from './components/MidSideModule'
import { PhaseModule }        from './components/PhaseModule'
import { BandMetersModule }   from './components/BandMetersModule'
import { LevelMeterModule }   from './components/LevelMeterModule'

// Panels
import { AudioUploader }    from './components/AudioUploader'
import { PlaylistPanel }    from './components/PlaylistPanel'
import { SettingsPanel }    from './components/SettingsPanel'
import { PresetsPanel }     from './components/PresetsPanel'
import { RecordingPanel }   from './components/RecordingPanel'
import { SafeMargins }      from './components/SafeMargins'

// New panels
import { MonitoringPanel }    from './components/monitoring/MonitoringPanel'
import { ReferencePanel }     from './components/reference/ReferencePanel'
import { MasteringAssistant } from './components/mastering/MasteringAssistant'
import { WaveformComparison } from './components/WaveformComparison'

import { formatTime } from './utils/formatTime'
import type { MonitoringMode } from './types/audio'

// ─── Module renderer ─────────────────────────────────────────────────────────
function RenderModule({ mod, engine, settings, primary, secondary }: {
  mod: ModuleInstance
  engine: ReturnType<typeof useAudioEngine>
  settings: GlobalSettings
  primary: string
  secondary: string
}) {
  const common = {
    analyser:  engine.analyserMaster,
    analyserL: engine.analyserL,
    analyserR: engine.analyserR,
    isActive:  engine.isActive,
    primaryColor:   primary,
    secondaryColor: secondary,
    showGlow:        false,
    accentIntensity: 0.5,
    showPeakHold:    settings.showPeakHold,
    peakDecay:       settings.peakDecay,
    sensitivity:     settings.sensitivity,
    sampleRate:      engine.sampleRate,
  }

  switch (mod.type) {
    case 'spectrum':
      return <SpectrumModule
        analyser={common.analyser} isActive={common.isActive}
        mode={mod.settings.spectrumMode ?? 'bars'}
        colorMap={mod.settings.colorMap ?? 'cyan-green'}
        showGlow={false} accentIntensity={0.5}
        showPeakHold={mod.settings.showPeakHold ?? settings.showPeakHold}
        peakDecay={mod.settings.peakDecay ?? settings.peakDecay}
        showTargetCurve={mod.settings.showTargetCurve ?? false}
        sensitivity={common.sensitivity}
        refAnalyser={engine.refAnalyserMaster}
      />
    case 'spectrogram':
      return <SpectrogramModule
        analyser={common.analyser} isActive={common.isActive}
        colorMap={mod.settings.colorMap ?? 'cyan-green'}
        scrollSpeed={mod.settings.scrollSpeed ?? 2}
        sensitivity={common.sensitivity}
      />
    case 'waveform':
      return <WaveformModule
        analyser={common.analyser} isActive={common.isActive}
        mode={mod.settings.waveformMode ?? 'centered'}
        colorMap={mod.settings.colorMap ?? 'cyan-green'}
        showGlow={false} accentIntensity={0.5}
        currentTime={engine.currentTime} duration={engine.duration}
      />
    case 'vectorscope':
      return <VectorscopeModule
        analyserL={common.analyserL} analyserR={common.analyserR}
        isActive={common.isActive} primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
      />
    case 'oscilloscope':
      return <OscilloscopeModule
        analyserL={common.analyserL} analyserR={common.analyserR}
        isActive={common.isActive} mode={mod.settings.oscMode ?? 'L'}
        primaryColor={primary} showGlow={false} accentIntensity={0.5}
      />
    case 'loudness':
      return <LoudnessModule
        analyser={common.analyser} isActive={common.isActive}
        primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5} sampleRate={common.sampleRate}
      />
    case 'lr':
      return <LRMeterModule
        analyserL={common.analyserL} analyserR={common.analyserR}
        isActive={common.isActive} primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
        showPeakHold={common.showPeakHold} peakDecay={common.peakDecay}
      />
    case 'midside':
      return <MidSideModule
        analyserL={common.analyserL} analyserR={common.analyserR}
        isActive={common.isActive} primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
        showPeakHold={common.showPeakHold} peakDecay={common.peakDecay}
      />
    case 'phase':
      return <PhaseModule
        analyserL={common.analyserL} analyserR={common.analyserR}
        isActive={common.isActive} primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
      />
    case 'bands':
      return <BandMetersModule
        analyser={common.analyser} isActive={common.isActive}
        primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
        showPeakHold={common.showPeakHold} peakDecay={common.peakDecay}
        sampleRate={common.sampleRate}
      />
    case 'level':
      return <LevelMeterModule
        analyser={common.analyser} isActive={common.isActive}
        levelMode={mod.settings.levelMode ?? 'rms'}
        vuMode={mod.settings.vuMode ?? 'bar'}
        primaryColor={primary} secondaryColor={secondary}
        showGlow={false} accentIntensity={0.5}
        showPeakHold={common.showPeakHold} peakDecay={common.peakDecay}
        label={mod.label}
      />
    default:
      return <div className="module-placeholder">{mod.label}</div>
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

type OverlayPanel = 'monitoring' | 'reference' | 'mastering' | 'settings' | 'presets' | 'recording' | 'modules' | null

export default function App() {
  const engine   = useAudioEngine()
  const modSys   = useModuleSystem()
  const presets  = usePresets()
  const recorder = useRecorder()

  const [layout,      setLayout]      = useState<LayoutPreset>('dashboard')
  const [settings,    setSettings]    = useState<GlobalSettings>(DEFAULT_SETTINGS)
  const [overlay,     setOverlay]     = useState<OverlayPanel>(null)
  const [activeNav,   setActiveNav]   = useState<NavItem>('home')
  const [editMode,    setEditMode]    = useState(false)
  const [dragId,      setDragId]      = useState<string | null>(null)
  const [activePreset,setActivePreset]= useState<string | null>(null)
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetName,  setPresetName]  = useState('')

  const appRef = useRef<HTMLDivElement>(null)

  const updateSettings = useCallback((patch: Partial<GlobalSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    if ('fftSize'   in patch && patch.fftSize)   engine.setFftSize(patch.fftSize)
    if ('smoothing' in patch && patch.smoothing !== undefined) engine.setSmoothing(patch.smoothing)
  }, [engine])

  const toggleOverlay = useCallback((p: OverlayPanel) => setOverlay(prev => prev === p ? null : p), [])

  const { primary, secondary } = THEME_COLORS[settings.theme]
  const displayName = settings.displayNameOverride || engine.tracks[engine.currentIndex]?.displayName || ''
  const currentTrack = engine.tracks[engine.currentIndex] ?? null
  const activeRefTrack = engine.referenceTracks.find(t => t.slot === engine.activeRefSlot) ?? null

  const handleNav = useCallback((nav: NavItem) => {
    setActiveNav(nav)
    // Nav items open their respective overlays
    const overlayMap: Partial<Record<NavItem, OverlayPanel>> = {
      settings:  'settings',
      reference: 'reference',
      mastering: 'mastering',
    }
    const mapped = overlayMap[nav]
    if (mapped) setOverlay(prev => prev === mapped ? null : mapped)
    else setOverlay(null)
  }, [])

  const handlePresetLoad = useCallback((id: string) => {
    if (id === '__default') { setActivePreset(null); return }
    const p = presets.loadPreset(id)
    if (!p) return
    setSettings(p.settings)
    modSys.setModules(p.modules)
    setLayout(p.layout)
    setActivePreset(id)
  }, [presets, modSys])

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return
    presets.savePreset(presetName.trim(), settings, modSys.modules, layout)
    setPresetName('')
    setShowPresetSave(false)
  }, [presets, settings, modSys.modules, layout, presetName])

  const recMode = settings.recordingMode
  const pct = engine.duration > 0 ? (engine.currentTime / engine.duration) * 100 : 0

  const layoutClass = {
    'dashboard':  'layout-dashboard',
    '16:9':       'layout-landscape',
    'quad':       'layout-quad',
    'horizontal': 'layout-horizontal',
    '1:1':        'layout-square',
    '9:16':       'layout-vertical',
  }[layout]

  return (
    <div
      ref={appRef}
      className={`app-root ${layoutClass} ${recMode ? 'recording-mode' : ''}`}
      style={{ '--primary': primary, '--secondary': secondary } as React.CSSProperties}
    >
      {/* ── SIDEBAR ── */}
      <Sidebar
        activeNav={activeNav}
        onNav={handleNav}
        presets={presets.presets}
        activePresetId={activePreset}
        onPresetLoad={handlePresetLoad}
        onNewPreset={() => setShowPresetSave(true)}
        monitoringMode={engine.monitoringMode}
        volume={engine.volume}
        onVolume={engine.setVolume}
        primaryColor={primary}
        secondaryColor={secondary}
        theme={settings.theme}
      />

      {/* ── MAIN BODY ── */}
      <div className="app-main">

        {/* ── MODULE AREA ── */}
        <div className="module-area">

          {/* Top action bar */}
          {!recMode && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8, flexWrap: 'wrap',
            }}>
              <SourceSelector
                source={engine.source}
                onChange={s => engine.setSource(s as AudioSource)}
                micError={engine.micError}
                primaryColor={primary}
              />
              {engine.referenceTracks.length > 0 && (
                <button
                  className={`btn-text ab-indicator ${engine.isABMode ? 'ab-active' : ''}`}
                  onClick={() => engine.setABMode(!engine.isABMode)}
                >
                  {engine.isABMode ? 'B — Reference' : 'A — Main'}
                </button>
              )}
              <button
                className={`btn-text mon-indicator ${engine.monitoringMode !== 'stereo' ? 'mon-active' : ''}`}
                onClick={() => toggleOverlay('monitoring')}
                title="Monitoring mode"
              >
                ◈ {engine.monitoringMode !== 'stereo' ? engine.monitoringMode : 'Stereo'}
              </button>
              <div style={{ flex: 1 }} />
              <LayoutControls current={layout} onChange={setLayout} primaryColor={primary} />
              <button
                className={`btn-text ${editMode ? 'active' : ''}`}
                onClick={() => { setEditMode(p => !p); if (!editMode) toggleOverlay('modules') }}
              >
                Edit
              </button>
              {engine.source === 'file' && (
                <button
                  className="btn-text"
                  onClick={() => toggleOverlay('recording')}
                >
                  ● Rec
                </button>
              )}
              {recMode && (
                <button className="rec-exit-btn" onClick={() => updateSettings({ recordingMode: false })}>
                  EXIT REC
                </button>
              )}
            </div>
          )}

          {/* Inline uploader for file source */}
          {!recMode && engine.source === 'file' && engine.tracks.length === 0 && (
            <div style={{ marginBottom: 8, maxWidth: 400 }}>
              <AudioUploader onFiles={engine.addTracks} primaryColor={primary} />
            </div>
          )}

          {/* Playlist (when file source + tracks exist) */}
          {!recMode && engine.source === 'file' && engine.tracks.length > 0 && (
            <details style={{ marginBottom: 6 }}>
              <summary style={{
                fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(224,234,248,0.3)', cursor: 'pointer', marginBottom: 4,
                userSelect: 'none', listStyle: 'none',
              }}>
                Playlist · {engine.tracks.length} track{engine.tracks.length !== 1 ? 's' : ''}
                {displayName && <span style={{ color: primary, marginLeft: 8 }}>{displayName}</span>}
              </summary>
              <div style={{ maxWidth: 600 }}>
                <PlaylistPanel
                  tracks={engine.tracks}
                  currentIndex={engine.currentIndex}
                  isPlaying={engine.isPlaying}
                  onSelect={engine.selectTrack}
                  onRemove={engine.removeTrack}
                  primaryColor={primary}
                />
                <div style={{ marginTop: 6, maxWidth: 300 }}>
                  <AudioUploader onFiles={engine.addTracks} primaryColor={primary} />
                </div>
              </div>
            </details>
          )}

          {/* Safe margins */}
          {settings.showSafeMargins && !recMode && (
            <SafeMargins aspect={settings.safeMarginsAspect} primaryColor={primary} />
          )}

          {/* Preset save form */}
          {showPresetSave && (
            <div style={{
              display: 'flex', gap: 6, marginBottom: 8, maxWidth: 340,
              background: 'rgba(255,255,255,0.04)', borderRadius: 6,
              padding: '8px 10px', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <input
                className="presets-name-input"
                placeholder="Preset name…"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                autoFocus
              />
              <button className="btn-text active" onClick={handleSavePreset}>Save</button>
              <button className="btn-xs" onClick={() => setShowPresetSave(false)}>✕</button>
            </div>
          )}

          {/* Module grid */}
          <div className="module-grid">
            {modSys.enabledModules.map(mod => (
              <ModuleContainer
                key={mod.id}
                module={mod}
                primaryColor={primary}
                showBorders={settings.showModuleBorders}
                onWidthChange={(w: ModuleWidth) => modSys.setModuleWidth(mod.id, w)}
                onHeightChange={(h: ModuleHeight) => modSys.setModuleHeight(mod.id, h)}
                onToggle={() => modSys.toggleModule(mod.id)}
                onMoveUp={() => modSys.moveModule(mod.id, 'up')}
                onMoveDown={() => modSys.moveModule(mod.id, 'down')}
                onDragStart={setDragId}
                onDragOver={id => { if (dragId && dragId !== id) modSys.swapModules(dragId, id) }}
                onDrop={() => setDragId(null)}
                editMode={editMode}
              >
                <RenderModule mod={mod} engine={engine} settings={settings} primary={primary} secondary={secondary} />
              </ModuleContainer>
            ))}

            {modSys.enabledModules.length === 0 && (
              <div className="module-empty">
                <p>No modules enabled.</p>
                <p>Click <strong>Edit</strong> to manage modules.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TRANSPORT BAR ── */}
        <div className="transport-bar">
          {/* Track info */}
          <div className="transport-track-info">
            <div className="transport-thumb">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            {currentTrack ? (
              <div className="transport-track-meta">
                <div className="transport-track-title">{currentTrack.displayName}</div>
                <div className="transport-track-artist">DVYDRM</div>
                <div className="transport-track-tech">
                  {engine.sampleRate / 1000} kHz · {engine.tracks.length} track{engine.tracks.length !== 1 ? 's' : ''}
                </div>
              </div>
            ) : (
              <span className="transport-track-empty">No track loaded</span>
            )}
          </div>

          {/* Center controls */}
          <div className="transport-controls-center">
            <div className="transport-seek-row">
              <span className="transport-time">{formatTime(engine.currentTime)}</span>
              <input
                type="range" className="seek-bar"
                min={0} max={engine.duration || 1} step={0.01}
                value={engine.currentTime}
                onChange={e => engine.seek(parseFloat(e.target.value))}
                disabled={!currentTrack}
                style={{ '--pct': `${pct}%` } as React.CSSProperties}
              />
              <span className="transport-time">{formatTime(engine.duration)}</span>
            </div>

            <div className="transport-btns-row">
              <button className="tb-btn" onClick={engine.prev} disabled={!currentTrack} title="Previous">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
              </button>
              <button className="tb-btn" onClick={engine.stop} disabled={!currentTrack} title="Stop">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
              </button>
              <button
                className="tb-btn-play"
                onClick={engine.isPlaying ? engine.pause : engine.play}
                disabled={!currentTrack && engine.source === 'file'}
                title={engine.isPlaying ? 'Pause' : 'Play'}
              >
                {engine.isPlaying
                  ? <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  : <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                }
              </button>
              <button className="tb-btn" onClick={engine.next} disabled={!currentTrack} title="Next">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
              <div style={{ width: 8 }} />
              <button
                className={`tb-btn ${settings.recordingMode ? 'active' : ''}`}
                onClick={() => updateSettings({ recordingMode: !settings.recordingMode })}
                title="Recording mode"
                style={{ fontSize: 11, color: settings.recordingMode ? '#ff3d6a' : 'rgba(224,234,248,0.3)' }}
              >
                ◉
              </button>
            </div>
          </div>

          {/* Right */}
          <div className="transport-controls-right">
            <svg className="tb-vol-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
            <input
              type="range" className="vol-slider"
              min={0} max={1} step={0.01}
              value={engine.volume}
              onChange={e => engine.setVolume(parseFloat(e.target.value))}
              style={{ '--pct': `${engine.volume * 100}%` } as React.CSSProperties}
            />
            <span className="tb-vol-val">{Math.round(engine.volume * 100)}%</span>
          </div>
        </div>

        {/* Status strip */}
        <div className="status-strip">
          <div className="status-strip-left">
            <span className="status-ok">● System OK</span>
            <span>{engine.sampleRate / 1000} kHz</span>
            {engine.spectralFeatures?.bpm && (
              <span>{engine.spectralFeatures.bpm.toFixed(1)} BPM</span>
            )}
          </div>
          <div className="status-strip-right">
            <span style={{ color: primary }}>
              {engine.source === 'file' ? 'FILE' : engine.source === 'microphone' ? 'MIC INPUT' : 'DEMO MODE'}
            </span>
            {engine.monitoringMode !== 'stereo' && (
              <span>◈ {engine.monitoringMode}</span>
            )}
            <span>DRMVYZ v3.0</span>
          </div>
        </div>
      </div>

      {/* ── OVERLAY PANELS ── */}

      {overlay === 'monitoring' && (
        <div className="panel-overlay panel-overlay-right">
          <div className="panel-overlay-header">
            <span>Monitoring</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <MonitoringPanel
              mode={engine.monitoringMode}
              onChange={(m: MonitoringMode) => engine.setMonitoringMode(m)}
              primaryColor={primary}
            />
          </div>
        </div>
      )}

      {overlay === 'reference' && (
        <div className="panel-overlay panel-overlay-right panel-overlay-wide">
          <div className="panel-overlay-header">
            <span>Reference Tracks</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <ReferencePanel
              referenceTracks={engine.referenceTracks}
              activeSlot={engine.activeRefSlot}
              isABMode={engine.isABMode}
              autoLoudnessMatch={engine.autoLoudnessMatch}
              refVolume={engine.refVolume}
              onAddTrack={engine.addReferenceTrack}
              onRemoveTrack={engine.removeReferenceTrack}
              onSetSlot={engine.setActiveRefSlot}
              onToggleAB={engine.setABMode}
              onAutoLoudness={engine.setAutoLoudnessMatch}
              onRefVolume={engine.setRefVolume}
              primaryColor={primary}
              secondaryColor={secondary}
            />
            {(currentTrack || activeRefTrack) && (
              <div style={{ height: 160, marginTop: 8 }}>
                <WaveformComparison
                  mainUrl={currentTrack?.url ?? null}
                  refUrl={activeRefTrack?.url ?? null}
                  isABMode={engine.isABMode}
                  primaryColor={primary}
                  secondaryColor={secondary}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {overlay === 'mastering' && (
        <div className="panel-overlay panel-overlay-right panel-overlay-wide">
          <div className="panel-overlay-header">
            <span>Mastering Assistant</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <MasteringAssistant
              analyser={engine.analyserMaster}
              analyserL={engine.analyserL}
              analyserR={engine.analyserR}
              isActive={engine.isActive}
              sampleRate={engine.sampleRate}
              primaryColor={primary}
              secondaryColor={secondary}
              spectralFeatures={engine.spectralFeatures}
              bpmDetecting={engine.bpmDetecting}
              onDetectBPM={engine.detectBPM}
            />
          </div>
        </div>
      )}

      {overlay === 'settings' && (
        <div className="panel-overlay panel-overlay-right">
          <div className="panel-overlay-header">
            <span>Settings</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              modules={modSys.modules}
              onModuleSettings={modSys.updateModuleSettings}
              primaryColor={primary}
              currentTrackName={currentTrack?.displayName ?? ''}
            />
          </div>
        </div>
      )}

      {overlay === 'presets' && (
        <div className="panel-overlay panel-overlay-right">
          <div className="panel-overlay-header">
            <span>Presets</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <PresetsPanel
              presets={presets.presets}
              onSave={name => { presets.savePreset(name, settings, modSys.modules, layout) }}
              onLoad={id => handlePresetLoad(id)}
              onDelete={presets.deletePreset}
              onExport={presets.exportPreset}
              onImport={presets.importPreset}
              primaryColor={primary}
            />
          </div>
        </div>
      )}

      {overlay === 'recording' && (
        <div className="panel-overlay panel-overlay-right">
          <div className="panel-overlay-header">
            <span>Recording</span>
            <button className="btn-xs" onClick={() => setOverlay(null)}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <RecordingPanel
              recorderState={recorder.recorderState}
              recordingTime={recorder.recordingTime}
              onStart={recorder.startRecording}
              onStop={recorder.stopRecording}
              onCaptureBuffer={recorder.exportRingBuffer}
              onExportPNG={recorder.exportPNG}
              onToggleRecMode={() => { updateSettings({ recordingMode: !recMode }); setOverlay(null) }}
              recordingMode={recMode}
              ringBuffer={engine.ringBuffer}
              primaryColor={primary}
            />
          </div>
        </div>
      )}

      {overlay === 'modules' && (
        <div className="panel-overlay panel-overlay-left">
          <div className="panel-overlay-header">
            <span>Modules</span>
            <button className="btn-xs" onClick={() => { setOverlay(null); setEditMode(false) }}>✕</button>
          </div>
          <div className="panel-overlay-scroll">
            <div className="settings-section-title">Enable / Disable</div>
            {modSys.modules.map(m => (
              <div key={m.id} className="module-manager-row">
                <label className="toggle-row">
                  <input type="checkbox" checked={m.enabled} onChange={() => modSys.toggleModule(m.id)} />
                  <span className="toggle-track" style={{ '--accent': primary } as React.CSSProperties}>
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">{m.label}</span>
                </label>
                <div className="module-mgr-btns">
                  <button className="sz-btn" onClick={() => modSys.moveModule(m.id, 'up')}>↑</button>
                  <button className="sz-btn" onClick={() => modSys.moveModule(m.id, 'down')}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

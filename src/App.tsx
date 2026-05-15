import { useState, useCallback, useRef } from 'react'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useModuleSystem } from './hooks/useModuleSystem'
import { usePresets } from './hooks/usePresets'
import { useRecorder } from './hooks/useRecorder'
import {
  THEME_COLORS, DEFAULT_SETTINGS, GlobalSettings,
  LayoutPreset, ModuleInstance, ModuleWidth, ModuleHeight, AudioSource
} from './types'

// Infrastructure
import { HudFrame }        from './components/HudFrame'
import { ModuleContainer } from './components/ModuleContainer'
import { SourceSelector }  from './components/SourceSelector'
import { SafeMargins }     from './components/SafeMargins'

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
import { TransportControls } from './components/TransportControls'
import { PlaylistPanel }    from './components/PlaylistPanel'
import { SettingsPanel }    from './components/SettingsPanel'
import { PresetsPanel }     from './components/PresetsPanel'
import { RecordingPanel }   from './components/RecordingPanel'
import { LayoutControls }   from './components/LayoutControls'
import { StatusPanel }      from './components/StatusPanel'
import { SystemPanel }      from './components/SystemPanel'

// New panels
import { MonitoringPanel }    from './components/monitoring/MonitoringPanel'
import { ReferencePanel }     from './components/reference/ReferencePanel'
import { MasteringAssistant } from './components/mastering/MasteringAssistant'
import { WaveformComparison } from './components/WaveformComparison'

import type { MonitoringMode } from './types/audio'
import { MONITORING_MODE_LABELS } from './types/audio'

// ─── Module renderer ─────────────────────────────────────────────────────────
function RenderModule({ mod, engine, settings, primary, secondary }: {
  mod: ModuleInstance
  engine: ReturnType<typeof useAudioEngine>
  settings: GlobalSettings
  primary: string
  secondary: string
}) {
  // When A/B mode is on, spectrum overlay gets both analysers for comparison
  const analyserForModule = engine.analyserMaster
  const analyserLForModule = engine.analyserL
  const analyserRForModule = engine.analyserR

  const common = {
    analyser: analyserForModule,
    analyserL: analyserLForModule,
    analyserR: analyserRForModule,
    isActive: engine.isActive,
    primaryColor:   primary,
    secondaryColor: secondary,
    showGlow:        settings.showGlow,
    accentIntensity: settings.accentIntensity,
    showPeakHold:    settings.showPeakHold,
    peakDecay:       settings.peakDecay,
    sensitivity:     settings.sensitivity,
    sampleRate:      engine.sampleRate,
  }

  switch (mod.type) {
    case 'spectrum':
      return <SpectrumModule
        analyser={common.analyser}
        isActive={common.isActive}
        mode={mod.settings.spectrumMode ?? 'bars'}
        colorMap={mod.settings.colorMap ?? 'cyan-green'}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        showPeakHold={mod.settings.showPeakHold ?? settings.showPeakHold}
        peakDecay={mod.settings.peakDecay ?? settings.peakDecay}
        showTargetCurve={mod.settings.showTargetCurve ?? false}
        sensitivity={common.sensitivity}
        refAnalyser={engine.refAnalyserMaster}
      />
    case 'spectrogram':
      return <SpectrogramModule
        analyser={common.analyser}
        isActive={common.isActive}
        colorMap={mod.settings.colorMap ?? 'fire'}
        scrollSpeed={mod.settings.scrollSpeed ?? 2}
        sensitivity={common.sensitivity}
      />
    case 'waveform':
      return <WaveformModule
        analyser={common.analyser}
        isActive={common.isActive}
        mode={mod.settings.waveformMode ?? 'centered'}
        colorMap={mod.settings.colorMap ?? 'cyan-green'}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        currentTime={engine.currentTime}
        duration={engine.duration}
      />
    case 'vectorscope':
      return <VectorscopeModule
        analyserL={common.analyserL}
        analyserR={common.analyserR}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
      />
    case 'oscilloscope':
      return <OscilloscopeModule
        analyserL={common.analyserL}
        analyserR={common.analyserR}
        isActive={common.isActive}
        mode={mod.settings.oscMode ?? 'L'}
        primaryColor={primary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
      />
    case 'loudness':
      return <LoudnessModule
        analyser={common.analyser}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        sampleRate={common.sampleRate}
      />
    case 'lr':
      return <LRMeterModule
        analyserL={common.analyserL}
        analyserR={common.analyserR}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        showPeakHold={common.showPeakHold}
        peakDecay={common.peakDecay}
      />
    case 'midside':
      return <MidSideModule
        analyserL={common.analyserL}
        analyserR={common.analyserR}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        showPeakHold={common.showPeakHold}
        peakDecay={common.peakDecay}
      />
    case 'phase':
      return <PhaseModule
        analyserL={common.analyserL}
        analyserR={common.analyserR}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
      />
    case 'bands':
      return <BandMetersModule
        analyser={common.analyser}
        isActive={common.isActive}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        showPeakHold={common.showPeakHold}
        peakDecay={common.peakDecay}
        sampleRate={common.sampleRate}
      />
    case 'level':
      return <LevelMeterModule
        analyser={common.analyser}
        isActive={common.isActive}
        levelMode={mod.settings.levelMode ?? 'rms'}
        vuMode={mod.settings.vuMode ?? 'bar'}
        primaryColor={primary}
        secondaryColor={secondary}
        showGlow={common.showGlow}
        accentIntensity={common.accentIntensity}
        showPeakHold={common.showPeakHold}
        peakDecay={common.peakDecay}
        label={mod.label}
      />
    default:
      return <div className="module-placeholder">{mod.label}</div>
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

type Panel = 'settings' | 'presets' | 'recording' | 'modules' | 'monitoring' | 'reference' | 'mastering' | null

export default function App() {
  const engine   = useAudioEngine()
  const modSys   = useModuleSystem()
  const presets  = usePresets()
  const recorder = useRecorder()

  const [layout,      setLayout]      = useState<LayoutPreset>('dashboard')
  const [settings,    setSettings]    = useState<GlobalSettings>(DEFAULT_SETTINGS)
  const [panel,       setPanel]       = useState<Panel>(null)
  const [editMode,    setEditMode]    = useState(false)
  const [dragId,      setDragId]      = useState<string | null>(null)
  const [showPlaylist,setShowPlaylist] = useState(true)
  const [isFullscreen,setIsFullscreen]= useState(false)

  const appRef = useRef<HTMLDivElement>(null)

  const updateSettings = useCallback((patch: Partial<GlobalSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
    if ('fftSize'   in patch && patch.fftSize)   engine.setFftSize(patch.fftSize)
    if ('smoothing' in patch && patch.smoothing !== undefined) engine.setSmoothing(patch.smoothing)
  }, [engine])

  const togglePanel = useCallback((p: Panel) => setPanel(prev => prev === p ? null : p), [])

  const { primary, secondary } = THEME_COLORS[settings.theme]

  const displayName = settings.displayNameOverride ||
    engine.tracks[engine.currentIndex]?.displayName || ''

  const handleSourceChange = useCallback(async (s: AudioSource) => {
    await engine.setSource(s)
  }, [engine])

  const handleSavePreset = useCallback((name: string) => {
    presets.savePreset(name, settings, modSys.modules, layout)
  }, [presets, settings, modSys.modules, layout])

  const handleLoadPreset = useCallback((id: string) => {
    const p = presets.loadPreset(id)
    if (!p) return
    setSettings(p.settings)
    modSys.setModules(p.modules)
    setLayout(p.layout)
    setPanel(null)
  }, [presets, modSys])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      appRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const themeVars = {
    '--primary': primary,
    '--secondary': secondary,
    '--accent-intensity': settings.accentIntensity,
    '--glow': settings.showGlow
      ? `0 0 ${settings.accentIntensity * 16}px ${primary}55`
      : 'none',
    '--font-scale': settings.fontDensity === 'compact' ? '0.85' : settings.fontDensity === 'large' ? '1.15' : '1',
  } as React.CSSProperties

  const layoutClass = {
    'dashboard':  'layout-dashboard',
    '16:9':       'layout-landscape',
    'quad':       'layout-quad',
    'horizontal': 'layout-horizontal',
    '1:1':        'layout-square',
    '9:16':       'layout-vertical',
  }[layout]

  const recMode = settings.recordingMode

  // Reference track for active slot
  const activeRefTrack = engine.referenceTracks.find(t => t.slot === engine.activeRefSlot) ?? null
  const mainTrack = engine.tracks[engine.currentIndex] ?? null

  const monLabel = MONITORING_MODE_LABELS[engine.monitoringMode]

  const NAV_ITEMS: { id: Panel; icon: string; label: string; accent?: string }[] = [
    { id: 'modules',    icon: '⊞', label: 'MODULES'  },
    { id: 'mastering',  icon: '◎', label: 'MASTERING' },
    { id: 'reference',  icon: '⇄', label: 'REFERENCE', accent: secondary },
    { id: 'monitoring', icon: '◈', label: 'MONITOR'  },
    { id: 'settings',   icon: '⚙', label: 'SETTINGS' },
    { id: 'presets',    icon: '⊙', label: 'PRESETS'  },
    { id: 'recording',  icon: '●', label: 'RECORD'   },
  ]

  return (
    <div
      ref={appRef}
      className={[
        'app-root',
        layoutClass,
        settings.showScanlines  ? 'scanlines'       : '',
        recMode                 ? 'recording-mode'  : '',
        settings.transparentBg  ? 'transparent-bg'  : '',
        editMode                ? 'edit-mode-active' : '',
      ].filter(Boolean).join(' ')}
      style={themeVars}
    >
      {settings.showGrid && <div className="grid-bg" aria-hidden />}

      <HudFrame
        primaryColor={primary}
        showGlow={settings.showGlow}
        accentIntensity={settings.accentIntensity}
        recordingMode={recMode}
        showRecIndicator={settings.showRecIndicator}
      />

      {settings.showSafeMargins && !recMode && (
        <SafeMargins aspect={settings.safeMarginsAspect} primaryColor={primary} />
      )}

      {/* ── TOP BAR ── */}
      <header className="top-bar">
        {settings.showLogo && (
          <div className="logo-block">
            <div className="logo-mark">
              <span style={{ color: primary }}>DV</span>
              <span style={{ color: secondary }}>Y</span>
              <span style={{ color: primary }}>DRM</span>
            </div>
            <div className="logo-sub">SIGNAL SYS</div>
          </div>
        )}

        <div className="title-block">
          <h1 className="main-title">
            DVYDRM <span style={{ color: secondary }}>//</span> DRMWLD SIGNAL
          </h1>
          {displayName && (
            <div className="now-playing-title" style={{ color: primary }}>{displayName}</div>
          )}
        </div>

        <div className="top-right-controls">
          {!recMode && (
            <>
              <SourceSelector
                source={engine.source}
                onChange={handleSourceChange}
                micError={engine.micError}
                primaryColor={primary}
              />

              {engine.referenceTracks.length > 0 && (
                <button
                  className={`btn-text ab-indicator ${engine.isABMode ? 'ab-active' : ''}`}
                  onClick={() => engine.setABMode(!engine.isABMode)}
                  style={{ '--accent': engine.isABMode ? secondary : primary } as React.CSSProperties}
                >
                  {engine.isABMode ? 'B REF' : 'A MAIN'}
                </button>
              )}

              <button
                className={`btn-text mon-indicator ${engine.monitoringMode !== 'stereo' ? 'mon-active' : ''}`}
                onClick={() => togglePanel('monitoring')}
                style={{ '--accent': primary } as React.CSSProperties}
              >
                ◈ {monLabel}
              </button>

              <LayoutControls current={layout} onChange={setLayout} primaryColor={primary} />
              <button className="btn-text" onClick={toggleFullscreen}
                style={{ '--accent': primary } as React.CSSProperties}>
                {isFullscreen ? '⊡' : '⊞'} FS
              </button>
              <button className="btn-text btn-rec-toggle"
                onClick={() => updateSettings({ recordingMode: true })}>
                ◉ REC MODE
              </button>
            </>
          )}
          {recMode && (
            <>
              {engine.source !== 'file' && (
                <SourceSelector source={engine.source} onChange={handleSourceChange} micError={engine.micError} primaryColor={primary} />
              )}
              <button className="btn-text" onClick={() => updateSettings({ recordingMode: false })}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' } as React.CSSProperties}>
                EXIT REC
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── BODY (nav + content) ── */}
      <div className="app-body">

        {/* ── LEFT NAV SIDEBAR ── */}
        {!recMode && (
          <nav className="nav-sidebar" style={{ '--primary': primary, '--secondary': secondary } as React.CSSProperties}>
            {NAV_ITEMS.map(({ id, icon, label, accent }) => (
              <button
                key={id}
                className={`nav-item ${panel === id ? 'active' : ''}`}
                onClick={() => {
                  togglePanel(id)
                  if (id === 'modules') setEditMode(p => panel !== id ? true : !p)
                }}
                title={label}
                style={{ '--accent': accent ?? primary } as React.CSSProperties}
              >
                <span className="nav-item-icon">{icon}</span>
                <span className="nav-item-label">{label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* ── PANELS ── */}
        {panel === 'monitoring' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset">
            <div className="panel-overlay-header">
              <span>MONITORING</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
            </div>
            <div className="panel-overlay-scroll">
              <MonitoringPanel
                mode={engine.monitoringMode}
                onChange={(m: MonitoringMode) => { engine.setMonitoringMode(m); }}
                primaryColor={primary}
              />
            </div>
          </div>
        )}

        {panel === 'reference' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset panel-overlay-wide">
            <div className="panel-overlay-header">
              <span>REFERENCE TRACKS</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
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
              {(mainTrack || activeRefTrack) && (
                <div style={{ padding: '8px 0', height: 160 }}>
                  <WaveformComparison
                    mainUrl={mainTrack?.url ?? null}
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

        {panel === 'mastering' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset panel-overlay-wide">
            <div className="panel-overlay-header">
              <span>MASTERING ASSISTANT</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
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

        {panel === 'settings' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset">
            <div className="panel-overlay-header">
              <span>SETTINGS</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
            </div>
            <div className="panel-overlay-scroll">
              <SettingsPanel
                settings={settings}
                onChange={updateSettings}
                modules={modSys.modules}
                onModuleSettings={modSys.updateModuleSettings}
                primaryColor={primary}
                currentTrackName={engine.tracks[engine.currentIndex]?.displayName ?? ''}
              />
            </div>
          </div>
        )}

        {panel === 'presets' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset">
            <div className="panel-overlay-header">
              <span>PRESETS</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
            </div>
            <div className="panel-overlay-scroll">
              <PresetsPanel
                presets={presets.presets}
                onSave={handleSavePreset}
                onLoad={handleLoadPreset}
                onDelete={presets.deletePreset}
                onExport={presets.exportPreset}
                onImport={presets.importPreset}
                primaryColor={primary}
              />
            </div>
          </div>
        )}

        {panel === 'recording' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset">
            <div className="panel-overlay-header">
              <span>RECORDING</span>
              <button className="btn-xs" onClick={() => setPanel(null)}>✕</button>
            </div>
            <div className="panel-overlay-scroll">
              <RecordingPanel
                recorderState={recorder.recorderState}
                recordingTime={recorder.recordingTime}
                onStart={recorder.startRecording}
                onStop={recorder.stopRecording}
                onCaptureBuffer={recorder.exportRingBuffer}
                onExportPNG={recorder.exportPNG}
                onToggleRecMode={() => { updateSettings({ recordingMode: !recMode }); setPanel(null) }}
                recordingMode={recMode}
                ringBuffer={engine.ringBuffer}
                primaryColor={primary}
              />
            </div>
          </div>
        )}

        {panel === 'modules' && !recMode && (
          <div className="panel-overlay panel-overlay-left panel-overlay-inset">
            <div className="panel-overlay-header">
              <span>MODULES</span>
              <button className="btn-xs" onClick={() => { setPanel(null); setEditMode(false) }}>✕</button>
            </div>
            <div className="panel-overlay-scroll">
              <div className="settings-section-title">ENABLE / REORDER</div>
              <div className="settings-note">Drag headers to reorder. Click to toggle.</div>
              {modSys.modules.map(m => (
                <div key={m.id} className="module-manager-row">
                  <label className="toggle-row">
                    <input type="checkbox" checked={m.enabled}
                      onChange={() => modSys.toggleModule(m.id)} />
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

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {!recMode && engine.source === 'file' && (
          <aside className="sidebar-left">
            <div className="panel panel-uploader">
              <div className="panel-header"><span>INPUT</span></div>
              <AudioUploader onFiles={engine.addTracks} primaryColor={primary} />
            </div>
            <div className="panel panel-playlist">
              <div className="panel-header">
                <span>PLAYLIST <span style={{ color: 'rgba(255,255,255,0.2)' }}>{engine.tracks.length}</span></span>
                <button className="btn-xs" onClick={() => setShowPlaylist(p => !p)}>{showPlaylist ? '▲' : '▼'}</button>
              </div>
              {showPlaylist && (
                <div className="playlist-scroll">
                  <PlaylistPanel tracks={engine.tracks} currentIndex={engine.currentIndex}
                    isPlaying={engine.isPlaying} onSelect={engine.selectTrack}
                    onRemove={engine.removeTrack} primaryColor={primary} />
                </div>
              )}
            </div>
            <div className="panel panel-system">
              <div className="panel-header"><span>SYSTEM</span></div>
              <SystemPanel isPlaying={engine.isPlaying} currentTime={engine.currentTime}
                duration={engine.duration} trackCount={engine.tracks.length}
                moduleCount={modSys.enabledModules.length} primaryColor={primary} />
            </div>
          </aside>
        )}

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
              <p>Click <strong>⊞ MODULES</strong> in the left sidebar to add visualizers.</p>
            </div>
          )}
        </div>
      </main>

      </div>{/* end app-body */}

      <footer className="bottom-bar">
        <StatusPanel isPlaying={engine.isPlaying} trackName={displayName}
          source={engine.source} primaryColor={primary} secondaryColor={secondary}
          showGlow={settings.showGlow} />

        {engine.source === 'file' && (
          <TransportControls
            isPlaying={engine.isPlaying} currentTime={engine.currentTime}
            duration={engine.duration} volume={engine.volume}
            onPlay={engine.play} onPause={engine.pause} onStop={engine.stop}
            onPrev={engine.prev} onNext={engine.next}
            onSeek={engine.seek} onVolume={engine.setVolume}
            primaryColor={primary} hasTrack={engine.tracks.length > 0}
          />
        )}

        <div className="footer-tagline">
          <span style={{ color: secondary }}>CONNECTED TO THE DREAMWORLD</span>
          <span style={{ opacity: 0.25 }}>◆ DRMVYZ v3.0 ◆ DVYDRM</span>
        </div>
      </footer>
    </div>
  )
}

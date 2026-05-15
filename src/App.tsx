import { useState, useCallback } from 'react'
import { useAudioEngine } from './hooks/useAudioEngine'
import { VisualizerSettings, LayoutPreset, Theme } from './types'
import { HudFrame } from './components/HudFrame'
import { AudioUploader } from './components/AudioUploader'
import { TransportControls } from './components/TransportControls'
import { PlaylistPanel } from './components/PlaylistPanel'
import { SpectrumAnalyzer } from './components/SpectrumAnalyzer'
import { VolumeMeters } from './components/VolumeMeters'
import { WaveformOverview } from './components/WaveformOverview'
import { OutputScope } from './components/OutputScope'
import { StatusPanel } from './components/StatusPanel'
import { SystemPanel } from './components/SystemPanel'
import { LayoutControls } from './components/LayoutControls'
import { SettingsPanel } from './components/SettingsPanel'

// Theme color maps
const THEME_COLORS: Record<Theme, { primary: string; secondary: string }> = {
  'cyan-green':  { primary: '#00e5ff', secondary: '#00ff88' },
  'cyan-blue':   { primary: '#00e5ff', secondary: '#448aff' },
  'green-gold':  { primary: '#00ff88', secondary: '#ffcc00' },
  'purple-cyan': { primary: '#bb86fc', secondary: '#00e5ff' },
}

const DEFAULT_SETTINGS: VisualizerSettings = {
  displayNameOverride: '',
  accentIntensity: 0.7,
  showScanlines: true,
  showGlow: true,
  showGrid: true,
  showLogo: true,
  theme: 'cyan-green',
  recordingMode: false,
}

export default function App() {
  const engine = useAudioEngine()
  const [layout, setLayout] = useState<LayoutPreset>('16:9')
  const [settings, setSettings] = useState<VisualizerSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(true)

  const updateSettings = useCallback((patch: Partial<VisualizerSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  const { primary, secondary } = THEME_COLORS[settings.theme]
  const currentTrack = engine.tracks[engine.currentIndex] ?? null
  const displayName = settings.displayNameOverride || currentTrack?.displayName || ''
  const isActive = engine.isPlaying

  // CSS vars injected on root for theming
  const themeVars = {
    '--primary': primary,
    '--secondary': secondary,
    '--accent-intensity': settings.accentIntensity,
    '--glow': settings.showGlow ? `0 0 ${settings.accentIntensity * 16}px ${primary}66` : 'none',
  } as React.CSSProperties

  const layoutClass = layout === '9:16' ? 'layout-vertical' : layout === '1:1' ? 'layout-square' : 'layout-landscape'

  return (
    <div
      className={`app-root ${layoutClass} ${settings.showScanlines ? 'scanlines' : ''} ${settings.recordingMode ? 'recording-mode' : ''}`}
      style={themeVars}
    >
      {/* Grid background */}
      {settings.showGrid && <div className="grid-bg" aria-hidden />}

      <HudFrame
        primaryColor={primary}
        showGlow={settings.showGlow}
        accentIntensity={settings.accentIntensity}
        recordingMode={settings.recordingMode}
      />

      {/* ── TOP BAR ──────────────────────────────────── */}
      <header className="top-bar">
        {settings.showLogo && (
          <div className="logo-block">
            <div className="logo-mark" style={{ color: primary }}>
              <span className="logo-dv">DV</span><span className="logo-y" style={{ color: secondary }}>Y</span><span className="logo-drm">DRM</span>
            </div>
            <div className="logo-sub">SIGNAL SYSTEM</div>
          </div>
        )}

        <div className="title-block">
          <h1 className="main-title">
            DVYDRM <span className="title-sep" style={{ color: secondary }}>//</span> DRMWLD SIGNAL
          </h1>
          {displayName && (
            <div className="now-playing-title" style={{ color: primary }}>
              {displayName}
            </div>
          )}
        </div>

        <div className="top-right-controls">
          {!settings.recordingMode && (
            <>
              <LayoutControls current={layout} onChange={setLayout} primaryColor={primary} />
              <button
                className={`btn-text ${showSettings ? 'active' : ''}`}
                onClick={() => setShowSettings(s => !s)}
                style={{ '--accent': primary } as React.CSSProperties}
              >
                {showSettings ? '✕ CLOSE' : '⚙ SETTINGS'}
              </button>
              <button
                className="btn-text btn-rec-toggle"
                onClick={() => updateSettings({ recordingMode: true })}
                style={{ '--accent': primary } as React.CSSProperties}
              >
                ● REC MODE
              </button>
            </>
          )}
          {settings.recordingMode && (
            <button
              className="btn-text"
              onClick={() => updateSettings({ recordingMode: false })}
              style={{ '--accent': primary, color: 'rgba(255,255,255,0.5)', fontSize: '11px' } as React.CSSProperties}
            >
              EXIT REC
            </button>
          )}
        </div>
      </header>

      {/* ── SETTINGS OVERLAY ─────────────────────────── */}
      {showSettings && !settings.recordingMode && (
        <div className="settings-overlay">
          <SettingsPanel
            settings={settings}
            onChange={updateSettings}
            primaryColor={primary}
            currentTrackName={currentTrack?.displayName ?? ''}
          />
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <main className="main-grid">

        {/* LEFT COLUMN */}
        <aside className={`left-col ${settings.recordingMode ? 'hidden' : ''}`}>
          <div className="panel panel-uploader">
            <div className="panel-header">
              <span>INPUT</span>
            </div>
            <AudioUploader onFiles={engine.addTracks} primaryColor={primary} />
          </div>

          <div className="panel panel-playlist">
            <div className="panel-header">
              <span>PLAYLIST <span className="panel-count">{engine.tracks.length}</span></span>
              <button className="btn-xs" onClick={() => setShowPlaylist(s => !s)}>
                {showPlaylist ? '▲' : '▼'}
              </button>
            </div>
            {showPlaylist && (
              <div className="playlist-scroll">
                <PlaylistPanel
                  tracks={engine.tracks}
                  currentIndex={engine.currentIndex}
                  isPlaying={engine.isPlaying}
                  onSelect={engine.selectTrack}
                  onRemove={engine.removeTrack}
                  primaryColor={primary}
                />
              </div>
            )}
          </div>
        </aside>

        {/* CENTER COLUMN */}
        <section className="center-col">
          <div className="panel panel-spectrum">
            <div className="panel-header">
              <span>SPECTRUM ANALYZER</span>
              <span className="panel-badge" style={{ color: secondary }}>FFT</span>
            </div>
            <div className="spectrum-wrap">
              <SpectrumAnalyzer
                analyser={engine.analyserMaster}
                accentIntensity={settings.accentIntensity}
                showGlow={settings.showGlow}
                primaryColor={primary}
                secondaryColor={secondary}
                active={isActive}
              />
            </div>
          </div>

          <div className="panel panel-waveform">
            <div className="panel-header">
              <span>WAVEFORM</span>
            </div>
            <div className="waveform-wrap">
              <WaveformOverview
                analyser={engine.analyserMaster}
                primaryColor={primary}
                showGlow={settings.showGlow}
                accentIntensity={settings.accentIntensity}
                active={isActive}
                currentTime={engine.currentTime}
                duration={engine.duration}
              />
            </div>
          </div>

          <div className="panel panel-transport">
            <TransportControls
              isPlaying={engine.isPlaying}
              currentTime={engine.currentTime}
              duration={engine.duration}
              volume={engine.volume}
              onPlay={engine.play}
              onPause={engine.pause}
              onStop={engine.stop}
              onPrev={engine.prev}
              onNext={engine.next}
              onSeek={engine.seek}
              onVolume={engine.setVolume}
              primaryColor={primary}
              hasTrack={engine.tracks.length > 0}
            />
          </div>

          <div className="panel panel-status">
            <StatusPanel
              isPlaying={engine.isPlaying}
              trackName={displayName}
              primaryColor={primary}
              secondaryColor={secondary}
              showGlow={settings.showGlow}
            />
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <aside className="right-col">
          <div className="panel panel-meters">
            <div className="panel-header">
              <span>LEVELS</span>
            </div>
            <div className="meters-wrap">
              <VolumeMeters
                analyserL={engine.analyserL}
                analyserR={engine.analyserR}
                primaryColor={primary}
                secondaryColor={secondary}
                showGlow={settings.showGlow}
                accentIntensity={settings.accentIntensity}
                active={isActive}
              />
            </div>
          </div>

          <div className="panel panel-scope">
            <div className="panel-header">
              <span>SCOPE</span>
              <span className="panel-badge" style={{ color: secondary }}>L/R</span>
            </div>
            <div className="scope-wrap">
              <OutputScope
                analyserL={engine.analyserL}
                analyserR={engine.analyserR}
                primaryColor={primary}
                secondaryColor={secondary}
                showGlow={settings.showGlow}
                accentIntensity={settings.accentIntensity}
                active={isActive}
              />
            </div>
          </div>

          <div className="panel panel-system">
            <div className="panel-header"><span>SYSTEM</span></div>
            <SystemPanel
              isPlaying={engine.isPlaying}
              currentTime={engine.currentTime}
              duration={engine.duration}
              trackCount={engine.tracks.length}
              primaryColor={primary}
            />
          </div>
        </aside>
      </main>

      {/* ── FOOTER ───────────────────────────────────── */}
      <footer className="app-footer">
        <span className="footer-text" style={{ color: secondary }}>CONNECTED TO THE DREAMWORLD</span>
        <span className="footer-sep">◆</span>
        <span className="footer-text">DRMVYZ v1.0</span>
        <span className="footer-sep">◆</span>
        <span className="footer-text">DVYDRM SIGNAL SYS</span>
      </footer>
    </div>
  )
}

import { useRef, useState, useCallback } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import type { AudioSource } from '../../types'

import { AnalyzerSidebar }        from './AnalyzerSidebar'
import { BottomTransportDock }     from './BottomTransportDock'
import { TrackInfoPanel }          from './TrackInfoPanel'
import { LoudnessPanel }           from './LoudnessPanel'
import { LevelMetersPanel }        from './LevelMetersPanel'
import { SpectrumSettingsPanel, useSpectrumSettings } from './SpectrumSettingsPanel'
import { MonitoringStatsPanel }    from './MonitoringStatsPanel'

import { SpectrumModule }          from '../SpectrumModule'
import { VectorscopeModule }       from '../VectorscopeModule'
import { WaveformModule }          from '../WaveformModule'

const CYAN = '#19bff2'
const CYAN2 = '#2edcb3'

interface AnalyzerViewProps {
  activeView?: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate?: (v: 'analyzer' | 'reference' | 'vyzualz') => void
}

export function AnalyzerView({ activeView = 'analyzer', onNavigate }: AnalyzerViewProps) {
  const engine = useAudioEngine()
  const { settings: specSettings, update: updateSpec } = useSpectrumSettings()

  const [specMode, setSpecMode] = useState<'Linear' | 'Log'>('Linear')
  const [stereoMode, setStereoMode] = useState<'Polar' | 'Lissajous'>('Polar')
  const [showSettings, setShowSettings] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const track = engine.tracks[engine.currentIndex] ?? null

  const handleSourceChange = useCallback(async (s: AudioSource) => {
    await engine.setSource(s)
  }, [engine])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (files.length) engine.addTracks(files)
  }, [engine])

  return (
    <div
      className="az-root"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false) }}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="az-drag-overlay">DROP AUDIO FILES</div>
      )}

      <div className="az-shell">
        <AnalyzerSidebar activeView={activeView} onNavigate={onNavigate} />

        <div className="az-main">
          <div className="az-grid">

            {/* ── Spectrum Analyzer ── */}
            <div className="az-panel az-panel-spectrum">
              <div className="az-panel-header">
                <span className="az-panel-title">Spectrum Analyzer</span>
                <div className="az-seg-group">
                  <button
                    className={`az-seg-btn ${specMode === 'Linear' ? 'az-seg-btn--active' : ''}`}
                    onClick={() => setSpecMode('Linear')}
                  >Linear</button>
                  <button
                    className={`az-seg-btn ${specMode === 'Log' ? 'az-seg-btn--active' : ''}`}
                    onClick={() => setSpecMode('Log')}
                  >Log</button>
                </div>
                <span className="az-spacer" />
                <select className="az-select" value={specSettings.mode}
                  onChange={e => updateSpec({ mode: e.target.value })}>
                  <option>1/3 Octave</option>
                  <option>1/6 Octave</option>
                  <option>Linear</option>
                  <option>FFT</option>
                </select>
                <button className="az-overflow-btn" title="More">···</button>
              </div>
              <div className="az-panel-body">
                <SpectrumModule
                  analyser={engine.analyserMaster}
                  isActive={engine.isActive}
                  mode="bars"
                  colorMap="cyan-green"
                  showGlow={false}
                  accentIntensity={0.4}
                  showPeakHold={specSettings.hold}
                  peakDecay={0.978}
                  showTargetCurve={false}
                  sensitivity={1.0}
                  freqScale={specMode}
                  refAnalyser={null}
                />
              </div>
            </div>

            {/* ── Stereo Image ── */}
            <div className="az-panel az-panel-stereo">
              <div className="az-panel-header">
                <span className="az-panel-title">Stereo Image</span>
                <span className="az-spacer" />
                <div className="az-seg-group">
                  <button
                    className={`az-seg-btn ${stereoMode === 'Polar' ? 'az-seg-btn--active' : ''}`}
                    onClick={() => setStereoMode('Polar')}
                  >Polar</button>
                  <button
                    className={`az-seg-btn ${stereoMode === 'Lissajous' ? 'az-seg-btn--active' : ''}`}
                    onClick={() => setStereoMode('Lissajous')}
                  >Lissajous</button>
                </div>
              </div>
              <div className="az-panel-body">
                <StereoImagePanel
                  analyserL={engine.analyserL}
                  analyserR={engine.analyserR}
                  isActive={engine.isActive}
                  mode={stereoMode}
                />
              </div>
            </div>

            {/* ── Waveform ── */}
            <div className="az-panel az-panel-waveform">
              <div className="az-panel-header">
                <span className="az-panel-title">Waveform</span>
                <span className="az-spacer" />
                <button className="az-icon-btn" title="Zoom in">+</button>
                <button className="az-icon-btn" title="Zoom out">−</button>
                <button className="az-overflow-btn" title="More">···</button>
              </div>
              <div className="az-panel-body">
                <WaveformDualPanel
                  trackUrl={track?.url ?? null}
                  currentTime={engine.currentTime}
                  duration={engine.duration}
                  onSeek={engine.seek}
                />
              </div>
            </div>

            {/* ── Level Meters ── */}
            <div className="az-panel az-panel-levelmeters">
              <div className="az-panel-header">
                <span className="az-panel-title">Level Meters</span>
                <span className="az-spacer" />
                <select className="az-select">
                  <option>EBU R128</option>
                  <option>VU</option>
                  <option>Peak</option>
                </select>
              </div>
              <div className="az-panel-body">
                <LevelMetersPanel
                  analyserL={engine.analyserL}
                  analyserR={engine.analyserR}
                  isActive={engine.isActive}
                />
              </div>
            </div>

            {/* ── Row 3: 4-panel bottom strip ── */}
            <div className="az-row3">

              {/* Track Info */}
              <div className="az-panel">
                <div className="az-panel-header">
                  <span className="az-panel-title">Track Info</span>
                  <span className="az-spacer" />
                  <button className="az-overflow-btn">···</button>
                </div>
                <div className="az-panel-body">
                  <TrackInfoPanel track={track} onFiles={engine.addTracks} />
                </div>
              </div>

              {/* Loudness */}
              <div className="az-panel">
                <div className="az-panel-header">
                  <span className="az-panel-title">Loudness</span>
                  <span className="az-spacer" />
                  <button className="az-overflow-btn">···</button>
                </div>
                <div className="az-panel-body">
                  <LoudnessPanel
                    analyser={engine.analyserMaster}
                    isActive={engine.isActive}
                    sampleRate={engine.sampleRate}
                  />
                </div>
              </div>

              {/* Spectrum Settings */}
              <div className="az-panel">
                <div className="az-panel-header">
                  <span className="az-panel-title">Spectrum Settings</span>
                </div>
                <div className="az-panel-body">
                  <SpectrumSettingsPanel settings={specSettings} onChange={updateSpec} />
                </div>
              </div>

              {/* Monitoring */}
              <div className="az-panel">
                <div className="az-panel-header">
                  <span className="az-panel-title">Monitoring</span>
                </div>
                <div className="az-panel-body">
                  <MonitoringStatsPanel
                    analyser={engine.analyserMaster}
                    analyserL={engine.analyserL}
                    analyserR={engine.analyserR}
                    isActive={engine.isActive}
                    sampleRate={engine.sampleRate}
                  />
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Settings popover */}
      {showSettings && (
        <div className="az-settings-popover">
          <div className="az-settings-popover-header">
            <span>Settings</span>
            <button className="az-popover-close" onClick={() => setShowSettings(false)}>✕</button>
          </div>
          <div className="az-settings-popover-body">
            <div className="az-popover-section-title">Monitoring Mode</div>
            <select
              className="az-select"
              style={{ width: '100%' }}
              value={engine.monitoringMode}
              onChange={e => engine.setMonitoringMode(e.target.value as Parameters<typeof engine.setMonitoringMode>[0])}
            >
              {(['stereo','mono','left','right','mid','side','lowpass','highpass','phone','car','club'] as const).map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Bottom transport dock */}
      <BottomTransportDock
        track={track}
        isPlaying={engine.isPlaying}
        currentTime={engine.currentTime}
        duration={engine.duration}
        volume={engine.volume}
        source={engine.source}
        sampleRate={engine.sampleRate}
        hasTrack={engine.tracks.length > 0}
        onPlay={engine.play}
        onPause={engine.pause}
        onStop={engine.stop}
        onPrev={engine.prev}
        onNext={engine.next}
        onSeek={engine.seek}
        onVolume={engine.setVolume}
        onSourceChange={handleSourceChange}
        onOpenSettings={() => setShowSettings(s => !s)}
        onFiles={engine.addTracks}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => {
          const files = Array.from(e.target.files ?? []).filter(f =>
            f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
          )
          if (files.length) engine.addTracks(files)
        }}
      />

      <style>{`
        .az-panel-body canvas { width: 100% !important; height: 100% !important; display: block; }
      `}</style>
    </div>
  )
}

// Thin wrapper for the existing vectorscope — shows L/R labels and correlation bar
function StereoImagePanel({ analyserL, analyserR, isActive, mode }: {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  mode: 'Polar' | 'Lissajous'
}) {
  const corrRef = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const markerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>
  const bufLRef = useRef<Float32Array<ArrayBuffer> | null>(null) as React.MutableRefObject<Float32Array<ArrayBuffer> | null>
  const bufRRef = useRef<Float32Array<ArrayBuffer> | null>(null) as React.MutableRefObject<Float32Array<ArrayBuffer> | null>

  return (
    <StereoImageInner
      analyserL={analyserL}
      analyserR={analyserR}
      isActive={isActive}
      mode={mode}
      corrRef={corrRef}
      markerRef={markerRef}
      bufLRef={bufLRef}
      bufRRef={bufRRef}
    />
  )
}

import { useAnimationFrame } from '../../hooks/useAnimationFrame'

function StereoImageInner({
  analyserL, analyserR, isActive, mode, corrRef, markerRef, bufLRef, bufRRef
}: {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  mode: 'Polar' | 'Lissajous'
  corrRef: React.RefObject<HTMLSpanElement>
  markerRef: React.RefObject<HTMLDivElement>
  bufLRef: React.MutableRefObject<Float32Array<ArrayBuffer> | null>
  bufRRef: React.MutableRefObject<Float32Array<ArrayBuffer> | null>
}) {
  const phaseRef = useRef(0)

  useAnimationFrame(() => {
    phaseRef.current += 0.02
    let corr = 0

    if (analyserL && analyserR && isActive) {
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)
      let sumLR = 0, sumLL = 0, sumRR = 0
      for (let i = 0; i < len; i++) {
        sumLR += bufLRef.current[i] * bufRRef.current[i]
        sumLL += bufLRef.current[i] * bufLRef.current[i]
        sumRR += bufRRef.current[i] * bufRRef.current[i]
      }
      const denom = Math.sqrt(sumLL * sumRR)
      corr = denom > 1e-10 ? Math.max(-1, Math.min(1, sumLR / denom)) : 0
    } else {
      corr = 0.12 + Math.sin(phaseRef.current * 0.3) * 0.08
    }

    if (corrRef.current) corrRef.current.textContent = corr.toFixed(2)
    // Map corr -1..1 → 0..100% for the bar
    const pct = ((corr + 1) / 2) * 100
    if (markerRef.current) markerRef.current.style.left = `${pct}%`
  })

  return (
    <div className="az-stereo-body">
      <div className="az-stereo-canvas-wrap">
        <div className="az-stereo-labels">
          <span className="az-stereo-label">L</span>
          <span className="az-stereo-label">R</span>
        </div>
        <div className="az-stereo-bottom-labels" style={{ bottom: 6 }}>
          <span className="az-stereo-label" style={{ fontSize: 9 }}>-1</span>
          <span className="az-stereo-label" style={{ fontSize: 9 }}>+1</span>
        </div>
        <VectorscopeModule
          analyserL={analyserL}
          analyserR={analyserR}
          isActive={isActive}
          mode={mode}
          primaryColor={CYAN}
          secondaryColor={CYAN2}
          showGlow={true}
          accentIntensity={0.55}
        />
      </div>
      <div className="az-correlation-row">
        <span className="az-correlation-label">CORRELATION</span>
        <div className="az-correlation-bar-wrap">
          <div className="az-correlation-bar-fill" style={{ width: '60%' }} />
          <div ref={markerRef} className="az-correlation-marker" style={{ left: '60%' }} />
        </div>
        <span ref={corrRef} className="az-correlation-val">0.12</span>
      </div>
    </div>
  )
}

function WaveformDualPanel({
  trackUrl, currentTime, duration, onSeek
}: {
  trackUrl: string | null
  currentTime: number
  duration: number
  onSeek: (t: number) => void
}) {
  const durSecs = duration > 0 ? duration : 60
  const marks = makeTimeMarks(durSecs, 6)

  return (
    <div className="az-waveform-body">
      <div className="az-waveform-tracks">
        <WaveformModule
          trackUrl={trackUrl}
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
        />
      </div>
      <div className="az-waveform-timeline">
        {marks.map(m => (
          <span key={m} className="az-waveform-time">{fmtMark(m)}</span>
        ))}
      </div>
    </div>
  )
}

function makeTimeMarks(dur: number, count: number): number[] {
  const step = dur / (count - 1)
  return Array.from({ length: count }, (_, i) => i * step)
}

function fmtMark(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

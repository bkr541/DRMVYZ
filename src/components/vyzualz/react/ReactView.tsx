import { useState, useMemo, useEffect, useCallback } from 'react'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useRecorder } from '../../../hooks/useRecorder'
import { useReactStore } from '../../../stores/reactStore'
import {
  ReactPresetsPanel,
  ReactEnginePanel,
  ReactFxPanel,
  ReactModulationPanel,
  ReactAudioPanel,
  ReactRecordingPanel,
  ReactInspectorPanel,
} from './panels/ReactRightPanels'
import { ReactTrackMapStrip } from './ReactTrackMapStrip'
import { SoundDrawingTimelineLane } from './SoundDrawingTimelineLane'
import { ReactPlaceholderCanvas } from './ReactPlaceholderCanvas'
import { ReactShaderCanvas }       from './ReactShaderCanvas'
import { ReactPerformancePads } from './ReactPerformancePads'
import { LaserDmxBeamMatrixEditorOverlay } from './LaserDmxBeamMatrixEditorOverlay'
import { LaserDmxLayersPanel } from './LaserDmxLayersPanel'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { RailTabs } from '../layout/RailTabs'
import type { RailTabOption } from '../layout/RailTabs'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { MediaDeckPanel } from '../media/MediaDeckPanel'
import { FontLibraryPanel } from './FontLibraryPanel'
import { useSvgVisualRehydration } from './useSvgVisualRehydration'
import { useFontLibraryHydration } from './useFontLibraryHydration'
import { useReactPresetAutomation } from './useReactPresetAutomation'
import '../../../styles/reactView.css'

type ReactLeftTab  = 'engine' | 'media' | 'layers' | 'sessions' | 'fonts'
type ReactRightPanel = 'presets' | 'fx' | 'mod' | 'audio' | 'rec' | 'insp'

// BASE_RIGHT_TABS omits 'disabled' — injected dynamically via useMemo (same pattern as Visualizer)
const REACT_RIGHT_BASE_TABS: Omit<RailTabOption<ReactRightPanel>, 'disabled'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'fx',      label: 'FX'      },
  { id: 'mod',     label: 'MOD'     },
  { id: 'audio',   label: 'AUDIO'   },
  { id: 'rec',     label: 'REC'     },
  { id: 'insp',    label: 'INSP'    },
]

const REACT_LEFT_TABS: RailTabOption<ReactLeftTab>[] = [
  { id: 'engine',   label: 'ENGINES'  },
  { id: 'media',    label: 'Media'    },
  { id: 'layers',   label: 'Layers'   },
  { id: 'sessions', label: 'Sessions' },
  { id: 'fonts',    label: 'Fonts'    },
]

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

export function ReactView() {
  const engine   = useSharedAudio()
  const analyser = engine.analyserMaster

  // Rehydrate SVG Visual cache whenever the selected visual changes or the view mounts.
  // Placed here so it runs regardless of which right-panel tab is open.
  useSvgVisualRehydration()
  useFontLibraryHydration()
  useReactPresetAutomation()

  const {
    reactPresets,
    activeReactPresetId,
    activeReactEngineId,
    laserDmxWorkspaceMode,
    reactIntensity,
    reactMotion,
    reactGlow,
    reactBassReactivity,
    reactTrailDecay,
    reactFogDensity,
    reactParticleDensity,
    oscillatorSettings,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    oscillatorTextPointCache,
    neonLatticeSettings,
    neonLatticeTrigger,
    manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId,
    beamEditorVisible,
    soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId,
  } = useReactStore(useShallow(s => ({
    reactPresets:           s.reactPresets,
    activeReactPresetId:    s.activeReactPresetId,
    activeReactEngineId:    s.activeReactEngineId,
    laserDmxWorkspaceMode:  s.laserDmxWorkspaceMode,
    reactIntensity:         s.reactIntensity,
    reactMotion:            s.reactMotion,
    reactGlow:              s.reactGlow,
    reactBassReactivity:    s.reactBassReactivity,
    reactTrailDecay:        s.reactTrailDecay,
    reactFogDensity:        s.reactFogDensity,
    reactParticleDensity:   s.reactParticleDensity,
    oscillatorSettings:             s.oscillatorSettings,
    oscillatorGlyphAssets:          s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:      s.oscillatorGlyphPointCache,
    oscillatorTextPointCache:       s.oscillatorTextPointCache,
    neonLatticeSettings:            s.neonLatticeSettings,
    neonLatticeTrigger:             s.neonLatticeTrigger,
    manualTrackSectionsByTrackId:   s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId: s.suppressedAutoSectionsByTrackId,
    beamEditorVisible:              s.laserDmxBeamMatrix.editor.beamEditorVisible,
    soundDrawingLayersByTrackId:    s.soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId:     s.soundDrawingClipsByTrackId,
  })))

  const [leftTab, setLeftTab]             = useState<ReactLeftTab>('engine')
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null)
  const [leftCollapsed,  setLeftCollapsed]  = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Recording — useRecorder lives at view level so active recordings survive tab switches
  const recorder = useRecorder()
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const [liveFps, setLiveFps]           = useState(0)

  const handleStartRecording = useCallback((canvas: HTMLCanvasElement) => {
    const audioStream = engine.isActive ? engine.getRecordingStream() : null
    recorder.startVideoRecording(canvas, audioStream)
  }, [engine.isActive, engine.getRecordingStream, recorder.startVideoRecording])

  // Right tab — persisted to localStorage.
  // Defaulting to 'engine': ENGINE tab contains the source/mode controls that were
  // previously the entire right rail, making it the most immediately useful landing tab.
  const [activeRightPanel, setActiveRightPanel] = useState<ReactRightPanel>(
    () => readLS<ReactRightPanel>('drmvyz:react:rightPanel', 'presets')
  )
  useEffect(() => {
    localStorage.setItem('drmvyz:react:rightPanel', JSON.stringify(activeRightPanel))
  }, [activeRightPanel])

  // selectedReactEntity: the currently "inspectable" thing.
  // Right now that's the active preset — always non-null when a preset is loaded.
  // TODO: expand to a full object/layer selection model (selectedReactObjectId in store).
  const selectedReactEntity = useMemo(
    () => reactPresets.find(p => p.id === activeReactPresetId) ?? null,
    [activeReactPresetId, reactPresets],
  )

  const rightTabs = useMemo<RailTabOption<ReactRightPanel>[]>(
    () => REACT_RIGHT_BASE_TABS.map(t =>
      t.id === 'insp'
        ? { ...t, disabled: activeReactEngineId !== 'shaderPads' && selectedReactEntity === null }
        : t
    ),
    [selectedReactEntity, activeReactEngineId]
  )

  // selectedReactEntity is the same preset lookup; fall back to the first preset when nothing is
  // explicitly selected so the canvas always has something to render.
  const activePreset = activeReactEngineId === 'shaderPads'
    ? null
    : (selectedReactEntity ?? reactPresets[0] ?? null)

  // Estimated track duration from the audio engine (fallback 180s)
  const audioDurationSec = (engine as { duration?: number }).duration ?? 180

  // Resolved sections for the current track: auto + manual merged.
  // This is the single section timeline consumed by Track Map, the renderer,
  // and any preset automation.  Manual overrides always take precedence.
  const resolvedSections = useMemo(() => {
    const trackId = engine.currentTrackId
    const analysis = engine.currentAnalysis
    const analyzedSections = analysis ? adaptMIAnalysis(analysis) : []
    const manualSections = trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
    const suppressedIds  = trackId ? (suppressedAutoSectionsByTrackId[trackId]  ?? []) : []
    return resolveTrackSections({ analyzedSections, manualSections, durationSec: audioDurationSec, suppressedIds })
  }, [engine.currentTrackId, engine.currentAnalysis, manualTrackSectionsByTrackId, suppressedAutoSectionsByTrackId, audioDurationSec])

  // Sound Drawing layers and clips for the active track — forwarded to canvas for per-frame rendering
  const activeTrackId        = engine.currentTrack?.id ?? null
  const activeSdLayers       = activeTrackId ? (soundDrawingLayersByTrackId[activeTrackId] ?? []) : []
  const activeSdClips        = activeTrackId ? (soundDrawingClipsByTrackId[activeTrackId]   ?? []) : []

  return (
    <div className="rv-shell">
      <div className="vz-header">
        <div className="vz-header-title-group">
          <div className="vz-header-title">REACT</div>
          <div className="vz-header-sub">Visual Performance Mode</div>
        </div>

        <div className="vz-header-sep" />

        <div className="vz-input-group">
          <span className="vz-input-label">Audio In</span>
          <select
            className="az-select"
            value={engine.source}
            onChange={e => engine.setSource(e.target.value as typeof engine.source)}
          >
            <option value="file">File Input</option>
            <option value="microphone">Microphone</option>
            <option value="demo">Demo Signal</option>
          </select>
        </div>

        <span className="az-spacer" />
        <VyzualzHeaderActions />
      </div>
      <div
        className="rv-layout"
        data-left-collapsed={leftCollapsed ? 'true' : undefined}
        data-right-collapsed={rightCollapsed ? 'true' : undefined}
      >
        {/* Left — tabbed rail */}
        <WorkspaceRail
          side="left"
          label="React left rail"
          collapsed={leftCollapsed}
          onToggleCollapsed={() => setLeftCollapsed(v => !v)}
        >
          <RailTabs
            tabs={REACT_LEFT_TABS}
            activeTab={leftTab}
            onChange={setLeftTab}
            ariaLabel="React left panel tabs"
          />
          <div className="rv-left-tab-body">
            {leftTab === 'engine' && <ReactEnginePanel />}
            {leftTab === 'media' && (
              <MediaDeckPanel
                mode="react"
                activeMediaId={activeMediaId}
                onSelect={setActiveMediaId}
              />
            )}
            {leftTab === 'layers' && (
              activeReactEngineId === 'laserDmx' && laserDmxWorkspaceMode === 'beamMatrix'
                ? <LaserDmxLayersPanel />
                : (
                  <div className="rv-placeholder-panel">
                    <span>React layers will appear here.</span>
                  </div>
                )
            )}
            {leftTab === 'sessions' && (
              <div className="rv-placeholder-panel">
                <span>React sessions will appear here.</span>
              </div>
            )}
            {leftTab === 'fonts' && <FontLibraryPanel />}
          </div>
        </WorkspaceRail>

        {/* Center — canvas + pads + track map */}
        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {activeReactEngineId === 'shaderPads' ? (
              <ReactShaderCanvas
                analyser={analyser}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                trailDecay={reactTrailDecay}
                fogDensity={reactFogDensity}
                particleDensity={reactParticleDensity}
                isPlaying={engine.isPlaying}
                getAudioTime={engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm}
                durationSec={audioDurationSec}
                onCanvasReady={setOutputCanvas}
                onLiveFps={setLiveFps}
              />
            ) : (
              <ReactPlaceholderCanvas
                analyser={analyser}
                activePreset={activePreset}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                trailDecay={reactTrailDecay}
                fogDensity={reactFogDensity}
                particleDensity={reactParticleDensity}
                oscillatorSettings={oscillatorSettings}
                oscillatorGlyphAssets={oscillatorGlyphAssets}
                oscillatorGlyphPointCache={oscillatorGlyphPointCache}
                oscillatorTextPointCache={oscillatorTextPointCache}
                neonLatticeSettings={neonLatticeSettings}
                neonLatticeTrigger={neonLatticeTrigger}
                isPlaying={engine.isPlaying}
                manualSections={resolvedSections}
                getAudioTime={engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm}
                onCanvasReady={setOutputCanvas}
                onLiveFps={setLiveFps}
                soundDrawingLayers={activeSdLayers}
                soundDrawingClips={activeSdClips}
              />
            )}
            {activeReactEngineId === 'laserDmx' && laserDmxWorkspaceMode === 'beamMatrix' && beamEditorVisible && (
              <LaserDmxBeamMatrixEditorOverlay />
            )}
          </div>
          <ReactPerformancePads />
          <SoundDrawingTimelineLane
            audioDurationSec={audioDurationSec}
            resolvedSections={resolvedSections}
          />
          <ReactTrackMapStrip audioDurationSec={audioDurationSec} />
        </div>

        {/* Right — tabbed control rail */}
        <WorkspaceRail
          side="right"
          label="React right rail"
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed(v => !v)}
        >
          <RailTabs
            tabs={rightTabs}
            activeTab={activeRightPanel}
            onChange={setActiveRightPanel}
            ariaLabel="React right workspace panels"
          />
          <div className="vz-panel-body">
            {activeRightPanel === 'presets' && <ReactPresetsPanel />}
            {activeRightPanel === 'fx'      && <ReactFxPanel />}
            {activeRightPanel === 'mod'     && <ReactModulationPanel />}
            {activeRightPanel === 'audio'   && <ReactAudioPanel />}
            {activeRightPanel === 'rec'     && (
              <ReactRecordingPanel
                canvas={outputCanvas}
                recorder={recorder}
                liveFps={liveFps}
                hasActiveProgramAudio={engine.isActive}
                onStartRecording={handleStartRecording}
              />
            )}
            {activeRightPanel === 'insp'    && <ReactInspectorPanel />}
          </div>
        </WorkspaceRail>
      </div>

      {/* Bottom dock — outside the grid, full width */}
      <VyzualzAudioDock />
    </div>
  )
}

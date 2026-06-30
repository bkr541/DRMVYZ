import { lazy, Suspense, useState, useMemo, useEffect, useCallback, useId } from 'react'
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
import { ReactPlaceholderCanvas } from './ReactPlaceholderCanvas'
import { isReactTransportPaused }  from './reactTransportState'
import { resolvePositiveDuration } from '../../../features/timeline/timelineViewport'
import { ReactPerformancePads } from './ReactPerformancePads'
import { LaserDmxBeamMatrixEditorOverlay } from './LaserDmxBeamMatrixEditorOverlay'
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
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { resolveReactInspectorSelection } from './reactInspectorSelection'
import {
  readReactRightPanel,
  writeReactRightPanel,
  type ReactRightPanel,
} from './reactRightPanelPersistence'
import {
  getReactLeftTabs,
  getReactPresetTabLabel,
  isReactLeftTabAvailable,
  resolveReactWorkspaceComposition,
  type ReactLeftTab,
} from './reactWorkspaceComposition'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { useActiveBrandOverlay } from '../../../features/personalization/useActiveBrandOverlay'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'
import '../../../styles/reactView.css'

// These workspaces carry large, engine-specific renderers and authoring tools.
// Keep them outside the initial React-view graph and load them only when their
// engine/workspace is actually visible.
const ReactShaderCanvas = lazy(() =>
  import('./ReactShaderCanvas').then(module => ({ default: module.ReactShaderCanvas })),
)
const ReactTrackMapStrip = lazy(() =>
  import('./ReactTrackMapStrip').then(module => ({ default: module.ReactTrackMapStrip })),
)
const SoundDrawingTimelineLane = lazy(() =>
  import('./SoundDrawingTimelineLane').then(module => ({ default: module.SoundDrawingTimelineLane })),
)
const LaserDmxLayersPanel = lazy(() =>
  import('./LaserDmxLayersPanel').then(module => ({ default: module.LaserDmxLayersPanel })),
)
const ShaderLibraryPanel = lazy(() =>
  import('./shaders/ui/ShaderLibraryPanel').then(module => ({ default: module.ShaderLibraryPanel })),
)

function LazyWorkspaceFallback({ label }: { label: string }) {
  return (
    <div className="rv-lazy-fallback" role="status" aria-live="polite">
      Loading {label}…
    </div>
  )
}

// BASE_RIGHT_TABS omits 'disabled' — injected dynamically via useMemo (same pattern as Visualizer)
const REACT_RIGHT_BASE_TABS: Omit<RailTabOption<ReactRightPanel>, 'disabled'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'fx',      label: 'FX'      },
  { id: 'mod',     label: 'MOD'     },
  { id: 'audio',   label: 'AUDIO'   },
  { id: 'rec',     label: 'REC'     },
  { id: 'insp',    label: 'INSP'    },
]

const REACT_LEFT_TAB_LABELS: Record<ReactLeftTab, string> = {
  engine: 'ENGINES',
  media: 'Media',
  layers: 'Layers',
  fonts: 'Fonts',
}

export function ReactView() {
  const audioSourceId = useId()
  const engine   = useSharedAudio()
  const analyser = engine.analyserMaster

  // Rehydrate SVG Visual cache whenever the selected visual changes or the view mounts.
  // Placed here so it runs regardless of which right-panel tab is open.
  useSvgVisualRehydration()
  useFontLibraryHydration()
  useReactPresetAutomation()

  const {
    reactPresets,
    cinematicConfigsByPresetId,
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
    performancePadTransition,
    oscillatorSettings,
    oscillatorFontAssets,
    oscillatorGlyphAssets,
    oscillatorGlyphPointCache,
    oscillatorTextPointCache,
    neonLatticeSettings,
    performanceActionEvent,
    performanceActionEvents,
    performanceActionToggleStates,
    neonLatticeTrigger,
    manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId,
    beamEditorVisible,
    soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId,
    laserDmxSettings,
    laserDmxBeamMatrix,
  } = useReactStore(useShallow(s => ({
    reactPresets:           s.reactPresets,
    cinematicConfigsByPresetId: s.cinematicConfigsByPresetId,
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
    performancePadTransition: s.performancePadTransition,
    oscillatorSettings:             s.oscillatorSettings,
    oscillatorFontAssets:            s.oscillatorFontAssets,
    oscillatorGlyphAssets:          s.oscillatorGlyphAssets,
    oscillatorGlyphPointCache:      s.oscillatorGlyphPointCache,
    oscillatorTextPointCache:       s.oscillatorTextPointCache,
    neonLatticeSettings:            s.neonLatticeSettings,
    performanceActionEvent:         s.performanceActionEvent,
    performanceActionEvents:        s.performanceActionEvents,
    performanceActionToggleStates:  s.performanceActionToggleStates,
    neonLatticeTrigger:             s.neonLatticeTrigger,
    manualTrackSectionsByTrackId:   s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId: s.suppressedAutoSectionsByTrackId,
    beamEditorVisible:              s.laserDmxBeamMatrix.editor.beamEditorVisible,
    soundDrawingLayersByTrackId:    s.soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId:     s.soundDrawingClipsByTrackId,
    laserDmxSettings:               s.laserDmxSettings,
    laserDmxBeamMatrix:             s.laserDmxBeamMatrix,
  })))
  const activeShaderId = useShaderPanelStore(s => s.activeShaderId)
  const activeBrandKit = useBrandKitStore(s => s.activeKit)
  const { overlay: activeBrandOverlay } = useActiveBrandOverlay()

  const workspaceComposition = useMemo(
    () => resolveReactWorkspaceComposition(
      activeReactEngineId,
      laserDmxWorkspaceMode,
      beamEditorVisible,
    ),
    [activeReactEngineId, laserDmxWorkspaceMode, beamEditorVisible],
  )
  const leftTabs = useMemo<RailTabOption<ReactLeftTab>[]>(
    () => getReactLeftTabs(workspaceComposition).map(id => ({
      id,
      label: REACT_LEFT_TAB_LABELS[id],
    })),
    [workspaceComposition],
  )

  const [leftTab, setLeftTab]             = useState<ReactLeftTab>('engine')
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null)
  const [leftCollapsed,  setLeftCollapsed]  = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Recording — useRecorder lives at view level so active recordings survive tab switches
  const recorder = useRecorder()
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const [liveFps, setLiveFps]           = useState(0)

  // Engine swaps are semantic diagnostics boundaries. Clear immediately rather
  // than showing the previous renderer's FPS until the new renderer samples.
  useEffect(() => { setLiveFps(0) }, [activeReactEngineId])

  const handleStartRecording = useCallback((canvas: HTMLCanvasElement) => {
    const audioStream = engine.isActive ? engine.getRecordingStream() : null
    recorder.startVideoRecording(canvas, audioStream)
  }, [engine.isActive, engine.getRecordingStream, recorder.startVideoRecording])

  // Right tab — persisted to localStorage after runtime validation.
  // PRESETS is the default and is always a valid right-rail destination.
  const [activeRightPanel, setActiveRightPanel] = useState<ReactRightPanel>(
    readReactRightPanel,
  )
  useEffect(() => {
    writeReactRightPanel(activeRightPanel)
  }, [activeRightPanel])

  // Presets describe an engine-wide look, but they are not object selections.
  // Keep preset resolution separate from Inspector enablement so INSP only opens
  // for a concrete source, scene, fixture, beam, group, or future selected object.
  const selectedPresetForEngine = useMemo(
    () => reactPresets.find(
      p => p.id === activeReactPresetId && p.engine === activeReactEngineId,
    ) ?? null,
    [activeReactEngineId, activeReactPresetId, reactPresets],
  )

  const inspectableSelection = useMemo(
    () => resolveReactInspectorSelection({
      activeReactEngineId,
      activeShaderId,
      oscillatorSettings,
      laserDmxSettings,
      laserDmxWorkspaceMode,
      laserDmxBeamMatrix,
    }),
    [
      activeReactEngineId,
      activeShaderId,
      oscillatorSettings,
      laserDmxSettings,
      laserDmxWorkspaceMode,
      laserDmxBeamMatrix,
    ],
  )

  const rightTabs = useMemo<RailTabOption<ReactRightPanel>[]>(
    () => REACT_RIGHT_BASE_TABS.map(t => {
      if (t.id === 'presets') {
        return {
          ...t,
          label: getReactPresetTabLabel(workspaceComposition),
        }
      }
      if (t.id === 'insp') {
        return { ...t, disabled: inspectableSelection === null }
      }
      return t
    }),
    [inspectableSelection, workspaceComposition.presetSurface],
  )

  useEffect(() => {
    if (activeRightPanel === 'insp' && inspectableSelection === null) {
      setActiveRightPanel('presets')
    }
  }, [activeRightPanel, inspectableSelection])

  useEffect(() => {
    if (!isReactLeftTabAvailable(leftTab, workspaceComposition)) {
      setLeftTab('engine')
    }
  }, [leftTab, workspaceComposition])

  // Fall back only within the active engine family. Never render a preset from
  // another engine merely because it appears first in the global collection.
  const activePreset = activeReactEngineId === 'shaderPads'
    ? null
    : (selectedPresetForEngine ?? reactPresets.find(p => p.engine === activeReactEngineId) ?? null)

  const renderPreset = useMemo(
    () => resolveBrandedReactPreset(activePreset, cinematicConfigsByPresetId, activeBrandKit),
    [activePreset, cinematicConfigsByPresetId, activeBrandKit],
  )

  // Timeline math requires a finite positive duration. New/decoding tracks can
  // briefly expose 0, and malformed metadata may contain NaN/Infinity/negatives.
  const audioDurationSec = resolvePositiveDuration(engine.duration, 180)
  const transportPaused = isReactTransportPaused({
    isPlaying:     engine.isPlaying,
    currentTimeSec: engine.currentTime,
    durationSec:    audioDurationSec,
  })

  // Resolved sections for the current track: auto + manual merged.
  // This is the single section timeline consumed by Track Map, the renderer,
  // and any preset automation.  Manual overrides always take precedence.
  const resolvedTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    const analysis = engine.currentAnalysis
    const analyzedSections = analysis ? adaptMIAnalysis(analysis) : []
    const manualSections = trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
    const suppressedIds  = trackId ? (suppressedAutoSectionsByTrackId[trackId]  ?? []) : []
    return resolveTrackSections({ analyzedSections, manualSections, durationSec: audioDurationSec, suppressedIds })
  }, [engine.currentTrackId, engine.currentAnalysis, manualTrackSectionsByTrackId, suppressedAutoSectionsByTrackId, audioDurationSec])

  // Manual BPM overrides regenerate the Track Map grid. Show Director receives
  // that exact effective grid while still using the same audio-engine playhead.
  const effectiveTrackAnalysis = useMemo(() => {
    const analysis = engine.currentAnalysis
    const beatGrid = engine.currentEffectiveBeatGrid
    const bpm = engine.currentEffectiveBpm
    if (!analysis || !beatGrid || bpm == null || bpm <= 0) return analysis
    return {
      ...analysis,
      bpmUsedForGrid: bpm,
      beatGridOffsetSec: beatGrid[0]?.timeSec ?? analysis.beatGridOffsetSec,
      beatGrid,
      downbeats: beatGrid.filter(marker => marker.isDownbeat),
    }
  }, [engine.currentAnalysis, engine.currentEffectiveBeatGrid, engine.currentEffectiveBpm])

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
          <label className="vz-input-label" htmlFor={audioSourceId}>Audio In</label>
          <select
            id={audioSourceId}
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
            tabs={leftTabs}
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
            {leftTab === 'layers' && workspaceComposition.showLaserLayersTab && (
              <Suspense fallback={<LazyWorkspaceFallback label="LaserDMX layers" />}>
                <LaserDmxLayersPanel />
              </Suspense>
            )}
            {leftTab === 'fonts' && <FontLibraryPanel />}
          </div>
        </WorkspaceRail>

        {/* Center — canvas + pads + track map */}
        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {activeReactEngineId === 'shaderPads' ? (
              <Suspense fallback={<LazyWorkspaceFallback label="Shader renderer" />}>
                <ReactShaderCanvas
                  analyser={analyser}
                  intensity={reactIntensity}
                  motion={reactMotion}
                  glow={reactGlow}
                  bassReactivity={reactBassReactivity}
                  trailDecay={reactTrailDecay}
                  fogDensity={reactFogDensity}
                  particleDensity={reactParticleDensity}
                  performancePadTransition={performancePadTransition}
                  isPlaying={engine.isPlaying}
                  isPaused={transportPaused}
                  getAudioTime={engine.getCurrentTime}
                  effectiveBpm={engine.currentEffectiveBpm}
                  durationSec={audioDurationSec}
                  trackSections={resolvedTrackSections}
                  onCanvasReady={setOutputCanvas}
                  onLiveFps={setLiveFps}
                  brandOverlay={activeBrandOverlay}
                />
              </Suspense>
            ) : (
              <ReactPlaceholderCanvas
                analyser={analyser}
                activePreset={renderPreset}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                trailDecay={reactTrailDecay}
                fogDensity={reactFogDensity}
                particleDensity={reactParticleDensity}
                performancePadTransition={performancePadTransition}
                oscillatorSettings={oscillatorSettings}
                oscillatorFontAssets={oscillatorFontAssets}
                oscillatorGlyphAssets={oscillatorGlyphAssets}
                oscillatorGlyphPointCache={oscillatorGlyphPointCache}
                oscillatorTextPointCache={oscillatorTextPointCache}
                neonLatticeSettings={neonLatticeSettings}
                performanceActionEvent={performanceActionEvent}
                performanceActionEvents={performanceActionEvents}
                performanceActionToggleStates={performanceActionToggleStates}
                neonLatticeTrigger={neonLatticeTrigger}
                isPlaying={engine.isPlaying}
                isPaused={transportPaused}
                trackSections={resolvedTrackSections}
                trackAnalysis={effectiveTrackAnalysis}
                getAudioTime={engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm}
                onCanvasReady={setOutputCanvas}
                onLiveFps={setLiveFps}
                brandOverlay={activeBrandOverlay}
                durationSec={audioDurationSec}
                soundDrawingLayers={activeSdLayers}
                soundDrawingClips={activeSdClips}
                activeAudioTrackId={engine.currentAudioTrackId}
              />
            )}
            {workspaceComposition.showLaserBeamEditor && (
              <LaserDmxBeamMatrixEditorOverlay />
            )}
          </div>
          {workspaceComposition.showPerformancePads && <ReactPerformancePads />}
          {workspaceComposition.showSoundDrawingTimeline && (
            <Suspense fallback={<LazyWorkspaceFallback label="Sound Drawing timeline" />}>
              <SoundDrawingTimelineLane
                audioDurationSec={audioDurationSec}
                trackSections={resolvedTrackSections}
              />
            </Suspense>
          )}
          {workspaceComposition.showTrackMap && (
            <Suspense fallback={<LazyWorkspaceFallback label="Track Map" />}>
              <ReactTrackMapStrip audioDurationSec={audioDurationSec} />
            </Suspense>
          )}
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
            {activeRightPanel === 'presets' && (
              workspaceComposition.presetSurface === 'shaderScenes'
                ? (
                  <Suspense fallback={<LazyWorkspaceFallback label="Shader scenes" />}>
                    <ShaderLibraryPanel />
                  </Suspense>
                )
                : <ReactPresetsPanel />
            )}
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

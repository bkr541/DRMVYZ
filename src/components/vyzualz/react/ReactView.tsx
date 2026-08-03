import { lazy, Suspense, useState, useMemo, useEffect, useCallback, useId } from 'react'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useRecorder } from '../../../hooks/useRecorder'
import { ReactPersistenceStatus } from './ReactPersistenceStatus'
import { retainSharedPerformanceDiagnosticsEngine } from './SharedPerformanceDiagnosticsStore'
import { useReactStore } from '../../../stores/reactStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { ReactPresetsPanel, ReactEnginePanel } from './panels/ReactRightPanels'
import { ReactPlaceholderCanvas } from './ReactPlaceholderCanvas'
import { CanvasEngineSurface } from './ReactCanvasEngineShell'
import { PixGridSurface } from './pixGrid/PixGridSurface'
import { PixGridEditorOverlay, shouldShowPixGridEditorOverlay } from './pixGrid/PixGridEditorOverlay'
import { addPixGridMediaLayer } from './pixGrid/PixGridAuthoring'
import { isReactTransportPaused }  from './reactTransportState'
import { resolvePositiveDuration } from '../../../features/timeline/timelineViewport'
import { ReactPerformancePads } from './ReactPerformancePads'
import { ReactGlobalOutputControls } from './ReactGlobalOutputControls'
import { OutputCastControl } from './output/OutputCastControl'
import {
  ReactDesignWorkspacePanel,
  ReactOutputWorkspacePanel,
  ReactReactivityWorkspacePanel,
} from './panels/ReactWorkspacePanels'
import { LaserDmxBeamMatrixEditorOverlay } from './LaserDmxBeamMatrixEditorOverlay'
import { LaserDmxShowDirectorCanvas } from './LaserDmxShowDirectorCanvas'
import { resolveLaserDmxAuthoringOverlayVisibility } from './renderers/laserDmx/LaserDmxRendererBackend'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { RailTabs } from '../layout/RailTabs'
import type { RailTabOption } from '../layout/RailTabs'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { MediaDeckPanel } from '../media/MediaDeckPanel'
import { FontLibraryPanel } from './FontLibraryPanel'
import { ReactEngineBrowser } from './ReactEngineBrowser'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'
import { useSvgVisualRehydration } from './useSvgVisualRehydration'
import { useFontLibraryHydration } from './useFontLibraryHydration'
import { useReactPresetAutomation } from './useReactPresetAutomation'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { resolveReactInspectorSelection } from './reactInspectorSelection'
import { readReactRightPanel, writeReactRightPanel, type ReactRightPanel } from './reactRightPanelPersistence'
import {
  getReactDefaultLeftTab,
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactLowerSurfaceLabel,
  getReactLowerSurfaces,
  getReactPresetTabLabel,
  isReactLowerSurfaceAvailable,
  isReactLeftTabAvailable,
  resolveReactWorkspaceComposition,
  type ReactLeftTab,
  type ReactLowerSurface,
} from './reactWorkspaceComposition'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { useActiveBrandOverlay } from '../../../features/personalization/useActiveBrandOverlay'
import { useReactWorkspacePreferences } from './reactWorkspacePreferences'
import {
  getReactMediaDisabledReason,
  getReactMediaSourceCapability,
  getReactMediaSourceId,
} from './reactMediaSourceCapabilities'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'
import { subscribePixGridWorkspace } from './pixGrid/PixGridWorkspaceNavigation'
import '../../../styles/reactView.css'
import { DropdownSelect } from '../../shared/Dropdown/Dropdown'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

// These workspaces carry large, engine-specific renderers and authoring tools.
// Keep them outside the initial React-view graph and load them only when their
// engine/workspace is actually visible.
const ReactShaderCanvas = lazy(() =>
  import('./ReactShaderCanvas').then((module) => ({
    default: module.ReactShaderCanvas,
  })),
)
const ReactTrackMapStrip = lazy(() =>
  import('./ReactTrackMapStrip').then((module) => ({
    default: module.ReactTrackMapStrip,
  })),
)
const SoundDrawingTimelineLane = lazy(() =>
  import('./SoundDrawingTimelineLane').then((module) => ({
    default: module.SoundDrawingTimelineLane,
  })),
)
const LaserDmxLayersPanel = lazy(() =>
  import('./LaserDmxLayersPanel').then((module) => ({
    default: module.LaserDmxLayersPanel,
  })),
)
const ShaderLibraryPanel = lazy(() =>
  import('./shaders/ui/ShaderLibraryPanel').then((module) => ({
    default: module.ShaderLibraryPanel,
  })),
)

function LazyWorkspaceFallback({ label }: { label: string }) {
  return (
    <div className="rv-lazy-fallback" role="status" aria-live="polite">
      Loading {label}…
    </div>
  )
}

function LowerWorkspaceChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={expanded ? 'm4 12 6-6 6 6' : 'm4 8 6 6 6-6'} />
    </svg>
  )
}

function StageFocusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 7.5v1.25M12 15.25v1.25M7.5 12h1.25M15.25 12h1.25" />
    </svg>
  )
}

function getLowerSurfaceHelpId(surface: ReactLowerSurface) {
  if (surface === 'trackMap') return 'react.shared.trackMap.overview' as const
  if (surface === 'performancePads') return 'react.shared.performancePads.overview' as const
  return null
}

// Four top-level destinations keep the right rail compact and role-based.
const REACT_RIGHT_BASE_TABS: Omit<RailTabOption<ReactRightPanel>, 'disabled'>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design',  label: 'DESIGN'  },
  { id: 'react',   label: 'REACT'   },
  { id: 'output',  label: 'OUTPUT'  },
]

export interface ReactViewProps {
  onOpenMediaManager?: () => void
  onOpenLyricManager?: (intent: import('../../../features/lyrics/lyricNavigation').LyricManagerNavigationIntent) => void
}

export function ReactView({ onOpenMediaManager, onOpenLyricManager }: ReactViewProps) {
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
    soundDrawingTrailResetRevision,
    soundDrawingRibbonResetRevision,
    soundDrawingPerformanceSettings,
    performanceActionEvent,
    performanceActionEvents,
    performanceActionToggleStates,
    manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId,
    beamEditorVisible,
    soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId,
    laserDmxBeamMatrix,
    laserDmxBeamMatrixAuthoringMode,
    laserDmxShowDirector,
    pixGridState,
    pixGridDecks,
    pixGridActionCuesByTrackId,
    setPixGridState,
    applyPixGridAuthoringState,
    selectSvgAsset,
  } = useReactStore(
    useShallow((s) => ({
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
    soundDrawingTrailResetRevision: s.soundDrawingTrailResetRevision,
      soundDrawingRibbonResetRevision: s.soundDrawingRibbonResetRevision,
    soundDrawingPerformanceSettings: s.soundDrawingPerformanceSettings,
    performanceActionEvent:         s.performanceActionEvent,
    performanceActionEvents:        s.performanceActionEvents,
    performanceActionToggleStates:  s.performanceActionToggleStates,
    manualTrackSectionsByTrackId:   s.manualTrackSectionsByTrackId,
    suppressedAutoSectionsByTrackId: s.suppressedAutoSectionsByTrackId,
    beamEditorVisible:              s.laserDmxBeamMatrix.editor.beamEditorVisible,
    soundDrawingLayersByTrackId:    s.soundDrawingLayersByTrackId,
    soundDrawingClipsByTrackId:     s.soundDrawingClipsByTrackId,
    laserDmxBeamMatrix:             s.laserDmxBeamMatrix,
    laserDmxBeamMatrixAuthoringMode: s.laserDmxBeamMatrixAuthoringMode,
    laserDmxShowDirector:           s.laserDmxShowDirector,
    pixGridState:                    s.pixGridState,
    pixGridDecks:                    s.pixGridDecks,
    pixGridActionCuesByTrackId:       s.pixGridActionCuesByTrackId,
    setPixGridState:                  s.setPixGridState,
    applyPixGridAuthoringState:       s.applyPixGridAuthoringState,
    selectSvgAsset:                  s.selectSvgAsset,
    })),
  )
  const activeShaderId = useShaderPanelStore((s) => s.activeShaderId)
  const activeBrandKit = useBrandKitStore((s) => s.activeKit)
  const { overlay: activeBrandOverlay } = useActiveBrandOverlay()

  const workspaceComposition = useMemo(
    () => resolveReactWorkspaceComposition(activeReactEngineId, laserDmxWorkspaceMode, beamEditorVisible),
    [activeReactEngineId, laserDmxWorkspaceMode, beamEditorVisible],
  )
  const lowerSurfaces = useMemo(
    () => getReactLowerSurfaces(workspaceComposition),
    [workspaceComposition],
  )
  const leftTabs = useMemo<RailTabOption<ReactLeftTab>[]>(
    () =>
      getReactLeftTabs(workspaceComposition).map((id) => ({
      id,
      label: getReactLeftTabLabel(id, workspaceComposition),
    })),
    [workspaceComposition],
  )

  const defaultLeftTab = getReactDefaultLeftTab(workspaceComposition)
  const {
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    lowerSurface,
    setLowerSurface,
    lowerWorkspaceCollapsed,
    setLowerWorkspaceCollapsed,
    leftTab: preferredLeftTab,
    setLeftTab,
  } = useReactWorkspacePreferences()
  const activeLowerSurface = isReactLowerSurfaceAvailable(lowerSurface, workspaceComposition)
    ? lowerSurface
    : (lowerSurfaces[0] ?? 'trackMap')
  const leftTab = isReactLeftTabAvailable(preferredLeftTab, workspaceComposition) ? preferredLeftTab : defaultLeftTab
  const [stageFocus, setStageFocus] = useState(false)
  const mediaSourceCapability = getReactMediaSourceCapability(activeReactEngineId)
  const activeMediaId = getReactMediaSourceId(mediaSourceCapability, oscillatorSettings, pixGridState)
  const getMediaDisabledReason = useCallback(
    (media: Parameters<typeof getReactMediaDisabledReason>[1]) =>
      getReactMediaDisabledReason(mediaSourceCapability, media),
    [mediaSourceCapability],
  )
  const handleSelectMedia = useCallback(
    (mediaId: string) => {
    if (mediaSourceCapability === 'pixGridStill') {
      if (pixGridState.authoringOverlayVisible) {
          const media = useMediaStore.getState().items.find((item) => item.id === mediaId)
          applyPixGridAuthoringState(
            addPixGridMediaLayer(pixGridState, mediaId, media?.title ?? media?.name ?? 'Media Artwork'),
          )
      } else {
          setPixGridState({
            conversion: {
              ...pixGridState.conversion,
              selectedMediaId: mediaId,
            },
          })
      }
      return
    }
    void selectSvgAsset(mediaId)
    },
    [applyPixGridAuthoringState, mediaSourceCapability, pixGridState, selectSvgAsset, setPixGridState],
  )

  // Recording — useRecorder lives at view level so active recordings survive tab switches
  const recorder = useRecorder()
  const { startVideoRecording } = recorder
  const { isActive: hasActiveProgramAudio, getRecordingStream } = engine
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const [pixGridOutputCanvas, setPixGridOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const handlePixGridCanvasReady = useCallback((canvas: HTMLCanvasElement | null) => {
    setOutputCanvas(canvas)
    setPixGridOutputCanvas(canvas)
  }, [])
  const [liveFps, setLiveFps]           = useState(0)

  // Engine swaps are semantic diagnostics boundaries. Clear immediately rather
  // than showing the previous renderer's FPS until the new renderer samples.
  useEffect(() => {
    setLiveFps(0)
  }, [activeReactEngineId])
  useEffect(() => {
    if (activeReactEngineId !== 'pixGrid') {
      setPixGridOutputCanvas(null)
      if (pixGridState.authoringOverlayVisible) setPixGridState({ authoringOverlayVisible: false })
    }
  }, [activeReactEngineId, pixGridState.authoringOverlayVisible, setPixGridState])
  useEffect(() => {
    if (!import.meta.env.DEV) return
    void import('./PerformanceProgramDevelopmentValidation')
      .then((module) => module.runPerformanceProgramDevelopmentValidation())
      .catch((error) => console.warn('[Performance Programs] Development validation could not load.', error))
  }, [])
  useEffect(() => {
    retainSharedPerformanceDiagnosticsEngine(
      activeReactEngineId === 'laserDmx'
        ? 'laserDmx'
        : activeReactEngineId === 'oscilloscope'
          ? 'soundDrawing'
          : activeReactEngineId === 'canvas'
            ? 'canvas'
            : activeReactEngineId === 'pixGrid'
              ? 'pixGrid'
              : null,
    )
  }, [activeReactEngineId])

  const handleStartRecording = useCallback(
    (canvas: HTMLCanvasElement) => {
    const audioStream = hasActiveProgramAudio ? getRecordingStream() : null
    startVideoRecording(canvas, audioStream)
    },
    [getRecordingStream, hasActiveProgramAudio, startVideoRecording],
  )

  // Right tab — persisted to localStorage after runtime validation.
  // PRESETS is the default and is always a valid right-rail destination.
  const [activeRightPanel, setActiveRightPanel] = useState<ReactRightPanel>(readReactRightPanel)
  useEffect(() => {
    writeReactRightPanel(activeRightPanel)
  }, [activeRightPanel])
  useEffect(() => subscribePixGridWorkspace(() => {
    setActiveRightPanel('react')
    setRightCollapsed(false)
  }), [setRightCollapsed])

  // Presets describe an engine-wide look, but they are not object selections.
  // Keep preset resolution separate from Inspector enablement so INSP only opens
  // for a concrete source, scene, fixture, beam, group, or future selected object.
  const selectedPresetForEngine = useMemo(
    () => reactPresets.find((p) => p.id === activeReactPresetId && p.engine === activeReactEngineId) ?? null,
    [activeReactEngineId, activeReactPresetId, reactPresets],
  )

  const inspectableSelection = useMemo(
    () =>
      resolveReactInspectorSelection({
      activeReactEngineId,
      activeShaderId,
      oscillatorSettings,
        laserDmxWorkspaceMode,
      laserDmxBeamMatrix,
    }),
    [activeReactEngineId, activeShaderId, oscillatorSettings, laserDmxWorkspaceMode, laserDmxBeamMatrix],
  )

  const rightTabs = useMemo<RailTabOption<ReactRightPanel>[]>(
    () =>
      REACT_RIGHT_BASE_TABS.map((tab) =>
        tab.id === 'presets' ? { ...tab, label: getReactPresetTabLabel(workspaceComposition) } : tab,
      ),
    [workspaceComposition],
  )

  useEffect(() => {
    if (lowerSurface !== activeLowerSurface) {
      setLowerSurface(activeLowerSurface)
    }
  }, [activeLowerSurface, lowerSurface, setLowerSurface])

  useEffect(() => {
    if (!isReactLeftTabAvailable(preferredLeftTab, workspaceComposition)) {
      setLeftTab(defaultLeftTab)
    }
  }, [defaultLeftTab, preferredLeftTab, setLeftTab, workspaceComposition])

  // Engine selection is a top-level workspace change. Always return to that
  // engine's primary authoring surface rather than carrying a contextual tab
  // such as Media or Fonts into a different engine family.
  useEffect(() => {
    setLeftTab(defaultLeftTab)
  }, [activeReactEngineId, defaultLeftTab, setLeftTab])

  // Fall back only within the active engine family. Never render a preset from
  // another engine merely because it appears first in the global collection.
  const activePreset =
    activeReactEngineId === 'shaderPads' || activeReactEngineId === 'canvas'
    ? null
      : (selectedPresetForEngine ?? reactPresets.find((p) => p.engine === activeReactEngineId) ?? null)

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

  const activePixGridActionCues = useMemo(() => {
    const trackId = engine.currentTrackId
    return trackId ? (pixGridActionCuesByTrackId[trackId] ?? []) : []
  }, [engine.currentTrackId, pixGridActionCuesByTrackId])

  const activeManualTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    return trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
  }, [engine.currentTrackId, manualTrackSectionsByTrackId])

  // Resolved sections for the current track: auto + manual merged.
  // This is the single section timeline consumed by Track Map, the renderer,
  // and any preset automation.  Manual overrides always take precedence.
  const resolvedTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    const analysis = engine.currentAnalysis
    const analyzedSections = analysis ? adaptMIAnalysis(analysis) : []
    const suppressedIds  = trackId ? (suppressedAutoSectionsByTrackId[trackId]  ?? []) : []
    return resolveTrackSections({
      analyzedSections,
      manualSections: activeManualTrackSections,
      durationSec: audioDurationSec,
      suppressedIds,
    })
  }, [
    engine.currentTrackId,
    engine.currentAnalysis,
    activeManualTrackSections,
    suppressedAutoSectionsByTrackId,
    audioDurationSec,
  ])

  useEffect(() => {
    musicIntelligenceEngine.setResolvedTimeline(resolvedTrackSections, engine.currentTrackId)
  }, [engine.currentTrackId, resolvedTrackSections])

  useEffect(
    () => () => {
    musicIntelligenceEngine.setResolvedTimeline([], engine.currentTrackId)
    },
    [engine.currentTrackId],
  )

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
      downbeats: beatGrid.filter((marker) => marker.isDownbeat),
    }
  }, [engine.currentAnalysis, engine.currentEffectiveBeatGrid, engine.currentEffectiveBpm])

  // Sound Drawing layers and clips for the active track — forwarded to canvas for per-frame rendering
  const activeTrackId        = engine.currentTrack?.id ?? null
  const activeSdLayers       = activeTrackId ? (soundDrawingLayersByTrackId[activeTrackId] ?? []) : []
  const activeSdClips        = activeTrackId ? (soundDrawingClipsByTrackId[activeTrackId]   ?? []) : []
  const laserDmxAuthoringOverlayVisibility = useMemo(
    () =>
      resolveLaserDmxAuthoringOverlayVisibility({
        showDirectorModeActive:
          activeReactEngineId === 'laserDmx' && laserDmxBeamMatrixAuthoringMode === 'showDirector',
      beamMatrixEditorRequested: workspaceComposition.showLaserBeamEditor,
      presentationMode: laserDmxShowDirector.settings.presentationMode,
    }),
    [
      activeReactEngineId,
      laserDmxBeamMatrixAuthoringMode,
      laserDmxShowDirector.settings.presentationMode,
      workspaceComposition.showLaserBeamEditor,
    ],
  )
  const showDirectorStageEditorVisible = laserDmxAuthoringOverlayVisibility.showDirectorStageEditor

  return (
    <div className="rv-shell" data-help-engine={activeReactEngineId} data-stage-focus={stageFocus ? 'true' : undefined}>
      <div className="vz-header">
        <div className="vz-header-title-group">
          <div className="vz-header-title">REACT</div>
          <div className="vz-header-sub">Visual Performance Mode</div>
        </div>

        <div className="vz-header-sep" />

        <div className="vz-input-group">
          <label className="vz-input-label" htmlFor={audioSourceId}>
            Input
          </label>
          <DropdownSelect
            id={audioSourceId}
            className="az-select"
            value={engine.source}
            onChange={(e) => engine.setSource(e.target.value as typeof engine.source)}
          >
            <option value="file">Track Input</option>
            <option value="microphone">Microphone</option>
            <option value="demo">Demo Signal</option>
          </DropdownSelect>
        </div>

        <span className="az-spacer" />
        <ReactPersistenceStatus />
        <ReactGlobalOutputControls />
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
          onToggleCollapsed={() => setLeftCollapsed((v) => !v)}
        >
          <div className="rv-left-workspace-shell" data-description-density="compact">
            <section
              className="rv-context-workspace"
              aria-label={`${REACT_ENGINE_CATALOG[activeReactEngineId].label} workspace`}
            >
              <header className="rv-context-workspace-header">
                <ReactEngineBrowser />
              </header>
              <RailTabs
                tabs={leftTabs}
                activeTab={leftTab}
                onChange={setLeftTab}
                ariaLabel={`${REACT_ENGINE_CATALOG[activeReactEngineId].label} workspace tabs`}
                className="rv-context-workspace-tabs"
              />
              <div className="rv-left-tab-body">
                <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
                  {leftTab === 'workspace' && <ReactEnginePanel />}
                  {leftTab === 'media' && (
                    <MediaDeckPanel
                      mode={mediaSourceCapability === 'pixGridStill' ? 'pixGrid' : 'react'}
                      activeMediaId={activeMediaId}
                      onSelect={handleSelectMedia}
                      onOpenMediaManager={onOpenMediaManager}
                      onOpenLyricManager={onOpenLyricManager}
                      title={
                        mediaSourceCapability === 'pixGridStill'
                          ? 'PixGrid Image & SVG Media'
                          : 'Sound Drawing SVG Media'
                      }
                      getDisabledReason={getMediaDisabledReason}
                    />
                  )}
                  {leftTab === 'layers' && workspaceComposition.showLaserLayersTab && (
                    <Suspense fallback={<LazyWorkspaceFallback label="LaserDMX layers" />}>
                      <LaserDmxLayersPanel />
                    </Suspense>
                  )}
                  {leftTab === 'fonts' && <FontLibraryPanel />}
                </div>
              </div>
            </section>
          </div>
        </WorkspaceRail>

        {/* Center — canvas + pads + track map */}
        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {activeReactEngineId === 'shaderPads' ? (
              <Suspense fallback={<LazyWorkspaceFallback label="Shader renderer" />}>
                <ReactShaderCanvas
                  key="react-live-shaderPads"
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
                  trackKey={engine.currentTrackId}
                  durationSec={audioDurationSec}
                  trackSections={resolvedTrackSections}
                  onCanvasReady={setOutputCanvas}
                  onLiveFps={setLiveFps}
                  brandOverlay={activeBrandOverlay}
                />
              </Suspense>
            ) : activeReactEngineId === 'canvas' ? (
              <CanvasEngineSurface
                isPlaying={engine.isPlaying}
                isPaused={transportPaused}
                analyser={analyser}
                trackAnalysis={effectiveTrackAnalysis}
                trackSections={resolvedTrackSections}
                getAudioTime={engine.getCurrentTime}
                activeAudioTrackId={engine.currentTrackId}
                onCanvasReady={setOutputCanvas}
                onLiveFps={setLiveFps}
              />
            ) : activeReactEngineId === 'pixGrid' ? (
              <PixGridSurface
                key="react-live-pixGrid"
                analyser={analyser}
                activePreset={renderPreset}
                pixGridState={pixGridState}
                pixGridDecks={pixGridDecks}
                pixGridActionCues={activePixGridActionCues}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                isPlaying={engine.isPlaying}
                isPaused={transportPaused}
                trackSections={resolvedTrackSections}
                trackAnalysis={effectiveTrackAnalysis}
                trackIdentity={engine.currentTrackId}
                durationSec={audioDurationSec}
                audioTimeSec={engine.currentTime}
                getAudioTime={engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm ?? undefined}
                onCanvasReady={handlePixGridCanvasReady}
                onLiveFps={setLiveFps}
              />
            ) : (
              <ReactPlaceholderCanvas
                key={`react-live-${activeReactEngineId}`}
                analyser={analyser}
                scopeStereoTap={engine.scopeStereoTap}
                engine={activeReactEngineId}
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
                soundDrawingTrailResetRevision={soundDrawingTrailResetRevision}
                soundDrawingRibbonResetRevision={soundDrawingRibbonResetRevision}
                soundDrawingPerformanceSettings={soundDrawingPerformanceSettings}
                performanceActionEvent={performanceActionEvent}
                performanceActionEvents={performanceActionEvents}
                performanceActionToggleStates={performanceActionToggleStates}
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
            {shouldShowPixGridEditorOverlay(activeReactEngineId, pixGridState.authoringOverlayVisible) && (
              <PixGridEditorOverlay liveCanvas={pixGridOutputCanvas} />
            )}
            {showDirectorStageEditorVisible && (
              <div className="rv-show-director-stage-overlay" aria-label="Show Director center visualizer editor">
                <LaserDmxShowDirectorCanvas
                  fixtures={laserDmxShowDirector.fixtures}
                  selectedFixtureId={laserDmxShowDirector.selectedFixtureId}
                  selectedFixtureIds={laserDmxShowDirector.selectedFixtureIds}
                  settings={laserDmxShowDirector.settings}
                  variant="stage"
                />
              </div>
            )}
            {laserDmxAuthoringOverlayVisibility.showBeamMatrixEditor && <LaserDmxBeamMatrixEditorOverlay />}
          </div>
          {lowerSurfaces.length > 0 && (
            <section
              className="rv-lower-workspace"
              data-collapsed={lowerWorkspaceCollapsed ? 'true' : undefined}
              aria-label="Performance timeline workspace"
            >
              <div className="rv-lower-workspace-toolbar">
                <button
                  type="button"
                  className="rv-lower-workspace-row-toggle"
                  aria-expanded={!lowerWorkspaceCollapsed}
                  aria-label={
                    lowerWorkspaceCollapsed
                      ? 'Expand lower workspace'
                      : 'Collapse lower workspace'
                  }
                  onClick={() => setLowerWorkspaceCollapsed((value) => !value)}
                />
                <div className="rv-lower-workspace-tabs" role="tablist" aria-label="Timeline surfaces">
                  {lowerSurfaces.map((surface) => {
                    const helpId = getLowerSurfaceHelpId(surface)
                    const tab = (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeLowerSurface === surface}
                        className={activeLowerSurface === surface ? 'is-active' : ''}
                        onClick={() => {
                          setLowerSurface(surface)
                          setLowerWorkspaceCollapsed(false)
                        }}
                      >
                        {getReactLowerSurfaceLabel(surface)}
                      </button>
                    )

                    if (!helpId) return <span key={surface} className="rv-lower-workspace-tab-wrap">{tab}</span>

                    return (
                      <span
                        key={surface}
                        className="rv-lower-workspace-tab-wrap drm-help-overlay-anchor"
                        role="presentation"
                      >
                        {tab}
                        <HelpInfoTrigger helpId={helpId} />
                      </span>
                    )
                  })}
                </div>
                <div className="rv-lower-workspace-actions">
                  <div className="rv-lower-workspace-output-actions drm-help-overlay-anchor">
                    <OutputCastControl canvas={outputCanvas} />
                    <button
                      type="button"
                      className={`rv-stage-focus-btn${stageFocus ? ' is-active' : ''}`}
                      aria-label={stageFocus ? 'Restore workspace rails and timeline' : 'Maximize the live output stage'}
                      aria-pressed={stageFocus}
                      onClick={() => setStageFocus((value) => !value)}
                      title={stageFocus ? 'Restore workspace rails and timeline' : 'Maximize the live output stage'}
                    >
                      <StageFocusIcon />
                    </button>
                    <HelpInfoTrigger helpId="react.shared.lowerWorkspace.outputActions" placement="left" />
                  </div>
                  <span className="rv-lower-workspace-chevron" aria-hidden="true">
                    <LowerWorkspaceChevron expanded={!lowerWorkspaceCollapsed} />
                  </span>
                </div>
              </div>

              <div
                hidden={activeLowerSurface !== 'trackMap' || lowerWorkspaceCollapsed || stageFocus}
                className="rv-lower-workspace-surface rv-lower-workspace-surface--track-map"
              >
                {workspaceComposition.showTrackMap && (
                  <Suspense fallback={<LazyWorkspaceFallback label="Track Map" />}>
                    <ReactTrackMapStrip audioDurationSec={audioDurationSec} embedded />
                  </Suspense>
                )}
              </div>

              {workspaceComposition.showSoundDrawingTimeline && (
                <div
                  hidden={activeLowerSurface !== 'soundDrawing' || lowerWorkspaceCollapsed || stageFocus}
                  className="rv-lower-workspace-surface rv-lower-workspace-surface--sound-drawing"
                >
                  <Suspense fallback={<LazyWorkspaceFallback label="Sound Drawing timeline" />}>
                    <SoundDrawingTimelineLane
                      audioDurationSec={audioDurationSec}
                      trackSections={resolvedTrackSections}
                    />
                  </Suspense>
                </div>
              )}

              {workspaceComposition.showPerformancePads && (
                <div
                  hidden={activeLowerSurface !== 'performancePads' || lowerWorkspaceCollapsed || stageFocus}
                  className="rv-lower-workspace-surface"
                >
                  <ReactPerformancePads embedded />
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right — tabbed control rail */}
        <WorkspaceRail
          side="right"
          label="React right rail"
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed((v) => !v)}
        >
          <RailTabs
            tabs={rightTabs}
            activeTab={activeRightPanel}
            onChange={setActiveRightPanel}
            ariaLabel="React right workspace panels"
          />
          <div className="vz-panel-body">
            {activeRightPanel === 'presets' &&
              (workspaceComposition.presetSurface === 'shaderScenes' ? (
                  <Suspense fallback={<LazyWorkspaceFallback label="Shader scenes" />}>
                    <ShaderLibraryPanel />
                  </Suspense>
              ) : (
                <ReactPresetsPanel />
              ))}
            {activeRightPanel === 'design' && (
              <ReactDesignWorkspacePanel hasSelection={inspectableSelection !== null} />
            )}
            {activeRightPanel === 'react' && <ReactReactivityWorkspacePanel />}
            {activeRightPanel === 'output' && (
              <ReactOutputWorkspacePanel
                canvas={outputCanvas}
                recorder={recorder}
                liveFps={liveFps}
                hasActiveProgramAudio={hasActiveProgramAudio}
                onStartRecording={handleStartRecording}
              />
            )}
          </div>
        </WorkspaceRail>
      </div>

      {/* Bottom dock — outside the grid, full width */}
      <VyzualzAudioDock
        compact={stageFocus}
        expandable
        unifiedTimeline={
          (activeLowerSurface === 'trackMap' || activeLowerSurface === 'soundDrawing') &&
          !lowerWorkspaceCollapsed &&
          !stageFocus
        }
        waveformAppearance="deck"
      />
    </div>
  )
}

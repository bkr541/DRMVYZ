import { AppIcon } from '../../shared/icons/AppIcon'
import { lazy, Suspense, useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, type CSSProperties } from 'react'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { musicIntelligenceEngine } from '../../../features/musicIntelligence/MusicIntelligenceEngine'
import { useShallow } from 'zustand/react/shallow'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { useRecorder } from '../../../hooks/useRecorder'
import { qualityTierForFps } from './ReactHeaderPerformanceStatus'
import { ReactHeaderStatusCluster } from './ReactHeaderStatusCluster'
import { retainSharedPerformanceDiagnosticsEngine } from './SharedPerformanceDiagnosticsStore'
import { useReactStore } from '../../../stores/reactStore'
import { useVisualStore } from '../../../stores/visualStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { ReactPresetsPanel, ReactEnginePanel } from './panels/ReactRightPanels'
import { ReactPlaceholderCanvas } from './ReactPlaceholderCanvas'
import { CanvasEngineSurface, CanvasLayersPanel } from './ReactCanvasEngineShell'
import { PixGridSurface } from './pixGrid/PixGridSurface'
import {
  HeadlinerDesignPanel,
  HeadlinerPresetsPanel,
  HeadlinerReactivityPanel,
  HeadlinerSurface,
} from './headliner/HeadlinerWorkspace'
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
import { LaserDmxRendererNotice } from './LaserDmxRendererDiagnosticsPanel'
import { resolveLaserDmxAuthoringOverlayVisibility } from './renderers/laserDmx/LaserDmxRendererBackend'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { useSharedDataActivity } from '../../../stores/useSharedDataActivity'
import {
  createLaserDmxShowManagerEmptyRuntimeShowDirector,
  createLaserDmxShowManagerRuntimeSectionPrograms,
} from '../showManager/LaserDmxShowManagerDomain'
import { LayoutLabModal } from './LayoutLabModal'
import { useRgbWaveformStore } from '../../../features/waveform/rgbWaveformStorage'
import { TrackTimelineIcon } from './trackTimeline/TrackTimelineIcon'
import { resolveTrackTimelineAvailability } from './trackTimeline/trackTimelineAvailability'
import { RailTabs } from '../layout/RailTabs'
import { HeaderControlGroup } from '../layout/HeaderControlGroup'
import { TopEdgeResizeHandle } from '../../shared/TopEdgeResizeHandle/TopEdgeResizeHandle'
import type { RailTabOption } from '../layout/RailTabs'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { RailWindowHeader } from '../layout/RailWindowHeader'

import { MediaDeckPanel } from '../media/MediaDeckPanel'
import { FontLibraryPanel } from './FontLibraryPanel'
import { ReactEngineBrowser } from './ReactEngineBrowser'
import { useActiveEnginePresetName } from './activeEnginePresetName'
import { Cinema2InspectorPanel } from './Cinema2InspectorPanel'
import { Cinema2LayersPanel } from './Cinema2LayersPanel'
import { Cinema2PresetsPanel } from './Cinema2PresetsPanel'
import { Cinema2Stage } from './Cinema2Stage'
import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  cinema2NativePresetRegistry,
  getCinema2WorkspacePresetState,
  type Cinema2PresetId,
  type Cinema2Runtime,
  type Cinema2RuntimeSnapshot,
  type Cinema2WorkspacePresetState,
} from '../cinema2'
import { readCinema2LastPresetId, writeCinema2LastPresetId } from './cinema2WorkspacePreferences'
import { useCinema2WorkspaceRestoreState } from './useCinema2WorkspaceRestoreState'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'
import { useCinema2LegacyPersistenceMigration } from './useCinema2LegacyPersistenceMigration'
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
import {
  CANVAS_OUTPUT_AVAILABLE,
  isCanvasOutputAvailable,
  type CanvasOutputCapability,
} from './canvasFracturesOutputContract'

// These workspaces carry large, engine-specific renderers and authoring tools.
// Keep them outside the initial React-view graph and load them only when their
// engine/workspace is actually visible.
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
const TrackTimelineModal = lazy(() =>
  import('./trackTimeline/TrackTimelineModal').then((module) => ({
    default: module.TrackTimelineModal,
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
  return <AppIcon kind={expanded ? 'chevronUp' : 'chevronDown'} />
}

function StageFocusIcon() {
  return (
    <AppIcon kind="cameraFocus" />
  )
}

function TrackMapLaneIconsToggleIcon() {
  return (
    <AppIcon kind="list" />
  )
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

const DEFAULT_LOWER_SURFACE_HEIGHT = 263
const MIN_LOWER_SURFACE_HEIGHT = 96
const MAX_LOWER_SURFACE_HEIGHT = 640
const MIN_STAGE_HEIGHT = 180

export function ReactView({ onOpenMediaManager, onOpenLyricManager }: ReactViewProps) {
  useSharedDataActivity('react', ['media', 'audio', 'persistence'])
  const engine   = useSharedAudio()
  const analyser = engine.analyserMaster

  // Rehydrate SVG Visual cache whenever the selected visual changes or the view mounts.
  // Placed here so it runs regardless of which right-panel tab is open.
  useSvgVisualRehydration()
  useFontLibraryHydration()
  useCinema2LegacyPersistenceMigration()
  useReactPresetAutomation()

  const {
    reactPresets,
    cinematicConfigsByPresetId,
    activeReactPresetId,
    activeReactEngineId,
    selectedCanvasPresetId,
    selectedCanvasLayerId,
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
    laserDmxShowManagerShows,
    laserDmxShowManagerActiveShowId,
    pixGridState,
    pixGridDecks,
    pixGridActionCuesByTrackId,
    setPixGridState,
    applyPixGridAuthoringState,
    selectSvgAsset,
    cinema2Workspace,
    activateCinema2Workspace,
    storeCinema2WorkspacePresetState,
  } = useReactStore(
    useShallow((s) => ({
    reactPresets:           s.reactPresets,
    cinematicConfigsByPresetId: s.cinematicConfigsByPresetId,
    activeReactPresetId:    s.activeReactPresetId,
    activeReactEngineId:    s.activeReactEngineId,
    selectedCanvasPresetId: s.selectedCanvasPresetId,
    selectedCanvasLayerId:  s.selectedCanvasLayerId,
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
    laserDmxShowManagerShows:        s.laserDmxShowManagerShows,
    laserDmxShowManagerActiveShowId: s.laserDmxShowManagerActiveShowId,
    pixGridState:                    s.pixGridState,
    pixGridDecks:                    s.pixGridDecks,
    pixGridActionCuesByTrackId:       s.pixGridActionCuesByTrackId,
    setPixGridState:                  s.setPixGridState,
    applyPixGridAuthoringState:       s.applyPixGridAuthoringState,
    selectSvgAsset:                  s.selectSvgAsset,
    cinema2Workspace:                s.cinema2Workspace,
    activateCinema2Workspace:        s.activateCinema2Workspace,
    storeCinema2WorkspacePresetState: s.storeCinema2WorkspacePresetState,
    })),
  )
  const bpmSync = useVisualStore((s) => s.bpmSync)
  const activeShaderId = useShaderPanelStore((s) => s.activeShaderId)
  const activeBrandKit = useBrandKitStore((s) => s.activeKit)
  const activeLaserDmxManagedShow = useMemo(
    () => laserDmxShowManagerShows.find(show => show.id === laserDmxShowManagerActiveShowId) ?? null,
    [laserDmxShowManagerActiveShowId, laserDmxShowManagerShows],
  )
  const activeLaserDmxSectionRuntimePrograms = useMemo(
    () => activeLaserDmxManagedShow
      ? createLaserDmxShowManagerRuntimeSectionPrograms(activeLaserDmxManagedShow)
      : [],
    [activeLaserDmxManagedShow],
  )
  const activeLaserDmxEmptyRuntimeShowDirector = useMemo(
    () => activeLaserDmxManagedShow
      ? createLaserDmxShowManagerEmptyRuntimeShowDirector(activeLaserDmxManagedShow)
      : null,
    [activeLaserDmxManagedShow],
  )
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
  const lowerWorkspaceRef = useRef<HTMLElement>(null)
  const [lowerSurfaceHeight, setLowerSurfaceHeight] = useState<number | null>(null)
  const getLowerSurfaceStartHeight = useCallback(
    () => lowerWorkspaceRef.current?.querySelector<HTMLElement>('.rv-lower-workspace-surface:not([hidden])')?.offsetHeight
      ?? DEFAULT_LOWER_SURFACE_HEIGHT,
    [],
  )
  const resizeLowerSurface = useCallback((next: number) => {
    const section = lowerWorkspaceRef.current
    const column = section?.parentElement
    const toolbarHeight = section?.querySelector<HTMLElement>('.rv-lower-workspace-toolbar')?.offsetHeight ?? 0
    const ceiling = column ? column.clientHeight - toolbarHeight - MIN_STAGE_HEIGHT : MAX_LOWER_SURFACE_HEIGHT
    setLowerSurfaceHeight(Math.max(MIN_LOWER_SURFACE_HEIGHT, Math.min(next, ceiling)))
  }, [])
  const activeLowerSurface = isReactLowerSurfaceAvailable(lowerSurface, workspaceComposition)
    ? lowerSurface
    : (lowerSurfaces[0] ?? 'trackMap')
  const leftTab = isReactLeftTabAvailable(preferredLeftTab, workspaceComposition) ? preferredLeftTab : defaultLeftTab
  const [stageFocus, setStageFocus] = useState(false)
  const [trackMapLaneIconsExpanded, setTrackMapLaneIconsExpanded] = useState(false)
  const [layoutLabOpen, setLayoutLabOpen] = useState(false)
  const [trackTimelineOpen, setTrackTimelineOpen] = useState(false)
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
  const { hasActiveProgramAudio, getRecordingStream } = engine
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const [cinema2Runtime, setCinema2Runtime] = useState<Cinema2Runtime | null>(null)
  const [cinema2RuntimeSnapshot, setCinema2RuntimeSnapshot] = useState<Cinema2RuntimeSnapshot | null>(null)
  const [cinema2InitialPresetId] = useState<Cinema2PresetId>(() => {
    const lastPresetId = readCinema2LastPresetId()
    if (lastPresetId && cinema2NativePresetRegistry.has(lastPresetId)) return lastPresetId
    return CINEMA2_RUNTIME_FOUNDATION_PRESET_ID
  })
  const cinema2PresetId = cinema2Workspace.activePresetId ?? cinema2InitialPresetId
  const cinema2RestoreState = useCinema2WorkspaceRestoreState(
    cinema2PresetId,
    getCinema2WorkspacePresetState(cinema2Workspace, cinema2PresetId),
    cinema2Workspace.activationRevision,
  )
  const activeEnginePresetName = useActiveEnginePresetName(activeReactEngineId, cinema2PresetId)
  const handleCinema2PresetSelect = useCallback((presetId: Cinema2PresetId) => {
    const result = activateCinema2Workspace({ presetId })
    if (!result.ok) return
    writeCinema2LastPresetId(presetId)
  }, [activateCinema2Workspace])
  const handleCinema2RuntimeRetiring = useCallback((state: Readonly<Cinema2WorkspacePresetState>) => {
    storeCinema2WorkspacePresetState(state)
  }, [storeCinema2WorkspacePresetState])
  useEffect(() => {
    if (cinema2Workspace.activePresetId) return
    const result = activateCinema2Workspace({ presetId: cinema2InitialPresetId })
    if (result.ok) writeCinema2LastPresetId(cinema2InitialPresetId)
  }, [activateCinema2Workspace, cinema2InitialPresetId, cinema2Workspace.activePresetId])
  const [canvasOutputCapability, setCanvasOutputCapability] = useState<CanvasOutputCapability>(CANVAS_OUTPUT_AVAILABLE)
  const outputCapability = activeReactEngineId === 'canvas'
    ? canvasOutputCapability
    : CANVAS_OUTPUT_AVAILABLE
  const handleCanvasOutputCapabilityChange = useCallback((capability: CanvasOutputCapability) => {
    setCanvasOutputCapability(capability)
    if (!isCanvasOutputAvailable(capability)) setOutputCanvas(null)
  }, [])
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

  useLayoutEffect(() => {
    if (activeReactEngineId !== 'canvas') return
    if (isCanvasOutputAvailable(outputCapability)) return
    if (recorder.recorderState === 'recording') recorder.stopRecording()
  }, [activeReactEngineId, outputCapability, recorder.recorderState, recorder.stopRecording])

  const handleStartRecording = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!isCanvasOutputAvailable(outputCapability) || canvas !== outputCanvas) return
      const audioStream = hasActiveProgramAudio ? getRecordingStream() : null
      startVideoRecording(canvas, audioStream)
    },
    [getRecordingStream, hasActiveProgramAudio, outputCanvas, outputCapability, startVideoRecording],
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
      selectedCanvasLayerId,
        laserDmxWorkspaceMode,
      laserDmxBeamMatrix,
    }),
    [activeReactEngineId, activeShaderId, oscillatorSettings, selectedCanvasLayerId, laserDmxWorkspaceMode, laserDmxBeamMatrix],
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
    activeReactEngineId === 'canvas' || activeReactEngineId === 'cinema2' || activeReactEngineId === 'headliner'
      ? null
      : (selectedPresetForEngine ?? reactPresets.find((p) => p.engine === activeReactEngineId) ?? null)

  const renderPreset = useMemo(
    () => resolveBrandedReactPreset(activePreset, cinematicConfigsByPresetId, activeBrandKit),
    [activePreset, cinematicConfigsByPresetId, activeBrandKit],
  )

  // Timeline math requires a finite positive duration. New/decoding tracks can
  // briefly expose 0, and malformed metadata may contain NaN/Infinity/negatives.
  const audioDurationSec = resolvePositiveDuration(engine.duration, 180)
  const transportPaused = engine.source === 'file' && isReactTransportPaused({
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
  const trackTimelineAnalysisKey = engine.currentTrack?.analysisRuntime.analysisKey ?? ''
  const trackTimelineWaveformEntry = useRgbWaveformStore((state) =>
    trackTimelineAnalysisKey ? state.waveforms[trackTimelineAnalysisKey] : undefined,
  )
  const trackTimelineAvailability = resolveTrackTimelineAvailability({
    hasTrack: engine.currentTrack != null,
    analysisStatus: engine.currentAnalysisStatus,
    analysis: effectiveTrackAnalysis,
    waveformEntry: trackTimelineWaveformEntry,
    progress: engine.currentTrack?.analysisRuntime.analysisProgress,
  })

  useEffect(() => {
    if (!trackTimelineAvailability.enabled) setTrackTimelineOpen(false)
  }, [trackTimelineAvailability.enabled])

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
  const cinema2FrameTimeMs = activeReactEngineId === 'cinema2'
    ? cinema2RuntimeSnapshot?.performance?.cpuFrameTimeAverageMs ?? null
    : null
  const headerFps = cinema2FrameTimeMs && cinema2FrameTimeMs > 0 ? 1000 / cinema2FrameTimeMs : liveFps
  const headerQualityTier = activeReactEngineId === 'cinema2'
    ? cinema2RuntimeSnapshot?.performance?.resolvedQuality ?? 'high'
    : qualityTierForFps(headerFps)

  return (
    <div className="rv-shell" data-help-engine={activeReactEngineId} data-stage-focus={stageFocus ? 'true' : undefined}>
      {activeReactEngineId === 'laserDmx' && <LaserDmxRendererNotice />}
      <div className="vz-header">
        <HeaderControlGroup label="React controls">
          <ReactGlobalOutputControls />
        </HeaderControlGroup>

        <span className="az-spacer" />
        <button
          type="button"
          className="vsm-settings-btn"
          title="Layout Lab"
          aria-label="Layout Lab"
          onClick={() => setLayoutLabOpen(true)}
        >
          <AppIcon kind="sliders" size="18" />
        </button>
        <VyzualzHeaderActions
          page="react"
          status={<ReactHeaderStatusCluster fps={headerFps} frameTimeMs={cinema2FrameTimeMs} qualityTier={headerQualityTier} />}
        />
      </div>
      {trackTimelineOpen
        && trackTimelineAvailability.enabled
        && effectiveTrackAnalysis
        && trackTimelineWaveformEntry?.analysis && (
          <Suspense fallback={null}>
            <TrackTimelineModal
              onClose={() => setTrackTimelineOpen(false)}
              analysis={effectiveTrackAnalysis}
              rgbWaveform={trackTimelineWaveformEntry.analysis}
              filename={engine.currentTrack?.displayName ?? engine.currentTrack?.name ?? 'Track'}
              trackTitle={engine.currentTrack?.title ?? engine.currentTrack?.displayName ?? engine.currentTrack?.name ?? null}
              artistName={engine.currentTrack?.artist ?? engine.currentTrack?.externalMetadata?.artist ?? null}
              channels={engine.currentTrack
                ? engine.getDecodedBuffer(engine.currentTrack.id)?.numberOfChannels
                  ?? engine.currentTrack.persistedMetadata?.channels
                  ?? null
                : null}
            />
          </Suspense>
        )}
      {layoutLabOpen && <LayoutLabModal onClose={() => setLayoutLabOpen(false)} />}
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
          className="rw-frame--left"
        >
          <RailWindowHeader
            side="left"
            icon={<AppIcon kind="grid" size={15} color="currentColor" aria-hidden="true" />}
            label="React Workspace"
          />
          <div className="rv-left-workspace-shell" data-description-density="compact">
            <section
              className="rv-context-workspace"
              aria-label={`${REACT_ENGINE_CATALOG[activeReactEngineId].label} workspace`}
            >
              <header className="rv-context-workspace-header">
                <ReactEngineBrowser presetName={activeEnginePresetName} />
              </header>
              <div className="rv-workspace-tabs-wrap">
                <RailTabs
                  tabs={leftTabs}
                  activeTab={leftTab}
                  onChange={setLeftTab}
                  ariaLabel={`${REACT_ENGINE_CATALOG[activeReactEngineId].label} workspace tabs`}
                  className="rv-context-workspace-tabs"
                  variant="underline"
                />
              </div>
              <div className="rv-left-tab-body">
                <div className="rv-engine-viewport rv-inspector rv-inspector-scroll">
                  {leftTab === 'workspace' && (
                    <ReactEnginePanel
                      cinema2Runtime={cinema2Runtime}
                      onOpenMediaManager={onOpenMediaManager}
                    />
                  )}
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
                  {leftTab === 'layers' && (activeReactEngineId === 'cinema2' ? <Cinema2LayersPanel runtime={cinema2Runtime} /> : activeReactEngineId === 'canvas' ? <CanvasLayersPanel /> : workspaceComposition.showLaserLayersTab ? (
                    <Suspense fallback={<LazyWorkspaceFallback label="LaserDMX layers" />}><LaserDmxLayersPanel /></Suspense>
                  ) : null)}
                  {leftTab === 'fonts' && <FontLibraryPanel />}
                </div>
              </div>
            </section>
          </div>
        </WorkspaceRail>

        {/* Center — canvas + pads + track map */}
        <div className="rv-center-col">
          <div className="rv-canvas-wrap">
            {activeReactEngineId === 'cinema2' ? (
              <Cinema2Stage
                presetId={cinema2PresetId}
                restoreState={cinema2RestoreState}
                isPlaying={engine.isPlaying}
                analysisActive={engine.analysisActive}
                isPaused={transportPaused}
                analyser={analyser}
                audioIntelligenceTrackId={engine.currentTrackId}
                activeAudioTrackId={engine.currentAudioTrackId ?? engine.currentTrackId}
                bpmSync={engine.source !== 'microphone' && bpmSync}
                bpm={engine.currentEffectiveBpm}
                getAudioTime={engine.getCurrentTime}
                onCanvasReady={setOutputCanvas}
                onRuntimeReady={setCinema2Runtime}
                onRuntimeSnapshot={setCinema2RuntimeSnapshot}
                onRuntimeRetiring={handleCinema2RuntimeRetiring}
              />
            ) : activeReactEngineId === 'canvas' ? (
              <CanvasEngineSurface
                isPlaying={engine.isPlaying}
                analysisActive={engine.analysisActive}
                isPaused={transportPaused}
                analyser={analyser}
                trackAnalysis={effectiveTrackAnalysis}
                trackSections={resolvedTrackSections}
                getAudioTime={engine.getCurrentTime}
                activeAudioTrackId={engine.currentTrackId}
                onCanvasReady={setOutputCanvas}
                onOutputCapabilityChange={handleCanvasOutputCapabilityChange}
                onLiveFps={setLiveFps}
                showRuntimeStatus={false}
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
                analysisActive={engine.analysisActive}
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
            ) : activeReactEngineId === 'headliner' ? (
              <HeadlinerSurface
                onCanvasReady={setOutputCanvas}
                onLiveFps={setLiveFps}
                audio={{
                  getAudioTime: engine.getCurrentTime,
                  trackAnalysis: effectiveTrackAnalysis,
                  trackSections: resolvedTrackSections,
                  trackIdentity: engine.currentAudioTrackId ?? engine.currentTrackId,
                }}
              />
            ) : activeReactEngineId === 'oscilloscope' || activeReactEngineId === 'laserDmx' ? (
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
                analysisActive={engine.analysisActive}
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
                laserDmxSectionRuntimePrograms={activeReactEngineId === 'laserDmx' ? activeLaserDmxSectionRuntimePrograms : undefined}
                laserDmxEmptyRuntimeShowDirector={activeReactEngineId === 'laserDmx' ? activeLaserDmxEmptyRuntimeShowDirector : null}
              />
            ) : null}
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
              ref={lowerWorkspaceRef}
              className="rv-lower-workspace"
              data-collapsed={lowerWorkspaceCollapsed ? 'true' : undefined}
              data-resized={lowerSurfaceHeight != null ? 'true' : undefined}
              style={lowerSurfaceHeight != null ? ({ '--rv-lower-surface-height': `${lowerSurfaceHeight}px` } as CSSProperties) : undefined}
              aria-label="Performance timeline workspace"
            >
              {!lowerWorkspaceCollapsed && !stageFocus && (
                <TopEdgeResizeHandle
                  label="Resize timeline workspace"
                  value={lowerSurfaceHeight ?? DEFAULT_LOWER_SURFACE_HEIGHT}
                  min={MIN_LOWER_SURFACE_HEIGHT}
                  max={MAX_LOWER_SURFACE_HEIGHT}
                  getStartValue={getLowerSurfaceStartHeight}
                  onChange={resizeLowerSurface}
                />
              )}
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
                <div className="rv-lower-workspace-tabs dv-underline-tabs" role="tablist" aria-label="Timeline surfaces">
                  {lowerSurfaces.map((surface) => (
                    <span key={surface} className="rv-lower-workspace-tab-wrap">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeLowerSurface === surface}
                        className={`dv-underline-tab${activeLowerSurface === surface ? ' is-active' : ''}`}
                        onClick={() => {
                          setLowerSurface(surface)
                          setLowerWorkspaceCollapsed(false)
                        }}
                      >
                        {getReactLowerSurfaceLabel(surface)}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="rv-lower-workspace-actions">
                  <div className="rv-lower-workspace-output-actions">
                    {activeLowerSurface === 'trackMap' && (
                      <button
                        type="button"
                        className={`rv-track-map-lane-icons-toggle${trackMapLaneIconsExpanded ? ' is-active' : ''}`}
                        aria-label={trackMapLaneIconsExpanded ? 'Collapse Track Map row icons' : 'Expand Track Map row icons'}
                        aria-expanded={trackMapLaneIconsExpanded}
                        aria-pressed={trackMapLaneIconsExpanded}
                        onClick={() => setTrackMapLaneIconsExpanded(value => !value)}
                        title={trackMapLaneIconsExpanded ? 'Hide Track Map row icons' : 'Show Track Map row icons'}
                      >
                        <TrackMapLaneIconsToggleIcon />
                      </button>
                    )}
                    <OutputCastControl canvas={outputCanvas} capability={outputCapability} />
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
                    <ReactTrackMapStrip
                      audioDurationSec={audioDurationSec}
                      embedded
                      laneIconsExpanded={trackMapLaneIconsExpanded}
                    />
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
          className="rw-frame--right"
        >
          <RailWindowHeader
            side="right"
            icon={<AppIcon kind="settings" size={15} color="currentColor" aria-hidden="true" />}
            label="Inspector"
          />
          <RailTabs
            tabs={rightTabs}
            activeTab={activeRightPanel}
            onChange={setActiveRightPanel}
            ariaLabel="React right workspace panels"
            className="rv-main-workspace-tabs"
            variant="underline"
          />
          <div className="vz-panel-body">
            {activeRightPanel === 'presets' &&
              (workspaceComposition.presetSurface === 'shaderScenes' ? (
                  <Suspense fallback={<LazyWorkspaceFallback label="Shader scenes" />}>
                    <ShaderLibraryPanel />
                  </Suspense>
              ) : activeReactEngineId === 'cinema2' ? (
                <Cinema2PresetsPanel activePresetId={cinema2PresetId} onSelectPreset={handleCinema2PresetSelect} />
              ) : activeReactEngineId === 'headliner' ? (
                <HeadlinerPresetsPanel />
              ) : (
                <ReactPresetsPanel />
              ))}
            {activeRightPanel === 'design' && (
              activeReactEngineId === 'cinema2'
                ? <Cinema2InspectorPanel runtime={cinema2Runtime} surface="design" />
                : activeReactEngineId === 'headliner'
                  ? <HeadlinerDesignPanel />
                  : <ReactDesignWorkspacePanel hasSelection={inspectableSelection !== null} />
            )}
            {activeRightPanel === 'react' && (
              activeReactEngineId === 'cinema2'
                ? <Cinema2InspectorPanel runtime={cinema2Runtime} surface="react" />
                : activeReactEngineId === 'headliner'
                  ? <HeadlinerReactivityPanel />
                  : <ReactReactivityWorkspacePanel />
            )}
            {activeRightPanel === 'output' && (
              <ReactOutputWorkspacePanel
                canvas={activeReactEngineId === 'cinema2' && cinema2Runtime == null ? null : outputCanvas}
                outputCapability={outputCapability}
                recorder={recorder}
                liveFps={liveFps}
                hasActiveProgramAudio={hasActiveProgramAudio}
                onStartRecording={handleStartRecording}
                cinema2Runtime={activeReactEngineId === 'cinema2' ? cinema2Runtime : null}
                cinema2RuntimeSnapshot={activeReactEngineId === 'cinema2' ? cinema2RuntimeSnapshot : null}
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
        showAudioSourceControl
        lowerReservedAction={(
          <button
            type="button"
            className="vz-dock-track-timeline-btn"
            data-state={trackTimelineOpen ? 'active' : trackTimelineAvailability.state}
            title={trackTimelineAvailability.title}
            aria-label={trackTimelineAvailability.title}
            aria-pressed={trackTimelineOpen}
            disabled={!trackTimelineAvailability.enabled}
            onClick={() => setTrackTimelineOpen(true)}
          >
            <TrackTimelineIcon />
          </button>
        )}
      />
    </div>
  )
}

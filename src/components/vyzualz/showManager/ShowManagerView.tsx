import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type MutableRefObject, type ReactNode } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { resolvePositiveDuration, type TimelineViewport } from '../../../features/timeline/timelineViewport'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useReactStore } from '../../../stores/reactStore'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { Collapsible, ColorRow, NumberInputRow, SelectRow, SliderRow, ToggleRow } from '../react/ReactControlRows'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import { PixGridDesignPanel } from '../react/pixGrid/PixGridDesignPanel'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  DEFAULT_REACT_PRESETS,
  LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorFixtureKind,
  type ReactEngineId,
  type ReactPreset,
} from '../react/ReactTypes'
import { FixtureIcon } from '../react/LaserDmxShowDirectorPalette'
import { ReactPlaceholderCanvas } from '../react/ReactPlaceholderCanvas'
import { ReactPersistenceStatus } from '../react/ReactPersistenceStatus'
import { EditSectionForm, SectionTimeline } from '../react/ReactTrackMapStrip'
import type { PixGridLayer } from '../react/pixGrid/PixGridTypes'
import { applyPixGridPresetSettings } from '../react/pixGrid/PixGridState'
import {
  createPixGridDeckGeneratedPreset,
  resolvePixGridDeckPresetReadiness,
} from '../react/pixGrid/PixGridDeckPreset'
import { usePixGridDeckCompilerStore } from '../react/pixGrid/PixGridDeckCompilerRuntime'
import { ingestPixGridDeckSourceFiles } from '../react/pixGrid/PixGridDeckMediaService'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import {
  PixGridDeckBuilderInspector,
  PixGridDeckBuilderLibrary,
  PixGridDeckPresetSummary,
  PixGridDeckSequenceStrip,
  type PixGridDeckUploadUiState,
} from './PixGridDeckBuilder'
import {
  LASER_DMX_SHOW_MANAGER_GRID_SIZE,
  LASER_DMX_SHOW_MANAGER_QUALITY,
  LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS,
  createLaserDmxShowManagerEmptyRuntimeShowDirector,
  createLaserDmxShowManagerRuntimeSectionPrograms,
  getEligibleLaserDmxShowManagerFixtureCopySources,
  isLaserDmxShowManagerFixtureKindEnabled,
  parseLaserDmxShowManagerFixtureKind,
  resolveLaserDmxShowManagerGridCell,
  resolveLaserDmxShowManagerTriggerOption,
  triggerPatchForLaserDmxShowManagerOption,
  type LaserDmxShowManagerTriggerOption,
  type LaserDmxShowManagerSection,
  type LaserDmxShowManagerShow,
  type LaserDmxShowManagerWorkspaceSettingsPatch,
} from './LaserDmxShowManagerDomain'
import '../../../styles/reactView.css'
import '../../../styles/showManager.css'

const COMPONENTS = [
  ['▦', 'Pixel Grid', '12'],
  ['▥', 'Bars', '8'],
  ['✦', 'Lights', '16'],
  ['·', 'Particles', '24'],
  ['ϟ', 'Strobe', '6'],
  ['T', 'Text', '10'],
] as const

const ASSETS = [
  ['▧', 'Textures', '28'],
  ['◇', 'Materials', '14'],
  ['▶', 'Media', '36'],
  ['◈', 'Shaders', '18'],
  ['Aa', 'Fonts', '9'],
] as const

const SECTION_SEGMENTS = [
  { label: 'Intro', className: 'is-intro' },
  { label: 'Build', className: 'is-build' },
  { label: 'Drop', className: 'is-drop' },
  { label: 'Breakdown', className: 'is-breakdown' },
] as const

const SHOW_MANAGER_ENGINE_OPTIONS = REACT_ENGINE_IDS.map(engineId => ({
  value: engineId,
  label: REACT_ENGINE_CATALOG[engineId].label,
  description: REACT_ENGINE_CATALOG[engineId].description,
  disabled: engineId !== 'pixGrid' && engineId !== 'laserDmx',
}))

const STAGE_SCALE_OPTIONS = [
  { value: 'fit', label: 'Fit' },
  { value: 'fill', label: 'Fill' },
  { value: '100', label: '100%' },
] as const

const SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE = 'showManager:pixGridDeckBuilder' as const

function formatClock(value: number): string {
  const safe = Number.isFinite(value) && value > 0 ? value : 0
  const minutes = Math.floor(safe / 60)
  const seconds = Math.floor(safe % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function findPixGridPreset(
  presets: readonly ReactPreset[],
  preferredId: string | null,
): ReactPreset | null {
  const pixGridPresets = presets.filter(preset => preset.engine === 'pixGrid')
  return pixGridPresets.find(preset => preset.id === preferredId) ?? pixGridPresets[0] ?? null
}

export function ShowManagerView() {
  const engine = useSharedAudio()
  const reactPresets = useReactStore(state => state.reactPresets)
  const activeReactPresetId = useReactStore(state => state.activeReactPresetId)
  const pixGridState = useReactStore(state => state.pixGridState)
  const pixGridDecks = useReactStore(state => state.pixGridDecks)
  const renamePixGridDeck = useReactStore(state => state.renamePixGridDeck)
  const updatePixGridDeck = useReactStore(state => state.updatePixGridDeck)
  const deletePixGridDeck = useReactStore(state => state.deletePixGridDeck)
  const createPixGridDeckPreset = useReactStore(state => state.createPixGridDeckPreset)
  const reactIntensity = useReactStore(state => state.reactIntensity)
  const reactMotion = useReactStore(state => state.reactMotion)
  const reactGlow = useReactStore(state => state.reactGlow)
  const reactBassReactivity = useReactStore(state => state.reactBassReactivity)
  const pixGridActionCuesByTrackId = useReactStore(state => state.pixGridActionCuesByTrackId)
  const manualTrackSectionsByTrackId = useReactStore(state => state.manualTrackSectionsByTrackId)
  const suppressedAutoSectionsByTrackId = useReactStore(state => state.suppressedAutoSectionsByTrackId)
  const laserDmxShowManagerShows = useReactStore(state => state.laserDmxShowManagerShows)
  const laserDmxShowManagerEditingShowId = useReactStore(state => state.laserDmxShowManagerEditingShowId)
  const laserDmxShowManagerEditingSectionId = useReactStore(state => state.laserDmxShowManagerEditingSectionId)
  const laserDmxShowManagerPlaybackSectionId = useReactStore(state => state.laserDmxShowManagerPlaybackSectionId)
  const createLaserDmxShowManagerShow = useReactStore(state => state.createLaserDmxShowManagerShow)
  const ensureLaserDmxShowManagerShow = useReactStore(state => state.ensureLaserDmxShowManagerShow)
  const selectLaserDmxShowManagerSection = useReactStore(state => state.selectLaserDmxShowManagerSection)
  const updateLaserDmxShowManagerSection = useReactStore(state => state.updateLaserDmxShowManagerSection)
  const updateLaserDmxShowManagerWorkspaceSettings = useReactStore(state => state.updateLaserDmxShowManagerWorkspaceSettings)
  const addLaserDmxShowManagerSection = useReactStore(state => state.addLaserDmxShowManagerSection)
  const removeLaserDmxShowManagerSection = useReactStore(state => state.removeLaserDmxShowManagerSection)
  const reorderLaserDmxShowManagerSection = useReactStore(state => state.reorderLaserDmxShowManagerSection)
  const addLaserDmxShowManagerFixture = useReactStore(state => state.addLaserDmxShowManagerFixture)
  const updateLaserDmxShowManagerFixture = useReactStore(state => state.updateLaserDmxShowManagerFixture)
  const removeLaserDmxShowManagerFixture = useReactStore(state => state.removeLaserDmxShowManagerFixture)
  const copyLaserDmxShowManagerFixturesFromSection = useReactStore(state => state.copyLaserDmxShowManagerFixturesFromSection)
  const updateLaserDmxShowManagerSectionBoundary = useReactStore(state => state.updateLaserDmxShowManagerSectionBoundary)
  const undoLaserDmxShowManagerEdit = useReactStore(state => state.undoLaserDmxShowManagerEdit)
  const redoLaserDmxShowManagerEdit = useReactStore(state => state.redoLaserDmxShowManagerEdit)
  const laserShowUndoDepth = useReactStore(state => state.showManagerUndoStack.length)
  const laserShowRedoDepth = useReactStore(state => state.showManagerRedoStack.length)
  const saveLaserDmxShowManagerShow = useReactStore(state => state.saveLaserDmxShowManagerShow)
  const [selectedEngineId, setSelectedEngineId] = useState<ReactEngineId>('pixGrid')
  const [selectedLightingComponentKind, setSelectedLightingComponentKind] = useState<LaserDmxShowDirectorFixtureKind | null>(null)
  const [selectedLaserFixtureId, setSelectedLaserFixtureId] = useState<string | null>(null)
  const [copyLaserFixturesEnabled, setCopyLaserFixturesEnabled] = useState(false)
  const [copyLaserFixturesSourceSectionId, setCopyLaserFixturesSourceSectionId] = useState<string | null>(null)
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null)
  const [liveFps, setLiveFps] = useState(0)
  const [workspaceMode, setWorkspaceMode] = useState<'default' | typeof SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE>('default')
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null)
  const [deckDraftName, setDeckDraftName] = useState('Untitled Deck')
  const [deckNameError, setDeckNameError] = useState<string | null>(null)
  const [previewDeckItemId, setPreviewDeckItemId] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<PixGridDeckUploadUiState>({
    active: false,
    phase: 'Ready',
    error: null,
    warnings: [],
  })
  const deckBuilderHeadingRef = useRef<HTMLDivElement | null>(null)
  const deckBuilderReturnTargetRef = useRef<'create' | 'edit'>('create')
  const uploadAbortRef = useRef<AbortController | null>(null)
  const uploadOperationRef = useRef(0)
  const [laserSavePending, setLaserSavePending] = useState<'save' | 'active' | null>(null)
  const [laserSaveStatus, setLaserSaveStatus] = useState<string | null>(null)
  const compilerStatuses = usePixGridDeckCompilerStore(state => state.statuses)
  const transitionStatuses = usePixGridDeckCompilerStore(state => state.transitionStatuses)
  const activeLaserDmxShow = useMemo(
    () => laserDmxShowManagerShows.find(show => show.id === laserDmxShowManagerEditingShowId)
      ?? laserDmxShowManagerShows[0]
      ?? null,
    [laserDmxShowManagerEditingShowId, laserDmxShowManagerShows],
  )
  const activeLaserDmxSection = useMemo(
    () => activeLaserDmxShow?.sections.find(section => section.id === laserDmxShowManagerEditingSectionId)
      ?? activeLaserDmxShow?.sections[0]
      ?? null,
    [activeLaserDmxShow, laserDmxShowManagerEditingSectionId],
  )
  const playbackLaserDmxSection = useMemo(
    () => activeLaserDmxShow?.sections.find(section => section.id === laserDmxShowManagerPlaybackSectionId) ?? null,
    [activeLaserDmxShow, laserDmxShowManagerPlaybackSectionId],
  )
  const laserDmxRuntimePrograms = useMemo(
    () => createLaserDmxShowManagerRuntimeSectionPrograms(activeLaserDmxShow),
    [activeLaserDmxShow],
  )
  const laserDmxEmptyRuntimeShowDirector = useMemo(
    () => activeLaserDmxShow ? createLaserDmxShowManagerEmptyRuntimeShowDirector(activeLaserDmxShow) : null,
    [activeLaserDmxShow],
  )
  const laserDmxRuntimePreset = useMemo(
    () => reactPresets.find(preset => preset.engine === 'laserDmx')
      ?? DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'laserDmx')
      ?? null,
    [reactPresets],
  )
  const selectedLaserFixture = useMemo(
    () => activeLaserDmxSection?.fixtures.find(fixture => fixture.id === selectedLaserFixtureId) ?? null,
    [activeLaserDmxSection, selectedLaserFixtureId],
  )
  const eligibleLaserFixtureCopySources = useMemo(
    () => activeLaserDmxShow && activeLaserDmxSection
      ? getEligibleLaserDmxShowManagerFixtureCopySources(activeLaserDmxShow, activeLaserDmxSection.id)
      : [],
    [activeLaserDmxSection, activeLaserDmxShow],
  )
  const laserTimelineDuration = useMemo(
    () => Math.max(1, ...(activeLaserDmxShow?.sections.map(section => section.endSec) ?? [1])),
    [activeLaserDmxShow],
  )
  const laserTimelineViewport = useMemo<TimelineViewport>(
    () => ({ startSec: 0, endSec: laserTimelineDuration }),
    [laserTimelineDuration],
  )
  const laserTimelineViewportRef = useRef<TimelineViewport>(laserTimelineViewport)
  laserTimelineViewportRef.current = laserTimelineViewport

  useEffect(() => {
    if (selectedEngineId !== 'laserDmx') return
    ensureLaserDmxShowManagerShow()
  }, [ensureLaserDmxShowManagerShow, selectedEngineId])

  useEffect(() => {
    if (selectedEngineId === 'laserDmx' && engine.isPlaying) return
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [engine.isPlaying, selectedEngineId])

  useEffect(() => () => {
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId !== null) {
      useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: null })
    }
  }, [])

  const handleLaserDmxPlaybackSectionChange = (sectionId: string | null) => {
    if (useReactStore.getState().laserDmxShowManagerPlaybackSectionId === sectionId) return
    useReactStore.setState({ laserDmxShowManagerPlaybackSectionId: sectionId })
  }

  useEffect(() => {
    if (selectedLaserFixtureId && !activeLaserDmxSection?.fixtures.some(fixture => fixture.id === selectedLaserFixtureId)) {
      setSelectedLaserFixtureId(null)
    }
  }, [activeLaserDmxSection, selectedLaserFixtureId])

  useEffect(() => {
    setCopyLaserFixturesEnabled(false)
    setCopyLaserFixturesSourceSectionId(null)
  }, [activeLaserDmxSection?.id, activeLaserDmxShow?.id])

  useEffect(() => {
    if (copyLaserFixturesSourceSectionId
      && !eligibleLaserFixtureCopySources.some(section => section.id === copyLaserFixturesSourceSectionId)) {
      setCopyLaserFixturesSourceSectionId(null)
    }
  }, [copyLaserFixturesSourceSectionId, eligibleLaserFixtureCopySources])

  const pixGridPresets = useMemo(
    () => reactPresets.filter(preset => preset.engine === 'pixGrid'),
    [reactPresets],
  )
  const editingDeck = useMemo(
    () => pixGridDecks.find(deck => deck.id === editingDeckId) ?? null,
    [editingDeckId, pixGridDecks],
  )
  const deckReadiness = useMemo(() => editingDeck
    ? resolvePixGridDeckPresetReadiness(
        editingDeck,
        compilerStatuses[editingDeck.id],
        transitionStatuses[editingDeck.id],
      )
    : null, [compilerStatuses, editingDeck, transitionStatuses])
  const deckPreviewPreset = useMemo(
    () => editingDeck ? createPixGridDeckGeneratedPreset(editingDeck) : null,
    [editingDeck],
  )

  useEffect(() => {
    if (workspaceMode !== SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE) return
    setDeckDraftName(editingDeck?.name ?? 'Untitled Deck')
    setDeckNameError(null)
    setPreviewDeckItemId(current => (
      editingDeck?.items.some(item => item.id === current && item.enabled)
        ? current
        : editingDeck?.items.find(item => item.enabled)?.id ?? null
    ))
  }, [editingDeck, workspaceMode])

  useEffect(() => {
    if (workspaceMode !== SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE) return
    deckBuilderHeadingRef.current?.focus()
  }, [workspaceMode])

  useEffect(() => {
    const preferred = findPixGridPreset(reactPresets, activeReactPresetId)
    setPreviewPresetId(current => {
      if (current && pixGridPresets.some(preset => preset.id === current)) return current
      return preferred?.id ?? null
    })
  }, [activeReactPresetId, pixGridPresets, reactPresets])

  useEffect(() => () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
  }, [])

  const activePreset = useMemo(
    () => findPixGridPreset(reactPresets, previewPresetId),
    [previewPresetId, reactPresets],
  )
  const displayedPreset = workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && deckPreviewPreset
    ? deckPreviewPreset
    : activePreset
  const displayedPixGridState = useMemo(() => (
    workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && deckPreviewPreset
      ? applyPixGridPresetSettings(pixGridState, deckPreviewPreset.id, deckPreviewPreset.pixGridSettings)
      : pixGridState
  ), [deckPreviewPreset, pixGridState, workspaceMode])
  const selectedScene = displayedPixGridState.scenes.find(scene => scene.id === displayedPixGridState.selectedSceneId)
    ?? displayedPixGridState.scenes[0]
    ?? null
  const selectedLayers = selectedScene
    ? selectedScene.layerIds
      .map(layerId => displayedPixGridState.layers.find(layer => layer.id === layerId))
      .filter((layer): layer is PixGridLayer => Boolean(layer))
    : []
  const activeCues = engine.currentTrackId
    ? (pixGridActionCuesByTrackId[engine.currentTrackId] ?? [])
    : []
  const durationSec = resolvePositiveDuration(engine.duration, 180)
  const activeManualTrackSections = useMemo(() => {
    const trackId = engine.currentTrackId
    return trackId ? (manualTrackSectionsByTrackId[trackId] ?? []) : []
  }, [engine.currentTrackId, manualTrackSectionsByTrackId])
  const resolvedTrackSections = useMemo(() => resolveTrackSections({
    analyzedSections: engine.currentAnalysis ? adaptMIAnalysis(engine.currentAnalysis) : [],
    manualSections: activeManualTrackSections,
    suppressedIds: engine.currentTrackId
      ? (suppressedAutoSectionsByTrackId[engine.currentTrackId] ?? [])
      : [],
    durationSec,
  }), [
    activeManualTrackSections,
    durationSec,
    engine.currentAnalysis,
    engine.currentTrackId,
    suppressedAutoSectionsByTrackId,
  ])
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
  const playheadPercent = Math.min(100, Math.max(0, (engine.currentTime / durationSec) * 100))
  const sceneLabels = displayedPixGridState.scenes.slice(0, 4).map(scene => scene.name)
  const matrixLabel = `${displayedPixGridState.matrixWidth}×${displayedPixGridState.matrixHeight}`
  const activeDeck = activePreset?.pixGridDeck
    ? pixGridDecks.find(deck => deck.id === activePreset.pixGridDeck?.deckId) ?? null
    : null
  const activeDeckReadiness = activeDeck
    ? resolvePixGridDeckPresetReadiness(
        activeDeck,
        compilerStatuses[activeDeck.id],
        transitionStatuses[activeDeck.id],
      )
    : null
  const presetOptions = pixGridPresets.map(preset => {
    const deck = preset.pixGridDeck
      ? pixGridDecks.find(candidate => candidate.id === preset.pixGridDeck?.deckId) ?? null
      : null
    return {
      value: preset.id,
      label: preset.name,
      description: preset.description,
      disabled: Boolean(preset.pixGridDeck && (!deck || !resolvePixGridDeckPresetReadiness(
        deck,
        compilerStatuses[deck.id],
        transitionStatuses[deck.id],
      ).ready)),
    }
  })
  const previewEnabledItems = editingDeck?.items.filter(item => item.enabled) ?? []
  const previewDeckIndex = Math.max(0, previewEnabledItems.findIndex(item => item.id === previewDeckItemId))
  const previewBpm = engine.currentEffectiveBpm && engine.currentEffectiveBpm > 0 ? engine.currentEffectiveBpm : 120
  const builderPreviewTime = editingDeck
    ? (previewDeckIndex * editingDeck.configuration.defaultItemDurationBeats * 60) / previewBpm + 0.01
    : engine.currentTime

  const enterDeckBuilder = (deckId: string | null) => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    deckBuilderReturnTargetRef.current = deckId ? 'edit' : 'create'
    setEditingDeckId(deckId)
    setWorkspaceMode(SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE)
    setUploadState({ active: false, phase: 'Ready', error: null, warnings: [] })
  }

  const exitDeckBuilder = () => {
    uploadOperationRef.current += 1
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    const returnTarget = deckBuilderReturnTargetRef.current
    setWorkspaceMode('default')
    setEditingDeckId(null)
    setPreviewDeckItemId(null)
    window.setTimeout(() => {
      const preferred = returnTarget === 'edit'
        ? document.querySelector<HTMLButtonElement>('.sm-deck-preset-summary button')
        : document.querySelector<HTMLButtonElement>('.sm-create-deck-button')
      ;(preferred ?? document.querySelector<HTMLButtonElement>('.sm-create-deck-button'))?.focus()
    }, 0)
  }

  const handleDeckFiles = async (files: File[]) => {
    const name = deckDraftName.trim()
    if (!editingDeck && !name) {
      setDeckNameError('Deck name is required.')
      return
    }

    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    const operationId = uploadOperationRef.current + 1
    uploadOperationRef.current = operationId
    uploadAbortRef.current = controller
    setUploadState({ active: true, phase: 'Validating…', error: null, warnings: [] })

    const result = await ingestPixGridDeckSourceFiles({
      target: editingDeck
        ? { kind: 'append', deckId: editingDeck.id }
        : { kind: 'create', name },
      files,
      signal: controller.signal,
      onUploadPhase: (fileName, phase) => {
        if (uploadOperationRef.current !== operationId || controller.signal.aborted) return
        setUploadState(current => ({ ...current, phase: `${fileName}: ${phase}` }))
      },
    })
    if (uploadOperationRef.current !== operationId) return
    uploadAbortRef.current = null

    if (!result.ok) {
      const phase = result.error.code === 'cancelled'
        ? 'Cancelled'
        : result.error.code === 'project-replaced' || result.error.code === 'deck-conflict'
          ? 'Conflict'
          : 'Failed'
      setUploadState({ active: false, phase, error: result.error.message, warnings: [] })
      return
    }
    setEditingDeckId(result.deckId)
    setDeckNameError(null)
    const resultWarnings = result.rejected?.map(entry => `${entry.fileName}: ${entry.message}`) ?? []
    setUploadState({
      active: false,
      phase: resultWarnings.length > 0 ? 'Ready with warnings' : 'Ready',
      error: null,
      warnings: resultWarnings,
    })
  }

  const handleDeckRename = () => {
    if (!editingDeck || deckDraftName.trim() === editingDeck.name) return
    const result = renamePixGridDeck(editingDeck.id, deckDraftName)
    if (!result.ok) setDeckNameError(result.error.message)
    else setDeckNameError(null)
  }

  const handleDeckUpdate = (patch: Parameters<typeof updatePixGridDeck>[1]) => {
    if (!editingDeck) return
    const result = updatePixGridDeck(editingDeck.id, patch)
    if (!result.ok) setUploadState(current => ({ ...current, error: result.error.message }))
  }

  const moveDeckItem = (itemId: string, direction: -1 | 1) => {
    if (!editingDeck) return
    const items = [...editingDeck.items].sort((left, right) => left.order - right.order)
    const index = items.findIndex(item => item.id === itemId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    handleDeckUpdate({ items: items.map((item, order) => ({ ...item, order })) })
  }

  const toggleDeckItem = (itemId: string) => {
    if (!editingDeck) return
    handleDeckUpdate({
      items: editingDeck.items.map(item => item.id === itemId ? { ...item, enabled: !item.enabled } : item),
    })
  }

  const removeDeckItem = (itemId: string) => {
    if (!editingDeck || editingDeck.items.length <= 2) return
    handleDeckUpdate({ items: editingDeck.items.filter(item => item.id !== itemId) })
  }

  const stepPreview = (direction: -1 | 1) => {
    if (previewEnabledItems.length === 0) return
    const nextIndex = (previewDeckIndex + direction + previewEnabledItems.length) % previewEnabledItems.length
    setPreviewDeckItemId(previewEnabledItems[nextIndex]?.id ?? null)
  }

  const undoLaserShowEdit = () => {
    if (laserShowUndoDepth === 0) return
    undoLaserDmxShowManagerEdit()
    setSelectedLaserFixtureId(current => {
      if (!current) return null
      const state = useReactStore.getState()
      const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === state.laserDmxShowManagerEditingShowId)
      const section = show?.sections.find(candidate => candidate.id === state.laserDmxShowManagerEditingSectionId)
      return section?.fixtures.some(fixture => fixture.id === current) ? current : null
    })
  }

  const redoLaserShowEdit = () => {
    if (laserShowRedoDepth === 0) return
    redoLaserDmxShowManagerEdit()
    setSelectedLaserFixtureId(current => {
      if (!current) return null
      const state = useReactStore.getState()
      const show = state.laserDmxShowManagerShows.find(candidate => candidate.id === state.laserDmxShowManagerEditingShowId)
      const section = show?.sections.find(candidate => candidate.id === state.laserDmxShowManagerEditingSectionId)
      return section?.fixtures.some(fixture => fixture.id === current) ? current : null
    })
  }

  const commitLaserWorkspaceSettings = (patch: LaserDmxShowManagerWorkspaceSettingsPatch) => {
    if (!activeLaserDmxShow) return
    updateLaserDmxShowManagerWorkspaceSettings(activeLaserDmxShow.id, patch)
  }

  const commitLaserShowSave = async (makeActive: boolean) => {
    if (!activeLaserDmxShow || laserSavePending) return
    setLaserSavePending(makeActive ? 'active' : 'save')
    setLaserSaveStatus(null)
    try {
      const saved = await saveLaserDmxShowManagerShow(activeLaserDmxShow.id, { makeActive })
      setLaserSaveStatus(saved
        ? (makeActive ? 'Saved and made active.' : 'Saved.')
        : (makeActive ? 'Could not complete Save + Make Active.' : 'Could not save Show.'))
    } finally {
      setLaserSavePending(null)
    }
  }

  const activateLaserComponent = (kind: LaserDmxShowDirectorFixtureKind) => {
    if (!isLaserDmxShowManagerFixtureKindEnabled(kind)) return
    setSelectedLightingComponentKind(kind)
  }

  const beginLaserComponentDrag = (event: DragEvent<HTMLButtonElement>, kind: LaserDmxShowDirectorFixtureKind) => {
    if (!isLaserDmxShowManagerFixtureKindEnabled(kind)) {
      event.preventDefault()
      return
    }
    setSelectedLightingComponentKind(kind)
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-drmvyz-laserdmx-fixture-kind', kind)
    event.dataTransfer.setData('text/plain', kind)
  }

  const commitLaserFixtureDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    const rawKind = event.dataTransfer.getData('application/x-drmvyz-laserdmx-fixture-kind')
      || event.dataTransfer.getData('text/plain')
    const kind = parseLaserDmxShowManagerFixtureKind(rawKind)
    if (!kind) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const cell = resolveLaserDmxShowManagerGridCell(event.clientX, event.clientY, bounds)
    if (!cell) return
    const fixtureId = addLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, kind, cell)
    if (fixtureId) {
      setSelectedLaserFixtureId(fixtureId)
    }
  }

  const commitLaserFixturePatch = (patch: LaserDmxShowDirectorFixturePatch) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection || !selectedLaserFixture) return
    updateLaserDmxShowManagerFixture(
      activeLaserDmxShow.id,
      activeLaserDmxSection.id,
      selectedLaserFixture.id,
      patch,
    )
  }

  const deleteSelectedLaserFixture = () => {
    if (!activeLaserDmxShow || !activeLaserDmxSection || !selectedLaserFixture) return
    removeLaserDmxShowManagerFixture(activeLaserDmxShow.id, activeLaserDmxSection.id, selectedLaserFixture.id)
    setSelectedLaserFixtureId(null)
  }

  const commitLaserFixtureCopy = (sourceSectionId: string) => {
    if (!activeLaserDmxShow || !activeLaserDmxSection) return
    if (!eligibleLaserFixtureCopySources.some(section => section.id === sourceSectionId)) return
    const copiedFixtureIds = copyLaserDmxShowManagerFixturesFromSection(
      activeLaserDmxShow.id,
      sourceSectionId,
      activeLaserDmxSection.id,
    )
    if (copiedFixtureIds.length === 0) return
    setSelectedLaserFixtureId(null)
    setCopyLaserFixturesSourceSectionId(null)
  }

  const selectLaserSectionForEditing = (sectionId: string) => {
    setSelectedLaserFixtureId(null)
    selectLaserDmxShowManagerSection(sectionId)
  }

  const commitLaserSectionBoundary = (
    sectionId: string,
    edge: 'start' | 'end',
    newTime: number,
    neighborId: string | null,
    neighborTime: number | null,
  ) => {
    if (!activeLaserDmxShow) return
    updateLaserDmxShowManagerSectionBoundary(
      activeLaserDmxShow.id,
      sectionId,
      edge,
      newTime,
      neighborId,
      neighborTime,
    )
  }

  return (
    <section className="sm-root rv-shell" aria-label="Show Manager workspace">
      <header className="sm-topbar">
        <div className="sm-title-block" tabIndex={-1} ref={deckBuilderHeadingRef}>
          <strong>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'DECK BUILDER' : 'SHOW MANAGER'}</strong>
          <span>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'PixGrid image sequence authoring' : 'Preset authoring workspace'}</span>
        </div>

        <div className="sm-topbar-spacer" />
        <div className="sm-stage-tools sm-stage-tools--header" aria-label="Show Manager stage tools">
          {selectedEngineId === 'laserDmx' && workspaceMode === 'default' ? (
            <>
              <button type="button" onClick={undoLaserShowEdit} disabled={laserShowUndoDepth === 0} title="Undo section edit">↶</button>
              <button type="button" onClick={redoLaserShowEdit} disabled={laserShowRedoDepth === 0} title="Redo section edit">↷</button>
              {['↖', '✥', '⌗', '▦', '◫'].map(tool => (
                <button key={tool} type="button" disabled>{tool}</button>
              ))}
            </>
          ) : (
            ['↖', '✥', '↻', '⌗', '▦', '◫', '20'].map(tool => (
              <button key={tool} type="button" disabled>{tool}</button>
            ))
          )}
        </div>
        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && (
          <button type="button" className="sm-header-button" onClick={exitDeckBuilder}>Back to Show Manager</button>
        )}
        {selectedEngineId === 'laserDmx' && workspaceMode === 'default' && (
          <button type="button" className="sm-header-button" onClick={() => createLaserDmxShowManagerShow()}>New Show</button>
        )}
        <button type="button" className="sm-header-button" disabled>Show Lyrics</button>
        <button
          type="button"
          className="sm-header-button"
          onClick={() => void commitLaserShowSave(false)}
          disabled={selectedEngineId !== 'laserDmx' || !activeLaserDmxShow || laserSavePending !== null}
        >{laserSavePending === 'save' ? 'Saving…' : 'Save'}</button>
        <button
          type="button"
          className="sm-header-button sm-header-button--primary"
          onClick={() => void commitLaserShowSave(true)}
          disabled={selectedEngineId !== 'laserDmx' || !activeLaserDmxShow || laserSavePending !== null}
        >{laserSavePending === 'active' ? 'Activating…' : 'Save + Make Active'}</button>
        {selectedEngineId === 'laserDmx' && (
          <>
            <ReactPersistenceStatus />
            {laserSaveStatus && (
              <span className="sm-header-save-status" role="status">{laserSaveStatus}</span>
            )}
          </>
        )}
        <VyzualzHeaderActions />
      </header>

      <div className="sm-workspace">
        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? (
          <aside className="sm-library sm-library--deck" aria-label="Show Manager Deck images">
            <PixGridDeckBuilderLibrary
              deck={editingDeck}
              draftName={deckDraftName}
              upload={uploadState}
              previewItemId={previewDeckItemId}
              onFiles={handleDeckFiles}
              onPreview={setPreviewDeckItemId}
              onMove={moveDeckItem}
              onReorder={(sourceItemId, targetItemId) => {
                if (!editingDeck) return
                const items = [...editingDeck.items].sort((left, right) => left.order - right.order)
                const sourceIndex = items.findIndex(item => item.id === sourceItemId)
                if (sourceIndex < 0 || !items.some(item => item.id === targetItemId)) return
                const [sourceItem] = items.splice(sourceIndex, 1)
                const targetIndex = items.findIndex(item => item.id === targetItemId)
                if (!sourceItem || targetIndex < 0) return
                items.splice(targetIndex, 0, sourceItem)
                handleDeckUpdate({ items: items.map((item, order) => ({ ...item, order })) })
              }}
              onToggle={toggleDeckItem}
              onRemove={removeDeckItem}
            />
          </aside>
        ) : (
        <aside className="sm-library" aria-label="Show Manager component library">
          <div className="sm-panel-heading">
            <strong>COMPONENT LIBRARY</strong>
            <span>{REACT_ENGINE_CATALOG[selectedEngineId].label}</span>
          </div>
          <div className="sm-engine-picker">
            <Dropdown
              id="show-manager-engine"
              ariaLabel="Show Manager engine"
              value={selectedEngineId}
              onChange={value => setSelectedEngineId(value as ReactEngineId)}
              options={SHOW_MANAGER_ENGINE_OPTIONS}
              size="compact"
              maxMenuHeight={360}
              className="sm-engine-dropdown"
              menuClassName="sm-engine-dropdown-menu"
            />
          </div>

          {selectedEngineId === 'pixGrid' ? (
            <>
              <label className="sm-search-field">
                <span className="sr-only">Search Show Manager components</span>
                <input type="search" placeholder="Search components…" disabled />
              </label>

              <LibrarySection title="Components" count={COMPONENTS.length}>
                {COMPONENTS.map(([icon, label, count], index) => (
                  <button key={label} type="button" className={`sm-library-row${index === 0 ? ' is-active' : ''}`} disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-library-icon">{icon}</span>
                    <span>{label}</span>
                    <small>{count}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Assets" count={ASSETS.length}>
                {ASSETS.map(([icon, label, count]) => (
                  <button key={label} type="button" className="sm-library-row" disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-library-icon">{icon}</span>
                    <span>{label}</span>
                    <small>{count}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Scenes" count={pixGridState.scenes.length}>
                {pixGridState.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={`sm-library-row sm-scene-row${scene.id === selectedScene?.id ? ' is-active' : ''}`}
                    disabled
                  >
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-scene-index">{String(index + 1).padStart(2, '0')}</span>
                    <span>{scene.name}</span>
                    <small>{scene.layerIds.length}</small>
                  </button>
                ))}
              </LibrarySection>

              <LibrarySection title="Layers" count={selectedLayers.length}>
                {selectedLayers.slice(0, 6).map(layer => (
                  <button key={layer.id} type="button" className="sm-library-row" disabled>
                    <span className="sm-library-grip">⋮⋮</span>
                    <span className="sm-layer-dot" />
                    <span>{layer.name}</span>
                    <small>{layer.visible ? '●' : '○'}</small>
                  </button>
                ))}
                {selectedLayers.length === 0 && <div className="sm-library-empty">No layers in this scene.</div>}
              </LibrarySection>
            </>
          ) : selectedEngineId === 'laserDmx' ? (
            <>
              <LibrarySection title="Lighting Components" count={LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.length}>
                {LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.map(kind => {
                  const enabled = isLaserDmxShowManagerFixtureKindEnabled(kind)
                  const active = enabled && selectedLightingComponentKind === kind
                  return (
                    <button
                      key={kind}
                      type="button"
                      className={`sm-library-row sm-library-row--fixture${active ? ' is-active' : ''}${enabled ? '' : ' is-disabled'}`}
                      disabled={!enabled}
                      aria-disabled={!enabled}
                      aria-pressed={enabled ? active : undefined}
                      draggable={enabled}
                      onClick={() => activateLaserComponent(kind)}
                      onDragStart={event => beginLaserComponentDrag(event, kind)}
                    >
                      <span className="sm-library-grip" aria-hidden="true">⋮⋮</span>
                      <span className="sm-library-icon sm-library-fixture-icon" aria-hidden="true"><FixtureIcon kind={kind} /></span>
                      <span>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]}</span>
                      <small>{enabled ? 'Ready' : 'Disabled'}</small>
                    </button>
                  )
                })}
              </LibrarySection>

              <LibrarySection title="Workspace" count={2}>
                <LibrarySubsection title="Display Settings" count={4}>
                  <div className="sm-library-controls">
                    <ToggleRow
                      label="Show Grid"
                      value={activeLaserDmxShow?.settings?.showGrid ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showGrid => commitLaserWorkspaceSettings({ showGrid })}
                    />
                    <ToggleRow
                      label="Show Labels"
                      value={activeLaserDmxShow?.settings?.showLabels ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showLabels => commitLaserWorkspaceSettings({ showLabels })}
                    />
                    <ToggleRow
                      label="Show Beams"
                      value={activeLaserDmxShow?.settings?.showBeams ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={showBeams => commitLaserWorkspaceSettings({ showBeams })}
                    />
                    <ToggleRow
                      label="Highlight Grid"
                      value={activeLaserDmxShow?.settings?.highlightGrid ?? true}
                      disabled={!activeLaserDmxShow}
                      onChange={highlightGrid => commitLaserWorkspaceSettings({ highlightGrid })}
                    />
                  </div>
                </LibrarySubsection>

                <LibrarySubsection title="Render Settings" count={3}>
                  <div className="sm-library-controls">
                    <SelectRow
                      label="Grid Size"
                      value="18x12"
                      disabled
                      onChange={() => undefined}
                      options={[{ value: '18x12', label: '18 × 12' }]}
                    />
                    <SelectRow
                      label="Lighting Renderer"
                      value={activeLaserDmxShow?.settings?.rendererMode ?? 'auto'}
                      disabled={!activeLaserDmxShow}
                      onChange={value => {
                        const option = LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS.find(candidate => candidate.value === value)
                        if (option) commitLaserWorkspaceSettings({ rendererMode: option.value })
                      }}
                      options={LASER_DMX_SHOW_DIRECTOR_RENDERER_OPTIONS.map(option => ({ ...option }))}
                    />
                    <SelectRow
                      label="Quality"
                      value={LASER_DMX_SHOW_MANAGER_QUALITY}
                      disabled
                      onChange={() => undefined}
                      options={[{ value: LASER_DMX_SHOW_MANAGER_QUALITY, label: 'High' }]}
                    />
                  </div>
                </LibrarySubsection>
              </LibrarySection>
            </>
          ) : (
            <div className="sm-panel-blank" />
          )}
        </aside>
        )}

        <main className="sm-center">
          <div className="sm-stage-frame">
            {selectedEngineId === 'laserDmx' && workspaceMode === 'default' ? (
              <LaserDmxShowManagerStage
                show={activeLaserDmxShow}
                section={activeLaserDmxSection}
                selectedFixtureId={selectedLaserFixtureId}
                showGrid={activeLaserDmxShow?.settings?.showGrid ?? true}
                showLabels={activeLaserDmxShow?.settings?.showLabels ?? true}
                showBeams={activeLaserDmxShow?.settings?.showBeams ?? true}
                highlightGrid={activeLaserDmxShow?.settings?.highlightGrid ?? true}
                playbackSectionLabel={engine.isPlaying ? playbackLaserDmxSection?.label ?? 'No active section' : null}
                runtimePreview={engine.isPlaying && laserDmxRuntimePreset && activeLaserDmxShow ? (
                  <ReactPlaceholderCanvas
                    analyser={engine.analyserMaster}
                    engine="laserDmx"
                    activePreset={laserDmxRuntimePreset}
                    intensity={reactIntensity}
                    motion={reactMotion}
                    glow={reactGlow}
                    bassReactivity={reactBassReactivity}
                    isPlaying={engine.isPlaying}
                    isPaused={false}
                    trackSections={resolvedTrackSections}
                    trackAnalysis={effectiveTrackAnalysis}
                    laserDmxSectionRuntimePrograms={laserDmxRuntimePrograms}
                    laserDmxEmptyRuntimeShowDirector={laserDmxEmptyRuntimeShowDirector}
                    onLaserDmxPlaybackSectionChange={handleLaserDmxPlaybackSectionChange}
                    getAudioTime={engine.getCurrentTime}
                    effectiveBpm={engine.currentEffectiveBpm ?? undefined}
                    activeAudioTrackId={engine.currentTrackId}
                    durationSec={durationSec}
                  />
                ) : null}
                onDropFixture={commitLaserFixtureDrop}
                onSelectFixture={setSelectedLaserFixtureId}
              />
            ) : (
              <PixGridSurface
                analyser={engine.analyserMaster}
                activePreset={displayedPreset}
                pixGridState={displayedPixGridState}
                pixGridDecks={pixGridDecks}
                pixGridActionCues={activeCues}
                intensity={reactIntensity}
                motion={reactMotion}
                glow={reactGlow}
                bassReactivity={reactBassReactivity}
                isPlaying={engine.isPlaying}
                isPaused={!engine.isPlaying}
                trackSections={resolvedTrackSections}
                trackAnalysis={effectiveTrackAnalysis}
                trackIdentity={engine.currentTrackId}
                durationSec={durationSec}
                audioTimeSec={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? builderPreviewTime : engine.currentTime}
                getAudioTime={workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? () => builderPreviewTime : engine.getCurrentTime}
                effectiveBpm={engine.currentEffectiveBpm ?? undefined}
                onLiveFps={setLiveFps}
              />
            )}
            <div className="sm-stage-status">
              {selectedEngineId === 'laserDmx' && workspaceMode === 'default' ? (
                <>
                  <span>LaserDMX {LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns} × {LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows}</span>
                  <span>{activeLaserDmxSection?.fixtures.length ?? 0} editing fixtures</span>
                  <span>{engine.isPlaying ? `Playback: ${playbackLaserDmxSection?.label ?? 'None'}` : 'Playback stopped'}</span>
                  <span>{selectedLaserFixture?.label ?? 'No selection'}</span>
                </>
              ) : (
                <>
                  <span>PixGrid {matrixLabel}</span>
                  <span>FPS {liveFps > 0 ? liveFps.toFixed(1) : '—'}</span>
                </>
              )}
            </div>
            <Dropdown
              id="show-manager-stage-scale"
              ariaLabel="Show Manager stage scale"
              value="fit"
              options={STAGE_SCALE_OPTIONS}
              size="dense"
              showDescriptions={false}
              disabled
              className="sm-fit-dropdown"
            />
          </div>

          {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && editingDeck ? (
            <PixGridDeckSequenceStrip
              deck={editingDeck}
              previewItemId={previewDeckItemId}
              onPreview={setPreviewDeckItemId}
              onPrevious={() => stepPreview(-1)}
              onNext={() => stepPreview(1)}
            />
          ) : selectedEngineId === 'laserDmx' ? (
            <LaserDmxShowManagerTimeline
              show={activeLaserDmxShow}
              selectedSectionId={activeLaserDmxSection?.id ?? null}
              durationSec={laserTimelineDuration}
              viewport={laserTimelineViewport}
              viewportRef={laserTimelineViewportRef}
              onSelect={selectLaserSectionForEditing}
              onRemove={sectionId => {
                if (!activeLaserDmxShow) return
                removeLaserDmxShowManagerSection(activeLaserDmxShow.id, sectionId)
              }}
              onCommitBoundary={commitLaserSectionBoundary}
            />
          ) : (
            <ShowManagerTimeline
              currentTime={engine.currentTime}
              duration={durationSec}
              playheadPercent={playheadPercent}
              sceneLabels={sceneLabels}
            />
          )}
        </main>

        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? (
          <aside className="sm-inspector sm-inspector--deck" aria-label="Show Manager Deck Builder inspector">
            <PixGridDeckBuilderInspector
              deck={editingDeck}
              draftName={deckDraftName}
              readiness={deckReadiness}
              upload={uploadState}
              nameError={deckNameError}
              onDraftName={setDeckDraftName}
              onRename={handleDeckRename}
              onUpdate={handleDeckUpdate}
              onCreatePreset={() => {
                if (!editingDeck || !deckReadiness) return
                const result = createPixGridDeckPreset(editingDeck.id, deckReadiness)
                if (!result.ok) {
                  setUploadState(current => ({ ...current, error: result.error.message }))
                  return
                }
                setPreviewPresetId(editingDeck.generatedPresetId)
                exitDeckBuilder()
              }}
              onDelete={() => {
                if (!editingDeck) return
                if (!window.confirm('Deleting this Deck will delete the Preset too. Are you sure?')) return
                const result = deletePixGridDeck(editingDeck.id)
                if (!result.ok) {
                  setUploadState(current => ({ ...current, error: result.error.message }))
                  return
                }
                exitDeckBuilder()
              }}
            />
          </aside>
        ) : (
        <aside className="sm-inspector" aria-label={`Show Manager ${REACT_ENGINE_CATALOG[selectedEngineId].label} inspector`}>
          <div className="sm-panel-heading sm-panel-heading--inspector">
            <strong>INSPECTOR</strong>
            <span>{REACT_ENGINE_CATALOG[selectedEngineId].label} parameters</span>
          </div>
          {selectedEngineId === 'pixGrid' ? (
            <div className="sm-inspector-scroll">
              <Collapsible label="Preset" defaultOpen>
                <div className="sm-preset-browser">
                  <div className="sm-preset-browser-heading">
                    <span aria-hidden="true">{REACT_ENGINE_CATALOG.pixGrid.icon}</span>
                    <div>
                      <strong>PixGrid Presets</strong>
                      <small>{pixGridPresets.length} preset{pixGridPresets.length === 1 ? '' : 's'} available</small>
                    </div>
                  </div>
                  <Dropdown
                    id="show-manager-pix-grid-preset"
                    ariaLabel="Show Manager PixGrid preset"
                    menuLabel="PixGrid presets"
                    value={activePreset?.id ?? null}
                    onChange={value => {
                      const preset = pixGridPresets.find(candidate => candidate.id === value)
                      if (!preset) return
                      if (preset.pixGridDeck) {
                        const deck = pixGridDecks.find(candidate => candidate.id === preset.pixGridDeck?.deckId)
                        if (!deck || !resolvePixGridDeckPresetReadiness(
                          deck,
                          compilerStatuses[deck.id],
                          transitionStatuses[deck.id],
                        ).ready) return
                      }
                      setPreviewPresetId(value)
                    }}
                    options={presetOptions}
                    placeholder="No PixGrid presets"
                    emptyMessage="No PixGrid presets"
                    disabled={pixGridPresets.length === 0}
                    size="compact"
                    className="sm-preset-dropdown"
                  />
                  <button type="button" className="sm-create-deck-button" onClick={() => enterDeckBuilder(null)}>
                    Create Deck
                  </button>
                  {activeDeck && activePreset && activeDeckReadiness && (
                    <PixGridDeckPresetSummary
                      deck={activeDeck}
                      preset={activePreset}
                      readiness={activeDeckReadiness}
                      onEdit={() => enterDeckBuilder(activeDeck.id)}
                    />
                  )}
                </div>
              </Collapsible>
              <div className="sm-inspector-context">
                <div>
                  <span>Component</span>
                  <strong>Pixel Grid</strong>
                </div>
                <div>
                  <span>Matrix</span>
                  <strong>{matrixLabel}</strong>
                </div>
              </div>
              <PixGridDesignPanel groupedSections />
              <Collapsible label="Validation" defaultOpen={false}>
                <section className="sm-validation-card">
                  <header><strong>PixGrid document</strong><span>OK</span></header>
                  <p>No blocking PixGrid issues detected.</p>
                  <p>Preset controls are connected to the existing PixGrid state.</p>
                </section>
              </Collapsible>
              <Collapsible label="Document Stats" defaultOpen={false}>
                <section className="sm-document-stats">
                  <div><span>Scenes</span><strong>{displayedPixGridState.scenes.length}</strong></div>
                  <div><span>Layers</span><strong>{displayedPixGridState.layers.length}</strong></div>
                  <div><span>Groups</span><strong>{displayedPixGridState.groups.length}</strong></div>
                  <div><span>Cues</span><strong>{activeCues.length}</strong></div>
                </section>
              </Collapsible>
            </div>
          ) : selectedEngineId === 'laserDmx' ? (
            <div className="sm-inspector-scroll sm-laser-section-inspector">
              <div className="sm-inspector-context">
                <div><span>Show</span><strong>{activeLaserDmxShow?.name ?? 'Untitled Show'}</strong></div>
                <div><span>Grid</span><strong>{LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns} × {LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows}</strong></div>
              </div>
              {activeLaserDmxShow && activeLaserDmxSection ? (
                selectedLaserFixture ? (
                  <LaserDmxShowManagerFixtureInspector
                    fixture={selectedLaserFixture}
                    onPatch={commitLaserFixturePatch}
                    onDelete={deleteSelectedLaserFixture}
                  />
                ) : <>
                  <div className="sm-laser-section-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const index = activeLaserDmxShow.sections.findIndex(section => section.id === activeLaserDmxSection.id)
                        if (index <= 0) return
                        reorderLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, -1)
                      }}
                      disabled={activeLaserDmxShow.sections[0]?.id === activeLaserDmxSection.id}
                    >Move Earlier</button>
                    <button
                      type="button"
                      onClick={() => {
                        const index = activeLaserDmxShow.sections.findIndex(section => section.id === activeLaserDmxSection.id)
                        if (index < 0 || index >= activeLaserDmxShow.sections.length - 1) return
                        reorderLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, 1)
                      }}
                      disabled={activeLaserDmxShow.sections[activeLaserDmxShow.sections.length - 1]?.id === activeLaserDmxSection.id}
                    >Move Later</button>
                    <button
                      type="button"
                      onClick={() => {
                        const last = activeLaserDmxShow.sections[activeLaserDmxShow.sections.length - 1]
                        addLaserDmxShowManagerSection(activeLaserDmxShow.id, {
                          type: 'unknown',
                          label: 'Section',
                          startSec: last?.endSec ?? 0,
                          endSec: (last?.endSec ?? 0) + 1,
                        })
                      }}
                    >Add Section</button>
                  </div>
                  <section className="sm-laser-copy-fixtures" data-testid="laser-dmx-copy-fixtures-controls">
                    <ToggleRow
                      id="show-manager-laser-copy-fixtures"
                      label="Copy Fixtures From Another Section"
                      value={copyLaserFixturesEnabled}
                      onChange={enabled => {
                        setCopyLaserFixturesEnabled(enabled)
                        if (!enabled) setCopyLaserFixturesSourceSectionId(null)
                      }}
                    />
                    {copyLaserFixturesEnabled && (
                      <div className="sm-laser-copy-fixtures-picker">
                        <Dropdown
                          id="show-manager-laser-copy-fixtures-source"
                          ariaLabel="Copy fixtures source section"
                          menuLabel="Sections with LaserDMX fixtures"
                          value={copyLaserFixturesSourceSectionId}
                          onChange={sourceSectionId => {
                            setCopyLaserFixturesSourceSectionId(sourceSectionId)
                            commitLaserFixtureCopy(sourceSectionId)
                          }}
                          options={eligibleLaserFixtureCopySources.map(section => ({
                            value: section.id,
                            label: section.label,
                            description: `${section.fixtures.length} fixture${section.fixtures.length === 1 ? '' : 's'}`,
                          }))}
                          placeholder={eligibleLaserFixtureCopySources.length > 0 ? 'Choose source section' : 'No eligible sections'}
                          emptyMessage="No other sections contain fixtures"
                          disabled={eligibleLaserFixtureCopySources.length === 0}
                          size="compact"
                          className="sm-laser-copy-fixtures-dropdown"
                        />
                        {eligibleLaserFixtureCopySources.length === 0 && (
                          <p>No other section in this Show currently contains LaserDMX fixtures.</p>
                        )}
                      </div>
                    )}
                  </section>
                  <EditSectionForm
                    key={activeLaserDmxSection.id}
                    section={activeLaserDmxSection}
                    durationSec={laserTimelineDuration}
                    effectiveBpm={null}
                    snapMode="free"
                    onCancel={() => undefined}
                    onSave={patch => {
                      updateLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id, patch)
                    }}
                    onDelete={() => {
                      removeLaserDmxShowManagerSection(activeLaserDmxShow.id, activeLaserDmxSection.id)
                    }}
                  />
                  <section className="sm-validation-card">
                    <header><strong>Section fixture ownership</strong><span>READY</span></header>
                    <p>{activeLaserDmxSection.fixtures.length} fixture{activeLaserDmxSection.fixtures.length === 1 ? '' : 's'} owned by this section. Select a fixture on the grid to edit its Part 1 controls.</p>
                  </section>
                </>
              ) : activeLaserDmxShow ? (
                <div className="sm-laser-empty-section">
                  <p>This Show intentionally has no sections.</p>
                  <button
                    type="button"
                    onClick={() => {
                      addLaserDmxShowManagerSection(activeLaserDmxShow.id, { label: 'Section', startSec: 0, endSec: 1 })
                    }}
                  >Add Section</button>
                </div>
              ) : (
                <div className="sm-panel-blank" />
              )}
            </div>
          ) : (
            <div className="sm-panel-blank" />
          )}
        </aside>
        )}
      </div>

      {/* Shared application Audio Dock. Loading or selecting a track here updates
          the same AudioEngineContext consumed by the Show Manager preview. */}
      <VyzualzAudioDock
        expandable
        unifiedTimeline
        waveformAppearance="deck"
      />
    </section>
  )
}

function LaserDmxShowManagerFixtureInspector({
  fixture,
  onPatch,
  onDelete,
}: {
  fixture: LaserDmxShowDirectorFixture
  onPatch: (patch: LaserDmxShowDirectorFixturePatch) => void
  onDelete: () => void
}) {
  const triggerOption = resolveLaserDmxShowManagerTriggerOption(fixture.trigger)
  const beamPatternOptions = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'fan', label: 'Fan' },
    { value: 'sweep', label: 'Sweep' },
    { value: 'cross', label: 'Cross' },
    { value: 'mirror', label: 'Mirror' },
    { value: 'audioReactive', label: 'Audio Reactive' },
  ]

  return (
    <div className="sm-laser-fixture-inspector" data-testid="laser-dmx-fixture-inspector">
      <div className="sm-inspector-context sm-laser-fixture-context">
        <div><span>Fixture</span><strong>{fixture.label}</strong></div>
        <div><span>Type</span><strong>{LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]}</strong></div>
      </div>

      <Collapsible label="Position" defaultOpen>
        <NumberInputRow
          label="X"
          value={fixture.x}
          min={0}
          max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1}
          step={1}
          onChange={x => onPatch({ x })}
        />
        <NumberInputRow
          label="Y"
          value={fixture.y}
          min={0}
          max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1}
          step={1}
          onChange={y => onPatch({ y })}
        />
        <NumberInputRow label="Z" value={fixture.z} min={-1} max={1} step={0.05} onChange={z => onPatch({ z })} />
        <NumberInputRow label="Rotation" value={fixture.rotation} min={-360} max={360} step={1} unit="°" onChange={rotation => onPatch({ rotation })} />
      </Collapsible>

      <Collapsible label="Color & Brightness" defaultOpen>
        <ColorRow label="Color" value={fixture.color} onChange={color => onPatch({ color })} />
        <SelectRow
          label="Color Mode"
          value="fixed"
          disabled
          options={[{ value: 'fixed', label: 'Static' }]}
          onChange={() => undefined}
        />
        <SliderRow label="Brightness" value={fixture.brightness} min={0} max={1} step={0.01} onChange={brightness => onPatch({ brightness })} />
      </Collapsible>

      <Collapsible label="Beam Configuration" defaultOpen>
        <SelectRow
          label="Beam Type / Pattern"
          value={fixture.beam.targetMode}
          options={beamPatternOptions}
          onChange={targetMode => onPatch({ beam: { targetMode: targetMode as LaserDmxShowDirectorFixture['beam']['targetMode'] } })}
        />
        <NumberInputRow
          label="Target X"
          value={fixture.beam.targetX ?? fixture.x}
          min={0}
          max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns - 1}
          step={1}
          onChange={targetX => onPatch({ beam: { targetX } })}
        />
        <NumberInputRow
          label="Target Y"
          value={fixture.beam.targetY ?? fixture.y}
          min={0}
          max={LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows - 1}
          step={1}
          onChange={targetY => onPatch({ beam: { targetY } })}
        />
        <SliderRow
          label="Width"
          value={fixture.optics.zoom}
          min={0}
          max={1}
          step={0.01}
          onChange={zoom => onPatch({ optics: { zoom } })}
        />
        <SliderRow label="Spread" value={fixture.beam.beamSpread} min={0} max={180} step={1} onChange={beamSpread => onPatch({ beam: { beamSpread } })} />
        <SliderRow label="Focus" value={fixture.beam.focus} min={0} max={1} step={0.01} onChange={focus => onPatch({ beam: { focus } })} />
      </Collapsible>

      <Collapsible label="Trigger Configuration" defaultOpen>
        <SelectRow
          label="Trigger"
          value={triggerOption}
          options={LASER_DMX_SHOW_MANAGER_TRIGGER_OPTIONS.map(option => ({ ...option }))}
          onChange={value => onPatch({ trigger: triggerPatchForLaserDmxShowManagerOption(value as LaserDmxShowManagerTriggerOption) })}
        />
      </Collapsible>

      <button type="button" className="sm-laser-delete-fixture" onClick={onDelete} aria-label={`Delete ${fixture.label}`}>
        Delete Fixture
      </button>
    </div>
  )
}

function LaserDmxShowManagerStage({
  show,
  section,
  selectedFixtureId,
  showGrid,
  showLabels,
  showBeams,
  highlightGrid,
  playbackSectionLabel,
  runtimePreview,
  onDropFixture,
  onSelectFixture,
}: {
  show: LaserDmxShowManagerShow | null
  section: LaserDmxShowManagerSection | null
  selectedFixtureId: string | null
  showGrid: boolean
  showLabels: boolean
  showBeams: boolean
  highlightGrid: boolean
  playbackSectionLabel: string | null
  runtimePreview: ReactNode
  onDropFixture: (event: DragEvent<HTMLDivElement>) => void
  onSelectFixture: (fixtureId: string | null) => void
}) {
  const fixtures = section?.fixtures ?? []
  const collisionOrdinals = new Map<string, number>()

  return (
    <div className="sm-laser-stage" aria-label="LaserDMX Part 1 authoring grid">
      <div className="sm-laser-stage-heading">
        <span>{show?.name ?? 'Untitled Show'}</span>
        <strong>{section ? `Editing: ${section.label}` : 'No section selected'}</strong>
        {playbackSectionLabel && <em>Playback: {playbackSectionLabel}</em>}
      </div>
      <div
        className={`sm-laser-stage-grid-surface${showGrid ? ' is-grid-visible' : ''}${highlightGrid ? ' is-highlighted' : ''}`}
        data-testid="laser-dmx-authoring-grid"
        onDragOver={event => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={onDropFixture}
        onClick={() => onSelectFixture(null)}
      >
        {runtimePreview && (
          <div className={`sm-laser-runtime-preview${showBeams ? '' : ' is-hidden'}`} aria-hidden="true">
            {runtimePreview}
          </div>
        )}
        {showBeams && !runtimePreview && fixtures.length > 0 && (
          <svg className="sm-laser-stage-beams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {fixtures.flatMap(fixture => {
              if (!fixture.beam.beamEnabled || fixture.beam.targetX == null || fixture.beam.targetY == null) return []
              const x1 = ((fixture.x + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
              const y1 = ((fixture.y + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
              const x2 = ((fixture.beam.targetX + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
              const y2 = ((fixture.beam.targetY + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
              return [<line
                key={fixture.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                style={{
                  stroke: fixture.color,
                  strokeOpacity: Math.max(0.08, fixture.brightness * 0.45),
                  strokeWidth: 0.12 + fixture.optics.zoom * 0.38,
                }}
              />]
            })}
          </svg>
        )}
        {fixtures.map(fixture => {
          const collisionKey = `${fixture.x}:${fixture.y}`
          const collisionOrdinal = collisionOrdinals.get(collisionKey) ?? 0
          collisionOrdinals.set(collisionKey, collisionOrdinal + 1)
          const collisionOffset = collisionOrdinal % 4
          const left = ((fixture.x + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.columns) * 100
          const top = ((fixture.y + 0.5) / LASER_DMX_SHOW_MANAGER_GRID_SIZE.rows) * 100
          const isSelected = fixture.id === selectedFixtureId
          return (
            <button
              key={fixture.id}
              type="button"
              className={`sm-laser-fixture${isSelected ? ' is-selected' : ''}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                marginLeft: collisionOffset * 4,
                marginTop: collisionOffset * 4,
              }}
              aria-pressed={isSelected}
              aria-label={`${fixture.label} at column ${fixture.x + 1}, row ${fixture.y + 1}`}
              data-fixture-id={fixture.id}
              data-grid-x={fixture.x}
              data-grid-y={fixture.y}
              onClick={event => {
                event.stopPropagation()
                onSelectFixture(fixture.id)
              }}
            >
              <span className="sm-laser-fixture-icon" aria-hidden="true"><FixtureIcon kind={fixture.kind} /></span>
              {showLabels && <span className="sm-laser-fixture-label">{fixture.label}</span>}
            </button>
          )
        })}
        {fixtures.length === 0 && (
          <div className="sm-laser-stage-empty" aria-hidden="true">
            Drag a lighting component onto the grid
          </div>
        )}
      </div>
    </div>
  )
}

function LaserDmxShowManagerTimeline({
  show,
  selectedSectionId,
  durationSec,
  viewport,
  viewportRef,
  onSelect,
  onRemove,
  onCommitBoundary,
}: {
  show: LaserDmxShowManagerShow | null
  selectedSectionId: string | null
  durationSec: number
  viewport: TimelineViewport
  viewportRef: MutableRefObject<TimelineViewport>
  onSelect: (sectionId: string) => void
  onRemove: (sectionId: string) => void
  onCommitBoundary: (
    sectionId: string,
    edge: 'start' | 'end',
    newTime: number,
    neighborId: string | null,
    neighborTime: number | null,
  ) => void
}) {
  return (
    <section className="sm-timeline sm-laser-timeline" aria-label="Show Manager LaserDMX section timeline">
      <header className="sm-timeline-tabs">
        <button type="button" className="is-active" disabled>Track Map</button>
        <span className="sm-timeline-meta">No audio required · free boundaries</span>
      </header>
      <div className="sm-timeline-grid">
        <div className="sm-timeline-ruler">
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index}>{index}</span>
          ))}
        </div>
        <TimelineRow label="Section">
          {show && show.sections.length > 0 ? (
            <SectionTimeline
              sections={show.sections}
              durationSec={durationSec}
              viewport={viewport}
              viewportRef={viewportRef}
              beatGrid={[]}
              effectiveBpm={null}
              snapMode="free"
              selectedId={selectedSectionId}
              onSelect={onSelect}
              onRemove={onRemove}
              onCommitBoundary={onCommitBoundary}
            />
          ) : (
            <div className="sm-laser-timeline-empty">No sections</div>
          )}
        </TimelineRow>
      </div>
    </section>
  )
}

function LibrarySubsection({
  title,
  count,
  defaultCollapsed = false,
  children,
}: {
  title: string
  count: number
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const contentId = useId()

  return (
    <section className={`sm-library-subsection${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="sm-library-section-toggle sm-library-subsection-toggle"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={() => setCollapsed(value => !value)}
      >
        <span className="sm-library-section-chevron" aria-hidden="true">⌄</span>
        <strong>{title}</strong>
        <small>{count}</small>
      </button>
      {!collapsed && <div id={contentId} className="sm-library-subsection-body">{children}</div>}
    </section>
  )
}

function LibrarySection({
  title,
  count,
  defaultCollapsed = false,
  children,
}: {
  title: string
  count: number
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const contentId = useId()

  return (
    <section className={`sm-library-section${collapsed ? ' is-collapsed' : ''}`}>
      <button
        type="button"
        className="sm-library-section-toggle"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={() => setCollapsed(value => !value)}
      >
        <span className="sm-library-section-chevron" aria-hidden="true">⌄</span>
        <strong>{title}</strong>
        <small>{count}</small>
      </button>
      {!collapsed && <div id={contentId} className="sm-library-section-body">{children}</div>}
    </section>
  )
}

function ShowManagerTimeline({
  currentTime,
  duration,
  playheadPercent,
  sceneLabels,
}: {
  currentTime: number
  duration: number
  playheadPercent: number
  sceneLabels: readonly string[]
}) {
  return (
    <section className="sm-timeline" aria-label="Show Manager track map preview">
      <header className="sm-timeline-tabs">
        <button type="button" className="is-active" disabled>Track Map</button>
        <button type="button" disabled>Cues</button>
        <button type="button" disabled>Automation</button>
        <button type="button" disabled>Clips</button>
        <button type="button" disabled>Events</button>
        <span className="sm-timeline-meta">Snap 1/4</span>
      </header>
      <div className="sm-timeline-grid">
        <div className="sm-timeline-ruler">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index}>{formatClock((duration / 6) * index)}</span>
          ))}
        </div>
        <TimelineRow label="Section">
          <div className="sm-segment-row">
            {SECTION_SEGMENTS.map(segment => (
              <span key={segment.label} className={segment.className}>{segment.label}</span>
            ))}
          </div>
        </TimelineRow>
        <TimelineRow label="Scenes">
          <div className="sm-segment-row sm-segment-row--scenes">
            {SECTION_SEGMENTS.map((segment, index) => (
              <span key={segment.label}>{sceneLabels[index] ?? segment.label}</span>
            ))}
          </div>
        </TimelineRow>
        <TimelineRow label="Cues">
          <div className="sm-cue-row">
            {[8, 18, 31, 43, 55, 69, 82, 94].map(position => <i key={position} style={{ left: `${position}%` }} />)}
          </div>
        </TimelineRow>
        <TimelineRow label="Glow">
          <svg className="sm-automation-curve" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,14 12,13 25,11 38,5 50,10 63,12 76,6 88,9 100,13" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Intensity">
          <svg className="sm-automation-curve is-green" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,15 16,15 30,12 45,7 58,9 72,5 84,9 100,14" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Motion">
          <svg className="sm-automation-curve is-purple" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,13 14,12 28,12 43,8 57,13 70,10 84,6 100,11" />
          </svg>
        </TimelineRow>
        <TimelineRow label="Audio">
          <div className="sm-waveform" aria-hidden="true">
            {Array.from({ length: 96 }, (_, index) => (
              <i key={index} style={{ height: `${22 + ((index * 17) % 68)}%` }} />
            ))}
          </div>
        </TimelineRow>
        <div className="sm-playhead" style={{ left: `calc(${playheadPercent}% + ${76 * (1 - playheadPercent / 100)}px)` }}>
          <span>{formatClock(currentTime)}</span>
        </div>
      </div>
    </section>
  )
}

function TimelineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sm-timeline-row">
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  )
}

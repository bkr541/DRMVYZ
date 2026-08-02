import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { resolvePositiveDuration } from '../../../features/timeline/timelineViewport'
import { adaptMIAnalysis, resolveTrackSections } from '../../../features/trackIntelligence/trackMapAdapter'
import { useReactStore } from '../../../stores/reactStore'
import { Dropdown } from '../../shared/Dropdown/Dropdown'
import { Collapsible } from '../react/ReactControlRows'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from '../react/reactEngineCatalog'
import { PixGridDesignPanel } from '../react/pixGrid/PixGridDesignPanel'
import { PixGridSurface } from '../react/pixGrid/PixGridSurface'
import type { ReactPreset } from '../react/ReactTypes'
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
  description: engineId === 'pixGrid'
    ? REACT_ENGINE_CATALOG[engineId].description
    : `${REACT_ENGINE_CATALOG[engineId].description} Coming to Show Manager later.`,
  disabled: engineId !== 'pixGrid',
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
  const compilerStatuses = usePixGridDeckCompilerStore(state => state.statuses)
  const transitionStatuses = usePixGridDeckCompilerStore(state => state.transitionStatuses)

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
    deckBuilderReturnTargetRef.current = deckId ? 'edit' : 'create'
    setEditingDeckId(deckId)
    setWorkspaceMode(SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE)
    setUploadState({ active: false, phase: 'Ready', error: null, warnings: [] })
  }

  const exitDeckBuilder = () => {
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
    setUploadState({ active: true, phase: 'Validating…', error: null, warnings: [] })
    const result = await ingestPixGridDeckSourceFiles({
      target: editingDeck
        ? { kind: 'append', deckId: editingDeck.id }
        : { kind: 'create', name },
      files,
      onUploadPhase: (fileName, phase) => setUploadState(current => ({
        ...current,
        phase: `${fileName}: ${phase}`,
      })),
    })
    if (!result.ok) {
      setUploadState({ active: false, phase: 'Failed', error: result.error.message, warnings: [] })
      return
    }
    setEditingDeckId(result.deckId)
    setDeckNameError(null)
    setUploadState({
      active: false,
      phase: 'Ready',
      error: null,
      warnings: result.rejected?.map(entry => `${entry.fileName}: ${entry.message}`) ?? [],
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

  return (
    <section className="sm-root rv-shell" aria-label="Show Manager workspace">
      <header className="sm-topbar">
        <div className="sm-title-block" tabIndex={-1} ref={deckBuilderHeadingRef}>
          <strong>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'DECK BUILDER' : 'SHOW MANAGER'}</strong>
          <span>{workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE ? 'PixGrid image sequence authoring' : 'Preset authoring workspace'}</span>
        </div>

        <div className="sm-topbar-spacer" />
        <div className="sm-stage-tools sm-stage-tools--header" aria-label="Show Manager stage tools">
          {['↖', '✥', '↻', '⌗', '▦', '◫', '20'].map(tool => (
            <button key={tool} type="button" disabled>{tool}</button>
          ))}
        </div>
        {workspaceMode === SHOW_MANAGER_PIX_GRID_DECK_BUILDER_MODE && (
          <button type="button" className="sm-header-button" onClick={exitDeckBuilder}>Back to Show Manager</button>
        )}
        <button type="button" className="sm-header-button" disabled>Show Lyrics</button>
        <button type="button" className="sm-header-button" disabled>Save</button>
        <button type="button" className="sm-header-button sm-header-button--primary" disabled>
          Save + Make Active
        </button>
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
            <span>PixGrid</span>
          </div>
          <div className="sm-engine-picker">
            <Dropdown
              id="show-manager-engine"
              ariaLabel="Show Manager engine"
              value="pixGrid"
              options={SHOW_MANAGER_ENGINE_OPTIONS}
              size="compact"
              maxMenuHeight={360}
              className="sm-engine-dropdown"
              menuClassName="sm-engine-dropdown-menu"
            />
          </div>
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
        </aside>
        )}

        <main className="sm-center">
          <div className="sm-stage-frame">
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
            <div className="sm-stage-status">
              <span>PixGrid {matrixLabel}</span>
              <span>FPS {liveFps > 0 ? liveFps.toFixed(1) : '—'}</span>
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
        <aside className="sm-inspector" aria-label="Show Manager PixGrid inspector">
          <div className="sm-panel-heading sm-panel-heading--inspector">
            <strong>INSPECTOR</strong>
            <span>PixGrid parameters</span>
          </div>
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

import { AppIcon } from '../../shared/icons/AppIcon'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'

import { useShallow } from 'zustand/react/shallow'
import { useRecorder } from '../../../hooks/useRecorder'
import { EMPTY_PRESET_ORGANIZATION, usePresetOrganizationStore } from '../../../features/presetOrganization/presetOrganizationStore'
import { usePresetCatalogStore, usePresetScopeFilter } from '../../../features/presetCatalog/presetCatalogStore'
import { useMediaStore } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { ApplicationHeaderControls } from '../layout/ApplicationWorkspaceFrame'
import { HeaderControlGroup } from '../layout/HeaderControlGroup'
import { HeaderIconKey } from '../layout/HeaderIconKey'
import { HeaderActionIcon } from '../layout/HeaderActionIcon'
import { SaveGlyph } from '../layout/HeaderGlyphs'
import { RailWindowHeader } from '../layout/RailWindowHeader'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { RailTabs, type RailTabOption } from '../layout/RailTabs'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import {
  getCinema2WorkspacePresetState,
  type Cinema2PresetId,
  type Cinema2Runtime,
  type Cinema2RuntimeSnapshot,
  type Cinema2WorkspacePresetState,
} from '../cinema2'
import { Cinema2InspectorPanel } from '../react/Cinema2InspectorPanel'
import { Cinema2Stage } from '../react/Cinema2Stage'
import {
  HeadlinerDesignPanel,
  HeadlinerReactivityPanel,
} from '../react/headliner/HeadlinerWorkspace'
import type { HeadlinerPresetId } from '../react/headliner/HeadlinerEffectCatalog'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../react/LaserDmxShowDirectorPerformancePresets'
import {
  ReactDesignWorkspacePanel,
  ReactOutputWorkspacePanel,
  ReactReactivityWorkspacePanel,
} from '../react/panels/ReactWorkspacePanels'
import { CANVAS_OUTPUT_AVAILABLE } from '../react/canvasFracturesOutputContract'
import { useCinema2WorkspaceRestoreState } from '../react/useCinema2WorkspaceRestoreState'
import { Collapsible, TextAreaRow, TextInputRow } from '../react/ReactControlRows'
import { ReactPresetArtwork } from '../react/ReactPresetCard'
import { ReactPresetThumbnail } from '../react/ReactPresetThumbnail'
import { DEFAULT_REACT_PRESETS } from '../react/ReactTypes'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import { UnderlineTabs, type UnderlineTabOption } from '../react/controls/UnderlineTabs'
import { TagsCollectionsGroup } from '../media/MediaManagerInspector'
import { LivePresetStore } from './LivePresetStore'
import { CartIcon } from './PresetStore'
import {
  PRESET_MANAGER_PRESETS,
  type PresetManagerRecord,
} from './presetManagerCatalog'
import '../../../styles/reactView.css'

type PresetManagerTab = 'presets' | 'favorites' | 'custom'
type PresetManagerInspectorTab = 'info' | 'design' | 'react' | 'output'
type PresetManagerStageTab = 'visualizer' | 'store' | 'downloads'

const PRESET_MANAGER_STAGE_TABS: readonly UnderlineTabOption<PresetManagerStageTab>[] = [
  { id: 'visualizer', label: 'Visualizer', icon: <AppIcon kind="waveform" size={14} color="currentColor" aria-hidden="true" /> },
  { id: 'store', label: 'Store', icon: <CartIcon size={14} /> },
  { id: 'downloads', label: 'My Downloads', icon: <AppIcon kind="download" size={14} color="currentColor" aria-hidden="true" /> },
]

const PRESET_MANAGER_TABS = [
  { id: 'presets', label: 'Presets' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'custom', label: 'Custom' },
] as const

const PRESET_MANAGER_INSPECTOR_TABS: RailTabOption<PresetManagerInspectorTab>[] = [
  { id: 'info', label: 'INFO' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

function infoValue(value: unknown): string {
  if (value === null) return 'None'
  if (value === undefined) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'function') return 'Runtime function'
  return String(value)
}

const NOOP = () => undefined

/** One read-only Preset Info field: the shared label-above-value row used by the other right-window groups. */
function InfoRow({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  const text = infoValue(value)
  return (
    <div className={wide ? 'pmv-info-wide' : undefined}>
      {wide && text.length > 48
        ? <TextAreaRow label={label} value={text} onChange={NOOP} readOnly rows={2} />
        : <TextInputRow label={label} value={text} onChange={NOOP} readOnly maxLength={400} />}
    </div>
  )
}

/** SYSTEM, or USER for a private preset (held by the signed-in account or not). Blank until the catalog has loaded. */
function usePresetOwnerLabel(preset: PresetManagerRecord): string {
  const isSystem = usePresetScopeFilter(preset.artwork, 'system')(preset.sourceId)
  const ready = usePresetCatalogStore(state => state.status === 'ready')
  if (!ready) return 'Loading'
  return isSystem ? 'SYSTEM' : 'USER'
}

function PresetInfoPanel({ preset }: { preset: PresetManagerRecord }) {
  const owner = usePresetOwnerLabel(preset)
  const organization = usePresetOrganizationStore(state => state.records[preset.id]) ?? EMPTY_PRESET_ORGANIZATION
  const loadOrganization = usePresetOrganizationStore(state => state.load)
  const updateOrganization = usePresetOrganizationStore(state => state.update)
  const loadCollections = useMediaStore(state => state.loadCollections)

  useEffect(() => {
    void loadOrganization()
    void loadCollections()
  }, [loadCollections, loadOrganization])

  return (
    <div className="rv-workspace-panel pmv-info-panel" aria-label={`${preset.name} preset information`}>
      <div className="rv-workspace-panel-body">
        <div className="rv-inspector rv-inspector-scroll">
          <div className="rv-ctrl-group">
            <Collapsible label="Preset Info">
              <div className="pmv-info-grid">
                <InfoRow label="Name" value={preset.name} wide />
                <InfoRow label="Description" value={preset.description} wide />
                <InfoRow label="Engine" value={preset.engineName} />
                <InfoRow label="OWNER" value={owner} />
                <InfoRow label="Category" value={preset.category} />
                <InfoRow label="Has Camera" value={preset.hasCamera} />
                <InfoRow label="Can Integrate User Media" value={preset.canIntegrateUserMedia} />
                <InfoRow label="3D Environment" value={preset.is3dEnvironment} />
                <InfoRow label="Custom" value={preset.custom ?? false} />
              </div>
            </Collapsible>
            <TagsCollectionsGroup
              idPrefix="pmv-preset"
              tags={[...organization.tags]}
              onTagsChange={tags => { void updateOrganization(preset.id, { ...organization, tags }) }}
              collectionIds={[...organization.collectionIds]}
              onCollectionIdsChange={collectionIds => { void updateOrganization(preset.id, { ...organization, collectionIds }) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

const CAN_HOST_CINEMA2_STAGE = typeof window !== 'undefined' && 'WebGL2RenderingContext' in window

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...Array.from(new Set(PRESET_MANAGER_PRESETS.map(preset => preset.category)))
    .sort((left, right) => left.localeCompare(right))
    .map(category => ({ value: category.toLowerCase(), label: category })),
]

const LIVE_ARTWORK_PRESETS = new Map(
  DEFAULT_REACT_PRESETS
    .filter(preset => preset.engine === 'oscilloscope' || preset.engine === 'pixGrid')
    .map(preset => [preset.id, preset]),
)

function PresetArtwork({ preset, className }: { preset: PresetManagerRecord; className: string }) {
  const livePreset = preset.activation === 'react' ? LIVE_ARTWORK_PRESETS.get(preset.sourceId) : undefined
  return (
    <ReactPresetArtwork
      id={preset.sourceId}
      className={className}
      backdrop={livePreset ? <ReactPresetThumbnail preset={livePreset} /> : undefined}
    />
  )
}

function PresetCard({ preset, active, favorite, onSelect, onToggleFavorite }: { preset: PresetManagerRecord; active: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  const metadataId = useId()
  const capabilities = [
    { label: 'Camera', icon: 'camera', available: preset.hasCamera },
    { label: 'User Media', icon: 'image', available: preset.canIntegrateUserMedia },
    { label: '3D Environment', icon: 'shader', available: preset.is3dEnvironment },
  ] as const

  return (
    <article className={`pmv-card${active ? ' is-active' : ''}`} data-preset-id={preset.sourceId} data-preset-engine={preset.engineName}>
      <button className="pmv-card-main" type="button" onClick={onSelect} aria-label={`Select ${preset.name}`} aria-describedby={metadataId} aria-pressed={active}>
        <PresetArtwork preset={preset} className="pmv-thumbnail" />
        <span className="pmv-card-copy">
          <strong>{preset.name}</strong>
          <span className="pmv-card-meta" id={metadataId}>
            <span className="pmv-card-type">{preset.engineName}</span>
            <span className="pmv-card-capabilities">
              {capabilities.filter(capability => capability.available).map(({ label, icon }) => (
                <span key={label} className="pmv-capability-badge" role="img" aria-label={label} title={label}>
                  <AppIcon kind={icon} size={12} />
                </span>
              ))}
            </span>
          </span>
        </span>
      </button>
      <button className={`vz-media-star${favorite ? ' vz-media-star--active' : ''}`} type="button" onClick={onToggleFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`}>
        <AppIcon kind={favorite ? 'star' : 'starOff'} size={13} color="currentColor" />
      </button>
    </article>
  )
}

export function PresetManagerView() {
  const [tab, setTab] = useState<PresetManagerTab>('presets')
  const [stageTab, setStageTab] = useState<PresetManagerStageTab>('visualizer')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedId, setSelectedId] = useState(PRESET_MANAGER_PRESETS[0]?.id ?? '')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(PRESET_MANAGER_PRESETS[0] ? [PRESET_MANAGER_PRESETS[0].id] : []))
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [activeRightPanel, setActiveRightPanel] = useState<PresetManagerInspectorTab>('info')
  const [cinema2Runtime, setCinema2Runtime] = useState<Cinema2Runtime | null>(null)
  const [cinema2RuntimeSnapshot, setCinema2RuntimeSnapshot] = useState<Cinema2RuntimeSnapshot | null>(null)
  const [outputCanvas, setOutputCanvas] = useState<HTMLCanvasElement | null>(null)
  const recorder = useRecorder()

  const selectedPreset = useMemo(
    () => PRESET_MANAGER_PRESETS.find(preset => preset.id === selectedId) ?? PRESET_MANAGER_PRESETS[0] ?? null,
    [selectedId],
  )
  const {
    activeReactEngineId,
    activeReactPresetId,
    selectedCanvasPresetId,
    activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixAuthoringMode,
    laserDmxShowDirectorSourceTemplateId,
    laserDmxShowDirectorPerformancePresetId,
    headlinerPresetId,
    cinema2Workspace,
  } = useReactStore(useShallow(state => ({
    activeReactEngineId: state.activeReactEngineId,
    activeReactPresetId: state.activeReactPresetId,
    selectedCanvasPresetId: state.selectedCanvasPresetId,
    activeLaserDmxBeamMatrixPresetId: state.activeLaserDmxBeamMatrixPresetId,
    laserDmxBeamMatrixAuthoringMode: state.laserDmxBeamMatrixAuthoringMode,
    laserDmxShowDirectorSourceTemplateId: state.laserDmxShowDirector.sourceTemplateId,
    laserDmxShowDirectorPerformancePresetId: state.laserDmxShowDirectorPerformance.activePresetId,
    headlinerPresetId: state.headlinerSettings.presetId,
    cinema2Workspace: state.cinema2Workspace,
  })))

  const fallbackCinema2PresetId = useMemo(
    () => PRESET_MANAGER_PRESETS.find(preset => preset.activation === 'cinema2')?.sourceId as Cinema2PresetId | undefined,
    [],
  )
  const selectedCinema2PresetId = selectedPreset?.activation === 'cinema2'
    ? selectedPreset.sourceId as Cinema2PresetId
    : fallbackCinema2PresetId
  const selectedCinema2WorkspaceState = selectedCinema2PresetId
    ? getCinema2WorkspacePresetState(cinema2Workspace, selectedCinema2PresetId)
    : null
  const cinema2RestoreState = useCinema2WorkspaceRestoreState(
    selectedCinema2PresetId ?? ('' as Cinema2PresetId),
    selectedCinema2WorkspaceState,
    cinema2Workspace.activationRevision,
  )

  const visiblePresets = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return PRESET_MANAGER_PRESETS.filter(preset => {
      if (tab === 'favorites' && !favoriteIds.has(preset.id)) return false
      if (tab === 'custom' && !preset.custom) return false
      if (category !== 'all' && preset.category.toLowerCase() !== category) return false
      return !needle || [preset.name, preset.description, preset.engineName, preset.category, ...preset.tags].some(value => value.toLowerCase().includes(needle))
    })
  }, [category, favoriteIds, query, tab])

  const toggleFavorite = (id: string) => setFavoriteIds(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const activatePreset = useCallback((preset: PresetManagerRecord) => {
    const state = useReactStore.getState()
    switch (preset.activation) {
      case 'cinema2':
        state.selectReactEngine('cinema2')
        state.activateCinema2Workspace({ presetId: preset.sourceId as Cinema2PresetId })
        break
      case 'canvas':
        state.selectReactEngine('canvas')
        state.selectCanvasPreset(preset.sourceId as Parameters<typeof state.selectCanvasPreset>[0])
        break
      case 'laserDmxBeamMatrix':
        state.applyLaserDmxBeamMatrixPreset(preset.sourceId)
        break
      case 'laserDmxPerformance': {
        const definition = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(candidate => candidate.id === preset.sourceId)
        if (definition) state.applyLaserDmxShowDirectorPerformancePreset(definition)
        break
      }
      case 'laserDmxTemplate':
        state.selectReactEngine('laserDmx')
        state.applyLaserDmxShowDirectorTemplate(preset.sourceId)
        state.setLaserDmxBeamMatrixAuthoringMode('showDirector')
        break
      case 'headliner':
        state.selectReactEngine('headliner')
        state.setHeadlinerSettings({ presetId: preset.sourceId as HeadlinerPresetId })
        break
      default:
        state.selectReactPreset(preset.sourceId)
        break
    }
    setSelectedId(preset.id)
    setActiveRightPanel('info')
    setRightCollapsed(false)
  }, [])

  useEffect(() => {
    let sourceId: string | null = null
    let activation: PresetManagerRecord['activation'] | null = null
    if (activeReactEngineId === 'cinema2') {
      sourceId = cinema2Workspace.activePresetId
      activation = 'cinema2'
    } else if (activeReactEngineId === 'canvas') {
      sourceId = selectedCanvasPresetId
      activation = 'canvas'
    } else if (activeReactEngineId === 'headliner') {
      sourceId = headlinerPresetId
      activation = 'headliner'
    } else if (activeReactEngineId === 'laserDmx') {
      if (laserDmxBeamMatrixAuthoringMode === 'showDirector') {
        sourceId = laserDmxShowDirectorPerformancePresetId ?? laserDmxShowDirectorSourceTemplateId ?? null
        activation = laserDmxShowDirectorPerformancePresetId ? 'laserDmxPerformance' : 'laserDmxTemplate'
      } else {
        sourceId = activeLaserDmxBeamMatrixPresetId
        activation = 'laserDmxBeamMatrix'
      }
    } else {
      sourceId = activeReactPresetId
      activation = 'react'
    }
    if (!sourceId || !activation) return
    const matchingPreset = PRESET_MANAGER_PRESETS.find(preset => (
      preset.sourceId === sourceId && preset.activation === activation
    ))
    if (matchingPreset && matchingPreset.id !== selectedId) setSelectedId(matchingPreset.id)
  }, [
    activeLaserDmxBeamMatrixPresetId,
    activeReactEngineId,
    activeReactPresetId,
    cinema2Workspace.activePresetId,
    headlinerPresetId,
    laserDmxBeamMatrixAuthoringMode,
    laserDmxShowDirectorPerformancePresetId,
    laserDmxShowDirectorSourceTemplateId,
    selectedCanvasPresetId,
    selectedId,
  ])

  useEffect(() => {
    setCinema2Runtime(null)
    setCinema2RuntimeSnapshot(null)
    setOutputCanvas(null)
  }, [selectedId, stageTab])

  const renderInspectorPanel = () => {
    if (!selectedPreset) return null
    if (activeRightPanel === 'info') return <PresetInfoPanel preset={selectedPreset} />
    if (activeRightPanel === 'design') {
      if (selectedPreset.activation === 'cinema2') return <Cinema2InspectorPanel runtime={cinema2Runtime} surface="design" />
      if (selectedPreset.activation === 'headliner') return <HeadlinerDesignPanel />
      return <ReactDesignWorkspacePanel hasSelection={selectedPreset.artwork === 'soundDrawing'} />
    }
    if (activeRightPanel === 'react') {
      if (selectedPreset.activation === 'cinema2') return <Cinema2InspectorPanel runtime={cinema2Runtime} surface="react" />
      if (selectedPreset.activation === 'headliner') return <HeadlinerReactivityPanel />
      return <ReactReactivityWorkspacePanel />
    }
    return (
      <ReactOutputWorkspacePanel
        canvas={outputCanvas}
        outputCapability={CANVAS_OUTPUT_AVAILABLE}
        recorder={recorder}
        liveFps={0}
        hasActiveProgramAudio={false}
        onStartRecording={canvas => recorder.startVideoRecording(canvas, null)}
        cinema2Runtime={selectedPreset.activation === 'cinema2' ? cinema2Runtime : null}
        cinema2RuntimeSnapshot={selectedPreset.activation === 'cinema2' ? cinema2RuntimeSnapshot : null}
      />
    )
  }

  return (
    <main className="pmv-root" aria-label="Preset Manager">
      <ApplicationHeaderControls fallbackWhenUnavailable>
        <header className="pmv-header">
          {/* Create, Save, Duplicate and Delete are placeholders: presets have no create/save/duplicate/delete actions yet. */}
          <HeaderControlGroup label="Preset Manager controls">
            <HeaderIconKey
              label="Create preset"
              icon={<HeaderActionIcon action="create" />}
              onClick={NOOP}
            />
            <HeaderIconKey label="Save preset" icon={<SaveGlyph />} onClick={NOOP} />
            <HeaderIconKey label="Duplicate preset" icon={<HeaderActionIcon action="duplicate" />} onClick={NOOP} />
            <HeaderIconKey label="Delete preset" icon={<HeaderActionIcon action="delete" />} danger onClick={NOOP} />
          </HeaderControlGroup>
          <div className="pmv-summary">
            <VyzualzHeaderActions page="preset-manager" />
          </div>
        </header>
      </ApplicationHeaderControls>
      <section className="pmv-workspace" aria-label="Preset Manager workspace">
        <div
          className="vz-content pmv-content"
          data-left-collapsed={leftCollapsed ? 'true' : 'false'}
          data-right-collapsed={rightCollapsed ? 'true' : 'false'}
        >
          <WorkspaceRail
            side="left"
            label="Preset Library"
            collapsed={leftCollapsed}
            onToggleCollapsed={() => setLeftCollapsed(value => !value)}
            className="rw-frame--left fw-surface"
          >
            <RailWindowHeader
              side="left"
              icon={<AppIcon kind="layers" size={15} color="currentColor" aria-hidden="true" />}
              label="Preset Library"
            />
            <div className="vz-panel vz-media-browser vz-media-browser--manager pmv-browser">
              <UnderlineTabs
                tabs={PRESET_MANAGER_TABS}
                activeTab={tab}
                onChange={setTab}
                ariaLabel="Preset library views"
                className="pmv-tabs vz-filter-tabs dv-underline-tabs--equal"
              />
              <PresetSearchRow
                query={query}
                onQueryChange={setQuery}
                className="pmv-search"
                trailing={
                  <UnderlineDropdown
                    id="preset-manager-category"
                    value={category}
                    options={CATEGORY_OPTIONS}
                    onChange={value => setCategory(value)}
                    ariaLabel="Preset category"
                    menuLabel="Preset category"
                    title="Preset category"
                    size="dense"
                    menuWidth={180}
                    showDescriptions={false}
                    className="pmv-category"
                  />
                }
              />
              <div className="vz-media-scroll pmv-list" aria-live="polite">
                <div className="pmv-card-list">
                  {visiblePresets.map(preset => <PresetCard key={preset.id} preset={preset} active={preset.id === selectedId} favorite={favoriteIds.has(preset.id)} onSelect={() => activatePreset(preset)} onToggleFavorite={() => toggleFavorite(preset.id)} />)}
                  {visiblePresets.length === 0 && <div className="pmv-empty">No presets match this view.</div>}
                </div>
              </div>
            </div>
          </WorkspaceRail>
          <div className="pmv-stage fw-surface" aria-label="Preset Manager detail workspace">
            <UnderlineTabs
              tabs={PRESET_MANAGER_STAGE_TABS}
              activeTab={stageTab}
              onChange={setStageTab}
              ariaLabel="Preset Manager workspace views"
              className="pmv-stage-tabs"
            />
            {stageTab === 'store' ? (
              <LivePresetStore />
            ) : stageTab === 'downloads' ? (
              <section className="pms-downloads" aria-label="My Downloads">
                <h3>My Downloads</h3>
                <p>Packs and presets you download will appear here. Coming soon.</p>
              </section>
            ) : selectedPreset?.activation === 'cinema2' && selectedCinema2PresetId && CAN_HOST_CINEMA2_STAGE ? (
              <Cinema2Stage
                presetId={selectedCinema2PresetId}
                restoreState={cinema2RestoreState as Readonly<Cinema2WorkspacePresetState> | null}
                onCanvasReady={setOutputCanvas}
                onRuntimeReady={setCinema2Runtime}
                onRuntimeSnapshot={setCinema2RuntimeSnapshot}
                onRuntimeRetiring={state => useReactStore.getState().storeCinema2WorkspacePresetState(state)}
              />
            ) : selectedPreset ? (
              <section className="pmv-selection-summary" aria-label={`${selectedPreset.name} selection`}>
                <PresetArtwork preset={selectedPreset} className="pmv-selection-art" />
                <div>
                  <span>{selectedPreset.engineName}</span>
                  <h2>{selectedPreset.name}</h2>
                  <p>{selectedPreset.description}</p>
                </div>
              </section>
            ) : null}
          </div>
          <WorkspaceRail
            side="right"
            label="Preset Inspector"
            collapsed={rightCollapsed}
            onToggleCollapsed={() => setRightCollapsed(value => !value)}
            className="rw-frame--right pmv-inspector fw-surface"
          >
            <RailWindowHeader
              side="right"
              icon={<AppIcon kind="settings" size={15} color="currentColor" aria-hidden="true" />}
              label="Inspector"
            />
            <RailTabs
              tabs={PRESET_MANAGER_INSPECTOR_TABS}
              activeTab={activeRightPanel}
              onChange={setActiveRightPanel}
              ariaLabel="Preset Manager inspector panels"
              className="rv-main-workspace-tabs"
              variant="underline"
            />
            <div className="vz-panel-body pmv-inspector-body" data-selected-preset={selectedPreset?.sourceId ?? ''}>
              {renderInspectorPanel()}
            </div>
          </WorkspaceRail>
        </div>
      </section>
    </main>
  )
}

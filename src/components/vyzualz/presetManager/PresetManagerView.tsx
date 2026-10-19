import { useCallback, useEffect, useMemo, useState } from 'react'
import { Add01Icon, FavouriteIcon, Layers01Icon, Settings02Icon } from 'hugeicons-react'
import { useShallow } from 'zustand/react/shallow'
import { useRecorder } from '../../../hooks/useRecorder'
import { useReactStore } from '../../../stores/reactStore'
import { PageHeadingPlate, PresetHeadingIcon } from '../layout/PageHeadingPlate'
import { RailWindowHeader } from '../layout/RailWindowHeader'
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
import { Cinema2PresetsPanel } from '../react/Cinema2PresetsPanel'
import { Cinema2Stage } from '../react/Cinema2Stage'
import {
  HeadlinerDesignPanel,
  HeadlinerPresetsPanel,
  HeadlinerReactivityPanel,
} from '../react/headliner/HeadlinerWorkspace'
import type { HeadlinerPresetId } from '../react/headliner/HeadlinerEffectCatalog'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../react/LaserDmxShowDirectorPerformancePresets'
import { ReactPresetsPanel } from '../react/ReactPresetsPanel'
import {
  ReactDesignWorkspacePanel,
  ReactOutputWorkspacePanel,
  ReactReactivityWorkspacePanel,
} from '../react/panels/ReactWorkspacePanels'
import { CANVAS_OUTPUT_AVAILABLE } from '../react/canvasFracturesOutputContract'
import type { ReactRightPanel } from '../react/reactRightPanelPersistence'
import { useCinema2WorkspaceRestoreState } from '../react/useCinema2WorkspaceRestoreState'
import { Badge } from '../react/controls/Badge'
import { IconChipButton } from '../react/controls/IconChipButton'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { UnderlineDropdown } from '../react/controls/UnderlineDropdown'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import {
  PRESET_MANAGER_PRESETS,
  type PresetManagerArtwork,
  type PresetManagerRecord,
} from './presetManagerCatalog'
import '../../../styles/reactView.css'

type PresetManagerTab = 'presets' | 'favorites' | 'custom'

const PRESET_MANAGER_TABS = [
  { id: 'presets', label: 'Presets' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'custom', label: 'Custom' },
] as const

const PRESET_MANAGER_INSPECTOR_TABS: RailTabOption<ReactRightPanel>[] = [
  { id: 'presets', label: 'PRESETS' },
  { id: 'design', label: 'DESIGN' },
  { id: 'react', label: 'REACT' },
  { id: 'output', label: 'OUTPUT' },
]

const CAN_HOST_CINEMA2_STAGE = typeof window !== 'undefined' && 'WebGL2RenderingContext' in window

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...Array.from(new Set(PRESET_MANAGER_PRESETS.map(preset => preset.category)))
    .sort((left, right) => left.localeCompare(right))
    .map(category => ({ value: category.toLowerCase(), label: category })),
]

function PresetArtwork({ kind }: { kind: PresetManagerArtwork }) {
  if (kind === 'cinema2') return (
    <svg className="pmv-art" viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="pm-main-bg"><stop stopColor="#153b69" /><stop offset="1" stopColor="#02060d" /></radialGradient><filter id="pm-main-glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <rect width="120" height="120" fill="url(#pm-main-bg)" /><g fill="none" stroke="#49dfff" filter="url(#pm-main-glow)"><path d="M60 15 103 96H17Z" strokeWidth="5" /><path d="M60 34 84 81H36Z" strokeWidth="2" /><path d="m60 48 12 23H48Z" /></g><path d="M0 105 34 76M120 105 86 76M12 120l40-39M108 120 68 81" stroke="#4968d9" opacity=".7" />
    </svg>
  )
  if (kind === 'soundDrawing' || kind === 'headliner') return (
    <svg className="pmv-art" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="pm-con-bg"><stop stopColor="#20346e" /><stop offset="1" stopColor="#02040c" /><filter id="x" /></radialGradient></defs><rect width="120" height="120" fill="url(#pm-con-bg)" /><g fill="none" strokeLinecap="round"><path d="M-8 84C22 22 51 23 73 57s36 28 57-12" stroke="#e9f4ff" strokeWidth="10" opacity=".8" /><path d="M-5 91C30 28 56 35 74 62s33 27 54-5" stroke="#55c7ff" strokeWidth="5" /><path d="M4 104C32 57 59 51 77 72s30 20 45 2" stroke="#8057ff" strokeWidth="4" /><path d="M12 22c34 16 42 38 48 69" stroke="#50efff" strokeWidth="3" /></g></svg>
  )
  if (kind === 'canvas') return (
    <svg className="pmv-art" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" fill="#02050a" /><g transform="translate(60 60)" fill="none" strokeLinecap="round">{Array.from({ length: 18 }, (_, index) => <path key={index} d={`M0 0 Q${20 + index % 3 * 8} ${-10 + index % 5 * 5} ${54 + index % 2 * 8} 0`} transform={`rotate(${index * 20})`} stroke={index % 3 === 0 ? '#d9f8ff' : index % 3 === 1 ? '#4aa6d5' : '#314d72'} strokeWidth={index % 4 === 0 ? 3 : 1.5} opacity=".9" />)}<circle r="9" fill="#07111c" stroke="#92efff" /></g></svg>
  )
  if (kind === 'pixGrid') return (
    <svg className="pmv-art" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="pm-night" x2="0" y2="1"><stop stopColor="#05041d" /><stop offset=".56" stopColor="#4b246b" /><stop offset=".72" stopColor="#b45ac5" /><stop offset="1" stopColor="#06111b" /></linearGradient><radialGradient id="pm-ring"><stop offset=".65" stopColor="#0a0820" /><stop offset=".72" stopColor="#f4b3ff" /><stop offset=".79" stopColor="#9c55ff" /><stop offset=".88" stopColor="#0a0820" stopOpacity="0" /></radialGradient></defs><rect width="120" height="120" fill="url(#pm-night)" /><circle cx="61" cy="52" r="32" fill="url(#pm-ring)" /><path d="M0 91Q17 80 33 89t29 0q17-12 32 0t26 0v31H0Z" fill="#020914" /><path d="M0 99q27-8 54 0t66-2M0 108q30-7 57 0t63-2" fill="none" stroke="#9855df" opacity=".65" /></svg>
  )
  return (
    <svg className="pmv-art" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="pm-storm" x2="0" y2="1"><stop stopColor="#0b2750" /><stop offset=".5" stopColor="#26558a" /><stop offset="1" stopColor="#020713" /></linearGradient><filter id="pm-bolt"><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><rect width="120" height="120" fill="url(#pm-storm)" /><g fill="#7da9d1" opacity=".48"><ellipse cx="28" cy="32" rx="35" ry="18" /><ellipse cx="87" cy="28" rx="42" ry="20" /></g><path d="m75 5-20 43 15-4-22 62 39-72-18 5Z" fill="#e9fbff" stroke="#66cfff" filter="url(#pm-bolt)" /><path d="M0 96 24 78l18 11 22-16 19 15 19-10 18 19v23H0Z" fill="#01050c" /><path d="M0 104q31-7 59 0t61-1" stroke="#5acaff" fill="none" opacity=".7" /></svg>
  )
}

function PresetCard({ preset, active, favorite, onSelect, onToggleFavorite }: { preset: PresetManagerRecord; active: boolean; favorite: boolean; onSelect: () => void; onToggleFavorite: () => void }) {
  return (
    <article className={`pmv-card${active ? ' is-active' : ''}`} data-preset-id={preset.sourceId} data-preset-engine={preset.engineName}>
      <button className="pmv-card-main" type="button" onClick={onSelect} aria-label={`Select ${preset.name}`}>
        <span className="pmv-thumbnail"><PresetArtwork kind={preset.artwork} /></span>
        <span className="pmv-card-copy">
          <strong>{preset.name}</strong>
          <span className="pmv-card-type">{preset.engineName}</span>
          <span className="pmv-tags">{preset.tags.slice(0, 3).map(tag => <Badge key={tag} label={tag} tone="#4ac7db" />)}</span>
        </span>
      </button>
      <button className={`vz-media-star${favorite ? ' vz-media-star--active' : ''}`} type="button" onClick={onToggleFavorite} aria-label={`${favorite ? 'Remove' : 'Add'} ${preset.name} ${favorite ? 'from' : 'to'} favorites`}>
        <FavouriteIcon size={12} color="currentColor" />
      </button>
    </article>
  )
}

export function PresetManagerView() {
  const [tab, setTab] = useState<PresetManagerTab>('presets')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedId, setSelectedId] = useState(PRESET_MANAGER_PRESETS[0]?.id ?? '')
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set(PRESET_MANAGER_PRESETS[0] ? [PRESET_MANAGER_PRESETS[0].id] : []))
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [activeRightPanel, setActiveRightPanel] = useState<ReactRightPanel>('design')
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
    setActiveRightPanel('design')
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
  }, [selectedId])

  const renderPresetBrowser = () => {
    if (!selectedPreset) return null
    if (selectedPreset.activation === 'cinema2') {
      return (
        <Cinema2PresetsPanel
          activePresetId={selectedPreset.sourceId as Cinema2PresetId}
          onSelectPreset={presetId => {
            const next = PRESET_MANAGER_PRESETS.find(preset => preset.activation === 'cinema2' && preset.sourceId === presetId)
            if (next) activatePreset(next)
          }}
        />
      )
    }
    if (selectedPreset.activation === 'headliner') return <HeadlinerPresetsPanel />
    return <ReactPresetsPanel />
  }

  const renderInspectorPanel = () => {
    if (!selectedPreset) return null
    if (activeRightPanel === 'presets') return renderPresetBrowser()
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
    <main className="pmv-root" aria-labelledby="preset-manager-title">
      <header className="pmv-header">
        <div className="pmv-header-left">
          <PageHeadingPlate titleAs="h1" titleId="preset-manager-title" title="Preset Manager" icon={<PresetHeadingIcon />} />
        </div>
      </header>
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
            className="rw-frame--left"
          >
            <RailWindowHeader
              side="left"
              icon={<Layers01Icon size={15} color="currentColor" aria-hidden="true" />}
              label="Preset Library"
              actions={
                <IconChipButton
                  tone="primary"
                  icon={<Add01Icon size={14} color="currentColor" />}
                  aria-label="Create preset"
                  title="Create preset"
                />
              }
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
          <div className="pmv-stage" aria-label="Preset Manager detail workspace">
            {selectedPreset?.activation === 'cinema2' && selectedCinema2PresetId && CAN_HOST_CINEMA2_STAGE ? (
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
                <span className="pmv-selection-art"><PresetArtwork kind={selectedPreset.artwork} /></span>
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
            className="rw-frame--right pmv-inspector"
          >
            <RailWindowHeader
              side="right"
              icon={<Settings02Icon size={15} color="currentColor" aria-hidden="true" />}
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

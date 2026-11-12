import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AppIcon } from '../../shared/icons/AppIcon'
import { useReactStore } from '../../../stores/reactStore'
import { ApplicationHeaderControls } from '../layout/ApplicationWorkspaceFrame'
import { HeaderControlGroup } from '../layout/HeaderControlGroup'
import { WorkspaceRail } from '../layout/WorkspaceRail'
import { RailWindowHeader } from '../layout/RailWindowHeader'
import { RailTabs } from '../layout/RailTabs'
import { VyzualzHeaderActions } from '../shared/VyzualzHeaderActions'
import { VyzualzAudioDock } from '../shared/VyzualzAudioDock'
import { ReactPerformancePads } from '../react/ReactPerformancePads'
import { ReactPresetCard } from '../react/ReactPresetCard'
import { ReactEngineCardContents } from '../react/ReactEngineBrowser'
import { REACT_ENGINE_CATALOG, REACT_ENGINE_IDS, isSelectableReactEngineId, type ReactLiveEngineId } from '../react/reactEngineCatalog'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { PanelSubtabs } from '../react/PanelSubtabs'
import { PRESET_MANAGER_PRESETS } from '../presetManager/presetManagerCatalog'
import { XY_SCOPE_PRESETS } from '../react/xyScope/XyScopeSettings'
import { usePresetScopeFilter } from '../../../features/presetCatalog/presetCatalogStore'
import { presetMatchesDiscoveryQuery } from '../react/presetDiscovery'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'
import { filterReactPresetLibrary } from '../react/reactPresetLibraryState'
import '../../../styles/reactView.css'
import '../../../styles/performanceManager.css'

const ARTWORK_ENGINE = { cinema2: 'cinema2', soundDrawing: 'oscilloscope', canvas: 'canvas', laserDmx: 'laserDmx', pixGrid: 'pixGrid', headliner: 'headliner' } as const

/** Phase 1 is a browse-only workspace: engine/preset choices never apply live presets or assign pads. */
export function PerformanceManagerView() {
  const activeEngine = useReactStore(state => state.activeReactEngineId)
  const [engine, setEngine] = useState<ReactLiveEngineId>(() => isSelectableReactEngineId(activeEngine) ? activeEngine : 'cinema2')
  const [leftTab, setLeftTab] = useState('engine')
  const [rightTab, setRightTab] = useState('presets')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'system' | 'user'>('system')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const inScope = usePresetScopeFilter(engine, scope)
  const { livePresets, laserMode } = useReactStore(useShallow(state => ({ livePresets: state.reactPresets, laserMode: state.laserDmxBeamMatrixAuthoringMode })))
  const presets = (() => {
    if (engine === 'cinema2') return cinema2NativePresetRegistry.list().filter(p => !p.metadata.tags?.includes('internal')).map(p => ({ id: p.id, name: p.metadata.name, description: p.metadata.description ?? p.metadata.name, tags: p.metadata.tags ?? [] }))
    if (engine === 'xyScope') return XY_SCOPE_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description, tags: [] as readonly string[] }))
    if (engine === 'oscilloscope' || engine === 'pixGrid') return filterReactPresetLibrary(livePresets, engine, 'current', new Set()).map(p => ({ id: p.id, name: p.name, description: p.description, tags: p.tags ?? [] }))
    return PRESET_MANAGER_PRESETS.filter(p => ARTWORK_ENGINE[p.artwork] === engine && (engine !== 'laserDmx' || (laserMode === 'showDirector' ? p.activation !== 'laserDmxBeamMatrix' : p.activation === 'laserDmxBeamMatrix'))).map(p => ({ id: p.sourceId, name: p.name, description: p.description, tags: p.tags }))
  })()
  const visible = presets.filter(p => inScope(p.id) && presetMatchesDiscoveryQuery(query.trim().toLowerCase(), p))
  const pickEngine = (id: ReactLiveEngineId) => { setEngine(id); setQuery(''); setSelectedPreset(null) }
  return <div className="rv-shell rv-shell--floating pfm-root">
    <ApplicationHeaderControls><div className="vz-header"><HeaderControlGroup label="Performance Manager controls">{null}</HeaderControlGroup><VyzualzHeaderActions page="performance-manager" /></div></ApplicationHeaderControls>
    <div className="rv-layout" data-left-collapsed={leftCollapsed || undefined} data-right-collapsed={rightCollapsed || undefined}>
      <WorkspaceRail side="left" label="Performance Manager engines" collapsed={leftCollapsed} onToggleCollapsed={() => setLeftCollapsed(v => !v)} className="rw-frame--left">
        <RailWindowHeader side="left" label="Performance Workspace" icon={<AppIcon kind="grid" size={15} />} />
        <RailTabs variant="underline" className="rv-main-workspace-tabs" ariaLabel="Performance Manager library tabs" activeTab={leftTab} onChange={setLeftTab} tabs={[{ id: 'engine', label: 'ENGINE' }, { id: 'placeholder-1', label: '—', disabled: true }, { id: 'placeholder-2', label: '—', disabled: true }]} />
        <div className="vz-panel-body">
          {leftTab === 'engine' && <div className="pfm-engine-grid" role="group" aria-label="Engines">
            {REACT_ENGINE_IDS.map(id => <button type="button" key={id} className="rv-engine-card rv-engine-card--compact pfm-engine-card" data-engine={id} aria-label={REACT_ENGINE_CATALOG[id].label} title={REACT_ENGINE_CATALOG[id].description} aria-pressed={engine === id} onClick={() => pickEngine(id)}><ReactEngineCardContents engineId={id} pixelLabel={id === 'pixGrid'} /></button>)}
          </div>}
        </div>
      </WorkspaceRail>
      <div className="pfm-center">
        <section className="pfm-window pfm-pad-window" aria-label="Current performance pads">
          <RailWindowHeader side="left" label="Performance Pads" icon={<AppIcon kind="grid" size={15} />} />
          <div className="pfm-pad-body"><ReactPerformancePads embedded mirror /></div>
        </section>
        <section className="pfm-window pfm-configuration" aria-label="Configuration">
          <RailWindowHeader side="left" label="Configuration" icon={<AppIcon kind="sliders" size={15} />} />
          <div className="pfm-configuration-canvas" />
        </section>
      </div>
      <WorkspaceRail side="right" label="Performance Manager inspector" collapsed={rightCollapsed} onToggleCollapsed={() => setRightCollapsed(v => !v)} className="rw-frame--right">
        <RailWindowHeader side="right" label="Inspector" icon={<AppIcon kind="sliders" size={15} />} />
        <RailTabs variant="underline" className="rv-main-workspace-tabs" ariaLabel="Performance Manager inspector tabs" activeTab={rightTab} onChange={setRightTab} tabs={[{ id: 'presets', label: 'PRESETS' }, { id: 'edit', label: 'EDIT' }, { id: 'placeholder', label: '—', disabled: true }]} />
        <div className="vz-panel-body">
          {rightTab === 'presets' && <section className="rv-engine-panel-list rv-engine-panel-list--rail-presets" aria-label={`${REACT_ENGINE_CATALOG[engine].label} presets`} data-preset-scope={scope}>
            <PanelSubtabs value={scope} onChange={setScope} ariaLabel="Preset scope" options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]} />
            <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel={`Search ${REACT_ENGINE_CATALOG[engine].label} presets`} />
            <div className="rv-preset-scroll"><div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
              {visible.map(p => <ReactPresetCard key={p.id} id={p.id} title={p.name} description={p.description} isActive={p.id === selectedPreset} activateLabel={`Select ${p.name}`} onActivate={() => setSelectedPreset(p.id)} />)}
              {!visible.length && <div className="rv-preset-library-empty" role="status">{query ? 'No presets match your search.' : scope === 'user' ? 'No user presets yet.' : 'No presets available.'}</div>}
            </div></div>
          </section>}
        </div>
      </WorkspaceRail>
    </div>
    <VyzualzAudioDock expandable waveformAppearance="deck" showAudioSourceControl activityPage="performance-manager" />
  </div>
}

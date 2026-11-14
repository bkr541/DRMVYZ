import { useState } from 'react'
import { getPerformanceManagerPresets } from './performanceManagerPresets'
import { usePerformancePadActions } from './usePerformancePadActions'
import { PerformancePadEditor } from './PerformancePadEditor'
import { NoticeCard } from '../react/controls/NoticeCard'
import { PERFORMANCE_PRESET_MIME, usePerformanceManagerPads } from './usePerformanceManagerPads'
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
import { usePresetScopeFilter } from '../../../features/presetCatalog/presetCatalogStore'
import { presetMatchesDiscoveryQuery } from '../react/presetDiscovery'
import '../../../styles/reactView.css'
import '../../../styles/performanceManager.css'

/** Browse and edit shared pad assignments without activating a live engine. */
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
  const presets = getPerformanceManagerPresets(engine, livePresets, laserMode)
  const visible = presets.filter(p => inScope(p.id) && presetMatchesDiscoveryQuery(query.trim().toLowerCase(), p))
  const padTools = usePerformanceManagerPads(engine, presets, selectedPreset)
  const padActions = usePerformancePadActions({ selectPad: padTools.editor.onSelect, showTab: tab => { setRightTab(tab); setRightCollapsed(false) } })
  const pickEngine = (id: ReactLiveEngineId) => { setEngine(id); setQuery(''); setSelectedPreset(null) }
  return <div className="rv-shell rv-shell--floating pfm-root">
    <ApplicationHeaderControls><div className="vz-header"><HeaderControlGroup label="Performance Manager controls">{padTools.toolbar}</HeaderControlGroup><VyzualzHeaderActions page="performance-manager" /></div></ApplicationHeaderControls>
    <div className="rv-layout" data-left-collapsed={leftCollapsed || undefined} data-right-collapsed={rightCollapsed || undefined}>
      <WorkspaceRail side="left" label="Performance Manager engines" collapsed={leftCollapsed} onToggleCollapsed={() => setLeftCollapsed(v => !v)} className="rw-frame--left">
        <RailWindowHeader side="left" label="Performance Workspace" icon={<AppIcon kind="grid" size={15} />} />
        <div className="rv-workspace-tabs-wrap">
          <RailTabs variant="underline" className="rv-context-workspace-tabs" ariaLabel="Performance Manager library tabs" activeTab={leftTab} onChange={setLeftTab} tabs={[{ id: 'engine', label: 'ENGINE' }, { id: 'placeholder-1', label: '—', disabled: true }, { id: 'placeholder-2', label: '—', disabled: true }]} />
        </div>
        <div className="vz-panel-body">
          {leftTab === 'engine' && <div className="pfm-engine-grid" role="group" aria-label="Engines">
            {REACT_ENGINE_IDS.map(id => <button type="button" key={id} className="rv-engine-card rv-engine-card--compact pfm-engine-card" data-engine={id} aria-label={REACT_ENGINE_CATALOG[id].label} title={REACT_ENGINE_CATALOG[id].description} aria-pressed={engine === id} onClick={() => pickEngine(id)}><ReactEngineCardContents engineId={id} pixelLabel={id === 'pixGrid'} /></button>)}
          </div>}
        </div>
      </WorkspaceRail>
      <div className="pfm-center">
        <section className="pfm-window pfm-pad-window" aria-label="Current performance pads">
          <RailWindowHeader side="left" label="Performance Pads" icon={<AppIcon kind="grid" size={15} />} />
          <div className="pfm-pad-body" onContextMenu={padActions.onContextMenu} onDragOver={padTools.onDragOver} onDrop={padTools.onDrop}><ReactPerformancePads embedded mirror presentation="expanded" editor={padTools.editor} /></div>
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
            {padActions.linkPad && <NoticeCard tone="info" title={`Link pad ${padActions.linkPad.keyBinding.toUpperCase()}`}>Choose a preset below. Clicking elsewhere will ask to cancel the link.</NoticeCard>}
            <div className="rv-preset-scroll"><div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
              {visible.map(p => <div key={p.id} draggable data-performance-preset={p.id} onDragStart={event => { event.dataTransfer.effectAllowed = 'link'; event.dataTransfer.setData(PERFORMANCE_PRESET_MIME, JSON.stringify({ engineId: engine, presetId: p.id })) }}><ReactPresetCard id={p.id} title={p.name} description={p.description} isActive={p.id === selectedPreset} activateLabel={`Select ${p.name}`} onActivate={() => { setSelectedPreset(p.id); padActions.selectPreset(p) }} /></div>)}
              {!visible.length && <div className="rv-preset-library-empty" role="status">{query ? 'No presets match your search.' : scope === 'user' ? 'No user presets yet.' : 'No presets available.'}</div>}
            </div></div>
          </section>}
          {rightTab === 'edit' && <PerformancePadEditor padId={padTools.editor.selectedPadId} />}
        </div>
      </WorkspaceRail>
    </div>
    {padTools.dialog}
    {padActions.popover}
    {padActions.cancelDialog}
    <VyzualzAudioDock expandable waveformAppearance="deck" showAudioSourceControl activityPage="performance-manager" />
  </div>
}

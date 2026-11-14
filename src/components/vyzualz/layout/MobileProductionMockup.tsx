import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, type AppIconKind } from '../../shared/icons/AppIcon'
import { RailWindowHeader } from './RailWindowHeader'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { PanelSubtabs } from '../react/PanelSubtabs'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { ReactPresetCard, ReactPresetArtwork } from '../react/ReactPresetCard'
import { PerformancePad } from '../react/controls/PerformancePad'
import { DEFAULT_PERFORMANCE_PADS } from '../react/ReactTypes'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { SliderRow, ToggleRow } from '../react/ReactControlRows'
import { NotificationBellIcon, NotificationDrawer, type NotificationCard } from '../shared/NotificationDrawer'
import { MobileVisualizerInspector } from './MobileVisualizerInspector'
import { ReactEngineBrowser } from '../react/ReactEngineBrowser'
import { REACT_ENGINE_CATALOG } from '../react/reactEngineCatalog'
import type { ReactEngineId } from '../react/ReactTypes'
import { DEFAULT_REACT_PRESETS } from '../react/ReactTypes'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'

/** The production mobile app's signed-in pages. Each shows its own header and the shared bottom navigation. */
export const MOBILE_PRODUCTION_PAGES = [
  { id: 'Performance', label: 'Perform', icon: 'navPreset' },
  { id: 'Remote', label: 'Remote', icon: 'cast' },
  { id: 'Pads', label: 'Pads', icon: 'navPerformance' },
  { id: 'Visualizer', label: 'Visualizer', icon: 'waveform' },
] as const satisfies readonly { id: string; label: string; icon: AppIconKind }[]
export type MobileProductionPage = typeof MOBILE_PRODUCTION_PAGES[number]['id']

interface MobilePreset { id: string; title: string; description: string }
const CINEMA2_PRESETS: MobilePreset[] = cinema2NativePresetRegistry.list()
  .filter(preset => !preset.metadata.tags?.includes('internal'))
  .map(preset => ({ id: preset.id, title: preset.metadata.name, description: preset.metadata.description ?? preset.metadata.name }))

/** The presets each engine owns. Engines whose presets are not part of the shipped catalog (CANVAS recipes, XY, HEADLINER) list none. */
export function mobilePresetsForEngine(engineId: ReactEngineId): MobilePreset[] {
  if (engineId === 'cinema2') return CINEMA2_PRESETS
  return DEFAULT_REACT_PRESETS.filter(preset => preset.engine === engineId)
    .map(preset => ({ id: preset.id, title: preset.name, description: preset.description ?? preset.name }))
}

/** A 3 × 4 grid: twelve pads a bank, so the 20 pads are Pads 1 (1–12) and Pads 2 (13–20). */
const PADS_PER_BANK = 12
const PAD_COLORS = ['#5993e8', '#df706d', '#64b98b', '#d9a35e', '#a855f7', '#eab308', '#14b8a6', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16', '#f59e0b', '#0ea5e9', '#6366f1', '#10b981', '#f43f5e', '#d946ef', '#2dd4bf', '#fb7185', '#38bdf8']

/** The page header's Notifications bell: the production bell's markup and classes, driven by local state instead of the notification store. */
function MobileNotificationsBell({ count, open, onOpen }: { count: number; open: boolean; onOpen: () => void }) {
  const label = count === 0 ? 'Notifications' : `Notifications (${count})`
  return <button type="button" className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--square vz-header-notifications" aria-haspopup="dialog"
    aria-expanded={open} aria-label={label} title={label} onClick={onOpen}><NotificationBellIcon /></button>
}

/** Store-free mockup of the production mobile pages: real components and real production CSS, no audio or render runtime. */
export function MobileProductionMockup({ page, onPageChange }: { page: MobileProductionPage; onPageChange: (page: MobileProductionPage) => void }) {
  const [engineId, setEngineId] = useState<ReactEngineId>('cinema2')
  const [selected, setSelected] = useState<Partial<Record<ReactEngineId, string>>>({})
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('system')
  const [performTab, setPerformTab] = useState<'Presets' | 'Controls'>('Presets')
  const [pad, setPad] = useState<string | null>(null)
  const [visualizerTab, setVisualizerTab] = useState<'Design' | 'React'>('Design')
  const [padBank, setPadBank] = useState<'Pads 1' | 'Pads 2'>('Pads 1')
  const [controls, setControls] = useState({ intensity: .75, motion: .4, scale: .6, colorShift: .25, bpmSync: true, autoPerformance: false })
  const presets = mobilePresetsForEngine(engineId)
  const preset = presets.find(item => item.id === selected[engineId]) ?? presets[0] ?? null
  // The inspector is Cinema 2.0's: the selected Cinema 2.0 preset, whichever engine the Perform page is showing.
  const cinema2PresetId = selected.cinema2 ?? CINEMA2_PRESETS[0].id
  const visiblePresets = presets.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
  const current = MOBILE_PRODUCTION_PAGES.find(item => item.id === page)!
  const rootRef = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState<HTMLElement | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  useEffect(() => { setScreen(rootRef.current?.closest<HTMLElement>('.mobile-preview-content') ?? null) }, [])
  // The drawer belongs to the page it was opened on.
  useEffect(() => { setNotificationsOpen(false) }, [page])

  // Notices live in the Notifications drawer, never in the page body.
  const noticesByPage: Record<MobileProductionPage, NotificationCard[]> = {
    Performance: performTab !== 'Presets' ? [] : scope === 'user'
      ? [{ id: 'no-user-presets', tone: 'info', title: 'No user presets', body: 'Save a preset to build your personal library.' }]
      : visiblePresets.length > 0 ? []
      : [{ id: 'no-presets', tone: 'info', title: presets.length ? 'No matching presets' : 'No presets', body: presets.length ? 'Try another search.' : `${REACT_ENGINE_CATALOG[engineId].label} has no presets to choose from.` }],
    Remote: [{ id: 'remote', tone: 'info', title: 'Remote', body: "Control your desktop's visuals from this phone. Remote controls will appear here." }],
    Pads: [],
    Visualizer: [{ id: 'visualizer', tone: 'info', title: preset?.title ?? REACT_ENGINE_CATALOG[engineId].label, body: 'Live visualizer output appears here.' }],
  }
  const notices = noticesByPage[page]

  return <div className="mpm mpm--production" ref={rootRef} aria-label={`Mobile ${page} page`} data-mobile-page={page} data-workspace-layout="floating">
    <section className="mpm-window fw-surface mpm-page-window" aria-label={`${page} header`}>
      <RailWindowHeader side="left" label={current.label} icon={null}
        actions={<MobileNotificationsBell count={notices.length} open={notificationsOpen} onOpen={() => setNotificationsOpen(true)} />} />
    </section>
    <div className="mpm-body" key={page} data-mobile-page={page}>
      {page === 'Performance' && <div className="mpm-panel-content mpm-perform">
        <ReactEngineBrowser engineId={engineId} presetName={preset?.title ?? null} boundarySelector=".mobile-preview-screen"
          onEngineChange={next => { setEngineId(next); setQuery('') }} />
        <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Presets', label: 'Presets' }, { id: 'Controls', label: 'Controls' }]}
          activeTab={performTab} onChange={id => setPerformTab(id as 'Presets' | 'Controls')} ariaLabel="Perform sections" />
        {performTab === 'Presets' && <>
          <PanelSubtabs value={scope} onChange={setScope} ariaLabel="Preset scope" options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]} />
          <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search presets" />
          <div className="mpm-scroll" data-mpm-scroll="presets">
            {scope !== 'user' && visiblePresets.length > 0 &&
              <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
                  {visiblePresets.map(item => <ReactPresetCard key={item.id} id={item.id} title={item.title} description={item.description} isActive={item.id === preset?.id}
                    activateLabel={`Select ${item.title}`} onActivate={() => setSelected(current => ({ ...current, [engineId]: item.id }))} />)}
                </div>}
          </div>
        </>}
        {performTab === 'Controls' && <div className="mpm-scroll mpm-controls" data-mpm-scroll="controls">
          <DualRailCollapsible label="Master Controls">
            <SliderRow label="Intensity" value={controls.intensity} onChange={intensity => setControls(c => ({ ...c, intensity }))} />
            <SliderRow label="Motion" value={controls.motion} onChange={motion => setControls(c => ({ ...c, motion }))} />
            <ToggleRow label="BPM Sync" value={controls.bpmSync} onChange={bpmSync => setControls(c => ({ ...c, bpmSync }))} />
            <ToggleRow label="Auto Performance" value={controls.autoPerformance} onChange={autoPerformance => setControls(c => ({ ...c, autoPerformance }))} />
          </DualRailCollapsible>
          <DualRailCollapsible label="Design"><DualRailCollapsible label="Geometry">
            <SliderRow label="Scale" value={controls.scale} onChange={scale => setControls(c => ({ ...c, scale }))} />
            <SliderRow label="Color shift" value={controls.colorShift} onChange={colorShift => setControls(c => ({ ...c, colorShift }))} />
          </DualRailCollapsible></DualRailCollapsible>
        </div>}
      </div>}
      {page === 'Remote' && <div className="mpm-panel-content" />}
      {page === 'Pads' && <div className="mpm-panel-content mpm-pads-page">
        <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Pads 1', label: 'Pads 1' }, { id: 'Pads 2', label: 'Pads 2' }]}
          activeTab={padBank} onChange={id => setPadBank(id as 'Pads 1' | 'Pads 2')} ariaLabel="Pad banks" />
        <div className="mpm-pads" role="group" aria-label={`Performance ${padBank}`}>
          {DEFAULT_PERFORMANCE_PADS.slice(padBank === 'Pads 1' ? 0 : PADS_PER_BANK, padBank === 'Pads 1' ? PADS_PER_BANK : undefined).map(item => <PerformancePad key={item.id} label={item.label} shortcut={item.keyBinding.toUpperCase()}
            color={PAD_COLORS[(Number(item.id.slice(4)) - 1) % PAD_COLORS.length]} density="expanded" disabled={!(item.presetId || item.destination)} selected={pad === item.id}
            onActivate={() => setPad(pad === item.id ? null : item.id)} />)}
        </div>
      </div>}
      {page === 'Visualizer' && <div className="mpm-panel-content mpm-visualizer">
        <div className="mpm-output-canvas" aria-label="Visualizer output">{preset && <ReactPresetArtwork id={preset.id} />}</div>
        <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Design', label: 'Design' }, { id: 'React', label: 'React' }]}
          activeTab={visualizerTab} onChange={id => setVisualizerTab(id as 'Design' | 'React')} ariaLabel="Visualizer sections" />
        <div className="mpm-scroll" data-mpm-scroll="visualizer">
          <MobileVisualizerInspector presetId={cinema2PresetId} surface={visualizerTab === 'Design' ? 'design' : 'react'} />
        </div>
      </div>}
    </div>
    <nav className="mpm-navigation" aria-label="Mobile navigation">
      <UnderlineTabs className="dv-underline-tabs--equal mpm-tabs" tabs={MOBILE_PRODUCTION_PAGES.map(item => ({ id: item.id, label: item.label, icon: <AppIcon kind={item.icon} size={26} /> }))}
        activeTab={page} onChange={id => onPageChange(id as MobileProductionPage)} ariaLabel="Mobile pages" />
    </nav>
    {notificationsOpen && screen && createPortal(<NotificationDrawer scope="container" cards={notices} portalTarget={screen} onClose={() => setNotificationsOpen(false)} />, screen)}
  </div>
}

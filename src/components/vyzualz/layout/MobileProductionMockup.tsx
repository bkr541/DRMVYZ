import { useState } from 'react'
import { AppIcon, type AppIconKind } from '../../shared/icons/AppIcon'
import { RailWindowHeader } from './RailWindowHeader'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { ReactPresetCard, ReactPresetArtwork } from '../react/ReactPresetCard'
import { PerformancePad } from '../react/controls/PerformancePad'
import { DEFAULT_PERFORMANCE_PADS } from '../react/ReactTypes'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { SliderRow, ToggleRow } from '../react/ReactControlRows'
import { NoticeCard } from '../react/controls/NoticeCard'
import { MOBILE_SAMPLE_PRESETS } from './MobilePerformanceMockup'

/** The production mobile app's signed-in pages. Each shows its own header and the shared bottom navigation. */
export const MOBILE_PRODUCTION_PAGES = [
  { id: 'Performance', label: 'Perform', icon: 'navPreset' },
  { id: 'Remote', label: 'Remote', icon: 'cast' },
  { id: 'Pads', label: 'Pads', icon: 'navPerformance' },
  { id: 'Visualizer', label: 'Visualizer', icon: 'waveform' },
] as const satisfies readonly { id: string; label: string; icon: AppIconKind }[]
export type MobileProductionPage = typeof MOBILE_PRODUCTION_PAGES[number]['id']

const PAD_COLORS = ['#5993e8', '#df706d', '#64b98b', '#d9a35e', '#a855f7', '#eab308', '#14b8a6', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16', '#f59e0b', '#0ea5e9', '#6366f1', '#10b981', '#f43f5e', '#d946ef', '#2dd4bf', '#fb7185', '#38bdf8']

/** Store-free mockup of the production mobile pages: real components and real production CSS, no audio or render runtime. */
export function MobileProductionMockup({ page, onPageChange }: { page: MobileProductionPage; onPageChange: (page: MobileProductionPage) => void }) {
  const [presetId, setPresetId] = useState(MOBILE_SAMPLE_PRESETS[0].id)
  const [query, setQuery] = useState('')
  const [performTab, setPerformTab] = useState<'Presets' | 'Controls'>('Presets')
  const [pad, setPad] = useState<string | null>(null)
  const [controls, setControls] = useState({ intensity: .75, motion: .4, scale: .6, colorShift: .25, bpmSync: true, autoPerformance: false })
  const preset = MOBILE_SAMPLE_PRESETS.find(item => item.id === presetId)!
  const current = MOBILE_PRODUCTION_PAGES.find(item => item.id === page)!

  return <div className="mpm mpm--production" aria-label={`Mobile ${page} page`} data-mobile-page={page} data-workspace-layout="floating">
    <section className="mpm-window fw-surface mpm-page-window" aria-label={`${page} header`}>
      <RailWindowHeader side="left" label={current.label} icon={null} />
    </section>
    <div className="mpm-body" key={page}>
      {page === 'Performance' && <div className="mpm-panel-content">
        <ReactPresetCard id={preset.id} title={preset.metadata.name} description={preset.metadata.description ?? preset.metadata.name} isActive activateLabel={`${preset.metadata.name} is active`} onActivate={() => setPerformTab('Controls')} />
        <UnderlineTabs className="dv-underline-tabs--equal" tabs={[{ id: 'Presets', label: 'Presets' }, { id: 'Controls', label: 'Controls' }]}
          activeTab={performTab} onChange={id => setPerformTab(id as 'Presets' | 'Controls')} ariaLabel="Perform sections" />
        {performTab === 'Presets' && <>
          <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search presets" />
          <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
            {MOBILE_SAMPLE_PRESETS.filter(item => item.metadata.name.toLowerCase().includes(query.toLowerCase())).map(item => <ReactPresetCard key={item.id} id={item.id} title={item.metadata.name}
              description={item.metadata.description ?? item.metadata.name} isActive={item.id === presetId} activateLabel={`Select ${item.metadata.name}`} onActivate={() => setPresetId(item.id)} />)}
          </div>
        </>}
        {performTab === 'Controls' && <div className="mpm-controls">
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
      {page === 'Remote' && <div className="mpm-panel-content">
        <NoticeCard title="Remote">Control your desktop's visuals from this phone. Remote controls will appear here.</NoticeCard>
      </div>}
      {page === 'Pads' && <div className="mpm-panel-content">
        <div className="mpm-pads" role="group" aria-label="Performance pads">
          {DEFAULT_PERFORMANCE_PADS.map(item => <PerformancePad key={item.id} label={item.label} shortcut={item.keyBinding.toUpperCase()}
            color={PAD_COLORS[(Number(item.id.slice(4)) - 1) % PAD_COLORS.length]} density="compact" disabled={!(item.presetId || item.destination)} selected={pad === item.id}
            onActivate={() => setPad(pad === item.id ? null : item.id)} />)}
        </div>
      </div>}
      {page === 'Visualizer' && <div className="mpm-panel-content">
        <div className="mpm-output-canvas" aria-label="Visualizer output"><ReactPresetArtwork id={preset.id} /></div>
        <NoticeCard title={preset.metadata.name}>Live visualizer output appears here.</NoticeCard>
      </div>}
    </div>
    <nav className="mpm-navigation" aria-label="Mobile navigation">
      <UnderlineTabs className="dv-underline-tabs--equal mpm-tabs" tabs={MOBILE_PRODUCTION_PAGES.map(item => ({ id: item.id, label: item.label, icon: <AppIcon kind={item.icon} size={26} /> }))}
        activeTab={page} onChange={id => onPageChange(id as MobileProductionPage)} ariaLabel="Mobile pages" />
    </nav>
  </div>
}

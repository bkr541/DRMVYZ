import { useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../shared/icons/AppIcon'
import { RailWindowHeader } from './RailWindowHeader'
import { UnderlineTabs } from '../react/controls/UnderlineTabs'
import { PanelSubtabs } from '../react/PanelSubtabs'
import { PresetSearchRow } from '../react/controls/PresetSearchRow'
import { ReactPresetCard, ReactPresetArtwork } from '../react/ReactPresetCard'
import { PerformancePad } from '../react/controls/PerformancePad'
import { DEFAULT_PERFORMANCE_PADS } from '../react/ReactTypes'
import { ReactEngineCardContents } from '../react/ReactEngineBrowser'
import { DualRailCollapsible } from '../react/DualRailCollapsible'
import { SliderRow, ToggleRow, SelectRow } from '../react/ReactControlRows'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'
import { cinema2NativePresetRegistry } from '../cinema2/presets/Cinema2PresetRegistry'

const PREFERRED = ['nightshift', 'glassfall', 'reactor', 'sixfold', 'threshold', 'afterhours', 'psylo', 'starters']
const catalog = cinema2NativePresetRegistry.list().filter(preset => !preset.metadata.tags?.includes('internal'))
export const MOBILE_SAMPLE_PRESETS = PREFERRED.map(name => catalog.find(preset => preset.id === `drmvyz.cinema2.${name}`)).filter((preset): preset is typeof catalog[number] => Boolean(preset))
const TABS: { id: string; label: string; icon: AppIconKind }[] = [
  { id: 'Presets', label: 'Presets', icon: 'navPreset' },
  { id: 'Pads', label: 'Pads', icon: 'navPerformance' },
  { id: 'Controls', label: 'Controls', icon: 'sliders' },
  { id: 'Cast', label: 'Cast', icon: 'cast' },
]
const COLORS = ['#5993e8', '#df706d', '#64b98b', '#d9a35e', '#a855f7', '#eab308', '#14b8a6', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16', '#f59e0b', '#0ea5e9', '#6366f1', '#10b981', '#f43f5e', '#d946ef', '#2dd4bf', '#fb7185', '#38bdf8']
const CONCEPTS = ['Classic controller', 'Scene deck', 'Live console', 'Session dashboard']

function MobileWindow({ title, icon, children, actions }: { title: string; icon: AppIconKind; children: ReactNode; actions?: ReactNode }) {
  return <section className="mpm-window fw-surface" aria-label={title}>
    <RailWindowHeader side="left" label={title} icon={<AppIcon kind={icon} size={15} />} actions={actions} />
    {children}
  </section>
}

/** Store-free interactions: actual production presentation, no audio/cast runtime. */
export function MobilePerformanceMockup({ variant = 1 }: { variant?: number }) {
  const [page, setPage] = useState(variant === 4 ? 'Home' : 'Presets')
  const [presetId, setPresetId] = useState(MOBILE_SAMPLE_PRESETS[0].id)
  const [pad, setPad] = useState<string | null>(null)
  const [output, setOutput] = useState('Stage display')
  const [casting, setCasting] = useState(false)
  const [scope, setScope] = useState('system')
  const [controlsQuality, setControlsQuality] = useState('1080p / 60 fps')
  const [favorites, setFavorites] = useState<Set<string>>(new Set([MOBILE_SAMPLE_PRESETS[0].id]))
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [controls, setControls] = useState({ intensity: .75, motion: .4, scale: .6, colorShift: .25, bpmSync: true, autoPerformance: false })
  const preset = MOBILE_SAMPLE_PRESETS.find(item => item.id === presetId)!
  const navigate = (next: string) => setPage(next)
  const scene = <ReactPresetCard id={preset.id} title={preset.metadata.name} description={preset.metadata.description ?? preset.metadata.name} isActive activateLabel={`Open ${preset.metadata.name} controls`} onActivate={() => navigate('Controls')} />
  const navigation = <nav className="mpm-navigation" aria-label="Mockup mobile navigation">
    <UnderlineTabs className="dv-underline-tabs--equal mpm-tabs" tabs={TABS.map(item => ({ ...item, icon: <AppIcon kind={item.icon} size={15} /> }))} activeTab={page} onChange={navigate} ariaLabel="Mobile workspaces" />
  </nav>
  const content = page === 'Home' ? <>
    <MobileWindow title="Current Preset" icon="cinema"><div className="mpm-panel-content">{scene}</div></MobileWindow>
    <MobileWindow title="Workspaces" icon="grid"><div className="mpm-panel-content mpm-hub">
      {TABS.map(item => <IconChipButton key={item.id} onClick={() => navigate(item.id)}><AppIcon kind={item.icon} size={18} /><span>{item.label}</span><AppIcon kind="chevronRight" size={12} /></IconChipButton>)}
    </div></MobileWindow>
  </> : <>
    {variant === 2 && page === 'Presets' && <MobileWindow title="Current Preset" icon="cinema"><div className="mpm-panel-content">{scene}</div></MobileWindow>}
    <MobileWindow title={page === 'Presets' ? 'Inspector' : page === 'Pads' ? 'Performance Pads' : page === 'Controls' ? 'Design' : 'Output'} icon={TABS.find(item => item.id === page)!.icon}
      actions={page === 'Presets' ? <IconChipButton aria-label="Show favorites" title="Show favorites" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><AppIcon kind="star" size={12} /></IconChipButton> : undefined}>
      {page === 'Presets' && <div className="mpm-panel-content">
        <PanelSubtabs value={scope} onChange={setScope} ariaLabel="Preset scope" options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]} />
        <PresetSearchRow query={query} onQueryChange={setQuery} ariaLabel="Search presets" />
        <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
          {scope === 'system' && MOBILE_SAMPLE_PRESETS.filter(item => item.metadata.name.toLowerCase().includes(query.toLowerCase()) && (!favoritesOnly || favorites.has(item.id))).map(item => <ReactPresetCard key={item.id} id={item.id} title={item.metadata.name} description={item.metadata.description ?? item.metadata.name}
            isActive={item.id === presetId} isFavorite={favorites.has(item.id)} activateLabel={`Select ${item.metadata.name}`} onActivate={() => setPresetId(item.id)}
            onToggleFavorite={() => setFavorites(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next })} />)}
        </div>
        {scope === 'user' && <NoticeCard title="No user presets">Save a preset to build your personal library.</NoticeCard>}
        {scope === 'system' && !MOBILE_SAMPLE_PRESETS.some(item => item.metadata.name.toLowerCase().includes(query.toLowerCase()) && (!favoritesOnly || favorites.has(item.id))) && <NoticeCard title="No matching presets">Try another search or turn off the favorites filter.</NoticeCard>}
      </div>}
      {page === 'Pads' && <div className="mpm-panel-content">
        <div className="mpm-pads" role="group" aria-label="Performance pads">
          {DEFAULT_PERFORMANCE_PADS.map(item => {
            const assigned = Boolean(item.presetId || item.destination)
            return <PerformancePad key={item.id} label={item.label} shortcut={item.keyBinding.toUpperCase()} color={COLORS[(Number(item.id.slice(4)) - 1) % COLORS.length]} density="compact" disabled={!assigned} selected={pad === item.id} onActivate={() => setPad(item.id)} aria-label={`${item.label}, pad ${item.keyBinding.toUpperCase()}`} />
          })}
        </div>
        <NoticeCard title={pad ? 'Pad selected' : 'Performance ready'}>{pad ? `${DEFAULT_PERFORMANCE_PADS.find(item => item.id === pad)!.label} · Preview` : 'Choose an assigned pad to preview its selected and press states.'}</NoticeCard>
        <IconChipButton onClick={() => setPad(null)}>Release pads</IconChipButton>
      </div>}
      {page === 'Controls' && <div className="mpm-panel-content mpm-controls">
        <DualRailCollapsible label="Master Controls">
          <SliderRow label="Intensity" value={controls.intensity} onChange={intensity => setControls(current => ({ ...current, intensity }))} />
          <SliderRow label="Motion" value={controls.motion} onChange={motion => setControls(current => ({ ...current, motion }))} />
          <ToggleRow label="BPM Sync" value={controls.bpmSync} onChange={bpmSync => setControls(current => ({ ...current, bpmSync }))} />
          <ToggleRow label="Auto Performance" value={controls.autoPerformance} onChange={autoPerformance => setControls(current => ({ ...current, autoPerformance }))} />
        </DualRailCollapsible>
        <DualRailCollapsible label="Design"><DualRailCollapsible label="Geometry">
          <SliderRow label="Scale" value={controls.scale} onChange={scale => setControls(current => ({ ...current, scale }))} />
          <SliderRow label="Color shift" value={controls.colorShift} onChange={colorShift => setControls(current => ({ ...current, colorShift }))} />
        </DualRailCollapsible></DualRailCollapsible>
        <IconChipButton onClick={() => navigate('Pads')}>Open performance pads<AppIcon kind="chevronRight" size={12} /></IconChipButton>
      </div>}
      {page === 'Cast' && <div className="mpm-panel-content">
        <div className="mpm-output-canvas" aria-label="Output preview"><ReactPresetArtwork id={preset.id} /></div>
        <DualRailCollapsible label="Available Displays" icon={<AppIcon kind="cast" size={15} />}>
          <div className="mpm-devices">{['Stage display', 'Studio projector'].map((name, index) => <IconChipButton key={name} aria-pressed={output === name} onClick={() => { setOutput(name); setCasting(false) }}>
            <AppIcon kind="cast" size={18} /><span><strong>{name}</strong><small>{index ? '1920 × 1080' : '3840 × 2160'}</small></span><span className="mpm-device-radio" aria-hidden="true" />
          </IconChipButton>)}</div>
        </DualRailCollapsible>
        <SelectRow label="Output quality" value={controlsQuality} onChange={setControlsQuality} menuBoundarySelector=".mobile-preview-screen" placement="below" options={['1080p / 60 fps', '720p / 30 fps', '4K / 30 fps'].map(value => ({ value, label: value }))} />
        <IconChipButton tone="primary" onClick={() => setCasting(!casting)}><AppIcon kind="cast" size={14} />{casting ? 'Stop casting' : 'Start casting'}</IconChipButton>
        <NoticeCard tone={casting ? 'success' : 'info'} title={casting ? 'Display connected' : 'Output ready'}>{casting ? `Preview connected to ${output}` : 'Choose an available display.'}</NoticeCard>
      </div>}
    </MobileWindow>
  </>

  return <div className={`mpm mpm--${variant}`} aria-label="Mobile performance layout mockup" data-concept={variant} data-workspace-layout="floating">
    <header className="mpm-page-header"><h1>{page}</h1></header>
    {variant === 2 && navigation}
    {variant === 1 && <button type="button" className="rv-engine-card mpm-engine-card" aria-label={`Cinema 2.0, ${preset.metadata.name}`} aria-pressed="true" onClick={() => navigate('Presets')}><ReactEngineCardContents engineId="cinema2" presetName={preset.metadata.name} /></button>}
    {variant === 3 && <div className="mpm-console-strip"><span>Cinema 2.0</span><span>128 BPM</span><span>{casting ? 'Connected' : 'Preview'}</span></div>}
    <div className="mpm-body" key={page} data-mobile-page={page}>{content}</div>
    {(variant === 1 || variant === 3) && navigation}
    {variant === 4 && <footer className="mpm-dashboard-footer"><span>{preset.metadata.name}</span><IconChipButton onClick={() => navigate(page === 'Home' ? 'Cast' : 'Home')}>{page === 'Home' ? 'Cast output' : 'Home'}</IconChipButton></footer>}
    <span className="mpm-concept-label">{CONCEPTS[variant - 1]}</span>
  </div>
}

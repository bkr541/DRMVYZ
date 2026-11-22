import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { RailTabs } from '../../layout/RailTabs'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { Collapsible, ColorRow, CtrlSection, NumberInputRow, PaletteColorRow, SelectRow, SliderRow, TextAreaRow, TextInputRow, ToggleRow } from '../ReactControlRows'
import { PanelSubtabs } from '../PanelSubtabs'
import { Badge } from '../controls/Badge'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconChipButton } from '../controls/IconChipButton'
import { IconMorphToggle } from '../controls/IconMorphToggle'
import { LayerRow } from '../controls/LayerRow'
import { LibrarySearchRow } from '../controls/LibrarySearchRow'
import { LibraryViewToggle, type LibraryView } from '../controls/LibraryViewToggle'
import { NoticeCard } from '../controls/NoticeCard'
import { NumericScrubField } from '../controls/NumericScrubField'
import { PerformancePad } from '../controls/PerformancePad'
import { StatusBadge } from '../controls/StatusBadge'
import { TagPill } from '../controls/TagPill'
import { UnderlineDropdown } from '../controls/UnderlineDropdown'
import { BRAND_FONT_LINK } from './brandKitModel'
import baseStyles from '../../../../styles.css?inline'
import vyzualzStyles from '../../../../styles/vyzualz.css?inline'
import appearanceStyles from '../../../../styles/appearance.css?inline'
import floatingStyles from '../../../../styles/floatingWorkspace.css?inline'
import tabRowStyles from '../../../../styles/tabRows.css?inline'
import groupSpacingStyles from '../../../../styles/groupSpacing.css?inline'
import typographyStyles from '../../../../styles/typography.css?inline'
import reactViewStyles from '../../../../styles/reactView.css?inline'
import canonicalStyles from '../controls/canonicalControls.css?inline'
import iconStyles from '../../../shared/icons/appIcon.css?inline'
import collapsibleStyles from '../DualRailCollapsible.css?inline'
import railHeaderStyles from '../../layout/RailWindowHeader.css?inline'
import headerGroupStyles from '../../layout/HeaderControlGroup.css?inline'
import searchRowStyles from '../controls/LibrarySearchRow.css?inline'
import viewToggleStyles from '../controls/LibraryViewToggle.css?inline'
import padStyles from '../controls/performancePad.css?inline'
import dropdownStyles from '../../../shared/Dropdown/Dropdown.css?inline'
import studyStyles from './uiPreviewStudies.css?inline'

/**
 * UI Preview: one window, built only from the application's reusable components, as the Inspector window sits in the React tab of the app. It is the
 * app's visual DNA on one page: the window title bar, the tab row and the nested tab row, parent groups and nested groups, and every control row and
 * reusable element the app uses. Nothing here is drawn for the study; the window is rendered in an iframe whose document carries the app's own stylesheets
 * (Layout Lab is a separate window that receives none), and nothing it does is saved or sent anywhere.
 */
const FRAME_CSS = [baseStyles, vyzualzStyles, appearanceStyles, floatingStyles, tabRowStyles, groupSpacingStyles, typographyStyles, reactViewStyles, canonicalStyles, iconStyles, collapsibleStyles, railHeaderStyles, headerGroupStyles, searchRowStyles, viewToggleStyles, padStyles, dropdownStyles].join('\n')
/** Frame-only geometry: the window sits in the first column at its desktop rail width, filling the frame's height. */
const STAGE_CSS = '.ll-ui-stage { position: absolute; inset: 0 auto auto 0; width: 100%; } .ll-ui-stage .rv-shell, .ll-ui-stage .rv-layout, .ll-ui-stage .vz-inspector, .ll-ui-stage .vz-inspector-inner, .ll-ui-stage .vz-panel-body, .ll-ui-stage .rv-workspace-panel, .ll-ui-stage .rv-workspace-panel-body, .ll-ui-stage .rv-inspector-scroll { height: auto; max-height: none; overflow: visible; flex: none; } .ll-ui-stage .rv-layout { display: block; width: 354px; } .ll-ui-stage .vz-inspector { width: 354px; }'
const FRAME_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${BRAND_FONT_LINK}"></head><body></body></html>`

const ENGINE_OPTIONS = [{ value: 'cinema2', label: 'Cinema 2.0' }, { value: 'soundDrawing', label: 'Sound Drawing' }, { value: 'canvas', label: 'CANVAS' }, { value: 'laserDmx', label: 'LaserDMX' }]
const PATTERN_OPTIONS = [
  { value: 'stargazing', label: 'Stargazing', description: 'The authored picture with a slow breath.' },
  { value: 'reach', label: 'Reach', description: 'His arms rise toward the planets and lower again.' },
  { value: 'conductor', label: 'Conductor', description: 'The arms take the beat in turn.' },
]
type RightTab = 'presets' | 'design' | 'react' | 'output'
type Surface = 'engine' | 'selection'
type Scope = 'system' | 'user'

function InspectorWindow() {
  const [tab, setTab] = useState<RightTab>('design')
  const [surface, setSurface] = useState<Surface>('engine')
  const [scope, setScope] = useState<Scope>('system')
  const [view, setView] = useState<LibraryView>('grid')
  const [query, setQuery] = useState('')
  const [n, setN] = useState({ intensity: 1, reactivity: .65, motion: .4, speed: 1.2, bloom: .3, angle: 0, size: 12, count: 24, scrub: 120 })
  const [t, setT] = useState({ sync: true, kick: true, auto: false, mirror: false })
  const [pattern, setPattern] = useState('stargazing')
  const [engine, setEngine] = useState('cinema2')
  const [text, setText] = useState({ name: 'Midnight Run', notes: 'Hold the drop for two bars, then release.' })
  const [color, setColor] = useState({ accent: '#4ac7db', ground: '#090d0f' })
  const [palette, setPalette] = useState({ void: '#000000', lines: '#d9d0d0', stars: '#8ef4ff' })
  const [selectedPad, setSelectedPad] = useState('1')
  const [tags, setTags] = useState(['ambient', 'reactive', 'night'])
  const [remember, setRemember] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const set = <K extends keyof typeof n>(key: K) => (value: number) => setN(current => ({ ...current, [key]: value }))
  const flip = <K extends keyof typeof t>(key: K) => (value: boolean) => setT(current => ({ ...current, [key]: value }))
  const icon = (kind: Parameters<typeof AppIcon>[0]['kind']): ReactNode => <AppIcon kind={kind} size={15} color="currentColor" aria-hidden="true" />
  return <WorkspaceRail side="right" label="UI Preview window" className="rw-frame--right">
    <RailWindowHeader side="right" icon={icon('settings')} label="Inspector" actions={<IconChipButton title="Reset" aria-label="Reset" icon={icon('clearAll')} />} />
    <RailTabs variant="underline" className="rv-main-workspace-tabs" ariaLabel="UI Preview window tabs" activeTab={tab} onChange={setTab}
      tabs={[{ id: 'presets', label: 'PRESETS' }, { id: 'design', label: 'DESIGN' }, { id: 'react', label: 'REACT' }, { id: 'output', label: 'OUTPUT', disabled: true }]} />
    <div className="vz-panel-body">
      <div className="rv-workspace-panel">
        <PanelSubtabs value={surface} onChange={setSurface} ariaLabel="UI Preview surfaces" options={[{ id: 'engine', label: 'ENGINE' }, { id: 'selection', label: 'SELECTION', disabled: true }]} />
        <div className="rv-workspace-panel-body">
          <div className="rv-inspector rv-inspector-scroll">
            <div className="rv-ctrl-group">
              <CtrlSection label="Engine" />
              <SelectRow label="Engine" value={engine} onChange={setEngine} options={ENGINE_OPTIONS} />
            </div>
            <div className="rv-ctrl-group">
              <Collapsible label="Master Controls" icon={icon('sliders')}>
                <ToggleRow label="BPM Sync" value={t.sync} onChange={flip('sync')} description="Locks the motion to the track tempo." />
                <SliderRow label="Intensity" value={n.intensity} onChange={set('intensity')} min={0} max={2} description="Scales the brightness of every line." resetValue={1} />
                <SliderRow label="Audio Reactivity" value={n.reactivity} onChange={set('reactivity')} liveValue={.82} />
                <ToggleRow label="Zoom on Kick" value={t.kick} onChange={flip('kick')} />
                <ToggleRow label="Auto Performance" value={t.auto} onChange={flip('auto')} disabled title="Locked while the music is not playing" />
              </Collapsible>
              <Collapsible label="Design" icon={icon('paintBrush')}>
                <Collapsible label="Pattern">
                  <SelectRow label="Pattern" value={pattern} onChange={setPattern} options={PATTERN_OPTIONS} showOptionDescriptions description="What the figure and the planets do." />
                  <ToggleRow label="Pattern Change" value={t.mirror} onChange={flip('mirror')} />
                </Collapsible>
                <Collapsible label="Motion">
                  <SliderRow label="Motion" value={n.motion} onChange={set('motion')} />
                  <SliderRow label="Speed" value={n.speed} onChange={set('speed')} min={0} max={2} formatValue={value => `${value.toFixed(1)}×`} />
                  <SliderRow label="Heading" value={n.angle} onChange={set('angle')} min={-50} max={50} step={1} formatValue={value => `${value > 0 ? '+' : ''}${value}°`} />
                  <Collapsible label="Fine">
                    <NumberInputRow label="Size" value={n.size} onChange={value => set('size')(Number(value))} min={1} max={100} step={1} unit="px" />
                    <NumberInputRow label="Count" value={n.count} onChange={value => set('count')(Number(value))} min={1} max={200} step={1} />
                    <NumericScrubField label="Tempo" value={n.scrub} onChange={set('scrub')} min={40} max={200} step={1} unit="BPM" />
                  </Collapsible>
                </Collapsible>
                <Collapsible label="Text">
                  <TextInputRow label="Name" value={text.name} onChange={value => setText(current => ({ ...current, name: value }))} maxLength={32} placeholder="Preset name" />
                  <TextAreaRow label="Notes" value={text.notes} onChange={value => setText(current => ({ ...current, notes: value }))} rows={3} placeholder="Notes for this preset" />
                </Collapsible>
              </Collapsible>
              <Collapsible label="Effects" icon={icon('wand')}>
                <SliderRow label="Bloom" value={n.bloom} onChange={set('bloom')} min={0} max={3} />
                <SliderRow label="Vignette" value={0} onChange={() => undefined} />
              </Collapsible>
              <Collapsible label="Palette" icon={icon('colorPalette')}>
                <ColorRow label="Accent" value={color.accent} onChange={value => setColor(current => ({ ...current, accent: value }))} />
                <ColorRow label="Ground" value={color.ground} onChange={value => setColor(current => ({ ...current, ground: value }))} />
                <PaletteColorRow label="Void" value={palette.void} onChange={value => setPalette(current => ({ ...current, void: value }))} />
                <PaletteColorRow label="Figure Lines" value={palette.lines} onChange={value => setPalette(current => ({ ...current, lines: value }))} />
                <PaletteColorRow label="Stars & Moons" value={palette.stars} onChange={value => setPalette(current => ({ ...current, stars: value }))} />
              </Collapsible>
              <Collapsible label="Library" icon={icon('grid')}>
                <PanelSubtabs value={scope} onChange={setScope} ariaLabel="Preset scope" options={[{ id: 'system', label: 'SYSTEM' }, { id: 'user', label: 'USER' }]} />
                <LibrarySearchRow value={query} onChange={setQuery} placeholder="Search presets" label="Search presets" clearable>
                  <LibraryViewToggle view={view} onChange={setView} />
                </LibrarySearchRow>
                <UnderlineDropdown eyebrow="Sort" aria-label="Sort presets" value="recent" options={[{ value: 'recent', label: 'Recently used' }, { value: 'name', label: 'Name' }]} />
                <DreamVizTextInput aria-label="Text field" placeholder="Text field" defaultValue="" />
                <div className="rv-ctrl-toggle-row"><div className="rv-ctrl-toggle-line"><span className="rv-ctrl-label">Remember me</span><IconMorphToggle checked={remember} onCheckedChange={setRemember} aria-label="Remember me" /></div></div>
              </Collapsible>
              <Collapsible label="Status" icon={icon('clock')}>
                <div className="ll-ui-row">
                  <StatusBadge tone="selected">Selected</StatusBadge><StatusBadge tone="loaded">Loaded</StatusBadge><StatusBadge tone="playing">Playing</StatusBadge><StatusBadge tone="dirty">Unsaved</StatusBadge><StatusBadge tone="legacy">Legacy</StatusBadge>
                </div>
                <div className="ll-ui-row">
                  {tags.map(tag => <TagPill key={tag} label={tag} onRemove={() => setTags(current => current.filter(item => item !== tag))} removeLabel={`Remove ${tag}`} />)}
                  <Badge label="Cinema 2.0" tone="#4ac7db" />
                </div>
                <div className="ll-ui-row">
                  <IconChipButton>Default</IconChipButton>
                  <IconChipButton tone="primary" icon={icon('check')}>Primary</IconChipButton>
                  <IconChipButton disabled>Disabled</IconChipButton>
                </div>
                <LayerRow index={1} label="Planets" status="Visible" tone="#4ac7db" active />
                <LayerRow index={2} label="Water" status="Hidden" tone="#61d6aa" />
                {!dismissed && <NoticeCard tone="info" title="Status update" onDismiss={() => setDismissed(true)}>Review the related workspace for details.</NoticeCard>}
                <NoticeCard tone="success" title="Action completed">The preset was saved.</NoticeCard>
                <NoticeCard tone="warning" title="Review required">This preset uses a model with a non-commercial licence.</NoticeCard>
                <NoticeCard tone="error" title="Action needs attention">The audio source could not be opened.</NoticeCard>
              </Collapsible>
              <Collapsible label="Performance Pads" icon={icon('grid')}>
                <div className="rv-pads-section rv-pads-section--embedded"><div className="rv-pads-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {[['1', 'Reactor', '#5993e8'], ['2', 'Drop Cage', '#df706d'], ['3', 'Infinity', '#64b98b'], ['4', 'Tunnel', '#d9a35e']].map(([key, label, tone]) => (
                    <PerformancePad key={key} density="compact" label={label!} shortcut={key!} color={tone} selected={selectedPad === key} onActivate={() => setSelectedPad(key!)} />
                  ))}
                </div></div>
              </Collapsible>
            </div>
          </div>
        </div>
      </div>
    </div>
  </WorkspaceRail>
}

/** The window is rendered at a desktop viewport (the app's rails take their desktop width from it) and the frame is sized to the window's content. */
const DESKTOP_VIEWPORT = 1700
const RAIL_WIDTH = 354

function FitHeight({ onHeight }: { onHeight(height: number): void }) {
  const marker = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    // The window lives in the frame's document, not Layout Lab's.
    const rail = marker.current?.ownerDocument.querySelector<HTMLElement>('.ll-ui-stage .vz-inspector')
    if (!rail) return
    const fit = () => onHeight(Math.ceil(rail.getBoundingClientRect().height) + 2)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [onHeight])
  return <span ref={marker} hidden />
}

export function UiPreviewStudies() {
  const [body, setBody] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(1200)
  return <div className="ll-ui-preview" aria-label="UI Preview">
    <style>{studyStyles}</style>
    <div className="ll-ui-preview-clip" style={{ width: RAIL_WIDTH + 2, height }}>
      <iframe className="ll-ui-preview-frame" title="UI Preview window" srcDoc={FRAME_HTML} style={{ width: DESKTOP_VIEWPORT, height }}
        onLoad={event => {
          const doc = event.currentTarget.contentDocument
          if (!doc) return
          doc.documentElement.dataset.theme = 'dark'
          doc.documentElement.dataset.workspaceLayout = 'floating'
          setBody(doc.body)
        }} />
    </div>
    {body && createPortal(<><style>{FRAME_CSS + STAGE_CSS}</style><div className="az-root ll-ui-stage" data-workspace-layout="floating" data-app-workspace="react"><div className="rv-shell rv-shell--floating"><div className="rv-layout"><InspectorWindow /></div></div></div><FitHeight onHeight={setHeight} /></>, body)}
  </div>
}

import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { NavMedallionIcon, type NavMedallionKind } from '../../navMedallionIcons'
import studyStyles from './leftNavBarStudies.css?inline'

const ITEMS: { kind: NavMedallionKind; label: string; note: string }[] = [
  { kind: 'navReact', label: 'React', note: 'Live engines' },
  { kind: 'navPerformance', label: 'Performance Manager', note: 'Pads & triggers' },
  { kind: 'navPreset', label: 'Preset Manager', note: 'Browse & recall' },
  { kind: 'navShow', label: 'Show Manager', note: 'Lights & timeline' },
  { kind: 'navLyrics', label: 'Lyric Manager', note: 'Words & mic' },
  { kind: 'navMedia', label: 'Media Manager', note: 'Clips & stills' },
]

/** Round one: five treatments of the production sidebar. Every column can be expanded or collapsed. */
export const LEFT_NAV_VARIANTS = [
  { id: 'edge', name: 'Edge bar', active: 'Production: 3px cyan edge, cyan label, icon glow' },
  { id: 'pill', name: 'Soft pill', active: 'Rounded tinted pill with a cyan outline, no edge' },
  { id: 'wash', name: 'Light wash', active: 'Cyan light sweeping in from the left with a hairline underneath' },
  { id: 'hud', name: 'HUD brackets', active: 'Corner brackets and a scan line frame the item' },
  { id: 'solid', name: 'Solid block', active: 'Filled cyan block with dark label and dark icon accents' },
] as const

/** Twelve inspirations reviewed on Dribbble and Pinterest, scored out of 20 (see the research note in the summary). */
export const LEFT_NAV_INSPIRATIONS = [
  { id: 'hudframe', rank: 1, score: 18, name: 'Game-menu HUD frame', source: 'Pinterest · HUD Digital Futuristic User Interface Frame', url: 'https://www.pinterest.com/pin/hud-digital-futuristic-user-interface-frame-cyberpunk-game-menu--662592163949341056/', idea: 'Numbered entries, ruler ticks and an arrow-tag active state', why: 'Most distinctive and closest to the app\'s lit-ring, instrument-panel identity; collapses to a tick ruler with a pointer.' },
  { id: 'dock', rank: 2, score: 17, name: 'Floating dock', source: 'Dribbble · Dock sidebar navigation (Luc Chaissac)', url: 'https://dribbble.com/shots/16541733--Dock-sidebar-navigation', idea: 'Icons that swell toward the cursor and a glowing dot for the active item', why: 'Gives the medallion icons room to be the hero and has a natural collapsed form (shown here in the production shell, not floating).' },
  { id: 'tier', rank: 3, score: 16, name: 'Dual-tier rail + panel', source: 'Dribbble · Left Navigation tag (dual-tier patterns)', url: 'https://dribbble.com/tags/left-navigation', idea: 'A permanent icon rail with a second panel that carries labels and one-line descriptions', why: 'Keeps the production rail intact and adds context; collapse simply drops the second tier.' },
  { id: 'glass', rank: 4, score: 16, name: 'Frosted glass panel', source: 'Dribbble · Sidebar Navigation, Glassmorphism visionOS (Riju Rajan)', url: 'https://dribbble.com/shots/21860592-Sidebar-Navigation-Glassmorphism-VisionOS-Visual-Style', idea: 'A lifted frosted-glass chip with a specular edge as the active state', why: 'Strong look, but glass reads weakly on a flat dark panel, so it scores below the dark-native ideas.' },
  { id: 'tube', rank: 5, score: 15, name: 'Neon tube', source: 'Pinterest · Glowing Neon Interface Design', url: 'https://www.pinterest.com/ideas/glowing-neon-interface-design/939832532464/', idea: 'A glass tube running down the edge that branches into the active item, which glows like a sign', why: 'Fits the neon identity; scored lower because glow competes with the icon accents.' },
  { id: 'grouped', rank: 6, score: 13, name: 'Grouped collapsing sections', source: 'Dribbble · Dashboard Sidebar Menu (Artyom Cherepanov)', url: 'https://dribbble.com/shots/24939861-Dashboard-Sidebar-Menu-Light-Dark-Mode', idea: 'Library / Tools / Analytics groups that minimise smoothly', why: 'Solid, but the app has only six items, so grouping adds little.' },
  { id: 'morph', rank: 7, score: 12, name: 'Animated collapse', source: 'Dribbble · Collapsing Sidebar Navigation (Marek Talbierz)', url: 'https://dribbble.com/shots/18111119-Collapsing-Sidebar-Navigation-Light-and-Dark-mode', idea: 'Labels slide and fade as the panel narrows', why: 'A motion idea, not a visual style.' },
  { id: 'finance', rank: 8, score: 11, name: 'Expandable finance dashboard', source: 'Dribbble · Expandable Sidebar Navigation (Julian Herbst)', url: 'https://dribbble.com/shots/10996186-Expandable-Sidebar-Navigation-Stocklabs', idea: 'Classic SaaS expandable sidebar', why: 'Conventional; nothing the production bar lacks.' },
  { id: 'macglass', rank: 9, score: 11, name: 'Mac-style glass sidebar', source: 'Dribbble · Glassmorphism Mac sidebar (Praveen Jose)', url: 'https://dribbble.com/shots/17942973-Glassmorphism-Mac-sidebar-navigation-Light-Dark-mode', idea: 'Apple-inspired translucent source list', why: 'Overlaps the visionOS glass idea and is more corporate.' },
  { id: 'morten', rank: 10, score: 10, name: 'Expanded and collapsed pair', source: 'Pinterest · Expanded & Collapsed Side Navigation (Morten Søby)', url: 'https://www.pinterest.com/pin/650207264939893626/', idea: 'Both states shown side by side', why: 'A presentation device, which this tab already does.' },
  { id: 'shadcn', rank: 11, score: 8, name: 'shadcn sidebar', source: 'Dribbble · shadcn Sidebar, Collapsed vs Expanded (Ankur Puri)', url: 'https://dribbble.com/shots/25393369-shadcn-Sidebar-Collapsed-vs-Expanded-dark-mode', idea: 'Neutral component-library sidebar', why: 'Deliberately generic, the opposite of what was asked for.' },
  { id: 'untitled', rank: 12, score: 7, name: 'Plain dark menu', source: 'Pinterest · Dark mode sidebar navigation (Untitled UI)', url: 'https://www.pinterest.com/pin/dark-mode-sidebar-navigation-untitled-ui--137430226124466130/', idea: 'Flat dark list with a grey active row', why: 'The cliché being avoided.' },
] as const
const TOP_FIVE = LEFT_NAV_INSPIRATIONS.slice(0, 5)

type Sidebar = { variant: string; collapsed: boolean; onToggle: () => void; active: NavMedallionKind; onActive: (kind: NavMedallionKind) => void }

function Sidebar({ variant, collapsed, onToggle, active, onActive }: Sidebar) {
  const toggle = <button type="button" className="ll-ln-toggle" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle}><AppIcon kind="chevronRight" size={22} style={{ transform: collapsed ? undefined : 'rotate(180deg)' }} /></button>
  const brand = <div className="ll-ln-brand"><AppIcon kind="brand" size={28} /><span>DRMVYZ</span></div>
  const root = `ll-ln-sidebar ll-ln-sidebar--${variant}${collapsed ? ' is-collapsed' : ''}`
  if (variant === 'tier') return <aside className={root} data-collapsed={collapsed}><div className="ll-ln-inner">
    <div className="ll-ln-rail">
      <div className="ll-ln-brand"><AppIcon kind="brand" size={28} /></div>
      <nav className="ll-ln-nav">{ITEMS.map(item => <button key={item.kind} type="button" title={item.label} aria-label={item.label} className={`ll-ln-item${active === item.kind ? ' is-active' : ''}`} aria-current={active === item.kind ? 'page' : undefined} onClick={() => onActive(item.kind)}><NavMedallionIcon kind={item.kind} size={36} /></button>)}</nav>
      {toggle}
    </div>
    <div className="ll-ln-panel" aria-hidden={collapsed}>
      <div className="ll-ln-panel-title">DRMVYZ<small>Workspace</small></div>
      {ITEMS.map((item, index) => <button key={item.kind} type="button" tabIndex={collapsed ? -1 : 0} className={`ll-ln-row${active === item.kind ? ' is-active' : ''}`} onClick={() => onActive(item.kind)}><strong>{item.label}</strong><small>{item.note}</small>{index === 0 && <i aria-hidden="true" />}</button>)}
    </div>
  </div></aside>
  return <aside className={root} data-collapsed={collapsed}><div className="ll-ln-inner">
    {brand}
    <nav className="ll-ln-nav">
      {ITEMS.map((item, index) => <div key={item.kind} className="ll-ln-group">
        {index === 1 && <div className="ll-ln-section">Managers</div>}
        <button type="button" title={item.label} aria-label={item.label} className={`ll-ln-item${active === item.kind ? ' is-active' : ''}`} aria-current={active === item.kind ? 'page' : undefined} onClick={() => onActive(item.kind)}>
          <NavMedallionIcon kind={item.kind} size={36} />
          <span className="ll-ln-label">{item.label}</span>
          <span className="ll-ln-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
        </button>
      </div>)}
    </nav>
    <div className="ll-ln-footer"><span>License</span><strong>Professional</strong><em>v3.0.0</em></div>
    {toggle}
  </div></aside>
}

/** Left navigation studies: round one (five treatments), the scored research, then the five best-scoring inspirations, each shown expanded and collapsed. */
export function LeftNavBarStudies() {
  const columnIds = [...LEFT_NAV_VARIANTS.map(variant => variant.id), ...TOP_FIVE.flatMap(item => [`${item.id}-expanded`, `${item.id}-collapsed`])]
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(Object.fromEntries(columnIds.map(id => [id, id.endsWith('-collapsed')])))
  const [active, setActive] = useState<Record<string, NavMedallionKind>>(Object.fromEntries(columnIds.map(id => [id, 'navReact'])))
  const setAll = (value: boolean) => setCollapsed(Object.fromEntries(columnIds.map(id => [id, value])))
  const column = (id: string, variant: string, title: string, note: string, index?: number) => <section key={id} className="ll-ln-column" data-left-nav-study={id} aria-labelledby={`ll-ln-${id}`}>
    <header className="ll-ln-heading"><h2 id={`ll-ln-${id}`}>{index !== undefined && <span>{String(index).padStart(2, '0')}</span>}{title}</h2><p>{note}</p></header>
    <Sidebar variant={variant} collapsed={collapsed[id]} onToggle={() => setCollapsed(current => ({ ...current, [id]: !current[id] }))} active={active[id]} onActive={kind => setActive(current => ({ ...current, [id]: kind }))} />
  </section>
  return <div className="ll-ln-studies" aria-label="Left navigation bar studies">
    <style>{studyStyles}</style>
    <div className="ll-ln-summary"><p>Every sidebar has its own expand / collapse button at the bottom · click an item to see its active state</p>
      <span><button type="button" onClick={() => setAll(false)}>Expand all</button><button type="button" onClick={() => setAll(true)}>Collapse all</button></span></div>
    <section className="ll-ln-block" aria-label="Round one">
      <h3 className="ll-ln-block-title">Round one · production treatments</h3>
      <div className="ll-ln-columns">{LEFT_NAV_VARIANTS.map((variant, index) => column(variant.id, variant.id, variant.name, variant.active, index + 1))}</div>
    </section>
    <section className="ll-ln-block" aria-label="Inspiration scoreboard" data-left-nav-scoreboard>
      <h3 className="ll-ln-block-title">Inspiration scoreboard · 12 ideas from Dribbble and Pinterest, scored out of 20</h3>
      <p className="ll-ln-note">Scored on distinctiveness, fit with the lit-ring Medallion icons and dark instrument look, how well it works both expanded and collapsed, and how cleanly it builds in CSS. Dribbble and Pinterest would not load their images here, so each idea comes from the shot or pin's title, tags and description, not from the pictures. The top five are built below.</p>
      <ol className="ll-ln-score">{LEFT_NAV_INSPIRATIONS.map(item => <li key={item.id} className={item.rank <= 5 ? 'is-built' : undefined}><b>{item.score}</b><div><strong>{item.name}</strong><a href={item.url} target="_blank" rel="noreferrer">{item.source}</a><span>{item.idea}. {item.why}</span></div></li>)}</ol>
    </section>
    {TOP_FIVE.map(item => <section key={item.id} className="ll-ln-block" aria-label={item.name}>
      <h3 className="ll-ln-block-title"><span>{String(item.rank).padStart(2, '0')}</span>{item.name}<em>{item.score}/20</em></h3>
      <p className="ll-ln-note">{item.idea}. Inspired by {item.source}.</p>
      <div className="ll-ln-columns">{column(`${item.id}-expanded`, item.id, 'Expanded', 'Labels and full active state')}{column(`${item.id}-collapsed`, item.id, 'Collapsed', 'Icon rail and active state')}</div>
    </section>)}
  </div>
}

import { useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'
import { PanelSubtabs } from '../PanelSubtabs'
import { ReactPresetCard } from '../ReactPresetCard'
import { SliderRow } from '../ReactControlRows'
import { IconChipButton } from '../controls/IconChipButton'
import { LibrarySearchRow } from '../controls/LibrarySearchRow'
import { PerformancePad } from '../controls/PerformancePad'
import { StatusBadge } from '../controls/StatusBadge'
import { UnderlineTabs } from '../controls/UnderlineTabs'
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
import searchRowStyles from '../controls/LibrarySearchRow.css?inline'
import padStyles from '../controls/performancePad.css?inline'
import mobileScreensStyles from '../../layout/mobileScreens.css?inline'
import mobileAppStyles from '../../mobile/mobileApp.css?inline'
import frameStyles from './mobileStudiesFrame.css?inline'
import studyStyles from './mobileStudies.css?inline'

/**
 * Mobile layout studies (portrait, 390 × 844) for the phone version of STAGELESS, Cinema 2.0 only for now. The phone does two jobs: a DJ's quick
 * resource while performing (swap visuals, hit pads) and a party or event player (live input or a track from the phone, cast to a screen). Each layout
 * shows both: "DJ set" and "Party". Everything is built from the app's real components; the stage is a still of the preset's artwork standing in for the
 * live render. Each layout is an iframe whose document carries the app's stylesheets (Layout Lab receives none). Nothing here changes the real mobile app.
 */
export const asset = (file: string) => `${import.meta.env.BASE_URL ?? '/'}${file}`
export const FRAME_CSS = [baseStyles, vyzualzStyles, appearanceStyles, floatingStyles, tabRowStyles, groupSpacingStyles, typographyStyles, reactViewStyles, canonicalStyles, iconStyles, collapsibleStyles, searchRowStyles, padStyles, mobileScreensStyles, mobileAppStyles, frameStyles].join('\n')
export const FRAME_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${BRAND_FONT_LINK}"></head><body></body></html>`

export const PRESETS = [
  { key: 'afterhours', name: 'Afterhours', pad: 'Hours', color: '#5993e8' }, { key: 'space-boi', name: 'Space Boi', pad: 'Boi', color: '#df706d' }, { key: 'chamber', name: 'Chamber', pad: 'Chamber', color: '#64b98b' },
  { key: 'cathedral', name: 'Cathedral', pad: 'Nave', color: '#d9a35e' }, { key: 'inertia', name: 'Inertia', pad: 'Inertia', color: '#4ac7db' }, { key: 'constellation', name: 'Constellation', pad: 'Stars', color: '#b84fc9' },
  { key: 'event-horizon', name: 'Event Horizon', pad: 'Horizon', color: '#e8b84a' }, { key: 'electric-storm', name: 'Electric Storm', pad: 'Storm', color: '#7aa2f7' },
] as const
const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] as const
const TRACKS = [{ id: 't1', title: 'Midnight Run', meta: 'This phone · 124 BPM' }, { id: 't2', title: 'Neon Static', meta: 'This phone · 128 BPM' }, { id: 't3', title: 'Low Tide', meta: 'Saved · 118 BPM' }]
type NavTab = 'pads' | 'presets' | 'tune' | 'source'
type SourceTab = 'mic' | 'track'

export interface Phone { preset: number; setPreset(index: number): void; playing: boolean; setPlaying(value: boolean): void }
export const icon = (kind: AppIconKind, size = 16): ReactNode => <AppIcon kind={kind} size={size} color="currentColor" aria-hidden="true" />

function Stage({ phone, children }: { phone: Phone; children?: ReactNode }) {
  const preset = PRESETS[phone.preset]!
  return <div className="ll-m-stage" aria-label="Visualizer output (a still stands in for the live render)">
    <img src={asset(`preset-artwork/drmvyz.cinema2.${preset.key}.webp`)} alt="" />
    <div className="ll-m-stage-top">
      <StatusBadge tone={phone.playing ? 'playing' : 'loaded'}>{phone.playing ? 'Live' : 'Paused'}</StatusBadge>
      <span className="ll-m-stage-name">{preset.name}</span>
      <span className="ll-m-stage-actions">
        <IconChipButton aria-label="Cast to screen" title="Cast to screen" tone="primary" icon={icon('cast')} />
      </span>
    </div>
    {children}
  </div>
}

export function Pads({ phone, columns = 3, rows, height }: { phone: Phone; columns?: number; rows: number; height: number }) {
  const count = columns * rows
  return <div className="rv-pads-section rv-pads-section--embedded"><div className="rv-pads-grid ll-m-pads" role="group" aria-label="Performance pads" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: `${height}px` }}>
    {Array.from({ length: count }, (_, index) => {
      const preset = PRESETS[index]
      return <PerformancePad key={index} density="expanded" label={preset?.pad ?? 'Empty'} shortcut={PAD_KEYS[index]!} color={preset?.color ?? '#3a4650'} selected={!!preset && phone.preset === index} disabled={!preset}
        className={preset ? '' : 'rv-pad--empty'} data-empty={!preset || undefined} style={{ minHeight: height, height } as CSSProperties} onActivate={() => phone.setPreset(index)} />
    })}
  </div></div>
}

export function PresetCards({ phone, layout }: { phone: Phone; layout: 'grid' | 'carousel' }) {
  const cards = PRESETS.map((preset, index) => (
    <ReactPresetCard key={preset.key} id={`m-${preset.key}`} title={preset.name} description="" activateLabel={`Load ${preset.name}`} isActive={phone.preset === index} onActivate={() => phone.setPreset(index)}
      backdrop={<img className="ll-m-card-art" src={asset(`preset-artwork/drmvyz.cinema2.${preset.key}.webp`)} alt="" />} chips={[{ label: 'Cinema 2.0' }]} />
  ))
  return layout === 'carousel'
    ? <div className="ll-m-carousel" role="list" aria-label="Presets">{cards.map((card, i) => <div role="listitem" key={i}>{card}</div>)}</div>
    : <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">{cards}</div>
}

function Macros({ count = 4 }: { count?: number }) {
  const [v, setV] = useState([.8, .65, .3, 1])
  const rows = [['Intensity', 0, 2], ['Audio Reactivity', 0, 1], ['Bloom', 0, 1], ['Speed', 0, 2]] as const
  return <div className="rv-inspector ll-m-macros"><div className="rv-ctrl-group">
    {rows.slice(0, count).map(([label, min, max], i) => <SliderRow key={label} label={label} value={v[i]!} min={min} max={max} onChange={value => setV(current => current.map((x, j) => j === i ? value : x))} />)}
  </div></div>
}

function Source({ phone }: { phone: Phone }) {
  const [tab, setTab] = useState<SourceTab>('track')
  const [listening, setListening] = useState(false)
  const [track, setTrack] = useState('t1')
  return <div className="mobile-audio ll-m-source">
    <UnderlineTabs className="dv-underline-tabs--equal" ariaLabel="Audio source" activeTab={tab} onChange={setTab} tabs={[{ id: 'mic', label: 'Live input' }, { id: 'track', label: 'Track' }]} />
    {tab === 'mic'
      ? <div className="mobile-audio-body"><p className="mobile-audio-status" data-listening={listening || undefined}>{listening ? 'Listening to the room. The visuals follow the music you play.' : 'Use the microphone to follow the room or the DJ’s audio.'}</p>
        <IconChipButton tone={listening ? 'default' : 'primary'} icon={icon('mic')} onClick={() => setListening(value => !value)}>{listening ? 'Stop live input' : 'Start live input'}</IconChipButton></div>
      : <div className="mobile-audio-body">
        <IconChipButton icon={icon('upload')}>Choose a track from this phone</IconChipButton>
        <ul className="mobile-track-list" aria-label="Tracks">{TRACKS.map(item => <li key={item.id}><button type="button" className="mobile-track" data-active={track === item.id || undefined} onClick={() => { setTrack(item.id); phone.setPlaying(true) }}><strong>{item.title}</strong><small>{item.meta}</small></button></li>)}</ul>
      </div>}
  </div>
}

function Transport({ phone }: { phone: Phone }) {
  return <div className="mobile-audio-transport ll-m-transport">
    <IconChipButton aria-label={phone.playing ? 'Pause' : 'Play'} icon={icon(phone.playing ? 'pause' : 'play')} onClick={() => phone.setPlaying(!phone.playing)} />
    <div className="mobile-audio-now"><strong>Midnight Run</strong><span className="mobile-audio-time">1:24 / 3:48 · 124 BPM</span></div>
    <IconChipButton tone="primary" icon={icon('cast')}>Cast</IconChipButton>
  </div>
}

const NAV: { id: NavTab; label: string; icon: AppIconKind }[] = [{ id: 'pads', label: 'Pads', icon: 'navPerformance' }, { id: 'presets', label: 'Presets', icon: 'navPreset' }, { id: 'tune', label: 'Tune', icon: 'sliders' }, { id: 'source', label: 'Source', icon: 'waveform' }]
function NavTabs({ tab, onChange }: { tab: NavTab; onChange(tab: NavTab): void }) {
  return <UnderlineTabs className="dv-underline-tabs--equal mpm-tabs ll-m-nav" ariaLabel="Mobile sections" activeTab={tab} onChange={onChange} tabs={NAV.map(item => ({ id: item.id, label: item.label, icon: icon(item.icon, 18) }))} />
}

/** A: the stage on top, one section at a time below, bottom navigation. The most conventional layout. */
function LayoutA({ phone, initial }: { phone: Phone; initial: NavTab }) {
  const [tab, setTab] = useState<NavTab>(initial)
  return <>
    <Stage phone={phone} />
    <div className="ll-m-body">
      {tab === 'pads' && <Pads phone={phone} rows={4} height={86} />}
      {tab === 'presets' && <><LibrarySearchRow value="" onChange={() => undefined} placeholder="Search presets" label="Search presets" /><PresetCards phone={phone} layout="grid" /></>}
      {tab === 'tune' && <Macros />}
      {tab === 'source' && <><Source phone={phone} /><Transport phone={phone} /></>}
    </div>
    <NavTabs tab={tab} onChange={setTab} />
  </>
}

/** B: one screen. Stage, a preset carousel and the pads together; the transport and Cast stay under the thumb. Party swaps the pads for the audio source. */
function LayoutB({ phone, mode }: { phone: Phone; mode: 'dj' | 'party' }) {
  return <>
    <div className="ll-m-b-head"><span>STAGELESS</span><span className="ll-m-b-bpm">124 BPM</span></div>
    <Stage phone={phone} />
    <PresetCards phone={phone} layout="carousel" />
    <div className="ll-m-body ll-m-body--tight">
      {mode === 'dj' ? <><Pads phone={phone} rows={3} height={84} /><Macros count={2} /></> : <Source phone={phone} />}
    </div>
    <Transport phone={phone} />
  </>
}

/** C: the stage fills the screen; a bottom sheet holds the controls. DJ keeps the sheet low; Party opens it for the audio source. */
function LayoutC({ phone, mode }: { phone: Phone; mode: 'dj' | 'party' }) {
  const [tab, setTab] = useState<NavTab>(mode === 'dj' ? 'pads' : 'source')
  return <>
    <div className="ll-m-c-stage"><Stage phone={phone} /></div>
    <div className="ll-m-c-sheet" data-open={mode === 'party' || undefined}>
      <span className="ll-m-c-handle" aria-hidden="true" />
      <NavTabs tab={tab} onChange={setTab} />
      <div className="ll-m-body ll-m-body--tight">
        {tab === 'pads' && <Pads phone={phone} rows={2} height={92} />}
        {tab === 'presets' && <PresetCards phone={phone} layout="carousel" />}
        {tab === 'tune' && <Macros />}
        {tab === 'source' && <><Source phone={phone} /><Transport phone={phone} /></>}
      </div>
    </div>
  </>
}

function PhoneScreen({ layout, mode }: { layout: 'a' | 'b' | 'c'; mode: 'dj' | 'party' }) {
  const [preset, setPreset] = useState(mode === 'dj' ? 1 : 0)
  const [playing, setPlaying] = useState(true)
  const phone: Phone = { preset, setPreset, playing, setPlaying }
  return <div className={`ll-m-phone ll-m-phone--${layout}`} data-mobile-layout={layout} data-mobile-mode={mode} aria-label={`${mode === 'dj' ? 'DJ set' : 'Party'} screen`}>
    {layout === 'a' && <LayoutA phone={phone} initial={mode === 'dj' ? 'pads' : 'source'} />}
    {layout === 'b' && <LayoutB phone={phone} mode={mode} />}
    {layout === 'c' && <LayoutC phone={phone} mode={mode} />}
  </div>
}

const STUDIES = [
  { id: 'a', name: 'A · Stage and sections', summary: 'The stage on top, one section at a time below (Pads, Presets, Tune, Source), bottom navigation. The most familiar layout and the closest to today’s app, but a preset change and a pad hit are on different sections.',
    best: 'Simple, predictable, easy to build on what exists.', cost: 'Switching visuals and hitting pads takes a section change.' },
  { id: 'b', name: 'B · One-screen deck', summary: 'Everything a DJ needs on one screen: the stage, a swipeable preset carousel, six large pads and two macro sliders, with play and Cast always under the thumb. Party mode swaps the pads for the audio source.',
    best: 'Fastest for a live set: swap visuals and hit pads without leaving the screen.', cost: 'A smaller stage and fewer pads at once than a pads-only screen.' },
  { id: 'c', name: 'C · Full-bleed stage and sheet', summary: 'The stage fills the screen, so you see exactly what the room sees. A bottom sheet holds the controls: low and compact for a DJ set, open for choosing audio at a party.',
    best: 'The most immersive; the stage is as large as it can be.', cost: 'Controls cover part of the stage, and a sheet needs more care to avoid accidental touches.' },
] as const

function LayoutStudy({ study }: { study: typeof STUDIES[number] }) {
  const [body, setBody] = useState<HTMLElement | null>(null)
  return <section className="ll-mobile-study" data-mobile-study={study.id} aria-labelledby={`ll-mobile-${study.id}`}>
    <header>
      <h2 id={`ll-mobile-${study.id}`}>{study.name}</h2>
      <p>{study.summary}</p>
      <dl><div><dt>Best for</dt><dd>{study.best}</dd></div><div><dt>Trade-off</dt><dd>{study.cost}</dd></div></dl>
    </header>
    <div className="ll-mobile-captions"><span>DJ set</span><span>Party</span></div>
    <iframe className="ll-mobile-frame" title={`Layout ${study.id.toUpperCase()}, DJ set and party`} srcDoc={FRAME_HTML}
      onLoad={event => { const doc = event.currentTarget.contentDocument; if (!doc) return; doc.documentElement.dataset.theme = 'dark'; setBody(doc.body) }} />
    {body && createPortal(<><style>{FRAME_CSS}</style><div className="ll-m-stagewrap"><PhoneScreen layout={study.id} mode="dj" /><PhoneScreen layout={study.id} mode="party" /></div></>, body)}
  </section>
}

export function MobileStudies({ children }: { children?: ReactNode }) {
  return <div className="ll-mobile" aria-label="Mobile layout studies">
    <style>{studyStyles}</style>
    <p className="ll-mobile-intro">Portrait, 390 × 844, Cinema 2.0 only. Each layout shows the phone in its two jobs: a DJ performing, and a party or event. Pads, preset cards and the audio source respond; the stage is a still of the preset's artwork. Nothing here changes the real mobile app.</p>
    {children}
    {STUDIES.map(study => <LayoutStudy key={study.id} study={study} />)}
  </div>
}

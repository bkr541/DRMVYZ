import { useRef, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { ObKey } from './obControls'

const DESTINATIONS: { label: string; short: string; icon: AppIconKind }[] = [
  { label: 'React', short: 'Create', icon: 'navReact' },
  { label: 'Preset Manager', short: 'Presets', icon: 'navPreset' },
  { label: 'Show Manager', short: 'Shows', icon: 'navShow' },
  { label: 'Lyric Manager', short: 'Lyrics', icon: 'navLyrics' },
  { label: 'Media Manager', short: 'Media', icon: 'navMedia' },
]

export function OptionBNav({ children }: { children: ReactNode }) {
  const [active, setActive] = useState('React')
  return <aside className="ob-spine" aria-label="Layout Lab navigation column">
    <div className="ob-brand" aria-label="DRMVYZ"><svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true"><path d="M5 7h8l6 9-6 9H5l6-9-6-9ZM19 7h8l-6 9 6 9h-8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg><small>DRMVYZ</small></div>
    <nav aria-label="Application navigation">{DESTINATIONS.map((item, index) => <button type="button" key={item.label} aria-label={item.label} title={item.label} aria-current={active === item.label ? 'page' : undefined} onClick={() => setActive(item.label)} data-manager={index > 0}><AppIcon kind={item.icon} size={21} /><span>{item.short}</span></button>)}</nav>
    {children}
    <div className="ob-license"><i className="ob-dot" /><strong>PRO</strong><small>v3.0.0</small><span className="ob-sr">License: Professional</span></div>
  </aside>
}

export function OptionBHeader() {
  const [popover, setPopover] = useState<'notifications' | 'profile' | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const notificationsRef = useRef<HTMLButtonElement>(null)
  const profileRef = useRef<HTMLButtonElement>(null)
  return <header ref={headerRef} className="ob-header" aria-label="Layout Lab header group">
    <div className="ob-header-title"><span className="ob-eyebrow">DRMVYZ / LAYOUT LAB</span><h1>Performance studio<span>Option B</span></h1></div>
    <div className="ob-output" role="group" aria-label="React controls"><button type="button" disabled aria-label="OUTPUT PREVIEW"><i className="ob-dot" />Output preview</button><button type="button" disabled aria-label="Reveal output"><AppIcon kind="eye" size={15} />Reveal</button><button type="button" disabled aria-label="Blackout output"><AppIcon kind="blackout" size={15} />Blackout</button></div>
    <div className="ob-metrics" aria-label="Performance and save status"><div role="status" aria-label="Nothing loading, saved at 11:31 AM"><small><AppIcon kind="check" size={11} />Saved</small><span>11:31 <em>AM</em></span></div><div><small>Frame rate</small><span>60 <em>FPS</em></span></div><div><small>Frame time</small><span>16.6 <em>ms</em></span></div><div><small>Quality / CPU</small><span>High <em>0%</em></span></div></div>
    <div className="ob-header-actions"><ObKey icon="sliders" label="Layout Lab" onClick={() => headerRef.current?.ownerDocument.querySelector<HTMLButtonElement>('.ob-root .ll-design-switch[aria-pressed="true"]')?.focus()} /><button type="button" ref={notificationsRef} className="ob-key" aria-label="Notifications" aria-expanded={popover === 'notifications'} onClick={() => setPopover(value => value === 'notifications' ? null : 'notifications')}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 20h4" /></svg></button><button type="button" ref={profileRef} className="ob-avatar" title="Profile" aria-label="Profile" aria-expanded={popover === 'profile'} onClick={() => setPopover(value => value === 'profile' ? null : 'profile')}>DV</button></div>
    <InfoPopover className="ob-popover" open={popover === 'notifications'} anchorRef={notificationsRef} title="Notifications" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>No new notifications in this local session.</p></InfoPopover>
    <InfoPopover className="ob-popover" open={popover === 'profile'} anchorRef={profileRef} title="DRMVYZ Professional" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>Layout Lab · Option B</p><p>Changes are local to this design preview.</p></InfoPopover>
  </header>
}

export function OptionBStage() {
  const [grid, setGrid] = useState(false)
  const [safe, setSafe] = useState(false)
  return <section className="ob-stage" role="region" aria-label="Layout Lab visualizer">
    <header className="ob-stage-heading"><div><i className="ob-dot" /><span>Output monitor</span><small>PREVIEW</small></div><div><ObKey icon="grid" label="Toggle composition grid" active={grid} onClick={() => setGrid(value => !value)} /><ObKey icon="cameraFocus" label="Toggle safe area" active={safe} onClick={() => setSafe(value => !value)} /></div></header>
    <div className="ob-stage-screen" data-grid={grid} data-safe={safe}><span className="ob-stage-grid" aria-hidden="true" /><span className="ob-stage-safe" aria-hidden="true" /><div className="ob-stage-id"><AppIcon kind="navReact" size={26} /><span>DRMVYZ</span><small>Layout preview · no live renderer</small></div></div>
    <footer><span>CINEMA 2.0 <i>/</i> ELECTRIC STORM</span><span>Preview only <i>·</i> No output</span></footer>
  </section>
}

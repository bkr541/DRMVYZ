import { useRef, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { OcKey } from './ocControls'

const DESTINATIONS: { label: string; short: string; icon: AppIconKind }[] = [
  { label: 'React', short: 'Create', icon: 'navReact' },
  { label: 'Preset Manager', short: 'Presets', icon: 'navPreset' },
  { label: 'Show Manager', short: 'Shows', icon: 'navShow' },
  { label: 'Lyric Manager', short: 'Lyrics', icon: 'navLyrics' },
  { label: 'Media Manager', short: 'Media', icon: 'navMedia' },
]
export function OptionCNav({ children }: { children: ReactNode }) {
  const [active, setActive] = useState('React')
  return <aside className="oc-nav" aria-label="Layout Lab navigation column"><nav aria-label="Application navigation">{DESTINATIONS.map((item, index) => <div key={item.label}>{index === 1 && <span className="oc-nav-label">Managers</span>}<button type="button" title={item.label} aria-label={item.label} aria-current={active === item.label ? 'page' : undefined} onClick={() => setActive(item.label)}><span><AppIcon kind={item.icon} size={21} /></span><small>{item.short}</small></button></div>)}</nav>{children}<footer><i className="oc-led" /><span>PRO</span><small>v3.0.0</small><span className="oc-sr">License: Professional</span></footer></aside>
}
export function OptionCHeader() {
  const [popover, setPopover] = useState<'notifications' | 'profile' | null>(null)
  const header = useRef<HTMLElement>(null)
  const notifications = useRef<HTMLButtonElement>(null)
  const profile = useRef<HTMLButtonElement>(null)
  return <header ref={header} className="oc-header" aria-label="Layout Lab header group">
    <div className="oc-wordmark"><svg width="25" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 5h7l7 9-7 9H3l7-9L3 5ZM17 5h8l-7 9 7 9h-8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg><strong>DRMVYZ</strong><span>Option C</span></div>
    <div className="oc-output" role="group" aria-label="React controls"><span className="oc-output-state"><i />OUTPUT PREVIEW</span><button type="button" disabled aria-label="OUTPUT PREVIEW" title="Output preview unavailable in Layout Lab"><AppIcon kind="cast" size={15} /></button><button type="button" disabled aria-label="Reveal output"><AppIcon kind="eye" size={15} />Reveal</button><button type="button" disabled aria-label="Blackout output"><AppIcon kind="blackout" size={15} />Blackout</button></div>
    <div className="oc-header-status"><div role="status" aria-label="Nothing loading. Saved 11:31 AM"><i className="oc-led" /><span>Saved <small>11:31 AM</small></span></div><div aria-label="FPS 60, frame time 16.6 ms"><strong>60<small>FPS</small></strong><span>16.6 ms</span></div><div aria-label="Quality high, App CPU usage 0 percent"><strong>High<small>QUALITY</small></strong><span>CPU 0%</span></div></div>
    <div className="oc-header-actions"><OcKey icon="sliders" label="Layout Lab" onClick={() => header.current?.ownerDocument.querySelector<HTMLButtonElement>('.oc-root .ll-design-switch[aria-pressed="true"]')?.focus()} /><button type="button" ref={notifications} className="oc-key" aria-label="Notifications" title="Notifications" aria-expanded={popover === 'notifications'} onClick={() => setPopover(value => value === 'notifications' ? null : 'notifications')}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 20h4" /></svg></button><button type="button" ref={profile} className="oc-avatar" aria-label="Profile" title="Profile" aria-expanded={popover === 'profile'} onClick={() => setPopover(value => value === 'profile' ? null : 'profile')}>DV</button></div>
    <InfoPopover className="oc-popover" open={popover === 'notifications'} anchorRef={notifications} title="Notifications" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>No new notifications in this local session.</p></InfoPopover>
    <InfoPopover className="oc-popover" open={popover === 'profile'} anchorRef={profile} title="DRMVYZ · Professional" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>Local design session. Account actions are available in the Settings study.</p></InfoPopover>
  </header>
}
export function OptionCStage() {
  const [grid, setGrid] = useState(false)
  const [safe, setSafe] = useState(false)
  return <section className="oc-stage oc-surface" aria-label="Layout Lab visualizer">
    <header><div><span className="oc-caption">VISUAL PERFORMANCE</span><h1>Your stage.</h1></div><span className="oc-stage-state"><i className="oc-led" />Preview only</span></header>
    <div className="oc-stage-screen" data-grid={grid} data-safe={safe}><div className="oc-stage-empty"><span className="oc-stage-orbit"><AppIcon kind="cinema" size={28} /></span><strong>A space for the unexpected.</strong><p>Visual output is disconnected in Layout Lab.</p></div></div>
    <footer><span><i />Cinema 2.0 <em>/</em> Electric Storm</span><div><OcKey icon="grid" label="Composition grid" active={grid} onClick={() => setGrid(value => !value)} /><OcKey icon="cameraFocus" label="Safe area guides" active={safe} onClick={() => setSafe(value => !value)} /></div></footer>
  </section>
}

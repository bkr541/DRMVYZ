import { useRef, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'
import { OdKey } from './odControls'

const DESTINATIONS: { label: string; icon: AppIconKind }[] = [
  { label: 'React', icon: 'navReact' },
  { label: 'Preset Manager', icon: 'navPreset' },
  { label: 'Show Manager', icon: 'navShow' },
  { label: 'Lyric Manager', icon: 'navLyrics' },
  { label: 'Media Manager', icon: 'navMedia' },
]

/** Vertical capsule dock for the five destinations, with the untouched Lab selector beneath it. */
export function OptionDNav({ children }: { children: ReactNode }) {
  const [active, setActive] = useState('React')
  return <aside className="od-nav" aria-label="Layout Lab navigation column">
    <nav className="od-dock-capsule" aria-label="Application navigation">
      {DESTINATIONS.map((item, index) => <div key={item.label} className="od-nav-item">
        {index === 1 && <span className="od-nav-rule" role="presentation"><span className="od-sr">Managers</span></span>}
        <button type="button" title={item.label} aria-label={item.label} aria-current={active === item.label ? 'page' : undefined} onClick={() => setActive(item.label)}><AppIcon kind={item.icon} size={20} /></button>
      </div>)}
    </nav>
    {children}
    <footer className="od-nav-foot"><i className="od-led" /><span>PRO</span><small>v3.0.0</small><span className="od-sr">License: Professional</span></footer>
  </aside>
}

export function OptionDHeader() {
  const [popover, setPopover] = useState<'notifications' | 'profile' | null>(null)
  const header = useRef<HTMLElement>(null)
  const notifications = useRef<HTMLButtonElement>(null)
  const profile = useRef<HTMLButtonElement>(null)
  return <header ref={header} className="od-header" aria-label="Layout Lab header group">
    <div className="od-brand">
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M3 5h7l7 9-7 9H3l7-9L3 5ZM17 5h8l-7 9 7 9h-8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
      <strong>DRMVYZ</strong><em>Option D</em>
    </div>
    <div className="od-output" role="group" aria-label="React controls">
      <span className="od-output-state"><i />OUTPUT PREVIEW</span>
      <button type="button" disabled aria-label="OUTPUT PREVIEW" title="Output preview unavailable in Layout Lab"><AppIcon kind="cast" size={15} /></button>
      <button type="button" disabled aria-label="Reveal output"><AppIcon kind="eye" size={15} /><span>Reveal</span></button>
      <button type="button" disabled aria-label="Blackout output"><AppIcon kind="blackout" size={15} /><span>Blackout</span></button>
    </div>
    <div className="od-status">
      <div className="od-save" role="status" aria-label="Nothing loading. Saved 11:31 AM"><i className="od-led" /><span>Saved</span><small>11:31 AM</small></div>
      <div className="od-metric" aria-label="FPS 60, frame time 16.6 ms"><b>60</b><span><small>FPS</small><em>16.6 ms</em></span></div>
      <div className="od-metric" aria-label="Quality high, App CPU usage 0 percent"><b>High</b><span><small>QUALITY</small><em>CPU 0%</em></span></div>
    </div>
    <div className="od-header-actions">
      <OdKey icon="sliders" label="Layout Lab" onClick={() => header.current?.ownerDocument.querySelector<HTMLButtonElement>('.od-root .ll-design-switch[aria-pressed="true"]')?.focus()} />
      <button type="button" ref={notifications} className="od-key" aria-label="Notifications" title="Notifications" aria-expanded={popover === 'notifications'} onClick={() => setPopover(value => value === 'notifications' ? null : 'notifications')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3ZM10 20h4" /></svg>
      </button>
      <button type="button" ref={profile} className="od-avatar" aria-label="Profile" title="Profile" aria-expanded={popover === 'profile'} onClick={() => setPopover(value => value === 'profile' ? null : 'profile')}>DV</button>
    </div>
    <InfoPopover className="od-popover" open={popover === 'notifications'} anchorRef={notifications} title="Notifications" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>No new notifications in this local session.</p></InfoPopover>
    <InfoPopover className="od-popover" open={popover === 'profile'} anchorRef={profile} title="DRMVYZ · Professional" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>Local design session. Account actions are available in the Settings study.</p></InfoPopover>
  </header>
}

/** The monitor: a recessed screen with floating chips. Guides are functional; nothing simulates a scene. */
export function OptionDStage() {
  const [grid, setGrid] = useState(false)
  const [safe, setSafe] = useState(false)
  return <section className="od-stage" aria-label="Layout Lab visualizer">
    <div className="od-stage-screen" data-grid={grid} data-safe={safe}>
      <div className="od-stage-empty"><span className="od-disc od-disc--lg"><AppIcon kind="cinema" size={26} /></span><strong>Stage is idle</strong><p>Visual output is disconnected in Layout Lab.</p></div>
      <span className="od-chip od-chip--tl"><i className="od-led" />Preview only</span>
      <span className="od-chip od-chip--tr">Cinema 2.0 <em>/</em> Electric Storm</span>
      <div className="od-stage-tools" role="group" aria-label="Stage guides"><OdKey icon="grid" label="Composition grid" active={grid} onClick={() => setGrid(value => !value)} /><OdKey icon="cameraFocus" label="Safe area guides" active={safe} onClick={() => setSafe(value => !value)} /></div>
    </div>
  </section>
}

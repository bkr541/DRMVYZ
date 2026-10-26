import { useRef, useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { InfoPopover } from '../../../../shared/InfoPopover'

const NAV: { label: string; icon: AppIconKind }[] = [
  { label: 'React', icon: 'navReact' },
  { label: 'Preset Manager', icon: 'navPreset' },
  { label: 'Show Manager', icon: 'navShow' },
  { label: 'Lyric Manager', icon: 'navLyrics' },
  { label: 'Media Manager', icon: 'navMedia' },
]

export function OptionENavigation({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState('React')
  return <aside className="oe-nav" aria-label="Layout Lab navigation column">
    <div className="oe-nav-section-caption">STUDIO</div>
    <nav className="oe-nav-icons" aria-label="Application navigation">
      {NAV.map((item, index) => <div key={item.label} className="oe-nav-item">
        {index === 1 && <span className="oe-nav-divider" aria-hidden="true" />}
        <button type="button" title={item.label} aria-label={item.label} aria-current={selected === item.label ? 'page' : undefined} onClick={() => setSelected(item.label)}><AppIcon kind={item.icon} size={19}/></button>
      </div>)}
    </nav>
    <span className="oe-nav-selector-caption">LAYOUT</span>
    {children}
    <div className="oe-nav-bottom"><span className="oe-led" /><strong>PRO</strong><span>3.0</span></div>
  </aside>
}

export function OptionEHeader() {
  const [popover, setPopover] = useState<'notification' | 'profile' | null>(null)
  const notificationRef = useRef<HTMLButtonElement>(null)
  const profileRef = useRef<HTMLButtonElement>(null)
  return <header className="oe-header" aria-label="Layout Lab header group">
    <div className="oe-brand"><span className="oe-brand-emblem"><AppIcon kind="navReact" size={23}/></span><span className="oe-brand-word">DRMVYZ</span><span className="oe-brand-breadcrumb">/</span><span className="oe-brand-title">Visual studio</span><span className="oe-header-version">E</span></div>
    <div className="oe-header-center" aria-label="Output and system status">
      <span className="oe-output-live"><i className="oe-led" />PREVIEW <span>OFFLINE</span></span>
      <span className="oe-header-rule" />
      <button type="button" title="Reveal output unavailable in Layout Lab" aria-label="Reveal output" disabled><AppIcon kind="eye" size={15}/> Reveal</button>
      <button type="button" title="Blackout output unavailable in Layout Lab" aria-label="Blackout output" disabled><AppIcon kind="blackout" size={15}/> Blackout</button>
    </div>
    <div className="oe-header-tools">
      <span className="oe-readout oe-readout--saved" role="status" aria-label="Nothing loading. Saved 11:31 AM"><span className="oe-readout-label">LOAD / SAVE</span><strong><i className="oe-led"/> Saved <em>11:31</em></strong></span>
      <span className="oe-readout" aria-label="FPS 60, frame time 16.6 milliseconds"><span className="oe-readout-label">RENDER / FPS</span><strong>60 <em>16.6ms</em></strong></span>
      <span className="oe-readout" aria-label="Quality High, CPU 0 percent"><span className="oe-readout-label">QUALITY / CPU</span><strong>HIGH <em>0%</em></strong></span>
      <button type="button" className="oe-icon-button" ref={notificationRef} aria-label="Notifications" aria-expanded={popover === 'notification'} onClick={() => setPopover(value => value === 'notification' ? null : 'notification')}><AppIcon kind="bell" size={17}/></button>
      <button type="button" className="oe-profile" ref={profileRef} aria-label="Profile" aria-expanded={popover === 'profile'} onClick={() => setPopover(value => value === 'profile' ? null : 'profile')}>DV</button>
    </div>
    <InfoPopover open={popover === 'notification'} anchorRef={notificationRef} title="Notifications" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>No new notifications in this local preview.</p></InfoPopover>
    <InfoPopover open={popover === 'profile'} anchorRef={profileRef} title="Profile" onOpenChange={() => setPopover(null)} placement="below" align="end"><p>Professional license. Account actions are shown in the Settings study.</p></InfoPopover>
  </header>
}

export function OptionEStage() {
  const [grid, setGrid] = useState(false)
  const [safe, setSafe] = useState(false)
  const [fit, setFit] = useState<'fit' | 'fill'>('fit')
  return <section className="oe-stage" aria-label="Layout Lab visualizer">
    <header className="oe-stage-toolbar"><div className="oe-stage-path"><span className="oe-kicker">PREVIEW</span><span className="oe-path-slash">/</span><strong>Composition 01</strong><span className="oe-stage-active"><i className="oe-led"/> Local preview</span></div><div className="oe-stage-toolbar-actions"><span>1920 × 1080</span><span className="oe-stage-divider"/><button type="button" aria-label="Switch stage fit" aria-pressed={fit === 'fill'} onClick={() => setFit(value => value === 'fit' ? 'fill' : 'fit')}>{fit === 'fit' ? 'Fit' : 'Fill'} <AppIcon kind="chevronDown" size={12}/></button><button type="button" aria-label="Composition grid" aria-pressed={grid} className={grid ? 'is-on' : ''} onClick={() => setGrid(value => !value)}><AppIcon kind="grid" size={15}/></button><button type="button" aria-label="Safe area guides" aria-pressed={safe} className={safe ? 'is-on' : ''} onClick={() => setSafe(value => !value)}><AppIcon kind="cameraFocus" size={15}/></button></div></header>
    <div className="oe-stage-content"><div className="oe-stage-screen" data-grid={grid} data-safe={safe} data-fit={fit}>
      <div className="oe-stage-corners" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="oe-stage-placeholder"><span className="oe-stage-signal"><AppIcon kind="cinema" size={26}/></span><span className="oe-stage-placeholder-kicker">OUTPUT MONITOR / 01</span><strong>Canvas ready</strong><p>Live rendering is disconnected in Layout Lab.<br/>Edit parameters and timelines in the surrounding workspace.</p></div>
      <span className="oe-stage-monitor-id">STAGE A&nbsp; / &nbsp;16:9</span>
    </div></div>
    <footer className="oe-stage-footer"><span><span className="oe-led"/>ENGINE / CINEMA 2.0</span><span>Electric Storm</span><span className="oe-stage-footer-right">00:39:12&nbsp;&nbsp; • &nbsp;&nbsp;24 FPS</span></footer>
  </section>
}

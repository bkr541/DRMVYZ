import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { WorkspaceRail } from '../../layout/WorkspaceRail'
import { Collapsible, SliderRow, ToggleRow } from '../ReactControlRows'
import { DreamVizTextInput } from '../controls/DreamVizTextInput'
import { IconChipButton } from '../controls/IconChipButton'
import { NoticeCard } from '../controls/NoticeCard'
import { StatusBadge } from '../controls/StatusBadge'
import { UnderlineTabs } from '../controls/UnderlineTabs'
import { FRAME_CSS, FRAME_HTML, PRESETS, Pads, PresetCards, asset, icon, type Phone } from './MobileStudies'

/**
 * Controller mode for the phone (Cinema 2.0). The laptop starts casting or performing, turns on Controller mode and shows a pairing code; the phone pairs and
 * becomes a control surface for that session. The laptop stays the source of truth: the phone's pads, presets and Master Controls (the same parameters as the Design tab
 * for the loaded preset) change the laptop's parameters, and the audio stays on the laptop. While paired the phone does not run its own visuals. The stage is a still
 * of the preset's artwork and the pairing code is a sample. Built from the app's real components; nothing here is connected to anything.
 */
type Link = 'connected' | 'lost'

function usePhone(initial: number): Phone {
  const [preset, setPreset] = useState(initial)
  const [playing, setPlaying] = useState(true)
  return { preset, setPreset, playing, setPlaying }
}

/** The loaded preset's Master Controls (Space Boi's, as the Design tab lists them): the same parameters as on the laptop. Only these for now. */
function MasterControls() {
  const [n, setN] = useState({ intensity: 1, reactivity: .65 })
  const [t, setT] = useState({ sync: true, kick: true, auto: false })
  const set = (key: keyof typeof n) => (value: number) => setN(current => ({ ...current, [key]: value }))
  const flip = (key: keyof typeof t) => (value: boolean) => setT(current => ({ ...current, [key]: value }))
  return <div className="rv-inspector ll-m-design"><div className="rv-ctrl-group">
    <Collapsible label="Master Controls" icon={icon('sliders')}>
      <ToggleRow label="BPM Sync" value={t.sync} onChange={flip('sync')} />
      <SliderRow label="Intensity" value={n.intensity} onChange={set('intensity')} min={0} max={2} />
      <SliderRow label="Audio Reactivity" value={n.reactivity} onChange={set('reactivity')} />
      <ToggleRow label="Zoom on Kick" value={t.kick} onChange={flip('kick')} />
      <ToggleRow label="Auto Performance" value={t.auto} onChange={flip('auto')} />
    </Collapsible>
  </div></div>
}

function Connection({ link }: { link: Link }) {
  return <span className="ll-m-conn" data-link={link}>
    <StatusBadge tone={link === 'connected' ? 'playing' : 'dirty'}>{link === 'connected' ? 'Connected' : 'Reconnecting'}</StatusBadge>
    <span className="ll-m-conn-name">Studio Mac{link === 'connected' ? ' · 12 ms' : ''}</span>
  </span>
}

/** What the laptop is playing, as the phone sees it: a still of the preset and where it is playing. */
function ControllerStage({ phone, link }: { phone: Phone; link: Link }) {
  const preset = PRESETS[phone.preset]!
  return <div className="ll-m-stage" data-offline={link === 'lost' || undefined} aria-label="What your laptop is showing (a still stands in for the live output)">
    <img src={asset(`preset-artwork/drmvyz.cinema2.${preset.key}.webp`)} alt="" />
    <div className="ll-m-stage-top">
      <StatusBadge tone="playing">On laptop</StatusBadge>
      <span className="ll-m-stage-name">{preset.name}</span>
    </div>
    <div className="ll-m-stage-foot">Output · Projector 1920 × 1080</div>
  </div>
}

function ControllerScreen({ link, view }: { link: Link; view: 'pads' | 'design' }) {
  const phone = usePhone(1)
  const [tab, setTab] = useState<'pads' | 'design'>(view)
  return <div className="ll-m-phone ll-m-phone--ctl" data-controller={link} data-view={tab} aria-label={`Controller, ${link === 'connected' ? 'connected' : 'connection lost'}, ${tab}`}>
    <div className="ll-m-b-head"><span>STAGELESS</span><Connection link={link} /></div>
    {link === 'lost' && <NoticeCard tone="error" title="Connection lost">Reconnecting to Studio Mac. Your laptop keeps playing. Controls are off until it is back.</NoticeCard>}
    <ControllerStage phone={phone} link={link} />
    <div className="ll-m-ctl-body" data-offline={link === 'lost' || undefined}>
      {tab === 'pads' && <PresetCards phone={phone} layout="carousel" />}
      <UnderlineTabs className="dv-underline-tabs--equal" ariaLabel="Controller sections" activeTab={tab} onChange={setTab} tabs={[{ id: 'pads', label: 'Pads', icon: icon('navPerformance', 16) }, { id: 'design', label: 'Controls', icon: icon('sliders', 16) }]} />
      <div className="ll-m-body ll-m-body--tight">
        {tab === 'pads' ? <Pads phone={phone} rows={3} height={78} /> : <MasterControls />}
      </div>
    </div>
    <div className="mobile-audio-transport ll-m-transport ll-m-ctl-foot">
      <span className="ll-m-ctl-audio">{icon('music')}</span>
      <div className="mobile-audio-now"><strong>Midnight Run</strong><span className="mobile-audio-time">Playing on your laptop · 124 BPM</span></div>
      <IconChipButton>Disconnect</IconChipButton>
    </div>
  </div>
}

/** The laptop turned Controller mode off: it has full control again, and the phone says so and waits. */
function TurnedOffScreen() {
  return <div className="ll-m-phone ll-m-phone--pair" aria-label="Controller mode turned off on the laptop">
    <div className="ll-m-b-head"><span>STAGELESS</span><span className="ll-m-conn"><StatusBadge tone="legacy">Disconnected</StatusBadge></span></div>
    <h1 className="ll-m-title">Your laptop has control</h1>
    <p className="ll-m-lede">Controller mode was turned off on Studio Mac, so your laptop is in full control of the visuals again. This phone is no longer controlling it and is not running any visuals of its own.</p>
    <div className="ll-m-pair-code"><IconChipButton tone="primary" icon={icon('cast')}>Pair again</IconChipButton><IconChipButton icon={icon('mobileApp')}>Use this phone on its own</IconChipButton></div>
    <NoticeCard tone="info" title="Nothing changes on the laptop">Whatever was playing when Controller mode turned off keeps playing there.</NoticeCard>
  </div>
}

function PairingScreen() {
  const [tab, setTab] = useState<'scan' | 'code'>('scan')
  return <div className="ll-m-phone ll-m-phone--pair" aria-label="Controller, pairing">
    <div className="ll-m-b-head"><span>STAGELESS</span><span className="ll-m-b-bpm">Controller</span></div>
    <h1 className="ll-m-title">Connect to your laptop</h1>
    <p className="ll-m-lede">Start casting or performing on your laptop, then turn on Controller mode in its header. Scan the code it shows, or type the pairing code.</p>
    <UnderlineTabs className="dv-underline-tabs--equal" ariaLabel="Pairing" activeTab={tab} onChange={setTab} tabs={[{ id: 'scan', label: 'Scan code' }, { id: 'code', label: 'Enter code' }]} />
    {tab === 'scan'
      ? <div className="ll-m-viewfinder" role="img" aria-label="Camera view: point it at the code on your laptop"><i /><i /><i /><i /><span>Point the camera at the code on your laptop</span></div>
      : <div className="ll-m-pair-code"><label className="rv-ctrl-label" htmlFor="ll-m-code">Pairing code</label><DreamVizTextInput id="ll-m-code" placeholder="STG-XXXX" defaultValue="" autoComplete="off" /><IconChipButton tone="primary" icon={icon('check')}>Connect</IconChipButton></div>}
    <h2 className="ll-m-sub">Recent laptops</h2>
    <ul className="mobile-remote-list" aria-label="Recent laptops">
      <li data-state="online"><span className="mobile-remote-dot" aria-hidden="true" /><div><strong>Studio Mac</strong><small>Online · Cinema 2.0 · Space Boi</small></div><button type="button">Connect</button></li>
      <li data-state="offline"><span className="mobile-remote-dot" aria-hidden="true" /><div><strong>Laptop</strong><small>Offline · last seen yesterday</small></div><button type="button" disabled>Connect</button></li>
    </ul>
    <NoticeCard tone="info" title="Audio stays on your laptop">While connected, this phone controls your laptop’s visuals. It does not play or analyse audio itself.</NoticeCard>
  </div>
}

/** A sample code: a deterministic pattern with the three corner markers, standing in for the real pairing code. */
function SampleCode() {
  const size = 21, cells: ReactNode[] = []
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
  const ring = (x: number, y: number, ox: number, oy: number) => { const dx = x - ox, dy = y - oy; const edge = dx === 0 || dy === 0 || dx === 6 || dy === 6; const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4; return edge || core }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const on = finder(x, y) ? ring(x, y, x < 7 ? 0 : size - 7, y < 7 ? 0 : size - 7) : ((x * 7 + y * 13 + x * y) % 5 < 2)
    if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />)
  }
  return <svg className="ll-m-qr" viewBox={`-1 -1 ${size + 2} ${size + 2}`} role="img" aria-label="Sample pairing code (not a real link)"><rect x={-1} y={-1} width={size + 2} height={size + 2} fill="#f5f8fa" /><g fill="#04060a">{cells}</g></svg>
}

/** The laptop side: the Controller mode window the user opens from the header while casting or performing. */
function DesktopControllerWindow() {
  const [on, setOn] = useState(true)
  return <div className="ll-m-desktop az-root" data-workspace-layout="floating" data-app-workspace="react"><div className="rv-shell rv-shell--floating"><div className="rv-layout"><WorkspaceRail side="right" label="Controller mode (laptop)" className="rw-frame--right">
    <RailWindowHeader side="right" icon={icon('cast', 15)} label="Controller mode" />
    <div className="ll-m-desktop-body">
      <div className="rv-inspector"><div className="rv-ctrl-group"><ToggleRow label="Controller mode" value={on} onChange={setOn} description="Let a phone control this session." /></div></div>
      <div className="ll-m-desktop-live"><StatusBadge tone="playing">Live</StatusBadge><span>Cinema 2.0 · Space Boi · Projector 1920 × 1080</span></div>
      {on ? <>
        <div className="ll-m-desktop-pair"><SampleCode /><div><span className="ll-m-eyebrow">Pairing code</span><strong className="ll-m-code">STG-4F7K</strong><small>Scan it with the STAGELESS app on your phone, or type the code.</small></div></div>
        <h3 className="ll-m-sub">Connected devices</h3>
        <ul className="mobile-remote-list" aria-label="Connected devices"><li data-state="online"><span className="mobile-remote-dot" aria-hidden="true" /><div><strong>Pixel 8</strong><small>Connected · 12 ms</small></div><button type="button">Disconnect</button></li></ul>
        <NoticeCard tone="info" title="Your phone controls this session">Presets, pads and Master Controls you change on the phone change them here. Audio stays on this laptop.</NoticeCard>
      </> : <NoticeCard tone="warning" title="Controller mode is off">This laptop has full control. Turn it on to show a pairing code and let a phone control this session. Turning it off disconnects a connected phone.</NoticeCard>}
    </div>
  </WorkspaceRail></div></div></div>
}

function ControllerStudy({ id, title, summary, width, captions, children }: { id: string; title: string; summary: string; width: number; captions: string[]; children: ReactNode }) {
  const [body, setBody] = useState<HTMLElement | null>(null)
  return <section className="ll-mobile-study ll-mobile-study--wide" data-mobile-controller={id} aria-labelledby={`ll-mobile-${id}`}>
    <header><h2 id={`ll-mobile-${id}`}>{title}</h2><p>{summary}</p></header>
    <div className="ll-mobile-captions ll-mobile-captions--flow" style={{ width }}>{captions.map(caption => <span key={caption}>{caption}</span>)}</div>
    <iframe className="ll-mobile-frame ll-mobile-frame--wide" title={title} srcDoc={FRAME_HTML} style={{ width }}
      onLoad={event => { const doc = event.currentTarget.contentDocument; if (!doc) return; doc.documentElement.dataset.theme = 'dark'; doc.documentElement.dataset.workspaceLayout = 'floating'; setBody(doc.body) }} />
    {body && createPortal(<><style>{FRAME_CSS}</style><div className="ll-m-stagewrap ll-m-stagewrap--flow" style={{ width }}>{children}</div></>, body)}
  </section>
}

export function MobileControllerStudies() {
  return <>
    <ControllerStudy id="flow" title="Controller mode · pair, connected, connection lost" width={1236} captions={['1 · Pair with the laptop', '2 · Connected', '3 · Connection lost']}
      summary="The phone pairs with a laptop that is already casting or performing, then controls it. The laptop stays the source of truth, so the stage shows what the laptop is playing. If the link drops, the controls turn off and say so; nothing pretends to have worked.">
      <PairingScreen /><ControllerScreen link="connected" view="pads" /><ControllerScreen link="lost" view="pads" />
    </ControllerStudy>
    <ControllerStudy id="design" title="Controller mode · the controls, the laptop side, and turning it off" width={1336} captions={['Controls on the phone', 'Controller mode on the laptop', 'Turned off on the laptop']}
      summary="For now the phone's Controls tab holds the loaded preset's Master Controls: the same parameters as in the Design tab on the laptop. On the laptop, Controller mode is turned on from the header while a session is live, and shows the pairing code and who is connected. When the laptop turns it off, the laptop has full control again and the phone says so and waits.">
      <ControllerScreen link="connected" view="design" /><DesktopControllerWindow /><TurnedOffScreen />
    </ControllerStudy>
  </>
}

import { useState } from 'react'
import { AppIcon, type AppIconKind } from '../../shared/icons/AppIcon'

const PRESETS = ['Nightshift', 'Reactor', 'Psylo', 'Sixfold', 'Threshold', 'Starters']
const TABS: { label: string; icon: AppIconKind }[] = [
  { label: 'Presets', icon: 'navPreset' },
  { label: 'Pads', icon: 'navPerformance' },
  { label: 'Controls', icon: 'sliders' },
  { label: 'Cast', icon: 'cast' },
]
const CONCEPTS = ['Classic controller', 'Scene deck', 'Live console', 'Session dashboard']
const PADS = ['Flash', 'Strobe', 'Freeze', 'Invert', 'Mirror', 'Glitch', 'Pulse', 'Blackout', 'Zoom']
const artwork = (name: string) => new URL(`${import.meta.env.BASE_URL}preset-artwork/drmvyz.cinema2.${name.toLowerCase()}.webp`, window.location.href).href

/** Local visual prototype: navigation and sample feedback never touch the app runtime. */
export function MobilePerformanceMockup({ variant = 1 }: { variant?: number }) {
  const [page, setPage] = useState(variant === 4 ? 'Home' : 'Presets')
  const [preset, setPreset] = useState('Nightshift')
  const [pad, setPad] = useState<string | null>(null)
  const [output, setOutput] = useState('Stage display')
  const [casting, setCasting] = useState(false)
  const [favorites, setFavorites] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = (next: string) => setPage(next)
  const scene = <section className="mpm-now" aria-label="Example current scene">
    <img src={artwork(preset)} alt="" />
    <div className="mpm-now-content">
      <div className="mpm-eyebrow">{variant === 3 ? 'PROGRAM / 01' : 'CURRENT SCENE'}<AppIcon kind="cinema" size={16} /></div>
      <h2>{preset}</h2><p>Cinema 2.0 <span>·</span> 128 BPM</p>
      <div className="mpm-scene-actions"><span><i />Preview only</span><button type="button" className="mpm-scene-arrow" aria-label="Previous preset" onClick={() => setPreset(PRESETS[(PRESETS.indexOf(preset) + PRESETS.length - 1) % PRESETS.length])}><AppIcon kind="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button><button type="button" className="mpm-scene-arrow" aria-label="Next preset" onClick={() => setPreset(PRESETS[(PRESETS.indexOf(preset) + 1) % PRESETS.length])}><AppIcon kind="chevronRight" size={18} /></button></div>
    </div>
  </section>
  const navigation = <nav className="mpm-tabs" aria-label="Mockup mobile navigation">{TABS.map(item => <button type="button" key={item.label} aria-current={page === item.label ? 'page' : undefined} onClick={() => navigate(item.label)}><AppIcon kind={item.icon} size={20} /><span>{item.label}</span></button>)}</nav>

  return <div className={`mpm mpm--${variant}`} aria-label="Mobile performance layout mockup" data-concept={variant}>
    <header className="mpm-header">
      <div className="mpm-wordmark"><AppIcon kind="navPerformance" size={24} /><div><strong>DRMVYZ</strong><span>{CONCEPTS[variant - 1]}</span></div></div>
      <span className="mpm-demo">MOCKUP</span>
    </header>
    {variant === 2 && navigation}
    {variant !== 3 && <button type="button" className="mpm-session" onClick={() => navigate('Cast')}><span className="mpm-status-dot" /><span>Desktop host <small>{casting ? `Casting to ${output}` : 'Demo session · Ready to perform'}</small></span><AppIcon kind="cast" size={19} /></button>}
    {variant === 1 && scene}
    {variant === 2 && <div className="mpm-deck-strip"><span>LIVE SET / 01</span><strong>{preset}</strong><span>128 BPM</span></div>}
    <div className="mpm-workspace">
      {variant === 3 && navigation}
      <div className="mpm-body" key={page} data-mobile-page={page}>
        {variant === 4 && page !== 'Home' && <button type="button" className="mpm-back" onClick={() => navigate('Home')}>← Session dashboard</button>}
        {page === 'Home' ? <>
          <div className="mpm-section-title"><h3><AppIcon kind="navPerformance" size={17} />Tonight’s session</h3><span className="mpm-muted">01 / DEMO</span></div>
          {scene}
          <div className="mpm-hub">{TABS.map((item, index) => <button type="button" key={item.label} onClick={() => navigate(item.label)}><AppIcon kind={item.icon} size={25} /><strong>{item.label}</strong><small>{['Choose your next scene', 'Play live effects', 'Shape the look', 'Connect a display'][index]}</small><AppIcon kind="chevronRight" size={16} /></button>)}</div>
          <div className="mpm-note">Your set, in your pocket. Choose a workspace to explore.</div>
        </> : <>
          <div className="mpm-section-title"><h3><AppIcon kind={TABS.find(tab => tab.label === page)!.icon} size={17} />{page === 'Cast' ? 'Casting & output' : page === 'Pads' ? 'Performance pads' : page === 'Controls' ? 'Scene controls' : 'Your next scene'}</h3><span className="mpm-muted">{variant === 3 ? 'LIVE' : 'DEMO'}</span></div>
          {page === 'Presets' && <>
            {variant === 2 && scene}
            <label className="mpm-search"><AppIcon kind="search" size={17} /><input aria-label="Find a preset" placeholder="Find a preset…" value={query} onChange={event => setQuery(event.target.value)} /></label>
            <div className="mpm-engine"><AppIcon kind="cinema" size={19} /><span>Cinema 2.0</span><button type="button" className="mpm-favorites-label" aria-pressed={favorites} onClick={() => setFavorites(!favorites)}><AppIcon kind="star" size={13} />Favorites</button></div>
            <div className="mpm-presets">{PRESETS.filter((name, index) => (!favorites || index < 3) && name.toLowerCase().includes(query.toLowerCase())).map((name, index) => <button type="button" className="mpm-preset" key={name} aria-pressed={name === preset} onClick={() => setPreset(name)}><img src={artwork(name)} alt="" /><span><small>0{index + 1} / CINEMA</small>{name}</span>{name === preset && <i />}</button>)}</div>
          </>}
          {page === 'Pads' && <>
            <div className="mpm-info"><strong>{preset}</strong><span>Bank A · Tap to preview an effect</span></div>
            <div className="mpm-pads">{PADS.map((name, index) => <button type="button" key={name} aria-pressed={pad === name} onClick={() => setPad(pad === name ? null : name)}><small>0{index + 1}</small><AppIcon kind={index % 2 ? 'sliders' : 'navPerformance'} size={22} /><strong>{name}</strong></button>)}</div>
            <div className="mpm-note" role="status">{pad ? `${pad} selected · Visual demo only` : 'Ready · No effect selected'}</div>
            <button type="button" className="mpm-action" onClick={() => setPad(null)}>Release all effects</button>
          </>}
          {page === 'Controls' && <>
            <div className="mpm-info"><strong>{preset}</strong><span>Shape your current scene</span></div>
            <div className="mpm-controls">{['Intensity', 'Motion', 'Scale', 'Color shift'].map((name, index) => <label key={name}><span>{name}<small>{['MASTER', 'SPEED', 'SIZE', 'PALETTE'][index]}</small></span><input type="range" aria-label={name} min="0" max="100" defaultValue={[75, 40, 60, 25][index]} /></label>)}</div>
            <div className="mpm-info"><AppIcon kind="navPerformance" size={20} /><span>Audio reactive <small>Demo input · 128 BPM</small></span><input type="checkbox" aria-label="Audio reactive" defaultChecked /></div>
            <button type="button" className="mpm-action" onClick={() => navigate('Pads')}>Open performance pads →</button>
          </>}
          {page === 'Cast' && <>
            <div className="mpm-output-preview">{scene}<span><AppIcon kind="cast" size={16} />{casting ? `Casting · ${output}` : 'Output preview'}</span></div>
            <div className="mpm-engine"><AppIcon kind="cast" size={18} /><span>Available displays</span><small>2 FOUND</small></div>
            <div className="mpm-devices">{['Stage display', 'Studio projector'].map((name, index) => <button type="button" key={name} aria-pressed={output === name} onClick={() => { setOutput(name); setCasting(false) }}><AppIcon kind="cast" size={22} /><span><strong>{name}</strong><small>{index ? '1920 × 1080 · Local network' : '3840 × 2160 · Local network'}</small></span><span className="mpm-device-radio" /></button>)}</div>
            <label className="mpm-quality">Output quality<select aria-label="Output quality" defaultValue="1080p / 60 fps"><option>1080p / 60 fps</option><option>720p / 30 fps</option><option>4K / 30 fps</option></select></label>
            <button type="button" className="mpm-action" onClick={() => setCasting(!casting)}>{casting ? 'Stop casting' : 'Start casting'}</button>
            <div className="mpm-note" role="status">{casting ? `Demo connected to ${output}` : 'Choose a display to preview the connected state.'} No video is transmitted.</div>
          </>}
        </>}
      </div>
    </div>
    {variant === 1 && navigation}
    {variant === 4 && <footer className="mpm-dashboard-footer"><span><i />{preset}</span><button type="button" onClick={() => navigate(page === 'Home' ? 'Cast' : 'Home')}>{page === 'Home' ? 'Cast output →' : '⌂ Home'}</button></footer>}
    {variant === 3 && <footer className="mpm-console-footer"><span>HOST / DEMO</span><span>128 BPM</span><span>60 FPS</span></footer>}
  </div>
}

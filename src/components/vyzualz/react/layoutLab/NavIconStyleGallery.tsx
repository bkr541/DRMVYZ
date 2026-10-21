import { AppIcon } from '../../../shared/icons/AppIcon'
const NAV_ICONS = [
  { kind: 'navReact', label: 'React' },
  { kind: 'navPreset', label: 'Preset Manager' },
  { kind: 'navShow', label: 'Show Manager' },
  { kind: 'navLyrics', label: 'Lyric Manager' },
  { kind: 'navMedia', label: 'Media Manager' },
] as const

export function NavIconStyleGallery() {
  return <div className="llni-gallery" aria-label="Approved navigation icons">
    <section className="llni-concept" data-testid="nav-icon-approved">
      <div className="llni-copy"><span>Approved navigation icons</span><p>The same artwork used throughout the application.</p></div>
      <div className="llni-stage llni-stage--approved">
        {NAV_ICONS.map((icon, index) => <div key={icon.kind} className={`llni-item${index === 0 ? ' is-active' : ''}`} data-nav-icon={icon.kind}>
          <span className="llni-label">{icon.label}</span><span className="llni-icon"><AppIcon kind={icon.kind} size={32} /></span>
        </div>)}
      </div>
    </section>
  </div>
}

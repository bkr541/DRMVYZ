import { useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../shared/icons/AppIcon'

// ── Layout Lab · navigation column · React ──────────────────────────────────
//
// A disconnected mockup of the production left navigation bar (VyzualzSidebar, compact floating variant): React, the
// Managers section label, Preset / Show / Lyric / Media Manager and the licence and version footer, in the same markup
// and classes. It has no audio engine, app-view routing or Show Manager availability check; clicking an option only
// moves the highlight. `children` is the lab's own design switcher, placed between the options and the footer.

type NavId = 'react' | 'presetManager' | 'showManager' | 'lyrics' | 'media'

const OPTIONS: { id: NavId; label: string; icon: AppIconKind }[] = [
  { id: 'react', label: 'React', icon: 'navReact' },
  { id: 'presetManager', label: 'Preset Manager', icon: 'navPreset' },
  { id: 'showManager', label: 'Show Manager', icon: 'navShow' },
  { id: 'lyrics', label: 'Lyric Manager', icon: 'navLyrics' },
  { id: 'media', label: 'Media Manager', icon: 'navMedia' },
]

export function LayoutLabReactNav({ children }: { children?: ReactNode }) {
  const [active, setActive] = useState<NavId>('react')

  return (
    <>
      <nav className="az-nav">
        {OPTIONS.map(option => (
          <div key={option.id} style={{ display: 'contents' }}>
            {option.id === 'presetManager' && <div className="az-nav-section-label">Managers</div>}
            <button
              type="button"
              className={`az-nav-item${active === option.id ? ' az-nav-item--active' : ''}`}
              onClick={() => setActive(option.id)}
              title={option.label}
              aria-label={option.label}
              aria-current={active === option.id ? 'page' : undefined}
            >
              <span className="az-nav-fill" aria-hidden="true" />
              <AppIcon kind={option.icon} size={28} />
              <span className="az-nav-label">{option.label}</span>
            </button>
          </div>
        ))}
      </nav>

      {children}

      <div className="az-sidebar-footer">
        <div className="az-footer-meta">
          <div className="az-license-label">License</div>
          <div className="az-license-type">Professional</div>
          <div className="az-version-row">
            <span className="az-version-text">v3.0.0</span>
            <span className="az-status-dot" />
          </div>
        </div>
      </div>
    </>
  )
}

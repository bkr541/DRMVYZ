import { useState, type ReactNode } from 'react'
import { AppIcon, type AppIconKind } from '../../../../shared/icons/AppIcon'
import { OaLed } from './oaControls'

// ── Option A · navigation spine ────────────────────────────────────────────────────────────────────────────────
//
// A full-height spine at the far left, not a column under the header: the brand disc on top, the five destinations as
// hardware keys with a short caption and an LED for the current one, then the Layout Lab design selector (passed in
// untouched) and the licence readout. The destinations are the production sidebar's (React, Preset / Show / Lyric /
// Media Manager); as there, picking one only moves the highlight in the lab.

type NavId = 'react' | 'presetManager' | 'showManager' | 'lyrics' | 'media'

const OPTIONS: { id: NavId; label: string; caption: string; icon: AppIconKind }[] = [
  { id: 'react', label: 'React', caption: 'React', icon: 'navReact' },
  { id: 'presetManager', label: 'Preset Manager', caption: 'Presets', icon: 'navPreset' },
  { id: 'showManager', label: 'Show Manager', caption: 'Shows', icon: 'navShow' },
  { id: 'lyrics', label: 'Lyric Manager', caption: 'Lyrics', icon: 'navLyrics' },
  { id: 'media', label: 'Media Manager', caption: 'Media', icon: 'navMedia' },
]

export function OptionANav({ children }: { children?: ReactNode }) {
  const [active, setActive] = useState<NavId>('react')

  return (
    <aside className="oa-spine" aria-label="Layout Lab navigation column">
      <button type="button" className="oa-spine__brand" title="DRMVYZ" aria-label="DRMVYZ">
        <span className="oa-spine__disc" aria-hidden="true" />
      </button>

      <nav className="oa-spine__nav" aria-label="Workspaces">
        {OPTIONS.map(option => (
          <div key={option.id} className="oa-spine__item">
            {option.id === 'presetManager' && <span className="oa-spine__section">Managers</span>}
            <button
              type="button"
              className="oa-key"
              data-active={active === option.id ? 'true' : 'false'}
              onClick={() => setActive(option.id)}
              title={option.label}
              aria-label={option.label}
              aria-current={active === option.id ? 'page' : undefined}
            >
              <OaLed on={active === option.id} className="oa-key__led" />
              <AppIcon kind={option.icon} size={24} />
              <span className="oa-key__caption">{option.caption}</span>
            </button>
          </div>
        ))}
      </nav>

      <div className="oa-spine__selector">{children}</div>

      <div className="oa-spine__licence">
        <span>Licence</span>
        <strong>Professional</strong>
        <span className="oa-spine__version">v3.0.0 <OaLed on tone="ice" /></span>
      </div>
    </aside>
  )
}

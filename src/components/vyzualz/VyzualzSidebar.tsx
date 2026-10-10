import { useEffect, useRef, useState } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import type { AppView } from './appView'
import { DeckHardwareGlyph, IsometricStackGlyph, NavIconSvg } from './navIcons'

interface Props {
  compact?: boolean
  appView?: AppView
  onAppViewChange?: (v: AppView) => void
}

export function VyzualzSidebar({
  compact = false,
  appView,
  onAppViewChange,
}: Props) {
  const engine = useSharedAudio()
  const [collapsed, setCollapsed] = useState(compact)
  const isCollapsed = collapsed
  const showManagerUnavailable = engine.source === 'microphone'
  const asideRef = useRef<HTMLElement>(null)

  // Publish the sidebar's live width (it animates between collapsed and expanded) so
  // anything laid out beside it, such as the bottom audio dock, starts at its right edge.
  useEffect(() => {
    const aside = asideRef.current
    const root = aside?.closest<HTMLElement>('.az-root')
    if (!aside || !root) return
    const publish = () => root.style.setProperty('--vz-sidebar-width', `${aside.getBoundingClientRect().width}px`)
    publish()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    observer?.observe(aside)
    return () => {
      observer?.disconnect()
      root.style.removeProperty('--vz-sidebar-width')
    }
  }, [])

  return (
    <aside ref={asideRef} className={`az-sidebar${isCollapsed ? ' az-sidebar--collapsed' : ''}`}>
      <button
        type="button"
        className="az-logo"
        onClick={() => setCollapsed(value => !value)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
      >
        <div className="az-logo-icon">
          <img src="/drmvyz_logo_icon.png" alt="DRMVYZ" />
        </div>
        <div className="az-logo-text">
          <span className="az-logo-mark">DRMVYZ</span>
        </div>
      </button>

      <nav className="az-nav">
        {/* React performance mode icon — default/top view */}
        <button
          type="button"
          className={`az-nav-item${appView === 'react' || !appView ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('react')}
          title="React"
          aria-label="React"
          aria-current={appView === 'react' || !appView ? 'page' : undefined}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <NavIconSvg size={28}><DeckHardwareGlyph kind="react" /></NavIconSvg>
          <span className="az-nav-label">React</span>
        </button>

        <div className="az-nav-section-label">Managers</div>

        {/* Show Manager icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'showManager' ? ' az-nav-item--active' : ''}`}
          onClick={() => {
            if (!showManagerUnavailable) onAppViewChange?.('showManager')
          }}
          title={showManagerUnavailable
            ? 'Show Manager requires a loaded audio track. Switch Live Input back to Track/File first.'
            : 'Show Manager'}
          aria-label="Show Manager"
          aria-current={appView === 'showManager' ? 'page' : undefined}
          aria-disabled={showManagerUnavailable}
          disabled={showManagerUnavailable}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <NavIconSvg size={28}><IsometricStackGlyph kind="show" /></NavIconSvg>
          <span className="az-nav-label">Show Manager</span>
        </button>

        {/* Lyric Manager icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'lyrics' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('lyrics')}
          title="Lyric Manager"
          aria-label="Lyric Manager"
          aria-current={appView === 'lyrics' ? 'page' : undefined}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <NavIconSvg size={28}><DeckHardwareGlyph kind="lyrics" /></NavIconSvg>
          <span className="az-nav-label">Lyric Manager</span>
        </button>

        {/* Media Manager icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'media' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('media')}
          title="Media Manager"
          aria-label="Media Manager"
          aria-current={appView === 'media' ? 'page' : undefined}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <NavIconSvg size={28}><IsometricStackGlyph kind="media" /></NavIconSvg>
          <span className="az-nav-label">Media Manager</span>
        </button>
      </nav>

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
    </aside>
  )
}

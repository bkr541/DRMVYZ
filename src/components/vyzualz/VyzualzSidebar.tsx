import { AppIcon } from '../shared/icons/AppIcon'
import { useEffect, useRef, useState } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { HeaderNotificationsButton } from './shared/HeaderNotificationsButton'
import type { AppPageId } from '../../stores/pageActivityStore'
import { LayoutLabModal } from './react/LayoutLabModal'
import { VyzualzProfileControl } from './shared/VyzualzProfileControl'
import type { AppView } from './appView'

const NOTIFICATION_PAGES: Record<AppView, AppPageId> = { react: 'react', presetManager: 'preset-manager', showManager: 'show-manager', lyrics: 'lyric-manager', media: 'media-manager' }

type Props = {
  compact?: boolean
  appView?: AppView
  onAppViewChange?: (v: AppView) => void
} & (
  | { variant?: 'legacy'; collapsed?: never; onCollapsedChange?: never }
  | { variant: 'floating'; collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void }
)

/** The same brand control moves into the global header in floating mode. */
export function VyzualzBrandToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="az-logo"
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
    >
      <div className="az-logo-icon">
        <AppIcon kind="brand" size={32} />
      </div>
      <div className="az-logo-text">
        <span className="az-logo-mark">DRMVYZ</span>
      </div>
    </button>
  )
}

export function VyzualzSidebar(props: Props) {
  const { compact = false, appView, onAppViewChange } = props
  const notificationPage = NOTIFICATION_PAGES[appView ?? 'react']
  const [layoutLabOpen, setLayoutLabOpen] = useState(false)
  const engine = useSharedAudio()
  const [legacyCollapsed, setLegacyCollapsed] = useState(compact)
  const isCollapsed = props.variant === 'floating' ? props.collapsed : legacyCollapsed
  const toggleCollapsed = () => {
    if (props.variant === 'floating') props.onCollapsedChange(!props.collapsed)
    else setLegacyCollapsed(value => !value)
  }
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
    <aside ref={asideRef} className={`az-sidebar${isCollapsed ? ' az-sidebar--collapsed' : ''}${props.variant === 'floating' ? ' az-sidebar--floating' : ''}`}>
      {props.variant !== 'floating' && (
        <VyzualzBrandToggle collapsed={isCollapsed} onToggle={toggleCollapsed} />
      )}

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
          <AppIcon kind="navReact" size={28} />
          <span className="az-nav-label">React</span>
        </button>

        <div className="az-nav-section-label">Managers</div>

        {/* Preset Manager icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'presetManager' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('presetManager')}
          title="Preset Manager"
          aria-label="Preset Manager"
          aria-current={appView === 'presetManager' ? 'page' : undefined}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <AppIcon kind="navPreset" size={28} />
          <span className="az-nav-label">Preset Manager</span>
        </button>

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
          <AppIcon kind="navShow" size={28} />
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
          <AppIcon kind="navLyrics" size={28} />
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
          <AppIcon kind="navMedia" size={28} />
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
      <div className="az-sidebar-account">
        {props.variant === 'floating' && <button
          type="button"
          className="fw-sidebar-toggle az-sidebar-utility"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          onClick={toggleCollapsed}
        >
          <AppIcon kind="chevronRight" size={24} style={{ transform: isCollapsed ? undefined : 'rotate(180deg)' }} />
        </button>}
        <button
          type="button"
          className="az-sidebar-utility az-sidebar-layout-lab"
          title="Layout Lab"
          aria-label="Layout Lab"
          onClick={() => setLayoutLabOpen(true)}
        >
          <AppIcon kind="sliders" size={24} />
        </button>
        <HeaderNotificationsButton key={notificationPage} page={notificationPage} iconOnly className="az-sidebar-notifications" />
        <VyzualzProfileControl />
      </div>
      {layoutLabOpen && <LayoutLabModal onClose={() => setLayoutLabOpen(false)} />}
    </aside>
  )
}

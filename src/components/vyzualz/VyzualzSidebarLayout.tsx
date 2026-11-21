import type { ReactNode, Ref } from 'react'
import { AppIcon } from '../shared/icons/AppIcon'
import { NavMedallionIcon } from './navMedallionIcons'
import type { AppView } from './appView'
import { BRAND_NAME } from '../../brand'

const NAV_ICON_SIZE = 36

interface SidebarLayoutProps {
  isCollapsed: boolean
  floating: boolean
  appView?: AppView
  onAppViewChange?: (view: AppView) => void
  toggleCollapsed?: () => void
  notched?: boolean
  showManagerUnavailable?: boolean
  isAdmin?: boolean
  asideRef?: Ref<HTMLElement>
  utilityControls?: ReactNode
  notifications: ReactNode
  profile: ReactNode
}

/** Store-free sidebar markup shared by the app and Layout Lab. */
export function VyzualzSidebarLayout({
  isCollapsed, floating, appView, onAppViewChange, toggleCollapsed, showManagerUnavailable = false,
  isAdmin = false, asideRef, utilityControls, notifications, profile, notched = false,
}: SidebarLayoutProps) {
  return (
    <aside ref={asideRef} className={`az-sidebar${isCollapsed ? ' az-sidebar--collapsed' : ''}${floating ? ' az-sidebar--floating' : ''}${notched ? ' az-sidebar--notched' : ''}`}>
      {!floating && toggleCollapsed && (
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
          <NavMedallionIcon kind="navReact" size={NAV_ICON_SIZE} />
          <span className="az-nav-label">React</span>
        </button>

        <div className="az-nav-section-label">Managers</div>

        <button type="button" className={`az-nav-item${appView === 'performanceManager' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('performanceManager')} title="Performance Manager" aria-label="Performance Manager" aria-current={appView === 'performanceManager' ? 'page' : undefined}>
          <span className="az-nav-fill" aria-hidden="true" /><NavMedallionIcon kind="navPerformance" size={NAV_ICON_SIZE} /><span className="az-nav-label">Performance Manager</span>
        </button>

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
          <NavMedallionIcon kind="navPreset" size={NAV_ICON_SIZE} />
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
          <NavMedallionIcon kind="navShow" size={NAV_ICON_SIZE} />
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
          <NavMedallionIcon kind="navLyrics" size={NAV_ICON_SIZE} />
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
          <NavMedallionIcon kind="navMedia" size={NAV_ICON_SIZE} />
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
        {utilityControls}
        {floating && toggleCollapsed && <button
          type="button"
          className="fw-sidebar-toggle az-sidebar-utility"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          onClick={toggleCollapsed}
        >
          <AppIcon kind="chevronRight" size={24} style={{ transform: isCollapsed ? undefined : 'rotate(180deg)' }} />
        </button>}
        {notifications}
        {isAdmin && <button
          type="button"
          className={`az-nav-item az-sidebar-admin${appView === 'admin' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('admin')}
          title="Admin"
          aria-label="Admin"
          aria-current={appView === 'admin' ? 'page' : undefined}
        >
          <span className="az-nav-fill" aria-hidden="true" />
          <NavMedallionIcon kind="navAdmin" size={NAV_ICON_SIZE} />
          <span className="az-nav-label">Admin</span>
        </button>}
        {profile}
      </div>
    </aside>
  )
}

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
        <span className="az-logo-mark">{BRAND_NAME}</span>
      </div>
    </button>
  )
}

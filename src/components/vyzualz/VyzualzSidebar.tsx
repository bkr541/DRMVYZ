import { useState } from 'react'
import type { AppView } from './appView'

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
  const [collapsed, setCollapsed] = useState(false)
  const isCollapsed = compact || collapsed

  return (
    <aside className={`az-sidebar${isCollapsed ? ' az-sidebar--collapsed' : ''}`}>
      <button
        type="button"
        className="az-logo"
        onClick={() => { if (!compact) setCollapsed(value => !value) }}
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
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
            {/* Atom-style orbit rings */}
            <ellipse cx="14" cy="14" rx="11" ry="4.5"
              stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none"/>
            <ellipse cx="14" cy="14" rx="11" ry="4.5"
              stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none"
              transform="rotate(60 14 14)"/>
            <ellipse cx="14" cy="14" rx="11" ry="4.5"
              stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5" fill="none"
              transform="rotate(120 14 14)"/>
            {/* Center nucleus */}
            <circle cx="14" cy="14" r="2.2" fill="currentColor" fillOpacity="0.85"/>
          </svg>
          <span className="az-nav-label">React</span>
        </button>

        {/* Visualizer icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'visualizer' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('visualizer')}
          title="Visualizer"
          aria-label="Visualizer"
          aria-current={appView === 'visualizer' ? 'page' : undefined}
        >
          <svg viewBox="0 0 1024 1024" width="28" height="28">
            {/* Monitor frame */}
            <path d="M960 1002.666667H64a42.666667 42.666667 0 0 1-42.666667-42.666667V64a42.666667 42.666667 0 0 1 42.666667-42.666667h896a42.666667 42.666667 0 0 1 42.666667 42.666667v896a42.666667 42.666667 0 0 1-42.666667 42.666667z" fill="#0d1820"/>
            {/* Screen area */}
            <path d="M64 64h896v682.666667H64z" fill="#091318"/>
            {/* Bottom bar track (unplayed) */}
            <path d="M896 896H597.333333a21.333333 21.333333 0 1 1 0-42.666667h298.666667a21.333333 21.333333 0 1 1 0 42.666667z" fill="#1a2d3a"/>
            {/* Bottom bar (progress) */}
            <path d="M661.333333 896H128a21.333333 21.333333 0 1 1 0-42.666667h533.333333a21.333333 21.333333 0 1 1 0 42.666667z" fill="#4ac7db"/>
            {/* Disc indicator */}
            <path d="M640 960c-47.04 0-85.333333-38.293333-85.333333-85.333333s38.293333-85.333333 85.333333-85.333334 85.333333 38.293333 85.333333 85.333334-38.293333 85.333333-85.333333 85.333333z" fill="#4ac7db"/>
            {/* Play triangle — brightest element, focal point */}
            <path d="M426.666667 554.666667a21.269333 21.269333 0 0 1-21.333334-21.333334V277.333333a21.333333 21.333333 0 0 1 33.173334-17.749333l192 128a21.333333 21.333333 0 0 1 0 35.498667l-192 128A21.333333 21.333333 0 0 1 426.666667 554.666667z" fill="#67f7ff"/>
          </svg>
          <span className="az-nav-label">Visualizer</span>
        </button>

        {/* Show Manager icon */}
        <button
          type="button"
          className={`az-nav-item${appView === 'showManager' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('showManager')}
          title="Show Manager"
          aria-label="Show Manager"
          aria-current={appView === 'showManager' ? 'page' : undefined}
        >
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none" aria-hidden="true">
            <rect x="3.5" y="4" width="21" height="20" rx="2.5" fill="#0d1820" />
            <rect x="3.5" y="4" width="21" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.48" />
            <path d="M10 4v20M18 4v20" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            <path d="M3.5 15.5h21" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" />
            <rect x="11.5" y="7" width="5" height="5" rx="1" fill="currentColor" fillOpacity="0.82" />
            <path d="M5.8 19h2.2M11.2 19h2.2M16.6 19h2.2M22 19h.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M6 21.5h16" stroke="currentColor" strokeWidth="1" strokeOpacity="0.45" />
          </svg>
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
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
            <rect x="4" y="2" width="16" height="21" rx="2.5" fill="#0d1820"/>
            <rect x="4" y="2" width="16" height="21" rx="2.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.45"/>
            <line x1="8" y1="8"  x2="16" y2="8"  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="16" x2="13" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="20" cy="22" r="4" fill="#0d1820" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5"/>
            <path d="M18.8 23.2c0 .66.54 1.2 1.2 1.2s1.2-.54 1.2-1.2-.54-1.2-1.2-1.2-1.2.54-1.2 1.2z" fill="currentColor" fillOpacity="0.8"/>
            <line x1="21.2" y1="22" x2="21.2" y2="19.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            <line x1="21.2" y1="19.6" x2="23" y2="20.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <span className="az-nav-label">Lyrics</span>
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
          <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
            <rect x="3.5" y="5" width="21" height="17" rx="2.5" fill="#0d1820" />
            <rect x="3.5" y="5" width="21" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
            <path d="M7.5 18.2l4.1-4.2 3 2.9 2.1-2.1 3.8 3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="18.8" cy="10.2" r="1.7" fill="currentColor" fillOpacity="0.8" />
            <path d="M9 3.5h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.45" />
            <path d="M9 23.8h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.45" />
          </svg>
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
        {!compact && (
          <button
            className="az-sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor">
              <path d={collapsed
                ? 'M8 4l6 6-6 6-1.4-1.4L11.2 10 6.6 5.4z'
                : 'M12 4L6 10l6 6 1.4-1.4L8.8 10l4.6-4.6z'
              }/>
            </svg>
            <span className="az-nav-label az-toggle-label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        )}
      </div>
    </aside>
  )
}

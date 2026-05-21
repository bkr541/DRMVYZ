import { useState } from 'react'

type AppView = 'visualizer' | 'lyrics'

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
      <div className="az-logo">
        <div className="az-logo-icon">
          <img src="/drmvyz_logo2.png" alt="DRMVYZ" />
        </div>
      </div>

      <nav className="az-nav">
        {/* Visualizer icon */}
        <div
          className={`az-nav-item${appView === 'visualizer' || !appView ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('visualizer')}
          title="Visualizer"
          role="button"
          tabIndex={0}
          aria-label="Visualizer"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onAppViewChange?.('visualizer') }}
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
        </div>

        {/* Lyric Manager icon */}
        <div
          className={`az-nav-item${appView === 'lyrics' ? ' az-nav-item--active' : ''}`}
          onClick={() => onAppViewChange?.('lyrics')}
          title="Lyric Manager"
          role="button"
          tabIndex={0}
          aria-label="Lyric Manager"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onAppViewChange?.('lyrics') }}
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
        </div>
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

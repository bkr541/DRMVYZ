import { useState } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
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
  const engine = useSharedAudio()
  const [collapsed, setCollapsed] = useState(compact)
  const isCollapsed = collapsed
  const showManagerUnavailable = engine.source === 'microphone'

  return (
    <aside className={`az-sidebar${isCollapsed ? ' az-sidebar--collapsed' : ''}`}>
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
          <svg viewBox="0 0 52 52" width="28" height="28" fill="none">
            <g fill="currentColor">
              <path d="M50,6c0-2.2-1.8-4-4-4H6C3.8,2,2,3.8,2,6v27.7c0,2.2,1.8,4,4,4h40c2.2,0,4-1.8,4-4V6z M44,30.2
                c0,0.8-0.7,1.5-1.5,1.5h-33C8.7,31.7,8,31,8,30.2V9.5C8,8.7,8.7,8,9.5,8h33C43.3,8,44,8.7,44,9.5V30.2z M19,44c-2.2,0-4,1.8-4,4
                v0.5c0,0.8,0.7,1.5,1.5,1.5h19c0.8,0,1.5-0.7,1.5-1.5V48c0-2.2-1.8-4-4-4H19z"/>
            </g>
            <path d="M18,26.7h-4.1c-0.6,0-1-0.5-1-1V14c0-0.6,0.4-1,1-1H18c0.5,0,1,0.4,1,1v11.7C19,26.3,18.5,26.7,18,26.7z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M38.1,26.7H24.8c-0.6,0-1-0.4-1-1V14c0-0.6,0.4-1,1-1h13.3c0.5,0,1,0.4,1,1v11.7
              C39.1,26.3,38.6,26.7,38.1,26.7z" fill="currentColor" fillOpacity="0.85"/>
          </svg>
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
          <span className="az-nav-fill" aria-hidden="true" />
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <path d="M27,12.994l0.009,-6.035c-0,-0.53 -0.211,-1.039 -0.586,-1.414c-0.375,-0.375 -0.884,-0.586 -1.414,-0.586c-4.185,0 -13.824,0 -18.009,0c-0.53,0 -1.039,0.211 -1.414,0.586c-0.375,0.375 -0.586,0.884 -0.586,1.414c0,4.184 0,13.817 0,18c-0,0.531 0.211,1.04 0.586,1.415c0.375,0.375 0.884,0.585 1.414,0.585l6,0.039"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.004,10l13.983,0c0.552,0 1,-0.448 1,-1c0,-0.552 -0.448,-1 -1,-1l-13.983,0c-0.552,0 -1,0.448 -1,1c0,0.552 0.448,1 1,1Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.004,13.994l13.983,0c0.552,0 1,-0.448 1,-1c0,-0.552 -0.448,-1 -1,-1l-13.983,0c-0.552,0 -1,0.448 -1,1c0,0.552 0.448,1 1,1Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.004,18l5.981,0c0.552,-0 1,-0.448 1,-1c-0,-0.552 -0.448,-1 -1,-1l-5.981,0c-0.552,-0 -1,0.448 -1,1c0,0.552 0.448,1 1,1Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M9.004,22.006l5.981,-0c0.552,-0 1,-0.448 1,-1c-0,-0.552 -0.448,-1 -1,-1l-5.981,-0c-0.552,-0 -1,0.448 -1,1c0,0.552 0.448,1 1,1Z" fill="currentColor" fillOpacity="0.85"/>
            <path d="M18.003,23.922l-0.001,0c-1.105,0 -2.002,0.897 -2.002,2.002c-0,1.105 0.897,2.002 2.002,2.002c1.104,-0 2.001,-0.897 2.001,-2.002l0,-7.122c0,-0 6.001,-0.75 6.001,-0.75l0.003,3.867c-1.105,-0 -2.002,0.897 -2.002,2.002c0,1.104 0.897,2.001 2.002,2.001c1.105,0 2.002,-0.897 2.002,-2.001l-0.006,-7.003c0,-0.286 -0.123,-0.559 -0.338,-0.749c-0.215,-0.19 -0.501,-0.278 -0.786,-0.242l-8,1c-0.5,0.062 -0.876,0.488 -0.876,0.992l0,6.003Z" fill="currentColor"/>
          </svg>
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
      </div>
    </aside>
  )
}

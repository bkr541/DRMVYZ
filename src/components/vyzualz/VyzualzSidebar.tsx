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
          <svg viewBox="0 0 16 16" width="28" height="28" fill="none">
            <path d="M1 11a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" fill="currentColor"/>
            <path d="M6.75 15c-1.5293 0 -2.97425 -0.74335 -3.86525 -1.98855l0.81325 -0.5819C4.40175 13.4129 5.5426 14 6.75 14c1.9845 0 3.6289 -1.5501 3.74365 -3.52895l0.9983 0.05785c-0.1454 2.50715 -2.22825 4.47105 -4.74195 4.47105Z" fill="currentColor"/>
            <path d="M13 11.5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" fill="currentColor"/>
            <path d="m15.32055 9.5474 -0.96215 -0.27245c0.094 -0.3319 0.1416 -0.67675 0.1416 -1.02495 0 -2.06775 -1.68225 -3.75 -3.75 -3.75 -0.53845 0 -1.05785 0.1115 -1.5438 0.3314l-0.41235 -0.911C9.4103 3.6414 10.0684 3.5 10.75005 3.5c2.61915 0 4.75 2.13085 4.75 4.75 0 0.44035 -0.0604 0.87685 -0.17945 1.2974Z" fill="currentColor"/>
            <path d="m10.20705 7.29295 -1.5 -1.5C8.51835 5.604 8.2671 5.5 8 5.5s-0.5183 0.104 -0.70715 0.29295l-1.4999 1.5C5.598 7.48775 5.5 7.7439 5.5 8s0.098 0.5122 0.29295 0.70705l1.4999 1.5C7.4817 10.396 7.7329 10.5 8 10.5s0.5183 -0.104 0.70705 -0.29295l1.5 -1.5C10.402 8.51225 10.5 8.2561 10.5 8s-0.098 -0.5122 -0.29295 -0.70705ZM8 9.5l-1.5 -1.5 1.5 -1.5 1.4999 1.5L8 9.5Z" fill="currentColor"/>
            <path d="M7 1.5a1 1 0 1 0 2 0 1 1 0 1 0 -2 0" fill="currentColor"/>
            <path d="M4.0127 9.94105C2.46275 9.11215 1.5 7.50625 1.5 5.75c0 -2.51355 1.96385 -4.5965 4.47105 -4.74195l0.05785 0.9983C4.05 2.1212 2.49995 3.76565 2.49995 5.75c0 1.3866 0.7604 2.6546 1.9844 3.3092l-0.4717 0.88185Z" fill="currentColor"/>
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
          <svg viewBox="0 0 16 16" width="28" height="28" fill="none" aria-hidden="true">
            <path d="M13 6c-1.10455 0 -2 0.8954 -2 2s0.89545 2 2 2 2 -0.89545 2 -2 -0.8954 -2 -2 -2Zm0 3c-0.5514 0 -1 -0.4486 -1 -1s0.4486 -1 1 -1 1 0.4486 1 1 -0.4486 1 -1 1Z" fill="currentColor"/>
            <path d="M7.5 10.5v1h1.29295l-1.1504 1.1504C7.447 12.55665 7.2308 12.5 6.99995 12.5c-0.82715 0 -1.5 0.67285 -1.5 1.5s0.67285 1.5 1.5 1.5 1.5 -0.67285 1.5 -1.5c0 -0.23095 -0.05675 -0.447 -0.15025 -0.6426l1.15025 -1.1504v1.29295h1v-3h-3Zm-0.5 4c-0.27575 0 -0.5 -0.22435 -0.5 -0.5s0.22425 -0.5 0.5 -0.5 0.5 0.22435 0.5 0.5 -0.22425 0.5 -0.5 0.5Z" fill="currentColor"/>
            <path d="M5.70715 5.70705 5 6.41435l1.0858 1.0857h-2.178c-0.20705 -0.58055 -0.75685 -1 -1.40785 -1 -0.82715 0 -1.5 0.67285 -1.5 1.5s0.67285 1.5 1.5 1.5c0.651 0 1.2008 -0.41945 1.40785 -1h2.178L5 9.58575l0.70715 0.7073L8 8.0001l-2.29285 -2.29295ZM2.5 8.5c-0.27575 0 -0.5 -0.22435 -0.5 -0.5s0.22425 -0.5 0.5 -0.5 0.5 0.22435 0.5 0.5 -0.22425 0.5 -0.5 0.5Z" fill="currentColor"/>
            <path d="M9.5 2.5v1.29295l-1.15025 -1.1504c0.0935 -0.19555 0.15025 -0.4116 0.15025 -0.6426 0 -0.82715 -0.67285 -1.5 -1.5 -1.5s-1.5 0.67285 -1.5 1.5 0.67285 1.5 1.5 1.5c0.23085 0 0.447 -0.05665 0.6426 -0.1504l1.1504 1.1504h-1.29295v1h3v-3h-1Zm-3 -0.5c0 -0.27565 0.22425 -0.5 0.5 -0.5s0.5 0.22435 0.5 0.5 -0.22425 0.5 -0.5 0.5 -0.5 -0.22435 -0.5 -0.5Z" fill="currentColor"/>
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
          <svg viewBox="0 0 16 16" width="28" height="28" fill="none">
            <path d="M3 11.5h2.5v1H3Z" fill="currentColor"/>
            <path d="M3 9.5h2.5v1H3Z" fill="currentColor"/>
            <path d="M6.5 15H2c-0.55 0 -1 -0.45 -1 -1V8.5c0 -0.55 0.45 -1 1 -1h4.5c0.55 0 1 0.45 1 1v5.5c0 0.55 -0.45 1 -1 1zM2 8.5v5.5h4.5V8.5H2z" fill="currentColor"/>
            <path d="M9.5 1h4v1h-4Z" fill="currentColor"/>
            <path d="M11 3h4v1h-4Z" fill="currentColor"/>
            <path d="M11 5h4v1h-4Z" fill="currentColor"/>
            <path d="M9.5 7h4v1h-4Z" fill="currentColor"/>
            <path d="M11 9h4v1h-4Z" fill="currentColor"/>
            <path d="m6 0.5 -0.7 0.7L6.6 2.5H2c-0.55 0 -1 0.45 -1 1v2.5h1V3.5h4.6l-1.3 1.3L6 5.5l2.5 -2.5 -2.5 -2.5z" fill="currentColor"/>
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
          <svg viewBox="0 0 16 16" width="28" height="28" fill="none">
            <path d="m4.5 9.5 0 3 2.5 -1.5z" fill="currentColor"/>
            <path d="M5.5 8c1.65 0 3 1.35 3 3s-1.35 3 -3 3 -3 -1.35 -3 -3 1.35 -3 3 -3m0 -1c-2.2 0 -4 1.8 -4 4s1.8 4 4 4 4 -1.8 4 -4 -1.8 -4 -4 -4z" fill="currentColor"/>
            <path d="M2 3v3h11v7h-2v1h2c0.55 0 1 -0.45 1 -1V3c0 -0.55 -0.45 -1 -1 -1H3c-0.55 0 -1 0.45 -1 1zm1 2V3h10v2H3z" fill="currentColor"/>
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

import { useState } from 'react'

interface Props {
  activeView?: 'analyzer' | 'reference' | 'vyzualz'
  onNavigate?: (v: 'analyzer' | 'reference' | 'vyzualz') => void
  compact?: boolean
}

export function AnalyzerSidebar({ activeView = 'analyzer', onNavigate, compact = false }: Props) {
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
        <div
          className="az-nav-item az-nav-item--active"
          title="Vyzualz"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor">
            <path d="M2 10c0-.3.02-.6.05-.9L1 8.5l1.5-2.6 1.15.48A6.97 6.97 0 0 1 5.5 5.1L5.75 4h3l.25 1.1c.68.3 1.3.72 1.85 1.28L12 5.9l1.5 2.6-1.05.6c.03.3.05.6.05.9s-.02.6-.05.9l1.05.6-1.5 2.6-1.15-.48c-.55.56-1.17.98-1.85 1.28L8.75 16h-3l-.25-1.1A6.97 6.97 0 0 1 3.65 13.6L2.5 14.1 1 11.5l1.05-.6A7.05 7.05 0 0 1 2 10zm3.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z"/>
          </svg>
          <span className="az-nav-label">Vyzualz</span>
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

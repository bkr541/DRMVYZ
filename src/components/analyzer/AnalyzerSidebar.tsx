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
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <path d="M27 4H5C3.34315 4 2 5.34315 2 7V25C2 26.6569 3.34315 28 5 28H27C28.6569 28 30 26.6569 30 25V7C30 5.34315 28.6569 4 27 4Z" fill="#0d1820"/>
            <path d="M25 24H7C6.73478 24 6.48043 23.8946 6.29289 23.7071C6.10536 23.5196 6 23.2652 6 23C6 22.7348 6.10536 22.4804 6.29289 22.2929C6.48043 22.1054 6.73478 22 7 22H25C25.2652 22 25.5196 22.1054 25.7071 22.2929C25.8946 22.4804 26 22.7348 26 23C26 23.2652 25.8946 23.5196 25.7071 23.7071C25.5196 23.8946 25.2652 24 25 24Z" fill="#4ac7db"/>
            <path d="M19 25C18.7348 25 18.4804 24.8946 18.2929 24.7071C18.1054 24.5196 18 24.2652 18 24V22C18 21.7348 18.1054 21.4804 18.2929 21.2929C18.4804 21.1054 18.7348 21 19 21C19.2652 21 19.5196 21.1054 19.7071 21.2929C19.8946 21.4804 20 21.7348 20 22V24C20 24.2652 19.8946 24.5196 19.7071 24.7071C19.5196 24.8946 19.2652 25 19 25Z" fill="#4ac7db"/>
            <path d="M20.45 12.67L13.45 9.17C13.3 9.09 13.13 9.06 12.96 9.06C12.79 9.07 12.62 9.12 12.48 9.21C12.33 9.3 12.21 9.42 12.13 9.57C12.04 9.72 12 9.89 12 10.06V17.94C12 18.12 12.05 18.29 12.14 18.45C12.23 18.6 12.36 18.72 12.52 18.81C12.66 18.9 12.83 18.94 13 18.94C13.19 18.94 13.37 18.89 13.53 18.79L20.53 14.41C20.68 14.32 20.81 14.18 20.89 14.02C20.97 13.87 21.01 13.69 21 13.51C20.99 13.33 20.93 13.16 20.84 13.02C20.74 12.87 20.61 12.75 20.45 12.67Z" fill="#4ac7db"/>
            <path d="M5 4C4.20435 4 3.44129 4.31607 2.87868 4.87868C2.31607 5.44129 2 6.20435 2 7V25C2 25.7956 2.31607 26.5587 2.87868 27.1213C3.44129 27.6839 4.20435 28 5 28H16V4H5Z" fill="#091318"/>
            <path d="M7 22C6.73478 22 6.48043 22.1054 6.29289 22.2929C6.10536 22.4804 6 22.7348 6 23C6 23.2652 6.10536 23.5196 6.29289 23.7071C6.48043 23.8946 6.73478 24 7 24H16V22H7Z" fill="#4ac7db"/>
            <path d="M13.45 9.17C13.3 9.09 13.13 9.06 12.96 9.06C12.79 9.07 12.62 9.12 12.48 9.21C12.33 9.3 12.21 9.42 12.13 9.57C12.04 9.72 12 9.89 12 10.06V17.94C12 18.12 12.05 18.29 12.14 18.45C12.23 18.6 12.36 18.72 12.52 18.81C12.66 18.9 12.83 18.94 13 18.94C13.19 18.94 13.37 18.89 13.53 18.79L16 17.24V10.44L13.45 9.17Z" fill="#67f7ff"/>
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

export function AnalyzerSidebar() {
  return (
    <aside className="az-sidebar">
      <div className="az-logo">
        <div className="az-logo-icon">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
            <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9-4-9-9-9zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zM7 16c0-2.8 2.2-5 5-5s5 2.2 5 5H7z"/>
          </svg>
        </div>
        <div className="az-logo-text">
          <div className="az-logo-mark">DRMVYZ</div>
          <div className="az-logo-sub">PRO STUDIO</div>
        </div>
      </div>

      <nav className="az-nav">
        <div className="az-nav-item az-nav-item--active">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
            <path d="M3 3h14v2H3V3zm0 4h2v10H3V7zm4 3h2v7H7v-7zm4-2h2v9h-2V8zm4 3h2v6h-2v-6z"/>
          </svg>
          Analyzer
        </div>
      </nav>

      <div className="az-sidebar-footer">
        <div className="az-license-label">License</div>
        <div className="az-license-type">Professional</div>
        <div className="az-version-row">
          <span className="az-version-text">v3.0.0</span>
          <span className="az-status-dot" />
        </div>
      </div>
    </aside>
  )
}

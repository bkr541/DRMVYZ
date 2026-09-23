import { useState } from 'react'
import { DeveloperLoggingPanel } from './DeveloperLoggingPanel'

type DeveloperGroupId = 'logging' | 'feature-flags' | 'network' | 'performance' | 'storage'

const DEVELOPER_GROUPS: Array<{ id: DeveloperGroupId; label: string }> = [
  { id: 'logging', label: 'Logging' },
  { id: 'feature-flags', label: 'Feature Flags' },
  { id: 'network', label: 'Network' },
  { id: 'performance', label: 'Performance' },
  { id: 'storage', label: 'Storage' },
]

function DeveloperPlaceholderGroup({ label }: { label: string }) {
  return (
    <div className="vsm-dev-placeholder">
      <h2>{label}</h2>
      <p>Coming soon.</p>
    </div>
  )
}

/** Settings → Developer: a secondary nav (same shape as the outer Settings
 * nav) so the Logging group can use the full panel width/height for its table. */
export function DeveloperPanel() {
  const [group, setGroup] = useState<DeveloperGroupId>('logging')

  return (
    <div className="vsm-dev-panel">
      <nav className="vsm-nav vsm-dev-nav" role="tablist" aria-label="Developer sections">
        {DEVELOPER_GROUPS.map(item => (
          <button
            key={item.id}
            id={`vsm-dev-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={group === item.id}
            aria-controls={`vsm-dev-panel-${item.id}`}
            tabIndex={group === item.id ? 0 : -1}
            className={`vsm-nav-item${group === item.id ? ' vsm-nav-item--active' : ''}`}
            onClick={() => setGroup(item.id)}
            onKeyDown={event => {
              const index = DEVELOPER_GROUPS.findIndex(candidate => candidate.id === item.id)
              const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1
                : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1
                  : 0
              if (!delta) return
              event.preventDefault()
              const next = DEVELOPER_GROUPS[(index + delta + DEVELOPER_GROUPS.length) % DEVELOPER_GROUPS.length]
              setGroup(next.id)
              requestAnimationFrame(() => document.getElementById(`vsm-dev-tab-${next.id}`)?.focus())
            }}
          >{item.label}</button>
        ))}
      </nav>
      <div
        id={`vsm-dev-panel-${group}`}
        className="vsm-dev-content"
        role="tabpanel"
        aria-labelledby={`vsm-dev-tab-${group}`}
        tabIndex={0}
      >
        {group === 'logging' && <DeveloperLoggingPanel />}
        {group === 'feature-flags' && <DeveloperPlaceholderGroup label="Feature Flags" />}
        {group === 'network' && <DeveloperPlaceholderGroup label="Network" />}
        {group === 'performance' && <DeveloperPlaceholderGroup label="Performance" />}
        {group === 'storage' && <DeveloperPlaceholderGroup label="Storage" />}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { PanelSubtabs } from '../../react/PanelSubtabs'
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

/** Settings → Developer: a horizontal sub-tab row (same widget the SYSTEM/USER
 * preset scope tabs use elsewhere) above a full-width/height content pane, so
 * the Logging group can give its table the whole panel to work with. */
export function DeveloperPanel() {
  const [group, setGroup] = useState<DeveloperGroupId>('logging')

  return (
    <div className="vsm-dev-panel">
      <PanelSubtabs
        value={group}
        options={DEVELOPER_GROUPS}
        onChange={setGroup}
        ariaLabel="Developer sections"
      />
      <div className="vsm-dev-content" role="tabpanel" aria-label={`Developer — ${DEVELOPER_GROUPS.find(item => item.id === group)?.label}`}>
        {group === 'logging' && <DeveloperLoggingPanel />}
        {group === 'feature-flags' && <DeveloperPlaceholderGroup label="Feature Flags" />}
        {group === 'network' && <DeveloperPlaceholderGroup label="Network" />}
        {group === 'performance' && <DeveloperPlaceholderGroup label="Performance" />}
        {group === 'storage' && <DeveloperPlaceholderGroup label="Storage" />}
      </div>
    </div>
  )
}

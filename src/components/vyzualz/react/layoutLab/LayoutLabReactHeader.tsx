import { useState } from 'react'
import { AppIcon } from '../../../shared/icons/AppIcon'
import { HeaderControlGroup } from '../../layout/HeaderControlGroup'
import { NotificationBellIcon } from '../../shared/NotificationDrawer'
import { VyzualzBrandToggle } from '../../VyzualzSidebar'
import { buildReactHeaderMetrics, MetricChip } from '../ReactHeaderPerformanceStatus'

// ── Layout Lab · header group · React ───────────────────────────────────────
//
// A disconnected mockup of the elements React View puts in the application header: the brand toggle, the global output
// controls in the centred control group, the Layout Lab button, the status cluster (Loading / Saved, FPS / Frame Time,
// Quality / CPU, Notifications) and the profile button. It reuses production's own pieces where they are presentational
// (the brand toggle, the header control group, the metric chip and metrics builder, the bell icon) and the production
// classes everywhere else, with fixed readings instead of the stores, output controller, CPU probe and account lookup.
// The controls look like production's output-preview state (Reveal and Blackout idle) and nothing here acts on anything.

const METRICS = buildReactHeaderMetrics({ fps: 60, frameTimeMs: 16.6, qualityTier: 'high' })

/** `optionLabel` (e.g. "Option A") is the design's name, shown beside the brand toggle at the top left of the header group. */
export function LayoutLabReactHeader({ optionLabel }: { optionLabel?: string } = {}) {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <>
      <div className="ll-header-lead">
        <VyzualzBrandToggle collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
        {optionLabel && <span className="ll-option-label">{optionLabel}</span>}
      </div>
      <div className="fw-app-header-controls" data-app-header-slot="controls">
        <div className="vz-header" data-react-header-controls>
          <HeaderControlGroup label="React controls">
            <div className="rv-header-output">
              <div className="rv-global-output" aria-label="Global performance output">
                <button type="button" className="rv-global-output-status" disabled aria-label="OUTPUT PREVIEW" title="Production output controls become available when LaserDMX is active">
                  <span className="rv-global-output-dot" aria-hidden="true" />
                  <AppIcon kind="power" className="rv-global-output-icon" />
                  <span className="rv-global-output-label">OUTPUT PREVIEW</span>
                </button>
                <button type="button" className="rv-global-output-reveal" disabled aria-label="Reveal output" title="Reveal output">
                  <AppIcon kind="eye" className="rv-global-output-icon" />
                  <span className="rv-global-output-label">Reveal</span>
                </button>
                <button type="button" className="rv-global-output-blackout" disabled aria-label="Blackout output" title="Blackout output">
                  <AppIcon kind="blackout" className="rv-global-output-icon" />
                  <span className="rv-global-output-label">Blackout</span>
                </button>
              </div>
            </div>
          </HeaderControlGroup>

          <span className="az-spacer" />
          <button type="button" className="vsm-settings-btn" title="Layout Lab" aria-label="Layout Lab">
            <AppIcon kind="sliders" size="18" />
          </button>

          <div className="rv-header-status" data-react-header-status>
            <div className="rv-header-status-stack" data-header-stack="loading+saved">
              <span
                className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--labeled vz-header-activity"
                data-busy="false"
                role="status"
                aria-label="Nothing loading"
                title="Nothing loading"
              >
                <span className="vz-header-state-label">Loading</span>
                <AppIcon kind="loading" size={18} className="vz-header-activity-ring" signalClassName="vz-header-activity-arc" />
              </span>
              <div className="rv-persistence-status vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--save-state rv-persistence-status--saved" data-save-tone="saved" role="status">
                <span className="vz-header-state-label">Saved</span>
                <span className="vz-header-state-value">11:31 AM</span>
              </div>
            </div>
            <div className="rv-header-status-stack" data-header-stack="fps+frame-time">
              <MetricChip {...METRICS.fps} />
              <MetricChip {...METRICS.frameTime} />
            </div>
            <div className="rv-header-status-stack" data-header-stack="quality+cpu">
              <MetricChip {...METRICS.quality} />
              <span
                className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--cpu vz-header-cpu"
                data-cpu-status="ready"
                data-cpu-level="low"
                title="App CPU usage"
                aria-label="App CPU usage 0 percent"
              >
                <span className="vz-header-cpu-label" aria-hidden="true">CPU</span>
                <span className="vz-header-cpu-value" aria-hidden="true">0%</span>
              </span>
            </div>
            <button
              type="button"
              className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--labeled vz-header-notifications"
              aria-label="Notifications"
              title="Notifications"
            >
              <span className="vz-header-state-label">Notifications</span>
              <NotificationBellIcon />
            </button>
          </div>

          <button type="button" className="vz-header-avatar" title="Profile">
            <span className="vz-header-avatar-initials">DV</span>
          </button>
        </div>
      </div>
    </>
  )
}

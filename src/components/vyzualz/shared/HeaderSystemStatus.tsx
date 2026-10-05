import { useAppCpuUsage } from '../../../native/useAppCpuUsage'
import { usePageActivityLabels } from '../../../stores/pageActivityStore'
import type { AppPageId } from '../../../stores/pageActivityStore'

function ActivitySpinner({ busy }: { busy: boolean }) {
  return (
    <svg className="vz-header-activity-ring" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.28" />
      <circle
        className={busy ? 'vz-header-activity-arc vz-header-activity-arc--spinning' : 'vz-header-activity-arc'}
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="14 43"
      />
    </svg>
  )
}

/**
 * Header status cluster shown left of the profile icon on every page: the app's CPU usage and a
 * circular activity indicator. The indicator animates (in the accent colour) while anything on
 * this page is loading and rests in the same gray as the header's icon buttons otherwise.
 */
export function HeaderSystemStatus({ page }: { page: AppPageId }) {
  const cpu = useAppCpuUsage()
  const activity = usePageActivityLabels(page)
  const busy = activity.length > 0

  const cpuText = cpu.status === 'ready' ? `${Math.round(cpu.usage.percent)}%` : cpu.status === 'measuring' ? '…' : '—'
  const cpuTitle = cpu.status === 'ready'
    ? `App CPU usage: ${cpu.usage.percent.toFixed(1)}% of this computer across ${cpu.usage.processCount} processes (${Math.round(cpu.usage.rawPercent)}% of one core)`
    : cpu.status === 'measuring'
      ? 'Measuring app CPU usage…'
      : 'App CPU usage is only available in the desktop app'

  return (
    <>
      <span
        className="vsm-settings-btn vz-header-status-chip vz-header-cpu"
        data-cpu-status={cpu.status}
        title={cpuTitle}
        aria-label={cpu.status === 'ready' ? `App CPU usage ${Math.round(cpu.usage.percent)} percent` : cpuTitle}
      >
        <span className="vz-header-cpu-label" aria-hidden="true">CPU</span>
        <span className="vz-header-cpu-value" aria-hidden="true">{cpuText}</span>
      </span>
      <span
        className="vsm-settings-btn vz-header-status-chip vz-header-activity"
        data-busy={busy ? 'true' : 'false'}
        role="status"
        aria-live="polite"
        aria-label={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
        title={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
      >
        <ActivitySpinner busy={busy} />
      </span>
    </>
  )
}

import { useAppCpuUsage } from '../../../native/useAppCpuUsage'
import { usePageActivityLabels } from '../../../stores/pageActivityStore'
import type { AppPageId } from '../../../stores/pageActivityStore'
import { HeaderNotificationsButton } from './HeaderNotificationsButton'

/** Low under 25% of the computer, medium under 60%, high above. */
function cpuLevel(percent: number) {
  return percent < 25 ? 'low' : percent < 60 ? 'medium' : 'high'
}

function ActivitySpinner({ busy }: { busy: boolean }) {
  return (
    <svg
      className="vz-header-activity-ring"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.28" />
      <path className={busy ? 'vz-header-activity-arc vz-header-activity-arc--spinning' : 'vz-header-activity-arc'} d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  )
}

/**
 * Header status cluster shown left of the profile icon on every page: the app's CPU usage, a
 * circular activity indicator and the Notifications bell. The indicator animates (in the accent colour) while anything on
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
        className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--cpu vz-header-cpu"
        data-cpu-status={cpu.status}
        data-cpu-level={cpu.status === 'ready' ? cpuLevel(cpu.usage.percent) : undefined}
        title={cpuTitle}
        aria-label={cpu.status === 'ready' ? `App CPU usage ${Math.round(cpu.usage.percent)} percent` : cpuTitle}
      >
        <span className="vz-header-cpu-label" aria-hidden="true">CPU</span>
        <span className="vz-header-cpu-value" aria-hidden="true">{cpuText}</span>
      </span>
      <span
        className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-chip--square vz-header-activity"
        data-busy={busy ? 'true' : 'false'}
        role="status"
        aria-live="polite"
        aria-label={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
        title={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
      >
        <ActivitySpinner busy={busy} />
      </span>
      <HeaderNotificationsButton page={page} />
    </>
  )
}

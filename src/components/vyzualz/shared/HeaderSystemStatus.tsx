import { AppIcon } from '../../shared/icons/AppIcon'
import { useAppCpuUsage } from '../../../native/useAppCpuUsage'
import { usePageActivityLabels } from '../../../stores/pageActivityStore'
import type { AppPageId } from '../../../stores/pageActivityStore'

/** Low under 25% of the computer, medium under 60%, high above. */
function cpuLevel(percent: number) {
  return percent < 25 ? 'low' : percent < 60 ? 'medium' : 'high'
}

function ActivitySpinner({ busy }: { busy: boolean }) {
  return <AppIcon
    kind="loading"
    size={18}
    className="vz-header-activity-ring"
    signalClassName={busy ? 'vz-header-activity-arc vz-header-activity-arc--spinning' : 'vz-header-activity-arc'}
  />
}

/** The app CPU readout chip. Exported on its own so a page can lay the status elements out differently. */
export function HeaderCpuChip() {
  const cpu = useAppCpuUsage()
  const cpuText = cpu.status === 'ready' ? `${Math.round(cpu.usage.percent)}%` : cpu.status === 'measuring' ? '…' : '—'
  const cpuTitle = cpu.status === 'ready'
    ? `App CPU usage: ${cpu.usage.percent.toFixed(1)}% of this computer across ${cpu.usage.processCount} processes (${Math.round(cpu.usage.rawPercent)}% of one core)`
    : cpu.status === 'measuring'
      ? 'Measuring app CPU usage…'
      : 'App CPU usage is only available in the desktop app'

  return (
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
  )
}

/** The Loading chip: a spinner that animates while anything on `page` is loading. */
export function HeaderActivityChip({ page }: { page: AppPageId }) {
  const activity = usePageActivityLabels(page)
  const busy = activity.length > 0
  return (
    <span
      className={`vsm-settings-btn vz-header-status-chip vz-header-chip ${page === 'react' ? 'vz-header-chip--labeled' : 'vz-header-chip--square'} vz-header-activity`}
      data-busy={busy ? 'true' : 'false'}
      role="status"
      aria-live="polite"
      aria-label={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
      title={busy ? `Loading: ${activity.join(', ')}` : 'Nothing loading'}
    >
      {page === 'react' && <span className="vz-header-state-label">Loading</span>}
      <ActivitySpinner busy={busy} />
    </span>
  )
}

/**
 * Header status cluster: the app's CPU usage and a circular activity indicator. The indicator animates (in the accent colour) while anything on
 * this page is loading and rests in the same gray as the header's icon buttons otherwise.
 */
export function HeaderSystemStatus({ page }: { page: AppPageId }) {
  return (
    <>
      <HeaderCpuChip />
      <HeaderActivityChip page={page} />
    </>
  )
}

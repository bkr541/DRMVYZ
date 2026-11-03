import { useAppCpuUsage } from '../../../native/useAppCpuUsage'
import { HeaderReadout } from '../layout/HeaderReadout'
import { buildReactHeaderMetrics, type ReactHeaderQualityTier } from './ReactHeaderPerformanceStatus'
import { ReactPersistenceStatus } from './ReactPersistenceStatus'
import type { AppPageId } from '../../../stores/pageActivityStore'
import type { HeaderSaveTone } from '../shared/HeaderSaveChip'

/** Live readings arranged as Option E's three paired editorial readouts. */
export function ReactHeaderStatusCluster({ fps = 0, frameTimeMs, qualityTier, page = 'react', saveStatus }: {
  fps?: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
  page?: AppPageId
  saveStatus?: { label: string; tone: HeaderSaveTone }
}) {
  const metrics = buildReactHeaderMetrics({ fps, frameTimeMs, qualityTier })
  const cpu = useAppCpuUsage()
  const cpuText = cpu.status === 'ready' ? `${Math.round(cpu.usage.percent)}%` : cpu.status === 'measuring' ? '…' : '—'
  const cpuTitle = cpu.status === 'ready' ? `App CPU usage: ${cpu.usage.percent.toFixed(1)}% across ${cpu.usage.processCount} processes` : 'App CPU usage is only available in the desktop app'
  return <div className="rv-header-status" data-react-header-status>
    <ReactPersistenceStatus presentation="readout" page={page} saveStatus={saveStatus} />
    <HeaderReadout label="RENDER / FPS" title={`${metrics.fps.title}; ${metrics.frameTime.title}`}>
      <strong className="vz-header-readout-primary" data-performance-metric="fps" aria-label={`FPS ${metrics.fps.value}`}>{metrics.fps.value}</strong>
      <em data-performance-metric="frame-time" aria-label={`Frame time ${metrics.frameTime.value}`}>{metrics.frameTime.value.replace(' ms', 'ms')}</em>
    </HeaderReadout>
    <HeaderReadout label="QUALITY / CPU" title={`${metrics.quality.title}; ${cpuTitle}`}>
      <strong className="vz-header-readout-primary" data-performance-metric="quality" aria-label={`Quality ${metrics.quality.value}`}>{metrics.quality.value[0].toUpperCase() + metrics.quality.value.slice(1)}</strong>
      <em data-header-cpu aria-label={cpuTitle}>{cpuText}</em>
    </HeaderReadout>
  </div>
}

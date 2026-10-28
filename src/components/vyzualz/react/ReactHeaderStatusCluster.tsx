import { useAppCpuUsage } from '../../../native/useAppCpuUsage'
import { HeaderReadout } from '../layout/HeaderReadout'
import { buildReactHeaderMetrics, type ReactHeaderQualityTier } from './ReactHeaderPerformanceStatus'
import { ReactPersistenceStatus } from './ReactPersistenceStatus'

/** Live readings arranged as Option E's three paired editorial readouts. */
export function ReactHeaderStatusCluster({ fps, frameTimeMs, qualityTier }: {
  fps: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
}) {
  const metrics = buildReactHeaderMetrics({ fps, frameTimeMs, qualityTier })
  const cpu = useAppCpuUsage()
  const cpuText = cpu.status === 'ready' ? `${Math.round(cpu.usage.percent)}%` : cpu.status === 'measuring' ? '…' : '—'
  const cpuTitle = cpu.status === 'ready' ? `App CPU usage: ${cpu.usage.percent.toFixed(1)}% across ${cpu.usage.processCount} processes` : 'App CPU usage is only available in the desktop app'
  return <div className="rv-header-status" data-react-header-status>
    <ReactPersistenceStatus presentation="readout" />
    <HeaderReadout label="RENDER / FPS" title={`${metrics.fps.title}; ${metrics.frameTime.title}`}>
      <strong className="vz-header-readout-primary" data-performance-metric="fps" aria-label={`FPS ${metrics.fps.value}`}>{metrics.fps.value}</strong>
      <em data-performance-metric="frame-time" aria-label={`Frame time ${metrics.frameTime.value}`}>{metrics.frameTime.value.replace(' ms', 'ms')}</em>
    </HeaderReadout>
    <HeaderReadout label="QUALITY / CPU" title={`${metrics.quality.title}; ${cpuTitle}`}>
      <strong className="vz-header-readout-primary" data-performance-metric="quality" aria-label={`Quality ${metrics.quality.value}`}>{metrics.quality.value.toUpperCase()}</strong>
      <em data-header-cpu aria-label={cpuTitle}>{cpuText}</em>
    </HeaderReadout>
  </div>
}

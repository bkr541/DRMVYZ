import { HeaderActivityChip, HeaderCpuChip } from '../shared/HeaderSystemStatus'
import { HeaderNotificationsButton } from '../shared/HeaderNotificationsButton'
import { buildReactHeaderMetrics, MetricChip, type ReactHeaderQualityTier } from './ReactHeaderPerformanceStatus'
import { ReactPersistenceStatus } from './ReactPersistenceStatus'

/**
 * The React page's header status cluster (Layout Lab → Template → "16 Layered Cards"): Loading stacked over Saved,
 * FPS over Frame Time, Quality over CPU, then the Notifications bell. The stacks are layout only; they carry no
 * border or background, and the metric lines share one label column per stack so their values start at the same x.
 * Every element is the same component the other pages use; only the arrangement and styling differ.
 */
export function ReactHeaderStatusCluster({
  fps,
  frameTimeMs,
  qualityTier,
}: {
  fps: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
}) {
  const metrics = buildReactHeaderMetrics({ fps, frameTimeMs, qualityTier })
  return (
    <div className="rv-header-status" data-react-header-status>
      <div className="rv-header-status-stack" data-header-stack="loading+saved">
        <HeaderActivityChip page="react" />
        <ReactPersistenceStatus />
      </div>
      <div className="rv-header-status-stack" data-header-stack="fps+frame-time">
        <MetricChip {...metrics.fps} />
        <MetricChip {...metrics.frameTime} />
      </div>
      <div className="rv-header-status-stack" data-header-stack="quality+cpu">
        <MetricChip {...metrics.quality} />
        <HeaderCpuChip />
      </div>
      <HeaderNotificationsButton page="react" />
    </div>
  )
}

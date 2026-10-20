export type ReactHeaderQualityTier = 'low' | 'medium' | 'high'

/** Maps the live presentation rate to the three header quality tiers. */
export function qualityTierForFps(fps: number): ReactHeaderQualityTier {
  if (fps <= 0 || fps >= 55) return 'high'
  return fps >= 30 ? 'medium' : 'low'
}

export function MetricChip({
  label,
  value,
  title,
  level,
  metric,
}: {
  label: string
  value: string
  title: string
  level: ReactHeaderQualityTier
  metric: 'fps' | 'frame-time' | 'quality'
}) {
  return (
    <span
      className="vsm-settings-btn vz-header-status-chip vz-header-chip vz-header-cpu vz-header-performance-metric"
      data-performance-metric={metric}
      data-cpu-level={level}
      title={title}
      aria-label={`${label} ${value}`}
    >
      <span className="vz-header-cpu-label" aria-hidden="true">{label}</span>
      <span className="vz-header-cpu-value" aria-hidden="true">{value}</span>
    </span>
  )
}

type MetricChipProps = Parameters<typeof MetricChip>[0]

/** The three performance readings (FPS, Frame Time, Quality) as chip props, so a header can lay them out as it likes. */
export function buildReactHeaderMetrics({
  fps,
  frameTimeMs,
  qualityTier = qualityTierForFps(fps),
}: {
  fps: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
}): { fps: MetricChipProps; frameTime: MetricChipProps; quality: MetricChipProps } {
  const validFps = Number.isFinite(fps) && fps > 0 ? fps : null
  const measuredFrameTime = frameTimeMs != null && Number.isFinite(frameTimeMs) && frameTimeMs > 0
    ? frameTimeMs
    : validFps == null ? null : 1000 / validFps
  const fpsText = validFps == null ? '—' : `${Math.round(validFps)}`
  const frameTimeText = measuredFrameTime == null ? '—' : `${measuredFrameTime.toFixed(1)} ms`
  const fpsLevel = qualityTierForFps(validFps ?? 0)
  return {
    fps: { label: 'FPS', value: fpsText, title: validFps == null ? 'Measuring frames per second…' : `${validFps.toFixed(1)} frames per second`, level: fpsLevel, metric: 'fps' },
    frameTime: { label: 'FRAME TIME', value: frameTimeText, title: measuredFrameTime == null ? 'Measuring frame time…' : `Average frame time ${measuredFrameTime.toFixed(1)} milliseconds`, level: fpsLevel, metric: 'frame-time' },
    quality: { label: 'QUALITY', value: qualityTier, title: `Active quality tier: ${qualityTier}`, level: qualityTier, metric: 'quality' },
  }
}

export function ReactHeaderPerformanceStatus(props: {
  fps: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
}) {
  const metrics = buildReactHeaderMetrics(props)
  return (
    <>
      <MetricChip {...metrics.fps} />
      <MetricChip {...metrics.frameTime} />
      <MetricChip {...metrics.quality} />
    </>
  )
}

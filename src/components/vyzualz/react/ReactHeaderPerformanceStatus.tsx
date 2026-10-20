export type ReactHeaderQualityTier = 'low' | 'medium' | 'high'

/** Maps the live presentation rate to the three header quality tiers. */
export function qualityTierForFps(fps: number): ReactHeaderQualityTier {
  if (fps <= 0 || fps >= 55) return 'high'
  return fps >= 30 ? 'medium' : 'low'
}

function MetricChip({
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

export function ReactHeaderPerformanceStatus({
  fps,
  frameTimeMs,
  qualityTier = qualityTierForFps(fps),
}: {
  fps: number
  frameTimeMs?: number | null
  qualityTier?: ReactHeaderQualityTier
}) {
  const validFps = Number.isFinite(fps) && fps > 0 ? fps : null
  const measuredFrameTime = frameTimeMs != null && Number.isFinite(frameTimeMs) && frameTimeMs > 0
    ? frameTimeMs
    : validFps == null ? null : 1000 / validFps
  const fpsText = validFps == null ? '—' : `${Math.round(validFps)}`
  const frameTimeText = measuredFrameTime == null ? '—' : `${measuredFrameTime.toFixed(1)} ms`
  const fpsLevel = qualityTierForFps(validFps ?? 0)

  return (
    <>
      <MetricChip label="FPS" value={fpsText} title={validFps == null ? 'Measuring frames per second…' : `${validFps.toFixed(1)} frames per second`} level={fpsLevel} metric="fps" />
      <MetricChip label="FRAME TIME" value={frameTimeText} title={measuredFrameTime == null ? 'Measuring frame time…' : `Average frame time ${measuredFrameTime.toFixed(1)} milliseconds`} level={fpsLevel} metric="frame-time" />
      <MetricChip label="QUALITY" value={qualityTier} title={`Active quality tier: ${qualityTier}`} level={qualityTier} metric="quality" />
    </>
  )
}

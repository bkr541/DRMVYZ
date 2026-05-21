import type { PerformanceStats } from '../../../types/performanceStats'

const LEVEL_COLOR = { ok: '#61d6aa', caution: '#d8b95a', critical: '#f87171' } as const

export function OutputHealthIndicator({ stats }: { stats: PerformanceStats }) {
  const { warningLevel, fps, averageFps, droppedFrameCount, frameTimeMs,
          canvasWidth, canvasHeight, dpr, quality, activeMediaLoaded, missingMediaCount } = stats

  const color = LEVEL_COLOR[warningLevel]
  const fpsLabel = fps > 0 ? `${fps}` : '--'

  const warnings: string[] = []
  if (dpr > 2) warnings.push('High DPR may reduce performance')
  if (missingMediaCount > 0) warnings.push(`${missingMediaCount} missing layer media`)
  if (!activeMediaLoaded && fps > 0) warnings.push('Active media not loaded')
  if (droppedFrameCount >= 3) warnings.push(`${droppedFrameCount} dropped frames`)

  return (
    <div className="vz-health-wrap">
      <div className={`vz-health-pill vz-health-pill--${warningLevel}`}>
        <span className="vz-health-dot" style={{ background: color }} />
        <span className="vz-health-fps">{fpsLabel}</span>
        <span className="vz-health-unit">FPS</span>
      </div>

      <div className="vz-health-popup">
        <div className="vz-health-popup-title" style={{ color }}>
          {warningLevel === 'ok' ? 'Output OK' : warningLevel === 'caution' ? 'Caution' : 'Critical'}
        </div>
        <div className="vz-health-grid">
          <span>FPS</span>       <span>{fpsLabel}</span>
          <span>Avg FPS</span>   <span>{averageFps > 0 ? averageFps : '--'}</span>
          <span>Dropped</span>   <span>{droppedFrameCount}</span>
          <span>Frame</span>     <span>{frameTimeMs > 0 ? `${frameTimeMs}ms` : '--'}</span>
          <span>Canvas</span>    <span>{canvasWidth > 0 ? `${canvasWidth}×${canvasHeight}` : '--'}</span>
          <span>DPR</span>       <span>{dpr}×</span>
          <span>Quality</span>   <span>{quality}</span>
        </div>
        {warnings.map(w => (
          <div key={w} className="vz-health-warning">{w}</div>
        ))}
      </div>
    </div>
  )
}

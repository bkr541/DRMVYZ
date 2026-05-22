import type { PerformanceStats } from '../../../types/performanceStats'
import { useVisualStore } from '../../../stores/visualStore'

const LEVEL_COLOR = { ok: '#61d6aa', caution: '#d8b95a', critical: '#f87171' } as const

function deltaColor(ms: number): string | undefined {
  if (ms > 33)   return '#f87171'
  if (ms > 16.7) return '#d8b95a'
  return undefined
}

export function OutputHealthIndicator({
  stats,
  videoBaselineMode = false,
}: {
  stats: PerformanceStats
  videoBaselineMode?: boolean
}) {
  const {
    warningLevel, fps, averageFps,
    avgFrameDeltaMs, worstFrameDeltaMs,
    framesOver30,
    videoTotalFrames, videoDroppedFrames,
    canvasWidth, canvasHeight, dpr, renderScale, quality,
    autoQualityEnabled, autoQualityReason,
    activeMediaLoaded, missingMediaCount, activeEffectCount,
    videoElementCount, videoPlayingCount,
    rendererType, gpuEffects,
  } = stats

  const setRendererType = useVisualStore(s => s.setRendererType)

  const color = LEVEL_COLOR[warningLevel]
  const fpsLabel = fps > 0 ? `${fps}` : '--'
  const isGpu = rendererType === 'webgl2'

  const warnings: string[] = []
  if (videoBaselineMode) warnings.push('Baseline mode — all effects bypassed')
  if (missingMediaCount > 0) warnings.push(`${missingMediaCount} missing layer media`)
  if (!activeMediaLoaded && fps > 0) warnings.push('Active media not loaded')
  if (framesOver30 >= 3) warnings.push(`${framesOver30} frames missed 30fps budget`)
  if (videoDroppedFrames > 0 && videoTotalFrames > 0) warnings.push(`${videoDroppedFrames} video frames dropped`)

  return (
    <div className="vz-health-wrap">
      <div className={`vz-health-pill vz-health-pill--${warningLevel}`}>
        <span className="vz-health-dot" style={{ background: color }} />
        <span className="vz-health-fps">{fpsLabel}</span>
        <span className="vz-health-unit">FPS</span>
        {isGpu && (
          <span className="vz-health-gpu-badge" title="WebGL2 GPU compositor active">GPU</span>
        )}
      </div>

      <div className="vz-health-popup">
        <div className="vz-health-popup-title" style={{ color }}>
          {warningLevel === 'ok' ? 'Output OK' : warningLevel === 'caution' ? 'Caution' : 'Critical'}
        </div>
        <div className="vz-health-grid">
          <span>FPS</span>      <span>{fpsLabel}</span>
          <span>Avg FPS</span>  <span>{averageFps > 0 ? averageFps : '--'}</span>
          <span>Δ avg</span>    <span style={{ color: deltaColor(avgFrameDeltaMs) }}>{avgFrameDeltaMs > 0 ? `${avgFrameDeltaMs}ms` : '--'}</span>
          <span>Δ worst</span>  <span style={{ color: deltaColor(worstFrameDeltaMs) }}>{worstFrameDeltaMs > 0 ? `${worstFrameDeltaMs}ms` : '--'}</span>
          <span>30ms miss</span><span style={{ color: framesOver30 > 0 ? '#f87171' : 'inherit' }}>{framesOver30}</span>
          {videoTotalFrames > 0 && <>
            <span>V.drop</span><span style={{ color: videoDroppedFrames > 0 ? '#d8b95a' : 'inherit' }}>{videoDroppedFrames}</span>
          </>}
          <span>Vid elems</span><span style={{ color: videoPlayingCount > 1 ? '#d8b95a' : 'inherit' }}>
            {videoElementCount > 0 ? `${videoElementCount} (${videoPlayingCount} playing)` : '0'}
          </span>
          <span>Effects</span>  <span>{activeEffectCount}</span>
          <span>Canvas</span>   <span>{canvasWidth > 0 ? `${canvasWidth}×${canvasHeight}` : '--'}</span>
          <span>DPR</span>      <span>{dpr > 0 ? `${dpr.toFixed(2)}×` : '--'}</span>
          {renderScale < 0.99 && <>
            <span>Px budget</span>
            <span style={{ color: '#d8b95a' }}>{Math.round(renderScale * 100)}%</span>
          </>}
          <span>Quality</span>
          <span>
            {quality}
            {autoQualityEnabled && <span style={{ marginLeft: 4, color: 'rgba(255,255,255,0.35)', fontSize: '0.82em' }}>AUTO</span>}
          </span>
          <span>Baseline</span> <span style={{ color: videoBaselineMode ? '#f59e0b' : 'inherit' }}>{videoBaselineMode ? 'ON' : 'off'}</span>
          <span>Renderer</span>
          <span style={{ color: isGpu ? '#4ac7db' : 'inherit' }}>
            {isGpu ? 'WebGL2' : 'Canvas 2D'}
            {isGpu && gpuEffects.length > 0 && (
              <span style={{ marginLeft: 4, color: 'rgba(74,199,219,0.6)', fontSize: '0.82em' }}>
                [{gpuEffects.join(', ')}]
              </span>
            )}
          </span>
        </div>
        {warnings.map(w => (
          <div key={w} className="vz-health-warning" style={w.startsWith('Baseline') ? { color: '#f59e0b' } : undefined}>{w}</div>
        ))}
        {autoQualityEnabled && autoQualityReason && (
          <div className="vz-health-warning" style={{ color: 'rgba(255,255,255,0.45)' }}>{autoQualityReason}</div>
        )}
        <button
          className={`vz-health-renderer-btn${isGpu ? ' vz-health-renderer-btn--gpu' : ''}`}
          onClick={() => setRendererType(isGpu ? 'canvas2d' : 'webgl2')}
          title={isGpu ? 'Switch to Canvas 2D renderer' : 'Switch to WebGL2 GPU compositor (RGB Split + Bloom on GPU)'}
        >
          {isGpu ? 'Switch to Canvas 2D' : 'Switch to WebGL2 GPU'}
        </button>
      </div>
    </div>
  )
}

import type { PerformanceStats } from '../../../types/performanceStats'
import { useVisualStore } from '../../../stores/visualStore'
import { computeFallbackStatus } from '../../../renderers/rendererSelection'

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

  // Read renderer diagnostic state directly from the store for immediate
  // responsiveness — no 500ms stats-publish lag for failure notices.
  const setGpuPreference     = useVisualStore(s => s.setGpuPreference)
  const gpuPreference        = useVisualStore(s => s.gpuPreference)
  const contextLost          = useVisualStore(s => s.contextLost)
  const rendererFallbackReason = useVisualStore(s => s.rendererFallbackReason)

  const color    = LEVEL_COLOR[warningLevel]
  const fpsLabel = fps > 0 ? `${fps}` : '--'
  const isGpu    = rendererType === 'webgl2'

  const fb = computeFallbackStatus(gpuPreference, rendererType, contextLost, rendererFallbackReason)

  const SEVERITY_COLOR: Record<string, string> = {
    info:     '#d8b95a',
    warning:  '#f59e0b',
    critical: '#f87171',
  }
  const fallbackColor = fb.severity !== 'none' ? SEVERITY_COLOR[fb.severity] : undefined

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
        {isGpu && !contextLost && (
          <span className="vz-health-gpu-badge" title="WebGL2 GPU compositor active">GPU</span>
        )}
        {contextLost && (
          <span className="vz-health-gpu-badge" style={{ background: '#f87171' }} title="WebGL2 context lost — Canvas 2D fallback active">CTX!</span>
        )}
      </div>

      <div className="vz-health-popup">
        <div className="vz-health-popup-title" style={{ color }}>
          {warningLevel === 'ok' ? 'Output OK' : warningLevel === 'caution' ? 'Caution' : 'Critical'}
        </div>

        {/* ── Context-loss elevated banner ── */}
        {contextLost && (
          <div className="vz-health-warning" style={{ color: '#f87171', fontWeight: 600 }}>
            GPU context lost — Canvas 2D fallback active
          </div>
        )}

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
          <span>Baseline</span><span style={{ color: videoBaselineMode ? '#f59e0b' : 'inherit' }}>{videoBaselineMode ? 'ON' : 'off'}</span>

          {/* Active renderer — separate from preference */}
          <span>Active</span>
          <span style={{ color: isGpu && !contextLost ? '#4ac7db' : 'inherit' }}>
            {isGpu && !contextLost
              ? 'WebGL2 GPU'
              : gpuPreference === 'canvas2d'
                ? 'Canvas 2D (manual)'
                : 'Canvas 2D'}
            {contextLost && <span style={{ marginLeft: 4, color: '#f87171', fontSize: '0.82em' }}>LOST</span>}
            {isGpu && !contextLost && gpuEffects.length > 0 && (
              <span style={{ marginLeft: 4, color: 'rgba(74,199,219,0.6)', fontSize: '0.82em' }}>
                [{gpuEffects.join(', ')}]
              </span>
            )}
          </span>

          {/* Fallback reason — only when a failure occurred (not for intentional canvas2d) */}
          {fb.showFallbackWarning && rendererFallbackReason && <>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Reason</span>
            <span style={{ color: fallbackColor, fontSize: '0.82em' }}>{rendererFallbackReason}</span>
          </>}
        </div>

        {warnings.map(w => (
          <div key={w} className="vz-health-warning" style={w.startsWith('Baseline') ? { color: '#f59e0b' } : undefined}>{w}</div>
        ))}
        {autoQualityEnabled && autoQualityReason && (
          <div className="vz-health-warning" style={{ color: 'rgba(255,255,255,0.45)' }}>{autoQualityReason}</div>
        )}

        {/* ── Three-way GPU preference control ── */}
        <div className="vz-health-pref-label">GPU preference</div>
        <div className="vz-health-pref-btns">
          <button
            className={`vz-health-pref-btn${gpuPreference === 'auto'    ? ' vz-health-pref-btn--active' : ''}`}
            onClick={() => setGpuPreference('auto')}
            title="Auto: use WebGL2 when available, fall back to Canvas 2D with an info notice if unavailable"
          >Auto</button>
          <button
            className={`vz-health-pref-btn${gpuPreference === 'webgl2'  ? ' vz-health-pref-btn--active' : ''}`}
            onClick={() => setGpuPreference('webgl2')}
            title="Force GPU: always attempt WebGL2; show warning if unavailable"
          >GPU</button>
          <button
            className={`vz-health-pref-btn${gpuPreference === 'canvas2d' ? ' vz-health-pref-btn--active' : ''}`}
            onClick={() => setGpuPreference('canvas2d')}
            title="Canvas 2D: use CPU renderer; never attempt WebGL2"
          >Canvas</button>
        </div>
      </div>
    </div>
  )
}

import type { Quality } from '../../../stores/visualStore'
import type { RendererType } from '../../../types/performanceStats'

type PreviewOverlayProps = {
  quality: Quality
  fps: number
  rendererType: RendererType
}

export function PreviewOverlay({ quality, fps, rendererType }: PreviewOverlayProps) {
  const rendererLabel = rendererType === 'webgl2' ? 'WebGL2' : 'Canvas 2D'
  return (
    <div className="vz-preview-pills">
      <span className="vz-preview-pill">{quality}</span>
      <span className="vz-preview-pill vz-preview-pill--fps">{fps > 0 ? `${fps} FPS` : '-- FPS'}</span>
      <span className="vz-preview-pill">{rendererLabel}</span>
    </div>
  )
}

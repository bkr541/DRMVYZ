import type { Quality } from '../../../stores/visualStore'

type PreviewOverlayProps = {
  quality: Quality
  fps: number
}

export function PreviewOverlay({ quality, fps }: PreviewOverlayProps) {
  return (
    <div className="vz-preview-pills">
      <span className="vz-preview-pill">{quality}</span>
      <span className="vz-preview-pill">{fps > 0 ? `${fps} FPS` : '-- FPS'}</span>
      <span className="vz-preview-pill">Canvas 2D</span>
    </div>
  )
}

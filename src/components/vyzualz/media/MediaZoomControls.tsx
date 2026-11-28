import { AppIcon } from '../../shared/icons/AppIcon'
import { formatZoom, MAX_ZOOM, MIN_ZOOM, type ZoomPanControls } from './zoomPan'

/** − / zoom level / + and Fit, floating in the corner of the media preview. */
export function MediaZoomControls({ zoom, className }: { zoom: ZoomPanControls; className?: string }) {
  return (
    <div className={`mms-zoom-controls${className ? ` ${className}` : ''}`} role="group" aria-label="Zoom">
      <button type="button" className="mms-zoom-btn" onClick={zoom.zoomOut} disabled={zoom.view.scale <= MIN_ZOOM} aria-label="Zoom out" title="Zoom out (scroll or pinch)">
        <AppIcon kind="minus" size={12} color="currentColor" />
      </button>
      <span className="mms-zoom-level" aria-live="polite" title="Zoom, relative to the fitted size">{formatZoom(zoom.view)}</span>
      <button type="button" className="mms-zoom-btn" onClick={zoom.zoomIn} disabled={zoom.view.scale >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in (scroll or pinch)">
        <AppIcon kind="plus" size={12} color="currentColor" />
      </button>
      <button type="button" className="mms-zoom-btn mms-zoom-fit" onClick={zoom.fit} disabled={!zoom.zoomed} title="Fit the media in the preview">Fit</button>
    </div>
  )
}

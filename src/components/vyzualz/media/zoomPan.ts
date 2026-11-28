import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

/**
 * Zoom and pan for the Media Manager's preview. The content is centred in the viewport and drawn with
 * `translate(x, y) scale(scale)` from its centre, so a point on screen (relative to the viewport centre) is x + scale × local.
 * Scale 1 is the fitted size.
 */
export interface ZoomView { scale: number; x: number; y: number }
export interface Size { width: number; height: number }

export const FIT_VIEW: ZoomView = { scale: 1, x: 0, y: 0 }
export const MIN_ZOOM = 1
export const MAX_ZOOM = 32
const BUTTON_STEP = 1.5

/** Keeps the scale in range and the content covering the viewport where it is larger than it (never panned off screen). */
export function clampZoomView(view: ZoomView, content: Size, viewport: Size): ZoomView {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.scale))
  const maxX = Math.max(0, (content.width * scale - viewport.width) / 2)
  const maxY = Math.max(0, (content.height * scale - viewport.height) / 2)
  // `+ 0` turns -0 into 0, so an unpanned view compares equal to FIT_VIEW.
  return { scale, x: Math.max(-maxX, Math.min(maxX, view.x)) + 0, y: Math.max(-maxY, Math.min(maxY, view.y)) + 0 }
}

/** Zooms by `factor` keeping the content under `point` (relative to the viewport centre) where it is. */
export function zoomViewAt(view: ZoomView, factor: number, point: { x: number; y: number }, content: Size, viewport: Size): ZoomView {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.scale * factor))
  const k = scale / view.scale
  return clampZoomView({ scale, x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k }, content, viewport)
}

export function formatZoom(view: ZoomView): string {
  return `${Math.round(view.scale * 100)}%`
}

export interface ZoomPanControls {
  view: ZoomView
  zoomed: boolean
  panning: boolean
  contentStyle: CSSProperties | undefined
  zoomIn(): void
  zoomOut(): void
  fit(): void
  /** Starts a drag that pans the content (call from a pointerdown on the viewport). */
  startPan(event: ReactPointerEvent): void
}

/**
 * Wheel or pinch zooms toward the pointer, `startPan` drags. `enabled: false` returns to the fitted view and ignores input.
 * The content's untransformed size (offsetWidth/Height) is what the view is clamped against.
 */
export function useZoomPan(viewportRef: RefObject<HTMLElement>, contentRef: RefObject<HTMLElement>, enabled: boolean): ZoomPanControls {
  const [view, setView] = useState<ZoomView>(FIT_VIEW)
  const [panning, setPanning] = useState(false)
  const viewRef = useRef(view)
  viewRef.current = view

  const sizes = useCallback((): { content: Size; viewport: Size; rect: DOMRect } | null => {
    const viewport = viewportRef.current, content = contentRef.current
    if (!viewport || !content) return null
    return { content: { width: content.offsetWidth, height: content.offsetHeight }, viewport: { width: viewport.clientWidth, height: viewport.clientHeight }, rect: viewport.getBoundingClientRect() }
  }, [viewportRef, contentRef])

  const zoomAround = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const measured = sizes()
    if (!measured) return
    const { rect } = measured
    const point = clientX === undefined || clientY === undefined ? { x: 0, y: 0 } : { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
    setView(current => zoomViewAt(current, factor, point, measured.content, measured.viewport))
  }, [sizes])

  useEffect(() => { if (!enabled) setView(FIT_VIEW) }, [enabled])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !enabled) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // Pinch arrives as a wheel with ctrlKey and small deltas; a mouse wheel notch is ~100px (or 3 lines).
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1)
      zoomAround(Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002)), event.clientX, event.clientY)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [viewportRef, enabled, zoomAround])

  // Re-clamp when the viewport changes size (window resize, panel drag).
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const measured = sizes()
      if (measured) setView(current => { const next = clampZoomView(current, measured.content, measured.viewport); return next.x === current.x && next.y === current.y && next.scale === current.scale ? current : next })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [viewportRef, sizes])

  const startPan = useCallback((event: ReactPointerEvent) => {
    if (!enabled) return
    const measured = sizes()
    if (!measured) return
    event.preventDefault()
    const startX = event.clientX, startY = event.clientY, from = viewRef.current
    setPanning(true)
    const move = (moveEvent: PointerEvent) => {
      setView(clampZoomView({ scale: from.scale, x: from.x + moveEvent.clientX - startX, y: from.y + moveEvent.clientY - startY }, measured.content, measured.viewport))
    }
    const end = () => {
      setPanning(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }, [enabled, sizes])

  const zoomed = view.scale !== 1 || view.x !== 0 || view.y !== 0
  return {
    view,
    zoomed,
    panning,
    contentStyle: zoomed ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } : undefined,
    zoomIn: () => zoomAround(BUTTON_STEP),
    zoomOut: () => zoomAround(1 / BUTTON_STEP),
    fit: () => setView(FIT_VIEW),
    startPan,
  }
}

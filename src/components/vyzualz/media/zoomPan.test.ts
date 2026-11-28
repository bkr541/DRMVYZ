import { describe, expect, it } from 'vitest'
import { clampZoomView, FIT_VIEW, MAX_ZOOM, zoomViewAt } from './zoomPan'

const content = { width: 400, height: 200 }
const viewport = { width: 400, height: 300 }

describe('preview zoom', () => {
  it('keeps the point under the pointer fixed while zooming', () => {
    const point = { x: 100, y: 50 }
    const view = zoomViewAt(FIT_VIEW, 2, point, content, viewport)
    expect(view.scale).toBe(2)
    // The content point that was under the pointer (local = point / 1) is still there: x + scale × local = point.
    expect(view.x + 2 * 100).toBeCloseTo(100)
    expect(view.y + 2 * 50).toBeCloseTo(50)
  })

  it('never zooms out past the fitted size or beyond the maximum', () => {
    expect(zoomViewAt(FIT_VIEW, 0.5, { x: 0, y: 0 }, content, viewport)).toEqual(FIT_VIEW)
    expect(zoomViewAt(FIT_VIEW, 1000, { x: 0, y: 0 }, content, viewport).scale).toBe(MAX_ZOOM)
  })

  it('stops panning at the content edges, and centres an axis that still fits', () => {
    // At 1.2× the content is 480 × 240: 40px of horizontal slack each side, none vertically (240 < 300).
    expect(clampZoomView({ scale: 1.2, x: 500, y: 80 }, content, viewport)).toEqual({ scale: 1.2, x: 40, y: 0 })
    expect(clampZoomView({ scale: 1.2, x: -500, y: -80 }, content, viewport)).toEqual({ scale: 1.2, x: -40, y: 0 })
  })
})

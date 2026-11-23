import { describe, expect, it, vi } from 'vitest'
import { hasCanvasFrameListeners, isCanvasFramePublisher, notifyCanvasFrameRendered, onCanvasFrameRendered } from './canvasFrameReadiness'

const canvas = () => ({}) as HTMLCanvasElement

describe('canvas frame announcements', () => {
  it('tells every listener about each frame, and stops telling one that unsubscribed', () => {
    const c = canvas(), a = vi.fn(), b = vi.fn()
    const stopA = onCanvasFrameRendered(c, a); onCanvasFrameRendered(c, b)
    notifyCanvasFrameRendered(c); notifyCanvasFrameRendered(c)
    stopA(); notifyCanvasFrameRendered(c)
    expect(a).toHaveBeenCalledTimes(2); expect(b).toHaveBeenCalledTimes(3)
  })

  it('a listener that throws neither stops the others nor reaches the renderer', () => {
    const c = canvas(), ok = vi.fn()
    onCanvasFrameRendered(c, () => { throw new Error('boom') }); onCanvasFrameRendered(c, ok)
    expect(() => notifyCanvasFrameRendered(c)).not.toThrow()
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('knows a canvas is a publisher only while its renderer keeps announcing frames', () => {
    const c = canvas()
    expect(isCanvasFramePublisher(c, 250, 1_000)).toBe(false)
    notifyCanvasFrameRendered(c, 1_000)
    expect(isCanvasFramePublisher(c, 250, 1_100)).toBe(true)
    expect(isCanvasFramePublisher(c, 250, 1_400)).toBe(false)   // the renderer stopped (another engine took over): consumers go back to their own timer
  })

  it('reports whether anything is waiting for a canvas\'s frames, so an idle renderer knows to keep drawing', () => {
    const c = canvas()
    expect(hasCanvasFrameListeners(c)).toBe(false)
    const stop = onCanvasFrameRendered(c, () => {})
    expect(hasCanvasFrameListeners(c)).toBe(true)
    stop()
    expect(hasCanvasFrameListeners(c)).toBe(false)
  })
})

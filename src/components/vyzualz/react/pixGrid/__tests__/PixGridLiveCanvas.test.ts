// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { resolvePixGridCanvasSampleRect, samplePixGridCanvasColor } from '../PixGridLiveCanvas'

describe('PixGrid live canvas sampling', () => {
  it('maps logical matrix cells to the renderer backing resolution', () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720

    expect(resolvePixGridCanvasSampleRect(canvas, { x: 80, y: 45 }, 160, 90)).toEqual({
      x: 640,
      y: 360,
      width: 8,
      height: 8,
    })
    expect(resolvePixGridCanvasSampleRect(canvas, { x: 999, y: 999 }, 160, 90)).toEqual({
      x: 1272,
      y: 712,
      width: 8,
      height: 8,
    })
  })

  it('samples the intended backing region and returns a stable hex color', () => {
    const source = document.createElement('canvas')
    source.width = 800
    source.height = 400
    const sampleCanvas = document.createElement('canvas')
    const context = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([17, 34, 51, 255]) })),
    } as unknown as CanvasRenderingContext2D
    vi.spyOn(sampleCanvas, 'getContext').mockReturnValue(context)

    expect(samplePixGridCanvasColor(source, { x: 10, y: 20 }, 80, 40, sampleCanvas)).toBe('#112233')
    expect(context.drawImage).toHaveBeenCalledWith(source, 100, 200, 10, 10, 0, 0, 1, 1)
  })

  it('fails safely when a canvas cannot be sampled', () => {
    const source = document.createElement('canvas')
    source.width = 160
    source.height = 90
    const sampleCanvas = document.createElement('canvas')
    vi.spyOn(sampleCanvas, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(() => { throw new DOMException('tainted') }),
    } as unknown as CanvasRenderingContext2D)

    expect(samplePixGridCanvasColor(source, { x: 0, y: 0 }, 160, 90, sampleCanvas)).toBeNull()
  })
})

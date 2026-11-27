import { describe, expect, it, vi } from 'vitest'
import { drawRecordingFrame } from './recordingFrame'
import { markCanvasFramePending, markCanvasFrameReady } from '../lib/canvasFrameReadiness'

function frame(width: number, height: number) {
  return { canvas: { width, height }, fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' } as unknown as CanvasRenderingContext2D
}

describe('recording output framing', () => {
  it('preserves composition when a cast has a different aspect ratio', () => {
    const ctx = frame(1080, 1920)
    const source = { width: 1920, height: 1080 } as HTMLCanvasElement
    expect(drawRecordingFrame(ctx, source)).toBe(true)
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920)
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 656.25, 1080, 607.5)
  })
  it('scales a matching composition to the exact output dimensions', () => {
    const ctx = frame(1920, 1080)
    const source = { width: 960, height: 540 } as HTMLCanvasElement
    expect(drawRecordingFrame(ctx, source)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(source, 0, 0, 1920, 1080)
  })
  it('retains the last picture during an unresolved renderer handoff', () => {
    const ctx = frame(1080, 1080)
    const source = { width: 1080, height: 1080 } as HTMLCanvasElement
    markCanvasFramePending(source)
    expect(drawRecordingFrame(ctx, source)).toBe(false)
    expect(ctx.fillRect).not.toHaveBeenCalled()
    markCanvasFrameReady(source)
    expect(drawRecordingFrame(ctx, source)).toBe(true)
  })
})

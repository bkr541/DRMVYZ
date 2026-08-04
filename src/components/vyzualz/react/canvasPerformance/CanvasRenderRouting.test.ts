import { describe, expect, it } from 'vitest'
import { canRenderCanvasOrchestrationFrame } from './CanvasRenderRouting'

const readyFrame = {
  orchestrationActive: true,
  readyMediaIds: ['hero-media'],
}

describe('Canvas orchestration render routing', () => {
  it('allows an enabled, active, media-ready resolved frame to own rendering', () => {
    expect(canRenderCanvasOrchestrationFrame({ enabled: true }, readyFrame)).toBe(true)
  })

  it.each([
    ['Auto Performance disabled', { enabled: false }, readyFrame],
    ['missing frame', { enabled: true }, null],
    ['inactive frame', { enabled: true }, { ...readyFrame, orchestrationActive: false }],
    ['media-unready frame', { enabled: true }, { ...readyFrame, readyMediaIds: [] }],
  ])('rejects %s and preserves direct fallback', (_label, orchestration, frame) => {
    expect(canRenderCanvasOrchestrationFrame(orchestration, frame)).toBe(false)
  })
})

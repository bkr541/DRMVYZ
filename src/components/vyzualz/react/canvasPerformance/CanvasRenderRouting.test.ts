import { describe, expect, it } from 'vitest'
import { canRenderCanvasAuthoredLayerFrame, canRenderCanvasOrchestrationFrame } from './CanvasRenderRouting'

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

describe('Canvas authored-layer render routing', () => {
  it('keeps the direct source visible only while every authored source is still preloading', () => {
    expect(canRenderCanvasAuthoredLayerFrame({
      readyMediaIds: [],
      pendingMediaIds: ['layer-a', 'layer-b'],
      mediaErrors: [],
    }, true)).toBe(false)

    expect(canRenderCanvasAuthoredLayerFrame({
      readyMediaIds: ['layer-a'],
      pendingMediaIds: ['layer-b'],
      mediaErrors: [],
    }, true)).toBe(true)
  })

  it('hands ownership to the authored stage when loading resolves to errors so diagnostics are not hidden behind stale media', () => {
    expect(canRenderCanvasAuthoredLayerFrame({
      readyMediaIds: [],
      pendingMediaIds: [],
      mediaErrors: [{ mediaId: 'layer-a', message: 'Unable to preload Layer A' }],
    }, true)).toBe(true)
  })
})

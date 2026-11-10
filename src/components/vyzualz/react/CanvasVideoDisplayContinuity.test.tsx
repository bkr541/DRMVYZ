/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useReactStore } from '../../../stores/reactStore'
import { CanvasEngineSurface } from './ReactCanvasEngineShell'

describe('CANVAS video Display continuity', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame

  beforeEach(() => {
    useReactStore.getState().resetReactView()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as typeof HTMLCanvasElement.prototype.getContext
    HTMLMediaElement.prototype.play = vi.fn(() => undefined as unknown as Promise<void>)
    HTMLMediaElement.prototype.pause = vi.fn()
    window.requestAnimationFrame = vi.fn(() => 1)
    window.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
    window.requestAnimationFrame = originalRequestAnimationFrame
    window.cancelAnimationFrame = originalCancelAnimationFrame
  })

  it('bounds capture allocations at UHD while retaining source and Display parameters', async () => {
    const context = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn() }
    HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext
    const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 3840, height: 2160, top: 0, left: 0, right: 3840, bottom: 2160,
      x: 0, y: 0, toJSON: () => ({}),
    })
    const dpr = vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    useReactStore.setState({
      selectedCanvasPresetId: 'canvas-clean-playback',
      activeCanvasMediaId: 'allocation-video',
      canvasMediaItems: [{ id: 'allocation-video', name: 'Allocation video', type: 'video',
        objectUrl: 'blob:allocation-video', createdAt: '2026-11-09T00:00:00Z' }],
    })
    const settings = useReactStore.getState().canvasEngineSettings
    try {
      await act(async () => root.render(<CanvasEngineSurface isPlaying isPaused={false} />))
      const capture = host.querySelector<HTMLCanvasElement>('.rv-canvas-output-capture')
      expect(capture?.width).toBe(3840)
      expect(capture?.height).toBe(2160)
      const scratch = host.querySelector<HTMLCanvasElement>('.rv-canvas-source-fx-canvas')
      expect(scratch?.width).toBe(1)
      expect(scratch?.height).toBe(1)
      expect(useReactStore.getState().canvasEngineSettings).toBe(settings)
      expect(useReactStore.getState().activeCanvasMediaId).toBe('allocation-video')
      expect(context.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0)
    } finally {
      await act(async () => root.unmount())
      host.remove(); bounds.mockRestore(); dpr.mockRestore()
    }
  })

  it('preserves the media element, playhead, timing state, and live render loop', async () => {
    useReactStore.setState({
      canvasMediaItems: [{
        id: 'display-continuity-video',
        name: 'Display Continuity Video',
        type: 'video',
        objectUrl: 'blob:display-continuity-video',
        createdAt: '2026-10-07T00:00:00.000Z',
      }],
      canvasMediaTimingById: {
        'display-continuity-video': {
          clipStartSec: 4,
          clipEndSec: 0,
          loopClipRange: false,
          restartOnDrop: false,
          restartOnSectionChange: false,
          restartOnManualPresetChange: false,
          triggerOn: 'manualOnly',
          sectionTriggerTypes: [],
        },
      },
      activeCanvasMediaId: 'display-continuity-video',
    })

    const timingState = useReactStore.getState().canvasMediaTimingById
    const legacyMediaState = useReactStore.getState().canvasMediaItems
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    try {
      await act(async () => root.render(<CanvasEngineSurface isPlaying isPaused={false} />))
      const video = host.querySelector<HTMLVideoElement>('video.rv-canvas-live-media')
      if (!video) throw new Error('Expected active CANVAS video')
      video.currentTime = 12
      const initialRenderLoopCancellations = vi.mocked(window.cancelAnimationFrame).mock.calls.length

      const displayPatches = [
        { scale: 1.25 },
        { positionX: 18 },
        { positionY: -12 },
        { rotation: 24 },
        { opacity: 0.72 },
      ]
      for (const patch of displayPatches) {
        await act(async () => useReactStore.getState().setCanvasEngineSettings(patch))
        expect(host.querySelector('video.rv-canvas-live-media')).toBe(video)
        expect(video.currentTime).toBe(12)
        expect(useReactStore.getState().canvasMediaTimingById).toBe(timingState)
        expect(useReactStore.getState().canvasMediaItems).toBe(legacyMediaState)
        expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(initialRenderLoopCancellations)
      }
    } finally {
      await act(async () => root.unmount())
      host.remove()
    }
  })
})

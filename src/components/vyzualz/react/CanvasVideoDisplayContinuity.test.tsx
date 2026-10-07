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

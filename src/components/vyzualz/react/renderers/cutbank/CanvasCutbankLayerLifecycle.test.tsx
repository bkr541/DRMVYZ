/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { DEFAULT_CANVAS_PRESET_SETTINGS } from '../../ReactTypes'
import { CanvasPreloadManager } from '../../canvasPerformance/CanvasPreloadManager'
import { testMedia, testPool } from './cutbankTestUtils'

const passes: Array<{ resize: ReturnType<typeof vi.fn>; render: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }> = []

vi.mock('./CutbankTreatPass', () => ({
  CutbankTreatPass: {
    create: () => {
      const pass = { resize: vi.fn(), render: vi.fn(() => true), dispose: vi.fn() }
      passes.push(pass)
      return { pass, error: null }
    },
  },
}))

vi.mock('../../../../../stores/mediaStore', () => ({
  useMediaStore: { getState: () => ({ ensureMediaSigned: vi.fn().mockResolvedValue(undefined) }) },
}))

import { CanvasCutbankLayer } from './CanvasCutbankLayer'

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
let cancelled: number[] = []
let contextLostListeners = 0
let contextLostRemoved = 0

const ctxStub = new Proxy({}, {
  get: (_t, key: string) => key === 'measureText' ? () => ({ width: 10 }) : () => undefined,
  set: () => true,
})

beforeEach(() => {
  passes.length = 0
  frames.clear()
  nextFrame = 1
  cancelled = []
  contextLostListeners = 0
  contextLostRemoved = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { const id = nextFrame++; frames.set(id, cb); return id })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { cancelled.push(id); frames.delete(id) })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctxStub) as never)
  const add = EventTarget.prototype.addEventListener
  const remove = EventTarget.prototype.removeEventListener
  vi.spyOn(EventTarget.prototype, 'addEventListener').mockImplementation(function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    if (type === 'webglcontextlost') contextLostListeners += 1
    return add.call(this, type, listener, options)
  })
  vi.spyOn(EventTarget.prototype, 'removeEventListener').mockImplementation(function (this: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    if (type === 'webglcontextlost') contextLostRemoved += 1
    return remove.call(this, type, listener, options)
  })
})

afterEach(() => vi.restoreAllMocks())

function runFrames(count: number) {
  for (let i = 0; i < count; i += 1) {
    const pending = [...frames.entries()]
    frames.clear()
    for (const [, cb] of pending) cb(performance.now() + i * 16)
  }
}

const media = [testMedia('img-1'), testMedia('img-2')]
const pool = testPool(['img-1', 'img-2'], ['HELLO'])

const contextRef = { current: createSharedPerformanceFallbackContext(0) }

function mount(props: Partial<React.ComponentProps<typeof CanvasCutbankLayer>> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const onCanvasReady = vi.fn()
  const onStatusChange = vi.fn()
  act(() => {
    root.render(
      <CanvasCutbankLayer
        active
        settings={DEFAULT_CANVAS_PRESET_SETTINGS}
        pool={pool}
        poolRevision={1}
        mediaItems={media}
        trackIdentity="track-a"
        performanceContextRef={contextRef}
        audioActive={false}
        onCanvasReady={onCanvasReady}
        onStatusChange={onStatusChange}
        {...props}
      />,
    )
  })
  return { host, root, onCanvasReady, onStatusChange }
}

describe('CanvasCutbankLayer lifecycle', () => {
  it('renders every frame through the treat pass and publishes a capture canvas', () => {
    const view = mount()
    expect(view.onCanvasReady).toHaveBeenCalledWith(expect.any(HTMLCanvasElement))
    runFrames(3)
    expect(passes).toHaveLength(1)
    expect(passes[0].render.mock.calls.length).toBeGreaterThanOrEqual(3)
    act(() => view.root.unmount())
  })

  it('does nothing while inactive', () => {
    const view = mount({ active: false })
    expect(view.host.querySelector('canvas')).toBeNull()
    expect(passes).toHaveLength(0)
    expect(frames.size).toBe(0)
    act(() => view.root.unmount())
  })

  it('releases the RAF loop, listeners, GL pass, and preload manager on unmount', () => {
    const disposeSpy = vi.spyOn(CanvasPreloadManager.prototype, 'dispose')
    const view = mount()
    runFrames(2)
    const pendingBefore = [...frames.keys()]
    expect(pendingBefore.length).toBe(1)
    act(() => view.root.unmount())
    expect(cancelled).toContain(pendingBefore[0])
    expect(frames.size).toBe(0)
    expect(passes[0].dispose).toHaveBeenCalledTimes(1)
    expect(disposeSpy).toHaveBeenCalledTimes(1)
    expect(view.onCanvasReady).toHaveBeenLastCalledWith(null)
    expect(contextLostRemoved).toBe(contextLostListeners)
    runFrames(3)
    expect(frames.size).toBe(0)
  })

  it('can be entered and left repeatedly without accumulating loops, listeners, or passes', () => {
    for (let i = 0; i < 6; i += 1) {
      const view = mount()
      runFrames(2)
      act(() => view.root.unmount())
      expect(frames.size).toBe(0)
    }
    expect(passes).toHaveLength(6)
    expect(passes.every(pass => pass.dispose.mock.calls.length === 1)).toBe(true)
    expect(contextLostRemoved).toBe(contextLostListeners)
  })

  it('reports a neutral status for missing, empty, and deleted pools without crashing', () => {
    for (const emptyPool of [null, testPool([]), testPool(['deleted'])]) {
      const view = mount({ pool: emptyPool })
      runFrames(2)
      const messages = view.onStatusChange.mock.calls.map(call => call[0]).filter(Boolean)
      expect(messages.length).toBeGreaterThan(0)
      expect(passes[passes.length - 1].render).toHaveBeenCalled()
      act(() => view.root.unmount())
    }
  })

  it('keeps running while the pool changes and never leaves the loop double-scheduled', () => {
    const view = mount()
    runFrames(2)
    act(() => {
      view.root.render(
        <CanvasCutbankLayer
          active
          settings={DEFAULT_CANVAS_PRESET_SETTINGS}
          pool={testPool(['img-2'], [])}
          poolRevision={2}
          mediaItems={media}
          trackIdentity="track-a"
          performanceContextRef={contextRef}
          audioActive={false}
          onCanvasReady={view.onCanvasReady}
          onStatusChange={view.onStatusChange}
        />,
      )
    })
    runFrames(3)
    expect(frames.size).toBe(1)
    expect(passes).toHaveLength(1)
    act(() => view.root.unmount())
  })

  it('stops rendering and reports when the GL pass throws (context loss safe)', () => {
    const view = mount()
    passes[0].render.mockImplementation(() => { throw new Error('boom') })
    runFrames(2)
    expect(passes[0].dispose).toHaveBeenCalled()
    expect(view.onStatusChange.mock.calls.some(call => String(call[0]).includes('boom'))).toBe(true)
    act(() => view.root.unmount())
    expect(frames.size).toBe(0)
  })
})

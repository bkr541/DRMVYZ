import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { notifyCanvasFrameRendered } from '../../../../lib/canvasFrameReadiness'
import { startRelayFramePump } from './relayFramePump'

// A controllable animation-frame clock, so a test decides the order callbacks run in within a frame.
let frameCallbacks: ((now: number) => void)[] = []
let clock = 1_000
const runFrame = (before?: () => void, after?: () => void) => {
  before?.()
  const callbacks = frameCallbacks; frameCallbacks = []
  clock += 16
  callbacks.forEach(callback => callback(clock))
  after?.()
}
const always = { due: () => true }
const canvas = () => ({ width: 640, height: 360 }) as HTMLCanvasElement

describe('relay frame pump', () => {
  beforeEach(() => {
    frameCallbacks = []; clock = 1_000
    vi.stubGlobal('window', { requestAnimationFrame: (callback: (now: number) => void) => { frameCallbacks.push(callback); return frameCallbacks.length }, cancelAnimationFrame: () => { frameCallbacks = [] } })
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('never copies a cleared picture: a WebGL canvas that is blank outside its own renderer is copied only in the renderer\'s announcement, whichever runs first in a frame', () => {
    // Models a WebGL canvas without preserveDrawingBuffer: the picture exists only between the draw and the end of that task.
    const source = canvas(); let picture: 'live' | 'cleared' = 'cleared'
    const copied: string[] = []
    const ref = { current: source }
    const stop = startRelayFramePump({ sourceRef: ref, cadence: always, copy: () => { copied.push(picture) } })
    copied.length = 0
    // The renderer draws and announces in its own task; afterwards the browser presents the frame and the buffer is cleared.
    const render = () => { picture = 'live'; notifyCanvasFrameRendered(source, clock); picture = 'cleared' }
    // The relay's timer callback ran BEFORE the renderer in every frame (it registered first, as after a preset change).
    runFrame(undefined, render)   // until a canvas has announced a frame the relay cannot know it announces, so this one frame may copy a cleared picture; it is replaced at once
    copied.length = 0
    for (let i = 0; i < 20; i++) runFrame(undefined, render)
    // From then on the timer no longer copies the canvas, so only live pictures are ever copied.
    expect(copied.length).toBeGreaterThan(10)
    expect(copied.filter(value => value === 'cleared')).toHaveLength(0)
    stop()
  })

  it('still copies a canvas that never announces (2D canvas, another engine) on the frame timer', () => {
    const copy = vi.fn()
    startRelayFramePump({ sourceRef: { current: canvas() }, cadence: always, copy })
    copy.mockClear()
    for (let i = 0; i < 5; i++) runFrame()
    expect(copy).toHaveBeenCalledTimes(5)
  })

  it('keeps going after a copy fails with anything at all, and reports each distinct failure once', () => {
    let calls = 0; const onError = vi.fn()
    const copy = vi.fn(() => { calls++; if (calls > 1 && calls <= 4) throw new TypeError('unexpected') ; if (calls === 5) throw new DOMException('gone', 'InvalidStateError') })
    startRelayFramePump({ sourceRef: { current: canvas() }, cadence: always, copy, onError })
    for (let i = 0; i < 8; i++) runFrame()
    expect(copy.mock.calls.length).toBe(9)                       // every frame still tried
    expect(onError).toHaveBeenCalledTimes(1)                      // the same TypeError, reported once; the InvalidStateError is expected and silent
  })

  it('follows a different canvas handed over later, announcing frames or not', () => {
    const first = canvas(), second = canvas(); const ref = { current: first }; const copy = vi.fn()
    startRelayFramePump({ sourceRef: ref, cadence: always, copy })
    copy.mockClear()
    runFrame(); ref.current = second; runFrame()
    copy.mockClear()
    notifyCanvasFrameRendered(first, clock)       // the old canvas is no longer listened to
    expect(copy).not.toHaveBeenCalled()
    notifyCanvasFrameRendered(second, clock)      // the new one is
    expect(copy).toHaveBeenCalledTimes(1)
  })

  it('respects the cadence for announced frames, and stops completely when stopped', () => {
    const source = canvas(); let allow = true; const copy = vi.fn()
    const stop = startRelayFramePump({ sourceRef: { current: source }, cadence: { due: () => allow }, copy })
    copy.mockClear()
    notifyCanvasFrameRendered(source, clock); allow = false; notifyCanvasFrameRendered(source, clock); allow = true; notifyCanvasFrameRendered(source, clock)
    expect(copy).toHaveBeenCalledTimes(2)
    stop(); copy.mockClear()
    notifyCanvasFrameRendered(source, clock); runFrame()
    expect(copy).not.toHaveBeenCalled()
  })

  it('lets a failure of the very first copy fail the start, as before', () => {
    expect(() => startRelayFramePump({ sourceRef: { current: canvas() }, cadence: always, copy: () => { throw new Error('no context') } })).toThrow('no context')
  })
})

/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markCanvasFramePending, markCanvasFrameReady, notifyCanvasFrameRendered } from '../../../lib/canvasFrameReadiness'
import { STAGE_READY_TIMEOUT_MS, STAGE_SETTLE_MS, STAGE_TAP_MAX_AGE_MS, STAGE_TRANSITION_COALESCE_MS, StageTransitionController } from './StageTransitionController'

interface Call { op: string; image?: HTMLCanvasElement; alpha: number }
const contexts = new WeakMap<HTMLCanvasElement, { calls: Call[]; globalAlpha: number }>()

function stubContext(canvas: HTMLCanvasElement) {
  const state = { calls: [] as Call[], globalAlpha: 1 }
  const noop = () => undefined
  const ctx = new Proxy({ save: noop, restore: noop, beginPath: noop, rect: noop, clip: noop, translate: noop, scale: noop, fillRect: noop, fillStyle: '#000',
    get globalAlpha() { return state.globalAlpha }, set globalAlpha(value: number) { state.globalAlpha = value },
    drawImage(image: HTMLCanvasElement) { state.calls.push({ op: 'draw', image, alpha: state.globalAlpha }) } }, {})
  contexts.set(canvas, state)
  return ctx
}

const drawsOf = (canvas: HTMLCanvasElement) => contexts.get(canvas)!.calls.filter(call => call.op === 'draw')
const source2d = (width = 200, height = 100) => { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas }

let blend: HTMLCanvasElement
let active: Array<HTMLCanvasElement | null>
let controller: StageTransitionController
const make = () => new StageTransitionController(blend, { onActiveCanvas: value => active.push(value) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return (contexts.get(this) ? null : stubContext(this)) ?? null } as never)
  blend = document.createElement('canvas')
  active = []
  controller = make()
})
afterEach(() => { controller.dispose(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('stage transition controller', () => {
  it('is a plain cut while off, and when nothing has been drawn recently enough to fade from', () => {
    expect(controller.trigger('dissolve', 500)).toBe(false)
    controller.setEnabled(true)
    expect(controller.trigger('dissolve', 500)).toBe(false)   // enabled, but no source and no tapped frame yet
    controller.setSource(source2d())
    vi.advanceTimersByTime(100)
    expect(controller.trigger('dissolve', 500)).toBe(true)
    expect(active).toEqual([blend])
  })

  it('taps frames while on, fades from the tapped picture, and hands the blend canvas to the cast for exactly as long as it runs', () => {
    const source = source2d(320, 180)
    controller.setEnabled(true); controller.setSource(source)
    vi.advanceTimersByTime(200)
    expect(controller.trigger('dissolve', 400)).toBe(true)
    expect(blend.style.display).toBe('block')
    expect(blend.width).toBe(320); expect(blend.height).toBe(180)
    expect(active).toEqual([blend])
    expect(controller.running).toBe(true)

    vi.advanceTimersByTime(STAGE_SETTLE_MS + 40)   // the new picture is trusted: the blend is now running
    expect(controller.running).toBe(true)
    vi.advanceTimersByTime(600)
    expect(controller.running).toBe(false)
    expect(blend.style.display).toBe('none')
    expect(active).toEqual([blend, null])
    // the final frame is the new picture alone
    const last = drawsOf(blend).at(-1)!
    expect(last.image).toBe(source); expect(last.alpha).toBe(1)
  })

  it('holds the old picture until the new engine has produced a frame, then blends, so a switch never shows a gap', () => {
    controller.setEnabled(true); controller.setSource(source2d())
    vi.advanceTimersByTime(200)
    controller.setSource(null)                                   // the old engine is gone; the new one has no canvas yet
    expect(controller.trigger('wipe', 300)).toBe(true)
    vi.advanceTimersByTime(500)
    expect(controller.running).toBe(true)                        // still waiting for the new picture
    expect(drawsOf(blend).every(call => call.image !== undefined && call.alpha === 1)).toBe(true)

    const next = source2d()
    controller.setSource(next)
    vi.advanceTimersByTime(STAGE_SETTLE_MS + 50 + 400)
    expect(controller.running).toBe(false)
    expect(drawsOf(blend).at(-1)!.image).toBe(next)
  })

  it('does not blend until a renderer that is still building says its first frame is ready, and gives up waiting after a while', () => {
    const source = source2d()
    controller.setEnabled(true); controller.setSource(source)
    vi.advanceTimersByTime(200)
    markCanvasFramePending(source)                               // the preset is rebuilding on the same canvas
    controller.trigger('dissolve', 300)
    vi.advanceTimersByTime(STAGE_SETTLE_MS + 400)
    expect(controller.running).toBe(true)
    vi.advanceTimersByTime(STAGE_READY_TIMEOUT_MS)               // it never became ready: the blend runs anyway rather than hanging
    vi.advanceTimersByTime(400)
    expect(controller.running).toBe(false)
    markCanvasFrameReady(source)
  })

  it('copies a WebGL-style canvas in the task its renderer announces the frame, not on the timer', () => {
    const live = source2d()
    controller.setEnabled(true); controller.setSource(live)
    vi.advanceTimersByTime(100)
    notifyCanvasFrameRendered(live)                              // the renderer announces: it is a publisher from now on, and the tap copies in that task
    vi.advanceTimersByTime(60)
    notifyCanvasFrameRendered(live)
    expect(controller.trigger('dissolve', 400)).toBe(true)
    vi.advanceTimersByTime(30)
    notifyCanvasFrameRendered(live)
    const before = drawsOf(blend).filter(call => call.image === live).length
    vi.advanceTimersByTime(10)                                   // no announcement: a publisher is never read on the timer
    expect(drawsOf(blend).filter(call => call.image === live).length).toBe(before)
    vi.advanceTimersByTime(40)
    notifyCanvasFrameRendered(live)
    expect(drawsOf(blend).filter(call => call.image === live).length).toBeGreaterThan(before)
  })

  it('treats a second trigger straight after the first as the same change, but a later one continues from what is on screen', () => {
    controller.setEnabled(true); controller.setSource(source2d())
    vi.advanceTimersByTime(200)
    controller.trigger('dissolve', 800)
    vi.advanceTimersByTime(STAGE_TRANSITION_COALESCE_MS - 50)
    expect(controller.trigger('zoom', 800)).toBe(true)
    expect(active).toEqual([blend])                              // one transition, not two

    vi.advanceTimersByTime(STAGE_SETTLE_MS + 100)
    expect(controller.running).toBe(true)
    expect(controller.trigger('zoom', 400)).toBe(true)            // a real second change, mid-blend
    expect(active.filter(value => value === blend).length).toBe(2)
    vi.advanceTimersByTime(STAGE_SETTLE_MS + 700)
    expect(controller.running).toBe(false)
    expect(active.at(-1)).toBeNull()
  })

  it('will not fade from a picture that is too old, and turning it off mid-blend ends the blend and returns the cast to the engine', () => {
    controller.setEnabled(true); const source = source2d(); controller.setSource(source)
    vi.advanceTimersByTime(100)
    controller.setSource(null)
    vi.advanceTimersByTime(STAGE_TAP_MAX_AGE_MS + 500)
    expect(controller.trigger('dissolve', 400)).toBe(false)

    controller.setSource(source)
    vi.advanceTimersByTime(100)
    expect(controller.trigger('dissolve', 400)).toBe(true)
    controller.setEnabled(false)
    expect(controller.running).toBe(false)
    expect(active.at(-1)).toBeNull()
    expect(blend.style.display).toBe('none')
  })

  it('disposing mid-blend returns the cast to the engine canvas and stops drawing', () => {
    controller.setEnabled(true); controller.setSource(source2d())
    vi.advanceTimersByTime(100)
    controller.trigger('flash', 400)
    controller.dispose()
    expect(active.at(-1)).toBeNull()
    const draws = drawsOf(blend).length
    vi.advanceTimersByTime(1000)
    expect(drawsOf(blend).length).toBe(draws)
    expect(controller.trigger('dissolve', 400)).toBe(false)
  })
})

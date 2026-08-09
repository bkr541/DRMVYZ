import { describe, expect, it, vi } from 'vitest'
import { GpuFrameTimer } from '../../react/shaders/performance/GpuFrameTimer'

function timerHarness(options: { supported?: boolean; ready?: boolean; disjoint?: boolean } = {}) {
  const extension = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb }
  let ready = options.ready ?? false
  let disjoint = options.disjoint ?? false
  let nextId = 1
  const gl = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    getExtension: vi.fn(() => options.supported === false ? null : extension),
    createQuery: vi.fn(() => ({ id: nextId++ } as unknown as WebGLQuery)),
    deleteQuery: vi.fn(),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getParameter: vi.fn(() => disjoint),
    getQueryParameter: vi.fn((_query: WebGLQuery, parameter: number) => (
      parameter === 0x8867 ? ready : 12_500_000
    )),
  } as unknown as WebGL2RenderingContext
  return {
    gl,
    setReady(value: boolean) { ready = value },
    setDisjoint(value: boolean) { disjoint = value },
  }
}

describe('GpuFrameTimer', () => {
  it('falls back cleanly when the extension is unsupported', () => {
    const { gl } = timerHarness({ supported: false })
    const timer = new GpuFrameTimer(gl)
    timer.beginFrame()
    timer.endFrame()
    expect(timer.getSnapshot()).toMatchObject({ available: false, state: 'unsupported', createdQueryCount: 0 })
  })

  it('keeps one delayed query bounded, publishes an available result, and deletes it', () => {
    const harness = timerHarness()
    const timer = new GpuFrameTimer(harness.gl)
    timer.beginFrame()
    timer.endFrame()
    timer.beginFrame()
    expect(timer.getSnapshot()).toMatchObject({ state: 'pending', createdQueryCount: 1, deletedQueryCount: 0 })

    harness.setReady(true)
    expect(timer.poll()).toBe(12.5)
    expect(timer.getSnapshot()).toMatchObject({ state: 'idle', createdQueryCount: 1, deletedQueryCount: 1 })
  })

  it('discards disjoint results and releases pending queries during disposal', () => {
    const harness = timerHarness({ disjoint: true })
    const timer = new GpuFrameTimer(harness.gl)
    timer.beginFrame()
    timer.endFrame()
    expect(timer.poll()).toBeNull()
    expect(timer.getSnapshot()).toMatchObject({ state: 'disjoint', deletedQueryCount: 1 })

    harness.setDisjoint(false)
    timer.beginFrame()
    timer.endFrame()
    timer.dispose()
    expect(timer.getSnapshot()).toMatchObject({ state: 'disposed', createdQueryCount: 2, deletedQueryCount: 2 })
  })
})

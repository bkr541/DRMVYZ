import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claimDrmvyzThumbnailWebGLContext,
  getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests,
  getDrmvyzWebGLContextDiagnosticsForTests,
  registerDrmvyzWebGLContext,
  releaseDrmvyzThumbnailWebGLContext,
  resetDrmvyzThumbnailWebGLCoordinatorForTests,
  resetDrmvyzWebGLContextDiagnosticsForTests,
  retireDrmvyzWebGLContext,
  serializeDrmvyzThumbnailWebGLWork,
  validateDrmvyzWebGLContextOwnershipBounds,
} from '../WebGLContextLifecycle'

const ownership = {
  lifetime: 'transient-thumbnail' as const,
  role: 'preset-thumbnail',
  engine: 'cinematic-worlds',
  expectedMaxActive: 1,
}

function fakeContext(): WebGL2RenderingContext {
  return {} as WebGL2RenderingContext
}

describe('DRMVYZ WebGL context lifecycle diagnostics', () => {
  beforeEach(() => {
    resetDrmvyzThumbnailWebGLCoordinatorForTests()
    resetDrmvyzWebGLContextDiagnosticsForTests()
  })

  it('reports balanced creation and terminal retirement', () => {
    const handle = registerDrmvyzWebGLContext(fakeContext(), ownership)
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      acquisitionCount: 1,
      retirementCount: 0,
      activeCount: 1,
      activeByLifetime: { 'live-reusable': 0, 'transient-thumbnail': 1 },
      activeByRole: { 'preset-thumbnail': 1 },
    })

    retireDrmvyzWebGLContext(handle, 'terminal-retire')
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      retirementCount: 1,
      terminalRetirementCount: 1,
      activeCount: 0,
    })
  })

  it('counts duplicate claims as one active context until the final claim retires', () => {
    const gl = fakeContext()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = registerDrmvyzWebGLContext(gl, ownership)
    const second = registerDrmvyzWebGLContext(gl, ownership)

    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      acquisitionCount: 2,
      duplicateOwnershipCount: 1,
      activeCount: 1,
    })
    retireDrmvyzWebGLContext(first, 'release-resources')
    expect(getDrmvyzWebGLContextDiagnosticsForTests().activeCount).toBe(1)
    retireDrmvyzWebGLContext(second, 'terminal-retire')
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      retirementCount: 1,
      terminalRetirementCount: 1,
      activeCount: 0,
    })
    warn.mockRestore()
  })

  it('warns only when DRMVYZ exceeds the declared role bound', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = registerDrmvyzWebGLContext(fakeContext(), ownership)
    expect(warn).not.toHaveBeenCalled()
    const second = registerDrmvyzWebGLContext(fakeContext(), ownership)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('context bound exceeded'))

    retireDrmvyzWebGLContext(first, 'terminal-retire')
    retireDrmvyzWebGLContext(second, 'terminal-retire')
    warn.mockRestore()
  })

  it('can reset diagnostics without retaining prior context ownership', () => {
    const gl = fakeContext()
    registerDrmvyzWebGLContext(gl, ownership)
    resetDrmvyzWebGLContextDiagnosticsForTests()
    const next = registerDrmvyzWebGLContext(gl, ownership)

    expect(next?.contextId).toBe(1)
    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      creationCount: 1,
      acquisitionCount: 1,
      duplicateOwnershipCount: 0,
      activeCount: 1,
    })
    retireDrmvyzWebGLContext(next, 'terminal-retire')
  })

  it('tracks active engines and rejects ownership left behind by an inactive live family', () => {
    const shader = registerDrmvyzWebGLContext(fakeContext(), {
      lifetime: 'live-reusable',
      role: 'react-preview',
      engine: 'shader-engine',
      expectedMaxActive: 1,
    })

    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeByEngine: { 'shader-engine': 1 },
      activeLiveByEngine: { 'shader-engine': 1 },
    })
    expect(validateDrmvyzWebGLContextOwnershipBounds('shader-engine')).toEqual({
      ok: true,
      violations: [],
    })
    expect(validateDrmvyzWebGLContextOwnershipBounds(null)).toMatchObject({
      ok: false,
      violations: [expect.stringContaining('expected no live WebGL context')],
    })
    expect(validateDrmvyzWebGLContextOwnershipBounds('cinematic-worlds')).toMatchObject({
      ok: false,
      violations: [expect.stringContaining('inactive live WebGL engine')],
    })

    retireDrmvyzWebGLContext(shader, 'release-resources')
    expect(validateDrmvyzWebGLContextOwnershipBounds(null)).toEqual({ ok: true, violations: [] })
  })


  it('allows the selected live engine to coexist with a thumbnail from another engine family', () => {
    const shader = registerDrmvyzWebGLContext(fakeContext(), {
      lifetime: 'live-reusable',
      role: 'react-preview',
      engine: 'shader-engine',
      expectedMaxActive: 1,
    })
    const thumbnail = registerDrmvyzWebGLContext(fakeContext(), ownership)

    expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
      activeByEngine: { 'shader-engine': 1, 'cinematic-worlds': 1 },
      activeLiveByEngine: { 'shader-engine': 1 },
    })
    expect(validateDrmvyzWebGLContextOwnershipBounds('shader-engine')).toEqual({
      ok: true,
      violations: [],
    })

    retireDrmvyzWebGLContext(thumbnail, 'terminal-retire')
    retireDrmvyzWebGLContext(shader, 'release-resources')
  })

  it('returns active ownership to baseline across repeated live mount and retirement cycles', () => {
    for (let index = 0; index < 12; index += 1) {
      const engine = index % 2 === 0 ? 'shader-engine' : 'cinematic-worlds'
      const handle = registerDrmvyzWebGLContext(fakeContext(), {
        lifetime: 'live-reusable',
        role: 'react-preview',
        engine,
        expectedMaxActive: 1,
      })
      expect(getDrmvyzWebGLContextDiagnosticsForTests().activeCount).toBe(1)
      retireDrmvyzWebGLContext(handle, 'release-resources')
      expect(getDrmvyzWebGLContextDiagnosticsForTests()).toMatchObject({
        activeCount: 0,
        activeByLifetime: { 'live-reusable': 0, 'transient-thumbnail': 0 },
        activeLiveByEngine: {},
      })
    }
  })

  it('accepts a non-WebGL live engine while retaining only the declared thumbnail pool', () => {
    const thumbnail = registerDrmvyzWebGLContext(fakeContext(), ownership)
    expect(validateDrmvyzWebGLContextOwnershipBounds(null)).toEqual({ ok: true, violations: [] })
    retireDrmvyzWebGLContext(thumbnail, 'terminal-retire')
  })

  it('terminally retires the previous thumbnail family before assigning the single slot', () => {
    const retireFirst = vi.fn()
    const first = claimDrmvyzThumbnailWebGLContext('cinematic-preset', retireFirst)
    expect(getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests()).toEqual({
      activeLeaseCount: 1,
      activeFamily: 'cinematic-preset',
      contextLimit: 1,
    })

    const second = claimDrmvyzThumbnailWebGLContext('shader-scene', vi.fn())
    expect(retireFirst).toHaveBeenCalledTimes(1)
    expect(getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests()).toMatchObject({
      activeLeaseCount: 1,
      activeFamily: 'shader-scene',
    })

    releaseDrmvyzThumbnailWebGLContext(first)
    expect(getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests().activeLeaseCount).toBe(1)
    releaseDrmvyzThumbnailWebGLContext(second)
    expect(getDrmvyzThumbnailWebGLCoordinatorDiagnosticsForTests().activeLeaseCount).toBe(0)
  })

  it('serializes thumbnail family work so replacement cannot race an active render', async () => {
    const order: string[] = []
    let releaseFirst = () => {}
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })

    const first = serializeDrmvyzThumbnailWebGLWork(async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
    })
    const second = serializeDrmvyzThumbnailWebGLWork(async () => {
      order.push('second:start')
      order.push('second:end')
    })

    await Promise.resolve()
    expect(order).toEqual(['first:start'])
    releaseFirst()
    await Promise.all([first, second])
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
  })

})

import { describe, expect, it, vi } from 'vitest'
import { createLiveFpsReporter, normalizeLiveFps } from '../fpsDiagnostics'

describe('FPS diagnostics', () => {
  it('normalizes invalid or unavailable values to zero', () => {
    expect(normalizeLiveFps(60.4)).toBe(60)
    expect(normalizeLiveFps(0)).toBe(0)
    expect(normalizeLiveFps(-1)).toBe(0)
    expect(normalizeLiveFps(Number.NaN)).toBe(0)
    expect(normalizeLiveFps(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('clears a stale FPS once when the render path becomes unavailable', () => {
    const callback = vi.fn()
    const reporter = createLiveFpsReporter(() => callback)

    expect(reporter.report(59.6)).toBe(true)
    expect(reporter.unavailable()).toBe(true)
    expect(reporter.unavailable()).toBe(false)

    expect(callback.mock.calls).toEqual([[60], [0]])
    expect(reporter.getLastReported()).toBe(0)
  })
})

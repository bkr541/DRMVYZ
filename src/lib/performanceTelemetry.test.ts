// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRecentLogEntries } from './logger'
import { installPerformanceTelemetry, PerformanceFrameSampler, recordPerformanceEvent, safePerformanceText } from './performanceTelemetry'

afterEach(() => vi.restoreAllMocks())

describe('bounded performance diagnostics', () => {
  it('summarizes only after ten seconds and excludes suspended time', () => {
    const sampler = new PerformanceFrameSampler()
    const summaries = []
    for (let frame = 0; frame <= 1201; frame++) {
      const summary = sampler.sample(frame * 1000 / 120)
      if (summary) summaries.push(summary)
    }
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({ rafFps: 120 })
    expect(summaries[0].frameP95Ms).toBeCloseTo(1000 / 120)
    expect(sampler.sample(30_000)).toBeNull()
    expect(sampler.sample(30_010)).toBeNull()
  })

  it('redacts URLs and credentials before recording context', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    const secret = 'Bearer secret-token https://media.example/a?token=secret eyJ' + 'a'.repeat(30)
    expect(safePerformanceText(secret)).not.toContain('secret')
    recordPerformanceEvent('engine', 'test', { presetId: 'safe-id', error: secret })
    expect(getRecentLogEntries(1)[0].context).toEqual({ scope: 'engine', presetId: 'safe-id', error: '[credential] [url] [credential]', event: 'test' })
    recordPerformanceEvent('engine', 'engine-ready', { engine: 'canvas' })
    expect(getRecentLogEntries(1)[0].context).toMatchObject({ presetId: 'safe-id', engine: 'canvas', event: 'engine-ready' })
    recordPerformanceEvent('engine', 'engine-initializing', { engine: 'cinema2', generation: 2 })
    expect(getRecentLogEntries(1)[0].context).not.toHaveProperty('error')
    expect(getRecentLogEntries(1)[0].context).not.toHaveProperty('presetId')
  })

  it('records errors passively, bounds bursts, and removes observers on shutdown', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(7)
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    const stop = installPerformanceTelemetry(window)
    for (let i = 0; i < 20; i++) {
      const event = new ErrorEvent('error', { message: 'failed', cancelable: true })
      window.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(console.error).toHaveBeenCalledTimes(10)
    stop()
    expect(cancel).toHaveBeenCalledWith(7)
    window.dispatchEvent(new ErrorEvent('error', { message: 'after cleanup' }))
    expect(console.error).toHaveBeenCalledTimes(10)
  })
})

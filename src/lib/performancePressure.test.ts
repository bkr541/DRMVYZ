import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPerformancePressure, resetPerformancePressureForTests, setPerformancePressure, subscribePerformancePressure } from './performancePressure'

describe('performance pressure', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T00:00:00Z')); resetPerformancePressureForTests() })
  afterEach(() => { resetPerformancePressureForTests(); vi.useRealTimers() })

  it('is the highest level any source holds, and 0 when none do', () => {
    expect(getPerformancePressure()).toBe(0)
    setPerformancePressure('cast', 1)
    setPerformancePressure('gpu', 2)
    expect(getPerformancePressure()).toBe(2)
    setPerformancePressure('gpu', 0)
    expect(getPerformancePressure()).toBe(1)
    setPerformancePressure('cast', 0)
    expect(getPerformancePressure()).toBe(0)
  })

  it('clamps out-of-range levels', () => {
    setPerformancePressure('cast', 9); expect(getPerformancePressure()).toBe(2)
    setPerformancePressure('cast', -3); expect(getPerformancePressure()).toBe(0)
  })

  it('lets a hold expire by itself, and tells subscribers when it does', () => {
    const seen: number[] = []
    subscribePerformancePressure(level => seen.push(level))
    setPerformancePressure('recovery', 2, { holdMs: 60_000 })
    expect(getPerformancePressure()).toBe(2)
    vi.advanceTimersByTime(59_000)
    expect(getPerformancePressure()).toBe(2)
    vi.advanceTimersByTime(2_000)
    expect(getPerformancePressure()).toBe(0)
    expect(seen).toEqual([2, 0])
  })

  it('notifies only when the combined level changes, and stops after unsubscribe', () => {
    const seen: number[] = []
    const stop = subscribePerformancePressure(level => seen.push(level))
    setPerformancePressure('cast', 1)
    setPerformancePressure('cast', 1)
    setPerformancePressure('gpu', 1)
    setPerformancePressure('cast', 2)
    expect(seen).toEqual([1, 2])
    stop()
    setPerformancePressure('cast', 0); setPerformancePressure('gpu', 0)
    expect(seen).toEqual([1, 2])
  })

  it('a listener that throws does not stop the others', () => {
    const seen: number[] = []
    subscribePerformancePressure(() => { throw new Error('boom') })
    subscribePerformancePressure(level => seen.push(level))
    setPerformancePressure('cast', 2)
    expect(seen).toEqual([2])
  })
})

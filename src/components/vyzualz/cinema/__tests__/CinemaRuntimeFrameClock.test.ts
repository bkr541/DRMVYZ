import { describe, expect, it } from 'vitest'
import {
  CINEMA_MAX_FRAME_DELTA_SEC,
  sampleCinemaRuntimeFrameClock,
  type CinemaRuntimeFrameClockState,
} from '../runtime/CinemaRuntimeFrameClock'

function runSchedule(hz: number, frames: number): number[] {
  let state: CinemaRuntimeFrameClockState = { lastNowMs: null }
  return Array.from({ length: frames }, (_, index) => {
    const sample = sampleCinemaRuntimeFrameClock(state, index * (1000 / hz))
    state = sample.state
    return sample.deltaTimeSec
  })
}

describe('Cinema RAF frame clock', () => {
  it.each([30, 60, 120])('measures every %s Hz RAF step instead of hard-coding 1/60', hz => {
    const deltas = runSchedule(hz, 120)
    expect(deltas[0]).toBe(0)
    expect(deltas.slice(1).every(delta => Math.abs(delta - 1 / hz) < 1e-9)).toBe(true)
  })

  it('preserves a dropped frame and suppresses destructive suspension deltas', () => {
    let state: CinemaRuntimeFrameClockState = { lastNowMs: null }
    const samples = [0, 16, 32, 82, 1082, 1098].map(nowMs => {
      const sample = sampleCinemaRuntimeFrameClock(state, nowMs)
      state = sample.state
      return sample
    })
    expect(samples[3]).toMatchObject({ deltaTimeSec: 0.05, timingDiscontinuity: false })
    expect(samples[4]).toMatchObject({ deltaTimeSec: 0, timingDiscontinuity: true })
    expect(samples[5]).toMatchObject({ deltaTimeSec: 0.016, timingDiscontinuity: false })
    expect(CINEMA_MAX_FRAME_DELTA_SEC).toBe(0.1)
  })

  it('treats a backwards or invalid RAF timestamp as a discontinuity without a negative delta', () => {
    expect(sampleCinemaRuntimeFrameClock({ lastNowMs: 100 }, 90)).toMatchObject({
      deltaTimeSec: 0,
      timingDiscontinuity: true,
    })
    expect(sampleCinemaRuntimeFrameClock({ lastNowMs: null }, Number.NaN)).toMatchObject({
      deltaTimeSec: 0,
      timingDiscontinuity: true,
    })
  })
})

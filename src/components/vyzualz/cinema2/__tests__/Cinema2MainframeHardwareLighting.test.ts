import { describe, expect, it } from 'vitest'
import { evaluateCinema2MainframePattern } from '../modules/mainframe/Cinema2MainframePatternEngine'
import { resolveCinema2MainframeHardwareLighting } from '../modules/mainframe/Cinema2MainframeHardwareLighting'
import { CINEMA2_MAINFRAME_ZERO_IMPULSES, CINEMA2_MAINFRAME_ZERO_SIGNALS } from '../modules/mainframe/Cinema2MainframeReactivity'

const makeFrame = (signals = {}, impulses = {}, active = true) => evaluateCinema2MainframePattern({
  pattern: 'radar-sweep', beats: 3.5, active,
  signals: { ...CINEMA2_MAINFRAME_ZERO_SIGNALS, ...signals },
  impulses: { ...CINEMA2_MAINFRAME_ZERO_IMPULSES, ...impulses },
})

describe('Mainframe-only component illumination channels', () => {
  it('keeps terminals, vias, radars, chips independent with no invented idle events', () => {
    expect(resolveCinema2MainframeHardwareLighting(makeFrame())).toEqual([0, 0, 0, 0])
    expect(resolveCinema2MainframeHardwareLighting(makeFrame({}, { kick: 1 }))).toEqual([0.76, 0, 0, 0])
    const withMids = resolveCinema2MainframeHardwareLighting(makeFrame({ mid: 0.8 }))
    expect(withMids[2]).toBeGreaterThan(0)
    expect(withMids[3]).toBeGreaterThan(withMids[2])
    expect(withMids[0]).toBe(0)
    expect(withMids[1]).toBe(0)
    const withHighs = resolveCinema2MainframeHardwareLighting(makeFrame({ high: 0.8 }))
    expect(withHighs[1]).toBeGreaterThan(withHighs[3])
    expect(withHighs[0]).toBe(0)
  })

  it('uses the existing phrase/downbeat/drop envelopes, clamps peaks and freezes inactive transport', () => {
    const accents = resolveCinema2MainframeHardwareLighting(makeFrame({}, { phrase: 1, downbeat: 1 }))
    expect(accents[2]).toBeGreaterThan(0)
    expect(accents[3]).toBeGreaterThan(0)
    expect(resolveCinema2MainframeHardwareLighting(makeFrame({ high: 4, mid: 9 }, { drop: 4 })))
      .toEqual([1, 1, 1, 1])
    expect(resolveCinema2MainframeHardwareLighting(makeFrame({ mid: 1 }, { drop: 1 }, false)))
      .toEqual([0, 0, 0, 0])
  })
})

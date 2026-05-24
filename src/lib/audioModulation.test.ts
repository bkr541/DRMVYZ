import { describe, it, expect } from 'vitest'
import { gateAudioBands } from './audioModulation'
import type { AudioBandValues } from './audioModulation'

// Representative "live" band reading — non-zero across every field.
const LIVE_BANDS: AudioBandValues = {
  bass:   0.82,
  lowMid: 0.55,
  mid:    0.41,
  high:   0.33,
  volume: 0.76,
  beat:   1.0,
}

describe('gateAudioBands — audio reactivity toggle', () => {
  it('returns the original rawBands object (by reference) when audio reactivity is on', () => {
    const result = gateAudioBands(LIVE_BANDS, true)
    expect(result).toBe(LIVE_BANDS)
  })

  it('returns all-zero bands when audio reactivity is off, regardless of input values', () => {
    const result = gateAudioBands(LIVE_BANDS, false)
    expect(result.bass).toBe(0)
    expect(result.lowMid).toBe(0)
    expect(result.mid).toBe(0)
    expect(result.high).toBe(0)
    expect(result.volume).toBe(0)
    expect(result.beat).toBe(0)
  })

  it('does not mutate rawBands when audio reactivity is off', () => {
    const input: AudioBandValues = { ...LIVE_BANDS }
    gateAudioBands(input, false)
    expect(input).toEqual(LIVE_BANDS)
  })

  it('returns all-zero bands for the zero-input case too (on→off idempotency)', () => {
    const silent: AudioBandValues = { bass: 0, lowMid: 0, mid: 0, high: 0, volume: 0, beat: 0 }
    const result = gateAudioBands(silent, false)
    expect(result.bass).toBe(0)
    expect(result.volume).toBe(0)
  })

  // Regression: confirms that the same analyser reading produces no audio-driven
  // visual changes when reactivity is disabled.  Any downstream parameter derived
  // from activeBands (transitions bass/beat, datamosh volume, generative volume
  // threshold, in-canvas meter) will be zero because activeBands is all-zero.
  it('regression — identical rawBands input yields zero activeBands when toggled off', () => {
    const withOn  = gateAudioBands(LIVE_BANDS, true)
    const withOff = gateAudioBands(LIVE_BANDS, false)

    // Audio on: values pass through
    expect(withOn.bass).toBeGreaterThan(0)
    expect(withOn.volume).toBeGreaterThan(0)
    expect(withOn.beat).toBeGreaterThan(0)

    // Audio off: same input → everything is zero
    expect(withOff.bass).toBe(0)
    expect(withOff.volume).toBe(0)
    expect(withOff.beat).toBe(0)
    expect(withOff.lowMid).toBe(0)
    expect(withOff.mid).toBe(0)
    expect(withOff.high).toBe(0)
  })
})

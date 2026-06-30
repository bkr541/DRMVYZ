import { describe, expect, it } from 'vitest'
import { CONSTELLATION_BEAM_INSTANCE_FLOATS } from '../ConstellationBeamGeometry'
import {
  CONSTELLATION_MAX_CURTAINS,
  writeConstellationCurtainInstances,
} from '../ConstellationCurtains'

describe('Reactive Constellation background curtains', () => {
  it('writes deterministic, finite, bounded instances into preallocated storage', () => {
    const first = new Float32Array(CONSTELLATION_MAX_CURTAINS * CONSTELLATION_BEAM_INSTANCE_FLOATS)
    const second = new Float32Array(first.length)
    const input = {
      seed: 48003,
      count: 18,
      spread: 1.62,
      depthSpread: 1.18,
      timeSec: 12.5,
      intensity: 0.7,
    }

    expect(writeConstellationCurtainInstances(first, input)).toBe(18)
    expect(writeConstellationCurtainInstances(second, input)).toBe(18)
    expect(Array.from(first)).toEqual(Array.from(second))
    expect(Array.from(first).every(Number.isFinite)).toBe(true)
    for (let index = 0; index < 18; index += 1) {
      const offset = index * CONSTELLATION_BEAM_INSTANCE_FLOATS
      expect(first[offset + 6]).toBeGreaterThan(0)
      expect(first[offset + 6]).toBeLessThanOrEqual(1)
      expect(first[offset + 7]).toBeGreaterThan(0)
      expect(first[offset + 8]).toBeGreaterThanOrEqual(0)
      expect(first[offset + 8]).toBeLessThanOrEqual(1)
    }
  })

  it('honors storage and global caps and disables cleanly at zero intensity', () => {
    const tiny = new Float32Array(3 * CONSTELLATION_BEAM_INSTANCE_FLOATS)
    expect(writeConstellationCurtainInstances(tiny, {
      seed: 1, count: 999, spread: 1, depthSpread: 1, timeSec: 0, intensity: 1,
    })).toBe(3)
    expect(writeConstellationCurtainInstances(tiny, {
      seed: 1, count: 3, spread: 1, depthSpread: 1, timeSec: 0, intensity: 0,
    })).toBe(0)
  })
})

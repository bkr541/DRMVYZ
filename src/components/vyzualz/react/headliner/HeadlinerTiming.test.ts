import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  HEADLINER_FALLBACK_BPM,
  HEADLINER_NEUTRAL_ENERGY,
  HeadlinerTimingTracker,
  headlinerReactiveGain,
} from './HeadlinerTiming'

const trackContext = (overrides: Partial<SharedPerformanceContext> = {}): SharedPerformanceContext => ({
  ...createSharedPerformanceFallbackContext(10),
  bpm: 90,
  absoluteBeat: 15,
  beatPhase: 0.5,
  audioTimeSec: 10,
  ...overrides,
})

describe('Headliner timing', () => {
  it('follows the loaded track’s BPM and beat grid with BPM Sync on', () => {
    const timing = new HeadlinerTimingTracker().update(100, trackContext(), true, 10)
    expect(timing.synced).toBe(true)
    expect(timing.secondsPerBeat).toBeCloseTo(60 / 90)
    expect(timing.beat).toBeCloseTo(15.5)
  })

  it('runs at a steady 120 BPM off wall time with BPM Sync off, whatever the track’s tempo', () => {
    const timing = new HeadlinerTimingTracker().update(3, trackContext(), false, 10)
    expect(timing.synced).toBe(false)
    expect(timing.secondsPerBeat).toBeCloseTo(60 / HEADLINER_FALLBACK_BPM)
    expect(timing.beat).toBeCloseTo(6)
  })

  it('falls back to 120 BPM when the audio has no BPM, even with BPM Sync on', () => {
    const timing = new HeadlinerTimingTracker().update(2, trackContext({ bpm: 0 }), true)
    expect(timing.synced).toBe(false)
    expect(timing.beat).toBeCloseTo(4)
  })

  it('pulses on a kick, decays, and stays neutral without analysed audio', () => {
    const tracker = new HeadlinerTimingTracker()
    expect(tracker.update(1, null, true).energy).toBe(HEADLINER_NEUTRAL_ENERGY)
    const hit = tracker.update(1.016, trackContext({ kick: true, kickStrength: 0.9 }), true)
    expect(hit.kick).toBeCloseTo(0.9)
    let later = hit
    for (let step = 1; step <= 10; step += 1) later = tracker.update(1.016 + step * 0.1, trackContext({ kick: false }), true)
    expect(later.kick).toBeLessThan(0.05)
  })

  it('leaves the effect unchanged at neutral energy with no kick and scales it with the reactions', () => {
    expect(headlinerReactiveGain({ energy: HEADLINER_NEUTRAL_ENERGY, kick: 0 }, 1, 1)).toBe(1)
    expect(headlinerReactiveGain({ energy: 1, kick: 0 }, 1, 0)).toBeGreaterThan(1)
    expect(headlinerReactiveGain({ energy: 1, kick: 0 }, 0, 0)).toBe(1)
    expect(headlinerReactiveGain({ energy: 0.5, kick: 1 }, 0, 1)).toBeGreaterThan(1)
  })

  it('reports each kick, snare and downbeat once, on the frame it starts', () => {
    const tracker = new HeadlinerTimingTracker()
    expect(tracker.update(1, trackContext({ downbeat: false }), true).kickHit).toBe(false)
    const first = tracker.update(1.016, trackContext({ kick: true, snare: true, downbeat: true }), true)
    expect(first).toMatchObject({ kickHit: true, snareHit: true, downbeatHit: true })
    // Still flagged on the next frame: not a new hit.
    const held = tracker.update(1.032, trackContext({ kick: true, snare: true, downbeat: true }), true)
    expect(held).toMatchObject({ kickHit: false, snareHit: false, downbeatHit: false })
    tracker.update(1.048, trackContext({ kick: false, snare: false, downbeat: false }), true)
    expect(tracker.update(1.064, trackContext({ kick: true }), true).kickHit).toBe(true)
  })

  it('counts a bar as four beats of the steady tempo when there is no grid, and carries the build-up', () => {
    const tracker = new HeadlinerTimingTracker()
    expect(tracker.update(0.1, null, true).downbeatHit).toBe(false)
    expect(tracker.update(1.9, null, true).downbeatHit).toBe(false)
    expect(tracker.update(2.1, null, true).downbeatHit).toBe(true)
    expect(tracker.update(2.2, trackContext({ bpm: 0, buildProgress: 0.4 }), true).build).toBeCloseTo(0.4)
  })
})

import { describe, expect, it } from 'vitest'
import { ScopePhosphorQualityController } from '../ScopePhosphorQualityController'
import type { ScopePhosphorQuality } from '../soundDrawingPhosphorPlan'

/**
 * Feeds `frames` frames of `frameMs` starting at `startMs`, one per 16 ms of
 * wall clock, and returns the tier afterwards. Time is injected so the policy
 * is fully deterministic.
 */
function run(
  controller: ScopePhosphorQualityController,
  frameMs: number,
  frames: number,
  startMs: number,
): { quality: ScopePhosphorQuality; endMs: number } {
  let now = startMs
  let quality = controller.currentQuality
  for (let i = 0; i < frames; i++) {
    now += 16
    quality = controller.recordFrame(frameMs, now)
  }
  return { quality, endMs: now }
}

function auto(initial: ScopePhosphorQuality = 'ultra'): ScopePhosphorQualityController {
  return new ScopePhosphorQualityController('auto', initial)
}

describe('explicit selection', () => {
  it('honours an explicit tier and ignores frame timing entirely', () => {
    const controller = new ScopePhosphorQualityController('high', 'ultra')
    expect(controller.currentQuality).toBe('high')
    // Catastrophically slow frames must not override a deliberate choice.
    expect(run(controller, 200, 400, 0).quality).toBe('high')
    expect(controller.getSnapshot().downshiftCount).toBe(0)
  })

  it('switches to automatic control when set back to auto', () => {
    const controller = new ScopePhosphorQualityController('low', 'ultra')
    controller.setRequested('auto', 'ultra')
    expect(controller.currentQuality).toBe('ultra')
    expect(controller.getSnapshot().requested).toBe('auto')
  })

  it('does not immediately override an explicit change with automatic control', () => {
    const controller = auto('ultra')
    run(controller, 40, 100, 0)
    controller.setRequested('ultra', 'ultra')
    expect(controller.currentQuality).toBe('ultra')
    expect(controller.getSnapshot().lastChangeReason).toBe('explicit')
  })
})

describe('downshift', () => {
  it('drops a tier when frames are consistently slow', () => {
    const controller = auto('ultra')
    expect(run(controller, 40, 100, 0).quality).toBe('high')
    expect(controller.getSnapshot().lastChangeReason).toBe('slow-frame')
    expect(controller.getSnapshot().downshiftCount).toBe(1)
  })

  it('needs enough samples before deciding', () => {
    const controller = auto('ultra')
    // Well past the evaluation interval but under the sample minimum.
    let now = 0
    for (let i = 0; i < 5; i++) {
      now += 500
      controller.recordFrame(60, now)
    }
    expect(controller.currentQuality).toBe('ultra')
  })

  it('holds a cooldown between successive downshifts', () => {
    const controller = auto('ultra')
    const first = run(controller, 40, 100, 0)
    expect(first.quality).toBe('high')
    // Immediately after, still inside the downshift cooldown.
    const second = run(controller, 40, 40, first.endMs)
    expect(second.quality).toBe('high')
  })

  it('continues dropping once each cooldown expires', () => {
    const controller = auto('ultra')
    let now = 0
    let quality = controller.currentQuality
    // Sustained heavy load across a long window.
    for (let i = 0; i < 3000; i++) {
      now += 16
      quality = controller.recordFrame(40, now)
    }
    expect(quality).toBe('low')
  })

  it('never drops below the cheapest tier', () => {
    const controller = auto('low')
    expect(run(controller, 500, 3000, 0).quality).toBe('low')
    expect(controller.getSnapshot().downshiftCount).toBe(0)
  })
})

describe('upshift', () => {
  it('raises a tier when there is sustained headroom', () => {
    const controller = auto('low')
    expect(run(controller, 4, 200, 0).quality).toBe('medium')
    expect(controller.getSnapshot().lastChangeReason).toBe('stable-headroom')
    expect(controller.getSnapshot().upshiftCount).toBe(1)
  })

  it('waits substantially longer to raise than to lower', () => {
    const fast = auto('low')
    const firstUp = run(fast, 4, 200, 0)
    expect(firstUp.quality).toBe('medium')
    // The downshift cooldown would already have elapsed here; the upshift
    // cooldown must not have.
    const soon = run(fast, 4, 100, firstUp.endMs)
    expect(soon.quality).toBe('medium')
  })

  it('never rises above the most expensive tier', () => {
    const controller = auto('ultra')
    expect(run(controller, 1, 3000, 0).quality).toBe('ultra')
    expect(controller.getSnapshot().upshiftCount).toBe(0)
  })
})

describe('stability', () => {
  it('does not oscillate at a frame time between the two thresholds', () => {
    // 15 ms is below 'high' downshift (20.5) and above 'high' headroom (10):
    // the tier is correct and must simply be left alone.
    const controller = auto('high')
    let now = 0
    for (let i = 0; i < 5000; i++) {
      now += 16
      controller.recordFrame(15, now)
    }
    const snapshot = controller.getSnapshot()
    expect(controller.currentQuality).toBe('high')
    expect(snapshot.downshiftCount).toBe(0)
    expect(snapshot.upshiftCount).toBe(0)
  })

  it('settles rather than pumping when load sits near a threshold', () => {
    // Alternating fast and slow frames averaging ~17ms — genuinely marginal.
    const controller = auto('ultra')
    let now = 0
    for (let i = 0; i < 6000; i++) {
      now += 16
      controller.recordFrame(i % 2 === 0 ? 26 : 8, now)
    }
    const snapshot = controller.getSnapshot()
    // It may adjust, but it must not thrash back and forth indefinitely.
    expect(snapshot.downshiftCount + snapshot.upshiftCount).toBeLessThanOrEqual(4)
  })

  it('recovers to a higher tier after load clears', () => {
    const controller = auto('ultra')
    const loaded = run(controller, 40, 600, 0)
    expect(loaded.quality).not.toBe('ultra')
    const recovered = run(controller, 3, 4000, loaded.endMs)
    // Given long sustained headroom it climbs back.
    expect(recovered.quality).toBe('ultra')
  })
})

describe('robustness', () => {
  it('ignores non-finite and negative frame times', () => {
    const controller = auto('ultra')
    let now = 0
    for (let i = 0; i < 200; i++) {
      now += 16
      controller.recordFrame(Number.NaN, now)
      controller.recordFrame(-5, now)
    }
    expect(controller.currentQuality).toBe('ultra')
    expect(controller.getSnapshot().sampleCount).toBe(0)
  })

  it('reports no average before any sample', () => {
    expect(auto('high').getSnapshot().averageFrameMs).toBeNull()
  })

  it('recomputes the automatic tier after a context restore', () => {
    const controller = auto('ultra')
    run(controller, 40, 600, 0)
    expect(controller.currentQuality).not.toBe('ultra')
    // A restored context may be a different GPU, so the tier is re-derived.
    controller.handleContextRestored('medium')
    expect(controller.currentQuality).toBe('medium')
    expect(controller.getSnapshot().lastChangeReason).toBe('context-restored')
  })

  it('preserves an explicit tier across a context restore', () => {
    const controller = new ScopePhosphorQualityController('high', 'ultra')
    controller.handleContextRestored('low')
    expect(controller.currentQuality).toBe('high')
  })
})

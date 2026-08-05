import { describe, expect, it } from 'vitest'
import {
  clampTrackTimelinePlayheadTime,
  resolveTrackTimelinePlayheadRatio,
} from './trackTimelinePlayhead'

describe('track timeline playhead', () => {
  it('clamps transport time to the loaded track duration', () => {
    expect(clampTrackTimelinePlayheadTime(-3, 120)).toBe(0)
    expect(clampTrackTimelinePlayheadTime(42.5, 120)).toBe(42.5)
    expect(clampTrackTimelinePlayheadTime(140, 120)).toBe(120)
  })

  it('returns a stable normalized position for the shared timeline rows', () => {
    expect(resolveTrackTimelinePlayheadRatio(30, 120)).toBe(0.25)
    expect(resolveTrackTimelinePlayheadRatio(999, 120)).toBe(1)
    expect(resolveTrackTimelinePlayheadRatio(Number.NaN, 120)).toBe(0)
    expect(resolveTrackTimelinePlayheadRatio(10, 0)).toBe(0)
  })
})

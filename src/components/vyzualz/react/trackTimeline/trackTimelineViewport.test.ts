import { describe, expect, it } from 'vitest'
import {
  createTrackTimelineViewport,
  estimateTrackTimelineBarDuration,
  moveTrackTimelineViewport,
  normalizeTrackTimelineViewport,
  resolveTrackTimelineViewportRatio,
} from './trackTimelineViewport'

const bars = Array.from({ length: 80 }, (_, index) => ({
  barIndex: index,
  barNumber: index + 1,
  start: index * 2,
  end: index * 2 + 2,
  gridConfidence: 1,
}))

describe('track timeline viewport', () => {
  it('normalizes a viewport while preserving its duration near the track end', () => {
    expect(normalizeTrackTimelineViewport({ startSec: 95, endSec: 115 }, 100)).toEqual({
      startSec: 80,
      endSec: 100,
    })
  })

  it('uses the median detected bar duration', () => {
    expect(estimateTrackTimelineBarDuration(bars, 140, 4)).toBe(2)
  })

  it('builds a centered 16-bar viewport and clamps it to the track', () => {
    expect(createTrackTimelineViewport(160, bars, 120, 4, 16, 154)).toEqual({
      startSec: 128,
      endSec: 160,
    })
  })

  it('moves a viewport without changing its width', () => {
    expect(moveTrackTimelineViewport({ startSec: 20, endSec: 40 }, 92, 100)).toEqual({
      startSec: 80,
      endSec: 100,
    })
  })

  it('returns a local playhead ratio only while the playhead is in view', () => {
    expect(resolveTrackTimelineViewportRatio(35, { startSec: 20, endSec: 50 })).toBe(0.5)
    expect(resolveTrackTimelineViewportRatio(10, { startSec: 20, endSec: 50 })).toBeNull()
  })
})

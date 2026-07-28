import { describe, expect, it } from 'vitest'
import { getSoundDrawingTimelineRowCount } from '../SoundDrawingTimelineLane'
import type { SoundDrawingClip } from '../ReactTypes'

function clip(id: string, startSec: number, endSec: number): SoundDrawingClip {
  return {
    id,
    trackId: 'track-1',
    layerId: `layer-${id}`,
    startSec,
    endSec,
    enabled: true,
    zIndex: 0,
    fadeInMs: 0,
    fadeOutMs: 0,
  }
}

describe('Sound Drawing timeline row layout', () => {
  it('does not reserve a phantom clip row for an empty timeline', () => {
    expect(getSoundDrawingTimelineRowCount([])).toBe(0)
  })

  it('uses one row for clips that do not overlap', () => {
    expect(getSoundDrawingTimelineRowCount([
      clip('a', 0, 2),
      clip('b', 2, 4),
    ])).toBe(1)
  })

  it('adds rows only when clips overlap', () => {
    expect(getSoundDrawingTimelineRowCount([
      clip('a', 0, 4),
      clip('b', 1, 3),
    ])).toBe(2)
  })
})

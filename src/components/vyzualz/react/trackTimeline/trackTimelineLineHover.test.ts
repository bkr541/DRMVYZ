import { describe, expect, it } from 'vitest'
import { resolveTrackTimelineLineHoverValue } from './trackTimelineCanvas'

const points = [
  { time: 0, value: 0 },
  { time: 10, value: 1 },
]

describe('Track Timeline line hover values', () => {
  it('interpolates the value at the pointer time when the pointer is near the line', () => {
    const hover = resolveTrackTimelineLineHoverValue({
      points,
      viewport: { startSec: 0, endSec: 10 },
      width: 100,
      height: 60,
      x: 50,
      y: 29,
    })

    expect(hover?.time).toBe(5)
    expect(hover?.value).toBe(0.5)
    expect(hover?.x).toBe(50)
    expect(hover?.y).toBe(29)
  })

  it('does not report a value when the pointer is away from the line', () => {
    expect(resolveTrackTimelineLineHoverValue({
      points,
      viewport: { startSec: 0, endSec: 10 },
      width: 100,
      height: 60,
      x: 50,
      y: 2,
    })).toBeNull()
  })
})

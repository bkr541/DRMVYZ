import { describe, expect, it } from 'vitest'
import { FrameCadence } from './frameCadence'

describe('relay frame cadence', () => {
  it.each([30, 60])('copies %s frames at 120 Hz without changing producer timing', fps => {
    const cadence = new FrameCadence(fps)
    let copies = 0
    for (let frame = 0; frame < 120; frame++) if (cadence.due(frame * 1000 / 120)) copies++
    expect(copies).toBe(fps)
  })

  it('never catches up with a burst after a stall and tolerates clock resets', () => {
    const cadence = new FrameCadence(60)
    expect(cadence.due(0)).toBe(true)
    expect(cadence.due(1000)).toBe(true)
    expect(cadence.due(1001)).toBe(false)
    expect(cadence.due(1017)).toBe(true)
    expect(cadence.due(0)).toBe(true)
    expect(cadence.due(NaN)).toBe(false)
  })
})

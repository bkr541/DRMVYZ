import { describe, expect, it } from 'vitest'
import {
  ReactorChoreographyController,
  type ReactorChoreographyMusicInput,
} from '../reactorChoreography'

function baseInput(overrides: Partial<ReactorChoreographyMusicInput> = {}): ReactorChoreographyMusicInput {
  return {
    deltaSec: 1 / 60,
    timingDiscontinuity: false,
    isPlaying: true,
    energy: 0,
    scope: 'track-1',
    frameOrdinal: 0,
    clocks: {},
    downbeat: null,
    drop: null,
    ...overrides,
  }
}

describe('ReactorChoreographyController', () => {
  it('the Off trigger never fires and never bursts', () => {
    const controller = new ReactorChoreographyController()
    let last = controller.update(baseInput(), 'off')
    for (let frame = 0; frame < 30; frame += 1) {
      last = controller.update(baseInput({
        clocks: { bar: { hit: true, eventId: `bar-${frame}`, index: frame } },
        drop: { active: true, eventId: `drop-${frame}`, index: frame },
        energy: 1,
      }), 'off')
    }
    expect(last.started).toBe(false)
    expect(last.rerollCount).toBe(0)
    expect(last.burst).toBe(0)
    expect(last.burstPhase).toBe(0)
  })

  it('consumes a clock hit once per event id and re-rolls on a fresh id', () => {
    const controller = new ReactorChoreographyController()
    const hitBar = (eventId: string) =>
      controller.update(baseInput({ clocks: { bar: { hit: true, eventId, index: 4 } } }), 'bar')

    const first = hitBar('bar:a')
    expect(first.started).toBe(true)
    expect(first.rerollCount).toBe(1)

    // Same event id on the next frames — held hit, no double count.
    expect(hitBar('bar:a').started).toBe(false)
    expect(hitBar('bar:a').rerollCount).toBe(1)

    const second = hitBar('bar:b')
    expect(second.started).toBe(true)
    expect(second.rerollCount).toBe(2)

    // A frame with no hit does not advance.
    const idle = controller.update(baseInput(), 'bar')
    expect(idle.started).toBe(false)
    expect(idle.rerollCount).toBe(2)
  })

  it('falls back to the index identity when a drop event carries no id', () => {
    const controller = new ReactorChoreographyController()
    const drop = (active: boolean, index: number) =>
      controller.update(baseInput({ drop: { active, eventId: null, index } }), 'drop')

    expect(drop(true, 1).rerollCount).toBe(1)
    expect(drop(true, 1).rerollCount).toBe(1) // same index → de-duped
    expect(drop(false, 1).rerollCount).toBe(1)
    expect(drop(true, 2).rerollCount).toBe(2) // fresh index → fires
  })

  it('the Energy trigger arms and re-arms with hysteresis', () => {
    const controller = new ReactorChoreographyController()
    const atEnergy = (energy: number, frameOrdinal: number) =>
      controller.update(baseInput({ energy, frameOrdinal }), 'energy')

    expect(atEnergy(0.4, 0).started).toBe(false)
    expect(atEnergy(0.75, 1).started).toBe(true)   // crosses the fire threshold
    expect(atEnergy(0.8, 2).started).toBe(false)   // still hot, not re-armed
    expect(atEnergy(0.6, 3).started).toBe(false)   // above the re-arm floor
    expect(atEnergy(0.5, 4).started).toBe(false)   // drops below re-arm → armed
    expect(atEnergy(0.9, 5).started).toBe(true)    // fires again
  })

  it('kicks a decaying burst envelope and an expanding ring on each event', () => {
    const controller = new ReactorChoreographyController()
    const fired = controller.update(
      baseInput({ clocks: { bar: { hit: true, eventId: 'bar:a', index: 1 } } }),
      'bar',
    )
    expect(fired.burst).toBeGreaterThan(0.9)
    expect(fired.burstPhase).toBe(0)

    let frame = controller.update(baseInput({ deltaSec: 0.1 }), 'bar')
    expect(frame.burstPhase).toBeGreaterThan(0)
    expect(frame.burst).toBeLessThan(fired.burst)

    // Mid-decay: the ring has swept past its full extent, brightness still fading.
    for (let i = 0; i < 6; i += 1) frame = controller.update(baseInput({ deltaSec: 0.1 }), 'bar')
    expect(frame.burstPhase).toBeGreaterThan(1)
    expect(frame.burst).toBeGreaterThan(0)

    // Well past the decay window — the burst returns fully to rest.
    for (let i = 0; i < 20; i += 1) frame = controller.update(baseInput({ deltaSec: 0.1 }), 'bar')
    expect(frame.burst).toBe(0)
    expect(frame.burstPhase).toBe(0)
  })

  it('a timing discontinuity resets the re-roll count and burst', () => {
    const controller = new ReactorChoreographyController()
    controller.update(baseInput({ clocks: { bar: { hit: true, eventId: 'bar:a', index: 1 } } }), 'bar')
    const afterReset = controller.update(baseInput({ timingDiscontinuity: true }), 'bar')
    expect(afterReset.rerollCount).toBe(0)
    expect(afterReset.burst).toBe(0)
  })

  it('does not fire while playback is stopped', () => {
    const controller = new ReactorChoreographyController()
    const result = controller.update(
      baseInput({ isPlaying: false, clocks: { bar: { hit: true, eventId: 'bar:a', index: 1 } } }),
      'bar',
    )
    expect(result.started).toBe(false)
    expect(result.rerollCount).toBe(0)
  })
})

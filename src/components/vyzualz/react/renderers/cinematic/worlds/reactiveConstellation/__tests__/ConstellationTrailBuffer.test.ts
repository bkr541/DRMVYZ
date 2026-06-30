import { describe, expect, it } from 'vitest'
import {
  ConstellationTrailBuffer,
  constellationTrailAgeWeight,
} from '../ConstellationTrailBuffer'

function endpoints(value: number, edgeCount = 2): Float32Array {
  const result = new Float32Array(edgeCount * 6)
  for (let index = 0; index < result.length; index += 1) result[index] = value + index * 0.01
  return result
}

describe('ConstellationTrailBuffer', () => {
  it('keeps a bounded newest-first ring and overwrites the oldest sample', () => {
    const trails = new ConstellationTrailBuffer()
    trails.configure({ edgeCount: 2, sampleCapacity: 3, topologyRevision: 1 })
    for (let value = 1; value <= 4; value += 1) {
      expect(trails.capture({ endpoints: endpoints(value), deltaTimeSec: 1, spacingSec: 0.01, isPlaying: true })).toBe(true)
    }

    expect(trails.getSampleCount()).toBe(3)
    expect(trails.getCapacity()).toBe(3)
    const storage = trails.getStorage()
    expect(storage[trails.getSampleOffset(0)]).toBeCloseTo(4)
    expect(storage[trails.getSampleOffset(1)]).toBeCloseTo(3)
    expect(storage[trails.getSampleOffset(2)]).toBeCloseTo(2)
    expect(trails.getSampleOffset(3)).toBe(-1)
  })

  it('uses predictable monotonic age decay', () => {
    const weights = [0, 1, 2, 3].map(age => constellationTrailAgeWeight(age, 0.75))
    expect(weights[0]).toBe(1)
    expect(weights[1]).toBeCloseTo(0.75)
    expect(weights[2]).toBeCloseTo(0.5625)
    expect(weights[3]).toBeLessThan(weights[2])
  })

  it('resets samples and invalidates history when topology changes', () => {
    const trails = new ConstellationTrailBuffer()
    trails.configure({ edgeCount: 1, sampleCapacity: 4, topologyRevision: 5 })
    trails.capture({ endpoints: endpoints(2, 1), deltaTimeSec: 1, spacingSec: 0.01, isPlaying: true })
    expect(trails.getSampleCount()).toBe(1)

    trails.reset()
    expect(trails.getSampleCount()).toBe(0)
    expect(Array.from(trails.getStorage()).every(value => value === 0)).toBe(true)

    trails.capture({ endpoints: endpoints(3, 1), deltaTimeSec: 1, spacingSec: 0.01, isPlaying: true })
    expect(trails.configure({ edgeCount: 2, sampleCapacity: 4, topologyRevision: 6 })).toBe(true)
    expect(trails.getSampleCount()).toBe(0)
    expect(trails.getEdgeCount()).toBe(2)
    expect(trails.getTopologyRevision()).toBe(6)
  })

  it('does not mutate samples or spacing state while paused', () => {
    const trails = new ConstellationTrailBuffer()
    trails.configure({ edgeCount: 1, sampleCapacity: 3, topologyRevision: 1 })
    trails.capture({ endpoints: endpoints(1, 1), deltaTimeSec: 1, spacingSec: 0.05, isPlaying: true })
    const revision = trails.getMutationRevision()
    const snapshot = Array.from(trails.getStorage())

    for (let frame = 0; frame < 120; frame += 1) {
      expect(trails.capture({ endpoints: endpoints(9, 1), deltaTimeSec: 1, spacingSec: 0.05, isPlaying: false })).toBe(false)
    }
    expect(trails.getMutationRevision()).toBe(revision)
    expect(Array.from(trails.getStorage())).toEqual(snapshot)
    expect(trails.getSampleCount()).toBe(1)
  })
})

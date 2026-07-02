import { describe, expect, it } from 'vitest'
import { createNeonLatticeSyntheticPreviewFrame } from '../neonLatticePreview'

function preview(index: number) {
  return createNeonLatticeSyntheticPreviewFrame({
    index,
    frameBudget: 9,
    timeSec: 31.5 + index * 0.3,
    bpm: 150,
    requestedSectionType: 'verse',
    presetId: 'preset-nl-reverie-keygrid',
  })
}

describe('deterministic Neon Lattice synthetic previews', () => {
  it('is deterministic and isolated to a stable preview source identity', () => {
    expect(preview(7)).toEqual(preview(7))
    expect(preview(7)).toMatchObject({
      sourceId: 'thumbnail:preset-nl-reverie-keygrid',
      trackId: 'thumbnail:preset-nl-reverie-keygrid',
      sampleRate: 48_000,
    })
  })

  it('demonstrates canonical beat, transient, build, drop, and all phrase boundaries', () => {
    const frames = Array.from({ length: 9 }, (_, index) => preview(index))
    expect(frames.some(frame => frame.rhythm.beatHit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.downbeatHit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.kickHit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.snareHit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.hatHit)).toBe(true)
    expect(frames.some(frame => frame.energy.buildProgress > 0.8)).toBe(true)
    expect(frames.some(frame => frame.energy.dropImpact > 0.9)).toBe(true)
    expect(frames.some(frame => frame.rhythm.phrase4Hit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.phrase8Hit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.phrase16Hit)).toBe(true)
    expect(frames.some(frame => frame.rhythm.phrase32Hit)).toBe(true)
    expect(frames.map(frame => frame.rhythm.beatIndex)).toEqual([0, 1, 4, 8, 12, 16, 20, 24, 32])
  })
})

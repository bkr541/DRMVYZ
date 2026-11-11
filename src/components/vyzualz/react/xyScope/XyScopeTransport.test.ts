import { describe, expect, it } from 'vitest'
import { XyScopeTransportTracker } from './XyScopeTransport'

function play(tracker: XyScopeTransportTracker, seconds: number, startAudio = 0, startWall = 0, track: string | null = 'a', duration = 200) {
  let audio = startAudio
  let wall = startWall
  let last = tracker.update({ audioTime: audio, clockActive: true, wallMs: wall, durationSec: duration, trackIdentity: track })
  for (let i = 0; i < seconds * 60; i += 1) {
    audio += 1 / 60
    wall += 1000 / 60
    last = tracker.update({ audioTime: audio, clockActive: true, wallMs: wall, durationSec: duration, trackIdentity: track })
    expect(last.discontinuity).toBe(false)
  }
  return { audio, wall, last }
}

describe('XyScopeTransportTracker', () => {
  it('sees nothing unusual in steady playback or while paused', () => {
    const t = new XyScopeTransportTracker()
    const { audio, wall } = play(t, 2)
    for (let i = 0; i < 30; i += 1) {
      const state = t.update({ audioTime: audio, clockActive: false, wallMs: wall + i * 16, durationSec: 200, trackIdentity: 'a' })
      expect(state.discontinuity).toBe(false)
    }
  })

  it('detects a forward seek during playback and bumps the seek identity', () => {
    const t = new XyScopeTransportTracker()
    const { audio, wall, last } = play(t, 1)
    const before = last.seekIdentity
    const seek = t.update({ audioTime: audio + 30, clockActive: true, wallMs: wall + 16, durationSec: 200, trackIdentity: 'a' })
    expect(seek.discontinuity).toBe(true)
    expect(seek.seekIdentity).not.toBe(before)
    expect(seek.timingIdentity).not.toBe(last.timingIdentity)
  })

  it('detects a backward jump and tells a loop wrap from a seek', () => {
    const t = new XyScopeTransportTracker()
    const near = play(t, 0.1, 190, 0, 'a', 200)
    const wrap = t.update({ audioTime: 2, clockActive: true, wallMs: near.wall + 16, durationSec: 200, trackIdentity: 'a' })
    expect(wrap.discontinuity).toBe(true)
    expect(wrap.loopIdentity).not.toBe(near.last.loopIdentity)
    expect(wrap.seekIdentity).toBe(near.last.seekIdentity)

    const t2 = new XyScopeTransportTracker()
    const mid = play(t2, 0.1, 100, 0, 'a', 200)
    const back = t2.update({ audioTime: 60, clockActive: true, wallMs: mid.wall + 16, durationSec: 200, trackIdentity: 'a' })
    expect(back.discontinuity).toBe(true)
    expect(back.seekIdentity).not.toBe(mid.last.seekIdentity)
    expect(back.loopIdentity).toBe(mid.last.loopIdentity)
  })

  it('treats a scrub while paused as a seek', () => {
    const t = new XyScopeTransportTracker()
    t.update({ audioTime: 10, clockActive: false, wallMs: 0, durationSec: 200, trackIdentity: 'a' })
    const scrub = t.update({ audioTime: 25, clockActive: false, wallMs: 16, durationSec: 200, trackIdentity: 'a' })
    expect(scrub.discontinuity).toBe(true)
  })

  it('reports a track change once, starts fresh, and does not call it a seek', () => {
    const t = new XyScopeTransportTracker()
    play(t, 0.5, 80, 0, 'a')
    const next = t.update({ audioTime: 0, clockActive: true, wallMs: 5000, durationSec: 180, trackIdentity: 'b' })
    expect(next.trackChanged).toBe(true)
    expect(next.discontinuity).toBe(false)
    expect(next.seekIdentity).toBe('xy-scope-seek:0')
    expect(t.update({ audioTime: 0.02, clockActive: true, wallMs: 5016, durationSec: 180, trackIdentity: 'b' }).trackChanged).toBe(false)
  })

  it('ignores a non-finite time and never throws', () => {
    const t = new XyScopeTransportTracker()
    expect(() => t.update({ audioTime: Number.NaN, clockActive: true, wallMs: 0, durationSec: 0, trackIdentity: null })).not.toThrow()
  })
})

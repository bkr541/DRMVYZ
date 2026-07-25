import { describe, expect, it } from 'vitest'
import type { AudioFeatureBusPublicationMeta } from '../../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import {
  createNeutralPixGridMusicIntelligenceFrame,
  resolvePixGridBusMusicIntelligenceFrame,
} from '../PixGridMusicIntelligenceFrame'

const publication: AudioFeatureBusPublicationMeta = {
  sequence: 4,
  publishedAtMs: 1_000,
  publisherId: 'retired-renderer',
  kind: 'frame',
}

function frameAt(timeSec: number, trackIdentity = 'track-a') {
  return {
    ...DEFAULT_MI_FRAME,
    frameId: 42,
    timeSec,
    sourceId: trackIdentity,
    trackId: trackIdentity,
  }
}

describe('PixGrid Music Intelligence bus fallback', () => {
  it('reuses only a fresh complete frame for the current track and playhead', () => {
    const frame = frameAt(12)
    const resolved = resolvePixGridBusMusicIntelligenceFrame({
      frame,
      publication,
      audioTimeSec: 12.1,
      trackIdentity: 'track-a',
      nowMs: 1_150,
    })
    expect(resolved).toBe(frame)
  })

  it('neutralizes stale, mismatched-track, and mismatched-playhead frames', () => {
    const frame = frameAt(12)
    const stale = resolvePixGridBusMusicIntelligenceFrame({
      frame,
      publication,
      audioTimeSec: 12,
      trackIdentity: 'track-a',
      nowMs: 1_400,
    })
    const wrongTrack = resolvePixGridBusMusicIntelligenceFrame({
      frame,
      publication,
      audioTimeSec: 12,
      trackIdentity: 'track-b',
      nowMs: 1_050,
    })
    const wrongPlayhead = resolvePixGridBusMusicIntelligenceFrame({
      frame,
      publication,
      audioTimeSec: 30,
      trackIdentity: 'track-a',
      nowMs: 1_050,
    })

    for (const neutral of [stale, wrongTrack, wrongPlayhead]) {
      expect(neutral.frameId).toBe(0)
      expect(neutral.bands.volume).toBe(0)
      expect(neutral.rhythm.kickHit).toBe(false)
    }
    expect(stale.timeSec).toBe(12)
    expect(wrongTrack.trackId).toBe('track-b')
    expect(wrongPlayhead.timeSec).toBe(30)
  })

  it('creates a finite neutral frame for invalid playhead input', () => {
    const frame = createNeutralPixGridMusicIntelligenceFrame(Number.NaN, 'track-a')
    expect(frame.timeSec).toBe(0)
    expect(frame.trackId).toBe('track-a')
    expect(frame.sourceId).toBe('track-a')
  })
})

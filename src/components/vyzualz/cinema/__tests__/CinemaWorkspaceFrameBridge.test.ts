import { describe, expect, it } from 'vitest'
import { EMPTY_LYRIC_PLAYBACK_STATE } from '../../../../features/lyrics/runtime/lyricPlaybackResolver'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { BrandKit } from '../../../../features/personalization/BrandKitTypes'
import { buildCinemaWorkspaceFrameBridge } from '../../react/CinemaWorkspaceFrameBridge'

const BRAND_KIT: BrandKit = {
  id: 'brand-a',
  userId: 'user-a',
  name: 'Stage Brand',
  palette: {
    primary: '#336699',
    secondary: '#123456',
    accent: '#00ff88',
    background: '#030609',
    highlight: '#ffffff',
    text: '#f0f4f8',
  },
  extractedPalette: null,
  extractionMetadata: null,
  defaultStrength: 1,
  engineRules: {},
  presetRules: {},
  useForAppAccent: false,
  autoApply: true,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
}

describe('Cinema production frame bridge', () => {
  it('filters stale track data and unrelated performance actions before normalization', () => {
    const staleMusicFrame = {
      ...DEFAULT_MI_FRAME,
      frameId: 5,
      trackId: 'track-b',
      sourceId: 'track-b',
      timeSec: 10,
    }
    const result = buildCinemaWorkspaceFrameBridge({
      width: 1920,
      height: 1080,
      dpr: 2,
      audioTimeSec: 10,
      durationSec: 180,
      trackId: 'track-a',
      playing: true,
      paused: false,
      bpm: 120,
      musicIntelligence: staleMusicFrame,
      lyrics: {
        ...EMPTY_LYRIC_PLAYBACK_STATE,
        documentId: 'lyrics-b',
        sourceIdentity: 'track-b:lyrics-b',
      },
      performanceEvents: [
        { actionId: 'cinema.test', sequence: 2, target: { engineId: 'cinema' }, triggeredAtMs: 10 },
        { actionId: 'cinema.test', sequence: 4, target: { engineId: 'cinema' }, triggeredAtMs: 10.5 },
        { actionId: 'laserDmx.blackout', sequence: 3, target: { engineId: 'laserDmx' }, triggeredAtMs: 11 },
      ],
      brandKit: BRAND_KIT,
      mediaAssetsAvailable: true,
    })

    expect(result.frame.capabilities).toMatchObject({
      musicIntelligence: false,
      beatGrid: false,
      lyrics: false,
      brandKit: true,
      sharedPerformance: true,
      mediaAssets: true,
    })
    expect(result.frame.music.source).toBe('bpm-derived')
    expect(result.frame.performance.events).toEqual([
      { actionId: 'cinema.test', sequence: 2 },
      { actionId: 'cinema.test', sequence: 4 },
    ])
    expect(result.frame.performance.actionIds).toEqual(['cinema.test', 'cinema.test'])
    expect(result.frame.brand.colors.primary).toEqual([0.2, 0.4, 0.6, 1])
  })

  it('returns a neutral no-track snapshot instead of leaking a previous publication', () => {
    const result = buildCinemaWorkspaceFrameBridge({
      width: 1,
      height: 1,
      dpr: 1,
      audioTimeSec: 0,
      durationSec: null,
      trackId: null,
      playing: false,
      paused: false,
      bpm: null,
      musicIntelligence: {
        ...DEFAULT_MI_FRAME,
        frameId: 9,
        trackId: 'old-track',
        sourceId: 'old-track',
      },
      lyrics: {
        ...EMPTY_LYRIC_PLAYBACK_STATE,
        documentId: 'old-lyrics',
        sourceIdentity: 'old-track:old-lyrics',
      },
    })

    expect(result.frame.transport.trackId).toBeNull()
    expect(result.frame.capabilities.musicIntelligence).toBe(false)
    expect(result.frame.capabilities.lyrics).toBe(false)
    expect(result.frame.audio.available).toBe(false)
  })
})

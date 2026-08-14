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

  it('exposes authoritative beat, section, and runtime lyric timing without creating another source of truth', () => {
    const beatGrid = [
      { timeSec: 1, confidence: 1, isDownbeat: true, beatIndex: 1, barIndex: 1 },
      { timeSec: 1.5, confidence: 1, isDownbeat: false, beatIndex: 2, barIndex: 1 },
    ]
    const phrases = [{ id: 'phrase-a', timeSec: 8, phraseLength: 8 as const, lengthBars: 8 as const, confidence: 0.95 }]
    const sections = [{ id: 'drop-a', label: 'Drop', type: 'drop' as const, startSec: 4, endSec: 12, intensity: 0.9 }]
    const lyricCues = [{ id: 'cue-a', startMs: 2000, endMs: 3000, text: 'Cue A' }]
    const result = buildCinemaWorkspaceFrameBridge({
      width: 1280,
      height: 720,
      dpr: 1,
      audioTimeSec: 4.25,
      durationSec: 20,
      trackId: 'track-a',
      playing: true,
      paused: false,
      bpm: 120,
      beatGrid,
      phraseMarkers: phrases,
      authoritativeSections: sections,
      lyricCues,
      lyricGlobalOffsetMs: 250,
    })

    expect(result.timeline.trackId).toBe('track-a')
    expect(result.timeline.beatGrid).toBe(beatGrid)
    expect(result.timeline.phrases).toEqual([{ id: 'phrase-a', timeSec: 8, lengthBars: 8 }])
    expect(result.timeline.sections).toEqual([{ id: 'drop-a', type: 'drop', startSec: 4, endSec: 12 }])
    expect(result.timeline.lyrics).toEqual([{ id: 'cue-a', text: 'Cue A', startSec: 2.25, endSec: 3.25 }])
    expect(result.frame.transport.audioTimeSec).toBe(4.25)
  })

  it('consumes a Live Input frame while keeping transport stopped and structural capabilities unavailable', () => {
    const liveFrame = {
      ...DEFAULT_MI_FRAME,
      frameId: 21,
      sourceId: 'live-input:21',
      trackId: null,
      timeSec: 4,
      bands: { ...DEFAULT_MI_FRAME.bands, bass: 0.72, lowMid: 0.4, mid: 0.6, high: 0.5, air: 0.7, volume: 0.64 },
      energy: { ...DEFAULT_MI_FRAME.energy, instant: 0.68, spectralFlux: 0.12 },
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 126, bpmConfidence: 0.71, transient: 0.8, kickHit: true, kickStrength: 0.9 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: false, sections: false },
    }
    const result = buildCinemaWorkspaceFrameBridge({
      width: 1280,
      height: 720,
      dpr: 1,
      audioTimeSec: 4,
      durationSec: null,
      trackId: null,
      playing: false,
      analysisActive: true,
      paused: false,
      bpm: 126,
      musicIntelligence: liveFrame,
      authoritativeSections: [],
    })

    expect(result.frame.transport.playing).toBe(false)
    expect(result.frame.timing.deltaTimeSec).toBeGreaterThan(0)
    expect(result.frame.audio).toMatchObject({ available: true, bass: 0.72, energy: 0.68 })
    expect(result.frame.capabilities).toMatchObject({ musicIntelligence: true, beatGrid: false, authoritativeSections: false, lyrics: false })
    expect(result.frame.music.sectionId).toBeNull()
    expect(result.frame.music.sectionType).toBeNull()
    expect(result.timeline.sections).toEqual([])
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

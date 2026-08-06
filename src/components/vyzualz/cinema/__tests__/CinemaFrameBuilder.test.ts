import { describe, expect, it } from 'vitest'
import { EMPTY_LYRIC_PLAYBACK_STATE } from '../../../../features/lyrics/runtime/lyricPlaybackResolver'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type { ReactFrameContext } from '../../react/renderers/reactRenderUtils'
import {
  buildCinemaFrameContext,
  createCinemaDeterministicEventId,
  createCinemaDeterministicSeed,
} from '../CinemaFrameBuilder'

function musicFrame(overrides: {
  timeSec?: number
  trackId?: string
  beatIndex?: number
  beatPhase?: number
  beatInBar?: number
  barIndex?: number
  beatHit?: boolean
  kickHit?: boolean
  snareHit?: boolean
  sectionType?: 'build' | 'drop'
  sectionStartSec?: number
  lineId?: string | null
  wordId?: string | null
} = {}): MusicIntelligenceFrame {
  const beatIndex = overrides.beatIndex ?? 0
  const beatInBar = overrides.beatInBar ?? beatIndex % 4
  const sectionType = overrides.sectionType ?? 'build'
  const sectionStartSec = overrides.sectionStartSec ?? 0
  return {
    ...DEFAULT_MI_FRAME,
    frameId: 10,
    timeSec: overrides.timeSec ?? 0,
    trackId: overrides.trackId ?? 'track-a',
    sourceId: overrides.trackId ?? 'track-a',
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
      lyrics: overrides.lineId != null,
    },
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.42,
      bass: 0.61,
      lowMid: 0.35,
      mid: 0.48,
      high: 0.55,
      air: 0.25,
      volume: 0.67,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: overrides.beatPhase ?? 0,
      beatInBar,
      barIndex: overrides.barIndex ?? Math.floor(beatIndex / 4),
      beatHit: overrides.beatHit ?? false,
      downbeatHit: (overrides.beatHit ?? false) && beatInBar === 0,
      kickHit: overrides.kickHit ?? false,
      snareHit: overrides.snareHit ?? false,
      transient: overrides.kickHit || overrides.snareHit ? 0.8 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.67,
      rms: 0.51,
      spectralFlux: 0.32,
      spectralCentroid: 0.45,
      spectralFlatness: 0.2,
      complexity: 0.58,
      tension: 0.63,
      buildProgress: sectionType === 'build' ? 0.74 : 0,
      dropImpact: sectionType === 'drop' ? 0.91 : 0,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: sectionType,
      label: sectionType,
      startSec: sectionStartSec,
      endSec: sectionStartSec + 16,
      progress: 0,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: sectionType === 'build' ? 0.9 : 0,
      dropConfidence: sectionType === 'drop' ? 0.95 : 0,
    },
    lyrics: {
      ...DEFAULT_MI_FRAME.lyrics,
      activeLine: overrides.lineId ? 'Line' : null,
      activeLineId: overrides.lineId ?? null,
      activeWord: overrides.wordId ? 'Word' : null,
      activeWordId: overrides.wordId ?? null,
      lyricLineProgress: 0.25,
      wordProgress: 0.5,
      vocalActivity: overrides.lineId ? 0.8 : 0,
    },
    raw: {
      freqData: new Uint8Array([1, 2, 3]),
      timeDomainData: new Uint8Array([128, 132, 124]),
    },
  }
}

function reactFrame(overrides: Partial<ReactFrameContext> = {}): ReactFrameContext {
  const mi = overrides.musicIntelligence ?? musicFrame()
  return {
    W: 1920,
    H: 1080,
    dpr: 2,
    t: 0,
    elapsedTimeSec: overrides.audioTime ?? 0,
    deltaTimeSec: 1 / 60,
    audioTime: 0,
    trackKey: 'track-a',
    bpm: 120,
    beatPhase: mi?.rhythm.beatPhase ?? 0,
    beatHit: mi?.rhythm.beatHit ?? false,
    isPlaying: true,
    isPaused: false,
    audio: { bass: 0.2, mid: 0.3, high: 0.4, volume: 0.5 },
    freqData: mi?.raw.freqData ?? null,
    timeDomainData: mi?.raw.timeDomainData ?? null,
    musicIntelligence: mi,
    ...overrides,
  }
}

describe('Cinema normalized frame builder', () => {
  it('uses explicit neutral fallbacks and capability diagnostics when source data is missing', () => {
    const result = buildCinemaFrameContext({
      reactFrame: reactFrame({
        trackKey: null,
        bpm: 0,
        beatPhase: 0,
        audio: { bass: Number.NaN, mid: -1, high: 2, volume: Number.POSITIVE_INFINITY },
        freqData: null,
        timeDomainData: null,
        musicIntelligence: null,
      }),
      musicIntelligence: null,
      authoritativeSections: [],
      lyrics: null,
    })

    expect(result.frame.capabilities).toEqual({
      analyser: false,
      musicIntelligence: false,
      beatGrid: false,
      authoritativeSections: false,
      lyrics: false,
      brandKit: false,
      sharedPerformance: false,
      mediaAssets: false,
    })
    expect(result.frame.audio).toMatchObject({
      available: false,
      bass: 0,
      mid: 0,
      high: 0,
      volume: 0,
      rms: 0,
    })
    expect(result.frame.music.available).toBe(false)
    expect(result.frame.music.clocks.states.beat.available).toBe(false)
    expect(result.frame.transport.reset.reasons).toEqual(['activation'])
    expect(result.diagnostics.diagnostics.map(diagnostic => diagnostic.code)).toEqual(expect.arrayContaining([
      'CINEMA_ANALYSER_UNAVAILABLE',
      'CINEMA_MUSIC_INTELLIGENCE_UNAVAILABLE',
      'CINEMA_LYRICS_UNAVAILABLE',
      'CINEMA_CAPABILITY_UNAVAILABLE',
    ]))
  })

  it('creates stable event identities and seeds from equivalent track and musical positions', () => {
    const left = createCinemaDeterministicEventId('kick', 'track-a', 'beat:32:phase:0')
    const right = createCinemaDeterministicEventId('kick', 'track-a', 'beat:32:phase:0')
    expect(left).toBe(right)
    expect(left).not.toBe(createCinemaDeterministicEventId('kick', 'track-b', 'beat:32:phase:0'))
    expect(createCinemaDeterministicSeed('track:track-a')).toBe(createCinemaDeterministicSeed('track:track-a'))

    const first = buildCinemaFrameContext({
      compositionId: 'composition-a',
      reactFrame: reactFrame({ audioTime: 16, musicIntelligence: musicFrame({ timeSec: 16, beatIndex: 32 }) }),
    })
    const replay = buildCinemaFrameContext({
      compositionId: 'composition-a',
      reactFrame: reactFrame({ audioTime: 16, musicIntelligence: musicFrame({ timeSec: 16, beatIndex: 32 }) }),
    })
    expect(first.frame.timing.seeds).toEqual(replay.frame.timing.seeds)
    expect(first.frame.music.clocks.states.beat.eventId).toBe(replay.frame.music.clocks.states.beat.eventId)
  })

  it('fires clock, section, drop, and transient impulses once at a continuous boundary', () => {
    const build = musicFrame({ timeSec: 1.95, beatIndex: 3, beatPhase: 0.9, sectionType: 'build', sectionStartSec: 0 })
    const initial = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 1.95, musicIntelligence: build }),
      authoritativeSections: [{ id: 'build-a', type: 'build', label: 'Build', startSec: 0, endSec: 2, intensity: 0.7 }],
    })

    const drop = musicFrame({
      timeSec: 2,
      beatIndex: 4,
      beatPhase: 0,
      beatInBar: 0,
      barIndex: 1,
      beatHit: true,
      kickHit: true,
      snareHit: true,
      sectionType: 'drop',
      sectionStartSec: 2,
    })
    const boundary = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 2, musicIntelligence: drop }),
      authoritativeSections: [{ id: 'drop-a', type: 'drop', label: 'Drop', startSec: 2, endSec: 18, intensity: 1 }],
      previousState: initial.state,
    })

    expect(boundary.frame.transport.discontinuity).toBe(false)
    expect(boundary.frame.music.clocks).toMatchObject({ beat: true, beat2: true, beat4: true, bar: true })
    expect(boundary.frame.impulses).toMatchObject({
      beat: true,
      downbeat: true,
      kick: true,
      snare: true,
      transient: true,
      sectionStart: true,
      dropStart: true,
    })

    const repeated = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 2, musicIntelligence: drop }),
      authoritativeSections: [{ id: 'drop-a', type: 'drop', label: 'Drop', startSec: 2, endSec: 18, intensity: 1 }],
      previousState: boundary.state,
    })
    expect(Object.values(repeated.frame.impulses).filter(value => value === true)).toHaveLength(0)
    expect(repeated.frame.impulses.eventIds.kick).toBe(boundary.frame.impulses.eventIds.kick)
  })


  it('exposes deterministic beat, bar, and phrase clock boundaries', () => {
    const before = buildCinemaFrameContext({
      reactFrame: reactFrame({
        audioTime: 15.95,
        musicIntelligence: musicFrame({ timeSec: 15.95, beatIndex: 31, beatPhase: 0.9, beatInBar: 3, barIndex: 7 }),
      }),
    })
    const boundary = buildCinemaFrameContext({
      reactFrame: reactFrame({
        audioTime: 16,
        musicIntelligence: musicFrame({ timeSec: 16, beatIndex: 32, beatPhase: 0, beatInBar: 0, barIndex: 8, beatHit: true }),
      }),
      previousState: before.state,
    })

    expect(boundary.frame.music.clocks).toMatchObject({
      beat: true,
      beat2: true,
      beat4: true,
      bar: true,
      bar4: true,
      bar8: true,
      phrase: true,
    })
    expect(boundary.frame.music.clocks.states.bar8).toMatchObject({ index: 1, phase: 0, hit: true })
    expect(boundary.frame.impulses.phrase8).toBe(true)
  })

  it('suppresses boundary events while emitting deterministic seek, loop, track-change, and resume reconstruction signals', () => {
    const initial = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 10, elapsedTimeSec: 10, musicIntelligence: musicFrame({ timeSec: 10, beatIndex: 20 }) }),
      transport: { durationSec: 120 },
    })
    const continuous = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 10.05, elapsedTimeSec: 10.05, musicIntelligence: musicFrame({ timeSec: 10.05, beatIndex: 20, beatPhase: 0.1 }) }),
      transport: { durationSec: 120 },
      previousState: initial.state,
    })
    expect(continuous.frame.transport.discontinuity).toBe(false)

    const seek = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 40, elapsedTimeSec: 10.06, musicIntelligence: musicFrame({ timeSec: 40, beatIndex: 80, kickHit: true }) }),
      transport: { durationSec: 120, seeking: true },
      previousState: continuous.state,
    })
    expect(seek.frame.transport.reset.reasons).toContain('seek')
    expect(seek.frame.impulses.kick).toBe(false)

    const nearEnd = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 119.9, elapsedTimeSec: 20, musicIntelligence: musicFrame({ timeSec: 119.9, beatIndex: 239 }) }),
      transport: { durationSec: 120 },
    })
    const loop = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 0.1, elapsedTimeSec: 20.1, musicIntelligence: musicFrame({ timeSec: 0.1, beatIndex: 0, beatHit: true }) }),
      transport: { durationSec: 120 },
      previousState: nearEnd.state,
    })
    expect(loop.frame.transport.reset.reasons).toContain('loop-wrap')
    expect(loop.frame.impulses.beat).toBe(false)

    const replacement = buildCinemaFrameContext({
      reactFrame: reactFrame({ trackKey: 'track-b', audioTime: 0, musicIntelligence: musicFrame({ trackId: 'track-b', beatIndex: 0 }) }),
      transport: { trackId: 'track-b' },
      previousState: continuous.state,
    })
    expect(replacement.frame.transport.reset.reasons).toContain('track-change')

    const backwards = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 9, elapsedTimeSec: 10.07, musicIntelligence: musicFrame({ timeSec: 9, beatIndex: 18 }) }),
      previousState: continuous.state,
    })
    expect(backwards.frame.transport.reset.reasons).toContain('backwards-time')

    const hidden = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 10.05, elapsedTimeSec: 10.08, musicIntelligence: musicFrame({ timeSec: 10.05, beatIndex: 20 }) }),
      transport: { visibilitySuspended: true },
      previousState: continuous.state,
    })
    expect(hidden.frame.transport.reset.reasons).toContain('visibility-suspension')

    const paused = buildCinemaFrameContext({
      reactFrame: reactFrame({
        audioTime: 10.05,
        elapsedTimeSec: 50,
        isPlaying: false,
        isPaused: true,
        musicIntelligence: musicFrame({ timeSec: 10.05, beatIndex: 20 }),
      }),
      previousState: continuous.state,
    })
    expect(paused.frame.timing.elapsedTimeSec).toBe(continuous.frame.timing.elapsedTimeSec)
    expect(paused.frame.timing.frameIndex).toBe(continuous.frame.timing.frameIndex)
    expect(paused.frame.timing.deltaTimeSec).toBe(0)

    const resume = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 10.05, elapsedTimeSec: 50.1, musicIntelligence: musicFrame({ timeSec: 10.05, beatIndex: 20 }) }),
      previousState: paused.state,
    })
    expect(resume.frame.transport.reset.reasons).toContain('resume')
  })

  it('normalizes canonical lyric transitions without double-firing repeated snapshots', () => {
    const lyricPlayback = {
      ...EMPTY_LYRIC_PLAYBACK_STATE,
      documentId: 'lyrics-a',
      sourceIdentity: 'track-a:lyrics-a',
      timelineRevision: 1,
      activeCue: { id: 'line-a', text: 'Line', startMs: 1000, endMs: 2000, words: [] },
      activeWord: { id: 'word-a', text: 'Word', startMs: 1000, endMs: 1200 },
      cueProgress: 0.2,
      wordProgress: 0.5,
      events: {
        lineEnter: { id: 'line-a', text: 'Line', startMs: 1000, endMs: 2000, words: [] },
        lineExit: null,
        wordEnter: { id: 'word-a', text: 'Word', startMs: 1000, endMs: 1200 },
      },
    }
    const initial = buildCinemaFrameContext({ reactFrame: reactFrame({ audioTime: 0.9 }), lyrics: EMPTY_LYRIC_PLAYBACK_STATE })
    const entered = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 1 }),
      lyrics: lyricPlayback,
      previousState: initial.state,
    })
    expect(entered.frame.impulses).toMatchObject({ lyricCue: true, lyricWord: true })
    expect(entered.frame.lyrics).toMatchObject({ lineId: 'line-a', wordId: 'word-a', available: true })

    const repeated = buildCinemaFrameContext({
      reactFrame: reactFrame({ audioTime: 1 }),
      lyrics: lyricPlayback,
      previousState: entered.state,
    })
    expect(repeated.frame.impulses.lyricCue).toBe(false)
    expect(repeated.frame.impulses.lyricWord).toBe(false)
  })
})

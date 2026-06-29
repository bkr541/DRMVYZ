import { describe, expect, it } from 'vitest'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import { AudioFeatureBus } from '../../musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceEngine } from '../../musicIntelligence/MusicIntelligenceEngine'
import { LyricPlaybackBus } from './LyricPlaybackBus'
import {
  ActiveLyricTracker,
  prepareLyricTimeline,
  resolveLyricPlayback,
  toCanonicalLyricTimeMs,
  toEffectiveLyricTimeMs,
  type LyricPlaybackState,
} from './lyricPlaybackResolver'

function word(id: string, startMs: number, endMs: number, text = id): LyricWord {
  return { id, startMs, endMs, text }
}

function cue(
  id: string,
  startMs: number,
  endMs: number,
  text = id,
  words?: LyricWord[],
): LyricCue {
  return { id, startMs, endMs, text, words }
}

function resolve(
  cues: LyricCue[],
  currentAudioMs: number,
  options: {
    globalOffsetMs?: number
    previousState?: LyricPlaybackState | null
    documentId?: string | null
    sourceIdentity?: string | null
    transitionMode?: 'continuous' | 'discontinuous'
  } = {},
): LyricPlaybackState {
  return resolveLyricPlayback({
    timeline: prepareLyricTimeline(cues),
    currentAudioMs,
    ...options,
  })
}

describe('canonical lyric playback boundaries', () => {
  it('uses start-inclusive and end-exclusive cue boundaries', () => {
    const cues = [cue('a', 1_000, 2_000)]

    expect(resolve(cues, 999).activeCue).toBeNull()
    expect(resolve(cues, 1_000).activeCue?.id).toBe('a')
    expect(resolve(cues, 1_999.999).activeCue?.id).toBe('a')
    expect(resolve(cues, 2_000).activeCue).toBeNull()
  })

  it('switches directly between adjacent cues at the exact boundary', () => {
    const cues = [cue('a', 0, 1_000), cue('b', 1_000, 2_000)]
    const before = resolve(cues, 999)
    const boundary = resolve(cues, 1_000, { previousState: before })

    expect(boundary.activeCue?.id).toBe('b')
    expect(boundary.events.lineExit?.id).toBe('a')
    expect(boundary.events.lineEnter?.id).toBe('b')
  })

  it('reports intentional gaps with useful previous and next cues', () => {
    const state = resolve(
      [cue('a', 0, 1_000), cue('b', 2_000, 3_000)],
      1_500,
    )

    expect(state.activeCue).toBeNull()
    expect(state.isGap).toBe(true)
    expect(state.previousCue?.id).toBe('a')
    expect(state.nextCue?.id).toBe('b')
  })

  it('prefers the most recently-started overlapping cue and restores a longer earlier cue', () => {
    const cues = [cue('long', 0, 5_000), cue('short', 2_000, 3_000)]

    const duringOverlap = resolve(cues, 2_500)
    const restoredLongCue = resolve(cues, 3_500)

    expect(duringOverlap.activeCue?.id).toBe('short')
    expect(duringOverlap.previousCue?.id).toBe('long')
    expect(restoredLongCue.activeCue?.id).toBe('long')
    expect(restoredLongCue.previousCue?.id).toBe('short')
    expect(restoredLongCue.nextCue).toBeNull()
  })
})

describe('global lyric offset semantics', () => {
  it('moves lyrics later for a positive offset', () => {
    const cues = [cue('a', 1_000, 2_000)]

    expect(resolve(cues, 1_499, { globalOffsetMs: 500 }).activeCue).toBeNull()
    expect(resolve(cues, 1_500, { globalOffsetMs: 500 }).activeCue?.id).toBe('a')
    expect(resolve(cues, 2_500, { globalOffsetMs: 500 }).activeCue).toBeNull()
  })

  it('moves lyrics earlier for a negative offset', () => {
    const cues = [cue('a', 1_000, 2_000)]

    expect(resolve(cues, 499, { globalOffsetMs: -500 }).activeCue).toBeNull()
    expect(resolve(cues, 500, { globalOffsetMs: -500 }).activeCue?.id).toBe('a')
    expect(resolve(cues, 1_500, { globalOffsetMs: -500 }).activeCue).toBeNull()
  })

  it('centralizes canonical/effective time conversion', () => {
    expect(toEffectiveLyricTimeMs(1_000, 250)).toBe(1_250)
    expect(toCanonicalLyricTimeMs(1_250, 250)).toBe(1_000)
    expect(toEffectiveLyricTimeMs(1_000, -250)).toBe(750)
  })
})

describe('word timing and progress', () => {
  const cues = [cue('line', 0, 2_000, 'hello world', [
    word('hello', 0, 1_000, 'hello'),
    word('world', 1_000, 2_000, 'world'),
  ])]

  it('uses the same exact boundaries for words', () => {
    expect(resolve(cues, 0).activeWord?.id).toBe('hello')
    expect(resolve(cues, 999).activeWord?.id).toBe('hello')
    expect(resolve(cues, 1_000).activeWord?.id).toBe('world')
    expect(resolve(cues, 2_000).activeWord).toBeNull()
  })

  it('calculates cue and word progress without exceeding one', () => {
    const state = resolve(cues, 1_500)
    expect(state.cueProgress).toBeCloseTo(0.75)
    expect(state.wordProgress).toBeCloseTo(0.5)
  })

  it('emits word-enter only when the active word changes', () => {
    const first = resolve(cues, 100)
    const sameWord = resolve(cues, 500, { previousState: first })
    const nextWord = resolve(cues, 1_000, { previousState: sameWord })

    expect(first.events.wordEnter?.id).toBe('hello')
    expect(sameWord.events.wordEnter).toBeNull()
    expect(nextWord.events.wordEnter?.id).toBe('world')
  })
})

describe('transport changes and transition events', () => {
  const cues = [
    cue('a', 0, 1_000),
    cue('b', 2_000, 3_000),
    cue('c', 4_000, 5_000),
  ]

  it('resolves a forward seek immediately without intermediate line events', () => {
    const before = resolve(cues, 500, { sourceIdentity: 'track-1:doc-1' })
    const after = resolve(cues, 4_500, {
      previousState: before,
      sourceIdentity: 'track-1:doc-1',
      transitionMode: 'discontinuous',
    })

    expect(after.activeCue?.id).toBe('c')
    expect(after.events.lineExit?.id).toBe('a')
    expect(after.events.lineEnter?.id).toBe('c')
    expect(after.events.lineEnter?.id).not.toBe('b')
  })

  it('resolves a backward seek and re-enters the target cue', () => {
    const before = resolve(cues, 4_500, { sourceIdentity: 'track-1:doc-1' })
    const after = resolve(cues, 500, {
      previousState: before,
      sourceIdentity: 'track-1:doc-1',
      transitionMode: 'discontinuous',
    })

    expect(after.activeCue?.id).toBe('a')
    expect(after.events.lineExit?.id).toBe('c')
    expect(after.events.lineEnter?.id).toBe('a')
  })

  it('updates paused cue edits at the same audio time', () => {
    const tracker = new ActiveLyricTracker()
    tracker.setLyrics({
      sourceIdentity: 'track-1:doc-1',
      cues: [cue('a', 0, 1_000)],
    })
    expect(tracker.update(0.5, 'discontinuous').activeLine).toBe('a')

    tracker.setLyrics({
      sourceIdentity: 'track-1:doc-1',
      cues: [cue('a', 1_000, 2_000)],
    })
    const edited = tracker.update(0.5, 'discontinuous')

    expect(edited.activeLine).toBeNull()
    expect(edited.playback.events.lineExit?.id).toBe('a')
  })

  it('isolates track replacement even when cue IDs are reused', () => {
    const before = resolve([cue('shared', 0, 1_000, 'old')], 500, {
      documentId: 'doc-old',
      sourceIdentity: 'track-old:doc-old',
    })
    const after = resolve([cue('shared', 0, 1_000, 'new')], 500, {
      previousState: before,
      documentId: 'doc-new',
      sourceIdentity: 'track-new:doc-new',
      transitionMode: 'discontinuous',
    })

    expect(after.activeCue?.text).toBe('new')
    expect(after.events.lineEnter?.text).toBe('new')
    expect(after.events.lineExit?.text).toBe('old')
  })

  it('isolates document replacement on the same track', () => {
    const before = resolve([cue('shared', 0, 1_000, 'version one')], 500, {
      documentId: 'doc-1',
      sourceIdentity: 'track-1:doc-1',
    })
    const after = resolve([cue('shared', 0, 1_000, 'version two')], 500, {
      previousState: before,
      documentId: 'doc-2',
      sourceIdentity: 'track-1:doc-2',
      transitionMode: 'discontinuous',
    })

    expect(after.documentId).toBe('doc-2')
    expect(after.activeCue?.text).toBe('version two')
    expect(after.events.lineEnter?.text).toBe('version two')
  })
})

describe('prepared timeline lookup', () => {
  it('sorts and validates once while retaining deterministic source references', () => {
    const validLate = cue('late', 2_000, 3_000)
    const validEarly = cue('early', 0, 1_000)
    const invalid = cue('invalid', 4_000, 4_000)
    const timeline = prepareLyricTimeline([validLate, invalid, validEarly])

    expect(timeline.cues).toEqual([validEarly, validLate])
    expect(timeline.invalidCueCount).toBe(1)
    expect(timeline.cues[0]).toBe(validEarly)

    const firstRevision = timeline.revision
    for (let timeMs = 0; timeMs < 3_000; timeMs += 17) {
      const state = resolveLyricPlayback({ timeline, currentAudioMs: timeMs })
      expect(state.timelineRevision).toBe(firstRevision)
    }
  })

  it('does not rebuild the prepared index for offset-only source updates', () => {
    const cues = [cue('a', 1_000, 2_000)]
    const tracker = new ActiveLyricTracker()
    tracker.setLyrics({ cues, globalOffsetMs: 0, sourceIdentity: 'track-1:doc-1' })
    const initial = tracker.update(1.5, 'discontinuous').playback

    tracker.setLyrics({ cues, globalOffsetMs: 250, sourceIdentity: 'track-1:doc-1' })
    const offset = tracker.update(1.5, 'discontinuous').playback

    expect(offset.timelineRevision).toBe(initial.timelineRevision)
    expect(offset.canonicalTimeMs).toBe(1_250)
    expect(offset.activeCue?.id).toBe('a')
  })

  it('resolves thousands of sorted cues through the prepared binary-search index', () => {
    const cues = Array.from({ length: 5_000 }, (_, index) => (
      cue(`cue-${index}`, index * 1_000, index * 1_000 + 800)
    ))
    const timeline = prepareLyricTimeline(cues)
    const state = resolveLyricPlayback({ timeline, currentAudioMs: 4_321_400 })

    expect(state.activeCue?.id).toBe('cue-4321')
    expect(state.previousCue?.id).toBe('cue-4320')
    expect(state.nextCue?.id).toBe('cue-4322')
  })
})

describe('Visualizer and Music Intelligence canonical integration', () => {
  it('publishes the same cue, word, progress, and events consumed by Visualizer', () => {
    const cues = [cue('line', 1_000, 3_000, 'canonical', [
      word('word', 1_500, 2_500, 'canonical'),
    ])]
    const timeline = prepareLyricTimeline(cues)
    const expected = resolveLyricPlayback({
      timeline,
      currentAudioMs: 2_000,
      globalOffsetMs: 250,
      documentId: 'doc-1',
      sourceIdentity: 'track-1:doc-1',
    })

    const engine = new MusicIntelligenceEngine()
    engine.setActiveLyrics({
      cues,
      globalOffsetMs: 250,
      documentId: 'doc-1',
      sourceIdentity: 'track-1:doc-1',
    })
    const visualizerState = engine.resolveLyricsAt(2, 'discontinuous')
    const publishedState = LyricPlaybackBus.getState()
    const intelligenceFrame = AudioFeatureBus.getFrame()

    expect(visualizerState.activeCue?.id).toBe(expected.activeCue?.id)
    expect(visualizerState.activeWord?.id).toBe(expected.activeWord?.id)
    expect(visualizerState.cueProgress).toBeCloseTo(expected.cueProgress)
    expect(visualizerState.wordProgress).toBeCloseTo(expected.wordProgress)
    expect(publishedState).toBe(visualizerState)
    expect(engine.getLyricPlaybackState()).toBe(visualizerState)
    expect(intelligenceFrame.timeSec).toBe(2)
    expect(intelligenceFrame.lyrics.activeLineId).toBe(visualizerState.activeCue?.id)
    expect(intelligenceFrame.lyrics.activeWordId).toBe(visualizerState.activeWord?.id)
    expect(intelligenceFrame.lyrics.lyricLineProgress).toBeCloseTo(visualizerState.cueProgress)
    expect(intelligenceFrame.lyrics.wordProgress).toBeCloseTo(visualizerState.wordProgress)
    expect(intelligenceFrame.lyrics.lineEnter).toBe(true)
  })
})

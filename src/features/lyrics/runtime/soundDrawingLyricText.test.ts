import { describe, expect, it } from 'vitest'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import {
  EMPTY_LYRIC_PLAYBACK_STATE,
  prepareLyricTimeline,
  resolveLyricPlayback,
  type LyricPlaybackState,
} from './lyricPlaybackResolver'
import {
  SoundDrawingLyricTextRuntime,
  resolveSoundDrawingLyricText,
} from './soundDrawingLyricText'

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

function playback(
  cues: LyricCue[],
  currentAudioMs: number,
  options: {
    offsetMs?: number
    documentId?: string | null
    sourceIdentity?: string | null
    previousState?: LyricPlaybackState | null
  } = {},
): LyricPlaybackState {
  return resolveLyricPlayback({
    timeline: prepareLyricTimeline(cues),
    currentAudioMs,
    globalOffsetMs: options.offsetMs ?? 0,
    documentId: options.documentId ?? 'doc-1',
    sourceIdentity: options.sourceIdentity ?? 'track-1:doc-1',
    previousState: options.previousState,
    transitionMode: 'discontinuous',
  })
}

describe('Sound Drawing lyric text adapter', () => {
  it('preserves backward-compatible static text when textSource is missing', () => {
    const result = resolveSoundDrawingLyricText(
      { staticText: 'LEGACY TEXT' },
      EMPTY_LYRIC_PLAYBACK_STATE,
    )

    expect(result).toMatchObject({ text: 'LEGACY TEXT', visible: true, status: 'static' })
  })

  it('switches active lines at canonical start-inclusive/end-exclusive boundaries', () => {
    const cues = [cue('a', 0, 1_000, 'Alpha'), cue('b', 1_000, 2_000, 'Beta')]
    const before = playback(cues, 999)
    const boundary = playback(cues, 1_000, { previousState: before })
    const end = playback(cues, 2_000, { previousState: boundary })

    expect(resolveSoundDrawingLyricText({ textSource: 'activeLyricLine', staticText: '' }, before).text).toBe('Alpha')
    const resolvedBoundary = resolveSoundDrawingLyricText({ textSource: 'activeLyricLine', staticText: '' }, boundary)
    expect(resolvedBoundary.text).toBe('Beta')
    expect(resolvedBoundary.cueId).toBe(boundary.activeCue?.id)
    expect(resolveSoundDrawingLyricText({ textSource: 'activeLyricLine', staticText: '' }, end).visible).toBe(false)
  })

  it('resolves the exact same canonical cue exposed to Visualizer consumers', () => {
    const state = playback([
      cue('verse-1', 0, 1_000, 'Shared runtime line'),
      cue('verse-2', 1_000, 2_000, 'Next shared line'),
    ], 1_000)

    const soundDrawing = resolveSoundDrawingLyricText({
      textSource: 'activeLyricLine',
      staticText: '',
    }, state)

    expect(soundDrawing.cueId).toBe(state.activeCue?.id)
    expect(soundDrawing.text).toBe(state.activeCue?.text)
  })

  it('uses canonical timed words and falls back to the line only when word timing is absent', () => {
    const timed = [cue('line', 0, 2_000, 'hello world', [
      word('hello', 0, 1_000, 'hello'),
      word('world', 1_000, 2_000, 'world'),
    ])]
    const lineOnly = [cue('line-only', 0, 2_000, 'line fallback')]

    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricWord', staticText: '' },
      playback(timed, 999),
    ).text).toBe('hello')
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricWord', staticText: '' },
      playback(timed, 1_000),
    ).text).toBe('world')
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricWord', staticText: '' },
      playback(lineOnly, 500),
    )).toMatchObject({ text: 'line fallback', status: 'wordLineFallback' })
  })

  it('does not fabricate timing inside a real inter-word gap', () => {
    const state = playback([cue('line', 0, 2_000, 'hello world', [
      word('hello', 0, 500, 'hello'),
      word('world', 1_000, 1_500, 'world'),
    ])], 750)

    expect(resolveSoundDrawingLyricText({
      textSource: 'activeLyricWord',
      staticText: '',
      gapBehavior: 'hide',
    }, state)).toMatchObject({ visible: false, status: 'gapHidden' })
  })

  it('supports hide, keep-previous, and configured fallback behavior across cue gaps', () => {
    const runtime = new SoundDrawingLyricTextRuntime()
    const cues = [cue('a', 0, 1_000, 'Alpha'), cue('b', 2_000, 3_000, 'Beta')]
    runtime.resolve('global', {
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'keepPrevious',
    }, playback(cues, 500))

    expect(runtime.resolve('global', {
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'keepPrevious',
    }, playback(cues, 1_500))).toMatchObject({ text: 'Alpha', visible: true, status: 'gapPrevious' })
    expect(resolveSoundDrawingLyricText({
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'fallback', fallbackText: 'INSTRUMENTAL',
    }, playback(cues, 1_500))).toMatchObject({ text: 'INSTRUMENTAL', visible: true, status: 'gapFallback' })
    expect(resolveSoundDrawingLyricText({
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'hide',
    }, playback(cues, 1_500))).toMatchObject({ visible: false, status: 'gapHidden' })
  })

  it('follows positive and negative offsets and resolves seeks immediately', () => {
    const cues = [cue('a', 1_000, 2_000, 'Offset line'), cue('b', 4_000, 5_000, 'Seek target')]

    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricLine', staticText: '' }, playback(cues, 1_499, { offsetMs: 500 }),
    ).visible).toBe(false)
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricLine', staticText: '' }, playback(cues, 1_500, { offsetMs: 500 }),
    ).text).toBe('Offset line')
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricLine', staticText: '' }, playback(cues, 500, { offsetMs: -500 }),
    ).text).toBe('Offset line')
    expect(resolveSoundDrawingLyricText(
      { textSource: 'activeLyricLine', staticText: '' }, playback(cues, 4_500),
    ).text).toBe('Seek target')
  })

  it('never carries a previous track lyric into a replacement track or missing document', () => {
    const runtime = new SoundDrawingLyricTextRuntime()
    runtime.resolve('global', {
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'keepPrevious',
    }, playback([cue('same', 0, 1_000, 'Old track')], 500, {
      documentId: 'doc-old', sourceIdentity: 'track-old:doc-old',
    }))

    const switched = runtime.resolve('global', {
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'keepPrevious',
    }, playback([], 500, { documentId: 'doc-new', sourceIdentity: 'track-new:doc-new' }))
    expect(switched.visible).toBe(false)
    expect(switched.text).toBe('')

    const noLyrics = runtime.resolve('global', {
      textSource: 'activeLyricLine', staticText: '', gapBehavior: 'keepPrevious',
    }, EMPTY_LYRIC_PLAYBACK_STATE)
    expect(noLyrics).toMatchObject({ visible: false, status: 'noLyrics' })
  })
})

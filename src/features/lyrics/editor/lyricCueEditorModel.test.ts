import { describe, expect, it } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import {
  addCueAtPlayhead,
  duplicateCue,
  findCueOverlaps,
  getCueIssues,
  isCueActive,
  mergeCues,
  moveCueToStart,
  normalizeCueBounds,
  resizeCueEnd,
  resizeCueStart,
  snapTimeMs,
  splitCue,
  validateWordTiming,
} from './lyricCueEditorModel'

function cue(id: string, startMs: number, endMs: number, text = id): LyricCue {
  return { id, startMs, endMs, text, source: 'manual', reviewStatus: 'unreviewed' }
}

describe('lyric cue timing model', () => {
  it('uses exact start-inclusive and end-exclusive boundaries', () => {
    const current = cue('a', 1_000, 2_000)
    expect(isCueActive(current, 999)).toBe(false)
    expect(isCueActive(current, 1_000)).toBe(true)
    expect(isCueActive(current, 1_999)).toBe(true)
    expect(isCueActive(current, 2_000)).toBe(false)
  })

  it('moves cues without changing duration and clamps them to track duration', () => {
    expect(moveCueToStart(cue('a', 1_000, 2_500), 3_000, 4_000)).toEqual({
      startMs: 2_500,
      endMs: 4_000,
    })
    expect(moveCueToStart(cue('a', 1_000, 2_500), -500, 4_000)).toEqual({
      startMs: 0,
      endMs: 1_500,
    })
  })

  it('resizes start and end with one millisecond minimum duration', () => {
    const current = cue('a', 1_000, 2_000)
    expect(resizeCueStart(current, 2_500, 5_000)).toEqual({ startMs: 1_999, endMs: 2_000 })
    expect(resizeCueEnd(current, 500, 5_000)).toEqual({ startMs: 1_000, endMs: 1_001 })
  })

  it('normalizes NaN, infinity, negative, zero-length, and beyond-duration values', () => {
    expect(normalizeCueBounds(Number.NaN, Number.POSITIVE_INFINITY, 3_000)).toEqual({
      startMs: 0,
      endMs: 1,
    })
    expect(normalizeCueBounds(-50, -10, 3_000)).toEqual({ startMs: 0, endMs: 1 })
    expect(normalizeCueBounds(5_000, 6_000, 3_000)).toEqual({ startMs: 2_999, endMs: 3_000 })
  })

  it('snaps to millisecond, frame, beat subdivisions, and word boundaries', () => {
    expect(snapTimeMs(1_006, { mode: 'millisecond', millisecondGridMs: 10 })).toBe(1_010)
    expect(snapTimeMs(1_017, { mode: 'frame', frameRate: 30 })).toBe(1_033)
    expect(snapTimeMs(1_420, { mode: 'beat', beatGridMs: [1_000, 1_500, 2_000] })).toBe(1_500)
    expect(snapTimeMs(1_260, { mode: 'half-beat', beatGridMs: [1_000, 1_500] })).toBe(1_250)
    expect(snapTimeMs(1_140, { mode: 'quarter-beat', beatGridMs: [1_000, 1_500] })).toBe(1_125)
    expect(snapTimeMs(1_440, { mode: 'word', wordBoundaryMs: [1_000, 1_450, 2_000] })).toBe(1_450)
  })

  it('falls back without pretending beat snap exists when the beat grid is unavailable', () => {
    expect(snapTimeMs(1_234, { mode: 'beat', beatGridMs: [1_000] })).toBe(1_234)
  })

  it('splits and merges cues while preserving millisecond boundaries and words', () => {
    const source: LyricCue = {
      ...cue('source', 1_000, 3_000, 'take me home'),
      confidence: 0.8,
      words: [
        { id: 'w1', text: 'take', startMs: 1_000, endMs: 1_500 },
        { id: 'w2', text: 'me', startMs: 1_500, endMs: 2_000 },
        { id: 'w3', text: 'home', startMs: 2_000, endMs: 3_000 },
      ],
    }
    const split = splitCue(source, 2_000, 'left', 'right')
    expect(split?.[0]).toMatchObject({ id: 'left', startMs: 1_000, endMs: 2_000, text: 'take me' })
    expect(split?.[1]).toMatchObject({ id: 'right', startMs: 2_000, endMs: 3_000, text: 'home' })
    expect(split?.[0].words?.map(word => word.text)).toEqual(['take', 'me'])
    expect(split?.[1].words?.map(word => word.text)).toEqual(['home'])

    const merged = mergeCues(split![0], split![1], 'merged')
    expect(merged).toMatchObject({ id: 'merged', startMs: 1_000, endMs: 3_000, text: 'take me home' })
    expect(merged.words?.map(word => word.text)).toEqual(['take', 'me', 'home'])
  })

  it('duplicates and adds cues without crossing a known track boundary', () => {
    const grouped: LyricCue = {
      ...cue('a', 2_000, 3_000),
      words: [{ id: 'word', text: 'word', startMs: 2_000, endMs: 3_000 }],
      groups: [{ id: 'group', wordIds: ['word'] }],
    }
    const copy = duplicateCue(grouped, 'copy', 3_400)
    expect(copy).toMatchObject({ id: 'copy', startMs: 2_400, endMs: 3_400, reviewStatus: 'unreviewed' })
    expect(copy.words?.[0].id).toBe('copy-word')
    expect(copy.groups?.[0]).toMatchObject({ id: 'copy-group', wordIds: ['copy-word'] })

    const added = addCueAtPlayhead('new', 9_999, 10_000)
    expect(added).toMatchObject({ startMs: 9_999, endMs: 10_000 })
  })

  it('detects overlaps without silently changing imported timing', () => {
    const cues = [cue('a', 0, 1_500), cue('b', 1_000, 2_000), cue('c', 2_000, 3_000)]
    expect(findCueOverlaps(cues).get('a')).toEqual(['b'])
    expect(findCueOverlaps(cues).get('b')).toEqual(['a'])
    expect(findCueOverlaps(cues).has('c')).toBe(false)
    expect(getCueIssues(cues[0], cues, 3_000)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'overlap', relatedCueId: 'b' }),
    ]))
    expect(cues[0]).toMatchObject({ startMs: 0, endMs: 1_500 })
  })

  it('surfaces invalid cue values and track-duration violations', () => {
    const invalid = { ...cue('bad', -10, 5_001, ''), confidence: 2 }
    const codes = getCueIssues(invalid, [invalid], 5_000).map(issue => issue.code)
    expect(codes).toEqual(expect.arrayContaining([
      'invalid_start',
      'outside_track',
      'empty_text',
      'invalid_confidence',
    ]))
  })

  it('validates word timing against the containing cue', () => {
    const current: LyricCue = {
      ...cue('a', 1_000, 2_000),
      words: [
        { id: 'valid', text: 'valid', startMs: 1_000, endMs: 1_500, confidence: 0.95 },
        { id: 'outside', text: 'outside', startMs: 900, endMs: 1_100, confidence: 0.5 },
        { id: 'reversed', text: 'reversed', startMs: 1_800, endMs: 1_700 },
      ],
    }
    const result = validateWordTiming(current)
    expect(result.validWords.map(word => word.id)).toEqual(['valid'])
    expect(result.invalidWords.map(word => word.id)).toEqual(['outside', 'reversed'])
    expect(getCueIssues(current, [current], 3_000).map(issue => issue.code)).toEqual(
      expect.arrayContaining(['word_outside_cue', 'invalid_word_timing']),
    )
  })
})

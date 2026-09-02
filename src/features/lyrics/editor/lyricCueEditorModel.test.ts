import { describe, expect, it } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import {
  addCueAtPlayhead,
  assignCueOverlapLanes,
  cueWordBoundaries,
  duplicateCue,
  findCueOverlaps,
  getCueIssues,
  isCueActive,
  mergeCues,
  moveCueToStart,
  normalizeCueBounds,
  resizeCueEnd,
  resizeCueStart,
  resizeLyricWordBoundary,
  retainLyricGroupsForWords,
  shiftCue,
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

  it('moves every timed word by the exact final applied cue delta', () => {
    const source: LyricCue = {
      ...cue('move', 1_000, 2_000),
      words: [
        {
          id: 'word-1',
          text: 'move',
          startMs: 1_100,
          endMs: 1_400,
          confidence: 0.91,
          source: 'manual',
          reviewStatus: 'reviewed',
          style: { color: '#fff' },
        },
        { id: 'word-2', text: 'me', startMs: 1_500, endMs: 1_900 },
      ],
      groups: [{ id: 'group-1', wordIds: ['word-1', 'word-2'] }],
    }

    expect(moveCueToStart(source, 2_000, 5_000)).toMatchObject({
      startMs: 2_000,
      endMs: 3_000,
      words: [
        expect.objectContaining({ id: 'word-1', startMs: 2_100, endMs: 2_400, confidence: 0.91, source: 'manual', reviewStatus: 'reviewed', style: { color: '#fff' } }),
        expect.objectContaining({ id: 'word-2', startMs: 2_500, endMs: 2_900 }),
      ],
    })
    expect(shiftCue(source, -500, 5_000)).toMatchObject({
      startMs: 500,
      endMs: 1_500,
      words: [
        expect.objectContaining({ id: 'word-1', startMs: 600, endMs: 900 }),
        expect.objectContaining({ id: 'word-2', startMs: 1_000, endMs: 1_400 }),
      ],
    })
    expect(moveCueToStart(source, -500, 5_000)).toMatchObject({
      startMs: 0,
      endMs: 1_000,
      words: [
        expect.objectContaining({ id: 'word-1', startMs: 100, endMs: 400 }),
        expect.objectContaining({ id: 'word-2', startMs: 500, endMs: 900 }),
      ],
    })
    expect(moveCueToStart(source, 4_800, 5_000)).toMatchObject({
      startMs: 4_000,
      endMs: 5_000,
      words: [
        expect.objectContaining({ id: 'word-1', startMs: 4_100, endMs: 4_400 }),
        expect.objectContaining({ id: 'word-2', startMs: 4_500, endMs: 4_900 }),
      ],
    })
    expect(source.words?.[0]).toMatchObject({ id: 'word-1', startMs: 1_100, endMs: 1_400 })
    expect(source.groups).toEqual([{ id: 'group-1', wordIds: ['word-1', 'word-2'] }])
    expect(resizeCueStart(source, 1_200, 5_000).words).toBeUndefined()
    expect(resizeCueEnd(source, 2_200, 5_000).words).toBeUndefined()
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
    expect(copy.words?.[0]).toMatchObject({ id: 'copy-word', startMs: 2_400, endMs: 3_400 })
    expect(copy.groups?.[0]).toMatchObject({ id: 'copy-group', wordIds: ['copy-word'] })
    expect(grouped.words?.[0]).toMatchObject({ id: 'word', startMs: 2_000, endMs: 3_000 })

    const added = addCueAtPlayhead('new', 9_999, 10_000)
    expect(added).toMatchObject({ startMs: 9_999, endMs: 10_000 })
  })

  it('duplicates multiple words using the final clamped start and survives malformed legacy groups', () => {
    const source: LyricCue = {
      ...cue('source', 2_000, 3_000),
      words: [
        { id: 'one', text: 'one', startMs: 2_050, endMs: 2_250 },
        { id: 'two', text: 'two', startMs: 2_500, endMs: 2_900 },
      ],
      groups: [
        { id: 'valid', wordIds: ['one', 'two'] },
        { id: 'legacy-bad', wordIds: null as unknown as string[] },
      ],
    }

    expect(() => duplicateCue(source, 'copy', 3_400)).not.toThrow()
    const copy = duplicateCue(source, 'copy', 3_400)
    expect(copy.words).toEqual([
      expect.objectContaining({ id: 'copy-one', startMs: 2_450, endMs: 2_650 }),
      expect.objectContaining({ id: 'copy-two', startMs: 2_900, endMs: 3_300 }),
    ])
    expect(copy.groups).toEqual([
      expect.objectContaining({ id: 'copy-valid', wordIds: ['copy-one', 'copy-two'] }),
    ])
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

  it('treats intentionally cleared word timing as untimed and excludes it from word snapping', () => {
    const current: LyricCue = {
      ...cue('a', 1_000, 2_000),
      words: [
        { id: 'timed', text: 'timed', startMs: 1_100, endMs: 1_400 },
        { id: 'untimed', text: 'untimed' },
      ],
    }
    const result = validateWordTiming(current)
    expect(result.validWords.map(word => word.id)).toEqual(['timed'])
    expect(result.invalidWords).toEqual([])
    expect(result.untimedWords.map(word => word.id)).toEqual(['untimed'])
    expect(cueWordBoundaries(current)).toEqual([1_100, 1_400])
  })

  it('cleans legacy malformed groups without throwing during word-list edits', () => {
    const groups = [
      { id: 'bad', wordIds: null as unknown as string[] },
      { id: 'mixed', wordIds: ['keep', 'remove'] },
    ]
    expect(() => retainLyricGroupsForWords(groups, [{ id: 'keep' }])).not.toThrow()
    expect(retainLyricGroupsForWords(groups, [{ id: 'keep' }])).toEqual([
      { id: 'mixed', wordIds: ['keep'] },
    ])
  })

  it('assigns deterministic minimum overlap lanes', () => {
    const cues = [
      cue('late', 1_500, 2_500),
      cue('lead', 0, 2_000),
      cue('double', 500, 1_000),
      cue('tail', 2_500, 3_000),
    ]
    const first = assignCueOverlapLanes(cues)
    const second = assignCueOverlapLanes([...cues].reverse())
    expect(first.laneCount).toBe(2)
    expect(first).toEqual(second)
    expect(new Map(first.assignments.map(item => [item.cueId, item.lane]))).toEqual(new Map([
      ['lead', 0],
      ['double', 1],
      ['late', 1],
      ['tail', 0],
    ]))
  })

  it('keeps intentional doubles visible without destructive overlap warnings', () => {
    const lead = cue('lead', 0, 2_000)
    const double = { ...cue('double', 500, 1_500), analysisMetadata: { vocalRole: 'double' } }
    expect(getCueIssues(lead, [lead, double], 3_000).map(issue => issue.code)).not.toContain('overlap')
    expect(getCueIssues(double, [lead, double], 3_000).map(issue => issue.code)).not.toContain('overlap')
  })

  it('resizes word boundaries without reordering, inverting, or escaping the cue', () => {
    const current: LyricCue = {
      ...cue('words', 1_000, 3_000),
      words: [
        { id: 'one', text: 'can’t', startMs: 1_000, endMs: 1_500 },
        { id: 'two', text: 'stop,', startMs: 1_500, endMs: 2_200 },
        { id: 'three', text: 'now', startMs: 2_200, endMs: 3_000 },
      ],
    }
    const start = resizeLyricWordBoundary(current, 'two', 'start', 900)
    expect(start.map(word => word.text)).toEqual(['can’t', 'stop,', 'now'])
    expect(start[1].startMs).toBe(1_500)

    const end = resizeLyricWordBoundary({ ...current, words: start }, 'two', 'end', 3_500)
    expect(end[1].endMs).toBe(2_200)
    expect(end[1].endMs).toBeGreaterThan(end[1].startMs!)
  })

})

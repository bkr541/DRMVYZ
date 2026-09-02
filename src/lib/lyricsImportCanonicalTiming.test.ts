import { describe, expect, it } from 'vitest'
import { parseLyricCueJson, LyricParseError } from './lyricsImport'
import { parseLyricDocumentJson } from '../features/lyrics/utils/lyricDocumentImport'
import {
  createLyricCueInputFromCue,
  mapLyricCueToInsert,
  toCanonicalLyricMs,
} from '../types/lyrics'

describe('canonical lyric millisecond imports', () => {
  it('rounds document, cue, and word timing to integer milliseconds', () => {
    const imported = parseLyricDocumentJson(JSON.stringify({
      title: 'Fractional timing',
      globalOffsetMs: 125.6,
      cues: [{
        id: 'cue-1',
        startMs: 100.4,
        endMs: 900.6,
        text: 'Pop that',
        words: [{ id: 'word-1', startMs: 100.4, endMs: 450.7, text: 'Pop' }],
      }],
    }))

    expect(imported.errors).toEqual([])
    expect(imported.documentPatch.globalOffsetMs).toBe(126)
    expect(imported.cues[0]).toMatchObject({ startMs: 100, endMs: 901 })
    expect(imported.cues[0].words?.[0]).toMatchObject({ startMs: 100, endMs: 451 })
  })

  it('keeps a malformed word and normalizes it to valid timing instead of dropping lyric text', () => {
    const [cue] = parseLyricCueJson(JSON.stringify([{
      startMs: 0,
      endMs: 1_000,
      text: 'Review me',
      words: [
        { startMs: 0, endMs: 400, text: 'Review' },
        { startMs: 400, text: 'missing end' },
      ],
    }]))

    // No lyric text is lost, order is preserved, and every word ends validly
    // timed and inside the cue.
    expect(cue.words?.map(word => word.text)).toEqual(['Review', 'missing end'])
    for (const word of cue.words ?? []) {
      expect(Number.isFinite(word.startMs)).toBe(true)
      expect(Number.isFinite(word.endMs)).toBe(true)
      expect(word.endMs as number).toBeGreaterThan(word.startMs as number)
      expect(word.startMs as number).toBeGreaterThanOrEqual(cue.startMs)
      expect(word.endMs as number).toBeLessThanOrEqual(cue.endMs)
    }
    // The repaired word starts where the prior word ended.
    expect(cue.words?.[1]).toMatchObject({ startMs: 400 })
    expect(cue.warnings ?? []).not.toContain('missing_word_timing')
  })

  it('sanitizes imported groups and drops unusable group entries', () => {
    const [cue] = parseLyricCueJson(JSON.stringify([{
      startMs: 0,
      endMs: 1_000,
      text: 'Grouped words',
      words: [
        { id: 'word-1', startMs: 0, endMs: 400, text: 'Grouped' },
        { id: 'word-2', startMs: 400, endMs: 800, text: 'words' },
      ],
      groups: [
        { id: 'missing-word-ids' },
        { id: 'non-array-word-ids', wordIds: 'word-1' },
        { id: 'mixed', wordIds: ['word-1', null, '', 42, 'word-1', ' word-2 '] },
        { id: 'empty-after-sanitize', wordIds: [null, '', 42] },
        { id: 'valid', wordIds: ['word-2'], style: { fill: '#fff' } },
      ],
    }]))

    expect(cue.groups).toEqual([
      expect.objectContaining({ id: 'mixed', wordIds: ['word-1', 'word-2'] }),
      expect.objectContaining({ id: 'valid', wordIds: ['word-2'], style: { fill: '#fff' } }),
    ])
  })

  it('rejects timings that collapse after canonical rounding', () => {
    expect(() => parseLyricCueJson(JSON.stringify([{
      startMs: 100.1,
      endMs: 100.4,
      text: 'Too short',
    }]))).toThrow(LyricParseError)
  })

  it('canonicalizes timing again at the database insert boundary', () => {
    const input = createLyricCueInputFromCue({
      id: 'cue-1',
      startMs: 10.49,
      endMs: 20.51,
      text: 'Boundary',
      words: [{ id: 'word-1', startMs: 10.49, endMs: 20.51, text: 'Boundary' }],
    }, 'document-1', 0)
    const row = mapLyricCueToInsert(input)

    expect(row.start_ms).toBe(10)
    expect(row.end_ms).toBe(21)
    expect(input.words?.[0]).toMatchObject({ startMs: 10, endMs: 21 })
    expect(toCanonicalLyricMs(Number.NaN, 12.7)).toBe(13)
  })
})

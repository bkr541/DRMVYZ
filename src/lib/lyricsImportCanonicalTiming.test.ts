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

  it('drops malformed words and marks the cue for review instead of importing unsafe timing', () => {
    const [cue] = parseLyricCueJson(JSON.stringify([{
      startMs: 0,
      endMs: 1_000,
      text: 'Review me',
      words: [
        { startMs: 0, endMs: 400, text: 'Review' },
        { startMs: 400, text: 'missing end' },
      ],
    }]))

    expect(cue.words).toHaveLength(1)
    expect(cue.warnings).toContain('missing_word_timing')
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

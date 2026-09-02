import { describe, expect, it } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import { validateLyricCues } from './lyricValidation'

const cue = (overrides: Partial<LyricCue> = {}): LyricCue => ({
  id: 'cue-1',
  startMs: 1_000,
  endMs: 2_000,
  text: 'Hold on',
  ...overrides,
})

describe('validateLyricCues structured issue navigation', () => {
  it('treats an empty lyric document as a hard validation error', () => {
    const result = validateLyricCues([])

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(['No cues in document'])
    expect(result.warnings).toEqual([])
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'empty_document',
      severity: 'error',
    }))
  })

  it('keeps cue and word identities on actionable validation issues', () => {
    const result = validateLyricCues([
      cue({
        words: [{ id: 'word-1', text: 'Hold', startMs: 900, endMs: 1_200 }],
      }),
    ])

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'word_outside_cue',
        severity: 'warning',
        cueId: 'cue-1',
        cueIndex: 0,
        wordId: 'word-1',
        wordIndex: 0,
      }),
    ]))
  })

  it('distinguishes errors from warnings while retaining legacy message arrays', () => {
    const result = validateLyricCues([
      cue({ text: '', endMs: 500 }),
      cue({ id: 'cue-2', startMs: 400, endMs: 1_500 }),
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.warnings.some(message => message.includes('overlaps'))).toBe(true)
    expect(result.issues.some(issue => issue.severity === 'error')).toBe(true)
    expect(result.issues.some(issue => issue.severity === 'warning')).toBe(true)
  })

  it('does not throw on malformed legacy group wordIds', () => {
    const malformed = cue({
      words: [{ id: 'word-1', text: 'Hold', startMs: 1_000, endMs: 1_200 }],
      groups: [{ id: 'legacy-bad', wordIds: null as unknown as string[] }],
    })

    expect(() => validateLyricCues([malformed])).not.toThrow()
    expect(validateLyricCues([malformed]).valid).toBe(true)
  })

  it('flags an untimed word as an error — a canonical document must carry no untimed words', () => {
    const result = validateLyricCues([
      cue({ words: [{ id: 'word-1', text: 'Hold' }] }),
    ])

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'missing_word_timing',
      severity: 'error',
      wordId: 'word-1',
    }))
    expect(result.issues.some(issue => issue.code === 'invalid_word_bounds')).toBe(false)
  })
})

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
})

import { describe, expect, it } from 'vitest'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import { hasUsableLyricWordTiming } from '../../../types/lyrics'
import {
  hasRepairableWordTiming,
  normalizeLyricCueTiming,
  splitCue,
} from './lyricCueEditorModel'

function cue(id: string, startMs: number, endMs: number, words?: LyricWord[], text = id): LyricCue {
  return { id, startMs, endMs, text, source: 'manual', reviewStatus: 'unreviewed', ...(words ? { words } : {}) }
}
function timed(id: string, startMs: number, endMs: number): LyricWord {
  return { id, text: id, startMs, endMs }
}
function untimed(id: string): LyricWord {
  return { id, text: id }
}

function assertAllWordsValid(cues: readonly LyricCue[]) {
  for (const c of cues) {
    for (const word of c.words ?? []) {
      expect(hasUsableLyricWordTiming(word), `${word.id} usable`).toBe(true)
      expect(word.startMs as number, `${word.id} >= cue start`).toBeGreaterThanOrEqual(c.startMs)
      expect(word.endMs as number, `${word.id} <= cue end`).toBeLessThanOrEqual(c.endMs)
    }
    expect(c.endMs).toBeGreaterThan(c.startMs)
  }
}
function wordCueOf(cues: readonly LyricCue[], wordId: string): string | null {
  return cues.find(c => (c.words ?? []).some(w => w.id === wordId))?.id ?? null
}

describe('normalizeLyricCueTiming — canonical word-timing invariant', () => {
  it('leaves a healthy document untouched (and hasRepairableWordTiming is false)', () => {
    const input = [
      cue('a', 0, 1_000, [timed('a1', 0, 500), timed('a2', 500, 1_000)]),
      cue('b', 1_000, 2_000, [timed('b1', 1_000, 2_000)]),
    ]
    expect(hasRepairableWordTiming(input)).toBe(false)
    const out = normalizeLyricCueTiming(input)
    expect(out.repairedWordCount).toBe(0)
    expect(out.movedWordCount).toBe(0)
    expect(out.cues).toEqual(input)
  })

  it('retimes an invalid word in place inside its own eligible cue', () => {
    const out = normalizeLyricCueTiming([
      cue('a', 0, 1_000, [timed('a1', 0, 400), { id: 'a2', text: 'a2', startMs: 900, endMs: 700 }]),
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 'a2')).toBe('a')
    expect(out.movedWordCount).toBe(0)
    expect(out.repairedWordCount).toBe(1)
  })

  it('rolls an untimed word into the nearer cue — left closer', () => {
    // Untimed word carried in a bounds-less middle cue; left anchor (ends 1000) is closer than right (starts 5000).
    const out = normalizeLyricCueTiming([
      cue('left', 0, 1_000, [timed('l1', 0, 1_000)]),
      { id: 'mid', startMs: Number.NaN, endMs: Number.NaN, text: 'mid', source: 'manual', reviewStatus: 'unreviewed', words: [{ id: 'm1', text: 'm1', startMs: 1_100 }] },
      cue('right', 5_000, 6_000, [timed('r1', 5_000, 6_000)]),
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 'm1')).toBe('left')
  })

  it('rolls an untimed word into the nearer cue — right closer', () => {
    const out = normalizeLyricCueTiming([
      cue('left', 0, 1_000, [timed('l1', 0, 1_000)]),
      { id: 'mid', startMs: Number.NaN, endMs: Number.NaN, text: 'mid', source: 'manual', reviewStatus: 'unreviewed', words: [{ id: 'm1', text: 'm1', startMs: 4_900 }] },
      cue('right', 5_000, 6_000, [timed('r1', 5_000, 6_000)]),
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 'm1')).toBe('right')
  })

  it('breaks an exact anchor-distance tie to the left / prior cue', () => {
    const out = normalizeLyricCueTiming([
      cue('left', 0, 1_000, [timed('l1', 0, 1_000)]),
      { id: 'mid', startMs: Number.NaN, endMs: Number.NaN, text: 'mid', source: 'manual', reviewStatus: 'unreviewed', words: [{ id: 'm1', text: 'm1', startMs: 3_000 }] },
      cue('right', 5_000, 6_000, [timed('r1', 5_000, 6_000)]),
    ])
    // |3000 - 1000| === |3000 - 5000| -> left
    expect(wordCueOf(out.cues, 'm1')).toBe('left')
  })

  it('breaks a source-order tie (no temporal anchor) to the left / prior cue', () => {
    const out = normalizeLyricCueTiming([
      cue('left', 0, 1_000, [timed('l1', 0, 1_000)]),
      { id: 'mid', startMs: Number.NaN, endMs: Number.NaN, text: 'mid', source: 'manual', reviewStatus: 'unreviewed', words: [untimed('m1')] },
      cue('right', 5_000, 6_000, [timed('r1', 5_000, 6_000)]),
    ])
    // one timed context each side, equal document-order distance -> left
    expect(wordCueOf(out.cues, 'm1')).toBe('left')
  })

  it('rolls a word before the first valid cue to the right', () => {
    const out = normalizeLyricCueTiming([
      { id: 'head', startMs: Number.NaN, endMs: Number.NaN, text: 'head', source: 'manual', reviewStatus: 'unreviewed', words: [untimed('h1')] },
      cue('first', 2_000, 3_000, [timed('f1', 2_000, 3_000)]),
      cue('second', 3_000, 4_000, [timed('s1', 3_000, 4_000)]),
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 'h1')).toBe('first')
  })

  it('rolls a word after the last valid cue to the left', () => {
    const out = normalizeLyricCueTiming([
      cue('first', 0, 1_000, [timed('f1', 0, 1_000)]),
      cue('second', 1_000, 2_000, [timed('s1', 1_000, 2_000)]),
      { id: 'tail', startMs: Number.NaN, endMs: Number.NaN, text: 'tail', source: 'manual', reviewStatus: 'unreviewed', words: [untimed('t1')] },
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 't1')).toBe('second')
  })

  it('repairs reversed timing, missing-start-only, and missing-end-only', () => {
    const out = normalizeLyricCueTiming([
      cue('a', 0, 3_000, [
        timed('a1', 0, 400),
        { id: 'rev', text: 'rev', startMs: 900, endMs: 500 },
        { id: 'noStart', text: 'noStart', endMs: 1_400 },
        { id: 'noEnd', text: 'noEnd', startMs: 1_600 },
      ]),
    ])
    assertAllWordsValid(out.cues)
    expect(out.cues[0].words?.map(w => w.id)).toEqual(['a1', 'rev', 'noStart', 'noEnd'])
  })

  it('gives multiple consecutive problematic words ordered, non-identical timing', () => {
    const out = normalizeLyricCueTiming([
      cue('a', 0, 5_000, [timed('a1', 0, 500), untimed('u1'), untimed('u2'), untimed('u3')]),
    ])
    assertAllWordsValid(out.cues)
    const w = out.cues[0].words!
    expect(w.map(x => x.id)).toEqual(['a1', 'u1', 'u2', 'u3'])
    expect(w[1].startMs).toBeGreaterThanOrEqual(w[0].endMs as number)
    expect(w[2].startMs).toBeGreaterThanOrEqual(w[1].endMs as number)
    expect(w[3].startMs).toBeGreaterThanOrEqual(w[2].endMs as number)
    const ranges = w.map(x => `${x.startMs}-${x.endMs}`)
    expect(new Set(ranges).size).toBe(ranges.length)
  })

  it('expands the destination cue bounds when a repaired word extends past them', () => {
    // Single untimed word, cue has no other words: repair appends 60ms after cue start.
    const out = normalizeLyricCueTiming([
      cue('a', 1_000, 1_020, [untimed('u1')]),
    ])
    assertAllWordsValid(out.cues)
    expect(out.cues[0].endMs).toBeGreaterThanOrEqual(out.cues[0].words![0].endMs as number)
  })

  it('turns a mixed timed/untimed cue into a fully validly-timed cue', () => {
    const out = normalizeLyricCueTiming([
      cue('a', 0, 2_000, [timed('a1', 0, 400), untimed('u1'), timed('a3', 1_000, 1_400), untimed('u2')]),
    ])
    assertAllWordsValid(out.cues)
    expect(out.cues[0].words?.map(w => w.id)).toEqual(['a1', 'u1', 'a3', 'u2'])
  })

  it('is deterministic across repeated normalization', () => {
    const input = [
      cue('a', 0, 3_000, [timed('a1', 0, 400), { id: 'rev', text: 'rev', startMs: 900, endMs: 500 }, untimed('u1')]),
      cue('b', 3_000, 4_000, [untimed('u2')]),
    ]
    const first = normalizeLyricCueTiming(input).cues
    const second = normalizeLyricCueTiming(first).cues
    const third = normalizeLyricCueTiming(structuredClone(input)).cues
    expect(second).toEqual(first)
    expect(third).toEqual(first)
    expect(hasRepairableWordTiming(first)).toBe(false)
  })

  it('flags a document with words but no timing anywhere as unrepairable without dropping text', () => {
    const out = normalizeLyricCueTiming([
      { id: 'a', startMs: Number.NaN, endMs: Number.NaN, text: 'a', source: 'manual', reviewStatus: 'unreviewed', words: [untimed('u1'), untimed('u2')] },
    ])
    expect(out.unrepairable).toBe(true)
    expect(out.cues[0].words?.map(w => w.id)).toEqual(['u1', 'u2'])
  })

  it('keeps a group when its word is retimed in place inside its own eligible cue', () => {
    const out = normalizeLyricCueTiming([
      {
        id: 'a', startMs: 0, endMs: 2_000, text: 'a', source: 'manual', reviewStatus: 'unreviewed',
        words: [timed('a1', 0, 400), { id: 'a2', text: 'a2', startMs: 900, endMs: 500 }],
        groups: [{ id: 'g', wordIds: ['a1', 'a2'] }],
      },
    ])
    assertAllWordsValid(out.cues)
    expect(wordCueOf(out.cues, 'a2')).toBe('a')
    expect(out.cues[0].groups).toEqual([{ id: 'g', wordIds: ['a1', 'a2'] }])
  })

  it('removes a rolled-away word from its former cue group', () => {
    const out = normalizeLyricCueTiming([
      cue('left', 0, 1_000, [timed('l1', 0, 1_000)]),
      {
        id: 'mid', startMs: Number.NaN, endMs: Number.NaN, text: 'mid', source: 'manual', reviewStatus: 'unreviewed',
        words: [{ id: 'm1', text: 'm1', startMs: 400 }],
        groups: [{ id: 'g', wordIds: ['m1'] }],
      },
      cue('right', 5_000, 6_000, [timed('r1', 5_000, 6_000)]),
    ])
    expect(wordCueOf(out.cues, 'm1')).toBe('left')
    expect(out.cues.find(c => c.id === 'mid')?.groups).toBeUndefined()
  })
})

describe('splitCue — never dumps problematic words left, both halves stay validly timed', () => {
  it('splits a cue that carries untimed words and validly times both halves', () => {
    const source: LyricCue = {
      ...cue('src', 1_000, 3_000, undefined, 'one two three four'),
      words: [
        timed('w1', 1_000, 1_400),
        untimed('w2'),
        untimed('w3'),
        timed('w4', 2_400, 3_000),
      ],
    }
    const [left, right] = splitCue(source, 2_000, 'L', 'R')!
    assertAllWordsValid([left, right])
    // Not all problematic words dumped left.
    expect(right.words?.length ?? 0).toBeGreaterThan(0)
    // Stable order preserved across the pair.
    expect([...(left.words ?? []), ...(right.words ?? [])].map(w => w.text))
      .toEqual(['w1', 'w2', 'w3', 'w4'])
  })

  it('keeps the existing timed-word split behaviour and merged text', () => {
    const source: LyricCue = {
      ...cue('src', 1_000, 3_000, undefined, 'take me home'),
      words: [
        { id: 'w1', text: 'take', startMs: 1_000, endMs: 1_500 },
        { id: 'w2', text: 'me', startMs: 1_500, endMs: 2_000 },
        { id: 'w3', text: 'home', startMs: 2_000, endMs: 3_000 },
      ],
    }
    const [left, right] = splitCue(source, 2_000, 'L', 'R')!
    expect(left).toMatchObject({ id: 'L', startMs: 1_000, endMs: 2_000, text: 'take me' })
    expect(right).toMatchObject({ id: 'R', startMs: 2_000, endMs: 3_000, text: 'home' })
    expect(left.words?.map(w => w.text)).toEqual(['take', 'me'])
    expect(right.words?.map(w => w.text)).toEqual(['home'])
  })

  it('repairs a legacy word with malformed timing on both sides of the split point', () => {
    const source: LyricCue = {
      ...cue('src', 0, 2_000, undefined, 'a b c d'),
      words: [
        timed('w1', 0, 400),
        { id: 'w2', text: 'w2', startMs: 900, endMs: 600 },
        { id: 'w3', text: 'w3', startMs: 1_200, endMs: 800 },
        timed('w4', 1_500, 2_000),
      ],
    }
    const [left, right] = splitCue(source, 1_000, 'L', 'R')!
    assertAllWordsValid([left, right])
  })
})

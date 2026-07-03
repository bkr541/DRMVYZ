import { describe, expect, it } from 'vitest'
import {
  FIVE_MINUTES_MS,
  groupWordsIntoReadableCues,
  normalizeProviderTranscript,
  planTranscriptionUnits,
  reconcileTranscriptUnits,
  secondsToIntegerMs,
  selectUsefulCues,
  type CanonicalWord,
} from '../../../../supabase/functions/_shared/lyricTranscriptionCore'


const groqVerboseJsonWithWords = {
  text: 'Lay your doubts down let the daylight in',
  language: 'en',
  duration: 5.42,
  segments: [
    {
      id: 0,
      seek: 0,
      start: 0.48,
      end: 3.76,
      text: 'Lay your doubts down let the daylight in',
      avg_logprob: -0.075,
      no_speech_prob: 0.018,
      words: [
        { word: 'Lay', start: 0.48, end: 0.82 },
        { word: 'your', start: 0.84, end: 1.05 },
        { word: 'doubts', start: 1.08, end: 1.48 },
        { word: 'down', start: 1.52, end: 1.92 },
        { word: 'let', start: 2.26, end: 2.46 },
        { word: 'the', start: 2.5, end: 2.68 },
        { word: 'daylight', start: 2.72, end: 3.28 },
        { word: 'in', start: 3.34, end: 3.76 },
      ],
    },
  ],
  words: [
    { word: 'Lay', start: 0.48, end: 0.82 },
    { word: 'your', start: 0.84, end: 1.05 },
    { word: 'doubts', start: 1.08, end: 1.48 },
    { word: 'down', start: 1.52, end: 1.92 },
    { word: 'let', start: 2.26, end: 2.46 },
    { word: 'the', start: 2.5, end: 2.68 },
    { word: 'daylight', start: 2.72, end: 3.28 },
    { word: 'in', start: 3.34, end: 3.76 },
  ],
}

const groqVerboseJsonSegmentsOnly = {
  text: 'You found heaven. I am falling from grace.',
  language: 'en',
  duration: 8.2,
  segments: [
    {
      id: 0,
      seek: 0,
      start: 0.5,
      end: 3.2,
      text: 'You found heaven.',
      avg_logprob: -0.12,
      no_speech_prob: 0.03,
    },
    {
      id: 1,
      seek: 0,
      start: 4.1,
      end: 7.7,
      text: 'I am falling from grace.',
      avg_logprob: -0.18,
      no_speech_prob: 0.04,
    },
  ],
  words: [],
}

const groqVerboseJsonLowConfidence = {
  text: 'mumbled line under the smoke',
  language: 'en',
  duration: 4.8,
  segments: [
    {
      id: 0,
      seek: 0,
      start: 0.8,
      end: 3.9,
      text: 'mumbled line under the smoke',
      avg_logprob: -2.4,
      no_speech_prob: 0.86,
      words: [
        { word: 'mumbled', start: 0.8, end: 1.42, confidence: 0.31 },
        { word: 'line', start: 1.5, end: 1.88, confidence: 0.34 },
        { word: 'under', start: 2.12, end: 2.58, confidence: 0.28 },
        { word: 'the', start: 2.68, end: 2.86, confidence: 0.42 },
        { word: 'smoke', start: 3.04, end: 3.9, confidence: 0.27 },
      ],
    },
  ],
  words: [
    { word: 'mumbled', start: 0.8, end: 1.42, confidence: 0.31 },
    { word: 'line', start: 1.5, end: 1.88, confidence: 0.34 },
    { word: 'under', start: 2.12, end: 2.58, confidence: 0.28 },
    { word: 'the', start: 2.68, end: 2.86, confidence: 0.42 },
    { word: 'smoke', start: 3.04, end: 3.9, confidence: 0.27 },
  ],
}

describe('lyric transcription normalization core', () => {
  it('keeps songs under five minutes in one logical transcription unit', () => {
    const units = planTranscriptionUnits(FIVE_MINUTES_MS - 1, { forceChunking: true })
    expect(units).toEqual([
      { index: 0, startMs: 0, endMs: FIVE_MINUTES_MS - 1, overlapBeforeMs: 0, overlapAfterMs: 0 },
    ])
  })

  it('plans deterministic overlapped units for long tracks only when chunking is required', () => {
    expect(planTranscriptionUnits(11 * 60_000)).toHaveLength(1)
    const units = planTranscriptionUnits(11 * 60_000, {
      forceChunking: true,
      maxUnitMs: 4 * 60_000,
      overlapMs: 4_000,
    })
    expect(units.length).toBeGreaterThan(1)
    expect(units[0]).toMatchObject({ index: 0, startMs: 0, endMs: 240_000, overlapBeforeMs: 0, overlapAfterMs: 4_000 })
    expect(units[1].startMs).toBe(236_000)
    expect(units[units.length - 1]?.endMs).toBe(660_000)
  })

  it('normalizes seconds to integer milliseconds without inventing invalid timings', () => {
    expect(secondsToIntegerMs(1.2346)).toBe(1235)
    expect(secondsToIntegerMs(-1)).toBeNull()
    expect(secondsToIntegerMs(Number.NaN)).toBeNull()
  })

  it('preserves provider confidence and marks newly extracted content unreviewed', () => {
    const unit = planTranscriptionUnits(20_000)[0]
    const normalized = normalizeProviderTranscript({
      language: 'en',
      words: [{ text: 'Grace', start: 1, end: 1.5, confidence: 0.82 }],
    }, unit, 0.7)
    expect(normalized.words[0]).toMatchObject({
      text: 'Grace',
      startMs: 1000,
      endMs: 1500,
      confidence: 0.82,
      source: 'transcription',
      reviewStatus: 'unreviewed',
    })
  })

  it('deduplicates overlapped words and keeps the stronger confidence value', () => {
    const first = normalizeProviderTranscript({
      words: [{ text: 'hello', start: 4, end: 4.5, confidence: 0.55 }],
    }, { index: 0, startMs: 0, endMs: 8_000, overlapBeforeMs: 0, overlapAfterMs: 4_000 })
    const second = normalizeProviderTranscript({
      words: [{ text: 'hello', start: 0, end: 0.5, confidence: 0.91 }],
    }, { index: 1, startMs: 4_000, endMs: 12_000, overlapBeforeMs: 4_000, overlapAfterMs: 0 })
    const reconciled = reconcileTranscriptUnits([first, second])
    expect(reconciled.words).toHaveLength(1)
    expect(reconciled.words[0].confidence).toBe(0.91)
  })


  it('records a warning when overlapping provider units cannot be reconciled confidently', () => {
    const first = normalizeProviderTranscript({
      words: [{ text: 'alpha', start: 4, end: 4.5 }],
    }, { index: 0, startMs: 0, endMs: 8_000, overlapBeforeMs: 0, overlapAfterMs: 4_000 })
    const second = normalizeProviderTranscript({
      words: [{ text: 'beta', start: 0, end: 0.5 }],
    }, { index: 1, startMs: 4_000, endMs: 12_000, overlapBeforeMs: 4_000, overlapAfterMs: 0 })
    expect(reconcileTranscriptUnits([first, second]).warnings).toContain('chunk_boundary_uncertain')
  })

  it('does not collapse intentionally repeated words within the same provider unit', () => {
    const unit = planTranscriptionUnits(10_000)[0]
    const normalized = normalizeProviderTranscript({
      words: [
        { text: 'pop', start: 1, end: 1.25, confidence: 0.9 },
        { text: 'pop', start: 1.6, end: 1.85, confidence: 0.88 },
      ],
    }, unit)
    expect(reconcileTranscriptUnits([normalized]).words.map(word => word.text)).toEqual(['pop', 'pop'])
  })

  it('falls back to word grouping when provider segments are too large to be readable', () => {
    const unit = planTranscriptionUnits(30_000)[0]
    const normalized = reconcileTranscriptUnits([normalizeProviderTranscript({
      segments: [{ text: 'A provider paragraph that should not become one enormous lyric cue', start: 0, end: 20 }],
      words: [
        { text: 'A', start: 0, end: 0.2 },
        { text: 'short', start: 0.25, end: 0.6 },
        { text: 'line.', start: 0.65, end: 1.1 },
        { text: 'Next', start: 2, end: 2.35 },
        { text: 'line', start: 2.4, end: 2.8 },
      ],
    }, unit)])
    expect(selectUsefulCues(normalized).map(cue => cue.text)).toEqual(['A short line.', 'Next line'])
  })

  it('groups word-only timing into readable cues using pauses, punctuation, and size limits', () => {
    const word = (text: string, startMs: number, endMs: number): CanonicalWord => ({
      id: `${text}-${startMs}`,
      text,
      startMs,
      endMs,
      confidence: 0.8,
      source: 'transcription',
      reviewStatus: 'unreviewed',
      normalizedText: text.toLowerCase().replace(/\W/g, ''),
      originalTranscriptionText: text,
    })
    const cues = groupWordsIntoReadableCues([
      word('You', 0, 300),
      word('found', 350, 650),
      word('heaven.', 700, 1_100),
      word('I’m', 2_100, 2_400),
      word('falling', 2_450, 2_850),
      word('from', 2_900, 3_100),
      word('grace', 3_150, 3_600),
    ])
    expect(cues).toHaveLength(2)
    expect(cues.map(cue => cue.text)).toEqual(['You found heaven.', 'I’m falling from grace'])
    expect(cues.every(cue => cue.words && cue.words.length > 1)).toBe(true)
  })



  it('normalizes Groq verbose_json word timestamps into cue words', () => {
    const unit = planTranscriptionUnits(6_000)[0]
    const normalized = reconcileTranscriptUnits([
      normalizeProviderTranscript(groqVerboseJsonWithWords, unit, 0.6),
    ])
    const cues = selectUsefulCues(normalized)

    expect(normalized.language).toBe('en')
    expect(normalized.durationMs).toBe(5420)
    expect(normalized.words.map(word => word.text)).toEqual(['Lay', 'your', 'doubts', 'down', 'let', 'the', 'daylight', 'in'])
    expect(normalized.words[0]).toMatchObject({ startMs: 480, endMs: 820, source: 'transcription', reviewStatus: 'unreviewed' })
    expect(cues[0]).toMatchObject({ text: 'Lay your doubts down let the daylight in', startMs: 480, endMs: 3760 })
    expect(cues[0].words?.map(word => word.text)).toEqual(normalized.words.map(word => word.text))
  })

  it('uses Groq segment timestamps as line cues when word timestamps are absent', () => {
    const unit = planTranscriptionUnits(9_000)[0]
    const normalized = reconcileTranscriptUnits([
      normalizeProviderTranscript(groqVerboseJsonSegmentsOnly, unit, 0.6),
    ])
    const cues = selectUsefulCues(normalized)

    expect(normalized.words).toHaveLength(0)
    expect(cues.map(cue => ({ text: cue.text, startMs: cue.startMs, endMs: cue.endMs }))).toEqual([
      { text: 'You found heaven.', startMs: 500, endMs: 3200 },
      { text: 'I am falling from grace.', startMs: 4100, endMs: 7700 },
    ])
  })

  it('ignores empty Groq words, empty segments, and invalid timings', () => {
    const unit = planTranscriptionUnits(10_000)[0]
    const normalized = normalizeProviderTranscript({
      text: 'Only the usable line survives',
      language: 'en',
      duration: 10,
      words: [
        { word: '', start: 0.2, end: 0.4 },
        { word: 'backwards', start: 2, end: 1.5 },
        { word: 'zero', start: 3, end: 3 },
        { word: 'Only', start: 4, end: 4.28 },
        { word: 'survives', start: 4.32, end: 4.9 },
      ],
      segments: [
        { text: '', start: 0.2, end: 0.4, avg_logprob: -0.1 },
        { text: 'bad timing', start: 5, end: 4.8, avg_logprob: -0.1 },
        { text: 'Only survives', start: 4, end: 4.9, avg_logprob: -0.1 },
      ],
    }, unit)

    expect(normalized.words.map(word => word.text)).toEqual(['Only', 'survives'])
    expect(normalized.segments.map(segment => segment.text)).toEqual(['Only survives'])
  })

  it('keeps Groq low-confidence and suspicious metadata as review warnings', () => {
    const unit = planTranscriptionUnits(5_000)[0]
    const normalized = reconcileTranscriptUnits([
      normalizeProviderTranscript(groqVerboseJsonLowConfidence, unit, 0.6),
    ])
    const cues = selectUsefulCues(normalized)

    expect(normalized.words.every(word => word.warnings?.includes('low_confidence'))).toBe(true)
    expect(cues[0].warnings).toEqual(expect.arrayContaining(['low_confidence', 'possible_silence', 'provider_warning']))
    expect(cues[0].reviewStatus).toBe('unreviewed')
  })

  it('reconciles overlapping WAV chunk transcripts without duplicating boundary words', () => {
    const firstUnit = { index: 0, startMs: 0, endMs: 8_000, overlapBeforeMs: 0, overlapAfterMs: 2_000 }
    const secondUnit = { index: 1, startMs: 6_000, endMs: 14_000, overlapBeforeMs: 2_000, overlapAfterMs: 0 }
    const reconciled = reconcileTranscriptUnits([
      normalizeProviderTranscript({
        text: 'we rise',
        language: 'en',
        duration: 8,
        words: [
          { word: 'we', start: 5.5, end: 5.8, confidence: 0.82 },
          { word: 'rise', start: 6.2, end: 6.7, confidence: 0.64 },
        ],
      }, firstUnit),
      normalizeProviderTranscript({
        text: 'rise again',
        language: 'en',
        duration: 8,
        words: [
          { word: 'rise', start: 0.2, end: 0.7, confidence: 0.93 },
          { word: 'again', start: 1, end: 1.4, confidence: 0.9 },
        ],
      }, secondUnit),
    ])

    expect(reconciled.words.map(word => word.text)).toEqual(['we', 'rise', 'again'])
    expect(reconciled.words.find(word => word.text === 'rise')?.confidence).toBe(0.93)
    expect(reconciled.warnings).not.toContain('chunk_boundary_uncertain')
  })

  it('reconciles browser-prepared overlapping chunks on the source timeline', () => {
    const firstPreparedChunk = { index: 0, startMs: 0, endMs: 23_000, overlapBeforeMs: 0, overlapAfterMs: 3_000 }
    const secondPreparedChunk = { index: 1, startMs: 20_000, endMs: 43_000, overlapBeforeMs: 3_000, overlapAfterMs: 3_000 }
    const reconciled = reconcileTranscriptUnits([
      normalizeProviderTranscript({
        text: 'take my hand',
        language: 'en',
        duration: 23,
        words: [
          { word: 'take', start: 20.4, end: 20.8, confidence: 0.88 },
          { word: 'my', start: 21, end: 21.2, confidence: 0.7 },
          { word: 'hand', start: 21.3, end: 21.75, confidence: 0.74 },
        ],
      }, firstPreparedChunk),
      normalizeProviderTranscript({
        text: 'my hand lead',
        language: 'en',
        duration: 23,
        words: [
          { word: 'my', start: 1, end: 1.2, confidence: 0.95 },
          { word: 'hand', start: 1.3, end: 1.75, confidence: 0.96 },
          { word: 'lead', start: 4, end: 4.42, confidence: 0.86 },
        ],
      }, secondPreparedChunk),
    ])
    const cues = selectUsefulCues(reconciled)

    expect(reconciled.words.map(word => `${word.text}@${word.startMs}`)).toEqual([
      'take@20400',
      'my@21000',
      'hand@21300',
      'lead@24000',
    ])
    expect(reconciled.words.find(word => word.text === 'hand')?.confidence).toBe(0.96)
    // The 2.25s pause between "hand" and "lead" should remain a lyric-line
    // break. This fixture verifies overlap reconciliation without loosening the
    // readable cue grouping behavior.
    expect(cues.map(cue => cue.text)).toEqual(['take my hand', 'lead'])
    expect(cues[0]).toMatchObject({ startMs: 20_400, endMs: 21_750 })
    expect(cues[1]).toMatchObject({ startMs: 24_000, endMs: 24_420 })
  })

  it('returns no usable cues when Groq verbose_json has no valid word or segment timing', () => {
    const unit = planTranscriptionUnits(5_000)[0]
    const normalized = reconcileTranscriptUnits([
      normalizeProviderTranscript({
        text: 'untimed lyrics only',
        language: 'en',
        duration: 5,
        words: [
          { word: 'untimed', start: -1, end: 0.2 },
          { word: 'bad', start: 2, end: 1.8 },
        ],
        segments: [
          { text: 'also bad', start: 3, end: 3 },
        ],
      }, unit),
    ])

    expect(normalized.warnings).toContain('provider_warning')
    expect(selectUsefulCues(normalized)).toHaveLength(0)
  })

  it('keeps chunk unit offsets but does not bake document global offset into cue timestamps', () => {
    const unit = { index: 2, startMs: 12_000, endMs: 18_000, overlapBeforeMs: 500, overlapAfterMs: 0 }
    const normalized = reconcileTranscriptUnits([
      normalizeProviderTranscript({
        text: 'Offset stays document-level',
        language: 'en',
        duration: 6,
        words: [
          { word: 'Offset', start: 1, end: 1.4 },
          { word: 'stays', start: 1.5, end: 1.9 },
          { word: 'document-level', start: 2, end: 2.8 },
        ],
      }, unit),
    ])
    const cues = selectUsefulCues(normalized)

    expect(cues[0]).toMatchObject({ startMs: 13_000, endMs: 14_800 })
    expect(cues[0].startMs).not.toBe(13_000 + 2_500)
  })

  it('prefers trustworthy provider segments and falls back to grouped words', () => {
    const unit = planTranscriptionUnits(10_000)[0]
    const withSegments = reconcileTranscriptUnits([normalizeProviderTranscript({
      segments: [{ text: 'Timed line', start: 1, end: 3 }],
    }, unit)])
    expect(selectUsefulCues(withSegments)[0].text).toBe('Timed line')

    const withWords = reconcileTranscriptUnits([normalizeProviderTranscript({
      words: [
        { text: 'Word', start: 1, end: 1.4 },
        { text: 'timing', start: 1.5, end: 2 },
      ],
    }, unit)])
    expect(selectUsefulCues(withWords)[0].text).toBe('Word timing')
  })
})

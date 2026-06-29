import { describe, expect, it } from 'vitest'
import type { LyricCue, LyricCueRow, LyricWord } from '../../../types/lyrics'
import {
  calculateLyricCueConfidence,
  createLyricCueInputFromCue,
  mapLyricCueRowToCue,
  mapLyricCueToInsert,
  normalizeLyricConfidence,
} from '../../../types/lyrics'
import { parseLyricCueJson } from '../../../lib/lyricsImport'
import { parseLyricDocumentJson } from './lyricDocumentImport'
import { validateLyricCues } from './lyricValidation'

function legacyRow(overrides: Partial<LyricCueRow> = {}): LyricCueRow {
  return {
    id: 'cue-row-1',
    lyric_document_id: 'doc-1',
    start_ms: 1000,
    end_ms: 2500,
    text: 'Legacy cue',
    style: {},
    animation: {},
    effects: {},
    words: [],
    groups: [],
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('lyric confidence normalization', () => {
  it('keeps missing confidence unknown instead of converting it to zero', () => {
    expect(normalizeLyricConfidence(undefined)).toBeUndefined()
    expect(normalizeLyricConfidence(null)).toBeUndefined()
    expect(calculateLyricCueConfidence([{ id: 'w', text: 'word', startMs: 0, endMs: 1 }])).toBeUndefined()
  })

  it('clamps provider values through the shared policy and can reject them strictly', () => {
    expect(normalizeLyricConfidence(-0.25)).toBe(0)
    expect(normalizeLyricConfidence(1.25)).toBe(1)
    expect(normalizeLyricConfidence(0.42)).toBe(0.42)
    expect(() => normalizeLyricConfidence(1.25, 'reject')).toThrow(RangeError)
    expect(() => normalizeLyricConfidence(Number.NaN, 'reject')).toThrow(RangeError)
  })

  it('averages only words with known confidence', () => {
    const words: LyricWord[] = [
      { id: 'a', text: 'one', startMs: 0, endMs: 100, confidence: 0.9 },
      { id: 'b', text: 'two', startMs: 100, endMs: 200 },
      { id: 'c', text: 'three', startMs: 200, endMs: 300, confidence: 0.5 },
    ]
    expect(calculateLyricCueConfidence(words)).toBeCloseTo(0.7)
  })
})

describe('backward-compatible lyric JSON parsing', () => {
  it('parses legacy cues without requiring optional metadata', () => {
    const [cue] = parseLyricCueJson(JSON.stringify([
      { startMs: 1000, endMs: 2000, text: 'Old format still works' },
    ]))

    expect(cue).toMatchObject({
      id: 'cue_001',
      startMs: 1000,
      endMs: 2000,
      text: 'Old format still works',
      source: 'import',
    })
    expect(cue.confidence).toBeUndefined()
    expect(cue.reviewStatus).toBeUndefined()
    expect(cue.warnings).toBeUndefined()
  })

  it('normalizes provider metadata, aggregates word confidence, and maps unknown enums safely', () => {
    const [cue] = parseLyricCueJson(JSON.stringify([{
      startMs: 0,
      endMs: 1000,
      text: 'Provider line',
      source: 'future_provider',
      reviewStatus: 'pending_review',
      sectionType: 'hook',
      warnings: ['low_confidence', 'future_warning'],
      words: [
        { id: 'w1', text: 'Provider', startMs: 0, endMs: 400, confidence: 1.4 },
        { id: 'w2', text: 'line', startMs: 400, endMs: 1000, confidence: 0.6 },
      ],
    }]))

    expect(cue.source).toBe('unknown')
    expect(cue.reviewStatus).toBeUndefined()
    expect(cue.sectionType).toBe('unknown')
    expect(cue.confidence).toBeCloseTo(0.8)
    expect(cue.words?.[0].confidence).toBe(1)
    expect(cue.warnings).toEqual(expect.arrayContaining([
      'low_confidence',
      'unknown',
      'unknown_source',
      'unknown_review_status',
      'unknown_section_type',
    ]))
  })

  it('retains extended cue and word metadata through JSON export/import', () => {
    const cue: LyricCue = {
      id: 'cue-rt',
      startMs: 500,
      endMs: 1800,
      text: 'Corrected line',
      confidence: 0.88,
      source: 'corrected',
      reviewStatus: 'corrected',
      sectionId: 'section-chorus-1',
      sectionType: 'chorus',
      warnings: ['provider_warning'],
      analysisMetadata: { provider: 'test', language: 'en' },
      originalTranscriptionText: 'Corected line',
      words: [{
        id: 'word-1',
        text: 'Corrected',
        startMs: 500,
        endMs: 1100,
        confidence: 0.91,
        source: 'corrected',
        reviewStatus: 'corrected',
        normalizedText: 'corrected',
        originalTranscriptionText: 'Corected',
        warnings: ['provider_warning'],
      }],
    }

    const [roundTripped] = parseLyricCueJson(JSON.stringify({ cues: [cue] }))
    expect(roundTripped).toEqual(cue)
  })

  it('infers JSON document source metadata and ignores unknown external document enums', () => {
    const result = parseLyricDocumentJson(JSON.stringify({
      title: 'External document',
      sourceType: 'future_source',
      sourceFormat: 'future_format',
      cues: [{ startMs: 0, endMs: 1000, text: 'Line' }],
    }))

    expect(result.errors).toEqual([])
    expect(result.documentPatch.sourceType).toBe('json_import')
    expect(result.documentPatch.sourceFormat).toBe('json')
    expect(result.documentPatch.rawSourceText).toContain('External document')
    expect(result.warnings).toHaveLength(2)
  })
})

describe('lyric database mapping', () => {
  it('maps legacy rows that do not contain optional metadata', () => {
    const cue = mapLyricCueRowToCue(legacyRow())
    expect(cue).toMatchObject({ id: 'cue-row-1', text: 'Legacy cue' })
    expect(cue.confidence).toBeUndefined()
    expect(cue.source).toBeUndefined()
    expect(cue.reviewStatus).toBeUndefined()
  })

  it('round-trips explicit snake_case database columns and extended word JSON', () => {
    const row = legacyRow({
      confidence: 0.81,
      source: 'transcription',
      review_status: 'unreviewed',
      section_id: 'verse-1',
      section_type: 'verse',
      warnings: ['low_confidence'],
      analysis_metadata: { model: 'fixture-model' },
      original_transcription_text: 'raw line',
      words: [{
        id: 'word-db',
        text: 'raw',
        startMs: 1000,
        endMs: 1500,
        confidence: 0.81,
        source: 'transcription',
      }],
    })

    const cue = mapLyricCueRowToCue(row)
    expect(cue).toMatchObject({
      confidence: 0.81,
      source: 'transcription',
      reviewStatus: 'unreviewed',
      sectionId: 'verse-1',
      sectionType: 'verse',
      warnings: ['low_confidence'],
      analysisMetadata: { model: 'fixture-model' },
      originalTranscriptionText: 'raw line',
    })

    const input = createLyricCueInputFromCue(cue, 'doc-1', 3)
    const insert = mapLyricCueToInsert(input)
    expect(insert).toMatchObject({
      lyric_document_id: 'doc-1',
      sort_order: 3,
      confidence: 0.81,
      source: 'transcription',
      review_status: 'unreviewed',
      section_id: 'verse-1',
      section_type: 'verse',
      warnings: ['low_confidence'],
      analysis_metadata: { model: 'fixture-model' },
      original_transcription_text: 'raw line',
    })
    expect(insert.words[0]).toMatchObject({ confidence: 0.81, source: 'transcription' })
  })

  it('normalizes unknown database enum values without crashing', () => {
    const cue = mapLyricCueRowToCue(legacyRow({
      source: 'future_source',
      review_status: 'future_status',
      section_type: 'hook',
      warnings: ['future_warning'],
    }))

    expect(cue.source).toBe('unknown')
    expect(cue.reviewStatus).toBeUndefined()
    expect(cue.sectionType).toBe('unknown')
    expect(cue.warnings).toEqual(expect.arrayContaining([
      'unknown',
      'unknown_source',
      'unknown_review_status',
      'unknown_section_type',
    ]))
  })
})

describe('confidence validation', () => {
  it('reports invalid cue and word confidence without treating missing values as errors', () => {
    const result = validateLyricCues([
      {
        id: 'bad',
        startMs: 0,
        endMs: 1000,
        text: 'Bad confidence',
        confidence: 1.1,
        words: [{ id: 'bad-word', text: 'Bad', startMs: 0, endMs: 500, confidence: -0.1 }],
      },
      {
        id: 'missing',
        startMs: 1000,
        endMs: 2000,
        text: 'Unknown confidence',
      },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'Cue 1: confidence must be between 0 and 1',
      'Cue 1, word 1: confidence must be between 0 and 1',
    ]))
    expect(result.errors.some(error => error.includes('Cue 2') && error.includes('confidence'))).toBe(false)
  })
})

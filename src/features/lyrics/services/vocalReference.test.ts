import { describe, expect, it } from 'vitest'
import {
  assessVocalReferenceCompatibility,
  normalizeVocalReferenceOffsetMs,
  shiftReconciledTranscriptToOwnerTimeline,
} from '../../../../supabase/functions/_shared/vocalReference'
import type { ReconciledTranscript } from '../../../../supabase/functions/_shared/lyricTranscriptionCore'

function transcript(): ReconciledTranscript {
  return {
    language: 'en',
    durationMs: 10_000,
    rawText: 'hello world',
    confidence: 0.9,
    warnings: [],
    words: [
      { id: 'w1', text: 'hello', startMs: 500, endMs: 1_000, source: 'transcription', reviewStatus: 'unreviewed', normalizedText: 'hello', originalTranscriptionText: 'hello' },
      { id: 'w2', text: 'world', startMs: 9_500, endMs: 10_000, source: 'transcription', reviewStatus: 'unreviewed', normalizedText: 'world', originalTranscriptionText: 'world' },
    ],
    segments: [],
  }
}

describe('vocal reference compatibility', () => {
  it('classifies compatible, minor, significant, and unknown durations', () => {
    expect(assessVocalReferenceCompatibility(180, 180, 0).status).toBe('compatible')
    expect(assessVocalReferenceCompatibility(180, 174, 0).status).toBe('minor_difference')
    expect(assessVocalReferenceCompatibility(180, 150, 0).status).toBe('significant_mismatch')
    expect(assessVocalReferenceCompatibility(180, null, 0).status).toBe('duration_unknown')
  })

  it('uses the offset when comparing the source end to the full mix', () => {
    const compatibility = assessVocalReferenceCompatibility(180, 175, 5_000)
    expect(compatibility.status).toBe('compatible')
    expect(compatibility.durationDifferenceMs).toBe(0)
  })

  it('blocks obviously different arrangements', () => {
    const compatibility = assessVocalReferenceCompatibility(240, 45, 0)
    expect(compatibility.status).toBe('significant_mismatch')
    expect(compatibility.blocked).toBe(true)
    expect(compatibility.requiresConfirmation).toBe(false)
  })
})

describe('vocal reference offset normalization', () => {
  it('supports positive and negative offsets and applies them exactly once', () => {
    expect(normalizeVocalReferenceOffsetMs(1250.4)).toBe(1250)
    expect(normalizeVocalReferenceOffsetMs(-800.6)).toBe(-801)

    const positive = shiftReconciledTranscriptToOwnerTimeline(transcript(), 1_000, 12_000)
    expect(positive.transcript.words[0].startMs).toBe(1_500)
    expect(positive.transcript.words[1].endMs).toBe(11_000)
    expect(positive.transcript.words[0].analysisMetadata).toMatchObject({
      vocalReferenceSourceStartMs: 500,
      vocalReferenceSourceEndMs: 1_000,
      vocalReferenceOffsetAppliedMs: 1_000,
    })

    const negative = shiftReconciledTranscriptToOwnerTimeline(transcript(), -750, 10_000)
    expect(negative.transcript.words[0].startMs).toBe(0)
    expect(negative.clampedWordCount).toBe(1)
    expect(negative.transcript.words[1].startMs).toBe(8_750)
  })

  it('rejects words outside the canonical full-mix timeline', () => {
    const shifted = shiftReconciledTranscriptToOwnerTimeline(transcript(), -1_000, 9_000)
    expect(shifted.rejectedWordCount).toBe(1)
    expect(shifted.transcript.words).toHaveLength(1)
    expect(shifted.transcript.words[0].text).toBe('world')
    expect(shifted.transcript.words[0].endMs).toBe(9_000)
  })
})

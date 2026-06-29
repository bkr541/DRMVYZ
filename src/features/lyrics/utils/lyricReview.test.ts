import { describe, expect, it } from 'vitest'
import type { LyricCue } from '../../../types/lyrics'
import {
  getLyricReviewStatistics,
  selectCuesWithWarnings,
  selectLowConfidenceCues,
  selectUnreviewedCues,
} from './lyricReview'

function cue(id: string, patch: Partial<LyricCue> = {}): LyricCue {
  return {
    id,
    startMs: 0,
    endMs: 1000,
    text: id,
    ...patch,
  }
}

describe('lyric review selectors', () => {
  const cues = [
    cue('legacy-missing-status'),
    cue('low', { confidence: 0.4, reviewStatus: 'unreviewed', warnings: ['low_confidence'] }),
    cue('derived-low', {
      reviewStatus: 'reviewed',
      words: [
        { id: 'a', text: 'a', startMs: 0, endMs: 400, confidence: 0.5 },
        { id: 'b', text: 'b', startMs: 400, endMs: 1000, confidence: 0.7 },
      ],
    }),
    cue('corrected', { confidence: 0.95, reviewStatus: 'corrected' }),
    cue('rejected', { reviewStatus: 'rejected', warnings: ['provider_warning'] }),
  ]

  it('finds low-confidence cues using explicit or derived confidence only', () => {
    expect(selectLowConfidenceCues(cues, 0.7).map(item => item.id)).toEqual(['low', 'derived-low'])
  })

  it('treats missing legacy review status as unreviewed', () => {
    expect(selectUnreviewedCues(cues).map(item => item.id)).toEqual([
      'legacy-missing-status',
      'low',
    ])
  })

  it('finds cues containing typed warnings', () => {
    expect(selectCuesWithWarnings(cues).map(item => item.id)).toEqual(['low', 'rejected'])
  })

  it('calculates review completion statistics without mutating cues', () => {
    const stats = getLyricReviewStatistics(cues, 0.7)
    expect(stats).toEqual({
      total: 5,
      completed: 3,
      unreviewed: 2,
      reviewed: 1,
      corrected: 1,
      rejected: 1,
      withWarnings: 2,
      lowConfidence: 2,
      completionRatio: 0.6,
      completionPercent: 60,
    })
  })

  it('reports an empty review set as complete', () => {
    expect(getLyricReviewStatistics([]).completionPercent).toBe(100)
  })
})

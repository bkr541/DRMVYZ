import type { LyricCue, LyricReviewStatus } from '../../../types/lyrics'
import { resolveLyricCueConfidence } from '../../../types/lyrics'

export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.7

export interface LyricReviewStatistics {
  total: number
  completed: number
  unreviewed: number
  reviewed: number
  corrected: number
  rejected: number
  withWarnings: number
  lowConfidence: number
  completionRatio: number
  completionPercent: number
}

function effectiveReviewStatus(cue: LyricCue): LyricReviewStatus {
  return cue.reviewStatus ?? 'unreviewed'
}

export function selectLowConfidenceCues(
  cues: readonly LyricCue[],
  threshold = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
): LyricCue[] {
  const safeThreshold = Number.isFinite(threshold)
    ? Math.min(1, Math.max(0, threshold))
    : DEFAULT_LOW_CONFIDENCE_THRESHOLD

  return cues.filter(cue => {
    const confidence = resolveLyricCueConfidence(cue)
    return confidence !== undefined && confidence < safeThreshold
  })
}

export function selectUnreviewedCues(cues: readonly LyricCue[]): LyricCue[] {
  return cues.filter(cue => effectiveReviewStatus(cue) === 'unreviewed')
}

export function selectCuesWithWarnings(cues: readonly LyricCue[]): LyricCue[] {
  return cues.filter(cue => (cue.warnings?.length ?? 0) > 0)
}

export function getLyricReviewStatistics(
  cues: readonly LyricCue[],
  lowConfidenceThreshold = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
): LyricReviewStatistics {
  const counts: Record<LyricReviewStatus, number> = {
    unreviewed: 0,
    reviewed: 0,
    corrected: 0,
    rejected: 0,
  }

  for (const cue of cues) counts[effectiveReviewStatus(cue)] += 1

  const completed = counts.reviewed + counts.corrected + counts.rejected
  const completionRatio = cues.length === 0 ? 1 : completed / cues.length

  return {
    total: cues.length,
    completed,
    unreviewed: counts.unreviewed,
    reviewed: counts.reviewed,
    corrected: counts.corrected,
    rejected: counts.rejected,
    withWarnings: selectCuesWithWarnings(cues).length,
    lowConfidence: selectLowConfidenceCues(cues, lowConfidenceThreshold).length,
    completionRatio,
    completionPercent: completionRatio * 100,
  }
}

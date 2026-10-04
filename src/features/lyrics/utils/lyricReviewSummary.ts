import { resolveLyricCueConfidence, type LyricCue } from '../../../types/lyrics'
import { validateLyricCues } from './lyricValidation'

export interface LyricReviewSummary {
  errors: number
  warnings: number
  /** Cues needing attention: validation issue, unreviewed, low confidence, or flagged warnings (each cue once). */
  attentionCueIds: Set<string>
}

/** The single definition of "needs review", shared by the Review tab and the inspector's summary card. */
export function getLyricReviewSummary(cues: readonly LyricCue[]): LyricReviewSummary {
  const validation = validateLyricCues(cues as LyricCue[])
  const attentionCueIds = new Set<string>(
    validation.issues.map(issue => issue.cueId).filter((id): id is string => Boolean(id)),
  )
  for (const cue of cues) {
    if (!cue.reviewStatus || cue.reviewStatus === 'unreviewed') attentionCueIds.add(cue.id)
    const confidence = resolveLyricCueConfidence(cue)
    if (confidence !== undefined && confidence < 0.7) attentionCueIds.add(cue.id)
    if ((cue.warnings?.length ?? 0) > 0) attentionCueIds.add(cue.id)
  }
  return { errors: validation.errors.length, warnings: validation.warnings.length, attentionCueIds }
}

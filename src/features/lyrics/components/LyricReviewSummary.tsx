import { useMemo } from 'react'
import { Collapsible } from '../../../components/vyzualz/react/ReactControlRows'
import { getLyricReviewSummary } from '../utils/lyricReviewSummary'
import type { LyricCue } from '../../../types/lyrics'

interface Props {
  cues: readonly LyricCue[]
  /** Switches the inspector to its Review tab (the full list and issue navigation live there). */
  onOpenReview: () => void
}

/** Compact "Review & Validation" shortcut under the inspector: counts only, no second diagnostics panel. */
export function LyricReviewSummary({ cues, onOpenReview }: Props) {
  const summary = useMemo(() => getLyricReviewSummary(cues), [cues])
  const rows: Array<{ id: string; label: string; count: number; tone: 'error' | 'warn' | 'review' }> = [
    ...(summary.errors > 0 ? [{ id: 'errors', label: 'Errors', count: summary.errors, tone: 'error' as const }] : []),
    { id: 'warnings', label: 'Warnings', count: summary.warnings, tone: 'warn' },
    { id: 'needs-review', label: 'Needs review', count: summary.attentionCueIds.size, tone: 'review' },
  ]

  return (
    <section className="lmv-review-summary" aria-label="Review and validation summary">
      <Collapsible label="Review & Validation">
      {rows.map(row => (
        <button
          key={row.id}
          type="button"
          className={`lmv-review-summary__row lmv-review-summary__row--${row.tone}${row.count === 0 ? ' is-clear' : ''}`}
          onClick={onOpenReview}
          aria-label={`${row.label}: ${row.count}. Open Review`}
        >
          <span className="lmv-review-summary__label">{row.label}</span>
          <strong>{row.count}</strong>
          <span aria-hidden="true">›</span>
        </button>
      ))}
      </Collapsible>
    </section>
  )
}

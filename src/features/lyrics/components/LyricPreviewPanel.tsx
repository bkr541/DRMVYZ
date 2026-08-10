import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { resolveLyricCueConfidence, type LyricCue, type LyricDocument, type LyricStyle } from '../../../types/lyrics'
import {
  validateLyricCues,
  formatMsCompact,
  type LyricValidationIssue,
} from '../utils/lyricValidation'
import { getLyricReviewStatistics } from '../utils/lyricReview'
import { toCanonicalLyricTimeMs, toEffectiveLyricTimeMs } from '../runtime/lyricPlaybackResolver'

interface Props {
  cues: LyricCue[]
  document: LyricDocument | null
  selectedCue: LyricCue | null
  currentAudioTimeMs?: number | null
  isPlaying?: boolean
  globalOffsetMs?: number
  onNavigateToIssue?: (issue: LyricValidationIssue) => void
  onPreviewInVisualizer: () => void
  previewDestination?: 'React' | 'Visualizer' | 'Show Manager'
  extractionConsole?: ReactNode
}

export function calculateLyricCueProgress(
  currentAudioTimeMs: number | null | undefined,
  cue: Pick<LyricCue, 'startMs' | 'endMs'> | null | undefined,
  globalOffsetMs = 0,
): number {
  if (!cue || currentAudioTimeMs === null || currentAudioTimeMs === undefined || !Number.isFinite(currentAudioTimeMs)) return 0
  if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)) return 0
  const effectiveStart = toEffectiveLyricTimeMs(cue.startMs, globalOffsetMs)
  const effectiveEnd = toEffectiveLyricTimeMs(cue.endMs, globalOffsetMs)
  const duration = effectiveEnd - effectiveStart
  if (!(duration > 0)) return currentAudioTimeMs >= effectiveEnd ? 100 : 0
  if (currentAudioTimeMs <= effectiveStart) return 0
  if (currentAudioTimeMs >= effectiveEnd) return 100
  return Math.max(0, Math.min(100, ((currentAudioTimeMs - effectiveStart) / duration) * 100))
}

function activeCueAt(cues: readonly LyricCue[], audioTimeMs: number | null | undefined, globalOffsetMs: number): LyricCue | null {
  if (audioTimeMs === null || audioTimeMs === undefined || !Number.isFinite(audioTimeMs)) return null
  const canonicalTime = toCanonicalLyricTimeMs(audioTimeMs, globalOffsetMs)
  let active: LyricCue | null = null
  for (const cue of cues) {
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)) continue
    if (cue.startMs <= canonicalTime && canonicalTime < cue.endMs && (!active || cue.startMs >= active.startMs)) active = cue
  }
  return active
}

function StylePreviewBox({ cue, doc }: { cue: LyricCue; doc: LyricDocument | null }) {
  const style: Partial<LyricStyle> = { ...doc?.defaultStyle, ...cue.style }
  const color = style.color ?? '#ffffff'
  const fontSize = Math.max(12, Math.min(42, (style.fontSize ?? 48) * 0.55))
  const fontFamily = style.fontFamily ?? 'inherit'
  const fontWeight = style.fontWeight ?? 700
  const shadowBlur = style.shadowBlur ?? 0
  const shadowColor = style.shadowColor ?? 'transparent'
  const strokeColor = style.strokeColor ?? 'transparent'

  return (
    <div className="lmv-preview-cue-box">
      <div
        className="lmv-preview-cue-text"
        style={{
          color,
          opacity: style.opacity ?? 1,
          fontSize,
          fontFamily,
          fontWeight,
          textShadow: shadowBlur > 0 ? `0 0 ${shadowBlur}px ${shadowColor}` : undefined,
          WebkitTextStroke: style.strokeWidth ? `${style.strokeWidth * 0.5}px ${strokeColor}` : undefined,
          textAlign: (style.align as CSSProperties['textAlign']) ?? 'center',
          letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
          textTransform: style.textTransform as CSSProperties['textTransform'],
        }}
      >
        {cue.text}
      </div>
      <div className="lmv-preview-cue-timing">
        {formatMsCompact(cue.startMs)} → {formatMsCompact(cue.endMs)}
      </div>
    </div>
  )
}

function RightInspectorSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  badge?: ReactNode
}) {
  return (
    <DualRailCollapsible
      className="lmv-panel-card lmv-right-section"
      headerClassName="lmv-right-section-header"
      bodyClassName="lmv-right-section-body"
      defaultOpen={defaultOpen}
      label={<span className="lmv-right-section-title">{title}</span>}
      headerAccessory={badge ? <span className="lmv-right-section-badge">{badge}</span> : undefined}
    >
      {children}
    </DualRailCollapsible>
  )
}

function IssueList({
  issues,
  onNavigate,
}: {
  issues: LyricValidationIssue[]
  onNavigate?: (issue: LyricValidationIssue) => void
}) {
  if (!issues.length) return null
  return (
    <div className={`lmv-msg-list lmv-msg-list--${issues[0]?.severity === 'error' ? 'error' : 'warn'}`}>
      {issues.map(issue => (
        <button
          key={issue.id}
          type="button"
          className="lmv-msg-item lmv-msg-item--action"
          onClick={() => onNavigate?.(issue)}
          disabled={!issue.cueId || !onNavigate}
          aria-label={`${issue.severity === 'error' ? 'Error' : 'Warning'}: ${issue.message}. Open affected lyric timing.`}
        >
          <span aria-hidden="true">{issue.severity === 'error' ? '✕' : '⚠'}</span>
          <span>{issue.message}</span>
          {issue.cueId && onNavigate && <em>Open</em>}
        </button>
      ))}
    </div>
  )
}

export function LyricPreviewPanel({
  cues,
  document,
  selectedCue,
  currentAudioTimeMs = null,
  isPlaying = false,
  globalOffsetMs = 0,
  onNavigateToIssue,
  onPreviewInVisualizer,
  previewDestination = 'Visualizer',
  extractionConsole,
}: Props) {
  const validation = useMemo(() => validateLyricCues(cues), [cues])
  const review = useMemo(() => getLyricReviewStatistics(cues), [cues])
  const hasTimedCues = cues.some(c => typeof c.endMs === 'number' && typeof c.startMs === 'number' && c.endMs > c.startMs)
  const activeCue = useMemo(() => activeCueAt(cues, currentAudioTimeMs, globalOffsetMs), [cues, currentAudioTimeMs, globalOffsetMs])
  const previewCue = isPlaying && activeCue ? activeCue : selectedCue ?? activeCue
  const selectedIndex = previewCue ? cues.findIndex(cue => cue.id === previewCue.id) : -1
  const progressPercent = calculateLyricCueProgress(currentAudioTimeMs, previewCue, globalOffsetMs)
  const validationCueIds = new Set(validation.issues.map(issue => issue.cueId).filter((id): id is string => Boolean(id)))
  const attentionCueIds = new Set<string>(validationCueIds)
  for (const cue of cues) {
    if (!cue.reviewStatus || cue.reviewStatus === 'unreviewed') attentionCueIds.add(cue.id)
    const confidence = resolveLyricCueConfidence(cue)
    if (confidence !== undefined && confidence < 0.7) attentionCueIds.add(cue.id)
    if ((cue.warnings?.length ?? 0) > 0) attentionCueIds.add(cue.id)
  }

  const fmtMs = (ms: number | null) => ms !== null ? formatMsCompact(ms) : '—'
  const validationBadge = (
    <span className={`lmv-valid-badge${validation.valid ? ' lmv-valid-badge--ok' : ' lmv-valid-badge--err'}`}>
      {validation.valid ? 'OK' : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`}
    </span>
  )
  const errorIssues = validation.issues.filter(issue => issue.severity === 'error')
  const warningIssues = validation.issues.filter(issue => issue.severity === 'warning')

  return (
    <div className="lmv-right-panel">
      <RightInspectorSection title="Live Preview">
        {previewCue ? (
          <>
            <StylePreviewBox cue={previewCue} doc={document} />
            <div className="lmv-preview-cue-meta">
              <span>{isPlaying && activeCue?.id === previewCue.id ? 'Playing cue' : 'Selected cue'}: {selectedIndex + 1} / {cues.length}</span>
              <strong>{previewCue.text || 'Empty cue'}</strong>
              <div
                className="lmv-preview-progress"
                role="progressbar"
                aria-label="Cue playback progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
              >
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <em>{formatMsCompact(toEffectiveLyricTimeMs(previewCue.startMs, globalOffsetMs))} / {formatMsCompact(toEffectiveLyricTimeMs(previewCue.endMs, globalOffsetMs))}</em>
            </div>
          </>
        ) : (
          <div className="lmv-preview-empty">Select a cue to preview its appearance</div>
        )}
        <IconChipButton
          className="lmv-preview-viz-btn"
          onClick={onPreviewInVisualizer}
          disabled={!hasTimedCues}
          title={hasTimedCues
            ? `Push draft cues to ${previewDestination} for live preview`
            : 'No cues to preview. Import or create lyric cues first.'}
        >
          Preview in {previewDestination} ↗
        </IconChipButton>
      </RightInspectorSection>

      {extractionConsole}

      <RightInspectorSection title="Validation" badge={validationBadge}>
        <IssueList issues={errorIssues} onNavigate={onNavigateToIssue} />
        <IssueList issues={warningIssues.slice(0, 8)} onNavigate={onNavigateToIssue} />
        {warningIssues.length > 8 && <div className="lmv-msg-item lmv-msg-muted">+{warningIssues.length - 8} more warnings</div>}
        {(attentionCueIds.size > 0 || validation.issues.length > 0) && (
          <div className="lmv-attention-box">
            <strong>{attentionCueIds.size} unique cue{attentionCueIds.size === 1 ? '' : 's'} needing attention</strong>
            <dl className="lmv-attention-counts">
              <div><dt>Unreviewed cues</dt><dd>{review.unreviewed}</dd></div>
              <div><dt>Low confidence</dt><dd>{review.lowConfidence}</dd></div>
              <div><dt>Warnings</dt><dd>{validation.warnings.length}</dd></div>
              <div><dt>Errors</dt><dd>{validation.errors.length}</dd></div>
            </dl>
          </div>
        )}
        {validation.valid && validation.warnings.length === 0 && cues.length > 0 && (
          <div className="lmv-valid-ok-msg">All cues are valid</div>
        )}
      </RightInspectorSection>

      <RightInspectorSection title="Document Stats">
        <div className="lmv-stats-grid">
          <div className="lmv-stat-row"><span className="lmv-stat-label">Cues</span><span className="lmv-stat-value">{validation.cueCount}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Words</span><span className="lmv-stat-value">{validation.wordCount}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Unreviewed</span><span className="lmv-stat-value">{review.unreviewed}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Low confidence</span><span className="lmv-stat-value">{review.lowConfidence}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Review complete</span><span className="lmv-stat-value">{Math.round(review.completionPercent)}%</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Groups</span><span className="lmv-stat-value">{validation.groupCount}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">Start</span><span className="lmv-stat-value">{fmtMs(validation.earliestStartMs)}</span></div>
          <div className="lmv-stat-row"><span className="lmv-stat-label">End</span><span className="lmv-stat-value">{fmtMs(validation.latestEndMs)}</span></div>
          {document && (
            <>
              <div className="lmv-stat-row"><span className="lmv-stat-label">Source</span><span className="lmv-stat-value">{document.sourceType}</span></div>
              <div className="lmv-stat-row"><span className="lmv-stat-label">Active</span><span className={`lmv-stat-value${document.isActive ? ' lmv-stat-active' : ''}`}>{document.isActive ? 'Yes' : 'No'}</span></div>
            </>
          )}
        </div>
        <DualRailCollapsible
          className="lmv-stats-explainer"
          defaultOpen={false}
          label="What these counts mean"
        >
          <p>Cues are timed lyric lines. Words are optional nested timings inside those cues, so some documents can have cue timing without word timing.</p>
        </DualRailCollapsible>
      </RightInspectorSection>
    </div>
  )
}

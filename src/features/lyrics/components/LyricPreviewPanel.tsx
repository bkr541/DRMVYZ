import { useState, type CSSProperties, type ReactNode } from 'react'
import type { LyricCue, LyricDocument, LyricStyle } from '../../../types/lyrics'
import { validateLyricCues, formatMsCompact } from '../utils/lyricValidation'
import { getLyricReviewStatistics } from '../utils/lyricReview'

interface Props {
  cues: LyricCue[]
  document: LyricDocument | null
  selectedCue: LyricCue | null
  onPreviewInVisualizer: () => void
  extractionConsole?: ReactNode
}

function StylePreviewBox({ cue, doc }: { cue: LyricCue; doc: LyricDocument | null }) {
  const style: Partial<LyricStyle> = { ...doc?.defaultStyle, ...cue.style }
  const color      = style.color      ?? '#ffffff'
  const fontSize   = Math.max(12, Math.min(42, (style.fontSize ?? 48) * 0.55))
  const fontFamily = style.fontFamily ?? 'inherit'
  const fontWeight = style.fontWeight ?? 700
  const shadowBlur = style.shadowBlur  ?? 0
  const shadowColor = style.shadowColor ?? 'transparent'
  const strokeColor = style.strokeColor ?? 'transparent'

  return (
    <div className="lmv-preview-cue-box">
      <div
        className="lmv-preview-cue-text"
        style={{
          color,
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
  const [open, setOpen] = useState(defaultOpen)
  const contentId = `lmv-right-section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <section className={`lmv-panel-card lmv-right-section${open ? ' lmv-right-section--open' : ' lmv-right-section--closed'}`}>
      <button
        type="button"
        className="lmv-right-section-header"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <span className="lmv-right-section-title">{title}</span>
        {badge && <span className="lmv-right-section-badge">{badge}</span>}
        <span className="lmv-right-section-arrow" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div id={contentId} className="lmv-right-section-body">
          {children}
        </div>
      )}
    </section>
  )
}

export function LyricPreviewPanel({ cues, document, selectedCue, onPreviewInVisualizer, extractionConsole }: Props) {
  const validation = validateLyricCues(cues)
  const review = getLyricReviewStatistics(cues)
  const hasTimedCues = cues.some(c => typeof c.endMs === 'number' && typeof c.startMs === 'number' && c.endMs > c.startMs)
  const selectedIndex = selectedCue ? cues.findIndex(cue => cue.id === selectedCue.id) : -1
  const attentionCount = review.lowConfidence + review.unreviewed + validation.warnings.length + validation.errors.length
  const selectedDurationMs = selectedCue ? Math.max(1, selectedCue.endMs - selectedCue.startMs) : 1
  const selectedProgressPercent = selectedCue
    ? Math.max(0, Math.min(100, ((selectedCue.endMs - selectedCue.startMs) / selectedDurationMs) * 100))
    : 0

  const fmtMs = (ms: number | null) =>
    ms !== null ? formatMsCompact(ms) : '—'

  const fmtDuration = (ms: number | null) => {
    if (ms === null) return '—'
    const s = ms / 1000
    const m = Math.floor(s / 60)
    const sec = (s % 60).toFixed(1)
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const validationBadge = (
    <span className={`lmv-valid-badge${validation.valid ? ' lmv-valid-badge--ok' : ' lmv-valid-badge--err'}`}>
      {validation.valid ? 'OK' : `${validation.errors.length} error${validation.errors.length !== 1 ? 's' : ''}`}
    </span>
  )

  return (
    <div className="lmv-right-panel">
      <RightInspectorSection title="Live Preview">
        {selectedCue ? (
          <>
            <StylePreviewBox cue={selectedCue} doc={document} />
            <div className="lmv-preview-cue-meta">
              <span>Cue: {selectedIndex + 1} / {cues.length}</span>
              <strong>{selectedCue.text || 'Empty cue'}</strong>
              <div className="lmv-preview-progress" aria-hidden="true">
                <span style={{ width: `${selectedProgressPercent}%` }} />
              </div>
              <em>{formatMsCompact(selectedCue.startMs)} / {formatMsCompact(selectedCue.endMs)}</em>
            </div>
          </>
        ) : (
          <div className="lmv-preview-empty">
            Select a cue to preview its appearance
          </div>
        )}
        <button
          className="lmv-btn lmv-btn--ghost lmv-preview-viz-btn"
          onClick={onPreviewInVisualizer}
          disabled={!hasTimedCues}
          title={hasTimedCues
            ? 'Push draft cues to visualizer for live preview'
            : 'No cues to preview. Import or create lyric cues first.'}
        >
          Preview in Visualizer ↗
        </button>
      </RightInspectorSection>

      {extractionConsole}

      <RightInspectorSection title="Validation" badge={validationBadge}>
        {validation.errors.length > 0 && (
          <div className="lmv-msg-list lmv-msg-list--error">
            {validation.errors.map((e, i) => (
              <div key={i} className="lmv-msg-item">✕ {e}</div>
            ))}
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div className="lmv-msg-list lmv-msg-list--warn">
            {validation.warnings.slice(0, 5).map((w, i) => (
              <div key={i} className="lmv-msg-item">⚠ {w}</div>
            ))}
            {validation.warnings.length > 5 && (
              <div className="lmv-msg-item lmv-msg-muted">
                +{validation.warnings.length - 5} more warnings
              </div>
            )}
          </div>
        )}
        {attentionCount > 0 && (
          <div className="lmv-attention-box">
            <strong>⚠ {attentionCount} cue review item{attentionCount === 1 ? '' : 's'}</strong>
            <span>{review.lowConfidence} low-confidence, {review.unreviewed} unreviewed</span>
            <button type="button">View details →</button>
          </div>
        )}
        {validation.valid && validation.warnings.length === 0 && cues.length > 0 && (
          <div className="lmv-valid-ok-msg">All cues are valid</div>
        )}
      </RightInspectorSection>

      <RightInspectorSection title="Document Stats">
        <div className="lmv-stats-grid">
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Cues</span>
            <span className="lmv-stat-value">{validation.cueCount}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Words</span>
            <span className="lmv-stat-value">{validation.wordCount}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Unreviewed</span>
            <span className="lmv-stat-value">{review.unreviewed}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Low confidence</span>
            <span className="lmv-stat-value">{review.lowConfidence}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Review complete</span>
            <span className="lmv-stat-value">{Math.round(review.completionPercent)}%</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Groups</span>
            <span className="lmv-stat-value">{validation.groupCount}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">Start</span>
            <span className="lmv-stat-value">{fmtMs(validation.earliestStartMs)}</span>
          </div>
          <div className="lmv-stat-row">
            <span className="lmv-stat-label">End</span>
            <span className="lmv-stat-value">{fmtMs(validation.latestEndMs)}</span>
          </div>
          {document && (
            <>
              <div className="lmv-stat-row">
                <span className="lmv-stat-label">Source</span>
                <span className="lmv-stat-value">{document.sourceType}</span>
              </div>
              <div className="lmv-stat-row">
                <span className="lmv-stat-label">Active</span>
                <span className={`lmv-stat-value${document.isActive ? ' lmv-stat-active' : ''}`}>
                  {document.isActive ? 'Yes' : 'No'}
                </span>
              </div>
            </>
          )}
        </div>
      </RightInspectorSection>
    </div>
  )
}

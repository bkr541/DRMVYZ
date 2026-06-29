import { useEffect, useMemo, useState } from 'react'
import type {
  LyricAnimation,
  LyricCue,
  LyricEffects,
  LyricReviewStatus,
  LyricSectionType,
  LyricSource,
  LyricStyle,
  LyricWarning,
  LyricWord,
} from '../../../types/lyrics'
import { getCueIssues, LOW_LYRIC_CONFIDENCE, validateWordTiming } from './lyricCueEditorModel'

export interface LyricSectionOption {
  id: string
  label: string
  type: LyricSectionType
}

export interface LyricCueActionHandlers {
  setStartToPlayhead(): void
  setEndToPlayhead(): void
  moveToPlayhead(): void
  addAtPlayhead(): void
  duplicate(): void
  split(): void
  mergePrevious(): void
  mergeNext(): void
  delete(): void
}

interface Props {
  cue: LyricCue
  cues: LyricCue[]
  currentTimeMs: number | null
  durationMs: number
  sections?: LyricSectionOption[]
  actions: LyricCueActionHandlers
  canMergePrevious: boolean
  canMergeNext: boolean
  onUpdateCue: (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => void
}

const SOURCES: LyricSource[] = ['manual', 'import', 'transcription', 'corrected', 'generated', 'unknown']
const REVIEW_STATUSES: LyricReviewStatus[] = ['unreviewed', 'reviewed', 'corrected', 'rejected']
const WARNINGS: LyricWarning[] = [
  'low_confidence',
  'confidence_clamped',
  'invalid_confidence',
  'timing_overlap',
  'timing_outside_cue',
  'missing_word_timing',
  'unknown_source',
  'unknown_review_status',
  'unknown_section_type',
  'needs_review',
  'provider_warning',
  'unknown',
]

function parseFiniteInteger(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2)
}

function JsonMetadataField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: Partial<LyricStyle> | Partial<LyricAnimation> | Partial<LyricEffects> | Record<string, unknown> | undefined
  onCommit: (value: Record<string, unknown>) => void
}) {
  const [draft, setDraft] = useState(stableJson(value))
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(stableJson(value)); setError(null) }, [value])

  const commit = () => {
    try {
      const parsed = JSON.parse(draft) as unknown
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Use a JSON object')
      setError(null)
      onCommit(parsed as Record<string, unknown>)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Invalid JSON')
    }
  }

  return (
    <div className="lyric-cue-inspector__json-field">
      <label>{label}</label>
      <textarea
        className="lmv-textarea"
        rows={4}
        value={draft}
        aria-invalid={!!error}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') commit()
        }}
      />
      {error && <span role="alert" className="lyric-cue-inspector__error">{error}</span>}
    </div>
  )
}

function WordTimingEditor({
  cue,
  onUpdateCue,
}: {
  cue: LyricCue
  onUpdateCue: Props['onUpdateCue']
}) {
  const words = cue.words ?? []
  const { invalidWords } = validateWordTiming(cue)
  const invalidIds = useMemo(() => new Set(invalidWords.map(word => word.id)), [invalidWords])

  const commitWords = (nextWords: LyricWord[]) => {
    const wordIds = new Set(nextWords.map(word => word.id))
    const groups = cue.groups
      ?.map(group => ({ ...group, wordIds: group.wordIds.filter(wordId => wordIds.has(wordId)) }))
      .filter(group => group.wordIds.length > 0)
    onUpdateCue(cue.id, {
      words: nextWords.length ? nextWords : undefined,
      groups: groups?.length ? groups : undefined,
    })
  }

  const updateWord = (wordId: string, patch: Partial<LyricWord>) => {
    commitWords(words.map(word => word.id === wordId ? { ...word, ...patch } : word))
  }

  if (!words.length) {
    return <div className="lyric-cue-inspector__empty-words">This cue has line timing only. Word timing is optional.</div>
  }

  return (
    <div className="lyric-word-editor">
      <div className="lyric-word-editor__header">
        <strong>Word timing</strong>
        {invalidWords.length > 0 && (
          <button
            type="button"
            className="lmv-btn lmv-btn--ghost"
            onClick={() => commitWords(words.filter(word => !invalidIds.has(word.id)))}
          >
            Remove invalid timing
          </button>
        )}
      </div>
      <div className="lyric-word-editor__rows">
        {words.map((word, index) => {
          const invalid = invalidIds.has(word.id)
          const lowConfidence = word.confidence !== undefined && word.confidence < LOW_LYRIC_CONFIDENCE
          return (
            <div
              key={word.id}
              className={`lyric-word-editor__row${invalid ? ' lyric-word-editor__row--invalid' : ''}${lowConfidence ? ' lyric-word-editor__row--low-confidence' : ''}`}
            >
              <span className="lyric-word-editor__index">{index + 1}</span>
              <input
                className="lmv-input"
                aria-label={`Word ${index + 1} text`}
                defaultValue={word.text}
                key={`${word.id}-text-${word.text}`}
                onBlur={event => updateWord(word.id, { text: event.target.value })}
              />
              <input
                className="lmv-num"
                type="number"
                step={1}
                aria-label={`Word ${index + 1} start milliseconds`}
                defaultValue={word.startMs}
                key={`${word.id}-start-${word.startMs}`}
                onBlur={event => {
                  const value = parseFiniteInteger(event.target.value)
                  if (value !== null) updateWord(word.id, { startMs: value })
                }}
              />
              <input
                className="lmv-num"
                type="number"
                step={1}
                aria-label={`Word ${index + 1} end milliseconds`}
                defaultValue={word.endMs}
                key={`${word.id}-end-${word.endMs}`}
                onBlur={event => {
                  const value = parseFiniteInteger(event.target.value)
                  if (value !== null) updateWord(word.id, { endMs: value })
                }}
              />
              <span className="lyric-word-editor__confidence">
                {word.confidence === undefined ? '—' : `${Math.round(word.confidence * 100)}%`}
              </span>
              <button
                type="button"
                className="lmv-icon-btn lmv-icon-btn--danger"
                aria-label={`Remove word ${index + 1}`}
                onClick={() => commitWords(words.filter(item => item.id !== word.id))}
              >×</button>
              {(invalid || lowConfidence) && (
                <span className="lyric-word-editor__status" role="status">
                  {invalid ? 'Invalid timing' : 'Low confidence'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function LyricCueInspector({
  cue,
  cues,
  currentTimeMs,
  durationMs,
  sections = [],
  actions,
  canMergePrevious,
  canMergeNext,
  onUpdateCue,
}: Props) {
  const [text, setText] = useState(cue.text)
  const [start, setStart] = useState(String(cue.startMs))
  const [end, setEnd] = useState(String(cue.endMs))
  const [duration, setDuration] = useState(String(Math.max(1, cue.endMs - cue.startMs)))
  const [confidence, setConfidence] = useState(cue.confidence === undefined ? '' : String(cue.confidence))
  const issues = useMemo(() => getCueIssues(cue, cues, durationMs), [cue, cues, durationMs])

  useEffect(() => {
    setText(cue.text)
    setStart(String(cue.startMs))
    setEnd(String(cue.endMs))
    setDuration(String(Math.max(1, cue.endMs - cue.startMs)))
    setConfidence(cue.confidence === undefined ? '' : String(cue.confidence))
  }, [cue.id, cue.text, cue.startMs, cue.endMs, cue.confidence])

  const applyTiming = () => {
    const nextStart = parseFiniteInteger(start)
    const nextEnd = parseFiniteInteger(end)
    if (nextStart === null || nextEnd === null) {
      setStart(String(cue.startMs))
      setEnd(String(cue.endMs))
      return
    }
    onUpdateCue(cue.id, { startMs: nextStart, endMs: nextEnd })
  }

  const applyDuration = () => {
    const nextDuration = parseFiniteInteger(duration)
    if (nextDuration === null || nextDuration < 1) {
      setDuration(String(Math.max(1, cue.endMs - cue.startMs)))
      return
    }
    onUpdateCue(cue.id, { endMs: cue.startMs + nextDuration })
  }

  const applyConfidence = () => {
    if (!confidence.trim()) {
      onUpdateCue(cue.id, { confidence: undefined })
      return
    }
    const value = Number(confidence)
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      setConfidence(cue.confidence === undefined ? '' : String(cue.confidence))
      return
    }
    onUpdateCue(cue.id, { confidence: value })
  }

  const currentWarnings = new Set(cue.warnings ?? [])
  const selectedSection = sections.find(section => section.id === cue.sectionId)

  return (
    <section className="lyric-cue-inspector" aria-label="Selected lyric cue editor">
      <div className="lyric-cue-inspector__heading">
        <div>
          <span className="lmv-section-label">Selected cue</span>
          <strong>{cue.text || 'Empty cue'}</strong>
        </div>
        <span className="lyric-cue-inspector__duration">{cue.endMs - cue.startMs} ms</span>
      </div>

      {issues.length > 0 && (
        <div className="lyric-cue-inspector__issues" role="status" aria-label={`${issues.length} cue warnings`}>
          {issues.map((issue, index) => <span key={`${issue.code}-${issue.relatedCueId ?? issue.wordId ?? index}`}>{issue.message}</span>)}
        </div>
      )}

      <div className="lyric-cue-inspector__grid">
        <label className="lyric-cue-inspector__wide">
          <span>Text</span>
          <textarea
            className="lmv-textarea"
            rows={3}
            value={text}
            onChange={event => setText(event.target.value)}
            onBlur={() => onUpdateCue(cue.id, { text })}
          />
        </label>
        <label>
          <span>Start (ms)</span>
          <input className="lmv-num" type="number" min={0} step={1} value={start} onChange={event => setStart(event.target.value)} onBlur={applyTiming} onKeyDown={event => event.key === 'Enter' && applyTiming()} />
        </label>
        <label>
          <span>End (ms)</span>
          <input className="lmv-num" type="number" min={1} step={1} value={end} onChange={event => setEnd(event.target.value)} onBlur={applyTiming} onKeyDown={event => event.key === 'Enter' && applyTiming()} />
        </label>
        <label>
          <span>Duration (ms)</span>
          <input
            className="lmv-num"
            type="number"
            min={1}
            step={1}
            value={duration}
            onChange={event => setDuration(event.target.value)}
            onBlur={applyDuration}
            onKeyDown={event => event.key === 'Enter' && applyDuration()}
          />
        </label>
        <label>
          <span>Confidence (0–1)</span>
          <input className="lmv-num" type="number" min={0} max={1} step={0.01} value={confidence} onChange={event => setConfidence(event.target.value)} onBlur={applyConfidence} onKeyDown={event => event.key === 'Enter' && applyConfidence()} />
        </label>
        <label>
          <span>Source</span>
          <select className="lmv-select" value={cue.source ?? ''} onChange={event => onUpdateCue(cue.id, { source: event.target.value ? event.target.value as LyricSource : undefined })}>
            <option value="">Unspecified</option>
            {SOURCES.map(source => <option key={source} value={source}>{source.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label>
          <span>Review status</span>
          <select className="lmv-select" value={cue.reviewStatus ?? ''} onChange={event => onUpdateCue(cue.id, { reviewStatus: event.target.value ? event.target.value as LyricReviewStatus : undefined })}>
            <option value="">Unspecified</option>
            {REVIEW_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="lyric-cue-inspector__wide">
          <span>Section association</span>
          <select
            className="lmv-select"
            value={cue.sectionId ?? ''}
            onChange={event => {
              const section = sections.find(item => item.id === event.target.value)
              onUpdateCue(cue.id, { sectionId: section?.id, sectionType: section?.type })
            }}
          >
            <option value="">No section</option>
            {sections.map(section => <option key={section.id} value={section.id}>{section.label} ({section.type.replace(/_/g, ' ')})</option>)}
          </select>
          {cue.sectionId && !selectedSection && <small>Stored section is not available in the current track analysis.</small>}
        </label>
      </div>

      <fieldset className="lyric-cue-inspector__warnings">
        <legend>Warnings</legend>
        {WARNINGS.map(warning => (
          <label key={warning}>
            <input
              type="checkbox"
              checked={currentWarnings.has(warning)}
              onChange={event => {
                const next = new Set(currentWarnings)
                if (event.target.checked) next.add(warning)
                else next.delete(warning)
                onUpdateCue(cue.id, { warnings: next.size ? [...next] : undefined })
              }}
            />
            {warning.replace(/_/g, ' ')}
          </label>
        ))}
      </fieldset>

      <div className="lyric-cue-inspector__actions" role="group" aria-label="Cue timing actions">
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={currentTimeMs === null} onClick={actions.setStartToPlayhead}>Set start to playhead</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={currentTimeMs === null} onClick={actions.setEndToPlayhead}>Set end to playhead</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={currentTimeMs === null} onClick={actions.moveToPlayhead}>Move to playhead</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={currentTimeMs === null} onClick={actions.addAtPlayhead}>Add at playhead</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" onClick={actions.duplicate}>Duplicate</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={currentTimeMs === null || currentTimeMs <= cue.startMs || currentTimeMs >= cue.endMs} onClick={actions.split}>Split at playhead</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={!canMergePrevious} onClick={actions.mergePrevious}>Merge previous</button>
        <button type="button" className="lmv-btn lmv-btn--ghost" disabled={!canMergeNext} onClick={actions.mergeNext}>Merge next</button>
        <button type="button" className="lmv-btn lyric-cue-inspector__delete" onClick={actions.delete}>Delete cue</button>
      </div>

      <details className="lyric-cue-inspector__metadata">
        <summary>Style, animation, effects, and analysis metadata</summary>
        <JsonMetadataField label="Style JSON" value={cue.style} onCommit={value => onUpdateCue(cue.id, { style: value as Partial<LyricStyle> })} />
        <JsonMetadataField label="Animation JSON" value={cue.animation} onCommit={value => onUpdateCue(cue.id, { animation: value as Partial<LyricAnimation> })} />
        <JsonMetadataField label="Effects JSON" value={cue.effects} onCommit={value => onUpdateCue(cue.id, { effects: value as Partial<LyricEffects> })} />
        <JsonMetadataField label="Analysis metadata JSON" value={cue.analysisMetadata} onCommit={value => onUpdateCue(cue.id, { analysisMetadata: value })} />
      </details>

      <WordTimingEditor cue={cue} onUpdateCue={onUpdateCue} />
    </section>
  )
}

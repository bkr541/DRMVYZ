import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { IconMorphCheckbox } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import { NoticeCard } from '../../../components/vyzualz/react/controls/NoticeCard'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
import {
  getCueIssues,
  LOW_LYRIC_CONFIDENCE,
  normalizeLyricCueTiming,
  retainLyricGroupsForWords,
  validateWordTiming,
} from './lyricCueEditorModel'
import { LyricAnchorField, LyricFontSizeField, LyricPresentationControls } from '../components/LyricPresentationControls'
import { NumberInputRow, SelectRow } from '../../../components/vyzualz/react/ReactControlRows'
import { LyricCueJsonField } from './LyricCueJsonField'

export interface LyricSectionOption {
  id: string
  label: string
  type: LyricSectionType
  startSec?: number
  endSec?: number
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
  onUpdateWord: (cueId: string, wordId: string, patch: Partial<Omit<LyricWord, 'id'>>) => void
  focusWordId?: string | null
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

/** Draft strings back to the number | '' shape NumberInputRow takes. */
function draftNumber(value: string): number | '' {
  const number = Number(value)
  return value.trim() === '' || !Number.isFinite(number) ? '' : number
}

function parseFiniteInteger(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

function WordTimingEditor({
  cue,
  onUpdateCue,
  onUpdateWord,
  focusWordId,
}: {
  cue: LyricCue
  onUpdateCue: Props['onUpdateCue']
  onUpdateWord: Props['onUpdateWord']
  focusWordId?: string | null
}) {
  const words = cue.words ?? []
  const rootRef = useRef<HTMLDivElement>(null)
  const { invalidWords } = validateWordTiming(cue)
  const invalidIds = useMemo(() => new Set(invalidWords.map(word => word.id)), [invalidWords])

  const commitWords = (nextWords: LyricWord[]) => {
    const groups = retainLyricGroupsForWords(cue.groups, nextWords)
    onUpdateCue(cue.id, {
      words: nextWords.length ? nextWords : undefined,
      groups: groups?.length ? groups : undefined,
    })
  }

  useEffect(() => {
    if (!focusWordId) return
    const frame = requestAnimationFrame(() => {
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-word-id]') ?? [])
        .find(element => element.dataset.wordId === focusWordId)
      const behavior: ScrollBehavior = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth'
      row?.scrollIntoView?.({ block: 'nearest', behavior })
      row?.querySelector<HTMLInputElement>('input')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [focusWordId])

  if (!words.length) {
    return <div className="lyric-cue-inspector__empty-words">This cue has line timing only. Word timing is optional.</div>
  }

  return (
    <div ref={rootRef} className="lyric-word-editor">
      <div className="lyric-word-editor__header">
        <strong>Word timing</strong>
        {invalidWords.length > 0 && (
          <IconChipButton
            onClick={() => {
              // Drop the malformed timing, then route through canonical repair
              // so the word ends re-timed inside a valid cue rather than left
              // indefinitely untimed. Preserves lyric text and stays a single
              // undo entry.
              const cleared: LyricCue = {
                ...cue,
                words: words.map(word => invalidIds.has(word.id)
                  ? { ...word, startMs: undefined, endMs: undefined }
                  : word),
              }
              const repaired = normalizeLyricCueTiming([cleared]).cues[0] ?? cleared
              const nextWords = repaired.words ?? []
              const groups = retainLyricGroupsForWords(cue.groups, nextWords)
              onUpdateCue(cue.id, {
                words: nextWords.length ? nextWords : undefined,
                groups: groups?.length ? groups : undefined,
                startMs: repaired.startMs,
                endMs: repaired.endMs,
              })
            }}
          >
            Remove invalid timing
          </IconChipButton>
        )}
      </div>
      <div className="lyric-word-editor__rows">
        {words.map((word, index) => {
          const invalid = invalidIds.has(word.id)
          const lowConfidence = word.confidence !== undefined && word.confidence < LOW_LYRIC_CONFIDENCE
          return (
            <div
              key={word.id}
              data-word-id={word.id}
              className={`lyric-word-editor__row${invalid ? ' lyric-word-editor__row--invalid' : ''}${lowConfidence ? ' lyric-word-editor__row--low-confidence' : ''}${focusWordId === word.id ? ' lyric-word-editor__row--focused' : ''}`}
            >
              <span className="lyric-word-editor__index">{index + 1}</span>
              <DreamVizTextInput
                className="lmv-input"
                aria-label={`Word ${index + 1} text`}
                defaultValue={word.text}
                key={`${word.id}-text-${word.text}`}
                onBlur={event => onUpdateWord(cue.id, word.id, { text: event.target.value })}
              />
              <DreamVizTextInput
                className="lmv-num"
                type="number"
                step={1}
                aria-label={`Word ${index + 1} start milliseconds`}
                defaultValue={word.startMs ?? ''}
                key={`${word.id}-start-${word.startMs}`}
                onBlur={event => {
                  const value = parseFiniteInteger(event.target.value)
                  if (value !== null) onUpdateWord(cue.id, word.id, { startMs: value })
                }}
              />
              <DreamVizTextInput
                className="lmv-num"
                type="number"
                step={1}
                aria-label={`Word ${index + 1} end milliseconds`}
                defaultValue={word.endMs ?? ''}
                key={`${word.id}-end-${word.endMs}`}
                onBlur={event => {
                  const value = parseFiniteInteger(event.target.value)
                  if (value !== null) onUpdateWord(cue.id, word.id, { endMs: value })
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
  onUpdateWord,
  focusWordId = null,
}: Props) {
  const fieldId = useId()
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
      {issues.length > 0 && (
        <NoticeCard tone="warning" role="status" ariaLabel={`${issues.length} cue warnings`} title="Cue warnings">
          {issues.map((issue, index) => <div key={`${issue.code}-${issue.relatedCueId ?? issue.wordId ?? index}`}>{issue.message}</div>)}
        </NoticeCard>
      )}

      <div className="lyric-cue-inspector__grid">
        <div className="rv-ctrl-row lyric-cue-inspector__wide">
          <span className="rv-ctrl-label-cluster">
            <label className="rv-ctrl-label" htmlFor={`${fieldId}-text`}>Text</label>
          </span>
          <textarea
            id={`${fieldId}-text`}
            className="dv-text-input lmv-cue-textarea"
            rows={3}
            spellCheck={false}
            value={text}
            onChange={event => setText(event.target.value)}
            onBlur={() => onUpdateCue(cue.id, { text })}
          />
        </div>
        <NumberInputRow
          id={`${fieldId}-start`}
          label="Start time (ms)"
          min={0}
          step={1}
          value={draftNumber(start)}
          onChange={value => setStart(String(value))}
          onEmpty={() => setStart('')}
          onBlur={applyTiming}
          onKeyDown={event => event.key === 'Enter' && applyTiming()}
        />
        <NumberInputRow
          id={`${fieldId}-end`}
          label="End time (ms)"
          min={1}
          step={1}
          value={draftNumber(end)}
          onChange={value => setEnd(String(value))}
          onEmpty={() => setEnd('')}
          onBlur={applyTiming}
          onKeyDown={event => event.key === 'Enter' && applyTiming()}
        />
        <SelectRow
          id={`${fieldId}-section`}
          label="Section"
          value={cue.sectionId ?? ''}
          onChange={value => {
            const section = sections.find(item => item.id === value)
            onUpdateCue(cue.id, { sectionId: section?.id, sectionType: section?.type })
          }}
          options={[
            { value: '', label: 'No section' },
            ...sections.map(section => ({ value: section.id, label: `${section.label} (${section.type.replace(/_/g, ' ')})` })),
          ]}
          description={cue.sectionId && !selectedSection ? 'Stored section is not available in the current track analysis.' : undefined}
        />
        <SelectRow
          id={`${fieldId}-review`}
          label="Review state"
          value={cue.reviewStatus ?? ''}
          onChange={value => onUpdateCue(cue.id, { reviewStatus: value ? value as LyricReviewStatus : undefined })}
          options={[
            { value: '', label: 'Unspecified' },
            ...REVIEW_STATUSES.map(status => ({ value: status, label: status })),
          ]}
        />
        <LyricAnchorField label="Position" style={cue.style ?? {}} allowInherit onStyleChange={patch => onUpdateCue(cue.id, { style: { ...(cue.style ?? {}), ...patch } })} />
        <LyricFontSizeField label="Text size" style={cue.style ?? {}} allowInherit onStyleChange={patch => onUpdateCue(cue.id, { style: { ...(cue.style ?? {}), ...patch } })} />
        <NumberInputRow
          id={`${fieldId}-duration`}
          label="Duration (ms)"
          min={1}
          step={1}
          value={draftNumber(duration)}
          onChange={value => setDuration(String(value))}
          onEmpty={() => setDuration('')}
          onBlur={applyDuration}
          onKeyDown={event => event.key === 'Enter' && applyDuration()}
        />
        <NumberInputRow
          id={`${fieldId}-confidence`}
          label="Confidence (0–1)"
          min={0}
          max={1}
          step={0.01}
          value={draftNumber(confidence)}
          onChange={value => setConfidence(String(value))}
          onEmpty={() => setConfidence('')}
          onBlur={applyConfidence}
          onKeyDown={event => event.key === 'Enter' && applyConfidence()}
        />
      </div>

      <div className="lyric-cue-inspector__actions" role="group" aria-label="Cue timing actions">
        <IconChipButton disabled={currentTimeMs === null} onClick={actions.setStartToPlayhead}>Set start to playhead</IconChipButton>
        <IconChipButton disabled={currentTimeMs === null} onClick={actions.setEndToPlayhead}>Set end to playhead</IconChipButton>
        <IconChipButton disabled={currentTimeMs === null} onClick={actions.moveToPlayhead}>Move to playhead</IconChipButton>
        <IconChipButton disabled={currentTimeMs === null} onClick={actions.addAtPlayhead}>Add at playhead</IconChipButton>
        <IconChipButton onClick={actions.duplicate}>Duplicate</IconChipButton>
        <IconChipButton disabled={currentTimeMs === null || currentTimeMs <= cue.startMs || currentTimeMs >= cue.endMs} onClick={actions.split}>Split at playhead</IconChipButton>
        <IconChipButton disabled={!canMergePrevious} onClick={actions.mergePrevious}>Merge previous</IconChipButton>
        <IconChipButton disabled={!canMergeNext} onClick={actions.mergeNext}>Merge next</IconChipButton>
        <IconChipButton className="lyric-cue-inspector__delete" onClick={actions.delete}>Delete cue</IconChipButton>
      </div>

      <DualRailCollapsible
        className="lyric-cue-inspector__presentation"
        defaultOpen
        label="Appearance overrides"
      >
        <p>Only fields set here override the document defaults. Other renderer metadata is preserved.</p>
        <LyricPresentationControls
          style={cue.style ?? {}}
          animation={cue.animation ?? {}}
          effects={cue.effects ?? {}}
          allowInherit
          omit={['anchor', 'fontSize']}
          onStyleChange={patch => onUpdateCue(cue.id, { style: { ...(cue.style ?? {}), ...patch } })}
          onAnimationChange={patch => onUpdateCue(cue.id, { animation: { ...(cue.animation ?? {}), ...patch } })}
          onEffectsChange={patch => onUpdateCue(cue.id, { effects: { ...(cue.effects ?? {}), ...patch } })}
          onClearStyle={() => onUpdateCue(cue.id, { style: undefined })}
          onClearAnimation={() => onUpdateCue(cue.id, { animation: undefined })}
          onClearEffects={() => onUpdateCue(cue.id, { effects: undefined })}
        />
      </DualRailCollapsible>

      <DualRailCollapsible
        className="lyric-cue-inspector__metadata"
        defaultOpen={false}
        label="Advanced"
      >
        <SelectRow
          id={`${fieldId}-source`}
          label="Source"
          value={cue.source ?? ''}
          onChange={value => onUpdateCue(cue.id, { source: value ? value as LyricSource : undefined })}
          options={[
            { value: '', label: 'Unspecified' },
            ...SOURCES.map(source => ({ value: source, label: source.replace(/_/g, ' ') })),
          ]}
        />

        <fieldset className="lyric-cue-inspector__warnings">
          <legend>Warnings</legend>
          {WARNINGS.map(warning => (
            <label key={warning}>
              <IconMorphCheckbox
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
        <p>Use the JSON fields only for uncommon renderer fields or troubleshooting. Unknown fields are preserved.</p>
        <LyricCueJsonField label="Style JSON" value={cue.style} onCommit={value => onUpdateCue(cue.id, { style: value as Partial<LyricStyle> })} />
        <LyricCueJsonField label="Animation JSON" value={cue.animation} onCommit={value => onUpdateCue(cue.id, { animation: value as Partial<LyricAnimation> })} />
        <LyricCueJsonField label="Effects JSON" value={cue.effects} onCommit={value => onUpdateCue(cue.id, { effects: value as Partial<LyricEffects> })} />
        <LyricCueJsonField label="Analysis metadata JSON" value={cue.analysisMetadata} onCommit={value => onUpdateCue(cue.id, { analysisMetadata: value })} />
      </DualRailCollapsible>

      <WordTimingEditor cue={cue} onUpdateCue={onUpdateCue} onUpdateWord={onUpdateWord} focusWordId={focusWordId} />
    </section>
  )
}

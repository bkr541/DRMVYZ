import { useEffect, useMemo, useRef } from 'react'
import { matchesCueSearch } from '../utils/cueListSearch'
import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import { LOW_LYRIC_CONFIDENCE, normalizeLyricCueTiming, retainLyricGroupsForWords, validateWordTiming } from './lyricCueEditorModel'

function parseFiniteInteger(value: string): number | null {
  if (!value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number) : null
}

/** Word edits use the canonical cue callbacks, preserving history and group membership. */
export function LyricWordTimingEditor({
  cue,
  onUpdateCue,
  onUpdateWord,
  focusWordId,
  focusRevision,
  search = '',
}: {
  cue: LyricCue
  onUpdateCue: (cueId: string, patch: Partial<Omit<LyricCue, 'id'>>) => void
  onUpdateWord: (cueId: string, wordId: string, patch: Partial<Omit<LyricWord, 'id'>>) => void
  focusWordId?: string | null
  search?: string
  focusRevision?: number
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
  }, [cue.id, focusWordId, focusRevision])

  if (!words.length) {
    return <div className="lyric-cue-inspector__empty-words">This cue has line timing only. Word timing is optional.</div>
  }

  return (
    <div ref={rootRef} className="lyric-word-editor">
      {invalidWords.length > 0 && (
        <div className="rv-ctrl-action-row">
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
        </div>
      )}
      <div className="lyric-word-editor__head" aria-hidden="true">
        <span>#</span><span>Word</span><span>Start (ms)</span><span>End (ms)</span><span>Conf.</span><span />
      </div>
      <div className="lyric-word-editor__rows">
        {words.map((word, index) => {
          const invalid = invalidIds.has(word.id)
          const lowConfidence = word.confidence !== undefined && word.confidence < LOW_LYRIC_CONFIDENCE
          return (
            <div
              key={word.id}
              data-word-id={word.id}
                data-search-match={matchesCueSearch(word.text, search) || undefined}
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
              ><AppIcon kind="close" size={14} /></button>
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


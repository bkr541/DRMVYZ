import { Fragment, useEffect, useState, type KeyboardEvent } from 'react'
import { DreamVizTextInput } from '../../../components/vyzualz/react/controls/DreamVizTextInput'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { UnderlineDropdown } from '../../../components/vyzualz/react/controls/UnderlineDropdown'
import { highlightCueSearch, matchesCueSearch } from '../utils/cueListSearch'
import { isKeyboardInputTarget } from '../../../utils/keyboardTargets'
import { isCueActive, LOW_LYRIC_CONFIDENCE } from '../editor/lyricCueEditorModel'
import { LyricCueTimeline } from '../editor/LyricCueTimeline'
import { LyricWordTimingEditor } from '../editor/LyricWordTimingEditor'
import { formatMs, type LyricCueFilter, type useLyricCueEditor } from '../editor/useLyricCueEditor'

type Editor = ReturnType<typeof useLyricCueEditor>

interface Props {
  editor: Editor
}

interface TimelineProps {
  editor: Editor
  durationMs: number
  currentTimeMs: number | null
  onSeek: (timeMs: number) => void
}

/** Two lyric lanes are always visible; a third appears only while cues overlap three deep (see LyricCueTimeline). */
const MAX_LYRIC_CUES_LANES = 3

/** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y redo. Ignored while typing in a field. */
export function handleLyricUndoRedoKey(
  event: KeyboardEvent,
  editor: Pick<Editor, 'undoCueEdit' | 'redoCueEdit'>,
): void {
  if (isKeyboardInputTarget(event.target)) return
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'y' && !event.shiftKey) {
    event.preventDefault()
    editor.redoCueEdit()
    return
  }
  if (key !== 'z') return
  event.preventDefault()
  if (event.shiftKey) editor.redoCueEdit()
  else editor.undoCueEdit()
}

export function LyricCueStackedTimeline({ editor, durationMs, currentTimeMs, onSeek }: TimelineProps) {
  return (
    <LyricCueTimeline
      cues={editor.orderedCues}
      selectedCueId={editor.selectedCueId}
      currentTimeMs={currentTimeMs}
      getCurrentTimeMs={editor.getCurrentTimeMs}
      durationMs={durationMs}
      zoom={editor.waveformZoom}
      snapContext={editor.snapContext}
      maxVisibleLanes={MAX_LYRIC_CUES_LANES}
      showRuler={false}
      showWaveform={false}
      showOverlays={false}
      showWordLane={false}
      showPlayhead={false}
      stackedLanes
      inactiveCueIds={editor.inactiveCueIds}
      onSelectCue={editor.selectCue}
      onSeek={onSeek}
      onAddCueAt={editor.addAtTimelineTime}
      onCommitCue={editor.commitCuePatch}
      onCommitWords={editor.commitWords}
      onCueContextAction={editor.handleCueContextAction}
      onDeleteCue={cueId => editor.handleCueContextAction(cueId, 'delete', 0)}
    />
  )
}

/**
 * "Cue list" window: the filterable table of every cue. The timeline itself and
 * its controls live in the Track Timeline window (LyricCueStackedTimeline +
 * LyricTimelineToolbar). The table only carries the columns needed to scan and
 * select cues — # / Time / Lyric / Status — so it fits the center column at any
 * width. Selecting a cue reveals cue/word timing, word text and deletion in
 * the list; presentation and metadata remain in the right inspector.
 */
export function LyricCuesWindow({ editor }: Props) {
  const {
    rootRef,
    cues,
    orderedCues,
    selectedCueId,
    canonicalPlayheadMs,
    selectCue,
    filter,
    setFilter,
    filteredCues,
    cueIssues,
    navigationTarget,
  } = editor
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [collapsedCueId, setCollapsedCueId] = useState<string | null>(null)
  const toggleCue = (id: string) => {
    setCollapsedCueId(selectedCueId === id && collapsedCueId !== id ? id : null)
    selectCue(id)
  }
  const firstMatchId = search.trim() ? filteredCues.find(cue => {
    const warningCount = (cueIssues.get(cue.id)?.length ?? 0) + (cue.warnings?.length ?? 0)
    const values = [
      cue.text || 'Empty',
      ...(cue.words ?? []).map(word => word.text),
      cue.reviewStatus ?? 'unreviewed',
      formatMs(cue.startMs),
      formatMs(cue.endMs),
      String(orderedCues.findIndex(item => item.id === cue.id) + 1),
      warningCount || '',
    ]
    return matchesCueSearch(values.join(' '), search)
  })?.id : undefined
  useEffect(() => {
    if (!firstMatchId || !open) return
    const frame = requestAnimationFrame(() => {
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-cue-row-id]') ?? [])
        .find(node => node.dataset.cueRowId === firstMatchId)
      row?.scrollIntoView?.({ block: 'center', behavior: 'auto' })
    })
    return () => cancelAnimationFrame(frame)
  }, [search, firstMatchId, open, rootRef])
  useEffect(() => { if (navigationTarget) { setOpen(true); setCollapsedCueId(null) } }, [navigationTarget])

  // Wait until the destination is selected, unfiltered and expanded before focusing.
  useEffect(() => {
    if (!open || !navigationTarget || selectedCueId !== navigationTarget.cueId) return
    const frame = requestAnimationFrame(() => {
      const row = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-cue-row-id]') ?? [])
        .find(node => node.dataset.cueRowId === navigationTarget.cueId)
      const behavior: ScrollBehavior = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      row?.scrollIntoView?.({ block: 'center', behavior })
      if (!navigationTarget.wordId) row?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, navigationTarget, selectedCueId, filter, rootRef])

  return (
    <section
      ref={rootRef}
      className="lmv-lyric-cues-window"
      aria-label="Lyric Cues"
      onKeyDown={event => handleLyricUndoRedoKey(event, editor)}
    >
      <DualRailCollapsible label="Cue list" open={open} onOpenChange={setOpen} headerClassName="lmv-live-preview-header" bodyClassName="lyric-cue-list-body">
        <section className="lyric-cue-list" aria-label="Lyric cue list">
          <div className="lyric-cue-list__controls">
            <strong>{filteredCues.length} of {cues.length} cues</strong>
            <div className="lyric-cue-list__search-filter">
              <DreamVizTextInput type="search" aria-label="Search cues" placeholder="Search cues" value={search} onChange={event => { setSearch(event.target.value); setOpen(true) }} />
              <UnderlineDropdown
                ariaLabel="Filter cues"
                menuLabel="Filter cues"
                className="lyric-cue-list__filter"
                value={filter}
                onChange={value => setFilter(value as LyricCueFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'unreviewed', label: 'Unreviewed' },
                  { value: 'low-confidence', label: 'Low confidence' },
                  { value: 'warnings', label: 'Warnings' },
                  { value: 'empty-text', label: 'Empty text' },
                ]}
              />
            </div>
          </div>
          {search.trim() && !firstMatchId && <div className="lyric-cue-list__empty" role="status">No cues match this search.</div>}
          <div className="lyric-cue-list__scroll">
            <table className="lyric-cue-list__table">
              <thead>
                <tr><th>#</th><th>Time</th><th>Lyric</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredCues.map(cue => {
                  const index = orderedCues.findIndex(item => item.id === cue.id)
                  const issues = cueIssues.get(cue.id) ?? []
                  const warningCount = issues.length + (cue.warnings?.length ?? 0)
                  const active = canonicalPlayheadMs !== null && isCueActive(cue, canonicalPlayheadMs)
                  const lowConfidence = cue.confidence !== undefined && cue.confidence < LOW_LYRIC_CONFIDENCE
                  const detail = [
                    `${cue.endMs - cue.startMs} ms`,
                    cue.confidence === undefined ? null : `confidence ${Math.round(cue.confidence * 100)}%`,
                    warningCount ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : null,
                  ].filter(Boolean).join(' · ')
                  return (
                    <Fragment key={cue.id}>
                    <tr
                      tabIndex={0}
                      data-cue-row-id={cue.id}
                      title={detail}
                      className={`${selectedCueId === cue.id ? 'lyric-cue-list__row--selected' : ''}${active ? ' lyric-cue-list__row--active' : ''}`}
                      aria-selected={selectedCueId === cue.id}
                      aria-expanded={selectedCueId === cue.id && collapsedCueId !== cue.id}
                      aria-current={active ? 'time' : undefined}
                      onClick={() => toggleCue(cue.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          toggleCue(cue.id)
                        }
                      }}
                    >
                      <td>{highlightCueSearch(String(index + 1), search)}</td>
                      <td className="lyric-cue-list__time">{highlightCueSearch(`${formatMs(cue.startMs)} – ${formatMs(cue.endMs)}`, search)}</td>
                      <td className="lyric-cue-list__text">{highlightCueSearch(cue.text || 'Empty', search)}</td>
                      <td className="lyric-cue-list__status">
                        <div className="lyric-cue-list__status-content">
                          <span className={`lyric-cue-list__status-dot lyric-cue-list__status-dot--${cue.reviewStatus ?? 'unreviewed'}`} aria-hidden="true" />
                          <span className={lowConfidence ? 'lyric-cue-list__low-confidence' : ''}>{highlightCueSearch(cue.reviewStatus ?? 'unreviewed', search)}</span>
                          {warningCount > 0 && <span className="lyric-cue-list__warning-count" aria-label={`${warningCount} cue warnings`}>{warningCount}</span>}
                        </div>
                      </td>
                    </tr>
                    {selectedCueId === cue.id && collapsedCueId !== cue.id && (
                      <tr className="lyric-cue-list__editor-row">
                        <td colSpan={4}>
                          <section className="lyric-cue-list__editor" aria-label={`Edit cue ${index + 1}`}>
                            <div className="lyric-cue-list__editor-toolbar">
                              <strong>Cue {index + 1}</strong>

                            </div>
                            <div className="lyric-cue-list__timing-fields">
                              {(['startMs', 'endMs'] as const).map(field => (
                                <label key={field} className="rv-ctrl-row">
                                  <span>{field === 'startMs' ? 'Start' : 'End'} (ms)</span>
                                  <DreamVizTextInput
                                    key={`${cue.id}-${field}-${cue[field]}`}
                                    type="number"
                                    step={1}
                                    defaultValue={cue[field]}
                                    aria-label={`Cue ${index + 1} ${field === 'startMs' ? 'start' : 'end'} milliseconds`}
                                    onBlur={event => {
                                      const raw = event.target.value.trim(), value = Number(raw)
                                      if (raw && Number.isFinite(value)) editor.commitCuePatch(cue.id, { [field]: Math.round(value) })
                                    }}
                                  />
                                </label>
                              ))}
                            </div>
                            <LyricWordTimingEditor
                              cue={cue}
                              search={search}
                              onUpdateCue={editor.commitCuePatch}
                              onUpdateWord={editor.updateCueWord}
                              focusWordId={navigationTarget?.cueId === cue.id ? navigationTarget.wordId : null}
                              focusRevision={navigationTarget?.revision}
                            />
                          </section>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {filteredCues.length === 0 && <div className="lyric-cue-list__empty">No cues match this filter.</div>}
          </div>
        </section>
      </DualRailCollapsible>
    </section>
  )
}

import type { KeyboardEvent } from 'react'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { DropdownSelect } from '../../../components/shared/Dropdown/Dropdown'
import { isKeyboardInputTarget } from '../../../utils/keyboardTargets'
import { isCueActive, LOW_LYRIC_CONFIDENCE } from '../editor/lyricCueEditorModel'
import { LyricCueTimeline } from '../editor/LyricCueTimeline'
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

/** Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z for the cue editor, ignored while typing in a field. */
export function handleLyricUndoRedoKey(
  event: KeyboardEvent,
  editor: Pick<Editor, 'undoCueEdit' | 'redoCueEdit'>,
): void {
  if (isKeyboardInputTarget(event.target)) return
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
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
 * width; the remaining detail (duration, confidence, warning count) is in each
 * row's tooltip, and everything is editable in the Cue inspector.
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
  } = editor

  return (
    <section
      ref={rootRef}
      className="lmv-lyric-cues-window"
      aria-label="Lyric Cues"
      onKeyDown={event => handleLyricUndoRedoKey(event, editor)}
    >
      <DualRailCollapsible label="Cue list" defaultOpen={false} headerClassName="lmv-live-preview-header" bodyClassName="lyric-cue-list-body">
        <section className="lyric-cue-list" aria-label="Lyric cue list">
          <div className="lyric-cue-list__controls">
            <strong>{filteredCues.length} of {cues.length} cues</strong>
            <label>
              <span>Filter</span>
              <DropdownSelect className="lmv-select" value={filter} onChange={event => setFilter(event.target.value as LyricCueFilter)}>
                <option value="all">All</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="low-confidence">Low confidence</option>
                <option value="warnings">Warnings</option>
                <option value="empty-text">Empty text</option>
              </DropdownSelect>
            </label>
          </div>
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
                    <tr
                      key={cue.id}
                      tabIndex={0}
                      data-cue-row-id={cue.id}
                      title={detail}
                      className={`${selectedCueId === cue.id ? 'lyric-cue-list__row--selected' : ''}${active ? ' lyric-cue-list__row--active' : ''}`}
                      aria-selected={selectedCueId === cue.id}
                      aria-current={active ? 'time' : undefined}
                      onClick={() => selectCue(cue.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          selectCue(cue.id)
                        }
                      }}
                    >
                      <td>{index + 1}</td>
                      <td className="lyric-cue-list__time">{formatMs(cue.startMs)} – {formatMs(cue.endMs)}</td>
                      <td className="lyric-cue-list__text">{cue.text || <em>Empty</em>}</td>
                      <td className="lyric-cue-list__status">
                        <span className={lowConfidence ? 'lyric-cue-list__low-confidence' : ''}>{cue.reviewStatus ?? 'unreviewed'}</span>
                        {warningCount > 0 && <span aria-label="Cue has warnings"> ⚠ {warningCount}</span>}
                      </td>
                    </tr>
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

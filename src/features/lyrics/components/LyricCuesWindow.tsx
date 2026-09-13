import { BubbleRevealSlider } from '../../../components/vyzualz/react/controls/BubbleRevealSlider'
import { IconMorphCheckbox } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { DropdownSelect } from '../../../components/shared/Dropdown/Dropdown'
import { isKeyboardInputTarget } from '../../../utils/keyboardTargets'
import { canUseSnapMode, isCueActive, LOW_LYRIC_CONFIDENCE, type LyricSnapMode } from '../editor/lyricCueEditorModel'
import { LyricCueTimeline } from '../editor/LyricCueTimeline'
import { formatMs, type LyricCueFilter, type useLyricCueEditor } from '../editor/useLyricCueEditor'
import type { TimelineOverlayVisibility } from '../../timeline/timelineOverlays'

type Editor = ReturnType<typeof useLyricCueEditor>

interface Props {
  editor: Editor
  durationMs: number
  currentTimeMs: number | null
  onSeek: (timeMs: number) => void
}

const MAX_LYRIC_CUES_LANES = 3

/**
 * "Lyric Cues" window: the always-visible, fully-editable cue timeline that
 * replaces the old tab-buried LyricCueEditor. Wraps LyricCueTimeline (capped
 * at 3 lanes via its new additive `maxVisibleLanes` prop, with ruler/
 * waveform/overlays/word-lane switched off since Track Timeline above
 * already shows those) plus the toolbar and filterable cue list relocated
 * here verbatim from the old editor, so undo/redo and cue browsing aren't
 * lost.
 */
export function LyricCuesWindow({ editor, durationMs, currentTimeMs, onSeek }: Props) {
  const {
    rootRef,
    cues,
    orderedCues,
    selectedCueId,
    canonicalPlayheadMs,
    getCurrentTimeMs,
    cueHistoryPast,
    cueHistoryFuture,
    undoCueEdit,
    redoCueEdit,
    selectCue,
    snapMode,
    setSnapMode,
    snapContext,
    overlaySource,
    overlayVisibility,
    setOverlayVisibility,
    filter,
    setFilter,
    filteredCues,
    inactiveCueIds,
    cueIssues,
    waveformZoom,
    setWaveformZoom,
    commitCuePatch,
    commitWords,
    addAtPlayhead,
    addAtTimelineTime,
    handleCueContextAction,
    beatGridHint,
    beatGridMs,
    wordBoundaryMs,
  } = editor

  return (
    <section
      ref={rootRef}
      className="lmv-lyric-cues-window"
      aria-label="Lyric Cues"
      onKeyDown={event => {
        if (isKeyboardInputTarget(event.target)) return
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
        event.preventDefault()
        if (event.shiftKey) redoCueEdit()
        else undoCueEdit()
      }}
    >
      <DualRailCollapsible label="Lyric Cues" headerClassName="lmv-live-preview-header">
        <div className="lyric-cue-editor-toolbar lmv-lyric-cues-toolbar">
          <IconChipButton onClick={addAtPlayhead}>+ Add cue at playhead</IconChipButton>
          <IconChipButton disabled={cueHistoryPast.length === 0} onClick={undoCueEdit} aria-label="Undo lyric edit">Undo</IconChipButton>
          <IconChipButton disabled={cueHistoryFuture.length === 0} onClick={redoCueEdit} aria-label="Redo lyric edit">Redo</IconChipButton>
          <label>
            <span>Snap</span>
            <DropdownSelect className="lmv-select" value={snapMode} onChange={event => setSnapMode(event.target.value as LyricSnapMode)}>
              <option value="none">No snap</option>
              <option value="millisecond">10 ms grid</option>
              <option value="frame">30 fps frames</option>
              <option value="beat" disabled={!canUseSnapMode('beat', { beatGridMs })}>Beat</option>
              <option value="half-beat" disabled={!canUseSnapMode('half-beat', { beatGridMs })}>Half beat</option>
              <option value="quarter-beat" disabled={!canUseSnapMode('quarter-beat', { beatGridMs })}>Quarter beat</option>
              <option value="word" disabled={!canUseSnapMode('word', { wordBoundaryMs })}>Word boundary</option>
            </DropdownSelect>
          </label>
          <label className="lyric-cue-editor-toolbar__zoom">
            <span>Zoom {waveformZoom.toFixed(2)}×</span>
            <BubbleRevealSlider type="range" min={1} max={16} step={1} value={waveformZoom} onChange={event => setWaveformZoom(Number(event.target.value))} aria-label="Shared waveform zoom" />
          </label>
          <DualRailCollapsible
            className="lyric-cue-editor-overlays"
            defaultOpen={false}
            headerClassName="lyric-cue-editor-overlays-trigger"
            bodyClassName="lyric-cue-editor-overlays-panel"
            label="Overlays"
          >
            {(Object.keys(overlayVisibility) as Array<keyof TimelineOverlayVisibility>).map(key => (
              <label key={key}>
                <IconMorphCheckbox
                  checked={overlayVisibility[key]}
                  onChange={event => setOverlayVisibility(current => ({ ...current, [key]: event.target.checked }))}
                />
                <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              </label>
            ))}
          </DualRailCollapsible>
          <span className={`lyric-cue-editor-toolbar__authority${overlaySource.authoritative ? ' lyric-cue-editor-toolbar__authority--trusted' : ''}`}>
            {overlaySource.authoritative ? 'Track Map overlays' : 'Fallback timeline'}
          </span>
          {beatGridHint && (
            <span className="lyric-cue-editor-toolbar__hint">{beatGridHint}</span>
          )}
        </div>

        <LyricCueTimeline
          cues={orderedCues}
          selectedCueId={selectedCueId}
          currentTimeMs={currentTimeMs}
          getCurrentTimeMs={getCurrentTimeMs}
          durationMs={durationMs}
          zoom={waveformZoom}
          snapContext={snapContext}
          maxVisibleLanes={MAX_LYRIC_CUES_LANES}
          showRuler={false}
          showWaveform={false}
          showOverlays={false}
          showWordLane={false}
          inactiveCueIds={inactiveCueIds}
          onSelectCue={selectCue}
          onSeek={onSeek}
          onAddCueAt={addAtTimelineTime}
          onCommitCue={commitCuePatch}
          onCommitWords={commitWords}
          onCueContextAction={handleCueContextAction}
          onDeleteCue={cueId => handleCueContextAction(cueId, 'delete', 0)}
        />

        <DualRailCollapsible label="Cue list" defaultOpen={false} bodyClassName="lyric-cue-list-body">
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
              <table>
                <thead>
                  <tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Text</th><th>Confidence</th><th>Review</th><th>Warnings</th></tr>
                </thead>
                <tbody>
                  {filteredCues.map(cue => {
                    const index = orderedCues.findIndex(item => item.id === cue.id)
                    const issues = cueIssues.get(cue.id) ?? []
                    const active = canonicalPlayheadMs !== null && isCueActive(cue, canonicalPlayheadMs)
                    return (
                      <tr
                        key={cue.id}
                        tabIndex={0}
                        data-cue-row-id={cue.id}
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
                        <td>{formatMs(cue.startMs)}</td>
                        <td>{formatMs(cue.endMs)}</td>
                        <td>{cue.endMs - cue.startMs} ms</td>
                        <td>{cue.text || <em>Empty</em>}</td>
                        <td className={cue.confidence !== undefined && cue.confidence < LOW_LYRIC_CONFIDENCE ? 'lyric-cue-list__low-confidence' : ''}>{cue.confidence === undefined ? '—' : `${Math.round(cue.confidence * 100)}%`}</td>
                        <td>{cue.reviewStatus ?? 'unreviewed'}</td>
                        <td>{issues.length || cue.warnings?.length ? <span aria-label="Cue has warnings">⚠ {issues.length + (cue.warnings?.length ?? 0)}</span> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredCues.length === 0 && <div className="lyric-cue-list__empty">No cues match this filter.</div>}
            </div>
          </section>
        </DualRailCollapsible>
      </DualRailCollapsible>
    </section>
  )
}

import {
  Add01Icon,
  AlignLeftIcon,
  AlignRightIcon,
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Copy01Icon,
  Delete02Icon,
  MoveIcon,
  Redo02Icon,
  Scissor01Icon,
  Undo02Icon,
} from 'hugeicons-react'
import { BubbleRevealSlider } from '../../../components/vyzualz/react/controls/BubbleRevealSlider'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import type { useLyricCueEditor } from '../editor/useLyricCueEditor'
import { formatDuration } from '../utils/lyricManagerFormat'

type Editor = ReturnType<typeof useLyricCueEditor>

interface Props {
  editor: Editor
  selectedTrackLoaded: boolean
  selectedTrackPlaying: boolean
  currentTimeMs: number | null
  durationMs: number
  volume: number
  onTogglePlayback: () => void
  onVolumeChange: (volume: number) => void
  /** Seeks the deck (milliseconds); the track scrubber drives it. */
  onSeek: (timeMs: number) => void
}

/** All cue-editing commands live together in one icon-only row beneath the Track Timeline heading. */
export function LyricTimelineEditActions({ editor, analyze }: {
  editor: Editor
  /** Present only while the track has no trusted beat grid: loads the track if needed and analyses it. Shown last, after Delete. */
  analyze?: { label: string; onClick: () => void } | null
}) {
  const cue = editor.selectedCue
  const actions = editor.actions
  const playheadUnavailable = editor.canonicalPlayheadMs === null
  const actionButtons = [
    {
      label: 'Set start to playhead',
      icon: <AlignLeftIcon size={14} color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.setStartToPlayhead,
    },
    {
      label: 'Set end to playhead',
      icon: <AlignRightIcon size={14} color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.setEndToPlayhead,
    },
    {
      label: 'Move to playhead',
      icon: <MoveIcon size={14} color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.moveToPlayhead,
    },
    {
      label: 'Duplicate cue',
      icon: <Copy01Icon size={14} color="currentColor" />,
      disabled: !actions,
      onClick: actions?.duplicate,
    },
    {
      label: 'Split at playhead',
      icon: <Scissor01Icon size={14} color="currentColor" />,
      disabled: !actions || playheadUnavailable || !cue || editor.canonicalPlayheadMs! <= cue.startMs || editor.canonicalPlayheadMs! >= cue.endMs,
      onClick: actions?.split,
    },
    {
      label: 'Merge previous cue',
      icon: <ArrowLeft01Icon size={14} color="currentColor" />,
      disabled: !actions || editor.selectedIndex <= 0,
      onClick: actions?.mergePrevious,
    },
    {
      label: 'Merge next cue',
      icon: <ArrowRight01Icon size={14} color="currentColor" />,
      disabled: !actions || editor.selectedIndex < 0 || editor.selectedIndex >= editor.orderedCues.length - 1,
      onClick: actions?.mergeNext,
    },
    {
      label: 'Delete cue',
      icon: <Delete02Icon size={14} color="currentColor" />,
      disabled: !actions,
      onClick: actions?.delete,
      danger: true,
    },
  ]

  return (
    <div className="lmv-timeline-edit-actions" role="toolbar" aria-label="Cue editing">
      <IconChipButton
        className="lmv-icon-only-chip"
        icon={<Add01Icon size={14} color="currentColor" />}
        title="Add cue at playhead"
        aria-label="Add cue"
        onClick={editor.addAtPlayhead}
      />
      <IconChipButton
        className="lmv-icon-only-chip"
        icon={<Undo02Icon size={14} color="currentColor" />}
        title="Undo lyric edit"
        aria-label="Undo lyric edit"
        disabled={editor.cueHistoryPast.length === 0}
        onClick={editor.undoCueEdit}
      />
      <IconChipButton
        className="lmv-icon-only-chip"
        icon={<Redo02Icon size={14} color="currentColor" />}
        title="Redo lyric edit"
        aria-label="Redo lyric edit"
        disabled={editor.cueHistoryFuture.length === 0}
        onClick={editor.redoCueEdit}
      />
      {actionButtons.map(action => (
        <IconChipButton
          key={action.label}
          className={`lmv-icon-only-chip${action.danger ? ' dv-icon-chip--danger' : ''}`}
          icon={action.icon}
          title={action.label}
          aria-label={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
        />
      ))}
      {analyze && (
        <IconChipButton
          className="lmv-icon-only-chip lmv-analyze-chip"
          icon={<Analytics01Icon size={14} color="currentColor" />}
          title={analyze.label}
          aria-label={analyze.label}
          onClick={analyze.onClick}
        />
      )}
    </div>
  )
}

/**
 * The row beneath the lanes ("Quiet Row", Layout Lab · Template): play, the track scrubber with the elapsed time on its left and the track's length on
 * its right, then zoom and volume together at the right end. No container; one hairline above and shared spacing hold it together.
 */
export function LyricTimelineToolbar({
  editor,
  selectedTrackLoaded,
  selectedTrackPlaying,
  currentTimeMs,
  durationMs,
  volume,
  onTogglePlayback,
  onVolumeChange,
  onSeek,
}: Props) {
  const { waveformZoom, setWaveformZoom } = editor
  const safeDuration = Math.max(0, durationMs)
  const safeCurrent = Math.min(safeDuration || Number.MAX_SAFE_INTEGER, Math.max(0, currentTimeMs ?? 0))
  const elapsed = formatDuration(Math.floor(safeCurrent / 1000))

  return (
    <div className="lltr-bar lltr-bar--quiet" role="toolbar" aria-label="Timeline controls">
      <button
        className="lmv-transport-icon lltr-play"
        type="button"
        disabled={!selectedTrackLoaded}
        onClick={onTogglePlayback}
        aria-label={selectedTrackPlaying ? 'Pause lyric preview' : 'Play lyric preview'}
      >
        {selectedTrackPlaying ? 'Ⅱ' : '▶'}
      </button>

      <label className="lltr-scrubber" aria-label="Playback position">
        <span className="lltr-stamp lltr-stamp--elapsed">{elapsed}</span>
        <BubbleRevealSlider
          type="range"
          min={0}
          max={Math.max(1, safeDuration / 1000)}
          step={0.01}
          value={safeCurrent / 1000}
          bubbleLabel={elapsed}
          disabled={!selectedTrackLoaded || safeDuration <= 0}
          aria-label="Track position"
          onChange={event => onSeek(Math.round(Number(event.target.value) * 1000))}
        />
        <span className="lltr-stamp lltr-stamp--total">{formatDuration(safeDuration / 1000)}</span>
      </label>

      <div className="lltr-levels">
        <label className="lltr-field lltr-field--zoom">
          <span className="lltr-label">Zoom <b>{waveformZoom.toFixed(2)}×</b></span>
          <BubbleRevealSlider type="range" min={1} max={16} step={1} value={waveformZoom} onChange={event => setWaveformZoom(Number(event.target.value))} aria-label="Shared waveform zoom" />
        </label>

        <label className="lltr-field lltr-field--volume">
          <span className="lltr-label lltr-label--icon" aria-hidden="true">♬</span>
          <BubbleRevealSlider
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={Number.isFinite(volume) ? volume : 0.8}
            onChange={event => onVolumeChange(Number(event.target.value))}
            aria-label="Preview volume"
          />
          <b className="lltr-value">{Math.round((Number.isFinite(volume) ? volume : 0.8) * 100)}</b>
        </label>
      </div>
    </div>
  )
}

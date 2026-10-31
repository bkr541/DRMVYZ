import { AppIcon } from '../../../components/shared/icons/AppIcon'
import { LyricHeaderIcon } from './LyricHeaderIcon'

import { BubbleRevealSlider } from '../../../components/vyzualz/react/controls/BubbleRevealSlider'
import { HeaderIconKey } from '../../../components/vyzualz/layout/HeaderIconKey'
import type { useLyricCueEditor } from '../editor/useLyricCueEditor'
import { formatDuration } from '../utils/lyricManagerFormat'

type Editor = ReturnType<typeof useLyricCueEditor>

interface Props {
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

/** All cue-editing commands live together in the top page header. */
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
      icon: <LyricHeaderIcon kind="alignStart" color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.setStartToPlayhead,
    },
    {
      label: 'Set end to playhead',
      icon: <LyricHeaderIcon kind="alignEnd" color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.setEndToPlayhead,
    },
    {
      label: 'Move to playhead',
      icon: <LyricHeaderIcon kind="move" color="currentColor" />,
      disabled: !actions || playheadUnavailable,
      onClick: actions?.moveToPlayhead,
    },
    {
      label: 'Duplicate cue',
      icon: <LyricHeaderIcon kind="copy" color="currentColor" />,
      disabled: !actions,
      onClick: actions?.duplicate,
    },
    {
      label: 'Split at playhead',
      icon: <LyricHeaderIcon kind="scissors" color="currentColor" />,
      disabled: !actions || playheadUnavailable || !cue || editor.canonicalPlayheadMs! <= cue.startMs || editor.canonicalPlayheadMs! >= cue.endMs,
      onClick: actions?.split,
    },
    {
      label: 'Merge previous cue',
      icon: <LyricHeaderIcon kind="left" color="currentColor" />,
      disabled: !actions || editor.selectedIndex <= 0,
      onClick: actions?.mergePrevious,
    },
    {
      label: 'Merge next cue',
      icon: <LyricHeaderIcon kind="right" color="currentColor" />,
      disabled: !actions || editor.selectedIndex < 0 || editor.selectedIndex >= editor.orderedCues.length - 1,
      onClick: actions?.mergeNext,
    },
    {
      label: 'Delete cue',
      icon: <LyricHeaderIcon kind="delete" color="currentColor" />,
      disabled: !actions,
      onClick: actions?.delete,
      danger: true,
    },
  ]

  return (
    <>
      <HeaderIconKey
        icon={<LyricHeaderIcon kind="plus" color="currentColor" />}
        title="Add cue at playhead"
        label="Add cue"
        onClick={editor.addAtPlayhead}
      />
      <HeaderIconKey
        icon={<LyricHeaderIcon kind="undo" color="currentColor" />}
        title="Undo lyric edit"
        label="Undo lyric edit"
        disabled={editor.cueHistoryPast.length === 0}
        onClick={editor.undoCueEdit}
      />
      <HeaderIconKey
        icon={<LyricHeaderIcon kind="redo" color="currentColor" />}
        title="Redo lyric edit"
        label="Redo lyric edit"
        disabled={editor.cueHistoryFuture.length === 0}
        onClick={editor.redoCueEdit}
      />
      {actionButtons.map(action => (
        <HeaderIconKey
          key={action.label}
          danger={action.danger}
          icon={action.icon}
          title={action.label}
          label={action.label}
          disabled={action.disabled}
          onClick={() => action.onClick?.()}
        />
      ))}
      {analyze && (
        <HeaderIconKey
          icon={<LyricHeaderIcon kind="bars" color="currentColor" />}
          title={analyze.label}
          label={analyze.label}
          onClick={analyze.onClick}
        />
      )}
    </>
  )
}

/**
 * The audio controls ("Quiet Row", Layout Lab · Template), docked in the track strip: play, the track scrubber with the elapsed time on its left and
 * the track's length on its right, then volume at the right end. Zoom is not here: it belongs to the track timeline, where the mouse wheel over
 * the lanes zooms it.
 */
export function LyricTimelineToolbar({
  selectedTrackLoaded,
  selectedTrackPlaying,
  currentTimeMs,
  durationMs,
  volume,
  onTogglePlayback,
  onVolumeChange,
  onSeek,
}: Props) {
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
        {selectedTrackPlaying ? <AppIcon kind="pause" size={14} /> : <AppIcon kind="play" size={14} />}
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
        <label className="lltr-field lltr-field--volume">
          <span className="lltr-label lltr-label--icon" aria-hidden="true"><AppIcon kind="volume" size={14} /></span>
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

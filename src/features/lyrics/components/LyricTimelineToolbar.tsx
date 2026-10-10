import { Add01Icon, Redo02Icon, Undo02Icon } from 'hugeicons-react'
import { BubbleRevealSlider } from '../../../components/vyzualz/react/controls/BubbleRevealSlider'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import type { useLyricCueEditor } from '../editor/useLyricCueEditor'
import { formatDuration, formatMsClock } from '../utils/lyricManagerFormat'

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
}

/** Add cue / Undo / Redo: icon-only, right-aligned in their own row beneath the Track Timeline heading. */
export function LyricTimelineEditActions({ editor }: { editor: Pick<Editor, 'cueHistoryPast' | 'cueHistoryFuture' | 'undoCueEdit' | 'redoCueEdit' | 'addAtPlayhead'> }) {
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
    </div>
  )
}

/** Transport, time, zoom and volume — the controls beneath the lanes. */
export function LyricTimelineToolbar({
  editor,
  selectedTrackLoaded,
  selectedTrackPlaying,
  currentTimeMs,
  durationMs,
  volume,
  onTogglePlayback,
  onVolumeChange,
}: Props) {
  const { waveformZoom, setWaveformZoom } = editor
  const safeDuration = Math.max(0, durationMs)
  const safeCurrent = Math.min(safeDuration || Number.MAX_SAFE_INTEGER, Math.max(0, currentTimeMs ?? 0))

  return (
    <div className="lmv-timeline-toolbar" role="toolbar" aria-label="Timeline controls">
      <div className="lmv-timeline-toolbar__group">
        <button
          className="lmv-transport-icon"
          type="button"
          disabled={!selectedTrackLoaded}
          onClick={onTogglePlayback}
          aria-label={selectedTrackPlaying ? 'Pause lyric preview' : 'Play lyric preview'}
        >
          {selectedTrackPlaying ? 'Ⅱ' : '▶'}
        </button>
        <div className="lmv-transport-time" aria-label="Playback position">
          <strong>{formatMsClock(safeCurrent)}</strong>
          <span>/ {formatDuration(safeDuration / 1000)}</span>
        </div>
      </div>

      <label className="lmv-timeline-toolbar__field lmv-timeline-toolbar__field--zoom">
        <span>Zoom {waveformZoom.toFixed(2)}×</span>
        <BubbleRevealSlider type="range" min={1} max={16} step={1} value={waveformZoom} onChange={event => setWaveformZoom(Number(event.target.value))} aria-label="Shared waveform zoom" />
      </label>

      <label className="lmv-timeline-toolbar__field lmv-timeline-toolbar__field--volume">
        <span>♬</span>
        <BubbleRevealSlider
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={Number.isFinite(volume) ? volume : 0.8}
          onChange={event => onVolumeChange(Number(event.target.value))}
          aria-label="Preview volume"
        />
      </label>
    </div>
  )
}

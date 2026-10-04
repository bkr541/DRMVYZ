import { useRef } from 'react'
import { BubbleRevealSlider } from '../../../components/vyzualz/react/controls/BubbleRevealSlider'
import { IconMorphCheckbox } from '../../../components/vyzualz/react/controls/IconMorphToggle'
import { DualRailCollapsible } from '../../../components/vyzualz/react/DualRailCollapsible'
import { IconChipButton } from '../../../components/vyzualz/react/controls/IconChipButton'
import { DropdownSelect } from '../../../components/shared/Dropdown/Dropdown'
import { canUseSnapMode, type LyricSnapMode } from '../editor/lyricCueEditorModel'
import type { useLyricCueEditor } from '../editor/useLyricCueEditor'
import type { TimelineOverlayVisibility } from '../../timeline/timelineOverlays'
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

type SnapResolution = Exclude<LyricSnapMode, 'none'>

/**
 * The one set of controls for working the timeline: transport, add/undo/redo,
 * Snap, zoom, volume and overlays. Snap is a single piece of editor state —
 * the toggle and the resolution picker both write it, so there is no second,
 * differently-behaving Snap control anywhere in Lyric Manager.
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
}: Props) {
  const {
    cueHistoryPast,
    cueHistoryFuture,
    undoCueEdit,
    redoCueEdit,
    addAtPlayhead,
    snapMode,
    setSnapMode,
    beatGridMs,
    wordBoundaryMs,
    waveformZoom,
    setWaveformZoom,
    overlayVisibility,
    setOverlayVisibility,
  } = editor

  const snapOn = snapMode !== 'none'
  // Remembers the resolution to return to when Snap is switched back on.
  const lastResolutionRef = useRef<SnapResolution | null>(null)
  if (snapOn) lastResolutionRef.current = snapMode as SnapResolution
  const defaultResolution: SnapResolution = canUseSnapMode('beat', { beatGridMs }) ? 'beat' : 'millisecond'
  const resolution: SnapResolution = lastResolutionRef.current ?? defaultResolution

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

      <div className="lmv-timeline-toolbar__group">
        <IconChipButton onClick={addAtPlayhead}>+ Add cue</IconChipButton>
        <IconChipButton disabled={cueHistoryPast.length === 0} onClick={undoCueEdit} aria-label="Undo lyric edit">Undo</IconChipButton>
        <IconChipButton disabled={cueHistoryFuture.length === 0} onClick={redoCueEdit} aria-label="Redo lyric edit">Redo</IconChipButton>
      </div>

      <div className="lmv-timeline-toolbar__group">
        <button
          className="lmv-transport-chip"
          type="button"
          aria-pressed={snapOn}
          title="Snap cue edits to the selected resolution"
          onClick={() => setSnapMode(snapOn ? 'none' : resolution)}
        >
          ⌕ Snap: {snapOn ? 'On' : 'Off'}
        </button>
        <label className="lmv-timeline-toolbar__field" title="Snap resolution">
          <DropdownSelect
            className="lmv-select"
            aria-label="Snap resolution"
            value={resolution}
            onChange={event => setSnapMode(event.target.value as SnapResolution)}
          >
            <option value="millisecond">10 ms grid</option>
            <option value="frame">30 fps frames</option>
            <option value="beat" disabled={!canUseSnapMode('beat', { beatGridMs })}>Beat</option>
            <option value="half-beat" disabled={!canUseSnapMode('half-beat', { beatGridMs })}>Half beat</option>
            <option value="quarter-beat" disabled={!canUseSnapMode('quarter-beat', { beatGridMs })}>Quarter beat</option>
            <option value="word" disabled={!canUseSnapMode('word', { wordBoundaryMs })}>Word boundary</option>
          </DropdownSelect>
        </label>
      </div>

      <div className="lmv-timeline-toolbar__group lmv-timeline-toolbar__group--end">
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
      </div>
    </div>
  )
}

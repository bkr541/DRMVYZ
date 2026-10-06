import type { RecorderState, RecordingMode } from '../../../hooks/useRecorder'
import { Badge } from '../react/controls/Badge'
import { IconChipButton } from '../react/controls/IconChipButton'
import { NoticeCard } from '../react/controls/NoticeCard'
import { StatusBadge } from '../react/controls/StatusBadge'
import { CtrlSection, SelectRow } from '../react/ReactControlRows'

function fmtRecTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface RecordingPanelProps {
  canvas: HTMLCanvasElement | null
  recorderState: RecorderState
  recordingMode: RecordingMode | null
  recordingTime: number
  recorderError: string | null
  fps: 30 | 60
  liveFps: number
  onFpsChange: (fps: 30 | 60) => void
  /**
   * Called when the user clicks "Start Recording".
   * The caller is responsible for resolving whether to include an audio stream —
   * the panel only knows the canvas; audio routing is an engine concern.
   */
  onStartRecording: (canvas: HTMLCanvasElement) => void
  onStopRecording: () => void
  /**
   * True when a program audio source (file playing or demo) is actively
   * connected and producing signal in the audio graph.
   * Used only for the pre-recording status label — never used to create a stream.
   */
  hasActiveProgramAudio: boolean
  onExportPng: (canvas: HTMLCanvasElement | null) => void
}

export function RecordingPanel({
  canvas, recorderState, recordingMode, recordingTime, recorderError,
  fps, liveFps, onFpsChange,
  onStartRecording, onStopRecording,
  hasActiveProgramAudio, onExportPng,
}: RecordingPanelProps) {
  const isRecording = recorderState === 'recording'
  // Warn if live FPS drops below 75% of selected target while recording
  const fpsWarning = isRecording && liveFps > 0 && liveFps < fps * 0.75

  function handleStart() {
    if (!canvas) return
    onStartRecording(canvas)
  }

  return (
    <div className="rv-ctrl-group" data-recording-panel>
      <CtrlSection label="Record" />

      <div className="rv-ctrl-row">
        <span className="rv-ctrl-label">Status</span>
        <span>
          {isRecording
            ? <Badge tone="#e0687d" label={recordingMode === 'video-audio' ? 'REC — Video + Audio' : 'REC — Video only'} />
            : canvas
              ? <StatusBadge tone="loaded">Ready</StatusBadge>
              : <StatusBadge tone="dirty">Canvas not ready</StatusBadge>}
        </span>
      </div>

      {isRecording && (
        <div className="rv-ctrl-row">
          <span className="rv-ctrl-label">Elapsed</span>
          <span className="rv-ctrl-description">{fmtRecTime(recordingTime)}</span>
        </div>
      )}

      {fpsWarning && (
        <NoticeCard tone="warning" role="alert" title="FPS drop">
          {Math.round(liveFps)} fps — recording may be choppy.
        </NoticeCard>
      )}

      {recorderError && (
        <NoticeCard tone="error" role="alert" title="Recording error">
          {recorderError}
        </NoticeCard>
      )}

      <div className="rv-ctrl-action-row">
        {!isRecording ? (
          <IconChipButton
            tone="primary"
            onClick={handleStart}
            disabled={!canvas}
            title={canvas ? 'Start recording the visual output' : 'Waiting for canvas to initialise'}
            icon={<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8" /></svg>}
          >
            Start Recording
          </IconChipButton>
        ) : (
          <IconChipButton
            className="dv-icon-chip--danger"
            onClick={onStopRecording}
            icon={<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" /></svg>}
          >
            Stop &amp; Save
          </IconChipButton>
        )}
      </div>

      {!isRecording && (
        <>
          <CtrlSection label="Settings" />
          <SelectRow
            id="recording-target-fps"
            label="Target FPS"
            value={String(fps)}
            onChange={value => onFpsChange(value === '60' ? 60 : 30)}
            options={[
              { value: '30', label: '30 fps' },
              { value: '60', label: '60 fps' },
            ]}
          />
          <div className="rv-ctrl-row">
            <span className="rv-ctrl-label">Audio</span>
            <span>
              {hasActiveProgramAudio
                ? <StatusBadge tone="playing">Available</StatusBadge>
                : <StatusBadge tone="dirty">Play a track first</StatusBadge>}
            </span>
          </div>
        </>
      )}

      <CtrlSection label="Export" />
      <div className="rv-ctrl-action-row">
        <IconChipButton
          onClick={() => onExportPng(canvas)}
          disabled={!canvas}
          title="Export current frame as PNG"
          icon={(
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 16l3.5-4 3 3.5L16 13l3 4" />
            </svg>
          )}
        >
          PNG Frame
        </IconChipButton>
      </div>

      <div className="rv-ctrl-info">
        Records clean canvas output only — no editor chrome or panels.
      </div>
    </div>
  )
}

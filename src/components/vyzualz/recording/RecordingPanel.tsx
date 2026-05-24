import type { RecorderState, RecordingMode } from '../../../hooks/useRecorder'

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
   * True when a program audio source (file playing, microphone, demo) is actively
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
    <div className="vz-rec-panel">
      <div className="vz-panel-header">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="8"/>
        </svg>
        <span className="vz-panel-title">Record</span>
      </div>

      <div className="vz-rec-body">

        {/* ── Status row ─────────────────────────────────── */}
        <div className="vz-rec-status">
          <div className={`vz-rec-dot${isRecording ? ' vz-rec-dot--live' : ''}`} />
          <span className="vz-rec-status-text">
            {isRecording
              ? (recordingMode === 'video-audio' ? 'REC — Video + Audio' : 'REC — Video only')
              : canvas ? 'Ready' : 'Canvas not ready'}
          </span>
          {isRecording && (
            <span className="vz-rec-timer">{fmtRecTime(recordingTime)}</span>
          )}
        </div>

        {/* ── FPS drop warning ────────────────────────────── */}
        {fpsWarning && (
          <div className="vz-rec-warning" role="alert">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
              <path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zm-1 5.5v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            FPS drop: {Math.round(liveFps)} fps — recording may be choppy
          </div>
        )}

        {/* ── Recorder error ──────────────────────────────── */}
        {recorderError && (
          <div className="vz-rec-error" role="alert">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
              <path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zm-1 5.5v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
            </svg>
            {recorderError}
          </div>
        )}

        {/* ── Start / Stop button ─────────────────────────── */}
        <div className="vz-rec-controls">
          {!isRecording ? (
            <button
              className="vz-rec-start-btn"
              onClick={handleStart}
              disabled={!canvas}
              title={canvas ? 'Start recording the visual output' : 'Waiting for canvas to initialise'}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="12" r="8"/>
              </svg>
              Start Recording
            </button>
          ) : (
            <button className="vz-rec-stop-btn" onClick={onStopRecording}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12"/>
              </svg>
              Stop &amp; Save
            </button>
          )}
        </div>

        {/* ── Settings (hidden while recording) ──────────── */}
        {!isRecording && (
          <div className="vz-rec-settings">
            <div className="vz-rec-setting-row">
              <span className="vz-rec-label">Target FPS</span>
              <div className="vz-rec-fps-btns">
                <button
                  className={`vz-rec-fps-btn${fps === 30 ? ' vz-rec-fps-btn--active' : ''}`}
                  onClick={() => onFpsChange(30)}
                  title="Record at 30 fps"
                >30</button>
                <button
                  className={`vz-rec-fps-btn${fps === 60 ? ' vz-rec-fps-btn--active' : ''}`}
                  onClick={() => onFpsChange(60)}
                  title="Record at 60 fps"
                >60</button>
              </div>
            </div>

            <div className="vz-rec-setting-row">
              <span className="vz-rec-label">Audio</span>
              <span className={`vz-rec-value${hasActiveProgramAudio ? '' : ' vz-rec-value--warn'}`}>
                {hasActiveProgramAudio ? 'Available' : 'Play a track first'}
              </span>
            </div>
          </div>
        )}

        {/* ── Export section ──────────────────────────────── */}
        <div className="vz-rec-section-title">Export</div>
        <div className="vz-rec-export-btns">
          <button
            className="vz-rec-export-btn"
            onClick={() => onExportPng(canvas)}
            disabled={!canvas}
            title="Export current frame as PNG"
          >
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            PNG Frame
          </button>
        </div>

        <p className="vz-rec-hint">
          Records clean canvas output only — no editor chrome or panels.
        </p>
      </div>
    </div>
  )
}

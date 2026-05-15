import { formatTime } from '../utils/formatTime'
import { RecorderState } from '../hooks/useRecorder'

interface RingBuffer {
  read: (s: number) => Float32Array
  sampleRate: number
}

interface Props {
  recorderState: RecorderState
  recordingTime: number
  onStart: () => void
  onStop: () => void
  onCaptureBuffer: (rb: RingBuffer | null, seconds: number) => void
  onExportPNG: () => void
  onToggleRecMode: () => void
  recordingMode: boolean
  ringBuffer: RingBuffer | null
  primaryColor: string
}

export function RecordingPanel({
  recorderState, recordingTime, onStart, onStop,
  onCaptureBuffer, onExportPNG, onToggleRecMode,
  recordingMode, ringBuffer, primaryColor,
}: Props) {
  return (
    <div className="recording-panel">
      <div className="settings-section-title">RECORDING &amp; EXPORT</div>

      {/* Screen / audio recording */}
      <div className="settings-section">
        <div className="settings-label">AUDIO RECORDING</div>
        <div className="rec-btn-row">
          {recorderState === 'idle'
            ? <button className="btn-rec" onClick={onStart}
                style={{ '--accent': primaryColor } as React.CSSProperties}>
                ● Start (mic/file stream)
              </button>
            : <button className="btn-rec btn-rec-stop" onClick={onStop}>■ Stop &amp; Save</button>
          }
          {recorderState === 'recording' && (
            <span className="rec-time">{formatTime(recordingTime)}</span>
          )}
        </div>
        <div className="settings-note">
          Note: Browser audio recording requires microphone permission or a mic source.
          For system audio capture use OBS or screen recorder software.
        </div>
      </div>

      {/* Ring buffer capture */}
      <div className="settings-section">
        <div className="settings-label">CAPTURE BUFFER</div>
        <div className="rec-btn-row">
          <button className="btn-text" onClick={() => onCaptureBuffer(ringBuffer, 10)}
            style={{ '--accent': primaryColor } as React.CSSProperties}>
            Export last 10s WAV
          </button>
          <button className="btn-text" onClick={() => onCaptureBuffer(ringBuffer, 30)}
            style={{ '--accent': primaryColor } as React.CSSProperties}>
            Export last 30s WAV
          </button>
          <button className="btn-text" onClick={() => onCaptureBuffer(ringBuffer, 60)}
            style={{ '--accent': primaryColor } as React.CSSProperties}>
            Export last 60s WAV
          </button>
        </div>
        <div className="settings-note">
          Buffer stores up to 60s of audio at native sample rate. Works with file + mic sources.
        </div>
      </div>

      {/* Frame export */}
      <div className="settings-section">
        <div className="settings-label">EXPORT</div>
        <button className="btn-text" onClick={onExportPNG}
          style={{ '--accent': primaryColor } as React.CSSProperties}>
          Export frame as PNG
        </button>
      </div>

      {/* Recording mode */}
      <div className="settings-section">
        <div className="settings-label">SCREEN RECORDING</div>
        <button
          className={`btn-text ${recordingMode ? 'active' : ''}`}
          onClick={onToggleRecMode}
          style={{ '--accent': recordingMode ? '#ff3333' : primaryColor } as React.CSSProperties}
        >
          {recordingMode ? '■ Exit Recording Mode' : '● Enter Recording Mode'}
        </button>
        <div className="settings-note">
          Hides controls. Use a screen recorder to capture the visual area.
        </div>
      </div>
    </div>
  )
}

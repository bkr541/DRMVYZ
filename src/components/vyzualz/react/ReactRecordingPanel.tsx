import { RecordingPanel } from '../recording/RecordingPanel'
import type { Recorder } from '../../../hooks/useRecorder'

// Props-driven so that useRecorder lives in ReactView and recording survives tab switches.
interface Props {
  canvas:                 HTMLCanvasElement | null
  recorder:              Recorder
  liveFps:               number
  hasActiveProgramAudio: boolean
  onStartRecording:      (canvas: HTMLCanvasElement) => void
}

export function ReactRecordingPanel({
  canvas, recorder, liveFps, hasActiveProgramAudio, onStartRecording,
}: Props) {
  return (
    <RecordingPanel
      canvas={canvas}
      recorderState={recorder.recorderState}
      recordingMode={recorder.recordingMode}
      recordingTime={recorder.recordingTime}
      recorderError={recorder.recorderError}
      fps={recorder.fps}
      liveFps={liveFps}
      onFpsChange={recorder.setFps}
      onStartRecording={onStartRecording}
      onStopRecording={recorder.stopRecording}
      hasActiveProgramAudio={hasActiveProgramAudio}
      onExportPng={recorder.exportPNG}
    />
  )
}

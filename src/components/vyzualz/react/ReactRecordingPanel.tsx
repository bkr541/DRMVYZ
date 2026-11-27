import { pickVideoMimeType, type Recorder, type RecordingBitrate, type RecordingFormat, type RecordingFps } from '../../../hooks/useRecorder'
import { DrawerNotice } from '../shared/DrawerNotice'
import { OutputHeaderTools, OUTPUT_FIELDS, type OutputSettings } from './output/OutputHeaderTools'

interface Props {
  canvas: HTMLCanvasElement | null
  recorder: Recorder
  liveFps: number
  hasActiveProgramAudio: boolean
  onStartRecording: (canvas: HTMLCanvasElement) => void
}

export function ReactRecordingPanel({ canvas, recorder, liveFps, hasActiveProgramAudio, onStartRecording }: Props) {
  const recording = recorder.recorderState === 'recording'
  const settings: OutputSettings = { aspect: recorder.aspect, fps: String(recorder.fps), bitrate: String(recorder.bitrate), format: recorder.format }
  const formats = OUTPUT_FIELDS.format.options.map(option => {
    const supported = Boolean(pickVideoMimeType(option.value as RecordingFormat))
    return { ...option, disabled: !supported, label: supported ? option.label : `${option.label} (unavailable)` }
  })
  const change = <K extends keyof OutputSettings>(key: K, value: OutputSettings[K]) => {
    if (recording) return
    if (key === 'aspect') recorder.setAspect(value as OutputSettings['aspect'])
    if (key === 'fps') recorder.setFps(Number(value) as RecordingFps)
    if (key === 'bitrate') recorder.setBitrate(Number(value) as RecordingBitrate)
    if (key === 'format' && pickVideoMimeType(value as RecordingFormat)) recorder.setFormat(value as RecordingFormat)
  }
  const elapsed = `${Math.floor(recorder.recordingTime / 60).toString().padStart(2, '0')}:${(recorder.recordingTime % 60).toString().padStart(2, '0')}`
  return <div data-recording-panel className="rv-output-recording-panel">
    <OutputHeaderTools settings={settings} onChange={change} recording={recording}
      formatOptions={formats} menuBoundarySelector=".rv-inspector-scroll"
      canRecord={Boolean(canvas && pickVideoMimeType(recorder.format))} canScreenshot={Boolean(canvas)}
      onRecord={() => recording ? recorder.stopRecording() : canvas && onStartRecording(canvas)}
      onScreenshot={() => { if (canvas) recorder.exportPNG(canvas) }} />
    {!recording && canvas && !formats.some(option => !option.disabled) && <DrawerNotice tone="warning" title="Video recording unavailable">This runtime does not expose a supported video encoder. PNG screenshots remain available.</DrawerNotice>}
    {recording && <div className="rv-ctrl-info" role="status">Recording · {elapsed} · {recorder.recordingMode === 'video-audio' ? 'Video + audio' : 'Video only'}</div>}
    {!recording && canvas && !hasActiveProgramAudio && <span className="sr-only">Recording will contain video only.</span>}
    {recording && liveFps > 0 && liveFps < recorder.fps * .75 && <DrawerNotice tone="warning" role="alert" title="FPS drop">{Math.round(liveFps)} fps — recording may be choppy.</DrawerNotice>}
    {recorder.recorderError && <DrawerNotice tone="error" role="alert" title="Recording error">{recorder.recorderError}</DrawerNotice>}
  </div>
}

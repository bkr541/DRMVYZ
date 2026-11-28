import { useState, useRef, useCallback, useEffect } from 'react'
import { encodeWAV, downloadBlob } from '../utils/wavExport'
import { notify } from '../stores/notificationStore'
import { BRAND_FILE_PREFIX } from '../brand'
import type { OutputAspectRatio } from '../native/outputBridge'
import type { MutableRefObject } from 'react'
import { createRecordingFrame, captureRecordingPng } from './recordingFrame'
import { getNativeRecordingBridge } from '../native/recordingBridge'
import { createDiskRecordingSink, createMemoryRecordingSink, MEMORY_RECORDING_LIMIT_BYTES, type RecordingSink, type RecordingSinkOutcome } from './recordingSink'

export type RecordingFps = 24 | 30 | 60
export type RecordingFormat = 'WebM' | 'MP4' | 'MOV'
export type RecordingBitrate = 4 | 8 | 12 | 16 | 24 | 40
export interface RecordingOptions { fps?: RecordingFps; sourceRef?: MutableRefObject<HTMLCanvasElement | null> }

export type RecorderState = 'idle' | 'recording'
export type RecordingMode = 'video-audio' | 'video-only'

export interface Recorder {
  recorderState: RecorderState
  recordingMode: RecordingMode | null
  recordingTime: number
  recorderError: string | null
  fps: RecordingFps
  setFps: (fps: RecordingFps) => void
  aspect: OutputAspectRatio
  setAspect: (aspect: OutputAspectRatio) => void
  format: RecordingFormat
  setFormat: (format: RecordingFormat) => void
  bitrate: RecordingBitrate
  setBitrate: (bitrate: RecordingBitrate) => void
  startVideoRecording: (
    canvas: HTMLCanvasElement,
    audioStream: MediaStream | null,
    opts?: RecordingOptions,
  ) => void
  stopRecording: () => void
  exportRingBuffer: (
    ringBuffer: { read: (s: number) => Float32Array; sampleRate: number } | null,
    seconds: number,
  ) => void
  exportPNG: (canvas?: HTMLCanvasElement | null) => void
}

// Ordered by quality preference. Codec suffix must be lowercase for isTypeSupported.
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

const FORMAT_MIME_CANDIDATES: Record<RecordingFormat, readonly string[]> = {
  WebM: MIME_CANDIDATES,
  MP4: ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'],
  MOV: ['video/quicktime'],
}
export function pickVideoMimeType(format: RecordingFormat = 'WebM'): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  return FORMAT_MIME_CANDIDATES[format].find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function buildCombinedStream(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  fps: RecordingFps,
): { stream: MediaStream; capturedTracks: MediaStreamTrack[]; mode: RecordingMode } {
  const videoStream    = canvas.captureStream(fps)
  const videoTracks    = videoStream.getVideoTracks()
  const capturedTracks = [...videoTracks]

  const audioTracks = audioStream?.getAudioTracks() ?? []
  const mode: RecordingMode = audioTracks.length > 0 ? 'video-audio' : 'video-only'

  try {
    if (!videoTracks.length) throw new Error('Canvas did not produce a video track')
    const stream = new MediaStream([...videoTracks, ...audioTracks])
    return { stream, capturedTracks, mode }
  } catch (error) {
    for (const track of capturedTracks) track.stop()
    throw error
  }
}

export function useRecorder(): Recorder {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recorderError, setRecorderError] = useState<string | null>(null)
  const [fps, setFpsState] = useState<RecordingFps>(30)

  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const stopFrameRef       = useRef<(() => void) | null>(null)
  const [aspect, setAspectState] = useState<OutputAspectRatio>('16:9')
  const [format, setFormatState] = useState<RecordingFormat>(() => pickVideoMimeType('WebM') ? 'WebM' : pickVideoMimeType('MP4') ? 'MP4' : pickVideoMimeType('MOV') ? 'MOV' : 'WebM')
  const [bitrate, setBitrateState] = useState<RecordingBitrate>(8)
  const settingsRef = useRef({ aspect, format, bitrate })
  const setAspect = useCallback((value: OutputAspectRatio) => { if (!mediaRecorderRef.current) { settingsRef.current.aspect = value; setAspectState(value) } }, [])
  const setFormat = useCallback((value: RecordingFormat) => { if (!mediaRecorderRef.current) { settingsRef.current.format = value; setFormatState(value) } }, [])
  const setBitrate = useCallback((value: RecordingBitrate) => { if (!mediaRecorderRef.current) { settingsRef.current.bitrate = value; setBitrateState(value) } }, [])
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const captureTracksRef   = useRef<MediaStreamTrack[]>([])
  const fpsRef             = useRef<RecordingFps>(fps)

  const setFps = useCallback((f: RecordingFps) => {
    if (mediaRecorderRef.current) return
    setFpsState(f)
    fpsRef.current = f
  }, [])

  // stopRecording defined before startVideoRecording so onerror can close over it.
  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (mr && mr.state !== 'inactive') {
      try { mr.stop() } catch (error) { setRecorderError(`Could not stop recorder: ${String(error)}`) }
    }
    stopFrameRef.current?.(); stopFrameRef.current = null

    // Stop only the video capture tracks we created — never stop the shared audio stream.
    for (const track of captureTracksRef.current) track.stop()
    captureTracksRef.current = []

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecorderState('idle')
    setRecordingMode(null)
    setRecordingTime(0)
  }, [])

  const startVideoRecording = useCallback((
    canvas: HTMLCanvasElement,
    audioStream: MediaStream | null,
    opts?: RecordingOptions,
  ) => {
    if (mediaRecorderRef.current) return

    const targetFps = opts?.fps ?? fpsRef.current
    const { aspect, format, bitrate } = settingsRef.current
    const mimeType = pickVideoMimeType(format)

    if (!mimeType) {
      setRecorderError(`${format} recording is not supported by this runtime. Choose an available video format.`)
      return
    }

    setRecorderError(null)

    let stream: MediaStream, capturedTracks: MediaStreamTrack[], mode: RecordingMode
    let stopFrame: (() => void) | undefined
    try {
      const frame = createRecordingFrame(opts?.sourceRef ?? { current: canvas }, aspect, targetFps, error => {
        setRecorderError(`Frame capture failed: ${String(error)}`)
        stopRecording()
      })
      stopFrame = frame.stop
      ;({ stream, capturedTracks, mode } = buildCombinedStream(frame.canvas, audioStream, targetFps))
    } catch (err) {
      stopFrame?.()
      setRecorderError(`Failed to capture canvas stream: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    let mr: MediaRecorder
    try {
      mr = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate * 1_000_000,
      })
    } catch (err) {
      stopFrame?.()
      for (const track of capturedTracks) track.stop()
      setRecorderError(`Could not create recorder: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    // Desktop: written to disk as it records; browser: held in memory up to a limit (recordingSink.ts).
    const fileName = `${BRAND_FILE_PREFIX}-performance-${Date.now()}.${format.toLowerCase()}`
    const expectedType = mimeType.split(';')[0].trim().toLowerCase()
    const mustStop = (reason: 'low-disk' | 'memory-limit' | 'write-failed', detail?: string) => {
      if (mediaRecorderRef.current === mr) stopRecording()
      const message = reason === 'low-disk'
        ? `The recording stopped because the disk is nearly full${detail ? ` (${detail})` : ''}. What was recorded is kept.`
        : reason === 'memory-limit'
          ? `Browser recordings stop at ${Math.round(MEMORY_RECORDING_LIMIT_BYTES / 1024 ** 3 * 10) / 10} GB. What was recorded is saved; use the desktop app for longer sets.`
          : `The recording could not be written to disk${detail ? `: ${detail}` : ''}. What was recorded is kept.`
      notify('react', { tone: 'warning', title: 'Recording stopped', message })
    }
    const bridge = getNativeRecordingBridge()
    const sink: RecordingSink = bridge
      ? createDiskRecordingSink(bridge, fileName, { onMustStop: mustStop })
      : createMemoryRecordingSink(expectedType, blob => downloadBlob(blob, fileName), { onMustStop: mustStop })
    const report = (outcome: RecordingSinkOutcome) => {
      if (outcome.kind === 'saved-to-disk') notify('react', { tone: 'success', title: 'Recording saved', message: `Saved to ${outcome.path}` })
      else if (outcome.kind === 'kept-partial') notify('react', { tone: 'warning', title: 'Recording kept', message: `What was recorded is in ${outcome.path}` })
      else if (outcome.kind === 'empty') notify('react', { tone: 'warning', title: 'Recording empty', message: 'No video data was produced.' })
    }
    const fail = (error: unknown) => notify('react', { tone: 'error', title: 'Recording not saved', message: error instanceof Error ? error.message : String(error) })

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) sink.write(e.data)
    }
    mr.onstop = () => {
      if (mediaRecorderRef.current === mr) stopRecording()
      const actualType = (mr.mimeType || mimeType).split(';')[0].trim().toLowerCase()
      if (actualType !== expectedType) {
        // In memory nothing is saved under the wrong name; on disk the recording is kept under its .partial name rather than lost.
        notify('react', { tone: 'error', title: 'Recording format mismatch', message: `Encoder returned ${actualType} instead of ${expectedType}. No mislabeled file was saved.` })
        if (bridge) void sink.abort().then(report, fail)
        return
      }
      void sink.finish().then(report, fail)
    }
    mr.onerror = (e) => {
      const msg = (e as Event & { error?: DOMException }).error?.message ?? 'unknown'
      if (mediaRecorderRef.current === mr) {
        setRecorderError(`Recording error: ${msg}`)
        stopRecording()
      }
    }

    try {
      mr.start(500)
    } catch (err) {
      stopFrame?.()
      for (const track of capturedTracks) track.stop()
      setRecorderError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    // Only assign to refs after all potentially-failing operations succeed.
    stopFrameRef.current = stopFrame ?? null
    captureTracksRef.current = capturedTracks
    mediaRecorderRef.current = mr
    setRecordingMode(mode)
    setRecorderState('recording')
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }, [stopRecording])

  // Best-effort cleanup when the component unmounts during an active recording.
  // Does not call setState — the component is gone.
  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== 'inactive') {
        try { mr.stop() } catch { /* ignore */ }
      }
      mediaRecorderRef.current = null
      stopFrameRef.current?.(); stopFrameRef.current = null
      for (const track of captureTracksRef.current) track.stop()
      captureTracksRef.current = []
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [])

  const exportRingBuffer = useCallback((
    ringBuffer: { read: (s: number) => Float32Array; sampleRate: number } | null,
    seconds: number,
  ) => {
    if (!ringBuffer) {
      notify('react', { tone: 'warning', title: 'Nothing to export', message: 'No audio has been captured yet. Play a track or use Live Input first.' })
      return
    }
    const samples = ringBuffer.read(seconds)
    if (samples.length === 0) {
      notify('react', { tone: 'warning', title: 'Nothing to export', message: 'The audio buffer is empty. Play some audio first, then export again.' })
      return
    }
    const wav = encodeWAV(samples, ringBuffer.sampleRate)
    downloadBlob(wav, `${BRAND_FILE_PREFIX}-capture-${seconds}s-${Date.now()}.wav`)
  }, [])

  const exportPNG = useCallback((canvas?: HTMLCanvasElement | null) => {
    const target = canvas

    if (!target) {
      notify('react', { tone: 'warning', title: 'Nothing to export', message: 'There is no visual output to export yet. Start an engine, then export again.' })
      return
    }

    void captureRecordingPng(target, settingsRef.current.aspect).then(blob => {
      downloadBlob(blob, `${BRAND_FILE_PREFIX}-frame-${Date.now()}.png`)
    }).catch(error => notify('react', { tone: 'error', title: 'Screenshot failed', message: String(error) }))
  }, [])

  return {
    recorderState, recordingMode, recordingTime, recorderError,
    fps, setFps, aspect, setAspect, format, setFormat, bitrate, setBitrate,
    startVideoRecording, stopRecording,
    exportRingBuffer, exportPNG,
  }
}

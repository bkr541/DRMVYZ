import { useState, useRef, useCallback, useEffect } from 'react'
import { encodeWAV, downloadBlob } from '../utils/wavExport'

export type RecorderState = 'idle' | 'recording'
export type RecordingMode = 'video-audio' | 'video-only'

export interface Recorder {
  recorderState: RecorderState
  recordingMode: RecordingMode | null
  recordingTime: number
  recorderError: string | null
  fps: 30 | 60
  setFps: (fps: 30 | 60) => void
  startVideoRecording: (
    canvas: HTMLCanvasElement,
    audioStream: MediaStream | null,
    opts?: { fps?: 30 | 60 },
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

export function pickVideoMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function buildCombinedStream(
  canvas: HTMLCanvasElement,
  audioStream: MediaStream | null,
  fps: 30 | 60,
): { stream: MediaStream; capturedTracks: MediaStreamTrack[]; mode: RecordingMode } {
  const videoStream    = canvas.captureStream(fps)
  const videoTracks    = videoStream.getVideoTracks()
  const capturedTracks = [...videoTracks]

  const audioTracks = audioStream?.getAudioTracks() ?? []
  const mode: RecordingMode = audioTracks.length > 0 ? 'video-audio' : 'video-only'

  const stream = new MediaStream([
    ...videoTracks,
    ...audioTracks,
  ])

  return { stream, capturedTracks, mode }
}

export function useRecorder(): Recorder {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recorderError, setRecorderError] = useState<string | null>(null)
  const [fps, setFpsState] = useState<30 | 60>(30)

  const mediaRecorderRef   = useRef<MediaRecorder | null>(null)
  const chunksRef          = useRef<Blob[]>([])
  const timerRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const captureTracksRef   = useRef<MediaStreamTrack[]>([])
  const fpsRef             = useRef<30 | 60>(fps)

  const setFps = useCallback((f: 30 | 60) => {
    setFpsState(f)
    fpsRef.current = f
  }, [])

  // stopRecording defined before startVideoRecording so onerror can close over it.
  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (mr && mr.state !== 'inactive') mr.stop()
    mediaRecorderRef.current = null

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
    opts?: { fps?: 30 | 60 },
  ) => {
    if (mediaRecorderRef.current) return

    const targetFps = opts?.fps ?? fpsRef.current
    const mimeType  = pickVideoMimeType()

    if (!mimeType) {
      setRecorderError('Your browser does not support video recording (WebM). Use Chrome or Edge.')
      return
    }

    setRecorderError(null)

    let stream: MediaStream, capturedTracks: MediaStreamTrack[], mode: RecordingMode
    try {
      ;({ stream, capturedTracks, mode } = buildCombinedStream(canvas, audioStream, targetFps))
    } catch (err) {
      setRecorderError(`Failed to capture canvas stream: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    let mr: MediaRecorder
    try {
      chunksRef.current = []
      mr = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000,
      })
    } catch (err) {
      for (const track of capturedTracks) track.stop()
      setRecorderError(`Could not create recorder: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      downloadBlob(blob, `drmvyz-performance-${Date.now()}.webm`)
      chunksRef.current = []
    }
    mr.onerror = (e) => {
      const msg = (e as Event & { error?: DOMException }).error?.message ?? 'unknown'
      setRecorderError(`Recording error: ${msg}`)
      stopRecording()
    }

    try {
      mr.start(500)
    } catch (err) {
      for (const track of capturedTracks) track.stop()
      setRecorderError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    // Only assign to refs after all potentially-failing operations succeed.
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
      alert('No audio captured yet. Play a track or use Live Input first.')
      return
    }
    const samples = ringBuffer.read(seconds)
    if (samples.length === 0) {
      alert('Ring buffer is empty — play some audio first.')
      return
    }
    const wav = encodeWAV(samples, ringBuffer.sampleRate)
    downloadBlob(wav, `drmvyz-capture-${seconds}s-${Date.now()}.wav`)
  }, [])

  const exportPNG = useCallback((canvas?: HTMLCanvasElement | null) => {
    const target = canvas ?? Array.from(
      document.querySelectorAll<HTMLCanvasElement>('canvas'),
    ).reduce<HTMLCanvasElement | null>((best, c) => {
      if (!best) return c
      return c.width * c.height > best.width * best.height ? c : best
    }, null)

    if (!target) { alert('No canvas found to export.'); return }

    const url = target.toDataURL('image/png')
    const a   = document.createElement('a')
    a.href     = url
    a.download = `drmvyz-frame-${Date.now()}.png`
    a.click()
  }, [])

  return {
    recorderState, recordingMode, recordingTime, recorderError,
    fps, setFps,
    startVideoRecording, stopRecording,
    exportRingBuffer, exportPNG,
  }
}

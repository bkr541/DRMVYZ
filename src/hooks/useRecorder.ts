import { useState, useRef, useCallback } from 'react'
import { encodeWAV, downloadBlob } from '../utils/wavExport'

export type RecorderState = 'idle' | 'recording' | 'stopped'

export interface Recorder {
  recorderState: RecorderState
  recordingTime: number
  startRecording: (stream?: MediaStream) => void
  stopRecording: () => void
  exportRingBuffer: (ringBuffer: { read: (s: number) => Float32Array; sampleRate: number } | null, seconds: number) => void
  exportPNG: (canvasSelector?: string) => void
}

export function useRecorder(): Recorder {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = useCallback((stream?: MediaStream) => {
    let targetStream = stream

    // If no stream provided, attempt to capture tab audio via display media
    if (!targetStream) {
      // We can only record if we have a real audio stream
      // Without one, we inform the user
      alert('To record audio, please use the Microphone source or load a file.\nFor screen+audio capture, use OBS or your OS screen recorder.')
      return
    }

    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      alert('Your browser does not support MediaRecorder with audio/webm.')
      return
    }

    chunksRef.current = []
    const mr = new MediaRecorder(targetStream, { mimeType: 'audio/webm' })
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      downloadBlob(blob, `drmvyz-recording-${Date.now()}.webm`)
    }
    mr.start(250)
    mediaRecorderRef.current = mr

    setRecorderState('recording')
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRecorderState('idle')
    setRecordingTime(0)
  }, [])

  const exportRingBuffer = useCallback((
    ringBuffer: { read: (s: number) => Float32Array; sampleRate: number } | null,
    seconds: number
  ) => {
    if (!ringBuffer) {
      alert('No audio captured yet. Play a track or use microphone input first.')
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

  const exportPNG = useCallback((selector = 'canvas') => {
    // Find the largest canvas on the page (the main visualizer area)
    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(selector))
    if (canvases.length === 0) { alert('No canvas found to export.'); return }

    // Create a composite canvas from the app root
    const appRoot = document.querySelector<HTMLElement>('.app-root')
    if (!appRoot) return

    // Use html2canvas equivalent: get app root bounding box and draw visible region
    // Simple approach: export the largest canvas
    const biggest = canvases.reduce((a, b) =>
      a.width * a.height > b.width * b.height ? a : b
    )

    const url = biggest.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `drmvyz-frame-${Date.now()}.png`
    a.click()
  }, [])

  return { recorderState, recordingTime, startRecording, stopRecording, exportRingBuffer, exportPNG }
}

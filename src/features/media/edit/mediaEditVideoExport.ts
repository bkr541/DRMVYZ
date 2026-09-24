// Video export: plays the source through the same WebGL renderer the preview
// uses, captures the rendered canvas together with the source's audio, and
// records it with the repo's existing canvas-capture stack (buildCombinedStream
// from useRecorder). Recording is real-time, so exporting takes as long as the
// video plays. Everything created here is released in a single finally block.

import { buildCombinedStream } from '../../../hooks/useRecorder'
import type { MediaEditState } from './mediaEditModel'
import { MediaEditAbortError } from './mediaEditImageExport'
import { MediaEditRenderer } from './MediaEditGlRenderer'
import { pickVideoExportFormat, type RenderedMedia } from './mediaEditOutput'
import { withWebmDuration } from './webmDuration'

export const MAX_VIDEO_EXPORT_EDGE = 4096
const DEFAULT_FPS = 30
/** How long the source may fail to advance before the export is abandoned. */
const STALL_TIMEOUT_MS = 12_000
const STALL_CHECK_MS = 1_000

export interface VideoExportInput {
  url: string
  edit: MediaEditState
  sourceMimeType: string | null
  /** Frame rate of the recording; defaults to the source's known FPS or 30. */
  fps?: number
  signal?: AbortSignal
  /** 0..1 as the source plays through. */
  onProgress?: (fraction: number) => void
}

/** Everything that touches the browser, replaceable in tests. */
export interface VideoExportEnvironment {
  createVideo(): HTMLVideoElement
  createCanvas(): HTMLCanvasElement
  createRenderer(canvas: HTMLCanvasElement): MediaEditRenderer | null
  createRecorder(stream: MediaStream, options: MediaRecorderOptions): MediaRecorder
  createAudioContext(): AudioContext | null
  isTypeSupported(mime: string): boolean
  setInterval(handler: () => void, ms: number): number
  clearInterval(id: number): void
}

export const browserVideoExportEnvironment: VideoExportEnvironment = {
  createVideo: () => document.createElement('video'),
  createCanvas: () => document.createElement('canvas'),
  createRenderer: canvas => MediaEditRenderer.create(canvas),
  createRecorder: (stream, options) => new MediaRecorder(stream, options),
  createAudioContext: () => {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return Ctor ? new Ctor() : null
  },
  isTypeSupported: mime => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime),
  setInterval: (handler, ms) => window.setInterval(handler, ms),
  clearInterval: id => window.clearInterval(id),
}

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream
  audioTracks?: { length: number }
  mozHasAudio?: boolean
  webkitAudioDecodedByteCount?: number
}

/**
 * Whether the source carries audio. Unknown resolves to `true`: carrying an
 * (at worst silent) track is safe, silently dropping real audio is not.
 */
export function detectVideoHasAudio(video: HTMLVideoElement): boolean {
  const media = video as CapturableVideo
  if (media.audioTracks && typeof media.audioTracks.length === 'number') return media.audioTracks.length > 0
  if (typeof media.mozHasAudio === 'boolean') return media.mozHasAudio
  if (typeof media.captureStream === 'function') {
    try {
      const probe = media.captureStream()
      const count = probe.getAudioTracks().length
      for (const track of probe.getTracks()) track.stop()
      return count > 0
    } catch {
      return true
    }
  }
  return true
}

function waitForEvent(target: EventTarget, type: string, signal: AbortSignal | undefined, errorType = 'error'): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(type, onDone)
      target.removeEventListener(errorType, onError)
      signal?.removeEventListener('abort', onAbort)
    }
    const onDone = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error('The video could not be loaded for editing.')) }
    const onAbort = () => { cleanup(); reject(new MediaEditAbortError()) }
    if (signal?.aborted) { onAbort(); return }
    target.addEventListener(type, onDone, { once: true })
    target.addEventListener(errorType, onError, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function bitrateFor(width: number, height: number, fps: number): number {
  return Math.round(Math.min(24_000_000, Math.max(2_000_000, width * height * fps * 0.12)))
}

export async function renderEditedVideo(
  input: VideoExportInput,
  env: VideoExportEnvironment = browserVideoExportEnvironment,
): Promise<RenderedMedia> {
  const { signal } = input
  if (signal?.aborted) throw new MediaEditAbortError()

  const video = env.createVideo() as CapturableVideo
  const canvas = env.createCanvas()
  let renderer: MediaEditRenderer | null = null
  let audioContext: AudioContext | null = null
  let audioStream: MediaStream | null = null
  let combined: { stream: MediaStream; capturedTracks: MediaStreamTrack[] } | null = null
  let recorder: MediaRecorder | null = null
  let stallTimer: number | null = null
  let frameHandle: number | null = null
  let disposed = false

  const cancelFrame = () => {
    if (frameHandle === null) return
    if (typeof video.cancelVideoFrameCallback === 'function') video.cancelVideoFrameCallback(frameHandle)
    else cancelAnimationFrame(frameHandle)
    frameHandle = null
  }

  const cleanup = () => {
    if (disposed) return
    disposed = true
    if (stallTimer !== null) env.clearInterval(stallTimer)
    cancelFrame()
    try { video.pause() } catch { /* already torn down */ }
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      try { recorder.stop() } catch { /* already stopped */ }
    }
    // Only the tracks created here: the canvas capture and the audio tap.
    for (const track of combined?.capturedTracks ?? []) track.stop()
    for (const track of audioStream?.getTracks() ?? []) track.stop()
    void audioContext?.close().catch(() => undefined)
    renderer?.dispose()
    canvas.width = 0
    canvas.height = 0
    video.removeAttribute('src')
    video.load()
  }

  try {
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    // Local playback stays silent: the audio is routed to the recorder only, below.
    video.muted = false
    const loaded = waitForEvent(video, 'loadeddata', signal)
    video.src = input.url
    await loaded

    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    const duration = video.duration
    if (!sourceWidth || !sourceHeight) throw new Error('The video has no decodable picture.')
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('The video length could not be determined.')

    const hasAudio = detectVideoHasAudio(video)
    const format = pickVideoExportFormat(input.sourceMimeType, hasAudio, mime => env.isTypeSupported(mime))
    if (!format) throw new Error('This runtime cannot record video, so the edited video cannot be saved.')

    renderer = env.createRenderer(canvas)
    if (!renderer) throw new Error('GPU rendering is unavailable, so this video cannot be rendered.')
    const geometryOptions = { even: true, maxEdge: MAX_VIDEO_EXPORT_EDGE }
    const drawFrame = (): boolean => {
      const geometry = renderer!.render({
        source: video,
        sourceWidth,
        sourceHeight,
        edit: input.edit,
        geometry: geometryOptions,
      })
      return geometry !== null
    }
    if (!drawFrame()) throw renderer.lastError ?? new Error('The first video frame could not be rendered.')

    if (hasAudio) {
      audioContext = env.createAudioContext()
      if (audioContext) {
        const tap = audioContext.createMediaElementSource(video)
        const destination = audioContext.createMediaStreamDestination()
        tap.connect(destination) // deliberately not connected to speakers
        audioStream = destination.stream
        await audioContext.resume().catch(() => undefined)
      } else if (typeof video.captureStream === 'function') {
        const captured = video.captureStream().getAudioTracks()
        if (captured.length > 0) audioStream = new MediaStream(captured)
        video.muted = true
      }
      // Never silently drop real audio: if it cannot be carried, the save fails instead.
      if (!audioStream) throw new Error('The video has audio, but this runtime cannot capture it for saving.')
    }

    // buildCombinedStream (shared with the performance recorder) captures at 30 or 60 fps.
    const fps: 30 | 60 = (input.fps ?? DEFAULT_FPS) > 45 ? 60 : 30
    combined = buildCombinedStream(canvas, audioStream, fps)
    recorder = env.createRecorder(combined.stream, {
      mimeType: format.recorderMime,
      videoBitsPerSecond: bitrateFor(canvas.width, canvas.height, fps),
      ...(audioStream ? { audioBitsPerSecond: 192_000 } : {}),
    })

    const chunks: Blob[] = []
    const active = recorder
    active.ondataavailable = event => { if (event.data && event.data.size > 0) chunks.push(event.data) }
    const stopped = new Promise<void>((resolve, reject) => {
      active.onstop = () => resolve()
      active.onerror = event => reject(new Error(`Recording failed: ${(event as Event & { error?: DOMException }).error?.message ?? 'unknown error'}`))
    })

    const finished = new Promise<void>((resolve, reject) => {
      let lastTime = -1
      let lastAdvance = Date.now()
      const onAbort = () => reject(new MediaEditAbortError())
      signal?.addEventListener('abort', onAbort, { once: true })
      video.addEventListener('ended', () => resolve(), { once: true })
      video.addEventListener('error', () => reject(new Error('The video failed while it was being rendered.')), { once: true })
      stallTimer = env.setInterval(() => {
        if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastAdvance = Date.now(); return }
        if (Date.now() - lastAdvance > STALL_TIMEOUT_MS) reject(new Error('Rendering stalled. Keep this window visible while the video is saved.'))
      }, STALL_CHECK_MS)

      const schedule = () => {
        if (disposed) return
        const step = () => {
          frameHandle = null
          if (disposed) return
          drawFrame()
          input.onProgress?.(Math.min(1, video.currentTime / duration))
          if (!video.ended) schedule()
        }
        frameHandle = typeof video.requestVideoFrameCallback === 'function'
          ? video.requestVideoFrameCallback(step)
          : requestAnimationFrame(step)
      }
      schedule()
    })

    void finished.catch(() => undefined)
    void stopped.catch(() => undefined)
    active.start(1000)
    video.currentTime = 0
    await video.play()
    await finished
    // One last frame so the final picture is in the recording, then let it flush.
    drawFrame()
    input.onProgress?.(1)
    await new Promise(resolve => setTimeout(resolve, Math.ceil(2000 / fps)))
    if (active.state !== 'inactive') active.stop()
    await stopped
    if (signal?.aborted) throw new MediaEditAbortError()

    const recordedType = (active.mimeType || format.recorderMime).split(';')[0]!.trim().toLowerCase()
    if (recordedType !== format.mimeType) {
      // The recorder produced a different container than requested; never label bytes with the wrong type.
      throw new Error(`The recorder produced ${recordedType} instead of ${format.mimeType}.`)
    }
    let blob = new Blob(chunks, { type: format.mimeType })
    if (blob.size === 0) throw new Error('The rendered video is empty.')
    // MediaRecorder WebM has no duration header; MP4 already carries one.
    if (format.container === 'webm') blob = await withWebmDuration(blob, duration)

    return {
      kind: 'video',
      blob,
      mimeType: format.mimeType,
      extension: format.extension,
      width: canvas.width,
      height: canvas.height,
      durationSec: duration,
      hasAlpha: false,
      hasAudio: audioStream !== null,
    }
  } finally {
    cleanup()
  }
}

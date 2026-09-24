import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultMediaEdit } from './mediaEditModel'
import { detectVideoHasAudio, renderEditedVideo, type VideoExportEnvironment } from './mediaEditVideoExport'

class FakeTrack {
  stopped = false
  constructor(readonly kind: 'audio' | 'video') {}
  stop() { this.stopped = true }
}

class FakeStream {
  constructor(private readonly tracks: FakeTrack[] = []) {}
  getTracks() { return this.tracks }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio') }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video') }
}

interface World {
  videoTracks: FakeTrack[]
  audioTracks: FakeTrack[]
  recorderOptions: MediaRecorderOptions | null
  recorderStream: FakeStream | null
  recorderStopped: boolean
  audioContextClosed: boolean
  rendererDisposed: boolean
  videoSrcRemoved: boolean
  intervals: Set<number>
  rendered: number
}

function makeEnv(options: {
  hasAudio?: boolean
  supported?: string[]
  audioContext?: boolean
  captureFallback?: boolean
  recordedMime?: string
  playMs?: number
  duration?: number
} = {}) {
  const world: World = {
    videoTracks: [], audioTracks: [], recorderOptions: null, recorderStream: null, recorderStopped: false,
    audioContextClosed: false, rendererDisposed: false, videoSrcRemoved: false, intervals: new Set(), rendered: 0,
  }
  const supported = options.supported ?? ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
  const hasAudio = options.hasAudio ?? true

  class FakeVideo extends EventTarget {
    videoWidth = 321
    videoHeight = 181
    duration = options.duration ?? 2
    currentTime = 0
    ended = false
    paused = true
    muted = false
    crossOrigin: string | null = null
    playsInline = false
    preload = ''
    audioTracks = { length: hasAudio ? 1 : 0 }
    set src(_value: string) { queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))) }
    async play() {
      this.paused = false
      setTimeout(() => {
        this.currentTime = this.duration
        this.ended = true
        this.dispatchEvent(new Event('ended'))
      }, options.playMs ?? 30)
    }
    pause() { this.paused = true }
    removeAttribute(name: string) { if (name === 'src') world.videoSrcRemoved = true }
    load() {}
    captureStream = options.captureFallback
      ? () => { const t = new FakeTrack('audio'); world.audioTracks.push(t); return new FakeStream([t]) }
      : undefined
  }

  class FakeRecorder {
    state: 'inactive' | 'recording' = 'inactive'
    mimeType: string
    ondataavailable: ((event: { data: Blob }) => void) | null = null
    onstop: (() => void) | null = null
    onerror: ((event: unknown) => void) | null = null
    constructor(stream: FakeStream, opts: MediaRecorderOptions) {
      world.recorderStream = stream
      world.recorderOptions = opts
      this.mimeType = options.recordedMime ?? opts.mimeType ?? ''
    }
    start() { this.state = 'recording' }
    stop() {
      if (this.state === 'inactive') return
      this.state = 'inactive'
      world.recorderStopped = true
      this.ondataavailable?.({ data: new Blob([new Uint8Array(64)]) })
      queueMicrotask(() => this.onstop?.())
    }
  }

  const env: VideoExportEnvironment = {
    createVideo: () => new FakeVideo() as unknown as HTMLVideoElement,
    createCanvas: () => ({
      width: 0,
      height: 0,
      captureStream: () => {
        const track = new FakeTrack('video')
        world.videoTracks.push(track)
        return new FakeStream([track])
      },
    }) as unknown as HTMLCanvasElement,
    createRenderer: canvas => ({
      lastError: null,
      render: (input: { sourceWidth: number; sourceHeight: number }) => {
        world.rendered += 1
        canvas.width = input.sourceWidth - (input.sourceWidth % 2)
        canvas.height = input.sourceHeight - (input.sourceHeight % 2)
        return { outputWidth: canvas.width, outputHeight: canvas.height }
      },
      dispose: () => { world.rendererDisposed = true },
    }) as never,
    createRecorder: (stream, opts) => new FakeRecorder(stream as unknown as FakeStream, opts) as unknown as MediaRecorder,
    createAudioContext: () => options.audioContext === false ? null : ({
      createMediaElementSource: () => ({ connect: () => undefined }),
      createMediaStreamDestination: () => {
        const track = new FakeTrack('audio')
        world.audioTracks.push(track)
        return { stream: new FakeStream([track]) }
      },
      resume: async () => undefined,
      close: async () => { world.audioContextClosed = true },
    }) as unknown as AudioContext,
    isTypeSupported: mime => supported.includes(mime),
    setInterval: (handler, ms) => { const id = setInterval(handler, ms) as unknown as number; world.intervals.add(id); return id },
    clearInterval: id => { clearInterval(id); world.intervals.delete(id) },
  }
  return { env, world }
}

beforeEach(() => {
  vi.stubGlobal('MediaStream', FakeStream)
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 4) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle))
})

afterEach(() => { vi.unstubAllGlobals() })

const baseInput = { url: 'blob:source', edit: { ...createDefaultMediaEdit(), brightness: 10 }, sourceMimeType: 'video/mp4' }

describe('video export', () => {
  it('records real MP4 with the source audio, and the MIME type, extension and blob type agree', async () => {
    const { env, world } = makeEnv()
    const result = await renderEditedVideo(baseInput, env)

    expect(result).toMatchObject({ kind: 'video', mimeType: 'video/mp4', extension: 'mp4', hasAudio: true, durationSec: 2, hasAlpha: false })
    expect(result.blob.type).toBe('video/mp4')
    expect(world.recorderOptions?.mimeType).toMatch(/^video\/mp4/)
    // Preserves audio: the recorder was fed the video capture AND the audio tap.
    expect(world.recorderStream?.getAudioTracks()).toHaveLength(1)
    expect(world.recorderStream?.getVideoTracks()).toHaveLength(1)
    expect(world.recorderOptions?.audioBitsPerSecond).toBeGreaterThan(0)
    // Even dimensions, as H.264 requires.
    expect(result.width % 2).toBe(0)
    expect(result.height % 2).toBe(0)
    expect(world.rendered).toBeGreaterThan(0)
  })

  it('falls back to WebM honestly when MP4 cannot be recorded: extension and MIME both say webm', async () => {
    const { env } = makeEnv({ supported: ['video/webm;codecs=vp9,opus', 'video/webm'] })
    const result = await renderEditedVideo(baseInput, env)
    expect(result).toMatchObject({ mimeType: 'video/webm', extension: 'webm' })
    expect(result.blob.type).toBe('video/webm')
  })

  it('does not add an audio track when the source has none', async () => {
    const { env, world } = makeEnv({ hasAudio: false })
    const result = await renderEditedVideo(baseInput, env)
    expect(result.hasAudio).toBe(false)
    expect(world.recorderStream?.getAudioTracks()).toHaveLength(0)
    expect(world.recorderOptions?.audioBitsPerSecond).toBeUndefined()
  })

  it('fails instead of silently dropping audio it cannot capture', async () => {
    const { env, world } = makeEnv({ audioContext: false })
    await expect(renderEditedVideo(baseInput, env)).rejects.toThrow(/cannot capture it/)
    expect(world.rendererDisposed).toBe(true)
  })

  it('captures audio through the element stream when no AudioContext exists', async () => {
    const { env, world } = makeEnv({ audioContext: false, captureFallback: true })
    const result = await renderEditedVideo(baseInput, env)
    expect(result.hasAudio).toBe(true)
    expect(world.recorderStream?.getAudioTracks()).toHaveLength(1)
  })

  it('rejects a recording whose container differs from what was requested', async () => {
    const { env } = makeEnv({ recordedMime: 'video/webm;codecs=vp9' })
    await expect(renderEditedVideo(baseInput, env)).rejects.toThrow(/instead of video\/mp4/)
  })

  it('fails clearly when the runtime cannot record video at all', async () => {
    const { env } = makeEnv({ supported: [] })
    await expect(renderEditedVideo(baseInput, env)).rejects.toThrow(/cannot record video/)
  })

  it('reports progress up to 100%', async () => {
    const { env } = makeEnv()
    const seen: number[] = []
    await renderEditedVideo({ ...baseInput, onProgress: value => seen.push(value) }, env)
    expect(seen[seen.length - 1]).toBe(1)
  })

  it('releases every stream, recorder, AudioContext, renderer, timer and the video source on success', async () => {
    const { env, world } = makeEnv()
    await renderEditedVideo(baseInput, env)
    expect(world.rendererDisposed).toBe(true)
    expect(world.audioContextClosed).toBe(true)
    expect(world.videoSrcRemoved).toBe(true)
    expect(world.videoTracks.every(track => track.stopped)).toBe(true)
    expect(world.audioTracks.every(track => track.stopped)).toBe(true)
    expect(world.intervals.size).toBe(0)
  })

  it('releases everything and stops the recorder when cancelled mid-render', async () => {
    const { env, world } = makeEnv({ playMs: 5_000 })
    const controller = new AbortController()
    const pending = renderEditedVideo({ ...baseInput, signal: controller.signal }, env)
    await new Promise(resolve => setTimeout(resolve, 40))
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(world.recorderStopped).toBe(true)
    expect(world.rendererDisposed).toBe(true)
    expect(world.audioContextClosed).toBe(true)
    expect(world.videoTracks.every(track => track.stopped)).toBe(true)
    expect(world.audioTracks.every(track => track.stopped)).toBe(true)
    expect(world.intervals.size).toBe(0)
  })

  it('never starts when already aborted', async () => {
    const { env, world } = makeEnv()
    const controller = new AbortController()
    controller.abort()
    await expect(renderEditedVideo({ ...baseInput, signal: controller.signal }, env)).rejects.toMatchObject({ name: 'AbortError' })
    expect(world.recorderOptions).toBeNull()
  })
})

describe('audio detection', () => {
  it('trusts explicit track lists, and treats "unknown" as audio present so it is never dropped', () => {
    expect(detectVideoHasAudio({ audioTracks: { length: 0 } } as unknown as HTMLVideoElement)).toBe(false)
    expect(detectVideoHasAudio({ audioTracks: { length: 2 } } as unknown as HTMLVideoElement)).toBe(true)
    expect(detectVideoHasAudio({ mozHasAudio: false } as unknown as HTMLVideoElement)).toBe(false)
    expect(detectVideoHasAudio({} as unknown as HTMLVideoElement)).toBe(true)
  })

  it('probes captureStream and stops the probe tracks', () => {
    const track = new FakeTrack('audio')
    const video = { captureStream: () => new FakeStream([track]) } as unknown as HTMLVideoElement
    expect(detectVideoHasAudio(video)).toBe(true)
    expect(track.stopped).toBe(true)
    const silent = { captureStream: () => new FakeStream([new FakeTrack('video')]) } as unknown as HTMLVideoElement
    expect(detectVideoHasAudio(silent)).toBe(false)
  })
})

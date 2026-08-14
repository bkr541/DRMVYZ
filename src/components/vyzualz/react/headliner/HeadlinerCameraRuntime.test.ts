// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEADLINER_DEFAULT_CAMERA_CONSTRAINTS,
  HeadlinerCameraRuntime,
  resolveHeadlinerCameraError,
} from './HeadlinerCameraRuntime'

class FakeTrack extends EventTarget {
  readonly kind = 'video'
  readyState: MediaStreamTrackState = 'live'
  muted = false
  stop = vi.fn()
}

class FakeStream {
  constructor(readonly track: FakeTrack) {}
  getTracks = () => [this.track] as unknown as MediaStreamTrack[]
  getVideoTracks = () => [this.track] as unknown as MediaStreamTrack[]
  getAudioTracks = () => [] as MediaStreamTrack[]
}

function installMediaDevices(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia) },
  })
}

function makeVideo(): HTMLVideoElement {
  const video = document.createElement('video')
  vi.spyOn(video, 'play').mockResolvedValue(undefined)
  return video
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HeadlinerCameraRuntime', () => {
  it('requests only the preferred front-facing video source and exposes a frame source only after video data is usable', async () => {
    const track = new FakeTrack()
    const stream = new FakeStream(track) as unknown as MediaStream
    installMediaDevices(async () => stream)
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()

    await runtime.start(video)

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(HEADLINER_DEFAULT_CAMERA_CONSTRAINTS)
    expect(HEADLINER_DEFAULT_CAMERA_CONSTRAINTS.audio).toBe(false)
    expect(runtime.getSnapshot().status).toBe('requesting')
    expect(runtime.getFrameSource()).toBeNull()

    video.dispatchEvent(new Event('loadeddata'))

    expect(runtime.getSnapshot().status).toBe('live')
    expect(runtime.getFrameSource()).toMatchObject({
      slotId: 'camera-1',
      sourceId: 'default-front-camera',
      video,
      stream,
    })
  })

  it('coalesces concurrent start requests and stops every captured track on teardown', async () => {
    let resolveStream!: (stream: MediaStream) => void
    const pending = new Promise<MediaStream>(resolve => { resolveStream = resolve })
    installMediaDevices(() => pending)
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()

    const first = runtime.start(video)
    const second = runtime.start(video)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)

    const track = new FakeTrack()
    const stream = new FakeStream(track) as unknown as MediaStream
    resolveStream(stream)
    await first
    video.dispatchEvent(new Event('canplay'))
    expect(runtime.getSnapshot().status).toBe('live')

    runtime.stop()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(video.srcObject).toBeNull()
    expect(runtime.getSnapshot().status).toBe('idle')
  })

  it('does not leak a stream when unmounted while permission is still pending', async () => {
    let resolveStream!: (stream: MediaStream) => void
    const pending = new Promise<MediaStream>(resolve => { resolveStream = resolve })
    installMediaDevices(() => pending)
    const runtime = new HeadlinerCameraRuntime()
    const request = runtime.start(makeVideo())

    runtime.stop()
    const track = new FakeTrack()
    resolveStream(new FakeStream(track) as unknown as MediaStream)
    await request

    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(runtime.getSnapshot().status).toBe('idle')
    expect(runtime.getFrameSource()).toBeNull()
  })

  it('represents permission denial and lost-signal states without a fake live frame source', async () => {
    installMediaDevices(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })
    const deniedRuntime = new HeadlinerCameraRuntime()
    await deniedRuntime.start(makeVideo())

    expect(deniedRuntime.getSnapshot()).toMatchObject({
      status: 'error',
      errorCode: 'permission-denied',
    })
    expect(deniedRuntime.getFrameSource()).toBeNull()

    const track = new FakeTrack()
    const stream = new FakeStream(track) as unknown as MediaStream
    installMediaDevices(async () => stream)
    const liveRuntime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    await liveRuntime.start(video)
    video.dispatchEvent(new Event('loadeddata'))
    track.dispatchEvent(new Event('ended'))

    expect(liveRuntime.getSnapshot().status).toBe('disconnected')
    expect(liveRuntime.getFrameSource()).toBeNull()
    liveRuntime.stop()
  })

  it('freezes runtime state on ended track and reacquires exactly one replacement stream with bounded retry scheduling', async () => {
    vi.useFakeTimers()
    try {
      const firstTrack = new FakeTrack()
      const secondTrack = new FakeTrack()
      const firstStream = new FakeStream(firstTrack) as unknown as MediaStream
      const secondStream = new FakeStream(secondTrack) as unknown as MediaStream
      let requestCount = 0
      installMediaDevices(async () => {
        requestCount += 1
        return requestCount === 1 ? firstStream : secondStream
      })
      const runtime = new HeadlinerCameraRuntime()
      const video = makeVideo()
      Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })

      await runtime.start(video)
      video.dispatchEvent(new Event('loadeddata'))
      expect(runtime.getSnapshot().status).toBe('live')

      firstTrack.readyState = 'ended'
      firstTrack.dispatchEvent(new Event('ended'))
      expect(runtime.getSnapshot().status).toBe('disconnected')
      expect(runtime.getFrameSource()).toBeNull()
      expect(firstTrack.stop).toHaveBeenCalledTimes(1)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(749)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await Promise.resolve()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
      expect(runtime.getSnapshot().status).toBe('disconnected')

      video.dispatchEvent(new Event('loadeddata'))
      expect(runtime.getSnapshot().status).toBe('live')
      expect(runtime.getFrameSource()?.stream).toBe(secondStream)

      await vi.advanceTimersByTimeAsync(10_000)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
      runtime.stop()
      expect(secondTrack.stop).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('backs off failed reacquisition and stops after the bounded recovery budget', async () => {
    vi.useFakeTimers()
    try {
      const firstTrack = new FakeTrack()
      const firstStream = new FakeStream(firstTrack) as unknown as MediaStream
      let requestCount = 0
      installMediaDevices(async () => {
        requestCount += 1
        if (requestCount === 1) return firstStream
        throw new DOMException('busy', 'NotReadableError')
      })
      const runtime = new HeadlinerCameraRuntime()
      const video = makeVideo()
      Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })

      await runtime.start(video)
      video.dispatchEvent(new Event('loadeddata'))
      firstTrack.readyState = 'ended'
      firstTrack.dispatchEvent(new Event('ended'))

      await vi.advanceTimersByTimeAsync(750)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1_500)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(3)
      await vi.advanceTimersByTimeAsync(3_000)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(4)

      await vi.advanceTimersByTimeAsync(30_000)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(4)
      expect(runtime.getSnapshot().status).toBe('disconnected')
      runtime.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses mute hysteresis and resumes the existing stream without opening a duplicate capture', async () => {
    vi.useFakeTimers()
    try {
      const track = new FakeTrack()
      const stream = new FakeStream(track) as unknown as MediaStream
      installMediaDevices(async () => stream)
      const runtime = new HeadlinerCameraRuntime()
      const video = makeVideo()
      Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })

      await runtime.start(video)
      video.dispatchEvent(new Event('loadeddata'))
      track.muted = true
      track.dispatchEvent(new Event('mute'))

      await vi.advanceTimersByTimeAsync(1_499)
      expect(runtime.getSnapshot().status).toBe('live')
      await vi.advanceTimersByTimeAsync(1)
      expect(runtime.getSnapshot().status).toBe('disconnected')
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)

      track.muted = false
      track.dispatchEvent(new Event('unmute'))
      expect(runtime.getSnapshot().status).toBe('live')
      expect(runtime.getFrameSource()?.stream).toBe(stream)

      await vi.advanceTimersByTimeAsync(5_000)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
      runtime.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats video source errors as loss and uses devicechange to trigger one immediate bounded recovery attempt', async () => {
    vi.useFakeTimers()
    try {
      const firstTrack = new FakeTrack()
      const secondTrack = new FakeTrack()
      const firstStream = new FakeStream(firstTrack) as unknown as MediaStream
      const secondStream = new FakeStream(secondTrack) as unknown as MediaStream
      let requestCount = 0
      const mediaDevices = new EventTarget() as MediaDevices
      Object.assign(mediaDevices, {
        getUserMedia: vi.fn(async () => {
          requestCount += 1
          return requestCount === 1 ? firstStream : secondStream
        }),
      })
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: mediaDevices })
      const runtime = new HeadlinerCameraRuntime()
      const video = makeVideo()
      Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })

      await runtime.start(video)
      video.dispatchEvent(new Event('loadeddata'))
      expect(runtime.getSnapshot().status).toBe('live')

      video.dispatchEvent(new Event('error'))
      expect(runtime.getSnapshot().status).toBe('disconnected')
      expect(firstTrack.stop).toHaveBeenCalledTimes(1)

      mediaDevices.dispatchEvent(new Event('devicechange'))
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
      expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
      expect(runtime.getSnapshot().status).toBe('disconnected')

      video.dispatchEvent(new Event('canplay'))
      expect(runtime.getSnapshot().status).toBe('live')
      expect(runtime.getFrameSource()?.stream).toBe(secondStream)
      runtime.stop()
      expect(secondTrack.stop).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('maps unavailable-device errors to a contained operator message', () => {
    expect(resolveHeadlinerCameraError(new DOMException('missing', 'NotFoundError'))).toEqual({
      errorCode: 'unavailable',
      message: 'The default front camera is unavailable. Check that a camera is connected and not in use by another app.',
    })
  })
})

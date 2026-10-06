// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildHeadlinerCameraConstraints,
  describeHeadlinerCameraStatus,
  HEADLINER_DEFAULT_CAMERA_CONSTRAINTS,
  HEADLINER_STARTUP_FRAME_TIMEOUT_MS,
  HeadlinerCameraRuntime,
  resolveHeadlinerCameraError,
} from './HeadlinerCameraRuntime'
import type { NativeCameraAccessStatus, NativeCameraBridge } from '../../../../native/cameraAccessBridge'

class FakeTrack extends EventTarget {
  readonly kind = 'video'
  label = ''
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

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function installNativeCamera(bridge: NativeCameraBridge | null) {
  ;(window as unknown as { drmvyzNative?: unknown }).drmvyzNative = bridge ? { camera: bridge } : undefined
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  installNativeCamera(null)
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

  it('maps each failure to its own code and message instead of one blanket "unavailable"', () => {
    const resolve = (name: string, context = {}) => resolveHeadlinerCameraError(new DOMException('x', name), context)

    expect(resolve('NotAllowedError').errorCode).toBe('permission-denied')
    expect(resolve('NotAllowedError', { osAccess: 'denied' }).message).toContain('Your system is blocking camera access')
    expect(resolve('NotAllowedError', { osAccess: 'restricted' }).message).toContain('restricted')
    expect(resolve('NotFoundError').errorCode).toBe('no-camera')
    expect(resolve('NotFoundError').message).toContain('No camera was found')
    expect(resolve('OverconstrainedError', { specificDevice: true }).message).toContain('selected camera is not connected')
    expect(resolve('NotReadableError').errorCode).toBe('camera-busy')
    expect(resolve('AbortError')).toMatchObject({ errorCode: 'capture-error', message: expect.stringContaining('AbortError') })
  })

  it('titles each state for the canvas and the notification', () => {
    const title = (errorCode: Parameters<typeof describeHeadlinerCameraStatus>[0]['errorCode']) =>
      describeHeadlinerCameraStatus({ status: 'error', errorCode, message: 'm' }).title

    expect(title('permission-denied')).toBe('Camera Permission Required')
    expect(title('no-camera')).toBe('No Camera Found')
    expect(title('camera-busy')).toBe('Camera Busy')
    expect(title('no-video')).toBe('Camera Detected but Video Failed to Start')
    expect(describeHeadlinerCameraStatus({ status: 'disconnected', errorCode: null, message: null }).title).toBe('Connection Lost')
  })

  it('requests the exact device when one is chosen and the default constraints otherwise', async () => {
    expect(buildHeadlinerCameraConstraints('default-front-camera')).toBe(HEADLINER_DEFAULT_CAMERA_CONSTRAINTS)
    expect(buildHeadlinerCameraConstraints('usb-1')).toEqual({ audio: false, video: { deviceId: { exact: 'usb-1' } } })

    const track = new FakeTrack()
    track.label = 'OBS Virtual Camera'
    installMediaDevices(async () => new FakeStream(track) as unknown as MediaStream)
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    await runtime.start(video, 'obs-id')
    video.dispatchEvent(new Event('loadeddata'))

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: false, video: { deviceId: { exact: 'obs-id' } } })
    expect(runtime.getSnapshot()).toMatchObject({ status: 'live', cameraLabel: 'OBS Virtual Camera' })
    expect(runtime.getFrameSource()?.sourceId).toBe('obs-id')
    runtime.stop()
  })

  it('switches cameras by closing the old stream and opening the new one', async () => {
    const first = new FakeTrack()
    const second = new FakeTrack()
    const streams = [first, second].map(track => new FakeStream(track) as unknown as MediaStream)
    let call = 0
    installMediaDevices(async () => streams[call++])
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    await runtime.start(video)
    video.dispatchEvent(new Event('loadeddata'))

    runtime.setSource('usb-2')
    expect(first.stop).toHaveBeenCalledTimes(1)
    await flush()
    video.dispatchEvent(new Event('loadeddata'))
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: { deviceId: { exact: 'usb-2' } } })
    expect(runtime.getFrameSource()?.stream).toBe(streams[1])
    runtime.stop()
  })

  it('closes a stream that arrives after the camera choice changed', async () => {
    const resolvers: Array<(stream: MediaStream) => void> = []
    installMediaDevices(() => new Promise<MediaStream>(resolve => { resolvers.push(resolve) }))
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    void runtime.start(video)

    runtime.setSource('usb-2')
    expect(resolvers).toHaveLength(2)

    const stale = new FakeTrack()
    resolvers[0](new FakeStream(stale) as unknown as MediaStream)
    await flush()
    expect(stale.stop).toHaveBeenCalledTimes(1)

    const fresh = new FakeTrack()
    resolvers[1](new FakeStream(fresh) as unknown as MediaStream)
    await flush()
    video.dispatchEvent(new Event('loadeddata'))
    expect(fresh.stop).not.toHaveBeenCalled()
    expect(runtime.getFrameSource()?.stream).toBeDefined()
    runtime.stop()
  })

  it('retry() reopens the camera after a failure', async () => {
    const track = new FakeTrack()
    let call = 0
    installMediaDevices(async () => {
      call += 1
      if (call === 1) throw new DOMException('busy', 'NotReadableError')
      return new FakeStream(track) as unknown as MediaStream
    })
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    await runtime.start(video)
    expect(runtime.getSnapshot()).toMatchObject({ status: 'error', errorCode: 'camera-busy' })

    runtime.retry()
    await Promise.resolve()
    await Promise.resolve()
    video.dispatchEvent(new Event('loadeddata'))
    expect(runtime.getSnapshot().status).toBe('live')
    runtime.stop()
  })

  it('disconnect() releases the camera and keeps it off until connect()', async () => {
    const first = new FakeTrack()
    const second = new FakeTrack()
    const tracks = [first, second]
    installMediaDevices(async () => new FakeStream(tracks.shift() as FakeTrack) as unknown as MediaStream)
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    await runtime.start(video)
    video.dispatchEvent(new Event('loadeddata'))
    expect(runtime.getSnapshot().status).toBe('live')

    runtime.disconnect()
    expect(first.stop).toHaveBeenCalledTimes(1)
    expect(runtime.getSnapshot()).toMatchObject({ status: 'idle', userDisconnected: true })
    expect(runtime.getFrameSource()).toBeNull()
    expect(describeHeadlinerCameraStatus(runtime.getSnapshot()).title).toBe('Camera Disconnected')
    // Neither a restart of the surface nor a camera change may reopen it.
    await runtime.start(video)
    runtime.setSource('another-camera')
    await Promise.resolve()
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)

    runtime.connect()
    await Promise.resolve()
    await Promise.resolve()
    video.dispatchEvent(new Event('loadeddata'))
    expect(runtime.getSnapshot()).toMatchObject({ status: 'live', userDisconnected: false })
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
    runtime.stop()
  })

  it('reports "detected but no video" only after the full startup window', async () => {
    vi.useFakeTimers()
    try {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      const runtime = new HeadlinerCameraRuntime()
      await runtime.start(makeVideo())

      await vi.advanceTimersByTimeAsync(HEADLINER_STARTUP_FRAME_TIMEOUT_MS - 1)
      expect(runtime.getSnapshot().status).toBe('requesting')
      await vi.advanceTimersByTimeAsync(1)
      expect(runtime.getSnapshot()).toMatchObject({ status: 'error', errorCode: 'no-video' })
      expect(HEADLINER_STARTUP_FRAME_TIMEOUT_MS).toBeGreaterThan(5_000)
      runtime.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes live when the track unmutes after the first frame was already decoded', async () => {
    const track = new FakeTrack()
    track.muted = true
    installMediaDevices(async () => new FakeStream(track) as unknown as MediaStream)
    const runtime = new HeadlinerCameraRuntime()
    const video = makeVideo()
    Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })
    await runtime.start(video)

    video.dispatchEvent(new Event('loadeddata'))
    expect(runtime.getSnapshot().status).toBe('requesting')

    track.muted = false
    track.dispatchEvent(new Event('unmute'))
    expect(runtime.getSnapshot().status).toBe('live')
    runtime.stop()
  })

  describe('operating-system camera permission', () => {
    const bridge = (status: NativeCameraAccessStatus, afterRequest: NativeCameraAccessStatus = status) => {
      const calls = { request: 0 }
      installNativeCamera({
        getAccessStatus: async () => status,
        requestAccess: async () => { calls.request += 1; return afterRequest },
      })
      return calls
    }

    it('refuses to open the camera and says so when the OS has denied access', async () => {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      bridge('denied')
      const runtime = new HeadlinerCameraRuntime()
      await runtime.start(makeVideo())

      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
      expect(runtime.getSnapshot()).toMatchObject({
        status: 'error',
        errorCode: 'permission-denied',
        osAccess: 'denied',
        message: expect.stringContaining('Your system is blocking camera access'),
      })
    })

    it('reports a managed-device restriction distinctly', async () => {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      bridge('restricted')
      const runtime = new HeadlinerCameraRuntime()
      await runtime.start(makeVideo())

      expect(runtime.getSnapshot().message).toContain('restricted')
    })

    it('raises the system prompt while undecided and opens the camera once granted', async () => {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      const calls = bridge('not-determined', 'granted')
      const runtime = new HeadlinerCameraRuntime()
      const video = makeVideo()
      await runtime.start(video)
      video.dispatchEvent(new Event('loadeddata'))

      expect(calls.request).toBe(1)
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
      expect(runtime.getSnapshot()).toMatchObject({ status: 'live', osAccess: 'granted' })
      runtime.stop()
    })

    it('stays in the error state with a permission code when the prompt is refused', async () => {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      bridge('not-determined', 'denied')
      const runtime = new HeadlinerCameraRuntime()
      await runtime.start(makeVideo())

      expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
      expect(runtime.getSnapshot()).toMatchObject({ status: 'error', errorCode: 'permission-denied' })
    })

    it('still tries the browser when the OS status is unknown', async () => {
      installMediaDevices(async () => new FakeStream(new FakeTrack()) as unknown as MediaStream)
      bridge('unknown')
      const runtime = new HeadlinerCameraRuntime()
      await runtime.start(makeVideo())

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
      runtime.stop()
    })
  })
})

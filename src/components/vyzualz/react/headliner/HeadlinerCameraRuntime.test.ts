// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEADLINER_DEFAULT_CAMERA_CONSTRAINTS,
  HeadlinerCameraRuntime,
  resolveHeadlinerCameraError,
} from './HeadlinerCameraRuntime'

class FakeTrack extends EventTarget {
  readonly kind = 'video'
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
  })

  it('maps unavailable-device errors to a contained operator message', () => {
    expect(resolveHeadlinerCameraError(new DOMException('missing', 'NotFoundError'))).toEqual({
      errorCode: 'unavailable',
      message: 'The default front camera is unavailable. Check that a camera is connected and not in use by another app.',
    })
  })
})

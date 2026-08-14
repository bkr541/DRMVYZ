/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../features/trackIntelligence/TrackAnalysisCoordinator', async () => {
  const actual = await vi.importActual<typeof import('../features/trackIntelligence/TrackAnalysisCoordinator')>(
    '../features/trackIntelligence/TrackAnalysisCoordinator',
  )
  class QuietCoordinator {
    invalidate(): void {}
    cancelTrack(): void {}
    enqueue(): void {}
    prioritize(): void {}
    reanalyze(): void {}
    getDecodedBuffer(): undefined { return undefined }
  }
  return { ...actual, TrackAnalysisCoordinator: QuietCoordinator }
})

vi.mock('../audio/routing', () => ({
  buildMonitoringChain: () => {
    const node = { connect: vi.fn(), disconnect: vi.fn() }
    return { input: node, output: node, cleanup: vi.fn() }
  },
}))

vi.mock('meyda', () => ({
  default: {
    createMeydaAnalyzer: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
}))

import { useAudioEngine, type AudioEngine } from './useAudioEngine'

class FakeAudioNode {
  gain = { value: 0, setTargetAtTime: vi.fn() }
  frequency = { value: 0 }
  type = ''
  fftSize = 0
  smoothingTimeConstant = 0
  connections: unknown[] = []

  connect(destination: unknown): unknown {
    this.connections.push(destination)
    return destination
  }
  disconnect(destination?: unknown): void {
    if (destination === undefined) this.connections = []
    else this.connections = this.connections.filter(candidate => candidate !== destination)
  }
  start(): void {}
  stop(): void {}
}

class FakeMediaStreamTrack extends EventTarget {
  readyState: MediaStreamTrackState = 'live'
  readonly stopMock = vi.fn(() => { this.readyState = 'ended' })

  stop(): void { this.stopMock() }
  endFromDevice(): void {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

class FakeMediaStream {
  constructor(readonly track = new FakeMediaStreamTrack()) {}
  getTracks(): MediaStreamTrack[] { return [this.track as unknown as MediaStreamTrack] }
  getAudioTracks(): MediaStreamTrack[] { return this.getTracks() }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  static failMediaStreamSource = false

  state: AudioContextState = 'running'
  sampleRate = 48_000
  currentTime = 10
  destination = new FakeAudioNode()
  audioWorklet = { addModule: vi.fn().mockRejectedValue(new Error('worklet unavailable in test')) }
  gains: FakeAudioNode[] = []
  mediaStreamSources: FakeAudioNode[] = []

  constructor() { FakeAudioContext.instances.push(this) }

  createGain(): GainNode {
    const node = new FakeAudioNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }
  createAnalyser(): AnalyserNode { return new FakeAudioNode() as unknown as AnalyserNode }
  createChannelSplitter(): ChannelSplitterNode { return new FakeAudioNode() as unknown as ChannelSplitterNode }
  createMediaElementSource(): MediaElementAudioSourceNode {
    return new FakeAudioNode() as unknown as MediaElementAudioSourceNode
  }
  createMediaStreamSource(): MediaStreamAudioSourceNode {
    if (FakeAudioContext.failMediaStreamSource) throw new Error('media stream source failed')
    const node = new FakeAudioNode()
    this.mediaStreamSources.push(node)
    return node as unknown as MediaStreamAudioSourceNode
  }
  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    const node = new FakeAudioNode() as FakeAudioNode & { stream: MediaStream }
    node.stream = new FakeMediaStream() as unknown as MediaStream
    return node as unknown as MediaStreamAudioDestinationNode
  }
  resume(): Promise<void> { this.state = 'running'; return Promise.resolve() }
}

const fakeAudioInstances: FakeAudio[] = []
class FakeAudio {
  crossOrigin = ''
  volume = 1
  currentTime = 0
  duration = 120
  loop = false
  src = ''
  readonly pauseMock = vi.fn()
  readonly playMock = vi.fn(() => Promise.resolve())

  constructor() { fakeAudioInstances.push(this) }
  addEventListener(): void {}
  removeEventListener(): void {}
  load(): void {}
  pause(): void { this.pauseMock() }
  play(): Promise<void> { return this.playMock() }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('useAudioEngine Live Input lifecycle', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null
  let engine: AudioEngine | null = null
  let originalAudio: typeof Audio
  let originalAudioContext: typeof AudioContext
  let mediaDevicesDescriptor: PropertyDescriptor | undefined
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    originalAudio = globalThis.Audio
    originalAudioContext = globalThis.AudioContext
    mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
    fakeAudioInstances.length = 0
    FakeAudioContext.instances.length = 0
    FakeAudioContext.failMediaStreamSource = false
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    globalThis.Audio = FakeAudio as unknown as typeof Audio
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    function Harness() {
      engine = useAudioEngine()
      return React.createElement('div')
    }
    act(() => root?.render(React.createElement(Harness)))
  })

  afterEach(() => {
    if (root) act(() => root?.unmount())
    host?.remove()
    root = null
    host = null
    engine = null
    globalThis.Audio = originalAudio
    globalThis.AudioContext = originalAudioContext
    if (mediaDevicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor)
    else delete (navigator as unknown as { mediaDevices?: MediaDevices }).mediaDevices
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    vi.restoreAllMocks()
  })

  it('commits Live Input only after capture succeeds, keeps transport stopped, stays analysis-active, silent, and uses a monotonic live clock', async () => {
    const stream = new FakeMediaStream()
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream)
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'preserved.wav',
        title: 'Preserved',
        url: 'https://signed.test/preserved.wav',
        dbId: 'track-preserved',
        storagePath: 'user/track-preserved/preserved.wav',
      }])
    })
    const preservedTrackId = engine?.currentTrackId

    await act(async () => { await engine?.setSource('microphone') })

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false })
    expect(engine?.source).toBe('microphone')
    expect(engine?.liveInputActive).toBe(true)
    expect(engine?.analysisActive).toBe(true)
    expect(engine?.isActive).toBe(true)
    expect(engine?.isPlaying).toBe(false)
    expect(engine?.hasActiveProgramAudio).toBe(false)
    expect(engine?.currentTrackId).toBe(preservedTrackId)
    expect(engine?.tracks).toHaveLength(1)
    expect(fakeAudioInstances[0]?.pauseMock).toHaveBeenCalled()
    expect(engine?.getRecordingStream()).toBeNull()

    const context = FakeAudioContext.instances[0]
    expect(context).toBeDefined()
    expect(context?.mediaStreamSources).toHaveLength(1)
    const micNode = context?.mediaStreamSources[0]
    expect(micNode?.connections).toHaveLength(1)
    expect(micNode?.connections).not.toContain(context?.destination)
    // The program-output gate is the third gain created by the production graph:
    // master, reference, then source-aware program gate.
    expect(context?.gains[2]?.gain.value).toBe(0)

    expect(engine?.getCurrentTime()).toBe(0)
    if (context) context.currentTime = 12.75
    expect(engine?.getCurrentTime()).toBeCloseTo(2.75, 5)

    await act(async () => { await engine?.setSource('file') })
    expect(stream.track.stopMock).toHaveBeenCalledOnce()
    expect(engine?.source).toBe('file')
    expect(engine?.liveInputActive).toBe(false)
    expect(engine?.currentTrackId).toBe(preservedTrackId)
    expect(engine?.tracks).toHaveLength(1)
    expect(context?.gains[2]?.gain.value).toBe(1)
    expect(engine?.getRecordingStream()).not.toBeNull()
  })

  it('denial restores a previously playing File source and exposes a clear error instead of a false Live Input state', async () => {
    getUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'playing.wav',
        url: 'https://signed.test/playing.wav',
        dbId: 'track-playing',
        storagePath: 'user/track-playing/playing.wav',
      }])
    })
    await act(async () => {
      engine?.play()
      await Promise.resolve()
    })
    expect(engine?.isPlaying).toBe(true)

    await act(async () => { await engine?.setSource('microphone') })

    expect(engine?.source).toBe('file')
    expect(engine?.liveInputActive).toBe(false)
    expect(engine?.analysisActive).toBe(true)
    expect(engine?.isPlaying).toBe(true)
    expect(engine?.hasActiveProgramAudio).toBe(true)
    expect(engine?.micError).toContain('Permission denied')
    expect(FakeAudioContext.instances[0]?.gains[2]?.gain.value).toBe(1)
  })

  it('cleans up an acquired stream if Web Audio source-node initialization fails', async () => {
    const stream = new FakeMediaStream()
    getUserMedia.mockResolvedValue(stream as unknown as MediaStream)
    FakeAudioContext.failMediaStreamSource = true

    await act(async () => { await engine?.setSource('microphone') })

    expect(stream.track.stopMock).toHaveBeenCalledOnce()
    expect(engine?.source).toBe('file')
    expect(engine?.liveInputActive).toBe(false)
    expect(engine?.micError).toContain('media stream source failed')
    expect(FakeAudioContext.instances[0]?.gains[2]?.gain.value).toBe(1)
  })

  it('invalidates a pending permission request when switching back to File and stops the stale stream when it eventually resolves', async () => {
    const pending = deferred<MediaStream>()
    const stream = new FakeMediaStream()
    getUserMedia.mockReturnValue(pending.promise)
    let liveRequest: Promise<void> | undefined

    await act(async () => {
      liveRequest = engine?.setSource('microphone')
      await Promise.resolve()
    })
    await act(async () => { await engine?.setSource('file') })
    await act(async () => {
      pending.resolve(stream as unknown as MediaStream)
      await liveRequest
    })

    expect(stream.track.stopMock).toHaveBeenCalledOnce()
    expect(engine?.source).toBe('file')
    expect(engine?.liveInputActive).toBe(false)
  })

  it('recovers across grant, deny, then grant attempts without retaining the prior capture', async () => {
    const first = new FakeMediaStream()
    const second = new FakeMediaStream()
    getUserMedia
      .mockResolvedValueOnce(first as unknown as MediaStream)
      .mockRejectedValueOnce(new DOMException('Permission denied again', 'NotAllowedError'))
      .mockResolvedValueOnce(second as unknown as MediaStream)

    await act(async () => { await engine?.setSource('microphone') })
    expect(engine?.source).toBe('microphone')
    await act(async () => { await engine?.setSource('file') })
    expect(first.track.stopMock).toHaveBeenCalledOnce()

    await act(async () => { await engine?.setSource('microphone') })
    expect(engine?.source).toBe('file')
    expect(engine?.micError).toContain('Permission denied again')

    await act(async () => { await engine?.setSource('microphone') })
    expect(engine?.source).toBe('microphone')
    expect(engine?.liveInputActive).toBe(true)
    expect(engine?.micError).toBeNull()
    expect(second.track.stopMock).not.toHaveBeenCalled()
  })

  it('stops a stream that resolves after provider unmount', async () => {
    const pending = deferred<MediaStream>()
    const stream = new FakeMediaStream()
    getUserMedia.mockReturnValue(pending.promise)
    let liveRequest: Promise<void> | undefined

    await act(async () => {
      liveRequest = engine?.setSource('microphone')
      await Promise.resolve()
    })
    act(() => root?.unmount())
    root = null
    await act(async () => {
      pending.resolve(stream as unknown as MediaStream)
      await liveRequest
    })

    expect(stream.track.stopMock).toHaveBeenCalledOnce()
  })

  it('falls back to File when the live track ends and re-anchors the clock for a later capture session', async () => {
    const first = new FakeMediaStream()
    const second = new FakeMediaStream()
    getUserMedia.mockResolvedValueOnce(first as unknown as MediaStream).mockResolvedValueOnce(second as unknown as MediaStream)

    await act(async () => { await engine?.setSource('microphone') })
    const context = FakeAudioContext.instances[0]
    if (context) context.currentTime = 15
    expect(engine?.getCurrentTime()).toBeCloseTo(5, 5)

    act(() => first.track.endFromDevice())
    expect(engine?.source).toBe('file')
    expect(engine?.liveInputActive).toBe(false)
    expect(engine?.micError).toContain('ended unexpectedly')

    if (context) context.currentTime = 30
    await act(async () => { await engine?.setSource('microphone') })
    expect(engine?.getCurrentTime()).toBe(0)
    if (context) context.currentTime = 30.5
    expect(engine?.getCurrentTime()).toBeCloseTo(0.5, 5)
  })
})

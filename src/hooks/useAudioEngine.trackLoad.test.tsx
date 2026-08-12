/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../types'
import type { TrackAnalysisRuntime } from '../types'
import {
  getLastAudioSourcePolicyMessage,
  resetAudioSourcePolicyForTests,
  setAudioSourcePolicyAppView,
  setShowManagerLinkedAudioTrackId,
  SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE,
} from '../audio/audioSourcePolicy'

vi.mock('../features/trackIntelligence/TrackAnalysisCoordinator', async () => {
  const actual = await vi.importActual<typeof import('../features/trackIntelligence/TrackAnalysisCoordinator')>(
    '../features/trackIntelligence/TrackAnalysisCoordinator',
  )

  class SynchronousCoordinator {
    constructor(
      _deps: unknown,
      private readonly callbacks: {
        onRuntimeUpdate: (trackId: string, patch: Partial<TrackAnalysisRuntime>) => void
      },
    ) {}

    enqueue(track: Track): void {
      // Mirrors the real coordinator's first same-tick status publication.
      this.callbacks.onRuntimeUpdate(track.id, {
        status: 'decoding',
        error: null,
        analysisStage: 'decoding',
        analysisProgress: 0.02,
      })
    }

    invalidate(): void {}
    cancelTrack(): void {}
    prioritize(): void {}
    reanalyze(): void {}
    getDecodedBuffer(): undefined { return undefined }
  }

  return {
    ...actual,
    TrackAnalysisCoordinator: SynchronousCoordinator,
  }
})


vi.mock('../audio/routing', () => ({
  buildMonitoringChain: () => {
    const node = new FakeAudioNode()
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
  fftSize = 0
  smoothingTimeConstant = 0

  connect(): this { return this }
  disconnect(): void {}
}

class FakeAudioContext {
  state: AudioContextState = 'running'
  sampleRate = 48_000
  currentTime = 0
  destination = new FakeAudioNode()
  audioWorklet = { addModule: vi.fn().mockRejectedValue(new Error('worklet unavailable in test')) }

  createGain(): GainNode { return new FakeAudioNode() as unknown as GainNode }
  createAnalyser(): AnalyserNode { return new FakeAudioNode() as unknown as AnalyserNode }
  createChannelSplitter(): ChannelSplitterNode { return new FakeAudioNode() as unknown as ChannelSplitterNode }
  createMediaElementSource(): MediaElementAudioSourceNode {
    return new FakeAudioNode() as unknown as MediaElementAudioSourceNode
  }
  resume(): Promise<void> { this.state = 'running'; return Promise.resolve() }
}

const fakeAudioInstances: FakeAudio[] = []

class FakeAudio {
  crossOrigin = ''
  volume = 1
  currentTime = 0
  duration = 0
  loop = false
  src = ''
  readonly playMock = vi.fn(() => Promise.resolve())

  constructor() { fakeAudioInstances.push(this) }
  addEventListener(): void {}
  removeEventListener(): void {}
  load(): void {}
  pause(): void {}
  play(): Promise<void> { return this.playMock() }
}

describe('useAudioEngine track loading', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null
  let engine: AudioEngine | null = null
  let originalAudio: typeof Audio
  let originalAudioContext: typeof AudioContext
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined

  beforeEach(() => {
    resetAudioSourcePolicyForTests()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    originalAudio = globalThis.Audio
    originalAudioContext = globalThis.AudioContext
    originalCreateObjectUrl = URL.createObjectURL
    originalRevokeObjectUrl = URL.revokeObjectURL
    fakeAudioInstances.length = 0
    globalThis.Audio = FakeAudio as unknown as typeof Audio
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext
    URL.createObjectURL = vi.fn(() => 'blob:track-load-regression')
    URL.revokeObjectURL = vi.fn()

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)

    function Harness() {
      engine = useAudioEngine()
      return React.createElement('div')
    }

    act(() => {
      root?.render(React.createElement(Harness))
    })
  })

  afterEach(() => {
    act(() => root?.unmount())
    host?.remove()
    root = null
    host = null
    engine = null
    globalThis.Audio = originalAudio
    globalThis.AudioContext = originalAudioContext
    if (originalCreateObjectUrl) URL.createObjectURL = originalCreateObjectUrl
    else delete (URL as Partial<typeof URL>).createObjectURL
    if (originalRevokeObjectUrl) URL.revokeObjectURL = originalRevokeObjectUrl
    else delete (URL as Partial<typeof URL>).revokeObjectURL
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    vi.restoreAllMocks()
    resetAudioSourcePolicyForTests()
  })

  it('keeps a newly selected file when analysis publishes decoding synchronously', () => {
    const file = new File(['audio'], 'test-track.wav', { type: 'audio/wav' })

    act(() => {
      engine?.addPreparedTracks([{ file }])
    })

    expect(engine?.tracks).toHaveLength(1)
    expect(engine?.tracks[0]?.name).toBe('test-track.wav')
    expect(engine?.tracks[0]?.analysisRuntime.status).toBe('decoding')
    expect(engine?.currentIndex).toBe(0)
  })


  it('can replace a remote track and play it in the same tick', async () => {
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'reverie.wav',
        title: 'Reverie',
        url: 'https://signed.test/reverie.wav',
        dbId: 'track-a',
        storagePath: 'user/track-a/reverie.wav',
      }])
      engine?.play()
    })

    await act(async () => { await Promise.resolve() })

    expect(fakeAudioInstances[0]?.src).toBe('https://signed.test/reverie.wav')
    expect(fakeAudioInstances[0]?.playMock).toHaveBeenCalledOnce()
    expect(engine?.currentAudioTrackId).toBe('track-a')
    expect(engine?.isPlaying).toBe(true)
  })

  it('rejects source replacement at the engine boundary while Show Manager owns the linked track', () => {
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'linked.wav',
        title: 'Linked',
        url: 'https://signed.test/linked.wav',
        dbId: 'track-b',
        storagePath: 'user/track-b/linked.wav',
      }])
    })
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')

    act(() => {
      engine?.replaceTrackUrls([{
        name: 'blocked.wav',
        title: 'Blocked',
        url: 'https://signed.test/blocked.wav',
        dbId: 'track-c',
        storagePath: 'user/track-c/blocked.wav',
      }])
    })

    expect(engine?.currentAudioTrackId).toBe('track-b')
    expect(engine?.tracks).toHaveLength(1)
    expect(engine?.tracks[0]?.dbId).toBe('track-b')
    expect(getLastAudioSourcePolicyMessage()).toBe(SHOW_MANAGER_AUDIO_SOURCE_LOCK_MESSAGE)
  })

  it('allows the explicit Show-open authority to replace the canonical source', () => {
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'track-a.wav',
        url: 'https://signed.test/track-a.wav',
        dbId: 'track-a',
        storagePath: 'user/track-a/track-a.wav',
      }])
    })
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')

    act(() => {
      engine?.replaceTrackUrls([{
        name: 'track-b.wav',
        url: 'https://signed.test/track-b.wav',
        dbId: 'track-b',
        storagePath: 'user/track-b/track-b.wav',
      }], { authority: 'showManagerLinkedTrack' })
    })

    expect(engine?.currentAudioTrackId).toBe('track-b')
    expect(engine?.tracks[0]?.dbId).toBe('track-b')
  })

  it('permits linked-track transport but refuses play and seek against an unrelated active source', async () => {
    act(() => {
      engine?.replaceTrackUrls([{
        name: 'linked.wav',
        url: 'https://signed.test/linked.wav',
        dbId: 'track-b',
        storagePath: 'user/track-b/linked.wav',
      }])
    })
    setAudioSourcePolicyAppView('showManager')
    setShowManagerLinkedAudioTrackId('track-b')

    act(() => engine?.seek(12))
    act(() => engine?.play())
    await act(async () => { await Promise.resolve() })

    expect(fakeAudioInstances[0]?.currentTime).toBe(12)
    expect(fakeAudioInstances[0]?.playMock).toHaveBeenCalledOnce()

    setShowManagerLinkedAudioTrackId('track-c')
    act(() => engine?.seek(44))
    act(() => engine?.play())
    await act(async () => { await Promise.resolve() })

    expect(fakeAudioInstances[0]?.currentTime).toBe(12)
    expect(fakeAudioInstances[0]?.playMock).toHaveBeenCalledOnce()
  })

})

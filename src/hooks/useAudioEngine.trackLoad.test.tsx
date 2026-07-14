/** @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../types'
import type { TrackAnalysisRuntime } from '../types'

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

import { useAudioEngine, type AudioEngine } from './useAudioEngine'

class FakeAudio {
  crossOrigin = ''
  volume = 1
  currentTime = 0
  duration = 0
  loop = false
  src = ''

  addEventListener(): void {}
  removeEventListener(): void {}
  load(): void {}
  pause(): void {}
  play(): Promise<void> { return Promise.resolve() }
}

describe('useAudioEngine track loading', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null
  let engine: AudioEngine | null = null
  let originalAudio: typeof Audio
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined
  let originalRevokeObjectUrl: typeof URL.revokeObjectURL | undefined

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    originalAudio = globalThis.Audio
    originalCreateObjectUrl = URL.createObjectURL
    originalRevokeObjectUrl = URL.revokeObjectURL
    globalThis.Audio = FakeAudio as unknown as typeof Audio
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
    if (originalCreateObjectUrl) URL.createObjectURL = originalCreateObjectUrl
    else delete (URL as Partial<typeof URL>).createObjectURL
    if (originalRevokeObjectUrl) URL.revokeObjectURL = originalRevokeObjectUrl
    else delete (URL as Partial<typeof URL>).revokeObjectURL
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    vi.restoreAllMocks()
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
})

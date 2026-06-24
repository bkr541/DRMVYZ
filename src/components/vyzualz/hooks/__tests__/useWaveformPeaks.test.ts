// @vitest-environment jsdom
// React 18 act() requires IS_REACT_ACT_ENVIRONMENT = true when running in jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useWaveformPeaks } from '../useWaveformPeaks'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFakeBuffer(numSamples = 4410): AudioBuffer {
  const channel = new Float32Array(numSamples).fill(0.5)
  return {
    duration:         numSamples / 44100,
    numberOfChannels: 1,
    sampleRate:       44100,
    length:           numSamples,
    getChannelData:   vi.fn(() => channel),
  } as unknown as AudioBuffer
}

interface HookResult {
  peaks:   number[] | null
  loading: boolean
}

interface TestProps {
  trackId:     string | null
  audioBuffer: AudioBuffer | null | undefined
  trackUrl:    string | null
}

// Renders useWaveformPeaks inside a minimal component and captures results.
// Re-render by calling root.render() with a new TestComp props via act().
function TestComp({ trackId, audioBuffer, trackUrl, onResult }: TestProps & {
  onResult: (r: HookResult) => void
}) {
  const r = useWaveformPeaks(trackId, audioBuffer, trackUrl)
  onResult(r)
  return null
}

let container: HTMLElement
let root: ReturnType<typeof createRoot>
let result: HookResult

function renderHook(props: TestProps) {
  root.render(
    React.createElement(TestComp, {
      ...props,
      onResult: (r: HookResult) => { result = r },
    }),
  )
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  result    = { peaks: null, loading: false }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useWaveformPeaks — buffer fast path', () => {
  it('does not call fetch when an engine AudioBuffer is provided', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const buffer = makeFakeBuffer()

    await act(async () => {
      renderHook({ trackId: 'buf-test-1', audioBuffer: buffer, trackUrl: null })
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not call OfflineAudioContext.decodeAudioData when buffer is provided', async () => {
    const decodeAudioData = vi.fn()
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({ decodeAudioData })))
    vi.stubGlobal('fetch', vi.fn())

    const buffer = makeFakeBuffer()

    await act(async () => {
      renderHook({ trackId: 'buf-test-2', audioBuffer: buffer, trackUrl: null })
    })

    expect(decodeAudioData).not.toHaveBeenCalled()
  })

  it('returns non-null peaks computed synchronously from the engine buffer', async () => {
    vi.stubGlobal('fetch', vi.fn())

    const buffer = makeFakeBuffer(4410)

    await act(async () => {
      renderHook({ trackId: 'buf-test-3', audioBuffer: buffer, trackUrl: 'https://x.test/a.mp3' })
    })

    expect(result.peaks).not.toBeNull()
    expect(result.peaks!.length).toBe(1000)
    expect(result.loading).toBe(false)
  })
})

describe('useWaveformPeaks — URL fallback', () => {
  it('fetches and decodes from URL when no buffer is available', async () => {
    const fakeBuffer = makeFakeBuffer()
    const fetchSpy   = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    })
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue(fakeBuffer),
    })))

    await act(async () => {
      renderHook({
        trackId:     'url-test-1',
        audioBuffer: undefined,
        trackUrl:    'https://example.test/track.mp3',
      })
    })

    // Async resolution needs another tick
    await act(async () => {})

    expect(fetchSpy).toHaveBeenCalledWith('https://example.test/track.mp3')
    expect(result.peaks).not.toBeNull()
    expect(result.loading).toBe(false)
  })

  it('returns null peaks when no buffer and no URL are provided', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await act(async () => {
      renderHook({ trackId: 'url-test-2', audioBuffer: undefined, trackUrl: null })
    })

    expect(result.peaks).toBeNull()
    expect(result.loading).toBe(false)
  })
})

describe('useWaveformPeaks — stale result cancellation on track change', () => {
  it('ignores stale URL fetch results after track ID changes', async () => {
    // Slow fetch that we can resolve manually
    let resolveArrayBuffer!: (v: ArrayBuffer) => void
    const slowFetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockImplementation(
        () => new Promise<ArrayBuffer>(resolve => { resolveArrayBuffer = resolve }),
      ),
    })
    vi.stubGlobal('fetch', slowFetch)
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue(makeFakeBuffer()),
    })))

    // Mount with track-A (no buffer, URL fetch in flight)
    await act(async () => {
      renderHook({
        trackId:     'stale-track-A',
        audioBuffer: undefined,
        trackUrl:    'https://stale.test/a.mp3',
      })
    })
    expect(slowFetch).toHaveBeenCalledTimes(1)

    // Switch to track-B (buffer available — no fetch needed)
    const bufferB = makeFakeBuffer()
    await act(async () => {
      renderHook({
        trackId:     'stale-track-B',
        audioBuffer: bufferB,
        trackUrl:    'https://stale.test/b.mp3',
      })
    })

    // track-B peaks should already be set from the buffer
    expect(result.peaks).not.toBeNull()
    const peaksBSnapshot = result.peaks!.slice()

    // Now resolve track-A's stale fetch — cleanup should have set cancelled=true
    await act(async () => {
      resolveArrayBuffer(new ArrayBuffer(8))
    })
    await act(async () => {})

    // Peaks must still reflect track-B, not a stale update from track-A
    expect(result.peaks).toEqual(peaksBSnapshot)
    // URL for track-A should not have been called a second time
    expect(slowFetch).toHaveBeenCalledTimes(1)
  })

  it('starts a fresh fetch for the new track after a track change', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    })
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('OfflineAudioContext', vi.fn(() => ({
      decodeAudioData: vi.fn().mockResolvedValue(makeFakeBuffer()),
    })))

    // Track-A: no buffer, trigger URL fetch
    await act(async () => {
      renderHook({
        trackId:     'fresh-track-A',
        audioBuffer: undefined,
        trackUrl:    'https://fresh.test/a.mp3',
      })
    })
    await act(async () => {})
    expect(fetchSpy).toHaveBeenCalledWith('https://fresh.test/a.mp3')

    fetchSpy.mockClear()

    // Track-B: no buffer either, different URL
    await act(async () => {
      renderHook({
        trackId:     'fresh-track-B',
        audioBuffer: undefined,
        trackUrl:    'https://fresh.test/b.mp3',
      })
    })
    await act(async () => {})
    expect(fetchSpy).toHaveBeenCalledWith('https://fresh.test/b.mp3')
  })
})

describe('useWaveformPeaks — buffer arrival while fetch in flight', () => {
  it('cancels the in-flight URL fetch when the engine buffer arrives for the same track', async () => {
    // Slow fetch that never resolves during this test
    const fetchSpy = vi.fn().mockImplementation(() => new Promise(() => { /* never resolves */ }))
    vi.stubGlobal('fetch', fetchSpy)

    // First render: no buffer, starts URL fetch
    await act(async () => {
      renderHook({
        trackId:     'arrival-track-1',
        audioBuffer: undefined,
        trackUrl:    'https://arrival.test/t.mp3',
      })
    })
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(result.peaks).toBeNull()

    // Engine buffer arrives (same track ID) — effect re-runs with new audioBuffer dep
    const buffer = makeFakeBuffer()
    await act(async () => {
      renderHook({
        trackId:     'arrival-track-1',
        audioBuffer: buffer,
        trackUrl:    'https://arrival.test/t.mp3',
      })
    })

    // Peaks should now come from the buffer, not the stalled fetch
    expect(result.peaks).not.toBeNull()
    expect(result.loading).toBe(false)
    // No additional fetch call (old fetch was abandoned via cancelled flag)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

// @vitest-environment jsdom
// React 18 act() requires IS_REACT_ACT_ENVIRONMENT = true when running in jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import Peaks from 'peaks.js'
import { PeaksWaveformView, syncCueMarkers } from '../PeaksWaveformView'
import type { AudioEngine } from '../../../../hooks/useAudioEngine'
import type { VzCueMarker } from '../../../../types/cue'
import type { PeaksInstance } from 'peaks.js'

// ── Mock peaks.js ─────────────────────────────────────────────────────────────

const mockPointsAdd    = vi.fn()
const mockPointsRemove = vi.fn()
const mockZoomSetZoom  = vi.fn()
const mockZoomFit      = vi.fn()
const mockOverviewFit  = vi.fn()
const mockInstanceOn   = vi.fn()
const mockDestroy      = vi.fn()

const mockInstance: Partial<PeaksInstance> = {
  destroy: mockDestroy,
  points:  {
    add:       mockPointsAdd,
    removeAll: mockPointsRemove,
    getPoints: vi.fn(() => []),
  } as unknown as PeaksInstance['points'],
  views: {
    getView: vi.fn((name: string) => {
      if (name === 'zoomview') return { setZoom: mockZoomSetZoom, fitToContainer: mockZoomFit }
      if (name === 'overview') return { fitToContainer: mockOverviewFit }
      return null
    }),
  } as unknown as PeaksInstance['views'],
  on:  mockInstanceOn,
  off: vi.fn(),
}

let capturedCb: ((err: Error | null, inst?: PeaksInstance) => void) | null = null

vi.mock('peaks.js', () => ({
  default: {
    init: vi.fn((_opts: unknown, cb: (err: Error | null, inst?: PeaksInstance) => void) => {
      capturedCb = cb
    }),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBuffer(): AudioBuffer {
  return { duration: 120, numberOfChannels: 2, sampleRate: 44100, length: 5292000 } as AudioBuffer
}

function makeEngine(overrides: Partial<AudioEngine> = {}): AudioEngine {
  return {
    play:                  vi.fn(),
    pause:                 vi.fn(),
    seek:                  vi.fn(),
    getCurrentTime:        vi.fn(() => 0),
    duration:              120,
    isPlaying:             false,
    currentAnalysisStatus: 'complete',
    currentTrack:          { id: 'track-1', displayName: 'Test' } as unknown as AudioEngine['currentTrack'],
    getDecodedBuffer:      vi.fn(() => makeBuffer()),
    ...overrides,
  } as unknown as AudioEngine
}

const MARKERS: VzCueMarker[] = [
  { id: 'c1', label: 'Intro', time: 5,  type: 'intro', color: '#ff0000' },
  { id: 'c2', label: 'Drop',  time: 60, type: 'drop',  color: '#00ff00' },
]

let container: HTMLElement
let root: ReturnType<typeof createRoot>

async function mount(engine: AudioEngine, markers = MARKERS, zoom = 1) {
  await act(async () => {
    root.render(
      <PeaksWaveformView engine={engine} cueMarkers={markers} waveformZoom={zoom} />
    )
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  capturedCb = null
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.stubGlobal('requestAnimationFrame', vi.fn())
  vi.stubGlobal('cancelAnimationFrame',  vi.fn())
  vi.stubGlobal('ResizeObserver', vi.fn(() => ({
    observe:    vi.fn(),
    unobserve:  vi.fn(),
    disconnect: vi.fn(),
  })))
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
})

// ── syncCueMarkers (pure helper) ──────────────────────────────────────────────

describe('syncCueMarkers', () => {
  it('clears all points then adds new ones', () => {
    syncCueMarkers(mockInstance as PeaksInstance, MARKERS)
    expect(mockPointsRemove).toHaveBeenCalledOnce()
    expect(mockPointsAdd).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'c1', time: 5,  labelText: 'Intro' }),
        expect.objectContaining({ id: 'c2', time: 60, labelText: 'Drop'  }),
      ]),
    )
  })

  it('clears but does not call add when markers array is empty', () => {
    syncCueMarkers(mockInstance as PeaksInstance, [])
    expect(mockPointsRemove).toHaveBeenCalledOnce()
    expect(mockPointsAdd).not.toHaveBeenCalled()
  })

  it('maps marker color to point color with fallback', () => {
    syncCueMarkers(mockInstance as PeaksInstance, [
      { id: 'x', label: 'X', time: 1, type: 'custom' },  // no color
    ])
    expect(mockPointsAdd).toHaveBeenCalledWith([
      expect.objectContaining({ color: '#b84fc9' }),
    ])
  })

  it('sets editable: false on every point', () => {
    syncCueMarkers(mockInstance as PeaksInstance, MARKERS)
    const added = vi.mocked(mockPointsAdd).mock.calls[0][0] as unknown[]
    expect((added as Array<{ editable: boolean }>).every(p => p.editable === false)).toBe(true)
  })
})

// ── PeaksWaveformView component ───────────────────────────────────────────────

describe('PeaksWaveformView', () => {
  describe('initialization', () => {
    it('calls Peaks.init when track and buffer are present', async () => {
      await mount(makeEngine())
      expect(Peaks.init).toHaveBeenCalledOnce()
    })

    it('does not call Peaks.init when currentTrack is null', async () => {
      await mount(makeEngine({ currentTrack: null }))
      expect(Peaks.init).not.toHaveBeenCalled()
    })

    it('does not call Peaks.init when getDecodedBuffer returns undefined', async () => {
      await mount(makeEngine({ getDecodedBuffer: vi.fn(() => undefined) }))
      expect(Peaks.init).not.toHaveBeenCalled()
    })

    it('shows fallback canvas before Peaks.init callback fires', async () => {
      await mount(makeEngine())
      expect(container.querySelector('.vz-peaks-fallback')).not.toBeNull()
    })

    it('removes fallback after successful callback', async () => {
      await mount(makeEngine())
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      expect(container.querySelector('.vz-peaks-fallback')).toBeNull()
    })

    it('passes webAudio.audioBuffer to Peaks.init', async () => {
      const buffer = makeBuffer()
      await mount(makeEngine({ getDecodedBuffer: vi.fn(() => buffer) }))
      const opts = vi.mocked(Peaks.init).mock.calls[0][0] as Record<string, unknown>
      expect((opts.webAudio as Record<string, unknown>).audioBuffer).toBe(buffer)
    })

    it('syncs cue markers after init callback', async () => {
      await mount(makeEngine())
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      expect(mockPointsRemove).toHaveBeenCalled()
      expect(mockPointsAdd).toHaveBeenCalled()
    })
  })

  describe('fallback on error', () => {
    it('keeps fallback canvas when Peaks.init callback returns an error', async () => {
      await mount(makeEngine())
      await act(async () => { capturedCb?.(new Error('oops')) })
      expect(container.querySelector('.vz-peaks-fallback')).not.toBeNull()
    })
  })

  describe('track-change cleanup', () => {
    it('destroys the existing instance when track ID changes', async () => {
      const eng1 = makeEngine()
      await mount(eng1)
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      vi.clearAllMocks()
      capturedCb = null

      const eng2 = makeEngine({
        currentTrack: { id: 'track-2', displayName: 'T2' } as unknown as AudioEngine['currentTrack'],
      })
      await act(async () => {
        root.render(
          <PeaksWaveformView engine={eng2} cueMarkers={[]} waveformZoom={1} />
        )
      })
      expect(mockDestroy).toHaveBeenCalled()
    })
  })

  describe('cue marker re-sync', () => {
    it('calls syncCueMarkers again when cueMarkers prop changes', async () => {
      await mount(makeEngine())
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      vi.clearAllMocks()

      const newMarkers: VzCueMarker[] = [{ id: 'c3', label: 'Bridge', time: 90, type: 'break' }]
      await act(async () => {
        root.render(
          <PeaksWaveformView engine={makeEngine()} cueMarkers={newMarkers} waveformZoom={1} />
        )
      })
      expect(mockPointsRemove).toHaveBeenCalled()
      expect(mockPointsAdd).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'c3' })]),
      )
    })
  })

  describe('zoom sync', () => {
    it('calls setZoom with duration / waveformZoom seconds', async () => {
      await mount(makeEngine({ duration: 120 }))
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      vi.clearAllMocks()

      await act(async () => {
        root.render(<PeaksWaveformView engine={makeEngine({ duration: 120 })} cueMarkers={[]} waveformZoom={2} />)
      })
      // 120 / 2 = 60 seconds
      expect(mockZoomSetZoom).toHaveBeenCalledWith({ seconds: 60 })
    })
  })

  describe('unmount cleanup', () => {
    it('destroys the Peaks instance on unmount', async () => {
      await mount(makeEngine())
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      vi.clearAllMocks()

      await act(async () => { root.unmount() })
      expect(mockDestroy).toHaveBeenCalled()
      // Recreate root so afterEach cleanup doesn't error
      root = createRoot(container)
    })

    it('discards a stale init callback fired after unmount', async () => {
      await mount(makeEngine())
      await act(async () => { root.unmount() })
      // Replace root so afterEach can unmount safely
      root = createRoot(container)

      vi.clearAllMocks()
      await act(async () => { capturedCb?.(null, mockInstance as PeaksInstance) })
      // Stale guard incremented the gen — should have destroyed the instance
      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})

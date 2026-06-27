import { describe, expect, it, vi } from 'vitest'
import { isReactTransportPaused } from '../reactTransportState'
import { renderReactEngine } from '../renderers/ReactEngineRenderer'
import { DEFAULT_REACT_RENDER_PARAMS } from '../renderers/reactRenderUtils'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import type { ReactFrameContext } from '../renderers/reactRenderUtils'

describe('isReactTransportPaused', () => {
  it('returns true for a non-terminal playhead while playback is paused', () => {
    expect(isReactTransportPaused({
      isPlaying: false,
      currentTimeSec: 42,
      durationSec: 180,
    })).toBe(true)
  })

  it('returns false while playback is active', () => {
    expect(isReactTransportPaused({
      isPlaying: true,
      currentTimeSec: 42,
      durationSec: 180,
    })).toBe(false)
  })

  it('returns false at the stopped/initial position', () => {
    expect(isReactTransportPaused({
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: 180,
    })).toBe(false)
  })

  it('returns false at natural track end', () => {
    expect(isReactTransportPaused({
      isPlaying: false,
      currentTimeSec: 179.99,
      durationSec: 180,
    })).toBe(false)
  })

  it('treats a non-zero playhead as paused when duration is not known yet', () => {
    expect(isReactTransportPaused({
      isPlaying: false,
      currentTimeSec: 5,
      durationSec: 0,
    })).toBe(true)
  })

  it('handles invalid timing values without producing a false pause', () => {
    expect(isReactTransportPaused({
      isPlaying: false,
      currentTimeSec: Number.NaN,
      durationSec: Number.POSITIVE_INFINITY,
    })).toBe(false)
  })
})

describe('renderReactEngine pause hold', () => {
  it('does not mutate the canvas when a frame is marked paused', () => {
    const ctx = {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    const frame: ReactFrameContext = {
      W: 1280,
      H: 720,
      dpr: 1,
      t: 100,
      timeSec: 10,
      audioTime: 10,
      bpm: 120,
      beatPhase: 0.5,
      beatHit: false,
      isPlaying: false,
      isPaused: true,
      audio: { bass: 0.4, mid: 0.3, high: 0.2, volume: 0.4 },
      freqData: null,
      timeDomainData: null,
      musicIntelligence: null,
    }

    renderReactEngine(
      ctx,
      frame,
      DEFAULT_REACT_PRESETS[0],
      DEFAULT_REACT_RENDER_PARAMS,
      [],
    )

    expect(ctx.fillRect).not.toHaveBeenCalled()
    expect(ctx.clearRect).not.toHaveBeenCalled()
    expect(ctx.save).not.toHaveBeenCalled()
  })
})

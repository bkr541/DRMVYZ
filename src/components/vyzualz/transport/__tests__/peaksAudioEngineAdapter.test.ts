import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PeaksAudioEngineAdapter } from '../peaksAudioEngineAdapter'
import type { AudioEngine } from '../../../../hooks/useAudioEngine'
import type { EventEmitterForPlayerEvents } from 'peaks.js'

// ── RAF mock ──────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []
let rafIdCounter = 0

beforeEach(() => {
  rafQueue = []
  rafIdCounter = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return ++rafIdCounter
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => {
    rafQueue = []
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function flushRaf(count = 1): void {
  for (let i = 0; i < count; i++) {
    const cbs = [...rafQueue]
    rafQueue = []
    cbs.forEach(cb => cb(0))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEngine(overrides: Partial<AudioEngine> = {}): { current: AudioEngine } {
  const engine: Partial<AudioEngine> = {
    play:           vi.fn(),
    pause:          vi.fn(),
    seek:           vi.fn(),
    getCurrentTime: vi.fn(() => 10),
    duration:       120,
    isPlaying:      false,
    ...overrides,
  }
  return { current: engine as AudioEngine }
}

function makeEmitter() {
  return { emit: vi.fn() } as unknown as EventEmitterForPlayerEvents
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PeaksAudioEngineAdapter', () => {
  describe('init', () => {
    it('emits player.canplay when engine has duration > 0', async () => {
      const engineRef = makeEngine({ duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      expect(emitter.emit).toHaveBeenCalledWith('player.canplay')
    })

    it('does not emit player.canplay when duration is 0', async () => {
      const engineRef = makeEngine({ duration: 0 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })

  describe('play', () => {
    it('calls engine.play() and emits player.playing', async () => {
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => 5) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      expect(engineRef.current.play).toHaveBeenCalledOnce()
      expect(emitter.emit).toHaveBeenCalledWith('player.playing', 5)
    })

    it('starts the RAF loop', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 1) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      expect(requestAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('pause', () => {
    it('calls engine.pause() and emits player.pause', async () => {
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => 8) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.pause()
      expect(engineRef.current.pause).toHaveBeenCalledOnce()
      expect(emitter.emit).toHaveBeenCalledWith('player.pause', 8)
    })

    it('stops the RAF loop when paused', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 1) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      await adapter.play()

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.pause()
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('seek', () => {
    it('calls engine.seek() and emits player.seeked', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.seek(42)
      expect(engineRef.current.seek).toHaveBeenCalledWith(42)
      expect(emitter.emit).toHaveBeenCalledWith('player.seeked', 42)
    })

    it('isSeeking() returns false after seek completes (synchronous seek)', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)

      adapter.seek(30)
      expect(adapter.isSeeking()).toBe(false)
    })
  })

  describe('getCurrentTime / getDuration / isPlaying', () => {
    it('getCurrentTime delegates to engine.getCurrentTime()', async () => {
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => 77) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      expect(adapter.getCurrentTime()).toBe(77)
    })

    it('getDuration reads engine.duration', () => {
      const engineRef = makeEngine({ duration: 240 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      expect(adapter.getDuration()).toBe(240)
    })

    it('isPlaying reflects engine.isPlaying', () => {
      const engineRef = makeEngine({ isPlaying: true })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      expect(adapter.isPlaying()).toBe(true)
    })

    it('returns safe defaults when engineRef.current is null', () => {
      const ref: { current: AudioEngine | null } = { current: null }
      const adapter = new PeaksAudioEngineAdapter(ref)
      expect(adapter.getCurrentTime()).toBe(0)
      expect(adapter.getDuration()).toBe(0)
      expect(adapter.isPlaying()).toBe(false)
    })
  })

  describe('RAF loop — player.timeupdate', () => {
    it('emits player.timeupdate on each animation frame while playing', async () => {
      let time = 10
      const engineRef = makeEngine({
        isPlaying:      true,
        getCurrentTime: vi.fn(() => time),
        duration:       120,
      })
      const adapter = new PeaksAudioEngineAdapter(engineRef)
      const emitter = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 10)

      time = 15
      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 15)
    })

    it('stops the loop and emits player.ended when near end of track', async () => {
      let time = 119.9   // within 0.15s of 120s duration
      const engineRef = makeEngine({
        isPlaying:      true,
        getCurrentTime: vi.fn(() => time),
        duration:       120,
      })
      const adapter = new PeaksAudioEngineAdapter(engineRef)
      const emitter = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.ended')
      // No further RAF should be queued
      const queueLengthAfterEnd = rafQueue.length
      flushRaf(2)
      expect(rafQueue.length).toBe(queueLengthAfterEnd)
    })
  })

  describe('notifyPlayState', () => {
    it('emits player.playing and starts RAF when playing=true', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 3) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(true)
      expect(emitter.emit).toHaveBeenCalledWith('player.playing', 3)
      expect(requestAnimationFrame).toHaveBeenCalled()
    })

    it('emits player.pause and stops RAF when playing=false', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 5) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      await adapter.play()
      vi.mocked(emitter.emit).mockClear()

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      expect(emitter.emit).toHaveBeenCalledWith('player.pause', 5)
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })
  })

  describe('notifyCanPlay', () => {
    it('emits player.canplay', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyCanPlay()
      expect(emitter.emit).toHaveBeenCalledWith('player.canplay')
    })
  })

  describe('destroy', () => {
    it('stops the RAF loop and clears the emitter', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 1) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      await adapter.play()
      vi.mocked(emitter.emit).mockClear()

      adapter.destroy()
      expect(cancelAnimationFrame).toHaveBeenCalled()

      // After destroy, no events should be emitted
      flushRaf(3)
      expect(emitter.emit).not.toHaveBeenCalled()
    })

    it('no-ops on play/pause/seek after destroy', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.destroy()
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      adapter.pause()
      adapter.seek(10)
      expect(engineRef.current.play).not.toHaveBeenCalled()
      expect(engineRef.current.pause).not.toHaveBeenCalled()
      expect(engineRef.current.seek).not.toHaveBeenCalled()
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })
})

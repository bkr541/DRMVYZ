import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PeaksAudioEngineAdapter } from '../peaksAudioEngineAdapter'
import type { AudioEngine } from '../../../../hooks/useAudioEngine'
import type { EventEmitterForPlayerEvents } from 'peaks.js'

// ── RAF mock ──────────────────────────────────────────────────────────────────

let rafQueue: FrameRequestCallback[] = []
let rafIdCounter = 0

beforeEach(() => {
  rafQueue     = []
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
    rafQueue  = []
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

  // ── play() commands only — events come later via notifyPlayState ───────────

  describe('play', () => {
    it('calls engine.play()', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      expect(engineRef.current.play).toHaveBeenCalledOnce()
    })

    it('does not emit player.playing or start RAF — events deferred to notifyPlayState', async () => {
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => 5) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      await adapter.play()
      expect(emitter.emit).not.toHaveBeenCalled()
      expect(requestAnimationFrame).not.toHaveBeenCalled()
    })
  })

  // ── pause() commands only — events come later via notifyPlayState ──────────

  describe('pause', () => {
    it('calls engine.pause()', async () => {
      const engineRef = makeEngine()
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.pause()
      expect(engineRef.current.pause).toHaveBeenCalledOnce()
    })

    it('does not emit player.pause or stop RAF — events deferred to notifyPlayState', async () => {
      // First get playing via notifyPlayState so RAF is running
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 1) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()
      const rafCallsBefore = vi.mocked(requestAnimationFrame).mock.calls.length

      adapter.pause()
      expect(emitter.emit).not.toHaveBeenCalled()
      // cancelAnimationFrame not called by pause() directly
      expect(cancelAnimationFrame).not.toHaveBeenCalled()
      // No new RAF queued either
      expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(rafCallsBefore)
    })
  })

  // ── seek ──────────────────────────────────────────────────────────────────

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

    it('resets ended state so player.ended can fire again after seeking back', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 119.99), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      // RAF detects end and emits player.ended (_endedEmitted = true, _prevPlaying = true)
      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.ended')
      vi.mocked(emitter.emit).mockClear()

      // Engine stops naturally (isPlaying → false at the same currentTime).
      // _endedEmitted is still true here so notifyPlayState emits nothing.
      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)

      // User seeks back to 0 — this resets _endedEmitted so ended can fire again.
      adapter.seek(0)

      // Engine resumes from t=0
      engineRef.current = {
        ...engineRef.current,
        isPlaying:      true,
        getCurrentTime: vi.fn(() => 0),
      } as AudioEngine
      adapter.notifyPlayState(true)   // _prevPlaying: false → true, resets _endedEmitted, starts RAF
      vi.mocked(emitter.emit).mockClear()

      // RAF fires at t=1 — well before the end, so only timeupdate fires
      engineRef.current = { ...engineRef.current, getCurrentTime: vi.fn(() => 1) } as AudioEngine
      flushRaf(1)
      expect(emitter.emit).not.toHaveBeenCalledWith('player.ended')
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 1)
    })
  })

  // ── getCurrentTime / getDuration / isPlaying ──────────────────────────────

  describe('getCurrentTime / getDuration / isPlaying', () => {
    it('getCurrentTime delegates to engine.getCurrentTime()', () => {
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

  // ── notifyPlayState — the authoritative event source ─────────────────────

  describe('notifyPlayState', () => {
    it('emits exactly one player.playing on the first false→true transition', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 3) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(true)
      const playingCalls = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.playing')
      expect(playingCalls).toHaveLength(1)
      expect(playingCalls[0]).toEqual(['player.playing', 3])
    })

    it('does not emit duplicate player.playing on repeated notifyPlayState(true)', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 3) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)

      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(true)   // second call — already playing
      adapter.notifyPlayState(true)   // third call
      expect(emitter.emit).not.toHaveBeenCalledWith('player.playing', expect.anything())
    })

    it('starts the RAF loop exactly once on false→true transition', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 3) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(requestAnimationFrame).mockClear()

      adapter.notifyPlayState(true)
      expect(requestAnimationFrame).toHaveBeenCalledOnce()

      adapter.notifyPlayState(true)   // duplicate — no second RAF
      expect(requestAnimationFrame).toHaveBeenCalledOnce()
    })

    it('emits exactly one player.pause on true→false transition when not near end', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 60), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      const pauseCalls = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.pause')
      expect(pauseCalls).toHaveLength(1)
      expect(pauseCalls[0]).toEqual(['player.pause', 60])
    })

    it('does not emit duplicate player.pause on repeated notifyPlayState(false)', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 60), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(false)   // already paused
      adapter.notifyPlayState(false)
      expect(emitter.emit).not.toHaveBeenCalledWith('player.pause', expect.anything())
    })

    it('stops the RAF loop on true→false transition', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 5) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      expect(cancelAnimationFrame).toHaveBeenCalled()
    })

    it('emits player.ended (not player.pause) when engine stops at natural end', async () => {
      // currentTime is within one frame of duration
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => 119.99), duration: 120, isPlaying: true })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      expect(emitter.emit).toHaveBeenCalledWith('player.ended')
      expect(emitter.emit).not.toHaveBeenCalledWith('player.pause', expect.anything())
    })

    it('does not emit player.ended via notifyPlayState when already emitted by RAF', async () => {
      let time        = 119.99
      const engineRef = makeEngine({ getCurrentTime: vi.fn(() => time), duration: 120, isPlaying: true })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)

      // RAF fires and emits player.ended
      flushRaf(1)
      vi.mocked(emitter.emit).mockClear()

      // Engine then stops — notifyPlayState must not emit a second ended
      engineRef.current = { ...engineRef.current, isPlaying: false } as AudioEngine
      adapter.notifyPlayState(false)
      expect(emitter.emit).not.toHaveBeenCalled()
    })
  })

  // ── RAF loop ──────────────────────────────────────────────────────────────

  describe('RAF loop — player.timeupdate', () => {
    it('emits player.timeupdate on each animation frame while playing', async () => {
      let time        = 10
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => time), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 10)

      time = 15
      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 15)
    })
  })

  describe('RAF loop — player.ended', () => {
    it('emits player.ended within one frame of duration and stops RAF', async () => {
      // 119.99 is 0.01 s before end — well within the 1/60 ≈ 0.0167 s tolerance
      let time        = 119.99
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => time), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      flushRaf(1)
      expect(emitter.emit).toHaveBeenCalledWith('player.ended')
      // No further RAF should be queued after ended
      const queueAfter = rafQueue.length
      flushRaf(2)
      expect(rafQueue.length).toBe(queueAfter)
    })

    it('does not emit player.ended 150 ms before end — old threshold was too early', async () => {
      // 119.85 is 0.15 s before end — beyond one-frame tolerance, so NO ended yet
      let time        = 119.85
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => time), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      flushRaf(1)
      expect(emitter.emit).not.toHaveBeenCalledWith('player.ended')
      expect(emitter.emit).toHaveBeenCalledWith('player.timeupdate', 119.85)
    })

    it('emits player.ended exactly once even if RAF fires multiple times near end', async () => {
      // Already within the one-frame window on the first tick
      let time        = 119.99
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => time), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
      vi.mocked(emitter.emit).mockClear()

      // First RAF tick — emits ended and stops loop
      flushRaf(1)
      const endedCount = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.ended').length
      expect(endedCount).toBe(1)

      // Manually trying to flush more frames has no effect (loop stopped)
      flushRaf(5)
      const endedCountAfter = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.ended').length
      expect(endedCountAfter).toBe(1)
    })
  })

  // ── notifyCanPlay ─────────────────────────────────────────────────────────

  describe('notifyCanPlay', () => {
    it('emits player.canplay when init() did not (duration was 0 at init time)', async () => {
      // duration=0 means init() skips canplay — notifyCanPlay() is the first to emit it
      const engineRef = makeEngine({ duration: 0 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyCanPlay()
      expect(emitter.emit).toHaveBeenCalledWith('player.canplay')
    })

    it('is idempotent — no-op after init() already emitted player.canplay', async () => {
      // duration>0 means init() emits canplay; a subsequent notifyCanPlay() must be silent
      const engineRef = makeEngine({ duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)   // emits canplay
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyCanPlay()
      expect(emitter.emit).not.toHaveBeenCalledWith('player.canplay')
    })

    it('emits player.canplay exactly once even when called multiple times', async () => {
      const engineRef = makeEngine({ duration: 0 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)

      adapter.notifyCanPlay()
      adapter.notifyCanPlay()
      adapter.notifyCanPlay()
      const canplayCalls = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.canplay')
      expect(canplayCalls).toHaveLength(1)
    })
  })

  // ── Remount while already playing ────────────────────────────────────────

  describe('remount while already playing', () => {
    it('emits player.playing on first notifyPlayState(true) even when engine was already playing before init', async () => {
      // Simulates the component unmounting and remounting while the engine is playing.
      // A freshly created adapter has _prevPlaying=null, so the first notifyPlayState(true)
      // must emit player.playing (it is never a duplicate from the adapter's perspective).
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 45), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(true)
      const playingCalls = vi.mocked(emitter.emit).mock.calls.filter(c => c[0] === 'player.playing')
      expect(playingCalls).toHaveLength(1)
      expect(playingCalls[0]).toEqual(['player.playing', 45])
    })

    it('does not emit a second player.playing when notifyPlayState(true) is called again after remount', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 45), duration: 120 })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)

      adapter.notifyPlayState(true)   // first — emits playing
      vi.mocked(emitter.emit).mockClear()

      adapter.notifyPlayState(true)   // second — must be no-op
      expect(emitter.emit).not.toHaveBeenCalledWith('player.playing', expect.anything())
    })
  })

  // ── destroy ───────────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('stops the RAF loop and clears the emitter', async () => {
      const engineRef = makeEngine({ isPlaying: true, getCurrentTime: vi.fn(() => 1) })
      const adapter   = new PeaksAudioEngineAdapter(engineRef)
      const emitter   = makeEmitter()
      await adapter.init(emitter)
      adapter.notifyPlayState(true)
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

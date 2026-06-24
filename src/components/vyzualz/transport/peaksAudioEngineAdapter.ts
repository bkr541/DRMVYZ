import type { PlayerAdapter, EventEmitterForPlayerEvents } from 'peaks.js'
import type { AudioEngine } from '../../../hooks/useAudioEngine'

/**
 * Bridges AudioEngine to the Peaks.js PlayerAdapter interface.
 *
 * play() and pause() command the engine only — no events are emitted until the
 * component calls notifyPlayState() with the confirmed engine state. This keeps
 * Peaks events strictly in sync with AudioEngine reality and prevents duplicates
 * from React re-renders.
 *
 * A single requestAnimationFrame loop runs while the engine is playing.  It
 * emits player.timeupdate each frame and player.ended when currentTime reaches
 * duration (within one frame).  notifyPlayState() also detects a natural end if
 * the engine stops before the RAF fires.  Either path sets _endedEmitted so
 * only one ended event is ever emitted per play-through.
 *
 * The engineRef is mutated each render by the component so the adapter always
 * reads current values without being recreated.
 */
export class PeaksAudioEngineAdapter implements PlayerAdapter {
  private emitter:      EventEmitterForPlayerEvents | null = null
  private rafId:        number | null = null
  private _destroyed    = false
  private _seekPending  = false
  /** Tracks the last confirmed play-state to prevent duplicate events. */
  private _prevPlaying: boolean | null = null   // null = no state seen yet
  private _endedEmitted = false

  /** One animation frame at 60 fps — tolerance for end-of-track detection. */
  private static readonly FRAME_TOLERANCE = 1 / 60  // ~16.7 ms

  constructor(private readonly engineRef: { current: AudioEngine | null }) {}

  async init(emitter: EventEmitterForPlayerEvents): Promise<void> {
    this.emitter = emitter
    if ((this.engineRef.current?.duration ?? 0) > 0) {
      emitter.emit('player.canplay')
    }
  }

  destroy(): void {
    this._destroyed = true
    this.stopRaf()
    this.emitter = null
  }

  /** Command the engine to play. player.playing fires via notifyPlayState() when isPlaying actually becomes true. */
  async play(): Promise<void> {
    if (this._destroyed) return
    this.engineRef.current?.play()
  }

  /** Command the engine to pause. player.pause fires via notifyPlayState() when isPlaying actually becomes false. */
  pause(): void {
    if (this._destroyed) return
    this.engineRef.current?.pause()
  }

  isPlaying(): boolean {
    return this.engineRef.current?.isPlaying ?? false
  }

  isSeeking(): boolean {
    return this._seekPending
  }

  getCurrentTime(): number {
    return this.engineRef.current?.getCurrentTime() ?? 0
  }

  getDuration(): number {
    return this.engineRef.current?.duration ?? 0
  }

  seek(time: number): void {
    if (this._destroyed) return
    this._seekPending = true
    this.engineRef.current?.seek(time)
    this._seekPending = false
    this._endedEmitted = false   // allow player.ended to fire again after seeking
    this.emitter?.emit('player.seeked', time)
  }

  // ── External notifications from the React component ───────────────────────

  /** Emit player.canplay when a new track/buffer is confirmed ready. */
  notifyCanPlay(): void {
    if (!this._destroyed) this.emitter?.emit('player.canplay')
  }

  /**
   * Called by the component whenever engine.isPlaying changes.
   *
   * Emits player.playing (+ starts RAF) exactly once on a stopped→playing
   * transition, and player.pause or player.ended exactly once on a
   * playing→stopped transition.  Repeated calls with the same value are no-ops.
   */
  notifyPlayState(playing: boolean): void {
    if (this._destroyed) return

    if (playing && this._prevPlaying !== true) {
      this._prevPlaying  = true
      this._endedEmitted = false
      this.emitter?.emit('player.playing', this.getCurrentTime())
      this.startRaf()
    } else if (!playing && this._prevPlaying === true) {
      this._prevPlaying = false
      this.stopRaf()
      if (!this._endedEmitted) {
        const t   = this.getCurrentTime()
        const dur = this.getDuration()
        if (dur > 0 && t >= dur - PeaksAudioEngineAdapter.FRAME_TOLERANCE) {
          // Engine stopped at the natural end — RAF may have missed the final frame.
          this._endedEmitted = true
          this.emitter?.emit('player.ended')
        } else {
          this.emitter?.emit('player.pause', t)
        }
      }
    }
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────

  private startRaf(): void {
    if (this.rafId !== null || this._destroyed) return
    const tick = (): void => {
      if (this._destroyed || !this.isPlaying()) {
        this.rafId = null
        return
      }
      const t   = this.getCurrentTime()
      const dur = this.getDuration()
      this.emitter?.emit('player.timeupdate', t)
      if (dur > 0 && t >= dur - PeaksAudioEngineAdapter.FRAME_TOLERANCE && !this._endedEmitted) {
        this.rafId         = null
        this._endedEmitted = true
        this.emitter?.emit('player.ended')
        return
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}

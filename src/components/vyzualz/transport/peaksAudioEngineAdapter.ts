import type { PlayerAdapter, EventEmitterForPlayerEvents } from 'peaks.js'
import type { AudioEngine } from '../../../hooks/useAudioEngine'

/**
 * Bridges AudioEngine to the Peaks.js PlayerAdapter interface.
 *
 * The engineRef is mutated each render by the component so the adapter always
 * reads current values without being recreated.
 *
 * A single requestAnimationFrame loop runs while the engine is playing,
 * emitting player.timeupdate each frame and player.ended when the track ends.
 * The loop stops when the engine pauses, or when destroy() is called.
 */
export class PeaksAudioEngineAdapter implements PlayerAdapter {
  private emitter: EventEmitterForPlayerEvents | null = null
  private rafId: number | null = null
  private _destroyed = false
  private _seekPending = false

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

  async play(): Promise<void> {
    if (this._destroyed) return
    this.engineRef.current?.play()
    this.emitter?.emit('player.playing', this.getCurrentTime())
    this.startRaf()
  }

  pause(): void {
    if (this._destroyed) return
    this.engineRef.current?.pause()
    this.stopRaf()
    this.emitter?.emit('player.pause', this.getCurrentTime())
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
    this.emitter?.emit('player.seeked', time)
  }

  // ── External notifications from the React component ───────────────────────

  /** Emit player.canplay when a new track/buffer is confirmed ready. */
  notifyCanPlay(): void {
    if (!this._destroyed) this.emitter?.emit('player.canplay')
  }

  /** Called when engine.isPlaying changes so Peaks stays in sync. */
  notifyPlayState(playing: boolean): void {
    if (this._destroyed) return
    if (playing) {
      this.emitter?.emit('player.playing', this.getCurrentTime())
      this.startRaf()
    } else {
      this.stopRaf()
      this.emitter?.emit('player.pause', this.getCurrentTime())
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
      if (dur > 0 && t >= dur - 0.15) {
        this.rafId = null
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

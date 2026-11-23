/**
 * Audio self-healing: two small helpers the audio engine wires in.
 *
 *   watchAudioContext   an AudioContext that was running and then stopped (the output device changed, the system suspended it) is resumed, a few tries, then reported.
 *   MediaLoadRetry      a track that failed to load (a USB drive that blipped) is loaded once more before the failure is shown.
 */
import { useHealthStore } from '../stores/healthStore'
import { beginHealing, markFailed, markHealed } from './selfHealing'

type Timer = ReturnType<typeof setTimeout>
const RESUME_DELAYS_MS = [300, 1_500, 4_000] as const
export const MEDIA_RETRY_DELAY_MS = 1_500

export interface ContextLike {
  state: AudioContextState | 'interrupted'
  resume: () => Promise<void>
  addEventListener?: (type: 'statechange', listener: () => void) => void
  removeEventListener?: (type: 'statechange', listener: () => void) => void
}

/** Returns the cleanup. Only a context that has been running is repaired: one that never started is waiting for the user's first click, which is normal. */
export function watchAudioContext(ctx: ContextLike, setTimer: (fn: () => void, ms: number) => Timer = (fn, ms) => setTimeout(fn, ms), clearTimer: (t: Timer) => void = t => clearTimeout(t)): () => void {
  let hasRun = ctx.state === 'running'
  let attempts = 0
  let timer: Timer | null = null
  let disposed = false

  const clear = () => { if (timer !== null) { clearTimer(timer); timer = null } }
  const attempt = () => {
    timer = null
    if (disposed || ctx.state === 'running' || ctx.state === 'closed') return
    if (attempts >= RESUME_DELAYS_MS.length) { markFailed('audio', 'Audio output stopped and could not be resumed'); return }
    attempts += 1
    ctx.resume().catch(() => undefined).finally(() => {
      if (disposed || ctx.state === 'running' || ctx.state === 'closed') return
      timer = setTimer(attempt, RESUME_DELAYS_MS[Math.min(attempts, RESUME_DELAYS_MS.length - 1)])
    })
  }
  const onChange = () => {
    if (disposed) return
    if (ctx.state === 'running') {
      hasRun = true
      clear()
      attempts = 0
      markHealed('audio')
      return
    }
    if (ctx.state === 'closed' || !hasRun || timer !== null) return
    beginHealing('audio', 'Audio output stopped')
    timer = setTimer(attempt, RESUME_DELAYS_MS[0])
  }
  ctx.addEventListener?.('statechange', onChange)
  return () => { disposed = true; clear(); ctx.removeEventListener?.('statechange', onChange) }
}

export interface MediaRetryOptions {
  /** Loads the same track again. */
  reload: () => void
  setTimer?: (fn: () => void, ms: number) => Timer
  clearTimer?: (timer: Timer) => void
}

/** One reload per track, then the failure is real. */
export class MediaLoadRetry {
  private retriedTrack: string | null = null
  private timer: Timer | null = null
  constructor(private readonly options: MediaRetryOptions) {}

  /** A load failed. Returns true when a retry was scheduled (the caller holds back its own error); false when this track has already been retried. */
  onFailure(trackId: string, trackLabel: string): boolean {
    if (this.retriedTrack === trackId) {
      this.cancel()
      markFailed('audio', `"${trackLabel}" could not be loaded`)
      return false
    }
    this.cancel()
    this.retriedTrack = trackId
    beginHealing('audio', `"${trackLabel}" failed to load`)
    const setTimer = this.options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.timer = setTimer(() => { this.timer = null; this.options.reload() }, MEDIA_RETRY_DELAY_MS)
    return true
  }

  /** The track is playable. */
  onLoaded(trackId: string): void {
    if (this.retriedTrack === trackId) markHealed('audio')
  }

  /** A different track was requested: forget the old track's retry (a pending reload would load the wrong file). */
  onTrackChanged(): void {
    this.cancel()
    this.retriedTrack = null
    // A repair for the previous track (or its failure) is over; the new track starts with a clean slate and its own errors.
    const { systems, setHealth } = useHealthStore.getState()
    if (systems.audio.state === 'healing' || systems.audio.state === 'failed') setHealth('audio', 'ok', null)
  }

  dispose(): void { this.cancel() }

  private cancel(): void {
    if (this.timer === null) return
    ;(this.options.clearTimer ?? (t => clearTimeout(t)))(this.timer)
    this.timer = null
  }
}

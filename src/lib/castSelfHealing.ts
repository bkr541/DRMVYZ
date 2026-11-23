/**
 * Reconnects a cast that failed on its own. It remembers the last cast the user started (target, window mode, aspect ratio) and, when the session fails, starts it
 * again with the same choices, up to RETRY_DELAYS_MS.length times with growing waits. It never acts on a stop the user asked for, and never on a session that simply
 * ended; only a session that reports `failed` while a cast is wanted.
 */
import { useHealthStore } from '../stores/healthStore'
import { RETRY_DELAYS_MS, beginHealing, markFailed, markHealed } from './selfHealing'

type Timer = ReturnType<typeof setTimeout>

export interface CastReconnectorOptions<Request> {
  /** Starts the cast again; resolves true when a session was created that has not already failed. */
  start: (request: Request) => Promise<boolean>
  setTimer?: (fn: () => void, ms: number) => Timer
  clearTimer?: (timer: Timer) => void
  delaysMs?: readonly number[]
}

export class CastReconnector<Request> {
  private request: Request | null = null
  private attempts = 0
  private timer: Timer | null = null
  private running = false
  private lastState = 'none'
  private readonly start: CastReconnectorOptions<Request>['start']
  private readonly setTimer: NonNullable<CastReconnectorOptions<Request>['setTimer']>
  private readonly clearTimer: NonNullable<CastReconnectorOptions<Request>['clearTimer']>
  private readonly delays: readonly number[]

  constructor(options: CastReconnectorOptions<Request>) {
    this.start = options.start
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? (timer => clearTimeout(timer))
    this.delays = options.delaysMs ?? RETRY_DELAYS_MS
  }

  /** The user started a cast: this is what to bring back if it fails. */
  remember(request: Request): void {
    this.cancel()
    this.request = request
    this.attempts = 0
    useHealthStore.getState().setHealth('cast', 'ok', 'Starting the cast')
  }

  /** The user stopped the cast, or it cannot be shown any more: nothing is wanted, so nothing is repaired. */
  forget(): void {
    this.cancel()
    this.request = null
    this.attempts = 0
    this.lastState = 'none'
    // A repair in progress or a failure ends with the cast it belonged to.
    markIdle()
  }

  /** Feed every session state change here. */
  observe(state: string): void {
    this.lastState = state
    if (!this.request) return
    if (state === 'connected') {
      this.cancel()
      this.attempts = 0
      // Posts "complete" only when a repair was in progress (or had given up); a normal first connection is silent.
      markHealed('cast', 'Casting')
      return
    }
    if (state === 'failed') this.schedule()
  }

  /** Free the timer when the component goes away. */
  dispose(): void { this.cancel(); this.request = null }

  private cancel(): void {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null }
  }

  private schedule(): void {
    if (this.timer !== null || this.running || !this.request) return
    if (this.attempts >= this.delays.length) {
      markFailed('cast', 'The cast could not reconnect')
      return
    }
    if (this.attempts === 0) beginHealing('cast', 'The cast connection was lost')
    const delay = this.delays[this.attempts]
    this.attempts += 1
    this.timer = this.setTimer(() => { this.timer = null; void this.retry() }, delay)
  }

  private async retry(): Promise<void> {
    const request = this.request
    if (!request) return
    this.running = true
    let ok = false
    try { ok = await this.start(request) } catch { ok = false }
    this.running = false
    // The user may have stopped the cast while the attempt was in flight; or the new session may already have failed again.
    if (!this.request) return
    if (!ok || this.lastState === 'failed') this.schedule()
  }
}

function markIdle(): void { useHealthStore.getState().setHealth('cast', 'idle', null) }

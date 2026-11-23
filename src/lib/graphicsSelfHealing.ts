/**
 * Graphics self-healing for the Cinema 2.0 stage.
 *
 *   context-lost  the GPU context was lost: the runtime restores it by itself; if it is still lost after CONTEXT_LOST_GRACE_MS the stage is rebuilt.
 *   unavailable   the runtime could not start or died: the stage is rebuilt, up to RETRY_DELAYS_MS.length times, then the failure is reported.
 *   anything else the stage is drawing: a repair in progress is complete.
 * Separately, `watchGraphicsPressure` shows reduced quality (the shared performance pressure) as a quiet "degraded" state.
 */
import { getPerformancePressure, subscribePerformancePressure } from './performancePressure'
import { RETRY_DELAYS_MS, beginHealing, markFailed, markHealed, setHealthQuietly } from './selfHealing'

type Timer = ReturnType<typeof setTimeout>
export const CONTEXT_LOST_GRACE_MS = 8_000

export class GraphicsHealer {
  private attempts = 0
  private timer: Timer | null = null
  constructor(
    private readonly recreate: () => void,
    private readonly setTimer: (fn: () => void, ms: number) => Timer = (fn, ms) => setTimeout(fn, ms),
    private readonly clearTimer: (timer: Timer) => void = timer => clearTimeout(timer),
    private readonly delays: readonly number[] = RETRY_DELAYS_MS,
  ) {}

  observe(phase: string): void {
    if (phase === 'initializing' || phase === 'disposed') return
    if (phase === 'context-lost') {
      beginHealing('graphics', 'The graphics context was lost')
      this.schedule(CONTEXT_LOST_GRACE_MS)
      return
    }
    if (phase === 'unavailable') {
      if (this.attempts >= this.delays.length) { this.cancel(); markFailed('graphics', 'The visualizer could not restart'); return }
      beginHealing('graphics', 'The visualizer stopped')
      this.schedule(this.delays[this.attempts])
      this.attempts += 1
      return
    }
    this.cancel()
    this.attempts = 0
    markHealed('graphics')
  }

  dispose(): void { this.cancel() }

  private schedule(ms: number): void {
    if (this.timer !== null) return
    this.timer = this.setTimer(() => { this.timer = null; this.recreate() }, ms)
  }

  private cancel(): void {
    if (this.timer !== null) { this.clearTimer(this.timer); this.timer = null }
  }
}

/** Reduced quality because the machine is overworked is not an alert: the chip turns amber and nothing else changes. Returns the cleanup. */
export function watchGraphicsPressure(): () => void {
  const apply = (level: number) => {
    if (level > 0) setHealthQuietly('graphics', 'degraded', 'Quality is reduced to keep up')
    else setHealthQuietly('graphics', 'ok', null)
  }
  apply(getPerformancePressure())
  return subscribePerformancePressure(apply)
}

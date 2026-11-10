import { createLogger } from './logger'

export type PerformanceDetails = Record<string, string | number | boolean | null>
type Scope = 'engine' | 'cast' | 'cinema2' | 'canvas' | 'renderer'
const log = createLogger('system', 'performance')
const context: Partial<Record<Scope, PerformanceDetails>> = {}
let activeCast = false

/** Diagnostic text must not persist signed media URLs, bearer credentials or JWTs. */
export function safePerformanceText(value: string): string {
  return value.replace(/(?:https?|wss?|file|blob|data):\S+/gi, '[url]')
    .replace(/Bearer\s+\S+|eyJ[A-Za-z0-9._-]{20,}|sb_(?:publish|secret)able_[A-Za-z0-9_-]+/g, '[credential]')
    .slice(0, 240)
}

export function recordPerformanceEvent(scope: Scope, event: string, details: PerformanceDetails = {}): void {
  const safe: PerformanceDetails = {}
  for (const [key, value] of Object.entries(details).slice(0, 24)) {
    safe[key] = typeof value === 'string' ? safePerformanceText(value)
      : typeof value === 'number' && !Number.isFinite(value) ? null : value
  }
  const previous = context[scope]
  const reset = event === 'engine-initializing' || event === 'activation-started' || event === 'cast-state'
  const retained = reset ? (scope === 'engine' && previous?.engine === safe.engine
    ? { presetId: previous.presetId ?? null } : {}) : previous
  context[scope] = Object.fromEntries(Object.entries({ ...retained, ...safe, event }).slice(-24))
  try { log.info(event, { scope, ...context[scope] }) } catch { /* Never interrupt a render for diagnostics. */ }
}

export function setPerformanceCastActive(active: boolean): void { activeCast = active }
export function isPerformanceCastActive(): boolean { return activeCast }

/** Fixed storage and infrequent summaries; no per-frame IPC or sorting. */
export class PerformanceFrameSampler {
  private readonly intervals = new Float64Array(256)
  private count = 0
  private frames = 0
  private previous: number | null = null
  private started: number | null = null

  sample(now: number): PerformanceDetails | null {
    if (!Number.isFinite(now)) return null
    if (this.previous !== null && now > this.previous && now - this.previous < 250) {
      this.intervals[this.count++ % this.intervals.length] = now - this.previous
      this.frames++
    } else {
      this.count = 0
      this.frames = 0
      this.started = now
    }
    this.previous = now
    this.started ??= now
    if (now - this.started < 10_000) return null
    const values = [...this.intervals.subarray(0, Math.min(this.count, this.intervals.length))].sort((a, b) => a - b)
    const summary = {
      rafFps: Math.round(this.frames * 1000 / (now - this.started)),
      frameP95Ms: values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? 0,
    }
    this.count = 0
    this.frames = 0
    this.started = now
    return summary
  }
}

/** Installs passive failure capture and low-frequency frame summaries once at app startup. */
export function installPerformanceTelemetry(target: Window = window): () => void {
  const sampler = new PerformanceFrameSampler()
  let frame = 0
  let stopped = false
  let errorWindow = 0
  let errors = 0
  const report = (kind: string, error: unknown) => {
    const now = Date.now()
    if (now - errorWindow > 10_000) { errorWindow = now; errors = 0 }
    if (errors++ >= 10) return
    try { log.error(kind, {
      name: error instanceof Error ? error.name : 'Error',
      message: safePerformanceText(error instanceof Error ? error.message : String(error)),
      recent: { ...context },
    }) } catch { /* Failure capture is advisory. */ }
  }
  const onError = (event: ErrorEvent) => report('renderer-error', event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) => report('renderer-rejection', event.reason)
  const tick = (now: number) => {
    if (stopped) return
    const summary = sampler.sample(now)
    if (summary) {
      try { log.info('frame-summary', { ...summary, recent: { ...context } }) } catch { /* Continue sampling. */ }
    }
    frame = target.requestAnimationFrame(tick)
  }
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  frame = target.requestAnimationFrame(tick)
  return () => {
    stopped = true
    target.cancelAnimationFrame(frame)
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}

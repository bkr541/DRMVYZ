/**
 * Non-blocking GPU timing with `EXT_disjoint_timer_query_webgl2`.
 *
 * `measure(label, fn)` brackets the GL work `fn` issues in a `TIME_ELAPSED` query. A result is only read once the driver says it is available
 * (`QUERY_RESULT_AVAILABLE`), on a later `collect()`, so nothing here ever stalls the CPU waiting for the GPU. A frame that the driver marks
 * disjoint (clock changed, power state switched) is discarded rather than reported.
 *
 * WebGL allows one active `TIME_ELAPSED` query at a time, so measured sections must not nest and this pool must not run while another query
 * (such as `Cinema2PerformanceDiagnostics`'s whole-frame query) is active on the same context. It is a developer tool: the production runtime
 * keeps its own single frame query and does not use it.
 */
export interface Cinema2GpuTimingEntry {
  label: string
  lastMs: number
  averageMs: number
  samples: number
}

interface PendingQuery { label: string; query: WebGLQuery }

interface TimerExtension {
  TIME_ELAPSED_EXT: number
  GPU_DISJOINT_EXT: number
}

export class Cinema2GpuTimerPool {
  private ext: TimerExtension | null
  private active: PendingQuery | null = null
  private pending: PendingQuery[] = []
  private readonly results = new Map<string, { lastMs: number; averageMs: number; samples: number }>()
  private disjointCount = 0
  private readonly maxPending: number

  constructor(private readonly gl: WebGL2RenderingContext, maxPending = 16) {
    this.maxPending = maxPending
    this.ext = this.acquire()
  }

  get supported(): boolean {
    return this.ext != null
  }

  /** Runs `fn` inside a timer query labelled `label`. Without the extension, or while another measure is open, it just runs `fn`. */
  measure<T>(label: string, fn: () => T): T {
    const ext = this.ext
    if (!ext || this.active || this.pending.length >= this.maxPending || this.gl.isContextLost()) return fn()
    const query = this.gl.createQuery()
    if (!query) return fn()
    try {
      this.gl.beginQuery(ext.TIME_ELAPSED_EXT, query)
    } catch {
      this.gl.deleteQuery(query)
      return fn()
    }
    this.active = { label, query }
    try {
      return fn()
    } finally {
      try { this.gl.endQuery(ext.TIME_ELAPSED_EXT) } catch { /* A lost context ends the query on its own. */ }
      this.pending.push(this.active)
      this.active = null
    }
  }

  /** Reads every query the GPU has finished. Call once per frame; never blocks. */
  collect(): void {
    const ext = this.ext
    if (!ext || this.pending.length === 0 || this.gl.isContextLost()) return
    const disjoint = Boolean(this.gl.getParameter(ext.GPU_DISJOINT_EXT))
    const remaining: PendingQuery[] = []
    for (const entry of this.pending) {
      if (!this.gl.getQueryParameter(entry.query, this.gl.QUERY_RESULT_AVAILABLE)) { remaining.push(entry); continue }
      if (disjoint) {
        this.disjointCount += 1
      } else {
        const ms = Number(this.gl.getQueryParameter(entry.query, this.gl.QUERY_RESULT)) / 1e6
        const previous = this.results.get(entry.label)
        this.results.set(entry.label, previous
          ? { lastMs: ms, averageMs: previous.averageMs * 0.9 + ms * 0.1, samples: previous.samples + 1 }
          : { lastMs: ms, averageMs: ms, samples: 1 })
      }
      this.gl.deleteQuery(entry.query)
    }
    this.pending = remaining
  }

  getTimings(): readonly Readonly<Cinema2GpuTimingEntry>[] {
    return [...this.results.entries()].map(([label, value]) => Object.freeze({ label, ...value }))
  }

  getDisjointCount(): number {
    return this.disjointCount
  }

  /** Context lost: queries are gone with it. */
  handleContextLost(): void {
    this.ext = null
    this.active = null
    this.pending = []
  }

  /** Extensions must be requested again after a restore. */
  handleContextRestored(): void {
    this.ext = this.acquire()
  }

  dispose(): void {
    if (!this.gl.isContextLost()) for (const entry of this.pending) this.gl.deleteQuery(entry.query)
    this.pending = []
    this.active = null
    this.results.clear()
    this.ext = null
  }

  private acquire(): TimerExtension | null {
    return typeof this.gl.getExtension === 'function' ? (this.gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null) : null
  }
}

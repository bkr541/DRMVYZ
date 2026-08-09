/** Minimal shape of EXT_disjoint_timer_query_webgl2 used by both live renderers. */
export interface WebGL2DisjointTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: GLenum
  readonly GPU_DISJOINT_EXT: GLenum
}

export type GpuFrameTimerState = 'unsupported' | 'idle' | 'pending' | 'disjoint' | 'disposed'

export interface GpuFrameTimerSnapshot {
  available: boolean
  state: GpuFrameTimerState
  lastGpuMs: number | null
  createdQueryCount: number
  deletedQueryCount: number
  completedSampleCount: number
}

/**
 * Context-scoped, bounded WebGL2 GPU timer.
 *
 * WebGL query results are asynchronous. Keeping at most one pending query avoids
 * unbounded allocations when a driver delays results; CPU/presentation timing
 * remains available while that query is pending or the extension is absent.
 */
export class GpuFrameTimer {
  private readonly extension: WebGL2DisjointTimerQueryExtension | null
  private query: WebGLQuery | null = null
  private active = false
  private disposed = false
  private disjoint = false
  private lastGpuMs: number | null = null
  private createdQueryCount = 0
  private deletedQueryCount = 0
  private completedSampleCount = 0

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as WebGL2DisjointTimerQueryExtension | null
  }

  get available(): boolean {
    return !this.disposed && this.extension != null
  }

  /** Polls an earlier result and begins a query only when no query is in flight. */
  beginFrame(): void {
    if (!this.available || !this.extension) return
    this.poll()
    if (this.query || this.active) return
    const query = this.gl.createQuery()
    if (!query) return
    try {
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query)
      this.query = query
      this.active = true
      this.createdQueryCount += 1
    } catch {
      try { this.gl.deleteQuery(query) } catch { /* A concurrently lost context already owns cleanup. */ }
      this.deletedQueryCount += 1
    }
  }

  endFrame(): void {
    if (!this.available || !this.extension || !this.active) return
    this.gl.endQuery(this.extension.TIME_ELAPSED_EXT)
    this.active = false
  }

  /** Returns the latest completed sample without blocking for GPU completion. */
  poll(): number | null {
    if (!this.available || !this.extension || !this.query || this.active) return this.lastGpuMs
    const disjoint = Boolean(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT))
    const available = Boolean(this.gl.getQueryParameter(this.query, this.gl.QUERY_RESULT_AVAILABLE))
    if (disjoint) {
      this.disjoint = true
      this.lastGpuMs = null
      this.deletePendingQuery()
      return this.lastGpuMs
    }
    if (!available) return this.lastGpuMs
    const nanoseconds = Number(this.gl.getQueryParameter(this.query, this.gl.QUERY_RESULT))
    if (Number.isFinite(nanoseconds) && nanoseconds >= 0) {
      this.lastGpuMs = nanoseconds / 1_000_000
      this.completedSampleCount += 1
    }
    this.disjoint = false
    this.deletePendingQuery()
    return this.lastGpuMs
  }

  getSnapshot(): Readonly<GpuFrameTimerSnapshot> {
    const state: GpuFrameTimerState = this.disposed
      ? 'disposed'
      : !this.extension
        ? 'unsupported'
        : this.disjoint
          ? 'disjoint'
          : this.query
            ? 'pending'
            : 'idle'
    return Object.freeze({
      available: this.available,
      state,
      lastGpuMs: this.lastGpuMs,
      createdQueryCount: this.createdQueryCount,
      deletedQueryCount: this.deletedQueryCount,
      completedSampleCount: this.completedSampleCount,
    })
  }

  dispose(): void {
    if (this.disposed) return
    if (this.active && this.extension) {
      try { this.gl.endQuery(this.extension.TIME_ELAPSED_EXT) } catch { /* Context loss may reject the final endQuery. */ }
      this.active = false
    }
    this.deletePendingQuery()
    this.disposed = true
  }

  private deletePendingQuery(): void {
    if (!this.query) return
    try { this.gl.deleteQuery(this.query) } catch { /* Context loss invalidates the query without an explicit delete. */ }
    this.deletedQueryCount += 1
    this.query = null
  }
}

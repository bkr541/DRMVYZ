import {
  type PerformanceMetrics,
  type TimerQueryResult,
  EMPTY_METRICS,
} from './shaderPerformanceTypes'

// ── Timer extension shim ──────────────────────────────────────────────────────
// EXT_disjoint_timer_query_webgl2 is not in the standard TS WebGL types.

interface EXT_disjoint_timer_query_webgl2 {
  readonly TIME_ELAPSED_EXT:  GLenum
  readonly GPU_DISJOINT_EXT:  GLenum
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Max frames to keep in the rolling history. */
const HISTORY_LENGTH = 60

// ── ShaderPerformanceMonitor ──────────────────────────────────────────────────

/**
 * Tracks per-frame shader performance.
 *
 * GPU timing uses the `EXT_disjoint_timer_query_webgl2` extension when
 * available.  On devices that don't support it, `gpuMs` is always `null`
 * and all other metrics are still collected from CPU-side data.
 *
 * This monitor is purely additive/observational — it never mutates any
 * render graph, scene, or quality setting.  The quality controller reads
 * from this monitor and decides whether to act.
 */
export class ShaderPerformanceMonitor {
  private readonly _history: PerformanceMetrics[] = []
  private _consecutiveSlowFrames = 0
  private _lastMetrics: PerformanceMetrics = { ...EMPTY_METRICS }

  // Timer query state
  private _timerExt:   EXT_disjoint_timer_query_webgl2 | null = null
  private _timerQuery: WebGLQuery | null = null
  private _pendingGpuMs: number | null = null
  private _timerAvailable = false
  private _disposed = false

  // ── Timer-query initialisation ─────────────────────────────────────────────

  /**
   * Attempt to acquire the timer-query extension.
   * Must be called once after the WebGL context is created.
   * Safe to call on devices that do not support the extension.
   */
  initTimerQuery(gl: WebGL2RenderingContext): void {
    if (this._disposed) return
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    if (ext) {
      this._timerExt       = ext
      this._timerAvailable = true
    }
  }

  get timerQueryAvailable(): boolean { return this._timerAvailable }

  // ── Per-frame recording ───────────────────────────────────────────────────

  /**
   * Call at the start of the GPU render block to begin a timer query.
   * No-op when timer queries are unavailable.
   */
  beginFrame(gl: WebGL2RenderingContext): void {
    if (this._disposed || !this._timerAvailable || !this._timerExt) return

    // Check if the previous query is ready before creating a new one.
    this._pollPendingQuery(gl)

    const query = gl.createQuery()
    if (!query) return
    this._timerQuery = query
    gl.beginQuery(this._timerExt.TIME_ELAPSED_EXT, query)
  }

  /**
   * Call at the end of the GPU render block to end the timer query.
   * No-op when timer queries are unavailable.
   */
  endFrame(gl: WebGL2RenderingContext): void {
    if (this._disposed || !this._timerAvailable || !this._timerExt || !this._timerQuery) return
    gl.endQuery(this._timerExt.TIME_ELAPSED_EXT)
  }

  /**
   * Record a completed frame's metrics.
   *
   * @param cpuPrepMs        Time from start to end of CPU-side draw preparation.
   * @param totalMs          Wall-clock frame time.
   * @param passCount        Number of render passes executed.
   * @param renderTargetCount Number of active FBOs (live render targets).
   * @param textureMb        Estimated GPU texture memory in MiB.
   * @param internalW        Render target width.
   * @param internalH        Render target height.
   * @param slowThresholdMs  Frame time above which a frame is "slow" (default 33ms = ~30fps).
   * @param gl               WebGL context, needed to poll pending timer queries.
   */
  recordFrame(opts: {
    cpuPrepMs:         number
    totalMs:           number
    passCount:         number
    renderTargetCount: number
    textureMb:         number
    internalW:         number
    internalH:         number
    slowThresholdMs?:  number
    gl?:               WebGL2RenderingContext
  }): void {
    if (this._disposed) return

    if (opts.gl) this._pollPendingQuery(opts.gl)

    const isSlow = opts.totalMs > (opts.slowThresholdMs ?? 33)
    this._consecutiveSlowFrames = isSlow ? this._consecutiveSlowFrames + 1 : 0

    const metrics: PerformanceMetrics = {
      cpuPrepMs:            opts.cpuPrepMs,
      gpuMs:                this._pendingGpuMs,
      totalMs:              opts.totalMs,
      passCount:            opts.passCount,
      renderTargetCount:    opts.renderTargetCount,
      textureMb:            opts.textureMb,
      internalW:            opts.internalW,
      internalH:            opts.internalH,
      consecutiveSlowFrames: this._consecutiveSlowFrames,
    }

    this._lastMetrics = metrics
    this._history.push(metrics)
    if (this._history.length > HISTORY_LENGTH) this._history.shift()
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get lastMetrics(): PerformanceMetrics { return this._lastMetrics }
  get consecutiveSlowFrames(): number   { return this._consecutiveSlowFrames }

  /** Rolling average of the last N frames. */
  rollingAverage(n = 30): PerformanceMetrics {
    const slice = this._history.slice(-Math.min(n, this._history.length))
    if (slice.length === 0) return { ...EMPTY_METRICS }

    let cpuSum = 0, totalSum = 0
    let gpuSum = 0, gpuCount = 0

    for (const m of slice) {
      cpuSum   += m.cpuPrepMs
      totalSum += m.totalMs
      if (m.gpuMs !== null) { gpuSum += m.gpuMs; gpuCount++ }
    }

    const last = slice[slice.length - 1]
    return {
      ...last,
      cpuPrepMs: cpuSum   / slice.length,
      totalMs:   totalSum / slice.length,
      gpuMs:     gpuCount > 0 ? gpuSum / gpuCount : null,
    }
  }

  /** True when the last N frames averaged above the threshold. */
  isSustainedlySlow(n = 10, thresholdMs = 33): boolean {
    const slice = this._history.slice(-Math.min(n, this._history.length))
    if (slice.length < n) return false
    const avg = slice.reduce((s, m) => s + m.totalMs, 0) / slice.length
    return avg > thresholdMs
  }

  /** True when the last N frames were all under the threshold. */
  isSustainedlyFast(n = 60, thresholdMs = 20): boolean {
    const slice = this._history.slice(-Math.min(n, this._history.length))
    if (slice.length < n) return false
    return slice.every(m => m.totalMs < thresholdMs)
  }

  // ── Texture memory estimate ───────────────────────────────────────────────

  /**
   * Estimate GPU texture memory for a set of FBOs described by width × height.
   * Assumes 4 bytes per pixel (RGBA8).  Returns MiB.
   */
  static estimateTextureMb(targets: { w: number; h: number }[]): number {
    const bytes = targets.reduce((s, t) => s + t.w * t.h * 4, 0)
    return bytes / (1024 * 1024)
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(gl?: WebGL2RenderingContext): void {
    if (this._disposed) return
    this._disposed = true
    if (gl && this._timerQuery) {
      gl.deleteQuery(this._timerQuery)
      this._timerQuery = null
    }
    this._history.length = 0
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _pollPendingQuery(gl: WebGL2RenderingContext): void {
    if (!this._timerQuery || !this._timerExt) return

    const disjoint = gl.getParameter(this._timerExt.GPU_DISJOINT_EXT)
    const ready    = gl.getQueryParameter(this._timerQuery, gl.QUERY_RESULT_AVAILABLE)

    if (ready && !disjoint) {
      const ns = gl.getQueryParameter(this._timerQuery, gl.QUERY_RESULT) as number
      this._pendingGpuMs = ns / 1_000_000
    }

    if (ready || disjoint) {
      gl.deleteQuery(this._timerQuery)
      this._timerQuery = null
    }
  }
}

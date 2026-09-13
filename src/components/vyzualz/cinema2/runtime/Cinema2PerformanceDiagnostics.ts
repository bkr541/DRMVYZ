import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2QualityMode } from '../parameters/Cinema2PerformanceParameters'

export interface Cinema2QualityPolicy {
  resolvedQuality: Cinema2RenderQualityLevel
  renderTargetScale: number
  gpuMemoryBudgetBytes: number
}

export interface Cinema2PerformanceSnapshot {
  diagnosticsEnabled: boolean
  requestedMode: Cinema2QualityMode
  resolvedQuality: Cinema2RenderQualityLevel
  renderTargetScale: number
  gpuMemoryBudgetBytes: number
  cpuFrameTimeMs: number | null
  cpuFrameTimeAverageMs: number | null
  gpuFrameTimeMs: number | null
  gpuTimingSupported: boolean
  degraded: boolean
  degradationReason: string | null
}

const POLICIES: Readonly<Record<Exclude<Cinema2QualityMode, 'auto'>, Readonly<Cinema2QualityPolicy>>> = Object.freeze({
  performance: Object.freeze({ resolvedQuality: 'low', renderTargetScale: 0.67, gpuMemoryBudgetBytes: 96 * 1024 * 1024 }),
  balanced: Object.freeze({ resolvedQuality: 'medium', renderTargetScale: 0.82, gpuMemoryBudgetBytes: 160 * 1024 * 1024 }),
  quality: Object.freeze({ resolvedQuality: 'high', renderTargetScale: 1, gpuMemoryBudgetBytes: 256 * 1024 * 1024 }),
})

const AUTO_LEVELS: readonly Cinema2RenderQualityLevel[] = Object.freeze(['low', 'medium', 'high'])

export function cinema2QualityPolicy(mode: Cinema2QualityMode, autoQuality: Cinema2RenderQualityLevel = 'high'): Readonly<Cinema2QualityPolicy> {
  if (mode !== 'auto') return POLICIES[mode]
  if (autoQuality === 'low') return POLICIES.performance
  if (autoQuality === 'medium') return POLICIES.balanced
  return POLICIES.quality
}

/** Low-overhead rolling frame telemetry plus conservative Auto quality hysteresis. */
export class Cinema2PerformanceDiagnostics {
  private requestedMode: Cinema2QualityMode
  private autoQuality: Cinema2RenderQualityLevel = 'high'
  private cpuFrameTimeMs: number | null = null
  private cpuFrameTimeAverageMs: number | null = null
  private gpuFrameTimeMs: number | null = null
  private slowSamples = 0
  private fastSamples = 0
  private degraded = false
  private degradationReason: string | null = null
  private readonly ext: any
  private pendingGpuQuery: WebGLQuery | null = null
  private activeGpuQuery: WebGLQuery | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    mode: Cinema2QualityMode,
    private readonly diagnosticsEnabled = true,
  ) {
    this.requestedMode = mode
    this.ext = diagnosticsEnabled && typeof gl.getExtension === 'function'
      ? gl.getExtension('EXT_disjoint_timer_query_webgl2')
      : null
  }

  setRequestedMode(mode: Cinema2QualityMode): void {
    if (mode === this.requestedMode) return
    this.requestedMode = mode
    this.slowSamples = 0
    this.fastSamples = 0
  }

  getPolicy(): Readonly<Cinema2QualityPolicy> {
    return cinema2QualityPolicy(this.requestedMode, this.autoQuality)
  }

  beginGpuFrame(): void {
    if (!this.ext || this.activeGpuQuery || typeof this.gl.createQuery !== 'function') return
    this.pollGpuResult()
    const query = this.gl.createQuery()
    if (!query) return
    try {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query)
      this.activeGpuQuery = query
    } catch {
      this.gl.deleteQuery(query)
    }
  }

  endGpuFrame(): void {
    if (!this.ext || !this.activeGpuQuery) return
    try {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      if (this.pendingGpuQuery) this.gl.deleteQuery(this.pendingGpuQuery)
      this.pendingGpuQuery = this.activeGpuQuery
    } catch {
      this.gl.deleteQuery(this.activeGpuQuery)
    } finally {
      this.activeGpuQuery = null
    }
  }

  sampleCpuFrame(frameMs: number): boolean {
    if (!Number.isFinite(frameMs) || frameMs < 0) return false
    this.cpuFrameTimeMs = frameMs
    this.cpuFrameTimeAverageMs = this.cpuFrameTimeAverageMs == null
      ? frameMs
      : this.cpuFrameTimeAverageMs * 0.9 + frameMs * 0.1
    if (this.requestedMode !== 'auto') return false

    const previous = this.autoQuality
    if (this.cpuFrameTimeAverageMs > 20) {
      this.slowSamples += 1
      this.fastSamples = 0
      if (this.slowSamples >= 12) this.autoQuality = stepQuality(this.autoQuality, -1)
    } else if (this.cpuFrameTimeAverageMs < 13.5) {
      this.fastSamples += 1
      this.slowSamples = 0
      if (this.fastSamples >= 90) this.autoQuality = stepQuality(this.autoQuality, 1)
    } else {
      this.slowSamples = 0
      this.fastSamples = 0
    }
    if (previous !== this.autoQuality) {
      this.slowSamples = 0
      this.fastSamples = 0
      return true
    }
    return false
  }

  markDegraded(reason: string | null): void {
    this.degraded = reason != null
    this.degradationReason = reason
  }

  getSnapshot(): Readonly<Cinema2PerformanceSnapshot> {
    this.pollGpuResult()
    const policy = this.getPolicy()
    return Object.freeze({
      diagnosticsEnabled: this.diagnosticsEnabled,
      requestedMode: this.requestedMode,
      resolvedQuality: policy.resolvedQuality,
      renderTargetScale: policy.renderTargetScale,
      gpuMemoryBudgetBytes: policy.gpuMemoryBudgetBytes,
      cpuFrameTimeMs: this.diagnosticsEnabled ? this.cpuFrameTimeMs : null,
      cpuFrameTimeAverageMs: this.diagnosticsEnabled ? this.cpuFrameTimeAverageMs : null,
      gpuFrameTimeMs: this.diagnosticsEnabled ? this.gpuFrameTimeMs : null,
      gpuTimingSupported: this.ext != null,
      degraded: this.degraded,
      degradationReason: this.degradationReason,
    })
  }

  dispose(): void {
    if (this.activeGpuQuery) this.gl.deleteQuery(this.activeGpuQuery)
    if (this.pendingGpuQuery) this.gl.deleteQuery(this.pendingGpuQuery)
    this.activeGpuQuery = null
    this.pendingGpuQuery = null
  }

  private pollGpuResult(): void {
    if (!this.ext || !this.pendingGpuQuery || typeof this.gl.getQueryParameter !== 'function') return
    try {
      const available = this.gl.getQueryParameter(this.pendingGpuQuery, this.gl.QUERY_RESULT_AVAILABLE)
      const disjoint = typeof this.gl.getParameter === 'function' ? Boolean(this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) : false
      if (!available) return
      if (!disjoint) {
        const nanoseconds = Number(this.gl.getQueryParameter(this.pendingGpuQuery, this.gl.QUERY_RESULT))
        if (Number.isFinite(nanoseconds) && nanoseconds >= 0) this.gpuFrameTimeMs = nanoseconds / 1_000_000
      }
      this.gl.deleteQuery(this.pendingGpuQuery)
      this.pendingGpuQuery = null
    } catch {
      if (this.pendingGpuQuery) this.gl.deleteQuery(this.pendingGpuQuery)
      this.pendingGpuQuery = null
    }
  }
}

function stepQuality(current: Cinema2RenderQualityLevel, delta: -1 | 1): Cinema2RenderQualityLevel {
  const index = AUTO_LEVELS.indexOf(current)
  return AUTO_LEVELS[Math.max(0, Math.min(AUTO_LEVELS.length - 1, index + delta))]
}

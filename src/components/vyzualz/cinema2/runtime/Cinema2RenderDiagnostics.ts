import { Cinema2GlResourceTracker, type Cinema2GlResourceSnapshot } from './Cinema2GlResourceTracker'
import { Cinema2GpuTimerPool, type Cinema2GpuTimingEntry } from './Cinema2GpuTimerPool'
import { getCinema2RenderTargetPool, type Cinema2RenderTargetPoolStats } from './Cinema2RenderTargetPool'

/**
 * Developer-facing rendering diagnostics: FPS and frame time, draw calls and triangles, textures and estimated GPU memory, render-target
 * allocations, shader compile activity, the active post-processing passes and, where the GPU offers it, per-section GPU time.
 *
 * It is attached from outside (a validation scene, the browser console, a test harness) and costs nothing until then: no existing preset or the
 * production runtime creates one. Reading is by `getSnapshot()` (plain JSON) or, in development builds, the `__CINEMA2_RENDER_DIAGNOSTICS__`
 * global that `installCinema2RenderDiagnosticsGlobal` registers. There is deliberately no production UI.
 *
 * Call `beginFrame()` / `endFrame()` around each frame. Draw and triangle counts come from wrapping the context's draw calls, so they include
 * Three's draws and the engine's own fullscreen passes alike.
 */
export interface Cinema2RenderDiagnosticsOptions {
  /** Count frame times over this many recent frames. */
  window?: number
  now?: () => number
  /** Extra Three-side numbers (`renderer.info`) read when taking a snapshot. */
  readThreeInfo?: () => Readonly<{ geometries: number; textures: number; programs: number }> | null
}

export interface Cinema2RenderDiagnosticsSnapshot {
  frame: Readonly<{ count: number; lastMs: number; averageMs: number; p95Ms: number; maxMs: number; fps: number }>
  draw: Readonly<{ drawCalls: number; triangles: number; lines: number; points: number }>
  resources: Readonly<Cinema2GlResourceSnapshot>
  renderTargets: Readonly<{ framebuffers: number; createdTotal: number; pool: Readonly<Cinema2RenderTargetPoolStats> }>
  shaders: Readonly<{ programs: number; linkedTotal: number; compiledTotal: number; linkMsTotal: number; linkedLastFrame: number; compilingNow: boolean }>
  passes: readonly string[]
  gpu: Readonly<{ supported: boolean; disjointCount: number; sections: readonly Readonly<Cinema2GpuTimingEntry>[] }>
  three: Readonly<{ geometries: number; textures: number; programs: number }> | null
}

export class Cinema2RenderDiagnostics {
  private readonly tracker: Cinema2GlResourceTracker
  private readonly timers: Cinema2GpuTimerPool
  private readonly frameTimes: number[] = []
  private readonly window: number
  private readonly now: () => number
  private frameStart = 0
  private frameCount = 0
  private passes: string[] = []
  private attached = false

  constructor(private readonly gl: WebGL2RenderingContext, private readonly options: Cinema2RenderDiagnosticsOptions = {}) {
    this.window = options.window ?? 120
    this.now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.tracker = new Cinema2GlResourceTracker(gl, this.now)
    this.timers = new Cinema2GpuTimerPool(gl)
  }

  /** Starts counting. Attach before the scene is built so its resources are included. */
  attach(): this {
    if (this.attached) return this
    this.attached = true
    this.tracker.attach()
    return this
  }

  /** Stops counting and removes every wrapper from the context. */
  detach(): void {
    if (!this.attached) return
    this.attached = false
    this.tracker.detach()
    this.timers.dispose()
  }

  beginFrame(): void {
    this.frameStart = this.now()
    this.tracker.beginFrame()
    this.timers.collect()
  }

  endFrame(): void {
    const elapsed = this.now() - this.frameStart
    this.tracker.endFrame()
    this.frameCount += 1
    this.frameTimes.push(elapsed)
    if (this.frameTimes.length > this.window) this.frameTimes.shift()
  }

  /** The post-processing passes that ran this frame (effect ids or labels). */
  setActivePasses(passes: readonly string[]): void {
    this.passes = [...passes]
  }

  /** Times the GL work `fn` issues on the GPU (no nesting). Returns `fn`'s result. */
  measureGpu<T>(label: string, fn: () => T): T {
    return this.timers.measure(label, fn)
  }

  handleContextLost(): void {
    this.tracker.handleContextLost()
    this.timers.handleContextLost()
  }

  handleContextRestored(): void {
    this.timers.handleContextRestored()
  }

  getSnapshot(): Readonly<Cinema2RenderDiagnosticsSnapshot> {
    const times = this.frameTimes
    const sorted = [...times].sort((a, b) => a - b)
    const averageMs = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : 0
    const resources = this.tracker.getSnapshot()
    const last = resources.lastFrame
    return Object.freeze({
      frame: Object.freeze({
        count: this.frameCount,
        lastMs: times.length ? times[times.length - 1]! : 0,
        averageMs,
        p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0,
        maxMs: sorted.length ? sorted[sorted.length - 1]! : 0,
        fps: averageMs > 0 ? 1000 / averageMs : 0,
      }),
      draw: Object.freeze({ drawCalls: last.drawCalls, triangles: last.triangles, lines: last.lines, points: last.points }),
      resources,
      renderTargets: Object.freeze({
        framebuffers: resources.framebuffers.count,
        createdTotal: resources.framebuffers.createdTotal,
        pool: getCinema2RenderTargetPool(this.gl).getStats(),
      }),
      shaders: Object.freeze({
        programs: resources.programs.count,
        linkedTotal: resources.programs.linkedTotal,
        compiledTotal: resources.programs.compiledTotal,
        linkMsTotal: resources.programs.linkMsTotal,
        linkedLastFrame: last.programLinks,
        compilingNow: resources.currentFrame.programLinks > 0 || resources.currentFrame.shaderCompiles > 0,
      }),
      passes: Object.freeze([...this.passes]),
      gpu: Object.freeze({ supported: this.timers.supported, disjointCount: this.timers.getDisjointCount(), sections: Object.freeze(this.timers.getTimings()) }),
      three: this.options.readThreeInfo?.() ?? null,
    })
  }
}

export interface Cinema2RenderDiagnosticsGlobal {
  attach(target: WebGL2RenderingContext | HTMLCanvasElement | string): Cinema2RenderDiagnostics
  get(): Cinema2RenderDiagnostics | null
  snapshot(): Readonly<Cinema2RenderDiagnosticsSnapshot> | null
  detach(): void
}

/**
 * Registers `globalThis.__CINEMA2_RENDER_DIAGNOSTICS__` so the console can attach diagnostics to a live canvas: `attach('canvas')` takes a CSS
 * selector, a canvas element or a WebGL2 context. Call from development entry points only (`import.meta.env.DEV`).
 */
export function installCinema2RenderDiagnosticsGlobal(target: Record<string, unknown> = globalThis as Record<string, unknown>): Cinema2RenderDiagnosticsGlobal {
  let current: Cinema2RenderDiagnostics | null = null
  const api: Cinema2RenderDiagnosticsGlobal = {
    attach(source) {
      current?.detach()
      let gl: WebGL2RenderingContext | null = null
      if (typeof source === 'string') {
        const canvas = document.querySelector(source) as HTMLCanvasElement | null
        gl = canvas?.getContext('webgl2') ?? null
      } else if ('getContext' in source) {
        gl = source.getContext('webgl2')
      } else {
        gl = source
      }
      if (!gl) throw new Error('Cinema 2.0 diagnostics could not find a WebGL2 context to attach to.')
      current = new Cinema2RenderDiagnostics(gl).attach()
      return current
    },
    get: () => current,
    snapshot: () => current?.getSnapshot() ?? null,
    detach() { current?.detach(); current = null },
  }
  target.__CINEMA2_RENDER_DIAGNOSTICS__ = api
  return api
}

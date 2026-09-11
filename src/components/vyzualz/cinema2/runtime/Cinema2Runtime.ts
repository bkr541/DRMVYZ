import {
  registerDrmvyzWebGLContext,
  retireDrmvyzWebGLContext,
  type WebGLContextDiagnosticHandle,
} from '../../react/shaders/runtime/WebGLContextLifecycle'

export type Cinema2RuntimePhase =
  | 'initializing'
  | 'running'
  | 'suspended'
  | 'context-lost'
  | 'unavailable'
  | 'disposed'

export interface Cinema2Viewport {
  width: number
  height: number
  dpr: number
}

export interface Cinema2RuntimeResourceSnapshot {
  activeAnimationFrameCount: number
  activeEventListenerCount: number
  activeWebGLContextCount: number
}

export interface Cinema2RuntimeSnapshot {
  phase: Cinema2RuntimePhase
  viewport: Cinema2Viewport
  frameCount: number
  contextGeneration: number
  statusMessage: string | null
  resources: Cinema2RuntimeResourceSnapshot
}

export interface Cinema2RuntimeDiagnostics {
  createdRuntimeCount: number
  disposedRuntimeCount: number
  activeRuntimeCount: number
  activeAnimationFrameCount: number
  activeEventListenerCount: number
  activeWebGLContextCount: number
}

export interface Cinema2RuntimeCreateOptions {
  requestAnimationFrame?: typeof requestAnimationFrame
  cancelAnimationFrame?: typeof cancelAnimationFrame
  onSnapshot?: (snapshot: Cinema2RuntimeSnapshot) => void
}

export type Cinema2RuntimeCreateResult =
  | { runtime: Cinema2Runtime; error: null; snapshot: Cinema2RuntimeSnapshot }
  | { runtime: null; error: string; snapshot: Cinema2RuntimeSnapshot }

const diagnostics: Cinema2RuntimeDiagnostics = {
  createdRuntimeCount: 0,
  disposedRuntimeCount: 0,
  activeRuntimeCount: 0,
  activeAnimationFrameCount: 0,
  activeEventListenerCount: 0,
  activeWebGLContextCount: 0,
}

const EMPTY_VIEWPORT: Cinema2Viewport = { width: 1, height: 1, dpr: 1 }

function unavailableSnapshot(message: string): Cinema2RuntimeSnapshot {
  return {
    phase: 'unavailable',
    viewport: { ...EMPTY_VIEWPORT },
    frameCount: 0,
    contextGeneration: 0,
    statusMessage: message,
    resources: {
      activeAnimationFrameCount: 0,
      activeEventListenerCount: 0,
      activeWebGLContextCount: 0,
    },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Process-local lifecycle diagnostics for the Cinema 2.0 runtime family.
 * These counts intentionally describe owned resources, not browser-global
 * WebGL objects, so engine switching can prove deterministic retirement.
 */
export function getCinema2RuntimeDiagnostics(): Readonly<Cinema2RuntimeDiagnostics> {
  return { ...diagnostics }
}

/**
 * Minimal native Cinema 2.0 runtime foundation.
 *
 * This runtime deliberately owns only lifecycle, one WebGL2 context, one RAF
 * loop, a deterministic safe frame, resize state and context recovery. Preset
 * compilation, audio intelligence, graph execution and creative modules are
 * future Cinema 2.0 stages and are not delegated to Cinema 1 here.
 */
export class Cinema2Runtime {
  static create(
    canvas: HTMLCanvasElement,
    options: Cinema2RuntimeCreateOptions = {},
  ): Cinema2RuntimeCreateResult {
    let gl: WebGL2RenderingContext | null = null
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        desynchronized: true,
      }) as WebGL2RenderingContext | null
    } catch (error) {
      const message = `Cinema 2.0 could not initialize WebGL2: ${errorMessage(error)}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    if (!gl) {
      const message = 'Cinema 2.0 requires WebGL2, but WebGL2 is unavailable.'
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    let runtime: Cinema2Runtime | null = null
    try {
      runtime = new Cinema2Runtime(canvas, gl, options)
      runtime.renderSafeFrame()
      const snapshot = runtime.getSnapshot()
      return { runtime, error: null, snapshot }
    } catch (error) {
      runtime?.dispose()
      const message = `Cinema 2.0 runtime setup failed: ${errorMessage(error)}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }
  }

  private readonly requestFrame: typeof requestAnimationFrame
  private readonly cancelFrame: typeof cancelAnimationFrame
  private readonly onSnapshot: ((snapshot: Cinema2RuntimeSnapshot) => void) | null
  private readonly contextHandle: WebGLContextDiagnosticHandle | null
  private readonly onContextLostHandler: (event: Event) => void
  private readonly onContextRestoredHandler: () => void

  private phase: Cinema2RuntimePhase = 'initializing'
  private viewport: Cinema2Viewport = { ...EMPTY_VIEWPORT }
  private frameCount = 0
  private contextGeneration = 1
  private statusMessage: string | null = null
  private animationFrameId: number | null = null
  private runningRequested = false
  private suspended = false
  private contextLost = false
  private disposed = false
  private listenersAttached = false
  private contextOwned = false

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    options: Cinema2RuntimeCreateOptions,
  ) {
    this.requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
    this.cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
    this.onSnapshot = options.onSnapshot ?? null
    this.contextHandle = registerDrmvyzWebGLContext(gl, {
      lifetime: 'live-reusable',
      role: 'react-live-canvas',
      engine: 'cinema2',
      expectedMaxActive: 1,
    })

    this.onContextLostHandler = event => {
      if (this.disposed) return
      event.preventDefault()
      this.contextLost = true
      this.phase = 'context-lost'
      this.statusMessage = 'Cinema 2.0 paused because its WebGL2 context was lost.'
      this.cancelScheduledFrame()
      this.emitSnapshot()
    }

    this.onContextRestoredHandler = () => {
      if (this.disposed) return
      this.contextLost = false
      this.contextGeneration += 1
      this.statusMessage = null
      try {
        this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
        this.renderSafeFrame()
        this.phase = this.suspended ? 'suspended' : this.runningRequested ? 'running' : 'initializing'
        this.emitSnapshot()
        this.scheduleFrame()
      } catch (error) {
        this.runningRequested = false
        this.phase = 'unavailable'
        this.statusMessage = `Cinema 2.0 could not recover its WebGL2 context: ${errorMessage(error)}`
        this.cancelScheduledFrame()
        this.emitSnapshot()
      }
    }

    let contextLostListenerAttached = false
    try {
      canvas.addEventListener('webglcontextlost', this.onContextLostHandler)
      contextLostListenerAttached = true
      canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler)
    } catch (error) {
      if (contextLostListenerAttached) {
        canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
      }
      retireDrmvyzWebGLContext(this.contextHandle, 'release-resources')
      throw error
    }

    this.contextOwned = true
    this.listenersAttached = true
    diagnostics.createdRuntimeCount += 1
    diagnostics.activeRuntimeCount += 1
    diagnostics.activeWebGLContextCount += 1
    diagnostics.activeEventListenerCount += 2
  }

  start(): void {
    if (this.disposed || this.phase === 'unavailable') return
    this.runningRequested = true
    this.phase = this.contextLost ? 'context-lost' : this.suspended ? 'suspended' : 'running'
    this.statusMessage = this.contextLost
      ? 'Cinema 2.0 paused because its WebGL2 context was lost.'
      : null
    this.emitSnapshot()
    this.scheduleFrame()
  }

  setSuspended(suspended: boolean): void {
    if (this.disposed || this.phase === 'unavailable' || this.suspended === suspended) return
    this.suspended = suspended
    if (suspended) {
      this.phase = 'suspended'
      this.cancelScheduledFrame()
      this.emitSnapshot()
      return
    }

    this.phase = this.contextLost ? 'context-lost' : this.runningRequested ? 'running' : 'initializing'
    this.emitSnapshot()
    this.scheduleFrame()
  }

  resize(viewport: Cinema2Viewport): boolean {
    if (this.disposed || this.phase === 'unavailable') return false
    const nextViewport: Cinema2Viewport = {
      width: Math.max(1, Math.round(finitePositive(viewport.width, 1))),
      height: Math.max(1, Math.round(finitePositive(viewport.height, 1))),
      dpr: finitePositive(viewport.dpr, 1),
    }
    const changed = this.viewport.width !== nextViewport.width
      || this.viewport.height !== nextViewport.height
      || Math.abs(this.viewport.dpr - nextViewport.dpr) > 1e-6
      || this.canvas.width !== nextViewport.width
      || this.canvas.height !== nextViewport.height
    if (!changed) return false

    this.viewport = nextViewport
    this.canvas.width = nextViewport.width
    this.canvas.height = nextViewport.height
    if (!this.contextLost) {
      this.gl.viewport(0, 0, nextViewport.width, nextViewport.height)
      this.renderSafeFrame()
    }
    this.emitSnapshot()
    return true
  }

  getSnapshot(): Cinema2RuntimeSnapshot {
    return {
      phase: this.phase,
      viewport: { ...this.viewport },
      frameCount: this.frameCount,
      contextGeneration: this.contextGeneration,
      statusMessage: this.statusMessage,
      resources: {
        activeAnimationFrameCount: this.animationFrameId == null ? 0 : 1,
        activeEventListenerCount: this.listenersAttached ? 2 : 0,
        activeWebGLContextCount: this.contextOwned ? 1 : 0,
      },
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.runningRequested = false
    this.cancelScheduledFrame()

    if (this.listenersAttached) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler)
      this.listenersAttached = false
      diagnostics.activeEventListenerCount = Math.max(0, diagnostics.activeEventListenerCount - 2)
    }

    if (this.contextOwned) {
      retireDrmvyzWebGLContext(this.contextHandle, 'release-resources')
      this.contextOwned = false
      diagnostics.activeWebGLContextCount = Math.max(0, diagnostics.activeWebGLContextCount - 1)
    }

    diagnostics.activeRuntimeCount = Math.max(0, diagnostics.activeRuntimeCount - 1)
    diagnostics.disposedRuntimeCount += 1
    this.phase = 'disposed'
    this.statusMessage = null
    this.emitSnapshot()
  }

  private renderSafeFrame(): void {
    if (this.disposed || this.contextLost) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.flush()
  }

  private scheduleFrame(): void {
    if (
      this.disposed
      || !this.runningRequested
      || this.suspended
      || this.contextLost
      || this.phase === 'unavailable'
      || this.animationFrameId != null
    ) return
    this.animationFrameId = this.requestFrame(this.runFrame)
    diagnostics.activeAnimationFrameCount += 1
  }

  private readonly runFrame = (): void => {
    if (this.animationFrameId != null) {
      this.animationFrameId = null
      diagnostics.activeAnimationFrameCount = Math.max(0, diagnostics.activeAnimationFrameCount - 1)
    }
    if (this.disposed || !this.runningRequested || this.suspended || this.contextLost || this.phase === 'unavailable') return

    try {
      this.renderSafeFrame()
      this.frameCount += 1
    } catch (error) {
      this.runningRequested = false
      this.phase = 'unavailable'
      this.statusMessage = `Cinema 2.0 stopped after a WebGL2 render failure: ${errorMessage(error)}`
      this.emitSnapshot()
      return
    }
    this.scheduleFrame()
  }

  private cancelScheduledFrame(): void {
    if (this.animationFrameId == null) return
    this.cancelFrame(this.animationFrameId)
    this.animationFrameId = null
    diagnostics.activeAnimationFrameCount = Math.max(0, diagnostics.activeAnimationFrameCount - 1)
  }

  private emitSnapshot(): void {
    if (!this.onSnapshot) return
    try {
      this.onSnapshot(this.getSnapshot())
    } catch (error) {
      if (import.meta.env.DEV) console.error('[Cinema2Runtime] snapshot listener failed:', error)
    }
  }
}

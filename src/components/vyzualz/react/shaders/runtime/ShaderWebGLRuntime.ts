import type { FrameState, RuntimeDimensions } from './shaderRuntimeTypes'
import { applyCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import {
  registerDrmvyzWebGLContext,
  retireDrmvyzWebGLContext,
  type WebGLContextDiagnosticHandle,
  type WebGLContextDisposalMode,
  type WebGLContextOwnership,
} from './WebGLContextLifecycle'

// ── Constants ─────────────────────────────────────────────────────────────────

export const MIN_RESOLUTION_SCALE = 0.1
export const MAX_RESOLUTION_SCALE = 1.0

// ── Result types ──────────────────────────────────────────────────────────────

export type RuntimeCreateResult =
  | { runtime: ShaderWebGLRuntime; error: null }
  | { runtime: null; error: string }

// ── ShaderWebGLRuntime ────────────────────────────────────────────────────────

export class ShaderWebGLRuntime {
  private _canvas: HTMLCanvasElement | null
  private _gl: WebGL2RenderingContext | null
  private readonly _ownership: WebGLContextOwnership
  private _diagnosticHandle: WebGLContextDiagnosticHandle | null
  private _onContextLostCallback: (() => void) | null
  private _onContextRestoredCallback: (() => void) | null
  private _disposed     = false
  private _contextLost  = false
  private _resolutionScale: number
  private _dims: RuntimeDimensions = { W: 1, H: 1, aspect: 1, pixelRatio: 1 }
  private readonly _startTime: number
  private _lastFrameTime: number

  // Stored so dispose() can remove them before calling loseContext().
  private readonly _onContextLostHandler:     (e: Event) => void
  private readonly _onContextRestoredHandler: () => void

  // ── Factory ───────────────────────────────────────────────────────────────

  /**
   * Attempt to acquire a WebGL2 context on the supplied canvas.
   *
   * Returns a discriminated-union result rather than throwing so callers can
   * degrade gracefully when WebGL2 is unavailable:
   *
   *   { runtime: ShaderWebGLRuntime; error: null }  — success
   *   { runtime: null; error: string }              — failure with reason
   */
  static create(
    canvas: HTMLCanvasElement,
    opts?: {
      resolutionScale?: number
      onContextLost?: () => void
      onContextRestored?: () => void
      ownership?: WebGLContextOwnership
    },
  ): RuntimeCreateResult {
    const gl = canvas.getContext('webgl2', {
      alpha:                false,
      antialias:            false,
      depth:                false,
      stencil:              false,
      premultipliedAlpha:   false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null

    if (!gl) return { runtime: null, error: 'WebGL2 unavailable in this environment' }

    return { runtime: new ShaderWebGLRuntime(canvas, gl, opts), error: null }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl:     WebGL2RenderingContext,
    opts?: {
      resolutionScale?: number
      onContextLost?: () => void
      onContextRestored?: () => void
      ownership?: WebGLContextOwnership
    },
  ) {
    this._canvas = canvas
    this._gl = gl
    this._ownership = opts?.ownership ?? {
      lifetime: 'live-reusable',
      role: 'unspecified-live-webgl',
      engine: 'unknown',
    }
    this._diagnosticHandle = registerDrmvyzWebGLContext(gl, this._ownership)
    this._onContextLostCallback = opts?.onContextLost ?? null
    this._onContextRestoredCallback = opts?.onContextRestored ?? null

    const now = performance.now() * 0.001
    this._startTime     = now
    this._lastFrameTime = now

    this._resolutionScale = clampScale(opts?.resolutionScale ?? 1.0)

    this._onContextLostHandler = (e: Event) => {
      e.preventDefault()
      this._contextLost = true
      if (import.meta.env.DEV) console.warn('[ShaderWebGLRuntime] context lost')
      this._onContextLostCallback?.()
    }
    this._onContextRestoredHandler = () => {
      this._contextLost = false
      if (import.meta.env.DEV) console.log('[ShaderWebGLRuntime] context restored')
      // Runtime owns no GPU resources of its own; scene-level rebuild is the
      // caller's responsibility via the onContextRestored callback.
      this._onContextRestoredCallback?.()
    }

    canvas.addEventListener('webglcontextlost',     this._onContextLostHandler)
    canvas.addEventListener('webglcontextrestored', this._onContextRestoredHandler)
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get gl(): WebGL2RenderingContext {
    if (!this._gl) throw new Error('Shader WebGL runtime is disposed')
    return this._gl
  }
  get dims():            RuntimeDimensions      { return { ...this._dims } }
  get contextLost():     boolean                { return this._contextLost }
  get disposed():        boolean                { return this._disposed }
  get resolutionScale(): number                 { return this._resolutionScale }

  // ── Resolution scale ──────────────────────────────────────────────────────

  setResolutionScale(scale: number): void {
    this._resolutionScale = clampScale(scale)
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  /**
   * Apply a centralized, already-resolved backing-store allocation.
   *
   * Returns true only when the integer backing dimensions changed. This keeps
   * downstream framebuffer resize paths from reallocating on fractional CSS
   * measurement chatter.
   */
  resize(resolution: CanvasResolution): boolean {
    if (this._disposed || this._contextLost || !resolution.valid) return false

    const W = resolution.backingWidth
    const H = resolution.backingHeight
    const dimensionsChanged = this._dims.W !== W || this._dims.H !== H
    const canvas = this._canvas
    const gl = this._gl
    if (!canvas || !gl) return false
    const storageChanged = applyCanvasResolution(canvas, resolution)

    this._dims = {
      W,
      H,
      aspect: W / H,
      pixelRatio: resolution.effectiveDpr,
    }

    if (dimensionsChanged || storageChanged) gl.viewport(0, 0, W, H)
    return dimensionsChanged
  }

  // ── Frame lifecycle ───────────────────────────────────────────────────────

  /**
   * Begin a render frame.  Returns a FrameState for the caller to pass to
   * scene renderers, or null when the context is lost or the runtime is
   * disposed (callers should skip rendering entirely in that case).
   */
  beginFrame(): FrameState | null {
    if (this._disposed || this._contextLost) return null

    const now = performance.now() * 0.001
    const dt  = Math.min(0.1, now - this._lastFrameTime)
    this._lastFrameTime = now

    return {
      time:      now - this._startTime,
      deltaTime: dt,
      dims:      { ...this._dims },
    }
  }

  /**
   * Clear the default framebuffer (or any currently bound FBO) to the given
   * RGBA colour.  Typically called by the active scene before its first draw.
   */
  clearViewport(r = 0, g = 0, b = 0, a = 1): void {
    if (this._disposed || this._contextLost) return
    const gl = this._gl
    if (!gl) return
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this._dims.W, this._dims.H)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** Flush the command queue at the end of the render frame. */
  endFrame(): void {
    if (this._disposed || this._contextLost) return
    this._gl?.flush()
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  /**
   * Release the runtime.  Idempotent — safe to call multiple times.
   *
   * Removes context-loss listeners and marks the runtime disposed. Live
   * reusable ownership never calls WEBGL_lose_context. Only explicit terminal
   * retirement of a transient thumbnail context may request context loss.
   */
  dispose(mode: WebGLContextDisposalMode = 'release-resources'): void {
    if (this._disposed) return
    this._disposed = true

    const canvas = this._canvas
    const gl = this._gl
    canvas?.removeEventListener('webglcontextlost', this._onContextLostHandler)
    canvas?.removeEventListener('webglcontextrestored', this._onContextRestoredHandler)

    const terminalTransient = mode === 'terminal-retire' && this._ownership.lifetime === 'transient-thumbnail'
    if (terminalTransient && gl) {
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      } catch {
        // Context loss may already be in progress or the extension may reject the call.
      }
      if (canvas) {
        canvas.width = 1
        canvas.height = 1
      }
    } else if (mode === 'terminal-retire' && import.meta.env.DEV) {
      console.warn('[ShaderWebGLRuntime] ignored terminal retirement for a live reusable context')
    }

    retireDrmvyzWebGLContext(
      this._diagnosticHandle,
      terminalTransient ? 'terminal-retire' : 'release-resources',
    )
    this._diagnosticHandle = null
    this._onContextLostCallback = null
    this._onContextRestoredCallback = null
    this._canvas = null
    this._gl = null
  }

  /**
   * Remove event listeners and mark disposed WITHOUT calling loseContext().
   * Use this inside an onContextRestored handler when the old runtime's GL
   * handles are already invalid — calling loseContext() would re-lose the
   * newly restored context.
   *
   * Delegates to dispose() since dispose() no longer calls loseContext().
   */
  disposeHandlers(): void {
    this.dispose('release-resources')
  }

  /**
   * Deliberately lose the WebGL context via WEBGL_lose_context.
   *
   * ONLY for use in automated tests that need to simulate context loss.
   * NEVER call from React component cleanup, scene switching, engine
   * switching, normal application shutdown, or context restoration.
   */
  forceLoseContextForTesting(): void {
    const ext = this._gl?.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function clampScale(scale: number): number {
  return Math.max(MIN_RESOLUTION_SCALE, Math.min(MAX_RESOLUTION_SCALE, scale))
}

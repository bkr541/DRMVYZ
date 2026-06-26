import type { FrameState, RuntimeDimensions } from './shaderRuntimeTypes'

// ── Constants ─────────────────────────────────────────────────────────────────

export const MIN_RESOLUTION_SCALE = 0.1
export const MAX_RESOLUTION_SCALE = 1.0

// ── Result types ──────────────────────────────────────────────────────────────

export type RuntimeCreateResult =
  | { runtime: ShaderWebGLRuntime; error: null }
  | { runtime: null; error: string }

// ── ShaderWebGLRuntime ────────────────────────────────────────────────────────

export class ShaderWebGLRuntime {
  private readonly _canvas: HTMLCanvasElement
  private readonly _gl:     WebGL2RenderingContext
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
    },
  ) {
    this._canvas = canvas
    this._gl     = gl

    const now = performance.now() * 0.001
    this._startTime     = now
    this._lastFrameTime = now

    this._resolutionScale = clampScale(opts?.resolutionScale ?? 1.0)

    this._onContextLostHandler = (e: Event) => {
      e.preventDefault()
      this._contextLost = true
      if (import.meta.env.DEV) console.warn('[ShaderWebGLRuntime] context lost')
      opts?.onContextLost?.()
    }
    this._onContextRestoredHandler = () => {
      this._contextLost = false
      if (import.meta.env.DEV) console.log('[ShaderWebGLRuntime] context restored')
      // Runtime owns no GPU resources of its own; scene-level rebuild is the
      // caller's responsibility via the onContextRestored callback.
      opts?.onContextRestored?.()
    }

    canvas.addEventListener('webglcontextlost',     this._onContextLostHandler)
    canvas.addEventListener('webglcontextrestored', this._onContextRestoredHandler)
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get gl():              WebGL2RenderingContext { return this._gl }
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
   * Update the canvas drawing buffer to match the current CSS size, device
   * pixel ratio, and resolution scale.  Call from a ResizeObserver or any
   * time the canvas layout dimensions change.
   *
   * @param cssW       Canvas CSS width in logical pixels.
   * @param cssH       Canvas CSS height in logical pixels.
   * @param pixelRatio Device pixel ratio (default 1). Pass window.devicePixelRatio.
   */
  resize(cssW: number, cssH: number, pixelRatio = 1): void {
    if (this._disposed || this._contextLost) return

    const scale = this._resolutionScale
    const W = Math.max(1, Math.round(cssW * pixelRatio * scale))
    const H = Math.max(1, Math.round(cssH * pixelRatio * scale))

    this._canvas.width  = W
    this._canvas.height = H
    this._dims = { W, H, aspect: W / H, pixelRatio }

    this._gl.viewport(0, 0, W, H)
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this._dims.W, this._dims.H)
    gl.clearColor(r, g, b, a)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  /** Flush the command queue at the end of the render frame. */
  endFrame(): void {
    if (this._disposed || this._contextLost) return
    this._gl.flush()
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  /**
   * Release the runtime.  Idempotent — safe to call multiple times.
   * Removes context-loss listeners before calling loseContext() so the
   * onContextLost callback is not re-triggered during shutdown.
   */
  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    this._canvas.removeEventListener('webglcontextlost',     this._onContextLostHandler)
    this._canvas.removeEventListener('webglcontextrestored', this._onContextRestoredHandler)

    const ext = this._gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }

  /**
   * Remove event listeners and mark disposed WITHOUT calling loseContext().
   * Use this inside an onContextRestored handler when the old runtime's GL
   * handles are already invalid — calling loseContext() would re-lose the
   * newly restored context.
   */
  disposeHandlers(): void {
    if (this._disposed) return
    this._disposed = true
    this._canvas.removeEventListener('webglcontextlost',     this._onContextLostHandler)
    this._canvas.removeEventListener('webglcontextrestored', this._onContextRestoredHandler)
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function clampScale(scale: number): number {
  return Math.max(MIN_RESOLUTION_SCALE, Math.min(MAX_RESOLUTION_SCALE, scale))
}

import { ShaderFramebuffer } from '../runtime/ShaderFramebuffer'
import type { TextureFormat, TextureFilter, TextureWrap } from '../runtime/shaderRuntimeTypes'

// ── ShaderPingPongBuffer ──────────────────────────────────────────────────────

/**
 * Paired framebuffer abstraction for persistent, frame-to-frame feedback.
 *
 * At any given time one buffer is the READ target (previous frame) and the
 * other is the WRITE target (current frame).  After each feedback pass call
 * swap() to flip roles so the next frame reads what was just written.
 *
 * Resize guarantees:
 *   - Both buffers are always recreated together.
 *   - Both are cleared to opaque black after resize to prevent stale content.
 *   - The internal swap index is preserved across resizes.
 *
 * Lifecycle:
 *   create → resize(w,h) → [each frame] swap() → dispose()
 */
export class ShaderPingPongBuffer {
  private readonly _a: ShaderFramebuffer
  private readonly _b: ShaderFramebuffer
  private _frozen  = false
  private _w       = 0
  private _h       = 0
  private _readIdx = 0   // 0 = _a is read, 1 = _b is read
  private _disposed = false

  constructor(
    private readonly _gl: WebGL2RenderingContext,
    format: TextureFormat = 'rgba8',
    filter: TextureFilter = 'linear',
    wrap:   TextureWrap   = 'clamp',
  ) {
    const desc = { format, filter, wrap }
    this._a = new ShaderFramebuffer(_gl, desc)
    this._b = new ShaderFramebuffer(_gl, desc)
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /** Texture from the previous frame — use as a sampler input in the current pass. */
  get readTexture(): WebGLTexture | null {
    return this._readIdx === 0 ? this._a.texture : this._b.texture
  }

  /** Framebuffer to render the current feedback frame into. */
  get writeFbo(): WebGLFramebuffer | null {
    return this._readIdx === 0 ? this._b.framebuffer : this._a.framebuffer
  }

  /**
   * Texture backing the current WRITE target.
   *
   * Exposed so callers can assert they are not about to bind it as a sampler
   * input: sampling the texture currently attached as the draw target is
   * undefined behaviour in WebGL, and typically shows as a black or garbage
   * frame with no reported error. Not needed to render — `readTexture` is the
   * one a pass should sample.
   */
  get writeTexture(): WebGLTexture | null {
    return this._readIdx === 0 ? this._b.texture : this._a.texture
  }

  /** Framebuffer holding the previous frame (rarely needed directly). */
  get readFbo(): WebGLFramebuffer | null {
    return this._readIdx === 0 ? this._a.framebuffer : this._b.framebuffer
  }

  get width():  number  { return this._w }
  get height(): number  { return this._h }
  get frozen(): boolean { return this._frozen }

  // ── Resize ────────────────────────────────────────────────────────────────

  /**
   * Resize both framebuffers.  A no-op if dimensions are unchanged.
   * Clears stale content after any resize.
   */
  resize(w: number, h: number): void {
    if (this._disposed) return
    const changed = w !== this._w || h !== this._h
    this._w = w
    this._h = h
    this._a.resize(w, h)
    this._b.resize(w, h)
    if (changed) this.clear()
  }

  // ── Swap ──────────────────────────────────────────────────────────────────

  /** Flip read/write roles.  Ignored when frozen. */
  swap(): void {
    if (this._disposed || this._frozen) return
    this._readIdx = this._readIdx === 0 ? 1 : 0
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  /** Clear both buffers to opaque black. */
  clear(): void {
    if (this._disposed) return
    const gl = this._gl
    for (const fbo of [this._a.framebuffer, this._b.framebuffer]) {
      if (!fbo) continue
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  // ── Freeze ────────────────────────────────────────────────────────────────

  /** Prevent swap() from flipping buffers (read stays read). */
  freeze():   void { this._frozen = true }
  unfreeze(): void { this._frozen = false }

  // ── Dispose ───────────────────────────────────────────────────────────────

  /** Dispose both framebuffers and release GPU memory. Idempotent. */
  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._a.dispose()
    this._b.dispose()
  }

  get disposed(): boolean { return this._disposed }
}

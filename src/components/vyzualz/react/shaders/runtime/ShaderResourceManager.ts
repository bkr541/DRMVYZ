// ── ShaderResourceManager ─────────────────────────────────────────────────────
//
// Centralises GPU resource lifetime so dispose is always safe to call more
// than once (Set membership prevents double-delete) and context restoration
// is handled cleanly (resetForRestore() wipes the tracking sets without
// issuing any GL calls on the dead context).

export class ShaderResourceManager {
  private readonly gl: WebGL2RenderingContext
  private readonly programs:     Set<WebGLProgram>           = new Set()
  private readonly textures:     Set<WebGLTexture>           = new Set()
  private readonly framebuffers: Set<WebGLFramebuffer>       = new Set()
  private readonly buffers:      Set<WebGLBuffer>            = new Set()
  private readonly vaos:         Set<WebGLVertexArrayObject> = new Set()
  private _disposed = false

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  // ── Tracking ──────────────────────────────────────────────────────────────

  trackProgram(p: WebGLProgram):         WebGLProgram         { this.programs.add(p);      return p }
  trackTexture(t: WebGLTexture):         WebGLTexture         { this.textures.add(t);      return t }
  trackFramebuffer(f: WebGLFramebuffer): WebGLFramebuffer     { this.framebuffers.add(f);  return f }
  trackBuffer(b: WebGLBuffer):           WebGLBuffer          { this.buffers.add(b);       return b }
  trackVAO(v: WebGLVertexArrayObject):   WebGLVertexArrayObject { this.vaos.add(v);         return v }

  untrackProgram(p: WebGLProgram):         void { this.programs.delete(p) }
  untrackTexture(t: WebGLTexture):         void { this.textures.delete(t) }
  untrackFramebuffer(f: WebGLFramebuffer): void { this.framebuffers.delete(f) }
  untrackBuffer(b: WebGLBuffer):           void { this.buffers.delete(b) }
  untrackVAO(v: WebGLVertexArrayObject):   void { this.vaos.delete(v) }

  // ── Disposal ──────────────────────────────────────────────────────────────

  /**
   * Delete every tracked GL object and clear all tracking sets.
   * Safe to call more than once — the second call is a no-op because all sets
   * are cleared on the first call and the `_disposed` guard prevents a repeat.
   */
  disposeAll(): void {
    if (this._disposed) return
    this._disposed = true

    const gl = this.gl
    this.programs.forEach(p     => gl.deleteProgram(p))
    this.textures.forEach(t     => gl.deleteTexture(t))
    this.framebuffers.forEach(f => gl.deleteFramebuffer(f))
    this.buffers.forEach(b      => gl.deleteBuffer(b))
    this.vaos.forEach(v         => gl.deleteVertexArray(v))

    this.programs.clear()
    this.textures.clear()
    this.framebuffers.clear()
    this.buffers.clear()
    this.vaos.clear()
  }

  /**
   * Prepare for WebGL context restoration.
   * After a context loss the existing GL handles are invalid — do NOT call
   * disposeAll() first (the context is already dead; GL calls are no-ops).
   * This method clears the tracking sets and resets the disposed flag so the
   * manager can accept fresh handles created during the re-init pass.
   */
  resetForRestore(): void {
    this.programs.clear()
    this.textures.clear()
    this.framebuffers.clear()
    this.buffers.clear()
    this.vaos.clear()
    this._disposed = false
  }
}

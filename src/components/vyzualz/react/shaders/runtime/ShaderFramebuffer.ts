import type { FramebufferDescriptor } from './shaderRuntimeTypes'

// ── ShaderFramebuffer ─────────────────────────────────────────────────────────

export class ShaderFramebuffer {
  private readonly gl: WebGL2RenderingContext
  private tex: WebGLTexture | null  = null
  private fbo: WebGLFramebuffer | null = null
  private _w = 0
  private _h = 0
  private _disposed = false
  private readonly desc: Required<FramebufferDescriptor>

  constructor(gl: WebGL2RenderingContext, desc: FramebufferDescriptor = {}) {
    this.gl   = gl
    this.desc = {
      format: desc.format ?? 'rgba8',
      filter: desc.filter ?? 'linear',
      wrap:   desc.wrap   ?? 'clamp',
    }
  }

  get width():       number                  { return this._w }
  get height():      number                  { return this._h }
  get texture():     WebGLTexture | null     { return this.tex }
  get framebuffer(): WebGLFramebuffer | null { return this.fbo }

  /**
   * Resize (or initially create) the backing texture and FBO.
   * Frees the previous texture and FBO before allocating new ones so no
   * GPU memory is leaked even after repeated resizes.
   * Throws if the FBO is incomplete after attachment.
   */
  resize(w: number, h: number): void {
    if (this._disposed) return
    if (w === this._w && h === this._h) return

    const gl = this.gl

    // Free the old resources before allocating new ones.
    if (this.fbo) { gl.deleteFramebuffer(this.fbo); this.fbo = null }
    if (this.tex) { gl.deleteTexture(this.tex);     this.tex = null }

    this._w = w
    this._h = h

    const { internalFormat, format, type } = this.resolveFormat()
    const wrap   = this.resolveWrap()
    const filter = this.resolveFilter()

    const tex = gl.createTexture()
    if (!tex) throw new Error(`[ShaderFramebuffer] createTexture() failed at ${w}×${h}`)

    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.bindTexture(gl.TEXTURE_2D, null)

    const fbo = gl.createFramebuffer()
    if (!fbo) {
      gl.deleteTexture(tex)
      throw new Error(`[ShaderFramebuffer] createFramebuffer() failed at ${w}×${h}`)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(tex)
      gl.deleteFramebuffer(fbo)
      throw new Error(
        `[ShaderFramebuffer] incomplete (0x${status.toString(16)}) at ${w}×${h} ` +
        `format=${this.desc.format}`,
      )
    }

    this.tex = tex
    this.fbo = fbo
  }

  bind(): void {
    if (this._disposed || !this.fbo) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo)
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    if (this.fbo) this.gl.deleteFramebuffer(this.fbo)
    if (this.tex) this.gl.deleteTexture(this.tex)
    this.fbo = null
    this.tex = null
  }

  // ── GL constant resolution ────────────────────────────────────────────────

  private resolveFormat(): { internalFormat: number; format: number; type: number } {
    const gl = this.gl
    switch (this.desc.format) {
      case 'rgba8':   return { internalFormat: gl.RGBA8,   format: gl.RGBA, type: gl.UNSIGNED_BYTE }
      case 'r8':      return { internalFormat: gl.R8,      format: gl.RED,  type: gl.UNSIGNED_BYTE }
      case 'rgba16f': return { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT    }
      case 'rgba32f': return { internalFormat: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT         }
    }
  }

  private resolveWrap(): number {
    const gl = this.gl
    switch (this.desc.wrap) {
      case 'clamp':  return gl.CLAMP_TO_EDGE
      case 'repeat': return gl.REPEAT
      case 'mirror': return gl.MIRRORED_REPEAT
    }
  }

  private resolveFilter(): number {
    const gl = this.gl
    switch (this.desc.filter) {
      case 'linear':  return gl.LINEAR
      case 'nearest': return gl.NEAREST
    }
  }
}

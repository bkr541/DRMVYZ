import type { TextureDescriptor } from './shaderRuntimeTypes'

// ── ShaderTexture ─────────────────────────────────────────────────────────────

export class ShaderTexture {
  private readonly gl: WebGL2RenderingContext
  private tex: WebGLTexture | null = null
  private _w = 0
  private _h = 0
  private _disposed = false
  private readonly desc: Required<TextureDescriptor>

  constructor(gl: WebGL2RenderingContext, desc: TextureDescriptor = {}) {
    this.gl   = gl
    this.desc = {
      format: desc.format ?? 'rgba8',
      wrap:   desc.wrap   ?? 'clamp',
      filter: desc.filter ?? 'linear',
    }
  }

  get width():  number              { return this._w }
  get height(): number              { return this._h }
  get handle(): WebGLTexture | null { return this.tex }

  // ── Allocation helpers ────────────────────────────────────────────────────

  private ensureTexture(): WebGLTexture {
    if (this.tex) return this.tex
    const gl = this.gl
    const t  = gl.createTexture()
    if (!t) throw new Error('[ShaderTexture] createTexture() returned null')
    this.tex = t
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this.resolveWrap())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this.resolveWrap())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.resolveFilter())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.resolveFilter())
    gl.bindTexture(gl.TEXTURE_2D, null)
    return t
  }

  // ── Upload methods ────────────────────────────────────────────────────────

  /** (Re-)allocate as an empty RGBA8 render target of the given size. */
  asRenderTarget(w: number, h: number): WebGLTexture {
    if (this._disposed) throw new Error('[ShaderTexture] disposed')
    const gl  = this.gl
    const tex = this.ensureTexture()
    this._w = w
    this._h = h
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }

  /** Upload raw byte data — suitable for FFT arrays and waveform uploads. */
  uploadBytes(w: number, h: number, data: Uint8Array | Uint8ClampedArray): void {
    if (this._disposed) return
    const gl  = this.gl
    const tex = this.ensureTexture()
    this._w = w
    this._h = h
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /** Upload from an HTMLImageElement or HTMLVideoElement (Y-flipped for WebGL convention). */
  uploadImage(source: HTMLImageElement | HTMLVideoElement): void {
    if (this._disposed) return
    const gl  = this.gl
    const tex = this.ensureTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  /** Upload from an HTMLCanvasElement (not Y-flipped — canvas pixels are already bottom-up). */
  uploadCanvas(source: HTMLCanvasElement): void {
    if (this._disposed) return
    const gl  = this.gl
    const tex = this.ensureTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  // ── Binding ───────────────────────────────────────────────────────────────

  bind(unit: number): void {
    if (this._disposed || !this.tex) return
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex)
  }

  unbind(unit: number): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    if (this.tex) this.gl.deleteTexture(this.tex)
    this.tex = null
  }

  // ── GL constant resolution ────────────────────────────────────────────────

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

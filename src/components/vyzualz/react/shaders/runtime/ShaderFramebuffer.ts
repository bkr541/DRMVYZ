import type { FramebufferDescriptor } from './shaderRuntimeTypes'

// ── Diagnostic maps ───────────────────────────────────────────────────────────

const FBO_STATUS_NAMES: Record<number, string> = {
  0x8CD6: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
  0x8CD7: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
  0x8CD9: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
  0x8CDD: 'FRAMEBUFFER_UNSUPPORTED',
  0x8D56: 'FRAMEBUFFER_INCOMPLETE_MULTISAMPLE',
}

const INTERNAL_FORMAT_NAMES: Record<number, string> = {
  0x8058: 'RGBA8',
  0x8229: 'R8',
  0x881A: 'RGBA16F',
  0x8814: 'RGBA32F',
}

const TYPE_NAMES: Record<number, string> = {
  0x1401: 'UNSIGNED_BYTE',
  0x140B: 'HALF_FLOAT',
  0x1406: 'FLOAT',
}

const GL_ERROR_NAMES: Record<number, string> = {
  0:      'NO_ERROR',
  0x0500: 'INVALID_ENUM',
  0x0501: 'INVALID_VALUE',
  0x0502: 'INVALID_OPERATION',
  0x0505: 'OUT_OF_MEMORY',
  0x0506: 'INVALID_FRAMEBUFFER_OPERATION',
}

// ── ShaderFramebuffer ─────────────────────────────────────────────────────────

export class ShaderFramebuffer {
  private readonly gl: WebGL2RenderingContext
  private tex: WebGLTexture | null  = null
  private fbo: WebGLFramebuffer | null = null
  private depth: WebGLRenderbuffer | null = null
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
      depth:  desc.depth  ?? false,
    }
  }

  get width():       number                  { return this._w }
  get height():      number                  { return this._h }
  get texture():     WebGLTexture | null     { return this.tex }
  get framebuffer(): WebGLFramebuffer | null { return this.fbo }
  get depthBuffer(): WebGLRenderbuffer | null { return this.depth }

  /**
   * Resize (or initially create) the backing texture and FBO.
   *
   * Transactional: allocates into local variables, validates completeness,
   * and only then deletes the old resources and commits the new handles.
   * On failure, the old valid FBO/texture are preserved unchanged.
   *
   * Returns silently (no throw) when:
   *   - The runtime context is lost
   *   - Dimensions are non-finite
   *   - Size is unchanged
   *   - The instance is disposed
   *
   * Throws a diagnostic error when allocation fails on a healthy context.
   */
  resize(w: number, h: number): void {
    if (this._disposed) return

    // Reject non-finite dimensions (NaN, Infinity) before normalisation.
    if (!Number.isFinite(w) || !Number.isFinite(h)) return

    const nextW = Math.max(1, Math.floor(w))
    const nextH = Math.max(1, Math.floor(h))

    if (nextW === this._w && nextH === this._h) return

    const gl = this.gl

    // Never attempt allocation while the context is lost — it will always fail.
    if (gl.isContextLost()) return

    const { internalFormat, format, type } = this.resolveFormat()
    const wrap   = this.resolveWrap()
    const filter = this.resolveFilter()

    // ── Allocate new texture into a LOCAL variable ────────────────────────────
    const newTex = gl.createTexture()
    if (!newTex) {
      if (!gl.isContextLost()) {
        throw new Error(`[ShaderFramebuffer] createTexture() failed at ${nextW}×${nextH}`)
      }
      return
    }

    gl.bindTexture(gl.TEXTURE_2D, newTex)

    // Use immutable texture storage (WebGL2) when available;
    // fall back to texImage2D for mocks or environments that omit it.
    const gl2 = gl as WebGL2RenderingContext & { texStorage2D?: (t: number, l: number, f: number, w: number, h: number) => void }
    if (typeof gl2.texStorage2D === 'function') {
      gl2.texStorage2D(gl.TEXTURE_2D, 1, internalFormat, nextW, nextH)
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, nextW, nextH, 0, format, type, null)
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.bindTexture(gl.TEXTURE_2D, null)

    // ── Allocate new FBO into a LOCAL variable ────────────────────────────────
    const newFbo = gl.createFramebuffer()
    if (!newFbo) {
      gl.deleteTexture(newTex)
      if (!gl.isContextLost()) {
        throw new Error(`[ShaderFramebuffer] createFramebuffer() failed at ${nextW}×${nextH}`)
      }
      return
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, newFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, newTex, 0)

    let newDepth: WebGLRenderbuffer | null = null
    if (this.desc.depth) {
      newDepth = gl.createRenderbuffer()
      if (!newDepth) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.deleteTexture(newTex)
        gl.deleteFramebuffer(newFbo)
        if (!gl.isContextLost()) {
          throw new Error(`[ShaderFramebuffer] createRenderbuffer() failed at ${nextW}×${nextH}`)
        }
        return
      }
      gl.bindRenderbuffer(gl.RENDERBUFFER, newDepth)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, nextW, nextH)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, newDepth)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
    }

    // Explicitly configure draw and read targets.
    gl.drawBuffers([gl.COLOR_ATTACHMENT0])
    gl.readBuffer(gl.COLOR_ATTACHMENT0)

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      // Allocation failed — delete ONLY the newly attempted resources.
      // The old valid fbo/tex are preserved intact.
      gl.deleteTexture(newTex)
      gl.deleteFramebuffer(newFbo)
      if (newDepth) gl.deleteRenderbuffer(newDepth)

      // Don't throw during a lost context — it will recover via restoration.
      if (gl.isContextLost()) return

      const statusName = FBO_STATUS_NAMES[status] ?? `UNKNOWN`
      const glError    = gl.getError()
      const maxTex     = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      const maxRb      = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
      throw new Error(
        `[ShaderFramebuffer] ${statusName} (0x${status.toString(16)})\n` +
        `size=${nextW}×${nextH}\n` +
        `format=${this.desc.format}\n` +
        `internalFormat=${INTERNAL_FORMAT_NAMES[internalFormat] ?? internalFormat}\n` +
        `type=${TYPE_NAMES[type] ?? type}\n` +
        `glError=${GL_ERROR_NAMES[glError] ?? `0x${glError.toString(16)}`}\n` +
        `contextLost=${gl.isContextLost()}\n` +
        `maxTextureSize=${maxTex}\n` +
        `maxRenderbufferSize=${maxRb}`,
      )
    }

    // ── Success: now safe to delete old resources and commit ──────────────────
    if (this.fbo) gl.deleteFramebuffer(this.fbo)
    if (this.tex) gl.deleteTexture(this.tex)
    if (this.depth) gl.deleteRenderbuffer(this.depth)

    this.tex = newTex
    this.fbo = newFbo
    this.depth = newDepth
    this._w  = nextW
    this._h  = nextH
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
    if (this.depth) this.gl.deleteRenderbuffer(this.depth)
    this.fbo = null
    this.tex = null
    this.depth = null
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

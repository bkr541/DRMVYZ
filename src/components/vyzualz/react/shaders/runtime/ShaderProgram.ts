import type { ShaderCompileFailure, ShaderLinkError } from './shaderRuntimeTypes'
import type { ShaderCompiler } from './ShaderCompiler'

// ── Descriptor and result types ───────────────────────────────────────────────

export interface ShaderProgramDescriptor {
  vertSrc: string
  fragSrc: string
  label: string
  /** Attribute name → explicit location, bound before linking. */
  attributes?: Record<string, number>
  /**
   * Uniform names whose absence at link time is a configuration error.
   * Missing required uniforms emit a dev-mode warning; setters silently skip them.
   */
  requiredUniforms?: string[]
  /** Uniform names that may or may not exist depending on shader variant. */
  optionalUniforms?: string[]
}

export type ShaderProgramResult =
  | { program: ShaderProgram; error: null }
  | { program: null; error: ShaderCompileFailure | ShaderLinkError }

// ── ShaderProgram ─────────────────────────────────────────────────────────────

export class ShaderProgram {
  private readonly gl: WebGL2RenderingContext
  private readonly prog: WebGLProgram
  private readonly uniformCache = new Map<string, WebGLUniformLocation | null>()
  private readonly attrCache    = new Map<string, number>()
  private _disposed = false

  private constructor(gl: WebGL2RenderingContext, prog: WebGLProgram) {
    this.gl   = gl
    this.prog = prog
  }

  static create(
    gl: WebGL2RenderingContext,
    compiler: ShaderCompiler,
    desc: ShaderProgramDescriptor,
  ): ShaderProgramResult {
    // ── Compile vertex shader ────────────────────────────────────────────────
    const vertResult = compiler.compile('vertex', desc.vertSrc, `${desc.label}/vert`)
    if (vertResult.shader === null) {
      return { program: null, error: vertResult.error }
    }
    const vert = vertResult.shader

    // ── Compile fragment shader ──────────────────────────────────────────────
    const fragResult = compiler.compile('fragment', desc.fragSrc, `${desc.label}/frag`)
    if (fragResult.shader === null) {
      gl.deleteShader(vert)
      return { program: null, error: fragResult.error }
    }
    const frag = fragResult.shader

    // ── Create and link program ──────────────────────────────────────────────
    const prog = gl.createProgram()
    if (!prog) {
      gl.deleteShader(vert)
      gl.deleteShader(frag)
      return {
        program: null,
        error: { stage: 'link', label: desc.label, log: 'gl.createProgram() returned null' },
      }
    }

    gl.attachShader(prog, vert)
    gl.attachShader(prog, frag)

    if (desc.attributes) {
      for (const [name, loc] of Object.entries(desc.attributes)) {
        gl.bindAttribLocation(prog, loc, name)
      }
    }

    gl.linkProgram(prog)

    // Shaders can be safely deleted now — they are attached to the program and
    // the GPU retains the compiled binary until the program is deleted.
    gl.deleteShader(vert)
    gl.deleteShader(frag)

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? ''
      if (import.meta.env.DEV) {
        console.error(`[ShaderProgram] link failed for "${desc.label}":`, log)
      }
      gl.deleteProgram(prog)
      return { program: null, error: { stage: 'link', label: desc.label, log } }
    }

    // ── Cache uniform locations ──────────────────────────────────────────────
    const instance = new ShaderProgram(gl, prog)
    const allUniforms = [
      ...(desc.requiredUniforms ?? []),
      ...(desc.optionalUniforms ?? []),
    ]
    for (const name of allUniforms) {
      const loc = gl.getUniformLocation(prog, name)
      instance.uniformCache.set(name, loc)
      if (loc === null && desc.requiredUniforms?.includes(name) && import.meta.env.DEV) {
        console.warn(`[ShaderProgram] required uniform "${name}" not found in "${desc.label}"`)
      }
    }

    return { program: instance, error: null }
  }

  // ── Activation ────────────────────────────────────────────────────────────

  activate(): void {
    if (this._disposed) return
    this.gl.useProgram(this.prog)
  }

  // ── Uniform location lookup ───────────────────────────────────────────────

  getUniform(name: string): WebGLUniformLocation | null {
    if (this.uniformCache.has(name)) return this.uniformCache.get(name) ?? null
    const loc = this.gl.getUniformLocation(this.prog, name)
    this.uniformCache.set(name, loc)
    return loc
  }

  getAttr(name: string): number {
    if (this.attrCache.has(name)) return this.attrCache.get(name)!
    const loc = this.gl.getAttribLocation(this.prog, name)
    this.attrCache.set(name, loc)
    return loc
  }

  // ── Typed uniform setters ─────────────────────────────────────────────────

  setFloat(name: string, v: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform1f(loc, v)
  }

  setInt(name: string, v: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform1i(loc, v)
  }

  setBool(name: string, v: boolean): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform1i(loc, v ? 1 : 0)
  }

  setVec2(name: string, x: number, y: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform2f(loc, x, y)
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform3f(loc, x, y, z)
  }

  setVec4(name: string, x: number, y: number, z: number, w: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform4f(loc, x, y, z, w)
  }

  setMat4(name: string, mat: Float32Array): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniformMatrix4fv(loc, false, mat)
  }

  setSampler(name: string, unit: number): void {
    const loc = this.getUniform(name)
    if (loc !== null) this.gl.uniform1i(loc, unit)
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this.gl.deleteProgram(this.prog)
  }
}


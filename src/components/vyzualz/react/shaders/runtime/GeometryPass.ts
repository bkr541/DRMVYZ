import type { RenderPassOptions, TextureBinding, GeometryPassInput } from './shaderRuntimeTypes'
import type { ShaderProgram } from './ShaderProgram'

// ── GeometryPass ──────────────────────────────────────────────────────────────
//
// Draws a polyline (e.g. a waveform trace) as instanced camera-facing quads —
// one instance per line segment. A fragment-only fullscreen pass cannot
// rasterize an arbitrary several-thousand-point polyline; this pass owns the
// VAO/VBOs needed to actually put segment geometry on the GPU.
//
// Per-vertex template (shared across all instances, uploaded once):
//   a_corner (location 0): (0,-0.5), (0,0.5), (1,-0.5), (1,0.5) — a unit quad
//   spanning the segment lengthwise (x: 0..1 along origin→target) and across
//   its width (y: -0.5..0.5). Drawn as a TRIANGLE_STRIP (4 verts/instance).
//
// Per-instance attributes (GEOMETRY_SEGMENT_FLOAT_STRIDE floats each, uploaded
// via bufferSubData from a caller-owned, reused Float32Array):
//   a_origin        (location 1, vec2)
//   a_target        (location 2, vec2)
//   a_color         (location 3, vec4)
//   a_density       (location 4, float)
//   a_dwellWeight   (location 5, float)
//   a_velocityRatio (location 6, float)
//
// Scenes declare these locations in their vertex shader via explicit
// `layout(location = N)` qualifiers (GLSL 300 es) — GeometryPass never needs
// to know the GLSL attribute names, only the fixed location contract above.
//
// Hot-path contract: the instance VBO is sized once (or grown, rarely) via
// bufferData; every frame's update is a single bufferSubData call against the
// caller's already-reused Float32Array — no allocation here.

export const GEOMETRY_SEGMENT_FLOAT_STRIDE = 11 // origin.xy + target.xy + color.rgba + density + dwellWeight + velocityRatio

const CORNER_LOCATION           = 0
const ORIGIN_LOCATION           = 1
const TARGET_LOCATION           = 2
const COLOR_LOCATION            = 3
const DENSITY_LOCATION          = 4
const DWELL_WEIGHT_LOCATION     = 5
const VELOCITY_RATIO_LOCATION   = 6

const CORNER_TEMPLATE = new Float32Array([
  0, -0.5,
  0, 0.5,
  1, -0.5,
  1, 0.5,
])

const DEFAULT_MAX_SEGMENTS = 4096
const BYTES_PER_FLOAT = 4
const STRIDE_BYTES = GEOMETRY_SEGMENT_FLOAT_STRIDE * BYTES_PER_FLOAT

export class GeometryPass {
  private readonly gl: WebGL2RenderingContext
  private _disposed = false

  private _vao: WebGLVertexArrayObject | null = null
  private _cornerVbo: WebGLBuffer | null = null
  private _instanceVbo: WebGLBuffer | null = null
  private _instanceCapacity = 0

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  private _ensureBuffers(requiredCapacity: number): void {
    const gl = this.gl

    if (!this._vao) {
      this._vao = gl.createVertexArray()
      this._cornerVbo = gl.createBuffer()
      this._instanceVbo = gl.createBuffer()

      gl.bindVertexArray(this._vao)

      gl.bindBuffer(gl.ARRAY_BUFFER, this._cornerVbo)
      gl.bufferData(gl.ARRAY_BUFFER, CORNER_TEMPLATE, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(CORNER_LOCATION)
      gl.vertexAttribPointer(CORNER_LOCATION, 2, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(CORNER_LOCATION, 0)

      gl.bindVertexArray(null)
    }

    if (requiredCapacity > this._instanceCapacity) {
      const nextCapacity = Math.max(requiredCapacity, this._instanceCapacity * 2 || DEFAULT_MAX_SEGMENTS)

      gl.bindVertexArray(this._vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceVbo)
      gl.bufferData(gl.ARRAY_BUFFER, nextCapacity * STRIDE_BYTES, gl.DYNAMIC_DRAW)

      const attr = (location: number, size: number, offsetFloats: number) => {
        gl.enableVertexAttribArray(location)
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE_BYTES, offsetFloats * BYTES_PER_FLOAT)
        gl.vertexAttribDivisor(location, 1)
      }
      attr(ORIGIN_LOCATION, 2, 0)
      attr(TARGET_LOCATION, 2, 2)
      attr(COLOR_LOCATION, 4, 4)
      attr(DENSITY_LOCATION, 1, 8)
      attr(DWELL_WEIGHT_LOCATION, 1, 9)
      attr(VELOCITY_RATIO_LOCATION, 1, 10)

      gl.bindVertexArray(null)
      this._instanceCapacity = nextCapacity
    }
  }

  /**
   * Execute a geometry render pass.
   *
   * @param program  Compiled ShaderProgram whose vertex shader expands
   *                 instanced quads from the segment attributes above.
   * @param target   Destination FBO, or null for the default framebuffer.
   * @param w        Target width in pixels.
   * @param h        Target height in pixels.
   * @param textures Texture units to bind before the draw call.
   * @param segments Per-instance segment data. A count of 0 draws nothing.
   * @param opts     Optional clear and viewport overrides.
   */
  run(
    program:  ShaderProgram,
    target:   WebGLFramebuffer | null,
    w:        number,
    h:        number,
    textures: TextureBinding[],
    segments: GeometryPassInput,
    opts:     RenderPassOptions = {},
  ): void {
    if (this._disposed) return
    const gl = this.gl
    const count = Math.max(0, Math.floor(segments.count))

    gl.bindFramebuffer(gl.FRAMEBUFFER, target)

    const vp = opts.viewport
    gl.viewport(
      vp?.x ?? 0,
      vp?.y ?? 0,
      vp?.w ?? w,
      vp?.h ?? h,
    )

    if (opts.clear) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }

    if (count === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      return
    }

    this._ensureBuffers(count)

    program.activate()

    for (const b of textures) {
      gl.activeTexture(gl.TEXTURE0 + b.unit)
      gl.bindTexture(gl.TEXTURE_2D, b.texture)
      program.setSampler(b.uniformName, b.unit)
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._instanceVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, segments.data, 0, count * GEOMETRY_SEGMENT_FLOAT_STRIDE)

    gl.bindVertexArray(this._vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
    gl.bindVertexArray(null)

    for (const b of textures) {
      gl.activeTexture(gl.TEXTURE0 + b.unit)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    const gl = this.gl
    if (this._vao) gl.deleteVertexArray(this._vao)
    if (this._cornerVbo) gl.deleteBuffer(this._cornerVbo)
    if (this._instanceVbo) gl.deleteBuffer(this._instanceVbo)
    this._vao = null
    this._cornerVbo = null
    this._instanceVbo = null
    this._instanceCapacity = 0
  }
}

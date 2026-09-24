// The single renderer behind the Media Manager live preview, still-image export
// and video export. It interprets a MediaEditState through mediaEditPipeline's
// pure parameters:
//
//   source ─► base pass (crop · orientation · sharpen · color) ─► [blur] ─► canvas
//
// Blur is a separable Gaussian run on a half-size pyramid so a strong blur costs
// a bounded number of taps at any resolution. Everything is premultiplied-alpha
// so transparent PNG/WebP sources keep their transparency.

import type { MediaEditState } from './mediaEditModel'
import {
  blurSigmaPx,
  buildColorTransform,
  isColorNeutral,
  opacityAmount,
  resolveEditGeometry,
  sharpenAmount,
  type EditGeometry,
  type EditGeometryOptions,
} from './mediaEditPipeline'

const VERTEX_SOURCE = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`

const BASE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_src;
uniform mat2 u_inverseOrientation;
uniform vec2 u_cropOrigin;
uniform vec2 u_cropSize;
uniform vec2 u_outputSize;
uniform float u_sharpen;
uniform bool u_colorEnabled;
uniform mat3 u_colorMatrix;
uniform vec3 u_colorOffset;
uniform float u_opacity;

vec4 fetchAt(vec2 outputUv) {
  vec2 cropUv = u_inverseOrientation * (outputUv - 0.5) + 0.5;
  return texture(u_src, u_cropOrigin + cropUv * u_cropSize);
}

void main() {
  // v_uv is bottom-up (GL); the frame is described top-down.
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 c = fetchAt(uv);
  if (u_sharpen > 0.0) {
    vec2 px = 1.0 / u_outputSize;
    vec4 around = fetchAt(uv + vec2(px.x, 0.0)) + fetchAt(uv - vec2(px.x, 0.0))
                + fetchAt(uv + vec2(0.0, px.y)) + fetchAt(uv - vec2(0.0, px.y));
    c = c + u_sharpen * (4.0 * c - around);
  }
  c = clamp(c, 0.0, 1.0);
  c.rgb = min(c.rgb, vec3(c.a));
  if (u_colorEnabled) {
    vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
    rgb = clamp(u_colorMatrix * rgb + u_colorOffset, 0.0, 1.0);
    c.rgb = rgb * c.a;
  }
  outColor = c * u_opacity;
}`

const DOWNSAMPLE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_texel;
void main() {
  outColor = 0.25 * (
    texture(u_tex, v_uv + vec2(-u_texel.x, -u_texel.y)) +
    texture(u_tex, v_uv + vec2( u_texel.x, -u_texel.y)) +
    texture(u_tex, v_uv + vec2(-u_texel.x,  u_texel.y)) +
    texture(u_tex, v_uv + vec2( u_texel.x,  u_texel.y)));
}`

const BLUR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform vec2 u_step;
uniform float u_sigma;
void main() {
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = -12; i <= 12; i++) {
    float d = float(i);
    float w = exp(-0.5 * d * d / (u_sigma * u_sigma));
    sum += w * texture(u_tex, v_uv + d * u_step);
    total += w;
  }
  outColor = sum / total;
}`

const PRESENT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_opacity;
void main() {
  outColor = texture(u_tex, v_uv) * u_opacity;
}`

/** Gaussian taps per pass; the pyramid keeps sigma at or below this level's useful range. */
const MAX_LEVEL_SIGMA = 4
const MAX_PYRAMID_LEVELS = 6
const BLUR_TARGET_A = MAX_PYRAMID_LEVELS
const BLUR_TARGET_B = MAX_PYRAMID_LEVELS + 1

interface Program {
  program: WebGLProgram
  uniforms: Map<string, WebGLUniformLocation | null>
}

interface RenderTarget {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

export interface MediaEditRenderInput {
  source: TexImageSource
  sourceWidth: number
  sourceHeight: number
  edit: MediaEditState
  geometry?: EditGeometryOptions
  /** Set false to reuse the previously uploaded source (still images, unchanged frames). */
  uploadSource?: boolean
}

export interface MediaEditRenderOptions {
  preserveDrawingBuffer?: boolean
}

export class MediaEditRenderer {
  private gl: WebGL2RenderingContext
  private programs: { base: Program; down: Program; blur: Program; present: Program } | null = null
  private sourceTexture: WebGLTexture | null = null
  private targets: Array<RenderTarget | null> = new Array(MAX_PYRAMID_LEVELS + 2).fill(null)
  private scratch: HTMLCanvasElement | null = null
  private lost = false
  private disposed = false
  private needsUpload = true
  /** The reason the most recent render() returned null, if any. */
  lastError: Error | null = null
  private readonly onLost = (event: Event) => { event.preventDefault(); this.lost = true }
  private readonly onRestored = () => { this.lost = false; this.targets.fill(null); this.needsUpload = true; this.init() }

  private constructor(private readonly canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
    this.init()
  }

  /** Returns null when this runtime cannot create a WebGL2 context. */
  static create(canvas: HTMLCanvasElement, options: MediaEditRenderOptions = {}): MediaEditRenderer | null {
    let gl: WebGL2RenderingContext | null = null
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: options.preserveDrawingBuffer === true,
      }) as WebGL2RenderingContext | null
    } catch {
      gl = null
    }
    if (!gl) return null
    try {
      return new MediaEditRenderer(canvas, gl)
    } catch {
      return null
    }
  }

  get isContextLost(): boolean {
    return this.lost || this.gl.isContextLost()
  }

  private init(): void {
    const { gl } = this
    this.programs = {
      base: this.link(BASE_FRAGMENT_SOURCE),
      down: this.link(DOWNSAMPLE_FRAGMENT_SOURCE),
      blur: this.link(BLUR_FRAGMENT_SOURCE),
      present: this.link(PRESENT_FRAGMENT_SOURCE),
    }
    this.sourceTexture = this.createTexture()
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
  }

  private compile(type: number, source: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)
    if (!shader) throw new Error('Could not create a shader.')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? 'unknown error'
      gl.deleteShader(shader)
      throw new Error(`Media edit shader failed to compile: ${log}`)
    }
    return shader
  }

  private link(fragmentSource: string): Program {
    const { gl } = this
    const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource)
    const program = gl.createProgram()
    if (!program) throw new Error('Could not create a shader program.')
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) ?? 'unknown error'
      gl.deleteProgram(program)
      throw new Error(`Media edit shader failed to link: ${log}`)
    }
    return { program, uniforms: new Map() }
  }

  private uniform(program: Program, name: string): WebGLUniformLocation | null {
    if (!program.uniforms.has(name)) program.uniforms.set(name, this.gl.getUniformLocation(program.program, name))
    return program.uniforms.get(name) ?? null
  }

  private createTexture(): WebGLTexture {
    const { gl } = this
    const texture = gl.createTexture()
    if (!texture) throw new Error('Could not create a texture.')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private target(index: number, width: number, height: number): RenderTarget {
    const { gl } = this
    const w = Math.max(1, Math.round(width))
    const h = Math.max(1, Math.round(height))
    const existing = this.targets[index]
    if (existing && existing.width === w && existing.height === h) return existing
    if (existing) this.deleteTarget(existing)
    const texture = this.createTexture()
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Could not create a framebuffer.')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const created: RenderTarget = { texture, framebuffer, width: w, height: h }
    this.targets[index] = created
    return created
  }

  private deleteTarget(target: RenderTarget): void {
    this.gl.deleteTexture(target.texture)
    this.gl.deleteFramebuffer(target.framebuffer)
  }

  private bindOutput(target: RenderTarget | null, width: number, height: number): void {
    const { gl } = this
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null)
    gl.viewport(0, 0, width, height)
  }

  private bindTexture(unit: number, texture: WebGLTexture): void {
    const { gl } = this
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
  }

  private draw(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3)
  }

  private uploadSource(source: TexImageSource, sourceWidth: number, sourceHeight: number): void {
    const { gl } = this
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    let uploadable: TexImageSource = source
    if (sourceWidth > maxSize || sourceHeight > maxSize) {
      // Normalized crop coordinates are resolution-independent, so a source that
      // is too large for the GPU can simply be uploaded at a reduced size.
      const scale = maxSize / Math.max(sourceWidth, sourceHeight)
      const scratch = this.scratch ?? (this.scratch = document.createElement('canvas'))
      scratch.width = Math.max(1, Math.floor(sourceWidth * scale))
      scratch.height = Math.max(1, Math.floor(sourceHeight * scale))
      const context = scratch.getContext('2d')
      if (!context) throw new Error('Could not downscale an oversized source.')
      context.clearRect(0, 0, scratch.width, scratch.height)
      context.drawImage(source as CanvasImageSource, 0, 0, scratch.width, scratch.height)
      uploadable = scratch
    }
    this.bindTexture(0, this.sourceTexture!)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, uploadable)
  }

  /** Marks the cached source texture stale (e.g. the image element changed). */
  invalidateSource(): void {
    this.needsUpload = true
  }

  /**
   * Renders the edited frame into the canvas, resizing it to the edit's output
   * geometry. Returns the geometry used, or null if the context is unavailable.
   */
  render(input: MediaEditRenderInput): EditGeometry | null {
    if (this.disposed || this.isContextLost || !this.programs) return null
    const { gl, programs } = this
    const { edit } = input
    const geometry = resolveEditGeometry(edit, input.sourceWidth, input.sourceHeight, input.geometry)
    const { outputWidth, outputHeight } = geometry
    if (this.canvas.width !== outputWidth) this.canvas.width = outputWidth
    if (this.canvas.height !== outputHeight) this.canvas.height = outputHeight

    if (input.uploadSource !== false || this.needsUpload) {
      try {
        this.uploadSource(input.source, input.sourceWidth, input.sourceHeight)
        this.needsUpload = false
      } catch (error) {
        // Typically a cross-origin source without CORS headers, or a frame that is not decodable yet.
        this.lastError = error instanceof Error ? error : new Error(String(error))
        return null
      }
    }
    this.lastError = null

    const sigma = blurSigmaPx(edit.blur, outputWidth, outputHeight)
    const blurred = sigma >= 0.25
    const opacity = opacityAmount(edit.opacity)
    const color = buildColorTransform(edit)
    const colorEnabled = !isColorNeutral(edit)

    // Pass 1: crop · orientation · sharpen · color (+ opacity when there is no blur).
    const base = programs.base
    const baseTarget = blurred ? this.target(0, outputWidth, outputHeight) : null
    gl.useProgram(base.program)
    this.bindOutput(baseTarget, outputWidth, outputHeight)
    this.bindTexture(0, this.sourceTexture!)
    gl.uniform1i(this.uniform(base, 'u_src'), 0)
    // uniformMatrix2fv is column-major; the inverse orientation is stored row-major.
    const inv = geometry.inverseOrientation
    gl.uniformMatrix2fv(this.uniform(base, 'u_inverseOrientation'), false, [inv[0][0], inv[1][0], inv[0][1], inv[1][1]])
    gl.uniform2f(this.uniform(base, 'u_cropOrigin'), geometry.cropOrigin[0], geometry.cropOrigin[1])
    gl.uniform2f(this.uniform(base, 'u_cropSize'), geometry.cropSize[0], geometry.cropSize[1])
    gl.uniform2f(this.uniform(base, 'u_outputSize'), outputWidth, outputHeight)
    gl.uniform1f(this.uniform(base, 'u_sharpen'), sharpenAmount(edit.sharpness))
    gl.uniform1i(this.uniform(base, 'u_colorEnabled'), colorEnabled ? 1 : 0)
    const m = color.matrix
    // Row-major → column-major for uniformMatrix3fv.
    gl.uniformMatrix3fv(this.uniform(base, 'u_colorMatrix'), false, [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!])
    gl.uniform3f(this.uniform(base, 'u_colorOffset'), color.offset[0]!, color.offset[1]!, color.offset[2]!)
    gl.uniform1f(this.uniform(base, 'u_opacity'), blurred ? 1 : opacity)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.draw()
    if (!blurred || !baseTarget) return geometry

    // Blur: shrink by halves until the remaining sigma is cheap, blur H then V, upsample.
    let current = baseTarget
    let levelSigma = sigma
    let level = 1
    while (levelSigma > MAX_LEVEL_SIGMA && level < MAX_PYRAMID_LEVELS && current.width > 2 && current.height > 2) {
      const next = this.target(level, Math.ceil(current.width / 2), Math.ceil(current.height / 2))
      gl.useProgram(programs.down.program)
      this.bindOutput(next, next.width, next.height)
      this.bindTexture(0, current.texture)
      gl.uniform1i(this.uniform(programs.down, 'u_tex'), 0)
      gl.uniform2f(this.uniform(programs.down, 'u_texel'), 1 / current.width, 1 / current.height)
      this.draw()
      current = next
      levelSigma /= 2
      level += 1
    }
    const sigmaTexels = Math.max(0.3, levelSigma)
    const horizontal = this.target(BLUR_TARGET_A, current.width, current.height)
    const vertical = this.target(BLUR_TARGET_B, current.width, current.height)
    gl.useProgram(programs.blur.program)
    gl.uniform1f(this.uniform(programs.blur, 'u_sigma'), sigmaTexels)
    gl.uniform1i(this.uniform(programs.blur, 'u_tex'), 0)
    this.bindOutput(horizontal, horizontal.width, horizontal.height)
    this.bindTexture(0, current.texture)
    gl.uniform2f(this.uniform(programs.blur, 'u_step'), 1 / current.width, 0)
    this.draw()
    this.bindOutput(vertical, vertical.width, vertical.height)
    this.bindTexture(0, horizontal.texture)
    gl.uniform2f(this.uniform(programs.blur, 'u_step'), 0, 1 / current.height)
    this.draw()

    gl.useProgram(programs.present.program)
    this.bindOutput(null, outputWidth, outputHeight)
    this.bindTexture(0, vertical.texture)
    gl.uniform1i(this.uniform(programs.present, 'u_tex'), 0)
    gl.uniform1f(this.uniform(programs.present, 'u_opacity'), opacity)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.draw()
    return geometry
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored)
    const { gl } = this
    if (!gl.isContextLost()) {
      for (const target of this.targets) if (target) this.deleteTarget(target)
      if (this.sourceTexture) gl.deleteTexture(this.sourceTexture)
      if (this.programs) for (const entry of Object.values(this.programs)) gl.deleteProgram(entry.program)
      // Release the GPU context immediately rather than waiting for GC.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    this.targets.fill(null)
    this.sourceTexture = null
    this.programs = null
    if (this.scratch) { this.scratch.width = 0; this.scratch.height = 0; this.scratch = null }
  }
}

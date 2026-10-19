import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { buildShiftgridVertexBatch, type ShiftgridRenderPlan } from './ShiftgridRenderPlan'
import type { ShiftgridRenderer, ShiftgridSourceElement } from './ShiftgridRenderer'

const VERTEX = `#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec2 aUv;
uniform vec2 uViewport;
out vec2 vUv;
void main() {
  vec2 clip = vec2((aPosition.x / uViewport.x) * 2.0 - 1.0, 1.0 - (aPosition.y / uViewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
in vec2 vUv;
out vec4 outColor;
void main() {
  if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) { outColor = vec4(0.0); return; }
  // Source UVs are authored top-down; flipped DOM uploads use bottom-up V.
  outColor = texture(uSource, vec2(vUv.x, 1.0 - vUv.y));
}`

export class ShiftgridWebGLRenderer implements ShiftgridRenderer {
  readonly backend = 'webgl2' as const
  private readonly gl: WebGL2RenderingContext
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly texture: WebGLTexture
  private disposed = false
  private cssWidth = 1; private cssHeight = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('SHIFTGRID WebGL2 is unavailable')
    this.gl = gl
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'SHIFTGRID/P1', vertSrc: VERTEX, fragSrc: FRAGMENT,
      attributes: { aPosition: 0, aUv: 1 }, requiredUniforms: ['uViewport', 'uSource'] })
    if (!result.program) throw new Error(result.error.log)
    this.program = result.program
    const vao = gl.createVertexArray(); const buffer = gl.createBuffer(); const texture = gl.createTexture()
    if (!vao || !buffer || !texture) {
      if (vao) gl.deleteVertexArray(vao)
      if (buffer) gl.deleteBuffer(buffer)
      if (texture) gl.deleteTexture(texture)
      this.program.dispose()
      throw new Error('SHIFTGRID GPU resource allocation failed')
    }
    this.vao = vao; this.buffer = buffer; this.texture = texture
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindVertexArray(null); gl.bindTexture(gl.TEXTURE_2D, null)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    if (this.disposed) return
    this.cssWidth = Math.max(1, cssWidth); this.cssHeight = Math.max(1, cssHeight)
    const width = Math.max(1, Math.round(this.cssWidth * pixelRatio)); const height = Math.max(1, Math.round(this.cssHeight * pixelRatio))
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
    this.gl.viewport(0, 0, width, height)
  }

  setSource(source: ShiftgridSourceElement): void {
    if (this.disposed) return
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.bindTexture(gl.TEXTURE_2D, null)
  }

  render(plan: ShiftgridRenderPlan): void {
    if (this.disposed || this.gl.isContextLost()) return
    const gl = this.gl; const vertices = buildShiftgridVertexBatch(plan)
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    this.program.activate(); this.program.setVec2('uViewport', this.cssWidth, this.cssHeight); this.program.setInt('uSource', 0)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 4)
    gl.bindVertexArray(null); gl.bindTexture(gl.TEXTURE_2D, null); gl.useProgram(null)
  }

  dispose(): void {
    if (this.disposed) return; this.disposed = true
    const gl = this.gl; gl.deleteTexture(this.texture); gl.deleteBuffer(this.buffer); gl.deleteVertexArray(this.vao); this.program.dispose()
  }
}

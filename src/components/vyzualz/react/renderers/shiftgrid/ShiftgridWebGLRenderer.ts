import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../shaders/runtime/ShaderProgram'
import { buildShiftgridVertexBatch, type ShiftgridRenderPlan } from './ShiftgridRenderPlan'
import type { ShiftgridRenderer, ShiftgridRendererSource, ShiftgridSourceElement, ShiftgridSourceUploadOptions } from './ShiftgridRenderer'
import { createShiftgridTextureAtlas, type ShiftgridAtlasLayout } from './ShiftgridTextureAtlas'

const VERTEX = `#version 300 es
layout(location=0) in vec2 aPosition;
layout(location=1) in vec2 aUv;
layout(location=2) in vec2 aPendingUv;
layout(location=3) in vec2 aSourcePair;
layout(location=4) in float aSourceMix;
uniform vec2 uViewport;
out vec2 vUv;
out vec2 vPendingUv;
flat out vec2 vSourcePair;
out float vSourceMix;
void main() {
  vec2 clip = vec2((aPosition.x / uViewport.x) * 2.0 - 1.0, 1.0 - (aPosition.y / uViewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
  vPendingUv = aPendingUv;
  vSourcePair = aSourcePair;
  vSourceMix = aSourceMix;
}`
const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uAtlasCellInset;
in vec2 vUv;
in vec2 vPendingUv;
flat in vec2 vSourcePair;
in float vSourceMix;
out vec4 outColor;
vec4 sampleSource(vec2 uv, float sourceIndex) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  float column = mod(sourceIndex, uAtlasGrid.x);
  float row = floor(sourceIndex / uAtlasGrid.x);
  vec2 safeUv = mix(vec2(uAtlasCellInset), vec2(1.0 - uAtlasCellInset), clamp(uv, vec2(0.0), vec2(1.0)));
  vec2 atlasUv = (vec2(column, row) + safeUv) / uAtlasGrid;
  return texture(uAtlas, vec2(atlasUv.x, 1.0 - atlasUv.y));
}
void main() {
  vec4 current = sampleSource(vUv, vSourcePair.x);
  vec4 pending = sampleSource(vPendingUv, vSourcePair.y);
  outColor = mix(current, pending, clamp(vSourceMix, 0.0, 1.0));
}`

export class ShiftgridWebGLRenderer implements ShiftgridRenderer {
  readonly backend = 'webgl2' as const
  private readonly gl: WebGL2RenderingContext
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly texture: WebGLTexture
  private atlasLayout: ShiftgridAtlasLayout = { columns: 1, rows: 1, cellSize: 1, width: 1, height: 1, estimatedBytes: 4 }
  private disposed = false
  private cssWidth = 1; private cssHeight = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false })
    if (!gl) throw new Error('SHIFTGRID WebGL2 is unavailable')
    this.gl = gl
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: 'SHIFTGRID/P3', vertSrc: VERTEX, fragSrc: FRAGMENT,
      attributes: { aPosition: 0, aUv: 1, aPendingUv: 2, aSourcePair: 3, aSourceMix: 4 }, requiredUniforms: ['uViewport', 'uAtlas', 'uAtlasGrid', 'uAtlasCellInset'] })
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
    const stride = 36
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 16)
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 24)
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 32)
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

  setSource(source: ShiftgridSourceElement): void { this.setSources([{ id: 'source-0', element: source }]) }

  setSources(sources: readonly ShiftgridRendererSource[], options: ShiftgridSourceUploadOptions = {}): void {
    if (this.disposed) return
    if (sources.length === 0 || sources.length > 10) throw new Error('SHIFTGRID supports one to ten retained image sources')
    const maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number
    const atlas = createShiftgridTextureAtlas(sources, options.preferredCellSize ?? 512, maxTextureSize)
    this.atlasLayout = atlas.layout
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.canvas)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.bindTexture(gl.TEXTURE_2D, null)
  }

  render(plan: ShiftgridRenderPlan): void {
    if (this.disposed || this.gl.isContextLost()) return
    const gl = this.gl; const vertices = buildShiftgridVertexBatch(plan)
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    this.program.activate(); this.program.setVec2('uViewport', this.cssWidth, this.cssHeight); this.program.setInt('uAtlas', 0)
    this.program.setVec2('uAtlasGrid', this.atlasLayout.columns, this.atlasLayout.rows)
    this.program.setFloat('uAtlasCellInset', 0.5 / this.atlasLayout.cellSize)
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

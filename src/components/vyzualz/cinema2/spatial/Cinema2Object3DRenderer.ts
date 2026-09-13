import type { Cinema2Color } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../scene/Cinema2SceneGraph'
import type { CinemaVectorCpuMesh } from '../../cinema/CinemaVectorGeometry'

export interface Cinema2Object3DMaterial {
  color?: Cinema2Color
  emissiveIntensity?: number
}

export interface Cinema2Object3DDrawRequest {
  modelMatrix: Cinema2Matrix4
  width: number
  height: number
  material?: Readonly<Cinema2Object3DMaterial>
}

export interface Cinema2Object3DRendererSnapshot {
  disposed: boolean
  meshKey: string
  drawCount: number
  createdBufferCount: number
  deletedBufferCount: number
}

const DEFAULT_COLOR = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const WORLD_HALF_HEIGHT = 2.5
const WORLD_DEPTH_HALF_RANGE = 50

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uWorldToClip;
void main() {
  gl_Position = uWorldToClip * uModel * vec4(aPosition, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec4 uColor;
uniform float uEmissiveIntensity;
out vec4 outColor;
void main() {
  vec3 rgb = uColor.rgb * (1.0 + max(0.0, uEmissiveIntensity));
  outColor = vec4(rgb, uColor.a);
}`

/**
 * Focused Stage 12A mesh renderer. The orthographic world-to-clip transform is
 * intentionally camera-free; Stage 12B can replace this projection input with
 * final camera authority without changing object or Scene Graph ownership.
 */
export class Cinema2Object3DRenderer {
  private readonly vao: WebGLVertexArrayObject
  private readonly positionBuffer: WebGLBuffer
  private readonly indexBuffer: WebGLBuffer
  private readonly program: WebGLProgram
  private readonly modelLocation: WebGLUniformLocation | null
  private readonly worldToClipLocation: WebGLUniformLocation | null
  private readonly colorLocation: WebGLUniformLocation | null
  private readonly emissiveLocation: WebGLUniformLocation | null
  private drawCount = 0
  private deletedBufferCount = 0
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly meshKey: string,
    private readonly mesh: Readonly<CinemaVectorCpuMesh>,
  ) {
    if (!meshKey.trim()) throw new Error('Cinema 2.0 Object3D mesh key must be non-empty.')
    validateMesh(mesh)
    const vao = gl.createVertexArray()
    const positionBuffer = gl.createBuffer()
    const indexBuffer = gl.createBuffer()
    if (!vao || !positionBuffer || !indexBuffer) {
      if (vao) gl.deleteVertexArray(vao)
      if (positionBuffer) gl.deleteBuffer(positionBuffer)
      if (indexBuffer) gl.deleteBuffer(indexBuffer)
      throw new Error('Cinema 2.0 could not allocate Object3D mesh GPU resources.')
    }
    this.vao = vao
    this.positionBuffer = positionBuffer
    this.indexBuffer = indexBuffer

    try {
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
      gl.bindVertexArray(null)
      if (gl.getError() === gl.OUT_OF_MEMORY) throw new Error('Cinema 2.0 could not allocate GPU memory for an Object3D mesh.')
      if (gl.isContextLost()) throw new Error('Cinema 2.0 lost WebGL2 while allocating an Object3D mesh.')
      this.program = createProgram(gl)
      this.modelLocation = gl.getUniformLocation(this.program, 'uModel')
      this.worldToClipLocation = gl.getUniformLocation(this.program, 'uWorldToClip')
      this.colorLocation = gl.getUniformLocation(this.program, 'uColor')
      this.emissiveLocation = gl.getUniformLocation(this.program, 'uEmissiveIntensity')
    } catch (error) {
      gl.bindVertexArray(null)
      gl.deleteBuffer(indexBuffer)
      gl.deleteBuffer(positionBuffer)
      gl.deleteVertexArray(vao)
      this.deletedBufferCount = 2
      throw error
    }
  }

  draw(request: Readonly<Cinema2Object3DDrawRequest>): void {
    if (this.disposed) throw new Error('Cinema 2.0 Object3D renderer is disposed.')
    const width = Math.max(1, Math.round(request.width))
    const height = Math.max(1, Math.round(request.height))
    const color = normalizeColor(request.material?.color ?? DEFAULT_COLOR)
    const emissive = Math.max(0, finite(request.material?.emissiveIntensity, 0))
    const gl = this.gl
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.enable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.CULL_FACE)
    gl.uniformMatrix4fv(this.modelLocation, false, new Float32Array(request.modelMatrix))
    gl.uniformMatrix4fv(this.worldToClipLocation, false, createFoundationWorldToClip(width, height))
    gl.uniform4fv(this.colorLocation, new Float32Array(color))
    gl.uniform1f(this.emissiveLocation, emissive)
    gl.drawElements(gl.TRIANGLES, this.mesh.indices.length, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
    this.drawCount += 1
  }

  getSnapshot(): Readonly<Cinema2Object3DRendererSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      meshKey: this.meshKey,
      drawCount: this.drawCount,
      createdBufferCount: 2,
      deletedBufferCount: this.deletedBufferCount,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gl.deleteProgram(this.program)
    this.gl.deleteBuffer(this.indexBuffer)
    this.gl.deleteBuffer(this.positionBuffer)
    this.deletedBufferCount = 2
    this.gl.deleteVertexArray(this.vao)
  }
}

export function createCinema2FoundationWorldToClip(width: number, height: number): Float32Array {
  return createFoundationWorldToClip(width, height)
}

function createFoundationWorldToClip(width: number, height: number): Float32Array {
  const aspect = Math.max(1e-6, width / Math.max(1, height))
  const halfWidth = WORLD_HALF_HEIGHT * aspect
  return new Float32Array([
    1 / halfWidth, 0, 0, 0,
    0, 1 / WORLD_HALF_HEIGHT, 0, 0,
    0, 0, -1 / WORLD_DEPTH_HALF_RANGE, 0,
    0, 0, 0, 1,
  ])
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema 2.0 could not allocate an Object3D shader program.')
  }
  try {
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Cinema 2.0 Object3D shader link failed: ${gl.getProgramInfoLog(program) || 'unknown link error'}`)
    }
    return program
  } catch (error) {
    gl.deleteProgram(program)
    throw error
  } finally {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema 2.0 could not allocate an Object3D shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error'
    gl.deleteShader(shader)
    throw new Error(`Cinema 2.0 Object3D shader compilation failed: ${log}`)
  }
  return shader
}

function normalizeColor(value: Cinema2Color): Cinema2Color {
  return Object.freeze([
    clamp01(finite(value[0], 1)),
    clamp01(finite(value[1], 1)),
    clamp01(finite(value[2], 1)),
    clamp01(finite(value[3], 1)),
  ]) as Cinema2Color
}

function validateMesh(mesh: Readonly<CinemaVectorCpuMesh>): void {
  if (mesh.positions.length === 0 || mesh.positions.length % 3 !== 0) throw new Error('Cinema 2.0 Object3D mesh positions must contain xyz triplets.')
  if (mesh.indices.length === 0 || mesh.indices.length % 3 !== 0) throw new Error('Cinema 2.0 Object3D mesh indices must contain triangles.')
  const vertexCount = mesh.positions.length / 3
  for (const index of mesh.indices) if (!Number.isInteger(index) || index < 0 || index >= vertexCount) throw new Error('Cinema 2.0 Object3D mesh contains an out-of-range index.')
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

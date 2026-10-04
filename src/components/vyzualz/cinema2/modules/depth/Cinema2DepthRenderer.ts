import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CINEMA2_DEPTH_INSTANCE_FLOATS } from './Cinema2DepthLayout'

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i_centerSizeX;
layout(location = 4) in vec4 i_sizeKindEmission;
layout(location = 5) in vec4 i_portalSideSpill;
uniform mat4 u_viewProjection;
uniform float u_centerScale;
out vec3 v_world;
out vec3 v_normal;
out vec3 v_local;
out vec2 v_uv;
flat out float v_kind;
flat out float v_emission;
flat out float v_spill;

void main() {
  vec3 size = vec3(i_centerSizeX.w, i_sizeKindEmission.x, i_sizeKindEmission.y);
  if (i_sizeKindEmission.z > 3.5) size *= u_centerScale;
  vec3 world = i_centerSizeX.xyz + a_position * size;
  gl_Position = u_viewProjection * vec4(world, 1.0);
  v_world = world;
  v_normal = a_normal;
  v_local = a_position;
  v_uv = a_uv;
  v_kind = i_sizeKindEmission.z;
  v_emission = i_sizeKindEmission.w;
  v_spill = i_portalSideSpill.z;
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
in vec3 v_local;
in vec2 v_uv;
flat in float v_kind;
flat in float v_emission;
flat in float v_spill;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightColor;
uniform vec3 u_bodyColor;
uniform float u_intensity;
uniform float u_spillAmount;
out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  vec3 keyDirection = normalize(vec3(-0.42, 0.68, 0.58));
  float diffuse = max(dot(normal, keyDirection), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  float faceEdge = smoothstep(0.3, 0.5, max(abs(v_local.x), max(abs(v_local.y), abs(v_local.z))));

  if (v_kind > 0.5 && v_kind < 1.5) {
    float core = mix(0.9, 1.0, smoothstep(0.08, 0.42, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y))));
    vec3 whiteCore = mix(u_lightColor, vec3(1.0), 0.58);
    outColor = vec4(whiteCore * v_emission * u_intensity * core * 8.0, 1.0);
    return;
  }

  if (v_kind > 3.5) {
    if (v_emission <= 0.0001) discard;
    float center = 1.0 - smoothstep(0.16, 0.72, length(v_local.xy));
    outColor = vec4(mix(u_lightColor, vec3(1.0), 0.4) * v_emission * u_intensity * (2.0 + center * 4.0), 1.0);
    return;
  }

  float materialLift = v_kind > 1.5 && v_kind < 2.5 ? 1.3 : (v_kind > 2.5 ? 0.72 : 1.0);
  vec3 structure = u_bodyColor * materialLift * (0.34 + diffuse * 0.7 + rim * 0.5 + faceEdge * 0.08);
  structure += u_lightColor * v_spill * u_spillAmount * u_intensity * (0.055 + diffuse * 0.035 + rim * 0.045);
  outColor = vec4(structure, 1.0);
}`

export interface Cinema2DepthDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  lightColor: readonly [number, number, number]
  bodyColor: readonly [number, number, number]
  intensity: number
  spill: number
  centerScale: number
  emissions: Float32Array
  spills: Float32Array
}

/** Draws the complete tunnel and its animated Step-2 light state with one instanced cube draw. */
export class Cinema2DepthRenderer {
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly instanceBuffer: WebGLBuffer
  private readonly packedInstances: Float32Array
  private readonly instanceCount: number
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, packedInstances: Float32Array) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Depth/PortalTunnel',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_viewProjection', 'u_centerScale', 'u_cameraPosition', 'u_lightColor', 'u_bodyColor', 'u_intensity', 'u_spillAmount'],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Depth could not allocate a vertex array.')
    this.vao = vao
    gl.bindVertexArray(vao)

    const { vertices, indices } = buildBox()
    this.createBuffer(gl.ARRAY_BUFFER, vertices)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)

    this.packedInstances = new Float32Array(packedInstances)
    this.instanceBuffer = this.createBuffer(gl.ARRAY_BUFFER, this.packedInstances, gl.DYNAMIC_DRAW)
    for (let attribute = 0; attribute < 3; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, CINEMA2_DEPTH_INSTANCE_FLOATS * 4, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }

    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.instanceCount = Math.floor(packedInstances.length / CINEMA2_DEPTH_INSTANCE_FLOATS)
    this.gpuBytes = vertices.byteLength + indices.byteLength + packedInstances.byteLength
    assertCinema2NoGlErrors(gl, 'Depth renderer setup')
  }

  estimateGpuBytes(): number {
    return this.gpuBytes
  }

  draw(state: Readonly<Cinema2DepthDrawState>): void {
    if (this.disposed || this.instanceCount === 0) return
    const { gl, program } = this
    program.activate()
    program.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    program.setVec3('u_lightColor', ...state.lightColor)
    program.setVec3('u_bodyColor', ...state.bodyColor)
    program.setFloat('u_intensity', state.intensity)
    program.setFloat('u_spillAmount', state.spill)
    program.setFloat('u_centerScale', state.centerScale)

    this.updateLighting(state.emissions, state.spills)

    gl.bindVertexArray(this.vao)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.colorMask(true, true, true, true)
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, this.instanceCount)
    gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Depth portal draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteVertexArray(this.vao)
    this.program.dispose()
  }

  private updateLighting(emissions: Float32Array, spills: Float32Array): void {
    if (emissions.length !== this.instanceCount || spills.length !== this.instanceCount) {
      throw new Error('Cinema 2.0 Depth lighting buffers must match the renderer instance count.')
    }
    for (let index = 0; index < this.instanceCount; index += 1) {
      const offset = index * CINEMA2_DEPTH_INSTANCE_FLOATS
      this.packedInstances[offset + 7] = emissions[index]!
      this.packedInstances[offset + 10] = spills[index]!
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer)
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.packedInstances)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array, usage = this.gl.STATIC_DRAW): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Depth could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer)
    this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, usage)
    this.buffers.push(buffer)
    return buffer
  }
}

/** Unit cube centered on the origin. Per vertex: position, normal and face UV. */
function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: readonly (readonly [readonly number[], readonly number[], readonly number[]])[] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
    [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ]
  const vertices: number[] = []
  const indices: number[] = []
  faces.forEach(([normal, tangent, bitangent], faceIndex) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const su = u - 0.5
      const sv = v - 0.5
      vertices.push(
        normal[0]! * 0.5 + tangent[0]! * su + bitangent[0]! * sv,
        normal[1]! * 0.5 + tangent[1]! * su + bitangent[1]! * sv,
        normal[2]! * 0.5 + tangent[2]! * su + bitangent[2]! * sv,
        normal[0]!, normal[1]!, normal[2]!, u, v,
      )
    }
    const base = faceIndex * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

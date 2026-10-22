import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CANOPY_INSTANCE_FLOATS, CANOPY_MAX_BOX_INSTANCES, CANOPY_MAX_INSTANCES } from './Cinema2CanopyLayout'

/** Light a fully lit rod feeds the bloom pass with, above display white. */
export const CANOPY_HDR_GAIN = 1.25
/** How quickly distance darkens the array, giving the rear banks their depth. */
export const CANOPY_DEPTH_FADE = 0.016

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 i_centerKind;
layout(location = 3) in vec4 i_sizeEmission;
layout(location = 4) in vec4 i_accentBank;
uniform mat4 u_viewProjection;
out vec3 v_world;
out vec3 v_normal;
out vec3 v_local;
flat out float v_kind;
flat out float v_emission;
flat out float v_accent;
flat out float v_bank;

void main() {
  vec3 world = i_centerKind.xyz + a_position * i_sizeEmission.xyz;
  gl_Position = u_viewProjection * vec4(world, 1.0);
  v_world = world;
  v_normal = a_normal;
  v_local = a_position;
  v_kind = i_centerKind.w;
  v_emission = i_sizeEmission.w;
  v_accent = i_accentBank.x;
  v_bank = i_accentBank.y;
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
in vec3 v_local;
flat in float v_kind;
flat in float v_emission;
flat in float v_accent;
flat in float v_bank;
uniform vec3 u_cameraPosition;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform vec3 u_accentColor;
uniform vec3 u_structure;
out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 toCamera = u_cameraPosition - v_world;
  float distanceToCamera = length(toCamera);
  vec3 viewDirection = toCamera / max(distanceToCamera, 0.0001);
  float fade = exp(-distanceToCamera * ${CANOPY_DEPTH_FADE});
  vec3 key = normalize(vec3(-0.35, 0.8, 0.5));
  float diffuse = max(dot(normal, key), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  // The accent colour takes a rod quickly and lets go quickly, so a hit reads as Accent Hits and not as a wash of in-between pastels.
  vec3 rod = mix(mix(u_primary, u_secondary, v_bank), u_accentColor, smoothstep(0.25, 0.75, v_accent));

  if (v_kind > 2.5) {
    // The luminous diffuser: a dim glass body that is always there, and the light the rod emits through it.
    float facing = max(dot(normal, viewDirection), 0.0);
    float edge = pow(facing, 0.6);
    float along = v_local.y + 0.5;
    float tube = mix(0.6, 1.0, edge) * mix(0.84, 1.0, smoothstep(0.0, 0.2, along));
    // Peaks are limited softly (about 1.15 at most) so a hard hit stays the rod's own colour instead of clipping to white.
    float level = v_emission < 0.6 ? v_emission : 0.6 + (1.0 - exp(-(v_emission - 0.6) * 2.2)) * 0.55;
    // The middle of the tube burns whiter than its edges, the way a lit diffuser does, and its flat end glows a little harder.
    vec3 core = mix(rod, vec3(1.0), 0.2 * pow(facing, 1.6) * clamp(level, 0.0, 1.0));
    float end = normal.y < -0.9 ? 1.25 : 1.0;
    // The unlit glass body is the Mounting Structure's colour, very dark; a rod that is lit shows only its own light, so that colour never tints it.
    vec3 body = u_structure * 0.12 * (0.5 + diffuse + rim * 0.7) * (1.0 - clamp(level * 2.0, 0.0, 1.0));
    vec3 emitted = core * level * ${CANOPY_HDR_GAIN} * tube * end;
    outColor = vec4((body + emitted) * fade, 1.0);
    return;
  }

  float grain = v_kind < 0.5 ? 0.62 : 0.78;
  vec3 structure = u_structure * (grain + diffuse * 0.8 + rim * 0.5);
  // A lit rod throws a little of its colour onto the cap and stem that hold it.
  structure += rod * v_emission * ${CANOPY_HDR_GAIN} * 0.06 * (v_kind > 0.5 ? 1.0 : 0.0);
  outColor = vec4(structure * fade, 1.0);
}`

export interface CanopyDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  primary: readonly [number, number, number]
  secondary: readonly [number, number, number]
  accent: readonly [number, number, number]
  structure: readonly [number, number, number]
  /** The packed instance buffer, boxes first and diffusers from the fixed diffuser region. */
  instances: Float32Array
  boxCount: number
  diffuserCount: number
}

interface CanopyBatch {
  vao: WebGLVertexArrayObject
  indexCount: number
}

/** Draws the array as two instanced batches: boxes (mounting rails, stems, caps) and one shared low-poly cylinder for every diffuser. */
export class Cinema2CanopyRenderer {
  private readonly program: ShaderProgram
  private readonly buffers: WebGLBuffer[] = []
  private readonly instanceBuffer: WebGLBuffer
  private readonly boxes: CanopyBatch
  private readonly diffusers: CanopyBatch
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Canopy/Rods',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_viewProjection', 'u_cameraPosition', 'u_primary', 'u_secondary', 'u_accentColor', 'u_structure'],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program

    const stride = CANOPY_INSTANCE_FLOATS * 4
    const instanceBuffer = gl.createBuffer()
    if (!instanceBuffer) throw new Error('Cinema 2.0 CANOPY could not allocate a buffer.')
    this.instanceBuffer = instanceBuffer
    this.buffers.push(instanceBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, CANOPY_MAX_INSTANCES * stride, gl.DYNAMIC_DRAW)

    const box = buildBox()
    const cylinder = buildCylinder()
    this.boxes = this.createBatch(box.vertices, box.indices, 0)
    this.diffusers = this.createBatch(cylinder.vertices, cylinder.indices, CANOPY_MAX_BOX_INSTANCES * stride)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.gpuBytes = CANOPY_MAX_INSTANCES * stride + box.vertices.byteLength + box.indices.byteLength + cylinder.vertices.byteLength + cylinder.indices.byteLength
    assertCinema2NoGlErrors(gl, 'CANOPY renderer setup')
  }

  estimateGpuBytes(): number {
    return this.gpuBytes
  }

  draw(state: Readonly<CanopyDrawState>): void {
    if (this.disposed) return
    const { gl, program } = this
    const stride = CANOPY_INSTANCE_FLOATS
    program.activate()
    program.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    program.setVec3('u_primary', ...state.primary)
    program.setVec3('u_secondary', ...state.secondary)
    program.setVec3('u_accentColor', ...state.accent)
    program.setVec3('u_structure', ...state.structure)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    if (state.boxCount > 0) gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.instances, 0, state.boxCount * stride)
    if (state.diffuserCount > 0) {
      const start = CANOPY_MAX_BOX_INSTANCES * stride
      gl.bufferSubData(gl.ARRAY_BUFFER, start * 4, state.instances, start, state.diffuserCount * stride)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.colorMask(true, true, true, true)
    if (state.boxCount > 0) {
      gl.bindVertexArray(this.boxes.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, this.boxes.indexCount, gl.UNSIGNED_SHORT, 0, state.boxCount)
    }
    if (state.diffuserCount > 0) {
      gl.bindVertexArray(this.diffusers.vao)
      gl.drawElementsInstanced(gl.TRIANGLES, this.diffusers.indexCount, gl.UNSIGNED_SHORT, 0, state.diffuserCount)
    }
    gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'CANOPY draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteVertexArray(this.boxes.vao)
    this.gl.deleteVertexArray(this.diffusers.vao)
    this.program.dispose()
  }

  private createBatch(vertices: Float32Array, indices: Uint16Array, instanceByteStart: number): CanopyBatch {
    const { gl } = this
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 CANOPY could not allocate a vertex array.')
    gl.bindVertexArray(vao)
    this.createBuffer(gl.ARRAY_BUFFER, vertices)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    const stride = CANOPY_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 3; attribute += 1) {
      gl.enableVertexAttribArray(2 + attribute)
      gl.vertexAttribPointer(2 + attribute, 4, gl.FLOAT, false, stride, instanceByteStart + attribute * 16)
      gl.vertexAttribDivisor(2 + attribute, 1)
    }
    return { vao, indexCount: indices.length }
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 CANOPY could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer)
    this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, this.gl.STATIC_DRAW)
    this.buffers.push(buffer)
    return buffer
  }
}

/** Unit cube centred on the origin. Per vertex: position and normal. */
export function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
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
        normal[0]!, normal[1]!, normal[2]!,
      )
    }
    const base = faceIndex * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

/** Unit-height, unit-diameter cylinder on the Y axis with a flat bottom end. The top is hidden under the cap box and is left open. */
export function buildCylinder(segments = 10): { vertices: Float32Array; indices: Uint16Array } {
  const vertices: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle)
    const z = Math.sin(angle)
    vertices.push(x * 0.5, 0.5, z * 0.5, x, 0, z)
    vertices.push(x * 0.5, -0.5, z * 0.5, x, 0, z)
  }
  for (let i = 0; i < segments; i += 1) {
    const top = i * 2
    indices.push(top, top + 2, top + 1, top + 2, top + 3, top + 1)
  }
  const centre = vertices.length / 6
  vertices.push(0, -0.5, 0, 0, -1, 0)
  const ringStart = centre + 1
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2
    vertices.push(Math.cos(angle) * 0.5, -0.5, Math.sin(angle) * 0.5, 0, -1, 0)
  }
  for (let i = 0; i < segments; i += 1) indices.push(centre, ringStart + i, ringStart + i + 1)
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

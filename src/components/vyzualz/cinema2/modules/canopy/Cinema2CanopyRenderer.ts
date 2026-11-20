import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CANOPY_INSTANCE_FLOATS, CANOPY_MAX_BOX_INSTANCES, CANOPY_MAX_INSTANCES } from './Cinema2CanopyLayout'
import { buildCanopyObservatory, CANOPY_OBSERVATORY_SCREEN_KIND } from './Cinema2CanopyObservatory'

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
flat out float v_lightGroup;

void main() {
  float c = cos(i_accentBank.z);
  float s = sin(i_accentBank.z);
  mat2 yaw = mat2(c, -s, s, c);
  vec3 offset = a_position * i_sizeEmission.xyz;
  offset.xz = yaw * offset.xz;
  vec3 world = i_centerKind.xyz + offset;
  gl_Position = u_viewProjection * vec4(world, 1.0);
  v_world = world;
  v_normal = a_normal;
  v_normal.xz = yaw * v_normal.xz;
  v_local = a_position;
  v_kind = i_centerKind.w;
  v_emission = i_sizeEmission.w;
  v_accent = i_accentBank.x;
  v_bank = i_accentBank.y;
  v_lightGroup = i_accentBank.w;
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
flat in float v_lightGroup;
uniform vec3 u_cameraPosition;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform vec3 u_accentColor;
uniform vec3 u_structure;
uniform float u_installationIntensity;
uniform float u_screenTime;
out vec4 outColor;

vec3 wallDisplay(vec3 world, float lower, float level) {
  float angle = atan(world.z, world.x);
  float h = world.y;
  float time = u_screenTime;
  // Integer angular harmonics close at the back seam. Both bands share physical LED pitch.
  float wave = sin(angle * 5.0 + h * 1.07 + time * 0.66);
  float carrier = mix(h * 5.6 + angle * 8.0, h * 3.4 - angle * 5.0, lower);
  float ribbon = 0.5 + 0.5 * cos(carrier + wave * 1.7 - time * mix(1.15, 0.8, lower));
  float drift = 0.5 + 0.5 * sin(angle * 3.0 - h * 0.87 + time * 0.35);
  vec3 tint = mix(u_primary, u_secondary, mix(0.16 + drift * 0.40, 0.47 + drift * 0.48, lower));
  float image = 0.10 + pow(ribbon, 5.0) * (0.58 + 0.28 * drift) + drift * 0.06;

  vec2 pixels = vec2(angle * (1152.0 / 6.28318530718), h * 16.5);
  vec2 cell = abs(fract(pixels) - 0.5);
  // Subpixel emitters blend together at distance and across the angular wrap.
  float pixelFootprint = max(length(dFdx(world)), length(dFdy(world))) * 16.5;
  float diode = mix(0.22, 1.16, 1.0 - smoothstep(0.27, 0.48, max(cell.x, cell.y)));
  diode = mix(diode, 0.83, smoothstep(0.23, 0.82, pixelFootprint));
  vec3 substrate = u_structure * 0.22;
  return substrate + tint * image * diode * level;
}

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
  float emission = v_emission * (v_lightGroup > 0.5 ? u_installationIntensity : 1.0);

  if (v_kind == ${CANOPY_OBSERVATORY_SCREEN_KIND.toFixed(1)}) {
    outColor = vec4(wallDisplay(v_world, v_bank, emission) * fade, 1.0);
    return;
  }
  if (v_kind > 4.5) {
    outColor = vec4(rod * emission * 1.45 * fade, 1.0);
    return;
  }
  if (v_kind > 3.5) {
    float brushed = 0.94 + 0.06 * sin(v_local.x * 145.0 + v_local.z * 68.0);
    float distanceShade = mix(1.24, 0.82, smoothstep(4.0, 16.0, distanceToCamera));
    vec3 steel = u_structure * (0.89 + diffuse * 0.81 + rim * 0.43) * distanceShade * brushed;
    float ringSpill = exp(-abs(v_world.y - 4.0) * 0.8);
    float rimReflection = (pow(rim, 3.0) * 0.13 + ringSpill * 0.17) * u_installationIntensity;
    outColor = vec4((steel + mix(u_primary, u_secondary, v_bank) * rimReflection) * fade, 1.0);
    return;
  }

  if (v_kind > 2.5) {
    // The luminous diffuser: a dim glass body that is always there, and the light the rod emits through it.
    float facing = max(dot(normal, viewDirection), 0.0);
    float edge = pow(facing, 0.6);
    float along = v_local.y + 0.5;
    float tube = mix(0.6, 1.0, edge) * mix(0.84, 1.0, smoothstep(0.0, 0.2, along));
    // Peaks are limited softly (about 1.15 at most) so a hard hit stays the rod's own colour instead of clipping to white.
    float level = emission < 0.6 ? emission : 0.6 + (1.0 - exp(-(emission - 0.6) * 2.2)) * 0.55;
    // The middle of the tube burns whiter than its edges, the way a lit diffuser does, and its flat end glows a little harder.
    vec3 core = mix(rod, vec3(1.0), 0.2 * pow(facing, 1.6) * clamp(level, 0.0, 1.0));
    float end = normal.y < -0.9 ? 1.25 : 1.0;
    // The unlit glass body is the Mounting Structure's colour, very dark; a rod that is lit shows only its own light, so that colour never tints it.
    vec3 body = u_structure * 0.12 * (0.5 + diffuse + rim * 0.7) * (1.0 - clamp(level * 2.0, 0.0, 1.0));
    float diffuserGain = v_lightGroup > 0.5 ? 1.65 : 2.25;
    vec3 emitted = core * level * ${CANOPY_HDR_GAIN} * tube * end * diffuserGain;
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
  /** Static installation lights follow the existing master dimmer. */
  installationIntensity?: number
  screenTimeSeconds?: number
}

interface CanopyBatch {
  vao: WebGLVertexArrayObject
  indexCount: number
}

/** Draws the live array and fixed installation with shared box and diffuser geometry. */
export class Cinema2CanopyRenderer {
  private readonly program: ShaderProgram
  private readonly buffers: WebGLBuffer[] = []
  private readonly instanceBuffer: WebGLBuffer
  private readonly boxes: CanopyBatch
  private readonly diffusers: CanopyBatch
  private readonly installationBoxes: CanopyBatch
  private readonly installationRods: CanopyBatch
  private readonly installationBoxCount: number
  private readonly installationRodCount: number
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Canopy/Rods',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_viewProjection', 'u_cameraPosition', 'u_primary', 'u_secondary', 'u_accentColor', 'u_structure', 'u_installationIntensity', 'u_screenTime'],
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
    const boxVertices = this.createBuffer(gl.ARRAY_BUFFER, box.vertices)
    const boxIndices = this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, box.indices)
    const rodVertices = this.createBuffer(gl.ARRAY_BUFFER, cylinder.vertices)
    const rodIndices = this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, cylinder.indices)
    this.boxes = this.createBatch(boxVertices, boxIndices, box.indices.length, instanceBuffer, 0)
    this.diffusers = this.createBatch(rodVertices, rodIndices, cylinder.indices.length, instanceBuffer, CANOPY_MAX_BOX_INSTANCES * stride)
    const installation = buildCanopyObservatory()
    const installationBuffer = this.createBuffer(gl.ARRAY_BUFFER, installation.instances)
    this.installationBoxCount = installation.boxCount
    this.installationRodCount = installation.rodCount
    this.installationBoxes = this.createBatch(boxVertices, boxIndices, box.indices.length, installationBuffer, 0)
    this.installationRods = this.createBatch(rodVertices, rodIndices, cylinder.indices.length, installationBuffer, installation.boxCount * stride)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.gpuBytes = CANOPY_MAX_INSTANCES * stride + installation.instances.byteLength + box.vertices.byteLength + box.indices.byteLength + cylinder.vertices.byteLength + cylinder.indices.byteLength
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
    program.setFloat('u_installationIntensity', state.installationIntensity ?? 0.78)
    program.setFloat('u_screenTime', state.screenTimeSeconds ?? 0)

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
    gl.bindVertexArray(this.installationBoxes.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.installationBoxes.indexCount, gl.UNSIGNED_SHORT, 0, this.installationBoxCount)
    gl.bindVertexArray(this.installationRods.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.installationRods.indexCount, gl.UNSIGNED_SHORT, 0, this.installationRodCount)
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
    this.gl.deleteVertexArray(this.installationBoxes.vao)
    this.gl.deleteVertexArray(this.installationRods.vao)
    this.program.dispose()
  }

  private createBatch(vertices: WebGLBuffer, indices: WebGLBuffer, indexCount: number, instances: WebGLBuffer, instanceByteStart: number): CanopyBatch {
    const { gl } = this
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 CANOPY could not allocate a vertex array.')
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
    gl.bindBuffer(gl.ARRAY_BUFFER, instances)
    const stride = CANOPY_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 3; attribute += 1) {
      gl.enableVertexAttribArray(2 + attribute)
      gl.vertexAttribPointer(2 + attribute, 4, gl.FLOAT, false, stride, instanceByteStart + attribute * 16)
      gl.vertexAttribDivisor(2 + attribute, 1)
    }
    return { vao, indexCount }
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

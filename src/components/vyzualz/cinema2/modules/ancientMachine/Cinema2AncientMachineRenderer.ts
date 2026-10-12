import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS } from './Cinema2AncientMachineLayout'

const VERTEX_SOURCE = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i_centerSizeX;
layout(location = 4) in vec4 i_sizeRotationKind;
layout(location = 5) in vec4 i_ringGroupRandom;
layout(location = 6) in vec4 i_reserved;
uniform mat4 u_viewProjection;
uniform float u_time;
uniform float u_rotationSpeed;
uniform float u_counterRotation;
uniform float u_mechanicalDepth;
uniform float u_lockProgress;
uniform float u_aperture;
uniform float u_build;
uniform float u_drop;
uniform float u_kick;
uniform int u_look;
out vec3 v_world;
out vec3 v_normal;
out vec2 v_uv;
flat out float v_kind;
flat out float v_ring;
flat out float v_group;
flat out float v_random;

void main() {
  float ring = i_ringGroupRandom.x;
  float direction = mod(ring, 2.0) < 0.5 ? 1.0 : -max(0.05, u_counterRotation);
  float lookRate = u_look == 1 ? 1.8 : (u_look == 2 ? 0.24 : 0.55);
  float dynamicRotation = u_time * u_rotationSpeed * lookRate * direction * (0.35 + ring * 0.08);
  dynamicRotation += u_build * direction * ring * 0.018;
  float c = cos(dynamicRotation);
  float s = sin(dynamicRotation);
  mat2 ringRotation = mat2(c, -s, s, c);
  vec3 center = i_centerSizeX.xyz;
  center.xy = ringRotation * center.xy;
  float kind = i_sizeRotationKind.w;
  float aperturePart = step(3.5, kind) * step(length(center.xy), 1.25);
  center.xy *= 1.0 + aperturePart * (u_aperture * 0.58 + u_drop * 0.38);
  center.z *= u_mechanicalDepth;
  center.z -= u_build * ring * 0.018;
  center.z += u_drop * (i_ringGroupRandom.z - 0.5) * 0.42;
  float authoredRotation = i_sizeRotationKind.z + dynamicRotation;
  float rc = cos(authoredRotation);
  float rs = sin(authoredRotation);
  mat2 localRotation = mat2(rc, -rs, rs, rc);
  vec3 size = vec3(i_centerSizeX.w, i_sizeRotationKind.xy);
  if (kind > 2.5 && kind < 3.5) size.y *= 1.0 + u_kick * 0.55;
  if (u_look == 0) size *= mix(0.94, 1.0, u_lockProgress);
  vec3 local = a_position * size;
  local.xy = localRotation * local.xy;
  vec3 normal = a_normal;
  normal.xy = localRotation * normal.xy;
  v_world = center + local;
  v_normal = normal;
  v_uv = a_uv;
  v_kind = kind;
  v_ring = ring;
  v_group = i_ringGroupRandom.y;
  v_random = i_ringGroupRandom.z;
  gl_Position = u_viewProjection * vec4(v_world, 1.0);
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_world;
in vec3 v_normal;
in vec2 v_uv;
flat in float v_kind;
flat in float v_ring;
flat in float v_group;
flat in float v_random;
uniform vec3 u_cameraPosition;
uniform vec3 u_metalColor;
uniform vec3 u_glyphColor;
uniform vec3 u_internalColor;
uniform float u_intensity;
uniform float u_glyphDensity;
uniform float u_energy;
uniform float u_beat;
uniform float u_kick;
uniform float u_snare;
uniform float u_downbeat;
uniform float u_phrase;
uniform float u_build;
uniform float u_drop;
uniform float u_quality;
uniform int u_look;
out vec4 outColor;

void main() {
  if (v_random > mix(0.52, 1.0, u_quality) && v_kind > 0.5 && v_kind < 3.5) discard;
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.62, 0.7))), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.8);
  float cadence = 0.16 + u_energy * 0.22 + u_beat * 0.22 + u_downbeat * 0.42;
  cadence += u_kick * (0.18 + 0.16 * step(0.5, v_group)) + u_phrase * 0.18;
  if (u_look == 0) cadence *= 0.64 + 0.36 * step(mod(v_ring, 4.0), 0.5);
  if (u_look == 1) cadence *= 1.24;
  if (u_look == 2) cadence *= 0.5 + u_build * 0.65;
  if (v_kind < 0.5 || v_kind > 2.5) {
    vec3 metal = u_metalColor * (0.3 + diffuse * 0.92 + rim * 0.48);
    metal += u_internalColor * (u_drop * 0.18 + u_build * 0.05) * (0.4 + v_random);
    outColor = vec4(metal, 1.0);
    return;
  }
  float glyphGate = step(v_random, u_glyphDensity);
  vec3 emissionColor = v_kind > 1.5 ? u_internalColor : u_glyphColor;
  float edge = smoothstep(0.0, 0.12, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
  float emission = (0.12 + cadence * 2.5 + u_snare * 0.42 + u_drop * 1.25) * u_intensity * glyphGate;
  outColor = vec4(emissionColor * emission * mix(0.75, 1.0, edge), 1.0);
}`

export interface Cinema2AncientMachineDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  timeSeconds: number
  look: number
  metalColor: readonly [number, number, number]
  glyphColor: readonly [number, number, number]
  internalColor: readonly [number, number, number]
  intensity: number
  rotationSpeed: number
  counterRotation: number
  mechanicalDepth: number
  lockProgress: number
  aperture: number
  glyphDensity: number
  energy: number
  beat: number
  kick: number
  snare: number
  downbeat: number
  phrase: number
  build: number
  drop: number
  quality: number
}

export class Cinema2AncientMachineRenderer {
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly indexCount: number
  private readonly instanceCount: number
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, instances: Float32Array) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/AncientMachine/CeremonialMechanism',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: [
        'u_viewProjection', 'u_cameraPosition', 'u_time', 'u_rotationSpeed', 'u_counterRotation', 'u_mechanicalDepth',
        'u_lockProgress', 'u_aperture', 'u_build', 'u_drop', 'u_kick', 'u_look', 'u_metalColor', 'u_glyphColor',
        'u_internalColor', 'u_intensity', 'u_glyphDensity', 'u_energy', 'u_beat', 'u_snare', 'u_downbeat', 'u_phrase', 'u_quality',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    const box = buildBox()
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Ancient Machine could not allocate a vertex array.')
    this.vao = vao
    gl.bindVertexArray(vao)
    this.createBuffer(gl.ARRAY_BUFFER, box.vertices)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, box.indices)
    this.createBuffer(gl.ARRAY_BUFFER, instances)
    const stride = CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, stride, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindVertexArray(null)
    this.indexCount = box.indices.length
    this.instanceCount = Math.floor(instances.length / CINEMA2_ANCIENT_MACHINE_INSTANCE_FLOATS)
    this.gpuBytes = box.vertices.byteLength + box.indices.byteLength + instances.byteLength
    assertCinema2NoGlErrors(gl, 'Ancient Machine renderer setup')
  }

  estimateGpuBytes(): number { return this.gpuBytes }

  draw(state: Readonly<Cinema2AncientMachineDrawState>): void {
    if (this.disposed) return
    const { gl, program } = this
    program.activate()
    program.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    for (const [name, value] of Object.entries({
      u_time: state.timeSeconds, u_rotationSpeed: state.rotationSpeed, u_counterRotation: state.counterRotation,
      u_mechanicalDepth: state.mechanicalDepth, u_lockProgress: state.lockProgress, u_aperture: state.aperture,
      u_glyphDensity: state.glyphDensity, u_intensity: state.intensity, u_energy: state.energy, u_beat: state.beat,
      u_kick: state.kick, u_snare: state.snare, u_downbeat: state.downbeat, u_phrase: state.phrase,
      u_build: state.build, u_drop: state.drop, u_quality: state.quality,
    })) program.setFloat(name, value)
    program.setVec3('u_metalColor', ...state.metalColor)
    program.setVec3('u_glyphColor', ...state.glyphColor)
    program.setVec3('u_internalColor', ...state.internalColor)
    program.setInt('u_look', state.look)
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.colorMask(true, true, true, true)
    gl.bindVertexArray(this.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this.instanceCount)
    gl.bindVertexArray(null); gl.disable(gl.CULL_FACE)
    assertCinema2NoGlErrors(gl, 'Ancient Machine draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteVertexArray(this.vao); this.program.dispose()
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array): void {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Ancient Machine could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer); this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, this.gl.STATIC_DRAW)
    this.buffers.push(buffer)
  }
}

function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: readonly (readonly [readonly number[], readonly number[], readonly number[]])[] = [
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  ]
  const vertices: number[] = []; const indices: number[] = []
  faces.forEach(([normal, tangent, bitangent], faceIndex) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const su = u - 0.5; const sv = v - 0.5
      vertices.push(normal[0]! * 0.5 + tangent[0]! * su + bitangent[0]! * sv, normal[1]! * 0.5 + tangent[1]! * su + bitangent[1]! * sv, normal[2]! * 0.5 + tangent[2]! * su + bitangent[2]! * sv, normal[0]!, normal[1]!, normal[2]!, u, v)
    }
    const base = faceIndex * 4; indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

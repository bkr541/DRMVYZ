import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CINEMA2_CATHEDRAL_INSTANCE_FLOATS } from './Cinema2CathedralLayout'

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i_centerSizeX;
layout(location = 4) in vec4 i_sizeRotationKind;
layout(location = 5) in vec4 i_archGroupRandom;
layout(location = 6) in vec4 i_reserved;
uniform mat4 u_viewProjection;
uniform vec3 u_cameraPosition;
uniform float u_repeatDistance;
uniform float u_repeatOriginZ;
uniform float u_build;
uniform float u_drop;
uniform float u_expansion;
uniform float u_time;
out vec3 v_world;
out vec3 v_normal;
out vec2 v_uv;
flat out float v_kind;
flat out float v_arch;
flat out float v_group;
flat out float v_random;

void main() {
  vec3 size = vec3(i_centerSizeX.w, i_sizeRotationKind.xy);
  float rotation = i_sizeRotationKind.z;
  float c = cos(rotation);
  float s = sin(rotation);
  mat2 rotationMatrix = mat2(c, -s, s, c);
  vec3 local = a_position * size;
  local.xy = rotationMatrix * local.xy;
  vec3 worldNormal = a_normal;
  worldNormal.xy = rotationMatrix * worldNormal.xy;
  vec3 center = i_centerSizeX.xyz;
  float lap = floor((u_repeatOriginZ - u_cameraPosition.z) / max(u_repeatDistance, 0.0001) + 0.0001);
  center.z -= lap * u_repeatDistance;
  float side = center.x < 0.0 ? -1.0 : 1.0;
  float contraction = 1.0 - u_build * 0.055;
  center.x *= contraction;
  center.x += side * u_expansion * 0.32;
  float ruptureMask = step(0.58, i_archGroupRandom.z) * (0.45 + 0.55 * sin(i_archGroupRandom.x * 8.0 + u_time * 0.7));
  center.x += side * u_drop * ruptureMask * (0.18 + i_archGroupRandom.z * 0.42);
  center.y += u_drop * ruptureMask * (i_archGroupRandom.z - 0.5) * 0.32;
  vec3 world = center + local;
  gl_Position = u_viewProjection * vec4(world, 1.0);
  v_world = world;
  v_normal = worldNormal;
  v_uv = a_uv;
  v_kind = i_sizeRotationKind.w;
  v_arch = i_archGroupRandom.x;
  v_group = i_archGroupRandom.y;
  v_random = i_archGroupRandom.z;
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
in vec2 v_uv;
flat in float v_kind;
flat in float v_arch;
flat in float v_group;
flat in float v_random;
uniform vec3 u_cameraPosition;
uniform vec3 u_structureColor;
uniform vec3 u_primaryColor;
uniform vec3 u_accentColor;
uniform float u_intensity;
uniform float u_activeDensity;
uniform float u_time;
uniform float u_kick;
uniform float u_snare;
uniform float u_beat;
uniform float u_downbeat;
uniform float u_phrase;
uniform float u_energy;
uniform float u_build;
uniform float u_drop;
uniform float u_vocalRestraint;
uniform float u_sparkDensity;
uniform float u_quality;
uniform int u_program;
out vec4 outColor;

float pulse(float x, float width) {
  return smoothstep(width, 0.0, abs(fract(x) - 0.5));
}

void main() {
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  vec3 keyDirection = normalize(vec3(-0.36, 0.74, 0.56));
  float diffuse = max(dot(normal, keyDirection), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.5);
  float archPhase = v_arch * 0.137;
  float densityGate = step(fract(v_arch * 0.6180339), u_activeDensity);
  float programLight = 0.16;
  if (u_program == 0) programLight = 0.18 + 0.82 * pulse(archPhase - u_time * 0.075, 0.18);
  if (u_program == 1) programLight = 0.12 + 0.88 * pulse(archPhase - u_time * 0.2, 0.11);
  if (u_program == 2) programLight = mix(0.14, 0.86, mod(v_arch + v_group, 2.0));
  if (u_program == 3) programLight = 0.22 + u_build * 0.78;
  if (u_program == 4) programLight = 0.14 + u_drop * (0.45 + v_random * 0.75);
  programLight *= densityGate * (1.0 - u_vocalRestraint * 0.36);
  programLight += u_kick * (0.16 + 0.2 * step(0.5, v_group));
  programLight += u_beat * (0.08 + 0.1 * step(0.5, v_group));
  programLight += u_downbeat * 0.42;
  programLight += u_phrase * (0.12 + 0.16 * step(1.5, v_kind));
  programLight += u_energy * 0.12;

  if (v_kind < 0.5 || v_kind > 3.5) {
    float railLift = v_kind > 3.5 ? 0.72 : 1.0;
    vec3 material = u_structureColor * railLift * (0.34 + diffuse * 0.82 + rim * 0.42);
    material += mix(u_primaryColor, u_accentColor, step(0.5, v_group)) * programLight * 0.075;
    outColor = vec4(material, 1.0);
    return;
  }

  if (v_kind > 2.5) {
    float tierGate = step(v_random, mix(0.28, 1.0, u_quality));
    float sparkGate = step(v_random, u_sparkDensity) * tierGate;
    float flicker = 0.45 + 0.55 * sin(u_time * (7.0 + v_random * 9.0) + v_arch * 2.1);
    float energy = sparkGate * max(u_snare, u_drop * 0.8) * max(flicker, 0.0);
    if (energy < 0.015) discard;
    outColor = vec4(mix(u_primaryColor, u_accentColor, v_random) * energy * u_intensity * 5.5, 1.0);
    return;
  }

  vec3 lightColor = v_kind > 1.5 ? u_accentColor : u_primaryColor;
  float edge = smoothstep(0.0, 0.12, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
  float emission = (0.08 + programLight * 2.7 + u_drop * 0.75) * u_intensity;
  outColor = vec4(lightColor * emission * mix(0.82, 1.0, edge), 1.0);
}`

export interface Cinema2CathedralDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  repeatDistance: number
  repeatOriginZ: number
  timeSeconds: number
  structureColor: readonly [number, number, number]
  primaryColor: readonly [number, number, number]
  accentColor: readonly [number, number, number]
  intensity: number
  activeDensity: number
  expansion: number
  sparkDensity: number
  program: number
  kick: number
  snare: number
  beat: number
  downbeat: number
  phrase: number
  energy: number
  build: number
  drop: number
  vocalRestraint: number
  quality: number
}

export class Cinema2CathedralRenderer {
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly indexCount: number
  private readonly instanceCount: number
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, instances: Float32Array) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Cathedral/GothicAisle',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: [
        'u_viewProjection', 'u_cameraPosition', 'u_repeatDistance', 'u_repeatOriginZ', 'u_build', 'u_drop', 'u_expansion', 'u_time',
        'u_structureColor', 'u_primaryColor', 'u_accentColor', 'u_intensity', 'u_activeDensity', 'u_kick', 'u_snare',
        'u_beat', 'u_downbeat', 'u_phrase', 'u_energy', 'u_vocalRestraint', 'u_sparkDensity', 'u_quality', 'u_program',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    const box = buildBox()
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Cathedral could not allocate a vertex array.')
    this.vao = vao
    gl.bindVertexArray(vao)
    this.createBuffer(gl.ARRAY_BUFFER, box.vertices)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, box.indices)
    this.createBuffer(gl.ARRAY_BUFFER, instances)
    const stride = CINEMA2_CATHEDRAL_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, stride, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.indexCount = box.indices.length
    this.instanceCount = Math.floor(instances.length / CINEMA2_CATHEDRAL_INSTANCE_FLOATS)
    this.gpuBytes = box.vertices.byteLength + box.indices.byteLength + instances.byteLength
    assertCinema2NoGlErrors(gl, 'Cathedral renderer setup')
  }

  estimateGpuBytes(): number {
    return this.gpuBytes
  }

  draw(state: Readonly<Cinema2CathedralDrawState>): void {
    if (this.disposed) return
    const { gl, program } = this
    program.activate()
    program.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    program.setFloat('u_repeatDistance', state.repeatDistance)
    program.setFloat('u_repeatOriginZ', state.repeatOriginZ)
    program.setFloat('u_time', state.timeSeconds)
    program.setVec3('u_structureColor', ...state.structureColor)
    program.setVec3('u_primaryColor', ...state.primaryColor)
    program.setVec3('u_accentColor', ...state.accentColor)
    program.setFloat('u_intensity', state.intensity)
    program.setFloat('u_activeDensity', state.activeDensity)
    program.setFloat('u_expansion', state.expansion)
    program.setFloat('u_sparkDensity', state.sparkDensity)
    program.setFloat('u_kick', state.kick)
    program.setFloat('u_snare', state.snare)
    program.setFloat('u_beat', state.beat)
    program.setFloat('u_downbeat', state.downbeat)
    program.setFloat('u_phrase', state.phrase)
    program.setFloat('u_energy', state.energy)
    program.setFloat('u_build', state.build)
    program.setFloat('u_drop', state.drop)
    program.setFloat('u_vocalRestraint', state.vocalRestraint)
    program.setFloat('u_quality', state.quality)
    program.setInt('u_program', state.program)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.colorMask(true, true, true, true)
    gl.bindVertexArray(this.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this.instanceCount)
    gl.bindVertexArray(null)
    gl.disable(gl.CULL_FACE)
    assertCinema2NoGlErrors(gl, 'Cathedral draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteVertexArray(this.vao)
    this.program.dispose()
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Cathedral could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer)
    this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, this.gl.STATIC_DRAW)
    this.buffers.push(buffer)
    return buffer
  }
}

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

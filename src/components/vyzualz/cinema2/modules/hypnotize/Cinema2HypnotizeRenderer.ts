import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import {
  CINEMA2_HYPNOTIZE_INSTANCE_FLOATS,
  CINEMA2_HYPNOTIZE_TUNNEL,
  HYP_KIND,
  type Cinema2HypnotizeTunnelFrame,
  type Cinema2HypnotizeTunnelLayout,
} from './Cinema2HypnotizeTunnel'

/**
 * Draws the Hypnotize ring tunnel (Cinema2HypnotizeTunnel.ts) with raw WebGL2, the way Depth does: one static instance buffer, one small dynamic buffer of per-instance light,
 * two instanced draws of one shared box, and matte analytic shading. There is no scene graph, no PBR and no shadow: the light comes from the strips, as HDR values above white that
 * the preset's bloom turns into halos.
 */
const RING_SLOTS = CINEMA2_HYPNOTIZE_TUNNEL.ringSlots
/** Source gain of a strip's light above display white; the preset's bloom threshold sits just under a fully driven strip. */
export const CINEMA2_HYPNOTIZE_STRIP_HDR_GAIN = 3.4

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i_a;
layout(location = 4) in vec4 i_b;
layout(location = 5) in vec4 i_c;
layout(location = 6) in vec4 i_light;
uniform mat4 u_viewProjection;
uniform float u_ringAngle[${RING_SLOTS}];
uniform float u_ringZ[${RING_SLOTS}];
uniform float u_ringHero[${RING_SLOTS}];
uniform float u_ringVane[${RING_SLOTS}];
uniform float u_ringGlow[${RING_SLOTS}];
uniform float u_radiusScale;
out vec3 v_world;
out vec3 v_normal;
out vec3 v_local;
out vec2 v_uv;
flat out float v_kind;
flat out float v_emission;
flat out float v_tint;
flat out float v_hot;
flat out float v_ringGlow;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

void main() {
  float kind = i_a.w;
  bool onRing = i_c.x > -0.5;
  int ring = onRing ? int(i_c.x + 0.5) : 0;
  float ringAngle = onRing ? u_ringAngle[ring] : 0.0;
  float ringZ = onRing ? u_ringZ[ring] : 0.0;
  float hero = onRing ? u_ringHero[ring] : 0.0;
  float vane = onRing ? u_ringVane[ring] : 1.0;
  vec3 size = i_b.xyz;
  vec2 centre = i_a.xy;
  bool isChord = kind < 2.5 && onRing;
  bool isVane = kind > 4.5;
  bool isLine = kind > 2.5 && kind < 3.5;
  if (isChord) size.x *= u_radiusScale;
  if (isVane) { size *= vane; size.y *= u_radiusScale; }
  if (isChord || isVane || isLine) centre *= u_radiusScale;
  if (hero > 0.5 && (kind < 1.5 || (kind > 1.5 && kind < 2.5))) { size.y *= 1.35; size.z *= 1.18; }
  vec3 local = a_position * size;
  local.xy = rot(i_b.w) * local.xy;
  vec2 planar = rot(ringAngle) * (centre + local.xy);
  vec3 world = vec3(planar, i_a.z + ringZ + local.z);
  vec2 normalXY = rot(ringAngle) * (rot(i_b.w) * a_normal.xy);
  gl_Position = u_viewProjection * vec4(world, 1.0);
  v_world = world;
  v_normal = vec3(normalXY, a_normal.z);
  v_local = a_position;
  v_uv = a_uv;
  v_kind = kind;
  v_emission = i_light.x;
  v_tint = i_light.y;
  v_hot = i_light.z;
  v_ringGlow = onRing ? u_ringGlow[ring] : 0.0;
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_world;
in vec3 v_normal;
in vec3 v_local;
in vec2 v_uv;
flat in float v_kind;
flat in float v_emission;
flat in float v_tint;
flat in float v_hot;
flat in float v_ringGlow;
uniform vec3 u_cameraPosition;
uniform vec3 u_lightA;
uniform vec3 u_lightB;
uniform vec3 u_core;
uniform vec3 u_body;
uniform float u_fog;
uniform float u_fadeStart;
uniform float u_fadeEnd;
uniform float u_hdrGain;
uniform float u_spill;
out vec4 outColor;

void main() {
  float dist = length(v_world - u_cameraPosition);
  float visible = exp(-dist * u_fog) * (1.0 - smoothstep(u_fadeStart, u_fadeEnd, dist));
  vec3 normal = normalize(v_normal);
  vec3 viewDirection = normalize(u_cameraPosition - v_world);
  float diffuse = max(dot(normal, normalize(vec3(-0.3, 0.5, 0.8))), 0.0);
  float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 3.0);
  vec3 tint = mix(u_lightA, u_lightB, v_tint);
  vec3 hot = mix(tint, u_core, v_hot);

  if (v_kind > 3.5 && v_kind < 4.5) {
    float radius = length(v_local.xy * 2.0);
    if (radius > 1.0) discard;
    float falloff = pow(1.0 - radius, 1.7);
    outColor = vec4(hot * v_emission * falloff * u_hdrGain * 0.6, 1.0);
    return;
  }
  if (v_kind > 2.5 && v_kind < 3.5) {
    outColor = vec4(hot * v_emission * u_hdrGain * 0.5 * exp(-dist * u_fog * 0.5), 1.0);
    return;
  }
  if (v_kind > 0.5 && v_kind < 1.5) {
    float core = mix(0.85, 1.0, smoothstep(0.08, 0.42, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y))));
    vec3 housing = u_body * 1.7 * (0.5 + diffuse * 0.9 + rim * 0.6) + tint * 0.012;
    vec3 emitter = hot * v_emission * u_hdrGain * core;
    outColor = vec4((housing + emitter) * visible, 1.0);
    return;
  }
  if ((v_kind > 1.5 && v_kind < 2.5) || v_kind > 5.5) {
    vec3 emitter = tint * v_emission * u_hdrGain * 0.3;
    outColor = vec4((u_body * 0.6 + emitter) * visible, 1.0);
    return;
  }
  float lift = v_kind > 4.5 ? 1.2 : 1.0;
  vec3 structure = u_body * lift * (0.46 + diffuse * 0.82 + rim * 0.62);
  structure += tint * v_ringGlow * u_spill * (0.02 + diffuse * 0.02 + rim * 0.03);
  outColor = vec4(structure * visible, 1.0);
}`

export interface Cinema2HypnotizeDrawState {
  viewProjection: readonly number[]
  cameraPosition: readonly [number, number, number]
  lightA: readonly [number, number, number]
  lightB: readonly [number, number, number]
  core: readonly [number, number, number]
  body: readonly [number, number, number]
  /** Tunnel width, 1 = authored. */
  radiusScale: number
  /** How far the rings stay visible: larger fades the tunnel out sooner. */
  fog: number
  spill: number
  frame: Readonly<Cinema2HypnotizeTunnelFrame>
}

interface Batch { vao: WebGLVertexArrayObject; indexCount: number }

/** One shared box, two instanced draws (the global lines and glow, then the visible rings). */
export class Cinema2HypnotizeRenderer {
  private readonly program: ShaderProgram
  private readonly buffers: WebGLBuffer[] = []
  private readonly globalBatch: Batch
  private readonly ringBatch: Batch
  private readonly dynamicBuffer: WebGLBuffer
  private readonly gpuBytes: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, private readonly layout: Readonly<Cinema2HypnotizeTunnelLayout>) {
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Hypnotize/RingTunnel',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: [
        'u_viewProjection', 'u_ringAngle', 'u_ringZ', 'u_ringHero', 'u_ringVane', 'u_ringGlow', 'u_radiusScale',
        'u_cameraPosition', 'u_lightA', 'u_lightB', 'u_core', 'u_body', 'u_fog', 'u_fadeStart', 'u_fadeEnd', 'u_hdrGain', 'u_spill',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program

    const box = buildBox()
    const staticBuffer = this.createBuffer(gl.ARRAY_BUFFER, layout.packed, gl.STATIC_DRAW)
    this.dynamicBuffer = this.createBuffer(gl.ARRAY_BUFFER, new Float32Array(layout.instanceCount * 4), gl.DYNAMIC_DRAW)
    this.globalBatch = this.createBatch(box, staticBuffer, 0)
    this.ringBatch = this.createBatch(box, staticBuffer, layout.globalCount)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.gpuBytes = layout.packed.byteLength + layout.instanceCount * 16 + box.vertices.byteLength + box.indices.byteLength
    assertCinema2NoGlErrors(gl, 'Hypnotize renderer setup')
  }

  estimateGpuBytes(): number { return this.gpuBytes }

  draw(state: Readonly<Cinema2HypnotizeDrawState>): void {
    if (this.disposed) return
    const { gl, program, layout } = this
    const frame = state.frame
    program.activate()
    program.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    program.setVec3('u_lightA', ...state.lightA)
    program.setVec3('u_lightB', ...state.lightB)
    program.setVec3('u_core', ...state.core)
    program.setVec3('u_body', ...state.body)
    program.setFloat('u_radiusScale', state.radiusScale)
    program.setFloat('u_fog', state.fog)
    program.setFloat('u_fadeStart', CINEMA2_HYPNOTIZE_TUNNEL.spacing * frame.ringsVisible * 0.62)
    program.setFloat('u_fadeEnd', CINEMA2_HYPNOTIZE_TUNNEL.spacing * frame.ringsVisible * 0.98)
    program.setFloat('u_hdrGain', CINEMA2_HYPNOTIZE_STRIP_HDR_GAIN)
    program.setFloat('u_spill', state.spill)
    gl.uniform1fv(program.getUniform('u_ringAngle'), frame.ringAngle)
    gl.uniform1fv(program.getUniform('u_ringZ'), frame.ringZ)
    gl.uniform1fv(program.getUniform('u_ringHero'), frame.ringHero)
    gl.uniform1fv(program.getUniform('u_ringVane'), frame.ringVane)
    gl.uniform1fv(program.getUniform('u_ringGlow'), frame.ringGlow)

    const used = layout.globalCount + frame.ringsVisible * layout.perRing
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, frame.dynamic, 0, used * 4)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.colorMask(true, true, true, true)
    gl.bindVertexArray(this.globalBatch.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.globalBatch.indexCount, gl.UNSIGNED_SHORT, 0, layout.globalCount)
    gl.bindVertexArray(this.ringBatch.vao)
    gl.drawElementsInstanced(gl.TRIANGLES, this.ringBatch.indexCount, gl.UNSIGNED_SHORT, 0, frame.ringsVisible * layout.perRing)
    gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Hypnotize tunnel draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.gl.deleteVertexArray(this.globalBatch.vao)
    this.gl.deleteVertexArray(this.ringBatch.vao)
    this.program.dispose()
  }

  private createBatch(box: { vertices: Float32Array; indices: Uint16Array }, staticBuffer: WebGLBuffer, instanceStart: number): Batch {
    const { gl } = this
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Hypnotize could not allocate a vertex array.')
    gl.bindVertexArray(vao)
    this.createBuffer(gl.ARRAY_BUFFER, box.vertices)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, box.indices)
    gl.bindBuffer(gl.ARRAY_BUFFER, staticBuffer)
    const stride = CINEMA2_HYPNOTIZE_INSTANCE_FLOATS * 4
    for (let attribute = 0; attribute < 3; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, stride, instanceStart * stride + attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicBuffer ?? null)
    gl.enableVertexAttribArray(6)
    gl.vertexAttribPointer(6, 4, gl.FLOAT, false, 16, instanceStart * 16)
    gl.vertexAttribDivisor(6, 1)
    return { vao, indexCount: box.indices.length }
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array, usage: number = this.gl.STATIC_DRAW): WebGLBuffer {
    const buffer = this.gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Hypnotize could not allocate a buffer.')
    this.gl.bindBuffer(target, buffer)
    this.gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, usage)
    this.buffers.push(buffer)
    return buffer
  }
}

/** Unit cube centred on the origin. Per vertex: position, normal and face UV. */
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

export { HYP_KIND }

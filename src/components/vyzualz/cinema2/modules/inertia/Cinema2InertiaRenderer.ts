import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import { buildCinema2InertiaGeometry, type InertiaPart, type InertiaProofPose } from './Cinema2InertiaGeometry'
import { INERTIA_DEFORM_GLSL, type InertiaMotionPose } from './Cinema2InertiaMotion'

const POINT_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in float a_role;
uniform mat4 u_viewProjection;
uniform float u_narrowFit;
uniform float u_dpr;
uniform float u_pointSize;
uniform float u_anchorSize;
${INERTIA_DEFORM_GLSL}
out float v_depth;
out float v_sparkleMask;
flat out int v_role;
flat out float v_diameter;
void main() {
  gl_Position = u_viewProjection * vec4(deform(a_position, a_role > 0.5 && a_role < 1.5), 1.0);
  gl_Position.xy *= u_narrowFit;
  v_role = int(a_role + 0.5);
  v_diameter = (v_role == 2 ? 5.0 * u_anchorSize : (v_role == 1 ? 1.6 : 1.4) * u_pointSize) * u_dpr;
  gl_PointSize = v_diameter + 2.0;
  v_depth = a_position.z;
  v_sparkleMask = step(0.4, sin(dot(a_position, vec3(31.0, 17.0, 11.0))));
}`

const COLOR_FUNCTIONS = `
uniform vec4 u_lattice;
uniform vec4 u_core;
uniform vec4 u_anchors;
uniform vec4 u_ribs;
uniform float u_intensity;
uniform int u_part;
out vec4 outColor;
vec3 toSrgb(vec3 linear) {
  return mix(12.92 * linear, 1.055 * pow(max(linear, vec3(0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), linear));
}
void emit(vec4 color, float coverage, float depthGain) {
  float alpha = coverage * depthGain * color.a;
  outColor = vec4(toSrgb(color.rgb * u_intensity) * alpha, alpha);
}`

const POINT_FRAGMENT = `#version 300 es
precision highp float;
in float v_depth;
in float v_sparkleMask;
uniform float u_sparkle;
flat in int v_role;
flat in float v_diameter;
${COLOR_FUNCTIONS}
void main() {
  if (u_part != 0 && u_part != v_role + 1) discard;
  float radius = length(gl_PointCoord - 0.5) * (v_diameter + 2.0);
  float coverage = 1.0 - smoothstep(max(0.0, v_diameter * 0.5 - 0.6), v_diameter * 0.5 + 0.6, radius);
  if (coverage < 0.002) discard;
  vec4 color = v_role == 2 ? u_anchors : v_role == 1 ? u_core : u_lattice;
  float coreRim = pow(1.0 - clamp(abs(v_depth) / 0.26, 0.0, 1.0), 2.0);
  float gain = v_role == 2 ? 1.0 : v_role == 1 ? mix(0.65, 1.0, coreRim) : mix(0.35, 0.9, clamp(v_depth + 0.5, 0.0, 1.0));
  emit(color, coverage, min(1.0, gain * (1.0 + u_sparkle * v_sparkleMask)));
}`

const RIB_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_start;
layout(location=1) in vec3 a_end;
uniform mat4 u_viewProjection;
uniform float u_narrowFit;
uniform vec2 u_resolution;
uniform float u_dpr;
${INERTIA_DEFORM_GLSL}
out float v_edge;
void main() {
  vec2 corners[6] = vec2[6](vec2(0,-1), vec2(1,-1), vec2(0,1), vec2(0,1), vec2(1,-1), vec2(1,1));
  vec2 corner = corners[gl_VertexID];
  vec4 start = u_viewProjection * vec4(deform(a_start,false),1), end = u_viewProjection * vec4(deform(a_end,false),1);
  start.xy *= u_narrowFit; end.xy *= u_narrowFit;
  vec2 direction = (end.xy / end.w - start.xy / start.w) * u_resolution;
  vec2 normal = vec2(-direction.y, direction.x) / max(length(direction), 0.00001);
  gl_Position = mix(start, end, corner.x);
  gl_Position.xy += normal * corner.y * (0.75 * u_dpr + 1.0) / u_resolution * gl_Position.w;
  v_edge = corner.y;
}`

const RIB_FRAGMENT = `#version 300 es
precision highp float;
in float v_edge;
${COLOR_FUNCTIONS}
void main() {
  if (u_part != 0 && u_part != 4) discard;
  emit(u_ribs, 1.0 - smoothstep(0.1, 1.0, abs(v_edge)), 0.22);
}`

export interface InertiaDrawState {
  viewProjection: readonly number[]
  width: number
  height: number
  dpr: number
  pose: InertiaProofPose
  part: InertiaPart
  quality: 'low' | 'medium' | 'high'
  intensity: number
  displacement: number
  sparkle: number
  motion: InertiaMotionPose
  cageSize: number
  coreSize: number
  density: number
  pointSize: number
  anchorSize: number
  lattice: Cinema2Color
  core: Cinema2Color
  anchors: Cinema2Color
  ribs: Cinema2Color
}

export class Cinema2InertiaRenderer {
  private pointProgram: ShaderProgram | null = null
  private ribProgram: ShaderProgram | null = null
  private pointVao: WebGLVertexArrayObject | null = null
  private ribVao: WebGLVertexArrayObject | null = null
  private pointBuffer: WebGLBuffer | null = null
  private ribBuffer: WebGLBuffer | null = null
  private key = ''
  private geometry = buildCinema2InertiaGeometry()
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    try {
      this.pointProgram = program(gl, POINT_VERTEX, POINT_FRAGMENT, 'Points')
      this.ribProgram = program(gl, RIB_VERTEX, RIB_FRAGMENT, 'Ribs')
      this.pointVao = gl.createVertexArray(); this.ribVao = gl.createVertexArray()
      this.pointBuffer = gl.createBuffer(); this.ribBuffer = gl.createBuffer()
      if (!this.pointVao || !this.ribVao || !this.pointBuffer || !this.ribBuffer) throw new Error('Inertia GPU allocation failed')
      gl.bindVertexArray(this.pointVao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0)
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12)
      gl.bindVertexArray(this.ribVao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ribBuffer)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribDivisor(0, 1)
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); gl.vertexAttribDivisor(1, 1)
      gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null)
      assertCinema2NoGlErrors(gl, 'Inertia allocation')
    } catch (error) { this.dispose(); throw error }
  }

  estimateGpuBytes(): number { return this.geometry.points.byteLength + this.geometry.ribs.byteLength }

  draw(state: InertiaDrawState): void {
    if (this.disposed) return
    const gl = this.gl, key = `${state.pose}:${state.quality}:${state.density}`
    if (key !== this.key) {
      this.geometry = buildCinema2InertiaGeometry(state.pose, state.quality, state.density)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer); gl.bufferData(gl.ARRAY_BUFFER, this.geometry.points, gl.STATIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ribBuffer); gl.bufferData(gl.ARRAY_BUFFER, this.geometry.ribs, gl.STATIC_DRAW)
      gl.bindBuffer(gl.ARRAY_BUFFER, null); this.key = key
    }
    // Transparent point surfaces read existing depth, but never occlude one another.
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false)
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND)
    gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.bind(this.ribProgram!, state)
    this.ribProgram!.setVec2('u_resolution', state.width, state.height)
    gl.bindVertexArray(this.ribVao)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.geometry.counts.ribs)
    this.bind(this.pointProgram!, state)
    gl.bindVertexArray(this.pointVao)
    gl.drawArrays(gl.POINTS, 0, this.geometry.points.length / 4)
    gl.bindVertexArray(null); gl.useProgram(null)
    gl.disable(gl.BLEND); gl.depthMask(true)
    assertCinema2NoGlErrors(gl, 'Inertia static sculpture')
  }

  private bind(shader: ShaderProgram, state: InertiaDrawState): void {
    shader.activate()
    shader.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    // Shared camera has a vertical ortho span; fit narrow outputs to their shorter side.
    shader.setFloat('u_narrowFit', Math.min(1, state.width / state.height))
    shader.setFloat('u_dpr', state.dpr)
    shader.setFloat('u_intensity', state.intensity)
    shader.setFloat('u_displacement', state.displacement)
    shader.setFloat('u_sparkle', state.sparkle)
    shader.setVec3('u_rotation', ...state.motion.rotation)
    shader.setVec4('u_shape', ...state.motion.shape)
    shader.setFloat('u_phase', state.motion.phase)
    shader.setFloat('u_travel', state.motion.travel)
    shader.setFloat('u_cageSize', state.cageSize)
    shader.setFloat('u_coreSize', state.coreSize)
    shader.setFloat('u_pointSize', state.pointSize)
    shader.setFloat('u_anchorSize', state.anchorSize)
    shader.setFloat('u_safeRadius', Math.min(0.90, 0.92 - (Math.max(5 * state.anchorSize, 1.6 * state.pointSize) + 2) * state.dpr / Math.min(state.width, state.height)))
    shader.setInt('u_part', ['all', 'lattice', 'core', 'anchors', 'ribs'].indexOf(state.part))
    for (const name of ['lattice', 'core', 'anchors', 'ribs'] as const) {
      const color = state[name]
      shader.setVec4(`u_${name}`, linear(color[0]), linear(color[1]), linear(color[2]), color[3])
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pointProgram?.dispose(); this.ribProgram?.dispose()
    this.gl.bindVertexArray(null)
    this.gl.deleteVertexArray(this.pointVao); this.gl.deleteVertexArray(this.ribVao)
    this.gl.deleteBuffer(this.pointBuffer); this.gl.deleteBuffer(this.ribBuffer)
  }
}

function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string, label: string): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label: `Cinema2/Inertia/${label}`, vertSrc: vertex, fragSrc: fragment })
  if (!result.program) throw new Error(`Inertia ${label} shader failed: ${JSON.stringify(result.error)}`)
  return result.program
}

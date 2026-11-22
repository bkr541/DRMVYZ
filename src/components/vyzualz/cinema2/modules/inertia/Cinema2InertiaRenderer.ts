import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import { buildCinema2InertiaGeometry, type InertiaPart, type InertiaProofPose } from './Cinema2InertiaGeometry'
import { INERTIA_EXTRA_STRIDE, InertiaExtras } from './Cinema2InertiaExtras'
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
  v_ripple = 0.0;
  gl_Position = u_viewProjection * vec4(deform(a_position, a_role > 0.5 && a_role < 1.5), 1.0);
  gl_Position.xy *= u_narrowFit;
  v_role = int(a_role + 0.5);
  // The core's dots swell a little as a wave passes through them.
  v_diameter = (v_role == 2 ? 5.0 * u_anchorSize : (v_role == 1 ? 1.6 * (1.0 + 0.3 * v_ripple) : 1.4) * u_pointSize) * u_dpr;
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
in float v_ripple;
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
  // A passing wave's trough dims the core's dots (the crest stays as bright as ever, so with the core still nothing changes).
  float gain = v_role == 2 ? 1.0 : v_role == 1 ? mix(0.65, 1.0, coreRim) * (1.0 + 0.5 * min(v_ripple, 0.0)) : mix(0.35, 0.9, clamp(v_depth + 0.5, 0.0, 1.0));
  emit(color, coverage, min(1.0, gain * (1.0 + u_sparkle * v_sparkleMask)));
}`

const EXTRAS_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in float a_role;
layout(location=2) in float a_gain;
uniform mat4 u_viewProjection;
uniform float u_narrowFit;
uniform float u_dpr;
uniform float u_pointSize;
uniform float u_pulse;
out float v_gain;
flat out int v_role;
flat out float v_diameter;
void main() {
  gl_Position = u_viewProjection * vec4(a_position, 1.0);
  gl_Position.xy *= u_narrowFit;
  v_role = int(a_role + 0.5);
  v_gain = a_gain;
  // 3 ring, 4 satellite, 5 dial tick, 6 major tick, 7 dust, 8 inner shell. The kick swells the satellites.
  float size = v_role == 4 ? 7.0 * (1.0 + u_pulse * 1.5) : v_role == 6 ? 4.4 : v_role == 7 ? 1.7 : v_role == 5 ? 2.3 : 2.0;
  v_diameter = size * (v_role == 4 ? 1.0 : u_pointSize) * u_dpr;
  gl_PointSize = v_diameter + 2.0;
}`

const EXTRAS_FRAGMENT = `#version 300 es
precision highp float;
in float v_gain;
flat in int v_role;
flat in float v_diameter;
uniform vec4 u_orbits;
uniform vec4 u_dust;
uniform vec4 u_innerColor;
uniform float u_intensity;
out vec4 outColor;
vec3 toSrgb(vec3 linear) {
  return mix(12.92 * linear, 1.055 * pow(max(linear, vec3(0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), linear));
}
void main() {
  float radius = length(gl_PointCoord - 0.5) * (v_diameter + 2.0);
  float coverage = 1.0 - smoothstep(max(0.0, v_diameter * 0.5 - 0.6), v_diameter * 0.5 + 0.6, radius);
  if (coverage < 0.002) discard;
  vec4 color = v_role == 8 ? u_innerColor : (v_role == 7 || v_role == 5 || v_role == 6) ? u_dust : u_orbits;
  float alpha = coverage * min(1.0, v_gain) * color.a;
  outColor = vec4(toSrgb(color.rgb * u_intensity) * alpha, alpha);
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
  /** The extra elements' clock, in beats, and how much of each to show (0 hides it). */
  clock: number
  coreMotion: number
  coreKick: number
  rings: number
  dial: number
  dust: number
  innerShell: number
  orbits: Cinema2Color
  dustColor: Cinema2Color
  /** Outward push on the orbit rings, from the shared kick displacement. */
  push: number
}

export class Cinema2InertiaRenderer {
  private pointProgram: ShaderProgram | null = null
  private ribProgram: ShaderProgram | null = null
  private pointVao: WebGLVertexArrayObject | null = null
  private ribVao: WebGLVertexArrayObject | null = null
  private pointBuffer: WebGLBuffer | null = null
  private ribBuffer: WebGLBuffer | null = null
  private extrasProgram: ShaderProgram | null = null
  private extrasVao: WebGLVertexArrayObject | null = null
  private extrasBuffer: WebGLBuffer | null = null
  private extras: InertiaExtras | null = null
  private extrasData = new Float32Array(0)
  private extrasQuality = ''
  private key = ''
  private geometry = buildCinema2InertiaGeometry()
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    try {
      this.pointProgram = program(gl, POINT_VERTEX, POINT_FRAGMENT, 'Points')
      this.ribProgram = program(gl, RIB_VERTEX, RIB_FRAGMENT, 'Ribs')
      this.extrasProgram = program(gl, EXTRAS_VERTEX, EXTRAS_FRAGMENT, 'Extras')
      this.extrasVao = gl.createVertexArray(); this.extrasBuffer = gl.createBuffer()
      if (!this.extrasVao || !this.extrasBuffer) throw new Error('Inertia GPU allocation failed')
      gl.bindVertexArray(this.extrasVao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.extrasBuffer)
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, INERTIA_EXTRA_STRIDE * 4, 0)
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, INERTIA_EXTRA_STRIDE * 4, 12)
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, INERTIA_EXTRA_STRIDE * 4, 16)
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

  estimateGpuBytes(): number { return this.geometry.points.byteLength + this.geometry.ribs.byteLength + this.extrasData.byteLength }

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
    this.drawExtras(state)
    gl.bindVertexArray(null); gl.useProgram(null)
    gl.disable(gl.BLEND); gl.depthMask(true)
    assertCinema2NoGlErrors(gl, 'Inertia static sculpture')
  }

  /** The orbit rings, dial, dust and inner shell. The static proof parts show only the part under review, so they leave these out. */
  private drawExtras(state: InertiaDrawState): void {
    if (state.part !== 'all') return
    const gl = this.gl
    if (!this.extras || this.extrasQuality !== state.quality) {
      this.extras = new InertiaExtras(state.quality); this.extrasQuality = state.quality
      this.extrasData = new Float32Array(this.extras.capacity * INERTIA_EXTRA_STRIDE)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.extrasBuffer); gl.bufferData(gl.ARRAY_BUFFER, this.extrasData.byteLength, gl.DYNAMIC_DRAW)
    }
    const count = this.extras.fill(this.extrasData, {
      clock: state.clock, rings: state.rings, dial: state.dial, dust: state.dust, inner: state.innerShell, coreSize: state.coreSize, push: state.push,
    })
    if (count === 0) return
    gl.bindBuffer(gl.ARRAY_BUFFER, this.extrasBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.extrasData, 0, count * INERTIA_EXTRA_STRIDE)
    const shader = this.extrasProgram!
    shader.activate()
    shader.setMat4('u_viewProjection', new Float32Array(state.viewProjection))
    shader.setFloat('u_narrowFit', Math.min(1, state.width / state.height))
    shader.setFloat('u_dpr', state.dpr)
    shader.setFloat('u_pointSize', state.pointSize)
    shader.setFloat('u_intensity', state.intensity)
    shader.setFloat('u_pulse', Math.min(1, state.coreKick))
    for (const [name, color] of [['u_orbits', state.orbits], ['u_dust', state.dustColor], ['u_innerColor', state.core]] as const) {
      shader.setVec4(name, linear(color[0]), linear(color[1]), linear(color[2]), color[3])
    }
    gl.bindVertexArray(this.extrasVao)
    gl.drawArrays(gl.POINTS, 0, count)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    assertCinema2NoGlErrors(gl, 'Inertia extra elements')
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
    shader.setFloat('u_clock', state.clock)
    shader.setFloat('u_coreMotion', state.part === 'all' ? state.coreMotion : 0)
    shader.setFloat('u_coreKick', state.coreKick)
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
    this.pointProgram?.dispose(); this.ribProgram?.dispose(); this.extrasProgram?.dispose()
    this.gl.bindVertexArray(null)
    this.gl.deleteVertexArray(this.pointVao); this.gl.deleteVertexArray(this.ribVao); this.gl.deleteVertexArray(this.extrasVao)
    this.gl.deleteBuffer(this.pointBuffer); this.gl.deleteBuffer(this.ribBuffer); this.gl.deleteBuffer(this.extrasBuffer)
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

import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { CINEMA2_HUMN_BONE_COUNT, CINEMA2_HUMN_VERTEX_FLOATS, type Cinema2HumNMesh } from './Cinema2HumNMesh'

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_skin;
layout(location = 3) in vec3 a_center;
layout(location = 4) in vec4 a_tri;
layout(location = 5) in vec3 a_edge;

uniform mat4 u_bones[${CINEMA2_HUMN_BONE_COUNT}];
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
// Kick jitter: a share of the triangles is thrown out along a random direction by up to u_jitter metres, chosen per kick by u_kickSeed.
uniform float u_jitter;
uniform float u_kickSeed;

out vec3 v_bary;
flat out vec4 v_tri;
flat out vec3 v_edge;
flat out float v_pick;
out vec3 v_world;

float hash11(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

void main() {
  vec3 bind = a_position;
  float pick = 0.0;
  if (u_jitter > 0.00001) {
    float select = hash11(a_tri.z * 91.7 + u_kickSeed * 13.13);
    pick = step(select, 0.34);
    vec3 direction = normalize(a_normal + 0.8 * vec3(hash11(a_tri.z * 3.1 + u_kickSeed), hash11(a_tri.z * 5.3 + u_kickSeed * 2.0), hash11(a_tri.z * 7.9 + u_kickSeed * 3.0)) - 0.4);
    bind += direction * pick * u_jitter * (0.45 + 0.55 * hash11(a_tri.z * 11.3 + u_kickSeed));
  }
  int boneA = int(a_skin.x + 0.5);
  int boneB = int(a_skin.y + 0.5);
  vec4 p = vec4(bind, 1.0);
  vec3 skinned = mix((u_bones[boneA] * p).xyz, (u_bones[boneB] * p).xyz, a_skin.z);
  vec4 world = u_model * vec4(skinned, 1.0);
  v_world = world.xyz;
  int corner = gl_VertexID % 3;
  v_bary = vec3(corner == 0 ? 1.0 : 0.0, corner == 1 ? 1.0 : 0.0, corner == 2 ? 1.0 : 0.0);
  v_tri = a_tri;
  v_edge = a_edge;
  v_pick = pick;
  gl_Position = u_projection * u_view * world;
}
`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec3 v_bary;
flat in vec4 v_tri;
flat in vec3 v_edge;
flat in float v_pick;
in vec3 v_world;
out vec4 outColor;

uniform vec4 u_background;
uniform vec4 u_wireframe;
uniform vec4 u_ink;
uniform vec3 u_color0;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_fill;
uniform float u_fillShift;
uniform int u_fillStyle;
uniform float u_gradientScroll;
uniform float u_linePresence;
uniform float u_lineWeight;
uniform float u_lineScale;
uniform float u_fragmentation;
uniform float u_edgeShare;
uniform float u_edgeGlow;
uniform float u_flicker;
uniform float u_flickerDown;
uniform float u_snare;
uniform float u_beatSeed;
uniform float u_downSeed;
uniform float u_kickJitter;
uniform float u_pulse;

float hash11(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

vec3 rgb2hsv(vec3 c) {
  vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

// Blend two colours along the colour wheel (shortest way round) rather than straight through RGB, so a gradient from magenta to green
// passes through vivid hues instead of a muddy grey.
vec3 hueMix(vec3 a, vec3 b, float f) {
  vec3 ha = rgb2hsv(a);
  vec3 hb = rgb2hsv(b);
  float dh = hb.x - ha.x;
  dh -= floor(dh + 0.5);
  return hsv2rgb(vec3(fract(ha.x + dh * f), mix(ha.y, hb.y, f), mix(ha.z, hb.z, f)));
}

vec3 palette(float t) {
  float cycle = fract(t / 3.0) * 3.0;
  float index = floor(cycle);
  float f = fract(cycle);
  vec3 a = index < 0.5 ? u_color0 : (index < 1.5 ? u_color1 : u_color2);
  vec3 b = index < 0.5 ? u_color1 : (index < 1.5 ? u_color2 : u_color0);
  return hueMix(a, b, f);
}

// Style of one filled triangle: 0 gradient, 1 stripes, 2 solid role colour, 3 halftone dots.
int styleOf(float seed) {
  if (u_fillStyle == 0) return 2;
  if (u_fillStyle == 1) return 0;
  if (u_fillStyle == 2) return 1;
  float s = fract(seed * 5.17 + 0.31);
  if (s < 0.62) return 0;
  if (s < 0.8) return 1;
  if (s < 0.92) return 2;
  return 3;
}

vec3 fillColor(float seed, float boost) {
  int style = styleOf(seed);
  float t = v_world.y * 20.0 + seed * 3.0 + u_gradientScroll;
  vec3 gradient = palette(t);
  if (style == 0) return gradient * boost;
  if (style == 1) {
    float angle = seed * 3.14159;
    vec2 direction = vec2(cos(angle), sin(angle));
    float stripe = step(0.5, fract(dot(v_world.xy, direction) * 95.0));
    return mix(vec3(0.0), u_ink.rgb, stripe) * boost;
  }
  if (style == 2) {
    float role = fract(seed * 9.7);
    vec3 solid = role < 0.5 ? u_color0 : (role < 0.82 ? u_color1 : u_color2);
    return solid * boost;
  }
  vec2 cell = fract(v_world.xy * 150.0) - 0.5;
  float radius = 0.18 + 0.34 * fract(v_world.y * 21.0 + seed * 4.0);
  float dotMask = 1.0 - smoothstep(radius - 0.06, radius + 0.06, length(cell));
  return mix(gradient * 0.5, u_ink.rgb, dotMask) * boost;
}

void main() {
  float rank = v_tri.x;
  float region = v_tri.y;
  float seed = v_tri.z;

  // Which triangles carry colour: a stable random subset that slowly turns over (u_fillShift), so no triangle keeps a fill for ever.
  float f = fract(rank + u_fillShift);
  float on = u_fill >= 0.999 ? 1.0 : (u_fill <= 0.001 ? 0.0 : 1.0 - smoothstep(u_fill - 0.035, u_fill, f));
  // Beat flicker: a fresh handful of triangles flashes into colour on every beat; a downbeat flashes a much larger set.
  float beatSelect = step(fract(seed * 7.31 + u_beatSeed * 3.7), 0.12 + 0.5 * u_flicker);
  float downSelect = step(fract(seed * 3.11 + u_downSeed * 5.3), 0.18 + 0.32 * u_flickerDown);
  float flash = max(beatSelect * u_flicker, downSelect * u_flickerDown);
  on = max(on, flash);
  float boost = 1.0 + flash * 0.7 + v_pick * u_kickJitter * 0.9 + 0.12 * u_pulse;

  vec3 base = u_background.rgb;
  vec3 color = base;
  if (region > 0.5) {
    // Eye: white disc with concentric rings and a dark pupil. v_bary.x is 1 at the disc centre, so 1 - x is the radius.
    float r = 1.0 - v_bary.x;
    float rings = smoothstep(0.045, 0.0, abs(r - 0.36)) + smoothstep(0.04, 0.0, abs(r - 0.66));
    float pupil = 1.0 - smoothstep(0.14, 0.2, r);
    float glint = 1.0 - smoothstep(0.03, 0.07, length(vec2(r * cos(v_tri.w * 6.28318) - 0.02, r * sin(v_tri.w * 6.28318) + 0.05)));
    vec3 eye = u_ink.rgb * (0.9 + 0.5 * u_snare);
    eye = mix(eye, vec3(0.0), clamp(rings * 0.8 + pupil, 0.0, 1.0));
    eye = mix(eye, u_ink.rgb, glint * 0.8);
    color = eye;
  } else {
    color = mix(base, fillColor(seed, boost), on);
  }

  // Edges: distance in pixels to each triangle edge from the barycentric gradient.
  float lineAmount = 0.0;
  // Line Weight 1 is about a 2 pixel line at 1080p and scales with the frame, so the figure keeps its look at any size.
  float halfWidth = 0.7 * u_lineWeight * u_lineScale + 0.3;
  // Derivatives are taken outside any branch so they stay well defined.
  vec3 pixelStep = vec3(
    length(vec2(dFdx(v_bary.x), dFdy(v_bary.x))),
    length(vec2(dFdx(v_bary.y), dFdy(v_bary.y))),
    length(vec2(dFdx(v_bary.z), dFdy(v_bary.z)))
  );
  for (int k = 0; k < 3; k++) {
    float b = k == 0 ? v_bary.x : (k == 1 ? v_bary.y : v_bary.z);
    float e = k == 0 ? v_edge.x : (k == 1 ? v_edge.y : v_edge.z);
    if (region > 0.5 && k != 0) continue;
    float rankE = mod(e, 2.0);
    float flip = e >= 2.0 ? 1.0 : 0.0;
    float gradient = max(k == 0 ? pixelStep.x : (k == 1 ? pixelStep.y : pixelStep.z), 1e-6);
    float d = b / gradient;
    float coverage = 1.0 - smoothstep(halfWidth, halfWidth + 1.1, d);
    if (coverage <= 0.0) continue;
    // Position along the edge (0..1 from the lower-numbered end), the same from both triangles that share it.
    float along = k == 0 ? v_bary.z / max(v_bary.y + v_bary.z, 1e-5) : (k == 1 ? v_bary.x / max(v_bary.z + v_bary.x, 1e-5) : v_bary.y / max(v_bary.x + v_bary.y, 1e-5));
    along = flip > 0.5 ? 1.0 - along : along;
    float cell = floor(along * 3.0);
    float dashKeep = step(u_fragmentation * 0.9, hash11(rankE * 97.0 + cell * 13.3 + 4.1));
    float keep = step(rankE, u_edgeShare) * dashKeep;
    lineAmount = max(lineAmount, coverage * keep);
  }
  lineAmount *= u_linePresence;
  vec3 wire = u_wireframe.rgb * (1.0 + u_edgeGlow * 0.6 + flash * 0.5 + u_pulse * 0.15);
  color = mix(color, wire, lineAmount);
  outColor = vec4(color, 1.0);
}
`

const UNIFORMS = [
  'u_bones', 'u_model', 'u_view', 'u_projection', 'u_jitter', 'u_kickSeed',
  'u_background', 'u_wireframe', 'u_ink', 'u_color0', 'u_color1', 'u_color2',
  'u_fill', 'u_fillShift', 'u_fillStyle', 'u_gradientScroll',
  'u_linePresence', 'u_lineWeight', 'u_lineScale', 'u_fragmentation', 'u_edgeShare', 'u_edgeGlow',
  'u_flicker', 'u_flickerDown', 'u_snare', 'u_beatSeed', 'u_downSeed', 'u_kickJitter', 'u_pulse',
]

export interface Cinema2HumNDrawState {
  view: Float32Array
  projection: Float32Array
  /** Figure placement (scale about the framing anchor). */
  model: Float32Array
  bones: Float32Array
  background: readonly [number, number, number, number]
  wireframe: readonly [number, number, number, number]
  ink: readonly [number, number, number, number]
  colors: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]]
  fill: number
  fillShift: number
  /** 0 solid, 1 gradient, 2 stripe, 3 mixed. */
  fillStyle: number
  gradientScroll: number
  linePresence: number
  lineWeight: number
  /** Frame height relative to 1080p (clamped), so line thickness scales with the output size. */
  lineScale: number
  fragmentation: number
  /** Share of edges drawn (Mesh Detail Sparse thins the network). */
  edgeShare: number
  edgeGlow: number
  flicker: number
  flickerDown: number
  snare: number
  beatSeed: number
  downSeed: number
  kickSeed: number
  /** Metres a kicked triangle is thrown out. */
  jitter: number
  kickJitter: number
  pulse: number
}

/** Draws the figure mesh into the currently bound target (colour + depth). */
export class Cinema2HumNRenderer {
  private readonly program: ShaderProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly vertexCount: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, mesh: Cinema2HumNMesh) {
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/HumN/Figure',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      optionalUniforms: UNIFORMS,
    })
    if (!compiled.program) throw new Error(`Shader compilation failed at ${compiled.error.stage} for "${compiled.error.label}": ${compiled.error.log}`)
    this.program = compiled.program
    const vao = gl.createVertexArray()
    const buffer = gl.createBuffer()
    if (!vao || !buffer) throw new Error('Cinema 2.0 HUM:N could not allocate its vertex buffers.')
    this.vao = vao
    this.buffer = buffer
    this.vertexCount = mesh.vertexCount
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data as ArrayBufferView<ArrayBuffer>, gl.STATIC_DRAW)
    const stride = CINEMA2_HUMN_VERTEX_FLOATS * 4
    const layout: readonly (readonly [number, number])[] = [[3, 0], [3, 12], [3, 24], [3, 36], [4, 48], [3, 64]]
    layout.forEach(([size, offset], location) => {
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset)
    })
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
  }

  draw(state: Readonly<Cinema2HumNDrawState>): void {
    if (this.disposed) return
    const { gl, program } = this
    program.activate()
    program.setMat4('u_bones', state.bones)
    program.setMat4('u_model', state.model)
    program.setMat4('u_view', state.view)
    program.setMat4('u_projection', state.projection)
    program.setFloat('u_jitter', state.jitter)
    program.setFloat('u_kickSeed', state.kickSeed)
    program.setVec4('u_background', ...state.background)
    program.setVec4('u_wireframe', ...state.wireframe)
    program.setVec4('u_ink', ...state.ink)
    program.setVec3('u_color0', ...state.colors[0])
    program.setVec3('u_color1', ...state.colors[1])
    program.setVec3('u_color2', ...state.colors[2])
    program.setFloat('u_fill', state.fill)
    program.setFloat('u_fillShift', state.fillShift)
    program.setInt('u_fillStyle', state.fillStyle)
    program.setFloat('u_gradientScroll', state.gradientScroll)
    program.setFloat('u_linePresence', state.linePresence)
    program.setFloat('u_lineWeight', state.lineWeight)
    program.setFloat('u_lineScale', state.lineScale)
    program.setFloat('u_fragmentation', state.fragmentation)
    program.setFloat('u_edgeShare', state.edgeShare)
    program.setFloat('u_edgeGlow', state.edgeGlow)
    program.setFloat('u_flicker', state.flicker)
    program.setFloat('u_flickerDown', state.flickerDown)
    program.setFloat('u_snare', state.snare)
    program.setFloat('u_beatSeed', state.beatSeed)
    program.setFloat('u_downSeed', state.downSeed)
    program.setFloat('u_kickJitter', state.kickJitter)
    program.setFloat('u_pulse', state.pulse)
    gl.bindVertexArray(this.vao)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    gl.disable(gl.BLEND)
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
    gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'HUM:N figure draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gl.deleteBuffer(this.buffer)
    this.gl.deleteVertexArray(this.vao)
    this.program.dispose()
  }
}

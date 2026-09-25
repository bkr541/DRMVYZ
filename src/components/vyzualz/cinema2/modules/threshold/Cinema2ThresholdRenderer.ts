import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import { THRESHOLD_HOUSING_WINDOW, THRESHOLD_INSTANCE_FLOATS } from './Cinema2ThresholdLayout'

const VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec4 i0;
layout(location = 4) in vec4 i1;
layout(location = 5) in vec4 i2;
layout(location = 6) in vec4 i3;
uniform mat4 u_viewRotation;
uniform mat4 u_projection;
uniform vec3 u_originShift;
uniform float u_widthScale;
uniform float u_intensity;
uniform float u_baseLevel;
uniform float u_accentBase;
uniform float u_kick;
uniform float u_snare;
uniform float u_beat;
uniform float u_beatParity;
uniform float u_sweepFront;
uniform float u_sweepStrength;
uniform float u_drop;
uniform float u_energy;
uniform float u_bass;
uniform float u_vocal;
uniform float u_arc;
uniform float u_level;
uniform float u_phraseSide;
uniform float u_breathing;
uniform float u_fieldVisibility;
out vec3 v_normal;
out vec2 v_uv;
out float v_emit;
out float v_role;
out float v_frontFace;
out vec3 v_relative;
out vec3 v_local;
out vec3 v_size;
out vec2 v_faceSize;
out float v_fieldFade;

mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  vec3 size = vec3(i0.w, i1.x, i1.y);
  mat3 rotation = rotY(i1.z) * rotX(i1.w) * rotZ(i2.x);
  float role = i2.y;
  float row = i2.z;
  float rank = i2.w;
  float side = i3.x;
  float zone = i3.y;

  vec3 center = i0.xyz;
  // Corridor Width widens or narrows the aisle only; the hanging field and ring keep their layout.
  // Everything in the corridor (screens, housings, bezels) shifts by the same amount, so a housing stays attached to its screen.
  center.x += sign(center.x) * 26.0 * (u_widthScale - 1.0) * step(zone, 0.5);
  vec3 relative = center + rotation * (a_position * size) + u_originShift;
  v_relative = relative;
  gl_Position = u_projection * (u_viewRotation * vec4(relative, 1.0));
  v_normal = rotation * a_normal;
  v_uv = a_uv;
  v_local = a_position;
  v_size = size;
  vec3 an = abs(a_normal);
  v_faceSize = an.z > 0.5 ? size.xy : (an.x > 0.5 ? size.zy : size.xz);
  v_role = role;
  v_frontFace = step(0.5, a_normal.z);

  // Per-screen emission. Kept per instance (flat across the box) so the fragment stage only shades the LED face.
  float ahead = max(-(center.z + u_originShift.z), 0.0);
  float rowParity = mod(row, 2.0);
  float open = smoothstep(rank - 0.05, rank + 0.05, u_arc);
  float breathe = 0.96 + 0.04 * u_breathing;
  float beatOn = 1.0 - abs(rowParity - u_beatParity);
  // A negative phrase side (no music) means no leading side: the set is perfectly symmetric at idle.
  float lead = u_phraseSide < 0.0 ? 1.0 : mix(0.72, 1.0, 1.0 - abs(side - u_phraseSide));
  float sweep = u_sweepStrength * exp(-pow((ahead - u_sweepFront) / 16.0, 2.0));
  // Main screens sit at full white when idle; music dims them (u_level) and hits/kick/snare lift them back over the top.
  float primary = open * lead * (u_baseLevel * breathe * u_level + beatOn * u_beat * 0.5 + rowParity * u_snare * 0.8 + u_kick * 0.25);
  float accent = (u_accentBase * breathe + u_kick * 1.15 + u_bass * 0.4) * (1.0 - 0.5 * u_vocal);
  float emit = 0.0;
  if (role > 1.5) emit = accent + sweep * 0.6 + u_drop * 0.8;
  else if (role > 0.5) emit = primary + sweep * 1.3 + u_drop; // roles 1, 3 and 4 share their screen's emission (housings and bezels catch its light)
  // The hanging field and the ring surface out of the fog as the camera nears them, so the far end of the corridor stays a clean vanishing point.
  // They are also a little dimmer than the corridor: a panel dead ahead in the ring fills the screen centre.
  // Field and ring pieces dissolve away (screen-door) beyond ~100 units, so the far end of the corridor is clean glow rather than a skyline.
  // The hanging field stays hidden while the camera is inside the corridor (u_fieldVisibility), so it never shows as a skyline against the glow.
  v_fieldFade = zone > 0.5 ? smoothstep(118.0, 96.0, ahead) * (zone < 1.5 ? u_fieldVisibility : 1.0) : 1.0;
  float reveal = zone > 0.5 ? smoothstep(75.0, 40.0, ahead) * 0.72 : 1.0;
  // A screen dims smoothly as the camera gets close to it, so flying past one never blows out the frame.
  float nearDim = mix(0.45, 1.0, smoothstep(9.0, 28.0, length(center + u_originShift)));
  v_emit = emit * u_intensity * reveal * nearDim;
}`

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec2 v_uv;
in float v_emit;
in float v_role;
in float v_frontFace;
in vec3 v_relative;
in vec3 v_local;
in vec3 v_size;
in vec2 v_faceSize;
in float v_fieldFade;
uniform vec3 u_primaryColor;
uniform vec3 u_accentColor;
uniform vec3 u_bodyColor;
uniform vec3 u_fogColor;
uniform float u_fogDensity;
uniform float u_highs;
uniform float u_time;
out vec4 outColor;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Screen window on a housing tower in the tower's normalized local space: x = half width, y = half height, z = center height.
const vec3 HOUSING_WINDOW = vec3(${THRESHOLD_HOUSING_WINDOW.halfWidth.toFixed(5)}, ${THRESHOLD_HOUSING_WINDOW.halfHeight.toFixed(5)}, ${THRESHOLD_HOUSING_WINDOW.centerY.toFixed(5)});

void main() {
  if (v_fieldFade < 1.0 && hash21(gl_FragCoord.xy) >= v_fieldFade) discard;
  vec3 normal = normalize(v_normal);
  float dist = length(v_relative);
  vec3 viewDir = -v_relative / max(dist, 0.001);
  vec2 edge = min(v_uv, 1.0 - v_uv);
  vec3 color;
  if (v_role > 2.5) {
    // Housing tower (3) and bezel / plinth metal (4): dark, grimy, and lit by the screen they belong to. The screen's light falls off
    // with distance from the window, so the tower face around the screen and its near edges glow while the far sides stay dark.
    vec3 q = v_local;
    float dx = max(abs(q.x) - HOUSING_WINDOW.x, 0.0) * v_size.x;
    float dy = max(abs(q.y - HOUSING_WINDOW.z) - HOUSING_WINDOW.y, 0.0) * v_size.y;
    float dz = (0.5 - q.z) * v_size.z;
    float reach = v_role < 3.5 ? length(vec3(dx, dy, dz)) : 0.6 + 0.4 * length(vec2(dx, dy));
    float spill = v_emit * exp(-reach / 3.2);
    vec3 tint = u_primaryColor;
    // Weathered concrete: long soft vertical streaks plus a finer mottling, all gentle so the towers stay a dark mass.
    vec2 surface = vec2(q.x * v_size.x + q.z * v_size.z, q.y * v_size.y);
    float streak = valueNoise(vec2(surface.x * 1.3, surface.y * 0.06)) * 0.6 + valueNoise(surface * vec2(0.5, 0.25)) * 0.4;
    float grime = 0.55 + 0.9 * streak;
    float edgeWorld = min(min(v_uv.x, 1.0 - v_uv.x) * v_faceSize.x, min(v_uv.y, 1.0 - v_uv.y) * v_faceSize.y);
    float edgeLine = 1.0 - smoothstep(0.0, max(0.05, fwidth(edgeWorld) * 1.1), edgeWorld);
    vec3 ambient = u_fogColor * (0.4 + 0.2 * normal.y) + u_bodyColor * 2.0;
    color = ambient * grime + tint * spill * (0.07 + 0.06 * grime);
    color += edgeLine * (u_fogColor * 0.35 + tint * spill * 0.3);
  } else if (v_role > 0.5 && v_frontFace > 0.5) {
    // LED screen inset in a dark bezel, with a fine pixel grid and highs-driven shimmer.
    float screen = smoothstep(0.012, 0.03, edge.x) * smoothstep(0.006, 0.014, edge.y);
    vec2 cell = vec2(64.0, 300.0);
    vec2 grid = fract(v_uv * cell);
    // The LED pitch fades out once a pixel drops below ~2 screen pixels, so distant screens do not moire.
    float pixelDetail = clamp(1.0 - max(fwidth(v_uv.x * cell.x), fwidth(v_uv.y * cell.y)) * 1.8, 0.0, 1.0);
    float pixel = mix(1.0, smoothstep(0.55, 0.25, length(grid - 0.5)), 0.1 * pixelDetail);
    float shimmer = 1.0 + (hash21(floor(v_uv * cell) + floor(u_time * 24.0)) - 0.5) * u_highs * 0.7 * pixelDetail;
    float gradient = 0.96 + 0.04 * v_uv.y;
    vec3 tint = v_role > 1.5 ? u_accentColor : u_primaryColor;
    float level = v_emit * pixel * shimmer * gradient;
    vec3 lit = tint * level;
    // Driven hard, an LED runs white-hot at its core.
    lit = mix(lit, vec3(level), smoothstep(0.9, 1.7, level) * 0.45);
    color = mix(u_bodyColor * 1.6, lit, screen);
  } else {
    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    float edgeLine = 1.0 - smoothstep(0.0, 0.018, min(edge.x, edge.y));
    color = u_bodyColor * (0.7 + 0.3 * normal.y) + (rim * 0.35 + edgeLine * 0.12) * u_fogColor;
  }
  float fog = 1.0 - exp(-dist * u_fogDensity);
  color = mix(color, u_fogColor, fog * 0.85);
  outColor = vec4(color, 1.0);
}`

/**
 * Light from the far end of the corridor: a soft glow at the vanishing point (as if the whole colonnade were scattering into the
 * haze behind it). Drawn behind everything (depth 1, tested against the towers) and additive, so towers and screens occlude it.
 */
const GLOW_VERTEX_SOURCE = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.99999, 1.0);
}`

const GLOW_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_center;
uniform float u_aspect;
uniform float u_strength;
uniform vec3 u_color;
out vec4 outColor;
void main() {
  vec2 d = v_uv - u_center;
  d.x *= u_aspect;
  // A hot core, a wide soft halo, and a tall cone that opens upward like light spilling up the corridor.
  float core = exp(-dot(d, d) / 0.0026);
  float halo = exp(-(d.x * d.x) / 0.045 - (d.y * d.y) / (d.y > 0.0 ? 0.16 : 0.012));
  float cone = exp(-abs(d.x) / (0.04 + max(d.y, 0.0) * 0.55)) * exp(-max(d.y, 0.0) / 0.42) * step(0.0, d.y);
  float glow = core * 0.55 + halo * 0.6 + cone * 0.5;
  outColor = vec4(u_color * glow * u_strength, 1.0);
}`

export interface ThresholdDrawState {
  viewRotation: Float32Array
  projection: Float32Array
  cameraPosition: readonly [number, number, number]
  /** Period offsets (in laps) to draw. */
  laps: readonly number[]
  period: number
  widthScale: number
  intensity: number
  baseLevel: number
  accentBase: number
  fogDensity: number
  primaryColor: readonly [number, number, number]
  accentColor: readonly [number, number, number]
  bodyColor: readonly [number, number, number]
  fogColor: readonly [number, number, number]
  time: number
  /** Per drawn lap: 0 while the camera is before or inside that lap's corridor, rising to 1 once it has passed the last pair (governs the hanging field). */
  fieldVisibility: readonly number[]
  /** Where the corridor's far end lands on screen (0..1) and how strongly it glows (0 outside the corridor). */
  vanishing: { x: number; y: number; strength: number; aspect: number }
  reactive: {
    kick: number; snare: number; beat: number; beatParity: number
    sweepFront: number; sweepStrength: number; drop: number
    energy: number; bass: number; highs: number; vocal: number
    arc: number; level: number; phraseSide: number; breathing: number
  }
}

const UNIFORMS = [
  'u_viewRotation', 'u_projection', 'u_originShift', 'u_widthScale', 'u_intensity', 'u_baseLevel', 'u_accentBase',
  'u_kick', 'u_snare', 'u_beat', 'u_beatParity', 'u_sweepFront', 'u_sweepStrength', 'u_drop', 'u_energy', 'u_bass',
  'u_vocal', 'u_arc', 'u_level', 'u_phraseSide', 'u_breathing', 'u_primaryColor', 'u_accentColor', 'u_bodyColor', 'u_fogColor',
  'u_fogDensity', 'u_highs', 'u_time', 'u_fieldVisibility',
]

/** Instanced unit boxes: geometry and instance data are uploaded once; per-frame state is uniforms only. */
export class ThresholdRenderer {
  private readonly program: ShaderProgram
  private readonly glowProgram: ShaderProgram
  private readonly glowVao: WebGLVertexArrayObject
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly instanceCount: number
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, instances: Float32Array) {
    this.instanceCount = Math.floor(instances.length / THRESHOLD_INSTANCE_FLOATS)
    const compiled = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Threshold/Monoliths',
      vertSrc: VERTEX_SOURCE,
      fragSrc: FRAGMENT_SOURCE,
      optionalUniforms: UNIFORMS,
    })
    if (!compiled.program) throw new Error(`Shader compilation failed at ${compiled.error.stage} for "${compiled.error.label}": ${compiled.error.log}`)
    this.program = compiled.program
    const glow = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Threshold/VanishingGlow',
      vertSrc: GLOW_VERTEX_SOURCE,
      fragSrc: GLOW_FRAGMENT_SOURCE,
      optionalUniforms: ['u_center', 'u_aspect', 'u_strength', 'u_color'],
    })
    if (!glow.program) throw new Error(`Shader compilation failed at ${glow.error.stage} for "${glow.error.label}": ${glow.error.log}`)
    this.glowProgram = glow.program
    const glowVao = gl.createVertexArray()
    if (!glowVao) throw new Error('Cinema 2.0 Threshold could not allocate a vertex array.')
    this.glowVao = glowVao

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Cinema 2.0 Threshold could not allocate a vertex array.')
    this.vao = vao
    gl.bindVertexArray(vao)
    const { vertices, indices } = buildBox()
    const vertexBuffer = this.createBuffer(gl.ARRAY_BUFFER, vertices)
    void vertexBuffer
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24)
    this.createBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
    this.createBuffer(gl.ARRAY_BUFFER, instances)
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, THRESHOLD_INSTANCE_FLOATS * 4, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    assertCinema2NoGlErrors(gl, 'Threshold renderer setup')
  }

  private createBuffer(target: number, data: Float32Array | Uint16Array): WebGLBuffer {
    const { gl } = this
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Cinema 2.0 Threshold could not allocate a buffer.')
    gl.bindBuffer(target, buffer)
    gl.bufferData(target, data as ArrayBufferView<ArrayBuffer>, gl.STATIC_DRAW)
    this.buffers.push(buffer)
    return buffer
  }

  draw(state: Readonly<ThresholdDrawState>): void {
    if (this.disposed || this.instanceCount === 0) return
    const { gl, program } = this
    program.activate()
    program.setMat4('u_viewRotation', state.viewRotation)
    program.setMat4('u_projection', state.projection)
    program.setFloat('u_widthScale', state.widthScale)
    program.setFloat('u_intensity', state.intensity)
    program.setFloat('u_baseLevel', state.baseLevel)
    program.setFloat('u_accentBase', state.accentBase)
    program.setFloat('u_fogDensity', state.fogDensity)
    program.setFloat('u_time', state.time)
    program.setVec3('u_primaryColor', ...state.primaryColor)
    program.setVec3('u_accentColor', ...state.accentColor)
    program.setVec3('u_bodyColor', ...state.bodyColor)
    program.setVec3('u_fogColor', ...state.fogColor)
    const r = state.reactive
    program.setFloat('u_kick', r.kick)
    program.setFloat('u_snare', r.snare)
    program.setFloat('u_beat', r.beat)
    program.setFloat('u_beatParity', r.beatParity)
    program.setFloat('u_sweepFront', r.sweepFront)
    program.setFloat('u_sweepStrength', r.sweepStrength)
    program.setFloat('u_drop', r.drop)
    program.setFloat('u_energy', r.energy)
    program.setFloat('u_bass', r.bass)
    program.setFloat('u_highs', r.highs)
    program.setFloat('u_vocal', r.vocal)
    program.setFloat('u_arc', r.arc)
    program.setFloat('u_level', r.level)
    program.setFloat('u_phraseSide', r.phraseSide)
    program.setFloat('u_breathing', r.breathing)

    if (state.vanishing.strength > 0.001) {
      const glow = this.glowProgram
      glow.activate()
      glow.setVec2('u_center', state.vanishing.x, state.vanishing.y)
      glow.setFloat('u_aspect', state.vanishing.aspect)
      glow.setFloat('u_strength', state.vanishing.strength)
      glow.setVec3('u_color', ...state.fogColor)
      gl.bindVertexArray(this.glowVao)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.depthMask(false)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.depthMask(true)
      gl.disable(gl.BLEND)
      program.activate()
    }
    gl.bindVertexArray(this.vao)
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.BACK)
    for (const [index, lap] of state.laps.entries()) {
      program.setFloat('u_fieldVisibility', state.fieldVisibility[index] ?? 1)
      // World -> camera-relative shift, computed in JS doubles so an endless flight keeps full precision.
      program.setVec3('u_originShift', -state.cameraPosition[0], -state.cameraPosition[1], -lap * state.period - state.cameraPosition[2])
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, this.instanceCount)
    }
    gl.disable(gl.CULL_FACE)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Threshold monolith draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.buffers.length = 0
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteVertexArray(this.glowVao)
    this.glowProgram.dispose()
    this.program.dispose()
  }
}

/** Unit cube centered on the origin. Per vertex: position, normal, face uv (u across the face, v up). */
function buildBox(): { vertices: Float32Array; indices: Uint16Array } {
  // [normal, tangent (u axis), bitangent (v axis)] per face; local +Z is the LED face.
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
  faces.forEach(([n, t, b], faceIndex) => {
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]] as const) {
      const su = u - 0.5
      const sv = v - 0.5
      vertices.push(
        n[0] * 0.5 + t[0] * su + b[0] * sv,
        n[1] * 0.5 + t[1] * su + b[1] * sv,
        n[2] * 0.5 + t[2] * su + b[2] * sv,
        n[0], n[1], n[2], u, v,
      )
    }
    const base = faceIndex * 4
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) }
}

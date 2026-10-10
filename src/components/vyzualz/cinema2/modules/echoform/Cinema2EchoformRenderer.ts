import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../../scene/Cinema2SceneGraph'
import { buildCinema2EchoformGeometry, ECHOFORM_VERTEX_FLOATS, type Cinema2EchoformGeometryOptions } from './Cinema2EchoformGeometry'
import type { Cinema2MainframeLightingFrame } from '../mainframe/Cinema2MainframePatternEngine'

/** The shared Mainframe lighting frame (already adapted for this figure) and how strongly it drives the figure. */
export interface Cinema2EchoformOrchestration {
  readonly strength: number
  readonly frame: Readonly<Cinema2MainframeLightingFrame>
}

/** Which of the preset's figures is showing and how assembled its particles are (1 formed, 0 dispersed into dust). */
export interface Cinema2EchoformMorph {
  readonly figure: 0 | 1
  readonly assemble: number
}

export interface Cinema2EchoformDrawState {
  /** Null for a single-figure preset; otherwise the figure to draw and its assembly. */
  readonly morph: Cinema2EchoformMorph | null
  /** Mainframe's geometry-aware musical orchestration; null while nothing is playing. */
  readonly orchestration: Cinema2EchoformOrchestration | null
  readonly modelMatrix: Cinema2Matrix4
  readonly viewProjectionMatrix: Cinema2Matrix4
  readonly reconstruction: number
  /** 0..1 position in the dissolve cycle: ignite, magenta bloom, blue shell, outline, black. */
  readonly phase: number
  /** Musical position in beats: drives the outward and inward waves. */
  readonly waveBeats: number
  /** 0..1.5 crest strength; bass raises it. */
  readonly waveGain: number
  readonly fragmentation: number
  readonly pointDensity: number
  readonly pointSize: number
  readonly shellCount: number
  readonly shellSeparation: number
  readonly yawRadians: number
  readonly scale: number
  readonly pulse: number
  readonly sparkle: number
  readonly scatter: number
  readonly seed: number
  readonly background: Cinema2Color
  readonly shadow: Cinema2Color
  readonly metal: Cinema2Color
  readonly highlight: Cinema2Color
  readonly eye: Cinema2Color
  readonly accent: Cinema2Color
}

// Kinds (see Cinema2EchoformGeometry): 0 contour, 1 fill, 2 wire, 3 halo, 4 eye, 5 node.
const COMMON_VERTEX = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_data; // tone, random, order, kind
layout(location = 2) in vec4 a_meta; // route, bank, region, system
layout(location = 3) in float a_phase;
uniform mat4 u_model;
uniform mat4 u_viewProjection;
uniform float u_yaw;
uniform float u_scale;
uniform float u_depth;
uniform float u_reconstruction;
uniform float u_phase;
uniform float u_waveBeats;
uniform float u_waveGain;
// Mainframe orchestration (same meaning as the Mainframe circuit shader's uniforms).
uniform float u_orchestration;
uniform float u_assemble;
uniform vec4 u_circuit;      // energy, accent, pulse, mode (0 bus, 1 banks, 2 regions, 3 sweep, 4 surge)
uniform vec4 u_state0;       // beats, level, chaseFront, chaseWidth
uniform vec4 u_state1;       // chaseGain, chaseDirection, flicker, 1
uniform vec4 u_section;      // mode, progress, confidence, phraseProgress
uniform vec4 u_banks;
uniform vec4 u_regions0;
uniform vec4 u_regions1;
uniform vec4 u_systems0;
uniform vec4 u_systems1;
uniform vec4 u_systems2;
uniform vec4 u_pulseFront;
uniform vec4 u_pulseWidth;
uniform vec4 u_pulseGain;
uniform vec4 u_pulseDirection;
uniform vec4 u_pulseGroup;
uniform float u_fragmentation;
uniform float u_density;
uniform float u_pointSize;
uniform float u_pixelScale;
uniform float u_pulse;
uniform float u_sparkle;
uniform float u_scatter;
uniform float u_seed;
uniform vec4 u_shadow;
uniform vec4 u_metal;
uniform vec4 u_highlight;
uniform vec4 u_eye;
uniform vec4 u_accent;
out vec4 v_color;

float pick4(vec4 values, float index) {
  return index < 0.5 ? values.x : (index < 1.5 ? values.y : (index < 2.5 ? values.z : values.w));
}

// The light Mainframe's programs would put on a circuit vertex with this route, bank, region, system and phase.
float orchestrationLight(float route, float bank, float region, float system, float phase) {
  float bankLight = bank < -0.5 ? 0.0 : pick4(u_banks, bank);
  float regionLight = region < -0.5 ? 0.0 : (region < 3.5 ? pick4(u_regions0, region) : pick4(u_regions1, region - 4.0));
  float travel = u_state1.y > 0.0 ? phase : 1.0 - phase;
  float distanceToFront = (travel - u_state0.z) / max(0.025, u_state0.w);
  float systemLight = system < 3.5 ? pick4(u_systems0, system) : (system < 7.5 ? pick4(u_systems1, system - 4.0) : u_systems2.x);
  systemLight = pow(clamp(systemLight, 0.0, 1.0), 1.25);
  float mode = u_circuit.w;
  float selection = 1.0;
  if (mode > 0.5 && mode < 1.5) selection = 0.08 + 0.92 * bankLight;
  else if (mode > 1.5 && mode < 2.5) selection = 0.07 + 0.93 * regionLight;
  else if (mode > 3.5) selection = 0.12 + 0.88 * regionLight;
  else if (mode > 2.5) selection = 0.36;
  float sectionMode = u_section.x;
  float sectionAuthority = smoothstep(0.35, 0.78, u_section.z);
  float sectionGroup = mod(floor(max(0.0, route)), 4.0);
  float phraseGroup = floor(clamp(u_section.w, 0.0, 0.999) * 4.0);
  float localGroup = 1.0 - step(0.5, abs(sectionGroup - phraseGroup));
  float sectionSelection = 1.0;
  if (sectionMode > 0.5 && sectionMode < 1.5) sectionSelection = 0.32 + 0.68 * localGroup;
  else if (sectionMode > 1.5 && sectionMode < 2.5) {
    float activeGroups = 1.0 + floor(clamp(u_section.y, 0.0, 0.999) * 4.0);
    sectionSelection = sectionGroup < activeGroups ? 1.0 : 0.2;
  } else if (sectionMode > 2.5 && sectionMode < 3.5) sectionSelection = 0.14 + 0.86 * localGroup;
  selection *= mix(1.0, sectionSelection, sectionAuthority);
  float tailDistance = (travel - (u_state0.z - u_state0.w * 1.3)) / max(0.045, u_state0.w * 2.5);
  float trail = exp(-tailDistance * tailDistance);
  float independentPulse = 0.0;
  for (int pulseIndex = 0; pulseIndex < 4; pulseIndex++) {
    float index = float(pulseIndex);
    float pulseTravel = pick4(u_pulseDirection, index) > 0.0 ? phase : 1.0 - phase;
    float pulseDistance = (pulseTravel - pick4(u_pulseFront, index)) / max(0.025, pick4(u_pulseWidth, index));
    float pulseGroup = pick4(u_pulseGroup, index);
    float routeModulo = mod(floor(max(0.0, route)), 8.0);
    float groupDistance = abs(routeModulo - pulseGroup);
    groupDistance = min(groupDistance, 8.0 - groupDistance);
    float routeGate = pulseGroup < -0.5 ? 0.72 + 0.28 * step(0.5, systemLight) : (groupDistance < 0.5 ? 1.0 : (groupDistance < 1.5 ? 0.2 : 0.0));
    independentPulse += exp(-pulseDistance * pulseDistance) * pick4(u_pulseGain, index) * routeGate;
  }
  float moving = (5.0 * exp(-distanceToFront * distanceToFront) + 1.1 * trail) * u_state1.x * u_circuit.z * selection
    * (0.75 + 0.5 * sqrt(clamp(u_state0.y, 0.0, 1.0)));
  moving += 5.2 * independentPulse * selection;
  float powered = (0.08 + 2.2 * u_circuit.x + 1.1 * u_circuit.y + 0.65 * systemLight) * selection;
  return 0.035 + powered + moving;
}

float hash11(float n) { return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453); }

void main() {
  float tone = a_data.x;
  float rand = a_data.y;
  float order = a_data.z;
  float kind = a_data.w;
  float reveal = clamp(u_reconstruction + u_pulse * 0.1 - u_fragmentation * 0.3, 0.0, 1.0);
  float present = 1.0 - smoothstep(reveal - 0.07, reveal + 0.02, order);
  // Thin the stipple with the density control; contours, wire and eyes always survive.
  float keep = (kind == 1.0 || kind == 3.0 || kind == 5.0) ? step(rand, u_density) : 1.0;

  vec3 local = a_position * vec3(u_scale, u_scale, u_scale * (0.6 + u_depth));
  // Scatter: kicks fling points off the figure along their own random direction.
  vec3 dir = vec3(hash11(rand * 91.0 + 1.0), hash11(rand * 91.0 + 2.0), hash11(rand * 91.0 + 3.0)) - 0.5;
  local += dir * u_scatter * 0.16 * (0.3 + rand);
  // Dispersal: as the figure comes apart each particle drifts out along its own path and swirls, and the same motion in reverse is how it merges.
  float loose = pow(1.0 - clamp(u_assemble, 0.0, 1.0), 1.6);
  if (loose > 0.0) {
    vec3 away = normalize(vec3(hash11(rand * 53.0 + 4.0), hash11(rand * 53.0 + 5.0), hash11(rand * 53.0 + 6.0)) - 0.5 + 0.0001);
    float swirl = (hash11(rand * 53.0 + 7.0) - 0.5) * 2.4 * loose;
    float sw = sin(swirl);
    float cw = cos(swirl);
    local = vec3(cw * local.x - sw * local.y, sw * local.x + cw * local.y, local.z);
    local += away * loose * (0.35 + 1.25 * hash11(rand * 53.0 + 8.0));
  }
  float c = cos(u_yaw);
  float s = sin(u_yaw);
  local = vec3(c * local.x + s * local.z, local.y, -s * local.x + c * local.z);
  gl_Position = u_viewProjection * u_model * vec4(local, 1.0);

  // The reference's sequence: the focal feature ignites out of black, a magenta mass swells through the dark parts,
  // the blue wire shell crystallises around it while the magenta recedes, then only the outline is left before black.
  float p = u_phase;
  float ignite = smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.58, 0.72, p));
  float magenta = smoothstep(0.08, 0.3, p) * (1.0 - smoothstep(0.46, 0.66, p));
  float blueShell = smoothstep(0.24, 0.46, p) * (1.0 - smoothstep(0.68, 0.88, p));
  float outline = smoothstep(0.18, 0.4, p) * (1.0 - smoothstep(0.9, 0.99, p));
  float halo = smoothstep(0.05, 0.25, p) * (1.0 - smoothstep(0.5, 0.75, p));
  bool outer = order > 0.2;

  // Colour by tone: dark shapes carry magenta, mid tones blue, bright rims cyan-white; eyes are the focal cyan.
  vec3 base = mix(u_metal.rgb, u_highlight.rgb, smoothstep(0.7, 1.0, tone));
  vec3 color = base;
  float brightness = 1.0;
  if (kind == 1.0) {
    float dark = 1.0 - smoothstep(0.08, 0.3, tone);
    color = mix(u_shadow.rgb, base, 1.0 - dark);
    float lit = 0.35 + 1.25 * smoothstep(0.1, 0.75, tone);
    brightness = mix(lit * (0.25 + 0.75 * blueShell), 0.2 + 1.5 * magenta, dark);
  } else if (kind == 0.0) {
    color = mix(base, u_accent.rgb, 0.2 * step(0.85, rand));
    float envelope = outer ? max(outline, blueShell * 0.6) : blueShell;
    brightness = (0.7 + 0.9 * smoothstep(0.1, 0.8, tone)) * (0.15 + 0.85 * envelope);
  } else if (kind == 2.0) {
    color = mix(u_metal.rgb, u_highlight.rgb, 0.15 + 0.35 * tone);
    color = mix(color, u_accent.rgb, 0.12 * rand);
    brightness = (0.22 + 0.3 * tone) * (0.1 + 0.9 * blueShell);
  } else if (kind == 3.0) {
    color = mix(u_metal.rgb, u_highlight.rgb, rand * 0.6);
    brightness = 0.2 + 0.7 * halo;
  } else if (kind == 4.0) {
    color = u_eye.rgb;
    brightness = (0.35 + 1.0 * ignite) + 0.4 * u_pulse;
  } else if (kind == 5.0) {
    color = u_highlight.rgb;
    brightness = 0.3 + 1.0 * blueShell;
  }
  // Waves: crests travel outward from the middle of the figure and others travel back in; wherever a crest
  // passes, points and wire flare brighter, shift toward cyan-white and swell slightly.
  float reach = length(a_position.xy * vec2(1.0, 0.92) - vec2(0.0, 0.06));
  float outCrest = fract(u_waveBeats * 0.25) * 1.5 - 0.1;
  float inCrest = 1.4 - fract(u_waveBeats * 0.25 + 0.5) * 1.5;
  float waveOut = exp(-pow((reach - outCrest) / 0.06, 2.0));
  float waveIn = exp(-pow((reach - inCrest) / 0.05, 2.0)) * 0.8;
  float crest = clamp(waveOut + waveIn, 0.0, 1.0) * u_waveGain;
  brightness *= 1.0 + 1.5 * crest;
  color = mix(color, u_highlight.rgb, clamp(crest * 0.45, 0.0, 0.5));
  // Mainframe orchestration: where its programs would put light on this part of the figure, the figure lights.
  if (u_orchestration > 0.0 && kind != 3.0) {
    float light = orchestrationLight(a_meta.x, a_meta.y, a_meta.z, a_meta.w, a_phase);
    float orchestrated = clamp(light / 3.0, 0.0, 1.8);
    brightness *= mix(1.0, 0.1 + pow(orchestrated, 1.35) * 1.9, clamp(u_orchestration, 0.0, 1.0));
    color = mix(color, u_highlight.rgb, clamp(orchestrated - 1.0, 0.0, 1.0) * 0.5 * u_orchestration);
  }
  float twinkle = 0.7 + 0.3 * step(0.55, fract(rand * 17.0 + u_seed * 3.0)) + u_sparkle * step(0.9, rand);
  float alpha = present * keep * brightness * twinkle * (0.2 + 0.8 * clamp(u_assemble, 0.0, 1.0));
  v_color = vec4(color * alpha, alpha);
  float size = kind == 4.0 ? 3.4 : (kind == 5.0 ? 3.0 : (kind == 3.0 ? 1.4 : (kind == 1.0 ? 3.2 : 2.6)));
  gl_PointSize = max(1.0, size * (1.0 + 0.35 * crest) * (0.6 + rand * 0.8) * (u_pointSize / 0.24) * u_pixelScale);
}`

const POINT_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float falloff = 1.0 - smoothstep(0.28, 0.5, length(p));
  outColor = vec4(v_color.rgb * falloff, v_color.a * falloff);
}`

const LINE_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
void main() {
  outColor = vec4(v_color.rgb, v_color.a);
}`

export function getCinema2EchoformShaderProgramSources(): readonly Readonly<{
  label: string
  vertSrc: string
  fragSrc: string
}>[] {
  return Object.freeze([
    Object.freeze({ label: 'echoform-point-cloud', vertSrc: COMMON_VERTEX, fragSrc: POINT_FRAGMENT }),
    Object.freeze({ label: 'echoform-wire-mesh', vertSrc: COMMON_VERTEX, fragSrc: LINE_FRAGMENT }),
  ])
}

interface GpuBatch {
  readonly vao: WebGLVertexArrayObject
  readonly buffer: WebGLBuffer
  readonly count: number
}

export class Cinema2EchoformRenderer {
  private readonly pointProgram: WebGLProgram
  private readonly lineProgram: WebGLProgram
  private readonly points: GpuBatch
  private readonly lines: GpuBatch
  private readonly secondaryPoints: GpuBatch | null
  private readonly secondaryLines: GpuBatch | null
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>()
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    svgSource: string,
    geometryOptions: Cinema2EchoformGeometryOptions = {},
    secondary: Readonly<{ svgSource: string; geometry?: Cinema2EchoformGeometryOptions }> | null = null,
  ) {
    const geometry = buildCinema2EchoformGeometry(svgSource, geometryOptions)
    this.pointProgram = createProgram(gl, COMMON_VERTEX, POINT_FRAGMENT)
    this.lineProgram = createProgram(gl, COMMON_VERTEX, LINE_FRAGMENT)
    this.points = createBatch(gl, geometry.points, geometry.pointCount)
    this.lines = createBatch(gl, geometry.lines, geometry.lineVertexCount)
    const other = secondary ? buildCinema2EchoformGeometry(secondary.svgSource, secondary.geometry ?? {}) : null
    this.secondaryPoints = other ? createBatch(gl, other.points, other.pointCount) : null
    this.secondaryLines = other ? createBatch(gl, other.lines, other.lineVertexCount) : null
  }

  draw(state: Readonly<Cinema2EchoformDrawState>): void {
    if (this.disposed) return
    const gl = this.gl
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    const second = state.morph?.figure === 1 && this.secondaryPoints && this.secondaryLines
    this.drawBatch(this.lineProgram, second ? this.secondaryLines! : this.lines, gl.LINES, state)
    this.drawBatch(this.pointProgram, second ? this.secondaryPoints! : this.points, gl.POINTS, state)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(null)
  }

  private drawBatch(program: WebGLProgram, batch: GpuBatch, mode: number, state: Readonly<Cinema2EchoformDrawState>): void {
    if (batch.count === 0) return
    const gl = this.gl
    gl.useProgram(program)
    this.uniforms.clear()
    gl.bindVertexArray(batch.vao)
    gl.uniformMatrix4fv(this.location(program, 'u_model'), false, new Float32Array(state.modelMatrix))
    gl.uniformMatrix4fv(this.location(program, 'u_viewProjection'), false, new Float32Array(state.viewProjectionMatrix))
    gl.uniform1f(this.location(program, 'u_yaw'), state.yawRadians)
    gl.uniform1f(this.location(program, 'u_scale'), state.scale)
    // Shell separation now spreads the figure's real depth layers.
    gl.uniform1f(this.location(program, 'u_depth'), Math.max(0, Math.min(1.5, state.shellSeparation)))
    gl.uniform1f(this.location(program, 'u_reconstruction'), state.reconstruction)
    gl.uniform1f(this.location(program, 'u_phase'), state.phase)
    gl.uniform1f(this.location(program, 'u_assemble'), state.morph ? state.morph.assemble : 1)
    gl.uniform1f(this.location(program, 'u_waveBeats'), state.waveBeats)
    gl.uniform1f(this.location(program, 'u_waveGain'), state.waveGain)
    gl.uniform1f(this.location(program, 'u_fragmentation'), state.fragmentation)
    gl.uniform1f(this.location(program, 'u_density'), Math.max(0.1, Math.min(1.2, state.pointDensity / 96)))
    gl.uniform1f(this.location(program, 'u_pointSize'), state.pointSize)
    gl.uniform1f(this.location(program, 'u_pixelScale'), Math.max(0.5, gl.drawingBufferHeight / 900))
    gl.uniform1f(this.location(program, 'u_pulse'), state.pulse)
    gl.uniform1f(this.location(program, 'u_sparkle'), state.sparkle)
    gl.uniform1f(this.location(program, 'u_scatter'), state.scatter)
    gl.uniform1f(this.location(program, 'u_seed'), state.seed)
    this.uploadOrchestration(program, state.orchestration)
    color(gl, this.location(program, 'u_shadow'), state.shadow)
    color(gl, this.location(program, 'u_metal'), state.metal)
    color(gl, this.location(program, 'u_highlight'), state.highlight)
    color(gl, this.location(program, 'u_eye'), state.eye)
    color(gl, this.location(program, 'u_accent'), state.accent)
    gl.drawArrays(mode, 0, batch.count)
  }

  private uploadOrchestration(program: WebGLProgram, orchestration: Cinema2EchoformOrchestration | null): void {
    const gl = this.gl
    const u = (name: string) => this.location(program, name)
    if (!orchestration || !orchestration.frame.active) {
      gl.uniform1f(u('u_orchestration'), 0)
      return
    }
    const { frame, strength } = orchestration
    const mode = frame.pattern === 'bank-alternator' ? 1 : frame.pattern === 'quadrant-relay' ? 2 : frame.pattern === 'radar-sweep' ? 3 : frame.pattern === 'system-surge' ? 4 : 0
    const pulses = frame.routePulses
    gl.uniform1f(u('u_orchestration'), strength)
    gl.uniform4f(u('u_circuit'), frame.circuitEnergy, frame.circuitAccent, frame.circuitPulse, mode)
    gl.uniform4f(u('u_state0'), frame.beats % 4096, frame.level, frame.chaseFront, frame.chaseWidth)
    gl.uniform4f(u('u_state1'), frame.chaseGain, frame.chaseDirection, frame.flicker, 1)
    gl.uniform4f(u('u_section'), frame.sectionMode, frame.sectionProgress, frame.sectionConfidence, frame.phraseProgress)
    gl.uniform4f(u('u_banks'), frame.bankWeights[0], frame.bankWeights[1], frame.bankWeights[2], frame.bankWeights[3])
    gl.uniform4f(u('u_regions0'), frame.regionWeights[0], frame.regionWeights[1], frame.regionWeights[2], frame.regionWeights[3])
    gl.uniform4f(u('u_regions1'), frame.regionWeights[4], frame.regionWeights[5], frame.regionWeights[6], frame.regionWeights[7])
    gl.uniform4f(u('u_systems0'), frame.systemGains[0], frame.systemGains[1], frame.systemGains[2], frame.systemGains[3])
    gl.uniform4f(u('u_systems1'), frame.systemGains[4], frame.systemGains[5], frame.systemGains[6], frame.systemGains[7])
    gl.uniform4f(u('u_systems2'), frame.systemGains[8], 0, 0, 0)
    gl.uniform4f(u('u_pulseFront'), pulses[0].front, pulses[1].front, pulses[2].front, pulses[3].front)
    gl.uniform4f(u('u_pulseWidth'), pulses[0].width, pulses[1].width, pulses[2].width, pulses[3].width)
    gl.uniform4f(u('u_pulseGain'), pulses[0].gain, pulses[1].gain, pulses[2].gain, pulses[3].gain)
    gl.uniform4f(u('u_pulseDirection'), pulses[0].direction, pulses[1].direction, pulses[2].direction, pulses[3].direction)
    gl.uniform4f(u('u_pulseGroup'), pulses[0].routeGroup, pulses[1].routeGroup, pulses[2].routeGroup, pulses[3].routeGroup)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const batch of [this.points, this.lines, ...(this.secondaryPoints ? [this.secondaryPoints] : []), ...(this.secondaryLines ? [this.secondaryLines] : [])]) {
      this.gl.deleteBuffer(batch.buffer)
      this.gl.deleteVertexArray(batch.vao)
    }
    this.gl.deleteProgram(this.pointProgram)
    this.gl.deleteProgram(this.lineProgram)
  }

  getSnapshot(): Readonly<{ ready: boolean; disposed: boolean; points: number; lineVertices: number }> {
    return Object.freeze({ ready: !this.disposed, disposed: this.disposed, points: this.points.count, lineVertices: this.lines.count })
  }

  private location(program: WebGLProgram, name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(program, name))
    return this.uniforms.get(name) ?? null
  }
}

function createBatch(gl: WebGL2RenderingContext, data: Float32Array, count: number): GpuBatch {
  const vao = gl.createVertexArray()
  const buffer = gl.createBuffer()
  if (!vao || !buffer) throw new Error('Cinema 2.0 Echoform could not allocate GPU resources.')
  gl.bindVertexArray(vao)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  const stride = ECHOFORM_VERTEX_FLOATS * 4
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 12)
  gl.enableVertexAttribArray(2)
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 28)
  gl.enableVertexAttribArray(3)
  gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 44)
  gl.bindVertexArray(null)
  return { vao, buffer, count }
}

function color(gl: WebGL2RenderingContext, location: WebGLUniformLocation | null, value: Cinema2Color): void {
  gl.uniform4f(location, value[0], value[1], value[2], value[3])
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) throw new Error('Cinema 2.0 Echoform could not allocate a shader program.')
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error'
    gl.deleteProgram(program)
    throw new Error(`Cinema 2.0 Echoform shader link failed: ${log}`)
  }
  return program
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema 2.0 Echoform could not allocate a shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error'
    gl.deleteShader(shader)
    throw new Error(`Cinema 2.0 Echoform shader compilation failed: ${log}`)
  }
  return shader
}

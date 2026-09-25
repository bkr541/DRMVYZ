import { ShaderCompiler } from '../../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../../react/shaders/runtime/ShaderProgram'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import {
  THRESHOLD_HOUSING_WINDOW,
  THRESHOLD_INSTANCE_FLOATS,
  THRESHOLD_PUFF_FLOATS,
  visibleThresholdRanges,
  type ThresholdChunk,
} from './Cinema2ThresholdLayout'

/**
 * The music-driven emission of one screen row, shared by the tower shader and the smoke billboards (which are lit by the screen they sit in
 * front of). Roles: 2 = accent, anything else above 0.5 = primary.
 */
const EMISSION_GLSL = `
uniform float u_baseLevel;
uniform float u_accentBase;
uniform float u_kick;
uniform float u_snare;
uniform float u_beat;
uniform float u_beatParity;
uniform float u_sweepFront;
uniform float u_sweepStrength;
uniform float u_drop;
uniform float u_bass;
uniform float u_vocal;
uniform float u_arc;
uniform float u_level;
uniform float u_phraseSide;
uniform float u_breathing;

float towerEmission(float role, float row, float rank, float side, float ahead) {
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
  else if (role > 0.5) emit = primary + sweep * 1.3 + u_drop;
  return emit;
}`

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
uniform float u_energy;
uniform float u_tier;
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
${EMISSION_GLSL}

mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  // Detail above the current quality tier is moved off screen (its vertices still run, but there are only a few hundred).
  if (i3.z > u_tier + 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
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
  // Screens, housings and bezels of a row share the row's emission (see towerEmission); roles 1, 3 and 4 use the primary, role 2 the accent.
  float emit = towerEmission(role, row, rank, side, ahead);
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

/**
 * Depth-only variant of the instanced vertex stage, used to render the towers into the engine shadow map (roadmap #10). It mirrors the
 * main pass exactly (corridor width shift, camera-relative placement, field/ring dissolve) so a piece that is not drawn does not cast.
 */
const SHADOW_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 3) in vec4 i0;
layout(location = 4) in vec4 i1;
layout(location = 5) in vec4 i2;
layout(location = 6) in vec4 i3;
uniform mat4 u_lightViewProj;
uniform vec3 u_originShift;
uniform float u_widthScale;
uniform float u_fieldVisibility;
uniform float u_tier;

mat3 rotY(float a) { float c = cos(a); float s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a); float s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a); float s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  if (i3.z > u_tier + 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 size = vec3(i0.w, i1.x, i1.y);
  mat3 rotation = rotY(i1.z) * rotX(i1.w) * rotZ(i2.x);
  float zone = i3.y;
  vec3 center = i0.xyz;
  center.x += sign(center.x) * 26.0 * (u_widthScale - 1.0) * step(zone, 0.5);
  float ahead = max(-(center.z + u_originShift.z), 0.0);
  float fade = zone > 0.5 ? smoothstep(118.0, 96.0, ahead) * (zone < 1.5 ? u_fieldVisibility : 1.0) : 1.0;
  if (fade < 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  gl_Position = u_lightViewProj * vec4(center + rotation * (a_position * size) + u_originShift, 1.0);
}`

const SHADOW_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() { outColor = vec4(0.0); }`


/**
 * Ground smoke: camera-facing billboards of soft puffs at the tower bases. They are lit by the screen row they sit in front of (the same
 * music-driven emission as the towers), faded near the camera, near the housing walls and with distance, drawn back to front with
 * premultiplied alpha, and write depth where they are dense so the floor reflection and the haze see them instead of painting over them.
 */
const SMOKE_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 p0;
layout(location = 2) in vec4 p1;
layout(location = 3) in vec4 p2;
uniform mat4 u_viewRotation;
uniform mat4 u_projection;
uniform vec3 u_originShift;
uniform vec3 u_cameraPosition;
uniform float u_widthScale;
uniform float u_tier;
uniform float u_time;
uniform float u_intensity;
uniform float u_smokeAmount;
uniform float u_fogDensity;
out vec2 v_uv;
out float v_cell;
out float v_alpha;
out float v_emit;
out float v_worldX;
out float v_dist;
out float v_ahead;
${EMISSION_GLSL}

void main() {
  if (p2.w > u_tier + 0.5 || u_smokeAmount <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec3 center = p0.xyz;
  // The aisle widens or narrows with Corridor Width, and the smoke follows its towers.
  center.x += sign(center.x) * 26.0 * (u_widthScale - 1.0);
  float bob = sin(u_time * 0.35 + p1.y * 6.2831) * 0.35;
  float breathe = 1.0 + 0.1 * u_bass + 0.04 * sin(u_time * 0.5 + p1.y * 9.0);
  vec3 relative = center + u_originShift + vec3(0.0, bob, 0.0);
  float size = p0.w * breathe;
  vec3 right = vec3(u_viewRotation[0][0], u_viewRotation[1][0], u_viewRotation[2][0]);
  vec3 up = vec3(u_viewRotation[0][1], u_viewRotation[1][1], u_viewRotation[2][1]);
  vec3 position = relative + right * (a_corner.x * size) + up * (a_corner.y * size * p1.x);
  gl_Position = u_projection * (u_viewRotation * vec4(position, 1.0));
  float angle = p1.y * 6.2831 + u_time * p1.z;
  vec2 c = a_corner;
  v_uv = vec2(cos(angle) * c.x - sin(angle) * c.y, sin(angle) * c.x + cos(angle) * c.y) + 0.5;
  v_cell = floor(p1.y * 3.999);
  float ahead = max(-(center.z + u_originShift.z), 0.0);
  v_emit = min(towerEmission(1.0, p2.x, p2.y, p2.z, ahead) * u_intensity, 1.5);
  v_dist = length(relative);
  v_ahead = ahead;
  // Absolute x of this corner (the camera stays near the aisle centre, so float precision is no concern for x).
  v_worldX = position.x + u_cameraPosition.x;
  v_alpha = p1.w * u_smokeAmount * smoothstep(2.5, 13.0, v_dist) * (1.0 - smoothstep(55.0, 100.0, ahead));
}`

const SMOKE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_cell;
in float v_alpha;
in float v_emit;
in float v_worldX;
in float v_dist;
in float v_ahead;
uniform sampler2D u_sprites;
uniform float u_glow;
uniform vec3 u_fogColor;
uniform vec3 u_primaryColor;
uniform float u_fogDensity;
uniform float u_wallX;
uniform float u_depthPass;
uniform float u_density;
out vec4 outColor;

void main() {
  vec2 cell = vec2(mod(v_cell, 2.0), floor(v_cell / 2.0)) * 0.5;
  vec2 uv = clamp(v_uv, 0.0, 1.0);
  vec4 sprite = texture(u_sprites, cell + uv * 0.5);
  // Smoke thins out toward the housing walls instead of cutting off against them.
  float wall = smoothstep(0.0, 5.0, u_wallX - abs(v_worldX));
  float alpha = sprite.a * v_alpha * wall * exp(-v_dist * u_fogDensity * 0.3);
  // Two passes: colour (blended, no depth write) and then depth only for the dense core, so the floor can occlude smoke that is below it and
  // the reflections see the core, while thin smoke leaves the haze behind it untouched.
  if (u_depthPass > 0.5) {
    if (alpha < 0.7) discard;
    outColor = vec4(0.0);
    return;
  }
  if (alpha < 0.02) discard;
  alpha *= u_density;
  // Lit fog: as bright as the haze around it (so its thin edges do not read as dark holes), lifted by the screen it sits in front of.
  vec3 color = (u_fogColor * 2.6 + u_primaryColor * v_emit * 0.1) * (0.55 + 0.6 * sprite.rgb);
  // The haze pass stops at the smoke's depth, so the haze that would have accumulated behind it is missing: brighten with distance to make up for it.
  color *= 1.0 + 1.6 * smoothstep(15.0, 80.0, v_ahead);
  // Toward the far end the smoke is backlit by the vanishing-point glow instead of standing dark against it.
  color += u_fogColor * 2.2 * u_glow * smoothstep(50.0, 170.0, v_ahead) * sprite.rgb;
  outColor = vec4(color * alpha, alpha);
}`

export interface ThresholdShadowDrawState {
  /** World -> light clip space, already translated to camera-relative coordinates (`world = relative + camera`). */
  lightViewProjection: Float32Array
  laps: readonly number[]
  period: number
  cameraPosition: readonly [number, number, number]
  widthScale: number
  fieldVisibility: readonly number[]
  /** Quality tier (0 low, 1 medium, 2 high): instances above it are skipped. */
  tier: number
  /** Chunks farther than this from the camera (or further behind it than `cullMargin`) are not drawn into the map. */
  viewFar: number
  cullMargin: number
}

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
  /** Quality tier (0 low, 1 medium, 2 high): instances above it are skipped. */
  tier: number
  /** View distance (the camera far plane) and how far behind the camera a chunk may still be drawn (its shadow can reach in). */
  viewFar: number
  cullMargin: number
  /** Ground smoke: the sprite sheet (null until it has loaded) and its fade-in amount 0..1. */
  smoke: { texture: WebGLTexture | null; amount: number; wallX: number }
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
  'u_fogDensity', 'u_highs', 'u_time', 'u_fieldVisibility', 'u_tier',
]

/** Instanced unit boxes: geometry and instance data are uploaded once; per-frame state is uniforms only. */
export class ThresholdRenderer {
  private readonly program: ShaderProgram
  private readonly glowProgram: ShaderProgram
  private readonly shadowProgram: ShaderProgram
  private readonly glowVao: WebGLVertexArrayObject
  private readonly vao: WebGLVertexArrayObject
  private readonly buffers: WebGLBuffer[] = []
  private readonly instanceCount: number
  private readonly instanceBuffer: WebGLBuffer
  private readonly chunks: readonly ThresholdChunk[]
  private readonly smokeProgram: ShaderProgram
  private readonly smokeVao: WebGLVertexArrayObject
  private readonly puffCount: number
  private boundStart = 0
  private stats = { boxesDrawn: 0, puffsDrawn: 0, shadowBoxesDrawn: 0 }
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    instances: Float32Array,
    options: Readonly<{ chunks?: readonly ThresholdChunk[]; puffs?: Float32Array }> = {},
  ) {
    this.instanceCount = Math.floor(instances.length / THRESHOLD_INSTANCE_FLOATS)
    this.chunks = options.chunks ?? Object.freeze([{ start: 0, count: this.instanceCount, zMin: -Infinity, zMax: Infinity }])
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
    const shadow = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Threshold/ShadowCaster',
      vertSrc: SHADOW_VERTEX_SOURCE,
      fragSrc: SHADOW_FRAGMENT_SOURCE,
      optionalUniforms: ['u_lightViewProj', 'u_originShift', 'u_widthScale', 'u_fieldVisibility'],
    })
    if (!shadow.program) throw new Error(`Shader compilation failed at ${shadow.error.stage} for "${shadow.error.label}": ${shadow.error.log}`)
    this.shadowProgram = shadow.program
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
    this.instanceBuffer = this.createBuffer(gl.ARRAY_BUFFER, instances)
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.enableVertexAttribArray(3 + attribute)
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, THRESHOLD_INSTANCE_FLOATS * 4, attribute * 16)
      gl.vertexAttribDivisor(3 + attribute, 1)
    }
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    // Ground-smoke billboards: one unit quad plus a static instance buffer (three vec4s per puff).
    const smoke = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: 'Cinema2/Threshold/GroundSmoke',
      vertSrc: SMOKE_VERTEX_SOURCE,
      fragSrc: SMOKE_FRAGMENT_SOURCE,
      optionalUniforms: [
        'u_viewRotation', 'u_projection', 'u_originShift', 'u_cameraPosition', 'u_widthScale', 'u_tier', 'u_time', 'u_intensity', 'u_smokeAmount',
        'u_fogDensity', 'u_sprites', 'u_fogColor', 'u_primaryColor', 'u_wallX', 'u_glow', 'u_depthPass', 'u_density',
        'u_baseLevel', 'u_accentBase', 'u_kick', 'u_snare', 'u_beat', 'u_beatParity', 'u_sweepFront', 'u_sweepStrength', 'u_drop', 'u_bass',
        'u_vocal', 'u_arc', 'u_level', 'u_phraseSide', 'u_breathing',
      ],
    })
    if (!smoke.program) throw new Error(`Shader compilation failed at ${smoke.error.stage} for "${smoke.error.label}": ${smoke.error.log}`)
    this.smokeProgram = smoke.program
    const puffs = options.puffs ?? new Float32Array(0)
    this.puffCount = Math.floor(puffs.length / THRESHOLD_PUFF_FLOATS)
    const smokeVao = gl.createVertexArray()
    if (!smokeVao) throw new Error('Cinema 2.0 Threshold could not allocate a vertex array.')
    this.smokeVao = smokeVao
    gl.bindVertexArray(smokeVao)
    this.createBuffer(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5]))
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)
    this.createBuffer(gl.ARRAY_BUFFER, puffs.length > 0 ? puffs : new Float32Array(THRESHOLD_PUFF_FLOATS))
    for (let attribute = 0; attribute < 3; attribute += 1) {
      gl.enableVertexAttribArray(1 + attribute)
      gl.vertexAttribPointer(1 + attribute, 4, gl.FLOAT, false, THRESHOLD_PUFF_FLOATS * 4, attribute * 16)
      gl.vertexAttribDivisor(1 + attribute, 1)
    }
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    assertCinema2NoGlErrors(gl, 'Threshold renderer setup')
  }

  /** Points the per-instance attributes at instance `start` (the VAO must be bound). */
  private bindInstanceStart(start: number): void {
    if (start === this.boundStart) return
    const { gl } = this
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    for (let attribute = 0; attribute < 4; attribute += 1) {
      gl.vertexAttribPointer(3 + attribute, 4, gl.FLOAT, false, THRESHOLD_INSTANCE_FLOATS * 4, start * THRESHOLD_INSTANCE_FLOATS * 4 + attribute * 16)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    this.boundStart = start
  }

  /** Draws the visible instance ranges of one lap copy; returns how many instances were submitted. */
  private drawRanges(lap: number, period: number, cameraZ: number, viewFar: number, margin: number): number {
    const { gl } = this
    let drawn = 0
    for (const range of visibleThresholdRanges(this.chunks, lap, period, cameraZ, viewFar, margin)) {
      this.bindInstanceStart(range.start)
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, range.count)
      drawn += range.count
    }
    return drawn
  }

  /** What the last frame submitted: box instances (main and shadow passes) and smoke puffs. For tests and diagnostics. */
  getStats(): Readonly<{ boxesDrawn: number; puffsDrawn: number; shadowBoxesDrawn: number; totalBoxes: number; totalPuffs: number }> {
    return { ...this.stats, totalBoxes: this.instanceCount, totalPuffs: this.puffCount }
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
    program.setFloat('u_tier', state.tier)
    const smoke = state.smoke
    const smokeReady = this.puffCount > 0 && smoke.texture != null && smoke.amount > 0.001
    this.stats.boxesDrawn = 0
    this.stats.puffsDrawn = 0
    // Laps far to near: the farthest copy first, so the smoke (blended) of each copy composes over what is behind it.
    for (const index of [...state.laps.keys()].reverse()) {
      const lap = state.laps[index]!
      // World -> camera-relative shift, computed in JS doubles so an endless flight keeps full precision.
      const shift: [number, number, number] = [-state.cameraPosition[0], -state.cameraPosition[1], -lap * state.period - state.cameraPosition[2]]
      program.activate()
      program.setFloat('u_fieldVisibility', state.fieldVisibility[index] ?? 1)
      program.setVec3('u_originShift', ...shift)
      gl.bindVertexArray(this.vao)
      gl.enable(gl.CULL_FACE)
      gl.cullFace(gl.BACK)
      this.stats.boxesDrawn += this.drawRanges(lap, state.period, state.cameraPosition[2], state.viewFar, state.cullMargin)
      gl.disable(gl.CULL_FACE)
      gl.bindVertexArray(null)
      if (smokeReady) this.drawSmoke(state, lap, shift, r)
    }
    assertCinema2NoGlErrors(gl, 'Threshold monolith draw')
  }

  private drawSmoke(state: Readonly<ThresholdDrawState>, lap: number, shift: readonly [number, number, number], r: ThresholdDrawState['reactive']): void {
    const { gl, smokeProgram: program } = this
    // Puffs of this lap that are in front of (or just behind) the camera; the buffer is sorted far to near, so it draws back to front.
    program.activate()
    program.setMat4('u_viewRotation', state.viewRotation)
    program.setMat4('u_projection', state.projection)
    program.setVec3('u_originShift', ...shift)
    program.setVec3('u_cameraPosition', ...state.cameraPosition)
    program.setFloat('u_widthScale', state.widthScale)
    program.setFloat('u_tier', state.tier)
    program.setFloat('u_time', state.time)
    program.setFloat('u_intensity', state.intensity)
    program.setFloat('u_smokeAmount', state.smoke.amount)
    program.setFloat('u_fogDensity', state.fogDensity)
    program.setFloat('u_wallX', state.smoke.wallX)
    program.setFloat('u_density', 0.4)
    program.setFloat('u_glow', Math.min(state.vanishing.strength / 3.6, 1.5))
    program.setVec3('u_fogColor', ...state.fogColor)
    program.setVec3('u_primaryColor', ...state.primaryColor)
    program.setFloat('u_baseLevel', state.baseLevel)
    program.setFloat('u_accentBase', state.accentBase)
    program.setFloat('u_kick', r.kick)
    program.setFloat('u_snare', r.snare)
    program.setFloat('u_beat', r.beat)
    program.setFloat('u_beatParity', r.beatParity)
    program.setFloat('u_sweepFront', r.sweepFront)
    program.setFloat('u_sweepStrength', r.sweepStrength)
    program.setFloat('u_drop', r.drop)
    program.setFloat('u_bass', r.bass)
    program.setFloat('u_vocal', r.vocal)
    program.setFloat('u_arc', r.arc)
    program.setFloat('u_level', r.level)
    program.setFloat('u_phraseSide', r.phraseSide)
    program.setFloat('u_breathing', r.breathing)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, state.smoke.texture!)
    program.setSampler('u_sprites', 0)
    gl.bindVertexArray(this.smokeVao)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    // Colour pass: depth-tested, blended, no depth write.
    gl.depthMask(false)
    program.setFloat('u_depthPass', 0)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.puffCount)
    // Depth pass: only the dense core writes depth (no colour), so the floor effect and the reflections see it.
    gl.disable(gl.BLEND)
    gl.colorMask(false, false, false, false)
    gl.depthMask(true)
    program.setFloat('u_depthPass', 1)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.puffCount)
    gl.colorMask(true, true, true, true)
    this.stats.puffsDrawn += this.puffCount
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    void lap
  }

  /** Draws every tower depth-only into the currently bound shadow-map framebuffer. */
  drawShadow(state: Readonly<ThresholdShadowDrawState>): void {
    if (this.disposed || this.instanceCount === 0) return
    const { gl, shadowProgram: program } = this
    program.activate()
    program.setMat4('u_lightViewProj', state.lightViewProjection)
    program.setFloat('u_widthScale', state.widthScale)
    program.setFloat('u_tier', state.tier)
    gl.bindVertexArray(this.vao)
    this.stats.shadowBoxesDrawn = 0
    for (const [index, lap] of state.laps.entries()) {
      program.setFloat('u_fieldVisibility', state.fieldVisibility[index] ?? 1)
      program.setVec3('u_originShift', -state.cameraPosition[0], -state.cameraPosition[1], -lap * state.period - state.cameraPosition[2])
      this.stats.shadowBoxesDrawn += this.drawRanges(lap, state.period, state.cameraPosition[2], state.viewFar, state.cullMargin)
    }
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Threshold shadow draw')
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const buffer of this.buffers) this.gl.deleteBuffer(buffer)
    this.buffers.length = 0
    this.gl.deleteVertexArray(this.vao)
    this.gl.deleteVertexArray(this.glowVao)
    this.gl.deleteVertexArray(this.smokeVao)
    this.smokeProgram.dispose()
    this.glowProgram.dispose()
    this.shadowProgram.dispose()
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

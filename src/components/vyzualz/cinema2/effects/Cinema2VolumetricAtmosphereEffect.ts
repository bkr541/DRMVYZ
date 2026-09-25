import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
  type Cinema2JsonValue,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../scene/Cinema2SceneGraph'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from '../spatial/Cinema2LightingEnvironmentRuntime'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectDiagnostic,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'

/**
 * Volumetric atmosphere: haze, ground mist and visible light shafts.
 *
 * A native post effect (no Three.js). It marches each pixel's view ray through
 * a noise-modulated density field and, at every step, gathers in-scattered light
 * from the shared lighting list (`spot`/`point`/`directional` scatter, `ambient`
 * tints the fill). The ray stops at the scene depth when a depth input is wired,
 * so it works with depth from ANY module; without depth it marches to
 * `maxDistance` (unoccluded haze). Screen-space shafts from bright pixels are a
 * separate opt-in that needs neither lights nor a camera.
 *
 * Known limit: there are no shadows, so light scatters through occluders
 * between the light and the ray sample. Shadowing is roadmap item #10.
 */
export const CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere')
export const CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_VERSION = 1 as const

export const CINEMA2_VOLUMETRIC_MAX_LIGHTS = 8
export const CINEMA2_VOLUMETRIC_MAX_STEPS = 48

export interface Cinema2VolumetricQualityProfile {
  /** Ray-march samples per pixel. */
  steps: number
  /** Noise octaves for density modulation. */
  octaves: number
  /** Taps for the optional screen-space shaft blur. */
  shaftTaps: number
  /** Resolution of the ray-march pass relative to the output; it is upsampled with a depth-aware filter. */
  scale: number
  /** Weight of the previous frame's march at 60 fps; higher averages more grain away but lags fast changes. */
  historyBlend: number
}

export const CINEMA2_VOLUMETRIC_QUALITY_PROFILES: Readonly<Record<Cinema2RenderQualityLevel, Readonly<Cinema2VolumetricQualityProfile>>> = Object.freeze({
  low: Object.freeze({ steps: 18, octaves: 1, shaftTaps: 8, scale: 0.4, historyBlend: 0.7 }),
  medium: Object.freeze({ steps: 26, octaves: 2, shaftTaps: 14, scale: 0.5, historyBlend: 0.6 }),
  high: Object.freeze({ steps: 40, octaves: 3, shaftTaps: 22, scale: 0.5, historyBlend: 0.5 }),
})

const SHADER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_depth;
uniform sampler2D u_atmosphere;
uniform sampler2D u_previous;
uniform float u_historyBlend;
uniform float u_mix;
uniform float u_time;
uniform float u_hasDepth;
uniform float u_hasCamera;
uniform mat4 u_invViewProj;
uniform vec2 u_nearFar;
uniform vec2 u_lowResolution;
uniform int u_steps;
uniform int u_octaves;
uniform int u_shaftTaps;
uniform float u_maxDistance;
uniform float u_density;
uniform float u_beam;
uniform float u_anisotropy;
uniform float u_occlusion;
uniform vec3 u_hazeColor;
uniform float u_ambientHaze;
uniform float u_ambientHeight;
uniform vec3 u_ambient;
uniform float u_mistAmount;
uniform float u_mistHeight;
uniform float u_mistFloor;
uniform float u_noiseScale;
uniform float u_noiseStrength;
uniform vec3 u_wind;
uniform float u_floorEnabled;
uniform float u_floorY;
uniform float u_floorReflection;
uniform int u_lightCount;
uniform vec4 u_lightPos[${CINEMA2_VOLUMETRIC_MAX_LIGHTS}];
uniform vec4 u_lightDir[${CINEMA2_VOLUMETRIC_MAX_LIGHTS}];
uniform vec4 u_lightCol[${CINEMA2_VOLUMETRIC_MAX_LIGHTS}];
uniform float u_lightInner[${CINEMA2_VOLUMETRIC_MAX_LIGHTS}];
uniform float u_shafts;
uniform vec2 u_shaftOrigin;
uniform float u_shaftLength;
out vec4 outColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Interleaved gradient noise: cheap, used only for the sub-LSB output dither.
float gradientNoise(vec2 pixel) {
  return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}
// White-noise hash for ray-start jitter. Unlike gradient noise it has no regular lattice, so after the
// reduced-resolution upsample it reads as film grain instead of a visible mesh.
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`

const MARCH_FUNCTIONS = `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float valueNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z
  );
}
float fbm(vec3 p) {
  float amplitude = 0.5;
  float sum = 0.0;
  float total = 0.0;
  for (int o = 0; o < 3; o++) {
    if (o >= u_octaves) break;
    sum += amplitude * valueNoise(p);
    total += amplitude;
    p = p * 2.03 + vec3(11.7, 5.3, 8.1);
    amplitude *= 0.5;
  }
  return sum / max(total, 0.0001);
}
vec3 unproject(vec2 ndc, float z) {
  vec4 p = u_invViewProj * vec4(ndc, z, 1.0);
  return p.xyz / p.w;
}
// Henyey-Greenstein, scaled so g = 0 (isotropic) returns 1.
float phase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * cosTheta, 0.0001), 1.5);
}
float densityAt(vec3 p) {
  float height = max(p.y - u_mistFloor, 0.0);
  float mist = u_mistAmount * exp(-height / max(u_mistHeight, 0.05));
  float n = fbm(p * u_noiseScale + u_wind);
  float modulation = mix(1.0, n * 2.0, u_noiseStrength);
  return max(u_density + mist, 0.0) * modulation;
}
vec3 lightScatter(vec3 p, vec3 rayDir) {
  vec3 total = vec3(0.0);
  for (int i = 0; i < ${CINEMA2_VOLUMETRIC_MAX_LIGHTS}; i++) {
    if (i >= u_lightCount) break;
    vec4 color = u_lightCol[i];
    int kind = int(color.w + 0.5);
    vec3 toLight;
    float attenuation = 1.0;
    if (kind == 1) {
      // Directional light is unshadowed, so it is held back to avoid washing the whole volume.
      toLight = -u_lightDir[i].xyz;
      attenuation = 0.35;
    } else {
      vec3 delta = u_lightPos[i].xyz - p;
      float dist = length(delta);
      toLight = delta / max(dist, 0.0001);
      float x = dist / max(u_lightPos[i].w, 0.0001);
      attenuation = (1.0 / (1.0 + 4.0 * x * x)) * clamp(1.0 - x * x * x * x, 0.0, 1.0);
      if (kind == 3) {
        float cone = dot(-toLight, u_lightDir[i].xyz);
        attenuation *= smoothstep(u_lightDir[i].w, u_lightInner[i], cone);
      }
    }
    total += color.rgb * attenuation * phase(dot(rayDir, toLight), u_anisotropy);
  }
  return total;
}
// Soft highlight roll-off that keeps hue, so heavy beams bloom toward white instead of clipping.
vec3 compressScatter(vec3 s) {
  float peak = max(max(s.r, s.g), s.b);
  return s * ((1.0 - exp(-peak)) / max(peak, 0.0001));
}
// Ray-marches one segment of the density field, accumulating in-scattered light and transmittance.
void marchSegment(vec3 origin, vec3 dir, float segmentLength, int steps, float jitter, inout vec3 scatter, inout float transmittance) {
  float stepLength = segmentLength / float(steps);
  vec3 ambientFill = u_hazeColor * u_ambientHaze + u_ambient * u_hazeColor;
  for (int i = 0; i < ${CINEMA2_VOLUMETRIC_MAX_STEPS}; i++) {
    if (i >= steps) break;
    vec3 p = origin + dir * ((float(i) + jitter) * stepLength);
    float dens = densityAt(p);
    if (dens < 0.0001) continue;
    float extinction = dens * stepLength;
    // The ambient glow can settle low: with a height set it fades above the mist floor, leaving the open space above dark.
    float ambientLift = u_ambientHeight > 0.001 ? exp(-max(p.y - u_mistFloor, 0.0) / u_ambientHeight) : 1.0;
    vec3 light = ambientFill * ambientLift + u_beam * lightScatter(p, dir);
    scatter += transmittance * light * extinction;
    transmittance *= exp(-extinction * u_occlusion);
  }
}
// Accumulates in-scattered light (rgb) and remaining transmittance (a) along the view ray through this pixel.
vec4 marchAtmosphere(vec2 uv) {
  vec3 scatter = vec3(0.0);
  float transmittance = 1.0;
  if (u_hasCamera > 0.5) {
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 rayOrigin = unproject(ndc, -1.0);
    vec3 rayDir = normalize(unproject(ndc, 1.0) - rayOrigin);
    float tMax = u_maxDistance;
    if (u_hasDepth > 0.5) {
      float depth = texture(u_depth, uv).r;
      // Depth 1.0 is "nothing drawn": the ray runs to maxDistance.
      if (depth < 0.99999) tMax = min(tMax, length(unproject(ndc, depth * 2.0 - 1.0) - rayOrigin));
    }
    float jitter = hash21(gl_FragCoord.xy + fract(u_time * 0.618) * 977.0);
    // A floor plane ends the haze where the ray reaches it; the mirrored ray then gathers the reflected beams.
    float planeDistance = 1.0e9;
    if (u_floorEnabled > 0.5 && rayOrigin.y > u_floorY && rayDir.y < -0.0005) planeDistance = (u_floorY - rayOrigin.y) / rayDir.y;
    bool onFloor = planeDistance < tMax;
    if (onFloor) tMax = planeDistance;
    marchSegment(rayOrigin, rayDir, tMax, u_steps, jitter, scatter, transmittance);
    if (onFloor && u_floorReflection > 0.0001) {
      vec3 floorPoint = rayOrigin + rayDir * planeDistance;
      vec3 mirrored = vec3(rayDir.x, -rayDir.y, rayDir.z);
      float fresnel = u_floorReflection * (0.15 + 0.85 * pow(1.0 - clamp(-rayDir.y, 0.0, 1.0), 3.0));
      vec3 reflectedScatter = vec3(0.0);
      float reflectedTransmittance = 1.0;
      marchSegment(floorPoint, mirrored, u_maxDistance * 0.6, max((u_steps * 3) / 4, 8), fract(jitter + 0.5), reflectedScatter, reflectedTransmittance);
      scatter += transmittance * reflectedScatter * fresnel;
      transmittance *= mix(1.0, reflectedTransmittance, fresnel);
    }
  } else {
    // No world camera: screen-space haze only.
    float n = fbm(vec3(uv * u_noiseScale * 6.0, 0.0) + u_wind);
    float haze = u_density * 4.0 * mix(1.0, n * 2.0, u_noiseStrength);
    scatter = u_hazeColor * (u_ambientHaze + luma(u_ambient)) * haze;
    transmittance = exp(-haze * u_occlusion * 0.25);
  }
  return vec4(compressScatter(scatter), transmittance);
}
`

const FINISH_FUNCTIONS = `
// Screen-space shafts from bright pixels; needs neither lights nor a camera.
vec3 screenShafts(vec2 uv) {
  if (u_shafts < 0.0001) return vec3(0.0);
  vec3 shaftLight = vec3(0.0);
  vec2 shaftStep = (u_shaftOrigin - uv) * u_shaftLength / float(u_shaftTaps);
  vec2 p = uv + shaftStep * gradientNoise(gl_FragCoord.yx);
  float weight = 1.0;
  for (int i = 0; i < 24; i++) {
    if (i >= u_shaftTaps) break;
    p += shaftStep;
    vec3 c = texture(u_source, clamp(p, vec2(0.0), vec2(1.0))).rgb;
    shaftLight += c * smoothstep(0.55, 0.9, luma(c)) * weight;
    weight *= 0.95;
  }
  return shaftLight * u_shafts * 2.2 / float(u_shaftTaps);
}
vec4 finishColor(vec4 base, vec3 scatter, float transmittance, vec2 uv) {
  vec3 shaftLight = screenShafts(uv);
  vec3 finalColor = base.rgb * mix(1.0, transmittance, clamp(u_occlusion, 0.0, 1.0)) + scatter + shaftLight;
  // Sub-LSB dither keeps dark gradients from banding on the 8-bit targets.
  finalColor += (gradientNoise(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
  float lift = clamp(max(scatter.r, max(scatter.g, scatter.b)) + luma(shaftLight), 0.0, 1.0);
  float m = clamp(u_mix, 0.0, 1.0);
  return vec4(mix(base.rgb, finalColor, m), max(base.a, lift * m));
}
float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * u_nearFar.x * u_nearFar.y / (u_nearFar.y + u_nearFar.x - z * (u_nearFar.y - u_nearFar.x));
}
// Depth-aware 4-tap upsample of the reduced-resolution march, so beams do not bleed across silhouettes.
vec4 sampleAtmosphere(vec2 uv) {
  vec2 grid = uv * u_lowResolution - 0.5;
  vec2 cell = floor(grid);
  vec2 f = fract(grid);
  float fullDepth = u_hasDepth > 0.5 ? linearDepth(texture(u_depth, uv).r) : 0.0;
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 offset = vec2(float(i & 1), float(i >> 1));
    vec2 tapUv = clamp((cell + offset + 0.5) / u_lowResolution, vec2(0.0), vec2(1.0));
    float weight = mix(1.0 - f.x, f.x, offset.x) * mix(1.0 - f.y, f.y, offset.y);
    if (u_hasDepth > 0.5) {
      float tapDepth = linearDepth(texture(u_depth, tapUv).r);
      weight *= 1.0 / (0.05 + abs(tapDepth - fullDepth) / max(fullDepth, 0.0001) * 9.0);
    }
    vec4 tap = texture(u_atmosphere, tapUv);
    sum += vec4(tap.rgb * tap.rgb, tap.a) * weight;
    total += weight;
  }
  return sum / max(total, 0.0001);
}
`

const MARCH_SOURCE = `${SHADER_HEADER}${MARCH_FUNCTIONS}
void main() {
  vec4 result = marchAtmosphere(v_uv);
  // sqrt encoding keeps dark scatter precise in the 8-bit reduced-resolution target.
  vec4 encoded = vec4(sqrt(result.rgb), result.a);
  // Ray-start jitter is uncorrelated between frames, so blending with the previous march averages the grain away.
  outColor = mix(encoded, texture(u_previous, v_uv), u_historyBlend);
}`

const COMPOSITE_SOURCE = `${SHADER_HEADER}${FINISH_FUNCTIONS}
void main() {
  vec4 atmosphere = sampleAtmosphere(v_uv);
  outColor = finishColor(texture(u_source, v_uv), atmosphere.rgb, atmosphere.a, v_uv);
}`

// Used when the reduced-resolution buffer is unavailable (history budget or context loss) or scale is 1.
const DIRECT_SOURCE = `${SHADER_HEADER}${MARCH_FUNCTIONS}${FINISH_FUNCTIONS}
void main() {
  vec4 atmosphere = marchAtmosphere(v_uv);
  outColor = finishColor(texture(u_source, v_uv), atmosphere.rgb, atmosphere.a, v_uv);
}`

const DEFAULT_HAZE_COLOR: readonly [number, number, number] = Object.freeze([0.55, 0.62, 0.72]) as readonly [number, number, number]

const NUMERIC_PARAMETERS: readonly (readonly [name: string, min: number, max: number])[] = Object.freeze([
  ['density', 0, 2],
  ['beamIntensity', 0, 8],
  ['anisotropy', -0.95, 0.95],
  ['occlusion', 0, 1],
  ['ambientHaze', 0, 4],
  ['ambientHeight', 0, 200],
  ['mistAmount', 0, 4],
  ['mistHeight', 0.05, 20],
  ['mistFloor', -50, 50],
  ['noiseScale', 0.02, 4],
  ['noiseStrength', 0, 1],
  ['drift', 0, 4],
  ['maxDistance', 1, 200],
  ['shafts', 0, 1],
  ['shaftOriginX', 0, 1],
  ['shaftOriginY', 0, 1],
  ['shaftLength', 0, 1],
  ['reactivity', 0, 2],
  ['floorY', -50, 50],
  ['floorReflection', 0, 1],
])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function numberValue(values: Readonly<Record<string, Cinema2JsonValue>>, name: string, fallback: number): number {
  const value = values[name]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isColorTriple(value: unknown): value is readonly number[] {
  return Array.isArray(value)
    && (value.length === 3 || value.length === 4)
    && value.every(component => typeof component === 'number' && Number.isFinite(component) && component >= 0 && component <= 1)
}

function validateVolumetric(effect: Readonly<Cinema2EffectManifest>): readonly Cinema2EffectDiagnostic[] {
  const diagnostics: Cinema2EffectDiagnostic[] = []
  const mix = effect.parameters?.mix
  if (typeof mix !== 'number' || !Number.isFinite(mix) || mix < 0 || mix > 1) {
    diagnostics.push({ code: 'CINEMA2_EFFECT_MIX_INVALID', path: '$.parameters.mix', message: 'Effect mix must be a finite number between 0 and 1.' })
  }
  for (const [name, min, max] of NUMERIC_PARAMETERS) {
    const value = effect.parameters?.[name]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: `$.parameters.${name}`, message: `Effect parameter "${name}" must be between ${min} and ${max}.` })
    }
  }
  const hazeColor = effect.parameters?.hazeColor
  if (hazeColor !== undefined && !isColorTriple(hazeColor)) {
    diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.hazeColor', message: 'Effect parameter "hazeColor" must be an [r, g, b] or [r, g, b, a] color with components between 0 and 1.' })
  }
  return Object.freeze(diagnostics)
}

/** General 4x4 inverse for column-major matrices. Returns null when singular or non-finite. */
export function invertCinema2Matrix4(matrix: Cinema2Matrix4 | readonly number[]): Float32Array | null {
  const m = matrix
  if (m.length !== 16 || m.some(value => !Number.isFinite(value))) return null
  const inv = new Float64Array(16)
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10]
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10]
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9]
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9]
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10]
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10]
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9]
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9]
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6]
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6]
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5]
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5]
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6]
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6]
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5]
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5]
  const determinant = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12]
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null
  const result = new Float32Array(16)
  for (let index = 0; index < 16; index += 1) result[index] = inv[index] / determinant
  return result
}

export interface Cinema2VolumetricLightUniforms {
  count: number
  /** xyz position, w range. */
  position: Float32Array
  /** xyz direction, w cos(outer cone). */
  direction: Float32Array
  /** rgb color premultiplied by intensity, w kind: 1 directional, 2 point, 3 spot. */
  color: Float32Array
  /** cos(inner cone) per light. */
  inner: Float32Array
  /** Sum of ambient lights (rgb * intensity), used to tint the haze fill. */
  ambient: readonly [number, number, number]
}

/** Packs the shared light list into fixed-size uniform arrays. Ambient lights fold into `ambient`. */
export function packCinema2VolumetricLights(lights: readonly Readonly<Cinema2ResolvedLightFrame>[]): Cinema2VolumetricLightUniforms {
  const position = new Float32Array(CINEMA2_VOLUMETRIC_MAX_LIGHTS * 4)
  const direction = new Float32Array(CINEMA2_VOLUMETRIC_MAX_LIGHTS * 4)
  const color = new Float32Array(CINEMA2_VOLUMETRIC_MAX_LIGHTS * 4)
  const inner = new Float32Array(CINEMA2_VOLUMETRIC_MAX_LIGHTS)
  const ambient: [number, number, number] = [0, 0, 0]
  let count = 0
  for (const light of lights) {
    if (light.type === 'ambient') {
      ambient[0] += light.color[0] * light.intensity
      ambient[1] += light.color[1] * light.intensity
      ambient[2] += light.color[2] * light.intensity
      continue
    }
    if (count >= CINEMA2_VOLUMETRIC_MAX_LIGHTS) break
    const offset = count * 4
    position.set([light.position[0], light.position[1], light.position[2], light.range], offset)
    const spot = light.type === 'spot' ? light.spot : null
    const outer = spot ? Math.cos((spot.outerAngleDegrees * Math.PI) / 180) : -1
    direction.set([light.direction[0], light.direction[1], light.direction[2], outer], offset)
    color.set([
      light.color[0] * light.intensity,
      light.color[1] * light.intensity,
      light.color[2] * light.intensity,
      light.type === 'directional' ? 1 : light.type === 'point' ? 2 : 3,
    ], offset)
    inner[count] = spot ? Math.cos((spot.innerAngleDegrees * Math.PI) / 180) : 1
    count += 1
  }
  return { count, position, direction, color, inner, ambient }
}

function environmentHazeColor(lighting: Readonly<Cinema2LightingEnvironmentFrame> | undefined): readonly [number, number, number] {
  const fog = lighting?.environment.fog
  if (!fog) return DEFAULT_HAZE_COLOR
  // Authored fog color is usually near-black; lift it so it reads as haze rather than a dark veil.
  const lift = 3.2
  return [clamp(fog.color[0] * lift, 0, 1), clamp(fog.color[1] * lift, 0, 1), clamp(fog.color[2] * lift, 0, 1)]
}

const MARCH_UNIFORMS = [
  'u_depth', 'u_time', 'u_hasDepth', 'u_hasCamera', 'u_invViewProj', 'u_steps', 'u_octaves', 'u_maxDistance',
  'u_density', 'u_beam', 'u_anisotropy', 'u_occlusion', 'u_hazeColor', 'u_ambientHaze', 'u_ambientHeight', 'u_ambient',
  'u_mistAmount', 'u_mistHeight', 'u_mistFloor', 'u_noiseScale', 'u_noiseStrength', 'u_wind', 'u_lightCount',
  'u_lightPos[0]', 'u_lightDir[0]', 'u_lightCol[0]', 'u_lightInner[0]', 'u_previous', 'u_historyBlend',
  'u_floorEnabled', 'u_floorY', 'u_floorReflection',
] as const
const FINISH_UNIFORMS = [
  'u_source', 'u_depth', 'u_atmosphere', 'u_mix', 'u_hasDepth', 'u_nearFar', 'u_lowResolution', 'u_occlusion',
  'u_shaftTaps', 'u_shafts', 'u_shaftOrigin', 'u_shaftLength',
] as const

interface AtmosphereFrameValues {
  parameters: Readonly<Record<string, Cinema2JsonValue>>
  profile: Readonly<Cinema2VolumetricQualityProfile>
  lights: Cinema2VolumetricLightUniforms
  inverseViewProjection: Float32Array | null
  hazeColor: readonly [number, number, number]
  musicalLift: number
  wind: number
  hasDepth: boolean
  elapsedTimeSec: number
  /** Weight of the previous reduced-resolution march (0 = none, e.g. first frame or after a reset). */
  historyBlend: number
}

function createProgram(gl: WebGL2RenderingContext, label: string, fragSrc: string, uniforms: readonly string[]): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
    label,
    vertSrc: FULLSCREEN_VERT_SRC,
    fragSrc,
    optionalUniforms: [...uniforms],
  })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

class VolumetricAtmosphereEffectInstance implements Cinema2EffectInstance {
  private readonly pass: FullscreenPass
  private readonly historyName: string
  private readonly label: string
  private marchProgram: ShaderProgram | null = null
  private compositeProgram: ShaderProgram | null = null
  private directProgram: ShaderProgram | null = null
  private disposed = false
  private impactEnvelope = 0
  private driftClock = 0

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly history: Cinema2EffectCreateContext['history'],
    effect: Readonly<Cinema2EffectManifest>,
  ) {
    this.label = `Cinema2/Effect/VolumetricAtmosphere/${effect.id}`
    this.historyName = `effect.${effect.id}.volumetric-atmosphere`
    this.pass = new FullscreenPass(gl)
    // Compile eagerly so a broken shader fails effect creation instead of a later frame.
    this.compositeProgram = createProgram(gl, `${this.label}/composite`, COMPOSITE_SOURCE, FINISH_UNIFORMS)
    this.marchProgram = createProgram(gl, `${this.label}/march`, MARCH_SOURCE, MARCH_UNIFORMS)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl } = this
    const parameters = context.parameters
    const profile = CINEMA2_VOLUMETRIC_QUALITY_PROFILES[context.quality]
    const lighting = context.lightingEnvironment
    const camera = context.camera
    const inverse = camera ? invertCinema2Matrix4(camera.viewProjectionMatrix) : null
    const depthInput = context.inputs.find(input => input.attachment === 'depth') ?? null

    // Musical response is deliberately gated: the Visual Director's impact
    // authority decays over ~0.35 s so a single hit swells and settles instead of strobing.
    const reactivity = clamp(numberValue(parameters, 'reactivity', 0), 0, 2)
    const director = context.frame.director
    const dt = Math.max(0, context.frame.deltaTimeSec)
    const impact = director?.authority.impact.available ? clamp(director.authority.impact.authority, 0, 1) : 0
    this.impactEnvelope = Math.max(impact, this.impactEnvelope * Math.exp(-dt / 0.35))
    const intensity = director?.continuous.intensity.value
    const musicalLift = reactivity * (this.impactEnvelope + (typeof intensity === 'number' ? clamp(intensity, 0, 1) * 0.4 : 0))
    this.driftClock += dt * clamp(numberValue(parameters, 'drift', 0.12), 0, 4)

    const values: AtmosphereFrameValues = {
      parameters,
      profile,
      lights: packCinema2VolumetricLights(lighting?.lights ?? []),
      inverseViewProjection: inverse,
      hazeColor: readColor(parameters.hazeColor) ?? environmentHazeColor(lighting),
      musicalLift,
      wind: this.driftClock,
      hasDepth: depthInput != null,
      elapsedTimeSec: context.frame.elapsedTimeSec,
      historyBlend: 0,
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)

    const lowWidth = Math.max(1, Math.round(context.width * profile.scale))
    const lowHeight = Math.max(1, Math.round(context.height * profile.scale))
    const reduced = profile.scale < 1 ? this.history.beginFrame(this.historyName, lowWidth, lowHeight) : null
    const bindings = (extra: { unit: number; texture: WebGLTexture; uniformName: string }[] = []) => [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      // Without a depth input unit 1 just re-binds the color texture; u_hasDepth keeps the shader from sampling it.
      { unit: 1, texture: depthInput?.texture ?? context.input.texture, uniformName: 'u_depth' },
      ...extra,
    ]

    if (reduced && this.marchProgram && this.compositeProgram) {
      // Frame-rate independent temporal blend. A long gap (seek/tab switch) or invalid history restarts clean;
      // a zero-dt frame (paused transport) keeps the normal per-frame blend so it still converges and parameter edits still land.
      const blendPerFrame = profile.historyBlend
      values.historyBlend = !reduced.valid || dt >= 0.1
        ? 0
        : dt <= 0 ? blendPerFrame : Math.min(0.9, Math.pow(blendPerFrame, Math.min(dt * 60, 4)))
      this.marchProgram.activate()
      this.setMarchUniforms(this.marchProgram, values)
      this.pass.run(this.marchProgram, reduced.write.framebuffer, lowWidth, lowHeight, bindings([
        // Never bind the surface being written; without valid history the blend weight is 0 and this is a placeholder.
        { unit: 3, texture: reduced.valid ? reduced.read.colorTexture : context.input.texture, uniformName: 'u_previous' },
      ]))
      assertCinema2NoGlErrors(gl, 'Volumetric atmosphere march draw')

      this.compositeProgram.activate()
      this.setFinishUniforms(this.compositeProgram, values, context, lowWidth, lowHeight, camera)
      this.pass.run(this.compositeProgram, context.target, context.width, context.height, bindings([
        { unit: 2, texture: reduced.write.colorTexture, uniformName: 'u_atmosphere' },
      ]))
      assertCinema2NoGlErrors(gl, 'Volumetric atmosphere composite draw')
      this.history.commit(this.historyName)
      return
    }

    // Reduced-resolution buffer unavailable: march at full resolution instead of dropping the effect.
    if (!this.directProgram) this.directProgram = createProgram(gl, `${this.label}/direct`, DIRECT_SOURCE, [...MARCH_UNIFORMS, ...FINISH_UNIFORMS])
    this.directProgram.activate()
    this.setMarchUniforms(this.directProgram, values)
    this.setFinishUniforms(this.directProgram, values, context, context.width, context.height, camera)
    this.pass.run(this.directProgram, context.target, context.width, context.height, bindings())
    assertCinema2NoGlErrors(gl, 'Volumetric atmosphere direct draw')
  }

  private setMarchUniforms(program: ShaderProgram, values: AtmosphereFrameValues): void {
    const { gl } = this
    const { parameters, profile, lights, hazeColor, musicalLift } = values
    program.setFloat('u_time', values.elapsedTimeSec)
    program.setFloat('u_historyBlend', values.historyBlend)
    program.setFloat('u_hasDepth', values.hasDepth ? 1 : 0)
    program.setFloat('u_hasCamera', values.inverseViewProjection ? 1 : 0)
    if (values.inverseViewProjection) program.setMat4('u_invViewProj', values.inverseViewProjection)
    program.setInt('u_steps', profile.steps)
    program.setInt('u_octaves', profile.octaves)
    program.setFloat('u_maxDistance', clamp(numberValue(parameters, 'maxDistance', 40), 1, 200))
    program.setFloat('u_density', clamp(numberValue(parameters, 'density', 0.06), 0, 2) * (1 + musicalLift * 0.35))
    program.setFloat('u_beam', clamp(numberValue(parameters, 'beamIntensity', 1), 0, 8) * (1 + musicalLift * 1.5))
    program.setFloat('u_anisotropy', clamp(numberValue(parameters, 'anisotropy', 0.55), -0.95, 0.95))
    program.setFloat('u_occlusion', clamp(numberValue(parameters, 'occlusion', 0.6), 0, 1))
    program.setVec3('u_hazeColor', hazeColor[0], hazeColor[1], hazeColor[2])
    program.setFloat('u_ambientHaze', clamp(numberValue(parameters, 'ambientHaze', 0.4), 0, 4))
    program.setFloat('u_ambientHeight', clamp(numberValue(parameters, 'ambientHeight', 0), 0, 200))
    program.setVec3('u_ambient', lights.ambient[0], lights.ambient[1], lights.ambient[2])
    program.setFloat('u_mistAmount', clamp(numberValue(parameters, 'mistAmount', 0), 0, 4))
    program.setFloat('u_mistHeight', clamp(numberValue(parameters, 'mistHeight', 1.5), 0.05, 20))
    program.setFloat('u_mistFloor', clamp(numberValue(parameters, 'mistFloor', 0), -50, 50))
    program.setFloat('u_noiseScale', clamp(numberValue(parameters, 'noiseScale', 0.35), 0.02, 4))
    program.setFloat('u_noiseStrength', clamp(numberValue(parameters, 'noiseStrength', 0.6), 0, 1))
    program.setVec3('u_wind', values.wind, values.wind * 0.2, values.wind * 0.45)
    // A floor is opt-in: authoring `floorY` clamps haze at that plane and reflects the beams in it.
    const floorY = parameters.floorY
    program.setFloat('u_floorEnabled', typeof floorY === 'number' && Number.isFinite(floorY) ? 1 : 0)
    program.setFloat('u_floorY', clamp(numberValue(parameters, 'floorY', 0), -50, 50))
    program.setFloat('u_floorReflection', clamp(numberValue(parameters, 'floorReflection', 0.6), 0, 1))
    program.setInt('u_lightCount', lights.count)
    setFloatArray(gl, program, 'u_lightPos[0]', lights.position, 4)
    setFloatArray(gl, program, 'u_lightDir[0]', lights.direction, 4)
    setFloatArray(gl, program, 'u_lightCol[0]', lights.color, 4)
    setFloatArray(gl, program, 'u_lightInner[0]', lights.inner, 1)
  }

  private setFinishUniforms(
    program: ShaderProgram,
    values: AtmosphereFrameValues,
    context: Readonly<Cinema2EffectRenderExecutionContext>,
    lowWidth: number,
    lowHeight: number,
    camera: Readonly<Cinema2EffectRenderExecutionContext>['camera'],
  ): void {
    const { parameters, profile } = values
    program.setFloat('u_mix', context.mix)
    program.setFloat('u_hasDepth', values.hasDepth ? 1 : 0)
    program.setVec2('u_nearFar', camera?.near ?? 0.1, camera?.far ?? 100)
    program.setVec2('u_lowResolution', lowWidth, lowHeight)
    program.setFloat('u_occlusion', clamp(numberValue(parameters, 'occlusion', 0.6), 0, 1))
    program.setInt('u_shaftTaps', profile.shaftTaps)
    program.setFloat('u_shafts', clamp(numberValue(parameters, 'shafts', 0), 0, 1))
    program.setVec2('u_shaftOrigin', clamp(numberValue(parameters, 'shaftOriginX', 0.5), 0, 1), clamp(numberValue(parameters, 'shaftOriginY', 0.85), 0, 1))
    program.setFloat('u_shaftLength', clamp(numberValue(parameters, 'shaftLength', 0.6), 0, 1))
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.history.releaseBuffer(this.historyName)
    this.pass.dispose()
    this.marchProgram?.dispose()
    this.compositeProgram?.dispose()
    this.directProgram?.dispose()
    this.marchProgram = this.compositeProgram = this.directProgram = null
  }
}

function readColor(value: Cinema2JsonValue | undefined): readonly [number, number, number] | null {
  return isColorTriple(value) ? [value[0], value[1], value[2]] : null
}

function setFloatArray(
  gl: WebGL2RenderingContext,
  program: ShaderProgram,
  name: string,
  data: Float32Array,
  components: 1 | 4,
): void {
  const location = program.getUniform(name)
  if (location === null) return
  if (components === 4) gl.uniform4fv(location, data)
  else gl.uniform1fv(location, data)
}

export const cinema2VolumetricAtmosphereEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
  version: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_VERSION,
  label: 'Volumetric Atmosphere',
  validate: validateVolumetric,
  create: ({ gl, effect, history }: Readonly<Cinema2EffectCreateContext>) => new VolumetricAtmosphereEffectInstance(gl, history, effect),
})

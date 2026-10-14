import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import { cinema2RenderQualityProfile } from '../render/Cinema2RenderQualityProfiles'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import { getCinema2RenderTargetPool, type Cinema2PooledTarget } from '../runtime/Cinema2RenderTargetPool'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'
import {
  clampEffectValue as clamp,
  readEffectNumber as number,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'
import { invertCinema2Matrix4 } from './Cinema2VolumetricAtmosphereEffect'

/**
 * Ambient occlusion: darkens the soft ambient light that crevices, corners, joints and tightly packed geometry do not receive.
 *
 * This is a Cinema 2.0-native depth-based hemisphere occlusion rather than Three's `GTAOPass`. `GTAOPass` renders the scene a second time into
 * its own normal/depth targets through Three's EffectComposer, which would double the scene cost and fight the engine's ownership of the
 * framebuffers; this effect instead reads the scene depth every Render Graph frame already has (the same `depth` input depth-of-field uses),
 * reconstructs world positions and normals from it, and needs no extra scene pass.
 *
 * Passes: (1) occlusion at `resolutionScale` of the frame into a pooled target (R = occlusion, G = packed camera distance), (2) a depth-aware
 * horizontal blur, (3) a depth-aware vertical blur fused with the composite, which upsamples at full resolution and multiplies the result into
 * the display-encoded color. Both blurs weight each tap by how close its camera distance is to the center pixel's, so occlusion never bleeds
 * across a depth edge (no halos), and the composite protects very bright emissive pixels so lit LEDs and signs keep their glow.
 *
 * Needs the `depth` input and a world camera; without them, or on low quality, it passes the image through. It is stateless between frames (no
 * temporal accumulation), so camera movement and resizes cannot leave ghosts.
 */
export const CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('ambient-occlusion')
export const CINEMA2_AMBIENT_OCCLUSION_EFFECT_VERSION = 1 as const

/** Packed-distance scale shared by the occlusion pass and both blurs: `g = d / (d + K)`. */
const DISTANCE_PACK = 10

const COMMON = `
float unpackDistance(float g) { return DISTANCE_PACK * g / max(1.0 - g, 1.0e-3); }
float packDistance(float d) { return d / (d + DISTANCE_PACK); }
`.replace(/DISTANCE_PACK/g, DISTANCE_PACK.toFixed(1))

const OCCLUSION_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_depth;
uniform mat4 u_invViewProj;
uniform mat4 u_viewProj;
uniform vec3 u_cameraPosition;
uniform vec2 u_depthTexel;
uniform float u_radius;
uniform float u_bias;
uniform int u_samples;
uniform float u_maxDistance;
out vec4 outColor;
${COMMON}
vec3 worldAt(vec2 uv, float d) {
  vec4 p = u_invViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
float radialInverse(uint bits) {
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return float(bits) * 2.3283064365386963e-10;
}
// Interleaved gradient noise: a stable per-pixel rotation that the blur then averages away.
float gradientNoise(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float d = texture(u_depth, v_uv).r;
  if (d >= 0.99999) { outColor = vec4(1.0, packDistance(1.0e4), 0.0, 1.0); return; }
  vec3 P = worldAt(v_uv, d);
  float dP = length(P - u_cameraPosition);
  // Normal from the neighbor on each axis that is closer in depth (keeps normals clean on silhouettes).
  vec2 t = u_depthTexel;
  vec3 pl = worldAt(v_uv - vec2(t.x, 0.0), texture(u_depth, v_uv - vec2(t.x, 0.0)).r);
  vec3 pr = worldAt(v_uv + vec2(t.x, 0.0), texture(u_depth, v_uv + vec2(t.x, 0.0)).r);
  vec3 pd = worldAt(v_uv - vec2(0.0, t.y), texture(u_depth, v_uv - vec2(0.0, t.y)).r);
  vec3 pu = worldAt(v_uv + vec2(0.0, t.y), texture(u_depth, v_uv + vec2(0.0, t.y)).r);
  float cl = abs(length(pl - u_cameraPosition) - dP);
  float cr = abs(length(pr - u_cameraPosition) - dP);
  float cd = abs(length(pd - u_cameraPosition) - dP);
  float cu = abs(length(pu - u_cameraPosition) - dP);
  vec3 dx = cr < cl ? pr - P : P - pl;
  vec3 dy = cu < cd ? pu - P : P - pd;
  vec3 N = cross(dx, dy);
  float nl = length(N);
  if (nl < 1.0e-12) { outColor = vec4(1.0, packDistance(dP), 0.0, 1.0); return; }
  N /= nl;
  if (dot(N, u_cameraPosition - P) < 0.0) N = -N;

  vec3 up = abs(N.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  float spin = gradientNoise(gl_FragCoord.xy) * 6.28318530718;
  float bias = u_bias * u_radius;
  float occlusion = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= u_samples) break;
    float fi = (float(i) + 0.5) / float(u_samples);
    float phi = 6.28318530718 * radialInverse(uint(i)) + spin;
    float sinTheta = sqrt(fi);
    vec3 dir = vec3(cos(phi) * sinTheta, sin(phi) * sinTheta, sqrt(1.0 - fi));
    // Golden-ratio sequence for the sample distance, squared so most samples land near the shaded point.
    float ring = fract(0.5 + float(i) * 0.61803398875);
    float scale = mix(0.1, 1.0, ring * ring);
    vec3 S = P + N * (u_radius * 0.01) + (T * dir.x + B * dir.y + N * dir.z) * (u_radius * scale);
    vec4 clip = u_viewProj * vec4(S, 1.0);
    if (clip.w <= 0.0) continue;
    vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
    float sd = texture(u_depth, suv).r;
    if (sd >= 0.99999) continue;
    float dQ = length(worldAt(suv, sd) - u_cameraPosition);
    float dS = length(S - u_cameraPosition);
    // Occluded when the visible surface along this ray is in front of the sample point; the range check drops surfaces far in front of P.
    float occluded = dQ < dS - bias ? 1.0 : 0.0;
    float range = smoothstep(0.0, 1.0, u_radius / max(abs(dP - dQ), 1.0e-4));
    occlusion += occluded * range;
  }
  float ao = 1.0 - occlusion / float(max(u_samples, 1));
  ao = mix(ao, 1.0, smoothstep(u_maxDistance * 0.7, u_maxDistance, dP));
  outColor = vec4(ao, packDistance(dP), 0.0, 1.0);
}`

const BLUR_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_occlusion;
uniform vec2 u_texel;
uniform vec2 u_axis;
uniform int u_taps;
uniform float u_tolerance;
out vec4 outColor;
${COMMON}
void main() {
  vec4 center = texture(u_occlusion, v_uv);
  float dc = unpackDistance(center.g);
  float tol = max(u_tolerance, dc * 0.02);
  float sum = center.r;
  float total = 1.0;
  for (int k = 1; k <= 6; k++) {
    if (k > u_taps) break;
    float spatial = exp(-float(k * k) / (0.5 * float(u_taps * u_taps) + 0.5));
    for (int s = -1; s <= 1; s += 2) {
      vec4 tap = texture(u_occlusion, v_uv + u_axis * u_texel * float(k * s));
      float dd = unpackDistance(tap.g) - dc;
      float w = spatial * exp(-(dd * dd) / (tol * tol));
      sum += tap.r * w;
      total += w;
    }
  }
  outColor = vec4(sum / total, center.g, 0.0, 1.0);
}`

const COMPOSITE_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_occlusion;
uniform sampler2D u_depth;
uniform mat4 u_invViewProj;
uniform vec3 u_cameraPosition;
uniform vec2 u_occlusionTexel;
uniform int u_active;
uniform int u_taps;
uniform float u_tolerance;
uniform float u_intensity;
uniform float u_power;
uniform float u_emissiveProtect;
uniform float u_mix;
uniform int u_debug;
out vec4 outColor;
${COMMON}
float distanceAt(vec2 uv) {
  float d = texture(u_depth, uv).r;
  if (d >= 0.99999) return 1.0e4;
  vec4 p = u_invViewProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return length(p.xyz / p.w - u_cameraPosition);
}
void main() {
  vec4 base = texture(u_source, v_uv);
  if (u_active == 0) { outColor = base; return; }
  float dc = distanceAt(v_uv);
  float ao = 1.0;
  if (dc < 9.0e3) {
    float tol = max(u_tolerance, dc * 0.02);
    vec4 center = texture(u_occlusion, v_uv);
    float centerWeight = exp(-pow(unpackDistance(center.g) - dc, 2.0) / (tol * tol)) + 1.0e-3;
    float sum = center.r * centerWeight;
    float total = centerWeight;
    for (int k = 1; k <= 6; k++) {
      if (k > u_taps) break;
      float spatial = exp(-float(k * k) / (0.5 * float(u_taps * u_taps) + 0.5));
      for (int s = -1; s <= 1; s += 2) {
        vec4 tap = texture(u_occlusion, v_uv + vec2(0.0, u_occlusionTexel.y * float(k * s)));
        float dd = unpackDistance(tap.g) - dc;
        float w = spatial * exp(-(dd * dd) / (tol * tol));
        sum += tap.r * w;
        total += w;
      }
    }
    ao = clamp(sum / total, 0.0, 1.0);
  }
  ao = pow(ao, u_power);
  if (u_debug == 1) { outColor = vec4(vec3(ao), 1.0); return; }
  float amount = clamp((1.0 - ao) * u_intensity, 0.0, 1.0);
  // Very bright pixels are light sources, not lit surfaces: leave their glow alone.
  float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
  float protection = 1.0 - u_emissiveProtect * smoothstep(0.7, 1.4, luma);
  float factor = 1.0 - amount * protection;
  // The engine's color is display-encoded (gamma 2.2); occlusion is a linear-light multiplier.
  vec3 occluded = base.rgb * pow(factor, 1.0 / 2.2);
  outColor = vec4(mix(base.rgb, occluded, clamp(u_mix, 0.0, 1.0)), base.a);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['radius', 0.01, 100],
  ['intensity', 0, 4],
  ['bias', 0, 0.5],
  ['power', 0.25, 4],
  ['maxDistance', 1, 2000],
  ['denoise', 0, 1],
  ['emissiveProtect', 0, 1],
])

export type Cinema2AmbientOcclusionOutput = 'composite' | 'occlusion'

function createProgram(gl: WebGL2RenderingContext, label: string, fragSrc: string, required: string[], optional: string[]): ShaderProgram {
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), { label, vertSrc: FULLSCREEN_VERT_SRC, fragSrc, requiredUniforms: required, optionalUniforms: optional })
  if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  return result.program
}

class AmbientOcclusionEffectInstance implements Cinema2EffectInstance {
  private readonly label: string
  private readonly pass: FullscreenPass
  private composite: ShaderProgram | null = null
  private occlusion: ShaderProgram | null = null
  private blur: ShaderProgram | null = null
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, effect: Readonly<Cinema2EffectManifest>) {
    this.label = `Cinema2/Effect/AmbientOcclusion/${effect.id}`
    this.pass = new FullscreenPass(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl } = this
    const p = context.parameters
    const tier = cinema2RenderQualityProfile(context.quality).ambientOcclusion
    const depthInput = context.inputs.find(input => input.attachment === 'depth') ?? null
    const camera = context.camera
    const inverse = camera ? invertCinema2Matrix4(camera.viewProjectionMatrix) : null
    const radius = clamp(number(p, 'radius', 0.5), 0.01, 100)
    const intensity = clamp(number(p, 'intensity', 1), 0, 4)
    const output: Cinema2AmbientOcclusionOutput = p.output === 'occlusion' ? 'occlusion' : 'composite'
    const active = tier.enabled && tier.samples > 0 && depthInput != null && camera != null && inverse != null && intensity > 0

    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)

    const composite = this.composite ??= createProgram(gl, `${this.label}/composite`, COMPOSITE_SOURCE, ['u_source'], [
      'u_occlusion', 'u_depth', 'u_invViewProj', 'u_cameraPosition', 'u_occlusionTexel', 'u_active', 'u_taps', 'u_tolerance',
      'u_intensity', 'u_power', 'u_emissiveProtect', 'u_mix', 'u_debug',
    ])
    if (!active || !depthInput || !camera || !inverse) {
      composite.activate()
      composite.setInt('u_active', 0)
      this.pass.run(composite, context.target, context.width, context.height, [
        { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
        { unit: 1, texture: context.input.texture, uniformName: 'u_occlusion' },
        { unit: 2, texture: context.input.texture, uniformName: 'u_depth' },
      ])
      return
    }

    const occlusionProgram = this.occlusion ??= createProgram(gl, `${this.label}/occlusion`, OCCLUSION_SOURCE, ['u_depth'], [
      'u_invViewProj', 'u_viewProj', 'u_cameraPosition', 'u_depthTexel', 'u_radius', 'u_bias', 'u_samples', 'u_maxDistance',
    ])
    const taps = Math.round(tier.denoiseTaps * clamp(number(p, 'denoise', 1), 0, 1))
    const blurProgram = taps > 0 ? (this.blur ??= createProgram(gl, `${this.label}/blur`, BLUR_SOURCE, ['u_occlusion'], ['u_texel', 'u_axis', 'u_taps', 'u_tolerance'])) : null

    const pool = getCinema2RenderTargetPool(gl)
    const aoWidth = Math.max(1, Math.round(context.width * tier.resolutionScale))
    const aoHeight = Math.max(1, Math.round(context.height * tier.resolutionScale))
    let first: Cinema2PooledTarget | null = null
    let second: Cinema2PooledTarget | null = null
    try {
      first = pool.acquire(aoWidth, aoHeight, 'rgba16f', 'nearest')
      occlusionProgram.activate()
      occlusionProgram.setMat4('u_invViewProj', inverse)
      occlusionProgram.setMat4('u_viewProj', Float32Array.from(camera.viewProjectionMatrix))
      occlusionProgram.setVec3('u_cameraPosition', camera.position[0], camera.position[1], camera.position[2])
      occlusionProgram.setVec2('u_depthTexel', 1 / depthInput.width, 1 / depthInput.height)
      occlusionProgram.setFloat('u_radius', radius)
      occlusionProgram.setFloat('u_bias', clamp(number(p, 'bias', 0.05), 0, 0.5))
      occlusionProgram.setInt('u_samples', tier.samples)
      occlusionProgram.setFloat('u_maxDistance', clamp(number(p, 'maxDistance', 100), 1, 2000))
      this.pass.run(occlusionProgram, first.framebuffer, aoWidth, aoHeight, [{ unit: 0, texture: depthInput.texture, uniformName: 'u_depth' }])

      let blurred = first
      const tolerance = radius * 0.5
      if (blurProgram) {
        second = pool.acquire(aoWidth, aoHeight, 'rgba16f', 'nearest')
        blurProgram.activate()
        blurProgram.setVec2('u_texel', 1 / aoWidth, 1 / aoHeight)
        blurProgram.setVec2('u_axis', 1, 0)
        blurProgram.setInt('u_taps', taps)
        blurProgram.setFloat('u_tolerance', tolerance)
        this.pass.run(blurProgram, second.framebuffer, aoWidth, aoHeight, [{ unit: 0, texture: first.texture, uniformName: 'u_occlusion' }])
        blurred = second
      }

      composite.activate()
      composite.setMat4('u_invViewProj', inverse)
      composite.setVec3('u_cameraPosition', camera.position[0], camera.position[1], camera.position[2])
      composite.setVec2('u_occlusionTexel', 1 / aoWidth, 1 / aoHeight)
      composite.setInt('u_active', 1)
      composite.setInt('u_taps', taps)
      composite.setFloat('u_tolerance', tolerance)
      composite.setFloat('u_intensity', intensity)
      composite.setFloat('u_power', clamp(number(p, 'power', 1), 0.25, 4))
      composite.setFloat('u_emissiveProtect', clamp(number(p, 'emissiveProtect', 0.85), 0, 1))
      composite.setFloat('u_mix', context.mix)
      composite.setInt('u_debug', output === 'occlusion' ? 1 : 0)
      this.pass.run(composite, context.target, context.width, context.height, [
        { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
        { unit: 1, texture: blurred.texture, uniformName: 'u_occlusion' },
        { unit: 2, texture: depthInput.texture, uniformName: 'u_depth' },
      ])
      assertCinema2NoGlErrors(gl, 'Ambient occlusion draw')
    } finally {
      if (first) pool.release(first)
      if (second) pool.release(second)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.pass.dispose()
    this.composite?.dispose()
    this.occlusion?.dispose()
    this.blur?.dispose()
    // The pooled occlusion targets are shared; free whatever is idle now (live targets of other effects are untouched).
    getCinema2RenderTargetPool(this.gl).flush()
  }
}

export const cinema2AmbientOcclusionEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_AMBIENT_OCCLUSION_EFFECT_TYPE_ID,
  version: CINEMA2_AMBIENT_OCCLUSION_EFFECT_VERSION,
  label: 'Ambient Occlusion',
  validate: (effect: Readonly<Cinema2EffectManifest>) => {
    const diagnostics = [...validateEffectParameters(effect, NUMERIC)]
    const output = effect.parameters?.output
    if (output !== undefined && output !== 'composite' && output !== 'occlusion') {
      diagnostics.push({ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.output', message: 'Effect parameter "output" must be "composite" or "occlusion".' })
    }
    return Object.freeze(diagnostics)
  },
  create: ({ gl, effect }: Readonly<Cinema2EffectCreateContext>) => new AmbientOcclusionEffectInstance(gl, effect),
})

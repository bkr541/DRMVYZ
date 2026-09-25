import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2EffectManifest,
  type Cinema2EffectTypeId,
  type Cinema2RenderQualityLevel,
} from '../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../runtime/Cinema2GpuValidation'
import type { Cinema2AssetTextureService, Cinema2TextureHandle } from '../assets/Cinema2AssetTextureService'
import { cinema2TextureAssetRegistry } from '../assets/Cinema2TextureAssetManifest'
import {
  CINEMA2_SHADOW_GLSL_FUNCTIONS,
  CINEMA2_SHADOW_GLSL_UNIFORMS,
  CINEMA2_SHADOW_UNIFORM_NAMES,
  CINEMA2_SHADOW_UNIT,
  createCinema2ShadowFallbackTexture,
  uploadCinema2ShadowUniforms,
} from './Cinema2ShadowSampling'
import type {
  Cinema2EffectCreateContext,
  Cinema2EffectDiagnostic,
  Cinema2EffectInstance,
  Cinema2EffectRenderExecutionContext,
  Cinema2EffectTypeDefinition,
} from './Cinema2EffectContracts'
import {
  clampEffectValue as clamp,
  readEffectColor,
  readEffectNumber as number,
  setEffectUniformArray,
  validateEffectParameters,
  type Cinema2EffectNumericRange,
} from './Cinema2EffectParameterHelpers'
import {
  CINEMA2_VOLUMETRIC_MAX_LIGHTS,
  invertCinema2Matrix4,
  packCinema2VolumetricLights,
} from './Cinema2VolumetricAtmosphereEffect'

/**
 * Reflective floor: a virtual infinite glossy plane at `floorY`, so a preset gets a wet stage floor
 * without authoring floor geometry.
 *
 * For each pixel the view ray is intersected with the plane. Where the plane is nearer than the scene
 * depth the pixel becomes floor (so pillars, screens and performers still occlude it), shaded with a
 * dark base, light pools and specular streaks from the shared light list, plus a screen-space
 * reflection: the mirrored ray is marched through the depth buffer and the scene color it hits is
 * blended in with a Fresnel weight. Optional `grit` (0-1, default 0) turns the mirror into wet concrete: damp patches, rippled
 * reflections and dark cracks from world-anchored noise, at `gritScale` world units per patch. Optional `surfaceTexture` names a shipped texture
 * (layout `surface-normal-crack-roughness`, see the texture registry) that replaces the procedural ripples with a real normal map, crack mask and
 * roughness map, tiled every `surfaceTextureScale` world units and blended in by `surfaceTextureStrength`; it fades in once loaded, and a missing or
 * failed texture leaves the procedural look untouched. The shadow-casting light (`config.castShadow`, roadmap #10) is occluded in its floor
 * pool and specular by the engine shadow map, scaled by `shadowStrength` (0-1, default 1). It needs the scene depth; without a depth input, or without a world camera, the effect passes
 * the image through unchanged.
 *
 * Screen-space limits, by design: only what is visible on screen can be reflected, reflections fade out
 * toward the screen edge, and rough reflections are a small blur rather than a true cone. Place it BEFORE
 * volumetric atmosphere and give that effect the same `floorY` so haze stops at the floor and reflects in it.
 */
export const CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID = cinema2StableId<Cinema2EffectTypeId>('reflective-floor')
export const CINEMA2_REFLECTIVE_FLOOR_EFFECT_VERSION = 1 as const

export interface Cinema2ReflectiveFloorQualityProfile {
  /** Screen-space reflection march steps. */
  steps: number
  /** Blur taps for rough reflections (1 = sharp). */
  blurTaps: number
}

export const CINEMA2_REFLECTIVE_FLOOR_QUALITY_PROFILES: Readonly<Record<Cinema2RenderQualityLevel, Readonly<Cinema2ReflectiveFloorQualityProfile>>> = Object.freeze({
  low: Object.freeze({ steps: 10, blurTaps: 1 }),
  medium: Object.freeze({ steps: 18, blurTaps: 3 }),
  high: Object.freeze({ steps: 30, blurTaps: 5 }),
})

const MAX_STEPS = 32
const MAX_LIGHTS = CINEMA2_VOLUMETRIC_MAX_LIGHTS

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_depth;
uniform float u_mix;
uniform float u_time;
uniform float u_enabled;
uniform mat4 u_viewProj;
uniform mat4 u_invViewProj;
uniform float u_floorY;
uniform vec3 u_baseColor;
uniform float u_albedo;
uniform float u_reflectivity;
uniform float u_roughness;
uniform float u_fresnel;
uniform float u_fadeDistance;
uniform vec3 u_skyColor;
uniform float u_pool;
uniform float u_specular;
uniform float u_maxReflection;
uniform float u_thickness;
uniform float u_grit;
uniform float u_gritScale;
uniform float u_baseLift;
uniform sampler2D u_surfaceTex;
uniform float u_surface;
uniform float u_surfaceScale;
uniform int u_steps;
uniform int u_blurTaps;
uniform vec3 u_ambient;
uniform int u_lightCount;
uniform vec4 u_lightPos[${MAX_LIGHTS}];
uniform vec4 u_lightDir[${MAX_LIGHTS}];
uniform vec4 u_lightCol[${MAX_LIGHTS}];
uniform float u_lightInner[${MAX_LIGHTS}];
${CINEMA2_SHADOW_GLSL_UNIFORMS}
out vec4 outColor;
${CINEMA2_SHADOW_GLSL_FUNCTIONS}

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
float fbm(vec2 p) {
  return valueNoise(p) * 0.5 + valueNoise(p * 2.03 + 17.1) * 0.25 + valueNoise(p * 4.11 + 41.7) * 0.125 + valueNoise(p * 8.3 + 5.3) * 0.0625;
}
vec3 unproject(vec2 ndc, float z) {
  vec4 p = u_invViewProj * vec4(ndc, z, 1.0);
  return p.xyz / p.w;
}

// True when the world point lies behind the visible surface at its screen position.
bool behindScene(vec3 pos, vec3 origin, out vec2 uv, out float overshoot) {
  vec4 clip = u_viewProj * vec4(pos, 1.0);
  overshoot = 0.0;
  uv = vec2(0.0);
  if (clip.w <= 0.0001) return false;
  vec3 ndc = clip.xyz / clip.w;
  if (abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0 || ndc.z > 1.0) return false;
  uv = ndc.xy * 0.5 + 0.5;
  float d = texture(u_depth, uv).r;
  if (d >= 0.99999) return false;
  float sceneDistance = length(unproject(ndc.xy, d * 2.0 - 1.0) - origin);
  overshoot = length(pos - origin) - sceneDistance;
  return overshoot > 0.0;
}

// Marches the mirrored ray through the depth buffer. Returns the hit uv in xy and 1/0 in z.
vec3 traceReflection(vec3 hitPoint, vec3 reflected, vec3 origin) {
  float jitter = hash21(gl_FragCoord.xy + fract(u_time * 0.618) * 977.0);
  float previousT = 0.0;
  for (int i = 0; i < ${MAX_STEPS}; i++) {
    if (i >= u_steps) break;
    // Quadratic spacing: fine near the floor where reflections carry the most detail.
    float s = (float(i) + 0.5 + jitter * 0.5) / float(u_steps);
    float t = u_maxReflection * s * s;
    vec3 pos = hitPoint + reflected * t;
    vec2 uv;
    float overshoot;
    if (behindScene(pos, origin, uv, overshoot) && overshoot < u_thickness + t * 0.06) {
      // Bisect between the last miss and this hit to tighten the silhouette.
      float lo = previousT;
      float hi = t;
      for (int k = 0; k < 4; k++) {
        float mid = 0.5 * (lo + hi);
        vec2 midUv;
        float midOvershoot;
        if (behindScene(hitPoint + reflected * mid, origin, midUv, midOvershoot)) { hi = mid; uv = midUv; } else { lo = mid; }
      }
      return vec3(uv, 1.0);
    }
    previousT = t;
  }
  return vec3(0.0);
}

vec3 sampleReflectionColor(vec2 uv, float travelled, float roughnessScale) {
  vec3 sum = texture(u_source, uv).rgb;
  if (u_blurTaps <= 1 || u_roughness * roughnessScale <= 0.01) return sum;
  float radius = u_roughness * roughnessScale * (0.004 + 0.028 * clamp(travelled / max(u_maxReflection, 0.001), 0.0, 1.0));
  float total = 1.0;
  for (int i = 0; i < 4; i++) {
    if (i >= u_blurTaps - 1) break;
    float angle = 1.5707963 * float(i) + 0.7853982;
    vec2 tap = uv + vec2(cos(angle), sin(angle)) * radius;
    sum += texture(u_source, clamp(tap, vec2(0.0), vec2(1.0))).rgb;
    total += 1.0;
  }
  return sum / total;
}

// Diffuse pools and wet-look specular from the shared light list. The floor normal is +Y.
void floorLighting(vec3 point, vec3 viewDir, out vec3 diffuse, out vec3 specular) {
  diffuse = vec3(0.0);
  specular = vec3(0.0);
  float shininess = mix(10.0, 420.0, pow(1.0 - u_roughness, 2.0));
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_lightCount) break;
    vec4 color = u_lightCol[i];
    int kind = int(color.w + 0.5);
    vec3 toLight;
    float attenuation = 1.0;
    if (kind == 1) {
      toLight = -u_lightDir[i].xyz;
    } else {
      vec3 delta = u_lightPos[i].xyz - point;
      float dist = length(delta);
      toLight = delta / max(dist, 0.0001);
      float x = dist / max(u_lightPos[i].w, 0.0001);
      attenuation = (1.0 / (1.0 + 4.0 * x * x)) * clamp(1.0 - x * x * x * x, 0.0, 1.0);
      if (kind == 3) attenuation *= smoothstep(u_lightDir[i].w, u_lightInner[i], dot(-toLight, u_lightDir[i].xyz));
    }
    // The shadow-casting light is occluded by the engine shadow map (towers, slabs, ...).
    if (i == u_shadowIndex) attenuation *= shadowVisibility(point);
    float lambert = max(toLight.y, 0.0);
    diffuse += color.rgb * attenuation * lambert;
    vec3 halfway = normalize(toLight + viewDir);
    specular += color.rgb * attenuation * pow(max(halfway.y, 0.0), shininess) * step(0.0001, toLight.y);
  }
}

void main() {
  vec4 base = texture(u_source, v_uv);
  if (u_enabled < 0.5) { outColor = base; return; }

  vec2 ndc = v_uv * 2.0 - 1.0;
  vec3 origin = unproject(ndc, -1.0);
  vec3 rayDir = normalize(unproject(ndc, 1.0) - origin);
  // Only a camera above the plane, looking down at it, can see the floor.
  if (origin.y <= u_floorY || rayDir.y > -0.0005) { outColor = base; return; }
  float planeDistance = (u_floorY - origin.y) / rayDir.y;
  float depth = texture(u_depth, v_uv).r;
  float sceneDistance = depth < 0.99999 ? length(unproject(ndc, depth * 2.0 - 1.0) - origin) : 1.0e9;
  if (planeDistance >= sceneDistance) { outColor = base; return; }

  vec3 hitPoint = origin + rayDir * planeDistance;
  vec3 viewDir = normalize(origin - hitPoint);
  vec3 reflected = vec3(rayDir.x, -rayDir.y, rayDir.z);

  // Wet concrete: large damp patches, fine ripples that break the mirror into streaks, and thin dark cracks. All noise is
  // anchored to world position, so the surface stays put as the camera flies over it. Off (u_grit = 0) it is a perfect mirror.
  float wet = 1.0;
  float crack = 0.0;
  float roughnessScale = 1.0;
  float lightness = 1.0;
  vec3 bump = vec3(0.0, 1.0, 0.0);
  if (u_grit > 0.001) {
    vec2 gp = hitPoint.xz / max(u_gritScale, 0.01);
    float patches = fbm(gp * 0.45);
    wet = mix(1.0, smoothstep(0.36, 0.6, patches), u_grit);
    float ridge = abs(fbm(gp * 1.7 + 3.7) - 0.5);
    crack = (1.0 - smoothstep(0.0, 0.035, ridge)) * u_grit;
    // Perturb the surface normal with two fine noise fields (stretched along the flight axis, like tyre-worn concrete).
    vec2 rp = vec2(hitPoint.x / max(u_gritScale, 0.01) * 9.0, hitPoint.z / max(u_gritScale, 0.01) * 3.6);
    vec2 speckle = vec2(valueNoise(gp * 26.0), valueNoise(gp * 26.0 + 7.7)) - 0.5;
    bump = normalize(vec3((fbm(rp) - 0.5) * 0.34 * u_grit + speckle.x * 0.16 * u_grit, 1.0, (fbm(rp + 31.3) - 0.5) * 0.34 * u_grit + speckle.y * 0.16 * u_grit));
    roughnessScale = 1.0 + 3.0 * u_grit * (1.0 - wet * (1.0 - crack));
    lightness = 1.0 + 1.6 * u_grit * (fbm(gp * 3.1 + 9.0) - 0.4) - 0.8 * crack;
  }
  // Shipped surface texture: two samples at unrelated scales/rotations hide the repeat. The procedural fine ripples give way to the map's normals,
  // its crack mask darkens and dulls the mirror, and its roughness channel drives the reflection blur.
  if (u_surface > 0.001) {
    vec2 sp = hitPoint.xz / max(u_surfaceScale, 0.01);
    vec4 t1 = texture(u_surfaceTex, sp);
    vec4 t2 = texture(u_surfaceTex, mat2(0.8, -0.6, 0.6, 0.8) * sp * 0.37 + 0.41);
    vec2 texNormal = (t1.rg - 0.5) * 2.0 + (t2.rg - 0.5) * 1.3;
    float texCrack = max(t1.b, t2.b * 0.7);
    float texRough = mix(t1.a, t2.a, 0.4);
    vec2 keep = bump.xz * (1.0 - 0.75 * u_surface);
    bump = normalize(vec3(keep.x + texNormal.x * 0.42 * u_surface, 1.0, keep.y + texNormal.y * 0.42 * u_surface));
    crack = max(crack, texCrack * u_surface);
    roughnessScale = mix(roughnessScale, roughnessScale * (0.35 + 2.4 * texRough), u_surface);
    lightness *= 1.0 + u_surface * (0.7 * (texRough - 0.45) - 0.7 * texCrack);
  }
  if (u_grit > 0.001 || u_surface > 0.001) {
    reflected = reflect(rayDir, bump);
    reflected.y = abs(reflected.y);
  }

  vec3 hit = traceReflection(hitPoint, reflected, origin);
  vec3 environment = u_skyColor;
  if (hit.z > 0.5) {
    vec2 edge = min(hit.xy, 1.0 - hit.xy);
    float edgeFade = smoothstep(0.0, 0.1, min(edge.x, edge.y));
    environment = mix(u_skyColor, sampleReflectionColor(hit.xy, length(hit.xy - v_uv), roughnessScale), edgeFade);
  }

  vec3 diffuse;
  vec3 specular;
  floorLighting(hitPoint, viewDir, diffuse, specular);
  float cosTheta = clamp(viewDir.y, 0.0, 1.0);
  float fresnel = u_reflectivity * (0.15 + 0.85 * pow(1.0 - cosTheta, u_fresnel)) * mix(0.25, 1.0, wet) * (1.0 - 0.9 * crack);
  vec3 surface = (u_baseColor * u_baseLift * (1.0 + u_ambient) + u_albedo * u_pool * diffuse) * max(lightness, 0.05);
  vec3 floorColor = surface * (1.0 - fresnel) + environment * fresnel + specular * u_specular * (0.4 + fresnel);

  // Fade to the untouched background toward the horizon so the plane never ends in a hard line.
  float visibility = smoothstep(u_fadeDistance, u_fadeDistance * 0.3, planeDistance);
  outColor = vec4(mix(base.rgb, floorColor, visibility * clamp(u_mix, 0.0, 1.0)), 1.0);
}`

const NUMERIC: readonly Cinema2EffectNumericRange[] = Object.freeze([
  ['floorY', -50, 50],
  ['albedo', 0, 1],
  ['reflectivity', 0, 1],
  ['roughness', 0, 1],
  ['fresnel', 0.5, 8],
  ['fadeDistance', 1, 300],
  ['poolIntensity', 0, 8],
  ['specular', 0, 8],
  ['maxReflection', 1, 120],
  ['thickness', 0.05, 10],
  ['grit', 0, 1],
  ['gritScale', 0.5, 40],
  ['baseLift', 0.1, 20],
  ['surfaceTextureScale', 0.5, 60],
  ['surfaceTextureStrength', 0, 1],
  ['shadowStrength', 0, 1],
])

/** Seconds a freshly loaded surface texture takes to fade in, so it does not pop. */
const SURFACE_FADE_IN_SEC = 0.6

const DEFAULT_BASE_COLOR: readonly [number, number, number] = Object.freeze([0.012, 0.016, 0.024]) as readonly [number, number, number]
const DEFAULT_SKY_COLOR: readonly [number, number, number] = Object.freeze([0.006, 0.008, 0.014]) as readonly [number, number, number]

class ReflectiveFloorEffectInstance implements Cinema2EffectInstance {
  private readonly program: ShaderProgram
  private readonly pass: FullscreenPass
  private disposed = false
  private readonly textureAssetId: string | null
  private textureHandle: Cinema2TextureHandle | null = null
  private textureQuality: Cinema2RenderQualityLevel | null = null
  private textureReadySinceSec: number | null = null
  private readonly fallbackShadowTexture: WebGLTexture | null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    effect: Readonly<Cinema2EffectManifest>,
    private readonly textures?: Cinema2AssetTextureService,
  ) {
    const assetId = effect.parameters?.surfaceTexture
    this.textureAssetId = typeof assetId === 'string' && assetId.trim() ? assetId.trim() : null
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      label: `Cinema2/Effect/ReflectiveFloor/${effect.id}`,
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FRAGMENT_SOURCE,
      requiredUniforms: ['u_source', 'u_mix'],
      optionalUniforms: [
        'u_depth', 'u_time', 'u_enabled', 'u_viewProj', 'u_invViewProj', 'u_floorY', 'u_baseColor', 'u_albedo', 'u_reflectivity',
        'u_roughness', 'u_fresnel', 'u_fadeDistance', 'u_skyColor', 'u_pool', 'u_specular', 'u_maxReflection', 'u_thickness', 'u_grit', 'u_gritScale', 'u_baseLift', 'u_surfaceTex', 'u_surface', 'u_surfaceScale', ...CINEMA2_SHADOW_UNIFORM_NAMES,
        'u_steps', 'u_blurTaps', 'u_ambient', 'u_lightCount', 'u_lightPos[0]', 'u_lightDir[0]', 'u_lightCol[0]', 'u_lightInner[0]',
      ],
    })
    if (!result.program) throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
    this.program = result.program
    this.pass = new FullscreenPass(gl)
    this.fallbackShadowTexture = createCinema2ShadowFallbackTexture(gl)
  }

  render(context: Readonly<Cinema2EffectRenderExecutionContext>): void {
    if (this.disposed) return
    const { gl, program } = this
    const p = context.parameters
    const profile = CINEMA2_REFLECTIVE_FLOOR_QUALITY_PROFILES[context.quality]
    const camera = context.camera
    const inverse = camera ? invertCinema2Matrix4(camera.viewProjectionMatrix) : null
    const depthInput = context.inputs.find(input => input.attachment === 'depth') ?? null
    // The floor is only meaningful when it can be depth-tested against the scene and viewed from a world camera.
    const active = camera != null && inverse != null && depthInput != null
    const shadow = context.shadow ?? null
    const lights = packCinema2VolumetricLights(context.lightingEnvironment?.lights ?? [], shadow?.lightId ?? null)
    const base = readEffectColor(p.baseColor, DEFAULT_BASE_COLOR)
    const sky = readEffectColor(p.skyColor, DEFAULT_SKY_COLOR)

    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)
    program.activate()
    program.setFloat('u_mix', context.mix)
    program.setFloat('u_time', context.frame.elapsedTimeSec)
    program.setFloat('u_enabled', active ? 1 : 0)
    if (camera && inverse) {
      program.setMat4('u_viewProj', new Float32Array(camera.viewProjectionMatrix))
      program.setMat4('u_invViewProj', inverse)
    }
    program.setFloat('u_floorY', clamp(number(p, 'floorY', 0), -50, 50))
    program.setVec3('u_baseColor', base[0], base[1], base[2])
    program.setFloat('u_albedo', clamp(number(p, 'albedo', 0.12), 0, 1))
    program.setFloat('u_reflectivity', clamp(number(p, 'reflectivity', 0.65), 0, 1))
    program.setFloat('u_roughness', clamp(number(p, 'roughness', 0.22), 0, 1))
    program.setFloat('u_fresnel', clamp(number(p, 'fresnel', 3), 0.5, 8))
    program.setFloat('u_fadeDistance', clamp(number(p, 'fadeDistance', 45), 1, 300))
    program.setVec3('u_skyColor', sky[0], sky[1], sky[2])
    program.setFloat('u_pool', clamp(number(p, 'poolIntensity', 1), 0, 8))
    program.setFloat('u_specular', clamp(number(p, 'specular', 1), 0, 8))
    program.setFloat('u_maxReflection', clamp(number(p, 'maxReflection', 30), 1, 120))
    program.setFloat('u_thickness', clamp(number(p, 'thickness', 1.2), 0.05, 10))
    program.setFloat('u_grit', clamp(number(p, 'grit', 0), 0, 1))
    program.setFloat('u_gritScale', clamp(number(p, 'gritScale', 6), 0.5, 40))
    program.setFloat('u_baseLift', clamp(number(p, 'baseLift', 1), 0.1, 20))
    const surface = this.surfaceAmount(context, clamp(number(p, 'surfaceTextureStrength', 1), 0, 1))
    program.setFloat('u_surface', surface)
    program.setFloat('u_surfaceScale', clamp(number(p, 'surfaceTextureScale', 6), 0.5, 60))
    program.setInt('u_steps', profile.steps)
    program.setInt('u_blurTaps', profile.blurTaps)
    program.setVec3('u_ambient', lights.ambient[0], lights.ambient[1], lights.ambient[2])
    program.setInt('u_lightCount', lights.count)
    setEffectUniformArray(gl, program, 'u_lightPos[0]', lights.position, 4)
    setEffectUniformArray(gl, program, 'u_lightDir[0]', lights.direction, 4)
    setEffectUniformArray(gl, program, 'u_lightCol[0]', lights.color, 4)
    setEffectUniformArray(gl, program, 'u_lightInner[0]', lights.inner, 1)
    uploadCinema2ShadowUniforms(program, shadow, lights.shadowIndex, clamp(number(p, 'shadowStrength', 1), 0, 1))
    this.pass.run(program, context.target, context.width, context.height, [
      { unit: 0, texture: context.input.texture, uniformName: 'u_source' },
      // Without a depth input unit 1 re-binds the color texture; u_enabled keeps the shader from using it.
      { unit: 1, texture: depthInput?.texture ?? context.input.texture, uniformName: 'u_depth' },
      // Unit 2 falls back to the colour texture while the surface texture is absent; u_surface = 0 keeps the shader from sampling it.
      { unit: 2, texture: surface > 0 ? this.textureHandle!.texture! : context.input.texture, uniformName: 'u_surfaceTex' },
      ...((shadow?.texture ?? this.fallbackShadowTexture) ? [{ unit: CINEMA2_SHADOW_UNIT, texture: (shadow?.texture ?? this.fallbackShadowTexture)!, uniformName: 'u_shadowMap' }] : []),
    ])
    assertCinema2NoGlErrors(gl, 'Reflective floor draw')
  }

  /** 0 until the texture is ready, then ramps to `strength`. Re-acquires when the quality tier (and so the resolution variant) changes. */
  private surfaceAmount(context: Readonly<Cinema2EffectRenderExecutionContext>, strength: number): number {
    if (!this.textureAssetId || !this.textures || strength <= 0) return 0
    if (this.textureQuality !== context.quality) {
      this.textureHandle?.release()
      this.textureHandle = this.textures.acquire(this.textureAssetId, context.quality)
      this.textureQuality = context.quality
      this.textureReadySinceSec = null
    }
    const handle = this.textureHandle
    if (!handle || handle.status !== 'ready' || !handle.texture) return 0
    const now = context.frame.elapsedTimeSec
    this.textureReadySinceSec ??= now
    return strength * clamp((now - this.textureReadySinceSec) / SURFACE_FADE_IN_SEC, 0, 1)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.textureHandle?.release()
    this.textureHandle = null
    if (this.fallbackShadowTexture) this.gl.deleteTexture(this.fallbackShadowTexture)
    this.pass.dispose()
    this.program.dispose()
  }
}

export const cinema2ReflectiveFloorEffectDefinition: Readonly<Cinema2EffectTypeDefinition> = Object.freeze({
  typeId: CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID,
  version: CINEMA2_REFLECTIVE_FLOOR_EFFECT_VERSION,
  label: 'Reflective Floor',
  validate: (effect: Readonly<Cinema2EffectManifest>) => [
    ...validateEffectParameters(effect, NUMERIC, ['baseColor', 'skyColor']),
    ...validateSurfaceTexture(effect),
  ],
  create: ({ gl, effect, textures }: Readonly<Cinema2EffectCreateContext>) => new ReflectiveFloorEffectInstance(gl, effect, textures),
})

function validateSurfaceTexture(effect: Readonly<Cinema2EffectManifest>): readonly Cinema2EffectDiagnostic[] {
  const value = effect.parameters?.surfaceTexture
  if (value === undefined) return []
  const record = typeof value === 'string' ? cinema2TextureAssetRegistry.get(value.trim()) : null
  if (!record) {
    return [{ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.surfaceTexture', message: 'Effect parameter "surfaceTexture" must be the id of a registered texture asset.' }]
  }
  if (record.layout !== 'surface-normal-crack-roughness') {
    return [{ code: 'CINEMA2_EFFECT_PARAMETER_INVALID', path: '$.parameters.surfaceTexture', message: `Texture asset "${record.id}" has layout "${record.layout}", but the reflective floor needs "surface-normal-crack-roughness".` }]
  }
  return []
}

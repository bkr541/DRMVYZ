import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('reactor-native-render')
export const CINEMA2_REACTOR_NATIVE_MODULE_VERSION = 1 as const

const GENERATOR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_coreSize;
uniform float u_coreIntensity;
uniform float u_rayDensity;
uniform float u_energyResponse;
uniform float u_bassResponse;
uniform float u_impactBurst;
uniform float u_mediaInfluence;
uniform sampler2D u_userMedia;
uniform float u_userMediaAvailable;
uniform float u_userMediaOpacity;
uniform sampler2D u_albumArtwork;
uniform float u_albumArtworkAvailable;
uniform float u_albumArtworkOpacity;
uniform sampler2D u_mediaOutput;
uniform float u_mediaOutputAvailable;
uniform float u_mediaOutputOpacity;
uniform vec4 u_primaryColor;
uniform vec4 u_secondaryColor;
uniform vec4 u_accentColor;
out vec4 outColor;

const float TAU = 6.28318530718;

float hash11(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

float segmentDistance(vec2 point, vec2 startPoint, vec2 endPoint) {
  vec2 offset = point - startPoint;
  vec2 segment = endPoint - startPoint;
  float position = clamp(dot(offset, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
  return length(offset - segment * position);
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 point = v_uv * 2.0 - 1.0;
  point.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float energy = clamp(u_energyResponse + u_impactBurst * 0.32, 0.0, 1.5);
  float bass = clamp(u_bassResponse, 0.0, 1.5);
  float impact = clamp(u_impactBurst, 0.0, 1.5);
  float spin = u_time * (0.055 + energy * 0.05 + impact * 0.018);
  vec2 local = rotate2d(spin) * point;
  float radius = length(local);
  float angle = atan(local.y, local.x);

  float coreRadius = max(0.08, u_coreSize) * (0.78 + bass * 0.18 + impact * 0.04);
  float segmented = 0.5 + 0.5 * cos(angle * 8.0 + u_time * 0.42);
  float outerRing = exp(-abs(radius - coreRadius) * (48.0 - energy * 12.0)) * mix(0.42, 1.0, segmented);
  float innerRing = exp(-abs(radius - coreRadius * 0.57) * 68.0);
  float diamond = exp(-abs(abs(local.x) + abs(local.y) - coreRadius * 0.72) * 52.0);
  float coreGlow = exp(-radius * (5.2 - bass * 1.5));

  float rays = 0.0;
  float hotRays = 0.0;
  float rayCount = mix(8.0, 34.0, clamp(u_rayDensity, 0.0, 1.0));
  for (int index = 0; index < 36; index++) {
    float ordinal = float(index);
    if (ordinal >= rayCount) break;
    float seed = hash11(ordinal * 9.73 + 2.17);
    float rayAngle = ordinal / rayCount * TAU + (seed - 0.5) * 0.24 + spin * (0.45 + seed * 0.2);
    vec2 direction = vec2(cos(rayAngle), sin(rayAngle));
    float travel = fract(u_time * (0.055 + seed * 0.075) + seed * 3.17);
    float startDistance = coreRadius * (0.72 + seed * 0.34) + travel * (0.08 + energy * 0.18);
    float rayLength = 0.13 + seed * 0.25 + bass * 0.08 + impact * 0.045;
    vec2 startPoint = direction * startDistance;
    vec2 endPoint = direction * (startDistance + rayLength);
    float distanceToRay = segmentDistance(local, startPoint, endPoint);
    float line = exp(-distanceToRay * (145.0 - seed * 32.0));
    float envelope = smoothstep(0.0, 0.13, travel) * (1.0 - smoothstep(0.72, 1.0, travel));
    rays += line * envelope;
    hotRays += line * envelope * step(0.78, seed);
  }

  vec3 color = vec3(0.006, 0.009, 0.016);
  color += u_primaryColor.rgb * outerRing * u_coreIntensity * (0.55 + energy * 0.8);
  color += u_secondaryColor.rgb * (innerRing * 0.52 + rays * 0.36) * (0.45 + bass * 0.75);
  color += u_accentColor.rgb * (diamond * 0.42 + hotRays * 0.68 + coreGlow * 0.12) * (0.45 + energy * 0.7 + impact * 0.42);
  color += mix(u_primaryColor.rgb, u_accentColor.rgb, 0.45) * coreGlow * 0.18;

  float userWeight = u_userMediaAvailable * u_userMediaOpacity;
  float artworkWeight = u_albumArtworkAvailable * u_albumArtworkOpacity;
  float outputWeight = u_mediaOutputAvailable * u_mediaOutputOpacity;
  float mediaWeight = userWeight + artworkWeight + outputWeight;
  if (u_mediaInfluence > 0.001 && mediaWeight > 0.001) {
    vec2 direction = radius > 0.0001 ? local / radius : vec2(0.0);
    vec2 mediaUv = clamp(v_uv + direction * sin(radius * 24.0 - u_time * 0.8) * (0.006 + bass * 0.008), vec2(0.001), vec2(0.999));
    vec3 mediaColor = (
      texture(u_userMedia, mediaUv).rgb * userWeight
      + texture(u_albumArtwork, mediaUv).rgb * artworkWeight
      + texture(u_mediaOutput, mediaUv).rgb * outputWeight
    ) / max(mediaWeight, 0.0001);
    float mediaMask = clamp(coreGlow * 0.42 + outerRing * 0.6 + rays * 0.08, 0.0, 1.0);
    color += mediaColor * mediaMask * u_mediaInfluence * (0.22 + energy * 0.24);
  }

  color = color / (vec3(1.0) + color * 0.42);
  outColor = vec4(color, 1.0);
}
`

const COMPOSITE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_refraction;
uniform float u_edgeGlow;
uniform float u_impactResponse;
uniform float u_refractionPulse;
out vec4 outColor;

void main() {
  vec2 centered = v_uv - 0.5;
  centered.x *= u_resolution.x / max(u_resolution.y, 1.0);
  float radius = length(centered);
  float impact = clamp(u_impactResponse, 0.0, 1.5);
  float refraction = clamp(u_refraction + u_refractionPulse, 0.0, 1.5);
  float ripple = sin(radius * 31.0 - u_time * 1.45) * exp(-radius * 3.2);
  vec2 direction = radius > 0.0001 ? centered / radius : vec2(0.0);
  vec2 aspectCorrection = vec2(max(u_resolution.y, 1.0) / max(u_resolution.x, 1.0), 1.0);
  vec2 offset = direction * ripple * refraction * (0.012 + impact * 0.014) * aspectCorrection;

  vec3 source = texture(u_source, clamp(v_uv + offset, vec2(0.0), vec2(1.0))).rgb;
  float chroma = refraction * (0.0018 + impact * 0.0015);
  float red = texture(u_source, clamp(v_uv + offset + direction * chroma * aspectCorrection, vec2(0.0), vec2(1.0))).r;
  float blue = texture(u_source, clamp(v_uv + offset - direction * chroma * aspectCorrection, vec2(0.0), vec2(1.0))).b;
  source.r = mix(source.r, red, clamp(refraction, 0.0, 1.0));
  source.b = mix(source.b, blue, clamp(refraction, 0.0, 1.0));

  float shockwave = exp(-abs(radius - (0.34 + 0.025 * sin(u_time * 0.72) + impact * 0.045)) * 54.0);
  source += vec3(0.16, 0.48, 0.72) * shockwave * u_edgeGlow * (0.22 + impact * 0.82);
  float vignette = 1.0 - smoothstep(0.55, 0.95, radius);
  outColor = vec4(source * mix(0.62, 1.0, vignette), 1.0);
}
`

type ReactorModuleVariant = 'generator' | 'composite'

function readVariant(module: Readonly<Cinema2ModuleManifest>): ReactorModuleVariant | null {
  const value = module.config?.variant
  return value === 'generator' || value === 'composite' ? value : null
}

function validate(module: Readonly<Cinema2ModuleManifest>): readonly Cinema2ModuleDiagnostic[] {
  const variant = readVariant(module)
  if (!variant) {
    return Object.freeze([Object.freeze({
      code: 'CINEMA2_REACTOR_MODULE_VARIANT_INVALID',
      path: '$.config.variant',
      message: 'Reactor native render module variant must be "generator" or "composite".',
    })])
  }
  const required = variant === 'generator'
    ? ['coreSize', 'coreIntensity', 'rayDensity', 'energyResponse', 'bassResponse', 'impactBurst', 'mediaInfluence', 'primaryColor', 'secondaryColor', 'accentColor']
    : ['refraction', 'edgeGlow', 'impactResponse', 'refractionPulse']
  const diagnostics: Cinema2ModuleDiagnostic[] = []
  for (const property of required) {
    if (module.parameters?.[property] === undefined) {
      diagnostics.push({
        code: 'CINEMA2_REACTOR_MODULE_PARAMETER_MISSING',
        path: `$.parameters.${property}`,
        message: `Reactor ${variant} module requires the "${property}" parameter.`,
      })
    }
  }
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze(diagnostic)))
}

function numberValue(context: Cinema2ModuleCreateContext, name: string, fallback: number): number {
  const value = context.parameters.get(name)
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colorValue(context: Cinema2ModuleCreateContext, name: string, fallback: readonly [number, number, number, number]): readonly [number, number, number, number] {
  const value = context.parameters.get(name)
  if (Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as unknown as readonly [number, number, number, number]
  }
  return fallback
}

function createProgram(
  gl: WebGL2RenderingContext,
  variant: ReactorModuleVariant,
): ShaderProgram {
  const generator = variant === 'generator'
  const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
    label: `Cinema2/Reactor/${variant}`,
    vertSrc: FULLSCREEN_VERT_SRC,
    fragSrc: generator ? GENERATOR_FRAGMENT_SOURCE : COMPOSITE_FRAGMENT_SOURCE,
    requiredUniforms: generator
      ? [
          'u_resolution', 'u_time', 'u_coreSize', 'u_coreIntensity', 'u_rayDensity',
          'u_energyResponse', 'u_bassResponse', 'u_impactBurst', 'u_mediaInfluence',
          'u_userMedia', 'u_userMediaAvailable', 'u_userMediaOpacity',
          'u_albumArtwork', 'u_albumArtworkAvailable', 'u_albumArtworkOpacity',
          'u_mediaOutput', 'u_mediaOutputAvailable', 'u_mediaOutputOpacity',
          'u_primaryColor', 'u_secondaryColor', 'u_accentColor',
        ]
      : ['u_source', 'u_resolution', 'u_time', 'u_refraction', 'u_edgeGlow', 'u_impactResponse', 'u_refractionPulse'],
  })
  if (!result.program) {
    throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
  }
  return result.program
}

export const cinema2ReactorNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_REACTOR_NATIVE_MODULE_VERSION,
  validate,
  create: (context: Cinema2ModuleCreateContext) => {
    const variant = readVariant(context.module)
    if (!variant) throw new Error('Reactor native render module was activated without a valid variant.')
    const provider = Object.freeze({
      id: `${context.module.id}:${variant}`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute: ({ frame, target, width, height, inputs = [] }: Cinema2ModuleRenderExecutionContext) => {
        const program = context.resources.acquire(
          `reactor-${variant}-program`,
          'WebGLProgram',
          (gl: WebGL2RenderingContext) => createProgram(gl, variant),
          (value: ShaderProgram) => value.dispose(),
        )
        const pass = context.resources.acquire(
          `reactor-${variant}-pass`,
          'FullscreenPass',
          (gl: WebGL2RenderingContext) => new FullscreenPass(gl),
          (value: FullscreenPass) => value.dispose(),
        )
        program.activate()
        program.setVec2('u_resolution', width, height)
        program.setFloat('u_time', frame.elapsedTimeSec)

        if (variant === 'generator') {
          const primary = colorValue(context, 'primaryColor', [0.12, 0.72, 1, 1])
          const secondary = colorValue(context, 'secondaryColor', [0.33, 0.22, 0.95, 1])
          const accent = colorValue(context, 'accentColor', [1, 0.28, 0.64, 1])
          program.setFloat('u_coreSize', numberValue(context, 'coreSize', 0.42))
          program.setFloat('u_coreIntensity', numberValue(context, 'coreIntensity', 1.15))
          program.setFloat('u_rayDensity', numberValue(context, 'rayDensity', 0.62))
          program.setFloat('u_energyResponse', numberValue(context, 'energyResponse', 0))
          program.setFloat('u_bassResponse', numberValue(context, 'bassResponse', 0))
          program.setFloat('u_impactBurst', numberValue(context, 'impactBurst', 0))
          program.setFloat('u_mediaInfluence', numberValue(context, 'mediaInfluence', 0.34))
          const userMedia = context.media.get('userMedia')
          const albumArtwork = context.media.get('albumArtwork')
          const mediaOutput = context.media.get('mediaOutput')
          program.setFloat('u_userMediaAvailable', userMedia ? 1 : 0)
          program.setFloat('u_userMediaOpacity', userMedia?.presentation.opacity ?? 0)
          program.setFloat('u_albumArtworkAvailable', albumArtwork ? 1 : 0)
          program.setFloat('u_albumArtworkOpacity', albumArtwork?.presentation.opacity ?? 0)
          program.setFloat('u_mediaOutputAvailable', mediaOutput ? 1 : 0)
          program.setFloat('u_mediaOutputOpacity', mediaOutput?.presentation.opacity ?? 0)
          program.setVec4('u_primaryColor', primary[0], primary[1], primary[2], primary[3])
          program.setVec4('u_secondaryColor', secondary[0], secondary[1], secondary[2], secondary[3])
          program.setVec4('u_accentColor', accent[0], accent[1], accent[2], accent[3])
          const textures = [
            userMedia ? { unit: 0, texture: userMedia.texture, uniformName: 'u_userMedia' } : null,
            albumArtwork ? { unit: 1, texture: albumArtwork.texture, uniformName: 'u_albumArtwork' } : null,
            mediaOutput ? { unit: 2, texture: mediaOutput.texture, uniformName: 'u_mediaOutput' } : null,
          ].filter((binding): binding is { unit: number; texture: WebGLTexture; uniformName: string } => binding != null)
          pass.run(program, target, width, height, textures)
          return
        }

        const source = inputs.find(input => input.attachment === 'color')
        if (!source) throw new Error('Reactor composite requires one upstream color input.')
        program.setFloat('u_refraction', numberValue(context, 'refraction', 0.42))
        program.setFloat('u_edgeGlow', numberValue(context, 'edgeGlow', 0.72))
        program.setFloat('u_impactResponse', numberValue(context, 'impactResponse', 0))
        program.setFloat('u_refractionPulse', numberValue(context, 'refractionPulse', 0))
        pass.run(program, target, width, height, [{ unit: 0, texture: source.texture, uniformName: 'u_source' }])
      },
    })

    return {
      lifecycle: { update: () => {}, dispose: () => {} },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

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
import { Cinema2SyncedMotionClockResolver } from './Cinema2SyncedMotionClock'

export const CINEMA2_REACTOR_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('reactor-native-render')
export const CINEMA2_REACTOR_NATIVE_MODULE_VERSION = 3 as const

const GENERATOR_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_coreSize;
uniform float u_coreIntensity;
uniform float u_rotationSpeed;
uniform float u_rayDensity;
uniform float u_energyResponse;
uniform float u_buildResponse;
uniform float u_buildContraction;
uniform float u_bassResponse;
uniform float u_impactBurst;
uniform float u_mediaInfluence;
uniform float u_patternSeed;
uniform vec4 u_backgroundColor;
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
const float GOLDEN_ANGLE = 2.39996322973;

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

  float energy = clamp(u_energyResponse + u_impactBurst * 0.58, 0.0, 2.0);
  float build = clamp(u_buildResponse, 0.0, 1.5);
  float bass = clamp(u_bassResponse, 0.0, 1.5);
  float impact = clamp(u_impactBurst, 0.0, 2.0);
  float spin = u_time * u_rotationSpeed * (0.52 + energy * 0.24 + impact * 0.12);
  vec2 local = rotate2d(spin) * point;
  float radius = length(local);
  float angle = atan(local.y, local.x);

  float buildScale = 1.0 - clamp(u_buildContraction, 0.0, 1.0) * build * 0.26;
  float releaseScale = 1.0 + impact * 0.18 + bass * 0.12;
  float coreRadius = max(0.08, u_coreSize) * buildScale * releaseScale;

  float cellCount = 10.0;
  float cellPhase = angle * cellCount + u_time * (0.18 + u_rotationSpeed * 0.12);
  float cellDefinition = smoothstep(0.18, 0.9, abs(cos(cellPhase)));
  float segmentedRing = exp(-abs(radius - coreRadius) * (44.0 - energy * 8.0)) * mix(0.2, 1.0, cellDefinition);
  float innerRing = exp(-abs(radius - coreRadius * 0.58) * 70.0);
  float outerHalo = exp(-abs(radius - coreRadius * 1.36) * 20.0) * (0.15 + energy * 0.22 + impact * 0.28);
  float spokes = exp(-abs(sin(cellPhase * 0.5 + u_time * 0.22)) * 17.0)
    * smoothstep(coreRadius * 0.25, coreRadius * 0.72, radius)
    * (1.0 - smoothstep(coreRadius * 1.5, coreRadius * 2.65, radius));

  float wobble = sin(angle * 5.0 - u_time * 0.8) * 0.055
    + sin(angle * 9.0 + u_time * 0.43) * 0.032
    + sin(angle * 13.0 - u_time * 0.21) * 0.018;
  float shellRadius = coreRadius * (0.76 + wobble * (0.45 + energy * 0.28));
  float proceduralShell = exp(-abs(radius - shellRadius) * 58.0);
  float diamond = exp(-abs(abs(local.x) + abs(local.y) - coreRadius * (0.66 + wobble * 0.2)) * 48.0);
  float coreGlow = exp(-radius * max(2.6, 5.0 - bass * 1.35 - impact * 0.55));
  float coreSpark = exp(-radius * max(7.0, 12.0 - impact * 2.5)) * (0.32 + energy * 0.55 + impact * 0.9);

  float primaryRays = 0.0;
  float secondaryRays = 0.0;
  float accentRays = 0.0;
  float hotEdges = 0.0;
  float rayCount = floor(mix(10.0, 64.0, clamp(u_rayDensity, 0.0, 1.0)));
  for (int index = 0; index < 64; index++) {
    float ordinal = float(index);
    if (ordinal >= rayCount) break;

    float seed0 = hash11(ordinal * 13.37 + u_patternSeed * 0.618);
    float seed1 = hash11(ordinal * 7.91 + u_patternSeed * 1.231 + 2.0);
    float seed2 = hash11(ordinal * 21.13 + u_patternSeed * 0.417 + 5.0);
    float seed3 = hash11(ordinal * 3.77 + u_patternSeed * 2.909 + 9.0);

    float evenAngle = ordinal / max(rayCount, 1.0) * TAU;
    float scatterAngle = ordinal * GOLDEN_ANGLE + (seed0 - 0.5) * (TAU / max(rayCount, 1.0)) * 1.6;
    float rayAngle = mix(evenAngle, scatterAngle, 0.58)
      + (seed0 - 0.5) * 0.34
      + sin(u_time * 0.16 + seed1 * TAU) * (0.025 + energy * 0.045)
      + spin * (0.22 + seed2 * 0.18)
      + impact * (seed3 - 0.5) * 0.18;
    vec2 direction = vec2(cos(rayAngle), sin(rayAngle));
    vec2 tangent = vec2(-direction.y, direction.x);

    float speed = 0.24 + seed0 * 0.92;
    float travel = fract(u_time * (0.055 + speed * 0.095) + seed2 + impact * (0.08 + speed * 0.11));
    float distanceFromOrigin = coreRadius * (0.24 + seed1 * 0.18)
      + travel * (0.44 + energy * 0.5 + impact * 0.36);
    float turbulence = sin(u_time * (0.55 + seed1 * 0.7) + seed3 * TAU) * (0.035 + energy * 0.055);
    vec2 rayCenter = direction * distanceFromOrigin + tangent * turbulence;

    float rayLength = (0.065 + seed2 * 0.3)
      * (0.82 + u_rayDensity * 0.32)
      * (1.0 + bass * 0.34 + impact * 0.72);
    float width = 118.0 - seed0 * 28.0 - energy * 10.0;
    vec2 tail = rayCenter - direction * rayLength * 0.34;
    vec2 head = rayCenter + direction * rayLength;

    float style = floor(seed1 * 5.0);
    float isTracer = 1.0 - step(0.5, abs(style - 2.0));
    float isForked = 1.0 - step(0.5, abs(style - 3.0));
    float isArc = 1.0 - step(0.5, abs(style - 4.0));

    float distanceToRay = segmentDistance(local, tail, head);
    if (isArc > 0.5) {
      vec2 midPoint = mix(tail, head, 0.52) + tangent * (seed3 - 0.5) * rayLength * 0.72;
      distanceToRay = min(segmentDistance(local, tail, midPoint), segmentDistance(local, midPoint, head));
    }
    if (isForked > 0.5) {
      vec2 forkStart = mix(tail, head, 0.62);
      vec2 forkDirection = rotate2d((seed3 - 0.5) * 0.72) * direction;
      distanceToRay = min(distanceToRay, segmentDistance(local, forkStart, forkStart + forkDirection * rayLength * 0.62));
    }

    float line = exp(-distanceToRay * width);
    vec2 axis = head - tail;
    float along = clamp(dot(local - tail, axis) / max(dot(axis, axis), 0.0001), 0.0, 1.0);
    float dashGate = mix(1.0, step(0.42, fract(along * (4.0 + seed3 * 8.0) - travel * 6.0 + seed3)), isTracer);
    float taper = mix(1.0, 1.0 - along * 0.82, step(0.75, seed0));
    float envelope = smoothstep(0.0, 0.08, travel) * (1.0 - smoothstep(0.7, 1.0, travel));
    float weightedRay = line * dashGate * taper * envelope * (0.54 + travel + energy * 0.26 + impact * 0.4);

    float primaryRole = 1.0 - step(0.62, seed1);
    float secondaryRole = step(0.62, seed1) * (1.0 - step(0.86, seed1));
    float accentRole = step(0.86, seed1);
    primaryRays += weightedRay * primaryRole;
    secondaryRays += weightedRay * secondaryRole;
    accentRays += weightedRay * accentRole;
    hotEdges += weightedRay * step(0.76, seed2);
  }

  vec3 color = u_backgroundColor.rgb;
  color += u_primaryColor.rgb * segmentedRing * u_coreIntensity * (0.62 + energy * 0.9 + impact * 0.38);
  color += u_secondaryColor.rgb * (innerRing * 0.58 + spokes * 0.46 + proceduralShell * 0.48) * (0.5 + bass * 0.88);
  color += u_accentColor.rgb * (diamond * 0.48 + coreSpark * 0.25 + outerHalo * 0.44) * (0.48 + energy * 0.72 + impact * 0.76);
  color += u_primaryColor.rgb * primaryRays * (0.48 + energy * 0.4);
  color += u_secondaryColor.rgb * secondaryRays * (0.5 + bass * 0.42);
  color += u_accentColor.rgb * accentRays * (0.64 + impact * 0.62);
  color += mix(u_primaryColor.rgb, u_accentColor.rgb, 0.46) * hotEdges * 0.3;
  color += mix(u_primaryColor.rgb, u_accentColor.rgb, 0.5) * coreGlow * (0.18 + bass * 0.24 + impact * 0.22);

  float userWeight = u_userMediaAvailable * u_userMediaOpacity;
  float artworkWeight = u_albumArtworkAvailable * u_albumArtworkOpacity;
  float outputWeight = u_mediaOutputAvailable * u_mediaOutputOpacity;
  float mediaWeight = userWeight + artworkWeight + outputWeight;
  if (u_mediaInfluence > 0.001 && mediaWeight > 0.001) {
    vec2 direction = radius > 0.0001 ? local / radius : vec2(0.0);
    vec2 mediaUv = clamp(v_uv + direction * sin(radius * 26.0 - u_time * 0.9) * (0.007 + bass * 0.011 + impact * 0.005), vec2(0.001), vec2(0.999));
    vec3 mediaColor = (
      texture(u_userMedia, mediaUv).rgb * userWeight
      + texture(u_albumArtwork, mediaUv).rgb * artworkWeight
      + texture(u_mediaOutput, mediaUv).rgb * outputWeight
    ) / max(mediaWeight, 0.0001);
    float mediaMask = clamp(coreGlow * 0.48 + segmentedRing * 0.62 + (primaryRays + secondaryRays + accentRays) * 0.055, 0.0, 1.0);
    color += mediaColor * mediaMask * u_mediaInfluence * (0.24 + energy * 0.3 + impact * 0.18);
  }

  color = vec3(1.0) - exp(-max(color, vec3(0.0)) * 0.88);
  outColor = vec4(color, 1.0);
}
`

const COMPOSITE_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_freshSource;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_refraction;
uniform float u_edgeGlow;
uniform float u_impactResponse;
uniform float u_refractionPulse;
uniform float u_shockwaveIntensity;
uniform float u_shockwavePulse;
uniform vec4 u_accentColor;
out vec4 outColor;

void main() {
  vec2 centered = v_uv * 2.0 - 1.0;
  centered.x *= u_resolution.x / max(u_resolution.y, 1.0);
  float radius = length(centered);
  float impact = clamp(u_impactResponse, 0.0, 2.0);
  float refraction = clamp(u_refraction + u_refractionPulse, 0.0, 3.0);
  float ripple = sin(radius * 24.0 - u_time * 1.7) * exp(-radius * 2.35);
  vec2 direction = radius > 0.0001 ? centered / radius : vec2(0.0);
  vec2 aspectCorrection = vec2(max(u_resolution.y, 1.0) / max(u_resolution.x, 1.0), 1.0);
  vec2 offset = direction * ripple * refraction * (0.014 + impact * 0.018) * aspectCorrection;

  vec3 historyColor = texture(u_source, clamp(v_uv + offset, vec2(0.0), vec2(1.0))).rgb;
  float chroma = refraction * (0.0022 + impact * 0.0018);
  float red = texture(u_source, clamp(v_uv + offset + direction * chroma * aspectCorrection, vec2(0.0), vec2(1.0))).r;
  float blue = texture(u_source, clamp(v_uv + offset - direction * chroma * aspectCorrection, vec2(0.0), vec2(1.0))).b;
  historyColor.r = mix(historyColor.r, red, clamp(refraction * 0.7, 0.0, 1.0));
  historyColor.b = mix(historyColor.b, blue, clamp(refraction * 0.7, 0.0, 1.0));

  vec3 freshColor = texture(u_freshSource, v_uv).rgb;
  vec3 source = max(historyColor, freshColor * (0.94 + impact * 0.08));
  source += freshColor * (0.18 + impact * 0.14);

  float pulse = clamp(u_shockwavePulse, 0.0, 1.0);
  float shockPhase = 1.0 - pulse;
  float shockRadius = mix(0.16, 1.34, shockPhase);
  float shockSharpness = mix(64.0, 24.0, shockPhase);
  float shockwave = exp(-abs(radius - shockRadius) * shockSharpness) * sqrt(max(pulse, 0.0));
  source += u_accentColor.rgb * shockwave * u_edgeGlow * u_shockwaveIntensity * (0.72 + impact * 0.78);

  float vignette = 1.0 - smoothstep(0.88, 1.55, radius);
  source *= mix(0.84, 1.0, vignette);
  source = max(source, vec3(0.0)) / (vec3(1.0) + max(source, vec3(0.0)) * 0.54);
  source = pow(source, vec3(0.4545));
  outColor = vec4(source, 1.0);
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
    ? ['coreSize', 'coreIntensity', 'rotationSpeed', 'rayDensity', 'energyResponse', 'buildResponse', 'buildContraction', 'bassResponse', 'impactBurst', 'mediaInfluence', 'backgroundColor', 'primaryColor', 'secondaryColor', 'accentColor', 'bpmSync']
    : ['refraction', 'edgeGlow', 'impactResponse', 'refractionPulse', 'shockwaveIntensity', 'shockwavePulse', 'accentColor', 'bpmSync']
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

function booleanValue(context: Cinema2ModuleCreateContext, name: string, fallback: boolean): boolean {
  const value = context.parameters.get(name)
  return typeof value === 'boolean' ? value : fallback
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
          'u_resolution', 'u_time', 'u_coreSize', 'u_coreIntensity', 'u_rotationSpeed', 'u_rayDensity',
          'u_energyResponse', 'u_buildResponse', 'u_buildContraction', 'u_bassResponse', 'u_impactBurst', 'u_mediaInfluence', 'u_patternSeed', 'u_backgroundColor',
          'u_userMedia', 'u_userMediaAvailable', 'u_userMediaOpacity',
          'u_albumArtwork', 'u_albumArtworkAvailable', 'u_albumArtworkOpacity',
          'u_mediaOutput', 'u_mediaOutputAvailable', 'u_mediaOutputOpacity',
          'u_primaryColor', 'u_secondaryColor', 'u_accentColor',
        ]
      : ['u_source', 'u_freshSource', 'u_resolution', 'u_time', 'u_refraction', 'u_edgeGlow', 'u_impactResponse', 'u_refractionPulse', 'u_shockwaveIntensity', 'u_shockwavePulse', 'u_accentColor'],
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
    const patternSeed = context.randomness.sample('reactor-pattern-seed') * 997
    const motionClock = new Cinema2SyncedMotionClockResolver()
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
        const bpmSync = booleanValue(context, 'bpmSync', true)
        const syncedTimeSec = motionClock.resolve(frame, bpmSync).syncedTimeSec
        program.setFloat('u_time', syncedTimeSec)

        if (variant === 'generator') {
          const background = colorValue(context, 'backgroundColor', [0.006, 0.009, 0.016, 1])
          const primary = colorValue(context, 'primaryColor', [0.12, 0.72, 1, 1])
          const secondary = colorValue(context, 'secondaryColor', [0.33, 0.22, 0.95, 1])
          const accent = colorValue(context, 'accentColor', [1, 0.28, 0.64, 1])
          program.setFloat('u_coreSize', numberValue(context, 'coreSize', 0.46))
          program.setFloat('u_coreIntensity', numberValue(context, 'coreIntensity', 1.15))
          program.setFloat('u_rotationSpeed', numberValue(context, 'rotationSpeed', 0.21))
          program.setFloat('u_rayDensity', numberValue(context, 'rayDensity', 0.62))
          program.setFloat('u_energyResponse', numberValue(context, 'energyResponse', 0))
          program.setFloat('u_buildResponse', numberValue(context, 'buildResponse', 0))
          program.setFloat('u_buildContraction', numberValue(context, 'buildContraction', 0.66))
          program.setFloat('u_bassResponse', numberValue(context, 'bassResponse', 0))
          program.setFloat('u_impactBurst', numberValue(context, 'impactBurst', 0))
          program.setFloat('u_mediaInfluence', numberValue(context, 'mediaInfluence', 0.34))
          program.setFloat('u_patternSeed', patternSeed)
          program.setVec4('u_backgroundColor', background[0], background[1], background[2], background[3])
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

        const colorInputs = inputs.filter(input => input.attachment === 'color')
        const source = colorInputs[0]
        const freshSource = colorInputs[1] ?? source
        if (!source || !freshSource) throw new Error('Reactor composite requires feedback and fresh upstream color inputs.')
        const accent = colorValue(context, 'accentColor', [1, 0.28, 0.64, 1])
        program.setFloat('u_refraction', numberValue(context, 'refraction', 0.82))
        program.setFloat('u_edgeGlow', numberValue(context, 'edgeGlow', 0.82))
        program.setFloat('u_impactResponse', numberValue(context, 'impactResponse', 0))
        program.setFloat('u_refractionPulse', numberValue(context, 'refractionPulse', 0))
        program.setFloat('u_shockwaveIntensity', numberValue(context, 'shockwaveIntensity', 1.2))
        program.setFloat('u_shockwavePulse', numberValue(context, 'shockwavePulse', 0))
        program.setVec4('u_accentColor', accent[0], accent[1], accent[2], accent[3])
        pass.run(program, target, width, height, [
          { unit: 0, texture: source.texture, uniformName: 'u_source' },
          { unit: 1, texture: freshSource.texture, uniformName: 'u_freshSource' },
        ])
      },
    })

    return {
      lifecycle: { update: () => {}, dispose: () => motionClock.reset() },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

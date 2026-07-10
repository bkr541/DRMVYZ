import type {
  RGBA,
  ShaderDefinition,
  ShaderParamDef,
  ShaderParamValue,
  ShaderParamValues,
} from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const REACTOR_SCENE_ID = 'shader-reactor'

export const LEGACY_REACTOR_SCENE_IDS = {
  semantic: 'shader-semantic-drop-reactor',
  shrapnel: 'shader-trap-shrapnel-reactor',
  singularity: 'shader-brand-singularity',
} as const

export type ReactorRecipe = 'semantic' | 'shrapnel' | 'singularity' | 'hybrid' | 'custom'

export interface ReactorConfig {
  recipe: ReactorRecipe

  semanticGeometryEnabled: boolean
  shrapnelEnabled: boolean
  brandCoreEnabled: boolean
  shockwaveEnabled: boolean
  feedbackTrailsEnabled: boolean
  mediaRefractionEnabled: boolean
  lyricVocalFillEnabled: boolean

  coreSize: number
  coreIntensity: number
  rotationSpeed: number
  buildContraction: number
  dropForce: number
  shockwaveIntensity: number
  shockwaveWidth: number
  overallGlow: number
  overallMix: number

  semanticCellCount: number
  semanticCellDepth: number
  angularMovement: number
  semanticResponse: number

  shardCount: number
  shardSpeed: number
  spread: number
  turbulence: number
  trailPersistence: number

  brandInfluence: number
  logoScale: number
  refractionAmount: number
  orbitAmount: number
  mediaInfluence: number
  vocalLyricInfluence: number

  primaryColor: RGBA
  secondaryColor: RGBA
  accentColor: RGBA
  backgroundColor: RGBA
}

export const REACTOR_DEFAULT_RECIPE: Exclude<ReactorRecipe, 'custom'> = 'hybrid'

const REACTOR_RECIPE_VALUES: Readonly<Record<Exclude<ReactorRecipe, 'custom'>, ReactorConfig>> = {
  semantic: {
    recipe: 'semantic',
    semanticGeometryEnabled: true,
    shrapnelEnabled: false,
    brandCoreEnabled: false,
    shockwaveEnabled: true,
    feedbackTrailsEnabled: false,
    mediaRefractionEnabled: false,
    lyricVocalFillEnabled: false,
    coreSize: 0.52,
    coreIntensity: 1.05,
    rotationSpeed: 0.24,
    buildContraction: 0.62,
    dropForce: 1.25,
    shockwaveIntensity: 1.4,
    shockwaveWidth: 0.18,
    overallGlow: 1.1,
    overallMix: 1,
    semanticCellCount: 10,
    semanticCellDepth: 1.15,
    angularMovement: 1.2,
    semanticResponse: 1.2,
    shardCount: 24,
    shardSpeed: 0.8,
    spread: 0.85,
    turbulence: 0.45,
    trailPersistence: 0.72,
    brandInfluence: 0.35,
    logoScale: 1,
    refractionAmount: 0.5,
    orbitAmount: 0.25,
    mediaInfluence: 0.15,
    vocalLyricInfluence: 0.3,
    primaryColor: [0.0, 0.9, 1.0, 1],
    secondaryColor: [0.45, 0.12, 1.0, 1],
    accentColor: [1.0, 0.08, 0.55, 1],
    backgroundColor: [0.008, 0.005, 0.02, 1],
  },
  shrapnel: {
    recipe: 'shrapnel',
    semanticGeometryEnabled: false,
    shrapnelEnabled: true,
    brandCoreEnabled: false,
    shockwaveEnabled: true,
    feedbackTrailsEnabled: true,
    mediaRefractionEnabled: false,
    lyricVocalFillEnabled: false,
    coreSize: 0.34,
    coreIntensity: 0.92,
    rotationSpeed: 0.22,
    buildContraction: 0.74,
    dropForce: 1.55,
    shockwaveIntensity: 1.1,
    shockwaveWidth: 0.12,
    overallGlow: 1.22,
    overallMix: 1,
    semanticCellCount: 8,
    semanticCellDepth: 0.72,
    angularMovement: 0.55,
    semanticResponse: 0.6,
    shardCount: 42,
    shardSpeed: 1.15,
    spread: 1.35,
    turbulence: 1.15,
    trailPersistence: 0.9,
    brandInfluence: 0.42,
    logoScale: 0.82,
    refractionAmount: 0.35,
    orbitAmount: 0.62,
    mediaInfluence: 0.1,
    vocalLyricInfluence: 0.2,
    primaryColor: [0.5, 0.05, 1, 1],
    secondaryColor: [0.12, 0.28, 1, 1],
    accentColor: [1, 0.34, 0.02, 1],
    backgroundColor: [0.008, 0.003, 0.018, 1],
  },
  singularity: {
    recipe: 'singularity',
    semanticGeometryEnabled: false,
    shrapnelEnabled: false,
    brandCoreEnabled: true,
    shockwaveEnabled: true,
    feedbackTrailsEnabled: true,
    mediaRefractionEnabled: true,
    lyricVocalFillEnabled: true,
    coreSize: 0.48,
    coreIntensity: 1.18,
    rotationSpeed: 0.18,
    buildContraction: 0.68,
    dropForce: 1.2,
    shockwaveIntensity: 1.25,
    shockwaveWidth: 0.16,
    overallGlow: 1.16,
    overallMix: 1,
    semanticCellCount: 12,
    semanticCellDepth: 0.7,
    angularMovement: 0.4,
    semanticResponse: 0.65,
    shardCount: 24,
    shardSpeed: 0.72,
    spread: 0.8,
    turbulence: 0.5,
    trailPersistence: 0.88,
    brandInfluence: 1,
    logoScale: 1,
    refractionAmount: 1.25,
    orbitAmount: 0.72,
    mediaInfluence: 0.42,
    vocalLyricInfluence: 1,
    primaryColor: [0.05, 0.62, 1, 1],
    secondaryColor: [0.85, 0.06, 1, 1],
    accentColor: [0.06, 1, 0.92, 1],
    backgroundColor: [0.004, 0.006, 0.02, 1],
  },
  hybrid: {
    recipe: 'hybrid',
    semanticGeometryEnabled: true,
    shrapnelEnabled: true,
    brandCoreEnabled: true,
    shockwaveEnabled: true,
    feedbackTrailsEnabled: true,
    mediaRefractionEnabled: true,
    lyricVocalFillEnabled: true,
    coreSize: 0.46,
    coreIntensity: 1,
    rotationSpeed: 0.21,
    buildContraction: 0.66,
    dropForce: 1.35,
    shockwaveIntensity: 1.2,
    shockwaveWidth: 0.15,
    overallGlow: 1.12,
    overallMix: 0.92,
    semanticCellCount: 10,
    semanticCellDepth: 0.9,
    angularMovement: 0.82,
    semanticResponse: 0.92,
    shardCount: 32,
    shardSpeed: 0.95,
    spread: 1.05,
    turbulence: 0.82,
    trailPersistence: 0.84,
    brandInfluence: 0.72,
    logoScale: 0.92,
    refractionAmount: 0.82,
    orbitAmount: 0.58,
    mediaInfluence: 0.3,
    vocalLyricInfluence: 0.72,
    primaryColor: [0.05, 0.72, 1, 1],
    secondaryColor: [0.68, 0.08, 1, 1],
    accentColor: [1, 0.18, 0.28, 1],
    backgroundColor: [0.006, 0.004, 0.02, 1],
  },
}

export const REACTOR_RECIPE_CONFIGS = REACTOR_RECIPE_VALUES

export function getReactorRecipeConfig(recipe: Exclude<ReactorRecipe, 'custom'>): ReactorConfig {
  const config = REACTOR_RECIPE_VALUES[recipe]
  return {
    ...config,
    primaryColor: [...config.primaryColor] as RGBA,
    secondaryColor: [...config.secondaryColor] as RGBA,
    accentColor: [...config.accentColor] as RGBA,
    backgroundColor: [...config.backgroundColor] as RGBA,
  }
}

export function applyReactorRecipe(
  recipe: Exclude<ReactorRecipe, 'custom'>,
): ShaderParamValues {
  return getReactorRecipeConfig(recipe) as unknown as ShaderParamValues
}

export function isReactorRecipe(value: ShaderParamValue): value is ReactorRecipe {
  return typeof value === 'string'
    && ['semantic', 'shrapnel', 'singularity', 'hybrid', 'custom'].includes(value)
}

const REACTOR_PARAM_MODULE_DEPENDENCIES: Readonly<Record<string, keyof ReactorConfig>> = {
  shockwaveIntensity: 'shockwaveEnabled',
  shockwaveWidth: 'shockwaveEnabled',
  semanticCellCount: 'semanticGeometryEnabled',
  semanticCellDepth: 'semanticGeometryEnabled',
  angularMovement: 'semanticGeometryEnabled',
  semanticResponse: 'semanticGeometryEnabled',
  shardCount: 'shrapnelEnabled',
  shardSpeed: 'shrapnelEnabled',
  spread: 'shrapnelEnabled',
  turbulence: 'shrapnelEnabled',
  trailPersistence: 'feedbackTrailsEnabled',
  brandInfluence: 'brandCoreEnabled',
  logoScale: 'brandCoreEnabled',
  orbitAmount: 'brandCoreEnabled',
  refractionAmount: 'mediaRefractionEnabled',
  mediaInfluence: 'mediaRefractionEnabled',
  vocalLyricInfluence: 'lyricVocalFillEnabled',
}

export function isReactorParamVisible(
  paramId: string,
  values: Readonly<Record<string, ShaderParamValue>>,
): boolean {
  const dependency = REACTOR_PARAM_MODULE_DEPENDENCIES[paramId]
  return dependency ? values[dependency] !== false : true
}

const REACTOR_GENERATOR = `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform sampler2D uUserMedia;
uniform float uUserMediaAvailable;
uniform sampler2D uAlbumArtwork;
uniform float uAlbumArtworkAvailable;
uniform sampler2D uMediaOutput;
uniform float uMediaOutputAvailable;

uniform float uRecipe;
uniform float uSemanticGeometryEnabled;
uniform float uShrapnelEnabled;
uniform float uBrandCoreEnabled;
uniform float uShockwaveEnabled;
uniform float uFeedbackTrailsEnabled;
uniform float uMediaRefractionEnabled;
uniform float uLyricVocalFillEnabled;

uniform float uCoreSize;
uniform float uCoreIntensity;
uniform float uRotationSpeed;
uniform float uBuildContraction;
uniform float uDropForce;
uniform float uShockwaveIntensity;
uniform float uShockwaveWidth;
uniform float uOverallGlow;
uniform float uOverallMix;

uniform float uSemanticCellCount;
uniform float uSemanticCellDepth;
uniform float uAngularMovement;
uniform float uSemanticResponse;
uniform float uShardCount;
uniform float uShardSpeed;
uniform float uSpread;
uniform float uTurbulence;
uniform float uTrailPersistence;
uniform float uBrandInfluence;
uniform float uLogoScale;
uniform float uRefractionAmount;
uniform float uOrbitAmount;
uniform float uMediaInfluence;
uniform float uVocalLyricInfluence;

uniform vec4 uPrimaryColor;
uniform vec4 uSecondaryColor;
uniform vec4 uAccentColor;
uniform vec4 uBackgroundColor;
out vec4 fragColor;

float reactorRing(float radius, float target, float width) {
  return exp(-abs(radius - target) * max(1.0, width));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float bass = mix(uBass, max(uBass, uBassStemEnergy), uHasStems);
  float vocal = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float buildAmount = max(music.build, uBuildProgress);
  float dropAmount = max(music.drop, uDropImpact) * uDropForce;
  float contraction = mix(1.0, clamp(uBuildContraction, 0.25, 1.0), buildAmount);

  float angle = atan(centered.y, centered.x);
  float radius = length(centered);
  float spin = uTime * uRotationSpeed * uMasterMotion
    + uAngularMovement * (uPhrase16Progress - 0.5)
    + uOrbitAmount * uPhrase32Progress * SHADER_TAU;
  float warpedAngle = angle + spin;

  float cellCount = max(3.0, floor(uSemanticCellCount));
  float semanticCells = pow(abs(cos(warpedAngle * cellCount)), max(0.2, uSemanticCellDepth));
  float semanticRadius = uCoreSize * contraction * (1.0 + bass * uSemanticResponse * 0.2);
  float semanticShape = reactorRing(radius, semanticRadius, 42.0 + uSemanticCellDepth * 22.0)
    * mix(0.28, 1.0, semanticCells)
    * uSemanticGeometryEnabled;

  float shardCount = max(6.0, floor(uShardCount));
  float shardSector = abs(fract((warpedAngle / SHADER_TAU + 0.5) * shardCount) - 0.5);
  float shardNoise = noise21(vec2(floor((warpedAngle / SHADER_TAU + 0.5) * shardCount),
    floor(uTime * max(0.1, uShardSpeed) * 2.0)));
  float shardRay = exp(-shardSector * (55.0 - uTurbulence * 14.0));
  float shardTravel = fract(radius * max(0.3, 2.2 - uSpread * 0.45)
    - uTime * uShardSpeed * 0.35 - shardNoise * uTurbulence * 0.25);
  float shardBody = (1.0 - smoothstep(0.42, 0.72, shardTravel))
    * smoothstep(0.02, 0.18, shardTravel);
  float shrapnelShape = shardRay * shardBody
    * smoothstep(uCoreSize * 0.35, uCoreSize + uSpread * 0.65 + dropAmount * 0.28, radius)
    * uShrapnelEnabled;

  float logoMask = brandLogoMask(centered / max(0.2, uLogoScale * contraction));
  float fallbackCore = exp(-radius * (5.5 / max(0.25, uCoreSize * contraction)));
  float brandShape = mix(fallbackCore, logoMask, uBrandLogoAvailable * uBrandEnabled)
    * uBrandCoreEnabled * uBrandInfluence;
  float brandFragmentCount = max(6.0, floor(uShardCount));
  float brandFragmentSector = abs(fract((warpedAngle / SHADER_TAU + 0.5) * brandFragmentCount) - 0.5);
  float brandOrbitRadius = uCoreSize * contraction + uOrbitAmount * 0.22 + bass * 0.06;
  float brandOrbit = exp(-brandFragmentSector * (48.0 - uTurbulence * 8.0))
    * reactorRing(radius, brandOrbitRadius, 40.0)
    * uBrandCoreEnabled * uBrandInfluence * uOrbitAmount;

  float waveform = waveformAt(fract(angle / SHADER_TAU + 0.5));
  vec2 refractedUv = uv + normalize(centered + vec2(0.0001))
    * waveform * uRefractionAmount * uMediaRefractionEnabled * 0.035;
  vec3 media = vec3(0.0);
  float mediaWeight = uUserMediaAvailable + uAlbumArtworkAvailable + uMediaOutputAvailable;
  if (mediaWeight > 0.0) {
    media = (
      texture(uUserMedia, refractedUv).rgb * uUserMediaAvailable
      + texture(uAlbumArtwork, refractedUv).rgb * uAlbumArtworkAvailable
      + texture(uMediaOutput, refractedUv).rgb * uMediaOutputAvailable
    ) / mediaWeight;
  }

  float shockRadius = fract(uBarPhase + dropAmount * 0.32) * (1.1 + uSpread * 0.2);
  float shockWidth = mix(75.0, 18.0, clamp(uShockwaveWidth, 0.02, 0.5));
  float shockShape = reactorRing(radius, shockRadius, shockWidth)
    * uShockwaveEnabled * uShockwaveIntensity * (dropAmount + uDownbeatHit * 0.55);

  float lyricFill = uLyricVocalFillEnabled * uVocalLyricInfluence
    * (uLyricActivity * uHasLyrics + vocal * 0.7 + uVocalHookConfidence * uHasSemantics * 0.5);
  float recipeAccent = 0.94 + uRecipe * 0.015;
  float coreEnergy = (0.45 + bass * uMasterBassReactivity * 0.55 + lyricFill * 0.4)
    * uCoreIntensity;

  vec3 color = mix(uBackgroundColor.rgb, uBrandBackground.rgb,
    uBrandEnabled * uBrandInfluence * 0.45) * (0.62 + music.macro * 0.25);
  color = mix(color, media, clamp(mediaWeight, 0.0, 1.0)
    * uMediaInfluence * uMediaRefractionEnabled);
  color += mix(uPrimaryColor.rgb, uBrandPrimary.rgb, uBrandEnabled * uBrandInfluence)
    * semanticShape * coreEnergy;
  color += mix(uSecondaryColor.rgb, uBrandSecondary.rgb, uBrandEnabled * uBrandInfluence)
    * shrapnelShape * (0.55 + dropAmount * 0.65 + music.micro * 0.25);
  color += mix(uPrimaryColor.rgb, uBrandHighlight.rgb, uBrandEnabled * uBrandInfluence)
    * brandShape * (0.55 + coreEnergy + lyricFill);
  color += mix(uSecondaryColor.rgb, uBrandSecondary.rgb, uBrandEnabled * uBrandInfluence)
    * brandOrbit * (0.35 + bass * 0.35 + dropAmount * 0.25);
  color += mix(uAccentColor.rgb, uBrandImpact.rgb, uBrandEnabled * uBrandInfluence)
    * shockShape;
  color += uAccentColor.rgb * lyricFill * brandShape * 0.45;
  color = applyBrandAtmosphere(color, uv, 0.12 + uMediaInfluence * 0.22);
  color *= recipeAccent * uOverallMix * uMasterIntensity
    * (0.72 + uOverallGlow * 0.22 + uMasterGlow * 0.12);
  fragColor = vec4(max(color, 0.0), 1.0);
}
`

const REACTOR_FEEDBACK = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uPreviousReactor;
uniform sampler2D uFreshReactor;
uniform float uFeedbackTrailsEnabled;
uniform float uTrailPersistence;
uniform float uRotationSpeed;
uniform float uOverallGlow;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uPhrase8Progress;
uniform float uMasterMotion;
uniform float uMasterTrailDecay;
out vec4 fragColor;

void main() {
  vec2 centered = v_uv - 0.5;
  float angle = (uRotationSpeed * 0.005 + uSnareHit * 0.008)
    * uMasterMotion * (0.5 + uPhrase8Progress);
  float cosineValue = cos(angle);
  float sineValue = sin(angle);
  centered = mat2(cosineValue, -sineValue, sineValue, cosineValue) * centered;
  centered *= 0.996 - uKickHit * 0.01;
  vec3 previousColor = texture(uPreviousReactor, clamp(centered + 0.5, 0.001, 0.999)).rgb;
  vec3 freshColor = texture(uFreshReactor, v_uv).rgb;
  float retention = clamp(uTrailPersistence * (1.0 - uMasterTrailDecay), 0.0, 0.985)
    * uFeedbackTrailsEnabled;
  vec3 color = max(freshColor, previousColor * retention * (0.93 + uOverallGlow * 0.04));
  fragColor = vec4(color, 1.0);
}
`

const REACTOR_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uReactorHistory;
uniform sampler2D uFreshReactor;
uniform float uOverallMix;
uniform float uOverallGlow;
uniform float uCoreIntensity;
uniform float uDropImpact;
uniform float uSnareHit;
uniform float uMasterIntensity;
out vec4 fragColor;

void main() {
  vec3 historyColor = texture(uReactorHistory, v_uv).rgb;
  vec3 freshColor = texture(uFreshReactor, v_uv).rgb;
  vec3 color = historyColor + freshColor * (0.18 + uCoreIntensity * 0.16 + uDropImpact * 0.18);
  color = mix(color, vec3(1.0), uSnareHit * 0.08 * uOverallGlow);
  color *= uOverallMix * uMasterIntensity;
  color = pow(max(color, 0.0), vec3(0.4545));
  fragColor = vec4(color, 1.0);
}
`

const REACTOR_PARAMS: ShaderParamDef[] = [
  {
    id: 'recipe', type: 'enum', label: 'Recipe', group: 'Recipe', uniformName: 'uRecipe',
    values: [
      { value: 'semantic', label: 'Semantic' },
      { value: 'shrapnel', label: 'Shrapnel' },
      { value: 'singularity', label: 'Singularity' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'custom', label: 'Custom' },
    ],
    default: REACTOR_DEFAULT_RECIPE,
  },

  { id: 'semanticGeometryEnabled', type: 'boolean', label: 'Semantic Geometry', group: 'Modules', uniformName: 'uSemanticGeometryEnabled', default: true },
  { id: 'shrapnelEnabled', type: 'boolean', label: 'Shrapnel', group: 'Modules', uniformName: 'uShrapnelEnabled', default: true },
  { id: 'brandCoreEnabled', type: 'boolean', label: 'Brand Core', group: 'Modules', uniformName: 'uBrandCoreEnabled', default: true },
  { id: 'shockwaveEnabled', type: 'boolean', label: 'Shockwave', group: 'Modules', uniformName: 'uShockwaveEnabled', default: true },
  { id: 'feedbackTrailsEnabled', type: 'boolean', label: 'Feedback Trails', group: 'Modules', uniformName: 'uFeedbackTrailsEnabled', default: true },
  { id: 'mediaRefractionEnabled', type: 'boolean', label: 'Media Refraction', group: 'Modules', uniformName: 'uMediaRefractionEnabled', default: true },
  { id: 'lyricVocalFillEnabled', type: 'boolean', label: 'Lyric / Vocal Fill', group: 'Modules', uniformName: 'uLyricVocalFillEnabled', default: true },

  { id: 'coreSize', type: 'float', label: 'Core Size', group: 'Core and Motion', uniformName: 'uCoreSize', min: 0.1, max: 1.1, step: 0.01, default: 0.46, modulatable: true },
  { id: 'coreIntensity', type: 'float', label: 'Core Intensity', group: 'Core and Motion', uniformName: 'uCoreIntensity', min: 0, max: 2.5, step: 0.01, default: 1, modulatable: true },
  { id: 'rotationSpeed', type: 'float', label: 'Rotation Speed', group: 'Core and Motion', uniformName: 'uRotationSpeed', min: -2, max: 2, step: 0.01, default: 0.21, modulatable: true },
  { id: 'buildContraction', type: 'float', label: 'Build Contraction', group: 'Core and Motion', uniformName: 'uBuildContraction', min: 0.25, max: 1, step: 0.01, default: 0.66, modulatable: true },
  { id: 'dropForce', type: 'float', label: 'Drop Force', group: 'Core and Motion', uniformName: 'uDropForce', min: 0.2, max: 3, step: 0.01, default: 1.35, modulatable: true },
  { id: 'shockwaveIntensity', type: 'float', label: 'Shockwave Intensity', group: 'Core and Motion', uniformName: 'uShockwaveIntensity', min: 0, max: 3, step: 0.01, default: 1.2, modulatable: true },
  { id: 'shockwaveWidth', type: 'float', label: 'Shockwave Width', group: 'Core and Motion', uniformName: 'uShockwaveWidth', min: 0.02, max: 0.5, step: 0.01, default: 0.15, modulatable: true },
  { id: 'overallGlow', type: 'float', label: 'Overall Glow', group: 'Core and Motion', uniformName: 'uOverallGlow', min: 0, max: 2.5, step: 0.01, default: 1.12, modulatable: true },
  { id: 'overallMix', type: 'float', label: 'Overall Mix', group: 'Core and Motion', uniformName: 'uOverallMix', min: 0, max: 1.5, step: 0.01, default: 0.92, modulatable: true },

  { id: 'semanticCellCount', type: 'integer', label: 'Cell Count', group: 'Semantic', uniformName: 'uSemanticCellCount', min: 3, max: 24, step: 1, default: 10, modulatable: true },
  { id: 'semanticCellDepth', type: 'float', label: 'Cell Definition', group: 'Semantic', uniformName: 'uSemanticCellDepth', min: 0.2, max: 2.5, step: 0.01, default: 0.9, modulatable: true },
  { id: 'angularMovement', type: 'float', label: 'Angular Movement', group: 'Semantic', uniformName: 'uAngularMovement', min: -4, max: 4, step: 0.01, default: 0.82, modulatable: true },
  { id: 'semanticResponse', type: 'float', label: 'Semantic Response', group: 'Semantic', uniformName: 'uSemanticResponse', min: 0, max: 2.5, step: 0.01, default: 0.92, modulatable: true },

  { id: 'shardCount', type: 'integer', label: 'Shard Count', group: 'Shrapnel', uniformName: 'uShardCount', min: 8, max: 64, step: 1, default: 32, modulatable: true },
  { id: 'shardSpeed', type: 'float', label: 'Shard Speed', group: 'Shrapnel', uniformName: 'uShardSpeed', min: 0, max: 2.5, step: 0.01, default: 0.95, modulatable: true },
  { id: 'spread', type: 'float', label: 'Spread', group: 'Shrapnel', uniformName: 'uSpread', min: 0.2, max: 2.5, step: 0.01, default: 1.05, modulatable: true },
  { id: 'turbulence', type: 'float', label: 'Turbulence', group: 'Shrapnel', uniformName: 'uTurbulence', min: 0, max: 2.5, step: 0.01, default: 0.82, modulatable: true },
  { id: 'trailPersistence', type: 'float', label: 'Trail Persistence', group: 'Shrapnel', uniformName: 'uTrailPersistence', min: 0, max: 0.99, step: 0.01, default: 0.84, modulatable: true },

  { id: 'brandInfluence', type: 'float', label: 'Brand Influence', group: 'Brand and Media', uniformName: 'uBrandInfluence', min: 0, max: 1.5, step: 0.01, default: 0.72, modulatable: true },
  { id: 'logoScale', type: 'float', label: 'Logo Scale', group: 'Brand and Media', uniformName: 'uLogoScale', min: 0.25, max: 2, step: 0.01, default: 0.92, modulatable: true },
  { id: 'refractionAmount', type: 'float', label: 'Refraction Amount', group: 'Brand and Media', uniformName: 'uRefractionAmount', min: 0, max: 3, step: 0.01, default: 0.82, modulatable: true },
  { id: 'orbitAmount', type: 'float', label: 'Orbit Amount', group: 'Brand and Media', uniformName: 'uOrbitAmount', min: 0, max: 2, step: 0.01, default: 0.58, modulatable: true },
  { id: 'mediaInfluence', type: 'float', label: 'Media Influence', group: 'Brand and Media', uniformName: 'uMediaInfluence', min: 0, max: 1, step: 0.01, default: 0.3, modulatable: true },
  { id: 'primaryColor', type: 'color', label: 'Primary', group: 'Brand and Media', uniformName: 'uPrimaryColor', brandRole: 'primary', default: [0.05, 0.72, 1, 1] },
  { id: 'secondaryColor', type: 'color', label: 'Secondary', group: 'Brand and Media', uniformName: 'uSecondaryColor', brandRole: 'secondary', default: [0.68, 0.08, 1, 1] },
  { id: 'accentColor', type: 'color', label: 'Impact', group: 'Brand and Media', uniformName: 'uAccentColor', brandRole: 'accent', default: [1, 0.18, 0.28, 1] },
  { id: 'backgroundColor', type: 'color', label: 'Background', group: 'Brand and Media', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.006, 0.004, 0.02, 1] },

  { id: 'vocalLyricInfluence', type: 'float', label: 'Vocal / Lyric Influence', group: 'Reactivity', uniformName: 'uVocalLyricInfluence', min: 0, max: 2, step: 0.01, default: 0.72, modulatable: true },
]

const defaultConfig = getReactorRecipeConfig(REACTOR_DEFAULT_RECIPE)

export const REACTOR: ShaderDefinition = {
  id: REACTOR_SCENE_ID,
  name: 'Reactor',
  description: 'A unified semantic, shrapnel, and brand-reactive Shader scene with recipe-driven module controls.',
  category: 'feedback',
  version: 1,
  passes: [
    {
      id: 'generator',
      fragSrc: REACTOR_GENERATOR,
      inputs: ['uUserMedia', 'uAlbumArtwork', 'uMediaOutput'],
      output: 'fresh-reactor',
      resolutionScale: 1,
      clearBeforeRender: true,
    },
    {
      id: 'feedback',
      fragSrc: REACTOR_FEEDBACK,
      inputs: [
        { source: 'reactor-history', uniformName: 'uPreviousReactor' },
        { source: 'fresh-reactor', uniformName: 'uFreshReactor' },
      ],
      output: 'reactor-history',
      resolutionScale: 0.75,
      clearBeforeRender: false,
      pingPong: true,
      dependsOn: ['generator'],
    },
    {
      id: 'composite',
      fragSrc: REACTOR_COMPOSITE,
      inputs: [
        { source: 'reactor-history', uniformName: 'uReactorHistory' },
        { source: 'fresh-reactor', uniformName: 'uFreshReactor' },
      ],
      output: 'composite',
      resolutionScale: 1,
      clearBeforeRender: true,
      dependsOn: ['feedback'],
    },
  ],
  params: REACTOR_PARAMS,
  defaults: defaultConfig as unknown as ShaderParamValues,
  textureInputs: [
    { name: 'uUserMedia', label: 'User Media', source: 'uploaded-image', required: false },
    { name: 'uAlbumArtwork', label: 'Album Artwork', source: 'album-artwork', required: false },
    { name: 'uMediaOutput', label: 'Media Output', source: 'media-output', required: false },
  ],
  resetOnActivation: true,
  feedback: { pingPongBuffers: 1, historyFrames: 1 },
  feedbackReset: {
    onSceneChange: true,
    onTrackChange: true,
    onPlaybackRestart: true,
    onSectionChange: false,
    onDropImpact: true,
    dropImpactThreshold: 0.94,
    onResolutionChange: true,
    onContextRestore: true,
  },
  quality: {
    minimumTier: 'medium',
    recommendedTier: 'high',
    particleLimit: { min: 8, recommended: 32, max: 64 },
    estimatedPassCount: 3,
    requiresPersistentBuffers: true,
  },
  transitions: {
    supportsGpuTransitions: true,
    supportedTransitionTypes: ['feedback-collapse', 'pixel-scatter', 'rgb-split-dissolve', 'flash-cut'],
  },
  thumbnail: { color: '#12052b' },
  tags: ['reactor', 'semantic', 'shrapnel', 'brand-kit', 'feedback', 'media', 'lyrics', 'stems'],
}

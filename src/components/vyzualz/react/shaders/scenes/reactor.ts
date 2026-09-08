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

/** Per-ray silhouette for the generative shrapnel field. `mixed` seeds each ray. */
export type ReactorRayStyle = 'spoke' | 'lance' | 'tracer' | 'forked' | 'arc' | 'mixed'
export const REACTOR_RAY_STYLES: readonly ReactorRayStyle[] = ['spoke', 'lance', 'tracer', 'forked', 'arc', 'mixed']

/** When the whole ray field re-rolls to a fresh deterministic layout. */
export type ReactorRayRerollCadence = 'off' | 'bar' | 'bar4' | 'phrase' | 'drop'
export const REACTOR_RAY_REROLL_CADENCES: readonly ReactorRayRerollCadence[] = ['off', 'bar', 'bar4', 'phrase', 'drop']

export interface ReactorConfig {
  recipe: ReactorRecipe

  semanticGeometryEnabled: boolean
  shrapnelEnabled: boolean
  brandCoreEnabled: boolean
  shockwaveEnabled: boolean
  feedbackTrailsEnabled: boolean
  mediaRefractionEnabled: boolean
  lyricVocalFillEnabled: boolean

  semanticMix: number
  shrapnelMix: number
  brandMix: number

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

  /** Generative ray-field controls (overhauled shrapnel module). */
  rayStyle: ReactorRayStyle
  raySeed: number
  rayRerollCadence: ReactorRayRerollCadence
  rayAngularIrregularity: number
  rayCurvature: number
  rayForkAmount: number
  rayDashDensity: number
  rayLengthVariation: number

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
    semanticMix: 1,
    shrapnelMix: 0,
    brandMix: 0,
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
    rayStyle: 'mixed',
    raySeed: 7,
    rayRerollCadence: 'phrase',
    rayAngularIrregularity: 0.2,
    rayCurvature: 0.3,
    rayForkAmount: 0.2,
    rayDashDensity: 0.35,
    rayLengthVariation: 0.4,
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
    semanticMix: 0,
    shrapnelMix: 1,
    brandMix: 0,
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
    rayStyle: 'mixed',
    raySeed: 3,
    rayRerollCadence: 'bar',
    rayAngularIrregularity: 0.55,
    rayCurvature: 0.3,
    rayForkAmount: 0.45,
    rayDashDensity: 0.5,
    rayLengthVariation: 0.65,
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
    semanticMix: 0,
    shrapnelMix: 0,
    brandMix: 1,
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
    rayStyle: 'arc',
    raySeed: 11,
    rayRerollCadence: 'phrase',
    rayAngularIrregularity: 0.3,
    rayCurvature: 0.6,
    rayForkAmount: 0.15,
    rayDashDensity: 0.25,
    rayLengthVariation: 0.45,
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
    semanticMix: 0.72,
    shrapnelMix: 0.78,
    brandMix: 0.9,
    coreSize: 0.46,
    coreIntensity: 1,
    rotationSpeed: 0.21,
    buildContraction: 0.66,
    dropForce: 1.35,
    shockwaveIntensity: 1.2,
    shockwaveWidth: 0.15,
    overallGlow: 1.12,
    overallMix: 0.94,
    semanticCellCount: 10,
    semanticCellDepth: 0.9,
    angularMovement: 0.82,
    semanticResponse: 0.92,
    shardCount: 32,
    shardSpeed: 0.95,
    spread: 1.05,
    turbulence: 0.82,
    trailPersistence: 0.84,
    rayStyle: 'mixed',
    raySeed: 1,
    rayRerollCadence: 'bar',
    rayAngularIrregularity: 0.35,
    rayCurvature: 0.25,
    rayForkAmount: 0.3,
    rayDashDensity: 0.4,
    rayLengthVariation: 0.5,
    brandInfluence: 0.82,
    logoScale: 0.96,
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

function cloneReactorConfig(config: ReactorConfig): ReactorConfig {
  return {
    ...config,
    primaryColor: [...config.primaryColor] as RGBA,
    secondaryColor: [...config.secondaryColor] as RGBA,
    accentColor: [...config.accentColor] as RGBA,
    backgroundColor: [...config.backgroundColor] as RGBA,
  }
}

export function getReactorRecipeConfig(recipe: Exclude<ReactorRecipe, 'custom'>): ReactorConfig {
  return cloneReactorConfig(REACTOR_RECIPE_VALUES[recipe])
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

/**
 * Hydrate persisted Reactor values against the current schema. Earlier saved
 * configurations may not contain module mix controls, so this keeps Custom looks
 * live while supplying deterministic weights for newly introduced parameters.
 */
export function normalizeReactorParamValues(
  values: ShaderParamValues | undefined,
): ShaderParamValues {
  const authored = values ?? {}
  const authoredRecipe = isReactorRecipe(authored.recipe) ? authored.recipe : REACTOR_DEFAULT_RECIPE
  const baseRecipe = authoredRecipe === 'custom' ? REACTOR_DEFAULT_RECIPE : authoredRecipe
  const normalized = {
    ...applyReactorRecipe(baseRecipe),
    ...authored,
    recipe: authoredRecipe,
  } as ShaderParamValues

  if (authored.semanticMix === undefined) {
    normalized.semanticMix = authored.semanticGeometryEnabled === false ? 0 : 1
  }
  if (authored.shrapnelMix === undefined) {
    normalized.shrapnelMix = authored.shrapnelEnabled === false ? 0 : 1
  }
  if (authored.brandMix === undefined) {
    normalized.brandMix = authored.brandCoreEnabled === false ? 0 : 1
  }

  // Generative ray-field params: the recipe spread already supplies defaults for
  // legacy projects; here we only repair malformed persisted values.
  if (!REACTOR_RAY_STYLES.includes(normalized.rayStyle as ReactorRayStyle)) {
    normalized.rayStyle = 'mixed'
  }
  if (!REACTOR_RAY_REROLL_CADENCES.includes(normalized.rayRerollCadence as ReactorRayRerollCadence)) {
    normalized.rayRerollCadence = 'bar'
  }
  if (typeof normalized.raySeed !== 'number' || !Number.isFinite(normalized.raySeed)) {
    normalized.raySeed = 1
  } else {
    normalized.raySeed = Math.min(9999, Math.max(0, Math.round(normalized.raySeed)))
  }
  for (const id of ['rayAngularIrregularity', 'rayCurvature', 'rayForkAmount', 'rayDashDensity', 'rayLengthVariation'] as const) {
    const value = normalized[id]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    normalized[id] = Math.min(1, Math.max(0, value))
  }

  for (const id of ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor'] as const) {
    const value = normalized[id]
    if (Array.isArray(value)) normalized[id] = [...value] as RGBA
  }

  return normalized
}

const REACTOR_PARAM_MODULE_DEPENDENCIES: Readonly<Record<string, keyof ReactorConfig>> = {
  semanticMix: 'semanticGeometryEnabled',
  shrapnelMix: 'shrapnelEnabled',
  brandMix: 'brandCoreEnabled',
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
  rayStyle: 'shrapnelEnabled',
  rayRerollCadence: 'shrapnelEnabled',
  raySeed: 'shrapnelEnabled',
  rayAngularIrregularity: 'shrapnelEnabled',
  rayCurvature: 'shrapnelEnabled',
  rayForkAmount: 'shrapnelEnabled',
  rayDashDensity: 'shrapnelEnabled',
  rayLengthVariation: 'shrapnelEnabled',
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

/**
 * The generative ray field's persistent re-roll epoch (uniform `uRayEpoch`),
 * shared by both render paths. `Off` freezes the layout; `Bar` / `4 Bars` /
 * `Phrase` follow canonical musical position; `Drop` uses a caller-owned counter
 * of consumed drop events (de-duped by the caller). `raySeed` is added on top in
 * GLSL so a given (seed, epoch) always rebuilds the same field.
 */
export function resolveReactorRayEpoch(
  cadence: ReactorRayRerollCadence,
  input: { barIndex: number; phraseIndex: number | null; dropCount: number },
): number {
  const barIndex = Math.max(0, Math.floor(Number.isFinite(input.barIndex) ? input.barIndex : 0))
  switch (cadence) {
    case 'off': return 0
    case 'bar4': return Math.floor(barIndex / 4)
    case 'phrase':
      return input.phraseIndex !== null && Number.isFinite(input.phraseIndex)
        ? Math.max(0, Math.floor(input.phraseIndex))
        : Math.floor(barIndex / 16)
    case 'drop': return Math.max(0, Math.floor(input.dropCount))
    case 'bar':
    default: return barIndex
  }
}

const REACTOR_MODULE_TYPES_GLSL = String.raw`
struct ReactorLayer {
  vec3 color;
  float mask;
  float identityMask;
};

ReactorLayer emptyReactorLayer() {
  return ReactorLayer(vec3(0.0), 0.0, 0.0);
}
`

const REACTOR_MODULE_UTILS_GLSL = String.raw`
float reactorRing(float radius, float target, float width) {
  return exp(-abs(radius - target) * max(1.0, width));
}

float reactorDiamond(vec2 point, float target, float width) {
  return exp(-abs(abs(point.x) + abs(point.y) - target) * max(1.0, width));
}

float reactorSegmentDistance(vec2 point, vec2 startPoint, vec2 endPoint) {
  vec2 pointOffset = point - startPoint;
  vec2 segment = endPoint - startPoint;
  float position = clamp(
    dot(pointOffset, segment) / max(dot(segment, segment), 0.0001),
    0.0,
    1.0
  );
  return length(pointOffset - segment * position);
}

// Coarse distance to a quadratic bezier (start -> control -> end). Used only by
// Arc-style rays; 5 chords keep it cheap inside the bounded ray loop.
float reactorBezierDistance(vec2 point, vec2 startPoint, vec2 controlPoint, vec2 endPoint) {
  float best = 1.0e9;
  vec2 previous = startPoint;
  for (int i = 1; i <= 5; i++) {
    float t = float(i) / 5.0;
    vec2 pointOnCurve = mix(mix(startPoint, controlPoint, t), mix(controlPoint, endPoint, t), t);
    best = min(best, reactorSegmentDistance(point, previous, pointOnCurve));
    previous = pointOnCurve;
  }
  return best;
}

// Deterministic golden-ratio angle — irregular placement that never clumps.
float reactorGoldenAngle(float ordinal) {
  return fract(ordinal * 0.61803398875) * SHADER_TAU;
}

vec3 reactorCompress(vec3 color, float amount) {
  vec3 positive = max(color, vec3(0.0));
  return positive / (vec3(1.0) + positive * max(0.0, amount));
}
`

const REACTOR_SEMANTIC_MODULE_GLSL = String.raw`
ReactorLayer renderSemanticModule(
  vec2 point,
  MusicSignals music,
  float bass,
  float buildAmount,
  float dropAmount,
  float contraction,
  float sharedSpin
) {
  if (uSemanticGeometryEnabled < 0.001 || uSemanticMix < 0.001) {
    return emptyReactorLayer();
  }

  float radius = length(point);
  float cellCount = max(3.0, floor(uSemanticCellCount));
  float sectionMotion = (uSectionProgress - 0.5) * uHasSections * uSemanticResponse;
  float angle = atan(point.y, point.x)
    + sharedSpin
    + uAngularMovement * (uPhrase16Progress - 0.5 + sectionMotion * 0.28);
  float cellPhase = angle * cellCount + uPhrase16Progress * SHADER_TAU;
  float cellDefinition = pow(
    abs(cos(cellPhase)),
    max(0.2, uSemanticCellDepth)
  );
  float cellCut = smoothstep(0.08, 0.92, cellDefinition);

  float sectionEnergy = mix(uEnergyLongTerm, uSectionIntensity, uHasSections);
  float releaseScale = 1.0 + dropAmount * (0.12 + uSemanticResponse * 0.11);
  float coreRadius = uCoreSize * contraction * releaseScale
    * (1.0 + bass * uMasterBassReactivity * uSemanticResponse * 0.18);
  float ringWidth = 58.0 - uLowMid * 16.0 + uSemanticCellDepth * 9.0;
  float segmentedRing = reactorRing(radius, coreRadius, ringWidth)
    * mix(0.22, 1.0, cellCut);

  float spokePhase = abs(sin(cellPhase * 0.5 + uPhrase4Progress * SHADER_TAU));
  float spokes = exp(-spokePhase * (16.0 + uSemanticCellDepth * 9.0))
    * smoothstep(coreRadius * 0.28, coreRadius * 1.7, radius)
    * (1.0 - smoothstep(coreRadius * 1.7, coreRadius * 2.7, radius));
  float inner = exp(-radius * (5.8 - buildAmount * 2.0))
    * (0.2 + bass * 0.55 + sectionEnergy * 0.25);
  float fakeoutCut = 1.0 - music.fakeout * smoothstep(coreRadius * 0.2, coreRadius * 1.9, radius);

  float coreEnergy = uCoreIntensity
    * (0.48 + bass * uMasterBassReactivity * 0.5 + music.macro * 0.2);
  vec3 semanticCoreColor = mix(
    uPrimaryColor.rgb,
    uSecondaryColor.rgb,
    uPhrase4Progress
  );
  vec3 color = semanticCoreColor * segmentedRing * fakeoutCut * coreEnergy;
  color += uSecondaryColor.rgb * spokes
    * (0.18 + music.rhythm * 0.38 + dropAmount * 0.22);
  color += uAccentColor.rgb * inner
    * (0.18 + buildAmount * 0.78 + uEnergyDelta * 0.12);

  float mask = saturate(segmentedRing + spokes * 0.5 + inner * 0.35);
  return ReactorLayer(color, mask, 0.0);
}
`

const REACTOR_SHRAPNEL_MODULE_GLSL = String.raw`
ReactorLayer renderShrapnelModule(
  vec2 point,
  MusicSignals music,
  float bass,
  float buildAmount,
  float dropAmount,
  float contraction,
  float sharedSpin
) {
  if (uShrapnelEnabled < 0.001 || uShrapnelMix < 0.001) {
    return emptyReactorLayer();
  }

  // Persistent deterministic layout key. uRayEpoch is advanced CPU-side per the
  // selected re-roll cadence (Off / Bar / 4 Bars / Phrase / Drop); uRaySeed
  // pins a particular look. A given (seed, epoch) always rebuilds the same field.
  float epoch = floor(uRaySeed) + floor(uRayEpoch);
  float epochHash = hash11(epoch * 1.713 + 4.27);

  float irregularity = saturate(uRayAngularIrregularity);
  float curvature = saturate(uRayCurvature);
  float forkAmount = saturate(uRayForkAmount);
  float dashDensity = saturate(uRayDashDensity);
  float lengthVariation = saturate(uRayLengthVariation);
  float styleSelector = clamp(uRayStyle, 0.0, 5.0);
  float mixedStyle = step(4.5, styleSelector);

  float detonation = max(dropAmount, uDrumStemTransient * uHasStems * uDropForce);
  float forceAngle = sharedSpin * 0.58
    + uPhrase4Progress * SHADER_TAU * 0.35
    + (epochHash - 0.5) * 1.8;
  vec2 forceDirection = vec2(cos(forceAngle), sin(forceAngle));
  vec2 impactOrigin = vec2(
    hash11(epoch * 2.31 + 1.7) - 0.5,
    hash11(epoch * 3.17 + 8.2) - 0.5
  ) * uTurbulence * 0.22;
  impactOrigin += forceDirection * (music.fakeout - 0.35) * uTurbulence * 0.09;

  vec2 localPoint = rotate2d(sharedSpin * 0.42) * (point - impactOrigin);
  localPoint *= mix(1.0, contraction * 0.72, buildAmount * (1.0 - music.fakeout * 0.35));

  float rayFieldPrimary = 0.0;
  float rayFieldSecondary = 0.0;
  float rayFieldAccent = 0.0;
  float hotEdges = 0.0;
  float rayMask = 0.0;
  float count = max(8.0, floor(uShardCount));

  for (int index = 0; index < 64; index++) {
    float rayIndex = float(index);
    if (rayIndex >= count) break;

    // Decorrelated per-ray hashes, keyed on the persistent epoch.
    float h0 = hash11(rayIndex * 13.37 + epoch * 0.618);       // placement / speed
    float h1 = hash11(rayIndex * 7.91 + epoch * 1.231 + 2.0);  // style / colour role
    float h2 = hash11(rayIndex * 21.13 + epoch * 0.417 + 5.0); // length / travel phase
    float h3 = hash11(rayIndex * 3.77 + epoch * 2.909 + 9.0);  // fork / dash phase

    // Angular placement: even fan <-> golden-angle scatter (irregular, no clumps).
    float evenAngle = rayIndex / count * SHADER_TAU;
    float scatterAngle = reactorGoldenAngle(rayIndex + epoch * 0.5)
      + (h0 - 0.5) * (SHADER_TAU / count) * 1.5;
    float radialAngle = mix(evenAngle, scatterAngle, irregularity)
      + h0 * 0.35
      + uPhrase4Progress * 0.65;
    vec2 radialDirection = vec2(cos(radialAngle), sin(radialAngle));
    float directionalBias = clamp(
      0.1 + uTurbulence * 0.16 + hash11(h0 * 31.0) * 0.24,
      0.0,
      0.62
    );
    vec2 direction = normalize(
      mix(radialDirection, forceDirection, directionalBias) + vec2(0.0001)
    );
    vec2 tangent = vec2(-direction.y, direction.x);

    // Style: the enum pins every ray, or Mixed seeds one per ray (0..4).
    float style = mix(styleSelector, floor(h1 * 5.0), mixedStyle);
    float isLance = step(abs(style - 1.0), 0.5);
    float isTracer = step(abs(style - 2.0), 0.5);
    float isForked = step(abs(style - 3.0), 0.5);
    float isArc = step(abs(style - 4.0), 0.5);

    float speed = 0.22 + h0 * 0.78;
    float phase = h2;
    float travel = fract(
      uPlaybackTime * (0.055 + speed * 0.095) * max(0.05, uShardSpeed)
      + phase
      + detonation * (0.08 + speed * 0.16)
    );
    travel = mix(travel, 0.12 + travel * 0.2, buildAmount * music.fakeout);

    float distanceFromOrigin = uCoreSize * 0.18
      + travel * (0.34 + uSpread * 0.72 + detonation * speed * 0.22);
    float turbulenceSample = waveformAt(fract(phase + uPhrase8Progress * 0.2));
    turbulenceSample += noise21(vec2(h0 * 17.0, uTime * 0.35)) - 0.5;
    vec2 rayCenter = direction * distanceFromOrigin
      + tangent * turbulenceSample * uTurbulence * 0.14;

    // Seeded per-ray length.
    float baseLength = (0.045 + speed * 0.16)
      * (0.5 + uSpread * 0.52)
      * (1.0 + uTransient * 0.45 + detonation * 0.3);
    float rayLength = max(0.02, baseLength * mix(1.0, 0.4 + h2 * 1.4, lengthVariation));
    float rayWidth = 0.0045 + uHigh * 0.006 + uHatHit * 0.008;

    vec2 tail = rayCenter - direction * rayLength * 0.38;
    vec2 head = rayCenter + direction * rayLength;

    // Style silhouette.
    float distanceToRay;
    if (isArc > 0.5) {
      vec2 control = mix(tail, head, 0.5)
        + tangent * curvature * rayLength * (h3 * 2.0 - 1.0);
      distanceToRay = reactorBezierDistance(localPoint, tail, control, head);
    } else {
      distanceToRay = reactorSegmentDistance(localPoint, tail, head);
    }
    if (isForked > 0.5) {
      vec2 forkStart = mix(tail, head, 0.62);
      vec2 forkDirection = rotate2d(mix(0.12, 0.5, forkAmount) * (h3 * 2.0 - 1.0)) * direction;
      distanceToRay = min(
        distanceToRay,
        reactorSegmentDistance(localPoint, forkStart, forkStart + forkDirection * rayLength * 0.5)
      );
    }

    float ray = exp(-distanceToRay * (128.0 - rayWidth * 2200.0));

    // Along-ray parameter for the Lance taper and the Tracer dash gate.
    vec2 axis = head - tail;
    float along = saturate(dot(localPoint - tail, axis) / max(dot(axis, axis), 0.0001));
    float taper = 1.0 - isLance * along * 0.85;
    float dashGate = mix(
      1.0,
      step(0.42, fract(along * mix(3.0, 14.0, dashDensity) - travel * 6.0 + h3)),
      isTracer
    );
    ray *= taper * dashGate;

    float travelEnvelope = smoothstep(0.0, 0.08, travel)
      * (1.0 - smoothstep(0.72, 1.0, travel));
    float spectral = spectrumAt(fract(phase * 0.8 + rayIndex / count * 0.2));
    float weightedRay = ray * travelEnvelope
      * (0.32 + spectral * 0.82)
      * (0.58 + travel + detonation * 0.38);

    // Seeded colour role — mostly primary, some secondary, a few accent — so the
    // field reads as one hue with variety rather than two flat colours.
    float roleHash = h1;
    rayFieldPrimary += weightedRay * step(roleHash, 0.68);
    rayFieldSecondary += weightedRay * step(0.68, roleHash) * step(roleHash, 0.9);
    rayFieldAccent += weightedRay * step(0.9, roleHash);

    rayMask += ray * travelEnvelope;
    hotEdges += weightedRay * step(0.7, h1)
      * (uSnareHit + uHatHit * 0.42 + uSpectralFlux * 0.32);
  }

  float coreRadius = uCoreSize * contraction * (0.22 + bass * 0.16);
  float angularCore = reactorDiamond(localPoint, coreRadius, 82.0)
    * (0.55 + buildAmount * 0.85);
  float reverseCut = mix(
    1.0,
    1.0 - smoothstep(0.1, 0.95, length(localPoint)),
    uSnareHit * 0.42
  );

  float coreEnergy = 0.5 + uCoreIntensity * 0.45 + music.micro * 0.25;
  vec3 color = (
    uPrimaryColor.rgb * rayFieldPrimary
    + uSecondaryColor.rgb * rayFieldSecondary
    + uAccentColor.rgb * rayFieldAccent
  ) * reverseCut * coreEnergy;
  color += uAccentColor.rgb * hotEdges;
  color += uSecondaryColor.rgb * angularCore
    * uCoreIntensity * (0.58 + buildAmount * 1.15);

  float mask = saturate(rayMask * 0.42 + angularCore);
  return ReactorLayer(color, mask, 0.0);
}
`

const REACTOR_BRAND_MODULE_GLSL = String.raw`
ReactorLayer renderBrandModule(
  vec2 uv,
  vec2 point,
  MusicSignals music,
  float bass,
  float vocal,
  float buildAmount,
  float dropAmount,
  float contraction,
  float sharedSpin
) {
  if (uBrandCoreEnabled < 0.001 || uBrandMix < 0.001) {
    return emptyReactorLayer();
  }

  float logoPresent = step(0.5, uBrandLogoAvailable * uBrandEnabled);
  float reactiveScale = uLogoScale * contraction
    * (0.82 + uCoreSize * 0.38)
    * (1.0 + bass * uMasterBassReactivity * 0.12 + dropAmount * 0.04);
  float logoMask = brandLogoMask(point / max(0.18, reactiveScale));
  float logoEdge = (abs(dFdx(logoMask)) + abs(dFdy(logoMask))) * 7.0;

  // A subdued angular calibration mark is the neutral no-logo state. It is
  // intentionally not a glowing orb, so missing Brand Kit identity is obvious.
  float neutralRadius = uCoreSize * contraction * 0.72;
  float neutralDiamond = reactorDiamond(point, neutralRadius, 70.0);
  float neutralCross = max(
    exp(-abs(point.x) * 82.0) * (1.0 - smoothstep(neutralRadius * 0.85, neutralRadius * 1.6, abs(point.y))),
    exp(-abs(point.y) * 82.0) * (1.0 - smoothstep(neutralRadius * 0.85, neutralRadius * 1.6, abs(point.x)))
  );
  float neutralMask = saturate(neutralDiamond * 0.72 + neutralCross * 0.2);
  float identityMask = mix(neutralMask, logoMask, logoPresent);

  float angle = atan(point.y, point.x);
  float radius = length(point);
  float waveform = waveformAt(fract(angle / SHADER_TAU + 0.5));
  float spectrum = spectrumAt(fract(radius * 0.65 + angle / SHADER_TAU));
  float refractedRadius = radius + waveform * uRefractionAmount
    * uMediaRefractionEnabled * (0.025 + bass * 0.055);
  float orbitAngle = angle + sharedSpin
    + uOrbitAmount * uPhrase32Progress * SHADER_TAU
    + uChordCode * 0.015 * uHasHarmonics;
  float fragmentCount = max(6.0, floor(mix(10.0, uShardCount, 0.68)));
  float sector = abs(fract(orbitAngle / SHADER_TAU * fragmentCount) - 0.5);
  float orbitRadius = uCoreSize * contraction + uOrbitAmount * 0.23
    + bass * 0.06 + spectrum * 0.045;
  float orbitFragments = exp(-sector * (48.0 - uComplexity * 10.0 - uTurbulence * 5.0))
    * reactorRing(refractedRadius, orbitRadius, 42.0)
    * uOrbitAmount;

  float lyricSignal = uLyricVocalFillEnabled * uVocalLyricInfluence * (
    uHasLyrics * (uLyricActivity * 0.38 + uLyricLineProgress * 0.2 + uLyricWordHit * 0.55)
    + vocal * 0.68
    + uHasSemantics * uVocalHookConfidence * 0.5
  );
  float identityEnergy = uCoreIntensity
    * (0.62 + bass * 0.32 + lyricSignal * 0.55 + buildAmount * 0.16);

  vec3 media = vec3(0.0);
  float mediaWeight = uUserMediaAvailable + uAlbumArtworkAvailable + uMediaOutputAvailable;
  if (uMediaRefractionEnabled > 0.001 && uMediaInfluence > 0.001 && mediaWeight > 0.0) {
    vec2 direction = point / max(length(point), 0.0001);
    vec2 refractedUv = clamp(
      uv + direction * waveform * uRefractionAmount * (0.012 + bass * 0.025),
      vec2(0.001),
      vec2(0.999)
    );
    media = (
      texture(uUserMedia, refractedUv).rgb * uUserMediaAvailable
      + texture(uAlbumArtwork, refractedUv).rgb * uAlbumArtworkAvailable
      + texture(uMediaOutput, refractedUv).rgb * uMediaOutputAvailable
    ) / mediaWeight;
  }

  vec3 authoredCore = mix(uPrimaryColor.rgb, uBrandPrimary.rgb, uBrandEnabled);
  vec3 authoredOrbit = mix(uSecondaryColor.rgb, uBrandSecondary.rgb, uBrandEnabled);
  vec3 authoredImpact = mix(uAccentColor.rgb, uBrandImpact.rgb, uBrandEnabled);

  vec3 logoColor = authoredCore * logoMask * (1.05 + identityEnergy * 0.82);
  logoColor += uBrandHighlight.rgb * logoEdge * logoPresent
    * (0.42 + uSnareHit * 0.5
      + uChordChangeHit * uHasHarmonics * 0.32
      + lyricSignal * 0.22);
  vec3 fallbackColor = mix(uPrimaryColor.rgb, uSecondaryColor.rgb, 0.45)
    * neutralMask * (0.2 + identityEnergy * 0.28);

  vec3 color = mix(fallbackColor, logoColor, logoPresent);
  color += authoredOrbit * orbitFragments
    * (0.28 + bass * 0.32 + dropAmount * 0.28);
  color += authoredImpact * logoMask * lyricSignal * logoPresent * 0.5;
  color += media * clamp(mediaWeight, 0.0, 1.0) * uMediaInfluence
    * uMediaRefractionEnabled
    * (0.08 + identityMask * 0.42 + music.expression * 0.14);

  float mask = saturate(identityMask + orbitFragments * 0.55 + logoEdge * 0.25);
  return ReactorLayer(color, mask, logoMask * logoPresent);
}
`

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

uniform float uSemanticMix;
uniform float uShrapnelMix;
uniform float uBrandMix;

uniform float uCoreSize;
uniform float uCoreIntensity;
uniform float uRotationSpeed;
uniform float uBuildContraction;
uniform float uDropForce;
uniform float uShockwaveIntensity;
uniform float uShockwaveWidth;
uniform float uOverallGlow;
uniform float uSemanticCellCount;
uniform float uSemanticCellDepth;
uniform float uAngularMovement;
uniform float uSemanticResponse;
uniform float uShardCount;
uniform float uShardSpeed;
uniform float uSpread;
uniform float uTurbulence;
uniform float uTrailPersistence;
uniform float uRayStyle;
uniform float uRayRerollCadence;
uniform float uRaySeed;
uniform float uRayEpoch;
uniform float uRayAngularIrregularity;
uniform float uRayCurvature;
uniform float uRayForkAmount;
uniform float uRayDashDensity;
uniform float uRayLengthVariation;
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

${REACTOR_MODULE_TYPES_GLSL}
${REACTOR_MODULE_UTILS_GLSL}
${REACTOR_SEMANTIC_MODULE_GLSL}
${REACTOR_SHRAPNEL_MODULE_GLSL}
${REACTOR_BRAND_MODULE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 point = uv * 2.0 - 1.0;
  point.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float bass = mix(uBass, max(uBass, uBassStemEnergy), uHasStems);
  float vocal = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float buildAmount = max(music.build, uBuildProgress);
  float dropAmount = max(music.drop, uDropImpact) * uDropForce;
  float contraction = mix(
    1.0,
    clamp(uBuildContraction, 0.25, 1.0),
    buildAmount * (1.0 - music.fakeout * 0.42)
  );
  float sharedSpin = uTime * uRotationSpeed * uMasterMotion
    + uPhrase32Progress * uRotationSpeed * SHADER_TAU * 0.35;

  ReactorLayer semanticLayer = renderSemanticModule(
    point, music, bass, buildAmount, dropAmount, contraction, sharedSpin
  );
  ReactorLayer shrapnelLayer = renderShrapnelModule(
    point, music, bass, buildAmount, dropAmount, contraction, sharedSpin
  );
  ReactorLayer brandLayer = renderBrandModule(
    uv, point, music, bass, vocal, buildAmount, dropAmount, contraction, sharedSpin
  );

  float semanticWeight = uSemanticGeometryEnabled * max(0.0, uSemanticMix);
  float shrapnelWeight = uShrapnelEnabled * max(0.0, uShrapnelMix);
  float brandWeight = uBrandCoreEnabled * max(0.0, uBrandMix) * max(0.0, uBrandInfluence);
  float weightSum = semanticWeight + shrapnelWeight + brandWeight;
  float normalization = 1.0 / max(1.0, 1.0 + max(0.0, weightSum - 1.0) * 0.48);

  vec3 nonBrandColor = semanticLayer.color * semanticWeight
    + shrapnelLayer.color * shrapnelWeight;
  float logoOcclusion = saturate(brandLayer.identityMask * brandWeight * 1.35);
  nonBrandColor *= mix(1.0, 0.16, logoOcclusion);

  vec3 moduleColor = (nonBrandColor + brandLayer.color * brandWeight) * normalization;
  moduleColor += brandLayer.color * brandWeight * brandLayer.identityMask * 0.24;

  float radius = length(point);
  float shockRadius = fract(uBarPhase + dropAmount * 0.32) * (1.08 + uSpread * 0.2);
  float shockWidth = mix(78.0, 18.0, clamp(uShockwaveWidth, 0.02, 0.5));
  float shockShape = reactorRing(radius, shockRadius, shockWidth)
    * uShockwaveEnabled
    * uShockwaveIntensity
    * (dropAmount + uDownbeatHit * 0.55 + uSectionChangePulse * 0.18);
  vec3 shockColor = mix(uAccentColor.rgb, uBrandImpact.rgb, uBrandEnabled * brandWeight)
    * shockShape;

  vec3 background = mix(
    uBackgroundColor.rgb,
    uBrandBackground.rgb,
    saturate(uBrandEnabled * brandWeight * 0.42)
  ) * (0.52 + music.macro * 0.24 + uEnergyLongTerm * 0.12);

  vec3 color = background + moduleColor + shockColor;
  color = applyBrandAtmosphere(color, uv, 0.08 + uMediaInfluence * brandWeight * 0.16);
  color *= 0.76 + uOverallGlow * 0.2 + uMasterGlow * 0.14;
  color = reactorCompress(color, 0.1 + weightSum * 0.035);
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
uniform float uDeltaTime;
out vec4 fragColor;

void main() {
  vec2 centered = v_uv - 0.5;
  float angle = (uRotationSpeed * 0.005 + uSnareHit * 0.008)
    * uMasterMotion * (0.5 + uPhrase8Progress);
  float cosineValue = cos(angle);
  float sineValue = sin(angle);
  centered = mat2(cosineValue, -sineValue, sineValue, cosineValue) * centered;
  centered *= 0.996 - uKickHit * 0.01;

  vec3 previousColor = texture(
    uPreviousReactor,
    clamp(centered + 0.5, 0.001, 0.999)
  ).rgb;
  vec3 freshColor = texture(uFreshReactor, v_uv).rgb;
  float retention = clamp(
    uTrailPersistence
      * (1.0 - uMasterTrailDecay)
      * (0.985 - min(uDeltaTime, 0.1) * 0.2),
    0.0,
    0.985
  ) * uFeedbackTrailsEnabled;
  vec3 trailColor = previousColor * retention * (0.92 + uOverallGlow * 0.045);
  vec3 color = freshColor + trailColor * (vec3(1.0) - clamp(freshColor, 0.0, 1.0) * 0.38);
  fragColor = vec4(max(color, 0.0), 1.0);
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
uniform float uMasterGlow;
out vec4 fragColor;

void main() {
  vec3 historyColor = texture(uReactorHistory, v_uv).rgb;
  vec3 freshColor = texture(uFreshReactor, v_uv).rgb;
  vec3 color = historyColor + freshColor
    * (0.1 + uCoreIntensity * 0.08 + uDropImpact * 0.1);
  color += vec3(1.0) * uSnareHit * (0.025 + uOverallGlow * 0.025);
  color *= max(0.0, uOverallMix)
    * uMasterIntensity
    * (0.76 + uOverallGlow * 0.16 + uMasterGlow * 0.16);
  color = max(color, 0.0) / (vec3(1.0) + max(color, 0.0) * 0.58);
  color = pow(color, vec3(0.4545));
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
  { id: 'semanticMix', type: 'float', label: 'Semantic Mix', group: 'Modules', uniformName: 'uSemanticMix', min: 0, max: 1.5, step: 0.01, default: 0.72, modulatable: true },
  { id: 'shrapnelEnabled', type: 'boolean', label: 'Shrapnel', group: 'Modules', uniformName: 'uShrapnelEnabled', default: true },
  { id: 'shrapnelMix', type: 'float', label: 'Shrapnel Mix', group: 'Modules', uniformName: 'uShrapnelMix', min: 0, max: 1.5, step: 0.01, default: 0.78, modulatable: true },
  { id: 'brandCoreEnabled', type: 'boolean', label: 'Brand Core', group: 'Modules', uniformName: 'uBrandCoreEnabled', default: true },
  { id: 'brandMix', type: 'float', label: 'Brand Mix', group: 'Modules', uniformName: 'uBrandMix', min: 0, max: 1.5, step: 0.01, default: 0.9, modulatable: true },
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
  { id: 'overallMix', type: 'float', label: 'Overall Mix', group: 'Core and Motion', uniformName: 'uOverallMix', min: 0, max: 1.5, step: 0.01, default: 0.94, modulatable: true },

  { id: 'semanticCellCount', type: 'integer', label: 'Cell Count', group: 'Semantic', uniformName: 'uSemanticCellCount', min: 3, max: 24, step: 1, default: 10, modulatable: true },
  { id: 'semanticCellDepth', type: 'float', label: 'Cell Definition', group: 'Semantic', uniformName: 'uSemanticCellDepth', min: 0.2, max: 2.5, step: 0.01, default: 0.9, modulatable: true },
  { id: 'angularMovement', type: 'float', label: 'Angular Movement', group: 'Semantic', uniformName: 'uAngularMovement', min: -4, max: 4, step: 0.01, default: 0.82, modulatable: true },
  { id: 'semanticResponse', type: 'float', label: 'Semantic Response', group: 'Semantic', uniformName: 'uSemanticResponse', min: 0, max: 2.5, step: 0.01, default: 0.92, modulatable: true },

  { id: 'shardCount', type: 'integer', label: 'Shard Count', group: 'Shrapnel', uniformName: 'uShardCount', min: 8, max: 64, step: 1, default: 32, modulatable: true },
  { id: 'shardSpeed', type: 'float', label: 'Shard Speed', group: 'Shrapnel', uniformName: 'uShardSpeed', min: 0, max: 2.5, step: 0.01, default: 0.95, modulatable: true },
  { id: 'spread', type: 'float', label: 'Spread', group: 'Shrapnel', uniformName: 'uSpread', min: 0.2, max: 2.5, step: 0.01, default: 1.05, modulatable: true },
  { id: 'turbulence', type: 'float', label: 'Turbulence', group: 'Shrapnel', uniformName: 'uTurbulence', min: 0, max: 2.5, step: 0.01, default: 0.82, modulatable: true },
  { id: 'trailPersistence', type: 'float', label: 'Trail Persistence', group: 'Shrapnel', uniformName: 'uTrailPersistence', min: 0, max: 0.99, step: 0.01, default: 0.84, modulatable: true },

  {
    id: 'rayStyle', type: 'enum', label: 'Ray Style', group: 'Shrapnel', uniformName: 'uRayStyle',
    values: [
      { value: 'spoke', label: 'Spoke' },
      { value: 'lance', label: 'Lance' },
      { value: 'tracer', label: 'Tracer' },
      { value: 'forked', label: 'Forked' },
      { value: 'arc', label: 'Arc' },
      { value: 'mixed', label: 'Mixed' },
    ],
    default: 'mixed',
  },
  {
    id: 'rayRerollCadence', type: 'enum', label: 'Re-roll Cadence', group: 'Shrapnel', uniformName: 'uRayRerollCadence',
    values: [
      { value: 'off', label: 'Off' },
      { value: 'bar', label: 'Bar' },
      { value: 'bar4', label: '4 Bars' },
      { value: 'phrase', label: 'Phrase' },
      { value: 'drop', label: 'Drop' },
    ],
    default: 'bar',
  },
  { id: 'raySeed', type: 'integer', label: 'Ray Seed', group: 'Shrapnel', uniformName: 'uRaySeed', min: 0, max: 9999, step: 1, default: 1, modulatable: false },
  { id: 'rayAngularIrregularity', type: 'float', label: 'Angular Irregularity', group: 'Shrapnel', uniformName: 'uRayAngularIrregularity', min: 0, max: 1, step: 0.01, default: 0.35, modulatable: true },
  { id: 'rayCurvature', type: 'float', label: 'Ray Curvature', group: 'Shrapnel', uniformName: 'uRayCurvature', min: 0, max: 1, step: 0.01, default: 0.25, modulatable: true },
  { id: 'rayForkAmount', type: 'float', label: 'Fork Amount', group: 'Shrapnel', uniformName: 'uRayForkAmount', min: 0, max: 1, step: 0.01, default: 0.3, modulatable: true },
  { id: 'rayDashDensity', type: 'float', label: 'Dash Density', group: 'Shrapnel', uniformName: 'uRayDashDensity', min: 0, max: 1, step: 0.01, default: 0.4, modulatable: true },
  { id: 'rayLengthVariation', type: 'float', label: 'Length Variation', group: 'Shrapnel', uniformName: 'uRayLengthVariation', min: 0, max: 1, step: 0.01, default: 0.5, modulatable: true },

  { id: 'brandInfluence', type: 'float', label: 'Brand Influence', group: 'Brand and Media', uniformName: 'uBrandInfluence', min: 0, max: 1.5, step: 0.01, default: 0.82, modulatable: true },
  { id: 'logoScale', type: 'float', label: 'Logo Scale', group: 'Brand and Media', uniformName: 'uLogoScale', min: 0.25, max: 2, step: 0.01, default: 0.96, modulatable: true },
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
  description: 'A composable semantic, shrapnel, and brand-reactive Shader scene with independently blendable modules.',
  category: 'feedback',
  version: 3,
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

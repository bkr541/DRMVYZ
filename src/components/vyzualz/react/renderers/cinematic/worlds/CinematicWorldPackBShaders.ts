import { CINEMATIC_WORLD_SHADER_HEADER as HEADER } from './CinematicWorldShaderCommon'

export const LIQUID_MEMBRANE_FRAGMENT_SOURCE = `${HEADER}
uniform float uMembraneScale;
uniform float uViscosity;
uniform float uStretch;
uniform float uRippleDensity;
uniform float uRippleSpeed;
uniform float uTearAmount;
uniform float uRefractionStrength;
uniform float uSurfaceDetail;
uniform float uEdgeSoftness;
uniform float uOpeningBias;
uniform float uMidSurfaceMotion;

void main() {
  vec2 p = cinematicCameraUv(v_uv);
  p.x *= uResolution.x / max(1.0, uResolution.y);

  float qualityMix = uQuality / 3.0;
  int detail = int(min(uSurfaceDetail, mix(2.0, 7.0, qualityMix)));
  float fluidSpeed = mix(1.25, 0.24, uViscosity) * uRippleSpeed;
  float time = uTime * fluidSpeed * uVariation.w;
  float bassPressure = uBass * (0.10 + uStretch * 0.10) + uDrop * 0.07;
  float midMotion = uMid * uMidSurfaceMotion;

  vec2 elastic = p;
  elastic.x += sin(p.y * (3.0 + uRippleDensity * 0.45) + time * 1.3) * uStretch * (0.025 + bassPressure * 0.10);
  elastic.y += cos(p.x * (4.0 + uRippleDensity * 0.32) - time) * uStretch * (0.018 + midMotion * 0.045);
  elastic *= vec2(1.0 - bassPressure * 0.08, 1.0 + bassPressure * 0.16);

  float fluid = fbm21(elastic * (2.0 + uRippleDensity * 0.22) + vec2(time, -time * 0.73), detail) - 0.5;
  float angle = atan(elastic.y, elastic.x);
  float radial = length(elastic * vec2(0.92, 1.08));
  float ripples = sin(radial * (12.0 + uRippleDensity * 4.0) - time * 7.0 + fluid * 4.0);
  ripples += sin(angle * (5.0 + uRippleDensity) + time * 2.1) * 0.35;

  float baseRadius = uMembraneScale * mix(0.34, 0.70, uOpeningBias);
  baseRadius += bassPressure + uBeat * 0.025;
  float tearNoise = fluid * (0.14 + uTearAmount * 0.22);
  tearNoise += sin(angle * (7.0 + uTearAmount * 12.0) + uVariation.x * 6.2831) * uTearAmount * 0.045;
  float split = abs(elastic.x + sin(elastic.y * 7.0 + time) * 0.08);
  tearNoise += smoothstep(0.26, 0.0, split) * uTearAmount * (0.05 + uDrop * 0.08);
  float signedEdge = radial - (baseRadius + tearNoise + ripples * 0.012 * (1.0 - uViscosity));
  float opening = smoothstep(uEdgeSoftness, -uEdgeSoftness, signedEdge);
  float edge = smoothstep(uEdgeSoftness * 1.8, 0.0, abs(signedEdge));

  vec2 refracted = elastic;
  vec2 normal = normalize(elastic + vec2(0.0001));
  refracted += normal * (fluid + ripples * 0.12) * uRefractionStrength * 0.085;
  float innerBands = 0.5 + 0.5 * sin(refracted.x * 10.0 + sin(refracted.y * 7.0 - time) * 2.0);
  float innerDepth = fbm21(refracted * 4.0 + vec2(-time * 0.3, time * 0.2), max(2, detail - 1));
  vec3 inside = mix(uSecondary, uPrimary, innerBands);
  inside = mix(inside, uAccent, innerDepth * 0.42 + uHigh * 0.25);
  inside *= 0.32 + innerDepth * 0.62 + uBass * 0.42 + uDrop * 0.38;

  float membraneSheen = smoothstep(0.9, 0.05, radial) * (0.12 + fluid * 0.12 + midMotion * 0.20);
  vec3 surface = mix(uSecondary * 0.06, uPrimary * 0.18, 0.5 + fluid);
  surface += mix(uPrimary, uAccent, uHigh) * membraneSheen;
  surface += mix(uPrimary, vec3(1.0), 0.35) * edge * (0.55 + uBass * 0.8 + uTransient * 0.6);

  vec3 color = mix(surface, inside, opening);
  float outerHalo = exp(-abs(signedEdge) * (8.0 + uViscosity * 10.0));
  color += uPrimary * outerHalo * (0.08 + midMotion * 0.15);
  color *= smoothstep(1.65, 0.18, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const CELESTIAL_CATHEDRAL_FRAGMENT_SOURCE = `${HEADER}
uniform float uCathedralScale;
uniform float uArchCount;
uniform float uPillarCount;
uniform float uRibDensity;
uniform float uAisleDepth;
uniform float uLightShaftIntensity;
uniform float uStarDensity;
uniform float uMajesticSpeed;
uniform float uCameraDrift;
uniform float uIlluminationResponse;
uniform float uArchitectureStyle;

float cathedralArch(vec2 q, float width, float style) {
  float curved = abs(length(vec2(q.x, q.y + 0.38)) - width);
  float pointed = abs(abs(q.x) + (q.y + 0.28) * 0.62 - width);
  float ribbed = min(curved, abs(abs(q.x) - width * 0.78));
  if (style < 0.5) return curved;
  if (style < 1.5) return pointed;
  return ribbed;
}

void main() {
  vec2 p = cinematicCameraUv(v_uv);
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float slowTime = uTime * uMajesticSpeed * uVariation.w;
  vec2 drift = vec2(sin(slowTime * 0.37 + uVariation.x * 6.0), cos(slowTime * 0.29)) * uCameraDrift;
  vec2 ray = p - drift;
  ray.y += 0.06;

  vec3 color = vec3(0.0015, 0.003, 0.010);
  float qualityMix = uQuality / 3.0;
  int stepBudget = int(mix(10.0, 36.0, qualityMix));
  int steps = int(min(float(stepBudget), max(6.0, uArchCount * 2.0)));
  float travel = uTransportTime * uMajesticSpeed * 0.018 + slowTime * 0.035;
  float midLight = uMid * uIlluminationResponse;

  for (int i = 0; i < 36; i++) {
    if (i >= steps) break;
    float fi = float(i);
    float slice = fract(fi / float(steps) + travel);
    float z = 0.045 + slice * slice * (1.25 + uAisleDepth * 0.7);
    float perspective = 0.11 + z * 1.45;
    vec2 q = ray / perspective;
    q.y += 0.20 + z * 0.10;

    float width = uCathedralScale * (0.78 + 0.06 * sin(fi * 0.71 + uVariation.y));
    float archDist = cathedralArch(q, width, uArchitectureStyle);
    float thickness = (0.018 + uRibDensity * 0.024) / perspective;
    float arch = smoothstep(thickness, 0.0, archDist);

    float pillarCells = max(3.0, uPillarCount);
    float pillarCoord = abs(fract((q.x / max(width * 2.0, 0.2) + 0.5) * pillarCells) - 0.5);
    float pillars = smoothstep(0.10 + uRibDensity * 0.035, 0.025, pillarCoord);
    pillars *= smoothstep(width * 1.1, width * 0.72, abs(q.x));
    pillars *= smoothstep(width * 1.05, -width * 0.65, q.y);

    float fade = exp(-z * (0.75 + uAisleDepth * 1.35));
    float cadence = 0.5 + 0.5 * sin(fi * 1.7 + uBarProgress * 6.2831);
    vec3 stone = mix(uSecondary, uPrimary, cadence * 0.44 + midLight * 0.35);
    color += stone * (arch + pillars * 0.42) * fade * (0.07 + fi / float(steps) * 0.055);
    color += uAccent * arch * fade * (midLight * 0.18 + uDownbeat * 0.24);

    float floorLine = smoothstep(thickness * 0.8, 0.0, abs(q.y + width * 0.78));
    color += uPrimary * floorLine * fade * 0.032;
  }

  vec2 starUv = ray * (8.0 + uStarDensity * 8.0) + vec2(slowTime * 0.06, -slowTime * 0.03);
  vec2 starCell = floor(starUv);
  vec2 starLocal = fract(starUv) - 0.5;
  float starChance = hash21(starCell);
  float stars = smoothstep(0.055, 0.0, length(starLocal));
  stars *= step(0.93 - uStarDensity * 0.11, starChance);
  stars *= 0.45 + 0.55 * sin(uTime * 0.7 + starChance * 17.0);
  color += mix(uPrimary, vec3(1.0), 0.58) * stars * (0.18 + uHigh * 0.38);

  float shaftWidth = mix(0.42, 0.12, uAisleDepth / 1.5);
  float shaft = smoothstep(shaftWidth, 0.0, abs(ray.x));
  shaft *= smoothstep(1.0, -0.65, ray.y);
  shaft *= 0.42 + 0.58 * fbm21(vec2(ray.x * 10.0, ray.y * 2.2 - slowTime * 0.4), int(mix(2.0, 5.0, qualityMix)));
  color += mix(uPrimary, uAccent, midLight) * shaft * uLightShaftIntensity * (0.08 + midLight * 0.18 + uVolume * 0.08);

  float rose = smoothstep(0.018, 0.0, abs(length(ray * vec2(1.0, 1.22)) - uCathedralScale * 0.24));
  rose *= 0.5 + 0.5 * sin(atan(ray.y, ray.x) * (8.0 + uRibDensity * 12.0) + slowTime);
  color += uAccent * rose * (0.14 + midLight * 0.55 + uDownbeat * 0.25);

  color *= smoothstep(1.72, 0.20, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const MIRROR_DIMENSION_FRAGMENT_SOURCE = `${HEADER}
uniform float uSymmetryCount;
uniform float uRecursionDepth;
uniform float uChamberDepth;
uniform float uMirrorScale;
uniform float uFeedbackAmount;
uniform float uFeedbackDrift;
uniform float uSnapStrength;
uniform float uFoldStrength;
uniform float uRotationSpeed;
uniform float uStructureStyle;

vec2 mirrorFold(vec2 p, float sectors) {
  float sector = 6.2831853 / max(3.0, sectors);
  float angle = atan(p.y, p.x);
  angle = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);
  return vec2(cos(angle), sin(angle)) * length(p);
}

float mirrorStructure(vec2 q, float style) {
  if (style < 0.5) return min(abs(abs(q.x) - 0.42), abs(abs(q.y) - 0.42));
  if (style < 1.5) return abs(length(q) - 0.52);
  return abs(max(abs(q.x) * 0.86 + abs(q.y) * 0.54, abs(q.y)) - 0.52);
}

void main() {
  vec2 p = cinematicCameraUv(v_uv);
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float qualityMix = uQuality / 3.0;
  int recursionBudget = int(mix(2.0, 8.0, qualityMix));
  int recursion = int(min(uRecursionDepth, float(recursionBudget)));

  float smoothRotation = uTime * uRotationSpeed * uVariation.w;
  float snapGrid = 6.2831853 / max(3.0, uSymmetryCount);
  float snappedRotation = floor((smoothRotation + uBeat * snapGrid) / snapGrid + 0.5) * snapGrid;
  float snapMix = clamp(uSnapStrength * (0.34 + uBeat * 0.66 + uDownbeat * 0.35), 0.0, 1.0);
  float rotation = mix(smoothRotation, snappedRotation, snapMix);

  vec2 q = rotate2d(rotation) * p;
  q = mirrorFold(q, uSymmetryCount);
  vec3 color = vec3(0.002, 0.003, 0.008);
  float accumulated = 0.0;

  for (int i = 0; i < 8; i++) {
    if (i >= recursion) break;
    float fi = float(i);
    q = mirrorFold(q, uSymmetryCount);
    q = abs(q) - vec2(0.24 + uFoldStrength * 0.06, 0.18 + uFoldStrength * 0.05);
    q = rotate2d(rotation * (0.18 + fi * 0.07) + uVariation.y * 0.08) * q;
    float scale = uMirrorScale + fi * 0.055 + uChamberDepth * 0.045;
    q *= scale;

    float dist = mirrorStructure(q, uStructureStyle);
    float line = smoothstep(0.026 + fi * 0.002, 0.0, dist);
    float facet = smoothstep(0.08, 0.0, abs(q.x + q.y) - 0.01);
    float fade = exp(-fi * (0.36 + 0.16 / max(0.2, uChamberDepth)));
    float pulse = 0.45 + 0.55 * sin(fi * 1.8 + uBarProgress * 6.2831);
    vec3 layerColor = mix(uSecondary, uPrimary, pulse);
    layerColor = mix(layerColor, uAccent, uHigh * 0.35 + uDownbeat * 0.22);
    color += layerColor * line * fade * (0.19 + uSectionIntensity * 0.08);
    color += uAccent * facet * line * fade * (0.04 + uBeat * 0.11);
    accumulated += line * fade;

    q += vec2(sin(fi * 2.1 + uVariation.x * 4.0), cos(fi * 1.7)) * uFeedbackDrift * 0.014;
  }

  float centerDepth = exp(-length(p) * (3.8 + uChamberDepth * 2.2));
  color += mix(uSecondary, uPrimary, uVolume) * centerDepth * (0.12 + uChamberDepth * 0.14);
  float symmetryRays = pow(max(0.0, cos(atan(p.y, p.x) * uSymmetryCount)), 18.0);
  color += uAccent * symmetryRays * smoothstep(1.1, 0.12, length(p)) * (0.025 + uBeat * 0.05);

  float readability = 1.0 / (1.0 + accumulated * 0.08 + uFeedbackAmount * 0.12);
  color *= readability;
  color *= smoothstep(1.68, 0.16, length(p));
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const ANCIENT_MACHINE_FRAGMENT_SOURCE = `${HEADER}
uniform float uGateRadius;
uniform float uRingCount;
uniform float uGearCount;
uniform float uGlyphDensity;
uniform float uRotationSpeed;
uniform float uLockProgress;
uniform float uUnlockResponse;
uniform float uRadialComplexity;
uniform float uMechanicalDepth;
uniform float uMechanicalProgress;
uniform float uUnlockState;
uniform float uToothDensity;

float ringLine(float radius, float target, float thickness) {
  return smoothstep(thickness, 0.0, abs(radius - target));
}

void main() {
  vec2 p = cinematicCameraUv(v_uv);
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float qualityMix = uQuality / 3.0;
  int ringBudget = int(mix(3.0, 8.0, qualityMix));
  int rings = int(min(uRingCount, float(ringBudget)));
  int gearBudget = int(mix(4.0, 14.0, qualityMix));
  int gears = int(min(uGearCount, float(gearBudget)));

  vec3 color = vec3(0.0025, 0.003, 0.0045);
  float progression = uMechanicalProgress;
  float unlock = clamp(uUnlockState + uBass * uUnlockResponse * 0.10 + uDrop * 0.24, 0.0, 1.0);
  float baseRotation = uTime * uRotationSpeed * 0.35 + progression * 6.2831853;

  for (int i = 0; i < 8; i++) {
    if (i >= rings) break;
    float fi = float(i);
    float target = uGateRadius * (0.36 + fi * 0.115) + uMechanicalDepth * fi * 0.012;
    float direction = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
    float ringAngle = angle + baseRotation * direction * (0.35 + fi * 0.12);
    float teeth = 10.0 + fi * (3.0 + uToothDensity * 5.0);
    float toothedRadius = target + sin(ringAngle * teeth) * uToothDensity * 0.008;
    float ring = ringLine(radius, toothedRadius, 0.012 + fi * 0.0015);
    float segment = 0.45 + 0.55 * step(0.16, fract(ringAngle / 6.2831853 * (8.0 + fi * 2.0)));
    float depthFade = exp(-fi * 0.22 / max(0.15, uMechanicalDepth));
    vec3 metal = mix(uSecondary, uPrimary, fi / max(1.0, float(rings - 1)));
    metal = mix(metal, uAccent, uDownbeat * 0.28 + uHigh * 0.12);
    color += metal * ring * segment * depthFade * (0.18 + uSectionIntensity * 0.12);

    float glyphCell = fract(ringAngle / 6.2831853 * (18.0 + fi * 7.0));
    float glyph = smoothstep(0.13, 0.025, abs(glyphCell - 0.5));
    glyph *= step(1.0 - uGlyphDensity, hash11(floor(glyphCell * 40.0) + fi * 17.0));
    color += uAccent * glyph * ring * (0.16 + uHigh * 0.72 + uBeat * 0.28);
  }

  for (int i = 0; i < 14; i++) {
    if (i >= gears) break;
    float fi = float(i);
    float h = hash11(fi * 11.7 + 2.0);
    float a = fi / float(max(1, gears)) * 6.2831853 + baseRotation * (h > 0.5 ? 0.18 : -0.15);
    float orbit = uGateRadius * (0.62 + 0.18 * hash11(fi * 3.1));
    vec2 center = vec2(cos(a), sin(a)) * orbit;
    vec2 local = p - center;
    float gearRadius = 0.045 + h * 0.045;
    float gearAngle = atan(local.y, local.x) + baseRotation * (h > 0.5 ? 1.0 : -1.0);
    float gearShape = length(local) - gearRadius - sin(gearAngle * (8.0 + floor(h * 6.0))) * 0.006 * uToothDensity;
    float gear = smoothstep(0.010, 0.0, abs(gearShape));
    color += mix(uSecondary, uPrimary, h) * gear * (0.10 + uBeat * 0.12 + uBass * 0.10);
  }

  float apertureRadius = uGateRadius * mix(0.18, 0.52, unlock);
  float aperture = smoothstep(apertureRadius + 0.025, apertureRadius - 0.018, radius);
  float innerPattern = 0.5 + 0.5 * sin(angle * (10.0 + uRadialComplexity * 18.0) - baseRotation * 2.0);
  vec3 inner = mix(uPrimary, uAccent, innerPattern + uHigh * 0.22);
  inner *= 0.22 + innerPattern * 0.35 + uBass * 0.38 + uDrop * 0.34;
  color = mix(color, inner, aperture);

  float spokes = pow(max(0.0, cos(angle * (4.0 + uRadialComplexity * 10.0))), 20.0);
  spokes *= smoothstep(uGateRadius * 0.95, apertureRadius, radius);
  spokes *= (1.0 - unlock) * uLockProgress;
  color += uAccent * spokes * (0.22 + uDownbeat * 0.78);

  float lockHalo = ringLine(radius, apertureRadius, 0.022);
  color += mix(uPrimary, vec3(1.0), 0.3) * lockHalo * (0.28 + uBass * 0.48 + uTransient * 0.42);
  color *= smoothstep(1.62, 0.14, radius);
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

export const STORM_GATEWAY_FRAGMENT_SOURCE = `${HEADER}
uniform float uStormIntensity;
uniform float uCloudDensity;
uniform float uCloudLayers;
uniform float uVortexStrength;
uniform float uWindSpeed;
uniform float uDebrisDensity;
uniform float uLightningFrequency;
uniform float uLightningBranching;
uniform float uGatewayRadius;
uniform float uAtmosphericDepth;
uniform float uTurbulence;
uniform float uLightningResponse;

float lightningPath(vec2 p, float seed, float branchOffset) {
  float y = p.y + branchOffset;
  float bend = sin(y * 8.0 + seed * 5.0) * 0.055;
  bend += (noise21(vec2(y * 4.5, seed)) - 0.5) * 0.16 * uLightningBranching;
  float width = 0.008 + branchOffset * 0.004;
  return smoothstep(width, 0.0, abs(p.x - bend));
}

void main() {
  vec2 p = cinematicCameraUv(v_uv);
  p.x *= uResolution.x / max(1.0, uResolution.y);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float qualityMix = uQuality / 3.0;
  int layerBudget = int(mix(2.0, 8.0, qualityMix));
  int layers = int(min(uCloudLayers, float(layerBudget)));
  float time = uTime * uWindSpeed * uVariation.w;

  float swirl = angle + time * 0.22 + uVortexStrength / (0.24 + radius) * 0.35;
  vec2 vortexUv = vec2(cos(swirl), sin(swirl)) * radius;
  vortexUv += vec2(time * 0.16, -time * 0.09);

  vec3 color = vec3(0.002, 0.004, 0.008);
  float cloud = 0.0;
  float depthWeight = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= layers) break;
    float fi = float(i);
    float scale = 1.6 + fi * (0.9 + uTurbulence * 0.22);
    vec2 layerUv = rotate2d(fi * 0.47 + uVariation.y * 0.2) * vortexUv * scale;
    layerUv += vec2(time * (0.10 + fi * 0.035), -time * (0.07 + fi * 0.02));
    float n = noise21(layerUv + fi * 17.0);
    float weight = exp(-fi * 0.32 / max(0.2, uAtmosphericDepth));
    cloud += n * weight;
    depthWeight += weight;
  }
  cloud /= max(0.001, depthWeight);
  float cloudShape = smoothstep(0.34 - uCloudDensity * 0.18, 0.82, cloud + uStormIntensity * 0.08);
  float centralClear = smoothstep(uGatewayRadius * 0.48, uGatewayRadius * 1.15, radius);
  vec3 cloudColor = mix(uSecondary * 0.10, uPrimary * 0.28, cloud);
  cloudColor = mix(cloudColor, uAccent * 0.36, uHigh * 0.22 + uStormIntensity * 0.08);
  color += cloudColor * cloudShape * (0.28 + uStormIntensity * 0.42) * (0.45 + centralClear * 0.55);

  float gatewayWarp = sin(angle * (5.0 + uTurbulence * 7.0) - time * 1.3) * 0.025 * uTurbulence;
  float gatewayEdge = smoothstep(0.035, 0.0, abs(radius - (uGatewayRadius + gatewayWarp + uBass * 0.025)));
  float gateway = smoothstep(uGatewayRadius + 0.02, uGatewayRadius - 0.025, radius);
  float innerStorm = fbm21(p * 4.2 + vec2(-time * 0.18, time * 0.12), int(mix(2.0, 6.0, qualityMix)));
  vec3 inner = mix(uSecondary, uPrimary, innerStorm);
  inner = mix(inner, uAccent, uTransient * 0.28 + uDrop * 0.22);
  inner *= 0.18 + innerStorm * 0.48 + uBass * 0.32;
  color = mix(color, inner, gateway * 0.82);
  color += mix(uPrimary, vec3(1.0), 0.38) * gatewayEdge * (0.32 + uBass * 0.62 + uBeat * 0.35);

  float randomPulse = pow(hash11(floor(uTime * (1.2 + uLightningFrequency * 7.0))), 14.0) * uLightningFrequency;
  float lightningPulse = clamp(
    randomPulse * 1.4 + (uTransient * 0.8 + uSnare * 0.9 + uKick * 0.25) * uLightningResponse,
    0.0,
    1.5
  );
  vec2 boltP = rotate2d(uVariation.x * 0.45) * (p - vec2(uVariation.y * 0.18, 0.0));
  float bolt = lightningPath(boltP, uVariation.x * 13.0 + floor(uTime * 4.0), 0.0);
  float branchA = lightningPath(rotate2d(0.42) * (boltP - vec2(0.04, -0.12)), 4.7, 0.08);
  float branchB = lightningPath(rotate2d(-0.36) * (boltP + vec2(0.06, 0.18)), 8.1, 0.12);
  bolt += (branchA + branchB) * uLightningBranching * 0.62;
  bolt *= smoothstep(1.15, 0.12, abs(boltP.y));
  color += mix(uPrimary, vec3(1.0), 0.72) * bolt * lightningPulse * (0.75 + uStormIntensity * 0.55);
  color += vec3(1.0) * lightningPulse * cloudShape * 0.10;

  int debrisBudget = int(mix(6.0, 24.0, qualityMix));
  int debrisCount = int(float(debrisBudget) * uDebrisDensity);
  for (int i = 0; i < 24; i++) {
    if (i >= debrisCount) break;
    float fi = float(i);
    float h = hash11(fi * 19.3 + 1.0);
    float a = h * 6.2831853 + time * (0.18 + hash11(fi + 5.0) * 0.25);
    float orbit = 0.34 + hash11(fi * 4.7) * 0.82;
    vec2 center = vec2(cos(a), sin(a)) * orbit;
    center.x += sin(time + fi) * 0.08 * uVortexStrength;
    vec2 local = rotate2d(a + fi) * (p - center);
    float shard = smoothstep(0.024, 0.0, sdBox(local, vec2(0.018 + h * 0.025, 0.004 + h * 0.008)));
    color += mix(uSecondary, uAccent, h) * shard * (0.16 + uHigh * 0.28 + lightningPulse * 0.20);
  }

  color *= smoothstep(1.72, 0.16, radius);
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

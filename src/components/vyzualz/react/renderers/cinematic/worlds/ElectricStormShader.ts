import { CINEMATIC_WORLD_SHADER_HEADER as HEADER } from './CinematicWorldShaderCommon'

export const ELECTRIC_STORM_FRAGMENT_SOURCE = `${HEADER}
uniform vec3 uStormBackground;
uniform vec3 uLightningBody;
uniform vec3 uLightningCore;
uniform vec3 uLightningGlowColor;
uniform vec3 uLightningBranchColor;
uniform float uMasterIntensity;
uniform float uBranching;
uniform float uThickness;
uniform float uGlowAmount;
uniform float uAudioDetail;
uniform float uImpactShake;
uniform float uZoomPunch;
uniform float uImpactStrength;
uniform vec4 uStrikeLine0;
uniform vec4 uStrikeMeta0;
uniform vec4 uStrikeStyle0;
uniform vec4 uStrikeLine1;
uniform vec4 uStrikeMeta1;
uniform vec4 uStrikeStyle1;
uniform vec4 uStrikeLine2;
uniform vec4 uStrikeMeta2;
uniform vec4 uStrikeStyle2;

float stormHash(float value) {
  return fract(sin(value * 91.3458 + 17.173) * 47453.5453);
}

vec2 aspectPoint(vec2 point) {
  point.x *= uResolution.x / max(1.0, uResolution.y);
  return point;
}

float segmentDistance(vec2 p, vec2 a, vec2 b, float seed, float jaggedness) {
  vec2 delta = b - a;
  float lengthSquared = max(dot(delta, delta), 0.00001);
  float t = clamp(dot(p - a, delta) / lengthSquared, 0.0, 1.0);
  vec2 tangent = normalize(delta + vec2(0.00001, 0.0));
  vec2 normal = vec2(-tangent.y, tangent.x);
  float envelope = sin(t * 3.14159265);
  float coarse = sin(t * 21.0 + seed * 13.1) * 0.62;
  float fine = sin(t * 53.0 + seed * 37.7) * 0.26;
  float micro = sin(t * 113.0 + seed * 71.3) * 0.12;
  vec2 nearest = mix(a, b, t) + normal * (coarse + fine + micro) * envelope * jaggedness;
  return length(p - nearest);
}

float strikeEnvelope(float age, float duration) {
  if (age < 0.0 || age > duration || duration <= 0.0) return 0.0;
  float normalizedAge = age / duration;
  float attack = smoothstep(0.0, 0.055, normalizedAge);
  float decay = exp(-normalizedAge * 2.8);
  float flickerAmount = mix(0.08, 0.18, clamp(uAudioDetail, 0.0, 1.0));
  float flicker = (1.0 - flickerAmount) + flickerAmount * sin(age * mix(390.0, 540.0, clamp(uAudioDetail, 0.0, 1.0)));
  return attack * decay * flicker;
}

vec3 renderStrike(vec2 p, vec4 line, vec4 meta, vec4 style, float slot) {
  float age = meta.x;
  float duration = meta.y;
  float strength = meta.z;
  float seed = meta.w + slot * 17.0;
  float branchSeed = style.x + slot * 29.0;
  float branchDetail = clamp(style.y * mix(0.82, 1.2, clamp(uAudioDetail, 0.0, 1.0)), 0.0, 1.0);
  float thicknessMultiplier = max(0.35, style.z);
  float glowMultiplier = max(0.35, style.w);
  float envelope = strikeEnvelope(age, duration) * strength * uMasterIntensity;
  if (envelope <= 0.0001) return vec3(0.0);

  vec2 a = aspectPoint(line.xy);
  vec2 b = aspectPoint(line.zw);
  float jaggedness = mix(0.014, 0.068, clamp(uBranching * mix(0.72, 1.18, branchDetail), 0.0, 1.0));
  float distanceToBolt = segmentDistance(p, a, b, seed, jaggedness);
  float masterGeometry = mix(0.72, 1.18, uMasterIntensity);
  float coreWidth = mix(0.0018, 0.0085, uThickness) * masterGeometry * thicknessMultiplier;
  float bodyWidth = coreWidth * mix(2.4, 3.6, uThickness);
  float haloWidth = bodyWidth * mix(4.5, 12.0, uGlowAmount) * glowMultiplier;

  float core = exp(-distanceToBolt * distanceToBolt / max(coreWidth * coreWidth, 0.000001));
  float body = exp(-distanceToBolt * distanceToBolt / max(bodyWidth * bodyWidth, 0.000001));
  float halo = exp(-distanceToBolt * distanceToBolt / max(haloWidth * haloWidth, 0.000001));

  vec3 color = uLightningCore * core * 1.55;
  color += uLightningBody * body * 1.02;
  color += uLightningGlowColor * halo * (0.2 + uGlowAmount * 0.9);

  vec2 mainDelta = b - a;
  vec2 mainTangent = normalize(mainDelta + vec2(0.00001, 0.0));
  float mainLength = length(mainDelta);
  for (int branchIndex = 0; branchIndex < 4; branchIndex++) {
    float fi = float(branchIndex);
    float effectiveBranching = clamp(uBranching * mix(0.62, 1.0, uMasterIntensity) * mix(0.72, 1.22, branchDetail), 0.0, 1.0);
    float branchGate = step((fi + 0.45) / 4.0, effectiveBranching);
    float branchChance = stormHash(branchSeed + fi * 19.7);
    branchGate *= step(0.22, branchChance + uBranching * 0.42);
    float originT = mix(0.18, 0.82, stormHash(branchSeed + fi * 31.9 + 4.0));
    vec2 origin = mix(a, b, originT);
    float side = stormHash(branchSeed + fi * 43.1 + 9.0) > 0.5 ? 1.0 : -1.0;
    float angle = side * mix(0.42, 1.02, stormHash(branchSeed + fi * 11.3 + 12.0));
    vec2 branchDirection = rotate2d(angle) * mainTangent;
    float branchLength = mainLength * mix(0.13, 0.34, stormHash(branchSeed + fi * 7.1 + 21.0)) * mix(0.78, 1.12, branchDetail);
    vec2 branchEnd = origin + branchDirection * branchLength;
    float branchDistance = segmentDistance(p, origin, branchEnd, seed + fi * 2.7, jaggedness * 0.68);
    float branchWidth = bodyWidth * mix(0.36, 0.62, uBranching);
    float branchBody = exp(-branchDistance * branchDistance / max(branchWidth * branchWidth, 0.000001));
    float branchHaloWidth = branchWidth * (3.0 + uGlowAmount * 5.0);
    float branchHalo = exp(-branchDistance * branchDistance / max(branchHaloWidth * branchHaloWidth, 0.000001));
    color += uLightningBranchColor * branchBody * branchGate * 0.72;
    color += uLightningGlowColor * branchHalo * branchGate * uGlowAmount * 0.18;
  }

  return color * envelope;
}

void main() {
  vec2 uv = v_uv;
  float impact = clamp(uImpactStrength, 0.0, 1.0);
  float shakeAmount = clamp(uImpactShake, 0.0, 1.0) * impact * 0.012;
  vec2 shake = vec2(
    sin(uTime * 91.0 + 0.7) + sin(uTime * 137.0 + 2.1) * 0.45,
    cos(uTime * 103.0 + 1.3) + cos(uTime * 149.0 + 0.4) * 0.45
  ) * shakeAmount;
  float zoomScale = 1.0 - clamp(uZoomPunch, 0.0, 1.0) * impact * 0.075;
  uv = vec2(0.5) + (uv - vec2(0.5)) * zoomScale + shake;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uResolution.x / max(1.0, uResolution.y);

  int hazeOctaves = uQuality >= 2.5 ? 6 : (uQuality >= 1.5 ? 5 : 4);
  vec2 hazeUv = uv * vec2(3.1, 2.2) + vec2(uTime * 0.012, -uTime * 0.008);
  float hazeA = fbm21(hazeUv + uVariation.xy * 2.7, hazeOctaves);
  float hazeB = fbm21(hazeUv * 1.7 - vec2(4.1, 1.8), max(3, hazeOctaves - 1));
  float haze = smoothstep(0.34, 0.78, hazeA * 0.72 + hazeB * 0.38);
  float hazePresence = haze * (0.035 + uMasterIntensity * 0.095);
  vec3 color = uStormBackground;
  color += mix(uStormBackground, uLightningGlowColor, 0.22) * hazePresence;

  vec3 strike0 = renderStrike(p, uStrikeLine0, uStrikeMeta0, uStrikeStyle0, 0.0);
  vec3 strike1 = renderStrike(p, uStrikeLine1, uStrikeMeta1, uStrikeStyle1, 1.0);
  vec3 strike2 = renderStrike(p, uStrikeLine2, uStrikeMeta2, uStrikeStyle2, 2.0);
  vec3 strikes = strike0 + strike1 + strike2;
  float strikeIllumination = clamp(max(max(strikes.r, strikes.g), strikes.b), 0.0, 2.5);
  color += strikes;
  color += uLightningGlowColor * haze * strikeIllumination * (0.035 + uGlowAmount * 0.11) * uMasterIntensity;

  float vignette = 1.0 - smoothstep(0.18, 1.48, length(p * vec2(0.73, 0.92)));
  color *= mix(0.82, 1.0, vignette);
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

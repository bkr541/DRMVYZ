/** Production LaserDMX WebGL shader sources shared by the runtime and real WebGL2 compile tests. */
export const BEAM_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iOrigin;
layout(location = 2) in vec3 iTarget;
layout(location = 3) in vec4 iColor;
layout(location = 4) in vec4 iOptics;
layout(location = 5) in vec4 iWidths;
layout(location = 6) in vec4 iExtra;
layout(location = 7) in vec4 iFixture;
layout(location = 8) in vec4 iPrism;
uniform vec2 uViewportPx;
uniform vec2 uCssToBacking;
out float vAcross;
out float vAlong;
out float vBodyRatio;
out vec2 vCapsuleCoordPx;
flat out vec4 vColor;
flat out vec4 vOptics;
flat out vec4 vExtra;
flat out vec4 vFixture;
flat out vec4 vPrism;
flat out vec4 vCoverage;
void main() {
  vec2 originPx = vec2(iOrigin.x * uViewportPx.x, iOrigin.y * uViewportPx.y);
  vec2 targetPx = vec2(iTarget.x * uViewportPx.x, iTarget.y * uViewportPx.y);
  vec2 delta = targetPx - originPx;
  float segmentLength = max(length(delta), 0.0001);
  vec2 tangent = segmentLength > 0.001 ? delta / segmentLength : vec2(1.0, 0.0);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float along = aCorner.x;
  float backingScale = min(uCssToBacking.x, uCssToBacking.y);
  float envelopeCssPx = mix(iWidths.z, iWidths.w, along);
  float envelopeHalfPx = max(0.75, envelopeCssPx * backingScale * 0.5);
  float capOffset = along < 0.5 ? -envelopeHalfPx : envelopeHalfPx;
  vec2 centerPx = mix(originPx, targetPx, along) + tangent * capOffset;
  vec2 positionPx = centerPx + normal * aCorner.y * envelopeHalfPx;
  vec2 clip = vec2(positionPx.x / uViewportPx.x * 2.0 - 1.0, 1.0 - positionPx.y / uViewportPx.y * 2.0);
  gl_Position = vec4(clip, clamp(mix(iOrigin.z, iTarget.z, along), -1.0, 1.0), 1.0);
  vAcross = aCorner.y;
  vAlong = along;
  vBodyRatio = mix(iWidths.x / max(iWidths.z, 0.001), iWidths.y / max(iWidths.w, 0.001), along);
  vCapsuleCoordPx = vec2(along < 0.5 ? -envelopeHalfPx : segmentLength + envelopeHalfPx, aCorner.y * envelopeHalfPx);
  vColor = iColor;
  vOptics = iOptics;
  vExtra = iExtra;
  vFixture = iFixture;
  vPrism = iPrism;
  vCoverage = vec4(
    segmentLength,
    max(0.28, iWidths.x * backingScale * 0.5),
    max(0.28, iWidths.y * backingScale * 0.5),
    backingScale
  );
}`

export const BEAM_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vAcross;
in float vAlong;
in float vBodyRatio;
in vec2 vCapsuleCoordPx;
flat in vec4 vColor;
flat in vec4 vOptics;
flat in vec4 vExtra;
flat in vec4 vFixture;
flat in vec4 vPrism;
flat in vec4 vCoverage;
out vec4 outColor;
const float PI = 3.14159265359;
mat2 rotate2(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}
float sdStar(vec2 p, float points, float innerRadius) {
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float spoke = 0.5 + 0.5 * cos(angle * points);
  float boundary = mix(innerRadius, 1.0, pow(spoke, 2.4));
  return 1.0 - smoothstep(boundary - 0.08, boundary + 0.04, radius);
}
float goboMask(vec2 p, float pattern, float phase) {
  if (pattern < 0.5) return 1.0;
  float radius = length(p);
  if (pattern < 1.5) return 1.0 - smoothstep(0.72, 0.88, radius);
  if (pattern < 2.5) {
    vec2 cells = abs(fract((p + 1.0) * 2.5) - 0.5);
    return 1.0 - smoothstep(0.18, 0.28, length(cells));
  }
  if (pattern < 3.5) return 1.0 - smoothstep(0.2, 0.34, abs(sin((p.x + phase * 0.15) * 10.0)));
  if (pattern < 4.5) {
    float triangle = max(abs(p.x) * 0.86 + p.y * 0.5, -p.y);
    return 1.0 - smoothstep(0.58, 0.72, triangle);
  }
  if (pattern < 5.5) return sdStar(p, 5.0, 0.38);
  if (pattern < 6.5) {
    float breakup = sin(p.x * 8.0 + phase * 2.0) * sin(p.y * 11.0 - phase * 1.3) + sin((p.x + p.y) * 15.0);
    return smoothstep(-0.15, 0.42, breakup);
  }
  if (pattern < 7.5) return smoothstep(0.15, 0.8, abs(sin(atan(p.y, p.x) * 7.0 + phase))) * (1.0 - smoothstep(0.82, 0.94, radius));
  vec2 grid = abs(sin((p + phase * 0.035) * 11.0));
  return max(smoothstep(0.82, 0.96, grid.x), smoothstep(0.82, 0.96, grid.y));
}
float capsuleDistance(vec2 localPx, float segmentLength) {
  float closestX = clamp(localPx.x, 0.0, segmentLength);
  return length(vec2(localPx.x - closestX, localPx.y));
}
float analyticCoverage(float distancePx, float radiusPx, float minimumCoverage) {
  float aa = max(0.55, fwidth(distancePx));
  float coverageRadius = max(radiusPx, aa * minimumCoverage);
  return 1.0 - smoothstep(coverageRadius - aa, coverageRadius + aa, distancePx);
}
void main() {
  float lateral = abs(vAcross);
  float intensity = vOptics.x;
  float coreIntensity = vOptics.y;
  float hotMix = vOptics.z;
  float opacity = vOptics.w;
  float materialMode = vExtra.z;
  float softness = clamp(vExtra.w, 0.0, 1.0);
  vec3 saturated = vColor.rgb;
  vec3 paleCore = mix(saturated, vec3(1.0), 0.08 + hotMix * 0.46);
  vec3 energy;
  if (materialMode < 0.5) {
    float segmentLength = max(0.0001, vCoverage.x);
    float closestX = clamp(vCapsuleCoordPx.x, 0.0, segmentLength);
    float alongT = clamp(closestX / segmentLength, 0.0, 1.0);
    float bodyRadius = mix(vCoverage.y, vCoverage.z, alongT);
    float distancePx = capsuleDistance(vCapsuleCoordPx, segmentLength);
    float body = analyticCoverage(distancePx, bodyRadius, 0.68);
    float core = analyticCoverage(distancePx, max(0.22, bodyRadius * 0.28), 0.5);
    float hot = analyticCoverage(distancePx, max(0.14, bodyRadius * 0.1), 0.42) * hotMix;
    float envelopeRadius = max(bodyRadius * 2.2, bodyRadius / max(vBodyRatio, 0.02));
    float envelope = exp(-pow(distancePx / max(0.75, envelopeRadius), 2.0) * 3.2) * vExtra.x;
    float endpointFade = smoothstep(-0.5, 0.5, vCapsuleCoordPx.x + bodyRadius)
      * (1.0 - smoothstep(segmentLength - bodyRadius, segmentLength + bodyRadius + 0.5, vCapsuleCoordPx.x));
    float sourceLift = 1.0 - smoothstep(0.0, max(1.0, segmentLength * 0.12), closestX);
    energy = saturated * envelope * intensity * 0.34;
    energy += saturated * body * intensity * 0.94;
    energy += paleCore * core * coreIntensity * (0.58 + sourceLift * 0.08);
    energy += vec3(1.0) * hot * intensity * 0.96;
    energy *= endpointFade;
  } else {
    float envelope = exp(-lateral * lateral * 4.8) * vExtra.x;
    float iris = clamp(vFixture.z, 0.05, 1.0);
    float frost = clamp(vFixture.w, 0.0, 1.0);
    float edge = materialMode < 1.5 ? mix(0.84, 0.3, softness) * iris : mix(0.64, 0.2, softness);
    float cone = 1.0 - smoothstep(edge, 1.0, lateral);
    float center = exp(-lateral * lateral * mix(8.6, 2.0, softness + frost * 0.5));
    float longitudinal = smoothstep(0.0, 0.035, vAlong) * (1.0 - smoothstep(0.965, 1.0, vAlong));
    vec2 projected = rotate2(vFixture.y) * vec2(vAcross / max(0.18, iris), (vAlong - 0.72) * 2.4);
    float projectedMask = goboMask(projected, vFixture.x, vPrism.w * 6.2831853);
    float gobo = materialMode < 1.5 ? mix(1.0, projectedMask, clamp(vExtra.y, 0.0, 1.0)) : 1.0;
    float field = cone * longitudinal * gobo;
    energy = saturated * field * intensity * (materialMode < 1.5 ? 0.76 : 0.48);
    energy += (materialMode < 1.5 ? paleCore : saturated)
      * center * field * coreIntensity * (materialMode < 1.5 ? 0.54 : 0.1);
    energy += saturated * envelope * intensity * (materialMode < 1.5 ? 0.16 + frost * 0.16 : 0.3);
  }
  outColor = vec4(energy * opacity, 1.0);
}`

export const APERTURE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iPosition;
layout(location = 2) in vec4 iColor;
layout(location = 3) in vec4 iRadii;
layout(location = 4) in vec2 iGlareDirection;
layout(location = 5) in vec4 iShape;
layout(location = 6) in vec4 iBehavior;
uniform vec2 uViewportPx;
uniform vec2 uCssToBacking;
out vec2 vLocal;
flat out vec4 vColor;
flat out vec4 vRadii;
flat out vec2 vGlareDirection;
flat out vec4 vShape;
flat out vec4 vBehavior;
void main() {
  float backingScale = min(uCssToBacking.x, uCssToBacking.y);
  vec2 centerPx = vec2(iPosition.x * uViewportPx.x, iPosition.y * uViewportPx.y);
  float aspect = max(0.18, iShape.y);
  vec2 local = aCorner;
  float c = cos(iBehavior.x);
  float s = sin(iBehavior.x);
  vec2 rotated = mat2(c, -s, s, c) * (local * vec2(aspect, 1.0));
  vec2 extent = rotated * iRadii.z * backingScale;
  vec2 positionPx = centerPx + extent;
  vec2 clip = vec2(positionPx.x / uViewportPx.x * 2.0 - 1.0, 1.0 - positionPx.y / uViewportPx.y * 2.0);
  gl_Position = vec4(clip, clamp(iPosition.z, -1.0, 1.0), 1.0);
  vLocal = local;
  vColor = iColor;
  vRadii = iRadii;
  vGlareDirection = iGlareDirection;
  vShape = iShape;
  vBehavior = iBehavior;
}`

export const APERTURE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec4 vColor;
flat in vec4 vRadii;
flat in vec2 vGlareDirection;
flat in vec4 vShape;
flat in vec4 vBehavior;
out vec4 outColor;
void main() {
  float shapeMode = vShape.x;
  float radius = length(vLocal);
  float boxDistance = max(abs(vLocal.x), abs(vLocal.y));
  bool rectangular = (shapeMode >= 0.5 && shapeMode < 3.5) || (shapeMode > 4.5 && shapeMode < 5.5);
  if (rectangular && boxDistance > 1.0) discard;
  if (!rectangular && radius > 1.0) discard;
  float coreRatio = clamp(vRadii.x / max(vRadii.z, 0.001), 0.02, 0.9);
  float ringRatio = clamp(vRadii.y / max(vRadii.z, 0.001), coreRatio, 0.96);
  float intensity = vRadii.w;
  float core = exp(-pow(radius / max(coreRatio, 0.001), 2.0) * 3.6);
  float ring = (1.0 - smoothstep(ringRatio * 0.72, ringRatio, radius)) * smoothstep(coreRatio * 0.88, coreRatio * 1.42, radius);
  float halo = exp(-radius * radius * 4.2);
  vec2 localDirection = radius > 0.0001 ? vLocal / radius : vec2(1.0, 0.0);
  float glareAxis = abs(dot(localDirection, normalize(vGlareDirection)));
  float glare = pow(glareAxis, 22.0) * exp(-radius * 5.8) * 0.12;
  vec3 energy;
  if (shapeMode < 0.5) {
    energy = vColor.rgb * halo * intensity * 0.18;
    energy += vColor.rgb * ring * intensity * 0.34;
    energy += mix(vColor.rgb, vec3(1.0), 0.7) * core * intensity * 0.92;
    energy += mix(vColor.rgb, vec3(1.0), 0.48) * glare * intensity;
  } else if (shapeMode < 2.5) {
    float cells = max(1.0, vShape.z);
    float cellUv = (vLocal.x * 0.5 + 0.5) * cells;
    float cell = floor(cellUv);
    float localCell = fract(cellUv);
    float behavior = vBehavior.y;
    float chaseHead = fract(vShape.w * 0.32);
    float chaseDistance = abs(fract(cell / cells - chaseHead + 0.5) - 0.5) * 2.0;
    float chase = exp(-chaseDistance * chaseDistance * 28.0);
    float segmented = 1.0 - smoothstep(0.42, 0.49, abs(localCell - 0.5));
    float gradient = 0.45 + 0.55 * (vLocal.x * 0.5 + 0.5);
    float pixel = behavior < 0.5 ? 1.0 : behavior < 1.5 ? segmented : behavior < 2.5 ? segmented * (0.22 + chase * 0.98) : segmented * gradient;
    float strip = shapeMode < 1.5
      ? 1.0 - smoothstep(0.56, 1.0, abs(vLocal.y))
      : 1.0 - smoothstep(0.72, 1.0, length(vec2(max(abs(vLocal.x) - 0.82, 0.0), vLocal.y)));
    float edgeGlow = exp(-boxDistance * boxDistance * 2.8);
    energy = vColor.rgb * intensity * (strip * pixel + edgeGlow * 0.14);
  } else if (shapeMode < 3.5) {
    float panel = 1.0 - smoothstep(0.72, 1.0, boxDistance);
    energy = mix(vColor.rgb, vec3(1.0), 0.78) * panel * intensity * 1.34;
  } else if (shapeMode < 4.5) {
    float warmCore = exp(-radius * radius * 3.1);
    energy = mix(vColor.rgb, vec3(1.0, 0.78, 0.48), 0.34) * warmCore * intensity * 1.18;
    energy += vColor.rgb * halo * intensity * 0.38;
  } else if (shapeMode < 5.5) {
    float wall = 1.0 - smoothstep(0.72, 1.0, boxDistance);
    float variant = vBehavior.z;
    float scan = variant < 0.5
      ? 0.86 + 0.14 * sin((vLocal.y + vShape.w) * 42.0)
      : variant < 1.5
        ? 0.55 + 0.45 * sin((vLocal.x * 2.0 + vLocal.y + vShape.w) * 9.0)
        : variant < 2.5
          ? 0.72 + 0.28 * sin((vLocal.x + vShape.w) * 24.0) * sin((vLocal.y - vShape.w) * 18.0)
          : 0.68 + 0.32 * sin((length(vLocal) - vShape.w) * 22.0);
    energy = vColor.rgb * wall * scan * intensity * 0.78;
  } else {
    float nozzle = exp(-radius * radius * 4.8);
    energy = mix(vColor.rgb, vec3(1.0), 0.6) * nozzle * intensity * 0.46;
  }
  outColor = vec4(energy, 0.0);
}`

export const ATMOSPHERE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iOrigin;
layout(location = 2) in vec3 iTarget;
layout(location = 3) in vec4 iColor;
layout(location = 4) in vec4 iScatter;
layout(location = 5) in vec4 iDepth;
uniform vec2 uViewportPx;
uniform vec2 uCssToBacking;
out float vAcross;
out float vAlong;
out float vClipDepth;
out vec2 vUv;
flat out vec4 vColor;
flat out vec4 vScatter;
flat out vec4 vDepth;
void main() {
  vec2 originPx = vec2(iOrigin.x * uViewportPx.x, iOrigin.y * uViewportPx.y);
  vec2 targetPx = vec2(iTarget.x * uViewportPx.x, iTarget.y * uViewportPx.y);
  vec2 delta = targetPx - originPx;
  float segmentLength = max(length(delta), 0.0001);
  vec2 normal = vec2(-delta.y, delta.x) / segmentLength;
  float along = aCorner.x;
  float widthCssPx = mix(iScatter.y, iScatter.z, along);
  float backingScale = min(uCssToBacking.x, uCssToBacking.y);
  vec2 positionPx = mix(originPx, targetPx, along) + normal * aCorner.y * widthCssPx * backingScale * 0.5;
  vUv = positionPx / uViewportPx;
  vec2 clip = vec2(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0);
  vClipDepth = mix(iOrigin.z, iTarget.z, along);
  gl_Position = vec4(clip, 0.0, 1.0);
  vAcross = aCorner.y;
  vAlong = along;
  vColor = iColor;
  vScatter = iScatter;
  vDepth = iDepth;
}`

export const ATMOSPHERE_NOISE_GLSL = `
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}
float fbm3(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.56;
  float total = 0.0;
  for (int octave = 0; octave < 4; octave++) {
    if (octave >= octaves) break;
    value += valueNoise3(p) * amplitude;
    total += amplitude;
    p = p * 2.03 + vec3(13.1, 7.7, 5.3);
    amplitude *= 0.52;
  }
  return value / max(total, 0.0001);
}
`

export const ATMOSPHERE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
#define MAX_HAZE_SOURCES 8
in float vAcross;
in float vAlong;
in float vClipDepth;
in vec2 vUv;
flat in vec4 vColor;
flat in vec4 vScatter;
flat in vec4 vDepth;
uniform vec4 uAtmosphere;
uniform vec4 uDrift;
uniform vec4 uQuality;
uniform vec2 uTimeSeed;
uniform vec4 uDepthSlice;
uniform int uSourceCount;
uniform vec4 uSourcePositionDensity[MAX_HAZE_SOURCES];
uniform vec4 uSourceDirectionSpread[MAX_HAZE_SOURCES];
uniform vec4 uSourceColorDissipation[MAX_HAZE_SOURCES];
uniform vec4 uSourceDynamics[MAX_HAZE_SOURCES];
out vec4 outColor;
${ATMOSPHERE_NOISE_GLSL}
float sourceDensity(vec2 uv, float depth, int index, out vec3 sourceColor) {
  vec4 positionDensity = uSourcePositionDensity[index];
  vec4 directionSpread = uSourceDirectionSpread[index];
  vec4 colorDissipation = uSourceColorDissipation[index];
  vec4 dynamics = uSourceDynamics[index];
  vec2 direction = directionSpread.xy;
  float directionLength = length(direction);
  direction = directionLength > 0.0001 ? direction / directionLength : vec2(0.0, -1.0);
  vec2 delta = uv - positionDensity.xy;
  float along = max(0.0, dot(delta, direction));
  float lateral = length(delta - direction * dot(delta, direction));
  float co2 = step(0.5, directionSpread.w);
  float expansion = dynamics.z;
  float turbulentWiden = 1.0 + dynamics.w * (0.18 + along * 1.8);
  float spread = max(0.025, directionSpread.z * (0.35 + along * mix(1.8, 3.4, co2)) * turbulentWiden);
  float plume = exp(-lateral * lateral / (spread * spread));
  plume *= exp(-along * mix(1.5 + colorDissipation.a * 2.2, 2.8 + colorDissipation.a * 1.2, co2));
  float depthPrecision = mix(1.8 + colorDissipation.a * 1.4, 4.2 + expansion * 2.8, co2);
  plume *= exp(-abs(depth - positionDensity.z) * depthPrecision);
  float lifecycle = co2 > 0.5 ? smoothstep(0.0, 0.08, dynamics.x / max(dynamics.y, 0.001)) * (1.0 - smoothstep(0.72, 1.0, dynamics.x / max(dynamics.y, 0.001))) : 1.0;
  float turbulence = co2 * (valueNoise3(vec3(uv * 34.0, uTimeSeed.y * 9.0 + dynamics.x * 2.0)) - 0.5) * dynamics.w;
  sourceColor = colorDissipation.rgb;
  return plume * positionDensity.w * lifecycle * (1.0 + turbulence * 0.34);
}
void main() {
  float lateral = abs(vAcross);
  float beamEnvelope = exp(-lateral * lateral * (2.2 + uDrift.z * 1.8));
  if (beamEnvelope < 0.002) discard;
  float angle = uDrift.y * 6.28318530718;
  vec2 driftDirection = vec2(cos(angle), sin(angle));
  float time = uTimeSeed.x * uDrift.x;
  int sampleCount = int(clamp(uQuality.x, 1.0, 6.0));
  int octaves = int(clamp(uQuality.y, 1.0, 4.0));
  float densitySum = 0.0;
  vec3 sourceTintSum = vec3(0.0);
  float sourceWeightSum = 0.0;
  for (int sampleIndex = 0; sampleIndex < 6; sampleIndex++) {
    if (sampleIndex >= sampleCount) break;
    float sampleT = (float(sampleIndex) + 0.5) / float(sampleCount) - 0.5;
    float sampleDepth = vClipDepth + sampleT * min(uDepthSlice.y, 0.14);
    vec2 warpedUv = vUv + driftDirection * time * (0.018 + sampleDepth * 0.006);
    vec3 p = vec3(warpedUv * uAtmosphere.w * 3.2, sampleDepth * 1.7 + uTimeSeed.y * 11.0 + vDepth.y * 0.7);
    float warp = valueNoise3(p * 0.72 + vec3(time * 0.02, -time * 0.015, 2.4)) - 0.5;
    p.xy += warp * uAtmosphere.z * 0.75;
    float coherentNoise = fbm3(p + vec3(time * 0.018, time * 0.011, 0.0), octaves);
    float pocket = smoothstep(0.22, 0.86, coherentNoise + uAtmosphere.x * 0.58);
    float localDensity = uAtmosphere.x;
    vec3 localTint = vec3(0.0);
    float localWeight = 0.0;
    for (int sourceIndex = 0; sourceIndex < MAX_HAZE_SOURCES; sourceIndex++) {
      if (sourceIndex >= uSourceCount) break;
      vec3 sourceColor;
      float contribution = sourceDensity(warpedUv, sampleDepth, sourceIndex, sourceColor);
      localDensity += contribution;
      localTint += sourceColor * contribution;
      localWeight += contribution;
    }
    densitySum += pocket * localDensity;
    sourceTintSum += localTint;
    sourceWeightSum += localWeight;
  }
  float density = densitySum / float(sampleCount);
  float absorption = uQuality.z;
  vec3 sourceTint = sourceWeightSum > 0.0001 ? sourceTintSum / sourceWeightSum : vColor.rgb;
  vec3 lightColor = mix(vColor.rgb, sourceTint, clamp(sourceWeightSum * 0.38, 0.0, 0.48));
  lightColor *= mix(vec3(1.0), normalize(max(lightColor, vec3(0.001))) * 0.82, absorption * 0.28);
  float alongFade = smoothstep(0.0, 0.018, vAlong) * (1.0 - smoothstep(0.95, 1.0, vAlong));
  float scatter = density * beamEnvelope * alongFade * vScatter.x * vScatter.w;
  scatter *= uAtmosphere.y * uQuality.w * (0.72 + uDrift.z * 0.4);
  vec3 energy = lightColor * scatter * mix(1.25, 1.02, vDepth.x);
  float extinction = 1.0 - exp(-density * beamEnvelope * vDepth.y * uDepthSlice.z * uAtmosphere.y * 0.34);
  outColor = vec4(energy, clamp(extinction, 0.0, 0.72));
}`

export const FULLSCREEN_VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

export const FOREGROUND_FRAGMENT_SHADER = `#version 300 es
precision highp float;
#define MAX_HAZE_SOURCES 8
in vec2 vUv;
uniform vec4 uAtmosphere;
uniform vec4 uDrift;
uniform vec2 uTimeSeed;
uniform vec4 uDepthSlice;
uniform float uForegroundStrength;
uniform int uNoiseOctaves;
uniform int uSourceCount;
uniform vec4 uSourcePositionDensity[MAX_HAZE_SOURCES];
uniform vec4 uSourceDirectionSpread[MAX_HAZE_SOURCES];
uniform vec4 uSourceColorDissipation[MAX_HAZE_SOURCES];
uniform vec4 uSourceDynamics[MAX_HAZE_SOURCES];
out vec4 outColor;
${ATMOSPHERE_NOISE_GLSL}
float sourceVeil(vec2 uv, int index) {
  vec4 positionDensity = uSourcePositionDensity[index];
  vec4 directionSpread = uSourceDirectionSpread[index];
  vec4 colorDissipation = uSourceColorDissipation[index];
  vec4 dynamics = uSourceDynamics[index];
  vec2 direction = directionSpread.xy;
  float directionLength = length(direction);
  direction = directionLength > 0.0001 ? direction / directionLength : vec2(0.0, -1.0);
  vec2 delta = uv - positionDensity.xy;
  float along = max(0.0, dot(delta, direction));
  float lateral = length(delta - direction * dot(delta, direction));
  float co2 = step(0.5, directionSpread.w);
  float spread = max(0.03, directionSpread.z * (0.45 + along * mix(1.6, 3.2, co2)) * (1.0 + dynamics.w * 0.35));
  float depthMatch = exp(-abs(uDepthSlice.x - positionDensity.z) * mix(2.2, 6.0, co2));
  float lifecycle = co2 > 0.5 ? 1.0 - smoothstep(0.68, 1.0, dynamics.x / max(dynamics.y, 0.001)) : 1.0;
  return exp(-lateral * lateral / (spread * spread))
    * exp(-along * (1.2 + colorDissipation.a * 1.8))
    * positionDensity.w * depthMatch * lifecycle;
}
void main() {
  float angle = uDrift.y * 6.28318530718;
  vec2 driftDirection = vec2(cos(angle), sin(angle));
  float time = uTimeSeed.x * uDrift.x;
  vec2 uv = vUv + driftDirection * time * 0.014;
  vec3 p = vec3(uv * uAtmosphere.w * 4.1, uDepthSlice.x * 2.0 + uTimeSeed.y * 13.0 + time * 0.018);
  float n = fbm3(p, clamp(uNoiseOctaves, 1, 4));
  float local = 0.0;
  for (int sourceIndex = 0; sourceIndex < MAX_HAZE_SOURCES; sourceIndex++) {
    if (sourceIndex >= uSourceCount) break;
    local += sourceVeil(uv, sourceIndex);
  }
  float sparse = smoothstep(0.72, 0.95, n + local * 0.32 + uAtmosphere.x * 0.18);
  float sliceScale = clamp(uDepthSlice.y * 2.6, 0.18, 0.72);
  float veil = sparse * uForegroundStrength * sliceScale * (0.32 + min(1.0, local) * 0.68);
  outColor = vec4(0.0, 0.0, 0.0, clamp(veil, 0.0, 0.42));
}`

export const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uAccumulatedTexture;
uniform sampler2D uSharpLightTexture;
uniform sampler2D uCurrentLaserTexture;
uniform sampler2D uLaserHistoryTexture;
uniform sampler2D uAtmosphereTexture;
uniform float uLayerExtinction;
out vec4 outColor;
void main() {
  vec3 behind = max(texture(uAccumulatedTexture, vUv).rgb, vec3(0.0));
  vec3 sharp = max(texture(uSharpLightTexture, vUv).rgb, vec3(0.0));
  vec3 currentLaser = max(texture(uCurrentLaserTexture, vUv).rgb, vec3(0.0));
  vec3 retainedLaser = max(texture(uLaserHistoryTexture, vUv).rgb, vec3(0.0));
  vec3 laser = max(currentLaser, retainedLaser);
  vec4 atmosphere = texture(uAtmosphereTexture, vUv);
  float extinction = clamp(atmosphere.a * uLayerExtinction, 0.0, 0.88);
  vec3 layerLight = sharp + laser;
  vec3 light = behind * (1.0 - extinction);
  light += layerLight * (1.0 - extinction * 0.1);
  light += atmosphere.rgb;
  outColor = vec4(max(light, vec3(0.0)), 1.0);
}`

export const TEMPORAL_HISTORY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uCurrentTexture;
uniform sampler2D uPreviousTexture;
uniform float uRetention;
uniform float uHistoryAvailable;
out vec4 outColor;
void main() {
  vec3 current = max(texture(uCurrentTexture, vUv).rgb, vec3(0.0));
  vec3 previous = max(texture(uPreviousTexture, vUv).rgb, vec3(0.0));
  vec3 retained = previous * clamp(uRetention, 0.0, 0.45) * step(0.5, uHistoryAvailable);
  // Max compositing preserves old scanner positions without repeatedly adding
  // stationary light, so feedback cannot grow brighter on every frame.
  vec3 history = max(current, retained);
  outColor = vec4(history, 1.0);
}`

export const BLOOM_DOWNSAMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSourceTexture;
uniform vec2 uSourceResolution;
uniform vec2 uThresholdKnee;
uniform float uFirstPass;
out vec4 outColor;
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
vec3 prefilter(vec3 color) {
  if (uFirstPass < 0.5) return color;
  float brightness = luminance(color);
  float threshold = uThresholdKnee.x;
  float knee = max(0.0001, uThresholdKnee.y);
  float soft = clamp((brightness - threshold + knee) / (2.0 * knee), 0.0, 1.0);
  soft = soft * soft * knee;
  float contribution = max(brightness - threshold, soft) / max(brightness, 0.0001);
  return color * max(contribution, 0.0);
}
void main() {
  vec2 px = 1.0 / max(uSourceResolution, vec2(1.0));
  vec3 color = texture(uSourceTexture, vUv).rgb * 0.24;
  color += texture(uSourceTexture, vUv + vec2( px.x, 0.0)).rgb * 0.12;
  color += texture(uSourceTexture, vUv + vec2(-px.x, 0.0)).rgb * 0.12;
  color += texture(uSourceTexture, vUv + vec2(0.0,  px.y)).rgb * 0.12;
  color += texture(uSourceTexture, vUv + vec2(0.0, -px.y)).rgb * 0.12;
  color += texture(uSourceTexture, vUv + vec2( px.x,  px.y)).rgb * 0.07;
  color += texture(uSourceTexture, vUv + vec2(-px.x,  px.y)).rgb * 0.07;
  color += texture(uSourceTexture, vUv + vec2( px.x, -px.y)).rgb * 0.07;
  color += texture(uSourceTexture, vUv + vec2(-px.x, -px.y)).rgb * 0.07;
  outColor = vec4(prefilter(max(color, vec3(0.0))), 1.0);
}`

export const BLOOM_BLUR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSourceTexture;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uRadius;
out vec4 outColor;
void main() {
  vec2 stepUv = uDirection * uRadius / max(uResolution, vec2(1.0));
  vec3 color = texture(uSourceTexture, vUv).rgb * 0.227027;
  color += texture(uSourceTexture, vUv + stepUv * 1.384615).rgb * 0.316216;
  color += texture(uSourceTexture, vUv - stepUv * 1.384615).rgb * 0.316216;
  color += texture(uSourceTexture, vUv + stepUv * 3.230769).rgb * 0.070270;
  color += texture(uSourceTexture, vUv - stepUv * 3.230769).rgb * 0.070270;
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}`

export const POST_COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSceneTexture;
uniform sampler2D uTemporalTexture;
uniform float uTemporalEnabled;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform vec2 uResolution;
uniform vec4 uBloomWeights;
uniform float uBloomStrength;
uniform vec2 uExposureWashout;
uniform vec4 uToneParams;
uniform vec4 uOptics0;
uniform vec4 uOptics1;
out vec4 outColor;
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
vec3 brightOnly(vec3 color, float threshold) {
  float luma = luminance(color);
  return color * smoothstep(threshold, threshold * 1.32 + 0.001, luma);
}
vec3 acesFitted(vec3 color) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
}
void main() {
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  vec3 currentScene = max(texture(uSceneTexture, vUv).rgb, vec3(0.0));
  vec3 temporalScene = max(texture(uTemporalTexture, vUv).rgb, vec3(0.0));
  vec3 scene = max(currentScene, temporalScene * step(0.5, uTemporalEnabled));
  float chromaticMask = smoothstep(uOptics1.x, uOptics1.x * 1.28 + 0.001, luminance(scene));
  vec2 radial = vUv - 0.5;
  radial = length(radial) > 0.0001 ? normalize(radial) : vec2(1.0, 0.0);
  vec2 chromaticShift = radial * px * uOptics1.y * chromaticMask;
  vec3 separated = vec3(
    texture(uSceneTexture, clamp(vUv + chromaticShift, vec2(0.0), vec2(1.0))).r,
    scene.g,
    texture(uSceneTexture, clamp(vUv - chromaticShift, vec2(0.0), vec2(1.0))).b
  );
  scene = mix(scene, separated, chromaticMask);

  vec3 bloom = texture(uBloom0, vUv).rgb * uBloomWeights.x;
  bloom += texture(uBloom1, vUv).rgb * uBloomWeights.y;
  bloom += texture(uBloom2, vUv).rgb * uBloomWeights.z;
  bloom += texture(uBloom3, vUv).rgb * uBloomWeights.w;

  float streakPx = uOptics0.z;
  vec3 glare = vec3(0.0);
  glare += brightOnly(texture(uSceneTexture, vUv + vec2(px.x * streakPx, 0.0)).rgb, uOptics0.x) * 0.22;
  glare += brightOnly(texture(uSceneTexture, vUv - vec2(px.x * streakPx, 0.0)).rgb, uOptics0.x) * 0.22;
  glare += brightOnly(texture(uSceneTexture, vUv + vec2(px.x * streakPx * 2.4, 0.0)).rgb, uOptics0.x) * 0.11;
  glare += brightOnly(texture(uSceneTexture, vUv - vec2(px.x * streakPx * 2.4, 0.0)).rgb, uOptics0.x) * 0.11;
  vec2 starStep = px * streakPx * 0.72;
  vec3 star = brightOnly(texture(uSceneTexture, vUv + starStep).rgb, uOptics0.x);
  star += brightOnly(texture(uSceneTexture, vUv - starStep).rgb, uOptics0.x);
  star += brightOnly(texture(uSceneTexture, vUv + vec2(starStep.x, -starStep.y)).rgb, uOptics0.x);
  star += brightOnly(texture(uSceneTexture, vUv + vec2(-starStep.x, starStep.y)).rgb, uOptics0.x);
  glare = glare * uOptics0.y + star * uOptics0.w * 0.16;

  float spectralMask = smoothstep(uOptics1.x * 1.18, uOptics1.x * 1.8 + 0.001, luminance(scene));
  vec3 spectralEdge = vec3(separated.r, scene.g * 0.96, separated.b) - scene;
  vec3 color = scene + bloom * uBloomStrength + glare;
  color += spectralEdge * spectralMask * uOptics1.z;
  color *= uExposureWashout.x;
  float bloomLuma = luminance(bloom);
  color += vec3(uExposureWashout.y * uExposureWashout.y * 0.008);
  color += bloom * uExposureWashout.y * (0.08 + bloomLuma * 0.04);

  float preToneLuma = luminance(color);
  float hot = smoothstep(1.0, max(1.001, uToneParams.x), preToneLuma);
  color = mix(color, vec3(preToneLuma), hot * uToneParams.z);
  color = acesFitted(color);
  float mappedLuma = luminance(color);
  color = mix(vec3(mappedLuma), color, uToneParams.y);
  color = max(color - vec3(uToneParams.w), vec3(0.0));
  color = pow(clamp(color, 0.0, 1.0), vec3(1.0 / max(uOptics1.w, 1.0)));
  outColor = vec4(color, 1.0);
}`

export interface LaserDmxWebGLShaderProgramSource {
  label: string
  vertSrc: string
  fragSrc: string
}

/** Browser-backed tests compile these exact production shader strings. */
export function getLaserDmxWebGLShaderProgramSources(): LaserDmxWebGLShaderProgramSource[] {
  return [
    { label: 'sharp-beam', vertSrc: BEAM_VERTEX_SHADER, fragSrc: BEAM_FRAGMENT_SHADER },
    { label: 'projector-aperture', vertSrc: APERTURE_VERTEX_SHADER, fragSrc: APERTURE_FRAGMENT_SHADER },
    { label: 'atmospheric-scatter', vertSrc: ATMOSPHERE_VERTEX_SHADER, fragSrc: ATMOSPHERE_FRAGMENT_SHADER },
    { label: 'foreground-veil', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: FOREGROUND_FRAGMENT_SHADER },
    { label: 'atmosphere-composite', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: COMPOSITE_FRAGMENT_SHADER },
    { label: 'temporal-history', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: TEMPORAL_HISTORY_FRAGMENT_SHADER },
    { label: 'bloom-downsample', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: BLOOM_DOWNSAMPLE_FRAGMENT_SHADER },
    { label: 'bloom-blur', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: BLOOM_BLUR_FRAGMENT_SHADER },
    { label: 'photographic-post', vertSrc: FULLSCREEN_VERTEX_SHADER, fragSrc: POST_COMPOSITE_FRAGMENT_SHADER },
  ]
}

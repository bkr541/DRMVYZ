export const REACTIVE_CONSTELLATION_VERTEX_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aBarycentric;
layout(location = 3) in vec3 aInstancePosition;
layout(location = 4) in float aInstanceScale;
layout(location = 5) in vec3 aInstanceRotation;
layout(location = 6) in float aInstanceProminence;
layout(location = 7) in float aInstancePalette;

uniform mat4 uViewProjection;
uniform float uTime;
uniform float uNodeScale;
uniform float uNodeSpin;
uniform float uMotion;
uniform float uCameraOrbit;
uniform float uGeometryRotation;
uniform float uDepthPulse;
uniform float uBeat;

out vec3 vWorldPosition;
out vec3 vNormal;
out vec3 vBarycentric;
out float vProminence;
out float vPalette;

mat3 rotateX(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}
mat3 rotateY(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
mat3 rotateZ(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

void main() {
  float spin = uTime * uNodeSpin * uMotion * mix(0.72, 1.35, aInstancePalette);
  mat3 nodeRotation = rotateZ(aInstanceRotation.z - spin * 0.37) * rotateY(aInstanceRotation.y + spin) * rotateX(aInstanceRotation.x + spin * 0.53);
  float pulseScale = 1.0 + uBeat * uMotion * (0.035 + aInstanceProminence * 0.09);
  vec3 localPosition = nodeRotation * aPosition * (uNodeScale * aInstanceScale * pulseScale);
  vec3 center = aInstancePosition;
  center.z *= 1.0 + uDepthPulse * 0.38 * uMotion;
  float orbit = (uTime * uCameraOrbit + uGeometryRotation * 0.65) * uMotion;
  mat3 worldOrbit = rotateY(orbit) * rotateX(sin(orbit * 0.37) * uCameraOrbit * 0.12);
  vec3 worldPosition = worldOrbit * (center + localPosition);
  vWorldPosition = worldPosition;
  vNormal = normalize(worldOrbit * nodeRotation * aNormal);
  vBarycentric = aBarycentric;
  vProminence = aInstanceProminence;
  vPalette = aInstancePalette;
  gl_Position = uViewProjection * vec4(worldPosition, 1.0);
}
`

export const REACTIVE_CONSTELLATION_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec3 vWorldPosition;
in vec3 vNormal;
in vec3 vBarycentric;
in float vProminence;
in float vPalette;

uniform vec3 uCameraPosition;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uFogColor;
uniform float uIntensity;
uniform float uGlow;
uniform float uFaceOpacity;
uniform float uFacetContrast;
uniform float uInternalGlow;
uniform float uRimIntensity;
uniform float uWireframeAmount;
uniform float uColorVariation;
uniform float uFogAmount;
uniform float uDepthFade;
uniform float uBrightness;
uniform float uBeat;
uniform float uPassMode;

out vec4 outColor;

int bayer2x2(int x, int y) {
  return ((x ^ y) << 1) | y;
}

float orderedDither4x4(vec2 pixel) {
  ivec2 cell = ivec2(mod(floor(pixel), 4.0));
  int low = bayer2x2(cell.x & 1, cell.y & 1);
  int high = bayer2x2((cell.x >> 1) & 1, (cell.y >> 1) & 1);
  return (float(low * 4 + high) + 0.5) / 16.0;
}

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(-0.35, 0.72, 0.58));
  vec3 fillDirection = normalize(vec3(0.58, -0.18, -0.72));
  float rawDiffuse = max(dot(normal, lightDirection), 0.0);
  float fill = max(dot(normal, fillDirection), 0.0);
  float contrast = clamp(uFacetContrast * 0.5, 0.0, 1.0);
  float bands = mix(8.0, 3.0, contrast);
  float facetedDiffuse = floor(rawDiffuse * bands + 0.5) / bands;
  float diffuse = mix(rawDiffuse, smoothstep(0.08, 0.92, facetedDiffuse), contrast);
  float backLight = max(dot(normal, -lightDirection), 0.0);
  float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.05) * uRimIntensity;
  vec3 derivative = max(fwidth(vBarycentric), vec3(0.0001));
  vec3 edgeDistance = smoothstep(vec3(0.0), derivative * 1.4, vBarycentric);
  float edge = 1.0 - min(min(edgeDistance.x, edgeDistance.y), edgeDistance.z);

  float paletteMix = clamp(0.5 + (vPalette - 0.5) * (0.2 + uColorVariation * 1.8), 0.0, 1.0);
  vec3 base = mix(uPrimary, uSecondary, paletteMix);
  base = mix(base, uAccent, vProminence * 0.18 + edge * uWireframeAmount * 0.52);
  float internal = (backLight * 0.62 + pow(1.0 - abs(dot(normal, viewDirection)), 4.0) * 0.38) * uInternalGlow;
  float lighting = 0.12 + diffuse * 0.82 + fill * 0.22 + internal * 0.38;
  lighting *= (1.0 + uBrightness * 0.26 + uBeat * 0.08);
  vec3 faceColor = base * lighting + uAccent * (rim * (0.16 + uGlow * 0.18) + internal * 0.12);

  float distanceToCamera = length(uCameraPosition - vWorldPosition);
  float fogFactor = 1.0 - exp(-max(0.0, distanceToCamera - 1.1) * uFogAmount * uDepthFade * 0.34);
  faceColor = mix(faceColor, uFogColor, clamp(fogFactor, 0.0, 0.82)) * uIntensity;

  if (uPassMode < 0.5) {
    if (uFaceOpacity * uIntensity < orderedDither4x4(gl_FragCoord.xy)) discard;
    outColor = vec4(faceColor, 1.0);
    return;
  }

  float emissiveAlpha = clamp(
    (edge * uWireframeAmount * 0.72
      + rim * (0.18 + uGlow * 0.18)
      + internal * 0.12) * uIntensity,
    0.0,
    1.0
  );
  if (emissiveAlpha <= 0.002) discard;
  vec3 emissive = mix(base, uAccent, 0.56) * (
    edge * uWireframeAmount * 1.35
      + rim * (0.5 + uGlow * 0.5)
      + internal * 0.34
  );
  emissive = mix(emissive, uFogColor, clamp(fogFactor * 0.65, 0.0, 0.7)) * uIntensity;
  outColor = vec4(emissive, emissiveAlpha);
}
`

export const REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE = `#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aEndpointA;
layout(location = 2) in vec3 aEndpointB;
layout(location = 3) in float aInstanceAlpha;
layout(location = 4) in float aInstanceWidth;
layout(location = 5) in float aInstancePalette;
layout(location = 6) in float aInstanceAge;

uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform vec3 uCameraPosition;
uniform float uBeamWidthPx;
uniform float uPassWidthScale;
uniform float uTime;
uniform float uMotion;
uniform float uCameraOrbit;
uniform float uGeometryRotation;
uniform float uDepthPulse;

out float vAlpha;
out float vAcross;
out float vPalette;
out float vAge;
out float vDistance;

mat3 rotateX(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}
mat3 rotateY(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 transformEndpoint(vec3 endpoint) {
  endpoint.z *= 1.0 + uDepthPulse * 0.38 * uMotion;
  float orbit = (uTime * uCameraOrbit + uGeometryRotation * 0.65) * uMotion;
  mat3 worldOrbit = rotateY(orbit) * rotateX(sin(orbit * 0.37) * uCameraOrbit * 0.12);
  return worldOrbit * endpoint;
}

void main() {
  vec3 worldA = transformEndpoint(aEndpointA);
  vec3 worldB = transformEndpoint(aEndpointB);
  vec4 clipA = uViewProjection * vec4(worldA, 1.0);
  vec4 clipB = uViewProjection * vec4(worldB, 1.0);
  float nearA = clipA.z + clipA.w;
  float nearB = clipB.z + clipB.w;
  bool invalid = nearA < 0.0 && nearB < 0.0;

  if (!invalid && nearA < 0.0) {
    float t = clamp(nearA / (nearA - nearB), 0.0, 1.0);
    clipA = mix(clipA, clipB, t);
    worldA = mix(worldA, worldB, t);
  }
  if (!invalid && nearB < 0.0) {
    float t = clamp(nearB / (nearB - nearA), 0.0, 1.0);
    clipB = mix(clipB, clipA, t);
    worldB = mix(worldB, worldA, t);
  }

  float safeWa = max(clipA.w, 0.0001);
  float safeWb = max(clipB.w, 0.0001);
  vec2 ndcA = clipA.xy / safeWa;
  vec2 ndcB = clipB.xy / safeWb;
  vec2 screenDelta = (ndcB - ndcA) * max(uViewport, vec2(1.0)) * 0.5;
  float projectedLength = length(screenDelta);
  invalid = invalid || clipA.w <= 0.0001 || clipB.w <= 0.0001 || projectedLength < 0.001;

  if (invalid) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    vAcross = aCorner.y;
    vPalette = aInstancePalette;
    vAge = aInstanceAge;
    vDistance = 0.0;
    return;
  }

  vec2 perpendicularPixels = vec2(-screenDelta.y, screenDelta.x) / projectedLength;
  vec2 offsetNdc = perpendicularPixels
    * (uBeamWidthPx * uPassWidthScale * aInstanceWidth)
    / max(uViewport, vec2(1.0));
  float along = clamp(aCorner.x, 0.0, 1.0);
  vec4 clip = mix(clipA, clipB, along);
  clip.xy += offsetNdc * aCorner.y * clip.w;
  gl_Position = clip;
  vAlpha = aInstanceAlpha;
  vAcross = aCorner.y;
  vPalette = aInstancePalette;
  vAge = aInstanceAge;
  vDistance = length(uCameraPosition - mix(worldA, worldB, along));
}
`

export const REACTIVE_CONSTELLATION_BEAM_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in float vAlpha;
in float vAcross;
in float vPalette;
in float vAge;
in float vDistance;

uniform vec3 uBeamColor;
uniform vec3 uBeamAccent;
uniform vec3 uFogColor;
uniform float uEdgeOpacity;
uniform float uPassBrightness;
uniform float uPassSoftness;
uniform float uColorVariation;
uniform float uFogAmount;
uniform float uDepthFade;
uniform float uBeat;
uniform float uBrightness;
uniform float uIntensity;

out vec4 outColor;

void main() {
  float edge = abs(vAcross);
  float profile = 1.0 - smoothstep(1.0 - uPassSoftness, 1.0, edge);
  float ageColor = smoothstep(0.15, 1.0, vAge);
  float paletteMix = clamp(0.5 + (vPalette - 0.5) * (0.24 + uColorVariation * 1.76), 0.0, 1.0);
  vec3 color = mix(uBeamColor, uBeamAccent, clamp(paletteMix * 0.7 + ageColor * 0.16, 0.0, 1.0));
  float brightness = uPassBrightness * (1.0 + uBeat * 0.24 + uBrightness * 0.2) * uIntensity;
  float fogFactor = 1.0 - exp(-max(0.0, vDistance - 1.0) * uFogAmount * uDepthFade * 0.28);
  color = mix(color, uFogColor, clamp(fogFactor, 0.0, 0.78));
  float alpha = clamp(vAlpha * uEdgeOpacity * profile * (1.0 - fogFactor * 0.45) * uIntensity, 0.0, 1.0);
  outColor = vec4(color * brightness, alpha);
}
`

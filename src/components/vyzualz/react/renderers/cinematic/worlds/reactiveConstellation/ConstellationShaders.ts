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
  float spin = uTime * uNodeSpin * (0.22 + uMotion * 0.78) * mix(0.72, 1.35, aInstancePalette);
  mat3 nodeRotation = rotateZ(aInstanceRotation.z - spin * 0.37) * rotateY(aInstanceRotation.y + spin) * rotateX(aInstanceRotation.x + spin * 0.53);
  float pulseScale = 1.0 + uBeat * (0.035 + aInstanceProminence * 0.09);
  vec3 localPosition = nodeRotation * aPosition * (uNodeScale * aInstanceScale * pulseScale);
  vec3 center = aInstancePosition;
  center.z *= 1.0 + uDepthPulse * 0.38;
  float orbit = uTime * uCameraOrbit * (0.15 + uMotion * 0.5) + uGeometryRotation * 0.65;
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
uniform float uIntensity;
uniform float uGlow;
uniform float uFaceOpacity;
uniform float uRimIntensity;
uniform float uWireframeAmount;
uniform float uBrightness;
uniform float uBeat;

out vec4 outColor;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(uCameraPosition - vWorldPosition);
  vec3 lightDirection = normalize(vec3(-0.35, 0.72, 0.58));
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float backLight = max(dot(normal, -lightDirection), 0.0) * 0.22;
  float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.15) * uRimIntensity;
  vec3 derivative = fwidth(vBarycentric);
  vec3 edgeDistance = smoothstep(vec3(0.0), derivative * 1.35, vBarycentric);
  float edge = 1.0 - min(min(edgeDistance.x, edgeDistance.y), edgeDistance.z);

  vec3 base = mix(uPrimary, uSecondary, smoothstep(0.08, 0.92, vPalette));
  base = mix(base, uAccent, vProminence * 0.22 + edge * uWireframeAmount * 0.72);
  float lighting = 0.24 + diffuse * 0.72 + backLight + rim * (0.55 + uGlow * 0.65);
  lighting *= (0.65 + uIntensity * 0.55) * (1.0 + uBrightness * 0.28 + uBeat * 0.08);
  vec3 color = base * lighting + uAccent * rim * (0.12 + uGlow * 0.22);
  float alpha = clamp(uFaceOpacity + edge * uWireframeAmount * 0.35 + rim * 0.08, 0.04, 1.0);
  outColor = vec4(color, alpha);
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

mat3 rotateX(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}
mat3 rotateY(float angle) {
  float c = cos(angle); float s = sin(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

vec3 transformEndpoint(vec3 endpoint) {
  endpoint.z *= 1.0 + uDepthPulse * 0.38;
  float orbit = uTime * uCameraOrbit * (0.15 + uMotion * 0.5) + uGeometryRotation * 0.65;
  mat3 worldOrbit = rotateY(orbit) * rotateX(sin(orbit * 0.37) * uCameraOrbit * 0.12);
  return worldOrbit * endpoint;
}

void main() {
  vec4 clipA = uViewProjection * vec4(transformEndpoint(aEndpointA), 1.0);
  vec4 clipB = uViewProjection * vec4(transformEndpoint(aEndpointB), 1.0);
  float nearA = clipA.z + clipA.w;
  float nearB = clipB.z + clipB.w;
  bool invalid = nearA < 0.0 && nearB < 0.0;

  if (!invalid && nearA < 0.0) {
    float t = clamp(nearA / (nearA - nearB), 0.0, 1.0);
    clipA = mix(clipA, clipB, t);
  }
  if (!invalid && nearB < 0.0) {
    float t = clamp(nearB / (nearB - nearA), 0.0, 1.0);
    clipB = mix(clipB, clipA, t);
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
    return;
  }

  vec2 perpendicularPixels = vec2(-screenDelta.y, screenDelta.x) / projectedLength;
  vec2 offsetNdc = perpendicularPixels
    * (uBeamWidthPx * uPassWidthScale * aInstanceWidth)
    / max(uViewport, vec2(1.0));
  vec4 clip = mix(clipA, clipB, clamp(aCorner.x, 0.0, 1.0));
  clip.xy += offsetNdc * aCorner.y * clip.w;
  gl_Position = clip;
  vAlpha = aInstanceAlpha;
  vAcross = aCorner.y;
  vPalette = aInstancePalette;
  vAge = aInstanceAge;
}
`

export const REACTIVE_CONSTELLATION_BEAM_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in float vAlpha;
in float vAcross;
in float vPalette;
in float vAge;

uniform vec3 uBeamColor;
uniform vec3 uBeamAccent;
uniform float uEdgeOpacity;
uniform float uPassBrightness;
uniform float uPassSoftness;
uniform float uBeat;
uniform float uBrightness;

out vec4 outColor;

void main() {
  float edge = abs(vAcross);
  float profile = 1.0 - smoothstep(1.0 - uPassSoftness, 1.0, edge);
  float ageColor = smoothstep(0.15, 1.0, vAge);
  vec3 color = mix(uBeamColor, uBeamAccent, clamp(vPalette * 0.42 + ageColor * 0.22, 0.0, 1.0));
  float brightness = uPassBrightness * (1.0 + uBeat * 0.24 + uBrightness * 0.2);
  float alpha = clamp(vAlpha * uEdgeOpacity * profile, 0.0, 1.0);
  outColor = vec4(color * brightness, alpha);
}
`

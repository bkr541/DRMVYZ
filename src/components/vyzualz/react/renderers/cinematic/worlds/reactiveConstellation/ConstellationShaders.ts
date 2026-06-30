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

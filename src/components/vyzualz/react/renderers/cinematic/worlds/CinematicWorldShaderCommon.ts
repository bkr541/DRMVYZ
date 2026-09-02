export const CINEMATIC_WORLD_COMMON_UNIFORMS = [
  'uResolution',
  'uTime',
  'uTransportTime',
  'uBass',
  'uMid',
  'uHigh',
  'uVolume',
  'uBeat',
  'uBeatPhase',
  'uKick',
  'uSnare',
  'uTransient',
  'uBarProgress',
  'uImpactAge',
  'uDownbeat',
  'uSectionIntensity',
  'uDrop',
  'uSeed',
  'uQuality',
  'uVariation',
  'uPrimary',
  'uSecondary',
  'uAccent',
  'uBackground',
  'uCameraPosition',
  'uCameraRotation',
  'uCameraFieldOfView',
  'uCameraRoute',
  'uCameraAction',
] as const

export const CINEMATIC_WORLD_SHADER_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uTransportTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uVolume;
uniform float uBeat;
uniform float uBeatPhase;
uniform float uKick;
uniform float uSnare;
uniform float uTransient;
uniform float uBarProgress;
uniform float uImpactAge;
uniform float uDownbeat;
uniform float uSectionIntensity;
uniform float uDrop;
uniform float uSeed;
uniform float uQuality;
uniform vec4 uVariation;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uBackground;
uniform vec3 uCameraPosition;
uniform vec3 uCameraRotation;
uniform float uCameraFieldOfView;
uniform float uCameraRoute;
uniform float uCameraAction;

vec3 cinematicBackground(float peak) {
  float maxChannel = max(max(uBackground.r, uBackground.g), max(uBackground.b, 0.0001));
  float scale = min(1.0, peak / maxChannel);
  return uBackground * scale;
}

float hash11(float p) {
  return fract(sin(p * 127.1 + uSeed * 0.0137) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 0.017) * 43758.5453123);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm21(vec2 p, int octaves) {
  float total = 0.0;
  float amplitude = 0.5;
  mat2 basis = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    total += noise21(p) * amplitude;
    p = basis * p * 2.03 + vec2(7.1, 3.7);
    amplitude *= 0.5;
  }
  return total;
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

vec2 cinematicCameraUv(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  float fov = clamp(uCameraFieldOfView, 20.0, 110.0);
  float fovScale = tan(radians(fov) * 0.5) / tan(radians(58.0) * 0.5);
  p *= fovScale;
  p = rotate2d(-uCameraRotation.z) * p;
  p += vec2(-uCameraPosition.x, uCameraPosition.y) * 0.16;
  p += vec2(uCameraRotation.y, -uCameraRotation.x) * 0.22;
  p *= 1.0 + (uCameraPosition.z - 1.8) * 0.10;
  p.x += sin(uCameraRoute * 6.2831853) * 0.012 * step(5.5, uCameraAction);
  return p;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
`

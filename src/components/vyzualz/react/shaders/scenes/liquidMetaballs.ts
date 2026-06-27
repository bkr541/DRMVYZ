import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const LIQUID_METABALLS: ShaderDefinition = {
  id: 'shader-liquid-metaballs',
  name: 'Liquid Metaballs',
  description: 'Organic liquid fields that merge and scale with bass, with spectral centroid color shifts.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeatHit;
uniform float uKickHit;
uniform float uSpectralCentroid;
uniform vec2  uResolution;
uniform float uAspect;

uniform float uViscosity;
uniform float uScale;
uniform float uTurbulence;
uniform float uReflection;
uniform vec4  uSurfaceColor;
uniform vec4  uHighlightColor;
uniform float uMotionSpeed;

uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterBassReactivity;

out vec4 fragColor;

float hash(float n) { return fract(sin(n) * 43758.5453); }

// Metaball field: sum of inverse square distances
float metafield(vec2 p, float t, float bass, float speed) {
  float v = 0.0;
  float sc = uScale * (1.0 + bass * uMasterBassReactivity * 0.4);

  // 6 moving blobs
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float r = hash(fi * 13.7) * 0.45 + 0.15;
    float ox = sin(t * speed * (0.3 + hash(fi * 5.1) * 0.4) + fi * 1.9) * 0.55 * sc;
    float oy = cos(t * speed * (0.25 + hash(fi * 8.3) * 0.35) + fi * 2.7) * 0.45 * sc;
    float dx = p.x - ox;
    float dy = p.y - oy;
    float d2 = dx*dx + dy*dy;
    float blobR = r * sc * (1.0 + bass * 0.3 + uKickHit * 0.2);
    v += (blobR * blobR) / max(d2, 0.0001);
  }
  return v;
}

// Liquid surface normal (2D gradient)
vec2 metaNormal(vec2 p, float t, float bass, float speed, float eps) {
  float dx = metafield(p + vec2(eps, 0.0), t, bass, speed)
           - metafield(p - vec2(eps, 0.0), t, bass, speed);
  float dy = metafield(p + vec2(0.0, eps), t, bass, speed)
           - metafield(p - vec2(0.0, eps), t, bass, speed);
  return normalize(vec2(dx, dy) + vec2(0.0001));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  float bass   = uBass  * uMasterBassReactivity;
  float speed  = uMotionSpeed * uMasterMotion;
  float t      = uTime;

  // Turbulence distortion on uv
  float turb = uTurbulence * 0.08;
  float nx = sin(uv.x * 3.1 + t * 0.7) * turb + cos(uv.y * 2.7 + t * 0.5) * turb;
  float ny = cos(uv.x * 2.9 + t * 0.6) * turb + sin(uv.y * 3.3 + t * 0.8) * turb;
  vec2 uvd = uv + vec2(nx, ny) * (1.0 + bass * 0.3);

  float field = metafield(uvd, t, bass, speed);
  float threshold = uViscosity * 1.8 + 0.4;

  // SDF from metaball field (invert: field > threshold = inside)
  float sdf = field - threshold;
  float edgeW = fwidth(sdf) * 1.5;
  float inside = smoothstep(-edgeW, edgeW, sdf);

  if (inside < 0.01) {
    // Background: dark with subtle energy shimmer
    float bg = uEnergy * 0.08 * uMasterIntensity;
    fragColor = vec4(uSurfaceColor.rgb * 0.05 + bg, 1.0);
    return;
  }

  // Surface color: interpolate between surface and highlight via spectral centroid
  // centroid is a reserved interpolation qualifier in GLSL ES 3.00,
  // so keep the local name explicit rather than shadowing the uniform concept.
  float spectralCentroid = uSpectralCentroid;
  vec3 col = mix(uSurfaceColor.rgb, uHighlightColor.rgb, spectralCentroid * 0.6 + bass * 0.2);

  // Reflection-like highlights using surface normal
  vec2 norm = metaNormal(uvd, t, bass, speed, 0.02);
  float lightAngle = dot(norm, normalize(vec2(0.5, 1.0)));
  float highlight = pow(max(lightAngle, 0.0), 4.0) * uReflection;

  col += uHighlightColor.rgb * highlight;

  // Beat brightness flash
  col *= 1.0 + uBeatHit * 0.5;

  // Bass glow
  col *= 1.0 + bass * 0.3;

  // Rim glow at edges
  float rim = 1.0 - clamp(sdf / (threshold * 0.3), 0.0, 1.0);
  col += uHighlightColor.rgb * rim * 0.4 * uMasterIntensity;

  // Intensity
  col *= uMasterIntensity;

  // Gamma
  col = pow(max(col, 0.0), vec3(0.454));

  fragColor = vec4(col * inside, 1.0);
}
`,

  params: [
    {
      id: 'viscosity',
      type: 'float',
      label: 'Viscosity',
      uniformName: 'uViscosity',
      min: 0.1, max: 2.0, step: 0.05,
      default: 0.9,
      modulatable: false,
    },
    {
      id: 'scale',
      type: 'float',
      label: 'Scale',
      uniformName: 'uScale',
      min: 0.2, max: 2.5, step: 0.05,
      default: 1.0,
      modulatable: false,
    },
    {
      id: 'turbulence',
      type: 'float',
      label: 'Turbulence',
      uniformName: 'uTurbulence',
      min: 0.0, max: 2.0, step: 0.05,
      default: 0.5,
      modulatable: false,
    },
    {
      id: 'reflection',
      type: 'float',
      label: 'Reflection',
      uniformName: 'uReflection',
      min: 0.0, max: 2.0, step: 0.05,
      default: 1.0,
      modulatable: false,
    },
    {
      id: 'surfaceColor',
      type: 'color',
      label: 'Surface Color',
      uniformName: 'uSurfaceColor',
      default: [0.1, 0.4, 0.9, 1.0],
    },
    {
      id: 'highlightColor',
      type: 'color',
      label: 'Highlight Color',
      uniformName: 'uHighlightColor',
      default: [0.8, 0.95, 1.0, 1.0],
    },
    {
      id: 'motionSpeed',
      type: 'float',
      label: 'Motion Speed',
      uniformName: 'uMotionSpeed',
      min: 0.0, max: 3.0, step: 0.05,
      default: 0.8,
      modulatable: false,
    },
  ],

  defaults: {
    viscosity:    0.9,
    scale:        1.0,
    turbulence:   0.5,
    reflection:   1.0,
    surfaceColor: [0.1, 0.4, 0.9, 1.0],
    highlightColor:[0.8, 0.95, 1.0, 1.0],
    motionSpeed:  0.8,
  },

  quality: {
    minimumTier:       'low',
    recommendedTier:   'medium',
    estimatedPassCount: 1,
  },

  thumbnail: { color: '#0a1a3a' },

  tags: ['liquid', 'organic', 'metaballs'],
}

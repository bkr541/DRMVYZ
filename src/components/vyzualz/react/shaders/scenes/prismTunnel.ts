import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const PRISM_TUNNEL: ShaderDefinition = {
  id: 'shader-neon-tunnel',
  name: 'Prism Tunnel',
  description: 'Ray-marched tunnel with cyan-emerald lighting, beat pulse, and bass wall deformation.',
  category: 'raymarch',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBeatPhase;
uniform float uBeatHit;
uniform float uBass;
uniform float uSnareHit;
uniform float uKickHit;
uniform float uEnergy;
uniform vec2  uResolution;
uniform float uAspect;

uniform float uSpeed;
uniform float uTunnelRadius;
uniform float uWarp;
uniform float uFogDensity;
uniform float uGlow;
uniform vec4  uPrimaryColor;
uniform vec4  uSecondaryColor;
uniform float uRotation;

// master controls
uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterBassReactivity;
uniform float uMasterFogDensity;

out vec4 fragColor;

// Simple hash for noise
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Distance to tunnel
float tunnel(vec3 p, float r, float warpAmt) {
  float ang = atan(p.y, p.x);
  float wave = sin(ang * 6.0 + p.z * 0.8 + uTime * 1.5) * warpAmt;
  float dist = length(p.xy) - r + wave;
  return dist;
}

// Hex-grid segment markers
float hexGrid(vec3 p) {
  float z = mod(p.z, 4.0);
  float ring = abs(length(p.xy) - uTunnelRadius * 0.95);
  return ring < 0.04 && z < 0.08 ? 1.0 : 0.0;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  // Beat pulse on brightness
  float beat = uBeatHit * 0.4 + uKickHit * 0.3 + uSnareHit * 0.15;
  float bass = uBass * uMasterBassReactivity;
  float speed = uSpeed * uMasterMotion * (1.0 + bass * 0.5);
  float rotAng = uRotation + uTime * 0.15 * uMasterMotion;

  // Rotate UV
  float cs = cos(rotAng); float sn = sin(rotAng);
  uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);

  // Ray origin and direction
  vec3 ro = vec3(0.0, 0.0, uTime * speed);
  vec3 rd = normalize(vec3(uv * 0.85, 1.0));

  float warpAmt = uWarp * (0.08 + bass * 0.12);
  float radius = uTunnelRadius * (1.0 + uKickHit * 0.06);

  // March
  float t = 0.0;
  float maxT = 28.0;
  float closest = 1e5;
  bool hit = false;
  int steps = 0;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = -tunnel(p, radius, warpAmt); // inside tunnel: negative → we flip
    // inside: distance to wall = -tunnel(p) when inside
    float wallD = abs(length(p.xy) - radius - sin(atan(p.y,p.x)*6.0+p.z*0.8+uTime*1.5)*warpAmt);
    if (wallD < 0.005) { hit = true; closest = t; break; }
    if (t > maxT) break;
    t += max(wallD * 0.5, 0.01);
    steps++;
  }

  vec3 col = vec3(0.0);

  if (hit) {
    vec3 hp = ro + rd * closest;
    float ang = atan(hp.y, hp.x);
    float z = hp.z;

    // Wall color from angular position + time
    float stripe = sin(ang * 8.0 + z * 1.2) * 0.5 + 0.5;
    vec3 primary   = uPrimaryColor.rgb;
    vec3 secondary = uSecondaryColor.rgb;
    col = mix(primary, secondary, stripe);

    // Segment line glow
    float seg = hexGrid(hp);
    col += seg * (primary * 0.8 + beat * 1.5);

    // Beat flash
    col += beat * secondary * 1.2;

    // Bass deformation glow
    col *= 1.0 + bass * 0.4;

    // Snare flash: white-out flash
    col = mix(col, vec3(1.0), uSnareHit * 0.5);

    // Fog / depth fade
    float fog = 1.0 - exp(-closest * uFogDensity * uMasterFogDensity * 0.12);
    col *= (1.0 - fog * 0.85);

    // Glow bloom at tunnel entrance
    float centerGlow = exp(-closest * 0.18) * uGlow * uMasterIntensity;
    col += centerGlow * secondary;
  } else {
    // Looking down the infinite tunnel — deep glow
    float depth = exp(-maxT * 0.06) * uGlow;
    col = uPrimaryColor.rgb * depth * (0.3 + uEnergy * 0.6 + beat * 0.4) * uMasterIntensity;
  }

  // Vignette
  float vignette = 1.0 - dot(uv * 0.4, uv * 0.4);
  col *= vignette;

  // Gamma
  col = pow(max(col, 0.0), vec3(0.454));

  fragColor = vec4(col, 1.0);
}
`,

  params: [
    {
      id: 'speed',
      type: 'float',
      label: 'Speed',
      uniformName: 'uSpeed',
      min: 0.1, max: 4.0, step: 0.05,
      default: 1.2,
      modulatable: true,
    },
    {
      id: 'tunnelRadius',
      type: 'float',
      label: 'Tunnel Radius',
      uniformName: 'uTunnelRadius',
      min: 0.3, max: 2.0, step: 0.05,
      default: 0.9,
      modulatable: true,
    },
    {
      id: 'warp',
      type: 'float',
      label: 'Warp',
      uniformName: 'uWarp',
      min: 0.0, max: 2.0, step: 0.05,
      default: 0.6,
      modulatable: true,
    },
    {
      id: 'fogDensity',
      type: 'float',
      label: 'Fog Density',
      uniformName: 'uFogDensity',
      min: 0.0, max: 3.0, step: 0.05,
      default: 1.0,
      modulatable: false,
    },
    {
      id: 'glow',
      type: 'float',
      label: 'Glow',
      uniformName: 'uGlow',
      min: 0.0, max: 3.0, step: 0.05,
      default: 1.0,
      modulatable: true,
    },
    {
      id: 'primaryColor',
      type: 'color',
      label: 'Primary Color',
      uniformName: 'uPrimaryColor',
      brandRole: 'primary',
      default: [0.0, 0.9, 0.85, 1.0],
    },
    {
      id: 'secondaryColor',
      type: 'color',
      label: 'Secondary Color',
      uniformName: 'uSecondaryColor',
      brandRole: 'secondary',
      default: [0.1, 0.9, 0.3, 1.0],
    },
    {
      id: 'rotation',
      type: 'float',
      label: 'Rotation',
      uniformName: 'uRotation',
      min: -3.14159, max: 3.14159, step: 0.01,
      default: 0.0,
      modulatable: true,
    },
  ],

  defaults: {
    speed:         1.2,
    tunnelRadius:  0.9,
    warp:          0.6,
    fogDensity:    1.0,
    glow:          1.0,
    primaryColor:  [0.0, 0.9, 0.85, 1.0],
    secondaryColor:[0.1, 0.9, 0.3,  1.0],
    rotation:      0.0,
  },

  quality: {
    minimumTier:       'low',
    recommendedTier:   'medium',
    estimatedPassCount: 1,
  },

  thumbnail: { color: '#063333' },

  tags: ['tunnel', 'prism', 'raymarch'],
}

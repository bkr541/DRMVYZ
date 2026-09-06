import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { PRISM_RADIAL_TOPOLOGY_GLSL, PRISM_RADIAL_TOPOLOGY_LIMITS } from './prismRadialTopology'

export const PRISM_TUNNEL: ShaderDefinition = {
  id: 'shader-neon-tunnel',
  name: 'Prism Tunnel',
  description: 'Radial prismatic field with addressable facets, luminous arcs, beat pulse, and bass-reactive curvature.',
  category: 'generator',
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

${PRISM_RADIAL_TOPOLOGY_GLSL}

float saturate(float value) { return clamp(value, 0.0, 1.0); }

float radialBand(float radius, float center, float width) {
  return 1.0 - smoothstep(width, width * 2.1, abs(radius - center));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  float beat = uBeatHit * 0.4 + uKickHit * 0.3 + uSnareHit * 0.15;
  float bass = uBass * uMasterBassReactivity;
  float motion = uSpeed * uMasterMotion;
  float rotAng = uRotation + uTime * 0.15 * uMasterMotion;
  float cs = cos(rotAng);
  float sn = sin(rotAng);
  vec2 radialUv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);

  // uTunnelRadius remains the persisted compatibility id, but now owns the
  // canonical center-anchored radial scale rather than corridor depth.
  float baseRadius = uTunnelRadius * (1.0 + uKickHit * 0.045);
  PrismRadialElement element = prismTopologyAt(radialUv, baseRadius, uWarp);

  float sectorAngle = PRISM_TOPOLOGY_TAU / float(PRISM_TOPOLOGY_ELEMENT_COUNT);
  float local = element.localAngle / (sectorAngle * 0.5);
  float angularCore = 1.0 - smoothstep(0.58, 1.0, abs(local));
  float angularEdge = smoothstep(0.72, 0.96, abs(local)) * (1.0 - smoothstep(0.96, 1.0, abs(local)));

  float radius = length(radialUv);
  float curveWave = sin(local * 1.57079632679) * uWarp * 0.055;
  float bassBend = sin(local * 3.14159265359 + element.normalizedIndex * 6.28318530718) * bass * 0.035;
  float shapedRadius = radius + curveWave + bassBend + element.curvature * 0.014;

  float innerFeather = max(0.012, baseRadius * 0.035);
  float outerFeather = max(0.02, baseRadius * 0.05);
  float insideOuter = 1.0 - smoothstep(element.outerRadius - outerFeather, element.outerRadius + outerFeather, shapedRadius);
  float outsideInner = smoothstep(element.innerRadius - innerFeather, element.innerRadius + innerFeather, shapedRadius);
  float facetMask = insideOuter * outsideInner * angularCore;

  // Surface motion travels across the radial field, not through camera depth.
  float span = max(element.outerRadius - element.innerRadius, 0.001);
  float radialT = saturate((shapedRadius - element.innerRadius) / span);
  float phase = radialT * 12.0 - uTime * motion * 1.9 + element.normalizedIndex * 7.0;
  float arcA = 0.5 + 0.5 * sin(phase);
  float arcB = radialBand(radialT, 0.34 + sin(uTime * motion * 0.32 + element.index) * 0.025, 0.035);
  float arcC = radialBand(radialT, 0.71 + cos(uTime * motion * 0.24 - element.index) * 0.02, 0.028);
  float arcGlow = max(pow(arcA, 8.0), max(arcB, arcC));

  vec3 primary = uPrimaryColor.rgb;
  vec3 secondary = uSecondaryColor.rgb;
  float paletteMix = 0.5 + 0.5 * sin(element.normalizedIndex * PRISM_TOPOLOGY_TAU * 2.0 + radialT * 3.0);
  vec3 facetColor = mix(primary, secondary, paletteMix);

  float facetLight = facetMask * (0.32 + arcA * 0.48 + arcGlow * (0.65 + beat * 1.35));
  float rimLight = angularEdge * insideOuter * outsideInner * (0.4 + uGlow * 0.35);
  vec3 col = facetColor * (facetLight + rimLight);

  // Center aperture glow and broad haze preserve the luminous Prism DNA while
  // keeping the composition center-anchored instead of a vanishing-point view.
  float apertureGlow = exp(-radius * (5.8 / max(baseRadius, 0.15))) * (0.22 + uGlow * 0.75) * (0.9 + uEnergy * 0.25);
  float halo = exp(-abs(radius - element.innerRadius) * (14.0 / max(baseRadius, 0.2))) * 0.42;
  col += mix(primary, secondary, 0.5) * (apertureGlow + halo * facetMask);

  float hazeAmount = uFogDensity * uMasterFogDensity;
  float haze = exp(-radius * 1.35) * hazeAmount * 0.11;
  col += mix(primary, secondary, 0.35) * haze;

  col *= 1.0 + bass * 0.34;
  col += beat * secondary * (0.18 + facetMask * 0.42);
  col = mix(col, vec3(1.0), uSnareHit * 0.28);
  col *= uMasterIntensity;

  float vignette = saturate(1.08 - dot(uv * 0.36, uv * 0.36));
  col *= vignette;
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
      label: 'Radial Scale',
      uniformName: 'uTunnelRadius',
      min: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.min,
      max: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.max,
      step: 0.05,
      default: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
      modulatable: true,
    },
    {
      id: 'warp',
      type: 'float',
      label: 'Warp',
      uniformName: 'uWarp',
      min: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.min,
      max: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.max,
      step: 0.05,
      default: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
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
    tunnelRadius:  PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
    warp:          PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
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

  tags: ['prism', 'radial', 'facets'],
}

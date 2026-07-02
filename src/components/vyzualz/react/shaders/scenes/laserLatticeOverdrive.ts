import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const LASER_LATTICE_OVERDRIVE: ShaderDefinition = {
  id: 'shader-laser-lattice-overdrive',
  name: 'Laser Lattice Overdrive',
  description: 'A razor-plane lattice that compresses through builds, slashes on snares, and detonates outward on drops.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uGridDensity;
uniform float uDepth;
uniform float uBladeWidth;
uniform float uRotation;
uniform float uScatter;
uniform vec4 uRailColor;
uniform vec4 uBladeColor;
uniform vec4 uPulseColor;
uniform vec4 uBackgroundColor;

out vec4 fragColor;

float beam(float d, float width) {
  return exp(-abs(d) * max(1.0, width));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float phraseFlip = floor(uPhrase8Progress * 4.0) + mod(floor(uBarIndex), 4.0);
  float spin = uRotation + uPhrase32Progress * SHADER_TAU * 0.5
    + uTime * 0.08 * uMasterMotion + phraseFlip * 0.12;
  p = rotate2d(spin) * p;

  float compress = mix(1.0, 0.58, music.build * (1.0 - music.fakeout));
  float explode = 1.0 + music.drop * uScatter * 0.28;
  p *= compress / explode;
  p += waveformAt(fract(uv.y + uPhrase4Progress * 0.25)) * vec2(0.035, 0.012) * music.micro;

  float density = max(4.0, floor(uGridDensity));
  vec2 perspective = p / max(0.24, 1.0 - abs(p.y) * uDepth * 0.23);
  float z = uPlaybackTime * (0.32 + uBass * 0.5) * uMasterMotion + uPhrase16Progress * 4.0;
  vec2 gridUv = perspective * density;
  gridUv.y += z;

  float vertical = beam(abs(fract(gridUv.x) - 0.5) - uBladeWidth, 105.0);
  float horizontal = beam(abs(fract(gridUv.y) - 0.5) - uBladeWidth, 105.0);
  float diagA = beam(abs(fract((gridUv.x + gridUv.y) * 0.5) - 0.5) - uBladeWidth * 0.8, 90.0);
  float diagB = beam(abs(fract((gridUv.x - gridUv.y) * 0.5) - 0.5) - uBladeWidth * 0.8, 90.0);
  float phraseSelector = mod(floor(uPhrase4Progress * 8.0 + uBeatInBar), 4.0);
  float rail = vertical + horizontal;
  rail += mix(diagA, diagB, step(2.0, phraseSelector)) * (0.35 + uHighMid * 0.5);

  float radius = length(p);
  float radial = beam(fract(radius * (6.0 + uDepth * 4.0) - z * 0.3) - 0.5, 55.0);
  float spokes = beam(abs(fract((atan(p.y, p.x) / SHADER_TAU + 0.5) * density * 0.5) - 0.5) - uBladeWidth, 80.0);
  float tunnel = radial * spokes * (0.4 + uEnergy * 0.8);

  float snareSlash = beam(dot(p, normalize(vec2(0.72, 0.42))) - (uSnareHit - 0.5) * 0.35, 115.0)
    * uSnareHit;
  float kickLaunch = beam(radius - fract(uBeatPhase + uKickHit * 0.35) * 1.2, 48.0)
    * (uKickHit + uBassStemTransient * uHasStems);
  float hatScan = beam(fract((p.y + uTime * 0.7) * 22.0) - 0.5, 75.0)
    * (uHatHit + uAir * 0.2);

  float spectrum = spectrumAt(fract(radius * 0.8 + atan(p.y, p.x) / SHADER_TAU));
  float latticeLight = rail * (0.45 + spectrum * 0.85 + music.rhythm * 0.22);
  float fakeoutHold = mix(1.0, 0.2 + tunnel * 0.5, music.fakeout);
  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.55 + uEnergyLongTerm * 0.18);
  col += mix(uRailColor.rgb, uBladeColor.rgb, spectrum) * latticeLight * fakeoutHold;
  col += uPulseColor.rgb * tunnel * (0.35 + music.macro * 0.7);
  col += mix(uBladeColor.rgb, uBrandImpact.rgb, uSnareHit) * snareSlash;
  col += mix(uPulseColor.rgb, uBrandHighlight.rgb, music.drop) * kickLaunch;
  col += uRailColor.rgb * hatScan * 0.22;
  col = applyBrandAtmosphere(col, uv, 0.1 + music.expression * 0.1);
  col *= 0.75 + music.micro * 0.34 + music.macro * 0.38 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.78 + uMasterGlow * 0.28);
  col *= 1.0 - dot(p * 0.24, p * 0.24);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    { id: 'gridDensity', type: 'float', label: 'Grid Density', group: 'Lattice', uniformName: 'uGridDensity', min: 4, max: 30, step: 0.5, default: 14, modulatable: true },
    { id: 'depth', type: 'float', label: 'Depth', group: 'Lattice', uniformName: 'uDepth', min: 0.2, max: 3, step: 0.05, default: 1.35, modulatable: true },
    { id: 'bladeWidth', type: 'float', label: 'Blade Width', group: 'Lattice', uniformName: 'uBladeWidth', min: 0.01, max: 0.2, step: 0.005, default: 0.055, modulatable: true },
    { id: 'rotation', type: 'float', label: 'Rotation', group: 'Motion', uniformName: 'uRotation', min: -3.14159, max: 3.14159, step: 0.01, default: 0.22, modulatable: true },
    { id: 'scatter', type: 'float', label: 'Drop Scatter', group: 'Impact', uniformName: 'uScatter', min: 0, max: 3, step: 0.05, default: 1.45, modulatable: true },
    { id: 'railColor', type: 'color', label: 'Rails', group: 'Color', uniformName: 'uRailColor', brandRole: 'primary', default: [0.02, 0.32, 1, 1] },
    { id: 'bladeColor', type: 'color', label: 'Blades', group: 'Color', uniformName: 'uBladeColor', brandRole: 'secondary', default: [0.95, 0.04, 0.82, 1] },
    { id: 'pulseColor', type: 'color', label: 'Pulse', group: 'Color', uniformName: 'uPulseColor', brandRole: 'accent', default: [0.05, 1, 0.92, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Background', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.003, 0.004, 0.018, 1] },
  ],

  defaults: {
    gridDensity: 14,
    depth: 1.35,
    bladeWidth: 0.055,
    rotation: 0.22,
    scatter: 1.45,
    railColor: [0.02, 0.32, 1, 1],
    bladeColor: [0.95, 0.04, 0.82, 1],
    pulseColor: [0.05, 1, 0.92, 1],
    backgroundColor: [0.003, 0.004, 0.018, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['flash-cut', 'pixel-scatter', 'rgb-split-dissolve', 'zoom-tunnel'] },
  thumbnail: { color: '#08052c' },
  tags: ['dubstep', 'laser', 'lattice', 'festival', 'phrases', 'fft', 'brand-kit'],
}

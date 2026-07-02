import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const SPECTRUM_CATHEDRAL: ShaderDefinition = {
  id: 'shader-spectrum-cathedral',
  name: 'Spectrum Cathedral',
  description: 'FFT-carved spectral arches with phrase-scale camera motion, section choreography, and stem-aware illumination.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
uniform sampler2D uSpectrumTexture;
uniform float uSpectrumAvailable;
uniform sampler2D uSpectralGradient;
uniform float uSpectralGradientStopCount;

uniform float uBass;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uHatHit;
uniform float uEnergy;
uniform float uEnergyLongTerm;
uniform float uPhrase16Progress;
uniform float uPhrase32Progress;
uniform float uSectionType;
uniform float uSectionProgress;
uniform float uSectionIntensity;
uniform float uBuildConfidence;
uniform float uDropConfidence;
uniform float uFakeoutConfidence;
uniform float uVocalEnergy;
uniform float uInstrumentEnergy;
uniform float uHasStems;

uniform float uArchCount;
uniform float uDepth;
uniform float uRotation;
uniform float uGlow;
uniform vec4 uBackgroundColor;

uniform vec4 uBrandPrimary;
uniform vec4 uBrandSecondary;
uniform vec4 uBrandAccent;
uniform vec4 uBrandImpact;
uniform float uBrandEnabled;
uniform float uBrandStrength;

uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterGlow;
uniform float uMasterBassReactivity;

out vec4 fragColor;

float spectrum(float x) {
  if (uSpectrumAvailable < 0.5) return mix(uEnergyLongTerm, uEnergy, x);
  return texture(uSpectrumTexture, vec2(clamp(x, 0.0, 1.0), 0.5)).r;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;

  float macro = uPhrase32Progress + uSectionProgress * 0.35;
  float angle = uRotation + macro * 0.35 + uTime * 0.025 * uMasterMotion;
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  p = rot * p;

  float count = max(4.0, floor(uArchCount));
  float lane = floor((p.x * 0.5 + 0.5) * count);
  float laneUv = fract((p.x * 0.5 + 0.5) * count) - 0.5;
  float spec = spectrum((lane + 0.5) / count);
  float bassLift = uBass * uMasterBassReactivity;
  float archHeight = 0.15 + spec * 0.75 + bassLift * 0.18;
  float arch = abs(length(vec2(laneUv * 2.1, max(0.0, p.y + 0.62))) - archHeight);
  float archLine = exp(-arch * (38.0 + uDepth * 18.0));

  float floorGrid = exp(-abs(fract((p.y + macro * 0.15) * (7.0 + uDepth * 3.0)) - 0.5) * 34.0);
  floorGrid *= 1.0 - smoothstep(-0.75, 0.45, p.y);

  float t = clamp(spec * 0.75 + uPhrase16Progress * 0.25, 0.0, 1.0);
  vec3 gradientColor = texture(uSpectralGradient, vec2(t, 0.5)).rgb;
  vec3 brandColor = mix(uBrandPrimary.rgb, uBrandSecondary.rgb, t);
  vec3 color = mix(gradientColor, brandColor, uBrandEnabled);

  float stemLight = mix(uInstrumentEnergy, max(uInstrumentEnergy, uVocalEnergy), uHasStems);
  float macroLight = 0.35 + uSectionIntensity * 0.55 + uBuildConfidence * 0.25;
  float impact = uKickHit * 0.7 + uSnareHit + uHatHit * 0.25 + uDropConfidence * 0.35;
  float fakeoutVoid = 1.0 - uFakeoutConfidence * 0.55;

  vec3 col = uBackgroundColor.rgb * (0.35 + uEnergyLongTerm * 0.3);
  col += color * archLine * (macroLight + stemLight * 0.35 + impact) * fakeoutVoid;
  col += uBrandAccent.rgb * floorGrid * (0.12 + uEnergy * 0.35);
  col = mix(col, uBrandImpact.rgb, uSnareHit * 0.35);
  col *= uMasterIntensity * (0.75 + uGlow * uMasterGlow * 0.3);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    {
      id: 'archCount', type: 'integer', label: 'Arch Count', uniformName: 'uArchCount',
      min: 4, max: 32, step: 1, default: 14, modulatable: true,
    },
    {
      id: 'depth', type: 'float', label: 'Depth', uniformName: 'uDepth',
      min: 0, max: 3, step: 0.05, default: 1.2, modulatable: true,
    },
    {
      id: 'rotation', type: 'float', label: 'Rotation', uniformName: 'uRotation',
      min: -3.14159, max: 3.14159, step: 0.01, default: 0, modulatable: true,
    },
    {
      id: 'glow', type: 'float', label: 'Glow', uniformName: 'uGlow',
      min: 0, max: 3, step: 0.05, default: 1.35, modulatable: true,
    },
    {
      id: 'backgroundColor', type: 'color', label: 'Background', uniformName: 'uBackgroundColor',
      brandRole: 'background', default: [0.01, 0.015, 0.04, 1],
    },
    {
      id: 'spectralGradient', type: 'gradient', label: 'Spectral Gradient', uniformName: 'uSpectralGradient',
      default: [
        { position: 0, color: [0.0, 0.92, 1.0, 1] },
        { position: 0.45, color: [0.25, 0.18, 1.0, 1] },
        { position: 1, color: [1.0, 0.12, 0.75, 1] },
      ],
    },
  ],

  defaults: {
    archCount: 14,
    depth: 1.2,
    rotation: 0,
    glow: 1.35,
    backgroundColor: [0.01, 0.015, 0.04, 1],
    spectralGradient: [
      { position: 0, color: [0.0, 0.92, 1.0, 1] },
      { position: 0.45, color: [0.25, 0.18, 1.0, 1] },
      { position: 1, color: [1.0, 0.12, 0.75, 1] },
    ],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  thumbnail: { color: '#07152d' },
  tags: ['fft', 'spectrum', 'cathedral', 'phrase', 'stems', 'brand'],
}

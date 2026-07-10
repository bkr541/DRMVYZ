import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const SEMANTIC_DROP_REACTOR: ShaderDefinition = {
  id: 'shader-semantic-drop-reactor',
  name: 'Semantic Drop Reactor',
  description: 'Macro build, fakeout, and drop states steer a bass-reactive reactor with stem and phrase choreography.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
uniform float uBass;
uniform float uLowMid;
uniform float uHigh;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uHatHit;
uniform float uDownbeatHit;
uniform float uTransient;
uniform float uBarPhase;
uniform float uPhrase4Progress;
uniform float uPhrase16Progress;
uniform float uPhrase32Progress;
uniform float uSectionType;
uniform float uSectionProgress;
uniform float uEnergyShortTerm;
uniform float uEnergyLongTerm;
uniform float uEnergyDelta;
uniform float uBuildProgress;
uniform float uDropImpact;
uniform float uBuildConfidence;
uniform float uDropConfidence;
uniform float uFakeoutConfidence;
uniform float uDrumEnergy;
uniform float uBassStemEnergy;
uniform float uVocalEnergy;
uniform float uHasStems;
uniform float uMoodCode;
uniform float uTextureCode;

uniform float uCellCount;
uniform float uCoreSize;
uniform float uSpin;
uniform float uShockwave;
uniform vec4 uPrimaryColor;
uniform vec4 uSecondaryColor;
uniform vec4 uAccentColor;
uniform vec4 uBackgroundColor;

uniform vec4 uBrandImpact;
uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterBassReactivity;
uniform float uMasterGlow;

out vec4 fragColor;

float ring(vec2 p, float radius, float width) {
  return exp(-abs(length(p) - radius) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;

  float macroBuild = max(uBuildProgress, uBuildConfidence);
  float macroDrop = max(uDropImpact, uDropConfidence);
  float fakeout = uFakeoutConfidence;
  float stemBass = mix(uBass, max(uBass, uBassStemEnergy), uHasStems);
  float drums = mix(uTransient, max(uTransient, uDrumEnergy), uHasStems);

  float angle = atan(p.y, p.x) + uSpin * (uPhrase32Progress - 0.5) + uTime * 0.04 * uMasterMotion;
  float radius = length(p);
  float cells = max(3.0, floor(uCellCount));
  float cell = abs(sin(angle * cells + uPhrase16Progress * 6.28318));
  float contracted = mix(1.0, 0.62, macroBuild * (1.0 - fakeout));
  float coreRadius = uCoreSize * contracted * (1.0 + stemBass * uMasterBassReactivity * 0.22);

  float core = ring(p, coreRadius, 65.0 - uLowMid * 18.0) * (0.45 + cell * 0.8);
  float inner = exp(-radius * (5.5 - macroBuild * 2.2)) * (0.3 + stemBass * 0.7);
  float shockRadius = fract(uBarPhase + macroDrop * 0.35) * 1.4;
  float shock = ring(p, shockRadius, 45.0) * uShockwave * (macroDrop + uDownbeatHit * 0.6);
  float fakeoutCut = 1.0 - fakeout * smoothstep(0.1, 0.85, radius);

  vec3 col = uBackgroundColor.rgb * (0.55 + uEnergyLongTerm * 0.25);
  col += mix(uPrimaryColor.rgb, uSecondaryColor.rgb, uPhrase4Progress) * core * fakeoutCut;
  col += uAccentColor.rgb * inner * (0.2 + macroBuild * 0.8);
  col += mix(uAccentColor.rgb, uBrandImpact.rgb, macroDrop) * shock;
  col += uBrandImpact.rgb * (uSnareHit * 0.45 + uKickHit * 0.2);
  col *= 1.0 + drums * 0.12 + uHatHit * uHigh * 0.15;
  col *= uMasterIntensity * (0.75 + uMasterGlow * 0.28);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    {
      id: 'cellCount', type: 'integer', label: 'Cell Count', uniformName: 'uCellCount',
      min: 3, max: 24, step: 1, default: 10, modulatable: true,
    },
    {
      id: 'coreSize', type: 'float', label: 'Core Size', uniformName: 'uCoreSize',
      min: 0.1, max: 1.1, step: 0.01, default: 0.52, modulatable: true,
    },
    {
      id: 'spin', type: 'float', label: 'Phrase Spin', uniformName: 'uSpin',
      min: -4, max: 4, step: 0.05, default: 1.2, modulatable: true,
    },
    {
      id: 'shockwave', type: 'float', label: 'Shockwave', uniformName: 'uShockwave',
      min: 0, max: 3, step: 0.05, default: 1.4, modulatable: true,
    },
    {
      id: 'primaryColor', type: 'color', label: 'Core', uniformName: 'uPrimaryColor',
      brandRole: 'primary', default: [0.0, 0.9, 1.0, 1],
    },
    {
      id: 'secondaryColor', type: 'color', label: 'Orbit', uniformName: 'uSecondaryColor',
      brandRole: 'secondary', default: [0.45, 0.12, 1.0, 1],
    },
    {
      id: 'accentColor', type: 'color', label: 'Impact', uniformName: 'uAccentColor',
      brandRole: 'accent', default: [1.0, 0.08, 0.55, 1],
    },
    {
      id: 'backgroundColor', type: 'color', label: 'Background', uniformName: 'uBackgroundColor',
      brandRole: 'background', default: [0.008, 0.005, 0.02, 1],
    },
  ],

  defaults: {
    cellCount: 10,
    coreSize: 0.52,
    spin: 1.2,
    shockwave: 1.4,
    primaryColor: [0.0, 0.9, 1.0, 1],
    secondaryColor: [0.45, 0.12, 1.0, 1],
    accentColor: [1.0, 0.08, 0.55, 1],
    backgroundColor: [0.008, 0.005, 0.02, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  thumbnail: { color: '#18051f' },
  tags: ['build', 'drop', 'fakeout', 'stems', 'phrases', 'semantic', 'internal'],
}

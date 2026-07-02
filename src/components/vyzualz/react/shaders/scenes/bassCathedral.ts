import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const BASS_CATHEDRAL: ShaderDefinition = {
  id: 'shader-bass-cathedral',
  name: 'Bass Cathedral',
  description: 'A monumental industrial nave of pistons, ribs, speaker arches, sparks, and drop-driven structural ruptures.',
  category: 'raymarch',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uArchDensity;
uniform float uDepthSpeed;
uniform float uRibThickness;
uniform float uRupture;
uniform float uSparkDensity;
uniform vec4 uStructureColor;
uniform vec4 uEdgeColor;
uniform vec4 uSparkColor;
uniform vec4 uVoidColor;

out vec4 fragColor;

float lineGlow(float distanceValue, float width) {
  return exp(-abs(distanceValue) * max(1.0, width));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float stemBass = mix(uBass, max(uBass, uBassStemEnergy), uHasStems);
  float drums = mix(uTransient, max(uDrumEnergy, uDrumStemTransient), uHasStems);
  float guitar = mix(uMid, uInstrumentEnergy, uHasStems);
  float sectionOpen = smoothstep(0.12, 0.95, music.drop + uSectionChangePulse * 0.45);
  float buildClamp = music.build * (1.0 - music.fakeout * 0.75);
  float cameraTime = uPlaybackTime * uDepthSpeed * uMasterMotion
    + uPhrase32Progress * 5.0 + uBarIndex * 0.025;

  float perspective = 1.0 / max(0.28, 1.42 - abs(p.y) * 0.7);
  vec2 q = vec2(p.x * perspective, p.y);
  q.x *= 1.0 + stemBass * uMasterBassReactivity * 0.11;
  q.x += waveformAt(fract(uv.y + uPhrase8Progress * 0.2)) * 0.035 * (0.3 + music.micro);

  float depthCell = fract(cameraTime + log(max(0.03, abs(q.y) + 0.06)) * 1.7);
  float depthFade = pow(1.0 - depthCell, 1.8);
  float ribPhase = q.x * uArchDensity + floor(cameraTime) * 0.35;
  float ribs = lineGlow(abs(fract(ribPhase) - 0.5) - uRibThickness, 95.0);

  float archRadius = 0.52 + depthCell * 0.55 + buildClamp * 0.12;
  float archShape = abs(length(vec2(q.x, max(0.0, q.y + 0.54))) - archRadius);
  float arches = lineGlow(archShape, 58.0 + uLowMid * 25.0) * depthFade;

  float pillarSpacing = max(3.0, floor(uArchDensity * 0.55));
  float pillarCell = abs(fract((q.x + 1.4) * pillarSpacing * 0.5) - 0.5);
  float pillars = lineGlow(pillarCell - 0.12, 80.0)
    * (1.0 - smoothstep(-0.1, 0.8, abs(q.y + 0.05)));

  float piston = lineGlow(abs(q.x) - (0.22 + 0.08 * sin(uBeatPhase * SHADER_TAU)), 70.0)
    * lineGlow(q.y + 0.36 + uKickHit * 0.18, 38.0);
  float speaker = lineGlow(length(q * vec2(1.0, 1.35)) - (0.19 + stemBass * 0.08), 65.0)
    * (0.35 + spectrumAt(length(q) * 0.5) * 0.9);

  float ruptureWave = lineGlow(length(q) - fract(uBarPhase + music.drop * 0.27) * 1.35, 42.0)
    * (music.drop + uDownbeatHit * 0.65) * uRupture;
  float snareBlade = lineGlow(q.y - (uSnareHit * 0.12), 120.0) * uSnareHit;

  vec2 sparkGrid = floor((q + vec2(cameraTime * 0.03, 0.0)) * vec2(28.0, 18.0));
  float sparkSeed = hash21(sparkGrid + floor(uBeatIndex));
  float sparks = step(1.0 - uSparkDensity * (0.05 + drums * 0.2), sparkSeed)
    * lineGlow(fract((q.y + sparkSeed + uTime * (1.2 + uHigh * 2.0)) * 9.0) - 0.5, 40.0)
    * (0.25 + uHatHit + uSpectralFlux * 0.5);

  float fakeoutVoid = mix(1.0, 0.16 + speaker * 0.35, music.fakeout);
  float structure = (arches * 1.2 + ribs * 0.55 + pillars * 0.72 + piston * 0.6) * fakeoutVoid;
  float spectralMetal = 0.65 + uSpectralFlatness * 0.22 + uComplexity * 0.18;
  vec3 col = mix(uVoidColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.5 + uEnergyLongTerm * 0.26);
  col += mix(uStructureColor.rgb, uEdgeColor.rgb, depthCell) * structure * spectralMetal;
  col += uEdgeColor.rgb * speaker * (0.3 + stemBass * 1.1);
  col += mix(uSparkColor.rgb, uBrandAccent.rgb, uBrandEnabled) * sparks;
  col += mix(uSparkColor.rgb, uBrandImpact.rgb, music.drop) * ruptureWave;
  col += uBrandImpact.rgb * snareBlade * (0.75 + guitar * 0.35);
  col += uStructureColor.rgb * sectionOpen * lineGlow(abs(q.x) - 0.75, 28.0) * 0.3;
  col = applyBrandAtmosphere(col, uv, 0.12 + music.expression * 0.12);
  col *= (0.78 + music.macro * 0.5 + music.rhythm * 0.18 + music.confidence * 0.08);
  col *= uMasterIntensity * (0.72 + uMasterGlow * 0.3);
  col *= 1.0 - dot(p * 0.27, p * 0.27);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    { id: 'archDensity', type: 'float', label: 'Arch Density', group: 'Structure', uniformName: 'uArchDensity', min: 4, max: 24, step: 0.5, default: 12, modulatable: true },
    { id: 'depthSpeed', type: 'float', label: 'Depth Speed', group: 'Motion', uniformName: 'uDepthSpeed', min: 0.03, max: 1.5, step: 0.01, default: 0.34, modulatable: true },
    { id: 'ribThickness', type: 'float', label: 'Rib Thickness', group: 'Structure', uniformName: 'uRibThickness', min: 0.02, max: 0.32, step: 0.01, default: 0.11, modulatable: true },
    { id: 'rupture', type: 'float', label: 'Drop Rupture', group: 'Impact', uniformName: 'uRupture', min: 0, max: 3, step: 0.05, default: 1.35, modulatable: true },
    { id: 'sparkDensity', type: 'float', label: 'Spark Density', group: 'Atmosphere', uniformName: 'uSparkDensity', min: 0, max: 1, step: 0.01, default: 0.48, modulatable: true },
    { id: 'structureColor', type: 'color', label: 'Structure', group: 'Color', uniformName: 'uStructureColor', brandRole: 'primary', default: [0.72, 0.04, 0.02, 1] },
    { id: 'edgeColor', type: 'color', label: 'Edge Light', group: 'Color', uniformName: 'uEdgeColor', brandRole: 'secondary', default: [1, 0.12, 0.025, 1] },
    { id: 'sparkColor', type: 'color', label: 'Sparks', group: 'Color', uniformName: 'uSparkColor', brandRole: 'accent', default: [1, 0.52, 0.08, 1] },
    { id: 'voidColor', type: 'color', label: 'Void', group: 'Color', uniformName: 'uVoidColor', brandRole: 'background', default: [0.004, 0.002, 0.002, 1] },
  ],

  defaults: {
    archDensity: 12,
    depthSpeed: 0.34,
    ribThickness: 0.11,
    rupture: 1.35,
    sparkDensity: 0.48,
    structureColor: [0.72, 0.04, 0.02, 1],
    edgeColor: [1, 0.12, 0.025, 1],
    sparkColor: [1, 0.52, 0.08, 1],
    voidColor: [0.004, 0.002, 0.002, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', rayMarchSteps: { min: 32, recommended: 64, max: 96 }, estimatedPassCount: 1 },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['flash-cut', 'feedback-collapse', 'zoom-tunnel', 'luma-dissolve'] },
  thumbnail: { color: '#250604' },
  tags: ['dubstep', 'heavy', 'industrial', 'cathedral', 'stems', 'semantic', 'brand-kit'],
}

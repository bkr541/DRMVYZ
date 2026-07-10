import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const RIDDIM_RAILGUN_SEQUENCER: ShaderDefinition = {
  id: 'shader-riddim-railgun-sequencer',
  name: 'Riddim Railgun Sequencer',
  description: 'A deterministic machine-grid sequencer that converts beat, bar, phrase, kick, snare, and fakeout structure into spatial firing patterns.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uRailCount;
uniform float uSequenceLength;
uniform float uRecoil;
uniform float uPerspective;
uniform float uChargeGlow;
uniform vec4 uRailColor;
uniform vec4 uChargeColor;
uniform vec4 uFireColor;
uniform vec4 uBackgroundColor;

out vec4 fragColor;

float beam(float value, float width) {
  return exp(-abs(value) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float rails = max(4.0, floor(uRailCount));
  float sequenceLength = max(4.0, floor(uSequenceLength));
  float sequenceStep = mod(floor(uBeatIndex), sequenceLength);
  float barPattern = mod(floor(uBarIndex), 8.0);
  float phraseBank = mod(floor(uPhrase16Progress * 8.0) + floor(uPhrase32Progress * 4.0), 6.0);
  float activeRail = mod(sequenceStep * (1.0 + mod(barPattern, 3.0)) + phraseBank * 2.0, rails);
  float responseRail = mod(rails - 1.0 - activeRail + floor(uBeatInBar), rails);

  float z = uPlaybackTime * (0.55 + uBass * 0.45) * uMasterMotion;
  vec2 q = p;
  q.y /= max(0.28, 1.0 - abs(q.x) * uPerspective * 0.22);
  float recoil = (uKickHit + uBassStemTransient * uHasStems) * uRecoil;
  q.y += recoil * (0.16 + abs(q.x) * 0.06);
  q.x += waveformAt(fract(uv.y + sequenceStep / sequenceLength)) * 0.025 * music.micro;

  float railUv = (q.x * 0.5 + 0.5) * rails;
  float railId = floor(railUv);
  float railLocal = fract(railUv) - 0.5;
  float lane = beam(abs(railLocal) - 0.12, 78.0);
  float activeRailMask = 1.0 - step(0.45, abs(railId - activeRail));
  float response = 1.0 - step(0.45, abs(railId - responseRail));

  float depthGrid = beam(fract((q.y + z) * (7.0 + uPerspective * 4.0)) - 0.5, 52.0);
  float chassis = lane * (0.18 + depthGrid * 0.82);
  float charge = activeRailMask * lane * beam(fract(q.y * 2.5 - uBarPhase) - 0.5, 34.0)
    * (0.25 + music.build * uChargeGlow + music.fakeout * 0.9);
  float forwardFire = activeRailMask * lane * beam(q.y - (-0.8 + uBeatPhase * 1.8), 95.0)
    * (uKickHit + uBeatHit * 0.25 + uBassStemTransient * uHasStems);
  float sideFire = response * beam(q.y, 90.0) * beam(abs(railLocal) - 0.28, 55.0)
    * (uSnareHit + uDrumStemTransient * uHasStems * 0.45);
  float hatTracer = lane * beam(fract((q.y - z * 1.7) * 24.0) - 0.5, 78.0)
    * (uHatHit + uHigh * 0.16);

  float selector = mod(sequenceStep + barPattern + phraseBank, 4.0);
  float diagonal = beam(fract((q.x + q.y * mix(-1.0, 1.0, step(2.0, selector))) * 7.0) - 0.5, 58.0)
    * (0.08 + uEnergy * 0.18 + uPhrase4Hit * 0.45);
  float muzzle = beam(length(q - vec2((activeRail + 0.5) / rails * 2.0 - 1.0, 0.72)) - 0.12, 68.0)
    * (music.drop + uDownbeatHit * 0.55);
  float fakeoutHold = mix(1.0, 0.22 + charge * 0.65, music.fakeout);
  float sectionReset = uSectionStartPulse + uSectionChangePulse;

  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.5 + uEnergyLongTerm * 0.18);
  col += mix(uRailColor.rgb, uBrandPrimary.rgb, uBrandEnabled) * chassis * fakeoutHold;
  col += mix(uChargeColor.rgb, uBrandSecondary.rgb, uBrandEnabled) * charge;
  col += mix(uFireColor.rgb, uBrandImpact.rgb, music.drop) * (forwardFire + sideFire + muzzle * 1.25);
  col += uChargeColor.rgb * (hatTracer * 0.28 + diagonal * 0.42);
  col += uBrandHighlight.rgb * sectionReset * depthGrid * 0.24;
  col = applyBrandAtmosphere(col, uv, 0.08 + music.expression * 0.08);
  col *= 0.76 + music.micro * 0.32 + music.rhythm * 0.46 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.78 + uMasterGlow * 0.27);
  col *= 1.0 - dot(p * 0.22, p * 0.22);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    { id: 'railCount', type: 'integer', label: 'Rail Count', group: 'Sequencer', uniformName: 'uRailCount', min: 4, max: 24, step: 1, default: 12, modulatable: true },
    { id: 'sequenceLength', type: 'integer', label: 'Sequence Length', group: 'Sequencer', uniformName: 'uSequenceLength', min: 4, max: 32, step: 1, default: 16, modulatable: true },
    { id: 'recoil', type: 'float', label: 'Recoil', group: 'Impact', uniformName: 'uRecoil', min: 0, max: 3, step: 0.05, default: 1.25, modulatable: true },
    { id: 'perspective', type: 'float', label: 'Perspective', group: 'Stage', uniformName: 'uPerspective', min: 0, max: 3, step: 0.05, default: 1.35, modulatable: true },
    { id: 'chargeGlow', type: 'float', label: 'Charge Glow', group: 'Build', uniformName: 'uChargeGlow', min: 0, max: 3, step: 0.05, default: 1.4, modulatable: true },
    { id: 'railColor', type: 'color', label: 'Rails', group: 'Color', uniformName: 'uRailColor', brandRole: 'primary', default: [0.2, 0.95, 0.06, 1] },
    { id: 'chargeColor', type: 'color', label: 'Charge', group: 'Color', uniformName: 'uChargeColor', brandRole: 'secondary', default: [0.62, 0.06, 1, 1] },
    { id: 'fireColor', type: 'color', label: 'Fire', group: 'Color', uniformName: 'uFireColor', brandRole: 'accent', default: [1, 0.42, 0.03, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Machine Void', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.004, 0.009, 0.004, 1] },
  ],

  defaults: {
    railCount: 12,
    sequenceLength: 16,
    recoil: 1.25,
    perspective: 1.35,
    chargeGlow: 1.4,
    railColor: [0.2, 0.95, 0.06, 1],
    chargeColor: [0.62, 0.06, 1, 1],
    fireColor: [1, 0.42, 0.03, 1],
    backgroundColor: [0.004, 0.009, 0.004, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['flash-cut', 'pixel-scatter', 'feedback-collapse', 'radial-wipe'] },
  thumbnail: { color: '#0a1d06' },
  tags: ['riddim', 'uk-dubstep', 'sequencer', 'beat-grid', 'phrases', 'fakeout', 'brand-kit'],
}

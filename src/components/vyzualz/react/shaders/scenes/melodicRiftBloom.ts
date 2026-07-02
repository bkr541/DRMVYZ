import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const MELODIC_RIFT_BLOOM: ShaderDefinition = {
  id: 'shader-melodic-rift-bloom',
  name: 'Melodic Rift Bloom',
  description: 'A cinematic rift of aurora ribbons, crystalline petals, embers, and lyric-driven light for emotional melodic-bass peaks.',
  category: 'generator',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uPetalCount;
uniform float uRiftWidth;
uniform float uBloomSpread;
uniform float uAuroraFlow;
uniform float uEmberDensity;
uniform vec4 uRiftColor;
uniform vec4 uPetalColor;
uniform vec4 uAuroraColor;
uniform vec4 uBackgroundColor;

out vec4 fragColor;

float glowLine(float value, float width) {
  return exp(-abs(value) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float harmonic = uHasHarmonics * (uChordConfidence * 0.45 + uKeyConfidence * 0.25 + uPitchNormalized * 0.3);
  float vocal = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float lyric = uHasLyrics * max(uLyricActivity, max(uLyricLineEnter, uLyricWordHit));
  float horizon = -0.32 + uMelodyHeight * uHasHarmonics * 0.28 + music.build * 0.18;
  float phraseRotation = (uPhrase16Progress - 0.5) * 0.32 + uPhrase32Progress * 0.18;
  vec2 q = rotate2d(phraseRotation) * vec2(p.x, p.y - horizon);

  float waveform = waveformAt(fract(uv.x + uLyricLineProgress * 0.12));
  float riftDist = abs(q.x + waveform * 0.06 * uAuroraFlow);
  float rift = glowLine(riftDist - uRiftWidth * (0.16 + uBass * 0.06), 62.0);
  float core = exp(-riftDist * (8.0 - music.build * 3.5))
    * smoothstep(-1.0, 0.2, q.y) * (0.2 + vocal * 0.65 + music.build * 0.45);

  float angle = atan(q.y, q.x);
  float radius = length(q);
  float petals = max(4.0, floor(uPetalCount));
  float petalPhase = abs(sin(angle * petals * 0.5 + uPhrase8Progress * SHADER_TAU));
  float petalRadius = 0.24 + petalPhase * uBloomSpread * (0.32 + music.drop * 0.35);
  float petal = glowLine(radius - petalRadius, 52.0 - uSpectralSpread * 16.0)
    * (1.0 - smoothstep(0.0, 0.95, radius)) * (0.35 + spectrumAt(fract(angle / SHADER_TAU + 0.5)) * 0.75);

  float shardAngle = abs(sin(angle * (petals * 1.5 + 2.0) + uChordCode * 0.07));
  float shards = glowLine(shardAngle - 0.92, 42.0)
    * glowLine(radius - (0.3 + uPhrase4Progress * 0.55), 28.0)
    * (uSnareHit + uChordChangeHit * uHasHarmonics + music.drop * 0.35);

  float auroraY = q.y - 0.25 - sin(q.x * (2.4 + uSpectralCentroid * 3.0) + uTime * 0.35 * uMasterMotion) * 0.16;
  float aurora = glowLine(auroraY + waveform * 0.08, 24.0)
    * (1.0 - smoothstep(0.0, 1.25, abs(q.x))) * (0.22 + harmonic * 0.55 + music.expression * 0.3);
  float lyricRibbon = glowLine(q.y - (uLyricLineProgress * 1.4 - 0.7), 45.0)
    * lyric * (0.35 + uLyricWordProgress * 0.65);

  vec2 emberCell = floor((p + vec2(uTime * 0.035, -uTime * 0.11)) * vec2(42.0, 30.0));
  float emberSeed = hash21(emberCell + floor(uBarIndex));
  float embers = step(1.0 - uEmberDensity * (0.04 + uMasterParticleDensity * 0.08), emberSeed)
    * glowLine(fract((p.y + emberSeed + uTime * (0.25 + emberSeed)) * 10.0) - 0.5, 34.0)
    * (0.15 + uHigh * 0.25 + uHatHit * 0.55);

  float dropBloom = glowLine(radius - fract(uBarPhase + music.drop * 0.38) * 1.35, 36.0)
    * (music.drop + uDownbeatHit * 0.45);
  float fakeoutDim = mix(1.0, 0.28 + rift * 0.35, music.fakeout);
  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.52 + uEnergyLongTerm * 0.22);
  col += mix(uRiftColor.rgb, uBrandHighlight.rgb, uBrandEnabled) * (rift * 1.15 + core * 0.75);
  col += mix(uPetalColor.rgb, uAuroraColor.rgb, harmonic) * petal * fakeoutDim;
  col += uPetalColor.rgb * shards * 0.9;
  col += mix(uAuroraColor.rgb, uBrandAccent.rgb, uBrandEnabled) * (aurora + lyricRibbon * 0.7);
  col += uAuroraColor.rgb * embers * 0.55;
  col += mix(uPetalColor.rgb, uBrandImpact.rgb, music.drop) * dropBloom * 1.2;
  col += uBrandImpact.rgb * uSnareHit * rift * 0.45;
  col = applyBrandAtmosphere(col, uv, 0.14 + music.expression * 0.14);
  col *= 0.74 + music.micro * 0.24 + music.expression * 0.5 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.75 + uMasterGlow * 0.31);
  col *= 1.0 - dot(p * 0.24, p * 0.24);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    { id: 'petalCount', type: 'integer', label: 'Petal Count', group: 'Bloom', uniformName: 'uPetalCount', min: 4, max: 24, step: 1, default: 12, modulatable: true },
    { id: 'riftWidth', type: 'float', label: 'Rift Width', group: 'Rift', uniformName: 'uRiftWidth', min: 0.1, max: 1.2, step: 0.01, default: 0.42, modulatable: true },
    { id: 'bloomSpread', type: 'float', label: 'Bloom Spread', group: 'Bloom', uniformName: 'uBloomSpread', min: 0.2, max: 2.2, step: 0.05, default: 1.15, modulatable: true },
    { id: 'auroraFlow', type: 'float', label: 'Aurora Flow', group: 'Motion', uniformName: 'uAuroraFlow', min: 0, max: 2.5, step: 0.05, default: 1, modulatable: true },
    { id: 'emberDensity', type: 'float', label: 'Ember Density', group: 'Atmosphere', uniformName: 'uEmberDensity', min: 0, max: 1, step: 0.01, default: 0.45, modulatable: true },
    { id: 'riftColor', type: 'color', label: 'Rift Core', group: 'Color', uniformName: 'uRiftColor', brandRole: 'highlight', default: [1, 0.72, 0.48, 1] },
    { id: 'petalColor', type: 'color', label: 'Petals', group: 'Color', uniformName: 'uPetalColor', brandRole: 'primary', default: [0.62, 0.18, 1, 1] },
    { id: 'auroraColor', type: 'color', label: 'Aurora', group: 'Color', uniformName: 'uAuroraColor', brandRole: 'secondary', default: [0.08, 0.72, 1, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Sky', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.008, 0.008, 0.03, 1] },
  ],

  defaults: {
    petalCount: 12,
    riftWidth: 0.42,
    bloomSpread: 1.15,
    auroraFlow: 1,
    emberDensity: 0.45,
    riftColor: [1, 0.72, 0.48, 1],
    petalColor: [0.62, 0.18, 1, 1],
    auroraColor: [0.08, 0.72, 1, 1],
    backgroundColor: [0.008, 0.008, 0.03, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['luma-dissolve', 'liquid-melt', 'flash-cut', 'radial-wipe'] },
  thumbnail: { color: '#160d39' },
  tags: ['melodic-dubstep', 'cinematic', 'rift', 'harmonics', 'vocals', 'lyrics', 'brand-kit'],
}

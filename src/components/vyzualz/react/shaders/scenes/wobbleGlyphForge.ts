import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

export const WOBBLE_GLYPH_FORGE: ShaderDefinition = {
  id: 'shader-wobble-glyph-forge',
  name: 'Wobble Glyph Forge',
  description: 'A living audio-forged glyph whose silhouette, teeth, face, and topology mutate from waveform, spectrum, vocals, and phrases.',
  category: 'fractal',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uSymmetry;
uniform float uBodyScale;
uniform float uWobble;
uniform float uDetail;
uniform float uLogoBlend;
uniform vec4 uBodyColor;
uniform vec4 uDetailColor;
uniform vec4 uEyeColor;
uniform vec4 uBackgroundColor;

out vec4 fragColor;

float ring(float distanceValue, float radius, float width) {
  return exp(-abs(distanceValue - radius) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float vocal = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float topology = floor(uPhrase32Progress * 4.0) + floor(uSectionType + 0.5);
  float phraseMorph = uPhrase8Progress + uPhrase16Progress * 0.5;
  float rotation = (uMelodyContourCode - 1.5) * 0.08 * uHasHarmonics
    + sin(uPhrase4Progress * SHADER_TAU) * 0.12 + uTime * 0.03 * uMasterMotion;
  p = rotate2d(rotation) * p;
  p /= uBodyScale * (1.0 + uSub * uMasterBassReactivity * 0.16 + uKickHit * 0.08);

  float angle = atan(p.y, p.x);
  float radius = length(p);
  float symmetry = max(3.0, floor(uSymmetry + mod(topology, 4.0)));
  float folded = abs(mod(angle + SHADER_PI / symmetry, SHADER_TAU / symmetry) - SHADER_PI / symmetry);
  float wave = waveformAt(fract(angle / SHADER_TAU + 0.5));
  float spectrum = spectrumAt(fract(folded / (SHADER_PI / symmetry)));
  float wobble = wave * uWobble * (0.08 + uLowMid * 0.12);
  float teeth = sin(folded * symmetry * (4.0 + floor(uDetail * 3.0)) + phraseMorph * SHADER_TAU);
  float bodyRadius = 0.46 + wobble + spectrum * 0.16 + teeth * 0.035 * uDetail;
  bodyRadius *= 1.0 + sin(angle * 2.0 + topology) * 0.08;

  float body = (1.0 - smoothstep(-0.018, 0.035, radius - bodyRadius));
  float edge = exp(-abs(radius - bodyRadius) * (65.0 + uHigh * 25.0));
  float innerRing = ring(radius, 0.24 + uBass * 0.06, 75.0);

  vec2 faceP = p;
  faceP.x = abs(faceP.x);
  float eyeY = 0.1 + uPitchNormalized * 0.12 * uHasHarmonics;
  float eye = exp(-length((faceP - vec2(0.14, eyeY)) * vec2(1.0, 1.25)) * 32.0);
  float pupil = exp(-length((faceP - vec2(0.14, eyeY)) * vec2(1.0, 1.25)) * 74.0);
  float mouthWidth = 0.22 + vocal * 0.13;
  float mouthCurve = abs(p.y + 0.15 + cos(p.x * 8.0) * (0.025 + uLyricWordProgress * 0.04));
  float mouth = exp(-mouthCurve * 85.0) * (1.0 - smoothstep(mouthWidth - 0.06, mouthWidth, abs(p.x)));
  mouth *= 0.25 + vocal * 0.9 + uLyricWordHit * uHasLyrics;

  float logo = brandLogoMask(p * (1.05 + uLogoBlend * 0.2));
  float logoContour = abs(dFdx(logo)) + abs(dFdy(logo));
  float logoMix = uLogoBlend * uBrandLogoAvailable * uBrandEnabled;
  float silhouette = mix(body, max(body * 0.35, logo), logoMix);
  float silhouetteEdge = mix(edge, max(edge * 0.3, logoContour * 7.0), logoMix);

  float ornaments = exp(-abs(sin(angle * symmetry * 2.0 + phraseMorph * SHADER_TAU)) * 5.0)
    * ring(radius, bodyRadius + 0.08 + spectrum * 0.08, 42.0) * uDetail;
  float splitFlash = exp(-abs(p.x) * 75.0) * uSnareHit;
  float phrasePulse = ring(radius, fract(uPhrase4Progress + uPhrase4Hit * 0.25) * 0.9, 48.0);
  float lyricAura = uHasLyrics * (uLyricLineEnter + uLyricLineExit + uLyricActivity * 0.25);

  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.5 + uEnergyLongTerm * 0.2);
  col += mix(uBodyColor.rgb, uDetailColor.rgb, spectrum) * silhouette * (0.4 + music.macro * 0.5);
  col += uDetailColor.rgb * (silhouetteEdge * 1.2 + ornaments * 0.65 + innerRing * 0.28);
  col += mix(uEyeColor.rgb, uBrandHighlight.rgb, uBrandEnabled) * (eye * 0.55 + pupil * 1.2 + mouth * 0.7);
  col += uEyeColor.rgb * phrasePulse * (0.16 + music.rhythm * 0.32);
  col += uBrandImpact.rgb * splitFlash * 0.75;
  col += mix(uDetailColor.rgb, uBrandAccent.rgb, uBrandEnabled) * lyricAura * edge * 0.28;
  col = applyBrandAtmosphere(col, uv, 0.1 + music.expression * 0.16);
  col *= 0.74 + music.micro * 0.36 + music.expression * 0.34 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.76 + uMasterGlow * 0.3);
  col *= 1.0 - dot(p * 0.22, p * 0.22);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    { id: 'symmetry', type: 'integer', label: 'Symmetry', group: 'Glyph', uniformName: 'uSymmetry', min: 3, max: 16, step: 1, default: 7, modulatable: true },
    { id: 'bodyScale', type: 'float', label: 'Body Scale', group: 'Glyph', uniformName: 'uBodyScale', min: 0.45, max: 1.6, step: 0.01, default: 1, modulatable: true },
    { id: 'wobble', type: 'float', label: 'Waveform Wobble', group: 'Audio Shape', uniformName: 'uWobble', min: 0, max: 2.5, step: 0.05, default: 1.15, modulatable: true },
    { id: 'detail', type: 'float', label: 'Ornament Detail', group: 'Glyph', uniformName: 'uDetail', min: 0, max: 2, step: 0.05, default: 1.05, modulatable: true },
    { id: 'logoBlend', type: 'float', label: 'Brand Logo Blend', group: 'Brand', uniformName: 'uLogoBlend', min: 0, max: 1, step: 0.01, default: 0.45, modulatable: true },
    { id: 'bodyColor', type: 'color', label: 'Body', group: 'Color', uniformName: 'uBodyColor', brandRole: 'primary', default: [0.08, 0.92, 0.55, 1] },
    { id: 'detailColor', type: 'color', label: 'Detail', group: 'Color', uniformName: 'uDetailColor', brandRole: 'secondary', default: [0.56, 0.08, 1, 1] },
    { id: 'eyeColor', type: 'color', label: 'Core', group: 'Color', uniformName: 'uEyeColor', brandRole: 'accent', default: [0.08, 1, 0.95, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Background', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.003, 0.012, 0.012, 1] },
  ],

  defaults: {
    symmetry: 7,
    bodyScale: 1,
    wobble: 1.15,
    detail: 1.05,
    logoBlend: 0.45,
    bodyColor: [0.08, 0.92, 0.55, 1],
    detailColor: [0.56, 0.08, 1, 1],
    eyeColor: [0.08, 1, 0.95, 1],
    backgroundColor: [0.003, 0.012, 0.012, 1],
  },

  quality: { minimumTier: 'low', recommendedTier: 'medium', iterationLimit: { min: 8, recommended: 16, max: 24 }, estimatedPassCount: 1 },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['liquid-melt', 'luma-dissolve', 'rgb-split-dissolve', 'flash-cut'] },
  thumbnail: { color: '#041c18' },
  tags: ['uk-dubstep', 'wobble', 'glyph', 'waveform', 'spectrum', 'lyrics', 'brand-logo'],
}

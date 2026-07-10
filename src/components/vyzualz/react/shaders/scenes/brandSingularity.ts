import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

const BRAND_CORE = `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform sampler2D uUserMedia;
uniform float uUserMediaAvailable;
uniform sampler2D uAlbumArtwork;
uniform float uAlbumArtworkAvailable;
uniform sampler2D uMediaOutput;
uniform float uMediaOutputAvailable;

uniform float uCoreScale;
uniform float uFragmentCount;
uniform float uRefraction;
uniform float uOrbitSpeed;
uniform float uEchoAmount;
uniform vec4 uCoreColor;
uniform vec4 uOrbitColor;
uniform vec4 uBurstColor;
uniform vec4 uBackgroundColor;
out vec4 fragColor;

float ring(float value, float radius, float width) {
  return exp(-abs(value - radius) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float bass = mix(uBass, max(uBass, uBassStemEnergy), uHasStems);
  float vocal = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float logo = brandLogoMask(p / max(0.2, uCoreScale * (1.0 + bass * 0.14)));
  float logoEdge = (abs(dFdx(logo)) + abs(dFdy(logo))) * 7.0;
  float fallbackCore = exp(-length(p) * 5.0);
  float emblem = mix(fallbackCore, logo, uBrandLogoAvailable * uBrandEnabled);

  float angle = atan(p.y, p.x);
  float radius = length(p);
  float waveform = waveformAt(fract(angle / SHADER_TAU + 0.5));
  float spectrum = spectrumAt(fract(radius * 0.65 + angle / SHADER_TAU));
  float refractedRadius = radius + waveform * uRefraction * (0.03 + bass * 0.08);
  float orbitAngle = angle + uTime * uOrbitSpeed * uMasterMotion
    + uPhrase32Progress * SHADER_TAU + uChordCode * 0.015 * uHasHarmonics;
  float fragments = max(6.0, floor(uFragmentCount));
  float sector = abs(fract(orbitAngle / SHADER_TAU * fragments) - 0.5);
  float fragmentMask = exp(-sector * (42.0 - uComplexity * 12.0))
    * ring(refractedRadius, 0.38 + spectrum * 0.36, 44.0);
  float orbit = ring(refractedRadius, 0.58 + music.build * 0.12, 54.0)
    * (0.25 + spectrum * 0.75);

  float lyricFill = uHasLyrics * (uLyricActivity * 0.35 + uLyricLineProgress * 0.25 + uLyricWordHit * 0.55);
  float vocalFill = vocal * (0.35 + uVocalHookConfidence * uHasSemantics * 0.65);
  float interior = emblem * (0.2 + vocalFill + lyricFill);
  float burst = ring(radius, fract(uBarPhase + music.drop * 0.42) * 1.35, 42.0)
    * (music.drop + uDownbeatHit * 0.5 + uSectionChangePulse * 0.35);
  float reconstruction = logoEdge * (uSnareHit + uChordChangeHit * uHasHarmonics * 0.4);
  float fragmentsOut = fragmentMask * (0.3 + uKickHit * 0.8 + music.drop * 0.65);

  vec3 media = vec3(0.0);
  float mediaWeight = uUserMediaAvailable + uAlbumArtworkAvailable + uMediaOutputAvailable;
  if (mediaWeight > 0.0) {
    media = (
      texture(uUserMedia, uv).rgb * uUserMediaAvailable
      + texture(uAlbumArtwork, uv).rgb * uAlbumArtworkAvailable
      + texture(uMediaOutput, uv).rgb * uMediaOutputAvailable
    ) / mediaWeight;
  }

  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.5 + uEnergyLongTerm * 0.2);
  col = mix(col, media, clamp(mediaWeight, 0.0, 1.0) * (0.06 + music.expression * 0.12));
  col += mix(uCoreColor.rgb, uBrandPrimary.rgb, uBrandEnabled) * (emblem * 0.65 + interior * 0.75);
  col += mix(uOrbitColor.rgb, uBrandSecondary.rgb, uBrandEnabled) * (orbit + fragmentsOut);
  col += mix(uBurstColor.rgb, uBrandAccent.rgb, uBrandEnabled) * reconstruction;
  col += mix(uBurstColor.rgb, uBrandImpact.rgb, music.drop) * burst * 1.25;
  col += uBrandHighlight.rgb * logoEdge * (0.2 + uSnareHit * 0.55);
  col = applyBrandAtmosphere(col, uv, 0.18 + music.expression * 0.16);
  col *= 0.74 + music.micro * 0.3 + music.expression * 0.42 + music.macro * 0.2 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.75 + uMasterGlow * 0.31);
  fragColor = vec4(max(col, 0.0), 1.0);
}
`

const BRAND_ECHO = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uPreviousBrand;
uniform sampler2D uFreshBrand;
uniform float uEchoAmount;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uPhrase8Progress;
uniform float uMasterTrailDecay;
uniform float uMasterMotion;
out vec4 fragColor;

void main() {
  vec2 p = v_uv - 0.5;
  float angle = (uPhrase8Progress - 0.5) * 0.006 * uMasterMotion + uSnareHit * 0.012;
  float c = cos(angle);
  float s = sin(angle);
  p = mat2(c, -s, s, c) * p;
  p *= 0.994 - uKickHit * 0.016;
  vec3 previous = texture(uPreviousBrand, clamp(p + 0.5, 0.001, 0.999)).rgb;
  vec3 fresh = texture(uFreshBrand, v_uv).rgb;
  float retention = clamp(uEchoAmount * (1.0 - uMasterTrailDecay), 0.0, 0.985);
  fragColor = vec4(max(fresh, previous * retention), 1.0);
}
`

const BRAND_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uBrandHistory;
uniform sampler2D uFreshBrand;
uniform float uSnareHit;
uniform float uDropImpact;
uniform float uMasterIntensity;
uniform float uMasterGlow;
out vec4 fragColor;
void main() {
  vec3 history = texture(uBrandHistory, v_uv).rgb;
  vec3 fresh = texture(uFreshBrand, v_uv).rgb;
  vec3 col = history + fresh * (0.36 + uDropImpact * 0.24);
  col = mix(col, vec3(1.0), uSnareHit * 0.12);
  col *= uMasterIntensity * (0.76 + uMasterGlow * 0.26);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`

export const BRAND_SINGULARITY: ShaderDefinition = {
  id: 'shader-brand-singularity',
  name: 'Brand Singularity',
  description: 'A universal Brand Kit centerpiece that refracts logos, emits branded fragments, fills from vocals and lyrics, and bursts on drops.',
  category: 'feedback',
  version: 1,

  passes: [
    {
      id: 'core', fragSrc: BRAND_CORE,
      inputs: ['uUserMedia', 'uAlbumArtwork', 'uMediaOutput'],
      output: 'fresh-brand', resolutionScale: 1, clearBeforeRender: true,
    },
    {
      id: 'echo', fragSrc: BRAND_ECHO,
      inputs: [
        { source: 'brand-history', uniformName: 'uPreviousBrand' },
        { source: 'fresh-brand', uniformName: 'uFreshBrand' },
      ],
      output: 'brand-history', resolutionScale: 0.75, clearBeforeRender: false,
      pingPong: true, dependsOn: ['core'],
    },
    {
      id: 'composite', fragSrc: BRAND_COMPOSITE,
      inputs: [
        { source: 'brand-history', uniformName: 'uBrandHistory' },
        { source: 'fresh-brand', uniformName: 'uFreshBrand' },
      ],
      output: 'composite', resolutionScale: 1, clearBeforeRender: true, dependsOn: ['echo'],
    },
  ],

  params: [
    { id: 'coreScale', type: 'float', label: 'Core Scale', group: 'Brand', uniformName: 'uCoreScale', min: 0.25, max: 2, step: 0.01, default: 1, modulatable: true },
    { id: 'fragmentCount', type: 'integer', label: 'Fragment Count', group: 'Particles', uniformName: 'uFragmentCount', min: 6, max: 48, step: 1, default: 24, modulatable: true },
    { id: 'refraction', type: 'float', label: 'Audio Refraction', group: 'Distortion', uniformName: 'uRefraction', min: 0, max: 3, step: 0.05, default: 1.25, modulatable: true },
    { id: 'orbitSpeed', type: 'float', label: 'Orbit Speed', group: 'Motion', uniformName: 'uOrbitSpeed', min: -2, max: 2, step: 0.02, default: 0.18, modulatable: true },
    { id: 'echoAmount', type: 'float', label: 'Echo Amount', group: 'Feedback', uniformName: 'uEchoAmount', min: 0, max: 0.99, step: 0.01, default: 0.88, modulatable: true },
    { id: 'coreColor', type: 'color', label: 'Core', group: 'Color', uniformName: 'uCoreColor', brandRole: 'primary', default: [0.05, 0.62, 1, 1] },
    { id: 'orbitColor', type: 'color', label: 'Orbit', group: 'Color', uniformName: 'uOrbitColor', brandRole: 'secondary', default: [0.85, 0.06, 1, 1] },
    { id: 'burstColor', type: 'color', label: 'Burst', group: 'Color', uniformName: 'uBurstColor', brandRole: 'accent', default: [0.06, 1, 0.92, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Background', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.004, 0.006, 0.02, 1] },
  ],

  defaults: {
    coreScale: 1, fragmentCount: 24, refraction: 1.25, orbitSpeed: 0.18, echoAmount: 0.88,
    coreColor: [0.05, 0.62, 1, 1], orbitColor: [0.85, 0.06, 1, 1],
    burstColor: [0.06, 1, 0.92, 1], backgroundColor: [0.004, 0.006, 0.02, 1],
  },

  textureInputs: [
    { name: 'uUserMedia', label: 'User Media', source: 'uploaded-image', required: false },
    { name: 'uAlbumArtwork', label: 'Album Artwork', source: 'album-artwork', required: false },
    { name: 'uMediaOutput', label: 'Media Output', source: 'media-output', required: false },
  ],
  resetOnActivation: true,
  feedback: { pingPongBuffers: 1, historyFrames: 1 },
  feedbackReset: { onSceneChange: true, onTrackChange: true, onPlaybackRestart: true, onSectionChange: true, onDropImpact: false, onResolutionChange: true, onContextRestore: true },
  quality: { minimumTier: 'medium', recommendedTier: 'high', estimatedPassCount: 3, requiresPersistentBuffers: true },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['feedback-collapse', 'luma-dissolve', 'rgb-split-dissolve', 'flash-cut'] },
  thumbnail: { color: '#07102c' },
  tags: ['brand-kit', 'logo', 'feedback', 'media', 'lyrics', 'stems', 'universal', 'internal'],
}

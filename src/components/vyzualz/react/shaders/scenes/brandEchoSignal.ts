import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const BRAND_ECHO_SIGNAL: ShaderDefinition = {
  id: 'shader-brand-echo-signal',
  name: 'Brand Echo Signal',
  description: 'Waveform ribbons refract through Brand Kit artwork while lyrics and harmonic changes steer the echo field.',
  category: 'effect',
  version: 1,

  fragSrc: `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
uniform sampler2D uWaveformTexture;
uniform float uWaveformAvailable;
uniform sampler2D uBrandLogoTexture;
uniform float uBrandLogoAvailable;
uniform float uBrandLogoAspect;
uniform float uBrandLogoScale;
uniform float uBrandLogoOpacity;
uniform sampler2D uBrandTexture;
uniform float uBrandTextureAvailable;
uniform float uBrandTextureOpacity;
uniform sampler2D uBrandBackgroundTexture;
uniform float uBrandBackgroundAvailable;
uniform float uBrandBackgroundOpacity;

uniform sampler2D uUserMedia;
uniform float uUserMediaAvailable;
uniform sampler2D uAlbumArtwork;
uniform float uAlbumArtworkAvailable;
uniform sampler2D uMediaOutput;
uniform float uMediaOutputAvailable;

uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uBeatPhase;
uniform float uPhrase8Progress;
uniform float uChordChangeHit;
uniform float uPitchNormalized;
uniform float uLyricActivity;
uniform float uLyricLineProgress;
uniform float uLyricWordProgress;
uniform float uLyricWordHit;
uniform float uVocalHookConfidence;
uniform float uHasLyrics;
uniform float uHasHarmonics;

uniform float uRibbonCount;
uniform float uWaveAmount;
uniform float uEchoSpread;
uniform float uLogoRefraction;
uniform vec4 uCoreColor;
uniform vec4 uEchoColor;
uniform vec4 uBackgroundColor;

uniform vec4 uBrandHighlight;
uniform vec4 uBrandImpact;
uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterGlow;
uniform float uMasterBassReactivity;

out vec4 fragColor;

float wave(float x) {
  if (uWaveformAvailable < 0.5) return sin((x + uTime * 0.1) * 18.0) * 0.18;
  return texture(uWaveformTexture, vec2(clamp(x, 0.0, 1.0), 0.5)).r * 2.0 - 1.0;
}

float logoMask(vec2 p) {
  if (uBrandLogoAvailable < 0.5) return exp(-dot(p, p) * 4.0);
  vec2 uv = p / max(0.05, uBrandLogoScale) * 0.5 + 0.5;
  uv.x = (uv.x - 0.5) / max(0.1, uBrandLogoAspect) + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  vec4 logo = texture(uBrandLogoTexture, uv);
  return max(logo.a, max(logo.r, max(logo.g, logo.b))) * uBrandLogoOpacity;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;

  float logo = logoMask(p);
  vec3 brandTexture = texture(uBrandTexture, uv).rgb * uBrandTextureOpacity * uBrandTextureAvailable;
  vec3 brandBackground = texture(uBrandBackgroundTexture, uv).rgb * uBrandBackgroundOpacity * uBrandBackgroundAvailable;
  vec3 userMedia = texture(uUserMedia, uv).rgb * uUserMediaAvailable;
  vec3 album = texture(uAlbumArtwork, uv).rgb * uAlbumArtworkAvailable;
  vec3 mediaOutput = texture(uMediaOutput, uv).rgb * uMediaOutputAvailable;
  float mediaWeight = uUserMediaAvailable + uAlbumArtworkAvailable + uMediaOutputAvailable;
  vec3 media = mediaWeight > 0.0
    ? (userMedia + album + mediaOutput) / mediaWeight
    : vec3(0.0);
  float lyric = mix(uVocalHookConfidence, max(uLyricActivity, uLyricLineProgress), uHasLyrics);
  float harmonic = mix(0.0, uPitchNormalized + uChordChangeHit * 0.35, uHasHarmonics);
  float refract = logo * uLogoRefraction * (0.02 + uBass * uMasterBassReactivity * 0.04);
  float ribbons = 0.0;
  float echoes = max(1.0, floor(uRibbonCount));

  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= echoes) break;
    float offset = (fi - (echoes - 1.0) * 0.5) * uEchoSpread;
    float x = clamp(uv.x + refract * sin(p.y * 8.0 + fi), 0.0, 1.0);
    float waveform = wave(x) * uWaveAmount * (0.45 + uBass * 0.55);
    float y = p.y - offset - waveform;
    float line = exp(-abs(y) * (65.0 - fi * 2.0));
    ribbons += line * (1.0 - fi / max(echoes, 1.0) * 0.65);
  }

  float wordSpark = uLyricWordHit + smoothstep(0.88, 1.0, uLyricWordProgress) * lyric;
  vec3 col = uBackgroundColor.rgb * (0.45 + uMid * 0.15);
  col = mix(col, media, clamp(mediaWeight, 0.0, 1.0) * (0.08 + uMid * 0.12));
  col += brandBackground * 0.16 + brandTexture * (0.08 + ribbons * 0.08);
  col += mix(uCoreColor.rgb, uEchoColor.rgb, uPhrase8Progress) * ribbons;
  col += uBrandHighlight.rgb * logo * (0.18 + lyric * 0.55 + harmonic * 0.18);
  col += uBrandImpact.rgb * (uSnareHit * 0.4 + wordSpark * 0.45);
  col *= 1.0 + uKickHit * 0.25 + uHigh * 0.08;
  col *= uMasterIntensity * (0.8 + uMasterGlow * 0.22);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`,

  params: [
    {
      id: 'ribbonCount', type: 'integer', label: 'Ribbon Count', uniformName: 'uRibbonCount',
      min: 1, max: 12, step: 1, default: 7, modulatable: true,
    },
    {
      id: 'waveAmount', type: 'float', label: 'Wave Amount', uniformName: 'uWaveAmount',
      min: 0.02, max: 1, step: 0.01, default: 0.32, modulatable: true,
    },
    {
      id: 'echoSpread', type: 'float', label: 'Echo Spread', uniformName: 'uEchoSpread',
      min: 0.02, max: 0.35, step: 0.005, default: 0.11, modulatable: true,
    },
    {
      id: 'logoRefraction', type: 'float', label: 'Logo Refraction', uniformName: 'uLogoRefraction',
      min: 0, max: 3, step: 0.05, default: 1.1, modulatable: true,
    },
    {
      id: 'coreColor', type: 'color', label: 'Core Color', uniformName: 'uCoreColor',
      brandRole: 'primary', default: [0.0, 0.9, 1.0, 1],
    },
    {
      id: 'echoColor', type: 'color', label: 'Echo Color', uniformName: 'uEchoColor',
      brandRole: 'secondary', default: [0.65, 0.18, 1.0, 1],
    },
    {
      id: 'backgroundColor', type: 'color', label: 'Background', uniformName: 'uBackgroundColor',
      brandRole: 'background', default: [0.005, 0.008, 0.018, 1],
    },
  ],

  defaults: {
    ribbonCount: 7,
    waveAmount: 0.32,
    echoSpread: 0.11,
    logoRefraction: 1.1,
    coreColor: [0.0, 0.9, 1.0, 1],
    echoColor: [0.65, 0.18, 1.0, 1],
    backgroundColor: [0.005, 0.008, 0.018, 1],
  },

  textureInputs: [
    { name: 'uUserMedia', label: 'User Media', source: 'uploaded-image', required: false },
    { name: 'uAlbumArtwork', label: 'Album Artwork', source: 'album-artwork', required: false },
    { name: 'uMediaOutput', label: 'Media Output', source: 'media-output', required: false },
  ],

  quality: { minimumTier: 'low', recommendedTier: 'medium', estimatedPassCount: 1 },
  thumbnail: { color: '#10072b' },
  tags: ['waveform', 'brand-logo', 'lyrics', 'harmonic', 'ribbons'],
}

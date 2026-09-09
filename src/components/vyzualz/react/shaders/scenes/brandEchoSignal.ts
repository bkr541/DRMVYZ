import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

export const BRAND_ECHO_SIGNAL: ShaderDefinition = {
  id: 'shader-brand-echo-signal',
  name: 'Brand Echo Signal',
  description: 'Waveform ribbons weave in a DNA braid and refract around a focal mask while lyrics and harmonic changes steer the echo field.',
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

uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterGlow;
uniform float uMasterBassReactivity;

out vec4 fragColor;

float rawWave(float x) {
  if (uWaveformAvailable < 0.5) return sin((x + uTime * 0.1) * 18.0) * 0.18;
  return texture(uWaveformTexture, vec2(clamp(x, 0.0, 1.0), 0.5)).r * 2.0 - 1.0;
}

// A full-bandwidth audio waveform sampled 1:1 per screen column reads as vertical
// hash. Resample it onto a coarse control grid and interpolate, so each ribbon
// stays a readable curve. The grid gets finer with Wave Amount and Motion — turn
// them down and the line just calms, it never scrambles.
float wave(float x) {
  if (uWaveformAvailable < 0.5) {
    return sin((x + uTime * 0.1 * (0.25 + uMasterMotion * 0.75)) * 18.0) * 0.18;
  }
  float detail = mix(26.0, 210.0, clamp(uWaveAmount * (0.35 + uMasterMotion * 0.65), 0.0, 1.0));
  float gx = x * detail;
  float g0 = floor(gx);
  float f = smoothstep(0.0, 1.0, gx - g0);
  return mix(rawWave(g0 / detail), rawWave((g0 + 1.0) / detail), f);
}

float focusMask(vec2 p) {
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

  float focus = focusMask(p);
  vec3 userMedia = texture(uUserMedia, uv).rgb * uUserMediaAvailable;
  vec3 album = texture(uAlbumArtwork, uv).rgb * uAlbumArtworkAvailable;
  vec3 mediaOutput = texture(uMediaOutput, uv).rgb * uMediaOutputAvailable;
  float mediaWeight = uUserMediaAvailable + uAlbumArtworkAvailable + uMediaOutputAvailable;
  vec3 media = mediaWeight > 0.0
    ? (userMedia + album + mediaOutput) / mediaWeight
    : vec3(0.0);
  float lyric = mix(uVocalHookConfidence, max(uLyricActivity, uLyricLineProgress), uHasLyrics);
  float harmonic = mix(0.0, uPitchNormalized + uChordChangeHit * 0.35, uHasHarmonics);
  float refract = focus * uLogoRefraction * (0.02 + uBass * uMasterBassReactivity * 0.04);

  float ribbons = 0.0;
  float echoes = max(1.0, floor(uRibbonCount));

  // Bass reaches the wave only through the Bass Reactivity master; Motion keeps a
  // 40% floor so the wave still answers the music when calmed right down.
  float bassReact = mix(1.0, 0.35 + uBass * 0.65, clamp(uMasterBassReactivity, 0.0, 1.0));
  float motionAmp = 0.4 + uMasterMotion * 0.6;
  float ampScale = 1.0 / (1.0 + (echoes - 1.0) * 0.14);

  // Ribbons sit 1.5x further apart than the raw Echo Spread and each one weaves
  // in counter-phase to its neighbour (a DNA braid), so they stay individually
  // readable as the count grows. The stack is fitted to the viewport when the
  // spread / count would push it off screen.
  float spacing = uEchoSpread * 1.5;
  float halfSpan = (echoes - 1.0) * 0.5 * spacing;
  float fit = min(1.0, 0.82 / max(halfSpan, 0.0001));
  float braidFreq = 5.0 + echoes * 0.4;
  float braidAmp = spacing * fit * 0.45;
  float braidTime = uTime * uMasterMotion * 1.2;

  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    if (fi >= echoes) break;
    float centre = (fi - (echoes - 1.0) * 0.5) * spacing * fit;
    float braid = sin(uv.x * braidFreq + braidTime + fi * 3.14159265) * braidAmp;
    float x = clamp(uv.x + fi * 0.013 + refract * sin(p.y * 8.0 + fi), 0.0, 1.0);
    float waveform = wave(x) * uWaveAmount * bassReact * motionAmp * ampScale;
    float y = p.y - centre - braid - waveform;
    float falloff = 46.0 + fi * 4.0;
    float line = exp(-abs(y) * falloff);
    ribbons += line * (1.0 - fi / max(echoes, 1.0) * 0.55);
  }

  float wordSpark = uLyricWordHit + smoothstep(0.88, 1.0, uLyricWordProgress) * lyric;
  vec3 col = uBackgroundColor.rgb * (0.45 + uMid * 0.15);
  col = mix(col, media, clamp(mediaWeight, 0.0, 1.0) * (0.08 + uMid * 0.12));
  col += mix(uCoreColor.rgb, uEchoColor.rgb, uPhrase8Progress) * ribbons;
  col += uCoreColor.rgb * focus * (0.18 + lyric * 0.55 + harmonic * 0.18);
  col += vec3(1.0) * (uSnareHit * 0.4 + wordSpark * 0.45);
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
      default: [0.0, 0.9, 1.0, 1],
    },
    {
      id: 'echoColor', type: 'color', label: 'Echo Color', uniformName: 'uEchoColor',
      default: [0.65, 0.18, 1.0, 1],
    },
    {
      id: 'backgroundColor', type: 'color', label: 'Background', uniformName: 'uBackgroundColor',
      default: [0.005, 0.008, 0.018, 1],
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
  tags: ['waveform', 'lyrics', 'harmonic', 'ribbons'],
}

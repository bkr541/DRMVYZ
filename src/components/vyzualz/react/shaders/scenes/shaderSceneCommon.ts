/**
 * Shared GLSL contract for the production bass-reactor shader pack.
 *
 * Every scene calls `readMusicSignals`, which folds the complete canonical
 * ShaderAudioBridge vocabulary into four deliberately slow/medium/fast control
 * lanes. This keeps every available Music Intelligence component meaningful
 * without making every pixel twitch independently.
 */
export const SHADER_SCENE_COMMON_GLSL = String.raw`
uniform vec2 uResolution;
uniform float uAspect;
uniform float uTime;
uniform float uDeltaTime;
uniform float uPlaybackTime;
uniform float uPlaybackProgress;

uniform sampler2D uSpectrumTexture;
uniform float uSpectrumAvailable;
uniform sampler2D uWaveformTexture;
uniform float uWaveformAvailable;

uniform float uSub;
uniform float uBass;
uniform float uLowMid;
uniform float uMid;
uniform float uHighMid;
uniform float uHigh;
uniform float uAir;
uniform float uRawSub;
uniform float uRawBass;
uniform float uRawLowMid;
uniform float uRawMid;
uniform float uRawHigh;
uniform float uRawAir;
uniform float uVolume;
uniform float uRms;
uniform float uPeak;
uniform float uCrestFactor;

uniform float uKick;
uniform float uSnare;
uniform float uHat;
uniform float uKickHit;
uniform float uSnareHit;
uniform float uHatHit;
uniform float uBeatHit;
uniform float uDownbeatHit;
uniform float uTransient;
uniform float uTransientConfidence;

uniform float uBpm;
uniform float uBpmConfidence;
uniform float uBeatPhase;
uniform float uBarPhase;
uniform float uPhrasePhase;
uniform float uPhrase4Progress;
uniform float uPhrase8Progress;
uniform float uPhrase16Progress;
uniform float uPhrase32Progress;
uniform float uPhrase4Hit;
uniform float uPhrase8Hit;
uniform float uPhrase16Hit;
uniform float uPhrase32Hit;
uniform float uSectionPhase;
uniform float uSectionProgress;
uniform float uBeatIndex;
uniform float uBeatInBar;
uniform float uBarIndex;
uniform float uSectionType;
uniform float uSectionStartPulse;
uniform float uSectionChangePulse;

uniform float uEnergy;
uniform float uEnergyShort;
uniform float uEnergyShortTerm;
uniform float uEnergyLong;
uniform float uEnergyLongTerm;
uniform float uEnergyDelta;
uniform float uEnergyPercentile;
uniform float uTrackEnergy;
uniform float uTension;
uniform float uBuildProgress;
uniform float uDropImpact;
uniform float uComplexity;
uniform float uSpectralCentroid;
uniform float uSpectralFlux;
uniform float uSpectralSpread;
uniform float uSpectralRolloff;
uniform float uSpectralFlatness;

uniform float uSectionIntensity;
uniform float uSectionConfidence;
uniform float uSectionSource;

uniform float uKey;
uniform float uKeyCode;
uniform float uMode;
uniform float uModeCode;
uniform float uKeyConfidence;
uniform float uChord;
uniform float uChordCode;
uniform float uChordConfidence;
uniform float uChordChangeHit;
uniform float uRootNote;
uniform float uRootNoteCode;
uniform float uPitchHz;
uniform float uDominantPitch;
uniform float uPitchNormalized;
uniform float uMelodyHeight;
uniform float uMelodyContour;
uniform float uMelodyContourCode;

uniform float uVocalEnergy;
uniform float uDrumEnergy;
uniform float uBassStemEnergy;
uniform float uInstrumentEnergy;
uniform float uOtherStemEnergy;
uniform float uVocalActivity;
uniform float uDrumStemTransient;
uniform float uBassStemTransient;

uniform float uLyricActivity;
uniform float uLyricLineProgress;
uniform float uLyricWordProgress;
uniform float uLyricWordHit;
uniform float uLyricLineEnter;
uniform float uLyricLineExit;
uniform float uLyricGap;
uniform float uLyricPhraseConfidence;

uniform float uBuildConfidence;
uniform float uDropConfidence;
uniform float uFakeoutConfidence;
uniform float uVocalHookConfidence;
uniform float uMood;
uniform float uMoodCode;
uniform float uTexture;
uniform float uTextureCode;

uniform float uHasLiveBands;
uniform float uHasRhythmEvents;
uniform float uHasBeatGrid;
uniform float uHasSections;
uniform float uHasTrackEnergyCurve;
uniform float uHasStems;
uniform float uHasLyrics;
uniform float uHasHarmonics;
uniform float uHasSemantics;
uniform float uOverallConfidence;
uniform float uRhythmConfidence;
uniform float uHarmonicConfidence;

uniform vec4 uBrandPrimary;
uniform vec4 uBrandSecondary;
uniform vec4 uBrandAccent;
uniform vec4 uBrandBackground;
uniform vec4 uBrandHighlight;
uniform vec4 uBrandText;
uniform vec4 uBrandImpact;
uniform float uBrandStrength;
uniform float uBrandEnabled;

uniform sampler2D uBrandLogoTexture;
uniform float uBrandLogoAvailable;
uniform float uBrandLogoAspect;
uniform float uBrandLogoScale;
uniform float uBrandLogoOpacity;
uniform sampler2D uBrandTexture;
uniform float uBrandTextureAvailable;
uniform float uBrandTextureAspect;
uniform float uBrandTextureScale;
uniform float uBrandTextureOpacity;
uniform sampler2D uBrandBackgroundTexture;
uniform float uBrandBackgroundAvailable;
uniform float uBrandBackgroundAspect;
uniform float uBrandBackgroundScale;
uniform float uBrandBackgroundOpacity;

uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterGlow;
uniform float uMasterBassReactivity;
uniform float uMasterTrailDecay;
uniform float uMasterFogDensity;
uniform float uMasterParticleDensity;

const float SHADER_PI = 3.14159265358979323846;
const float SHADER_TAU = 6.28318530717958647692;

float saturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float safeNorm(float value, float scale) {
  return saturate(value / max(scale, 0.0001));
}

float hash11(float value) {
  return fract(sin(value * 127.1) * 43758.5453123);
}

float hash21(vec2 value) {
  return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise21(vec2 value) {
  vec2 cell = floor(value);
  vec2 local = fract(value);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float spectrumAt(float position) {
  float fallback = mix(uEnergyLongTerm, uEnergy, saturate(position));
  return mix(fallback, texture(uSpectrumTexture, vec2(saturate(position), 0.5)).r, uSpectrumAvailable);
}

float waveformAt(float position) {
  float fallback = sin((position + uTime * 0.05) * SHADER_TAU * 3.0) * 0.22;
  float sampled = texture(uWaveformTexture, vec2(saturate(position), 0.5)).r * 2.0 - 1.0;
  return mix(fallback, sampled, uWaveformAvailable);
}

float brandLogoMask(vec2 point) {
  float scale = max(0.05, uBrandLogoScale);
  vec2 uv = point / scale * 0.5 + 0.5;
  uv.x = (uv.x - 0.5) / max(0.1, uBrandLogoAspect) + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  vec4 logo = texture(uBrandLogoTexture, uv);
  float sampled = max(logo.a, max(logo.r, max(logo.g, logo.b))) * uBrandLogoOpacity;
  return mix(0.0, sampled, uBrandLogoAvailable);
}

vec3 brandBackdrop(vec2 uv) {
  vec3 textureLayer = texture(uBrandTexture, uv).rgb
    * uBrandTextureOpacity * uBrandTextureAvailable;
  vec3 backgroundLayer = texture(uBrandBackgroundTexture, uv).rgb
    * uBrandBackgroundOpacity * uBrandBackgroundAvailable;
  return textureLayer * 0.35 + backgroundLayer * 0.45;
}

struct MusicSignals {
  float micro;
  float rhythm;
  float macro;
  float expression;
  float build;
  float drop;
  float fakeout;
  float confidence;
};

MusicSignals readMusicSignals(vec2 uv) {
  float normalizedBands = (
    uSub + uBass + uLowMid + uMid + uHighMid + uHigh + uAir
  ) / 7.0;
  float rawBands = (
    safeNorm(uRawSub, 2.0) + safeNorm(uRawBass, 2.0)
    + safeNorm(uRawLowMid, 2.0) + safeNorm(uRawMid, 2.0)
    + safeNorm(uRawHigh, 2.0) + safeNorm(uRawAir, 2.0)
  ) / 6.0;
  float amplitude = (
    saturate(uVolume) + saturate(uRms) + saturate(uPeak)
    + safeNorm(uCrestFactor, 8.0)
  ) * 0.25;
  float textureProbe = spectrumAt(fract(uv.x * 0.72 + uv.y * 0.28));
  float waveformProbe = abs(waveformAt(fract(uv.x * 0.63 + uPhrase8Progress * 0.17)));
  float micro = saturate(
    normalizedBands * 0.28 + rawBands * 0.12 + amplitude * 0.12
    + textureProbe * 0.15 + waveformProbe * 0.08
    + uKick * 0.05 + uSnare * 0.04 + uHat * 0.035
    + uKickHit * 0.055 + uSnareHit * 0.07 + uHatHit * 0.035
    + uTransient * uTransientConfidence * 0.06
  );

  float indexedPulse = (
    hash11(mod(uBeatIndex, 256.0) + 1.0)
    + hash11(mod(uBarIndex, 128.0) + 9.0)
    + fract(uBeatInBar * 0.25)
  ) / 3.0;
  float phraseMotion = (
    uPhrasePhase + uPhrase4Progress + uPhrase8Progress
    + uPhrase16Progress + uPhrase32Progress
  ) / 5.0;
  float phraseHits = max(max(uPhrase4Hit, uPhrase8Hit), max(uPhrase16Hit, uPhrase32Hit));
  float rhythm = saturate(
    uBeatPhase * 0.08 + uBarPhase * 0.08 + phraseMotion * 0.14
    + indexedPulse * 0.08 + uBeatHit * 0.16 + uDownbeatHit * 0.16
    + phraseHits * 0.12 + safeNorm(uBpm, 220.0) * uBpmConfidence * 0.06
    + uHasBeatGrid * uRhythmConfidence * 0.06 + uHasRhythmEvents * 0.06
  );

  float energy = (
    uEnergy + uEnergyShort + uEnergyShortTerm + uEnergyLong
    + uEnergyLongTerm + saturate(uEnergyDelta * 0.5 + 0.5)
    + uEnergyPercentile + uTrackEnergy
  ) / 8.0;
  float timbre = (
    uComplexity + uSpectralCentroid + uSpectralFlux + uSpectralSpread
    + uSpectralRolloff + uSpectralFlatness
  ) / 6.0;
  float sectionCode = fract((uSectionType + uSectionSource * 0.37) / 16.0);
  float section = (
    uSectionPhase + uSectionProgress + uSectionIntensity * uSectionConfidence
    + uSectionStartPulse + uSectionChangePulse + sectionCode
  ) / 6.0;
  float build = max(max(uBuildProgress, uBuildConfidence), saturate(uTension * 0.8));
  float drop = max(max(uDropImpact, uDropConfidence), uEnergyDelta);
  float fakeout = uFakeoutConfidence;
  float macro = saturate(
    energy * 0.3 + timbre * 0.2 + section * uHasSections * 0.2
    + build * 0.14 + drop * 0.12 + fakeout * 0.04
  );

  float harmonicCodes = (
    fract((uKey + uKeyCode + uRootNote + uRootNoteCode) / 48.0)
    + fract((uMode + uModeCode + uChord + uChordCode) / 64.0)
    + fract((uMelodyContour + uMelodyContourCode) / 16.0)
  ) / 3.0;
  float pitch = (
    safeNorm(uPitchHz, 2000.0) + safeNorm(uDominantPitch, 2000.0)
    + uPitchNormalized + uMelodyHeight
  ) * 0.25;
  float harmonic = saturate(
    (harmonicCodes * 0.22 + pitch * 0.25 + uChordChangeHit * 0.18
    + uKeyConfidence * 0.12 + uChordConfidence * 0.13
    + uHarmonicConfidence * 0.1) * uHasHarmonics
  );

  float stems = saturate((
    uVocalEnergy + uDrumEnergy + uBassStemEnergy + uInstrumentEnergy
    + uOtherStemEnergy + uVocalActivity + uDrumStemTransient
    + uBassStemTransient
  ) * 0.125 * uHasStems);
  float lyrics = saturate((
    uLyricActivity + uLyricLineProgress + uLyricWordProgress + uLyricWordHit
    + uLyricLineEnter + uLyricLineExit + (1.0 - uLyricGap)
    + uLyricPhraseConfidence
  ) * 0.125 * uHasLyrics);
  float semantics = saturate((
    uBuildConfidence + uDropConfidence + uFakeoutConfidence
    + uVocalHookConfidence + fract((uMood + uMoodCode) / 16.0)
    + fract((uTexture + uTextureCode) / 16.0)
  ) / 6.0 * uHasSemantics);
  float capability = (
    uHasLiveBands + uHasRhythmEvents + uHasBeatGrid + uHasSections
    + uHasTrackEnergyCurve + uHasStems + uHasLyrics + uHasHarmonics
    + uHasSemantics
  ) / 9.0;
  float confidence = saturate((
    uOverallConfidence + uRhythmConfidence + uHarmonicConfidence
    + uBpmConfidence + uTransientConfidence + uSectionConfidence
    + uKeyConfidence + uChordConfidence + uLyricPhraseConfidence
  ) / 9.0 * (0.7 + capability * 0.3));
  float expression = saturate(
    harmonic * 0.28 + stems * 0.24 + lyrics * 0.22
    + semantics * 0.2 + capability * 0.06
  );

  return MusicSignals(micro, rhythm, macro, expression, build, drop, fakeout, confidence);
}

vec3 applyBrandAtmosphere(vec3 color, vec2 uv, float amount) {
  vec3 branded = color + brandBackdrop(uv) * amount * uBrandStrength;
  return mix(color, branded, uBrandEnabled);
}
`

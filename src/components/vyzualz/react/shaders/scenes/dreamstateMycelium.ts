import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

const MYCELIUM_GROWTH = `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uBranchDensity;
uniform float uGrowthSpeed;
uniform float uCellScale;
uniform float uFlow;
uniform float uPersistence;
uniform vec4 uRootColor;
uniform vec4 uBloomColor;
uniform vec4 uSporeColor;
uniform vec4 uBackgroundColor;
out vec4 fragColor;

float ridge(float value, float width) {
  return exp(-abs(value) * width);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float harmonicDrift = (uPitchNormalized - 0.5) * 0.6 * uHasHarmonics
    + uChordChangeHit * 0.2;
  float flowTime = uPlaybackTime * uGrowthSpeed * uMasterMotion
    + uPhrase32Progress * 2.0 + harmonicDrift;
  p = rotate2d(sin(flowTime * 0.13) * 0.28 + uMelodyContourCode * 0.04) * p;

  float density = max(2.0, uBranchDensity);
  float cellScale = max(1.0, uCellScale);
  float spectralWidth = 0.2 + uSpectralSpread * 0.8;
  float organic = mix(1.0, 0.35, uSpectralFlatness);
  float branch = 0.0;
  float nodes = 0.0;

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 q = p * (cellScale + fi * density * 0.42);
    q += vec2(flowTime * (0.12 + fi * 0.017), -flowTime * (0.08 + fi * 0.013));
    q += vec2(
      sin(q.y * (1.7 + fi * 0.2) + flowTime) * uFlow,
      cos(q.x * (1.5 + fi * 0.17) - flowTime * 0.8) * uFlow
    ) * (0.15 + music.micro * 0.08);
    vec2 id = floor(q);
    vec2 local = fract(q) - 0.5;
    float n = noise21(id + fi * 17.0);
    float angle = n * SHADER_TAU + uPhrase16Progress * SHADER_TAU * (0.2 + fi * 0.05);
    vec2 direction = vec2(cos(angle), sin(angle));
    float strand = dot(local, vec2(-direction.y, direction.x));
    float along = dot(local, direction);
    float spectrum = spectrumAt(fract(n * 0.7 + fi * 0.13));
    float width = 0.025 + spectralWidth * 0.035 + spectrum * 0.025;
    branch += ridge(abs(strand) - width, 70.0) * (1.0 - smoothstep(0.05, 0.55, abs(along)))
      * (0.2 + spectrum * 0.8) / (1.0 + fi * 0.35);
    nodes += exp(-length(local) * (22.0 - uComplexity * 8.0))
      * step(0.62 - uComplexity * 0.2, n) / (1.0 + fi * 0.45);
  }

  float vocalBloom = mix(uMid, max(uVocalEnergy, uVocalActivity), uHasStems);
  float lyricBloom = uHasLyrics * (uLyricLineEnter + uLyricWordHit + uLyricActivity * 0.25);
  float bloomPulse = nodes * (0.28 + vocalBloom * 0.9 + lyricBloom * 0.65);
  float dropReverse = music.drop * ridge(length(p) - fract(1.0 - uBarPhase) * 1.2, 36.0);
  float spores = step(0.93 - uMasterParticleDensity * 0.08, noise21(floor((p + flowTime * 0.03) * 34.0)))
    * (uHatHit + uAir * 0.2 + uOtherStemEnergy * uHasStems * 0.25);
  float crystalline = mix(branch, branch * (0.45 + ridge(fract(p.x * 18.0) - 0.5, 28.0)), 1.0 - organic);

  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.55 + uEnergyLongTerm * 0.22);
  col += mix(uRootColor.rgb, uBloomColor.rgb, uSpectralCentroid) * crystalline
    * (0.4 + music.macro * 0.5);
  col += mix(uBloomColor.rgb, uBrandHighlight.rgb, uBrandEnabled) * bloomPulse;
  col += uSporeColor.rgb * spores * 0.55;
  col += mix(uSporeColor.rgb, uBrandAccent.rgb, uBrandEnabled) * dropReverse;
  col = applyBrandAtmosphere(col, uv, 0.13 + music.expression * 0.12);
  col *= 0.72 + music.micro * 0.28 + music.expression * 0.42 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.75 + uMasterGlow * 0.3);
  fragColor = vec4(max(col, 0.0), 1.0);
}
`

const MYCELIUM_FEEDBACK = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uPreviousGrowth;
uniform sampler2D uFreshGrowth;
uniform float uPersistence;
uniform float uDropImpact;
uniform float uChordChangeHit;
uniform float uMasterTrailDecay;
uniform float uMasterMotion;
out vec4 fragColor;

void main() {
  vec2 p = v_uv - 0.5;
  float angle = (0.001 + uChordChangeHit * 0.008 - uDropImpact * 0.012) * uMasterMotion;
  float c = cos(angle);
  float s = sin(angle);
  p = mat2(c, -s, s, c) * p;
  p *= 0.996 + uDropImpact * 0.018;
  vec3 previous = texture(uPreviousGrowth, clamp(p + 0.5, 0.001, 0.999)).rgb;
  vec3 fresh = texture(uFreshGrowth, v_uv).rgb;
  float retention = clamp(uPersistence * (1.0 - uMasterTrailDecay), 0.0, 0.985);
  fragColor = vec4(max(fresh, previous * retention), 1.0);
}
`

const MYCELIUM_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uGrowthHistory;
uniform sampler2D uFreshGrowth;
uniform float uEnergy;
uniform float uDropImpact;
uniform float uMasterIntensity;
uniform float uMasterGlow;
out vec4 fragColor;
void main() {
  vec3 history = texture(uGrowthHistory, v_uv).rgb;
  vec3 fresh = texture(uFreshGrowth, v_uv).rgb;
  vec3 col = history + fresh * (0.28 + uDropImpact * 0.2);
  col *= uMasterIntensity * (0.77 + uMasterGlow * 0.25 + uEnergy * 0.08);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`

export const DREAMSTATE_MYCELIUM: ShaderDefinition = {
  id: 'shader-dreamstate-mycelium',
  name: 'Dreamstate Mycelium',
  description: 'A persistent cosmic fungal network that grows from spectral spread, blooms with vocals, and reverses through drops.',
  category: 'simulation',
  version: 1,

  passes: [
    { id: 'growth', fragSrc: MYCELIUM_GROWTH, inputs: [], output: 'fresh-growth', resolutionScale: 0.75, clearBeforeRender: true },
    {
      id: 'persistence', fragSrc: MYCELIUM_FEEDBACK,
      inputs: [
        { source: 'growth-history', uniformName: 'uPreviousGrowth' },
        { source: 'fresh-growth', uniformName: 'uFreshGrowth' },
      ],
      output: 'growth-history', resolutionScale: 0.75, clearBeforeRender: false,
      pingPong: true, dependsOn: ['growth'], filter: 'linear', wrap: 'clamp',
    },
    {
      id: 'composite', fragSrc: MYCELIUM_COMPOSITE,
      inputs: [
        { source: 'growth-history', uniformName: 'uGrowthHistory' },
        { source: 'fresh-growth', uniformName: 'uFreshGrowth' },
      ],
      output: 'composite', resolutionScale: 1, clearBeforeRender: true, dependsOn: ['persistence'],
    },
  ],

  params: [
    { id: 'branchDensity', type: 'float', label: 'Branch Density', group: 'Growth', uniformName: 'uBranchDensity', min: 2, max: 12, step: 0.25, default: 6.5, modulatable: true },
    { id: 'growthSpeed', type: 'float', label: 'Growth Speed', group: 'Growth', uniformName: 'uGrowthSpeed', min: 0.02, max: 1.2, step: 0.01, default: 0.23, modulatable: true },
    { id: 'cellScale', type: 'float', label: 'Cell Scale', group: 'Growth', uniformName: 'uCellScale', min: 1, max: 10, step: 0.1, default: 4.2, modulatable: true },
    { id: 'flow', type: 'float', label: 'Organic Flow', group: 'Motion', uniformName: 'uFlow', min: 0, max: 2, step: 0.05, default: 0.8, modulatable: true },
    { id: 'persistence', type: 'float', label: 'Persistence', group: 'Feedback', uniformName: 'uPersistence', min: 0, max: 0.99, step: 0.01, default: 0.91, modulatable: true },
    { id: 'rootColor', type: 'color', label: 'Roots', group: 'Color', uniformName: 'uRootColor', brandRole: 'primary', default: [0.1, 0.16, 1, 1] },
    { id: 'bloomColor', type: 'color', label: 'Blooms', group: 'Color', uniformName: 'uBloomColor', brandRole: 'secondary', default: [0.82, 0.08, 1, 1] },
    { id: 'sporeColor', type: 'color', label: 'Spores', group: 'Color', uniformName: 'uSporeColor', brandRole: 'accent', default: [0.04, 1, 0.76, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Void', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.002, 0.006, 0.022, 1] },
  ],

  defaults: {
    branchDensity: 6.5, growthSpeed: 0.23, cellScale: 4.2, flow: 0.8, persistence: 0.91,
    rootColor: [0.1, 0.16, 1, 1], bloomColor: [0.82, 0.08, 1, 1],
    sporeColor: [0.04, 1, 0.76, 1], backgroundColor: [0.002, 0.006, 0.022, 1],
  },

  resetOnActivation: true,
  feedback: { pingPongBuffers: 1, historyFrames: 1 },
  feedbackReset: { onSceneChange: true, onTrackChange: true, onPlaybackRestart: true, onSectionChange: true, onDropImpact: false, onResolutionChange: true, onContextRestore: true },
  quality: { minimumTier: 'medium', recommendedTier: 'high', simulationResolution: { min: 0.5, recommended: 0.75 }, iterationLimit: { min: 3, recommended: 5, max: 7 }, estimatedPassCount: 3, requiresPersistentBuffers: true },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['liquid-melt', 'luma-dissolve', 'feedback-collapse', 'noise-dissolve'] },
  thumbnail: { color: '#09113a' },
  tags: ['psychedelic-bass', 'mycelium', 'organic', 'feedback', 'harmonics', 'lyrics', 'brand-kit'],
}

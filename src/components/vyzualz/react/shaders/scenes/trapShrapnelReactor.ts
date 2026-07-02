import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { SHADER_SCENE_COMMON_GLSL } from './shaderSceneCommon'

const SHRAPNEL_GENERATOR = `#version 300 es
precision highp float;
${SHADER_SCENE_COMMON_GLSL}

uniform float uShardCount;
uniform float uShardScale;
uniform float uExplosion;
uniform float uAngularVelocity;
uniform float uTrailAmount;
uniform vec4 uShardColor;
uniform vec4 uCoreColor;
uniform vec4 uImpactColor;
uniform vec4 uBackgroundColor;

out vec4 fragColor;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uAspect;
  MusicSignals music = readMusicSignals(uv);

  float fakeoutCharge = music.fakeout * (0.35 + music.build * 0.65);
  float detonation = max(music.drop, uDrumStemTransient * uHasStems);
  float radialPush = uExplosion * (detonation + uKickHit * 0.38);
  float rotation = uTime * uAngularVelocity * uMasterMotion
    + uPhrase16Progress * SHADER_TAU + uSnareHit * 0.75;
  p = rotate2d(rotation) * p;
  p *= mix(1.0, 0.68, fakeoutCharge);

  float shardField = 0.0;
  float hotEdges = 0.0;
  float count = max(8.0, floor(uShardCount));
  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    if (fi >= count) break;
    float seed = hash11(fi * 13.37 + floor(uBarIndex) * 0.73);
    float angle = fi / count * SHADER_TAU + seed * 0.8 + uPhrase4Progress * 0.65;
    float speed = 0.22 + seed * 0.78;
    float travel = fract(uPlaybackTime * (0.08 + speed * 0.1) + seed + radialPush * 0.18);
    travel = mix(travel, 0.18 + travel * 0.22, fakeoutCharge);
    float radius = travel * (0.45 + radialPush * speed);
    vec2 direction = vec2(cos(angle), sin(angle));
    vec2 tangent = vec2(-direction.y, direction.x);
    vec2 center = direction * radius;
    center += tangent * waveformAt(fract(seed + uPhrase8Progress * 0.2)) * 0.08;
    float lengthValue = uShardScale * (0.06 + speed * 0.16) * (1.0 + uTransient * 0.5);
    float widthValue = 0.006 + uHigh * 0.008 + uHatHit * 0.01;
    float d = segmentDistance(p, center - direction * lengthValue, center + direction * lengthValue);
    float shard = exp(-d * (110.0 - widthValue * 1800.0));
    float spectral = spectrumAt(fract(seed * 0.8 + fi / count * 0.2));
    shardField += shard * (0.25 + spectral * 0.85) * (0.45 + travel);
    hotEdges += shard * step(0.72, seed) * (uSnareHit + uHatHit * 0.45 + uSpectralFlux * 0.35);
  }

  float coreRadius = 0.055 + uBass * uMasterBassReactivity * 0.08 + fakeoutCharge * 0.13;
  float core = exp(-abs(length(p) - coreRadius) * 95.0);
  float shock = exp(-abs(length(p) - fract(uBarPhase + detonation * 0.3) * 1.25) * 50.0)
    * (detonation + uDownbeatHit * 0.55);
  float reverseCut = mix(1.0, (1.0 - smoothstep(0.1, 0.95, length(p))), uSnareHit * 0.42);

  vec3 col = mix(uBackgroundColor.rgb, uBrandBackground.rgb, uBrandEnabled * uBrandStrength)
    * (0.42 + uEnergyLongTerm * 0.2);
  col += mix(uShardColor.rgb, uCoreColor.rgb, music.expression) * shardField * reverseCut;
  col += uImpactColor.rgb * hotEdges;
  col += mix(uCoreColor.rgb, uBrandHighlight.rgb, uBrandEnabled) * core * (0.6 + fakeoutCharge * 1.4);
  col += mix(uImpactColor.rgb, uBrandImpact.rgb, detonation) * shock * 1.4;
  col = applyBrandAtmosphere(col, uv, 0.08 + music.expression * 0.12);
  col *= 0.72 + music.micro * 0.46 + music.macro * 0.34 + music.confidence * 0.08;
  col *= uMasterIntensity * (0.76 + uMasterGlow * 0.28);
  fragColor = vec4(max(col, 0.0), 1.0);
}
`

const SHRAPNEL_FEEDBACK = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uPreviousShrapnel;
uniform sampler2D uFreshShrapnel;
uniform float uDeltaTime;
uniform float uSnareHit;
uniform float uKickHit;
uniform float uFakeoutConfidence;
uniform float uTrailAmount;
uniform float uMasterTrailDecay;
uniform float uMasterMotion;
out vec4 fragColor;

void main() {
  vec2 centered = v_uv - 0.5;
  float angle = (0.0015 + uSnareHit * 0.018) * uMasterMotion;
  float c = cos(angle);
  float s = sin(angle);
  centered = mat2(c, -s, s, c) * centered;
  float zoom = 0.992 - uKickHit * 0.014 + uFakeoutConfidence * 0.006;
  vec2 historyUv = clamp(centered * zoom + 0.5, 0.001, 0.999);
  vec3 previous = texture(uPreviousShrapnel, historyUv).rgb;
  vec3 fresh = texture(uFreshShrapnel, v_uv).rgb;
  float retention = clamp(uTrailAmount * (1.0 - uMasterTrailDecay) * (0.98 - uDeltaTime * 0.15), 0.0, 0.985);
  vec3 col = max(fresh, previous * retention);
  fragColor = vec4(col, 1.0);
}
`

const SHRAPNEL_COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uShrapnelTrail;
uniform sampler2D uFreshShrapnel;
uniform float uSnareHit;
uniform float uDropImpact;
uniform float uDropConfidence;
uniform float uMasterIntensity;
uniform float uMasterGlow;
out vec4 fragColor;

void main() {
  vec3 trails = texture(uShrapnelTrail, v_uv).rgb;
  vec3 fresh = texture(uFreshShrapnel, v_uv).rgb;
  vec3 col = trails + fresh * (0.42 + uDropImpact * 0.35);
  col = mix(col, vec3(1.0), uSnareHit * 0.18 + uDropConfidence * 0.06);
  col *= uMasterIntensity * (0.78 + uMasterGlow * 0.24);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`

export const TRAP_SHRAPNEL_REACTOR: ShaderDefinition = {
  id: 'shader-trap-shrapnel-reactor',
  name: 'Trap Shrapnel Reactor',
  description: 'A persistent angular debris reactor that charges through fakeouts, reverses on snares, and detonates on hybrid-trap drops.',
  category: 'particle',
  version: 1,

  passes: [
    { id: 'generator', fragSrc: SHRAPNEL_GENERATOR, inputs: [], output: 'fresh-shrapnel', resolutionScale: 1, clearBeforeRender: true },
    {
      id: 'feedback',
      fragSrc: SHRAPNEL_FEEDBACK,
      inputs: [
        { source: 'shrapnel-trail', uniformName: 'uPreviousShrapnel' },
        { source: 'fresh-shrapnel', uniformName: 'uFreshShrapnel' },
      ],
      output: 'shrapnel-trail',
      resolutionScale: 0.75,
      clearBeforeRender: false,
      pingPong: true,
      dependsOn: ['generator'],
    },
    {
      id: 'composite',
      fragSrc: SHRAPNEL_COMPOSITE,
      inputs: [
        { source: 'shrapnel-trail', uniformName: 'uShrapnelTrail' },
        { source: 'fresh-shrapnel', uniformName: 'uFreshShrapnel' },
      ],
      output: 'composite',
      resolutionScale: 1,
      clearBeforeRender: true,
      dependsOn: ['feedback'],
    },
  ],

  params: [
    { id: 'shardCount', type: 'integer', label: 'Shard Count', group: 'Particles', uniformName: 'uShardCount', min: 8, max: 64, step: 1, default: 42, modulatable: true },
    { id: 'shardScale', type: 'float', label: 'Shard Scale', group: 'Particles', uniformName: 'uShardScale', min: 0.25, max: 2.5, step: 0.05, default: 1.15, modulatable: true },
    { id: 'explosion', type: 'float', label: 'Explosion', group: 'Impact', uniformName: 'uExplosion', min: 0.2, max: 3, step: 0.05, default: 1.55, modulatable: true },
    { id: 'angularVelocity', type: 'float', label: 'Angular Velocity', group: 'Motion', uniformName: 'uAngularVelocity', min: -2, max: 2, step: 0.02, default: 0.22, modulatable: true },
    { id: 'trailAmount', type: 'float', label: 'Trail Amount', group: 'Feedback', uniformName: 'uTrailAmount', min: 0, max: 0.99, step: 0.01, default: 0.9, modulatable: true },
    { id: 'shardColor', type: 'color', label: 'Shards', group: 'Color', uniformName: 'uShardColor', brandRole: 'primary', default: [0.5, 0.05, 1, 1] },
    { id: 'coreColor', type: 'color', label: 'Core', group: 'Color', uniformName: 'uCoreColor', brandRole: 'secondary', default: [0.12, 0.28, 1, 1] },
    { id: 'impactColor', type: 'color', label: 'Impact', group: 'Color', uniformName: 'uImpactColor', brandRole: 'accent', default: [1, 0.34, 0.02, 1] },
    { id: 'backgroundColor', type: 'color', label: 'Background', group: 'Color', uniformName: 'uBackgroundColor', brandRole: 'background', default: [0.008, 0.003, 0.018, 1] },
  ],

  defaults: {
    shardCount: 42,
    shardScale: 1.15,
    explosion: 1.55,
    angularVelocity: 0.22,
    trailAmount: 0.9,
    shardColor: [0.5, 0.05, 1, 1],
    coreColor: [0.12, 0.28, 1, 1],
    impactColor: [1, 0.34, 0.02, 1],
    backgroundColor: [0.008, 0.003, 0.018, 1],
  },

  resetOnActivation: true,
  feedback: { pingPongBuffers: 1, historyFrames: 1 },
  feedbackReset: { onSceneChange: true, onTrackChange: true, onPlaybackRestart: true, onSectionChange: false, onDropImpact: true, dropImpactThreshold: 0.94, onResolutionChange: true, onContextRestore: true },
  quality: { minimumTier: 'medium', recommendedTier: 'high', particleLimit: { min: 16, recommended: 42, max: 64 }, estimatedPassCount: 3, requiresPersistentBuffers: true },
  transitions: { supportsGpuTransitions: true, supportedTransitionTypes: ['pixel-scatter', 'flash-cut', 'feedback-collapse', 'rgb-split-dissolve'] },
  thumbnail: { color: '#16052b' },
  tags: ['hybrid-trap', 'shrapnel', 'particles', 'feedback', 'fakeout', 'stems', 'brand-kit'],
}

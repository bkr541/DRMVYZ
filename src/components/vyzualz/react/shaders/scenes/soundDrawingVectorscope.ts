import type { ShaderDefinition } from '../registry/shaderRegistryTypes'
import { FEEDBACK_FRAG_SRC } from '../glsl/feedback.frag'
import { SOUND_DRAWING_BLOOM_TIERS } from './soundDrawingBloom'

// ── soundDrawingVectorscope ───────────────────────────────────────────────────
//
// Phase 3 Sound Drawing scene: a GPU vectorscope that draws the two-channel
// XY waveform (ShaderWaveformTextureXY) as an instanced-geometry polyline
// (GeometryPass), persists it through the engine's existing, shared feedback
// GLSL (FEEDBACK_FRAG_SRC — not a bespoke per-scene feedback shader), blooms
// it through three chromatic, differently-downsampled passes, and tone-maps
// the HDR accumulation back to display range.
//
// Pass pipeline (see the module docblocks below for why each shape is what
// it is):
//   draw      (geometry, additive, HDR) → "u_scene"
//   feedback  (pingPong, persistent, HDR, FEEDBACK_FRAG_SRC) → "u_feedback"
//   bloom1/2/3 (chromatic small-kernel blur, cheap via downsampling) → "u_bloomN"
//   composite (screen, Reinhard tonemap + luma-driven desaturation)
//
// Follows the idiom of feedbackKaleidoscope.ts: a plain exported
// ShaderDefinition constant, multi-pass array, params/defaults, and a quality
// block declaring requiresFloatTarget/requiresPersistentBuffers/
// estimatedPassCount. Like feedbackKaleidoscope.ts, this scene is exported
// for direct import/registration and test coverage but is intentionally NOT
// added to scenes/index.ts's PRODUCTION_SCENES — its geometry-pass segment
// data (built by soundDrawingVectorscopeGeometry.ts from live audio) has no
// wired production data source yet; see the Phase 3 summary for what a full
// ShaderEngineRenderer integration would still need to add.

export const SOUND_DRAWING_VECTORSCOPE_SCENE_ID = 'shader-sound-drawing-vectorscope'

// ── draw: geometry pass ───────────────────────────────────────────────────────
//
// Expands each instanced line segment into a camera-facing quad wide enough
// to cover the halo radius; the fragment shader computes a tight core term
// plus a wider, dimmer halo term as a function of distance across the quad,
// so ONE geometry draw call produces both the core and halo strokes (no
// second pass needed the way the Canvas2D rasterizer uses two stroke() calls).
//
// Samples live in an abstract -1..1 "world" space (both X and Y channels of
// the XY waveform); dividing clip-space X by uAspect (rather than the
// fragment-shader convention of multiplying a pixel-derived UV by aspect)
// is the correct dual operation for vertex-shader clip-space placement — it
// keeps a circular Lissajous pattern circular instead of stretched to the
// canvas's aspect ratio.
const DRAW_VERT_SRC = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_origin;
layout(location = 2) in vec2 a_target;
layout(location = 3) in vec4 a_color;
layout(location = 4) in float a_density;
layout(location = 5) in float a_dwellWeight;
layout(location = 6) in float a_velocityRatio;

uniform vec2 uResolution;
uniform float uAspect;
uniform float uHaloWidthPx;

out vec4 v_color;
out float v_density;
out float v_dwellWeight;
out float v_velocityRatio;
out float v_localY;

void main() {
  vec2 dir = a_target - a_origin;
  float len = length(dir);
  vec2 tangent = len > 1e-6 ? dir / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-tangent.y, tangent.x);

  vec2 pos = mix(a_origin, a_target, a_corner.x);

  float worldPerPixel = 2.0 / max(min(uResolution.x, uResolution.y), 1.0);
  pos += normal * a_corner.y * uHaloWidthPx * worldPerPixel;

  vec2 clipPos = pos;
  clipPos.x /= max(uAspect, 0.0001);

  gl_Position = vec4(clipPos, 0.0, 1.0);

  v_color = a_color;
  v_density = a_density;
  v_dwellWeight = a_dwellWeight;
  v_velocityRatio = a_velocityRatio;
  v_localY = a_corner.y * 2.0; // -1..1 across the quad
}
`

const DRAW_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec4 v_color;
in float v_density;
in float v_dwellWeight;
in float v_velocityRatio;
in float v_localY;

uniform vec4 uTraceColor;
uniform float uCoreWidthPx;
uniform float uHaloWidthPx;
uniform float uMasterIntensity;

out vec4 fragColor;

void main() {
  float coreFrac = clamp(uCoreWidthPx / max(uHaloWidthPx, 0.0001), 0.02, 1.0);
  float distAcross = abs(v_localY);

  float coreTerm = exp(-pow(distAcross / coreFrac, 2.0) * 4.0);
  float haloTerm = exp(-pow(distAcross, 2.0) * 2.0) * 0.35;

  // Exposure mirrors the Canvas2D beam-optics model's own formula:
  // density scaled up by corner dwell time (segments that linger at a cusp
  // read as brighter). Brightness is inversely proportional to velocityRatio's
  // complement — velocityRatio is already "how slow" (1 = slow = bright).
  float exposure = clamp(v_density * (0.55 + v_dwellWeight * 0.45), 0.0, 1.0);
  float brightness = mix(0.4, 1.0, v_velocityRatio);

  float intensity = (coreTerm + haloTerm) * exposure * brightness * uMasterIntensity;
  fragColor = vec4(v_color.rgb * uTraceColor.rgb * intensity, 1.0);
}
`

// ── bloomN: chromatic small-kernel blur ───────────────────────────────────────
//
// A single 8-tap radial kernel sampled independently per channel at that
// channel's own radius (red tightest, blue widest — SOUND_DRAWING_BLOOM_
// CHANNEL_SCALE, hand-transcribed from soundDrawingBloom.ts). Each of the
// three bloom passes runs at progressively smaller resolutionScale (see the
// pass list below), so the SAME small texel-space kernel radius maps to a
// much larger effective screen-space blur on the cheaper, lower-tier passes
// — the standard "downsample for cheap wide bloom" technique, and exactly
// what lets resolutionScale (already quality-tier-scaled) double as the bloom
// chain's own performance lever.
function bloomBlurFragSrc(sigmaUniform: string): string {
  return /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_feedback;
uniform vec2 uResolution;
uniform float ${sigmaUniform};

out vec4 fragColor;

const int TAP_COUNT = 8;
const vec3 CHANNEL_RADIUS_SCALE = vec3(1.0, 1.5, 2.5);

float channelTap(vec2 uv, vec2 texel, float radiusPx, vec3 mask) {
  vec3 sum = texture(u_feedback, uv).rgb;
  float wsum = 1.0;
  for (int i = 0; i < TAP_COUNT; i++) {
    float angle = (float(i) / float(TAP_COUNT)) * 6.28318530718;
    vec2 offset = vec2(cos(angle), sin(angle)) * radiusPx * texel;
    sum += texture(u_feedback, clamp(uv + offset, 0.0, 1.0)).rgb;
    wsum += 1.0;
  }
  return dot(sum / wsum, mask);
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  float red   = channelTap(v_uv, texel, ${sigmaUniform} * CHANNEL_RADIUS_SCALE.r, vec3(1.0, 0.0, 0.0));
  float green = channelTap(v_uv, texel, ${sigmaUniform} * CHANNEL_RADIUS_SCALE.g, vec3(0.0, 1.0, 0.0));
  float blue  = channelTap(v_uv, texel, ${sigmaUniform} * CHANNEL_RADIUS_SCALE.b, vec3(0.0, 0.0, 1.0));
  fragColor = vec4(red, green, blue, 1.0);
}
`
}

// ── composite: Reinhard tonemap + luma-driven desaturation ───────────────────
//
// Matches soundDrawingBloom.ts's resolveSoundDrawingToneMap exactly: Reinhard
// per-channel, then mix toward the mapped pixel's own luma in proportion to
// that luma — a dense, bright core (many overlapping additive strokes)
// desaturates toward white, while a dim halo sample keeps its base hue.
const COMPOSITE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_feedback;
uniform sampler2D u_bloom1;
uniform sampler2D u_bloom2;
uniform sampler2D u_bloom3;

uniform float uBloomWeight1;
uniform float uBloomWeight2;
uniform float uBloomWeight3;
uniform float uWhitenStrength;
uniform float uMasterGlow;

out vec4 fragColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 reinhard(vec3 c) { return c / (1.0 + c); }

void main() {
  vec3 base = texture(u_feedback, v_uv).rgb;
  vec3 b1 = texture(u_bloom1, v_uv).rgb;
  vec3 b2 = texture(u_bloom2, v_uv).rgb;
  vec3 b3 = texture(u_bloom3, v_uv).rgb;

  vec3 hdr = base + (b1 * uBloomWeight1 + b2 * uBloomWeight2 + b3 * uBloomWeight3) * max(uMasterGlow, 0.0);

  vec3 mapped = reinhard(max(hdr, vec3(0.0)));
  float l = luma(mapped);
  float whiten = clamp(l * uWhitenStrength, 0.0, 1.0);
  vec3 out3 = mix(mapped, vec3(l), whiten);

  fragColor = vec4(clamp(out3, 0.0, 1.0), 1.0);
}
`

export const SOUND_DRAWING_VECTORSCOPE: ShaderDefinition = {
  id: SOUND_DRAWING_VECTORSCOPE_SCENE_ID,
  name: 'Sound Drawing: Vectorscope',
  description: 'GPU XY vectorscope with additive geometry drawing, phosphor-style feedback persistence, and multi-scale chromatic bloom.',
  category: 'feedback',
  version: 1,

  passes: [
    {
      id: 'draw',
      drawKind: 'geometry',
      vertSrc: DRAW_VERT_SRC,
      fragSrc: DRAW_FRAG_SRC,
      inputs: [],
      output: 'u_scene',
      resolutionScale: 1.0,
      clearBeforeRender: true,
      blendMode: 'additive',
    },
    {
      id: 'feedback',
      fragSrc: FEEDBACK_FRAG_SRC,
      inputs: [
        { source: 'u_scene', uniformName: 'u_scene' },
        { source: 'u_feedback', uniformName: 'u_feedback' },
      ],
      output: 'u_feedback',
      pingPong: true,
      persistent: true,
      clearBeforeRender: false,
    },
    {
      id: 'bloom1',
      bloomTier: 1,
      fragSrc: bloomBlurFragSrc('uBloomSigma1Px'),
      inputs: [{ source: 'u_feedback', uniformName: 'u_feedback' }],
      output: 'u_bloom1',
      resolutionScale: 0.5,
      clearBeforeRender: true,
    },
    {
      id: 'bloom2',
      bloomTier: 2,
      fragSrc: bloomBlurFragSrc('uBloomSigma2Px'),
      inputs: [{ source: 'u_feedback', uniformName: 'u_feedback' }],
      output: 'u_bloom2',
      resolutionScale: 0.25,
      clearBeforeRender: true,
    },
    {
      id: 'bloom3',
      bloomTier: 3,
      fragSrc: bloomBlurFragSrc('uBloomSigma3Px'),
      inputs: [{ source: 'u_feedback', uniformName: 'u_feedback' }],
      output: 'u_bloom3',
      resolutionScale: 0.125,
      clearBeforeRender: true,
    },
    {
      id: 'composite',
      fragSrc: COMPOSITE_FRAG_SRC,
      inputs: [
        { source: 'u_feedback', uniformName: 'u_feedback' },
        { source: 'u_bloom1', uniformName: 'u_bloom1' },
        { source: 'u_bloom2', uniformName: 'u_bloom2' },
        { source: 'u_bloom3', uniformName: 'u_bloom3' },
      ],
      output: 'composite-out',
      clearBeforeRender: true,
    },
  ],

  params: [
    {
      id: 'traceColor',
      type: 'color',
      label: 'Trace Color',
      uniformName: 'uTraceColor',
      brandRole: 'accent',
      default: [240 / 255, 220 / 255, 70 / 255, 1.0],
    },
    {
      id: 'coreWidthPx',
      type: 'float',
      label: 'Core Width',
      uniformName: 'uCoreWidthPx',
      min: 0.5, max: 8, step: 0.1,
      default: 2,
      unit: 'px',
      modulatable: true,
    },
    {
      id: 'haloWidthPx',
      type: 'float',
      label: 'Halo Width',
      uniformName: 'uHaloWidthPx',
      min: 10, max: 140, step: 1,
      default: 60,
      unit: 'px',
      modulatable: true,
    },
    {
      id: 'decay',
      type: 'float',
      label: 'Trail Decay',
      description: 'Per-frame retention. ~0.59 decays to the noise floor in ~100ms at 60fps.',
      uniformName: 'u_decay',
      min: 0, max: 0.99, step: 0.01,
      default: 0.59,
      modulatable: true,
    },
    {
      id: 'lumaRetention',
      type: 'float',
      label: 'Phosphor Retention',
      description: 'How strongly bright pixels resist decay (phosphor persistence).',
      uniformName: 'u_lumaRetention',
      min: 0, max: 1, step: 0.01,
      default: 0.15,
      modulatable: true,
    },
    {
      id: 'zoom',
      type: 'float',
      label: 'Feedback Zoom',
      uniformName: 'u_zoom',
      min: 0.9, max: 1.1, step: 0.001,
      default: 1.0,
      modulatable: true,
      advanced: true,
    },
    {
      id: 'rotation',
      type: 'float',
      label: 'Feedback Rotation',
      uniformName: 'u_rotation',
      min: -0.2, max: 0.2, step: 0.001,
      default: 0,
      modulatable: true,
      advanced: true,
    },
    {
      id: 'saturation',
      type: 'float',
      label: 'Feedback Saturation',
      uniformName: 'u_saturation',
      min: 0, max: 2, step: 0.01,
      default: 1.0,
      modulatable: true,
      advanced: true,
    },
    {
      id: 'brightness',
      type: 'float',
      label: 'Feedback Brightness',
      uniformName: 'u_brightness',
      min: 0, max: 2, step: 0.01,
      default: 1.0,
      modulatable: true,
      advanced: true,
    },
    {
      id: 'feedbackBlendMode',
      type: 'enum',
      label: 'Feedback Blend',
      uniformName: 'u_blendMode',
      uniformType: 'int',
      values: [
        { value: 'normal', label: 'Normal' },
        { value: 'additive', label: 'Additive' },
        { value: 'screen', label: 'Screen' },
        { value: 'maximumLuma', label: 'Max Luma' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'difference', label: 'Difference' },
      ],
      default: 'additive',
      advanced: true,
    },
    {
      id: 'bloomSigma1Px',
      type: 'float',
      label: 'Bloom Tier 1 Radius',
      uniformName: 'uBloomSigma1Px',
      min: 0.5, max: 8, step: 0.1,
      default: SOUND_DRAWING_BLOOM_TIERS[0].sigmaPx,
      unit: 'px',
      modulatable: true,
    },
    {
      id: 'bloomSigma2Px',
      type: 'float',
      label: 'Bloom Tier 2 Radius',
      uniformName: 'uBloomSigma2Px',
      min: 4, max: 24, step: 0.5,
      default: SOUND_DRAWING_BLOOM_TIERS[1].sigmaPx,
      unit: 'px',
      modulatable: true,
    },
    {
      id: 'bloomSigma3Px',
      type: 'float',
      label: 'Bloom Tier 3 Radius',
      uniformName: 'uBloomSigma3Px',
      min: 16, max: 80, step: 1,
      default: SOUND_DRAWING_BLOOM_TIERS[2].sigmaPx,
      unit: 'px',
      modulatable: true,
    },
    {
      id: 'bloomWeight1',
      type: 'float',
      label: 'Bloom Tier 1 Weight',
      uniformName: 'uBloomWeight1',
      min: 0, max: 2, step: 0.01,
      default: SOUND_DRAWING_BLOOM_TIERS[0].weight,
      modulatable: true,
    },
    {
      id: 'bloomWeight2',
      type: 'float',
      label: 'Bloom Tier 2 Weight',
      uniformName: 'uBloomWeight2',
      min: 0, max: 2, step: 0.01,
      default: SOUND_DRAWING_BLOOM_TIERS[1].weight,
      modulatable: true,
    },
    {
      id: 'bloomWeight3',
      type: 'float',
      label: 'Bloom Tier 3 Weight',
      uniformName: 'uBloomWeight3',
      min: 0, max: 2, step: 0.01,
      default: SOUND_DRAWING_BLOOM_TIERS[2].weight,
      modulatable: true,
    },
    {
      id: 'whitenStrength',
      type: 'float',
      label: 'Core Whitening',
      description: 'How strongly dense, bright overlap desaturates toward white.',
      uniformName: 'uWhitenStrength',
      min: 0, max: 2, step: 0.01,
      default: 1.0,
      modulatable: true,
    },
  ],

  defaults: {
    traceColor: [240 / 255, 220 / 255, 70 / 255, 1.0],
    coreWidthPx: 2,
    haloWidthPx: 60,
    decay: 0.59,
    lumaRetention: 0.15,
    zoom: 1.0,
    rotation: 0,
    saturation: 1.0,
    brightness: 1.0,
    feedbackBlendMode: 'additive',
    bloomSigma1Px: SOUND_DRAWING_BLOOM_TIERS[0].sigmaPx,
    bloomSigma2Px: SOUND_DRAWING_BLOOM_TIERS[1].sigmaPx,
    bloomSigma3Px: SOUND_DRAWING_BLOOM_TIERS[2].sigmaPx,
    bloomWeight1: SOUND_DRAWING_BLOOM_TIERS[0].weight,
    bloomWeight2: SOUND_DRAWING_BLOOM_TIERS[1].weight,
    bloomWeight3: SOUND_DRAWING_BLOOM_TIERS[2].weight,
    whitenStrength: 1.0,
  },

  quality: {
    minimumTier: 'medium',
    recommendedTier: 'high',
    estimatedPassCount: 6,
    requiresFloatTarget: true,
    requiresPersistentBuffers: true,
  },

  feedback: { pingPongBuffers: 1 },

  feedbackReset: {
    onSceneChange: true,
    onTrackChange: true,
    onResolutionChange: true,
    onContextRestore: true,
  },

  thumbnail: { color: '#0a1a1a' },

  tags: ['sound-drawing', 'vectorscope', 'bloom', 'feedback', 'geometry'],

  resetOnActivation: true,
}

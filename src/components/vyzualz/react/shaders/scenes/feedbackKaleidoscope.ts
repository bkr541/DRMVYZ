import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

// Fragment shader: generator pass — geometric pattern source
const GENERATOR_FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBeatHit;
uniform float uKickHit;
uniform float uEnergy;
uniform float uBass;
uniform vec2  uResolution;
uniform float uAspect;

uniform float uSegments;
uniform float uRotationSpeed;
uniform float uDistortion;
uniform vec4  uColorShift;

uniform float uMasterIntensity;
uniform float uMasterMotion;
uniform float uMasterBassReactivity;

out vec4 fragColor;

float hash(float n) { return fract(sin(n)*43758.5453); }

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uAspect;

  float bass = uBass * uMasterBassReactivity;
  float speed = uRotationSpeed * uMasterMotion;

  // Rotate with beat
  float ang = uTime * speed + uBeatHit * 0.4 + uKickHit * 0.6;
  float cs = cos(ang); float sn = sin(ang);
  uv = vec2(uv.x*cs - uv.y*sn, uv.x*sn + uv.y*cs);

  // Polar coords
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // Kaleidoscope fold
  float segs = max(2.0, uSegments);
  float aPi = 3.14159265 / segs;
  a = mod(a, 2.0 * aPi);
  if (a > aPi) a = 2.0 * aPi - a;

  // Distortion
  float dist = uDistortion * (0.1 + bass * 0.15);
  float rD = r + sin(a * 6.0 + uTime * 1.3) * dist;
  vec2 p = vec2(cos(a), sin(a)) * rD;

  // Pattern
  float grid = sin(p.x * 8.0 + uTime * 0.5) * sin(p.y * 8.0 + uTime * 0.7);
  float ring = abs(sin(rD * 6.0 - uTime * speed * 2.0)) * (1.0 - r * 0.5);

  float pattern = grid * 0.4 + ring * 0.6;
  pattern = pow(max(pattern, 0.0), 1.5);

  // Color from colorShift
  vec3 col = uColorShift.rgb * pattern * uMasterIntensity;
  col += vec3(0.05, 0.1, 0.2) * ring * (0.3 + uEnergy * 0.4);

  // Kick flash
  col += uKickHit * vec3(0.3, 0.15, 0.05) * uMasterIntensity;

  fragColor = vec4(col, 1.0);
}
`

// Fragment shader: ping-pong feedback pass
const FEEDBACK_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D uPreviousFrame; // ping-pong previous result
uniform sampler2D uGenerator;     // current generator output

uniform float uTime;
uniform float uBeatHit;
uniform float uKickHit;
uniform float uFeedbackDecay;
uniform float uFeedbackZoom;
uniform float uRotationSpeed;

uniform float uMasterMotion;
uniform float uMasterTrailDecay;

out vec4 fragColor;

void main() {
  vec2 uv = v_uv;

  float decay  = uFeedbackDecay * uMasterTrailDecay;
  float zoom   = uFeedbackZoom;
  float speed  = uRotationSpeed * uMasterMotion;

  // Center the UV for zoom / rotation
  vec2 centered = uv - 0.5;

  // Rotate slightly each frame
  float angle = speed * 0.008 + uBeatHit * 0.025;
  float cs = cos(angle); float sn = sin(angle);
  centered = vec2(centered.x*cs - centered.y*sn, centered.x*sn + centered.y*cs);

  // Zoom toward center
  centered *= zoom;
  vec2 fbUv = centered + 0.5;

  // Sample previous frame (with wrap-clamp)
  fbUv = clamp(fbUv, 0.001, 0.999);
  vec4 prev = texture(uPreviousFrame, fbUv) * decay;

  // Sample current generator
  vec4 gen  = texture(uGenerator, uv);

  // Kick: disturbance burst
  float kick = uKickHit * 0.5;
  vec2 distUv = uv + vec2(sin(uv.y * 20.0 + uTime) * kick * 0.03,
                           cos(uv.x * 20.0 + uTime) * kick * 0.03);
  vec4 distPrev = texture(uPreviousFrame, clamp(distUv, 0.001, 0.999)) * decay;

  vec4 combined = max(prev * (1.0 - kick) + distPrev * kick, gen);
  fragColor = vec4(combined.rgb, 1.0);
}
`

// Fragment shader: final composite pass
const COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D uFeedback;
uniform sampler2D uGenerator;

uniform float uEnergy;
uniform float uBeatHit;
uniform float uMasterIntensity;
uniform float uMasterGlow;

out vec4 fragColor;

void main() {
  vec2 uv = v_uv;

  vec4 fb  = texture(uFeedback,  uv);
  vec4 gen = texture(uGenerator, uv);

  // Blend feedback with fresh generator signal
  vec3 col = fb.rgb + gen.rgb * 0.4;

  // Glow boost from energy
  col *= 1.0 + uEnergy * 0.3 * uMasterGlow;

  // Beat flash
  col = mix(col, col * 1.5, uBeatHit * 0.4);

  col *= uMasterIntensity;

  // Gamma
  col = pow(max(col, 0.0), vec3(0.454));

  fragColor = vec4(col, 1.0);
}
`

export const FEEDBACK_KALEIDOSCOPE: ShaderDefinition = {
  id: 'shader-feedback-kaleidoscope',
  name: 'Feedback Kaleidoscope',
  description: 'Multi-pass kaleidoscope with ping-pong feedback, rotation, decay, zoom, and beat disturbance.',
  category: 'feedback',
  version: 1,

  passes: [
    {
      id: 'generator',
      fragSrc: GENERATOR_FRAG,
      inputs: [],
      output: 'generator',
      resolutionScale: 1.0,
      clearBeforeRender: true,
      persistent: false,
      pingPong: false,
    },
    {
      id: 'feedback',
      fragSrc: FEEDBACK_FRAG,
      inputs: ['feedback', 'generator'],
      output: 'feedback',
      resolutionScale: 1.0,
      clearBeforeRender: false,
      persistent: false,
      pingPong: true,
    },
    {
      id: 'composite',
      fragSrc: COMPOSITE_FRAG,
      inputs: ['feedback', 'generator'],
      output: 'composite',
      resolutionScale: 1.0,
      clearBeforeRender: true,
    },
  ],

  params: [
    {
      id: 'segments',
      type: 'float',
      label: 'Segments',
      uniformName: 'uSegments',
      min: 2.0, max: 16.0, step: 1.0,
      default: 6.0,
      modulatable: false,
    },
    {
      id: 'rotationSpeed',
      type: 'float',
      label: 'Rotation Speed',
      uniformName: 'uRotationSpeed',
      min: 0.0, max: 3.0, step: 0.05,
      default: 0.4,
      modulatable: true,
    },
    {
      id: 'feedbackDecay',
      type: 'float',
      label: 'Feedback Decay',
      uniformName: 'uFeedbackDecay',
      min: 0.0, max: 0.99, step: 0.01,
      default: 0.88,
      modulatable: true,
    },
    {
      id: 'feedbackZoom',
      type: 'float',
      label: 'Feedback Zoom',
      uniformName: 'uFeedbackZoom',
      min: 0.9, max: 1.1, step: 0.001,
      default: 0.985,
      modulatable: true,
    },
    {
      id: 'distortion',
      type: 'float',
      label: 'Distortion',
      uniformName: 'uDistortion',
      min: 0.0, max: 2.0, step: 0.05,
      default: 0.5,
      modulatable: true,
    },
    {
      id: 'colorShift',
      type: 'color',
      label: 'Color Shift',
      uniformName: 'uColorShift',
      default: [0.6, 0.3, 0.9, 1.0],
    },
  ],

  defaults: {
    segments:      6.0,
    rotationSpeed: 0.4,
    feedbackDecay: 0.88,
    feedbackZoom:  0.985,
    distortion:    0.5,
    colorShift:    [0.6, 0.3, 0.9, 1.0],
  },

  quality: {
    minimumTier:               'medium',
    recommendedTier:           'high',
    estimatedPassCount:        3,
    requiresPersistentBuffers: true,
  },

  feedback: { pingPongBuffers: 1 },

  thumbnail: { color: '#1a0a2a' },

  tags: ['kaleidoscope', 'feedback', 'symmetry'],
}

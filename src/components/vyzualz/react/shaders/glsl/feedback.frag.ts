import type { ShaderDefinition } from '../registry/shaderRegistryTypes'

// ── feedback.frag.ts ──────────────────────────────────────────────────────────
//
// GLSL 300 es fragment shader for the Shader engine's built-in feedback pass.
//
// Input textures (sampler names are also the logical pass input names):
//   u_scene     — current rendered scene frame
//   u_feedback  — previous feedback frame (from ping-pong read buffer)
//   u_noise     — optional noise texture for UV displacement
//
// All value parameters are clamped inside the shader to safe ranges so that
// no upstream misconfiguration can cause runaway brightness, NaN coordinates,
// or uncontrolled white accumulation.

export const FEEDBACK_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

// ── Samplers ──────────────────────────────────────────────────────────────────
uniform sampler2D u_scene;
uniform sampler2D u_feedback;
uniform sampler2D u_noise;
uniform int       u_hasNoise;   // 1 if u_noise is bound, else 0

// ── Transform ─────────────────────────────────────────────────────────────────
uniform float u_decay;          // 0..1 — fraction of prev frame to retain
uniform float u_zoom;           // ≥0.001 — 1.0 = no zoom
uniform float u_rotation;       // radians
uniform float u_translationX;   // -1..1 (applied in UV-half-space)
uniform float u_translationY;

// ── Displacement ─────────────────────────────────────────────────────────────
uniform float u_noiseDisp;      // 0..1 — noise UV offset scale
uniform float u_smearAngle;     // radians — smear direction
uniform float u_smearStrength;  // 0..1

// ── Color ─────────────────────────────────────────────────────────────────────
uniform float u_chromaticSep;   // 0..1 — lateral RGB channel separation
uniform float u_lumaRetention;  // 0..1 — bright pixels resist decay more
uniform float u_saturation;     // 0=gray, 1=normal, >1=hyper
uniform float u_brightness;     // 1=neutral

// ── Control ──────────────────────────────────────────────────────────────────
uniform float u_freeze;         // >0.5 → pass feedback through unchanged
uniform float u_clearPulse;     // 0..1 → blend output toward black
uniform int   u_blendMode;      // 0=normal 1=additive 2=screen 3=maxLuma 4=multiply 5=difference

out vec4 fragColor;

// ── Helpers ───────────────────────────────────────────────────────────────────

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 applySaturation(vec3 rgb, float sat) {
  return mix(vec3(luma(rgb)), rgb, sat);
}

vec2 feedbackUV(vec2 uv) {
  vec2 c  = uv - 0.5;
  // Rotation
  float cs = cos(u_rotation), sn = sin(u_rotation);
  c = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  // Zoom — clamp to avoid degenerate divide
  c /= max(u_zoom, 0.001);
  // Translation (half-UV-space so ±1 scrolls one full screen)
  c += vec2(u_translationX, u_translationY) * 0.5;
  return c + 0.5;
}

// ── Main ──────────────────────────────────────────────────────────────────────

void main() {
  vec2 uv = v_uv;

  // Freeze: pass previous feedback through without any modification.
  if (u_freeze > 0.5) {
    fragColor = vec4(texture(u_feedback, uv).rgb, 1.0);
    return;
  }

  // Current scene sample.
  vec4 scene = texture(u_scene, uv);

  // Feedback UV with transform.
  vec2 fbUV = feedbackUV(uv);

  // Noise displacement.
  if (u_hasNoise == 1 && u_noiseDisp > 0.0) {
    vec2 n = (texture(u_noise, uv).rg - 0.5) * clamp(u_noiseDisp, 0.0, 1.0) * 0.1;
    fbUV += n;
  }

  // Smear displacement.
  if (u_smearStrength > 0.0) {
    vec2 sd = vec2(cos(u_smearAngle), sin(u_smearAngle))
              * clamp(u_smearStrength, 0.0, 1.0) * 0.02;
    fbUV += sd;
  }

  // Clamp — never sample outside [0,1] to avoid border artifacts.
  fbUV = clamp(fbUV, 0.0, 1.0);

  // Sample feedback with optional chromatic separation.
  vec4 prev;
  if (u_chromaticSep > 0.0) {
    float sep = clamp(u_chromaticSep, 0.0, 1.0) * 0.025;
    float r   = texture(u_feedback, clamp(fbUV + vec2(sep, 0.0), 0.0, 1.0)).r;
    float g   = texture(u_feedback, fbUV).g;
    float b   = texture(u_feedback, clamp(fbUV - vec2(sep, 0.0), 0.0, 1.0)).b;
    prev = vec4(r, g, b, 1.0);
  } else {
    prev = texture(u_feedback, fbUV);
  }

  // Decay with luma retention.
  float safeDecay = clamp(u_decay, 0.0, 1.0);
  float fbLuma    = luma(prev.rgb);
  float retDecay  = safeDecay + clamp(u_lumaRetention, 0.0, 1.0) * fbLuma * (1.0 - safeDecay);
  vec3 decayed    = prev.rgb * clamp(retDecay, 0.0, 1.0);

  // Color adjustments on decayed feedback.
  decayed  = applySaturation(decayed, max(u_saturation, 0.0));
  decayed *= max(u_brightness, 0.0);
  decayed  = clamp(decayed, 0.0, 1.0);   // hard clamp — no runaway accumulation

  // Combine scene with decayed feedback.
  vec3 sceneRGB = scene.rgb * scene.a;
  vec3 out3;

  if (u_blendMode == 1) {
    // Additive: feedback + scene contribution
    out3 = decayed + sceneRGB;
  } else if (u_blendMode == 2) {
    // Screen: 1-(1-a)(1-b)
    out3 = vec3(1.0) - (vec3(1.0) - decayed) * (vec3(1.0) - sceneRGB);
  } else if (u_blendMode == 3) {
    // Maximum luma: take whichever pixel is brighter
    out3 = luma(sceneRGB) > luma(decayed) ? sceneRGB : decayed;
  } else if (u_blendMode == 4) {
    // Multiply: darkens the feedback
    out3 = decayed * max(sceneRGB, vec3(1e-4));
  } else if (u_blendMode == 5) {
    // Difference
    out3 = abs(decayed - sceneRGB);
  } else {
    // Normal (0): alpha-composite scene over decayed feedback
    out3 = mix(decayed, scene.rgb, scene.a);
  }

  // Final clamp and clear pulse.
  out3 = clamp(out3, 0.0, 1.0);
  out3 = mix(out3, vec3(0.0), clamp(u_clearPulse, 0.0, 1.0));

  fragColor = vec4(out3, 1.0);
}
`

// ── Dev demo generator ────────────────────────────────────────────────────────
//
// A simple moving-ring generator used by the internal dev feedback demo.
// Not exposed as a production preset.

export const DEV_GENERATOR_FRAG_SRC = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
uniform float u_time;

out vec4 fragColor;

void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float angle = atan(p.y, p.x);
  float speed = u_time * 0.8;
  float ring  = smoothstep(0.16, 0.18, r) - smoothstep(0.19, 0.21, r);
  float col   = sin(angle * 6.0 + speed) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.05, 0.2, 0.9), vec3(0.9, 0.1, 0.5), col);
  fragColor = vec4(c * ring, ring * 0.85);
}
`

// ── Dev demo blit ─────────────────────────────────────────────────────────────

export const DEV_BLIT_FRAG_SRC = /* glsl */ `#version 300 es
precision mediump float;

in vec2 v_uv;
uniform sampler2D u_feedback;

out vec4 fragColor;

void main() {
  fragColor = vec4(texture(u_feedback, v_uv).rgb, 1.0);
}
`

// ── Dev demo ShaderDefinition ─────────────────────────────────────────────────
//
// Internal development scene: moving ring + ping-pong feedback.
// Tagged ['dev', 'internal'] — not exposed as a production preset.
//
// Pass pipeline:
//   generator  → "u_scene"    (FBO, temporary)
//   feedback   → "u_feedback" (ping-pong)  reads: u_scene + prev u_feedback
//   blit       → screen        reads: u_feedback

export const DEV_FEEDBACK_DEMO_DEF: ShaderDefinition = {
  id:          'shader-dev-feedback-demo',
  name:        '[DEV] Feedback Demo',
  description: 'Internal development scene demonstrating ping-pong feedback. Not a production preset.',
  category:    'feedback',
  version:     1,
  params:      [],
  defaults:    {},
  tags:        ['dev', 'internal'],
  passes: [
    {
      id:                'generator',
      fragSrc:           DEV_GENERATOR_FRAG_SRC,
      inputs:            [],
      output:            'u_scene',
      clearBeforeRender: true,
    },
    {
      id:      'feedback',
      fragSrc: FEEDBACK_FRAG_SRC,
      inputs:  ['u_scene', 'u_feedback'],
      output:  'u_feedback',
      pingPong: true,
      clearBeforeRender: false,
      persistent: true,
    },
    {
      id:     'blit',
      fragSrc: DEV_BLIT_FRAG_SRC,
      inputs:  ['u_feedback'],
      output:  'blit-out',   // last pass → compiled with outputName=null → screen
    },
  ],
  feedback: { pingPongBuffers: 1 },
  feedbackReset: {
    onSceneChange:      true,
    onResolutionChange: true,
  },
}

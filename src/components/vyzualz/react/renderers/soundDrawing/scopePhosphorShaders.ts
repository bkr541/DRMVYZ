import { FULLSCREEN_VERT_SRC } from '../../shaders/runtime/FullscreenPass'

// ── scopePhosphorShaders ──────────────────────────────────────────────────────
//
// GLSL for the Sound Drawing phosphor pipeline. Derived from the vectorscope
// scene's passes, with two deliberate changes documented at their sites: the
// beam profile now tapers to zero at the quad edge, and persistence takes a
// frame-rate-independent decay.
//
// The numeric behaviour these implement is pinned in soundDrawingPhosphorPlan.ts
// and soundDrawingBloom.ts, which are unit-testable; GLSL is not. Any change
// here must be mirrored there.

export { FULLSCREEN_VERT_SRC }

// ── Beam emission ─────────────────────────────────────────────────────────────

/**
 * Expands each instanced segment into a screen-space quad.
 *
 * `a_corner.y` is ±0.5, so `uHaloWidthPx` is the quad's FULL width in pixels.
 * `v_localY` is rescaled to ±1 so the fragment shader measures across the quad
 * in normalised units.
 */
export const SCOPE_BEAM_VERT_SRC = /* glsl */ `#version 300 es
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

  // World units per pixel. Incoming positions are already in the isotropic
  // world space packVectorBeamSegments produces, so the shorter viewport axis
  // sets the scale and the aspect division below restores clip space.
  float worldPerPixel = 2.0 / max(min(uResolution.x, uResolution.y), 1.0);
  pos += normal * a_corner.y * uHaloWidthPx * worldPerPixel;

  vec2 clipPos = pos;
  clipPos.x /= max(uAspect, 0.0001);

  gl_Position = vec4(clipPos, 0.0, 1.0);

  v_color = a_color;
  v_density = a_density;
  v_dwellWeight = a_dwellWeight;
  v_velocityRatio = a_velocityRatio;
  v_localY = a_corner.y * 2.0;
}
`

/**
 * Nested-Gaussian beam profile with velocity-weighted exposure, emitting
 * unclamped HDR so overlapping strokes accumulate into hotter intersections.
 *
 * Two departures from the vectorscope scene's fragment shader:
 *
 * 1. The profile is multiplied by an edge taper. Both Gaussians are measured in
 *    quad-relative units, so the halo term still had ~3.5% of peak intensity at
 *    the quad boundary — a faint hard-edged band running parallel to every beam.
 *    Widening the quad could not fix it, because the profile scales with the
 *    quad. The taper forces the profile to reach zero exactly at the edge.
 *    See BEAM_PROFILE_EDGE_RESIDUAL in soundDrawingBeamPacking.ts.
 *
 * 2. Emission is not clamped to 1. The geometry pass writes into an HDR target
 *    specifically so intersections can exceed display white and be brought back
 *    by tone mapping later; clamping here would flatten them before the bloom
 *    and tone-map stages ever see them.
 */
export const SCOPE_BEAM_FRAG_SRC = /* glsl */ `#version 300 es
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
uniform float uExposureScale;

out vec4 fragColor;

void main() {
  float coreFrac = clamp(uCoreWidthPx / max(uHaloWidthPx, 0.0001), 0.02, 1.0);
  float distAcross = clamp(abs(v_localY), 0.0, 1.0);

  float coreTerm = exp(-pow(distAcross / coreFrac, 2.0) * 4.0);
  float haloTerm = exp(-pow(distAcross, 2.0) * 2.0) * 0.35;

  // Taper to zero at the quad edge. smoothstep rather than a linear ramp so the
  // derivative also vanishes and the seam does not simply move.
  float edgeTaper = 1.0 - smoothstep(0.75, 1.0, distAcross);

  // Corner dwell brightens segments that linger at a cusp; velocityRatio is
  // already "how slow" (1 = slow = bright), matching the Canvas2D beam optics.
  float exposure = clamp(v_density * (0.55 + v_dwellWeight * 0.45), 0.0, 1.0);
  float brightness = mix(0.4, 1.0, clamp(v_velocityRatio, 0.0, 1.0));

  float intensity = (coreTerm + haloTerm) * edgeTaper * exposure * brightness
                  * uMasterIntensity * uExposureScale;

  fragColor = vec4(v_color.rgb * uTraceColor.rgb * intensity, 1.0);
}
`

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Phosphor persistence: decayed history plus current emission.
 *
 * `uDecay` is supplied per frame by resolveScopePersistenceDecay as
 * `exp(-dt / tau)` — a decay expressed per *frame* would make the trail twice as
 * long at 120fps as at 60fps.
 *
 * Additive accumulation with a saturation ceiling rather than `max()`: `max`
 * cannot express a beam retracing its own path getting brighter, which is the
 * behaviour that produces hot intersections on a real phosphor. The ceiling
 * keeps the HDR target from growing without bound on a static figure.
 */
export const SCOPE_PERSISTENCE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_previous;
uniform sampler2D u_emission;
uniform float uDecay;
uniform float uMaxSceneValue;

out vec4 fragColor;

void main() {
  vec3 previous = texture(u_previous, v_uv).rgb;
  vec3 emission = texture(u_emission, v_uv).rgb;

  vec3 decayed = previous * clamp(uDecay, 0.0, 1.0);
  vec3 accumulated = decayed + emission;

  // Saturating ceiling, not a hard clamp: values approach the target's usable
  // maximum asymptotically so a bright intersection keeps some headroom above a
  // merely bright stroke instead of both pinning to the same value.
  float ceilingValue = max(uMaxSceneValue, 1.0);
  vec3 saturated = ceilingValue * (accumulated / (ceilingValue + accumulated));

  fragColor = vec4(max(saturated, vec3(0.0)), 1.0);
}
`

// ── Bloom ─────────────────────────────────────────────────────────────────────

/**
 * Separable-in-spirit radial blur with per-channel radii.
 *
 * Red blurs tightest and blue widest, matching SOUND_DRAWING_BLOOM_CHANNEL_SCALE
 * — the chromatic bleed that gives a phosphor its coloured tail. Each level runs
 * at a smaller target scale, so one small texel-space kernel becomes a much
 * wider effective screen-space blur on the cheaper levels.
 */
export const SCOPE_BLOOM_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_source;
uniform vec2 uResolution;
uniform float uSigmaPx;
uniform vec3 uChannelRadiusScale;
uniform float uThreshold;

out vec4 fragColor;

const int TAP_COUNT = 8;

float channelBlur(vec2 uv, vec2 texel, float radiusPx, vec3 mask) {
  vec3 sum = texture(u_source, uv).rgb;
  float weight = 1.0;
  for (int i = 0; i < TAP_COUNT; i++) {
    float angle = (float(i) / float(TAP_COUNT)) * 6.28318530718;
    vec2 offset = vec2(cos(angle), sin(angle)) * radiusPx * texel;
    // Clamped so the kernel cannot wrap or pull in the black border, either of
    // which shows as a dark halo along the frame edge.
    sum += texture(u_source, clamp(uv + offset, vec2(0.0), vec2(1.0))).rgb;
    weight += 1.0;
  }
  return dot(sum / weight, mask);
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));

  // Soft-knee highlight extraction, applied before blurring so dim beam bodies
  // do not smear into a uniform fog.
  vec3 source = texture(u_source, v_uv).rgb;
  float brightness = max(max(source.r, source.g), source.b);
  float knee = smoothstep(uThreshold, uThreshold + 0.5, brightness);

  float red   = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.r, vec3(1.0, 0.0, 0.0));
  float green = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.g, vec3(0.0, 1.0, 0.0));
  float blue  = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.b, vec3(0.0, 0.0, 1.0));

  fragColor = vec4(vec3(red, green, blue) * knee, 1.0);
}
`

// ── Composite ─────────────────────────────────────────────────────────────────

/**
 * Combines persistence with the bloom levels, tone-maps, and writes display
 * range.
 *
 * Reinhard plus luma-driven desaturation, matching resolveSoundDrawingToneMap:
 * a dense core of many overlapping strokes pulls toward white while a dim halo
 * keeps its hue. Unused bloom levels are bound to a black texture and weighted
 * zero, so the same program serves every quality tier without recompiling —
 * recompiling a shader on a tier change would stall the frame it happens on.
 */
export const SCOPE_COMPOSITE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_persistence;
uniform sampler2D u_bloom0;
uniform sampler2D u_bloom1;
uniform sampler2D u_bloom2;

uniform vec3 uBloomWeights;
uniform float uGlow;
uniform float uWhitenStrength;
uniform vec3 uBackgroundColor;
uniform float uBackgroundLift;

out vec4 fragColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 reinhard(vec3 c) { return c / (1.0 + c); }

void main() {
  vec3 base = texture(u_persistence, v_uv).rgb;
  vec3 bloom = texture(u_bloom0, v_uv).rgb * uBloomWeights.x
             + texture(u_bloom1, v_uv).rgb * uBloomWeights.y
             + texture(u_bloom2, v_uv).rgb * uBloomWeights.z;

  vec3 hdr = base + bloom * max(uGlow, 0.0);

  vec3 mapped = reinhard(max(hdr, vec3(0.0)));
  float l = luma(mapped);

  // Desaturate only genuinely hot pixels. A linear luma-times-strength term
  // greys out the ordinary trace too: after Reinhard a normal stroke sits near
  // 0.7, so a linear ramp would strip ~70% of its hue. The knee keeps the beam
  // body saturated and reserves whitening for overlapping intersections, which
  // is the behaviour the HDR path exists to produce.
  float whiten = smoothstep(0.75, 1.0, l) * clamp(uWhitenStrength, 0.0, 1.0);
  vec3 toned = mix(mapped, vec3(l), whiten);

  // Background lift keeps the tube from reading as absolute black, the way a
  // real CRT's unexcited phosphor never is.
  vec3 lifted = toned + uBackgroundColor * uBackgroundLift * (1.0 - l);

  fragColor = vec4(clamp(lifted, 0.0, 1.0), 1.0);
}
`

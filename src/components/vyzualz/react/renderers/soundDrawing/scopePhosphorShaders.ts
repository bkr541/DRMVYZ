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
uniform float uFixedPhosphorColor;
uniform float uCoreWidthPx;
uniform float uHaloWidthPx;
uniform float uMasterIntensity;
uniform float uExposureScale;
uniform float uVelocityBrightness;
uniform float uCornerDwell;

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
  // Both responses are user-scalable, and at 0 each collapses to a flat term so
  // the trace reads as uniform brightness rather than losing energy.
  float dwell = clamp(uCornerDwell, 0.0, 1.0);
  // A straight segment still deposits energy. Scaling all the way to zero made
  // high-dwell presets render only isolated corners instead of a continuous
  // beam. The 0.55 floor matches the shared Canvas2D beam response.
  float dwellResponse = mix(
    1.0,
    mix(0.55, 1.0, clamp(v_dwellWeight, 0.0, 1.0)),
    dwell
  );
  float velocity = clamp(uVelocityBrightness, 0.0, 1.0);
  float velocityResponse = mix(
    1.0,
    mix(0.4, 1.0, clamp(v_velocityRatio, 0.0, 1.0)),
    velocity
  );
  float exposure = clamp(v_density * dwellResponse * velocityResponse, 0.0, 1.0);

  float intensity = (coreTerm + haloTerm) * edgeTaper * exposure
                  * uMasterIntensity * uExposureScale;

  // RGB/disabled CRT uses the authored per-segment colour. A fixed phosphor
  // model replaces it: multiplying amber or white by a green vertex colour
  // cannot produce the requested tube colour, especially when the Low tier
  // omits the later CRT presentation pass.
  vec3 emissionColor = mix(
    v_color.rgb * uTraceColor.rgb,
    uTraceColor.rgb,
    clamp(uFixedPhosphorColor, 0.0, 1.0)
  );
  fragColor = vec4(emissionColor * intensity, 1.0);
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
  vec3 accumulated = max(decayed + emission, vec3(0.0));

  // Saturating ceiling on LUMINANCE, scaling all channels together, so the hue
  // ratio survives.
  //
  // Applying the curve per channel destroys colour on anything that accumulates:
  // a long-persistence trace on a static figure converges far above the ceiling,
  // every channel pins near it, and the ratio that carried the hue flattens to
  // white. Scaling by a single factor keeps a saturated cyan core cyan.
  float ceilingValue = max(uMaxSceneValue, 1.0);
  float peak = max(max(accumulated.r, accumulated.g), accumulated.b);
  vec3 saturated = accumulated;
  if (peak > 1e-5) {
    float saturatedPeak = ceilingValue * (peak / (ceilingValue + peak));
    saturated = accumulated * (saturatedPeak / peak);
  }

  fragColor = vec4(saturated, 1.0);
}
`

// ── Bloom ─────────────────────────────────────────────────────────────────────

/**
 * One axis of a separable Gaussian blur, with per-channel radii.
 *
 * Separable and Gaussian, not a single-radius ring. A ring kernel — 8 taps all
 * at the same offset distance — does not blur, it convolves with a circle: a
 * circular trace came out as a rosette of eight displaced copies of itself,
 * because that is literally what the kernel describes. Weighted taps spread
 * along one axis, run twice, are what produce a smooth falloff.
 *
 * Red blurs tightest and blue widest, matching SOUND_DRAWING_BLOOM_CHANNEL_SCALE
 * — the chromatic bleed that gives a phosphor its coloured tail. Each level runs
 * at a smaller target scale, so the same texel-space kernel becomes a much wider
 * effective screen-space blur on the cheaper levels.
 */
export const SCOPE_BLOOM_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_source;
uniform vec2 uResolution;
uniform float uSigmaPx;
uniform vec3 uChannelRadiusScale;
uniform float uThreshold;
uniform float uGain;
/** (1,0) for the horizontal pass, (0,1) for the vertical. */
uniform vec2 uDirection;
/** 1 on the first (extracting) axis, 0 on the second. */
uniform float uExtract;

out vec4 fragColor;

/**
 * Taps either side of centre.
 *
 * Sized so the kernel reaches ~3 sigma, where the Gaussian weight is ~0.01. A
 * kernel truncated while its weight is still high is a box, not a Gaussian, and
 * two separable box passes produce a *square* support region — which showed up
 * as a square halo around the trace. The previous budget stopped at 1.6 sigma
 * with the weight still at 0.28.
 */
const int TAP_RADIUS = 8;

/**
 * Soft-knee highlight extraction for one tap.
 *
 * Applied per sample, inside the blur. Thresholding the *result* instead — that
 * is, blurring the raw image and multiplying by the destination fragment's own
 * brightness — silently deletes the entire halo: away from the trace the local
 * brightness is zero, so the spread energy is multiplied to nothing at exactly
 * the pixels the glow is supposed to occupy. Extract, then blur.
 */
vec3 extractHighlight(vec3 c) {
  float brightness = max(max(c.r, c.g), c.b);
  return c * smoothstep(uThreshold, uThreshold + 0.5, brightness);
}

/** Sample with extraction applied only on the first axis. */
vec3 sampleSource(vec2 uv) {
  // Clamped so the kernel cannot wrap or pull in the black border, either of
  // which shows as a dark line along the frame edge.
  vec3 c = texture(u_source, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
  return uExtract > 0.5 ? extractHighlight(c) : c;
}

/** Weighted Gaussian sum along uDirection at this channel's radius. */
float channelBlur(vec2 uv, vec2 texel, float sigmaPx, vec3 mask) {
  float sigma = max(sigmaPx, 0.0001);
  // Spread the tap budget across +/-2 sigma, but never skip texels: a step
  // wider than one texel turns the kernel into a sparse comb, which reads as an
  // axis-aligned lattice around the trace rather than a smooth falloff. Levels
  // reach further by rendering into a smaller target, not by striding further.
  float step = min((sigma * 2.0) / float(TAP_RADIUS), 1.0);

  vec3 sum = sampleSource(uv);
  float weightSum = 1.0;

  for (int i = 1; i <= TAP_RADIUS; i++) {
    float distancePx = float(i) * step;
    float weight = exp(-(distancePx * distancePx) / (2.0 * sigma * sigma));
    vec2 offset = uDirection * distancePx * texel;
    sum += sampleSource(uv + offset) * weight;
    sum += sampleSource(uv - offset) * weight;
    weightSum += weight * 2.0;
  }

  return dot(sum / weightSum, mask);
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));

  float red   = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.r, vec3(1.0, 0.0, 0.0));
  float green = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.g, vec3(0.0, 1.0, 0.0));
  float blue  = channelBlur(v_uv, texel, uSigmaPx * uChannelRadiusScale.b, vec3(0.0, 0.0, 1.0));

  // uGain compensates the peak a thin feature loses to downsampling. A trace is
  // thin in one dimension, so rendering it into a half-scale target roughly
  // halves its peak; without the gain the wide levels — the ones that produce
  // the atmospheric halo — arrive far too dim to see against black. Applied on
  // the second axis only, so it is not squared by the two passes.
  float gain = uExtract > 0.5 ? 1.0 : max(uGain, 0.0);
  fragColor = vec4(vec3(red, green, blue) * gain, 1.0);
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
uniform float uTransparentBackground;

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
  vec3 lifted = toned + uBackgroundColor * uBackgroundLift * (1.0 - l) * (1.0 - uTransparentBackground);
  vec3 outputColor = clamp(lifted, 0.0, 1.0);
  float signalAlpha = smoothstep(0.001, 0.045, max(max(outputColor.r, outputColor.g), outputColor.b));
  float outputAlpha = mix(1.0, signalAlpha, clamp(uTransparentBackground, 0.0, 1.0));

  fragColor = vec4(outputColor, outputAlpha);
}
`

// ── CRT presentation ──────────────────────────────────────────────────────────

/**
 * Optional CRT layer: curvature, scanlines, edge defocus, vignette, grain, and
 * an optional graticule.
 *
 * Deliberately contains no animated artifact. Flicker, vertical roll, and
 * horizontal jitter are the CRT effects that carry photosensitivity risk, and
 * this pass has no time uniform at all — so they cannot be added by setting a
 * value. Static character carries the tube identity without motion.
 *
 * Runs after tone mapping, on display-range colour. Curving or scanlining HDR
 * values before compression would let a bright intersection survive the
 * scanline it should have been dimmed by.
 */
export const SCOPE_CRT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_source;
uniform vec2 uResolution;

uniform float uScanlineStrength;
uniform float uScanlineDensity;
uniform float uCurvature;
uniform float uVignette;
uniform float uEdgeDefocus;
uniform float uGrain;
uniform float uTransparentBackground;

uniform vec3 uPhosphorColor;
/** 1 when the phosphor model tints the image, 0 for an untinted RGB display. */
uniform float uPhosphorTint;

uniform float uGraticuleBrightness;
/** 0 none, 1 minimal, 2 scope grid, 3 vectorscope rings. */
uniform int uGraticuleStyle;

out vec4 fragColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

/** Barrel distortion about the screen centre. */
vec2 curveUv(vec2 uv, float amount) {
  vec2 centered = uv * 2.0 - 1.0;
  float r2 = dot(centered, centered);
  centered *= 1.0 + amount * r2 * 0.35;
  return centered * 0.5 + 0.5;
}

/** Cheap 4-tap defocus, widening toward the tube edge. */
vec3 sampleDefocused(vec2 uv, vec2 texel, float amount) {
  vec3 centre = texture(u_source, uv).rgb;
  if (amount <= 0.001) return centre;
  vec3 blurred = centre;
  blurred += texture(u_source, clamp(uv + vec2(texel.x, 0.0) * amount, 0.0, 1.0)).rgb;
  blurred += texture(u_source, clamp(uv - vec2(texel.x, 0.0) * amount, 0.0, 1.0)).rgb;
  blurred += texture(u_source, clamp(uv + vec2(0.0, texel.y) * amount, 0.0, 1.0)).rgb;
  blurred += texture(u_source, clamp(uv - vec2(0.0, texel.y) * amount, 0.0, 1.0)).rgb;
  return blurred / 5.0;
}

/**
 * Graticule intensity at this pixel.
 *
 * Drawn procedurally rather than from a texture so it stays crisp at any
 * resolution. Presented as a reference overlay only — the brief is explicit that
 * this must not be positioned as calibrated measurement, so the divisions are
 * evenly spaced guides with no unit labels.
 */
float graticule(vec2 uv, vec2 texel) {
  if (uGraticuleStyle == 0) return 0.0;

  vec2 centered = uv * 2.0 - 1.0;
  float line = max(texel.x, texel.y) * 1.5;
  float value = 0.0;

  // Centre axes, common to every style.
  value = max(value, 1.0 - smoothstep(0.0, line * 2.0, abs(centered.x)));
  value = max(value, 1.0 - smoothstep(0.0, line * 2.0, abs(centered.y)));
  if (uGraticuleStyle == 1) return value;

  if (uGraticuleStyle == 3) {
    // Vectorscope: concentric rings plus the two correlation diagonals, which
    // are where a mono-compatible and an anti-phase signal sit.
    //
    // Measured in aspect-corrected space so the rings are actually circular. UV
    // space is anisotropic on a non-square canvas, and an elliptical ring would
    // misstate the amplitude it marks — the one thing a reference overlay on a
    // correlation display must not do. The same reasoning as the trace's own
    // aspect handling in packVectorBeamSegments.
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 circular = vec2(centered.x * aspect, centered.y);

    for (int i = 1; i <= 3; i++) {
      float radius = float(i) / 3.0;
      float d = abs(length(circular) - radius);
      value = max(value, 1.0 - smoothstep(0.0, line * 2.0, d));
    }
    // The +/-45 degree lines in that same circular space.
    float diagA = abs(circular.y - circular.x) * 0.70710678;
    float diagB = abs(circular.y + circular.x) * 0.70710678;
    value = max(value, (1.0 - smoothstep(0.0, line * 2.0, diagA)) * 0.6);
    value = max(value, (1.0 - smoothstep(0.0, line * 2.0, diagB)) * 0.6);
    return value;
  }

  // Scope grid: eight horizontal and ten vertical divisions.
  vec2 grid = abs(fract(vec2(centered.x * 5.0, centered.y * 4.0)) - 0.5);
  vec2 gridLine = vec2(line * 5.0, line * 4.0);
  value = max(value, (1.0 - smoothstep(0.0, gridLine.x, grid.x)) * 0.45);
  value = max(value, (1.0 - smoothstep(0.0, gridLine.y, grid.y)) * 0.45);
  return value;
}

void main() {
  vec2 texel = 1.0 / max(uResolution, vec2(1.0));
  vec2 uv = curveUv(v_uv, uCurvature);

  // Outside the curved tube is bezel, not signal.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0 - clamp(uTransparentBackground, 0.0, 1.0));
    return;
  }

  vec2 centered = uv * 2.0 - 1.0;
  float edge = clamp(dot(centered, centered), 0.0, 1.0);

  vec4 sourceSample = texture(u_source, uv);
  vec3 color = sampleDefocused(uv, texel, uEdgeDefocus * edge * 2.0);

  // Phosphor tint: drive the trace toward the tube's emission colour while
  // keeping its own luminance, so a green tube reads green without flattening
  // bright cores to a single value.
  vec3 tinted = uPhosphorColor * luma(color);
  color = mix(color, tinted, uPhosphorTint);

  float graticuleSignal = graticule(uv, texel) * uGraticuleBrightness;
  color += uPhosphorColor * graticuleSignal;

  // Scanlines in device pixels, so output resolution does not change how coarse
  // they look. Halved in amplitude against the signal's own luminance so a
  // bright trace is not sliced apart by them.
  float scanPhase = uv.y * uResolution.y / max(uResolution.y / uScanlineDensity, 1.0);
  float scan = 0.5 + 0.5 * cos(scanPhase * 6.28318530718);
  color *= 1.0 - uScanlineStrength * scan * (1.0 - luma(color) * 0.5);

  color *= 1.0 - uVignette * edge * edge;

  // Static grain from screen position. No time input, deliberately.
  float noise = fract(sin(dot(uv * uResolution, vec2(12.9898, 78.233))) * 43758.5453);
  color += (noise - 0.5) * uGrain * 0.12;

  vec3 outputColor = clamp(color, 0.0, 1.0);
  float graticuleAlpha = smoothstep(0.001, 0.03, graticuleSignal);
  float outputAlpha = mix(
    1.0,
    max(sourceSample.a, graticuleAlpha),
    clamp(uTransparentBackground, 0.0, 1.0)
  );
  fragColor = vec4(outputColor, outputAlpha);
}
`

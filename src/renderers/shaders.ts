/**
 * WebGL2 shader sources for the DRMVYZ GPU compositor.
 *
 * Architecture: one shared vertex shader (fullscreen quad) + five fragment
 * programs covering:
 *   1. video  — draws a video/image element into the scene with background fill
 *   2. rgbSplit — chromatic-aberration fringe matching the Canvas 2D screen blend
 *   3. bloomThreshold — extracts bright pixels for bloom pass
 *   4. bloomBlur — separable Gaussian blur (call twice: H then V)
 *   5. bloomComposite — screen-blends blurred bloom back onto scene
 *   6. pass — identity passthrough (FBO → canvas blit)
 */

// ── Shared vertex shader ──────────────────────────────────────────────────────
// NDC fullscreen quad [-1,1]² with UV [0,1]².
export const VERT_SRC = /* glsl */`#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
}
`

// ── 1. Video draw ─────────────────────────────────────────────────────────────
// Renders a video (or image) element into the scene respecting an aspect-ratio
// draw rect. Fragments outside the rect receive u_bg.
//
// Uniforms:
//   u_tex  — video/image texture
//   u_rect — normalised draw rect: vec4(ox/W, oy/H, sw/W, sh/H)
//   u_bg   — background colour (RGBA, linear)
export const VIDEO_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec4 u_rect;  // ox/W, oy/H, sw/W, sh/H
uniform vec4 u_bg;
out vec4 fragColor;

void main() {
  // v_uv is 0..1 from bottom-left (WebGL convention).
  // Canvas coords: x left→right, y top→bottom — flip v_uv.y.
  float cx = v_uv.x;
  float cy = 1.0 - v_uv.y;

  float rx = (cx - u_rect.x) / u_rect.z;
  float ry = (cy - u_rect.y) / u_rect.w;

  if (rx < 0.0 || rx > 1.0 || ry < 0.0 || ry > 1.0) {
    fragColor = u_bg;
    return;
  }
  // DOM source uploaded with UNPACK_FLIP_Y_WEBGL: texture y=1=image top, y=0=image bottom.
  // ry=0 at canvas top → sample 1.0-ry=1.0 (texture top = image top). ✓
  fragColor = texture(u_tex, vec2(rx, 1.0 - ry));
}
`

// ── 2. RGB Split ──────────────────────────────────────────────────────────────
// Applies a chromatic-aberration fringe that matches the Canvas 2D
// sepia+saturate+hue-rotate screen-blend approach used at quality-independent
// scale (shift in normalised UV units = pixels / canvasWidth).
//
// Uniforms:
//   u_tex   — scene texture (output of video pass)
//   u_shift — horizontal UV shift (rgbShiftPx / canvasWidth)
export const RGBSPLIT_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_shift;
out vec4 fragColor;

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

// Approximate the cyan fringe produced by sepia + saturate(5) + hue-rotate(-40deg)
vec3 cyanFringe(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  // Desaturate then tint cyan
  vec3 des = mix(vec3(lum), c, 0.15);
  return clamp(vec3(des.r * 0.25, des.g * 1.15 + des.b * 0.35, des.b * 1.45), 0.0, 1.0);
}

// Approximate the magenta fringe produced by sepia + saturate(5) + hue-rotate(200deg)
vec3 magentaFringe(vec3 c) {
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 des = mix(vec3(lum), c, 0.15);
  return clamp(vec3(des.r * 1.35 + des.b * 0.25, des.g * 0.18, des.b * 1.25 + des.r * 0.18), 0.0, 1.0);
}

void main() {
  vec4 base  = texture(u_tex, v_uv);
  vec4 left  = texture(u_tex, v_uv - vec2(u_shift, 0.0));
  vec4 right = texture(u_tex, v_uv + vec2(u_shift, 0.0));

  vec3 c = base.rgb;
  c = screen(c, cyanFringe(left.rgb)    * 0.65);
  c = screen(c, magentaFringe(right.rgb) * 0.65);
  fragColor = vec4(c, 1.0);
}
`

// ── 3. Bloom threshold ────────────────────────────────────────────────────────
// Extracts bright areas above u_threshold for the bloom blur pass.
// Applies optional exposure boost and tint. Renders at half canvas resolution.
//
// Uniforms:
//   u_tex        — current scene texture
//   u_threshold  — luminance extraction threshold (default 0.35)
//   u_exposure   — highlight exposure boost added before threshold (0..1)
//   u_tintR/G/B  — glow tint colour channels (1.0 = neutral white)
//   u_intensityMul — intensity multiplier for the extracted region
export const BLOOM_THRESHOLD_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
uniform float u_exposure;
uniform float u_tintR;
uniform float u_tintG;
uniform float u_tintB;
uniform float u_intensityMul;
out vec4 fragColor;

void main() {
  vec4 c = texture(u_tex, v_uv);
  // Optional exposure boost before threshold extraction
  vec3 boosted = c.rgb * (1.0 + u_exposure * 1.5);
  float lum = dot(boosted, vec3(0.2126, 0.7152, 0.0722));
  float knee = max(0.001, 1.0 - u_threshold);
  float bright = clamp((lum - u_threshold) / knee, 0.0, 1.0);
  vec3 tint = vec3(u_tintR, u_tintG, u_tintB);
  fragColor = vec4(boosted * bright * 1.4 * u_intensityMul * tint, 1.0);
}
`

// ── 4. Bloom blur ─────────────────────────────────────────────────────────────
// Single-axis separable Gaussian blur.
// Call twice: first with u_dir=(1/bW, 0) for horizontal, then (0, 1/bH) for vertical.
//
// Uniforms:
//   u_tex    — input texture
//   u_dir    — texel step direction (vec2)
//   u_radius — Gaussian sigma / kernel half-width in texels
export const BLOOM_BLUR_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir;
uniform float u_radius;
out vec4 fragColor;

void main() {
  vec4 sum = vec4(0.0);
  float wTotal = 0.0;
  float sigma = max(u_radius, 0.5);
  int r = int(ceil(sigma * 2.5));  // ~2.5σ covers >98% of Gaussian
  for (int i = -r; i <= r; i++) {
    float w = exp(-float(i * i) / (2.0 * sigma * sigma));
    sum    += texture(u_tex, v_uv + u_dir * float(i)) * w;
    wTotal += w;
  }
  fragColor = sum / wTotal;
}
`

// ── 5. Bloom composite ────────────────────────────────────────────────────────
// Screen-blends the blurred bloom buffer onto the scene at u_amount strength.
// Matches the Canvas 2D bloom: globalCompositeOperation='screen', globalAlpha=bloomMod*0.45.
//
// Uniforms:
//   u_scene  — scene texture (TEXTURE0)
//   u_bloom  — blurred bloom texture (TEXTURE1)
//   u_amount — bloom intensity 0..1
export const BLOOM_COMPOSITE_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_amount;
out vec4 fragColor;

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  vec3 result = screen(scene, bloom * u_amount * 0.45);
  fragColor = vec4(result, 1.0);
}
`

// ── 6. Passthrough ────────────────────────────────────────────────────────────
// Identity blit from u_tex to output (used for final FBO → canvas draw).
//
// Uniforms:
//   u_tex — texture to display
export const PASS_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() { fragColor = texture(u_tex, v_uv); }
`

// ── 8. Displacement ghost ────────────────────────────────────────────────────
// Renders the current scene as-is, then screen-blends a shifted, hue-rotated
// ghost copy of it on top — matching the Canvas 2D path:
//   globalAlpha = 0.35 × dispAmount
//   globalCompositeOperation = 'screen'
//   filter = hue-rotate((colorShift × 360 + 90)°) when colorShift > 0
//   drawImage(scene, offX, offY)
//
// UV convention: FBO textures follow standard WebGL bottom-left origin.
//   v_uv.y=0 → canvas bottom   v_uv.y=1 → canvas top
// Content is correctly oriented (image top at canvas top) because VIDEO_FRAG
// already accounts for the UNPACK_FLIP_Y_WEBGL upload convention.
// A canvas drawImage shift of (offX px right, offY px down) maps to UV:
//   ghost.u = v_uv.x − offX/W     (right shift = sample further left in UV)
//   ghost.v = v_uv.y + offY/H     (down in canvas = increasing UV y = upward in WebGL UV)
//
// Uniforms:
//   u_tex        — scene texture (output of preceding GPU stage)
//   u_dispOffX   — normalised ghost UV x-offset: offXPx / canvasW (may be negative)
//   u_dispOffY   — normalised ghost UV y-offset: offYPx / canvasH (may be negative)
//   u_dispAmount — 0..1 intensity (ghost alpha = 0.35 × amount; 0 = pass is identity)
//   u_dispHueRad — hue rotation for ghost in radians (0 = no rotation)
export const DISPLACEMENT_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_dispOffX;
uniform float u_dispOffY;
uniform float u_dispAmount;
uniform float u_dispHueRad;
out vec4 fragColor;

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

// CSS hue-rotate matrix (SVG filter spec / WebKit convention).
vec3 hueRotate(vec3 c, float rad) {
  float cosA = cos(rad), sinA = sin(rad);
  // mat3 is column-major in GLSL: mat3(col0, col1, col2)
  return clamp(mat3(
    0.213 + cosA*0.787 - sinA*0.213,  0.213 - cosA*0.213 + sinA*0.143,  0.213 - cosA*0.213 - sinA*0.787,
    0.715 - cosA*0.715 - sinA*0.715,  0.715 + cosA*0.285 + sinA*0.140,  0.715 - cosA*0.715 + sinA*0.715,
    0.072 - cosA*0.072 + sinA*0.928,  0.072 - cosA*0.072 - sinA*0.283,  0.072 + cosA*0.928 + sinA*0.072
  ) * c, 0.0, 1.0);
}

void main() {
  vec4 base = texture(u_tex, v_uv);
  if (u_dispAmount <= 0.0) { fragColor = base; return; }

  vec2 ghostUV = clamp(vec2(v_uv.x - u_dispOffX, v_uv.y + u_dispOffY), 0.0, 1.0);
  vec3 ghost   = hueRotate(texture(u_tex, ghostUV).rgb, u_dispHueRad);
  fragColor    = vec4(screen(base.rgb, ghost * (0.35 * u_dispAmount)), 1.0);
}
`

// ── 10. GPU Transition composite ─────────────────────────────────────────────
// Composites outgoing and incoming GPU-rendered sources using a GLSL transition.
// Ten transition types are selected by the u_type integer uniform:
//   0 crossfade   1 wipeLeft   2 wipeRight  3 wipeUp     4 wipeDown
//   5 additiveBlend  6 lumaFade  7 radialWipe  8 zoomIn   9 zoomOut
//
// UV convention: v_uv.y=0=bottom, v_uv.y=1=top (standard WebGL).
// Wipe directions name where the incoming clip enters from.
//
// Uniforms:
//   u_out      — outgoing source (TEXTURE0)
//   u_in       — incoming source (TEXTURE1)
//   u_progress — eased 0..1 transition progress
//   u_type     — integer 0-9 selecting the transition algorithm
export const GPU_TRANSITION_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_out;
uniform sampler2D u_in;
uniform float u_progress;
uniform int   u_type;
out vec4 fragColor;

const float TWO_PI = 6.28318530718;

void main() {
  float p = clamp(u_progress, 0.0, 1.0);
  vec4 outC = texture(u_out, v_uv);
  vec4 inC  = texture(u_in,  v_uv);

  // 0 — crossfade
  if (u_type == 0) { fragColor = mix(outC, inC, p); return; }

  // 1 — wipeLeft: incoming enters from the right edge
  if (u_type == 1) { fragColor = (v_uv.x >= 1.0 - p) ? inC : outC; return; }

  // 2 — wipeRight: incoming enters from the left edge
  if (u_type == 2) { fragColor = (v_uv.x <= p) ? inC : outC; return; }

  // 3 — wipeUp: incoming enters from the bottom (WebGL y=0=bottom)
  if (u_type == 3) { fragColor = (v_uv.y <= p) ? inC : outC; return; }

  // 4 — wipeDown: incoming enters from the top (WebGL y=1=top)
  if (u_type == 4) { fragColor = (v_uv.y >= 1.0 - p) ? inC : outC; return; }

  // 5 — additiveBlend: additive layer builds up then incoming takes over at 0.4
  if (u_type == 5) {
    if (p <= 0.4) {
      fragColor = clamp(outC + inC * (p / 0.4), 0.0, 1.0);
    } else {
      float s = (p - 0.4) / 0.6;
      fragColor = mix(clamp(outC + inC, 0.0, 1.0), inC, s);
    }
    return;
  }

  // 6 — lumaFade: dip through black (outgoing fades out, incoming fades in)
  if (u_type == 6) {
    if (p < 0.5) {
      fragColor = vec4(outC.rgb * (1.0 - p * 2.0), 1.0);
    } else {
      fragColor = vec4(inC.rgb  * ((p - 0.5) * 2.0), 1.0);
    }
    return;
  }

  // 7 — radialWipe: clockwise sweep from 12-o'clock position
  if (u_type == 7) {
    vec2  c    = v_uv * 2.0 - 1.0;
    float ang  = atan(c.x, c.y);          // [0,π] above x-axis, [-π,0] below
    if (ang < 0.0) ang += TWO_PI;         // normalise to [0, 2π]
    fragColor = (ang / TWO_PI <= p) ? inC : outC;
    return;
  }

  // 8 — zoomIn: outgoing zooms in (appears to enlarge) while incoming crossfades
  if (u_type == 8) {
    vec2 uv  = (v_uv - 0.5) / (1.0 + p * 0.12) + 0.5;
    vec4 zOut = texture(u_out, clamp(uv, 0.0, 1.0));
    fragColor = mix(zOut, inC, p);
    return;
  }

  // 9 — zoomOut: incoming zooms out from centre to fill frame
  {
    vec2 uv  = (v_uv - 0.5) / max(0.001, 1.12 - p * 0.12) + 0.5;
    vec4 zIn  = texture(u_in, clamp(uv, 0.0, 1.0));
    fragColor = mix(outC, zIn, p);
  }
}
`

// ── 11. Color grade ───────────────────────────────────────────────────────────
// Per-source color grade applied BEFORE RGB Split / Bloom / Displacement.
// Order: brightness (additive) → contrast (centered on 0.5) → saturation →
// hue rotation → temperature → tint → clamp.
//
// Uniforms:
//   u_texture     — source texture (output of video pass)
//   u_gradeEnabled — when false, identity passthrough
//   u_brightness  — additive luminance offset, -1..+1
//   u_contrast    — contrast multiplier centered on 0.5, 0..2
//   u_saturation  — 0=grayscale, 1=original, 2=double
//   u_hueRotation — hue rotation in radians
//   u_temperature — -1..+1 (warm shifts R+, B-; cool shifts B+, R-)
//   u_tint        — -1..+1 (positive=magenta R+,G-,B+; negative=green G+,R-,B-)
export const COLOR_GRADE_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform bool  u_gradeEnabled;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hueRotation;
uniform float u_temperature;
uniform float u_tint;
out vec4 fragColor;

// CSS hue-rotate matrix (SVG filter spec / WebKit convention).
vec3 hueRotate(vec3 c, float rad) {
  float cosA = cos(rad), sinA = sin(rad);
  return mat3(
    0.213 + cosA*0.787 - sinA*0.213,  0.213 - cosA*0.213 + sinA*0.143,  0.213 - cosA*0.213 - sinA*0.787,
    0.715 - cosA*0.715 - sinA*0.715,  0.715 + cosA*0.285 + sinA*0.140,  0.715 - cosA*0.715 + sinA*0.715,
    0.072 - cosA*0.072 + sinA*0.928,  0.072 - cosA*0.072 - sinA*0.283,  0.072 + cosA*0.928 + sinA*0.072
  ) * c;
}

void main() {
  vec4 src = texture(u_texture, v_uv);
  if (!u_gradeEnabled) { fragColor = src; return; }

  vec3 color = src.rgb;

  // Brightness: additive
  color += u_brightness;

  // Contrast: centered on 0.5
  color = (color - 0.5) * u_contrast + 0.5;

  // Saturation
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, u_saturation);

  // Hue rotation
  if (u_hueRotation != 0.0) color = hueRotate(color, u_hueRotation);

  // Temperature: warm shifts R+, B-; cool shifts B+, R-
  color.r += u_temperature * 0.1;
  color.b -= u_temperature * 0.1;

  // Tint: positive=magenta (R+, G-, B+); negative=green (G+, R-, B-)
  color.r += u_tint * 0.05;
  color.g -= u_tint * 0.05;
  color.b += u_tint * 0.05;

  color = clamp(color, 0.0, 1.0);
  fragColor = vec4(color, src.a);
}
`

// ── 12. Pixel Distortion ─────────────────────────────────────────────────────
// Pixel grid snap, posterization, Bayer dithering, corruption blocks, energy
// overexposure and cyan-white highlight tinting for the corrupted CRT look.
// Pass is an identity when u_amount is zero.
//
// Uniforms:
//   u_tex          — input scene texture
//   u_resolution   — canvas size in pixels
//   u_time         — elapsed ms (per-frame seed for corruption)
//   u_amount       — master intensity 0..1 (0 = identity)
//   u_pixelSize    — pixel cell size in output pixels (1 = no pixelation)
//   u_posterize    — number of tonal posterization steps (≥2)
//   u_dither       — Bayer dither strength 0..1
//   u_corruption   — block corruption breakup amount 0..1
//   u_overexposure — highlight clip / bleach-energy strength 0..1
//   u_energyTint   — cyan-white tint on bright areas 0..1
//   u_beatPunch    — per-beat additional corruption boost 0..1
export const PIXEL_DISTORTION_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_amount;
uniform float u_pixelSize;
uniform float u_posterize;
uniform float u_dither;
uniform float u_corruption;
uniform float u_overexposure;
uniform float u_energyTint;
uniform float u_beatPunch;
out vec4 fragColor;

// 2D value hash → [0,1)
float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p.yx + 19.19);
  return fract(p.x * p.y);
}
float hash11(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}

// 4×4 Bayer ordered dither matrix normalised to [0,1)
float bayer4(vec2 px) {
  int x = int(mod(px.x, 4.0));
  int y = int(mod(px.y, 4.0));
  int idx = y * 4 + x;
  // Bayer4 threshold values (0-15) normalised
  float vals[16];
  vals[0]  =  0.0/16.0; vals[1]  =  8.0/16.0; vals[2]  =  2.0/16.0; vals[3]  = 10.0/16.0;
  vals[4]  = 12.0/16.0; vals[5]  =  4.0/16.0; vals[6]  = 14.0/16.0; vals[7]  =  6.0/16.0;
  vals[8]  =  3.0/16.0; vals[9]  = 11.0/16.0; vals[10] =  1.0/16.0; vals[11] =  9.0/16.0;
  vals[12] = 15.0/16.0; vals[13] =  7.0/16.0; vals[14] = 13.0/16.0; vals[15] =  5.0/16.0;
  return vals[idx];
}

void main() {
  if (u_amount <= 0.0) { fragColor = texture(u_tex, v_uv); return; }

  // ── 1. Pixel-grid snap ────────────────────────────────────────────────
  float pxSz = max(1.0, u_pixelSize);
  vec2 cell   = pxSz / u_resolution;
  vec2 snapUv = floor(v_uv / cell) * cell + cell * 0.5;

  // ── 2. Corruption displacement ────────────────────────────────────────
  // Block-level instability driven by time and beat punch
  float corr   = u_corruption * u_amount + u_beatPunch * u_amount;
  float timeSeed = floor(u_time * 0.02);   // slow-changing seed
  vec2  blockUv  = floor(snapUv * 16.0) / 16.0;
  float blockN   = hash21(blockUv + timeSeed);
  if (corr > 0.0 && blockN < corr * 0.25) {
    // Corrupt a fraction of cells by shifting their UV horizontally
    float shift = (hash11(blockN + timeSeed) - 0.5) * corr * 0.12;
    snapUv.x = clamp(snapUv.x + shift, 0.0, 1.0);
  }
  snapUv = clamp(snapUv, 0.0, 1.0);
  vec3 color = texture(u_tex, snapUv).rgb;

  // ── 3. Posterization ─────────────────────────────────────────────────
  float levels = max(2.0, u_posterize);
  color = floor(color * levels + 0.5) / levels;

  // ── 4. Bayer dither ───────────────────────────────────────────────────
  if (u_dither > 0.0) {
    vec2 px = floor(v_uv * u_resolution);
    float dithThresh = bayer4(px);
    // Push each channel toward the nearest posterize level via dither
    float spread = (1.0 / levels) * u_dither * u_amount;
    color += (dithThresh - 0.5) * spread;
    color = clamp(color, 0.0, 1.0);
  }

  // ── 5. Energy overexposure — clip highlights to cyan-white ───────────
  if (u_overexposure > 0.0) {
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float oeStrength = u_overexposure * u_amount;
    // Boost above a soft threshold
    float bright = smoothstep(0.45, 0.75, lum);
    color += color * bright * oeStrength * 1.8;
    color = clamp(color, 0.0, 1.0);
  }

  // ── 6. Cyan-white energy tint on bright regions ───────────────────────
  if (u_energyTint > 0.0) {
    float lum2     = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float tintMask = smoothstep(0.55, 0.90, lum2);
    vec3  cyanWhite = vec3(0.78, 1.0, 1.0);  // icy cyan-white
    float tintAmt   = u_energyTint * u_amount * tintMask;
    color = mix(color, cyanWhite * lum2, tintAmt);
  }

  // ── 7. Blend with original based on amount ────────────────────────────
  vec3 original = texture(u_tex, v_uv).rgb;
  fragColor = vec4(mix(original, color, u_amount), 1.0);
}
`

// ── 13. Temporal Feedback (ping-pong) ─────────────────────────────────────────
// Blends the current scene with the previous rendered frame for luminous trails.
// Called once after the full effect stack has been composited; the result is
// written to the feedbackWrite FBO and also blitted to the final output.
//
// Uniforms:
//   u_scene    — current fully-composited scene texture
//   u_history  — previous feedback frame (feedbackRead)
//   u_decay    — blend factor: history contribution 0..0.97
//   u_smearX   — per-frame UV shift in pixels (horizontal smear)
//   u_smearY   — per-frame UV shift in pixels (vertical smear)
//   u_zoom     — subtle zoom factor per frame (1.0 = no zoom)
//   u_resolution — canvas size for smear normalisation
export const FEEDBACK_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_history;
uniform float u_decay;
uniform float u_smearX;
uniform float u_smearY;
uniform float u_zoom;
uniform vec2  u_resolution;
out vec4 fragColor;

void main() {
  // Sample history with optional smear + zoom offset
  vec2 histUv = v_uv;
  if (u_zoom != 1.0) {
    histUv = (histUv - 0.5) / u_zoom + 0.5;
  }
  histUv.x += u_smearX / u_resolution.x;
  histUv.y += u_smearY / u_resolution.y;
  histUv = clamp(histUv, 0.0, 1.0);

  vec3 scene   = texture(u_scene,   v_uv).rgb;
  vec3 history = texture(u_history, histUv).rgb;

  // Blend: current scene + decayed history
  vec3 result = mix(scene, max(scene, history * u_decay), u_decay);
  fragColor = vec4(result, 1.0);
}
`

// ── 14. Noise Warp Displacement ───────────────────────────────────────────────
// Procedural value-noise UV warp plus optional shifted ghost layer.
// Replaces or extends the basic ghost-copy displacement for the Distortion
// Pixels look. Falls back to identity when u_noiseAmount == 0.
//
// Uniforms:
//   u_tex        — input scene texture
//   u_time       — elapsed ms (drives noise animation)
//   u_resolution — canvas dimensions
//   u_noiseScale — noise field UV scale
//   u_noiseAmt   — warp UV offset strength 0..1
//   u_warpSpeed  — noise field animation speed
//   u_hBias      — horizontal warp bias multiplier
//   u_ghostAmt   — shifted ghost layer alpha (0 = no ghost)
//   u_ghostOffX  — ghost x offset in normalised UV
//   u_ghostOffY  — ghost y offset in normalised UV
//   u_ghostHue   — hue rotation for ghost in radians
export const NOISE_WARP_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform vec2  u_resolution;
uniform float u_noiseScale;
uniform float u_noiseAmt;
uniform float u_warpSpeed;
uniform float u_hBias;
uniform float u_ghostAmt;
uniform float u_ghostOffX;
uniform float u_ghostOffY;
uniform float u_ghostHue;
out vec4 fragColor;

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

// Simple value noise
float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p.yx + 19.19);
  return fract(p.x * p.y);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i),            hash21(i + vec2(1,0)), f.x),
    mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y
  );
}

vec3 hueRotate(vec3 c, float rad) {
  float cosA = cos(rad), sinA = sin(rad);
  return clamp(mat3(
    0.213 + cosA*0.787 - sinA*0.213,  0.213 - cosA*0.213 + sinA*0.143,  0.213 - cosA*0.213 - sinA*0.787,
    0.715 - cosA*0.715 - sinA*0.715,  0.715 + cosA*0.285 + sinA*0.140,  0.715 - cosA*0.715 + sinA*0.715,
    0.072 - cosA*0.072 + sinA*0.928,  0.072 - cosA*0.072 - sinA*0.283,  0.072 + cosA*0.928 + sinA*0.072
  ) * c, 0.0, 1.0);
}

void main() {
  vec3 base = texture(u_tex, v_uv).rgb;

  if (u_noiseAmt > 0.0) {
    float t   = u_time * 0.001 * u_warpSpeed;
    vec2  uv2 = v_uv * u_noiseScale;
    float n   = valueNoise(uv2 + t) - 0.5;
    vec2  warp;
    warp.x = n * u_noiseAmt * u_hBias;
    warp.y = n * u_noiseAmt * 0.4;
    vec2 warpedUv = clamp(v_uv + warp, 0.0, 1.0);
    base = texture(u_tex, warpedUv).rgb;
  }

  // Optional ghost layer (legacy shifted copy)
  if (u_ghostAmt > 0.0) {
    vec2 ghostUV = clamp(vec2(v_uv.x - u_ghostOffX, v_uv.y + u_ghostOffY), 0.0, 1.0);
    vec3 ghost   = hueRotate(texture(u_tex, ghostUV).rgb, u_ghostHue);
    base = screen(base, ghost * (0.35 * u_ghostAmt));
  }

  fragColor = vec4(base, 1.0);
}
`

// ── 7. Post-process: grain + scanlines ───────────────────────────────────────
// Combined final pass applying procedural grain (Noise Fog) and horizontal
// scanlines before the GPU output is blit to Canvas 2D.
//
// Grain reproduces the noiseFog Canvas 2D path: per-pixel teal dots at
// amount*0.12 average opacity in screen blend mode.
// Scanlines darken every u_scanStep-th row by amount*0.17, matching the
// Canvas 2D fillRect path at quality-controlled stride.
//
// Pass ordering note: this runs before Canvas 2D postMedia effects (kaleidoscope
// etc.) because it is baked into the GPU output blit.  The visual difference is
// imperceptible for grain and minor for scanlines — documented intentionally.
//
// Uniforms:
//   u_tex         — input scene texture
//   u_time        — ms elapsed (per-frame grain seed)
//   u_grainAmount — 0..1 fog intensity (0 = disabled)
//   u_scanAlpha   — 0..1 scanline darkness (0 = disabled)
//   u_scanStep    — pixel stride between darkened scanline rows
//   u_resolution  — canvas size in pixels (for scanline coord + grain texel)
export const POST_PROCESS_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_grainAmount;
uniform float u_scanAlpha;
uniform float u_scanStep;
uniform vec2  u_resolution;
out vec4 fragColor;

// Value hash: maps (pixel coord, time seed) → 0..1
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

vec3 screen(vec3 a, vec3 b) { return 1.0 - (1.0 - a) * (1.0 - b); }

void main() {
  vec3 c = texture(u_tex, v_uv).rgb;

  // Grain — matches noiseFog: screen-blend teal dots at amount*0.12*random opacity
  if (u_grainAmount > 0.0) {
    vec2 px  = floor(v_uv * u_resolution);
    float g  = hash21(px + fract(u_time * 0.037));
    vec3 teal = vec3(74.0/255.0, 199.0/255.0, 219.0/255.0);
    c = screen(c, teal * (u_grainAmount * 0.12 * g));
  }

  // Scanlines — matches scanlines: darken every u_scanStep-th row by amount*0.17
  if (u_scanAlpha > 0.0 && u_scanStep > 0.5) {
    float row = floor(v_uv.y * u_resolution.y);
    if (mod(row, u_scanStep) < 1.0) {
      c *= (1.0 - u_scanAlpha * 0.17);
    }
  }

  fragColor = vec4(c, 1.0);
}
`

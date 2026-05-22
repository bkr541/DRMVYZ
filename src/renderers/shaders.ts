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
  // Video texture top = canvas top → flip ry for texture UV.
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
// Extracts bright areas (luminance > 0.35) for the bloom blur pass.
// Renders at half canvas resolution to reduce blur cost (4× fewer texels).
//
// Uniforms:
//   u_tex — current scene texture
export const BLOOM_THRESHOLD_FRAG = /* glsl */`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;

void main() {
  vec4 c = texture(u_tex, v_uv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float bright = clamp((lum - 0.35) / 0.65, 0.0, 1.0);
  // Boost bright regions for more visible glow
  fragColor = vec4(c.rgb * bright * 1.4, 1.0);
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

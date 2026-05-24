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

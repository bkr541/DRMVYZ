export const TERMINAL_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

export const TERMINAL_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
out vec4 color;
uniform sampler2D source, atlas;
uniform vec2 outputSize, fitSize, position, grid;
uniform vec3 inkColor;
uniform float scale, rotation, amount, contrast, brightness, edge, backgroundFill, glow, variation;
uniform int family, seed, epoch;
uniform bool monochrome;

float luma(vec4 pixel) { return dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722)); }

float hashCell(ivec2 cell) {
  uint n = uint(cell.x) * 73856093u ^ uint(cell.y) * 19349663u ^ uint(seed) ^ uint(epoch) * 83492791u;
  n ^= n >> 16u;
  n *= 0x7feb352du;
  n ^= n >> 15u;
  return float(n & 65535u) / 65535.0;
}

vec2 direction(int glyph) {
  return texelFetch(atlas, ivec2(glyph * 24, family * 32), 0).rg * 2.0 - 1.0;
}

float glyphAlpha(int glyph, vec2 p) {
  vec2 local = clamp(vec2(p.x, 1.0 - p.y) * vec2(24.0, 32.0), vec2(1.5), vec2(22.5, 30.5));
  return texture(atlas, (vec2(glyph * 24, family * 32) + local) / vec2(384.0, 96.0)).a;
}

void main() {
  vec2 p = (uv - 0.5) * outputSize - position;
  float c = cos(rotation), s = sin(rotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / max(0.01, scale) / fitSize + 0.5;
  if (any(lessThan(p, vec2(0))) || any(greaterThanEqual(p, vec2(1)))) { color = vec4(0); return; }

  vec4 original = texture(source, p);
  if (amount <= 0.0 || original.a <= 0.0) { color = original; return; }
  vec2 cell = floor(p * grid);
  vec2 center = (cell + 0.5) / grid;
  vec2 stepUV = 0.32 / grid;
  vec4 mid = texture(source, center);
  vec4 left = texture(source, center - vec2(stepUV.x, 0));
  vec4 right = texture(source, center + vec2(stepUV.x, 0));
  vec4 low = texture(source, center - vec2(0, stepUV.y));
  vec4 high = texture(source, center + vec2(0, stepUV.y));
  vec4 local = (2.0 * mid + left + right + low + high) / 6.0;
  vec3 palette = local.a > 0.001 ? local.rgb / local.a : original.rgb / original.a;
  float luminance = dot(palette, vec3(0.2126, 0.7152, 0.0722));
  float level = clamp((sqrt(luminance) - 0.5) * contrast + 0.5 + brightness, 0.0, 1.0);
  int band = min(7, int(level * 8.0));
  int glyph = 2 * band;
  float preferDense = fract(level * 8.0);
  if (level >= 1.0) preferDense = 1.0;
  if (band > 0) preferDense = mix(preferDense, hashCell(ivec2(cell)), variation);
  if (edge > 0.0 && band > 0) {
    vec2 gradient = vec2(luma(right) - luma(left) + 0.5 * (right.a - left.a),
                         luma(high) - luma(low) + 0.5 * (high.a - low.a));
    float power = dot(gradient, gradient);
    if (power > 0.0001) {
      vec2 tangent = normalize(vec2(-gradient.y, gradient.x));
      vec2 axis = vec2(tangent.x * tangent.x - tangent.y * tangent.y, 2.0 * tangent.x * tangent.y);
      preferDense += edge * min(1.0, 4.0 * sqrt(power)) * dot(direction(glyph + 1) - direction(glyph), axis);
    }
  }
  if (preferDense >= 0.5) glyph++;
  vec2 point = fract(p * grid);
  float coverage = glyphAlpha(glyph, point);
  if (glow > 0.0) {
    float halo = glyphAlpha(glyph, point + vec2(0.09, 0)) + glyphAlpha(glyph, point - vec2(0.09, 0))
      + glyphAlpha(glyph, point + vec2(0, 0.075)) + glyphAlpha(glyph, point - vec2(0, 0.075));
    coverage += (1.0 - coverage) * glow * halo * 0.14;
  }
  vec3 ink = monochrome ? inkColor : palette;
  float glyphOpacity = coverage * original.a;
  float backgroundOpacity = (1.0 - coverage) * original.a * backgroundFill;
  vec4 processed = vec4(ink * (glyphOpacity + 0.14 * backgroundOpacity), glyphOpacity + backgroundOpacity);
  color = mix(original, processed, amount);
}`

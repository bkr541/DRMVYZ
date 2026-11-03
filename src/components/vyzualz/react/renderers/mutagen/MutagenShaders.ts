import type { MutagenPattern } from './MutagenSettings'

export const MUTAGEN_VERTEX = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const COMMON = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSource;
uniform sampler2D uHistory;
uniform vec2 uResolution;
uniform vec2 uFitSize;
uniform vec2 uPosition;
uniform vec2 uSourceTexel;
uniform float uScale;
uniform float uRotation;
uniform float uTime;
uniform float uMutation;
uniform float uSourceMix;
uniform float uFeedback;
uniform bool uPreserveColors;
uniform float uDetail;
uniform float uCells;
uniform int uHeightSteps;
uniform float uVoronoiCells;
uniform float uBands;
uniform int uDepth;
uniform vec4 uAudio; // kick displacement, snare ripple, mid density, restrained high detail

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 seed(vec2 p) { return vec2(hash(p), hash(p + 19.71)); }
mat2 rotate(float a) { return mat2(cos(a), sin(a), -sin(a), cos(a)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = mat2(1.6, -1.2, 1.2, 1.6) * p + 7.13;
    amplitude *= 0.5;
  }
  return value;
}
vec4 sampleSource(vec2 uv) {
  if (any(lessThan(uv, vec2(0))) || any(greaterThan(uv, vec2(1)))) return vec4(0);
  vec4 c = texture(uSource, uv);
  return vec4(c.rgb * c.a, c.a);
}
float heightAt(vec2 uv) {
  vec4 c = sampleSource(uv);
  return dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
}
`

/** Each entry is compiled as its own program. Shared code handles only source
 * mapping, alpha, reconstruction, and optional history, never mode substitution. */
export const MUTAGEN_PATTERN_GLSL: Record<MutagenPattern, string> = {
  liquify: `
vec4 pattern(vec2 uv) {
  vec2 field = uv * 3.4;
  vec2 t = vec2(uTime * 0.24, -uTime * 0.19);
  vec2 q = vec2(fbm(field + t), fbm(field + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(field + q * 3.2 + t), fbm(field + q * 3.2 + vec2(8.3, 2.8) - t));
  return sampleSource(uv + (r - 0.47) * (uMutation * 0.65));
}`,
  vortex: `
vec4 pattern(vec2 uv) {
  float aspect = uFitSize.x / uFitSize.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float radius = length(p);
  float envelope = 1.0 - smoothstep(0.0, 0.9, radius);
  float twist = uMutation * uDetail * 8.0 * envelope * (0.65 + 0.35 * sin(uTime * 0.65));
  float angle = atan(p.y, p.x) + twist;
  float depth = 1.0 + uMutation * 0.15 * sin(radius * 24.0 - uTime * 1.2) * envelope;
  vec2 polar = vec2(cos(angle), sin(angle)) * radius * depth;
  return sampleSource(polar / vec2(aspect, 1.0) + 0.5);
}`,
  particulate: `
vec4 pattern(vec2 uv) {
  vec2 grid = vec2(uCells * uFitSize.x / uFitSize.y, uCells);
  vec2 id = floor(uv * grid), local = fract(uv * grid) - 0.5;
  vec4 color = sampleSource((id + 0.5) / grid);
  float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722)) / max(color.a, 0.001);
  float radius = mix(0.17, 0.47, sqrt(luminance)) * (0.92 + 0.08 * sin(uTime * 1.7 + hash(id) * 6.28));
  float aa = max(fwidth(local.x), fwidth(local.y));
  float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, length(local));
  return mix(sampleSource(uv), color * dotMask, smoothstep(0.0, 0.6, uMutation));
}`,
  terraform: `
vec4 pattern(vec2 uv) {
  // Parallax-occlusion intersection of an actual luminance heightfield.
  // March front-to-back, then interpolate the crossing between depth slices.
  vec2 view = vec2(cos(uTime * 0.24), sin(uTime * 0.24) * 0.55 + 0.5);
  vec2 parallax = view * uMutation * uDetail * 0.22;
  float stepDepth = 1.0 / float(uHeightSteps);
  vec2 hit = uv;
  float previousDelta = 1.0 - heightAt(uv - parallax * 0.5);
  vec2 previousUv = uv - parallax * 0.5;
  for (int i = 1; i <= 24; i++) {
    if (i > uHeightSteps) break;
    float depth = 1.0 - float(i) * stepDepth;
    vec2 candidate = uv + parallax * (0.5 - depth);
    float delta = depth - heightAt(candidate);
    hit = candidate;
    if (delta <= 0.0) {
      hit = mix(previousUv, candidate, previousDelta / max(0.0001, previousDelta - delta));
      break;
    }
    previousDelta = delta; previousUv = candidate;
  }
  float h = heightAt(hit);
  vec2 texel = max(uSourceTexel, vec2(0.002));
  vec2 gradient = vec2(heightAt(hit + vec2(texel.x, 0)) - heightAt(hit - vec2(texel.x, 0)),
                       heightAt(hit + vec2(0, texel.y)) - heightAt(hit - vec2(0, texel.y)));
  vec3 normal = normalize(vec3(-gradient * uDetail * 14.0, 1.0));
  float light = 0.72 + 0.28 * max(0.0, dot(normal, normalize(vec3(0.5, 0.7, 1.0))));
  float contour = abs(fract(h * 18.0) - 0.5);
  float line = 1.0 - smoothstep(0.025, 0.085, contour);
  vec4 color = sampleSource(hit);
  color.rgb *= mix(1.0, light * (1.0 - line * 0.4), uMutation * uDetail);
  return color;
}`,
  fracture: `
vec3 nearestCell(vec2 p) {
  vec2 base = floor(p), winner = base;
  float best = 100.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 id = base + vec2(x,y);
    vec2 point = id + 0.2 + seed(id) * 0.6;
    float distanceSq = dot(point - p, point - p);
    if (distanceSq < best) { best = distanceSq; winner = id; }
  }
  return vec3(winner, best);
}
vec4 pattern(vec2 uv) {
  vec2 grid = vec2(uVoronoiCells * uFitSize.x / uFitSize.y, uVoronoiCells);
  vec2 p = uv * grid, base = floor(p);
  // Closed separation/reassembly cycle: bounded to less than one cell.
  float release = 0.5 - 0.5 * cos(uTime * 1.4);
  float spread = uMutation * uDetail * release;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 id = base + vec2(x,y), rand = seed(id);
    vec2 center = id + 0.2 + rand * 0.6;
    vec2 displacement = (rand - 0.5) * spread * 1.25;
    vec2 local = rotate((rand.x - 0.5) * spread * 0.9) * (p - center - displacement);
    vec2 originalPoint = center + local / (1.0 - spread * 0.14);
    vec3 owner = nearestCell(originalPoint);
    if (all(lessThan(abs(owner.xy - id), vec2(0.01)))) return sampleSource(originalPoint / grid);
  }
  return vec4(0);
}`,
  spectralTear: `
vec4 pattern(vec2 uv) {
  float band = floor(uv.y * uBands);
  float wave = sin(band * 2.17 + uTime * 1.5);
  float low = sin(uTime * 0.7 + band * 0.35);
  float high = sin(uTime * 3.1 - band * 3.7);
  float tear = (wave * 0.08 + low * 0.045 + high * 0.02) * uMutation;
  float split = uMutation * (0.006 + 0.022 * abs(high));
  vec2 p = uv + vec2(tear, high * uMutation * 0.008);
  vec4 r = sampleSource(p + vec2(split, 0));
  vec4 g = sampleSource(p);
  vec4 b = sampleSource(p - vec2(split, 0));
  return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
}`,
  recursion: `
vec4 pattern(vec2 uv) {
  vec2 p = (uv - 0.5) * 2.0;
  vec4 result = sampleSource(uv);
  float breathing = 0.63 + 0.035 * sin(uTime * 0.8);
  float scale = 1.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uDepth) break;
    scale *= breathing;
    vec2 nested = rotate(sin(uTime * 0.4 + float(i) * 0.3) * 0.17 * uMutation) * p / scale;
    if (max(abs(nested.x), abs(nested.y)) < 1.0) result = sampleSource(nested * 0.5 + 0.5);
  }
  return mix(sampleSource(uv), result, smoothstep(0.0, 0.55, uMutation));
}`,
  morph: `
vec4 pattern(vec2 uv) {
  float count = mix(12.0, 42.0, uDetail);
  vec2 grid = vec2(count * uFitSize.x / uFitSize.y, count);
  vec2 id = floor(uv * grid), p = fract(uv * grid) - 0.5;
  p = rotate(uTime * 0.35 + hash(id) * 3.14) * p;
  vec4 color = sampleSource((id + 0.5) / grid);
  float luma = dot(color.rgb, vec3(0.2126,0.7152,0.0722)) / max(color.a, 0.001);
  float shape = mix(length(p), (abs(p.x) + abs(p.y)) * 0.72, 0.5 + 0.5 * sin(uTime * 0.7));
  float radius = 0.15 + 0.33 * sqrt(luma);
  float aa = max(fwidth(p.x), fwidth(p.y));
  vec4 procedural = color * (1.0 - smoothstep(radius-aa, radius+aa, shape));
  float structure = smoothstep(0.05, 0.95, 0.5 + 0.5 * sin(uTime * 0.9));
  return mix(sampleSource(uv), procedural, uMutation * structure);
}`,
}

export function createMutagenFragment(pattern: MutagenPattern): string {
  return COMMON + MUTAGEN_PATTERN_GLSL[pattern] + `
void main() {
  vec2 p = (vUv - 0.5) * uResolution - uPosition;
  float c = cos(uRotation), s = sin(uRotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec2 uv = p / (uFitSize * uScale) + 0.5;
  vec4 original = sampleSource(uv);
  if (uMutation <= 0.0 || uSourceMix >= 1.0) { outColor = original; return; }
  vec2 accent = vec2(sin(uv.y * 17.0 + uTime), cos(uv.x * 19.0 - uTime)) * min(uAudio.x, 1.0) * vec2(0.035, 0.02);
  accent.x += sin(uv.y * (18.0 + 20.0 * uAudio.z) - uTime * 3.0) * min(uAudio.y, 1.0) * 0.025;
  vec4 fresh = pattern(uv + accent);
  float edge = length(dFdx(fresh.rgb)) + length(dFdy(fresh.rgb));
  fresh.rgb = min(vec3(fresh.a), fresh.rgb * (1.0 + min(0.06, edge * uAudio.w * 0.2)));
  if (!uPreserveColors) fresh.rgb = mix(fresh.rgb, fresh.gbr, uMutation * 0.45);
  fresh = mix(fresh, original, uSourceMix);
  outColor = mix(fresh, texture(uHistory, vUv), uFeedback);
}`
}

/** One bounded postprocess: crossfade + optional 8-neighbor glow. It never
 * samples temporal history; history mixing is the one pattern feedback pass. */
export const MUTAGEN_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uMix;
uniform float uGlow;
uniform vec2 uTexel;
vec4 frame(vec2 uv) { return mix(texture(uFrom, uv), texture(uTo, uv), uMix); }
void main() {
  vec4 color = frame(vUv);
  if (uGlow > 0.0) {
    vec4 halo = vec4(0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      if (x != 0 || y != 0) halo += frame(vUv + vec2(x,y) * uTexel * 4.0);
    }
    halo *= uGlow / 8.0;
    // Alpha-aware source-over, retaining the original sampled palette.
    float alpha = color.a + halo.a * (1.0 - color.a);
    color.rgb = min(vec3(alpha), color.rgb + halo.rgb * 0.45);
    color.a = alpha;
  }
  outColor = color;
}`

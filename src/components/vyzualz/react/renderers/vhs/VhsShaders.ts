export const VHS_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

export const VHS_PRESENT = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D processed;
void main() { color = texture(processed, uv); }
`

export const VHS_SIGNAL = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
out vec4 color;
uniform sampler2D source, history;
uniform vec2 viewportSize, outputSize, fitSize, position;
uniform float transformScale, rotation, amount, phase;
uniform float damage, tracking, dropout, bleed, roll, grain, scanlines, curvature, phosphor, misalignment;
uniform float audioTexture, glow, historyWeight;
uniform int seed, chromaTaps, lineLimit;
uniform bool tape, crt;

const vec3 LUMA = vec3(0.299, 0.587, 0.114);

float noise(ivec3 key) {
  uint n = uint(seed) ^ uint(key.x) * 197153649u ^ uint(key.y) * 231037001u ^ uint(key.z) * 4794217u;
  n ^= n >> 16u;
  n *= 0x7feb352du;
  n ^= n >> 15u;
  n *= 0x846ca68bu;
  n ^= n >> 16u;
  return float(n & 65535u) / 65535.0;
}

vec4 image(vec2 p) {
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) return vec4(0);
  return texture(source, p);
}

vec3 straight(vec4 pixel, vec3 fallback) {
  return pixel.a > 0.00001 ? mix(fallback, pixel.rgb / pixel.a, smoothstep(0.0, 0.24, pixel.a)) : fallback;
}

vec2 tapeCoordinate(vec2 p, int field) {
  int row = int(floor(p.y * 224.0));
  float coarse = noise(ivec3(row / 7, field / 3, 17)) - 0.5;
  float fine = noise(ivec3(row, field, 59)) - 0.5;
  float head = 1.0 - smoothstep(0.018, 0.11, abs(p.y - (0.048 + 0.014 * sin(phase * 1.7))));
  float slip = sin(p.y * 37.0 + phase * 7.4) * 0.28 + coarse * (0.6 + damage) + fine * (0.14 + head);
  p.x += slip * tracking * amount * 0.078 + head * coarse * tracking * amount * 0.088;
  return p;
}

vec3 tapeSignal(vec2 p, vec3 rgb, int field) {
  float luma = dot(rgb, LUMA);
  if (bleed > 0.0) {
    // Tape chroma is lower bandwidth than luma. Lag it horizontally while keeping
    // the luminance edge sharp and sampling only covered color.
    float width = bleed * amount * 0.126;
    vec3 chroma = vec3(0);
    float weightSum = 0.0;
    float filteredLuma = 0.0;
    for (int i = 0; i < 7; i++) {
      if (i >= chromaTaps) break;
      float u = float(i) / float(chromaTaps - 1);
      float weight = 1.0 - 0.48 * u;
      vec3 sampleColor = straight(image(p - vec2(width * (u - 0.12), 0)), rgb);
      float sampleLuma = dot(sampleColor, LUMA);
      chroma += (sampleColor - sampleLuma) * weight;
      filteredLuma += sampleLuma * weight;
      weightSum += weight;
    }
    float softLuma = mix(luma, filteredLuma / weightSum, bleed * amount * 0.48);
    float chromaLoss = 1.0 - bleed * amount * 0.55;
    rgb = vec3(softLuma) + chromaLoss * mix(rgb - luma, chroma / weightSum, min(1.0, bleed * amount * 3.2));
  }

  int line = int(floor(p.y * 213.0));
  float chance = noise(ivec3(line, field / 2, 171));
  float length = 0.13 + 0.44 * noise(ivec3(line, field / 2, 191));
  float start = noise(ivec3(line, field / 2, 193));
  float brokenLine = 1.0 - smoothstep(length * 0.65, length, fract(p.x + start));
  float dropoutMask = step(1.0 - dropout * (0.075 + 0.17 * damage), chance) * brokenLine;
  float white = noise(ivec3(int(p.x * 460.0), line, field)) > 0.24 ? 0.45 : -0.28;
  float switching = (1.0 - smoothstep(0.0, 0.105, p.y)) * tracking * (0.12 + 0.24 * damage);
  float lineGain = (noise(ivec3(line / 3, field / 2, 211)) - 0.47) * tracking * (0.16 + 0.18 * damage);
  rgb += amount * (white * dropoutMask * sqrt(dropout) + (chance - 0.42) * switching + lineGain);
  return rgb;
}

vec2 crtCoordinate(vec2 p) {
  vec2 screen = p * 2.0 - 1.0;
  screen *= 1.0 + 0.42 * curvature * amount * screen.yx * screen.yx;
  return screen * 0.5 + 0.5;
}

vec3 crtDisplay(vec2 p, vec3 rgb) {
  vec2 screen = abs(p * 2.0 - 1.0);
  float corner = 1.0 - smoothstep(0.88, 1.19, pow(screen.x, 5.0) + pow(screen.y, 5.0));
  float edge = 1.0 - smoothstep(0.965, 1.018, max(screen.x, screen.y));
  float shape = mix(1.0, edge * corner, min(1.0, curvature * amount * 3.0));
  float pixelsY = fitSize.y * transformScale * outputSize.y / viewportSize.y;
  float pixelsX = fitSize.x * transformScale * outputSize.x / viewportSize.x;
  float lines = min(float(lineLimit), max(10.0, pixelsY / 3.3));
  float columns = min(lines * 1.7, max(12.0, pixelsX / 5.1));
  float beam = pow(0.5 + 0.5 * cos(p.y * lines * 6.2831853), 1.8);
  float luma = clamp(dot(rgb, LUMA), 0.0, 1.0);
  float lineDepth = scanlines * amount * (0.81 + 0.19 * audioTexture) * (1.0 - 0.29 * luma);
  float triad = fract(p.x * columns + 0.14 * mod(floor(p.y * lines), 2.0));
  vec3 mask = 0.5 + 0.5 * cos((triad - vec3(0.16, 0.49, 0.82)) * 6.2831853);
  rgb *= mix(vec3(1), vec3(0.47) + 0.53 * mask, phosphor * amount);
  rgb *= shape * (1.0 - lineDepth * (1.0 - beam));
  return rgb + rgb * luma * glow * amount * 0.22;
}

void main() {
  vec2 q = (uv - 0.5) * viewportSize - position;
  float c = cos(rotation), s = sin(rotation);
  vec2 originalUV = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / max(0.01, transformScale) / fitSize + 0.5;
  vec4 original = image(originalUV);
  if (amount <= 0.0 || original.a <= 0.0) { color = original; return; }

  int field = int(floor(phase * 29.97));
  vec2 screen = crt ? crtCoordinate(originalUV) : originalUV;
  vec2 signal = screen;
  float sweep = fract(phase * 0.19 + noise(ivec3(1, 2, 3)));
  float band = exp(-pow((signal.y - sweep) * 12.0, 2.0));
  signal.y += roll * amount * (sin(phase * 2.3) * 0.027 + band * sin(phase * 6.7) * 0.056);
  if (tape) signal = tapeCoordinate(signal, field);
  vec3 base = original.rgb / original.a;
  vec3 rgb = straight(image(signal), base);
  if (misalignment > 0.0) {
    vec2 offset = vec2(misalignment * amount * (tape ? 0.032 : 0.018), misalignment * amount * (crt ? 0.006 : 0.001));
    rgb.r = straight(image(signal + offset), rgb).r;
    rgb.b = straight(image(signal - offset), rgb).b;
  }
  if (tape) rgb = tapeSignal(signal, rgb, field);
  if (grain > 0.0) {
    ivec2 cell = ivec2(floor(originalUV * vec2(517.0, 286.0)));
    float signalNoise = noise(ivec3(cell, field)) - 0.5;
    rgb += signalNoise * grain * amount * (0.40 + 0.20 * audioTexture + (tape ? 0.30 * damage : 0.0));
  }
  if (crt) rgb = crtDisplay(screen, rgb);
  rgb = clamp(rgb, 0.0, 1.0);
  if (historyWeight > 0.0) {
    // Only brighter phosphor traces linger. Current coverage always comes from
    // the immutable input, so a moving transparent edge leaves no opaque wake.
    vec4 last = texture(history, uv);
    vec3 prior = straight(last, rgb);
    rgb = mix(rgb, max(rgb, prior * 0.91), historyWeight);
  }
  color = vec4(rgb * original.a, original.a);
}`

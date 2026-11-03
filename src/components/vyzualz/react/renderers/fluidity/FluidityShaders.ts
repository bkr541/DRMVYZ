export const FLUIDITY_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

export const FLUIDITY_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
out vec4 color;
uniform sampler2D source;
uniform vec2 viewportSize, fitSize, position, sourceTexel;
uniform float transformScale, rotation, motion, amount, refraction, surfaceScale, bevel, frost, highlight;
uniform float dispersion, lightAngle, pressure, pressureAge, detail;
uniform int surface, seed, frostTaps, qualityDetail;

const float TAU = 6.28318530718;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec4 image(vec2 p) {
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) return vec4(0);
  return texture(source, p);
}

float randomCell(ivec2 p, uint salt) {
  uint n = uint(p.x) * 197153649u ^ uint(p.y) * 231037001u ^ uint(seed) ^ salt;
  n ^= n >> 16u;
  n *= 0x7feb352du;
  n ^= n >> 15u;
  n *= 0x846ca68bu;
  n ^= n >> 16u;
  return float(n & 65535u) / 65535.0;
}

float contourHeight(vec2 uv) {
  vec4 s = image(uv);
  return dot(s.rgb, LUMA) * 0.65 + s.a * 0.35;
}

vec2 contourSlope(vec2 p, vec2 metric, float period, float phase) {
  vec2 stepUV = max(sourceTexel * 1.25, period * mix(0.030, 0.075, bevel) / metric);
  // Height is driven by the actual image. Changing the sampling radius breathes the bevel
  // without translating the contours away from their source edges.
  stepUV *= 1.0 + 0.24 * sin(motion * 1.5 + phase);
  vec2 dx = vec2(stepUV.x, 0), dy = vec2(0, stepUV.y);
  vec2 slope = vec2(contourHeight(p + dx) - contourHeight(p - dx), contourHeight(p + dy) - contourHeight(p - dy));
  if (qualityDetail > 0) {
    vec2 shoulder = vec2(contourHeight(p + dx * 2.0) - contourHeight(p - dx * 2.0),
                         contourHeight(p + dy * 2.0) - contourHeight(p - dy * 2.0));
    slope = mix(slope, shoulder, 0.34);
  }
  return slope * (1.8 + bevel);
}

vec2 waveSlope(vec2 p, vec2 center, float k, float phase, float strength) {
  vec2 d = p - center;
  float r = length(d);
  return strength * cos(k * r + phase) * d / max(r, 0.035);
}

vec2 rippleSlope(vec2 p, float period, float phase) {
  float k = TAU / period;
  vec2 focus = 0.13 * vec2(sin(motion * 0.47 + phase), cos(motion * 0.39 + phase));
  vec2 slope = waveSlope(p, focus + vec2(-0.17, 0.09), k, -motion * 3.4 + phase, 0.62);
  slope += waveSlope(p, -focus + vec2(0.27, -0.24), k * 0.68, -motion * 2.5 - phase, 0.35);
  if (qualityDetail > 0) {
    vec2 direction = vec2(0.82, 0.57);
    slope += direction * cos(dot(p, direction) * k * 1.75 - motion * 4.6) * (0.09 + 0.10 * detail);
  }
  return slope;
}

vec2 lensSlope(vec2 p, float period, float phase) {
  vec2 cell = p / (period * 1.4) + 0.5;
  cell.x += mod(floor(cell.y), 2.0) * 0.5;
  ivec2 id = ivec2(floor(cell));
  float variant = randomCell(id, 175u) * TAU + phase;
  vec2 d = fract(cell) - 0.5 - 0.047 * vec2(sin(motion * 1.2 + variant), cos(motion * 0.94 - variant));
  float radius = 0.36 + 0.045 * sin(motion * 0.77 + variant);
  float r = length(d) / radius;
  // A rounded convex cap with a tapered bevel and a flat inter-lens bed.
  float taper = 1.0 - smoothstep(0.76 - 0.24 * bevel, 1.0, r);
  float curvature = inversesqrt(max(0.14, 1.08 - r * r));
  return -d / radius * curvature * taper * 1.25;
}

vec2 ribSlope(vec2 p, float period, float phase) {
  const vec2 axis = vec2(0.987, 0.160);
  float bend = 0.09 * sin(p.y * 7.4 + motion * 1.23 + phase);
  float theta = TAU * (dot(p, axis) + bend) / (period * 0.64) - motion * 2.3;
  float wave = sin(theta);
  // Cylindrical ribs with a tunable lip. The gradient includes the longitudinal bow.
  float profile = wave * mix(0.83, 1.12 - 0.56 * cos(theta), bevel);
  vec2 gradient = vec2(axis.x, axis.y + 0.666 * cos(p.y * 7.4 + motion * 1.23 + phase));
  return -profile * gradient;
}

vec2 pressureSlope(vec2 p, float phase) {
  vec2 origin = 0.14 * vec2(cos(phase), sin(phase));
  vec2 d = p - origin;
  float r = length(d);
  float wave = (r - pressureAge * 0.83) / 0.085;
  return d / max(0.04, r) * (sin(wave * 2.8) * exp(-0.7 * wave * wave) * pressure * 0.85);
}

vec4 frostSample(vec2 p, vec2 blur) {
  vec4 center = image(p);
  if (frost <= 0.0) return center;
  vec2 tangent = vec2(0.83, 0.55) * blur;
  vec2 normal = vec2(-0.55, 0.83) * blur;
  vec4 sum = 2.0 * center + image(p + tangent) + image(p - tangent);
  if (frostTaps == 3) return sum * 0.25;
  sum += image(p + normal) + image(p - normal);
  if (frostTaps == 5) return sum / 6.0;
  vec2 a = (tangent + normal) * 0.61, b = (tangent - normal) * 0.61;
  return (sum + image(p + a) + image(p - a) + image(p + b) + image(p - b)) * 0.1;
}

void main() {
  vec2 q = (uv - 0.5) * viewportSize - position;
  float c = cos(rotation), s = sin(rotation);
  vec2 p = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / max(0.01, transformScale) / fitSize + 0.5;
  vec4 original = image(p);
  if (amount <= 0.0 || original.a <= 0.0) { color = original; return; }

  vec2 metric = fitSize / min(fitSize.x, fitSize.y);
  vec2 glass = (p - 0.5) * metric;
  float period = mix(0.115, 0.54, surfaceScale);
  float phase = randomCell(ivec2(0), 97u) * TAU;
  vec2 slope;
  if (surface == 0) slope = contourSlope(p, metric, period, phase);
  else if (surface == 1) slope = rippleSlope(glass, period, phase);
  else if (surface == 2) slope = lensSlope(glass, period, phase);
  else slope = ribSlope(glass, period, phase);
  if (pressure > 0.001) slope += pressureSlope(glass, phase);
  vec3 N = normalize(vec3(-slope * (0.82 + 0.68 * bevel), 1));
  // Snell's law for an air-to-glass interface viewed along the optical axis.
  vec3 ray = refract(vec3(0, 0, -1), N, 1.0 / 1.48);
  // Scale the optical path itself so partial strength does not ghost the dry image.
  float thickness = surface == 0 ? 0.13 : 0.24;
  vec2 bend = ray.xy / max(0.5, -ray.z) * (thickness * amount * refraction * (0.72 + 0.45 * bevel)) / metric;
  vec2 point = p + bend;
  vec4 through = frostSample(point, frost * frost * amount * 0.027 / metric);
  vec3 base = original.rgb / original.a;
  // Premultiplied samples and a silhouette anchor avoid RGB streaks and dark fringes.
  vec3 refracted = through.a > 0.0001 ? mix(base, through.rgb / through.a, smoothstep(0.0, 0.35, through.a)) : base;
  if (dispersion > 0.0 && refraction > 0.0) {
    vec4 red = image(point + bend * dispersion * 0.46);
    vec4 blue = image(point - bend * dispersion * 0.46);
    refracted.r = mix(refracted.r, red.r / max(0.0001, red.a), smoothstep(0.0, 0.35, red.a));
    refracted.b = mix(refracted.b, blue.b / max(0.0001, blue.a), smoothstep(0.0, 0.35, blue.a));
  }

  vec2 lightDir = vec2(cos(lightAngle), -sin(lightAngle));
  vec3 light = normalize(vec3(lightDir * 0.83, 0.72));
  vec3 halfVector = normalize(light + vec3(0, 0, 1));
  float gloss = pow(max(0.0, dot(N, halfVector)), mix(64.0, 19.0, frost));
  float key = max(0.0, dot(N, light) - light.z);
  float shade = max(0.0, light.z - dot(N, light));
  float fresnel = pow(1.0 - N.z, 2.0);
  float ridge = smoothstep(0.17, 0.59, length(N.xy)) * max(0.0, dot(N.xy, lightDir));
  float lighting = highlight * amount;
  float shine = lighting * clamp(gloss * 0.58 + ridge * 0.42 + key * 0.24 + fresnel * 0.34, 0.0, 0.86);
  vec3 lit = mix(refracted * (1.0 - lighting * shade * 0.46), vec3(1), shine);
  color = vec4(clamp(lit, 0.0, 1.0) * original.a, original.a);
}`

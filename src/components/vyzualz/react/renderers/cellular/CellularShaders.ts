export const CELLULAR_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

const FIELD = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D source, field;
uniform vec2 fieldSize;

// Each concentration occupies two RGBA8 channels. Nearest filtering keeps
// carry bits intact. Presentation interpolates the decoded values separately.
vec2 concentrations(vec4 packedField) {
  return (packedField.rb * 65280.0 + packedField.ga * 255.0) / 65535.0;
}
vec4 packField(vec2 value) {
  vec2 word = floor(clamp(value, 0.0, 1.0) * 65535.0 + 0.5);
  vec2 highByte = floor(word / 256.0);
  vec2 lowByte = word - highByte * 256.0;
  return vec4(highByte.x, lowByte.x, highByte.y, lowByte.y) / 255.0;
}
vec2 readField(vec2 position) { return concentrations(texture(field, position)); }
`

export const CELLULAR_STEP = FIELD + `
uniform float seed, spacing, feed, kill, diffusion, injection, pulse, stepSize;
uniform bool initializeField, expandAlpha;

float hash(vec2 p) {
  uvec2 key = uvec2(ivec2(p));
  uint h = (key.x * 1597334677u) ^ (key.y * 3812015801u) ^ uint(seed);
  h = (h ^ (h >> 16u)) * 2246822519u;
  return float(h ^ (h >> 13u)) / 4294967295.0;
}
void main() {
  vec4 pixel = texture(source, uv);
  float luma = dot(pixel.rgb, vec3(0.2126, 0.7152, 0.0722));
  float mask = pixel.a * mix(0.32, 1.0, luma);
  if (!expandAlpha && pixel.a < 0.005) { color = packField(vec2(1.0, 0.0)); return; }
  vec2 grid = uv * fieldSize / spacing;
  vec2 cell = floor(grid);
  vec2 jitter = vec2(hash(cell), hash(cell + vec2(37.0, 83.0))) * 0.52 - 0.26;
  float radius = mix(0.19, 0.32, hash(cell + 53.0));
  float spot = 1.0 - smoothstep(radius * 0.55, radius, length(fract(grid) - 0.5 - jitter));
  if (initializeField) {
    float seedV = spot * mask * mix(0.38, 0.62, hash(cell + 19.0));
    color = packField(vec2(1.0 - seedV * 0.95, seedV));
    return;
  }

  vec2 texel = 1.0 / fieldSize;
  vec2 here = readField(uv);
  vec2 axial = readField(uv + vec2(texel.x, 0)) + readField(uv - vec2(texel.x, 0))
    + readField(uv + vec2(0, texel.y)) + readField(uv - vec2(0, texel.y));
  vec2 diagonal = readField(uv + texel) + readField(uv - texel)
    + readField(uv + vec2(texel.x, -texel.y)) + readField(uv + vec2(-texel.x, texel.y));
  vec2 laplacian = 0.2 * axial + 0.05 * diagonal - here;
  float reaction = here.x * here.y * here.y;
  float inputV = mask * (spot * 0.004 * injection + (0.25 + spot * 0.75) * 0.035 * pulse);
  vec2 rates = laplacian * vec2(mix(0.68, 0.96, diffusion), mix(0.27, 0.48, diffusion))
    + vec2(-reaction + feed * (1.0 - here.x) - inputV * 0.5, reaction - (feed + kill) * here.y + inputV);
  vec2 next = here + rates * clamp(stepSize, 0.0, 1.0);
  if (any(isnan(next)) || any(isinf(next))) next = vec2(1.0, 0.0);
  color = packField(next);
}`

export const CELLULAR_PRESENT = FIELD + `
uniform vec2 outputSize, fitSize, position;
uniform float scale, rotation, edge, amount, reconstruction;
uniform bool duotone, expandAlpha;
uniform vec3 colorA, colorB;

float smoothV(vec2 p) {
  vec2 cell = p * fieldSize - 0.5;
  vec2 base = (floor(cell) + 0.5) / fieldSize;
  vec2 stepUV = 1.0 / fieldSize;
  vec2 f = fract(cell);
  float a = mix(readField(base).y, readField(base + vec2(stepUV.x, 0)).y, f.x);
  float b = mix(readField(base + vec2(0, stepUV.y)).y, readField(base + stepUV).y, f.x);
  return mix(a, b, f.y);
}

void main() {
  vec2 p = (uv - 0.5) * outputSize - position;
  float c = cos(rotation), s = sin(rotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / max(0.01, scale) / fitSize + 0.5;
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) { color = vec4(0); return; }
  vec4 pixel = texture(source, p);
  vec4 original = vec4(pixel.rgb * pixel.a, pixel.a);
  float mixAmount = amount * (1.0 - reconstruction);
  if (mixAmount <= 0.0) { color = original; return; }
  float v = smoothV(p);
  float spread = mix(0.2, 0.045, edge);
  float shape = smoothstep(0.035, 0.035 + spread, v);
  float ridge = (1.0 - smoothstep(0.015, 0.12, abs(v - 0.18))) * shape;
  vec3 sourceColor = pixel.a > 0.001 ? pixel.rgb : vec3(0.42, 0.58, 0.64);
  vec3 grown = duotone ? mix(colorA, colorB, clamp(shape * 0.85 + ridge * 0.15, 0.0, 1.0))
    : clamp(sourceColor * (1.0 - shape * 0.78) + (vec3(1.0) - sourceColor) * ridge * 0.28, 0.0, 1.0);
  float alpha = expandAlpha ? max(pixel.a, shape * 0.8) : pixel.a;
  color = mix(original, vec4(grown * alpha, alpha), mixAmount);
}`

export const PHASE_DRAG_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

const SOURCE = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D source;
uniform vec2 stillOffset;

vec4 readSource(vec2 p) {
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) return vec4(0);
  vec4 pixel = texture(source, p);
  return vec4(pixel.rgb * pixel.a, pixel.a);
}`

export const PHASE_DRAG_COPY = SOURCE + `
void main() { color = readSource(uv - stillOffset); }`

export const PHASE_DRAG_PRESENT = SOURCE + `
uniform highp sampler2DArray history;
uniform vec2 ages[12];
uniform int count, mode, direction, curve;
uniform vec2 outputSize, fitSize, position;
uniform float scale, rotation, phase, windowSeconds, width, ripple, depth, amount, reconstruction;

vec4 past(vec2 p, float delay) {
  vec2 newer = ages[0];
  if (count == 1 || delay <= newer.y) return texture(history, vec3(p, newer.x));
  for (int i = 1; i < 12; i++) {
    if (i >= count) break;
    vec2 older = ages[i];
    if (delay <= older.y) {
      float weight = clamp((delay - newer.y) / max(0.00001, older.y - newer.y), 0.0, 1.0);
      return mix(texture(history, vec3(p, newer.x)), texture(history, vec3(p, older.x)), weight);
    }
    newer = older;
  }
  return texture(history, vec3(p, newer.x));
}

void main() {
  vec2 p = (uv - 0.5) * outputSize - position;
  float c = cos(rotation), s = sin(rotation);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / max(0.01, scale) / fitSize + 0.5;
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) { color = vec4(0); return; }

  float coord = p.x;
  if (mode == 1) coord = 1.0 - p.y;
  if (mode == 2) coord = length((p - 0.5) * fitSize / max(fitSize.x, fitSize.y)) * 2.0;
  if (mode == 3) coord = 0.5 + 0.24 * sin(p.x * 12.0 + phase * 6.283) + 0.24 * cos(p.y * 10.0 - phase * 6.283);
  float head = direction == 2 ? 1.0 - abs(fract(phase) * 2.0 - 1.0) : fract(direction == 1 ? -phase : phase);
  float distanceToSlit = abs(coord - head);
  if (direction != 2) distanceToSlit = fract(direction == 1 ? head - coord : coord - head + 0.00001);
  float age = clamp((distanceToSlit - width * 0.5) / max(0.01, 1.0 - width * 0.5), 0.0, 1.0);
  if (curve == 1) age = smoothstep(0.0, 1.0, age);
  if (curve == 2) age = clamp(age + 0.13 * sin(age * 12.566 + phase * 6.283) * sin(age * 3.14159), 0.0, 1.0);
  age = clamp(age + ripple * sin(p.y * 37.0 + phase * 6.283), 0.0, 1.0);
  vec4 fresh = readSource(p - stillOffset);
  if (amount <= 0.0 || count == 0) { color = fresh; return; }
  color = mix(fresh, past(p, age * windowSeconds * depth * amount), amount);
  color = mix(color, readSource(p), reconstruction);
}`

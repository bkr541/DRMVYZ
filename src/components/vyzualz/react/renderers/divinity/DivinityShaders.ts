export const DIVINITY_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`

export const DIVINITY_MASK = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform sampler2D source;
uniform vec2 maskTexel;
uniform float threshold;
uniform bool alphaMask;

vec4 image(vec2 p) {
  if (any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1)))) return vec4(0);
  return texture(source, p);
}

void main() {
  vec2 d = maskTexel * 0.36;
  vec4 s = (image(uv + d) + image(uv - d) + image(uv + vec2(d.x, -d.y)) + image(uv + vec2(-d.x, d.y))) * 0.25;
  vec3 rgb = s.rgb / max(s.a, 0.00001);
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  // Soft threshold in straight RGB, then restore coverage so hidden RGB cannot emit.
  float highlights = smoothstep(max(0.0, threshold - 0.085), max(0.015, min(1.0, threshold + 0.095)), luma);
  float energy = s.a * (alphaMask ? 1.0 : highlights * luma);
  // Light tint keeps the source hue even when the emitting logo is dark.
  float peak = max(rgb.r, max(rgb.g, rgb.b));
  vec3 tint = mix(vec3(0.84), rgb / max(0.08, peak), smoothstep(0.035, 0.25, peak));
  color = vec4(tint * energy, energy);
}`

export const DIVINITY_PRESENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
out vec4 color;
uniform sampler2D source, maskTexture;
uniform vec2 viewportSize, fitSize, position, origin;
uniform float transformScale, rotation, amount, rayLength, spread, density, decay, detail;
uniform int tapCount;
uniform bool manualColor, clipToAlpha;
uniform vec3 rayColor;

bool outside(vec2 p) { return any(lessThan(p, vec2(0))) || any(greaterThan(p, vec2(1))); }
vec4 readMask(vec2 p, float lod) { return outside(p) ? vec4(0) : textureLod(maskTexture, p, lod); }

void main() {
  vec2 q = (uv - 0.5) * viewportSize - position;
  float c = cos(rotation), s = sin(rotation);
  vec2 p = vec2(c * q.x - s * q.y, s * q.x + c * q.y) / max(0.01, transformScale) / fitSize + 0.5;
  vec4 original = outside(p) ? vec4(0) : texture(source, p);
  if (amount <= 0.0 || rayLength <= 0.0 || density <= 0.0 || (clipToAlpha && original.a == 0.0)) {
    color = original;
    return;
  }

  vec2 metric = fitSize / min(fitSize.x, fitSize.y);
  vec2 radial = (p - origin) * metric;
  float distanceToLight = length(radial);
  float reach = rayLength * 1.04;
  float segment = min(distanceToLight, reach);
  vec2 tangent = vec2(-radial.y, radial.x) / max(distanceToLight, 0.00001);
  float fanWidth = mix(0.001, 0.079, spread * spread);
  if (segment < 0.00001 || length((p - clamp(p, 0.0, 1.0)) * metric) > reach * 1.01) {
    color = original;
    return;
  }

  float stepSize = segment / float(tapCount);
  float attenuation = pow(max(decay, 0.0001), 0.3 + 4.0 * stepSize);
  float attenuationStep = pow(max(decay, 0.0001), 8.0 * stepSize);
  vec2 maskPixels = vec2(textureSize(maskTexture, 0)) / metric;
  float texelsPerUnit = min(maskPixels.x, maskPixels.y);
  // Filter at the radial sampling footprint to suppress gaps between taps.
  // Farther samples get a broader footprint as the angular cone opens.
  float footprint = max(1.0, stepSize * texelsPerUnit * 1.25);
  vec4 light = vec4(0);
  for (int i = 0; i < 40; i++) {
    if (i >= tapCount) break;
    float travel = stepSize * (float(i) + 0.5);
    // Deterministic radial quadrature with an interleaved angular fan. There is
    // no frame jitter or wrapped/clamped sample outside the source aperture.
    float fan = (fract(float(i) * 0.61803399 + 0.25) * 2.0 - 1.0);
    vec2 offset = tangent * fan * fanWidth * travel * 0.23;
    float lod = log2(footprint + fanWidth * travel * texelsPerUnit);
    vec2 samplePoint = p - (radial * (travel / distanceToLight) + offset) / metric;
    float distanceWeight = attenuation * (1.0 - smoothstep(0.68, 1.0, travel / reach));
    light += readMask(samplePoint, lod) * distanceWeight;
    attenuation *= attenuationStep;
  }

  float exposure = (light.a / float(tapCount)) * (segment / reach) * amount * density * (8.2 + 1.8 * detail);
  float emission = min(0.82, 1.0 - exp(-exposure));
  vec3 tint = manualColor ? rayColor : light.rgb / max(light.a, 0.00001);
  vec3 lit = original.rgb + (vec3(original.a) - original.rgb) * tint * emission;
  float extra = clipToAlpha ? 0.0 : (1.0 - original.a) * emission;
  color = vec4(lit + tint * extra, original.a + extra);
}`

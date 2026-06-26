export const PIXEL_SCATTER_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
uniform float u_seed;
out vec4 fragColor;

// Cheap 2-component hash
vec2 hash2(vec2 p, float seed) {
  p = vec2(dot(p, vec2(127.1 + seed, 311.7)), dot(p, vec2(269.5, 183.3 + seed)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2  h     = hash2(floor(v_uv * 64.0), u_seed);
  // Each pixel departs at a random time within [0, 0.8] of the transition
  float depart = h.x * 0.8;
  float local  = clamp((uTransitionProgress - depart) / 0.2, 0.0, 1.0);
  // Offset grows during flight
  vec2  offset = h * 2.0 - 1.0;
  vec2  uvA    = v_uv + offset * local * u_intensity * 0.3;
  vec4  a      = texture(u_texA, clamp(uvA, 0.0, 1.0));
  vec4  b      = texture(u_texB, v_uv);
  float mask   = local;
  fragColor    = mix(a, b, mask);
}
`

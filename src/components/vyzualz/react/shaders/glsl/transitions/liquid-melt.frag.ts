export const LIQUID_MELT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
uniform float u_seed;
out vec4 fragColor;

float wave(float x, float freq, float phase) {
  return sin(x * freq + phase) * 0.5 + 0.5;
}

void main() {
  float t   = uTransitionProgress;
  // Drip displacement — columns of the outgoing scene drip downward
  float freq   = 4.0 + u_seed * 3.14159;
  float drip   = wave(v_uv.x, freq, u_seed) * t * u_intensity * 0.4;
  vec2  uvA    = vec2(v_uv.x, v_uv.y - drip);
  vec4  a      = texture(u_texA, clamp(uvA, 0.0, 1.0));

  // Incoming scene wipes up from bottom as A melts down
  float reveal = smoothstep(v_uv.y - drip * 0.5, v_uv.y + 0.05, t);
  vec4  b      = texture(u_texB, v_uv);

  fragColor = mix(a, b, reveal);
}
`

export const NOISE_DISSOLVE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
uniform float u_seed;
out vec4 fragColor;

// LCG hash — same algorithm as ShaderNoiseTextureFactory
float lcgNoise(vec2 p, float seed) {
  uint s = uint(p.x * 1023.0 + 1.0) * 1664525u + uint(p.y * 1023.0 + 1.0) * 22695477u + uint(seed) * 1013904223u;
  s = (s * 1664525u + 1013904223u) & 0xFFFFFFu;
  return float(s) / float(0xFFFFFF);
}

void main() {
  vec4 a    = texture(u_texA, v_uv);
  vec4 b    = texture(u_texB, v_uv);
  float n   = lcgNoise(v_uv, u_seed);
  float soft = max(0.02, 0.15 * (1.0 - u_intensity));
  float mask = smoothstep(uTransitionProgress - soft, uTransitionProgress + soft, n);
  fragColor  = mix(a, b, mask);
}
`

export const LUMA_DISSOLVE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
out vec4 fragColor;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

void main() {
  vec4 a = texture(u_texA, v_uv);
  vec4 b = texture(u_texB, v_uv);
  float L      = luma(a.rgb);
  float edge   = mix(0.0, 1.0 + u_intensity * 0.5, uTransitionProgress);
  float soft   = u_intensity * 0.25 + 0.02;
  float mask   = smoothstep(edge - soft, edge + soft, L);
  fragColor    = mix(a, b, mask);
}
`

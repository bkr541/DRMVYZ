export const CROSSFADE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
out vec4 fragColor;
void main() {
  vec4 a = texture(u_texA, v_uv);
  vec4 b = texture(u_texB, v_uv);
  fragColor = mix(a, b, uTransitionProgress);
}
`

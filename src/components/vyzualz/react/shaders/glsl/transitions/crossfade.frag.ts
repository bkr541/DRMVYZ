export const CROSSFADE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
uniform int u_selfTransition;
out vec4 fragColor;
void main() {
  vec4 a = texture(u_texA, v_uv);
  vec4 b = texture(u_texB, v_uv);
  if (u_selfTransition == 1) {
    float pulse = sin(uTransitionProgress * 3.14159265);
    float dip = 1.0 - pulse * 0.42 * u_intensity;
    fragColor = vec4(a.rgb * dip, a.a);
    return;
  }
  fragColor = mix(a, b, uTransitionProgress);
}
`

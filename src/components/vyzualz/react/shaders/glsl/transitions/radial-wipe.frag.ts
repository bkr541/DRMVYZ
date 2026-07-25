export const RADIAL_WIPE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
uniform int   u_direction;
uniform int   u_selfTransition;
out vec4 fragColor;

void main() {
  vec4  a     = texture(u_texA, v_uv);
  vec4  b     = texture(u_texB, v_uv);
  vec2  d     = v_uv - 0.5;
  float angle = atan(d.y, d.x);                 // -π..π
  float norm  = (angle + 3.14159265) / 6.28318530; // 0..1

  // Direction: forward = clockwise, backward = counterclockwise
  if (u_direction == 1) norm = 1.0 - norm;

  float edge  = uTransitionProgress;
  float soft  = 0.02 + (1.0 - u_intensity) * 0.1;
  float mask  = smoothstep(edge - soft, edge + soft, norm);
  if (u_selfTransition == 1) {
    float phase = 1.0 - abs(uTransitionProgress * 2.0 - 1.0);
    float visible = smoothstep(phase - soft, phase + soft, norm);
    fragColor = vec4(a.rgb * visible, a.a);
    return;
  }
  fragColor   = mix(a, b, mask);
}
`

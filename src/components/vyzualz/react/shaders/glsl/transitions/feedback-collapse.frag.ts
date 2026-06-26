export const FEEDBACK_COLLAPSE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
out vec4 fragColor;

void main() {
  float t      = uTransitionProgress;
  vec2  center = vec2(0.5);
  vec2  d      = v_uv - center;

  // A collapses inward with spiral echo
  float collapse = 1.0 - t * u_intensity * 0.6;
  float spin     = t * u_intensity * 0.15;
  float cs       = cos(spin), sn = sin(spin);
  vec2  rotated  = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
  vec2  uvA      = center + rotated * max(collapse, 0.01);
  vec4  a        = texture(u_texA, clamp(uvA, 0.0, 1.0));

  // A fades and blooms slightly before B takes over
  float decay  = 1.0 - smoothstep(0.5, 1.0, t);
  float bloom  = 1.0 + smoothstep(0.3, 0.6, t) * u_intensity * 0.4;

  vec4  b = texture(u_texB, v_uv);
  fragColor = mix(a * vec4(vec3(bloom), 1.0) * decay, b, t);
}
`

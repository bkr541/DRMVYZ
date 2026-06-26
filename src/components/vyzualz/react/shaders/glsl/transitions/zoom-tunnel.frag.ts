export const ZOOM_TUNNEL_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
out vec4 fragColor;

void main() {
  vec2  center = vec2(0.5);
  vec2  d      = v_uv - center;
  float t      = uTransitionProgress;

  // Outgoing zooms out (shrinks toward center, fades)
  float zoomA  = 1.0 + t * u_intensity * 1.5;
  vec2  uvA    = center + d / zoomA;
  float alphaA = 1.0 - t;
  vec4  a      = texture(u_texA, clamp(uvA, 0.0, 1.0)) * alphaA;

  // Incoming zooms in from very small (tunnel effect)
  float zoomB  = 1.0 + (1.0 - t) * u_intensity * 3.0;
  vec2  uvB    = center + d / zoomB;
  float alphaB = t;
  vec4  b      = texture(u_texB, clamp(uvB, 0.0, 1.0)) * alphaB;

  // Combine over black
  fragColor = a + b;
}
`

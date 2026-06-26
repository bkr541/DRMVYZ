export const FLASH_CUT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
out vec4 fragColor;

void main() {
  float t     = uTransitionProgress;
  // Flash: linearly brighten to white, then cut to B and resolve
  float peak  = 0.35;
  float flash = 0.0;
  if (t < peak) {
    flash = smoothstep(0.0, peak, t) * u_intensity;
  }
  // At peak, cut to B immediately
  vec4  a   = texture(u_texA, v_uv);
  vec4  b   = texture(u_texB, v_uv);
  vec4  src = t < peak ? a : b;
  // Fade flash out on the B side
  float fadeOut = t >= peak ? smoothstep(peak, min(peak + 0.3, 1.0), t) : 0.0;
  float flashFinal = flash - fadeOut * u_intensity;
  fragColor = src + vec4(vec3(max(flashFinal, 0.0)), 0.0);
}
`

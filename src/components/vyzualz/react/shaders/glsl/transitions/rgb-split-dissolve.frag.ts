export const RGB_SPLIT_DISSOLVE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform float uTransitionProgress;
uniform float u_intensity;
out vec4 fragColor;

void main() {
  // During first half: split A into RGB channels, pulling them apart.
  // During second half: converge B from split channels.
  float split = sin(uTransitionProgress * 3.14159265) * u_intensity * 0.04;
  vec2  offR  = vec2( split, 0.0);
  vec2  offB  = vec2(-split, 0.0);

  // Outgoing scene with chromatic split
  vec4 aR = texture(u_texA, clamp(v_uv + offR, 0.0, 1.0));
  vec4 aG = texture(u_texA, v_uv);
  vec4 aB = texture(u_texA, clamp(v_uv + offB, 0.0, 1.0));
  vec4 aSplit = vec4(aR.r, aG.g, aB.b, aG.a);

  // Incoming scene with converging split
  float splitB = (1.0 - uTransitionProgress) * u_intensity * 0.04;
  vec4 bR = texture(u_texB, clamp(v_uv + vec2( splitB, 0.0), 0.0, 1.0));
  vec4 bG = texture(u_texB, v_uv);
  vec4 bBl= texture(u_texB, clamp(v_uv + vec2(-splitB, 0.0), 0.0, 1.0));
  vec4 bSplit = vec4(bR.r, bG.g, bBl.b, bG.a);

  fragColor = mix(aSplit, bSplit, uTransitionProgress);
}
`

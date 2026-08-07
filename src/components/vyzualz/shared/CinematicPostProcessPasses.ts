/**
 * Renderer-neutral Cinematic post-pass semantics shared by the standalone
 * Cinematic pipeline and Cinema graph effect nodes. This module owns no WebGL
 * context, framebuffer, program, or animation lifecycle.
 */
export const CINEMATIC_POST_PROCESS_CONSTANTS = Object.freeze({
  bloomThreshold: 0.28,
  bloomBaseGain: 0.5,
  bloomGain: 1.7,
  vignetteOuter: 1.25,
  vignetteInner: 0.2,
  chromaticShift: 0.008,
  feedbackDrift: 0.0012,
  feedbackZoom: 0.008,
  feedbackHistoryAttenuation: 0.925,
  feedbackReadabilityLow: 0.02,
  feedbackReadabilityHigh: 0.22,
  feedbackBlend: 0.72,
  feedbackHistoryMix: 0.62,
  toneGamma: 2.2,
})

const COMMON_HEADER = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uAmount;
uniform float uTime;
`

const C = CINEMATIC_POST_PROCESS_CONSTANTS

export const CINEMATIC_POST_PROCESS_PASS_SOURCES = Object.freeze({
  copy: `${COMMON_HEADER}
void main() { outColor = texture(uSource, v_uv); }
`,
  bloom: `${COMMON_HEADER}
void main() {
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  vec3 base = texture(uSource, v_uv).rgb;
  vec3 glow = vec3(0.0);
  glow += texture(uSource, v_uv + vec2( px.x, 0.0) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(-px.x, 0.0) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(0.0,  px.y) * 2.0).rgb;
  glow += texture(uSource, v_uv + vec2(0.0, -px.y) * 2.0).rgb;
  glow *= 0.25;
  glow = max(glow - vec3(${C.bloomThreshold}), vec3(0.0));
  outColor = vec4(base + glow * (${C.bloomBaseGain} + uAmount * ${C.bloomGain}), 1.0);
}
`,
  vignette: `${COMMON_HEADER}
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float edge = smoothstep(${C.vignetteOuter}, ${C.vignetteInner}, dot(p, p));
  vec3 color = texture(uSource, v_uv).rgb;
  outColor = vec4(color * mix(1.0, edge, uAmount), 1.0);
}
`,
  chromatic: `${COMMON_HEADER}
void main() {
  vec2 p = v_uv - 0.5;
  vec2 shift = normalize(p + vec2(0.0001)) * (uAmount * ${C.chromaticShift});
  float r = texture(uSource, v_uv + shift).r;
  float g = texture(uSource, v_uv).g;
  float b = texture(uSource, v_uv - shift).b;
  outColor = vec4(r, g, b, 1.0);
}
`,
  grain: `${COMMON_HEADER}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 19.19) * 43758.5453);
}
void main() {
  vec3 color = texture(uSource, v_uv).rgb;
  float grain = (hash(gl_FragCoord.xy) - 0.5) * uAmount;
  outColor = vec4(color + grain, 1.0);
}
`,
  feedback: `${COMMON_HEADER}
uniform sampler2D uHistory;
void main() {
  vec2 centered = v_uv - 0.5;
  vec2 drift = vec2(sin(uTime * 0.17), cos(uTime * 0.13)) * ${C.feedbackDrift} * uAmount;
  vec2 historyUv = 0.5 + centered * (1.0 + ${C.feedbackZoom} * uAmount) + drift;
  vec3 current = texture(uSource, v_uv).rgb;
  vec3 history = texture(uHistory, clamp(historyUv, vec2(0.001), vec2(0.999))).rgb * ${C.feedbackHistoryAttenuation};
  float currentLuma = dot(current, vec3(0.2126, 0.7152, 0.0722));
  float historyLuma = dot(history, vec3(0.2126, 0.7152, 0.0722));
  float readability = smoothstep(${C.feedbackReadabilityLow}, ${C.feedbackReadabilityHigh}, currentLuma + historyLuma * 0.35);
  float blend = uAmount * ${C.feedbackBlend} * readability;
  outColor = vec4(mix(current, current + history * ${C.feedbackHistoryMix}, blend), 1.0);
}
`,
  tone: `${COMMON_HEADER}
uniform float uExposure;
void main() {
  vec3 color = max(texture(uSource, v_uv).rgb * uExposure, vec3(0.0));
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / ${C.toneGamma}));
  outColor = vec4(color, 1.0);
}
`,
  final: `${COMMON_HEADER}
void main() { outColor = vec4(texture(uSource, v_uv).rgb, 1.0); }
`,
})

export type CinematicPostProcessProgramName = keyof typeof CINEMATIC_POST_PROCESS_PASS_SOURCES

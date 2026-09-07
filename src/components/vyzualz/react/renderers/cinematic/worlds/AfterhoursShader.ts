import { AFTERHOURS_MAX_BEAMS } from './AfterhoursBeamGeometry'

const BEAM_UNIFORMS = Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `
uniform vec4 uAfterhoursBeam${index};
uniform vec2 uAfterhoursBeamMeta${index};`).join('')

const BEAM_ACCUMULATION = Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `
  color += renderBeam(uv, uAfterhoursBeam${index}, uAfterhoursBeamMeta${index});`).join('')

export const AFTERHOURS_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 uResolution;
uniform vec3 uAfterhoursBackground;
uniform vec3 uAfterhoursPrimary;
uniform vec3 uAfterhoursAccent;
uniform float uAfterhoursAtmosphere;
${BEAM_UNIFORMS}
out vec4 outColor;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float denom = max(dot(ba, ba), 0.000001);
  float h = clamp(dot(pa, ba) / denom, 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 renderBeam(vec2 uv, vec4 line, vec2 meta) {
  if (meta.x <= 0.0) return vec3(0.0);
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 p = (uv - vec2(0.5)) * vec2(aspect, 1.0);
  vec2 a = (line.xy - vec2(0.5)) * vec2(aspect, 1.0);
  vec2 b = (line.zw - vec2(0.5)) * vec2(aspect, 1.0);
  float distanceToBeam = segmentDistance(p, a, b);
  float core = exp(-distanceToBeam * 900.0);
  float body = exp(-distanceToBeam * 330.0);
  float glow = exp(-distanceToBeam * 72.0) * uAfterhoursAtmosphere;
  float sourceGlow = exp(-length(p - a) * 36.0) * (0.2 + uAfterhoursAtmosphere * 0.8);
  vec3 roleColor = mix(uAfterhoursPrimary, uAfterhoursAccent, clamp(meta.y, 0.0, 1.0));
  vec3 whiteCore = mix(roleColor, vec3(1.0), 0.72);
  return roleColor * (body * 0.72 + glow * 0.22 + sourceGlow * 0.06) + whiteCore * core * 1.3;
}

void main() {
  vec2 uv = v_uv;
  vec3 color = uAfterhoursBackground;
${BEAM_ACCUMULATION}
  float verticalHaze = smoothstep(0.0, 0.65, uv.y) * (1.0 - smoothstep(0.78, 1.0, uv.y));
  color += mix(uAfterhoursPrimary, uAfterhoursAccent, 0.25) * verticalHaze * uAfterhoursAtmosphere * 0.018;
  outColor = vec4(max(color, vec3(0.0)), 1.0);
}
`

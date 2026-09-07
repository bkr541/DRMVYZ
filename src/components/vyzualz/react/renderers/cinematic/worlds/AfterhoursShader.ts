import { AFTERHOURS_MAX_BEAMS } from './AfterhoursBeamGeometry'

const BEAM_UNIFORMS = Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `
uniform vec4 uAfterhoursBeam${index};
uniform vec2 uAfterhoursBeamMeta${index};`).join('')

const BEAM_ACCUMULATION = Array.from({ length: AFTERHOURS_MAX_BEAMS }, (_, index) => `
  color += renderBeam(fieldPoint, uAfterhoursBeam${index}, uAfterhoursBeamMeta${index}, haze);`).join('')

/**
 * Afterhours Stage 3 laser rendering. Single WebGL2 fullscreen pass, no
 * textures. Each active beam is drawn as a bounded stack:
 *
 *   broad atmospheric scatter (haze-gated)
 *     -> soft colored envelope
 *       -> saturated beam body (length-tapered)
 *         -> very narrow high-luminance core
 *   + a restrained bloom at the fixed emitter origin
 *
 * Atmosphere raises both the per-beam volumetric glow and a low-frequency haze
 * floor, but the final image is tone-mapped so Atmosphere 1 stays luminous
 * rather than washing the frame to a flat solid. Inactive slots (meta.x <= 0)
 * contribute exactly zero.
 */
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

float segmentT(vec2 p, vec2 a, vec2 b) {
  vec2 ba = b - a;
  float denom = max(dot(ba, ba), 1e-6);
  return clamp(dot(p - a, ba) / denom, 0.0, 1.0);
}

float segmentDistance(vec2 p, vec2 a, vec2 b, out float along) {
  along = segmentT(p, a, b);
  return length(p - (a + (b - a) * along));
}

// Cheap value noise for a low-frequency haze floor — spatial only, so the
// scene is deterministic and does not drift per frame.
float hashNoise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hashNoise(i);
  float b = hashNoise(i + vec2(1.0, 0.0));
  float c = hashNoise(i + vec2(0.0, 1.0));
  float d = hashNoise(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 renderBeam(vec2 p, vec4 line, vec2 meta, float haze) {
  if (meta.x <= 0.0) return vec3(0.0);
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 a = (line.xy - vec2(0.5)) * vec2(aspect, 1.0);
  vec2 b = (line.zw - vec2(0.5)) * vec2(aspect, 1.0);

  float along;
  float dist = segmentDistance(p, a, b, along);

  // Laser body colour, plus a hot core that keeps a trace of the hue instead
  // of blowing out to pure white everywhere.
  vec3 bodyColor = mix(uAfterhoursPrimary, uAfterhoursAccent, clamp(meta.y, 0.0, 1.0));
  vec3 coreColor = mix(bodyColor, vec3(1.0), 0.6);

  // Intensity tapers from the emitter toward the target so beams read as light
  // travelling through air rather than flat strokes.
  float lengthTaper = mix(1.0, 0.34, smoothstep(0.0, 1.0, along));

  float core = exp(-dist * 1100.0);
  float body = exp(-dist * 300.0) * lengthTaper;
  float envelope = exp(-dist * 96.0) * (0.35 + 0.65 * haze);
  float scatter = exp(-dist * 26.0) * haze * 0.5;

  // Restrained bloom at the fixed emitter origin only.
  float sourceBloom = exp(-length(p - a) * 30.0) * (0.18 + 0.55 * haze);

  vec3 lit = coreColor * core * 1.35
    + bodyColor * body * 0.85
    + bodyColor * envelope * 0.30
    + bodyColor * scatter * 0.16
    + coreColor * sourceBloom * 0.12;
  return lit;
}

void main() {
  vec2 uv = v_uv;
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 fieldPoint = (uv - vec2(0.5)) * vec2(aspect, 1.0);

  float atmosphere = clamp(uAfterhoursAtmosphere, 0.0, 1.0);

  // Low-frequency haze floor: never a flat grey overlay, always subtle, and it
  // stays faintly present whenever Atmosphere > 0 so quiet states are not pure
  // black. Weighted toward the lower half where the bottom bank lives.
  float hazeField = valueNoise(uv * vec2(3.0, 4.5)) * 0.6 + valueNoise(uv * vec2(9.0, 11.0)) * 0.4;
  float verticalBias = mix(1.0, 0.35, smoothstep(0.15, 0.95, uv.y));
  float haze = atmosphere * atmosphere * (0.22 + 0.78 * hazeField) * verticalBias;

  vec3 color = uAfterhoursBackground;
  color += mix(uAfterhoursPrimary, uAfterhoursAccent, 0.2) * haze * 0.05;
${BEAM_ACCUMULATION}

  // Tone-map so strong Atmosphere still resolves to bright rays in haze rather
  // than a solid wash, and nothing exceeds displayable range.
  color = color / (color + vec3(0.85));
  outColor = vec4(clamp(color, vec3(0.0), vec3(1.0)), 1.0);
}
`

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
  CINEMA2_FULLSCREEN_SHADER_MODULE_VERSION,
} from '../modules/Cinema2FullscreenShaderModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HUMN_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hum-n')
export const CINEMA2_HUMN_MODULE_ID = cinema2StableId<Cinema2ModuleId>('hum-n-emergence')
export const CINEMA2_HUMN_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-root')
export const CINEMA2_HUMN_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-emergence-node')
export const CINEMA2_HUMN_LAYER_ID = cinema2StableId<Cinema2LayerId>('hum-n-emergence-layer')

/** Prompt 01 only: deterministic still with no time/audio/automation inputs. */
export const CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
out vec4 outColor;

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(pa - ba * h);
}

float segmentMask(vec2 p, vec2 a, vec2 b, float width, float feather) {
  return 1.0 - smoothstep(width, width + feather, sdSegment(p, a, b));
}

float pointGlow(vec2 p, vec2 c, float radius) {
  return 1.0 - smoothstep(0.0, radius, length(p - c));
}

void main() {
  vec2 resolution = max(u_resolution, vec2(1.0));
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float px = 2.0 / resolution.y;
  float stroke = 1.18 * px;
  float feather = 1.35 * px;

  vec2 pixel = v_uv * resolution;
  vec2 gridCell = abs(fract(pixel / 72.0) - 0.5);
  float grid = max(smoothstep(0.486, 0.5, gridCell.x), smoothstep(0.486, 0.5, gridCell.y));
  float vignette = 1.0 - smoothstep(0.48, 1.18, length((v_uv - 0.5) * vec2(0.86, 1.0)));

  float ink = 0.0;
  float ghost = 0.0;
  float cyan = 0.0;
  float magenta = 0.0;

  // Broken crown and scalp fragments.
  ink = max(ink, segmentMask(p, vec2(-0.54, 0.69), vec2(-0.34, 0.91), stroke, feather) * 0.22);
  ink = max(ink, segmentMask(p, vec2(-0.31, 0.96), vec2(-0.05, 1.02), stroke, feather) * 0.30);
  ink = max(ink, segmentMask(p, vec2(-0.28, 0.94), vec2(0.12, 0.90), stroke, feather) * 0.19);
  ink = max(ink, segmentMask(p, vec2(0.33, 0.88), vec2(0.48, 0.70), stroke, feather) * 0.24);
  ink = max(ink, segmentMask(p, vec2(0.44, 0.67), vec2(0.55, 0.55), stroke, feather) * 0.18);
  ink = max(ink, segmentMask(p, vec2(0.55, 0.55), vec2(0.57, 0.36), stroke, feather) * 0.27);

  // Outer face fragments, intentionally interrupted.
  ink = max(ink, segmentMask(p, vec2(-0.61, 0.55), vec2(-0.69, 0.36), stroke, feather) * 0.25);
  ink = max(ink, segmentMask(p, vec2(-0.69, 0.26), vec2(-0.63, 0.06), stroke, feather) * 0.29);
  ink = max(ink, segmentMask(p, vec2(-0.49, 0.30), vec2(-0.43, -0.24), stroke, feather) * 0.31);
  ink = max(ink, segmentMask(p, vec2(-0.43, -0.24), vec2(-0.23, -0.48), stroke, feather) * 0.23);
  ink = max(ink, segmentMask(p, vec2(0.56, 0.28), vec2(0.55, 0.08), stroke, feather) * 0.24);
  ink = max(ink, segmentMask(p, vec2(0.48, 0.29), vec2(0.41, -0.22), stroke, feather) * 0.30);
  ink = max(ink, segmentMask(p, vec2(0.41, -0.22), vec2(0.22, -0.47), stroke, feather) * 0.24);

  // Brows and eye planes establish the humanoid before the skin exists.
  ink = max(ink, segmentMask(p, vec2(-0.46, 0.31), vec2(-0.17, 0.27), stroke, feather) * 0.34);
  ink = max(ink, segmentMask(p, vec2(-0.44, 0.21), vec2(-0.18, 0.24), stroke, feather) * 0.24);
  ink = max(ink, segmentMask(p, vec2(-0.44, 0.21), vec2(-0.31, 0.34), stroke, feather) * 0.17);
  ink = max(ink, segmentMask(p, vec2(0.16, 0.26), vec2(0.43, 0.31), stroke, feather) * 0.33);
  ink = max(ink, segmentMask(p, vec2(0.18, 0.23), vec2(0.42, 0.19), stroke, feather) * 0.23);
  ink = max(ink, segmentMask(p, vec2(0.42, 0.19), vec2(0.31, 0.34), stroke, feather) * 0.17);
  ink = max(ink, segmentMask(p, vec2(-0.34, 0.22), vec2(-0.29, 0.29), stroke, feather) * 0.22);
  ink = max(ink, segmentMask(p, vec2(-0.29, 0.29), vec2(-0.23, 0.22), stroke, feather) * 0.19);
  ink = max(ink, segmentMask(p, vec2(0.25, 0.22), vec2(0.30, 0.29), stroke, feather) * 0.22);
  ink = max(ink, segmentMask(p, vec2(0.30, 0.29), vec2(0.36, 0.21), stroke, feather) * 0.19);

  // Nose, mouth and lower-face polygon fragments.
  ink = max(ink, segmentMask(p, vec2(0.00, 0.28), vec2(0.06, -0.10), stroke, feather) * 0.32);
  ink = max(ink, segmentMask(p, vec2(0.06, -0.10), vec2(-0.02, -0.22), stroke, feather) * 0.29);
  ink = max(ink, segmentMask(p, vec2(-0.02, -0.22), vec2(0.19, -0.11), stroke, feather) * 0.20);
  ink = max(ink, segmentMask(p, vec2(0.00, 0.28), vec2(-0.18, 0.16), stroke, feather) * 0.13);
  ink = max(ink, segmentMask(p, vec2(0.00, 0.28), vec2(0.19, 0.15), stroke, feather) * 0.13);
  ink = max(ink, segmentMask(p, vec2(-0.24, -0.20), vec2(0.20, -0.19), stroke, feather) * 0.27);
  ink = max(ink, segmentMask(p, vec2(-0.16, -0.27), vec2(0.12, -0.31), stroke, feather) * 0.15);
  ink = max(ink, segmentMask(p, vec2(-0.22, -0.48), vec2(0.01, -0.56), stroke, feather) * 0.29);
  ink = max(ink, segmentMask(p, vec2(0.01, -0.56), vec2(0.22, -0.47), stroke, feather) * 0.24);

  // Neck / shoulders are fainter so the bust seems to arrive from darkness.
  ink = max(ink, segmentMask(p, vec2(-0.22, -0.49), vec2(-0.20, -0.78), stroke, feather) * 0.20);
  ink = max(ink, segmentMask(p, vec2(0.20, -0.48), vec2(0.18, -0.77), stroke, feather) * 0.19);
  ink = max(ink, segmentMask(p, vec2(-0.20, -0.76), vec2(0.00, -0.91), stroke, feather) * 0.21);
  ink = max(ink, segmentMask(p, vec2(0.00, -0.91), vec2(0.20, -0.76), stroke, feather) * 0.21);
  ink = max(ink, segmentMask(p, vec2(-0.20, -0.73), vec2(-0.62, -0.91), stroke, feather) * 0.18);
  ink = max(ink, segmentMask(p, vec2(-0.62, -0.91), vec2(-1.10, -1.04), stroke, feather) * 0.12);
  ink = max(ink, segmentMask(p, vec2(0.20, -0.73), vec2(0.63, -0.91), stroke, feather) * 0.18);
  ink = max(ink, segmentMask(p, vec2(0.63, -0.91), vec2(1.10, -1.04), stroke, feather) * 0.12);

  // Ghost geometry foreshadows the later polygon skin without filling it yet.
  ghost = max(ghost, segmentMask(p, vec2(-0.32, 0.91), vec2(-0.16, 0.99), stroke * 2.6, feather * 2.0) * 0.025);
  ghost = max(ghost, segmentMask(p, vec2(-0.16, 0.99), vec2(0.10, 0.92), stroke * 2.6, feather * 2.0) * 0.020);
  ghost = max(ghost, segmentMask(p, vec2(-0.18, 0.16), vec2(-0.02, -0.22), stroke * 2.5, feather * 2.0) * 0.020);
  ghost = max(ghost, segmentMask(p, vec2(0.19, 0.15), vec2(0.20, -0.19), stroke * 2.5, feather * 2.0) * 0.018);

  // Minimal spectral traces only. Full color skin comes in later prompts.
  cyan = max(cyan, segmentMask(p, vec2(0.43, 0.31), vec2(0.56, 0.28), stroke * 1.15, feather) * 0.13);
  cyan = max(cyan, segmentMask(p, vec2(-0.20, -0.76), vec2(-0.62, -0.91), stroke * 1.15, feather) * 0.055);
  magenta = max(magenta, segmentMask(p, vec2(-0.44, 0.21), vec2(-0.31, 0.34), stroke * 1.15, feather) * 0.075);
  magenta = max(magenta, segmentMask(p, vec2(0.06, -0.10), vec2(0.19, -0.11), stroke * 1.15, feather) * 0.060);

  float eyeDust = min(pointGlow(p, vec2(-0.29, 0.24), 0.028) + pointGlow(p, vec2(0.30, 0.24), 0.028), 1.0) * 0.025;
  vec3 background = vec3(0.0016, 0.0024, 0.0030);
  vec3 gridColor = vec3(0.12, 0.18, 0.20) * grid * 0.075 * vignette;
  vec3 lineColor = vec3(0.72, 0.78, 0.81) * ink;
  vec3 ghostColor = vec3(0.17, 0.24, 0.27) * ghost;
  vec3 spectral = vec3(0.10, 0.82, 0.88) * cyan + vec3(0.92, 0.11, 0.58) * magenta;
  vec3 dust = vec3(0.28, 0.62, 0.67) * eyeDust;
  vec3 color = (background + gridColor + lineColor + ghostColor + spectral + dust) * (0.72 + 0.28 * vignette);
  outColor = vec4(color, 1.0);
}
`

export const CINEMA2_HUMN_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_HUMN_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'HUM:N',
    description: 'A near-black geometric humanoid emergence frame built from sparse fractured line art and restrained spectral traces.',
    tags: Object.freeze(['hum-n', 'native', 'humanoid', 'line-art', 'screen-space', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Deterministic screen-space procedural line-art foundation rendering.' }),
  ]),
  parameters: Object.freeze([CINEMA2_QUALITY_MODE_PARAMETER]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_MODULE_ID,
    typeId: CINEMA2_FULLSCREEN_SHADER_MODULE_TYPE_ID,
    version: CINEMA2_FULLSCREEN_SHADER_MODULE_VERSION,
    enabled: true,
    config: Object.freeze({ label: 'HUM:N Static Emergence Foundation', fragmentSource: CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: CINEMA2_HUMN_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: CINEMA2_HUMN_MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID), module: cinema2Ref(CINEMA2_HUMN_MODULE_ID), visible: true }),
    ]),
  }),
  layers: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_LAYER_ID,
    label: 'HUM:N Emergence',
    source: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
})

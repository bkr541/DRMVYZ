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

const int PRIMARY_SEGMENT_COUNT = 100;
const vec4 PRIMARY_SEGMENTS[PRIMARY_SEGMENT_COUNT] = vec4[PRIMARY_SEGMENT_COUNT](
  vec4(-0.182788, 0.782178, -0.036558, 0.826352),
  vec4(-0.194973, 0.779132, 0.108149, 0.739528),
  vec4(-0.239147, 0.738005, -0.207159, 0.768469),
  vec4(0.172125, 0.742574, 0.237624, 0.672506),
  vec4(-0.306169, 0.677075, -0.265042, 0.715156),
  vec4(0.214775, 0.649657, 0.292460, 0.584158),
  vec4(-0.394516, 0.468393, -0.347296, 0.625286),
  vec4(-0.345773, 0.622239, -0.295506, 0.469916),
  vec4(0.293983, 0.582635, 0.309216, 0.412034),
  vec4(-0.342727, 0.616146, -0.254379, 0.346535),
  vec4(-0.289414, 0.450114, -0.255903, 0.348058),
  vec4(-0.388423, 0.366337, -0.386900, 0.343488),
  vec4(-0.388423, 0.352628, -0.388423, 0.331302),
  vec4(-0.258949, 0.346535, -0.162986, 0.323686),
  vec4(0.134044, 0.317593, 0.190404, 0.346535),
  vec4(-0.289414, 0.314547, -0.257426, 0.348058),
  vec4(0.303123, 0.303884, 0.307692, 0.355674),
  vec4(-0.166032, 0.323686, -0.042650, 0.305407),
  vec4(-0.383854, 0.340442, -0.374714, 0.282559),
  vec4(-0.242193, 0.319117, -0.172125, 0.277989),
  vec4(-0.388423, 0.329779, -0.388423, 0.264280),
  vec4(0.188880, 0.346535, 0.298553, 0.247525),
  vec4(0.172125, 0.313024, 0.182788, 0.271896),
  vec4(0.300076, 0.270373, 0.301599, 0.302361),
  vec4(0.092917, 0.265804, 0.141660, 0.302361),
  vec4(0.167555, 0.261234, 0.170602, 0.303884),
  vec4(-0.351866, 0.252094, -0.293983, 0.309977),
  vec4(-0.245240, 0.305407, -0.233054, 0.249048),
  vec4(-0.421935, 0.264280, -0.392993, 0.273420),
  vec4(-0.230008, 0.247525, -0.194973, 0.265804),
  vec4(0.313785, 0.247525, 0.351866, 0.261234),
  vec4(-0.428027, 0.261234, -0.386900, 0.246002),
  vec4(0.298553, 0.268850, 0.298553, 0.235339),
  vec4(0.106626, 0.258187, 0.162986, 0.241432),
  vec4(-0.274181, 0.244478, -0.242193, 0.244478),
  vec4(-0.351866, 0.239909, -0.275704, 0.242955),
  vec4(0.179741, 0.236862, 0.293983, 0.220107),
  vec4(0.354912, 0.183549, 0.354912, 0.259711),
  vec4(-0.429551, 0.233816, -0.426504, 0.143945),
  vec4(-0.063976, 0.060168, -0.038081, 0.305407),
  vec4(-0.031988, 0.288652, 0.054836, 0.061691),
  vec4(-0.031988, 0.285605, 0.054836, 0.058644),
  vec4(-0.424981, 0.142422, -0.380807, 0.160701),
  vec4(-0.364052, 0.218583, -0.325971, 0.081493),
  vec4(0.316832, 0.157654, 0.350343, 0.142422),
  vec4(0.243717, -0.006855, 0.297030, 0.224676),
  vec4(0.249810, 0.022087, 0.284844, 0.175933),
  vec4(0.290937, 0.051028, 0.350343, 0.140899),
  vec4(-0.420411, 0.133283, -0.362529, 0.049505),
  vec4(0.284844, 0.058644, 0.293983, 0.118050),
  vec4(-0.361005, 0.118050, -0.351866, 0.038842),
  vec4(-0.327494, 0.090632, -0.316832, 0.049505),
  vec4(-0.062452, 0.069307, 0.053313, 0.057121),
  vec4(0.065499, 0.051028, 0.159939, 0.003808),
  vec4(-0.313785, 0.043412, -0.303123, 0.000762),
  vec4(0.115765, 0.025133, 0.194973, -0.014471),
  vec4(-0.039604, -0.064737, 0.053313, 0.054075),
  vec4(-0.062452, 0.057121, -0.050267, -0.076923),
  vec4(0.196497, -0.015994, 0.234577, -0.034273),
  vec4(-0.303123, 0.005331, -0.287890, -0.057121),
  vec4(0.236101, -0.087586, 0.237624, -0.043412),
  vec4(-0.287890, -0.054075, -0.041127, -0.101295),
  vec4(-0.290937, -0.113481, -0.289414, -0.067784),
  vec4(-0.042650, -0.101295, 0.060929, -0.125666),
  vec4(0.201066, -0.165270, 0.233054, -0.116527),
  vec4(-0.290937, -0.115004, -0.202589, -0.220107),
  vec4(0.175171, -0.192688, 0.199543, -0.168317),
  vec4(-0.068545, -0.096725, -0.051790, -0.296268),
  vec4(-0.269612, -0.227723, -0.269612, -0.192688),
  vec4(0.102056, -0.270373, 0.173648, -0.194212),
  vec4(0.199543, -0.166794, 0.207159, -0.340442),
  vec4(-0.176695, -0.241432, -0.062452, -0.293222),
  vec4(0.028941, -0.287129, 0.079208, -0.281036),
  vec4(-0.266565, -0.261234, -0.265042, -0.316070),
  vec4(-0.053313, -0.296268, 0.060929, -0.282559),
  vec4(-0.025895, -0.320640, 0.062452, -0.287129),
  vec4(-0.030465, -0.323686, 0.028941, -0.300838),
  vec4(-0.312262, -0.457730, -0.265042, -0.322163),
  vec4(0.181264, -0.453161, 0.205636, -0.341965),
  vec4(0.207159, -0.329779, 0.475248, -0.509520),
  vec4(-0.265042, -0.317593, -0.193450, -0.526276),
  vec4(-0.577304, -0.521706, -0.278751, -0.335872),
  vec4(-0.571211, -0.517136, -0.356436, -0.383092),
  vec4(-0.035034, -0.338919, -0.012186, -0.568926),
  vec4(0.009139, -0.587205, 0.176695, -0.460777),
  vec4(0.473724, -0.507997, 0.722011, -0.610053),
  vec4(0.371668, -0.638995, 0.458492, -0.520183),
  vec4(-0.799695, -0.622239, -0.619954, -0.539985),
  vec4(0.342727, -0.680122, 0.467631, -0.507997),
  vec4(-0.843869, -0.669459, -0.801219, -0.622239),
  vec4(-0.194973, -0.523229, 0.109673, -0.774562),
  vec4(-0.623001, -0.597867, -0.283321, -0.727342),
  vec4(0.749429, -0.623762, 0.901752, -0.756283),
  vec4(-0.901752, -0.734958, -0.851485, -0.678599),
  vec4(-0.389947, -0.686215, -0.280274, -0.727342),
  vec4(0.109673, -0.773039, 0.336634, -0.686215),
  vec4(0.036558, -0.715156, 0.111196, -0.777609),
  vec4(0.111196, -0.773039, 0.249810, -0.719726),
  vec4(-0.277228, -0.734958, -0.217822, -0.968012),
  vec4(-0.237624, -0.893374, -0.217822, -0.971059)
);

const int ACCENT_SEGMENT_COUNT = 24;
const vec4 ACCENT_SEGMENTS[ACCENT_SEGMENT_COUNT] = vec4[ACCENT_SEGMENT_COUNT](
  vec4(-0.182788, 0.782178, -0.036558, 0.826352),
  vec4(-0.345773, 0.622239, -0.295506, 0.469916),
  vec4(-0.258949, 0.346535, -0.162986, 0.323686),
  vec4(-0.245240, 0.305407, -0.233054, 0.249048),
  vec4(-0.063976, 0.060168, -0.038081, 0.305407),
  vec4(0.092917, 0.265804, 0.141660, 0.302361),
  vec4(0.167555, 0.261234, 0.170602, 0.303884),
  vec4(0.243717, -0.006855, 0.297030, 0.224676),
  vec4(0.316832, 0.157654, 0.350343, 0.142422),
  vec4(-0.031988, 0.288652, 0.054836, 0.061691),
  vec4(-0.039604, -0.064737, 0.053313, 0.054075),
  vec4(-0.042650, -0.101295, 0.060929, -0.125666),
  vec4(-0.176695, -0.241432, -0.062452, -0.293222),
  vec4(0.175171, -0.192688, 0.199543, -0.168317),
  vec4(-0.068545, -0.096725, -0.051790, -0.296268),
  vec4(0.199543, -0.166794, 0.207159, -0.340442),
  vec4(-0.312262, -0.457730, -0.265042, -0.322163),
  vec4(0.181264, -0.453161, 0.205636, -0.341965),
  vec4(-0.577304, -0.521706, -0.278751, -0.335872),
  vec4(-0.623001, -0.597867, -0.283321, -0.727342),
  vec4(0.473724, -0.507997, 0.722011, -0.610053),
  vec4(0.749429, -0.623762, 0.901752, -0.756283),
  vec4(-0.277228, -0.734958, -0.217822, -0.968012),
  vec4(0.111196, -0.773039, 0.249810, -0.719726)
);

const int GHOST_SEGMENT_COUNT = 18;
const vec4 GHOST_SEGMENTS[GHOST_SEGMENT_COUNT] = vec4[GHOST_SEGMENT_COUNT](
  vec4(-0.430000, 0.612000, -0.394000, 0.651000),
  vec4(0.282000, 0.620000, 0.250000, 0.668000),
  vec4(-0.347000, 0.383000, -0.347000, 0.287000),
  vec4(0.305000, 0.286000, 0.309000, 0.187000),
  vec4(-0.271000, 0.342000, -0.210000, 0.339000),
  vec4(0.175000, 0.346000, 0.256000, 0.349000),
  vec4(-0.289000, 0.238000, -0.246000, 0.236000),
  vec4(0.104000, 0.260000, 0.172000, 0.258000),
  vec4(-0.355000, 0.118000, -0.318000, 0.052000),
  vec4(0.282000, 0.060000, 0.316000, 0.153000),
  vec4(-0.296000, -0.115000, -0.203000, -0.219000),
  vec4(0.198000, -0.166000, 0.233000, -0.115000),
  vec4(-0.054000, -0.294000, 0.060000, -0.282000),
  vec4(-0.025000, -0.323000, 0.028000, -0.302000),
  vec4(-0.195000, -0.523000, 0.109000, -0.775000),
  vec4(-0.389000, -0.686000, -0.280000, -0.727000),
  vec4(0.342000, -0.680000, 0.458000, -0.520000),
  vec4(-0.571000, -0.517000, -0.356000, -0.383000)
);

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(pa - ba * h);
}

float segmentMask(vec2 p, vec2 a, vec2 b, float stroke, float feather) {
  float d = sdSegment(p, a, b);
  return 1.0 - smoothstep(stroke, stroke + feather, d);
}

void main() {
  vec2 resolution = max(u_resolution, vec2(1.0));
  float aspect = resolution.x / resolution.y;

  // Preserve the approved portrait geometry instead of redrawing a generic face.
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= aspect;

  // Match the original portrait scale and breathing room more closely across viewport sizes.
  float portraitScale = mix(1.02, 1.14, smoothstep(1.10, 1.90, aspect));
  p /= portraitScale;
  p.y += 0.012;

  float px = 2.0 / resolution.y;

  float primarySoft = 0.0;
  float primaryCore = 0.0;
  for (int i = 0; i < PRIMARY_SEGMENT_COUNT; ++i) {
    vec4 segment = PRIMARY_SEGMENTS[i];
    primarySoft = max(primarySoft, segmentMask(p, segment.xy, segment.zw, 1.18 * px, 1.40 * px));
    primaryCore = max(primaryCore, segmentMask(p, segment.xy, segment.zw, 0.56 * px, 0.60 * px));
  }

  float accentSoft = 0.0;
  float accentCore = 0.0;
  for (int i = 0; i < ACCENT_SEGMENT_COUNT; ++i) {
    vec4 segment = ACCENT_SEGMENTS[i];
    accentSoft = max(accentSoft, segmentMask(p, segment.xy, segment.zw, 1.26 * px, 1.42 * px));
    accentCore = max(accentCore, segmentMask(p, segment.xy, segment.zw, 0.62 * px, 0.66 * px));
  }

  float ghostSoft = 0.0;
  float ghostCore = 0.0;
  for (int i = 0; i < GHOST_SEGMENT_COUNT; ++i) {
    vec4 segment = GHOST_SEGMENTS[i];
    ghostSoft = max(ghostSoft, segmentMask(p, segment.xy, segment.zw, 0.92 * px, 1.22 * px));
    ghostCore = max(ghostCore, segmentMask(p, segment.xy, segment.zw, 0.42 * px, 0.54 * px));
  }

  // Fine technical grid from the visual reference, subordinate to the figure.
  vec2 gridCell = abs(fract(gl_FragCoord.xy / 58.0) - 0.5);
  float grid = max(
    smoothstep(0.486, 0.500, gridCell.x),
    smoothstep(0.486, 0.500, gridCell.y)
  );
  vec2 macroCell = abs(fract(gl_FragCoord.xy / 290.0) - 0.5);
  float macroGrid = max(
    smoothstep(0.492, 0.500, macroCell.x),
    smoothstep(0.492, 0.500, macroCell.y)
  );

  float vignette = 1.0 - smoothstep(0.56, 1.30, length((v_uv - 0.5) * vec2(0.92, 1.0)));
  vec3 background = vec3(0.0009, 0.0012, 0.0014);
  vec3 gridColor = vec3(0.10, 0.13, 0.14) * grid * 0.74 + vec3(0.08, 0.10, 0.11) * macroGrid * 0.12;

  float ghostFigure = ghostSoft * 0.18 + ghostCore * 0.10;
  float wireframeFigure = primarySoft * 0.32 + primaryCore * 0.80;
  float accentFigure = accentSoft * 0.16 + accentCore * 0.34;

  vec3 color = background + gridColor;
  color += vec3(0.72, 0.75, 0.77) * ghostFigure;
  color += vec3(0.93, 0.95, 0.97) * wireframeFigure;
  color += vec3(1.0) * accentFigure;
  color *= 0.92 + 0.08 * vignette;
  outColor = vec4(color, 1.0);
}
`

export const CINEMA2_HUMN_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_HUMN_PRESET_ID,
  revision: 3,
  metadata: Object.freeze({
    name: 'HUM:N',
    description: 'A near-black sparse low-poly humanoid bust reconstructed from the approved fractured white wireframe silhouette with stronger facet hierarchy, faint emergence fragments, and a restrained technical grid.',
    tags: Object.freeze(['hum-n', 'native', 'humanoid', 'low-poly', 'wireframe', 'screen-space', 'keeper']),
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
    config: Object.freeze({ label: 'HUM:N Sparse Wireframe Foundation', fragmentSource: CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE }),
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

import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleTypeDefinition,
} from './Cinema2ModuleContracts'

export const CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('hum-n-native-render')
export const CINEMA2_HUMN_NATIVE_MODULE_VERSION = 1 as const

export type Cinema2HumNSegment = readonly [number, number, number, number]
export type Cinema2HumNFacet = readonly [number, number, number, number, number, number]
export type Cinema2HumNSegmentTier = 'primary' | 'accent' | 'ghost'
export type Cinema2HumNSemanticGroupId =
  | 'head-shell'
  | 'left-eye'
  | 'right-eye'
  | 'nose'
  | 'left-cheek'
  | 'right-cheek'
  | 'jaw-mouth'
  | 'left-ear'
  | 'right-ear'
  | 'neck'
  | 'shoulders'
  | 'primary-edges'
  | 'secondary-edges'
  | 'ghost-emergence-edges'

const HUMN_PRIMARY_SEGMENTS: readonly Cinema2HumNSegment[] = Object.freeze([
  Object.freeze([-0.182788, 0.782178, -0.036558, 0.826352]) as Cinema2HumNSegment,
  Object.freeze([-0.194973, 0.779132, 0.108149, 0.739528]) as Cinema2HumNSegment,
  Object.freeze([-0.239147, 0.738005, -0.207159, 0.768469]) as Cinema2HumNSegment,
  Object.freeze([0.172125, 0.742574, 0.237624, 0.672506]) as Cinema2HumNSegment,
  Object.freeze([-0.306169, 0.677075, -0.265042, 0.715156]) as Cinema2HumNSegment,
  Object.freeze([0.214775, 0.649657, 0.292460, 0.584158]) as Cinema2HumNSegment,
  Object.freeze([-0.394516, 0.468393, -0.347296, 0.625286]) as Cinema2HumNSegment,
  Object.freeze([-0.345773, 0.622239, -0.295506, 0.469916]) as Cinema2HumNSegment,
  Object.freeze([0.293983, 0.582635, 0.309216, 0.412034]) as Cinema2HumNSegment,
  Object.freeze([-0.342727, 0.616146, -0.254379, 0.346535]) as Cinema2HumNSegment,
  Object.freeze([-0.289414, 0.450114, -0.255903, 0.348058]) as Cinema2HumNSegment,
  Object.freeze([-0.388423, 0.366337, -0.386900, 0.343488]) as Cinema2HumNSegment,
  Object.freeze([-0.388423, 0.352628, -0.388423, 0.331302]) as Cinema2HumNSegment,
  Object.freeze([-0.258949, 0.346535, -0.162986, 0.323686]) as Cinema2HumNSegment,
  Object.freeze([0.134044, 0.317593, 0.190404, 0.346535]) as Cinema2HumNSegment,
  Object.freeze([-0.289414, 0.314547, -0.257426, 0.348058]) as Cinema2HumNSegment,
  Object.freeze([0.303123, 0.303884, 0.307692, 0.355674]) as Cinema2HumNSegment,
  Object.freeze([-0.166032, 0.323686, -0.042650, 0.305407]) as Cinema2HumNSegment,
  Object.freeze([-0.383854, 0.340442, -0.374714, 0.282559]) as Cinema2HumNSegment,
  Object.freeze([-0.242193, 0.319117, -0.172125, 0.277989]) as Cinema2HumNSegment,
  Object.freeze([-0.388423, 0.329779, -0.388423, 0.264280]) as Cinema2HumNSegment,
  Object.freeze([0.188880, 0.346535, 0.298553, 0.247525]) as Cinema2HumNSegment,
  Object.freeze([0.172125, 0.313024, 0.182788, 0.271896]) as Cinema2HumNSegment,
  Object.freeze([0.300076, 0.270373, 0.301599, 0.302361]) as Cinema2HumNSegment,
  Object.freeze([0.092917, 0.265804, 0.141660, 0.302361]) as Cinema2HumNSegment,
  Object.freeze([0.167555, 0.261234, 0.170602, 0.303884]) as Cinema2HumNSegment,
  Object.freeze([-0.351866, 0.252094, -0.293983, 0.309977]) as Cinema2HumNSegment,
  Object.freeze([-0.245240, 0.305407, -0.233054, 0.249048]) as Cinema2HumNSegment,
  Object.freeze([-0.421935, 0.264280, -0.392993, 0.273420]) as Cinema2HumNSegment,
  Object.freeze([-0.230008, 0.247525, -0.194973, 0.265804]) as Cinema2HumNSegment,
  Object.freeze([0.313785, 0.247525, 0.351866, 0.261234]) as Cinema2HumNSegment,
  Object.freeze([-0.428027, 0.261234, -0.386900, 0.246002]) as Cinema2HumNSegment,
  Object.freeze([0.298553, 0.268850, 0.298553, 0.235339]) as Cinema2HumNSegment,
  Object.freeze([0.106626, 0.258187, 0.162986, 0.241432]) as Cinema2HumNSegment,
  Object.freeze([-0.274181, 0.244478, -0.242193, 0.244478]) as Cinema2HumNSegment,
  Object.freeze([-0.351866, 0.239909, -0.275704, 0.242955]) as Cinema2HumNSegment,
  Object.freeze([0.179741, 0.236862, 0.293983, 0.220107]) as Cinema2HumNSegment,
  Object.freeze([0.354912, 0.183549, 0.354912, 0.259711]) as Cinema2HumNSegment,
  Object.freeze([-0.429551, 0.233816, -0.426504, 0.143945]) as Cinema2HumNSegment,
  Object.freeze([-0.063976, 0.060168, -0.038081, 0.305407]) as Cinema2HumNSegment,
  Object.freeze([-0.031988, 0.288652, 0.054836, 0.061691]) as Cinema2HumNSegment,
  Object.freeze([-0.031988, 0.285605, 0.054836, 0.058644]) as Cinema2HumNSegment,
  Object.freeze([-0.424981, 0.142422, -0.380807, 0.160701]) as Cinema2HumNSegment,
  Object.freeze([-0.364052, 0.218583, -0.325971, 0.081493]) as Cinema2HumNSegment,
  Object.freeze([0.316832, 0.157654, 0.350343, 0.142422]) as Cinema2HumNSegment,
  Object.freeze([0.243717, -0.006855, 0.297030, 0.224676]) as Cinema2HumNSegment,
  Object.freeze([0.249810, 0.022087, 0.284844, 0.175933]) as Cinema2HumNSegment,
  Object.freeze([0.290937, 0.051028, 0.350343, 0.140899]) as Cinema2HumNSegment,
  Object.freeze([-0.420411, 0.133283, -0.362529, 0.049505]) as Cinema2HumNSegment,
  Object.freeze([0.284844, 0.058644, 0.293983, 0.118050]) as Cinema2HumNSegment,
  Object.freeze([-0.361005, 0.118050, -0.351866, 0.038842]) as Cinema2HumNSegment,
  Object.freeze([-0.327494, 0.090632, -0.316832, 0.049505]) as Cinema2HumNSegment,
  Object.freeze([-0.062452, 0.069307, 0.053313, 0.057121]) as Cinema2HumNSegment,
  Object.freeze([0.065499, 0.051028, 0.159939, 0.003808]) as Cinema2HumNSegment,
  Object.freeze([-0.313785, 0.043412, -0.303123, 0.000762]) as Cinema2HumNSegment,
  Object.freeze([0.115765, 0.025133, 0.194973, -0.014471]) as Cinema2HumNSegment,
  Object.freeze([-0.039604, -0.064737, 0.053313, 0.054075]) as Cinema2HumNSegment,
  Object.freeze([-0.062452, 0.057121, -0.050267, -0.076923]) as Cinema2HumNSegment,
  Object.freeze([0.196497, -0.015994, 0.234577, -0.034273]) as Cinema2HumNSegment,
  Object.freeze([-0.303123, 0.005331, -0.287890, -0.057121]) as Cinema2HumNSegment,
  Object.freeze([0.236101, -0.087586, 0.237624, -0.043412]) as Cinema2HumNSegment,
  Object.freeze([-0.287890, -0.054075, -0.041127, -0.101295]) as Cinema2HumNSegment,
  Object.freeze([-0.290937, -0.113481, -0.289414, -0.067784]) as Cinema2HumNSegment,
  Object.freeze([-0.042650, -0.101295, 0.060929, -0.125666]) as Cinema2HumNSegment,
  Object.freeze([0.201066, -0.165270, 0.233054, -0.116527]) as Cinema2HumNSegment,
  Object.freeze([-0.290937, -0.115004, -0.202589, -0.220107]) as Cinema2HumNSegment,
  Object.freeze([0.175171, -0.192688, 0.199543, -0.168317]) as Cinema2HumNSegment,
  Object.freeze([-0.068545, -0.096725, -0.051790, -0.296268]) as Cinema2HumNSegment,
  Object.freeze([-0.269612, -0.227723, -0.269612, -0.192688]) as Cinema2HumNSegment,
  Object.freeze([0.102056, -0.270373, 0.173648, -0.194212]) as Cinema2HumNSegment,
  Object.freeze([0.199543, -0.166794, 0.207159, -0.340442]) as Cinema2HumNSegment,
  Object.freeze([-0.176695, -0.241432, -0.062452, -0.293222]) as Cinema2HumNSegment,
  Object.freeze([0.028941, -0.287129, 0.079208, -0.281036]) as Cinema2HumNSegment,
  Object.freeze([-0.266565, -0.261234, -0.265042, -0.316070]) as Cinema2HumNSegment,
  Object.freeze([-0.053313, -0.296268, 0.060929, -0.282559]) as Cinema2HumNSegment,
  Object.freeze([-0.025895, -0.320640, 0.062452, -0.287129]) as Cinema2HumNSegment,
  Object.freeze([-0.030465, -0.323686, 0.028941, -0.300838]) as Cinema2HumNSegment,
  Object.freeze([-0.312262, -0.457730, -0.265042, -0.322163]) as Cinema2HumNSegment,
  Object.freeze([0.181264, -0.453161, 0.205636, -0.341965]) as Cinema2HumNSegment,
  Object.freeze([0.207159, -0.329779, 0.475248, -0.509520]) as Cinema2HumNSegment,
  Object.freeze([-0.265042, -0.317593, -0.193450, -0.526276]) as Cinema2HumNSegment,
  Object.freeze([-0.577304, -0.521706, -0.278751, -0.335872]) as Cinema2HumNSegment,
  Object.freeze([-0.571211, -0.517136, -0.356436, -0.383092]) as Cinema2HumNSegment,
  Object.freeze([-0.035034, -0.338919, -0.012186, -0.568926]) as Cinema2HumNSegment,
  Object.freeze([0.009139, -0.587205, 0.176695, -0.460777]) as Cinema2HumNSegment,
  Object.freeze([0.473724, -0.507997, 0.722011, -0.610053]) as Cinema2HumNSegment,
  Object.freeze([0.371668, -0.638995, 0.458492, -0.520183]) as Cinema2HumNSegment,
  Object.freeze([-0.799695, -0.622239, -0.619954, -0.539985]) as Cinema2HumNSegment,
  Object.freeze([0.342727, -0.680122, 0.467631, -0.507997]) as Cinema2HumNSegment,
  Object.freeze([-0.843869, -0.669459, -0.801219, -0.622239]) as Cinema2HumNSegment,
  Object.freeze([-0.194973, -0.523229, 0.109673, -0.774562]) as Cinema2HumNSegment,
  Object.freeze([-0.623001, -0.597867, -0.283321, -0.727342]) as Cinema2HumNSegment,
  Object.freeze([0.749429, -0.623762, 0.901752, -0.756283]) as Cinema2HumNSegment,
  Object.freeze([-0.901752, -0.734958, -0.851485, -0.678599]) as Cinema2HumNSegment,
  Object.freeze([-0.389947, -0.686215, -0.280274, -0.727342]) as Cinema2HumNSegment,
  Object.freeze([0.109673, -0.773039, 0.336634, -0.686215]) as Cinema2HumNSegment,
  Object.freeze([0.036558, -0.715156, 0.111196, -0.777609]) as Cinema2HumNSegment,
  Object.freeze([0.111196, -0.773039, 0.249810, -0.719726]) as Cinema2HumNSegment,
  Object.freeze([-0.277228, -0.734958, -0.217822, -0.968012]) as Cinema2HumNSegment,
  Object.freeze([-0.237624, -0.893374, -0.217822, -0.971059]) as Cinema2HumNSegment,
])

const HUMN_ACCENT_SEGMENTS: readonly Cinema2HumNSegment[] = Object.freeze([
  Object.freeze([-0.182788, 0.782178, -0.036558, 0.826352]) as Cinema2HumNSegment,
  Object.freeze([-0.345773, 0.622239, -0.295506, 0.469916]) as Cinema2HumNSegment,
  Object.freeze([-0.258949, 0.346535, -0.162986, 0.323686]) as Cinema2HumNSegment,
  Object.freeze([-0.245240, 0.305407, -0.233054, 0.249048]) as Cinema2HumNSegment,
  Object.freeze([-0.063976, 0.060168, -0.038081, 0.305407]) as Cinema2HumNSegment,
  Object.freeze([0.092917, 0.265804, 0.141660, 0.302361]) as Cinema2HumNSegment,
  Object.freeze([0.167555, 0.261234, 0.170602, 0.303884]) as Cinema2HumNSegment,
  Object.freeze([0.243717, -0.006855, 0.297030, 0.224676]) as Cinema2HumNSegment,
  Object.freeze([0.316832, 0.157654, 0.350343, 0.142422]) as Cinema2HumNSegment,
  Object.freeze([-0.031988, 0.288652, 0.054836, 0.061691]) as Cinema2HumNSegment,
  Object.freeze([-0.039604, -0.064737, 0.053313, 0.054075]) as Cinema2HumNSegment,
  Object.freeze([-0.042650, -0.101295, 0.060929, -0.125666]) as Cinema2HumNSegment,
  Object.freeze([-0.176695, -0.241432, -0.062452, -0.293222]) as Cinema2HumNSegment,
  Object.freeze([0.175171, -0.192688, 0.199543, -0.168317]) as Cinema2HumNSegment,
  Object.freeze([-0.068545, -0.096725, -0.051790, -0.296268]) as Cinema2HumNSegment,
  Object.freeze([0.199543, -0.166794, 0.207159, -0.340442]) as Cinema2HumNSegment,
  Object.freeze([-0.312262, -0.457730, -0.265042, -0.322163]) as Cinema2HumNSegment,
  Object.freeze([0.181264, -0.453161, 0.205636, -0.341965]) as Cinema2HumNSegment,
  Object.freeze([-0.577304, -0.521706, -0.278751, -0.335872]) as Cinema2HumNSegment,
  Object.freeze([-0.623001, -0.597867, -0.283321, -0.727342]) as Cinema2HumNSegment,
  Object.freeze([0.473724, -0.507997, 0.722011, -0.610053]) as Cinema2HumNSegment,
  Object.freeze([0.749429, -0.623762, 0.901752, -0.756283]) as Cinema2HumNSegment,
  Object.freeze([-0.277228, -0.734958, -0.217822, -0.968012]) as Cinema2HumNSegment,
  Object.freeze([0.111196, -0.773039, 0.249810, -0.719726]) as Cinema2HumNSegment,
])

const HUMN_GHOST_SEGMENTS: readonly Cinema2HumNSegment[] = Object.freeze([
  Object.freeze([-0.430000, 0.612000, -0.394000, 0.651000]) as Cinema2HumNSegment,
  Object.freeze([0.282000, 0.620000, 0.250000, 0.668000]) as Cinema2HumNSegment,
  Object.freeze([-0.347000, 0.383000, -0.347000, 0.287000]) as Cinema2HumNSegment,
  Object.freeze([0.305000, 0.286000, 0.309000, 0.187000]) as Cinema2HumNSegment,
  Object.freeze([-0.271000, 0.342000, -0.210000, 0.339000]) as Cinema2HumNSegment,
  Object.freeze([0.175000, 0.346000, 0.256000, 0.349000]) as Cinema2HumNSegment,
  Object.freeze([-0.289000, 0.238000, -0.246000, 0.236000]) as Cinema2HumNSegment,
  Object.freeze([0.104000, 0.260000, 0.172000, 0.258000]) as Cinema2HumNSegment,
  Object.freeze([-0.355000, 0.118000, -0.318000, 0.052000]) as Cinema2HumNSegment,
  Object.freeze([0.282000, 0.060000, 0.316000, 0.153000]) as Cinema2HumNSegment,
  Object.freeze([-0.296000, -0.115000, -0.203000, -0.219000]) as Cinema2HumNSegment,
  Object.freeze([0.198000, -0.166000, 0.233000, -0.115000]) as Cinema2HumNSegment,
  Object.freeze([-0.054000, -0.294000, 0.060000, -0.282000]) as Cinema2HumNSegment,
  Object.freeze([-0.025000, -0.323000, 0.028000, -0.302000]) as Cinema2HumNSegment,
  Object.freeze([-0.195000, -0.523000, 0.109000, -0.775000]) as Cinema2HumNSegment,
  Object.freeze([-0.389000, -0.686000, -0.280000, -0.727000]) as Cinema2HumNSegment,
  Object.freeze([0.342000, -0.680000, 0.458000, -0.520000]) as Cinema2HumNSegment,
  Object.freeze([-0.571000, -0.517000, -0.356000, -0.383000]) as Cinema2HumNSegment,
])

function segmentId(tier: Cinema2HumNSegmentTier, index: number): string {
  const prefix = tier === 'primary' ? 'p' : tier === 'accent' ? 'a' : 'g'
  return `${prefix}${String(index).padStart(3, '0')}`
}

function segmentIds(tier: Cinema2HumNSegmentTier, indices: readonly number[]): readonly string[] {
  return Object.freeze(indices.map(index => segmentId(tier, index)))
}

function allSegmentIds(tier: Cinema2HumNSegmentTier, segments: readonly Cinema2HumNSegment[]): readonly string[] {
  return Object.freeze(segments.map((_, index) => segmentId(tier, index)))
}

/**
 * Canonical semantic topology for the approved HUM:N still. Segment tiers own
 * appearance; semantic groups own future editability. Group membership is
 * intentionally allowed to overlap so a contour can remain a primary edge and
 * also be addressable as an anatomical region.
 */
export const CINEMA2_HUMN_SEMANTIC_GROUPS: Readonly<Record<Cinema2HumNSemanticGroupId, readonly string[]>> = Object.freeze({
  'head-shell': segmentIds('primary', [0, 1, 2, 3, 4, 5, 6, 7, 8, 37, 38, 44, 48]),
  'left-eye': segmentIds('primary', [9, 10, 17, 18, 19, 20, 26, 27, 29, 34, 35]),
  'right-eye': segmentIds('primary', [14, 21, 22, 23, 24, 25, 30, 32, 33, 36]),
  nose: segmentIds('primary', [39, 40, 41, 42, 52, 56, 57]),
  'left-cheek': segmentIds('primary', [43, 49, 50, 51, 54, 58, 59, 62, 65]),
  'right-cheek': segmentIds('primary', [45, 46, 47, 53, 55, 60, 61, 64, 66]),
  'jaw-mouth': segmentIds('primary', [53, 56, 57, 61, 62, 63, 64, 65, 66, 67, 71, 72, 73, 74, 75, 76, 77]),
  'left-ear': segmentIds('primary', [11, 12, 13, 15, 16, 18, 20, 26, 28, 31, 38, 42]),
  'right-ear': segmentIds('primary', [23, 30, 32, 37, 44, 47]),
  neck: segmentIds('primary', [67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 82, 83, 84, 85]),
  shoulders: segmentIds('primary', [80, 81, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99]),
  'primary-edges': allSegmentIds('primary', HUMN_PRIMARY_SEGMENTS),
  'secondary-edges': allSegmentIds('accent', HUMN_ACCENT_SEGMENTS),
  'ghost-emergence-edges': allSegmentIds('ghost', HUMN_GHOST_SEGMENTS),
})

/** Hidden canonical facet seeds for later skin/fill work. They are not rendered in Phase A. */
export const CINEMA2_HUMN_FUTURE_FACET_GROUPS = Object.freeze({
  forehead: Object.freeze([
    Object.freeze([-0.239147, 0.738005, -0.036558, 0.826352, 0.108149, 0.739528]) as Cinema2HumNFacet,
    Object.freeze([-0.306169, 0.677075, -0.265042, 0.715156, -0.194973, 0.779132]) as Cinema2HumNFacet,
  ]),
  leftFace: Object.freeze([
    Object.freeze([-0.342727, 0.616146, -0.254379, 0.346535, -0.063976, 0.305407]) as Cinema2HumNFacet,
    Object.freeze([-0.351866, 0.252094, -0.287890, -0.054075, -0.042650, -0.101295]) as Cinema2HumNFacet,
  ]),
  rightFace: Object.freeze([
    Object.freeze([0.293983, 0.582635, 0.188880, 0.346535, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([0.298553, 0.268850, 0.243717, -0.006855, 0.060929, -0.125666]) as Cinema2HumNFacet,
  ]),
  torso: Object.freeze([
    Object.freeze([-0.577304, -0.521706, -0.193450, -0.526276, -0.194973, -0.773039]) as Cinema2HumNFacet,
    Object.freeze([0.207159, -0.329779, 0.473724, -0.507997, 0.109673, -0.773039]) as Cinema2HumNFacet,
  ]),
})

export const CINEMA2_HUMN_CANONICAL_TOPOLOGY = Object.freeze({
  primarySegments: HUMN_PRIMARY_SEGMENTS,
  accentSegments: HUMN_ACCENT_SEGMENTS,
  ghostSegments: HUMN_GHOST_SEGMENTS,
  semanticGroups: CINEMA2_HUMN_SEMANTIC_GROUPS,
  futureFacetGroups: CINEMA2_HUMN_FUTURE_FACET_GROUPS,
})

function glslNumber(value: number): string {
  return value.toFixed(6)
}

function glslSegmentArray(name: string, segments: readonly Cinema2HumNSegment[]): string {
  const countName = name.replace(/_SEGMENTS$/, '_SEGMENT_COUNT')
  const values = segments
    .map(segment => `  vec4(${segment.map(glslNumber).join(', ')})`)
    .join(',\n')
  return `const int ${countName} = ${segments.length};\nconst vec4 ${name}[${countName}] = vec4[${countName}](\n${values}\n);`
}

/**
 * Native-module-owned shader generated from the canonical topology above. It
 * deliberately has no time, audio, director, choreography, or automation input.
 */
export const CINEMA2_HUMN_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
out vec4 outColor;

${glslSegmentArray('PRIMARY_SEGMENTS', HUMN_PRIMARY_SEGMENTS)}

${glslSegmentArray('ACCENT_SEGMENTS', HUMN_ACCENT_SEGMENTS)}

${glslSegmentArray('GHOST_SEGMENTS', HUMN_GHOST_SEGMENTS)}

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

function validateConfig(config: Cinema2JsonObject | undefined): readonly Cinema2ModuleDiagnostic[] {
  if (config == null || config.label == null) return Object.freeze([])
  if (typeof config.label === 'string') return Object.freeze([])
  return Object.freeze([Object.freeze({
    code: 'CINEMA2_HUMN_MODULE_LABEL_INVALID',
    path: '$.config.label',
    message: 'HUM:N native renderer label must be a string when provided.',
  })])
}

export const cinema2HumNNativeModuleDefinition: Readonly<Cinema2ModuleTypeDefinition> = Object.freeze({
  typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
  validate: (module: Readonly<Cinema2ModuleManifest>) => validateConfig(module.config),
  create: (context: Cinema2ModuleCreateContext) => {
    const label = typeof context.module.config?.label === 'string'
      ? context.module.config.label
      : `Cinema2/${context.module.id}`

    const provider = Object.freeze({
      id: `${context.module.id}:hum-n-native`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute: ({ target, width, height }: Cinema2ModuleRenderExecutionContext) => {
        const program = context.resources.acquire(
          'hum-n-program',
          'WebGLProgram',
          (gl: WebGL2RenderingContext) => {
            const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
              label,
              vertSrc: FULLSCREEN_VERT_SRC,
              fragSrc: CINEMA2_HUMN_FRAGMENT_SOURCE,
              optionalUniforms: ['u_resolution'],
            })
            if (!result.program) {
              throw new Error(`Shader compilation failed at ${result.error.stage} for "${result.error.label}": ${result.error.log}`)
            }
            return result.program
          },
          (value: ShaderProgram) => value.dispose(),
        )
        const pass = context.resources.acquire(
          'hum-n-pass',
          'FullscreenPass',
          (gl: WebGL2RenderingContext) => new FullscreenPass(gl),
          (value: FullscreenPass) => value.dispose(),
        )
        program.activate()
        program.setVec2('u_resolution', width, height)
        pass.run(program, target, width, height, [])
      },
    })

    return {
      lifecycle: {
        update: () => {},
        dispose: () => {},
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

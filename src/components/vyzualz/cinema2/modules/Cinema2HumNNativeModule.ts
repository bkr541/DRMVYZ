import { FULLSCREEN_VERT_SRC, FullscreenPass } from '../../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../react/shaders/runtime/ShaderCompiler'
import { ShaderProgram } from '../../react/shaders/runtime/ShaderProgram'
import {
  cinema2StableId,
  type Cinema2JsonObject,
  type Cinema2ModuleManifest,
  type Cinema2ModuleTypeId,
} from '../contracts/Cinema2NativePresetManifest'
import { Cinema2SyncedMotionClockResolver } from './Cinema2SyncedMotionClock'
import { buildHumNLimbGlsl, CINEMA2_HUMN_ARM_ANCHORS, CINEMA2_HUMN_HEAD_GRAB_POSE } from './humn/Cinema2HumNLimbTopology'
import {
  Cinema2HumNPerformanceRuntime,
  CINEMA2_HUMN_LUNGE_PIVOT,
  cinema2HumNAutoDropStrength,
  cinema2HumNDirectorContext,
  cinema2HumNDirectionFromUnit,
  resolveCinema2HumNGestureUniforms,
  selectCinema2HumNDropGesture,
  selectCinema2HumNStructuralVariant,
  type Cinema2HumNStructuralKind,
} from './humn/Cinema2HumNPerformance'
import type { Cinema2DispatchedTargetAction } from '../parameters/Cinema2TargetRuntime'
import type {
  Cinema2ModuleCreateContext,
  Cinema2ModuleDiagnostic,
  Cinema2ModuleRenderExecutionContext,
  Cinema2ModuleUpdateContext,
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

export const CINEMA2_HUMN_COMPOSITION_ANCHOR = Object.freeze({ x: 0, y: 0.0266565 })
export const CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS = Object.freeze({
  minX: -0.901752,
  maxX: 0.901752,
  minY: -0.773039,
  maxY: 0.826352,
})

const HUMN_SAFE_FRAME_MARGIN = 0.995

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clampNumber((value - edge0) / Math.max(edge1 - edge0, Number.EPSILON), 0, 1)
  return t * t * (3 - 2 * t)
}

function humNPortraitScale(aspect: number): number {
  return 1.02 + (1.14 - 1.02) * smoothstep(1.10, 1.90, aspect)
}

/**
 * Keeps the authored public 0.70-1.30 Figure Scale range while protecting the
 * canonical head/shoulder envelope on unusually constrained viewports. The
 * approved landscape default resolves to exactly 1.0; only unsafe enlargement
 * (or portrait fit pressure) is constrained internally.
 */
export function resolveCinema2HumNFigureScale(requested: unknown, width: number, height: number, motionAmount: unknown = 0): number {
  const authored = clampNumber(readNumber(requested, 1), 0.7, 1.3)
  const motionSafety = clampNumber(readNumber(motionAmount, 0), 0, 1)
  const safeFrameMargin = HUMN_SAFE_FRAME_MARGIN - 0.045 * motionSafety
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  const aspect = safeWidth / safeHeight
  const portraitScale = humNPortraitScale(aspect)
  const horizontalExtent = Math.max(
    Math.abs(CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.minX - CINEMA2_HUMN_COMPOSITION_ANCHOR.x),
    Math.abs(CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.maxX - CINEMA2_HUMN_COMPOSITION_ANCHOR.x),
  )
  const verticalExtent = Math.max(
    Math.abs(CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.minY - CINEMA2_HUMN_COMPOSITION_ANCHOR.y),
    Math.abs(CINEMA2_HUMN_CRITICAL_FIGURE_BOUNDS.maxY - CINEMA2_HUMN_COMPOSITION_ANCHOR.y),
  )
  const anchorScreenOffsetY = Math.abs(CINEMA2_HUMN_COMPOSITION_ANCHOR.y - 0.012)
  const horizontalCap = (safeFrameMargin * aspect) / Math.max(portraitScale * horizontalExtent, Number.EPSILON)
  const verticalCap = (safeFrameMargin / portraitScale - anchorScreenOffsetY) / Math.max(verticalExtent, Number.EPSILON)
  const safeCap = clampNumber(Math.min(1.3, horizontalCap, verticalCap), 0.01, 1.3)

  if (safeCap >= 1) return Math.min(authored, safeCap)
  return safeCap * (authored / 1.3)
}


/** Authored bridge strokes revealed only below the approved fragmentation baseline. */
const HUMN_RESTORATION_SEGMENTS: readonly Cinema2HumNSegment[] = Object.freeze([
  Object.freeze([-0.207159, 0.768469, -0.182788, 0.782178]) as Cinema2HumNSegment,
  Object.freeze([0.108149, 0.739528, 0.172125, 0.742574]) as Cinema2HumNSegment,
  Object.freeze([-0.254379, 0.346535, -0.166032, 0.323686]) as Cinema2HumNSegment,
  Object.freeze([0.054836, 0.061691, 0.115765, 0.025133]) as Cinema2HumNSegment,
  Object.freeze([-0.202589, -0.220107, -0.068545, -0.096725]) as Cinema2HumNSegment,
  Object.freeze([0.060929, -0.125666, 0.175171, -0.192688]) as Cinema2HumNSegment,
  Object.freeze([-0.325971, 0.081493, -0.303123, 0.005331]) as Cinema2HumNSegment,
  Object.freeze([0.237624, -0.043412, 0.201066, -0.165270]) as Cinema2HumNSegment,
])

/** Conservative authored additions used only by Mesh Detail = Dense. */
const HUMN_DENSE_SEGMENTS: readonly Cinema2HumNSegment[] = Object.freeze([
  Object.freeze([-0.265042, 0.715156, -0.063976, 0.305407]) as Cinema2HumNSegment,
  Object.freeze([0.214775, 0.649657, 0.054836, 0.061691]) as Cinema2HumNSegment,
  Object.freeze([-0.242193, 0.319117, -0.039604, -0.064737]) as Cinema2HumNSegment,
  Object.freeze([0.188880, 0.346535, 0.065499, 0.051028]) as Cinema2HumNSegment,
  Object.freeze([-0.351866, 0.239909, -0.287890, -0.054075]) as Cinema2HumNSegment,
  Object.freeze([0.293983, 0.220107, 0.236101, -0.087586]) as Cinema2HumNSegment,
  Object.freeze([-0.290937, -0.115004, -0.193450, -0.526276]) as Cinema2HumNSegment,
  Object.freeze([0.201066, -0.165270, 0.207159, -0.329779]) as Cinema2HumNSegment,
  Object.freeze([-0.193450, -0.526276, -0.577304, -0.521706]) as Cinema2HumNSegment,
  Object.freeze([0.207159, -0.329779, 0.473724, -0.507997]) as Cinema2HumNSegment,
])

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

/**
 * Authored semantic skin facets. Every vertex is anchored to a point already
 * present in the HUM:N line topology, so fill never becomes an unrelated
 * fullscreen triangulation. Object insertion order is the stable reveal order.
 */
export const CINEMA2_HUMN_SKIN_FACET_GROUPS = Object.freeze({
  forehead: Object.freeze([
    Object.freeze([-0.306169, 0.677075, -0.239147, 0.738005, -0.063976, 0.305407]) as Cinema2HumNFacet,
    Object.freeze([-0.239147, 0.738005, -0.036558, 0.826352, -0.063976, 0.305407]) as Cinema2HumNFacet,
    Object.freeze([-0.036558, 0.826352, 0.108149, 0.739528, -0.063976, 0.305407]) as Cinema2HumNFacet,
    Object.freeze([0.108149, 0.739528, 0.214775, 0.649657, 0.054836, 0.061691]) as Cinema2HumNFacet,
  ]),
  leftTemple: Object.freeze([
    Object.freeze([-0.394516, 0.468393, -0.306169, 0.677075, -0.254379, 0.346535]) as Cinema2HumNFacet,
    Object.freeze([-0.306169, 0.677075, -0.063976, 0.305407, -0.254379, 0.346535]) as Cinema2HumNFacet,
    Object.freeze([-0.394516, 0.468393, -0.254379, 0.346535, -0.351866, 0.252094]) as Cinema2HumNFacet,
  ]),
  rightTemple: Object.freeze([
    Object.freeze([0.214775, 0.649657, 0.292460, 0.584158, 0.188880, 0.346535]) as Cinema2HumNFacet,
    Object.freeze([0.214775, 0.649657, 0.188880, 0.346535, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([0.292460, 0.584158, 0.309216, 0.412034, 0.188880, 0.346535]) as Cinema2HumNFacet,
  ]),
  leftEyePlane: Object.freeze([
    Object.freeze([-0.254379, 0.346535, -0.166032, 0.323686, -0.242193, 0.244478]) as Cinema2HumNFacet,
    Object.freeze([-0.166032, 0.323686, -0.042650, 0.305407, -0.063976, 0.060168]) as Cinema2HumNFacet,
    Object.freeze([-0.242193, 0.244478, -0.063976, 0.060168, -0.351866, 0.252094]) as Cinema2HumNFacet,
  ]),
  rightEyePlane: Object.freeze([
    Object.freeze([0.134044, 0.317593, 0.188880, 0.346535, 0.179741, 0.236862]) as Cinema2HumNFacet,
    Object.freeze([0.092917, 0.265804, 0.134044, 0.317593, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([0.179741, 0.236862, 0.298553, 0.268850, 0.243717, -0.006855]) as Cinema2HumNFacet,
  ]),
  noseBridge: Object.freeze([
    Object.freeze([-0.063976, 0.305407, -0.031988, 0.285605, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([-0.063976, 0.060168, -0.039604, -0.064737, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([-0.039604, -0.064737, 0.053313, 0.054075, 0.060929, -0.125666]) as Cinema2HumNFacet,
  ]),
  leftCheek: Object.freeze([
    Object.freeze([-0.351866, 0.252094, -0.242193, 0.244478, -0.287890, -0.054075]) as Cinema2HumNFacet,
    Object.freeze([-0.242193, 0.244478, -0.063976, 0.060168, -0.042650, -0.101295]) as Cinema2HumNFacet,
    Object.freeze([-0.351866, 0.252094, -0.287890, -0.054075, -0.042650, -0.101295]) as Cinema2HumNFacet,
  ]),
  rightCheek: Object.freeze([
    Object.freeze([0.179741, 0.236862, 0.243717, -0.006855, 0.054836, 0.061691]) as Cinema2HumNFacet,
    Object.freeze([0.298553, 0.268850, 0.243717, -0.006855, 0.236101, -0.087586]) as Cinema2HumNFacet,
    Object.freeze([0.054836, 0.061691, 0.243717, -0.006855, 0.060929, -0.125666]) as Cinema2HumNFacet,
  ]),
  mouthJaw: Object.freeze([
    Object.freeze([-0.287890, -0.054075, -0.042650, -0.101295, -0.202589, -0.220107]) as Cinema2HumNFacet,
    Object.freeze([-0.042650, -0.101295, 0.060929, -0.125666, -0.051790, -0.296268]) as Cinema2HumNFacet,
    Object.freeze([0.060929, -0.125666, 0.201066, -0.165270, 0.079208, -0.281036]) as Cinema2HumNFacet,
    Object.freeze([-0.202589, -0.220107, -0.051790, -0.296268, -0.176695, -0.241432]) as Cinema2HumNFacet,
    Object.freeze([-0.051790, -0.296268, 0.060929, -0.282559, -0.035034, -0.338919]) as Cinema2HumNFacet,
    Object.freeze([0.060929, -0.282559, 0.207159, -0.329779, -0.035034, -0.338919]) as Cinema2HumNFacet,
  ]),
  neck: Object.freeze([
    Object.freeze([-0.265042, -0.317593, -0.193450, -0.526276, -0.035034, -0.338919]) as Cinema2HumNFacet,
    Object.freeze([-0.193450, -0.526276, -0.012186, -0.568926, -0.035034, -0.338919]) as Cinema2HumNFacet,
    Object.freeze([-0.035034, -0.338919, 0.181264, -0.453161, 0.207159, -0.329779]) as Cinema2HumNFacet,
    Object.freeze([-0.035034, -0.338919, -0.012186, -0.568926, 0.181264, -0.453161]) as Cinema2HumNFacet,
  ]),
  leftShoulder: Object.freeze([
    Object.freeze([-0.577304, -0.521706, -0.278751, -0.335872, -0.193450, -0.526276]) as Cinema2HumNFacet,
    Object.freeze([-0.623001, -0.597867, -0.577304, -0.521706, -0.283321, -0.727342]) as Cinema2HumNFacet,
    Object.freeze([-0.577304, -0.521706, -0.193450, -0.526276, -0.283321, -0.727342]) as Cinema2HumNFacet,
    Object.freeze([-0.283321, -0.727342, -0.193450, -0.526276, -0.277228, -0.734958]) as Cinema2HumNFacet,
    Object.freeze([-0.843869, -0.669459, -0.623001, -0.597867, -0.283321, -0.727342]) as Cinema2HumNFacet,
  ]),
  rightShoulder: Object.freeze([
    Object.freeze([0.181264, -0.453161, 0.473724, -0.507997, 0.109673, -0.773039]) as Cinema2HumNFacet,
    Object.freeze([0.473724, -0.507997, 0.722011, -0.610053, 0.336634, -0.686215]) as Cinema2HumNFacet,
    Object.freeze([0.181264, -0.453161, 0.109673, -0.773039, -0.012186, -0.568926]) as Cinema2HumNFacet,
    Object.freeze([0.109673, -0.773039, 0.336634, -0.686215, 0.473724, -0.507997]) as Cinema2HumNFacet,
    Object.freeze([0.336634, -0.686215, 0.722011, -0.610053, 0.901752, -0.756283]) as Cinema2HumNFacet,
  ]),
})

/** Compatibility alias retained for earlier HUM:N foundation tests/consumers. */
export const CINEMA2_HUMN_FUTURE_FACET_GROUPS = CINEMA2_HUMN_SKIN_FACET_GROUPS

const HUMN_SKIN_FACETS: readonly Cinema2HumNFacet[] = Object.freeze(
  Object.values(CINEMA2_HUMN_SKIN_FACET_GROUPS).flat(),
)

export const CINEMA2_HUMN_CANONICAL_TOPOLOGY = Object.freeze({
  primarySegments: HUMN_PRIMARY_SEGMENTS,
  accentSegments: HUMN_ACCENT_SEGMENTS,
  ghostSegments: HUMN_GHOST_SEGMENTS,
  restorationSegments: HUMN_RESTORATION_SEGMENTS,
  denseSegments: HUMN_DENSE_SEGMENTS,
  semanticGroups: CINEMA2_HUMN_SEMANTIC_GROUPS,
  futureFacetGroups: CINEMA2_HUMN_FUTURE_FACET_GROUPS,
  skinFacetGroups: CINEMA2_HUMN_SKIN_FACET_GROUPS,
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

function glslFloatArray(name: string, countName: string, values: readonly number[]): string {
  return `const float ${name}[${countName}] = float[${countName}](\n${values.map(value => `  ${value.toFixed(1)}`).join(',\n')}\n);`
}

/** Ordinal (0, 1, 2 ...) of each primary segment that belongs to an eye or cheek group, else -1. */
const HUMN_PRIMARY_EYE_CHEEK_ORDINALS: readonly number[] = (() => {
  const members = new Set<string>([
    ...CINEMA2_HUMN_SEMANTIC_GROUPS['left-eye'],
    ...CINEMA2_HUMN_SEMANTIC_GROUPS['right-eye'],
    ...CINEMA2_HUMN_SEMANTIC_GROUPS['left-cheek'],
    ...CINEMA2_HUMN_SEMANTIC_GROUPS['right-cheek'],
  ])
  let ordinal = 0
  return Object.freeze(HUMN_PRIMARY_SEGMENTS.map((_, index) => (members.has(segmentId('primary', index)) ? ordinal++ : -1)))
})()

function glslFacetArrays(facets: readonly Cinema2HumNFacet[]): string {
  const ab = facets
    .map(facet => `  vec4(${facet.slice(0, 4).map(glslNumber).join(', ')})`)
    .join(',\n')
  const c = facets
    .map(facet => `  vec2(${facet.slice(4, 6).map(glslNumber).join(', ')})`)
    .join(',\n')
  return `const int SKIN_FACET_COUNT = ${facets.length};\nconst vec4 SKIN_FACET_AB[SKIN_FACET_COUNT] = vec4[SKIN_FACET_COUNT](\n${ab}\n);\nconst vec2 SKIN_FACET_C[SKIN_FACET_COUNT] = vec2[SKIN_FACET_COUNT](\n${c}\n);`
}

/**
 * Native-module-owned shader generated from the canonical topology above. Its
 * only time input is the shared Cinema 2.0 synced-motion clock. It has no
 * audio analysis of its own: every reactive uniform is a resolved canonical
 * module target (choreography-owned) or a deterministic per-event seed, and
 * each one collapses to the exact approved static frame at its neutral value.
 */
export const CINEMA2_HUMN_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_masterIntensity;
uniform float u_figureScale;
uniform float u_motionAmount;
uniform float u_motionTime;
uniform float u_gridPresence;
uniform float u_linePresence;
uniform float u_lineWeight;
uniform float u_fragmentation;
uniform int u_meshDetail;
uniform float u_facetFill;
uniform int u_fillStyle;
uniform vec4 u_backgroundColor;
uniform vec4 u_wireframeColor;
uniform vec4 u_patternInk;
uniform vec4 u_skinPrimary;
uniform vec4 u_skinSecondary;
uniform vec4 u_skinAccent;
uniform float u_colorShift;
uniform float u_ghostEdgeEmphasis;
uniform float u_beatFlicker;
uniform float u_downbeatReveal;
uniform float u_kickJitter;
uniform float u_snareEyeCheek;
uniform float u_flickerAmount;
uniform float u_fragmentJitter;
uniform float u_beatSeed;
uniform float u_downbeatSeed;
uniform float u_kickSeed;
uniform float u_snareSeed;
uniform float u_gReach;
uniform vec4 u_reachHand;
uniform vec4 u_reachArm;
uniform vec2 u_reachWrist;
uniform float u_gShock;
uniform float u_gGrab;
uniform float u_gLunge;
uniform float u_lungeScale;
uniform float u_lookYaw;
uniform float u_bodyTurn;
uniform float u_nod;
out vec4 outColor;

${glslSegmentArray('PRIMARY_SEGMENTS', HUMN_PRIMARY_SEGMENTS)}

${glslSegmentArray('ACCENT_SEGMENTS', HUMN_ACCENT_SEGMENTS)}

${glslSegmentArray('GHOST_SEGMENTS', HUMN_GHOST_SEGMENTS)}

${glslSegmentArray('RESTORATION_SEGMENTS', HUMN_RESTORATION_SEGMENTS)}

${glslSegmentArray('DENSE_SEGMENTS', HUMN_DENSE_SEGMENTS)}

${glslFloatArray('PRIMARY_EYE_CHEEK_ORDINAL', 'PRIMARY_SEGMENT_COUNT', HUMN_PRIMARY_EYE_CHEEK_ORDINALS)}

${buildHumNLimbGlsl()}

const vec2 LEFT_SHOULDER = vec2(${glslNumber(CINEMA2_HUMN_ARM_ANCHORS.leftShoulder[0])}, ${glslNumber(CINEMA2_HUMN_ARM_ANCHORS.leftShoulder[1])});
const vec2 RIGHT_SHOULDER = vec2(${glslNumber(CINEMA2_HUMN_ARM_ANCHORS.rightShoulder[0])}, ${glslNumber(CINEMA2_HUMN_ARM_ANCHORS.rightShoulder[1])});
const vec2 GRAB_LEFT_ELBOW = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.elbow[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.elbow[1])});
const vec2 GRAB_LEFT_WRIST = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.wrist[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.wrist[1])});
const vec2 GRAB_LEFT_HAND = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.handOrigin[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.handOrigin[1])});
const float GRAB_LEFT_ANGLE = ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.left.handAngle)};
const vec2 GRAB_RIGHT_ELBOW = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.elbow[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.elbow[1])});
const vec2 GRAB_RIGHT_WRIST = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.wrist[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.wrist[1])});
const vec2 GRAB_RIGHT_HAND = vec2(${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.handOrigin[0])}, ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.handOrigin[1])});
const float GRAB_RIGHT_ANGLE = ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.right.handAngle)};
const float GRAB_HAND_SCALE = ${glslNumber(CINEMA2_HUMN_HEAD_GRAB_POSE.handScale)};
const vec2 LUNGE_PIVOT = vec2(${glslNumber(CINEMA2_HUMN_LUNGE_PIVOT.x)}, ${glslNumber(CINEMA2_HUMN_LUNGE_PIVOT.y)});

${glslFacetArrays(HUMN_SKIN_FACETS)}

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

float stableRank(int index, float salt) {
  return fract(sin((float(index) + 1.0) * 12.9898 + salt * 78.233) * 43758.5453);
}

float fragmentationKeep(int index, float salt) {
  if (u_fragmentation <= 0.55) return 1.0;
  float normalized = clamp((u_fragmentation - 0.55) / 0.45, 0.0, 1.0);
  float keepFraction = mix(1.0, 0.22, normalized);
  return stableRank(index, salt) <= keepFraction ? 1.0 : 0.0;
}


float cross2(vec2 a, vec2 b) {
  return a.x * b.y - a.y * b.x;
}

float triangleMask(vec2 p, vec2 a, vec2 b, vec2 c) {
  float d0 = cross2(b - a, p - a);
  float d1 = cross2(c - b, p - b);
  float d2 = cross2(a - c, p - c);
  bool hasNegative = d0 < 0.0 || d1 < 0.0 || d2 < 0.0;
  bool hasPositive = d0 > 0.0 || d1 > 0.0 || d2 > 0.0;
  return hasNegative && hasPositive ? 0.0 : 1.0;
}

vec3 paletteColorForRole(int r) {
  int rr = int(mod(float(r), 7.0));
  if (rr == 4 || rr == 5) return u_skinSecondary.rgb;
  if (rr == 6) return u_skinAccent.rgb;
  return u_skinPrimary.rgb;
}

// Authored role slots a shifted facet may land on. Nothing here is generated:
// every slot is one of the user's own colors (or the authored background void).
vec3 shiftedSlotColor(int slot) {
  int s = int(mod(float(slot), 5.0));
  if (s == 0) return u_skinPrimary.rgb;
  if (s == 1) return u_skinSecondary.rgb;
  if (s == 2) return u_skinAccent.rgb;
  if (s == 3) return u_patternInk.rgb;
  return u_backgroundColor.rgb;
}

int baseSlotForRole(int role) {
  int rr = int(mod(float(role), 7.0));
  if (rr == 4 || rr == 5) return 1;
  if (rr == 6) return 2;
  return 0;
}

vec3 facetRoleColor(int index) {
  // Stable authored role distribution: primary dominates, secondary contrasts,
  // and accent remains intentionally rare. The role is topology-index based,
  // so palette edits never reshuffle which facets own which color. A resolved
  // color shift slides every facet along the authored role ring
  // (primary, secondary, accent, ink, void) - deterministic, no color synthesis.
  int role = index % 7;
  if (u_colorShift < 0.0001) return paletteColorForRole(role);
  float phase = clamp(u_colorShift, 0.0, 1.0) * 4.0;
  int stepIndex = int(floor(phase));
  float stepFrac = phase - float(stepIndex);
  if (stepIndex >= 4) { stepIndex = 3; stepFrac = 1.0; }
  int baseSlot = baseSlotForRole(role);
  return mix(shiftedSlotColor(baseSlot + stepIndex), shiftedSlotColor(baseSlot + stepIndex + 1), stepFrac);
}

vec3 facetStyleColor(int index, vec2 p, vec2 facetCenter) {
  vec3 base = facetRoleColor(index);
  float gradientT = clamp(0.5 + (p.y - facetCenter.y) * 2.8 + (p.x - facetCenter.x) * 0.8, 0.0, 1.0);
  vec3 gradient = mix(base * 0.46, base, gradientT);
  float stripeWave = sin((p.x * 1.28 + p.y) * 92.0 + float(index) * 1.73);
  vec3 stripe = stripeWave >= 0.0 ? u_patternInk.rgb * 0.96 : vec3(0.006);

  if (u_fillStyle == 0) return base;
  if (u_fillStyle == 1) return gradient;
  if (u_fillStyle == 2) return stripe;

  int mixedRole = index % 7;
  if (mixedRole == 0) return vec3(0.004); // authored black surface void
  if (mixedRole == 1) return stripe;
  if (mixedRole == 2) return base;
  if (mixedRole == 3) return base * 0.62;
  if (mixedRole == 4) return u_patternInk.rgb * vec3(0.94, 0.96, 0.98);
  return gradient;
}

vec2 rotateAround(vec2 point, vec2 pivot, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  vec2 local = point - pivot;
  return pivot + vec2(c * local.x - s * local.y, s * local.x + c * local.y);
}

vec2 applyHumNNativeMotion(vec2 p) {
  float amount = clamp(u_motionAmount, 0.0, 1.0);
  if (amount <= 0.000001) return p;

  float t = u_motionTime;
  const float TAU = 6.28318530718;

  // Slow, overlapping authored cycles keep the bust moving as one person rather
  // than as independent line fragments. Ranges stay deliberately restrained.
  float bodyWave = sin(t * TAU * 0.105 + 0.35);
  float postureWave = sin(t * TAU * 0.071 + 1.20);
  float breathWave = sin(t * TAU * 0.185 - 0.60);
  float yawWave = sin(t * TAU * 0.132 + 0.82);
  float pitchWave = sin(t * TAU * 0.097 - 1.05);
  float shoulderWave = sin(t * TAU * 0.143 + 2.10);

  // Inverse-transform the sample point so the rendered figure receives the
  // forward pose. Translation remains under ~3% and breathing scale under 1%.
  vec2 q = p;
  vec2 bodyTranslation = vec2(0.018 * bodyWave + 0.008 * postureWave, 0.008 * postureWave) * amount;
  q -= bodyTranslation;

  float bodyLean = 0.027925268 * postureWave * amount; // ~1.6 degrees
  q = rotateAround(q, vec2(0.0, -0.56), -bodyLean);

  float shoulderWeight = 1.0 - smoothstep(-0.42, -0.12, q.y);
  q.x -= shoulderWeight * 0.014 * shoulderWave * amount;
  q.y -= shoulderWeight * 0.006 * breathWave * amount;

  float breathScale = 1.0 + 0.008 * breathWave * amount;
  vec2 torsoPivot = vec2(0.0, -0.46);
  vec2 torsoLocal = q - torsoPivot;
  torsoLocal.x /= mix(1.0, breathScale, shoulderWeight);
  q = torsoPivot + torsoLocal;

  float headWeight = smoothstep(-0.34, 0.06, q.y);
  vec2 headPivot = vec2(-0.015, 0.13);
  vec2 headLocal = q - headPivot;

  // The 2D authored topology gets a restrained perspective proxy for roughly
  // +/-8 degree yaw and +/-4 degree pitch without breaking shared vertices.
  float yaw = 0.13962634 * yawWave * amount;
  float pitch = 0.06981317 * pitchWave * amount;
  float yawNorm = yaw / 0.13962634;
  float pitchNorm = pitch / 0.06981317;
  float yawCompression = 1.0 - 0.035 * abs(yawNorm);
  headLocal.x = headLocal.x / max(yawCompression, 0.965);
  headLocal.x += 0.022 * yawNorm * headLocal.y;
  headLocal.x -= 0.030 * yawNorm * headWeight;
  headLocal.y -= 0.018 * pitchNorm * headWeight;
  q = mix(q, headPivot + headLocal, headWeight);

  return q;
}

// Kick: a deterministic ~third of the fragments (chosen per kick event via
// u_kickSeed) is rigidly translated by at most 0.012 portrait units. Both
// endpoints move together, so a shocked fragment stays a straight stroke and
// the rest of the figure never moves.
vec4 humNKickDisplace(vec4 segment, int index, float salt) {
  float amount = clamp(u_fragmentJitter, 0.0, 1.0) * clamp(u_kickJitter, 0.0, 1.0);
  if (amount <= 0.0001) return segment;
  if (stableRank(index, salt + 7.13 + u_kickSeed * 19.0) > 0.32) return segment;
  float angle = stableRank(index, salt + 3.71 + u_kickSeed * 23.0) * 6.28318530718;
  vec2 shift = vec2(cos(angle), sin(angle)) * (0.012 * amount);
  return segment + vec4(shift, shift);
}

// ── Structural gestures ─────────────────────────────────────────────────────
// Figure-local pose: the sampling point is mapped through the inverse of the
// forward pose (lunge, shock, head grab, look/turn/nod). Every term is
// weighted by a resolved gesture uniform and is an exact identity at zero, so
// the approved default frame is untouched. The background grid never goes
// through this path.
float humNHeadWeight(float y) {
  return smoothstep(-0.22, 0.05, y);
}

vec2 applyHumNGesturePose(vec2 p) {
  // Look / body turn / nod (last forward step, first inverse step).
  if (abs(u_lookYaw) > 0.00001 || abs(u_bodyTurn) > 0.00001 || u_nod > 0.00001) {
    float hw = humNHeadWeight(p.y);
    p.x -= 0.05 * u_lookYaw * hw;
    p.y += 0.02 * u_nod * hw;
    float sw = 1.0 - hw;
    p.x -= 0.03 * u_bodyTurn * sw;
    p = rotateAround(p, vec2(0.0, -0.56), -0.035 * u_bodyTurn);
  }
  // Head grab: tilt then dip.
  if (u_gGrab > 0.00001) {
    float hw = humNHeadWeight(p.y);
    p = rotateAround(p, vec2(-0.04, 0.10), -0.09 * u_gGrab * hw);
    p.y += 0.03 * u_gGrab * hw;
  }
  // Shock: head pulls back (smaller, lifted), features spread, shoulders recoil.
  if (u_gShock > 0.00001) {
    float hw = humNHeadWeight(p.y);
    p.y -= 0.03 * u_gShock * hw;
    vec2 headCenter = vec2(-0.04, 0.35);
    p = headCenter + (p - headCenter) / (1.0 - 0.07 * u_gShock * hw);
    vec2 faceCenter = vec2(-0.04, 0.30);
    float faceWeight = 1.0 - smoothstep(0.10, 0.42, length((p - faceCenter) * vec2(1.0, 0.9)));
    p = faceCenter + (p - faceCenter) / (1.0 + 0.11 * u_gShock * faceWeight);
    // Shoulders recoil over a wide band so the jaw/neck region is never sheared.
    float torsoWeight = 1.0 - smoothstep(-0.62, -0.10, p.y);
    p.y += 0.06 * u_gShock * torsoWeight;
    p.x /= (1.0 - 0.05 * u_gShock * torsoWeight);
  }
  // Lunge: figure-local surge about the crown pivot; the stage is never scaled.
  if (u_gLunge > 0.00001 && u_lungeScale > 1.00001) {
    p = LUNGE_PIVOT + (p - LUNGE_PIVOT) / u_lungeScale;
  }
  return p;
}

vec2 handToScene(vec2 u, vec2 origin, float scale, float angle, float mirror) {
  u.x *= mirror;
  u.x *= 1.0 + 0.16 * (u.y + 0.6);
  float c = cos(angle);
  float s = sin(angle);
  return origin + vec2(c * u.x - s * u.y, s * u.x + c * u.y) * scale;
}

// x: hand line strokes, y: foreground occlusion coverage.
vec2 humNHandInstance(vec2 p, vec2 origin, float scale, float angle, float mirror, float stroke, float feather, float edge) {
  if (scale < 0.0005) return vec2(0.0);
  if (length(p - origin) > 1.3 * scale + stroke * 2.0) return vec2(0.0);
  float lines = 0.0;
  float cover = 0.0;
  for (int i = 0; i < HAND_SEGMENT_COUNT; ++i) {
    vec4 seg = HAND_SEGMENTS[i];
    vec2 a = handToScene(seg.xy, origin, scale, angle, mirror);
    vec2 b = handToScene(seg.zw, origin, scale, angle, mirror);
    lines = max(lines, segmentMask(p, a, b, stroke, feather));
  }
  for (int i = 0; i < HAND_CAPSULE_COUNT; ++i) {
    vec4 seg = HAND_CAPSULES[i];
    vec2 a = handToScene(seg.xy, origin, scale, angle, mirror);
    vec2 b = handToScene(seg.zw, origin, scale, angle, mirror);
    float radius = 0.5 * HAND_CAPSULE_WIDTH[i] * scale;
    cover = max(cover, 1.0 - smoothstep(radius - edge, radius, sdSegment(p, a, b)));
  }
  for (int i = 0; i < 2; ++i) {
    vec2 a = handToScene(HAND_PALM[i * 3], origin, scale, angle, mirror);
    vec2 b = handToScene(HAND_PALM[i * 3 + 1], origin, scale, angle, mirror);
    vec2 c = handToScene(HAND_PALM[i * 3 + 2], origin, scale, angle, mirror);
    cover = max(cover, triangleMask(p, a, b, c));
  }
  return vec2(lines, cover);
}

// A tapered limb bone: two fractured edge strokes plus occlusion coverage.
vec2 humNLimbBone(vec2 p, vec2 a, vec2 b, float widthA, float widthB, float stroke, float feather) {
  vec2 ba = b - a;
  float len2 = max(dot(ba, ba), 0.000001);
  float tRaw = dot(p - a, ba) / len2;
  float t = clamp(tRaw, 0.0, 1.0);
  float d = length(p - a - ba * t);
  float halfWidth = 0.5 * mix(widthA, widthB, t);
  float cover = 1.0 - smoothstep(halfWidth - stroke, halfWidth, d);
  float ring = 1.0 - smoothstep(stroke, stroke + feather, abs(d - halfWidth));
  float inSpan = step(0.02, tRaw) * step(tRaw, 0.98);
  float side = dot(p - a, vec2(-ba.y, ba.x));
  float broken = (side > 0.0 && tRaw > 0.52 && tRaw < 0.60) ? 0.0 : 1.0;
  return vec2(ring * inSpan * broken, cover);
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
  vec2 screenP = p;
  vec2 compositionAnchor = vec2(${glslNumber(CINEMA2_HUMN_COMPOSITION_ANCHOR.x)}, ${glslNumber(CINEMA2_HUMN_COMPOSITION_ANCHOR.y)});
  float figureScale = max(u_figureScale, 0.0001);
  if (abs(figureScale - 1.0) > 0.000001) {
    p = compositionAnchor + (p - compositionAnchor) / figureScale;
  }
  p = applyHumNNativeMotion(p);
  vec2 posedP = p;
  p = applyHumNGesturePose(p);

  float flickerAmt = clamp(u_flickerAmount, 0.0, 1.0);
  float beatLift = flickerAmt * clamp(u_beatFlicker, 0.0, 1.0) * 0.10;
  float downbeatLift = flickerAmt * clamp(u_downbeatReveal, 0.0, 1.0) * 0.25;
  float snareAmount = flickerAmt * clamp(u_snareEyeCheek, 0.0, 1.0) * 0.18;

  float px = 2.0 / resolution.y;
  float weight = clamp(u_lineWeight, 0.5, 2.0);

  float primarySoft = 0.0;
  float primaryCore = 0.0;
  for (int i = 0; i < PRIMARY_SEGMENT_COUNT; ++i) {
    vec4 segment = humNKickDisplace(PRIMARY_SEGMENTS[i], i, 0.17);
    float eligible = (u_meshDetail == 0 && stableRank(i, 0.17) > 0.72) ? 0.0 : 1.0;
    float keep = eligible * fragmentationKeep(i, 0.17);
    float eyeCheekOrdinal = PRIMARY_EYE_CHEEK_ORDINAL[i];
    if (eyeCheekOrdinal >= 0.0 && snareAmount > 0.0001) {
      // Alternating eye/cheek fragments: one parity dips, the other is revealed.
      // The parity flips per snare event through u_snareSeed.
      float parity = mod(eyeCheekOrdinal + floor(u_snareSeed * 2.0), 2.0);
      keep = parity < 0.5 ? keep * (1.0 - snareAmount) : keep + (eligible - keep) * snareAmount;
    }
    primarySoft = max(primarySoft, keep * segmentMask(p, segment.xy, segment.zw, 1.18 * weight * px, 1.40 * weight * px));
    primaryCore = max(primaryCore, keep * segmentMask(p, segment.xy, segment.zw, 0.56 * weight * px, 0.60 * weight * px));
  }

  float accentSoft = 0.0;
  float accentCore = 0.0;
  float accentLift = 0.0;
  for (int i = 0; i < ACCENT_SEGMENT_COUNT; ++i) {
    vec4 segment = humNKickDisplace(ACCENT_SEGMENTS[i], i, 0.41);
    float eligible = u_meshDetail == 0 ? 0.0 : 1.0;
    float keep = eligible * fragmentationKeep(i, 0.41);
    float softMask = segmentMask(p, segment.xy, segment.zw, 1.26 * weight * px, 1.42 * weight * px);
    accentSoft = max(accentSoft, keep * softMask);
    accentCore = max(accentCore, keep * segmentMask(p, segment.xy, segment.zw, 0.62 * weight * px, 0.66 * weight * px));
    accentLift = max(accentLift, eligible * step(stableRank(i, 3.3 + u_beatSeed * 13.0), 0.5) * beatLift * softMask);
  }

  float ghostSoft = 0.0;
  float ghostCore = 0.0;
  float ghostLift = 0.0;
  for (int i = 0; i < GHOST_SEGMENT_COUNT; ++i) {
    vec4 segment = humNKickDisplace(GHOST_SEGMENTS[i], i, 0.73);
    float eligible = u_meshDetail == 0 ? 0.0 : 1.0;
    float keep = eligible * fragmentationKeep(i, 0.73);
    float softMask = segmentMask(p, segment.xy, segment.zw, 0.92 * weight * px, 1.22 * weight * px);
    ghostSoft = max(ghostSoft, keep * softMask);
    ghostCore = max(ghostCore, keep * segmentMask(p, segment.xy, segment.zw, 0.42 * weight * px, 0.54 * weight * px));
    // Beat brightens a deterministic half of the ghost edges; the downbeat
    // reveals a (different) deterministic subset even when fragmentation has
    // hidden it. The lift lives only on the edge mask, never on the frame.
    float ghostBeatPick = step(stableRank(i, 4.1 + u_beatSeed * 13.0), 0.5);
    float ghostDownbeatPick = step(stableRank(i, 5.7 + u_downbeatSeed * 11.0), 0.45);
    ghostLift = max(ghostLift, eligible * softMask * (beatLift * ghostBeatPick + downbeatLift * ghostDownbeatPick));
  }

  float restoration = 0.0;
  float restorationAmount = clamp((0.55 - u_fragmentation) / 0.55, 0.0, 1.0);
  if (u_meshDetail > 0 && restorationAmount > 0.0) {
    for (int i = 0; i < RESTORATION_SEGMENT_COUNT; ++i) {
      vec4 segment = humNKickDisplace(RESTORATION_SEGMENTS[i], i, 0.91);
      float reveal = stableRank(i, 0.91) <= restorationAmount ? 1.0 : 0.0;
      restoration = max(restoration, reveal * segmentMask(p, segment.xy, segment.zw, 0.72 * weight * px, 0.82 * weight * px));
    }
  }

  float denseFigure = 0.0;
  if (u_meshDetail == 2) {
    for (int i = 0; i < DENSE_SEGMENT_COUNT; ++i) {
      vec4 segment = humNKickDisplace(DENSE_SEGMENTS[i], i, 1.13);
      float keep = fragmentationKeep(i, 1.13);
      denseFigure = max(denseFigure, keep * segmentMask(p, segment.xy, segment.zw, 0.66 * weight * px, 0.76 * weight * px));
    }
  }

  vec3 skinColor = vec3(0.0);
  float skinCoverage = 0.0;
  float facetFill = clamp(u_facetFill, 0.0, 1.0);
  if (facetFill > 0.0) {
    for (int i = 0; i < SKIN_FACET_COUNT; ++i) {
      vec4 ab = SKIN_FACET_AB[i];
      vec2 c = SKIN_FACET_C[i];
      float inside = triangleMask(p, ab.xy, ab.zw, c);
      float rank = stableRank(i, 1.71);
      float reveal = smoothstep(rank * 0.82, min(1.0, rank * 0.82 + 0.18), facetFill);
      float mask = inside * reveal;
      vec2 facetCenter = (ab.xy + ab.zw + c) / 3.0;
      skinColor = mix(skinColor, facetStyleColor(i, p, facetCenter), mask);
      skinCoverage = max(skinCoverage, mask);
    }
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
  vec3 background = u_backgroundColor.rgb;
  float gridPresence = clamp(u_gridPresence, 0.0, 1.0);
  vec3 gridColor = vec3(0.10, 0.13, 0.14) * grid * 0.74 + vec3(0.08, 0.10, 0.11) * macroGrid * 0.12;
  if (gridPresence < 0.999999) gridColor *= gridPresence;

  float ghostEmphasis = clamp(u_ghostEdgeEmphasis, 0.0, 1.0);
  float ghostFigure = (ghostSoft * 0.18 + ghostCore * 0.10) * (1.0 + ghostEmphasis) + ghostLift;
  float wireframeFigure = primarySoft * 0.32 + primaryCore * 0.80;
  float accentFigure = accentSoft * 0.16 + accentCore * 0.34 + accentLift;

  vec3 stageColor = background + gridColor;
  vec3 figureColor = stageColor;
  figureColor = mix(figureColor, skinColor, skinCoverage * facetFill * 0.90);
  float presence = clamp(u_linePresence, 0.0, 1.0);
  vec3 wireframeColor = u_wireframeColor.rgb;
  figureColor += presence * wireframeColor * vec3(0.749388, 0.774291, 0.785400) * ghostFigure;
  figureColor += presence * wireframeColor * vec3(0.967959, 0.980769, 0.989400) * wireframeFigure;
  figureColor += presence * wireframeColor * vec3(1.040816, 1.032389, 1.020000) * accentFigure;
  figureColor += presence * wireframeColor * vec3(0.936735, 0.960121, 0.969000) * restoration * 0.48;
  figureColor += presence * wireframeColor * vec3(0.895102, 0.939474, 0.958800) * denseFigure * 0.52;
  // Authored arms and hands. Head Grab lives in the posed figure space so it
  // follows the head; Reach is a foreground projection in screen space.
  float limbStroke = 0.62 * weight * px;
  float limbFeather = 0.60 * weight * px;
  vec3 limbFill = stageColor * 0.35 + u_skinPrimary.rgb * (0.05 + 0.10 * facetFill);
  if (u_gGrab > 0.00001) {
    float g = clamp(u_gGrab, 0.0, 1.0);
    float armEase = smoothstep(0.0, 0.7, g);
    float wristEase = smoothstep(0.15, 1.0, g);
    float handEase = smoothstep(0.25, 1.0, g);
    float handScale = GRAB_HAND_SCALE * smoothstep(0.1, 0.9, g);
    vec2 lElbow = mix(LEFT_SHOULDER, GRAB_LEFT_ELBOW, armEase);
    vec2 lWrist = mix(LEFT_SHOULDER, GRAB_LEFT_WRIST, wristEase);
    vec2 lHand = mix(LEFT_SHOULDER, GRAB_LEFT_HAND, handEase);
    vec2 rElbow = mix(RIGHT_SHOULDER, GRAB_RIGHT_ELBOW, armEase);
    vec2 rWrist = mix(RIGHT_SHOULDER, GRAB_RIGHT_WRIST, wristEase);
    vec2 rHand = mix(RIGHT_SHOULDER, GRAB_RIGHT_HAND, handEase);
    float grabLines = 0.0;
    float grabCover = 0.0;
    vec2 bone = humNLimbBone(posedP, LEFT_SHOULDER, lElbow, 0.11, 0.10, limbStroke, limbFeather);
    grabLines = max(grabLines, bone.x); grabCover = max(grabCover, bone.y);
    bone = humNLimbBone(posedP, lElbow, lWrist, 0.10, 0.085, limbStroke, limbFeather);
    grabLines = max(grabLines, bone.x); grabCover = max(grabCover, bone.y);
    bone = humNLimbBone(posedP, RIGHT_SHOULDER, rElbow, 0.11, 0.10, limbStroke, limbFeather);
    grabLines = max(grabLines, bone.x); grabCover = max(grabCover, bone.y);
    bone = humNLimbBone(posedP, rElbow, rWrist, 0.10, 0.085, limbStroke, limbFeather);
    grabLines = max(grabLines, bone.x); grabCover = max(grabCover, bone.y);
    vec2 leftHand = humNHandInstance(posedP, lHand, handScale, GRAB_LEFT_ANGLE, 1.0, limbStroke, limbFeather, px);
    vec2 rightHand = humNHandInstance(posedP, rHand, handScale, GRAB_RIGHT_ANGLE, -1.0, limbStroke, limbFeather, px);
    grabLines = max(grabLines, max(leftHand.x, rightHand.x));
    grabCover = max(grabCover, max(leftHand.y, rightHand.y));
    figureColor = mix(figureColor, limbFill, grabCover * 0.94);
    figureColor += presence * wireframeColor * grabLines * 0.92;
  }
  if (u_gReach > 0.00001) {
    vec2 shoulder = u_reachArm.xy;
    vec2 elbow = u_reachArm.zw;
    vec2 wrist = u_reachWrist;
    float k = u_reachHand.z;
    float reachLines = 0.0;
    float reachCover = 0.0;
    vec2 bone = humNLimbBone(screenP, shoulder, elbow, 0.12, 0.13, limbStroke, limbFeather);
    reachLines = max(reachLines, bone.x); reachCover = max(reachCover, bone.y);
    bone = humNLimbBone(screenP, elbow, wrist, 0.13, max(0.30 * k, 0.13), limbStroke, limbFeather);
    reachLines = max(reachLines, bone.x); reachCover = max(reachCover, bone.y);
    vec2 hand = humNHandInstance(screenP, u_reachHand.xy, k, u_reachHand.w, 1.0, limbStroke, limbFeather, px);
    reachLines = max(reachLines, hand.x);
    reachCover = max(reachCover, hand.y);
    figureColor = mix(figureColor, limbFill, reachCover * 0.96);
    figureColor += presence * wireframeColor * reachLines * 0.95;
  }
  float masterIntensity = clamp(u_masterIntensity, 0.0, 1.0);
  vec3 color = figureColor;
  if (masterIntensity < 0.999999) color = mix(stageColor, figureColor, masterIntensity);
  color *= 0.92 + 0.08 * vignette;
  outColor = vec4(color, 1.0);
}
`

export type Cinema2HumNFragmentEventKind = 'beat' | 'downbeat' | 'kick' | 'snare'

function parseFragmentEventKind(payload: unknown): Cinema2HumNFragmentEventKind | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const kind = (payload as { kind?: unknown }).kind
  return kind === 'beat' || kind === 'downbeat' || kind === 'kick' || kind === 'snare' ? kind : null
}

function parseStructuralEventKind(payload: unknown): Cinema2HumNStructuralKind | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const kind = (payload as { kind?: unknown }).kind
  return kind === 'drop' || kind === 'phrase' || kind === 'section' ? kind : null
}

function frameTimeSec(frame: { transport?: { timeSec: number }; audio: { upstream: { timeSec: number } } | null; elapsedTimeSec: number }): number {
  return frame.transport?.timeSec ?? frame.audio?.upstream.timeSec ?? frame.elapsedTimeSec
}

function frameBeatSec(frame: { transport?: { bpm?: number | null }; audio: { rhythm: { bpm: { available: boolean; value: number | null } } } | null }): number | null {
  const analysed = frame.audio?.rhythm.bpm
  if (analysed?.available && typeof analysed.value === 'number' && analysed.value > 0) return 60 / analysed.value
  const host = frame.transport?.bpm
  return typeof host === 'number' && host > 0 ? 60 / host : null
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function readMotionRate(value: unknown): number {
  if (value === '1/2x') return 0.5
  if (value === '2x') return 2
  if (value === '4x') return 4
  return 1
}

function readColor(value: unknown, fallback: readonly [number, number, number, number]): readonly [number, number, number, number] {
  if (Array.isArray(value) && value.length === 4 && value.every(component => typeof component === 'number' && Number.isFinite(component))) {
    return value as unknown as readonly [number, number, number, number]
  }
  return fallback
}

function readMeshDetail(value: unknown): number {
  if (value === 'Sparse') return 0
  if (value === 'Dense') return 2
  return 1
}

function readFillStyle(value: unknown): number {
  if (value === 'Solid') return 0
  if (value === 'Gradient') return 1
  if (value === 'Stripe') return 2
  return 3
}

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
    const motionClock = new Cinema2SyncedMotionClockResolver()
    const eventSeeds: Record<Cinema2HumNFragmentEventKind, number> = { beat: 0, downbeat: 0, kick: 0, snare: 0 }
    const performance = new Cinema2HumNPerformanceRuntime()
    const pendingStructural: { eventId: string; kind: Cinema2HumNStructuralKind }[] = []
    let audioGeneration: number | null = null
    let contextGeneration: number | null = null
    const resetEventSeeds = () => {
      performance.reset()
      pendingStructural.length = 0
      eventSeeds.beat = 0
      eventSeeds.downbeat = 0
      eventSeeds.kick = 0
      eventSeeds.snare = 0
    }

    const provider = Object.freeze({
      id: `${context.module.id}:hum-n-native`,
      moduleId: context.module.id,
      intent: 'fullscreen' as const,
      execute: ({ frame, target, width, height }: Cinema2ModuleRenderExecutionContext) => {
        const program = context.resources.acquire(
          'hum-n-program',
          'WebGLProgram',
          (gl: WebGL2RenderingContext) => {
            const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
              label,
              vertSrc: FULLSCREEN_VERT_SRC,
              fragSrc: CINEMA2_HUMN_FRAGMENT_SOURCE,
              optionalUniforms: ['u_resolution', 'u_masterIntensity', 'u_figureScale', 'u_motionAmount', 'u_motionTime', 'u_gridPresence', 'u_linePresence', 'u_lineWeight', 'u_fragmentation', 'u_meshDetail', 'u_facetFill', 'u_fillStyle', 'u_backgroundColor', 'u_wireframeColor', 'u_patternInk', 'u_skinPrimary', 'u_skinSecondary', 'u_skinAccent', 'u_colorShift', 'u_ghostEdgeEmphasis', 'u_beatFlicker', 'u_downbeatReveal', 'u_kickJitter', 'u_snareEyeCheek', 'u_flickerAmount', 'u_fragmentJitter', 'u_beatSeed', 'u_downbeatSeed', 'u_kickSeed', 'u_snareSeed', 'u_gReach', 'u_reachHand', 'u_reachArm', 'u_reachWrist', 'u_gShock', 'u_gGrab', 'u_gLunge', 'u_lungeScale', 'u_lookYaw', 'u_bodyTurn', 'u_nod'],
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
        program.setFloat('u_masterIntensity', readNumber(context.parameters.get('masterIntensity'), 1))
        // The resolved Motion Amount target is the user's base (plus any manual
        // automation). Music adds on top of it through two internal targets and
        // only that added portion is restrained by vocal presence.
        const userMotionAmount = clampNumber(readNumber(context.parameters.get('motionAmount'), 0), 0, 1)
        const tensionMotionLift = clampNumber(readNumber(context.parameters.get('tensionMotionLift'), 0), 0, 1)
        const buildMotionLift = clampNumber(readNumber(context.parameters.get('buildMotionLift'), 0), 0, 1)
        const vocalMotionRestraint = clampNumber(readNumber(context.parameters.get('vocalMotionRestraint'), 0), 0, 1)
        const intelligenceMotion = (tensionMotionLift + buildMotionLift) * (1 - vocalMotionRestraint)
        const motionAmount = clampNumber(userMotionAmount + intelligenceMotion, 0, 1)
        const resolvedFigureScale = resolveCinema2HumNFigureScale(context.parameters.get('figureScale'), width, height, motionAmount)
        program.setFloat('u_figureScale', resolvedFigureScale)
        const motionRate = readMotionRate(context.parameters.get('motionRate'))
        const bpmSync = readBoolean(context.parameters.get('bpmSync'), true)
        const motionTimeSec = motionClock.resolve(frame, bpmSync).syncedTimeSec * motionRate
        program.setFloat('u_motionAmount', motionAmount)
        program.setFloat('u_motionTime', motionTimeSec)
        program.setFloat('u_gridPresence', readNumber(context.parameters.get('gridPresence'), 1))
        // Energy may only lower Line Presence, and never below 0.55x the user's value.
        const linePresenceBase = clampNumber(readNumber(context.parameters.get('linePresence'), 1), 0, 1)
        const linePresenceLowering = clampNumber(
          readNumber(context.parameters.get('linePresenceLowering'), 0) + readNumber(context.parameters.get('autoLineSparse'), 0),
          0,
          0.45,
        )
        program.setFloat('u_linePresence', linePresenceBase * (1 - linePresenceLowering))
        program.setFloat('u_lineWeight', readNumber(context.parameters.get('lineWeight'), 1))
        program.setFloat('u_fragmentation', clampNumber(readNumber(context.parameters.get('fragmentation'), 0.55), 0, 1))
        program.setInt('u_meshDetail', readMeshDetail(context.parameters.get('meshDetail')))
        program.setFloat('u_facetFill', clampNumber(readNumber(context.parameters.get('facetFill'), 0), 0, 1))
        program.setInt('u_fillStyle', readFillStyle(context.parameters.get('fillStyle')))
        const backgroundColor = readColor(context.parameters.get('backgroundColor'), [0, 0, 0, 1])
        const wireframeColor = readColor(context.parameters.get('wireframeColor'), [245 / 255, 247 / 255, 250 / 255, 1])
        const patternInk = readColor(context.parameters.get('patternInk'), [1, 1, 1, 1])
        const skinPrimary = readColor(context.parameters.get('skinPrimary'), [72 / 255, 240 / 255, 221 / 255, 1])
        const skinSecondary = readColor(context.parameters.get('skinSecondary'), [1, 61 / 255, 200 / 255, 1])
        const skinAccent = readColor(context.parameters.get('skinAccent'), [200 / 255, 1, 74 / 255, 1])
        program.setVec4('u_backgroundColor', backgroundColor[0], backgroundColor[1], backgroundColor[2], backgroundColor[3])
        program.setVec4('u_wireframeColor', wireframeColor[0], wireframeColor[1], wireframeColor[2], wireframeColor[3])
        program.setVec4('u_patternInk', patternInk[0], patternInk[1], patternInk[2], patternInk[3])
        program.setVec4('u_skinPrimary', skinPrimary[0], skinPrimary[1], skinPrimary[2], skinPrimary[3])
        program.setVec4('u_skinSecondary', skinSecondary[0], skinSecondary[1], skinSecondary[2], skinSecondary[3])
        program.setVec4('u_skinAccent', skinAccent[0], skinAccent[1], skinAccent[2], skinAccent[3])
        const colorShiftAmount = clampNumber(readNumber(context.parameters.get('colorShiftAmount'), 0), 0, 1)
        const colorShiftHighBand = clampNumber(readNumber(context.parameters.get('colorShiftHighBand'), 0), 0, 1)
        const colorShiftAirBand = clampNumber(readNumber(context.parameters.get('colorShiftAirBand'), 0), 0, 1)
        const effectiveColorShift = colorShiftAmount * clampNumber(colorShiftHighBand * 0.65 + colorShiftAirBand * 0.35, 0, 1)
        program.setFloat('u_colorShift', effectiveColorShift)
        program.setFloat('u_ghostEdgeEmphasis', clampNumber(readNumber(context.parameters.get('ghostEdgeEmphasis'), 0), 0, 1))
        program.setFloat('u_beatFlicker', clampNumber(readNumber(context.parameters.get('beatFlicker'), 0), 0, 1))
        program.setFloat('u_downbeatReveal', clampNumber(readNumber(context.parameters.get('downbeatReveal'), 0), 0, 1))
        program.setFloat('u_kickJitter', clampNumber(readNumber(context.parameters.get('kickJitter'), 0), 0, 1))
        program.setFloat('u_snareEyeCheek', clampNumber(readNumber(context.parameters.get('snareEyeCheek'), 0), 0, 1))
        program.setFloat('u_flickerAmount', clampNumber(readNumber(context.parameters.get('flickerAmount'), 0), 0, 1))
        program.setFloat('u_fragmentJitter', clampNumber(readNumber(context.parameters.get('fragmentJitter'), 0), 0, 1))
        program.setFloat('u_beatSeed', eventSeeds.beat)
        program.setFloat('u_downbeatSeed', eventSeeds.downbeat)
        program.setFloat('u_kickSeed', eventSeeds.kick)
        program.setFloat('u_snareSeed', eventSeeds.snare)
        // Structural performance: live ceilings are applied every frame, never latched.
        const gestureIntensity = clampNumber(readNumber(context.parameters.get('gestureIntensity'), 0), 0, 1)
        const pose = performance.evaluate(frameTimeSec(frame), { gestureIntensity, motionAmount: userMotionAmount })
        const gesture = resolveCinema2HumNGestureUniforms(pose, { aspect: width / Math.max(height, 1), figureScale: resolvedFigureScale })
        program.setFloat('u_gReach', gesture.reach.weight)
        program.setVec4('u_reachHand', gesture.reach.handX, gesture.reach.handY, gesture.reach.handScale, gesture.reach.handAngle)
        program.setVec4('u_reachArm', gesture.reach.shoulderX, gesture.reach.shoulderY, gesture.reach.elbowX, gesture.reach.elbowY)
        program.setVec2('u_reachWrist', gesture.reach.wristX, gesture.reach.wristY)
        program.setFloat('u_gShock', gesture.shock)
        program.setFloat('u_gGrab', gesture.headGrab)
        program.setFloat('u_gLunge', gesture.lungeWeight)
        program.setFloat('u_lungeScale', gesture.lungeScale)
        program.setFloat('u_lookYaw', gesture.lookYaw)
        program.setFloat('u_bodyTurn', gesture.bodyTurn)
        program.setFloat('u_nod', gesture.nod)
        pass.run(program, target, width, height, [])
      },
    })

    return {
      lifecycle: {
        update: ({ frame }: Cinema2ModuleUpdateContext) => {
          // Event-local state must not survive a seek, source change or new context.
          const nextAudioGeneration = frame.audio?.discontinuity.generation ?? null
          if (audioGeneration !== nextAudioGeneration || contextGeneration !== frame.contextGeneration) {
            if (audioGeneration !== null || contextGeneration !== null) resetEventSeeds()
            audioGeneration = nextAudioGeneration
            contextGeneration = frame.contextGeneration
          }
          // Without analysis there is no musical time: nothing may stay posed.
          if (frame.audio == null) {
            if (performance.activeCount > 0 || pendingStructural.length > 0) resetEventSeeds()
            return
          }
          if (pendingStructural.length === 0) return
          const nowSec = frameTimeSec(frame)
          const beatSec = frameBeatSec(frame)
          const autoOn = readBoolean(context.parameters.get('autoPerformance'), false)
          const director = autoOn ? cinema2HumNDirectorContext(frame.director as never) : null
          for (const pending of pendingStructural.splice(0)) {
            if (beatSec == null) continue // no musical time: never fabricate a tempo
            const strength = clampNumber(readNumber(context.parameters.get(`${pending.kind}Strength`), 0), 0, 1)
            if (strength <= 0.001) continue
            const stream = context.randomness.eventStream(pending.eventId, `hum-n-structural-${pending.kind}`)
            const family = stream.next()
            const direction = cinema2HumNDirectionFromUnit(stream.next())
            const alt = stream.next()
            if (pending.kind === 'drop') {
              // Director impact may gate and scale a drop, but only while Auto Performance is on.
              const gatedStrength = cinema2HumNAutoDropStrength(strength, director?.impact ?? null)
              if (gatedStrength == null) continue
              const gesture = selectCinema2HumNDropGesture(family, { auto: director, previous: performance.previousDropGesture })
              performance.trigger({
                eventId: pending.eventId,
                kind: 'drop',
                gesture,
                strength: gatedStrength,
                startSec: nowSec,
                beatSec,
              }, nowSec)
            } else {
              const variant = selectCinema2HumNStructuralVariant(pending.kind, family, director)
              const resolved = variant === 'lookLeft' && direction > 0 ? 'lookRight' : variant
              performance.trigger({
                eventId: pending.eventId,
                kind: pending.kind,
                variant: resolved,
                sign: direction,
                alt,
                strength,
                startSec: nowSec,
                beatSec,
              }, nowSec)
            }
          }
        },
        dispose: () => {
          motionClock.reset()
          resetEventSeeds()
        },
      },
      handleAction: (action: string, event: Readonly<Cinema2DispatchedTargetAction>) => {
        if (action === 'structuralEvent') {
          const kind = parseStructuralEventKind(event.payload)
          if (kind && pendingStructural.length < 8) pendingStructural.push({ eventId: event.eventId, kind })
          return
        }
        if (action !== 'fragmentEvent') return
        const kind = parseFragmentEventKind(event.payload)
        if (!kind) return
        // Same stable event identity -> same seed -> same fragment subset.
        eventSeeds[kind] = context.randomness.eventStream(event.eventId, `hum-n-fragment-${kind}`).next()
      },
      render: { providers: Object.freeze([provider]) },
    }
  },
})

import type { ShaderParamValue } from '../registry/shaderRegistryTypes'
import { MI_SOURCE_CATEGORY_LABELS, MI_SOURCE_REGISTRY } from '../../../../../lib/miSourceRegistry'
import type { ModulationSourceKey } from '../../../../../lib/miSourceRegistry'

// ── Modulation source IDs ─────────────────────────────────────────────────────
//
// The Shader ENGINE consumes the canonical MI source registry. The small alias
// set below preserves existing Shader routes and exposes engine-specific phase
// or decaying-envelope signals that are not canonical MI source keys.

export type ShaderModulationAliasSourceId =
  | 'highMid'
  | 'kickHit' | 'snareHit' | 'hatHit' | 'beatHit' | 'downbeatHit'
  | 'barPhase' | 'phrasePhase' | 'sectionPhase'
  | 'playbackProgress'

export type ModulationSourceId = ModulationSourceKey | ShaderModulationAliasSourceId

// ── Curve shapes ──────────────────────────────────────────────────────────────

export type ModulationCurve =
  | 'linear'        // x
  | 'easeIn'        // x²
  | 'easeOut'       // 1-(1-x)²
  | 'easeInOut'     // smooth-step S-curve
  | 'exponential'   // x³ (steeper than easeIn)
  | 'logarithmic'   // log curve (fast rise, slow top)
  | 'stepped'       // 8 discrete steps

// ── Route modes ───────────────────────────────────────────────────────────────

export type ModulationMode =
  | 'continuous'  // raw source value → smoothed by route attack/release
  | 'trigger'     // rising edge of source fires an ADHR envelope
  | 'envelope'    // source > 0.5 → attack; source ≤ 0.5 → release
  | 'phase'       // source value passes through directly (no smoothing)

// ── Combine modes ─────────────────────────────────────────────────────────────

export type ModulationCombineMode =
  | 'add'       // target += delta (in param units)
  | 'multiply'  // target *= (1 + scaledSignal)
  | 'replace'   // target = absolute value derived from signal

// ── Route definition ──────────────────────────────────────────────────────────

export interface ShaderModulationRoute {
  /** Unique route identifier. */
  id: string
  source: ModulationSourceId
  /** Must match a param ID in the active ShaderDefinition with modulatable: true. */
  targetParamId: string
  enabled: boolean

  // ── Signal shaping ─────────────────────────────────────────────────────────
  /** Signal depth, -1..1. Negative values invert the signal after `invert`. */
  amount: number
  /** Map the shaped signal to this sub-range of the output before applying amount. */
  outputMin: number  // 0..1
  outputMax: number  // 0..1
  curve: ModulationCurve
  /** If true, signal is flipped (1-x) before output mapping and amount scaling. */
  invert: boolean

  // ── Timing ────────────────────────────────────────────────────────────────
  /** Continuous/envelope attack time in milliseconds. */
  attackMs: number   // 0..5000
  /** Hold time in milliseconds (trigger mode only; 0 = no hold). */
  holdMs: number     // 0..5000
  /** Continuous/envelope release time in milliseconds. */
  releaseMs: number  // 0..5000
  /** If true, a new trigger restarts the envelope even while a prior one is active. */
  retrigger: boolean

  mode: ModulationMode
  combineMode: ModulationCombineMode
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ModulationValidationCode =
  | 'TARGET_NOT_FOUND'
  | 'NOT_MODULATABLE'
  | 'TYPE_NOT_SUPPORTED'

export interface ModulationValidationError {
  code: ModulationValidationCode
  message: string
}

// ── Evaluation output ─────────────────────────────────────────────────────────

export interface ModulationParamResult {
  paramId: string
  /** Unmodulated preset value — preserved for UI display. */
  baseValue: ShaderParamValue
  /** After all routes applied, clamped to schema range. */
  effectiveValue: ShaderParamValue
  /** True when at least one enabled route contributed to this param. */
  modulationActive: boolean
}

export interface ModulationEvaluationFrame {
  /** Result for every param in the active definition, modulated and unmodulated. */
  params: Record<string, ModulationParamResult>
  activeRouteCount: number
}

// ── Route factory ─────────────────────────────────────────────────────────────

let _routeCounter = 0

export function createModulationRoute(
  partial: Partial<ShaderModulationRoute> & { source: ModulationSourceId; targetParamId: string },
): ShaderModulationRoute {
  return {
    id:           `mod-${++_routeCounter}`,
    source:       partial.source,
    targetParamId: partial.targetParamId,
    enabled:      partial.enabled      ?? true,
    amount:       partial.amount       ?? 1,
    outputMin:    partial.outputMin    ?? 0,
    outputMax:    partial.outputMax    ?? 1,
    curve:        partial.curve        ?? 'linear',
    invert:       partial.invert       ?? false,
    attackMs:     partial.attackMs     ?? 10,
    holdMs:       partial.holdMs       ?? 0,
    releaseMs:    partial.releaseMs    ?? 200,
    retrigger:    partial.retrigger    ?? true,
    mode:         partial.mode         ?? 'continuous',
    combineMode:  partial.combineMode  ?? 'add',
  }
}

// ── Source metadata (for UI) ──────────────────────────────────────────────────

export interface ModulationSourceMeta {
  id: ModulationSourceId
  label: string
  group: string
}

export const MODULATION_SOURCE_META: readonly ModulationSourceMeta[] = [
  ...MI_SOURCE_REGISTRY.map(source => ({
    id: source.key as ModulationSourceId,
    label: source.label,
    group: MI_SOURCE_CATEGORY_LABELS[source.category],
  })),
  { id: 'highMid',          label: 'High Mid',          group: 'Audio Bands' },
  { id: 'kickHit',          label: 'Kick Hit Envelope', group: 'Shader Envelopes' },
  { id: 'snareHit',         label: 'Snare Hit Envelope',group: 'Shader Envelopes' },
  { id: 'hatHit',           label: 'Hat Hit Envelope',  group: 'Shader Envelopes' },
  { id: 'beatHit',          label: 'Beat Envelope',     group: 'Shader Envelopes' },
  { id: 'downbeatHit',      label: 'Downbeat Envelope', group: 'Shader Envelopes' },
  { id: 'barPhase',         label: 'Bar Phase',         group: 'Shader Timing' },
  { id: 'phrasePhase',      label: 'Phrase 8 Phase',    group: 'Shader Timing' },
  { id: 'sectionPhase',     label: 'Section Phase',     group: 'Shader Timing' },
  { id: 'playbackProgress', label: 'Playback Position', group: 'Shader Timing' },
]

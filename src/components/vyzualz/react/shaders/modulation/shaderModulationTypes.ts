import type { ShaderParamValue } from '../registry/shaderRegistryTypes'

// ── Modulation source IDs ─────────────────────────────────────────────────────
//
// Every source maps to a field in ShaderAudioUniformFrame or ShaderTimingUniformFrame.
// Source values are guaranteed 0–1 by the audio bridge.

export type ModulationSourceId =
  // Spectral bands
  | 'sub' | 'bass' | 'lowMid' | 'mid' | 'highMid' | 'high' | 'air'
  // Percussion energies
  | 'kick' | 'snare' | 'hat'
  // Per-onset trigger envelopes (already decaying 1→0 from bridge)
  | 'kickHit' | 'snareHit' | 'hatHit' | 'beatHit' | 'downbeatHit'
  // Beat-grid phases (0–1)
  | 'beatPhase' | 'barPhase' | 'phrasePhase' | 'sectionPhase'
  // Energy and spectral features
  | 'energy' | 'tension' | 'buildProgress' | 'dropImpact'
  | 'spectralCentroid' | 'spectralFlux' | 'spectralSpread' | 'spectralFlatness'
  // Playback position
  | 'playbackProgress'

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
  { id: 'sub',             label: 'Sub',              group: 'Spectral Bands' },
  { id: 'bass',            label: 'Bass',             group: 'Spectral Bands' },
  { id: 'lowMid',          label: 'Low Mid',          group: 'Spectral Bands' },
  { id: 'mid',             label: 'Mid',              group: 'Spectral Bands' },
  { id: 'highMid',         label: 'High Mid',         group: 'Spectral Bands' },
  { id: 'high',            label: 'High',             group: 'Spectral Bands' },
  { id: 'air',             label: 'Air',              group: 'Spectral Bands' },
  { id: 'kick',            label: 'Kick',             group: 'Percussion' },
  { id: 'snare',           label: 'Snare',            group: 'Percussion' },
  { id: 'hat',             label: 'Hat',              group: 'Percussion' },
  { id: 'kickHit',         label: 'Kick Hit',         group: 'Hits' },
  { id: 'snareHit',        label: 'Snare Hit',        group: 'Hits' },
  { id: 'hatHit',          label: 'Hat Hit',          group: 'Hits' },
  { id: 'beatHit',         label: 'Beat',             group: 'Hits' },
  { id: 'downbeatHit',     label: 'Downbeat',         group: 'Hits' },
  { id: 'energy',          label: 'Energy',           group: 'Music' },
  { id: 'tension',         label: 'Tension',          group: 'Music' },
  { id: 'buildProgress',   label: 'Build Progress',   group: 'Music' },
  { id: 'dropImpact',      label: 'Drop Impact',      group: 'Music' },
  { id: 'spectralCentroid', label: 'Spectral Centroid', group: 'Spectral' },
  { id: 'spectralFlux',    label: 'Spectral Flux',    group: 'Spectral' },
  { id: 'spectralSpread',  label: 'Spectral Spread',  group: 'Spectral' },
  { id: 'spectralFlatness', label: 'Spectral Flatness', group: 'Spectral' },
  { id: 'beatPhase',       label: 'Beat Phase',       group: 'Timing' },
  { id: 'barPhase',        label: 'Bar Phase',        group: 'Timing' },
  { id: 'phrasePhase',     label: 'Phrase Phase',     group: 'Timing' },
  { id: 'sectionPhase',    label: 'Section Phase',    group: 'Timing' },
  { id: 'playbackProgress', label: 'Playback Position', group: 'Timing' },
]

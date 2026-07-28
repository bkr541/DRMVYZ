import type {
  PixGridPerformanceProgramId,
  PixGridPerformanceSettings,
  PixGridQualityMode,
  PixGridQualityTier,
  PixGridReactionAssignment,
  PixGridState,
} from './PixGridTypes'

export const PIX_GRID_QUALITY_OPTIONS: Array<{ value: PixGridQualityTier; label: string }> = [
  { value: 'draft', label: 'Draft · 64 × 36' },
  { value: 'low', label: 'Low · 96 × 54' },
  { value: 'high', label: 'High · 160 × 90' },
  { value: 'ultra', label: 'Ultra · 256 × 144' },
]

export type PixGridPresentationPatch = Partial<Pick<PixGridState,
  | 'cellGap'
  | 'cellRoundness'
  | 'cellBrightness'
  | 'globalIntensity'
  | 'glowAmount'
  | 'diffusion'
  | 'rgbSubpixelMode'
>>

export type PixGridPerformancePatch = Partial<Pick<PixGridPerformanceSettings,
  | 'enabled'
  | 'intensity'
>>

export function applyPixGridPerformancePatch(state: PixGridState, patch: PixGridPerformancePatch): PixGridState {
  return { ...state, performance: { ...state.performance, ...patch } }
}

export function applyPixGridRequestedQuality(state: PixGridState, quality: PixGridQualityTier): PixGridState {
  return { ...state, quality }
}

export function applyPixGridQualityMode(state: PixGridState, qualityMode: PixGridQualityMode): PixGridState {
  return { ...state, qualityMode }
}

export function applyPixGridPresentationPatch(state: PixGridState, patch: PixGridPresentationPatch): PixGridState {
  return { ...state, ...patch }
}

export function changePixGridPerformanceProgramOnly(
  state: PixGridState,
  programId: PixGridPerformanceProgramId,
): PixGridState {
  return {
    ...state,
    performance: {
      ...state.performance,
      sharedPerformanceProgramId: programId,
      programOverrides: { routes: {}, sections: {} },
    },
  }
}

export function clearPixGridManualOverrideState(state: PixGridState): PixGridState {
  return {
    ...state,
    performance: { ...state.performance, lockedRoutes: [] },
    layers: state.layers.map(layer => layer.locked ? { ...layer, locked: false } : layer),
  }
}

export const PIX_GRID_REACTION_FIELDS = Object.freeze({
  amount: { min: -4, max: 4, step: 0.01 },
  inputRange: { min: -4, max: 4, step: 0.01 },
  outputRange: { min: -8, max: 8, step: 0.01 },
  priority: { min: -1000, max: 1000, step: 1 },
  threshold: { min: 0, max: 1, step: 0.01 },
  hysteresis: { min: 0, max: 0.5, step: 0.01 },
  attack: { min: 0, max: 10, step: 0.001 },
  hold: { min: 0, max: 10, step: 0.001 },
  release: { min: 0, max: 20, step: 0.001 },
  cooldown: { min: 0, max: 30, step: 0.001 },
  smoothing: { min: 0, max: 10, step: 0.001 },
  minimumConfidence: { min: 0, max: 1, step: 0.01 },
})

export function patchPixGridReactionAssignment(
  assignment: PixGridReactionAssignment,
  patch: Partial<PixGridReactionAssignment>,
): PixGridReactionAssignment {
  return { ...assignment, ...patch }
}

export function pixGridReactionHasAdvancedValues(assignment: PixGridReactionAssignment): boolean {
  return Boolean(
    assignment.conditions
    || assignment.cooldown
    || assignment.inputRange
    || assignment.outputRange
    || assignment.quantization !== 'none'
    || assignment.retrigger !== 'restart'
    || assignment.blend !== 'add'
    || assignment.priority
    || assignment.hysteresis
    || assignment.minimumConfidence
    || assignment.capabilityFallback !== 'disable'
    || assignment.polarity === 'bipolar',
  )
}

export function summarizePixGridReactionAssignment(assignment: PixGridReactionAssignment): string {
  const priority = assignment.priority ?? 0
  const advanced = pixGridReactionHasAdvancedValues(assignment) ? ' · advanced fields preserved' : ''
  return `${assignment.source} → ${assignment.target} · amount ${assignment.amount.toFixed(2)} · priority ${priority}${advanced}`
}

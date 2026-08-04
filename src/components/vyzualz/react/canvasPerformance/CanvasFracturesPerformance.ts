import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  CANVAS_FRACTURE_EFFECT_ROLES,
  CANVAS_PRESET_BY_ID,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  type CanvasFractureEffectRole,
  type CanvasPresetId,
  type CanvasPresetSettings,
} from '../ReactTypes'
import type {
  CanvasFracturesLayerProcessor,
  CanvasFracturesNumericOverrideKey,
  CanvasFracturesOverridePatch,
  CanvasFracturesOverrideProfile,
} from './CanvasPerformanceTypes'

const ANCHOR_MODES = new Set(['alwaysVisible', 'reactive', 'fadeWithMusic', 'fullyFragmented'])
const PLACEMENT_MODES = new Set(['balanced', 'offscreenSpill', 'heavyOverlap', 'anchorCover', 'repeatedCrops', 'mirrorFlip', 'randomMix'])
const QUANTIZE_INTERVALS = new Set(['manualOnly', 'beat', 'bar', '2bars', '4bars', '8bars', '16bars', 'section'])
const TRANSITION_MODES = new Set(['hardGlitchCut', 'staggeredAssembly', 'zoomInOut'])

const NUMERIC_OVERRIDE_KEYS: readonly CanvasFracturesNumericOverrideKey[] = [
  'fractureIntensity',
  'fractureComposition',
  'fractureFocusProtection',
  'fractureMotionAmount',
  'fractureEffectsIntensity',
  'fractureAudioResponse',
  'fractureBassMotion',
  'fractureTransientGlitch',
  'fractureStructuralResponse',
  'fractureGlowAmount',
  'fractureGlitchAmount',
  'fractureDuplicationAmount',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeRoleWeights(value: unknown): Partial<Record<CanvasFractureEffectRole, number>> | undefined {
  if (!isRecord(value)) return undefined
  const result: Partial<Record<CanvasFractureEffectRole, number>> = {}
  for (const role of CANVAS_FRACTURE_EFFECT_ROLES) {
    const candidate = finiteNumber(value[role])
    if (candidate !== null) result[role] = clamp01(candidate)
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function normalizeCanvasFracturesOverridePatch(value: unknown): CanvasFracturesOverridePatch {
  if (!isRecord(value)) return {}
  const normalized: CanvasFracturesOverridePatch = {}

  for (const key of NUMERIC_OVERRIDE_KEYS) {
    const candidate = finiteNumber(value[key])
    if (candidate !== null) normalized[key] = clamp01(candidate)
  }

  if (typeof value.fractureAnchorMode === 'string' && ANCHOR_MODES.has(value.fractureAnchorMode)) {
    normalized.fractureAnchorMode = value.fractureAnchorMode as CanvasFracturesOverridePatch['fractureAnchorMode']
  }
  if (typeof value.fracturePlacementMode === 'string' && PLACEMENT_MODES.has(value.fracturePlacementMode)) {
    normalized.fracturePlacementMode = value.fracturePlacementMode as CanvasFracturesOverridePatch['fracturePlacementMode']
  }
  if (typeof value.fractureTopologyInterval === 'string' && QUANTIZE_INTERVALS.has(value.fractureTopologyInterval)) {
    normalized.fractureTopologyInterval = value.fractureTopologyInterval as CanvasFracturesOverridePatch['fractureTopologyInterval']
  }
  if (typeof value.fractureLayoutInterval === 'string' && QUANTIZE_INTERVALS.has(value.fractureLayoutInterval)) {
    normalized.fractureLayoutInterval = value.fractureLayoutInterval as CanvasFracturesOverridePatch['fractureLayoutInterval']
  }
  if (typeof value.fractureTransitionMode === 'string' && TRANSITION_MODES.has(value.fractureTransitionMode)) {
    normalized.fractureTransitionMode = value.fractureTransitionMode as CanvasFracturesOverridePatch['fractureTransitionMode']
  }
  if (typeof value.fractureReturnToAnchor === 'boolean') normalized.fractureReturnToAnchor = value.fractureReturnToAnchor

  const roleWeights = normalizeRoleWeights(value.fractureEffectRoleWeights)
  if (roleWeights) normalized.fractureEffectRoleWeights = roleWeights
  return normalized
}

export function normalizeCanvasFracturesOverrideProfile(value: unknown): CanvasFracturesOverrideProfile | null {
  if (!isRecord(value)) return null
  const values = normalizeCanvasFracturesOverridePatch(value.values)
  const rampSource = isRecord(value.ramp) ? value.ramp : null
  const ramp: CanvasFracturesOverrideProfile['ramp'] = {}
  if (rampSource) {
    for (const key of NUMERIC_OVERRIDE_KEYS) {
      const candidate = finiteNumber(rampSource[key])
      if (candidate !== null) ramp[key] = Math.max(-1, Math.min(1, candidate))
    }
  }
  return {
    values,
    ...(Object.keys(ramp).length > 0 ? { ramp } : {}),
  }
}

function mergeOverridePatches(
  base: CanvasFracturesOverridePatch,
  next: CanvasFracturesOverridePatch,
): CanvasFracturesOverridePatch {
  return {
    ...base,
    ...next,
    fractureEffectRoleWeights: base.fractureEffectRoleWeights || next.fractureEffectRoleWeights
      ? { ...base.fractureEffectRoleWeights, ...next.fractureEffectRoleWeights }
      : undefined,
  }
}

function profileProgress(context: SharedPerformanceContext): number {
  const continuous = context.sectionType === 'build' || context.sectionType === 'preDrop'
    ? Math.max(context.sectionProgress, context.buildProgress)
    : context.sectionProgress
  // Four deterministic steps keep structural Fractures changes musical and seek-safe.
  return Math.round(clamp01(continuous) * 4) / 4
}

export function resolveCanvasFracturesOverrideProfile(
  profile: CanvasFracturesOverrideProfile | null | undefined,
  context: SharedPerformanceContext,
): CanvasFracturesOverridePatch {
  const normalized = normalizeCanvasFracturesOverrideProfile(profile)
  if (!normalized) return {}
  const resolved = { ...normalized.values }
  const progress = profileProgress(context)
  for (const key of NUMERIC_OVERRIDE_KEYS) {
    const start = finiteNumber(resolved[key])
    const delta = finiteNumber(normalized.ramp?.[key])
    if (start !== null && delta !== null) resolved[key] = clamp01(start + delta * progress)
  }
  return resolved
}

export function resolveCanvasFracturesShowOverrides({
  authoredProfile,
  persistedProfile,
  context,
}: {
  authoredProfile: CanvasFracturesOverrideProfile
  persistedProfile?: CanvasFracturesOverrideProfile | null
  context: SharedPerformanceContext
}): CanvasFracturesOverridePatch {
  const authored = resolveCanvasFracturesOverrideProfile(authoredProfile, context)
  const persisted = resolveCanvasFracturesOverrideProfile(persistedProfile, context)
  return mergeOverridePatches(authored, persisted)
}

export function makeCanvasFracturesProcessorIdentity({
  programId,
  sceneId,
  context,
  overrides,
}: {
  programId: string
  sceneId: string
  context: SharedPerformanceContext
  overrides: CanvasFracturesOverridePatch
}): string {
  const sortedWeights = overrides.fractureEffectRoleWeights
    ? Object.fromEntries(Object.entries(overrides.fractureEffectRoleWeights).sort(([a], [b]) => a.localeCompare(b)))
    : null
  return [
    programId,
    sceneId,
    context.trackIdentity,
    context.sectionIdentity,
    context.performanceFourBarBlockIndex,
    JSON.stringify({ ...overrides, fractureEffectRoleWeights: sortedWeights }),
  ].join('|')
}

export function resolveCanvasFracturesPresetSettings({
  selectedPresetId,
  userSettings,
  autoPerformance,
  processor,
}: {
  selectedPresetId: CanvasPresetId
  userSettings: CanvasPresetSettings
  autoPerformance: boolean
  processor?: CanvasFracturesLayerProcessor | null
}): CanvasPresetSettings {
  const presetDefaults = CANVAS_PRESET_BY_ID['canvas-fractures']?.settings ?? {}
  const canonical: CanvasPresetSettings = {
    ...DEFAULT_CANVAS_PRESET_SETTINGS,
    ...presetDefaults,
    fractureEffectRoleWeights: {
      ...DEFAULT_CANVAS_PRESET_SETTINGS.fractureEffectRoleWeights,
      ...presetDefaults.fractureEffectRoleWeights,
    },
  }
  const baseline: CanvasPresetSettings = selectedPresetId === 'canvas-fractures'
    ? { ...canonical, ...userSettings, fractureEffectRoleWeights: { ...canonical.fractureEffectRoleWeights, ...userSettings.fractureEffectRoleWeights } }
    : { ...canonical, fractureEffectRoleWeights: { ...canonical.fractureEffectRoleWeights } }
  if (!autoPerformance || processor?.kind !== 'fractures') return baseline
  const overrides = normalizeCanvasFracturesOverridePatch(processor.overrides)
  return {
    ...baseline,
    ...overrides,
    fractureEffectRoleWeights: {
      ...baseline.fractureEffectRoleWeights,
      ...overrides.fractureEffectRoleWeights,
    },
  }
}

export function isCanvasFracturesProcessor(
  value: unknown,
): value is CanvasFracturesLayerProcessor {
  return isRecord(value)
    && value.kind === 'fractures'
    && value.presetId === 'canvas-fractures'
    && typeof value.identity === 'string'
}

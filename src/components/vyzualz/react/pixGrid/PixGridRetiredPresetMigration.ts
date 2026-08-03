import { DEFAULT_PIX_GRID_PRESET_ID } from './PixGridDefaults'
import { PIX_GRID_PRESET_BY_ID } from './PixGridPresets'
import { applyPixGridPresetSettings } from './PixGridState'
import type { PixGridState } from './PixGridTypes'
import { normalizePixGridState } from './PixGridValidation'

export const RETIRED_PIX_GRID_MARQUEE_PRESET_ID = 'pix-grid-neon-marquee-cycle' as const
export const RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID = 'pix-grid-neon-marquee-performance' as const

export const RETIRED_PIX_GRID_MARQUEE_SCENE_PREFIX = `${RETIRED_PIX_GRID_MARQUEE_PRESET_ID}-` as const
export const RETIRED_PIX_GRID_MARQUEE_LAYER_PREFIX = 'marquee-' as const
export const RETIRED_PIX_GRID_MARQUEE_GROUP_PREFIX = 'marquee-' as const
export const RETIRED_PIX_GRID_MARQUEE_ASSET_PREFIX = 'pix-neon-marquee-' as const

const RETIRED_CUE_TARGET_ID_KEYS = new Set([
  'sceneId',
  'layerId',
  'groupId',
  'assetId',
  'targetId',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasPrefix(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix)
}

function isRetiredSceneId(value: unknown): boolean {
  return hasPrefix(value, RETIRED_PIX_GRID_MARQUEE_SCENE_PREFIX)
}

function isRetiredLayerId(value: unknown): boolean {
  return hasPrefix(value, RETIRED_PIX_GRID_MARQUEE_LAYER_PREFIX)
}

function isRetiredGroupId(value: unknown): boolean {
  return hasPrefix(value, RETIRED_PIX_GRID_MARQUEE_GROUP_PREFIX)
}

function isRetiredAssetId(value: unknown): boolean {
  return hasPrefix(value, RETIRED_PIX_GRID_MARQUEE_ASSET_PREFIX)
}

function isRetiredDescendantId(value: unknown): boolean {
  return isRetiredSceneId(value)
    || isRetiredLayerId(value)
    || isRetiredGroupId(value)
    || isRetiredAssetId(value)
}

function containsRetiredScopedId(value: unknown): boolean {
  return typeof value === 'string'
    && value.split(/[:/]/).some(isRetiredDescendantId)
}

function recordHasRetiredScopedKey(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).some(containsRetiredScopedId)
}

function reactionReferencesRetiredDescendant(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (isRetiredDescendantId(value.id) || isRetiredDescendantId(value.targetId)) return true
  const conditions = isRecord(value.conditions) ? value.conditions : null
  return isRetiredLayerId(conditions?.activeLayerId)
    || isRetiredGroupId(conditions?.activeGroupId)
}

function layerReferencesRetiredAsset(layer: Record<string, unknown>): boolean {
  if (isRetiredAssetId(layer.maskAssetId)) return true

  const frameSource = isRecord(layer.frameSource) ? layer.frameSource : null
  if (frameSource?.kind === 'asset') {
    return isRetiredAssetId(frameSource.assetId) || isRetiredAssetId(layer.assetId)
  }
  if (frameSource?.kind === 'media' || frameSource?.kind === 'deck') {
    // Media and Deck frame sources are authoritative. Their legacy assetId
    // compatibility alias is not an owned built-in asset reference.
    return false
  }
  return isRetiredAssetId(layer.assetId) || isRetiredAssetId(frameSource?.assetId)
}

/**
 * Detects the frozen persisted lineage of the retired Marquee Sign Cycle.
 * Display names are intentionally ignored so the unrelated rectangular
 * Marquee Selection editor tool and user-authored labels remain untouched.
 */
export function isRetiredPixGridMarqueeState(value: unknown): boolean {
  if (!isRecord(value)) return false

  if (value.selectedPresetId === RETIRED_PIX_GRID_MARQUEE_PRESET_ID) return true

  const configuration = isRecord(value.configuration) ? value.configuration : null
  if (configuration?.sourcePresetId === RETIRED_PIX_GRID_MARQUEE_PRESET_ID) return true
  const lastMigration = isRecord(configuration?.lastMigration) ? configuration.lastMigration : null
  if (lastMigration?.originalBuiltInPresetId === RETIRED_PIX_GRID_MARQUEE_PRESET_ID) return true
  const signatures = isRecord(configuration?.canonicalSignatures) ? configuration.canonicalSignatures : null
  if (
    recordHasRetiredScopedKey(signatures?.groups)
    || recordHasRetiredScopedKey(signatures?.assignments)
    || recordHasRetiredScopedKey(signatures?.layerAnimations)
  ) return true

  const performance = isRecord(value.performance) ? value.performance : null
  if (performance?.sharedPerformanceProgramId === RETIRED_PIX_GRID_MARQUEE_PERFORMANCE_PROGRAM_ID) return true

  if (isRetiredSceneId(value.selectedSceneId)) return true

  const editor = isRecord(value.editor) ? value.editor : null
  if (
    isRetiredSceneId(editor?.selectedSceneId)
    || isRetiredLayerId(editor?.selectedLayerId)
    || isRetiredGroupId(editor?.selectedGroupId)
    || isRetiredDescendantId(editor?.previewReactionAssignmentId)
  ) return true

  const scenes = Array.isArray(value.scenes) ? value.scenes : []
  for (const scene of scenes) {
    if (!isRecord(scene)) continue
    if (isRetiredSceneId(scene.id)) return true
    if (Array.isArray(scene.layerIds) && scene.layerIds.some(isRetiredLayerId)) return true
  }

  const layers = Array.isArray(value.layers) ? value.layers : []
  for (const layer of layers) {
    if (!isRecord(layer)) continue
    if (isRetiredLayerId(layer.id) || layerReferencesRetiredAsset(layer)) return true
  }

  const groups = Array.isArray(value.groups) ? value.groups : []
  for (const group of groups) {
    if (!isRecord(group)) continue
    if (isRetiredGroupId(group.id)) return true
    if (isRetiredLayerId(group.layerId)) return true
    if (Array.isArray(group.layerScope) && group.layerScope.some(isRetiredLayerId)) return true
    if (isRetiredDescendantId(group.smartRuleId)) return true
    if (Array.isArray(group.reactions) && group.reactions.some(reactionReferencesRetiredDescendant)) return true
  }

  const audioAssignments = Array.isArray(value.audioAssignments) ? value.audioAssignments : []
  if (audioAssignments.some(reactionReferencesRetiredDescendant)) return true

  if (performance) {
    if (Array.isArray(performance.lockedRoutes) && performance.lockedRoutes.some(containsRetiredScopedId)) return true
    if (isRecord(performance.programOverrides)) {
      const routes = isRecord(performance.programOverrides.routes)
        ? performance.programOverrides.routes
        : {}
      if (recordHasRetiredScopedKey(routes)) return true
      if (Object.values(routes).some((route) => (
        isRecord(route) && isRetiredDescendantId(route.targetId)
      ))) return true
      if (recordHasRetiredScopedKey(performance.programOverrides.sections)) return true
    }
  }

  return false
}

/**
 * Atomically replaces a retired Marquee graph through the same preset-application
 * path used by normal PixGrid selection. This clears every graph-owned ID and
 * reference together while preserving the generic state that preset application
 * already preserves, including conversion, diagnostics, authoring chrome, and
 * the selected editor tool.
 */
export function sanitizeRetiredPixGridMarqueeState(value: unknown): PixGridState {
  const normalized = normalizePixGridState(value)
  if (!isRetiredPixGridMarqueeState(value)) return normalized

  const fallback = PIX_GRID_PRESET_BY_ID.get(DEFAULT_PIX_GRID_PRESET_ID)
  if (!fallback?.pixGridSettings) return normalized

  return applyPixGridPresetSettings(
    normalized,
    DEFAULT_PIX_GRID_PRESET_ID,
    fallback.pixGridSettings,
  )
}

function actionTargetsRetiredMarquee(value: unknown, key: string | null = null): boolean {
  if (typeof value === 'string') {
    return (key === 'target' || key === 'targets' || (key != null && RETIRED_CUE_TARGET_ID_KEYS.has(key)))
      && isRetiredDescendantId(value)
  }
  if (Array.isArray(value)) {
    return value.some(item => actionTargetsRetiredMarquee(item, key))
  }
  if (!isRecord(value)) return false

  return Object.entries(value).some(([childKey, childValue]) => (
    actionTargetsRetiredMarquee(childValue, childKey)
  ))
}

export function isRetiredPixGridMarqueeActionCue(value: unknown): boolean {
  return isRecord(value)
    && isRecord(value.action)
    && actionTargetsRetiredMarquee(value.action)
}

/**
 * Drops only cue actions that explicitly target frozen Marquee descendants.
 * Generic actions, all-layer targets, palette/background actions, power
 * transitions, freeze, clear, and Auto Performance cues remain byte-for-byte.
 */
export function sanitizeRetiredPixGridMarqueeActionCueMap(value: unknown): unknown {
  if (!isRecord(value)) return value

  let changed = false
  const sanitized = Object.fromEntries(Object.entries(value).map(([trackId, bucket]) => {
    if (!Array.isArray(bucket)) return [trackId, bucket]
    const retained = bucket.filter(cue => !isRetiredPixGridMarqueeActionCue(cue))
    changed ||= retained.length !== bucket.length
    return [trackId, retained]
  }))

  return changed ? sanitized : value
}

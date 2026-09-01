import type { CanvasFitMode } from '../ReactTypes'
import {
  CANVAS_LAYER_EFFECT_IDS,
  MAX_CANVAS_AUTHORED_LAYERS,
  MAX_CANVAS_LAYER_EFFECTS,
  MAX_CANVAS_STORED_AUTHORED_LAYERS,
  type CanvasAuthoredLayer,
  type CanvasAuthoredLayerOwnership,
  type CanvasControlScope,
  type CanvasLayerEffectId,
  type CanvasLayerEffectMutationFailureCode,
  type CanvasLayerEngineOverrides,
  type CanvasLayerMutationFailureCode,
  type CanvasMediaPool,
  type CanvasPrimaryLayerState,
  type CanvasRenderMode,
} from './CanvasPerformanceTypes'

export const CANVAS_LEGACY_COMPATIBILITY_POOL_ID = 'canvas-pool-legacy'
export const CANVAS_LEGACY_COMPATIBILITY_POOL_NAME = 'Performance Pool'
export const MAX_CANVAS_MEDIA_POOLS = 64
export const MAX_CANVAS_MEDIA_IDS_PER_POOL = 128

const CANVAS_LAYER_EFFECT_ID_SET = new Set<string>(CANVAS_LAYER_EFFECT_IDS)

export interface CanvasLayerSlotState {
  authoredLayers: readonly Pick<CanvasAuthoredLayer, 'id' | 'mediaId' | 'enabled' | 'solo'>[]
  renderMode: CanvasRenderMode
  activeCanvasMediaId: string | null
}

export function getCanvasLayerSlotState(state: CanvasLayerSlotState): {
  occupiedSlots: number
  requiredSlots: number
  hasCapacity: boolean
  activeLayerIndex: number
} {
  const activeMediaId = typeof state.activeCanvasMediaId === 'string'
    ? state.activeCanvasMediaId.trim()
    : ''
  const activeLayerIndex = activeMediaId
    ? state.authoredLayers.findIndex(layer => layer.mediaId === activeMediaId)
    : -1
  const occupiedSlots = state.renderMode === 'single'
    ? Number(activeMediaId.length > 0)
    : resolveCanvasEffectiveAuthoredLayers(state.authoredLayers).length
  const requiredSlots = 1
  return {
    occupiedSlots,
    requiredSlots,
    hasCapacity: occupiedSlots + requiredSlots <= MAX_CANVAS_AUTHORED_LAYERS,
    activeLayerIndex,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isCanvasLayerEffectId(value: unknown): value is CanvasLayerEffectId {
  return typeof value === 'string' && CANVAS_LAYER_EFFECT_ID_SET.has(value)
}

export function normalizeCanvasLayerEffects(value: unknown): CanvasLayerEffectId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<CanvasLayerEffectId>()
  const effects: CanvasLayerEffectId[] = []
  for (const candidate of value) {
    if (!isCanvasLayerEffectId(candidate) || seen.has(candidate)) continue
    seen.add(candidate)
    effects.push(candidate)
    if (effects.length >= MAX_CANVAS_LAYER_EFFECTS) break
  }
  return effects
}

export function normalizeCanvasMediaIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue
    const id = candidate.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
    if (normalized.length >= MAX_CANVAS_MEDIA_IDS_PER_POOL) break
  }
  return normalized
}

const CANVAS_ENGINE_OVERRIDE_FIT_MODES = new Set<CanvasFitMode>(['contain', 'cover', 'stretch'])

function clampFiniteCanvasOverrideNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(min, Math.min(max, value))
}

/**
 * Validates a persisted/patched engine-overrides record field by field so a
 * single corrupt or out-of-range value can't poison the rest, and keeps the
 * result sparse -- an empty result normalizes to `undefined` rather than an
 * empty object, matching the "absence means inherit" contract. Ranges mirror
 * normalizeCanvasEngineSettings' bounds for the same Display fields.
 */
export function normalizeCanvasLayerEngineOverrides(value: unknown): CanvasLayerEngineOverrides | undefined {
  if (!isRecord(value)) return undefined
  const overrides: CanvasLayerEngineOverrides = {}
  if (typeof value.fitMode === 'string' && CANVAS_ENGINE_OVERRIDE_FIT_MODES.has(value.fitMode as CanvasFitMode)) {
    overrides.fitMode = value.fitMode as CanvasFitMode
  }
  const scale = clampFiniteCanvasOverrideNumber(value.scale, 0.1, 4)
  if (scale !== undefined) overrides.scale = scale
  const positionX = clampFiniteCanvasOverrideNumber(value.positionX, -100, 100)
  if (positionX !== undefined) overrides.positionX = positionX
  const positionY = clampFiniteCanvasOverrideNumber(value.positionY, -100, 100)
  if (positionY !== undefined) overrides.positionY = positionY
  const rotation = clampFiniteCanvasOverrideNumber(value.rotation, -180, 180)
  if (rotation !== undefined) overrides.rotation = rotation
  const opacity = clampFiniteCanvasOverrideNumber(value.opacity, 0, 1)
  if (opacity !== undefined) overrides.opacity = opacity
  return Object.keys(overrides).length > 0 ? overrides : undefined
}

export function normalizeCanvasAuthoredLayers(value: unknown): CanvasAuthoredLayer[] {
  if (!Array.isArray(value)) return []
  const seenIds = new Set<string>()
  const candidates: Array<CanvasAuthoredLayer & { sourceIndex: number }> = []

  for (const [sourceIndex, raw] of value.entries()) {
    if (!isRecord(raw)) continue
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    const mediaId = typeof raw.mediaId === 'string' ? raw.mediaId.trim() : ''
    if (!id || !mediaId || seenIds.has(id)) continue
    seenIds.add(id)
    const ownership: CanvasAuthoredLayerOwnership = raw.ownership === 'automatic' ? 'automatic' : 'manual'
    const rawOrder = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : sourceIndex
    candidates.push({
      id,
      mediaId,
      effects: normalizeCanvasLayerEffects(raw.effects),
      order: rawOrder,
      enabled: raw.enabled !== false,
      solo: raw.solo === true,
      ownership,
      pinned: typeof raw.pinned === 'boolean' ? raw.pinned : ownership === 'manual',
      engineOverrides: normalizeCanvasLayerEngineOverrides(raw.engineOverrides),
      sourceIndex,
    })
  }

  const ordered = candidates
    .sort((left, right) => left.order - right.order || left.sourceIndex - right.sourceIndex || left.id.localeCompare(right.id))
    .slice(0, MAX_CANVAS_STORED_AUTHORED_LAYERS)
    .map(({ sourceIndex: _sourceIndex, ...layer }, order) => ({ ...layer, order }))

  let soloClaimed = false
  return ordered.map(layer => {
    const solo = layer.solo && !soloClaimed
    if (solo) soloClaimed = true
    return solo === layer.solo ? layer : { ...layer, solo }
  })
}

export function normalizeCanvasPrimaryLayerState(
  value: unknown,
  authoredLayers: readonly CanvasAuthoredLayer[],
): CanvasPrimaryLayerState | null {
  if (!isRecord(value)) return null
  const canonicalLayers = normalizeCanvasAuthoredLayers(authoredLayers)
  if (value.kind === 'authored') {
    const layerId = typeof value.layerId === 'string' ? value.layerId.trim() : ''
    return canonicalLayers.some(layer => layer.id === layerId) ? { kind: 'authored', layerId } : null
  }
  if (value.kind !== 'detached') return null
  const layer = normalizeCanvasAuthoredLayers([value.layer])[0] ?? null
  if (!layer) return null
  if (canonicalLayers.some(candidate => candidate.id === layer.id)) {
    return { kind: 'authored', layerId: layer.id }
  }
  return { kind: 'detached', layer: { ...layer, order: 0 } }
}

export function resolveCanvasPrimaryLayer(
  primaryLayer: CanvasPrimaryLayerState | null,
  authoredLayers: readonly CanvasAuthoredLayer[],
): CanvasAuthoredLayer | null {
  const canonicalLayers = normalizeCanvasAuthoredLayers(authoredLayers)
  const canonicalPrimary = normalizeCanvasPrimaryLayerState(primaryLayer, canonicalLayers)
  if (!canonicalPrimary) return null
  return canonicalPrimary.kind === 'authored'
    ? canonicalLayers.find(layer => layer.id === canonicalPrimary.layerId) ?? null
    : canonicalPrimary.layer
}

export function retargetCanvasPrimaryLayerState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  mediaId: unknown,
  createDetachedLayer: (mediaId: string) => CanvasAuthoredLayer,
): CanvasPrimaryLayerState | null {
  const nextMediaId = typeof mediaId === 'string' ? mediaId.trim() : ''
  if (!nextMediaId) return null
  const canonicalLayers = normalizeCanvasAuthoredLayers(authoredLayers)
  const matchingAuthored = canonicalLayers.find(layer => layer.mediaId === nextMediaId)
  if (matchingAuthored) return { kind: 'authored', layerId: matchingAuthored.id }

  const canonicalPrimary = normalizeCanvasPrimaryLayerState(primaryLayer, canonicalLayers)
  if (canonicalPrimary?.kind === 'detached') {
    return {
      kind: 'detached',
      layer: { ...canonicalPrimary.layer, mediaId: nextMediaId, order: 0 },
    }
  }

  const created = normalizeCanvasAuthoredLayers([createDetachedLayer(nextMediaId)])[0] ?? null
  return created ? { kind: 'detached', layer: { ...created, order: 0 } } : null
}

export function getAvailableCanvasLayerEffects(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
): CanvasLayerEffectId[] {
  const layer = findCanvasLayerEffectOwner(authoredLayers, primaryLayer, layerId)
  if (!layer) return []
  const selected = new Set(layer.effects)
  return CANVAS_LAYER_EFFECT_IDS.filter(effect => !selected.has(effect))
}

type CanvasLayerEffectStateMutationResult =
  | {
      ok: true
      layer: CanvasAuthoredLayer
      authoredLayers: CanvasAuthoredLayer[]
      primaryLayer: CanvasPrimaryLayerState | null
    }
  | { ok: false; code: CanvasLayerEffectMutationFailureCode }

function findCanvasLayerEffectOwner(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
): CanvasAuthoredLayer | null {
  const id = typeof layerId === 'string' ? layerId.trim() : ''
  if (!id) return null
  const canonicalLayers = normalizeCanvasAuthoredLayers(authoredLayers)
  const authored = canonicalLayers.find(layer => layer.id === id)
  if (authored) return authored
  const canonicalPrimary = normalizeCanvasPrimaryLayerState(primaryLayer, canonicalLayers)
  return canonicalPrimary?.kind === 'detached' && canonicalPrimary.layer.id === id
    ? canonicalPrimary.layer
    : null
}

function mutateCanvasLayerEffects(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
  update: (effects: readonly CanvasLayerEffectId[]) => CanvasLayerEffectId[] | CanvasLayerEffectMutationFailureCode,
): CanvasLayerEffectStateMutationResult {
  const id = typeof layerId === 'string' ? layerId.trim() : ''
  const canonicalLayers = normalizeCanvasAuthoredLayers(authoredLayers)
  const canonicalPrimary = normalizeCanvasPrimaryLayerState(primaryLayer, canonicalLayers)
  const authoredIndex = canonicalLayers.findIndex(layer => layer.id === id)
  const target = authoredIndex >= 0
    ? canonicalLayers[authoredIndex]
    : canonicalPrimary?.kind === 'detached' && canonicalPrimary.layer.id === id
      ? canonicalPrimary.layer
      : null
  if (!target) return { ok: false, code: 'layer-not-found' }

  const nextEffects = update(target.effects)
  if (typeof nextEffects === 'string') return { ok: false, code: nextEffects }
  const layer = { ...target, effects: normalizeCanvasLayerEffects(nextEffects) }
  if (authoredIndex >= 0) {
    const nextLayers = [...canonicalLayers]
    nextLayers[authoredIndex] = layer
    return { ok: true, layer, authoredLayers: nextLayers, primaryLayer: canonicalPrimary }
  }
  return {
    ok: true,
    layer,
    authoredLayers: canonicalLayers,
    primaryLayer: { kind: 'detached', layer },
  }
}

export function addCanvasLayerEffectState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
  effectId: unknown,
): CanvasLayerEffectStateMutationResult {
  if (!isCanvasLayerEffectId(effectId)) return { ok: false, code: 'invalid-effect-id' }
  return mutateCanvasLayerEffects(authoredLayers, primaryLayer, layerId, effects => {
    if (effects.includes(effectId)) return 'duplicate-effect'
    if (effects.length >= MAX_CANVAS_LAYER_EFFECTS) return 'effect-limit-reached'
    return [...effects, effectId]
  })
}

export function setCanvasLayerEffectState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
  index: number,
  effectId: unknown,
): CanvasLayerEffectStateMutationResult {
  if (!isCanvasLayerEffectId(effectId)) return { ok: false, code: 'invalid-effect-id' }
  return mutateCanvasLayerEffects(authoredLayers, primaryLayer, layerId, effects => {
    if (!Number.isInteger(index) || index < 0 || index >= effects.length) return 'invalid-effect-index'
    if (effects[index] === effectId) return [...effects]
    if (effects.includes(effectId)) return 'duplicate-effect'
    const next = [...effects]
    next[index] = effectId
    return next
  })
}

export function removeCanvasLayerEffectAtState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
  index: number,
): CanvasLayerEffectStateMutationResult {
  return mutateCanvasLayerEffects(authoredLayers, primaryLayer, layerId, effects => {
    if (!Number.isInteger(index) || index < 0 || index >= effects.length) return 'invalid-effect-index'
    return effects.filter((_, effectIndex) => effectIndex !== index)
  })
}

export function removeCanvasLayerEffectState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
  effectId: unknown,
): CanvasLayerEffectStateMutationResult {
  if (!isCanvasLayerEffectId(effectId)) return { ok: false, code: 'invalid-effect-id' }
  return mutateCanvasLayerEffects(authoredLayers, primaryLayer, layerId, effects => (
    effects.includes(effectId) ? effects.filter(effect => effect !== effectId) : [...effects]
  ))
}

export function clearCanvasLayerEffectsState(
  authoredLayers: readonly CanvasAuthoredLayer[],
  primaryLayer: CanvasPrimaryLayerState | null,
  layerId: string,
): CanvasLayerEffectStateMutationResult {
  return mutateCanvasLayerEffects(authoredLayers, primaryLayer, layerId, () => [])
}

export function normalizeCanvasMediaPools(value: unknown): CanvasMediaPool[] {
  if (!Array.isArray(value)) return []
  const seenIds = new Set<string>()
  const pools: CanvasMediaPool[] = []
  for (const [index, raw] of value.entries()) {
    if (!isRecord(raw)) continue
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)
    const requestedName = typeof raw.name === 'string' ? raw.name.trim() : ''
    pools.push({
      id,
      name: requestedName || `Media Pool ${index + 1}`,
      mediaIds: normalizeCanvasMediaIds(raw.mediaIds),
    })
    if (pools.length >= MAX_CANVAS_MEDIA_POOLS) break
  }
  return pools
}

export function normalizeCanvasMediaPoolName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isCanvasMediaPoolNameAvailable(
  pools: readonly CanvasMediaPool[],
  name: unknown,
  exceptPoolId: string | null = null,
): boolean {
  const normalizedName = normalizeCanvasMediaPoolName(name)
  if (!normalizedName) return false
  const key = normalizedName.toLowerCase()
  return !normalizeCanvasMediaPools(pools).some(pool => (
    pool.id !== exceptPoolId && pool.name.trim().toLowerCase() === key
  ))
}

export function resolveActiveCanvasMediaPool(
  settings: Pick<NormalizedCanvasAuthoringState, 'mediaPools' | 'activeMediaPoolId'>,
): CanvasMediaPool | null {
  if (!settings.activeMediaPoolId) return null
  return settings.mediaPools.find(pool => pool.id === settings.activeMediaPoolId) ?? null
}

export interface NormalizedCanvasAuthoringState {
  authoredLayers: CanvasAuthoredLayer[]
  primaryLayer: CanvasPrimaryLayerState | null
  mediaPools: CanvasMediaPool[]
  activeMediaPoolId: string | null
  mediaPoolIds: string[]
}

/**
 * Normalizes the canonical authoring graph and performs the one-way legacy
 * migration from the historical flat mediaPoolIds list when no named pools exist.
 */
export function normalizeCanvasAuthoringState(source: Record<string, unknown>): NormalizedCanvasAuthoringState {
  const authoredLayers = normalizeCanvasAuthoredLayers(source.authoredLayers)
  const primaryLayer = normalizeCanvasPrimaryLayerState(source.primaryLayer, authoredLayers)
  const hasCanonicalPoolSchema = Object.prototype.hasOwnProperty.call(source, 'mediaPools')
  let mediaPools = normalizeCanvasMediaPools(source.mediaPools)
  let activeMediaPoolId = typeof source.activeMediaPoolId === 'string' && source.activeMediaPoolId.trim()
    ? source.activeMediaPoolId.trim()
    : null

  if (!mediaPools.some(pool => pool.id === activeMediaPoolId)) activeMediaPoolId = null

  if (!hasCanonicalPoolSchema && mediaPools.length === 0) {
    const legacyIds = normalizeCanvasMediaIds(source.mediaPoolIds)
    if (legacyIds.length > 0) {
      mediaPools = [{
        id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
        name: CANVAS_LEGACY_COMPATIBILITY_POOL_NAME,
        mediaIds: legacyIds,
      }]
      activeMediaPoolId = CANVAS_LEGACY_COMPATIBILITY_POOL_ID
    }
  }

  const mediaPoolIds = activeMediaPoolId
    ? mediaPools.find(pool => pool.id === activeMediaPoolId)?.mediaIds ?? []
    : []

  return { authoredLayers, primaryLayer, mediaPools, activeMediaPoolId, mediaPoolIds: [...mediaPoolIds] }
}

export function reorderCanvasAuthoredLayers(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
  targetIndex: number,
): CanvasAuthoredLayer[] | null {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  const sourceIndex = normalized.findIndex(layer => layer.id === layerId)
  if (sourceIndex < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= normalized.length) return null
  if (sourceIndex === targetIndex) return normalized
  const next = [...normalized]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next.map((layer, order) => ({ ...layer, order }))
}

/**
 * Applies the authoring-layer solo contract without rewriting enabled state.
 * CANVAS uses a deterministic single-solo model: enabling solo on one layer
 * clears solo from every other layer; disabling it simply clears that layer.
 */
export function setCanvasAuthoredLayerSoloState(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
  solo: boolean,
): CanvasAuthoredLayer[] | null {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  if (!normalized.some(layer => layer.id === layerId)) return null
  return normalized.map(layer => ({
    ...layer,
    solo: layer.id === layerId ? solo : (solo ? false : layer.solo),
  }))
}

/**
 * Canonical authored-stack eligibility rule. Keeping this rule domain-only
 * prevents authoring UI from inventing a parallel render path.
 */
export function resolveCanvasEffectiveAuthoredLayers(
  layers: readonly Pick<CanvasAuthoredLayer, 'id' | 'mediaId' | 'enabled' | 'solo'>[],
): CanvasAuthoredLayer[] {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  const activeSoloId = normalized.find(candidate => candidate.enabled && candidate.solo)?.id ?? null
  return normalized.filter(layer => layer.enabled && (activeSoloId === null || activeSoloId === layer.id))
}

export function isCanvasAuthoredLayerRenderEligible(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
): boolean {
  return resolveCanvasEffectiveAuthoredLayers(layers).some(layer => layer.id === layerId)
}

/**
 * Authored layers considered "active" for Layers-tab/Engine-scope structural
 * decisions (e.g. whether the CANVAS row shows, or a layer scope is valid) --
 * enabled state only, unlike resolveCanvasEffectiveAuthoredLayers, which also
 * narrows by Solo for the live renderer. Solo affects preview/output, not the
 * editing surface: soloing a layer must not restructure the Layers tab.
 */
export function resolveCanvasEnabledAuthoredLayers(
  layers: readonly CanvasAuthoredLayer[],
): CanvasAuthoredLayer[] {
  return normalizeCanvasAuthoredLayers(layers).filter(layer => layer.enabled)
}

/** True once any authored layer carries at least one Engine Display override. */
export function hasAnyCanvasLayerEngineOverrides(
  layers: readonly Pick<CanvasAuthoredLayer, 'engineOverrides'>[],
): boolean {
  return layers.some(layer => (
    layer.engineOverrides != null && Object.keys(layer.engineOverrides).length > 0
  ))
}

/**
 * Validates a requested Engine control scope against the current authored
 * layers. Layer scope requires the referenced layer to actually exist and
 * requires at least two enabled authored layers -- with fewer, CANVAS is not
 * shown as a selectable row at all, so layer scope has no meaning and Engine
 * editing stays Canvas/global (see Single-Layer Behavior).
 */
export function normalizeCanvasControlScope(
  value: unknown,
  authoredLayers: readonly CanvasAuthoredLayer[],
): CanvasControlScope {
  if (isRecord(value) && value.kind === 'layer') {
    const layerId = typeof value.layerId === 'string' ? value.layerId.trim() : ''
    if (
      layerId
      && resolveCanvasEnabledAuthoredLayers(authoredLayers).length >= 2
      && normalizeCanvasAuthoredLayers(authoredLayers).some(layer => layer.id === layerId)
    ) {
      return { kind: 'layer', layerId }
    }
  }
  return { kind: 'canvas' }
}

export type CanvasLayerEngineOverrideMutationResult =
  | { ok: true; layer: CanvasAuthoredLayer; authoredLayers: CanvasAuthoredLayer[] }
  | { ok: false; code: CanvasLayerMutationFailureCode }

/**
 * Merges a sparse patch into one layer's engineOverrides. Explicitly passing
 * `undefined` for a key clears just that field (back to inheriting the
 * Canvas baseline) without disturbing the layer's other overrides. Refuses
 * to create the layer's first override while fewer than two authored layers
 * are enabled, so Phase 2's editing UI cannot silently create an invisible
 * per-layer override in single-layer mode.
 */
export function updateCanvasLayerEngineOverridesState(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
  patch: Partial<CanvasLayerEngineOverrides>,
): CanvasLayerEngineOverrideMutationResult {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  const index = normalized.findIndex(layer => layer.id === layerId)
  if (index < 0) return { ok: false, code: 'layer-not-found' }
  if (resolveCanvasEnabledAuthoredLayers(normalized).length < 2) {
    return { ok: false, code: 'layer-scope-unavailable' }
  }
  const merged = normalizeCanvasLayerEngineOverrides({ ...normalized[index].engineOverrides, ...patch })
  const authoredLayers = [...normalized]
  authoredLayers[index] = { ...authoredLayers[index], engineOverrides: merged }
  return { ok: true, layer: authoredLayers[index], authoredLayers }
}

/** Clears one layer's Engine overrides, returning it to full inheritance. */
export function resetCanvasLayerEngineOverridesState(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
): CanvasLayerEngineOverrideMutationResult {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  const index = normalized.findIndex(layer => layer.id === layerId)
  if (index < 0) return { ok: false, code: 'layer-not-found' }
  if (!normalized[index].engineOverrides) return { ok: true, layer: normalized[index], authoredLayers: normalized }
  const authoredLayers = [...normalized]
  authoredLayers[index] = { ...authoredLayers[index], engineOverrides: undefined }
  return { ok: true, layer: authoredLayers[index], authoredLayers }
}

/**
 * Clears Engine overrides from every authored layer -- the CANVAS row's
 * reset/unlock action. The Canvas baseline (`canvasEngineSettings`) is never
 * touched; every layer simply goes back to inheriting it.
 */
export function resetAllCanvasLayerEngineOverridesState(
  layers: readonly CanvasAuthoredLayer[],
): CanvasAuthoredLayer[] {
  return normalizeCanvasAuthoredLayers(layers).map(layer => (
    layer.engineOverrides ? { ...layer, engineOverrides: undefined } : layer
  ))
}

export function upsertCanvasCompatibilityPool(
  pools: readonly CanvasMediaPool[],
  activeMediaPoolId: string | null,
  mediaIds: unknown,
): { mediaPools: CanvasMediaPool[]; activeMediaPoolId: string | null } {
  const normalizedPools = normalizeCanvasMediaPools(pools)
  const nextIds = normalizeCanvasMediaIds(mediaIds)
  const activeIndex = activeMediaPoolId
    ? normalizedPools.findIndex(pool => pool.id === activeMediaPoolId)
    : -1

  if (activeIndex >= 0) {
    return {
      mediaPools: normalizedPools.map((pool, index) => index === activeIndex ? { ...pool, mediaIds: nextIds } : pool),
      activeMediaPoolId,
    }
  }

  if (nextIds.length === 0) return { mediaPools: normalizedPools, activeMediaPoolId: null }

  const legacyIndex = normalizedPools.findIndex(pool => pool.id === CANVAS_LEGACY_COMPATIBILITY_POOL_ID)
  if (legacyIndex >= 0) {
    return {
      mediaPools: normalizedPools.map((pool, index) => index === legacyIndex ? { ...pool, mediaIds: nextIds } : pool),
      activeMediaPoolId: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
    }
  }

  return {
    mediaPools: [
      ...normalizedPools,
      {
        id: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
        name: CANVAS_LEGACY_COMPATIBILITY_POOL_NAME,
        mediaIds: nextIds,
      },
    ],
    activeMediaPoolId: CANVAS_LEGACY_COMPATIBILITY_POOL_ID,
  }
}

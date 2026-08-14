import {
  MAX_CANVAS_AUTHORED_LAYERS,
  type CanvasAuthoredLayer,
  type CanvasAuthoredLayerOwnership,
  type CanvasMediaPool,
} from './CanvasPerformanceTypes'

export const CANVAS_LEGACY_COMPATIBILITY_POOL_ID = 'canvas-pool-legacy'
export const CANVAS_LEGACY_COMPATIBILITY_POOL_NAME = 'Performance Pool'
export const MAX_CANVAS_MEDIA_POOLS = 64
export const MAX_CANVAS_MEDIA_IDS_PER_POOL = 128

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
      order: rawOrder,
      enabled: raw.enabled !== false,
      solo: raw.solo === true,
      ownership,
      pinned: typeof raw.pinned === 'boolean' ? raw.pinned : ownership === 'manual',
      sourceIndex,
    })
  }

  const ordered = candidates
    .sort((left, right) => left.order - right.order || left.sourceIndex - right.sourceIndex || left.id.localeCompare(right.id))
    .slice(0, MAX_CANVAS_AUTHORED_LAYERS)
    .map(({ sourceIndex: _sourceIndex, ...layer }, order) => ({ ...layer, order }))

  let soloClaimed = false
  return ordered.map(layer => {
    const solo = layer.solo && !soloClaimed
    if (solo) soloClaimed = true
    return solo === layer.solo ? layer : { ...layer, solo }
  })
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
  mediaPools: CanvasMediaPool[]
  activeMediaPoolId: string | null
  mediaPoolIds: string[]
}

/**
 * Normalizes the new canonical authoring graph and performs the one-way legacy
 * migration from the historical flat mediaPoolIds list when no named pools exist.
 */
export function normalizeCanvasAuthoringState(source: Record<string, unknown>): NormalizedCanvasAuthoringState {
  const authoredLayers = normalizeCanvasAuthoredLayers(source.authoredLayers)
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

  return { authoredLayers, mediaPools, activeMediaPoolId, mediaPoolIds: [...mediaPoolIds] }
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
 * Canonical Stage 3 eligibility rule for the authored stack. The production
 * compositor begins consuming authored layers in Stage 4; keeping this rule
 * domain-only prevents the authoring UI from inventing a parallel render path.
 */
export function isCanvasAuthoredLayerRenderEligible(
  layers: readonly CanvasAuthoredLayer[],
  layerId: string,
): boolean {
  const normalized = normalizeCanvasAuthoredLayers(layers)
  const layer = normalized.find(candidate => candidate.id === layerId)
  if (!layer?.enabled) return false
  const activeSoloId = normalized.find(candidate => candidate.enabled && candidate.solo)?.id ?? null
  return activeSoloId === null || activeSoloId === layer.id
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

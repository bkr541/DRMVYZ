import { create } from 'zustand'
import type { BrandKitAssetInsert, BrandKitAssetUpdate, BrandKitInsert } from '../../types/database'
import type {
  ActiveBrandKitData,
  ActiveBrandKitMetadata,
  BrandKit,
  BrandKitAssetWithMedia,
} from './BrandKitTypes'
import {
  addBrandKitAsset,
  brandKitToDbUpdate,
  clearActiveBrandKit,
  createBrandKit,
  deleteBrandKit,
  listBrandKitAssets,
  listBrandKits,
  loadActiveBrandKitData,
  removeBrandKitAsset,
  setActiveBrandKit,
  updateBrandKit,
  updateBrandKitAsset,
} from './brandKitDb'
import {
  DEFAULT_BRAND_PALETTE,
  clampStrength,
  normalizeBrandAssetRole,
  normalizeBrandKitEngineRules,
  normalizeBrandKitPresetRules,
  normalizeBrandPalette,
  normalizeBrandPaletteAnalysis,
  normalizePaletteExtractionMetadata,
} from './brandKitNormalization'

export const BRAND_KIT_CACHE_VERSION = 1
const CACHE_PREFIX = 'drmvyz-brand-kit-cache'
let initializationGeneration = 0

interface BrandKitCacheEnvelope {
  version: number
  userId: string
  active: ActiveBrandKitData | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function brandKitCacheKey(userId: string): string {
  return `${CACHE_PREFIX}:v${BRAND_KIT_CACHE_VERSION}:${userId}`
}

function normalizeCachedActive(value: unknown, userId: string): ActiveBrandKitData | null {
  if (!isRecord(value) || !isRecord(value.kit)) return null
  const rawKit = value.kit
  if (rawKit.userId !== userId || typeof rawKit.id !== 'string') return null
  const kit: BrandKit = {
    id: rawKit.id,
    userId,
    name: typeof rawKit.name === 'string' && rawKit.name.trim() ? rawKit.name.trim().slice(0, 120) : 'Brand Kit',
    palette: normalizeBrandPalette(rawKit.palette),
    extractedPalette: normalizeBrandPaletteAnalysis(rawKit.extractedPalette),
    extractionMetadata: normalizePaletteExtractionMetadata(rawKit.extractionMetadata),
    defaultStrength: clampStrength(rawKit.defaultStrength),
    engineRules: normalizeBrandKitEngineRules(rawKit.engineRules),
    presetRules: normalizeBrandKitPresetRules(rawKit.presetRules),
    useForAppAccent: rawKit.useForAppAccent === true,
    autoApply: rawKit.autoApply !== false,
    createdAt: typeof rawKit.createdAt === 'string' ? rawKit.createdAt : '',
    updatedAt: typeof rawKit.updatedAt === 'string' ? rawKit.updatedAt : '',
  }
  const assets = Array.isArray(value.assets)
    ? value.assets.flatMap(raw => {
        if (!isRecord(raw) || typeof raw.id !== 'string' || raw.brandKitId !== kit.id || typeof raw.mediaItemId !== 'string') return []
        if (raw.media !== null && raw.media !== undefined && !isRecord(raw.media)) return []
        const mediaRaw = isRecord(raw.media) ? raw.media : null
        if (mediaRaw && (typeof mediaRaw.id !== 'string' || (mediaRaw.userId !== userId && mediaRaw.userId !== null))) return []
        const asset: BrandKitAssetWithMedia = {
          id: raw.id,
          brandKitId: kit.id,
          mediaItemId: raw.mediaItemId,
          role: normalizeBrandAssetRole(raw.role),
          sortOrder: Math.max(0, Math.round(typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0)),
          isPaletteSource: raw.isPaletteSource === true,
          presentation: isRecord(raw.presentation) ? raw.presentation : null,
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
          media: mediaRaw ? {
            id: mediaRaw.id as string,
            userId: typeof mediaRaw.userId === 'string' ? mediaRaw.userId : null,
            name: typeof mediaRaw.name === 'string' ? mediaRaw.name : '',
            storagePath: typeof mediaRaw.storagePath === 'string' ? mediaRaw.storagePath : '',
            thumbnailPath: typeof mediaRaw.thumbnailPath === 'string' ? mediaRaw.thumbnailPath : null,
            mimeType: typeof mediaRaw.mimeType === 'string' ? mediaRaw.mimeType : null,
            mediaRole: typeof mediaRaw.mediaRole === 'string' ? mediaRaw.mediaRole : 'other',
            metadata: isRecord(mediaRaw.metadata) ? mediaRaw.metadata : {},
          } : null,
        }
        return [asset]
      })
    : []
  return { kit, assets }
}

export function readBrandKitCache(userId: string): ActiveBrandKitData | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(brandKitCacheKey(userId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== BRAND_KIT_CACHE_VERSION || parsed.userId !== userId) {
      localStorage.removeItem(brandKitCacheKey(userId))
      return null
    }
    return normalizeCachedActive(parsed.active, userId)
  } catch {
    try { localStorage.removeItem(brandKitCacheKey(userId)) } catch { /* non-fatal cache cleanup */ }
    return null
  }
}

function isTransientCacheKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z]/g, '')
  return normalized === 'url' || normalized === 'signedurl' || normalized === 'objecturl' || normalized === 'previewurl'
}

function cacheSafeValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) {
    return value.flatMap(entry => {
      const safe = cacheSafeValue(entry)
      return safe === undefined ? [] : [safe]
    })
  }
  if (!isRecord(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return undefined
  }
  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (isTransientCacheKey(key)) continue
    const safe = cacheSafeValue(entry)
    if (safe !== undefined) output[key] = safe
  }
  return output
}

function cacheSafeRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
  const safe = cacheSafeValue(value)
  return isRecord(safe) ? safe : null
}

function toCacheSafeActive(active: ActiveBrandKitData | null): ActiveBrandKitData | null {
  if (!active) return null
  return {
    kit: {
      id: active.kit.id,
      userId: active.kit.userId,
      name: active.kit.name,
      palette: { ...active.kit.palette },
      extractedPalette: active.kit.extractedPalette ? {
        swatches: active.kit.extractedPalette.swatches.map(swatch => ({ ...swatch })),
        candidates: {
          faithful: { ...active.kit.extractedPalette.candidates.faithful },
          stageVibrant: { ...active.kit.extractedPalette.candidates.stageVibrant },
          highContrast: { ...active.kit.extractedPalette.candidates.highContrast },
        },
        metadata: { ...active.kit.extractedPalette.metadata, warnings: [...active.kit.extractedPalette.metadata.warnings] },
      } : null,
      extractionMetadata: active.kit.extractionMetadata
        ? { ...active.kit.extractionMetadata, warnings: [...active.kit.extractionMetadata.warnings] }
        : null,
      defaultStrength: active.kit.defaultStrength,
      engineRules: normalizeBrandKitEngineRules(active.kit.engineRules),
      presetRules: normalizeBrandKitPresetRules(active.kit.presetRules),
      useForAppAccent: active.kit.useForAppAccent,
      autoApply: active.kit.autoApply,
      createdAt: active.kit.createdAt,
      updatedAt: active.kit.updatedAt,
    },
    assets: active.assets.map(asset => ({
      id: asset.id,
      brandKitId: asset.brandKitId,
      mediaItemId: asset.mediaItemId,
      role: asset.role,
      sortOrder: asset.sortOrder,
      isPaletteSource: asset.isPaletteSource,
      presentation: cacheSafeRecord(asset.presentation),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      media: asset.media ? {
        id: asset.media.id,
        userId: asset.media.userId,
        name: asset.media.name,
        storagePath: asset.media.storagePath,
        thumbnailPath: asset.media.thumbnailPath,
        mimeType: asset.media.mimeType,
        mediaRole: asset.media.mediaRole,
        metadata: cacheSafeRecord(asset.media.metadata) ?? {},
      } : null,
    })),
  }
}

export function writeBrandKitCache(userId: string, active: ActiveBrandKitData | null): void {
  if (typeof localStorage === 'undefined') return
  const envelope: BrandKitCacheEnvelope = {
    version: BRAND_KIT_CACHE_VERSION,
    userId,
    active: toCacheSafeActive(active),
  }
  try {
    localStorage.setItem(brandKitCacheKey(userId), JSON.stringify(envelope))
  } catch {
    // The network-backed state remains authoritative when local storage is unavailable or full.
  }
}

export function clearBrandKitCache(userId: string): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(brandKitCacheKey(userId)) } catch { /* non-fatal cache cleanup */ }
}

interface BrandKitState {
  currentUserId: string | null
  kits: BrandKit[]
  activeKit: BrandKit | null
  activeAssets: BrandKitAssetWithMedia[]
  assetsByKitId: Record<string, BrandKitAssetWithMedia[]>
  loadingAssetsForKitId: string | null
  activeMetadata: ActiveBrandKitMetadata
  loading: boolean
  syncing: boolean
  error: string | null
  usingCachedActiveKit: boolean

  initializeForUser(userId: string): Promise<void>
  clearForSignedOut(): void
  refresh(): Promise<void>
  loadAssetsForKit(kitId: string): Promise<BrandKitAssetWithMedia[]>
  createKit(input: Omit<BrandKitInsert, 'user_id'>): Promise<BrandKit | null>
  updateKit(id: string, patch: Partial<BrandKit>): Promise<BrandKit | null>
  deleteKit(id: string): Promise<boolean>
  activateKit(id: string | null): Promise<boolean>
  addAsset(input: BrandKitAssetInsert): Promise<BrandKitAssetWithMedia | null>
  updateAsset(id: string, update: BrandKitAssetUpdate): Promise<BrandKitAssetWithMedia | null>
  removeAsset(id: string): Promise<boolean>
  clearError(): void
}

function cacheActiveState(userId: string, kit: BrandKit | null, assets: BrandKitAssetWithMedia[]): void {
  writeBrandKitCache(userId, kit ? { kit, assets } : null)
}

export const useBrandKitStore = create<BrandKitState>((set, get) => ({
  currentUserId: null,
  kits: [],
  activeKit: null,
  activeAssets: [],
  assetsByKitId: {},
  loadingAssetsForKitId: null,
  activeMetadata: { activeKitId: null, source: 'none', loadedAt: null, lastSyncedAt: null },
  loading: false,
  syncing: false,
  error: null,
  usingCachedActiveKit: false,

  async initializeForUser(userId) {
    const generation = ++initializationGeneration
    const changedUser = get().currentUserId !== userId
    const cached = readBrandKitCache(userId)
    if (changedUser) {
      set({
        currentUserId: userId,
        kits: cached?.kit ? [cached.kit] : [],
        activeKit: cached?.kit ?? null,
        activeAssets: cached?.assets ?? [],
        assetsByKitId: cached?.kit ? { [cached.kit.id]: cached.assets } : {},
        loadingAssetsForKitId: null,
        activeMetadata: {
          activeKitId: cached?.kit.id ?? null,
          source: cached ? 'localCache' : 'none',
          loadedAt: cached ? new Date().toISOString() : null,
          lastSyncedAt: null,
        },
        loading: true,
        syncing: true,
        error: null,
        usingCachedActiveKit: Boolean(cached),
      })
    } else {
      set({ loading: true, syncing: true, error: null })
    }

    const [kitsResult, activeResult] = await Promise.all([
      listBrandKits(userId),
      loadActiveBrandKitData(userId),
    ])
    if (get().currentUserId !== userId || generation !== initializationGeneration) return

    const error = kitsResult.error ?? activeResult.error
    if (error) {
      set({ loading: false, syncing: false, error, usingCachedActiveKit: Boolean(get().activeKit) })
      return
    }

    const active = activeResult.value
    cacheActiveState(userId, active?.kit ?? null, active?.assets ?? [])
    set({
      kits: kitsResult.rows,
      activeKit: active?.kit ?? null,
      activeAssets: active?.assets ?? [],
      assetsByKitId: active?.kit ? { ...get().assetsByKitId, [active.kit.id]: active.assets } : get().assetsByKitId,
      loadingAssetsForKitId: null,
      activeMetadata: {
        activeKitId: active?.kit.id ?? null,
        source: 'database',
        loadedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      },
      loading: false,
      syncing: false,
      error: null,
      usingCachedActiveKit: false,
    })
  },

  clearForSignedOut() {
    initializationGeneration += 1
    set({
      currentUserId: null,
      kits: [],
      activeKit: null,
      activeAssets: [],
      assetsByKitId: {},
      loadingAssetsForKitId: null,
      activeMetadata: { activeKitId: null, source: 'none', loadedAt: null, lastSyncedAt: null },
      loading: false,
      syncing: false,
      error: null,
      usingCachedActiveKit: false,
    })
  },

  async refresh() {
    const userId = get().currentUserId
    if (userId) await get().initializeForUser(userId)
  },

  async loadAssetsForKit(kitId) {
    const existing = get().assetsByKitId[kitId]
    if (existing) return existing
    set({ loadingAssetsForKitId: kitId, error: null })
    const result = await listBrandKitAssets(kitId)
    if (get().loadingAssetsForKitId !== kitId) return get().assetsByKitId[kitId] ?? []
    if (result.error) {
      set({ loadingAssetsForKitId: null, error: result.error })
      return []
    }
    set(state => ({
      assetsByKitId: { ...state.assetsByKitId, [kitId]: result.rows },
      loadingAssetsForKitId: null,
    }))
    return result.rows
  },

  async createKit(input) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return null }
    set({ syncing: true, error: null })
    const payload = {
      name: input.name,
      palette: input.palette ?? { ...DEFAULT_BRAND_PALETTE },
      extracted_palette: input.extracted_palette ?? {},
      extraction_metadata: input.extraction_metadata ?? {},
      default_strength: clampStrength(input.default_strength),
      engine_rules: input.engine_rules ?? {},
      preset_rules: input.preset_rules ?? {},
      use_for_app_accent: input.use_for_app_accent ?? false,
      auto_apply: input.auto_apply ?? true,
    }
    const result = await createBrandKit(userId, payload)
    if (get().currentUserId !== userId) return null
    if (result.error || !result.value) { set({ syncing: false, error: result.error ?? 'Brand Kit creation failed' }); return null }
    set(state => ({ kits: [result.value!, ...state.kits], syncing: false }))
    return result.value
  },

  async updateKit(id, patch) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return null }
    set({ syncing: true, error: null })
    const result = await updateBrandKit(id, userId, brandKitToDbUpdate(patch))
    if (get().currentUserId !== userId) return null
    if (result.error || !result.value) { set({ syncing: false, error: result.error ?? 'Brand Kit update failed' }); return null }
    set(state => {
      const updatedActiveKit = state.activeKit?.id === id
      const activeKit = updatedActiveKit ? result.value! : state.activeKit
      if (activeKit) cacheActiveState(userId, activeKit, state.activeAssets)
      const syncedAt = new Date().toISOString()
      return {
        kits: state.kits.map(kit => kit.id === id ? result.value! : kit),
        activeKit,
        activeMetadata: updatedActiveKit
          ? { activeKitId: activeKit?.id ?? null, source: 'database', loadedAt: syncedAt, lastSyncedAt: syncedAt }
          : state.activeMetadata,
        syncing: false,
      }
    })
    return result.value
  },

  async deleteKit(id) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return false }
    set({ syncing: true, error: null })
    const result = await deleteBrandKit(id, userId)
    if (get().currentUserId !== userId) return false
    if (result.error) { set({ syncing: false, error: result.error }); return false }
    set(state => {
      const wasActive = state.activeKit?.id === id
      if (wasActive) cacheActiveState(userId, null, [])
      const assetsByKitId = { ...state.assetsByKitId }
      delete assetsByKitId[id]
      return {
        kits: state.kits.filter(kit => kit.id !== id),
        activeKit: wasActive ? null : state.activeKit,
        activeAssets: wasActive ? [] : state.activeAssets,
        assetsByKitId,
        activeMetadata: wasActive
          ? { activeKitId: null, source: 'database', loadedAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() }
          : state.activeMetadata,
        syncing: false,
      }
    })
    return true
  },

  async activateKit(id) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return false }
    set({ syncing: true, error: null })
    const result = id ? await setActiveBrandKit(userId, id) : await clearActiveBrandKit(userId)
    if (get().currentUserId !== userId) return false
    if (result.error) { set({ syncing: false, error: result.error }); return false }
    if (!id) {
      cacheActiveState(userId, null, [])
      set({
        activeKit: null,
        activeAssets: [],
        activeMetadata: { activeKitId: null, source: 'database', loadedAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() },
        syncing: false,
        usingCachedActiveKit: false,
      })
      return true
    }
    const activeResult = await loadActiveBrandKitData(userId)
    if (get().currentUserId !== userId) return false
    if (activeResult.error || !activeResult.value) {
      set({ syncing: false, error: activeResult.error ?? 'Active Brand Kit could not be loaded' })
      return false
    }
    cacheActiveState(userId, activeResult.value.kit, activeResult.value.assets)
    set({
      activeKit: activeResult.value.kit,
      activeAssets: activeResult.value.assets,
      assetsByKitId: { ...get().assetsByKitId, [activeResult.value.kit.id]: activeResult.value.assets },
      activeMetadata: { activeKitId: activeResult.value.kit.id, source: 'database', loadedAt: new Date().toISOString(), lastSyncedAt: new Date().toISOString() },
      syncing: false,
      usingCachedActiveKit: false,
    })
    return true
  },

  async addAsset(input) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return null }
    set({ syncing: true, error: null })
    const result = await addBrandKitAsset(input)
    if (get().currentUserId !== userId) return null
    if (result.error || !result.value) { set({ syncing: false, error: result.error ?? 'Brand asset link failed' }); return null }
    set(state => {
      const updatesActiveKit = state.activeKit?.id === input.brand_kit_id
      const activeAssets = updatesActiveKit
        ? [...state.activeAssets, result.value!].sort((a, b) => a.sortOrder - b.sortOrder)
        : state.activeAssets
      if (state.activeKit) cacheActiveState(userId, state.activeKit, activeAssets)
      const syncedAt = new Date().toISOString()
      const kitAssets = [...(state.assetsByKitId[input.brand_kit_id] ?? []), result.value!]
        .filter((asset, index, all) => all.findIndex(candidate => candidate.id === asset.id) === index)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      return {
        activeAssets,
        assetsByKitId: { ...state.assetsByKitId, [input.brand_kit_id]: kitAssets },
        activeMetadata: updatesActiveKit
          ? { ...state.activeMetadata, source: 'database', loadedAt: syncedAt, lastSyncedAt: syncedAt }
          : state.activeMetadata,
        syncing: false,
      }
    })
    return result.value
  },

  async updateAsset(id, update) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return null }
    set({ syncing: true, error: null })
    const result = await updateBrandKitAsset(id, update)
    if (get().currentUserId !== userId) return null
    if (result.error || !result.value) { set({ syncing: false, error: result.error ?? 'Brand asset update failed' }); return null }
    set(state => {
      const updatesActiveKit = state.activeAssets.some(asset => asset.id === id)
      const activeAssets = state.activeAssets.map(asset => asset.id === id ? result.value! : asset).sort((a, b) => a.sortOrder - b.sortOrder)
      const kitId = result.value!.brandKitId
      const kitAssets = (state.assetsByKitId[kitId] ?? []).map(asset => asset.id === id ? result.value! : asset).sort((a, b) => a.sortOrder - b.sortOrder)
      if (state.activeKit) cacheActiveState(userId, state.activeKit, activeAssets)
      const syncedAt = new Date().toISOString()
      return {
        activeAssets,
        assetsByKitId: { ...state.assetsByKitId, [kitId]: kitAssets },
        activeMetadata: updatesActiveKit
          ? { ...state.activeMetadata, source: 'database', loadedAt: syncedAt, lastSyncedAt: syncedAt }
          : state.activeMetadata,
        syncing: false,
      }
    })
    return result.value
  },

  async removeAsset(id) {
    const userId = get().currentUserId
    if (!userId) { set({ error: 'No authenticated user' }); return false }
    set({ syncing: true, error: null })
    const result = await removeBrandKitAsset(id)
    if (get().currentUserId !== userId) return false
    if (result.error) { set({ syncing: false, error: result.error }); return false }
    set(state => {
      const linkedAsset = state.activeAssets.find(asset => asset.id === id)
        ?? Object.values(state.assetsByKitId).flat().find(asset => asset.id === id)
      const updatesActiveKit = state.activeAssets.some(asset => asset.id === id)
      const activeAssets = state.activeAssets.filter(asset => asset.id !== id)
      const assetsByKitId = linkedAsset ? {
        ...state.assetsByKitId,
        [linkedAsset.brandKitId]: (state.assetsByKitId[linkedAsset.brandKitId] ?? []).filter(asset => asset.id !== id),
      } : state.assetsByKitId
      if (state.activeKit) cacheActiveState(userId, state.activeKit, activeAssets)
      const syncedAt = new Date().toISOString()
      return {
        activeAssets,
        assetsByKitId,
        activeMetadata: updatesActiveKit
          ? { ...state.activeMetadata, source: 'database', loadedAt: syncedAt, lastSyncedAt: syncedAt }
          : state.activeMetadata,
        syncing: false,
      }
    })
    return true
  },

  clearError() { set({ error: null }) },
}))

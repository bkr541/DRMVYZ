import type { Json } from '../../types/database'
import type {
  ActiveBrandKitData,
  BrandAssetRole,
  BrandKit,
  BrandKitAssetWithMedia,
  BrandKitEngineRule,
  BrandKitEngineRules,
  BrandKitEngineTarget,
  BrandKitPresetRules,
  BrandPalette,
  BrandPaletteAnalysis,
  PaletteExtractionMetadata,
} from './BrandKitTypes'
import {
  BRAND_ASSET_ROLES,
  BRAND_PERSONALIZATION_MODES,
} from './BrandKitTypes'
import { normalizeHexColor } from './paletteColorSpace'

const ENGINE_TARGETS = new Set<BrandKitEngineTarget>([
  'shaderPads', 'cinematicPortal', 'oscilloscope', 'laserDmx', 'neonLattice', 'reactiveConstellation',
])

export const DEFAULT_BRAND_PALETTE: BrandPalette = {
  primary: '#19BFF2',
  secondary: '#7C5CFC',
  accent: '#00E0A4',
  background: '#080B12',
  highlight: '#FFFFFF',
  text: '#FFFFFF',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clampStrength(value: unknown, fallback = 0.75): number {
  return Math.max(0, Math.min(1, finiteNumber(value, fallback)))
}

export function normalizeBrandPalette(value: unknown, fallback = DEFAULT_BRAND_PALETTE): BrandPalette {
  const input = isRecord(value) ? value : {}
  return {
    primary: normalizeHexColor(input.primary, fallback.primary),
    secondary: normalizeHexColor(input.secondary, fallback.secondary),
    accent: normalizeHexColor(input.accent, fallback.accent),
    background: normalizeHexColor(input.background, fallback.background),
    highlight: normalizeHexColor(input.highlight, fallback.highlight),
    text: normalizeHexColor(input.text, fallback.text),
  }
}

export function normalizeEngineRule(value: unknown): BrandKitEngineRule {
  const input = isRecord(value) ? value : {}
  const mode = BRAND_PERSONALIZATION_MODES.includes(input.mode as never)
    ? input.mode as BrandKitEngineRule['mode']
    : 'hybrid'
  return {
    mode,
    strength: clampStrength(input.strength),
    ...(input.customPalette ? { customPalette: normalizeBrandPalette(input.customPalette) } : {}),
  }
}

export function normalizeBrandKitEngineRules(value: unknown): BrandKitEngineRules {
  if (!isRecord(value)) return {}
  const rules: BrandKitEngineRules = {}
  for (const [key, rule] of Object.entries(value)) {
    if (!ENGINE_TARGETS.has(key as BrandKitEngineTarget)) continue
    rules[key as BrandKitEngineTarget] = normalizeEngineRule(rule)
  }
  return rules
}

export function normalizeBrandKitPresetRules(value: unknown): BrandKitPresetRules {
  if (!isRecord(value)) return {}
  const result: BrandKitPresetRules = {}
  for (const [presetId, raw] of Object.entries(value)) {
    if (!presetId.trim() || !isRecord(raw)) continue
    const mode = BRAND_PERSONALIZATION_MODES.includes(raw.mode as never)
      ? raw.mode as NonNullable<BrandKitPresetRules[string]['mode']>
      : undefined
    result[presetId] = {
      ...(mode ? { mode } : {}),
      ...(typeof raw.strength === 'number' ? { strength: clampStrength(raw.strength) } : {}),
      ...(raw.palette ? { palette: normalizeBrandPalette(raw.palette) } : {}),
      ...(typeof raw.enabled === 'boolean' ? { enabled: raw.enabled } : {}),
    }
  }
  return result
}

export function normalizePaletteExtractionMetadata(value: unknown): PaletteExtractionMetadata | null {
  if (!isRecord(value) || typeof value.algorithmVersion !== 'string') return null
  return {
    algorithmVersion: value.algorithmVersion,
    analyzedAt: typeof value.analyzedAt === 'string' ? value.analyzedAt : new Date(0).toISOString(),
    sourceWidth: Math.max(0, Math.round(finiteNumber(value.sourceWidth, 0))),
    sourceHeight: Math.max(0, Math.round(finiteNumber(value.sourceHeight, 0))),
    sampledPixels: Math.max(0, Math.round(finiteNumber(value.sampledPixels, 0))),
    ignoredTransparentPixels: Math.max(0, Math.round(finiteNumber(value.ignoredTransparentPixels, 0))),
    isMonochrome: value.isMonochrome === true,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((entry): entry is string => typeof entry === 'string').slice(0, 20) : [],
  }
}

export function normalizeBrandPaletteAnalysis(value: unknown): BrandPaletteAnalysis | null {
  if (!isRecord(value)) return null
  const metadata = normalizePaletteExtractionMetadata(value.metadata)
  if (!metadata) return null
  const swatches = Array.isArray(value.swatches)
    ? value.swatches.flatMap(raw => {
        if (!isRecord(raw)) return []
        return [{
          hex: normalizeHexColor(raw.hex, '#000000'),
          weight: clampStrength(raw.weight, 0),
          population: Math.max(0, Math.round(finiteNumber(raw.population, 0))),
          chroma: Math.max(0, finiteNumber(raw.chroma, 0)),
        }]
      }).slice(0, 16)
    : []
  const candidates = isRecord(value.candidates) ? value.candidates : {}
  return {
    swatches,
    candidates: {
      faithful: normalizeBrandPalette(candidates.faithful),
      stageVibrant: normalizeBrandPalette(candidates.stageVibrant),
      highContrast: normalizeBrandPalette(candidates.highContrast),
    },
    metadata,
  }
}

export interface BrandKitDbLike {
  id: string
  user_id: string
  name: string
  palette: Json
  extracted_palette: Json
  extraction_metadata: Json
  default_strength: number
  engine_rules: Json
  preset_rules: Json
  use_for_app_accent: boolean
  auto_apply: boolean
  created_at: string
  updated_at: string
}

export function normalizeBrandKitRow(row: BrandKitDbLike): BrandKit {
  const analysis = normalizeBrandPaletteAnalysis(row.extracted_palette)
  return {
    id: row.id,
    userId: row.user_id,
    name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 120) : 'Brand Kit',
    palette: normalizeBrandPalette(row.palette),
    extractedPalette: analysis,
    extractionMetadata: normalizePaletteExtractionMetadata(row.extraction_metadata) ?? analysis?.metadata ?? null,
    defaultStrength: clampStrength(row.default_strength),
    engineRules: normalizeBrandKitEngineRules(row.engine_rules),
    presetRules: normalizeBrandKitPresetRules(row.preset_rules),
    useForAppAccent: row.use_for_app_accent === true,
    autoApply: row.auto_apply !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function normalizeBrandAssetRole(value: unknown): BrandAssetRole {
  return BRAND_ASSET_ROLES.includes(value as BrandAssetRole) ? value as BrandAssetRole : 'paletteSource'
}

export function normalizeBrandKitAssetRow(row: Record<string, unknown>): BrandKitAssetWithMedia | null {
  if (typeof row.id !== 'string' || typeof row.brand_kit_id !== 'string' || typeof row.media_item_id !== 'string') return null
  const mediaRaw = isRecord(row.media_items) ? row.media_items : null
  return {
    id: row.id,
    brandKitId: row.brand_kit_id,
    mediaItemId: row.media_item_id,
    role: normalizeBrandAssetRole(row.asset_role),
    sortOrder: Math.max(0, Math.round(finiteNumber(row.sort_order, 0))),
    isPaletteSource: row.is_palette_source === true,
    presentation: isRecord(row.presentation) ? row.presentation : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : '',
    media: mediaRaw && typeof mediaRaw.id === 'string' ? {
      id: mediaRaw.id,
      userId: typeof mediaRaw.user_id === 'string' ? mediaRaw.user_id : null,
      name: typeof mediaRaw.name === 'string' ? mediaRaw.name : '',
      storagePath: typeof mediaRaw.storage_path === 'string' ? mediaRaw.storage_path : '',
      thumbnailPath: typeof mediaRaw.thumbnail_path === 'string' ? mediaRaw.thumbnail_path : null,
      mimeType: typeof mediaRaw.mime_type === 'string' ? mediaRaw.mime_type : null,
      mediaRole: typeof mediaRaw.media_role === 'string' ? mediaRaw.media_role : 'other',
      metadata: isRecord(mediaRaw.metadata) ? mediaRaw.metadata : {},
    } : null,
  }
}

export function normalizeActiveBrandKitData(value: unknown, userId: string): ActiveBrandKitData | null {
  if (!isRecord(value) || !isRecord(value.kit)) return null
  const rawKit = value.kit as unknown as BrandKitDbLike
  if (rawKit.user_id !== userId) return null
  const kit = normalizeBrandKitRow(rawKit)
  const assets = Array.isArray(value.assets)
    ? value.assets.map(raw => isRecord(raw) ? normalizeBrandKitAssetRow(raw) : null).filter((asset): asset is BrandKitAssetWithMedia => asset !== null)
    : []
  return { kit, assets }
}

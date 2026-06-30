import type { ReactEngineId, ReactPalette } from '../../components/vyzualz/react/ReactTypes'

export const BRAND_PALETTE_ROLES = ['primary', 'secondary', 'accent', 'background', 'highlight', 'text'] as const
export type BrandPaletteRole = typeof BRAND_PALETTE_ROLES[number]
export type BrandPalette = ReactPalette

export const BRAND_PALETTE_CANDIDATE_IDS = ['faithful', 'stageVibrant', 'highContrast'] as const
export type BrandPaletteCandidateId = typeof BRAND_PALETTE_CANDIDATE_IDS[number]

export const BRAND_ASSET_ROLES = [
  'primaryLogo', 'secondaryLogo', 'wordmark', 'monogram', 'keyArt',
  'watermark', 'texture', 'background', 'paletteSource',
] as const
export type BrandAssetRole = typeof BRAND_ASSET_ROLES[number]

export const BRAND_PERSONALIZATION_MODES = ['original', 'hybrid', 'brand', 'custom'] as const
export type BrandPersonalizationMode = typeof BRAND_PERSONALIZATION_MODES[number]

export type BrandKitEngineTarget = ReactEngineId | 'reactiveConstellation'

export interface ExtractedColorSwatch {
  hex: string
  weight: number
  population: number
  chroma: number
}

export interface BrandPaletteCandidate {
  id: BrandPaletteCandidateId
  palette: BrandPalette
}

export interface PaletteExtractionMetadata {
  algorithmVersion: string
  analyzedAt: string
  sourceWidth: number
  sourceHeight: number
  sampledPixels: number
  ignoredTransparentPixels: number
  isMonochrome: boolean
  warnings: string[]
}

export interface BrandPaletteAnalysis {
  swatches: ExtractedColorSwatch[]
  candidates: Record<BrandPaletteCandidateId, BrandPalette>
  metadata: PaletteExtractionMetadata
}

export interface BrandKitEngineRule {
  mode: BrandPersonalizationMode
  strength: number
  customPalette?: BrandPalette
}

export type BrandKitEngineRules = Partial<Record<BrandKitEngineTarget, BrandKitEngineRule>>

export interface BrandKitPresetRule {
  mode?: BrandPersonalizationMode
  strength?: number
  palette?: BrandPalette
  enabled?: boolean
}

export type BrandKitPresetRules = Record<string, BrandKitPresetRule>

export interface BrandKit {
  id: string
  userId: string
  name: string
  palette: BrandPalette
  extractedPalette: BrandPaletteAnalysis | null
  extractionMetadata: PaletteExtractionMetadata | null
  defaultStrength: number
  engineRules: BrandKitEngineRules
  presetRules: BrandKitPresetRules
  useForAppAccent: boolean
  autoApply: boolean
  createdAt: string
  updatedAt: string
}

export interface BrandKitAssetLink {
  id: string
  brandKitId: string
  mediaItemId: string
  role: BrandAssetRole
  sortOrder: number
  isPaletteSource: boolean
  presentation: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface BrandKitAssetWithMedia extends BrandKitAssetLink {
  media: {
    id: string
    userId: string | null
    name: string
    storagePath: string
    thumbnailPath: string | null
    mimeType: string | null
    mediaRole: string
    metadata: Record<string, unknown>
  } | null
}

export interface ActiveBrandKitData {
  kit: BrandKit
  assets: BrandKitAssetWithMedia[]
}

export interface ActiveBrandKitMetadata {
  activeKitId: string | null
  source: 'none' | 'database' | 'localCache'
  loadedAt: string | null
  lastSyncedAt: string | null
}

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

export const LASER_DMX_SEMANTIC_SOURCES = ['bass', 'snare', 'beat', 'other', 'white'] as const
export type LaserDmxSemanticSource = typeof LASER_DMX_SEMANTIC_SOURCES[number]

export interface BrandKitEngineRule {
  mode: BrandPersonalizationMode
  strength: number
  customPalette?: BrandPalette
  /** LaserDMX only. Keeps kick/snare/pulse/fill distinctions recognizable. */
  preserveTriggerSemantics?: boolean
  /** Optional LaserDMX semantic source to palette-role remapping. */
  semanticRoleMapping?: Partial<Record<LaserDmxSemanticSource, BrandPaletteRole>>
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

export const BRAND_ASSET_PLACEMENTS = [
  'top-left', 'top-center', 'top-right', 'center',
  'bottom-left', 'bottom-center', 'bottom-right',
] as const
export type BrandAssetPlacement = typeof BRAND_ASSET_PLACEMENTS[number]

export const BRAND_ASSET_BLEND_MODES = ['source-over', 'screen', 'multiply', 'overlay', 'lighter'] as const
export type BrandAssetBlendMode = typeof BRAND_ASSET_BLEND_MODES[number]

export const BRAND_ASSET_VISIBILITY_MODES = ['always', 'introOnly', 'outroOnly'] as const
export type BrandAssetVisibilityMode = typeof BRAND_ASSET_VISIBILITY_MODES[number]

export const BRAND_ASSET_GLOW_MODES = ['none', 'static', 'audioReactive'] as const
export type BrandAssetGlowMode = typeof BRAND_ASSET_GLOW_MODES[number]

export interface BrandAssetPresentation {
  enabled: boolean
  placement: BrandAssetPlacement
  scale: number
  opacity: number
  margin: number
  blendMode: BrandAssetBlendMode
  glowMode: BrandAssetGlowMode
  visibility: BrandAssetVisibilityMode
  preserveOriginalColors: boolean
}

export interface BrandKitAssetLink {
  id: string
  brandKitId: string
  mediaItemId: string
  role: BrandAssetRole
  sortOrder: number
  isPaletteSource: boolean
  presentation: BrandAssetPresentation | null
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

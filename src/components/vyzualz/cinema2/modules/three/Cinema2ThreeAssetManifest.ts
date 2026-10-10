import { CINEMA2_ASSET_RECORDS, type Cinema2AssetId } from '../../assets/Cinema2AssetManifest.generated'
import { Cinema2ThreeAssetRegistry } from './Cinema2ThreeAssetRegistry'

export const CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID: Cinema2AssetId = 'cinema2-reference-torus-knot'
/** The owner's DVYDRM logo as a 3D model with two parts (nodes `outline`, `crystal`); shared by every logo preset. */
export const CINEMA2_DVYDRM_LOGO_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo'
/** The cut-crystal variant of the logo (same parts, `outline` and `crystal`, with a faceted crystal body): RELIQUARY's clear crystal. */
export const CINEMA2_DVYDRM_LOGO_FACETED_ASSET_ID: Cinema2AssetId = 'cinema2-dvydrm-logo-faceted'
/** The golden tree that holds the logo in RELIQUARY: parts (materials) `roots`, `veins`, `leaves`, each vertex with a `_GLOW_PHASE`. */
export const CINEMA2_GOLDEN_ROOTS_ASSET_ID: Cinema2AssetId = 'cinema2-golden-roots'
/** RELIQUARY's flanking forest: dark bark trees wrapped in gold vines. Parts (materials) `bark`, `vines`, `buds`, each vertex with a `_GLOW_PHASE`. */
export const CINEMA2_RELIQUARY_TREES_ASSET_ID: Cinema2AssetId = 'cinema2-reliquary-trees'
/** CONDUIT's DVYDRM wordmark: parts `outline`, `letters`, `plate`, `rim` (emissive edge glow); vertices carry `_GLOW_PHASE` and `_SEGMENT`. */
export const CINEMA2_CONDUIT_WORDMARK_ASSET_ID: Cinema2AssetId = 'cinema2-conduit-wordmark'
/** CONDUIT's four energy tubes: parts `pipe`, `channel`, `flange`, `coupler`, `energy` (emissive windows); vertices carry `_GLOW_PHASE` and `_SEGMENT`. */
export const CINEMA2_CONDUIT_TUBES_ASSET_ID: Cinema2AssetId = 'cinema2-conduit-tubes'
/** CONDUIT's chamber: parts `shell`, `trim`, `floorTrim`, `segments` (95 emissive LED strips in 8 groups); vertices carry `_GLOW_PHASE` and `_SEGMENT`. */
export const CINEMA2_CONDUIT_CHAMBER_ASSET_ID: Cinema2AssetId = 'cinema2-conduit-chamber'
/** ATMOSPHERE REFERENCE's four cracked rock monoliths: parts (materials) `back`, `center`, `left`, `right`, placed in world coordinates on the preset's floor (y -1.2). */
export const CINEMA2_ATMOSPHERE_MONOLITHS_ASSET_ID: Cinema2AssetId = 'cinema2-atmosphere-monoliths'
/** ATL HOE's complete modeled night scene: Waffle House sign, Atlanta landmark skyline, freeway, stars and foreground canopy. */
export const CINEMA2_ATL_HOE_ASSET_ID: Cinema2AssetId = 'cinema2-atl-hoe'
/** MAINFRAME's complete shallow hard-surface circuit wall with independently addressable hardware and emissive systems. */
export const CINEMA2_MAINFRAME_ASSET_ID: Cinema2AssetId = 'cinema2-mainframe'
/** SAY IT production glyph package: independently addressable bevelled meshes for printable Basic Latin U+0021-U+007E. */
export const CINEMA2_SAY_IT_GLYPH_ASSET_ID: Cinema2AssetId = 'cinema2-say-it-glyphs'

/**
 * Model registry, filled from the generated asset manifest (`npm run assets:build`; records live in `assets/cinema2/<id>/asset.json`).
 * Every record carries a license and is checked against the size and GPU budgets by `npm run assets:check`.
 */
export const cinema2ThreeAssetRegistry = new Cinema2ThreeAssetRegistry()

for (const record of CINEMA2_ASSET_RECORDS) {
  if (record.kind !== 'model') continue
  const { high, medium, low } = record.files as { high: ModelFile; medium?: ModelFile; low?: ModelFile }
  cinema2ThreeAssetRegistry.register({
    id: record.id,
    url: high.url,
    compression: record.compression,
    variants: {
      ...(medium ? { medium: medium.url } : {}),
      ...(low ? { low: low.url } : {}),
    },
    license: record.license,
    ...(record.attribution ? { attribution: record.attribution } : {}),
    ...(high.triangles != null ? { triangleCount: high.triangles } : {}),
  })
}

interface ModelFile { url: string; triangles?: number }

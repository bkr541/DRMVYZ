import { CINEMA2_ASSET_RECORDS, type Cinema2AssetId } from './Cinema2AssetManifest.generated'
import { Cinema2TextureAssetRegistry } from './Cinema2TextureAssetRegistry'

/** Tileable wet-concrete normal / crack / roughness map used by the reflective floor (generated in house, see `assets/cinema2/cinema2-wet-concrete`). */
export const CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-wet-concrete'
/** 2x2 sheet of soft smoke puffs used by Threshold's ground-smoke billboards (generated in house, see `assets/cinema2/cinema2-smoke-sprites`). */
export const CINEMA2_SMOKE_SPRITES_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-smoke-sprites'
/** The printed label (ZERO SUGAR, claw emblem, ULTRA WHITE) wrapped around the BWC plush creature's body (see `assets/cinema2/cinema2-bwc-creature-label`). */
export const CINEMA2_BWC_CREATURE_LABEL_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-bwc-creature-label'
/** Tileable 3D smoke/noise volume used by the volumetric atmosphere (generated in house, see `assets/cinema2/cinema2-smoke-volume`). */
export const CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-smoke-volume'
export const CINEMA2_LOCAL_ANCIENT_MACHINE_ROCK_ASSET_ID = 'local-ancient-machine-rock'

/** Shipped assets come from the generated manifest (`npm run assets:build`). */
export const cinema2TextureAssetRegistry = new Cinema2TextureAssetRegistry()

for (const record of CINEMA2_ASSET_RECORDS) {
  const attribution = record.attribution
  if (record.kind !== 'texture') continue
  const { high, medium, low } = record.files as { high: TextureFile; medium?: TextureFile; low?: TextureFile }
  cinema2TextureAssetRegistry.register({
    id: record.id,
    url: high.url,
    layout: record.layout,
    width: high.width,
    height: high.height,
    ...(high.depth ? { depth: high.depth } : {}),
    variants: {
      ...(medium ? { medium: variantOf(medium) } : {}),
      ...(low ? { low: variantOf(low) } : {}),
    },
    license: record.license,
    ...(attribution ? { attribution } : {}),
  })
}

if (import.meta.env.DEV) {
  cinema2TextureAssetRegistry.register({
    id: CINEMA2_LOCAL_ANCIENT_MACHINE_ROCK_ASSET_ID,
    url: '/artifacts/ancient-machine/rock-material.png',
    layout: 'surface-normal-crack-roughness',
    width: 448,
    height: 128,
    license: 'CC BY-NC-SA 4.0',
    attribution: 'Glowing Rock by laboratorija (Sketchfab). Cropped and repacked material maps.',
  })
}

interface TextureFile { url: string; width: number; height: number; depth?: number }

function variantOf(file: TextureFile): { url: string; width: number; height: number; depth?: number } {
  return { url: file.url, width: file.width, height: file.height, ...(file.depth ? { depth: file.depth } : {}) }
}

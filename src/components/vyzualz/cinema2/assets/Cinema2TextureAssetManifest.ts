import { CINEMA2_ASSET_RECORDS, type Cinema2AssetId } from './Cinema2AssetManifest.generated'
import { Cinema2TextureAssetRegistry } from './Cinema2TextureAssetRegistry'

/** Tileable wet-concrete normal / crack / roughness map used by the reflective floor (generated in house, see `assets/cinema2/cinema2-wet-concrete`). */
export const CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-wet-concrete'
/** Tileable 3D smoke/noise volume used by the volumetric atmosphere (generated in house, see `assets/cinema2/cinema2-smoke-volume`). */
export const CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID: Cinema2AssetId = 'cinema2-smoke-volume'

/** Filled from the generated manifest (`npm run assets:build`); nothing is registered by hand. */
export const cinema2TextureAssetRegistry = new Cinema2TextureAssetRegistry()

for (const record of CINEMA2_ASSET_RECORDS) {
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
    ...(record.attribution ? { attribution: record.attribution } : {}),
  })
}

interface TextureFile { url: string; width: number; height: number; depth?: number }

function variantOf(file: TextureFile): { url: string; width: number; height: number; depth?: number } {
  return { url: file.url, width: file.width, height: file.height, ...(file.depth ? { depth: file.depth } : {}) }
}

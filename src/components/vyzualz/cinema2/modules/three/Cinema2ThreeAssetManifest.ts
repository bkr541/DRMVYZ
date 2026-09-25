import { CINEMA2_ASSET_RECORDS, type Cinema2AssetId } from '../../assets/Cinema2AssetManifest.generated'
import { Cinema2ThreeAssetRegistry } from './Cinema2ThreeAssetRegistry'

export const CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID: Cinema2AssetId = 'cinema2-reference-torus-knot'

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

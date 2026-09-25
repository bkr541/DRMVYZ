import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2TextureAssetLayout } from './Cinema2TextureAssetRegistry'

/** Shape of the records in `Cinema2AssetManifest.generated.ts` (produced by `npm run assets:build`, see `assets/cinema2/README.md`). */
export interface Cinema2GeneratedAssetFile {
  readonly url: string
  readonly bytes: number
  readonly width?: number
  readonly height?: number
  readonly triangles?: number
}

interface Cinema2GeneratedAssetBase {
  readonly id: string
  readonly license: string
  readonly attribution: string | null
  /** A tier without its own file uses the next better one. */
  readonly files: { readonly high: Cinema2GeneratedAssetFile } & Partial<Record<Exclude<Cinema2RenderQualityLevel, 'high'>, Cinema2GeneratedAssetFile>>
  /** Estimated GPU bytes per quality tier (decoded geometry plus textures with mips). */
  readonly gpuBytes: Readonly<Record<Cinema2RenderQualityLevel, number>>
}

export interface Cinema2GeneratedModelAssetRecord extends Cinema2GeneratedAssetBase {
  readonly kind: 'model'
  readonly compression: 'none' | 'meshopt'
}

export interface Cinema2GeneratedTextureAssetRecord extends Cinema2GeneratedAssetBase {
  readonly kind: 'texture'
  readonly layout: Cinema2TextureAssetLayout
}

export type Cinema2GeneratedAssetRecord = Cinema2GeneratedModelAssetRecord | Cinema2GeneratedTextureAssetRecord

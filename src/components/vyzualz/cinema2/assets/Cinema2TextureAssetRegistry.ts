import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'

/**
 * Shipped textures are referenced by id, never by URL, exactly like the Three.js model assets. The #7b asset pipeline will
 * generate the manifest that feeds this registry; until then `Cinema2TextureAssetManifest.ts` is authored by hand with the same record shape.
 *
 * `layout` says what the channels mean, so an effect can refuse a texture it cannot interpret and the pipeline can pick the right
 * encoding (data layouts must never be lossy-compressed or colour-managed):
 * - `surface-normal-crack-roughness`: RG = tangent-space normal xy (0.5 = flat), B = crack mask, A = roughness.
 * - `color`: sRGB colour with straight alpha.
 * - `noise-volume-rgba`: a tileable 3D noise volume (RGBA, all channels 0..1 data) stored as one image `width` wide and `width * depth` tall, uploaded as a 3D texture:
 *   R billowy puffs, G wispy ridged strands, B fine puffs, A broad patchiness.
 */
export type Cinema2TextureAssetLayout = 'surface-normal-crack-roughness' | 'color' | 'noise-volume-rgba'

export interface Cinema2TextureAssetRecord {
  id: string
  /** App-origin path of the image (root-relative, served from `public/` in dev and from `dist/` in Electron). */
  url: string
  layout: Cinema2TextureAssetLayout
  width: number
  height: number
  /** Volume textures: number of slices. Slice size is `width` x `height`. */
  depth?: number
  /** Per-quality replacements for `url` (smaller resolution). Missing tiers fall back to `url`. */
  variants?: Partial<Record<Cinema2RenderQualityLevel, Readonly<{ url: string; width: number; height: number; depth?: number }>>>
  license: string
  attribution?: string
}

export interface Cinema2ResolvedTextureAsset {
  id: string
  url: string
  layout: Cinema2TextureAssetLayout
  width: number
  height: number
  depth: number | null
}

export class Cinema2TextureAssetRegistry {
  private readonly records = new Map<string, Readonly<Cinema2TextureAssetRecord>>()

  register(record: Cinema2TextureAssetRecord): void {
    const id = record.id?.trim()
    if (!id) throw new Error('Cinema 2.0 texture asset ids must be non-empty.')
    if (this.records.has(id)) throw new Error(`Cinema 2.0 texture asset "${id}" is already registered.`)
    assertAppOriginPath(id, record.url)
    for (const variant of Object.values(record.variants ?? {})) if (variant) assertAppOriginPath(id, variant.url)
    if (!record.license?.trim()) throw new Error(`Cinema 2.0 texture asset "${id}" needs a license record.`)
    if (!(record.width > 0) || !(record.height > 0)) throw new Error(`Cinema 2.0 texture asset "${id}" needs positive pixel dimensions.`)
    this.records.set(id, Object.freeze({ ...record, id }))
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  get(id: string): Readonly<Cinema2TextureAssetRecord> | null {
    return this.records.get(id) ?? null
  }

  list(): readonly Readonly<Cinema2TextureAssetRecord>[] {
    return Object.freeze([...this.records.values()])
  }

  /** The file to fetch for a quality tier. */
  resolve(id: string, quality: Cinema2RenderQualityLevel): Readonly<Cinema2ResolvedTextureAsset> | null {
    const record = this.records.get(id)
    if (!record) return null
    const variant = record.variants?.[quality]
    return Object.freeze({
      id,
      url: variant?.url ?? record.url,
      layout: record.layout,
      width: variant?.width ?? record.width,
      height: variant?.height ?? record.height,
      depth: (variant ? variant.depth : record.depth) ?? null,
    })
  }
}

function assertAppOriginPath(id: string, url: string): void {
  if (!url || !url.startsWith('/') || url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
    throw new Error(`Cinema 2.0 texture asset "${id}" must use an app-origin path (starting with "/"), not "${url}".`)
  }
}

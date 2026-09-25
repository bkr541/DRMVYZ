import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'

/**
 * Shipped 3D assets are referenced by id, never by URL. The roadmap's #7 asset pipeline will generate the manifest file that
 * feeds this registry; until then `Cinema2ThreeAssetManifest.ts` is authored by hand with the same record shape.
 */
export type Cinema2ThreeAssetCompression = 'none' | 'meshopt'

export interface Cinema2ThreeAssetRecord {
  id: string
  /** App-origin path of the GLB (root-relative, served from `public/` in dev and from `dist/` in Electron). */
  url: string
  compression: Cinema2ThreeAssetCompression
  /** Per-quality replacements for `url` (smaller textures / lower LOD). Missing tiers fall back to `url`. */
  variants?: Partial<Record<Cinema2RenderQualityLevel, string>>
  license: string
  attribution?: string
  triangleCount?: number
}

export class Cinema2ThreeAssetRegistry {
  private readonly records = new Map<string, Readonly<Cinema2ThreeAssetRecord>>()

  register(record: Cinema2ThreeAssetRecord): void {
    const id = record.id?.trim()
    if (!id) throw new Error('Cinema 2.0 Three asset ids must be non-empty.')
    if (this.records.has(id)) throw new Error(`Cinema 2.0 Three asset "${id}" is already registered.`)
    if (!record.url || !record.url.startsWith('/') || record.url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(record.url)) {
      throw new Error(`Cinema 2.0 Three asset "${id}" must use an app-origin path (starting with "/"), not "${record.url}".`)
    }
    if (!record.license?.trim()) throw new Error(`Cinema 2.0 Three asset "${id}" needs a license record.`)
    this.records.set(id, Object.freeze({ ...record, id }))
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  get(id: string): Readonly<Cinema2ThreeAssetRecord> | null {
    return this.records.get(id) ?? null
  }

  list(): readonly Readonly<Cinema2ThreeAssetRecord>[] {
    return Object.freeze([...this.records.values()])
  }

  /** The URL to fetch for a quality tier. */
  resolveUrl(id: string, quality: Cinema2RenderQualityLevel): string | null {
    const record = this.records.get(id)
    if (!record) return null
    return record.variants?.[quality] ?? record.url
  }
}

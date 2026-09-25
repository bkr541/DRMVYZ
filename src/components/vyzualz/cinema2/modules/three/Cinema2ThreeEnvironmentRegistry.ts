import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ASSET_RECORDS, type Cinema2AssetId } from '../../assets/Cinema2AssetManifest.generated'

/** Shipped studio environment (equirectangular Radiance `.hdr`) used for image-based lighting; generated in house, see `assets/cinema2/cinema2-studio-environment`. */
export const CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID: Cinema2AssetId = 'cinema2-studio-environment'

export interface Cinema2ThreeEnvironmentRecord {
  id: string
  url: string
  variants?: Partial<Record<Cinema2RenderQualityLevel, string>>
  license: string
  attribution?: string
}

/** Environments are referenced by id, like models and textures: app-origin paths only, license required. */
export class Cinema2ThreeEnvironmentRegistry {
  private readonly records = new Map<string, Readonly<Cinema2ThreeEnvironmentRecord>>()

  register(record: Cinema2ThreeEnvironmentRecord): void {
    const id = record.id?.trim()
    if (!id) throw new Error('Cinema 2.0 environment ids must be non-empty.')
    if (this.records.has(id)) throw new Error(`Cinema 2.0 environment "${id}" is already registered.`)
    for (const url of [record.url, ...Object.values(record.variants ?? {})]) {
      if (!url || !url.startsWith('/') || url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url)) {
        throw new Error(`Cinema 2.0 environment "${id}" must use an app-origin path (starting with "/"), not "${url}".`)
      }
    }
    if (!record.license?.trim()) throw new Error(`Cinema 2.0 environment "${id}" needs a license record.`)
    this.records.set(id, Object.freeze({ ...record, id }))
  }

  has(id: string): boolean {
    return this.records.has(id)
  }

  list(): readonly Readonly<Cinema2ThreeEnvironmentRecord>[] {
    return Object.freeze([...this.records.values()])
  }

  resolveUrl(id: string, quality: Cinema2RenderQualityLevel): string | null {
    const record = this.records.get(id)
    return record ? (record.variants?.[quality] ?? record.url) : null
  }
}

/** Filled from the generated asset manifest (`npm run assets:build`); nothing is registered by hand. */
export const cinema2ThreeEnvironmentRegistry = new Cinema2ThreeEnvironmentRegistry()

for (const record of CINEMA2_ASSET_RECORDS) {
  if (record.kind !== 'environment') continue
  const { high, medium, low } = record.files as { high: { url: string }; medium?: { url: string }; low?: { url: string } }
  cinema2ThreeEnvironmentRegistry.register({
    id: record.id,
    url: high.url,
    variants: { ...(medium ? { medium: medium.url } : {}), ...(low ? { low: low.url } : {}) },
    license: record.license,
    ...(record.attribution ? { attribution: record.attribution } : {}),
  })
}

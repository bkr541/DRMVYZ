import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'
import type { Cinema2ThreeAssetRecord, Cinema2ThreeAssetRegistry } from './Cinema2ThreeAssetRegistry'

export interface Cinema2ThreeLoadedAsset {
  readonly id: string
  /** Template scene. Never drawn directly: modules clone it (sharing geometry and textures) per instance. */
  readonly scene: ThreeNamespace.Object3D
  readonly triangleCount: number
  /** Estimated GPU bytes for the template's unique geometry and textures. */
  readonly gpuBytes: number
}

export class Cinema2ThreeAssetError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'Cinema2ThreeAssetError'
  }
}

export interface Cinema2ThreeAssetCacheOptions {
  /** Fetch + decode one asset. Replaced in tests; the default fetches the URL and parses it with GLTFLoader (+ meshopt). */
  loadModel?: (library: Cinema2ThreeLibrary, record: Readonly<Cinema2ThreeAssetRecord>, url: string) => Promise<ThreeNamespace.Object3D>
  /** Assets that stay decoded in memory after their last user releases them (their GPU resources are freed). */
  idleLimit?: number
}

interface CacheEntry {
  key: string
  id: string
  promise: Promise<Cinema2ThreeLoadedAsset>
  asset: Cinema2ThreeLoadedAsset | null
  holders: number
}

/**
 * Reference-counted store of decoded models. GPU resources are freed when the last holder releases an asset, while the
 * decoded CPU data stays in a small idle list so a preset re-entry or a context restore does not fetch and decode again.
 */
export class Cinema2ThreeAssetCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly idle: string[] = []
  private readonly loadModel: NonNullable<Cinema2ThreeAssetCacheOptions['loadModel']>
  private readonly idleLimit: number

  constructor(private readonly registry: Cinema2ThreeAssetRegistry, options: Cinema2ThreeAssetCacheOptions = {}) {
    this.loadModel = options.loadModel ?? loadModelWithGltfLoader
    this.idleLimit = options.idleLimit ?? 4
  }

  /** Loads (or shares) an asset and counts the caller as a holder. Every successful acquire needs one `release`. */
  acquire(library: Cinema2ThreeLibrary, id: string, quality: Cinema2RenderQualityLevel): Promise<Cinema2ThreeLoadedAsset> {
    const record = this.registry.get(id)
    const url = this.registry.resolveUrl(id, quality)
    if (!record || !url) return Promise.reject(new Cinema2ThreeAssetError('CINEMA2_THREE_ASSET_UNKNOWN', `Cinema 2.0 has no shipped 3D asset "${id}".`))
    const key = `${id}@${url}`
    let entry = this.entries.get(key)
    if (!entry) {
      const created: CacheEntry = { key, id, asset: null, holders: 0, promise: Promise.resolve(null as never) }
      created.promise = this.decode(library, record, url).then(
        asset => { created.asset = asset; return asset },
        error => { if (this.entries.get(key) === created) this.entries.delete(key); throw error },
      )
      this.entries.set(key, created)
      entry = created
    }
    const held = entry
    held.holders += 1
    this.removeFromIdle(key)
    return held.promise.catch(error => { held.holders = Math.max(0, held.holders - 1); throw error })
  }

  release(asset: Cinema2ThreeLoadedAsset): void {
    for (const entry of this.entries.values()) {
      if (entry.asset !== asset) continue
      entry.holders = Math.max(0, entry.holders - 1)
      if (entry.holders === 0) this.retire(entry)
      return
    }
  }

  /** Drops every decoded model (test and shutdown seam). */
  clear(): void {
    for (const entry of [...this.entries.values()]) {
      if (entry.asset) disposeObject(entry.asset.scene)
    }
    this.entries.clear()
    this.idle.length = 0
  }

  getSnapshot(): { entryCount: number; heldCount: number; idleCount: number } {
    let held = 0
    for (const entry of this.entries.values()) held += entry.holders
    return { entryCount: this.entries.size, heldCount: held, idleCount: this.idle.length }
  }

  private async decode(library: Cinema2ThreeLibrary, record: Readonly<Cinema2ThreeAssetRecord>, url: string): Promise<Cinema2ThreeLoadedAsset> {
    let scene: ThreeNamespace.Object3D
    try {
      scene = await this.loadModel(library, record, url)
    } catch (error) {
      if (error instanceof Cinema2ThreeAssetError) throw error
      throw new Cinema2ThreeAssetError('CINEMA2_THREE_ASSET_LOAD_FAILED', `Cinema 2.0 could not load 3D asset "${record.id}" from ${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const stats = measureObject(scene)
    return Object.freeze({ id: record.id, scene, triangleCount: stats.triangles, gpuBytes: stats.bytes })
  }

  private retire(entry: CacheEntry): void {
    if (!entry.asset) return
    // Free GPU resources now (Three re-uploads on next use); keep the decoded data for a cheap re-entry.
    disposeObject(entry.asset.scene)
    this.idle.push(entry.key)
    while (this.idle.length > this.idleLimit) {
      const evicted = this.idle.shift()
      if (evicted) this.entries.delete(evicted)
    }
  }

  private removeFromIdle(key: string): void {
    const index = this.idle.indexOf(key)
    if (index >= 0) this.idle.splice(index, 1)
  }
}

const GLB_MAGIC = 0x46546c67 // "glTF"

async function loadModelWithGltfLoader(library: Cinema2ThreeLibrary, record: Readonly<Cinema2ThreeAssetRecord>, url: string): Promise<ThreeNamespace.Object3D> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = await response.arrayBuffer()
  // A missing file can come back as an HTML fallback page with a 200 status; say so instead of a parser error.
  if (buffer.byteLength < 12 || new DataView(buffer).getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('the file is not a binary glTF (GLB)')
  }
  const loader = new library.GLTFLoader()
  if (record.compression === 'meshopt') loader.setMeshoptDecoder(library.MeshoptDecoder as never)
  const gltf = await loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1))
  return gltf.scene
}

interface ObjectStats {
  triangles: number
  bytes: number
}

/** Triangle count and a GPU byte estimate (geometry attributes + textures at width x height x 4 x 1.34 for mipmaps); shared geometry and textures count once. */
export function measureObject(roots: ThreeNamespace.Object3D | readonly ThreeNamespace.Object3D[]): ObjectStats {
  const geometries = new Set<ThreeNamespace.BufferGeometry>()
  const textures = new Set<ThreeNamespace.Texture>()
  let triangles = 0
  const visit = (object: ThreeNamespace.Object3D) => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry
    if (!geometries.has(geometry)) {
      geometries.add(geometry)
      triangles += (geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0) / 3
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) {
        if (value && (value as ThreeNamespace.Texture).isTexture) textures.add(value as ThreeNamespace.Texture)
      }
    }
  }
  for (const root of Array.isArray(roots) ? roots : [roots as ThreeNamespace.Object3D]) root.traverse(visit)
  let bytes = 0
  for (const geometry of geometries) {
    for (const attribute of Object.values(geometry.attributes)) bytes += (attribute as ThreeNamespace.BufferAttribute).array.byteLength
    if (geometry.index) bytes += geometry.index.array.byteLength
  }
  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | null
    if (image?.width && image.height) bytes += image.width * image.height * 4 * (texture.generateMipmaps ? 1.34 : 1)
  }
  return { triangles: Math.round(triangles), bytes: Math.round(bytes) }
}

/** Disposes geometry, materials and textures of an object tree (each once). Safe to call repeatedly. */
export function disposeObject(root: ThreeNamespace.Object3D): void {
  const disposed = new Set<{ dispose(): void }>()
  const dispose = (resource: { dispose(): void } | null | undefined) => {
    if (!resource || disposed.has(resource)) return
    disposed.add(resource)
    resource.dispose()
  }
  root.traverse(object => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh) return
    dispose(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) {
        if (value && (value as ThreeNamespace.Texture).isTexture) dispose(value as ThreeNamespace.Texture)
      }
      dispose(material)
    }
  })
}

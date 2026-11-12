import type * as Three from 'three'
import { supabase } from '../../../../lib/supabase'
import { modelAssetRepository, type ModelAssetRepository } from '../../../../features/models/data/modelAssetRepository'
import { ModelAssetError, MODEL_MAX_FILE_BYTES, MODEL_MAX_TRIANGLES, type ModelAsset, type ModelAssetVersion } from '../../../../features/models/domain/modelAssetTypes'
import { checkAbort } from '../../../../features/models/geometry/modelQualityBudget'
import { describeCinema2LoadedModel } from '../modules/three/Cinema2ThreeAssetMetadata'
import { disposeObject, measureObject, type Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
import { cinema2ThreeDecoderPool, readCinema2GlbRequirements, type Cinema2ThreeDecoderPool } from '../modules/three/Cinema2ThreeDecoders'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { UserModelBinding } from './Cinema2ModelBinding'
export type Cinema2UserModelStatus = 'loading' | 'ready' | 'error' | 'missing' | 'unauthorized'
export class Cinema2UserModelError extends Error {
  constructor(readonly status: 'error' | 'missing' | 'unauthorized', message: string) { super(message); this.name = 'Cinema2UserModelError' }
}
export interface AuthorizedUserModel { userId: string; asset: ModelAsset; version: ModelAssetVersion }
export interface Cinema2UserModelResolverOptions {
  repository?: ModelAssetRepository
  currentUser?: () => Promise<string | null>
  fetch?: typeof fetch
  decoders?: Cinema2ThreeDecoderPool
}
function fail(message: string): never { throw new Cinema2UserModelError('error', message) }
/** Private generated-model profile: embedded static triangle geometry and PBR; no textures, skins or animations. */
export function validateCinema2UserGlb(buffer: ArrayBuffer): void {
  const view = new DataView(buffer)
  if (buffer.byteLength < 20 || buffer.byteLength > MODEL_MAX_FILE_BYTES || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) fail('The saved model is not a valid bounded GLB.')
  const length = view.getUint32(12, true)
  if (length > 4 * 1024 * 1024 || length + 20 > buffer.byteLength) fail('Model metadata exceeds the runtime budget.')
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))) as {
    images?: unknown[]; textures?: unknown[]; skins?: unknown[]; animations?: unknown[]; nodes?: unknown[]; materials?: unknown[]
    accessors?: { count: number }[]; bufferViews?: { byteLength: number }[]; buffers?: { byteLength: number }[]; meshes?: { primitives: { mode?: number; indices?: number; attributes?: { POSITION?: number } }[] }[]
  }
  const rejectUris = (value: unknown): void => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (key === 'uri') fail('External or URI-based model resources are unsupported.'); rejectUris(child) } }
  rejectUris(json)
  if (json.images?.length || json.textures?.length || json.skins?.length || json.animations?.length) fail('Private models must be static generated meshes without textures or skins.')
  if ((json.nodes?.length ?? 0) > 2048 || (json.materials?.length ?? 0) > 128 || (json.accessors?.length ?? 0) > 8192) fail('Model structure exceeds the runtime budget.')
  if (json.accessors?.some(a => !Number.isInteger(a.count) || a.count < 1 || a.count > 1_000_000) || json.buffers?.some(b => !Number.isInteger(b.byteLength) || b.byteLength < 1 || b.byteLength > MODEL_MAX_FILE_BYTES) || (json.bufferViews ?? []).reduce((sum, v) => sum + v.byteLength, 0) > MODEL_MAX_FILE_BYTES * 2 || json.bufferViews?.some(v => !Number.isInteger(v.byteLength) || v.byteLength < 1 || v.byteLength > MODEL_MAX_FILE_BYTES)) fail('Decoded buffers exceed the model resource budget.')
  let triangles = 0
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives) {
    const accessor = json.accessors?.[primitive.indices ?? primitive.attributes?.POSITION ?? -1]
    if ((primitive.mode ?? 4) !== 4 || !accessor || !Number.isInteger(accessor.count) || accessor.count < 3) fail('Only bounded triangle meshes are supported.')
    triangles += accessor.count / 3
  }
  if (!triangles || triangles > MODEL_MAX_TRIANGLES) fail('Model exceeds the triangle budget or has no mesh.')
}
export class Cinema2UserModelResolver {
  private readonly repository: ModelAssetRepository
  private readonly currentUser: () => Promise<string | null>
  private readonly fetcher: typeof fetch
  private readonly decoders: Cinema2ThreeDecoderPool
  constructor(options: Cinema2UserModelResolverOptions = {}) {
    this.repository = options.repository ?? modelAssetRepository
    this.currentUser = options.currentUser ?? (async () => { const result = await supabase.auth.getUser(); return result.error ? null : result.data.user?.id ?? null })
    this.fetcher = options.fetch ?? ((...args) => fetch(...args)); this.decoders = options.decoders ?? cinema2ThreeDecoderPool
  }
  async authorize(binding: Extract<UserModelBinding, { kind: 'user-model' }>, signal?: AbortSignal): Promise<AuthorizedUserModel> {
    try {
      const userId = await this.currentUser(); checkAbort(signal)
      if (!userId) throw new Cinema2UserModelError('unauthorized', 'Sign in to load this private model.')
      const asset = await this.repository.get(binding.modelAssetId); checkAbort(signal)
      if (asset.userId !== userId) throw new Cinema2UserModelError('unauthorized', 'This model is not available to the signed-in account.')
      if (asset.status !== 'ready' || asset.currentVersion < binding.version) throw new Cinema2UserModelError('missing', 'The selected model or pinned version is unavailable or deleted.')
      const version = await this.repository.getVersion(asset.id, binding.version); checkAbort(signal)
      if (version.modelAssetId !== asset.id || version.version !== binding.version) fail('Model version identity differs from its binding.')
      if ((await this.currentUser()) !== userId) throw new Cinema2UserModelError('unauthorized', 'The account changed while authorizing the model.')
      return { userId, asset, version }
    } catch (error) { throw classifyCinema2UserModelError(error) }
  }
  async load(library: Cinema2ThreeLibrary, authorized: AuthorizedUserModel, signal: AbortSignal): Promise<Cinema2ThreeLoadedAsset> {
    const { asset, version, userId } = authorized
    let buffer: ArrayBuffer | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      checkAbort(signal)
      const signed = await this.repository.signedUrl(asset.id, version.version, 'glbPath'); checkAbort(signal)
      const response = await this.fetcher(signed.url, { signal, credentials: 'omit' })
      if (!response.ok) {
        if (!attempt && [401, 403].includes(response.status)) continue
        throw new Cinema2UserModelError(response.status === 404 ? 'missing' : [401, 403].includes(response.status) ? 'unauthorized' : 'error', 'The private model could not be downloaded. Retry or choose another model.')
      }
      const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
      if (!['model/gltf-binary', 'application/octet-stream'].includes(mime ?? '')) fail('The model response has an unsupported MIME type.')
      if (Number(response.headers.get('content-length')) > MODEL_MAX_FILE_BYTES) fail('The model exceeds the 64 MiB file budget.')
      // Bound the download even when Content-Length is absent or dishonest.
      const reader = response.body?.getReader(); if (!reader) fail('The model response contains no bytes.')
      const chunks: Uint8Array[] = []; let total = 0
      try { for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MODEL_MAX_FILE_BYTES) fail('The model exceeds the 64 MiB file budget.'); chunks.push(part.value); checkAbort(signal) } }
      finally { await reader.cancel(); reader.releaseLock() }
      const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      buffer = bytes.buffer; break
    }
    if (!buffer) fail('No model bytes were received.')
    validateCinema2UserGlb(buffer); checkAbort(signal)
    const requirements = readCinema2GlbRequirements(buffer), loader = new library.GLTFLoader()
    if (requirements.meshopt) loader.setMeshoptDecoder(library.MeshoptDecoder as never)
    const lease = requirements.decoders.length ? await this.decoders.lease(requirements.decoders) : null
    let scene: Three.Group | null = null
    try {
      if (lease?.loaders.draco) loader.setDRACOLoader(lease.loaders.draco)
      if (lease?.loaders.ktx2) loader.setKTX2Loader(lease.loaders.ktx2)
      const loaded = await loader.parseAsync(buffer, ''); scene = loaded.scene; buffer = null; checkAbort(signal)
      if ((await this.currentUser()) !== userId) throw new Cinema2UserModelError('unauthorized', 'The account changed while downloading the model.')
      const { THREE } = library, box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
      if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) || Math.max(size.x, size.y, size.z) <= 0) fail('The model bounds are invalid.')
      let triangles = 0, vertices = 0
      scene.traverse(object => { const mesh = object as Three.Mesh; if (!mesh.isMesh) return; const positions = mesh.geometry.attributes.position; if (!positions || Array.from(positions.array).some(n => !Number.isFinite(n))) fail('Model geometry contains invalid coordinates.'); vertices += positions.count; triangles += (mesh.geometry.index?.count ?? positions.count) / 3 })
      if (triangles > MODEL_MAX_TRIANGLES || vertices > 1_000_000) fail('The decoded model exceeds the runtime geometry budget.')
      const expected = version.geometryStats.bounds
      if (triangles !== version.geometryStats.triangles || !box.min.toArray().every((v, i) => Math.abs(v - expected.min[i]) < 1e-3) || !box.max.toArray().every((v, i) => Math.abs(v - expected.max[i]) < 1e-3)) fail('The model geometry does not match its saved metadata.')
      const normalized = new THREE.Group(), scale = 2 / Math.max(size.x, size.y, size.z)
      normalized.name = 'Cinema2UserModel'; normalized.scale.setScalar(scale); normalized.position.copy(center).multiplyScalar(-scale); normalized.add(scene); normalized.updateMatrixWorld(true)
      return { id: `user-model:${userId}:${asset.id}:${version.version}`, scene: normalized, triangleCount: triangles, gpuBytes: measureObject(normalized).bytes, animations: [], metadata: describeCinema2LoadedModel(normalized, []) }
    } catch (error) { if (scene) disposeObject(scene); throw classifyCinema2UserModelError(error) }
    finally { lease?.release() }
  }
}
export function classifyCinema2UserModelError(error: unknown): Cinema2UserModelError {
  if (error instanceof Cinema2UserModelError) return error
  if (error instanceof ModelAssetError) return new Cinema2UserModelError(error.kind === 'authorization' ? 'unauthorized' : 'error', error.message)
  return new Cinema2UserModelError('error', error instanceof Error ? error.message : 'Model loading failed.')
}

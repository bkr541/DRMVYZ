import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelAssetRepository } from '../../../../features/models/data/modelAssetRepository'
import { MODEL_ID, USER_A, USER_B, recipe } from '../../../../features/models/__tests__/modelAssetFixtures'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { Cinema2UserModelResolver, validateCinema2UserGlb } from './Cinema2UserModelResolver'
import { Cinema2UserModelCache } from './Cinema2UserModelCache'
import { Cinema2UserModelSlot } from './Cinema2UserModelSlot'
import { createCinema2ModelPlaceholder } from './Cinema2ModelPlaceholder'
import { parseUserModelBinding, serializeUserModelBinding } from './Cinema2ModelBinding'
import { CINEMA2_USER_MODEL_PARAMETER_ID, CINEMA2_USER_MODEL_REFERENCE_ID, CINEMA2_USER_MODEL_REFERENCE_MANIFEST } from './Cinema2UserModelReferenceHarness'
import { Cinema2PresetRegistry, cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { createEmptyCinema2WorkspaceDocument, parseCinema2WorkspaceDocument, activateCinema2Workspace } from '../runtime/Cinema2WorkspacePersistence'
const library = { THREE, GLTFLoader } as unknown as Cinema2ThreeLibrary
const binding = { kind: 'user-model' as const, modelAssetId: MODEL_ID, version: 1 }
const stats = { triangles: 1, vertices: 3, meshes: 1, bounds: { min: [-1, -1, 0] as [number, number, number], max: [1, 1, 0] as [number, number, number] } }
const asset = { id: MODEL_ID, userId: USER_A, sourceMediaId: null, name: 'Logo', description: null, currentVersion: 2, status: 'ready' as const, favorite: false, createdAt: '2026-11-12T00:00:00Z', updatedAt: '2026-11-12T00:00:00Z' }
function glb(patch = {}) {
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0.3, 0, 1], metallicFactor: 0.4, roughnessFactor: 0.5 } }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }], bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ byteLength: 36 }], ...patch }
  const text = new TextEncoder().encode(JSON.stringify(json)), length = Math.ceil(text.length / 4) * 4
  const bytes = new ArrayBuffer(20 + length + 8 + 36), view = new DataView(bytes)
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.byteLength, true); view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(bytes, 20, length).fill(32); new Uint8Array(bytes, 20, text.length).set(text)
  view.setUint32(20 + length, 36, true); view.setUint32(24 + length, 0x004e4942, true)
  new Float32Array(bytes, 28 + length, 9).set([-1, -1, 0, 1, -1, 0, 0, 1, 0]); return bytes
}
let repository: ModelAssetRepository, owner: string | null, fetcher: ReturnType<typeof vi.fn>, resolver: Cinema2UserModelResolver
beforeEach(() => {
  owner = USER_A
  repository = { get: vi.fn(async () => asset), getVersion: vi.fn(async () => ({ modelAssetId: MODEL_ID, version: 1, geometryStats: stats, generatorRecipe: recipe })), signedUrl: vi.fn(async () => ({ url: 'https://private.example.invalid/model?temporary=1' })) } as unknown as ModelAssetRepository
  fetcher = vi.fn(async () => new Response(glb(), { headers: { 'content-type': 'model/gltf-binary' } }))
  resolver = new Cinema2UserModelResolver({ repository, currentUser: async () => owner, fetch: fetcher })
})
const signal = () => new AbortController().signal
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve() }
describe('private user model authorization, binary decoding and bounded validation', () => {
  it('authorizes a pinned version and parses actual GLB PBR geometry into a centered bounded model', async () => {
    const loaded = await resolver.load(library, await resolver.authorize(binding), signal())
    expect(loaded.triangleCount).toBe(1); expect(loaded.id).toContain(`${USER_A}:${MODEL_ID}:1`)
    expect(new THREE.Box3().setFromObject(loaded.scene).getCenter(new THREE.Vector3()).length()).toBe(0)
    expect(repository.getVersion).toHaveBeenCalledWith(MODEL_ID, 1)
    expect(loaded.scene.children[0].children[0]).toBeInstanceOf(THREE.Mesh)
  })
  it('rejects another owner, signed-out access and deleted/missing versions before download', async () => {
    owner = USER_B; await expect(resolver.authorize(binding)).rejects.toMatchObject({ status: 'unauthorized' })
    owner = null; await expect(resolver.authorize(binding)).rejects.toMatchObject({ status: 'unauthorized' })
    owner = USER_A; vi.mocked(repository.get).mockResolvedValueOnce({ ...asset, status: 'deletion_pending' })
    await expect(resolver.authorize(binding)).rejects.toMatchObject({ status: 'missing' })
    await expect(resolver.authorize({ ...binding, version: 3 })).rejects.toMatchObject({ status: 'missing' })
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('refreshes an expired signed URL once, and diagnoses 404/denied/MIME errors', async () => {
    const authorized = await resolver.authorize(binding)
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }))
    await resolver.load(library, authorized, signal()); expect(repository.signedUrl).toHaveBeenCalledTimes(2)
    fetcher.mockResolvedValueOnce(new Response(null, { status: 404 })); await expect(resolver.load(library, authorized, signal())).rejects.toMatchObject({ status: 'missing' })
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(new Response(null, { status: 403 })); await expect(resolver.load(library, authorized, signal())).rejects.toMatchObject({ status: 'unauthorized' })
    fetcher.mockResolvedValueOnce(new Response(glb(), { headers: { 'content-type': 'text/html' } })); await expect(resolver.load(library, authorized, signal())).rejects.toThrow(/MIME/)
  })
  it('rejects malformed bytes, URI dependencies, textures and excessive triangles before parsing', () => {
    expect(() => validateCinema2UserGlb(new ArrayBuffer(20))).toThrow()
    expect(() => validateCinema2UserGlb(glb({ buffers: [{ uri: 'https://remote.invalid/buffer' }] }))).toThrow(/URI/)
    expect(() => validateCinema2UserGlb(glb({ images: [{}] }))).toThrow(/textures/)
    expect(() => validateCinema2UserGlb(glb({ accessors: [{ count: 3_000_000 }] }))).toThrow(/budget/)
  })
})
describe('private model cache and dynamic subtree ownership', () => {
  it('shares two preset leases, reauthorizes cache hits, and frees the template only after the final release', async () => {
    const cache = new Cinema2UserModelCache(resolver)
    const [a, b] = await Promise.all([cache.acquire(library, binding, signal()), cache.acquire(library, binding, signal())])
    expect(a.asset).toBe(b.asset); expect(fetcher).toHaveBeenCalledTimes(1); expect(repository.get).toHaveBeenCalledTimes(2)
    const mesh = a.asset.scene.children[0].children[0] as THREE.Mesh, dispose = vi.spyOn(mesh.geometry, 'dispose')
    a.release(); a.release(); expect(dispose).not.toHaveBeenCalled(); expect(cache.getSnapshot().heldCount).toBe(1)
    owner = USER_B; await expect(cache.acquire(library, binding, signal())).rejects.toMatchObject({ status: 'unauthorized' })
    b.release(); expect(dispose).toHaveBeenCalledTimes(1); expect(cache.getSnapshot()).toEqual({ entryCount: 0, heldCount: 0 })
  })
  it('aborts one waiter without breaking the other, and bounds A→B→A replacement resources', async () => {
    const cache = new Cinema2UserModelCache(resolver), controller = new AbortController()
    const first = cache.acquire(library, binding, controller.signal), second = cache.acquire(library, binding, signal())
    controller.abort(); const rejection = expect(first).rejects.toThrow(/cancelled/); const lease = await second
    await rejection; lease.release()
    for (const version of [1, 2, 1]) {
      vi.mocked(repository.getVersion).mockResolvedValueOnce({ modelAssetId: MODEL_ID, version, geometryStats: stats } as never)
      const current = await cache.acquire(library, { ...binding, version }, signal()); current.release()
      expect(cache.getSnapshot()).toEqual({ entryCount: 0, heldCount: 0 })
    }
  })
  it('ignores stale selection completion and restores a neutral placeholder with a diagnostic on denial', async () => {
    const fallback = createCinema2ModelPlaceholder(library), attach = vi.fn(), release = vi.fn()
    let finish!: (value: { asset: typeof fallback; release: typeof release }) => void
    const acquire = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockRejectedValueOnce(new Error('Access revoked'))
    const cache = { acquire } as unknown as Cinema2UserModelCache
    const slot = new Cinema2UserModelSlot(library, fallback, attach, cache, () => () => {})
    slot.select(serializeUserModelBinding(binding)); slot.select('default-model'); finish({ asset: fallback, release }); await flush()
    expect(release).toHaveBeenCalledTimes(1); expect(slot.getSnapshot().binding).toBe('default-model')
    slot.select(serializeUserModelBinding(binding)); await flush(); expect(slot.getSnapshot()).toMatchObject({ status: 'error', message: 'Access revoked' }); expect(attach).toHaveBeenLastCalledWith(fallback)
    slot.dispose()
  })
})
describe('generic binding persistence compatibility', () => {
  it('keeps the harness unregistered and round-trips the pinned ID/version through workspace schema 1', () => {
    const registry = new Cinema2PresetRegistry(); const registered = registry.register(CINEMA2_USER_MODEL_REFERENCE_MANIFEST)
    if (!registered.ok) throw new Error(JSON.stringify(registered.diagnostics))
    expect(cinema2NativePresetRegistry.has(CINEMA2_USER_MODEL_REFERENCE_ID)).toBe(false)
    const compiled = registry.compile(CINEMA2_USER_MODEL_REFERENCE_ID); if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const parameters = new Cinema2ParameterState(compiled.plan.parameters), value = serializeUserModelBinding(binding)
    expect(parameters.setPersistentValue(CINEMA2_USER_MODEL_PARAMETER_ID, value).ok).toBe(true)
    expect(parameters.setPersistentValue(CINEMA2_USER_MODEL_PARAMETER_ID, 'https://private.invalid/signed.glb').ok).toBe(false)
    const activation = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), { presetId: CINEMA2_USER_MODEL_REFERENCE_ID, parameterPatch: { [CINEMA2_USER_MODEL_PARAMETER_ID]: value } }, registry)
    const document = activation.document
    const restored = parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(document)), registry)
    expect(restored.ok).toBe(true); expect(restored.value.schemaVersion).toBe(1)
    const state = new Cinema2ParameterState(compiled.plan.parameters); state.restore(restored.value.presets[0].serializedParameterState)
    expect(parseUserModelBinding(state.getSnapshot().persistentValues[CINEMA2_USER_MODEL_PARAMETER_ID])).toEqual(binding)
    expect(JSON.stringify(document)).not.toContain('https:')
  })
})

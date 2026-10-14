import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { MeshoptEncoder } from 'meshoptimizer'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Cinema2ThreeAssetCache,
  Cinema2ThreeAssetError,
} from '../modules/three/Cinema2ThreeAssetCache'
import { Cinema2ThreeAssetRegistry } from '../modules/three/Cinema2ThreeAssetRegistry'
import {
  Cinema2ThreeDecoderPool,
  CINEMA2_BASIS_TRANSCODER_PATH,
  CINEMA2_DRACO_DECODER_PATH,
  readCinema2GlbRequirements,
  registerCinema2DecoderRenderer,
} from '../modules/three/Cinema2ThreeDecoders'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'

const FIXTURES = join(process.cwd(), 'src/test/fixtures/render-validation')
const fixture = (name: string): ArrayBuffer => {
  const bytes = readFileSync(join(FIXTURES, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function stubFetch(files: Record<string, ArrayBuffer>): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url in files
    ? { ok: true, status: 200, arrayBuffer: async () => files[url] }
    : { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })))
}

afterEach(() => { vi.unstubAllGlobals(); registerCinema2DecoderRenderer(null) })

function registry(files: { id: string; url: string; compression?: 'none' | 'meshopt' | 'draco'; textureCompression?: 'none' | 'ktx2' }[]): Cinema2ThreeAssetRegistry {
  const result = new Cinema2ThreeAssetRegistry()
  for (const file of files) result.register({ id: file.id, url: file.url, compression: file.compression ?? 'none', ...(file.textureCompression ? { textureCompression: file.textureCompression } : {}), license: 'generated-in-house' })
  return result
}

const realLibrary = { THREE, GLTFLoader, MeshoptDecoder } as unknown as Cinema2ThreeLibrary

/** The committed animated fixture without needing a texture decoder, re-encoded with lossless Meshopt compression. */
async function meshoptAnimated(): Promise<ArrayBuffer> {
  await MeshoptEncoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
  const document = await io.readBinary(new Uint8Array(fixture('fixture-animated.glb')))
  document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
  const bytes = await io.writeBinary(document)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('importing animated models through the asset cache', () => {
  it('keeps names, hierarchy, morph targets, skin and every animation clip, and never plays them', async () => {
    stubFetch({ '/models/animated.glb': fixture('fixture-animated.glb') })
    const cache = new Cinema2ThreeAssetCache(registry([{ id: 'animated', url: '/models/animated.glb' }]))
    const asset = await cache.acquire(realLibrary, 'animated', 'high')
    expect(asset.animations.map(clip => clip.name).sort()).toEqual(['bend', 'breathe', 'spin'])
    expect(asset.metadata.animations.map(clip => clip.name).sort()).toEqual(['bend', 'breathe', 'spin'])
    expect(asset.metadata.nodeNames).toEqual(expect.arrayContaining(['gear', 'blob', 'strip', 'jointBase', 'jointBend']))
    expect(asset.metadata.skinCount).toBe(1)
    expect(asset.metadata.meshes.find(mesh => mesh.name === 'blob')?.morphTargets).toEqual(['inflate'])
    expect(asset.metadata.meshes.some(mesh => mesh.skinned)).toBe(true)
    expect(asset.metadata.generator).toMatch(/cinema2 render-validation/)
    const gear = asset.scene.getObjectByName('gear')!
    expect(gear.rotation.y).toBe(0)
    cache.release(asset)
  })

  it('loads a Meshopt-compressed model with the same content as the uncompressed one', async () => {
    stubFetch({ '/models/plain.glb': fixture('fixture-animated.glb'), '/models/meshopt.glb': await meshoptAnimated() })
    const cache = new Cinema2ThreeAssetCache(registry([{ id: 'plain', url: '/models/plain.glb' }, { id: 'meshopt', url: '/models/meshopt.glb', compression: 'meshopt' }]))
    const plain = await cache.acquire(realLibrary, 'plain', 'high')
    const compressed = await cache.acquire(realLibrary, 'meshopt', 'high')
    expect(compressed.triangleCount).toBe(plain.triangleCount)
    expect(compressed.metadata.nodeNames).toEqual(plain.metadata.nodeNames)
    expect(compressed.animations.map(clip => clip.name).sort()).toEqual(plain.animations.map(clip => clip.name).sort())
    expect(compressed.metadata.extensionsUsed).toContain('EXT_meshopt_compression')
    // The two files store the attribute differently (interleaved vs not), so compare vertex by vertex.
    const read = (asset: typeof plain) => {
      const attribute = (asset.scene.getObjectByName('blob') as THREE.Mesh).geometry.attributes.position!
      return Array.from({ length: attribute.count }, (_, index) => [attribute.getX(index), attribute.getY(index), attribute.getZ(index)])
    }
    expect(read(compressed)).toEqual(read(plain))
  })

  it('also loads Meshopt when the record forgot to say so (the file header decides)', async () => {
    stubFetch({ '/models/meshopt.glb': await meshoptAnimated() })
    const cache = new Cinema2ThreeAssetCache(registry([{ id: 'meshopt', url: '/models/meshopt.glb', compression: 'none' }]))
    await expect(cache.acquire(realLibrary, 'meshopt', 'high')).resolves.toMatchObject({ id: 'meshopt' })
  })

  it('reports malformed, missing and non-GLB files as asset-load failures', async () => {
    stubFetch({ '/models/html.glb': new TextEncoder().encode('<html>fallback page</html>').buffer as ArrayBuffer, '/models/bad.glb': (() => { const copy = fixture('fixture-animated.glb').slice(0, 400); return copy })() })
    const cache = new Cinema2ThreeAssetCache(registry([
      { id: 'html', url: '/models/html.glb' }, { id: 'bad', url: '/models/bad.glb' }, { id: 'missing', url: '/models/missing.glb' },
    ]))
    for (const id of ['html', 'bad', 'missing']) {
      const error = await cache.acquire(realLibrary, id, 'high').catch(caught => caught)
      expect(error).toBeInstanceOf(Cinema2ThreeAssetError)
      expect((error as Cinema2ThreeAssetError).code).toBe('CINEMA2_THREE_ASSET_LOAD_FAILED')
    }
    expect(cache.getSnapshot().heldCount).toBe(0)
  })
})

describe('reading what a GLB needs', () => {
  it('finds Draco, KTX2 and Meshopt from the file header and nothing for a plain model', () => {
    expect(readCinema2GlbRequirements(fixture('fixture-plain.glb'))).toMatchObject({ decoders: [], meshopt: false })
    expect(readCinema2GlbRequirements(fixture('fixture-draco.glb')).decoders).toEqual(['draco'])
    expect(readCinema2GlbRequirements(fixture('fixture-ktx2.glb')).decoders).toEqual(['ktx2'])
    expect(readCinema2GlbRequirements(fixture('fixture-meshopt.glb'))).toMatchObject({ decoders: [], meshopt: true })
    expect(() => readCinema2GlbRequirements(new ArrayBuffer(40))).toThrow(/binary glTF/)
  })
})

interface FakeLoaderState { created: number; disposed: number; dracoPath?: string; transcoderPath?: string; support?: unknown }

function fakeModules(state: FakeLoaderState, fail: { draco?: boolean; ktx2?: boolean } = {}) {
  class FakeDraco { setDecoderPath(path: string) { state.dracoPath = path; return this } dispose() { state.disposed += 1 } constructor() { state.created += 1 } }
  class FakeKtx2 { setTranscoderPath(path: string) { state.transcoderPath = path; return this } detectSupport(renderer: unknown) { state.support = renderer; return this } dispose() { state.disposed += 1 } constructor() { state.created += 1 } }
  return {
    loadDraco: async () => { if (fail.draco) throw new Error('chunk 404'); return FakeDraco as never },
    loadKtx2: async () => { if (fail.ktx2) throw new Error('chunk 404'); return FakeKtx2 as never },
  }
}

describe('decoder pool', () => {
  function manualTimers() {
    const timers = new Map<number, () => void>()
    let next = 1
    return {
      setTimer: (callback: () => void) => { timers.set(next, callback); return next++ },
      clearTimer: (handle: unknown) => { timers.delete(handle as number) },
      fire: () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback() } },
      pending: () => timers.size,
    }
  }

  it('creates a decoder only when leased, shares it, and disposes it after the idle window', async () => {
    const state: FakeLoaderState = { created: 0, disposed: 0 }
    const timers = manualTimers()
    const pool = new Cinema2ThreeDecoderPool({ modules: fakeModules(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    expect(pool.getSnapshot()).toMatchObject({ dracoActive: false, ktx2Active: false })
    const first = await pool.lease(['draco'])
    const second = await pool.lease(['draco'])
    expect(first.loaders.draco).toBe(second.loaders.draco)
    expect(state).toMatchObject({ created: 1, dracoPath: CINEMA2_DRACO_DECODER_PATH })
    first.release(); first.release()
    expect(pool.getSnapshot().dracoLeases).toBe(1)
    second.release()
    expect(timers.pending()).toBe(1)
    timers.fire()
    expect(state.disposed).toBe(1)
    expect(pool.getSnapshot().dracoActive).toBe(false)
    const again = await pool.lease(['draco'])
    expect(state.created).toBe(2)
    again.release()
    pool.dispose()
    expect(state.disposed).toBe(2)
  })

  it('keeps a decoder alive when a new lease arrives before the idle timer fires', async () => {
    const state: FakeLoaderState = { created: 0, disposed: 0 }
    const timers = manualTimers()
    const pool = new Cinema2ThreeDecoderPool({ modules: fakeModules(state), setTimer: timers.setTimer, clearTimer: timers.clearTimer })
    ;(await pool.lease(['ktx2'])).release()
    expect(timers.pending()).toBe(1)
    const lease = await pool.lease(['ktx2'])
    expect(timers.pending()).toBe(0)
    timers.fire()
    expect(state.disposed).toBe(0)
    lease.release()
  })

  it('points KTX2 at the bundled transcoder and reports no hardware formats until a renderer registers', async () => {
    const state: FakeLoaderState = { created: 0, disposed: 0 }
    const pool = new Cinema2ThreeDecoderPool({ modules: fakeModules(state) })
    ;(await pool.lease(['ktx2'])).release()
    expect(state.transcoderPath).toBe(CINEMA2_BASIS_TRANSCODER_PATH)
    expect((state.support as { extensions: { has(name: string): boolean } }).extensions.has('WEBGL_compressed_texture_s3tc')).toBe(false)
    pool.dispose()
    const renderer = { extensions: { has: () => true, get: () => ({}) } }
    registerCinema2DecoderRenderer(renderer as never)
    ;(await pool.lease(['ktx2'])).release()
    expect(state.support).toBe(renderer)
    pool.dispose()
  })

  it('turns a failed decoder download into a typed error and leaves no lease behind', async () => {
    const pool = new Cinema2ThreeDecoderPool({ modules: fakeModules({ created: 0, disposed: 0 }, { draco: true }) })
    await expect(pool.lease(['draco'])).rejects.toMatchObject({ code: 'CINEMA2_DRACO_DECODER_UNAVAILABLE' })
    expect(pool.getSnapshot().dracoLeases).toBe(0)
  })

  it('serves bundled decoder paths that exist on disk and match the installed Three.js', () => {
    for (const path of [`${CINEMA2_DRACO_DECODER_PATH}draco_wasm_wrapper.js`, `${CINEMA2_DRACO_DECODER_PATH}draco_decoder.wasm`, `${CINEMA2_BASIS_TRANSCODER_PATH}basis_transcoder.js`, `${CINEMA2_BASIS_TRANSCODER_PATH}basis_transcoder.wasm`]) {
      expect(readFileSync(join(process.cwd(), 'public', path)).byteLength).toBeGreaterThan(1000)
    }
  })
})

describe('cache wiring for compressed models', () => {
  function fakeGltfLibrary(calls: string[]): Cinema2ThreeLibrary {
    class FakeGltfLoader {
      setMeshoptDecoder() { calls.push('meshopt'); return this }
      setDRACOLoader(loader: unknown) { calls.push(`draco:${(loader as { id: string }).id}`); return this }
      setKTX2Loader(loader: unknown) { calls.push(`ktx2:${(loader as { id: string }).id}`); return this }
      async parseAsync() { calls.push('parse'); return { scene: new THREE.Group(), animations: [], asset: {} } }
    }
    return { THREE, GLTFLoader: FakeGltfLoader, MeshoptDecoder: {} } as unknown as Cinema2ThreeLibrary
  }
  const decoderPool = (released: string[]) => ({
    lease: async (kinds: string[]) => ({
      loaders: { ...(kinds.includes('draco') ? { draco: { id: 'D' } } : {}), ...(kinds.includes('ktx2') ? { ktx2: { id: 'K' } } : {}) },
      release: () => { released.push(kinds.join('+')) },
    }),
  }) as unknown as Cinema2ThreeDecoderPool

  it('leases only the decoders the file declares, hands them to the loader and releases the lease', async () => {
    stubFetch({ '/m/draco.glb': fixture('fixture-draco.glb'), '/m/ktx2.glb': fixture('fixture-ktx2.glb'), '/m/plain.glb': fixture('fixture-plain.glb') })
    const calls: string[] = []
    const released: string[] = []
    const cache = new Cinema2ThreeAssetCache(registry([{ id: 'draco', url: '/m/draco.glb', compression: 'draco' }, { id: 'ktx2', url: '/m/ktx2.glb', textureCompression: 'ktx2' }, { id: 'plain', url: '/m/plain.glb' }]), { decoders: decoderPool(released) })
    const library = fakeGltfLibrary(calls)
    await cache.acquire(library, 'plain', 'high')
    expect(calls).toEqual(['parse'])
    expect(released).toEqual([])
    calls.length = 0
    await cache.acquire(library, 'draco', 'high')
    expect(calls).toEqual(['draco:D', 'parse'])
    calls.length = 0
    await cache.acquire(library, 'ktx2', 'high')
    expect(calls).toEqual(['ktx2:K', 'parse'])
    expect(released).toEqual(['draco', 'ktx2'])
  })

  it('releases the lease even when parsing fails', async () => {
    stubFetch({ '/m/draco.glb': fixture('fixture-draco.glb') })
    const released: string[] = []
    class Failing { setMeshoptDecoder() { return this } setDRACOLoader() { return this } async parseAsync(): Promise<never> { throw new Error('corrupt draco stream') } }
    const cache = new Cinema2ThreeAssetCache(registry([{ id: 'draco', url: '/m/draco.glb', compression: 'draco' }]), { decoders: decoderPool(released) })
    const error = await cache.acquire({ THREE, GLTFLoader: Failing, MeshoptDecoder: {} } as unknown as Cinema2ThreeLibrary, 'draco', 'high').catch(caught => caught)
    expect((error as Cinema2ThreeAssetError).code).toBe('CINEMA2_THREE_ASSET_LOAD_FAILED')
    expect((error as Error).message).toMatch(/corrupt draco stream/)
    expect(released).toEqual(['draco'])
  })
})

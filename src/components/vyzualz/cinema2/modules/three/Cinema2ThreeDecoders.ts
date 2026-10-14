import type * as ThreeNamespace from 'three'
import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

/**
 * Lazy, leased access to the optional model decoders: Draco (geometry) and Basis Universal / KTX2 (textures), plus the EXR environment loader.
 *
 * - Every decoder is a dynamic `import()`, so none of them is downloaded or parsed until a model or environment that needs it is loaded.
 * - The WASM decoders are served from `/cinema2/decoders/` (copied from the installed Three.js by `npm run cinema2:decoders:sync`), never from a
 *   CDN, so they work offline, on Vercel and in the Electron app.
 * - Loaders own worker threads, so they are leased: `lease()` hands out the shared loaders and counts the caller; `release()` ends the lease, and
 *   a loader that has been idle for `idleMs` is disposed (workers terminated) and recreated on the next lease. Textures and geometry already
 *   decoded are independent of the loaders and are not affected.
 * - KTX2 needs to know which compressed texture formats the GPU can sample. The shared Three renderer registers itself here when it is created
 *   (`registerCinema2DecoderRenderer`); with no renderer the loader reports no hardware formats and Basis transcodes to plain RGBA, which every GPU
 *   can use, so a KTX2 asset always loads, just at a higher memory cost.
 */
export const CINEMA2_DECODER_BASE_PATH = '/cinema2/decoders/'
export const CINEMA2_DRACO_DECODER_PATH = `${CINEMA2_DECODER_BASE_PATH}draco/`
export const CINEMA2_BASIS_TRANSCODER_PATH = `${CINEMA2_DECODER_BASE_PATH}basis/`

export type Cinema2DecoderKind = 'draco' | 'ktx2'

/** The extensions a model declares that need a decoder this module provides. */
export const CINEMA2_DECODER_EXTENSIONS: Readonly<Record<string, Cinema2DecoderKind>> = Object.freeze({
  KHR_draco_mesh_compression: 'draco',
  KHR_texture_basisu: 'ktx2',
})

export class Cinema2ThreeDecoderError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'Cinema2ThreeDecoderError'
  }
}

type RendererLike = Pick<ThreeNamespace.WebGLRenderer, 'extensions'>
let supportRenderer: RendererLike | null = null

/** The shared renderer tells the KTX2 loader which compressed texture formats the GPU can sample. */
export function registerCinema2DecoderRenderer(renderer: RendererLike | null): void {
  supportRenderer = renderer
}

/** Forgets a renderer (its context was lost) unless a newer one has already replaced it. */
export function unregisterCinema2DecoderRenderer(renderer: RendererLike): void {
  if (supportRenderer === renderer) supportRenderer = null
}

const NO_HARDWARE_FORMATS: RendererLike = {
  extensions: { has: () => false, get: () => null } as unknown as ThreeNamespace.WebGLRenderer['extensions'],
}

export interface Cinema2DecoderLoaders {
  draco?: DRACOLoader
  ktx2?: KTX2Loader
}

export interface Cinema2DecoderLease {
  readonly loaders: Readonly<Cinema2DecoderLoaders>
  release(): void
}

export interface Cinema2DecoderModuleLoaders {
  loadDraco(): Promise<typeof DRACOLoader>
  loadKtx2(): Promise<typeof KTX2Loader>
}

const defaultModuleLoaders: Cinema2DecoderModuleLoaders = {
  loadDraco: async () => (await import('three/examples/jsm/loaders/DRACOLoader.js')).DRACOLoader,
  loadKtx2: async () => (await import('three/examples/jsm/loaders/KTX2Loader.js')).KTX2Loader,
}

export interface Cinema2DecoderPoolOptions {
  idleMs?: number
  modules?: Cinema2DecoderModuleLoaders
  dracoPath?: string
  basisPath?: string
  /** Timer seam for tests. */
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

interface Slot<T extends { dispose(): void }> {
  loader: T | null
  creating: Promise<T> | null
  leases: number
  timer: unknown
}

export class Cinema2ThreeDecoderPool {
  private readonly idleMs: number
  private readonly modules: Cinema2DecoderModuleLoaders
  private readonly dracoPath: string
  private readonly basisPath: string
  private readonly setTimer: NonNullable<Cinema2DecoderPoolOptions['setTimer']>
  private readonly clearTimer: NonNullable<Cinema2DecoderPoolOptions['clearTimer']>
  private readonly draco: Slot<DRACOLoader> = { loader: null, creating: null, leases: 0, timer: null }
  private readonly ktx2: Slot<KTX2Loader> = { loader: null, creating: null, leases: 0, timer: null }
  private created = { draco: 0, ktx2: 0 }
  private disposedCount = 0

  constructor(options: Cinema2DecoderPoolOptions = {}) {
    this.idleMs = options.idleMs ?? 15000
    this.modules = options.modules ?? defaultModuleLoaders
    this.dracoPath = options.dracoPath ?? CINEMA2_DRACO_DECODER_PATH
    this.basisPath = options.basisPath ?? CINEMA2_BASIS_TRANSCODER_PATH
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
    this.clearTimer = options.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
  }

  /** Leases the loaders for the requested kinds, creating them on first use. Always `release()` the lease (a `finally` block is the place). */
  async lease(kinds: readonly Cinema2DecoderKind[]): Promise<Cinema2DecoderLease> {
    const wantDraco = kinds.includes('draco')
    const wantKtx2 = kinds.includes('ktx2')
    // Count the leases first so an idle timer cannot dispose a loader while its module is still loading.
    if (wantDraco) this.take(this.draco)
    if (wantKtx2) this.take(this.ktx2)
    const loaders: Cinema2DecoderLoaders = {}
    try {
      if (wantDraco) loaders.draco = await this.ensureDraco()
      if (wantKtx2) loaders.ktx2 = await this.ensureKtx2()
    } catch (error) {
      if (wantDraco) this.drop(this.draco)
      if (wantKtx2) this.drop(this.ktx2)
      throw error
    }
    let released = false
    return {
      loaders: Object.freeze(loaders),
      release: () => {
        if (released) return
        released = true
        if (wantDraco) this.drop(this.draco)
        if (wantKtx2) this.drop(this.ktx2)
      },
    }
  }

  getSnapshot(): Readonly<{ dracoActive: boolean; ktx2Active: boolean; dracoLeases: number; ktx2Leases: number; created: { draco: number; ktx2: number }; disposedCount: number }> {
    return Object.freeze({
      dracoActive: this.draco.loader != null,
      ktx2Active: this.ktx2.loader != null,
      dracoLeases: this.draco.leases,
      ktx2Leases: this.ktx2.leases,
      created: { ...this.created },
      disposedCount: this.disposedCount,
    })
  }

  /** Disposes both loaders now (workers terminated), whatever the lease count. */
  dispose(): void {
    this.destroy(this.draco)
    this.destroy(this.ktx2)
  }

  private take(slot: Slot<{ dispose(): void }>): void {
    slot.leases += 1
    if (slot.timer != null) { this.clearTimer(slot.timer); slot.timer = null }
  }

  private drop(slot: Slot<{ dispose(): void }>): void {
    slot.leases = Math.max(0, slot.leases - 1)
    if (slot.leases > 0 || (!slot.loader && !slot.creating)) return
    slot.timer = this.setTimer(() => {
      slot.timer = null
      if (slot.leases === 0) this.destroy(slot)
    }, this.idleMs)
  }

  private destroy(slot: Slot<{ dispose(): void }>): void {
    if (slot.timer != null) { this.clearTimer(slot.timer); slot.timer = null }
    const loader = slot.loader
    slot.loader = null
    slot.creating = null
    if (loader) {
      this.disposedCount += 1
      try { loader.dispose() } catch { /* The workers are already gone. */ }
    }
  }

  private ensureDraco(): Promise<DRACOLoader> {
    const slot = this.draco
    if (slot.loader) return Promise.resolve(slot.loader)
    slot.creating ??= this.modules.loadDraco().then(Loader => {
      const loader = new Loader()
      loader.setDecoderPath(this.dracoPath)
      slot.loader = loader
      this.created.draco += 1
      return loader
    }).catch(error => {
      slot.creating = null
      throw new Cinema2ThreeDecoderError('CINEMA2_DRACO_DECODER_UNAVAILABLE', `Cinema 2.0 could not load the Draco decoder: ${error instanceof Error ? error.message : String(error)}`)
    })
    return slot.creating
  }

  private ensureKtx2(): Promise<KTX2Loader> {
    const slot = this.ktx2
    if (slot.loader) return Promise.resolve(slot.loader)
    slot.creating ??= this.modules.loadKtx2().then(Loader => {
      const loader = new Loader()
      loader.setTranscoderPath(this.basisPath)
      loader.detectSupport((supportRenderer ?? NO_HARDWARE_FORMATS) as ThreeNamespace.WebGLRenderer)
      slot.loader = loader
      this.created.ktx2 += 1
      return loader
    }).catch(error => {
      slot.creating = null
      throw new Cinema2ThreeDecoderError('CINEMA2_KTX2_DECODER_UNAVAILABLE', `Cinema 2.0 could not load the KTX2 texture decoder: ${error instanceof Error ? error.message : String(error)}`)
    })
    return slot.creating
  }
}

/** The pool every model load shares. */
export const cinema2ThreeDecoderPool = new Cinema2ThreeDecoderPool()

// ---------------------------------------------------------------- GLB inspection

const GLB_MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a

export interface Cinema2GlbRequirements {
  extensionsUsed: readonly string[]
  extensionsRequired: readonly string[]
  /** Decoders the file needs, from its declared extensions. */
  decoders: readonly Cinema2DecoderKind[]
  meshopt: boolean
}

/** Reads a GLB's JSON header (no geometry is touched) to learn which decoders loading it will need. */
export function readCinema2GlbRequirements(buffer: ArrayBuffer): Cinema2GlbRequirements {
  const view = new DataView(buffer)
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Cinema2ThreeDecoderError('CINEMA2_GLB_INVALID', 'The file is not a binary glTF (GLB).')
  }
  let json: { extensionsUsed?: string[]; extensionsRequired?: string[] } = {}
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset + 8, length)))
      break
    }
    offset += 8 + length + ((4 - (length % 4)) % 4)
  }
  const used = json.extensionsUsed ?? []
  const required = json.extensionsRequired ?? []
  const decoders = new Set<Cinema2DecoderKind>()
  for (const name of [...used, ...required]) {
    const kind = CINEMA2_DECODER_EXTENSIONS[name]
    if (kind) decoders.add(kind)
  }
  return Object.freeze({
    extensionsUsed: Object.freeze([...used]),
    extensionsRequired: Object.freeze([...required]),
    decoders: Object.freeze([...decoders]),
    meshopt: used.includes('EXT_meshopt_compression') || used.includes('KHR_meshopt_compression'),
  })
}

// ---------------------------------------------------------------- EXR and skeleton helpers

let exrLoader: Promise<typeof EXRLoader> | null = null

/** Loads the EXR loader class on first use (it is only needed for `.exr` environments). */
export function loadCinema2ExrLoader(): Promise<typeof EXRLoader> {
  exrLoader ??= import('three/examples/jsm/loaders/EXRLoader.js').then(module => module.EXRLoader).catch(error => { exrLoader = null; throw error })
  return exrLoader
}

type SkeletonUtilsModule = typeof import('three/examples/jsm/utils/SkeletonUtils.js')
let skeletonUtils: Promise<SkeletonUtilsModule> | null = null

/** Loads `SkeletonUtils` (skinned-mesh clone and retarget) on first use. */
export function loadCinema2SkeletonUtils(): Promise<SkeletonUtilsModule> {
  skeletonUtils ??= import('three/examples/jsm/utils/SkeletonUtils.js').catch(error => { skeletonUtils = null; throw error })
  return skeletonUtils
}

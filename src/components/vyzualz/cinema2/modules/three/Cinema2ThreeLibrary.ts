import type * as ThreeNamespace from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Lazy loader for Three.js. Nothing here is imported statically by product code: the dynamic `import()` calls below are
 * the only references, so Vite keeps Three in separate chunks that are fetched the first time a preset that includes the
 * `three-scene` module activates. Presets that never use it never download or parse Three.
 */
export interface Cinema2ThreeLibrary {
  readonly THREE: typeof ThreeNamespace
  readonly GLTFLoader: typeof GLTFLoader
  /** Meshopt decoder (a single inline module: no worker, no file paths, works offline). */
  readonly MeshoptDecoder: { supported: boolean; ready: Promise<void>; decode: (...args: never[]) => unknown }
  /** Procedural studio environment used for image-based lighting until a shipped HDR environment exists. */
  readonly RoomEnvironment: new () => ThreeNamespace.Scene & { dispose(): void }
}

export type Cinema2ThreeLibraryLoader = () => Promise<Cinema2ThreeLibrary>

const defaultLoader: Cinema2ThreeLibraryLoader = async () => {
  const [THREE, gltf, meshopt, room] = await Promise.all([
    import('three'),
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
  ])
  return Object.freeze({
    THREE,
    GLTFLoader: gltf.GLTFLoader,
    MeshoptDecoder: meshopt.MeshoptDecoder as unknown as Cinema2ThreeLibrary['MeshoptDecoder'],
    RoomEnvironment: room.RoomEnvironment as unknown as Cinema2ThreeLibrary['RoomEnvironment'],
  })
}

let loader: Cinema2ThreeLibraryLoader = defaultLoader
let pending: Promise<Cinema2ThreeLibrary> | null = null
let loaded: Cinema2ThreeLibrary | null = null

/** Loads Three once. A failed load is not cached, so a later preset activation can retry. */
export function loadCinema2ThreeLibrary(): Promise<Cinema2ThreeLibrary> {
  if (loaded) return Promise.resolve(loaded)
  if (!pending) {
    pending = loader().then(
      library => { loaded = library; return library },
      error => { pending = null; throw error },
    )
  }
  return pending
}

/** Synchronous access once the library has loaded (null before). */
export function getLoadedCinema2ThreeLibrary(): Cinema2ThreeLibrary | null {
  return loaded
}

/** Test seam: replace the loader (and forget any loaded library). */
export function setCinema2ThreeLibraryLoaderForTests(next: Cinema2ThreeLibraryLoader | null): void {
  loader = next ?? defaultLoader
  pending = null
  loaded = null
}

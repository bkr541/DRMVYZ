import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { cinema2RenderQualityProfile } from '../../render/Cinema2RenderQualityProfiles'
import { loadCinema2ExrLoader } from './Cinema2ThreeDecoders'
import { cinema2ThreeEnvironmentRegistry, CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID, CINEMA2_STUDIO_GEM_ENVIRONMENT_ASSET_ID, CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from './Cinema2ThreeEnvironmentRegistry'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'

/**
 * Reusable environment (image-based lighting) profiles for future scenes: which shipped environment, how bright, how it is rotated, and whether
 * it also shows as the background, plus a loader that filters the environment into PMREM reflections once per renderer and quality tier.
 *
 * Supports Radiance `.hdr` (what the shipped environments use) and OpenEXR `.exr`. The file is parsed as 32-bit float, optionally box-downsampled
 * to the tier's `environment.maxSourceWidth` (PMREM resolution follows the source width), converted to half float and filtered by
 * `PMREMGenerator`. Results are cached per renderer, keyed by URL and width, so switching scenes or presets never filters the same environment
 * twice. The cache is tied to the renderer object, which the host replaces after a context loss, so a restored context starts clean.
 *
 * `Cinema2ThreeRendererHost.loadEnvironment` keeps serving the existing presets unchanged.
 */
export type Cinema2EnvironmentVec3 = readonly [x: number, y: number, z: number]

export interface Cinema2EnvironmentProfile {
  id: string
  /** Id of a registered environment asset (`assets/cinema2/<id>/asset.json`, kind `environment`). */
  assetId: string
  /** `scene.environmentIntensity`. */
  intensity: number
  /** Rotation of the environment in degrees about each axis (yaw is Y). */
  rotationDegrees?: Cinema2EnvironmentVec3
  /** Also draw the environment as the scene background. */
  background?: Readonly<{ blurriness?: number; intensity?: number }>
}

/** The shipped studio environments as profiles. They describe the existing assets; no preset is changed by their existence. */
export const CINEMA2_ENVIRONMENT_PROFILES: Readonly<Record<string, Readonly<Cinema2EnvironmentProfile>>> = Object.freeze({
  'studio': Object.freeze({ id: 'studio', assetId: CINEMA2_STUDIO_ENVIRONMENT_ASSET_ID, intensity: 1 }),
  'studio-neutral': Object.freeze({ id: 'studio-neutral', assetId: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID, intensity: 1 }),
  'studio-gem': Object.freeze({ id: 'studio-gem', assetId: CINEMA2_STUDIO_GEM_ENVIRONMENT_ASSET_ID, intensity: 1 }),
})

/** Profiles added at runtime (future environments) share the same lookup. */
export class Cinema2EnvironmentProfileRegistry {
  private readonly profiles = new Map<string, Readonly<Cinema2EnvironmentProfile>>(Object.entries(CINEMA2_ENVIRONMENT_PROFILES))

  register(profile: Cinema2EnvironmentProfile): void {
    if (!profile.id.trim()) throw new Error('Cinema 2.0 environment profile ids must be non-empty.')
    if (this.profiles.has(profile.id)) throw new Error(`Cinema 2.0 environment profile "${profile.id}" is already registered.`)
    if (!cinema2ThreeEnvironmentRegistry.has(profile.assetId)) throw new Error(`Cinema 2.0 environment profile "${profile.id}" names "${profile.assetId}", which is not a registered environment asset.`)
    this.profiles.set(profile.id, Object.freeze({ ...profile }))
  }

  get(id: string): Readonly<Cinema2EnvironmentProfile> | null {
    return this.profiles.get(id) ?? null
  }

  list(): readonly Readonly<Cinema2EnvironmentProfile>[] {
    return Object.freeze([...this.profiles.values()])
  }
}

export const cinema2EnvironmentProfiles = new Cinema2EnvironmentProfileRegistry()

// ---------------------------------------------------------------- downsampling

/**
 * Box-downsamples an equirectangular RGBA float image by an integer factor (each output pixel is the mean of a factor x factor block, in linear
 * light). Used to bring a wide source down to the quality tier's environment width before filtering.
 */
export function downsampleEquirectangular(data: Float32Array, width: number, height: number, factor: number): { data: Float32Array; width: number; height: number } {
  if (!Number.isInteger(factor) || factor < 1) throw new Error('Downsample factor must be a positive integer.')
  if (factor === 1) return { data, width, height }
  const outWidth = Math.floor(width / factor)
  const outHeight = Math.floor(height / factor)
  const out = new Float32Array(outWidth * outHeight * 4)
  const area = factor * factor
  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      let r = 0, g = 0, b = 0, a = 0
      for (let dy = 0; dy < factor; dy += 1) {
        let index = ((y * factor + dy) * width + x * factor) * 4
        for (let dx = 0; dx < factor; dx += 1, index += 4) {
          r += data[index]!
          g += data[index + 1]!
          b += data[index + 2]!
          a += data[index + 3]!
        }
      }
      const o = (y * outWidth + x) * 4
      out[o] = r / area
      out[o + 1] = g / area
      out[o + 2] = b / area
      out[o + 3] = a / area
    }
  }
  return { data: out, width: outWidth, height: outHeight }
}

/** The integer factor that brings `width` to at most `maxWidth`. */
export function environmentDownsampleFactor(width: number, maxWidth: number): number {
  if (width <= maxWidth) return 1
  return Math.max(1, Math.ceil(width / maxWidth))
}

// ---------------------------------------------------------------- loading

export type Cinema2EnvironmentFormat = 'hdr' | 'exr'

export function cinema2EnvironmentFormat(url: string): Cinema2EnvironmentFormat | null {
  const path = url.split(/[?#]/)[0]!.toLowerCase()
  return path.endsWith('.hdr') ? 'hdr' : path.endsWith('.exr') ? 'exr' : null
}

const EXR_MAGIC = 0x01312f76

function ensureFormatMatches(url: string, format: Cinema2EnvironmentFormat, buffer: ArrayBuffer): void {
  if (format === 'exr') {
    if (buffer.byteLength < 8 || new DataView(buffer).getUint32(0, true) !== EXR_MAGIC) throw new Error(`Environment "${url}" is not an OpenEXR file.`)
    return
  }
  const head = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))
  if (!/^#\?(RADIANCE|RGBE)/.test(head)) throw new Error(`Environment "${url}" is not a Radiance .hdr file.`)
}

interface ParsedImage { data: ArrayBufferView; width: number; height: number }

const caches = new WeakMap<object, Map<string, Promise<ThreeNamespace.Texture>>>()

export interface Cinema2LoadEnvironmentOptions {
  tier: Cinema2RenderQualityLevel
  /** Overrides the tier's `environment.maxSourceWidth`. */
  maxSourceWidth?: number
}

/**
 * Loads an environment URL (`.hdr` or `.exr`) into a PMREM texture for `renderer`, cached per renderer. Rejects (and forgets the failure, so a
 * later call retries) when the file is missing, is not the format its extension claims, or cannot be decoded.
 */
export function loadCinema2EnvironmentTexture(
  library: Cinema2ThreeLibrary,
  renderer: ThreeNamespace.WebGLRenderer,
  url: string,
  options: Readonly<Cinema2LoadEnvironmentOptions>,
): Promise<ThreeNamespace.Texture> {
  const maxWidth = options.maxSourceWidth ?? cinema2RenderQualityProfile(options.tier).environment.maxSourceWidth
  const key = `${url}@${maxWidth}`
  let cache = caches.get(renderer)
  if (!cache) { cache = new Map(); caches.set(renderer, cache) }
  const existing = cache.get(key)
  if (existing) return existing
  const pending = (async () => {
    const format = cinema2EnvironmentFormat(url)
    if (!format) throw new Error(`Environment "${url}" must be a .hdr or .exr file.`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Environment request for "${url}" failed with HTTP ${response.status}.`)
    const buffer = await response.arrayBuffer()
    ensureFormatMatches(url, format, buffer)
    const { THREE } = library
    let parsed: ParsedImage
    if (format === 'hdr') {
      const loader = new library.HDRLoader()
      loader.setDataType(THREE.FloatType)
      parsed = loader.parse(buffer) as unknown as ParsedImage
    } else {
      const Exr = await loadCinema2ExrLoader()
      const loader = new Exr()
      loader.setDataType(THREE.FloatType)
      parsed = loader.parse(buffer) as unknown as ParsedImage
    }
    const floats = parsed.data instanceof Float32Array ? parsed.data : Float32Array.from(parsed.data as unknown as ArrayLike<number>)
    const factor = environmentDownsampleFactor(parsed.width, maxWidth)
    const reduced = downsampleEquirectangular(floats, parsed.width, parsed.height, factor)
    const half = new Uint16Array(reduced.data.length)
    for (let index = 0; index < half.length; index += 1) half[index] = THREE.DataUtils.toHalfFloat(reduced.data[index]!)
    const source = new THREE.DataTexture(half, reduced.width, reduced.height, THREE.RGBAFormat, THREE.HalfFloatType)
    source.mapping = THREE.EquirectangularReflectionMapping
    source.minFilter = THREE.LinearFilter
    source.magFilter = THREE.LinearFilter
    source.generateMipmaps = false
    source.flipY = true
    source.needsUpdate = true
    const generator = new THREE.PMREMGenerator(renderer)
    const target = generator.fromEquirectangular(source)
    source.dispose()
    generator.dispose()
    renderer.resetState()
    return target.texture
  })()
  pending.catch(() => { if (cache!.get(key) === pending) cache!.delete(key) })
  cache.set(key, pending)
  return pending
}

/** Resolves a registered environment asset id (and the tier's variant) to a texture. */
export function loadCinema2EnvironmentAsset(
  library: Cinema2ThreeLibrary,
  renderer: ThreeNamespace.WebGLRenderer,
  assetId: string,
  options: Readonly<Cinema2LoadEnvironmentOptions>,
): Promise<ThreeNamespace.Texture> {
  const url = cinema2ThreeEnvironmentRegistry.resolveUrl(assetId, options.tier)
  if (!url) return Promise.reject(new Error(`Cinema 2.0 has no shipped environment "${assetId}".`))
  return loadCinema2EnvironmentTexture(library, renderer, url, options)
}

/** Frees the cached environments of a renderer (their GPU textures). Call when the scene using them is done and nothing else will need them. */
export async function disposeCinema2EnvironmentCache(renderer: ThreeNamespace.WebGLRenderer): Promise<void> {
  const cache = caches.get(renderer)
  if (!cache) return
  caches.delete(renderer)
  for (const pending of cache.values()) {
    try { (await pending).dispose() } catch { /* A failed load has nothing to free. */ }
  }
}

// ---------------------------------------------------------------- applying

/** Applies a profile to a scene: lighting texture, intensity, rotation and optional background. Pass `texture` from `loadCinema2Environment*`. */
export function applyCinema2EnvironmentProfile(
  THREE: typeof ThreeNamespace,
  scene: ThreeNamespace.Scene,
  texture: ThreeNamespace.Texture,
  profile: Readonly<Pick<Cinema2EnvironmentProfile, 'intensity' | 'rotationDegrees' | 'background'>>,
): void {
  scene.environment = texture
  scene.environmentIntensity = profile.intensity
  const [x, y, z] = profile.rotationDegrees ?? [0, 0, 0]
  const rotation = new THREE.Euler(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z))
  scene.environmentRotation.copy(rotation)
  if (profile.background) {
    scene.background = texture
    scene.backgroundBlurriness = profile.background.blurriness ?? 0
    scene.backgroundIntensity = profile.background.intensity ?? profile.intensity
    scene.backgroundRotation.copy(rotation)
  } else if (scene.background === texture) {
    scene.background = null
  }
}

/** Updates only intensity / rotation (cheap, per-frame safe: no texture work). */
export function setCinema2EnvironmentTransform(
  THREE: typeof ThreeNamespace,
  scene: ThreeNamespace.Scene,
  transform: Readonly<{ intensity?: number; rotationDegrees?: Cinema2EnvironmentVec3 }>,
): void {
  if (transform.intensity !== undefined) scene.environmentIntensity = transform.intensity
  if (transform.rotationDegrees) {
    const [x, y, z] = transform.rotationDegrees
    scene.environmentRotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z))
  }
}

import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2TextureAssetRegistry, type Cinema2TextureAssetLayout } from './Cinema2TextureAssetRegistry'

export type Cinema2TextureStatus = 'loading' | 'ready' | 'failed'

/** A decoded image ready for upload. `close` frees decoder memory once the pixels are on the GPU. */
export interface Cinema2DecodedTextureImage {
  source: TexImageSource
  width: number
  height: number
  close?(): void
}

export type Cinema2TextureImageLoader = (url: string) => Promise<Cinema2DecodedTextureImage>

export interface Cinema2AssetTextureServiceOptions {
  /** Upper bound for all shipped textures held on the GPU. A texture that would exceed it fails with a diagnostic instead of loading. */
  budgetBytes?: number
  /** Replaceable so tests and non-browser hosts do not need `fetch`/`createImageBitmap`. */
  loader?: Cinema2TextureImageLoader
}

export interface Cinema2TextureHandle {
  readonly assetId: string
  readonly status: Cinema2TextureStatus
  /** The GL texture once `status` is `ready`; sampling it before then is a bug, so effects must check `status`. */
  readonly texture: WebGLTexture | null
  readonly width: number
  readonly height: number
  /** Idempotent. The GL texture is deleted when the last handle for it is released. */
  release(): void
}

export interface Cinema2TextureEntrySnapshot {
  assetId: string
  url: string
  status: Cinema2TextureStatus
  references: number
  width: number
  height: number
  estimatedGpuBytes: number
  error: string | null
}

export interface Cinema2AssetTextureServiceSnapshot {
  disposed: boolean
  budgetBytes: number
  estimatedGpuBytes: number
  textureCount: number
  failedTextureCount: number
  entries: readonly Readonly<Cinema2TextureEntrySnapshot>[]
}

interface TextureEntry {
  key: string
  assetId: string
  url: string
  layout: Cinema2TextureAssetLayout
  status: Cinema2TextureStatus
  references: number
  texture: WebGLTexture | null
  width: number
  height: number
  estimatedGpuBytes: number
  error: string | null
  generation: number
}

const DEFAULT_BUDGET_BYTES = 48 * 1024 * 1024
/** A full mip chain adds a third on top of the base level. */
const MIP_CHAIN_FACTOR = 4 / 3
const MAX_ANISOTROPY = 8

/**
 * Engine-owned loader for shipped 2D textures (native effects and modules; Three.js loads its own model textures).
 *
 * Assets are referenced by id through the texture registry. An acquire returns immediately with a handle whose `status`
 * moves loading -> ready | failed; the image is fetched and decoded off the render path, then uploaded in one call between
 * frames (mipmaps, anisotropic filtering, repeat wrap). Textures are reference counted per (asset, quality variant),
 * budgeted, and deleted with their last handle. A missing file, a non-image response or a busted budget produces a
 * diagnostic and a `failed` handle; the effect keeps running without the texture.
 */
export class Cinema2AssetTextureService {
  private readonly entries = new Map<string, TextureEntry>()
  private readonly loader: Cinema2TextureImageLoader
  private budgetBytes: number
  private disposed = false
  private contextAvailable = true
  private generation = 0

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly registry: Cinema2TextureAssetRegistry,
    options: Cinema2AssetTextureServiceOptions = {},
  ) {
    this.loader = options.loader ?? loadCinema2TextureImage
    this.budgetBytes = positive(options.budgetBytes, DEFAULT_BUDGET_BYTES)
  }

  setBudgetBytes(bytes: number): void {
    this.budgetBytes = positive(bytes, this.budgetBytes)
  }

  acquire(assetId: string, quality: Cinema2RenderQualityLevel): Cinema2TextureHandle {
    const resolved = this.disposed ? null : this.registry.resolve(assetId, quality)
    const key = resolved ? `${resolved.id}|${resolved.url}` : `missing|${assetId}`
    let entry = this.entries.get(key)
    if (!entry) {
      entry = {
        key,
        assetId,
        url: resolved?.url ?? '',
        layout: resolved?.layout ?? 'color',
        status: resolved ? 'loading' : 'failed',
        references: 0,
        texture: null,
        width: resolved?.width ?? 0,
        height: resolved?.height ?? 0,
        estimatedGpuBytes: 0,
        error: resolved ? null : this.disposed ? 'The texture service was disposed.' : `Texture asset "${assetId}" is not registered.`,
        generation: this.generation,
      }
      this.entries.set(key, entry)
      if (resolved) this.startLoad(entry)
    }
    entry.references += 1
    return this.createHandle(entry)
  }

  /** The GL context is gone: every GL object is already invalid, so forget them without deleting. Owners re-acquire after restore. */
  handleContextLost(): void {
    if (this.disposed) return
    this.contextAvailable = false
    this.generation += 1
    for (const entry of this.entries.values()) {
      entry.texture = null
      entry.estimatedGpuBytes = 0
      if (entry.status === 'ready' || entry.status === 'loading') entry.status = 'loading'
    }
  }

  /** Re-uploads every texture that still has an owner. */
  handleContextRestored(): void {
    if (this.disposed) return
    this.contextAvailable = true
    for (const entry of [...this.entries.values()]) {
      if (entry.references <= 0) {
        this.entries.delete(entry.key)
        continue
      }
      if (entry.url && entry.status === 'loading') this.startLoad(entry)
    }
  }

  getSnapshot(): Readonly<Cinema2AssetTextureServiceSnapshot> {
    const entries = [...this.entries.values()]
      .sort((left, right) => left.key.localeCompare(right.key))
      .map(entry => Object.freeze({
        assetId: entry.assetId,
        url: entry.url,
        status: entry.status,
        references: entry.references,
        width: entry.width,
        height: entry.height,
        estimatedGpuBytes: entry.estimatedGpuBytes,
        error: entry.error,
      }))
    return Object.freeze({
      disposed: this.disposed,
      budgetBytes: this.budgetBytes,
      estimatedGpuBytes: entries.reduce((sum, entry) => sum + entry.estimatedGpuBytes, 0),
      textureCount: entries.filter(entry => entry.status === 'ready').length,
      failedTextureCount: entries.filter(entry => entry.status === 'failed').length,
      entries: Object.freeze(entries),
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.generation += 1
    for (const entry of this.entries.values()) this.deleteTexture(entry)
    this.entries.clear()
  }

  private createHandle(entry: TextureEntry): Cinema2TextureHandle {
    let released = false
    return {
      assetId: entry.assetId,
      get status() { return released ? 'failed' : entry.status },
      get texture() { return released ? null : entry.texture },
      get width() { return entry.width },
      get height() { return entry.height },
      release: () => {
        if (released) return
        released = true
        entry.references -= 1
        if (entry.references > 0) return
        this.deleteTexture(entry)
        if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key)
      },
    }
  }

  private startLoad(entry: TextureEntry): void {
    const generation = this.generation
    entry.generation = generation
    entry.status = 'loading'
    entry.error = null
    void this.loader(entry.url).then(
      image => {
        try {
          if (this.disposed || generation !== this.generation || entry.references <= 0 || !this.contextAvailable) return
          this.upload(entry, image)
        } catch (error) {
          this.failEntry(entry, error)
        } finally {
          image.close?.()
        }
      },
      error => {
        if (this.disposed || generation !== this.generation || entry.references <= 0) return
        this.failEntry(entry, error)
      },
    )
  }

  private upload(entry: TextureEntry, image: Cinema2DecodedTextureImage): void {
    const { gl } = this
    const bytes = Math.round(image.width * image.height * 4 * MIP_CHAIN_FACTOR)
    const others = this.snapshotBytesExcluding(entry)
    if (others + bytes > this.budgetBytes) {
      throw new Error(`Texture "${entry.assetId}" (${formatMegabytes(bytes)}) would exceed the ${formatMegabytes(this.budgetBytes)} texture budget.`)
    }
    const maxSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 2048
    if (image.width > maxSize || image.height > maxSize) {
      throw new Error(`Texture "${entry.assetId}" is ${image.width}x${image.height}, above the ${maxSize}px GPU limit.`)
    }

    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
    const previousUnit = gl.getParameter(gl.ACTIVE_TEXTURE) as number
    const texture = gl.createTexture()
    if (!texture) throw new Error('Cinema 2.0 could not allocate a texture.')
    try {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      // Colour textures are stored as sRGB so sampling returns linear values; data layouts must stay untouched.
      const internalFormat = entry.layout === 'color' ? gl.SRGB8_ALPHA8 : gl.RGBA8
      gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.source)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      const anisotropic = gl.getExtension('EXT_texture_filter_anisotropic')
      if (anisotropic) {
        const max = Number(gl.getParameter(anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 1
        gl.texParameterf(gl.TEXTURE_2D, anisotropic.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(MAX_ANISOTROPY, max))
      }
      const error = gl.getError()
      if (error !== gl.NO_ERROR) throw new Error(`Texture upload for "${entry.assetId}" failed with GL error 0x${error.toString(16)}.`)
    } catch (error) {
      gl.deleteTexture(texture)
      throw error
    } finally {
      gl.bindTexture(gl.TEXTURE_2D, previousTexture)
      gl.activeTexture(previousUnit)
    }
    entry.texture = texture
    entry.width = image.width
    entry.height = image.height
    entry.estimatedGpuBytes = bytes
    entry.status = 'ready'
  }

  private failEntry(entry: TextureEntry, error: unknown): void {
    entry.status = 'failed'
    entry.error = error instanceof Error ? error.message : String(error)
    entry.estimatedGpuBytes = 0
    this.deleteTexture(entry)
  }

  private deleteTexture(entry: TextureEntry): void {
    if (entry.texture && this.contextAvailable) this.gl.deleteTexture(entry.texture)
    entry.texture = null
    entry.estimatedGpuBytes = 0
  }

  private snapshotBytesExcluding(entry: TextureEntry): number {
    let total = 0
    for (const other of this.entries.values()) if (other !== entry) total += other.estimatedGpuBytes
    return total
  }
}

/** Fetches a shipped image and decodes it without colour management or alpha premultiplication, so data channels survive intact. */
export async function loadCinema2TextureImage(url: string): Promise<Cinema2DecodedTextureImage> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Texture request for "${url}" failed with HTTP ${response.status}.`)
  // A dev server or the app protocol can answer a missing file with an HTML fallback page and status 200.
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType && !/^image\//i.test(contentType)) throw new Error(`Texture request for "${url}" returned "${contentType}", not an image.`)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

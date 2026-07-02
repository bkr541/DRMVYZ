import type { BrandKit, BrandKitAssetWithMedia, BrandAssetRole } from '../../../../../features/personalization/BrandKitTypes'
import {
  getBrandAssetCacheSnapshot,
  preloadBrandAssets,
} from '../../../../../features/personalization/brandAssetRuntime'
import type { ShaderProgram } from '../runtime/ShaderProgram'
import { getShaderReservedTextureUnits } from '../runtime/shaderTextureUnits'

interface BrandTextureSlot {
  texture: WebGLTexture
  mediaItemId: string | null
  updatedAt: number
  available: boolean
  aspect: number
  scale: number
  opacity: number
}

type SlotName = 'logo' | 'texture' | 'background'

const ROLE_PRIORITY: Readonly<Record<SlotName, readonly BrandAssetRole[]>> = {
  logo: ['primaryLogo', 'wordmark', 'monogram', 'secondaryLogo', 'watermark'],
  texture: ['texture', 'keyArt'],
  background: ['background', 'keyArt'],
}

/**
 * Uploads decoded Brand Kit assets into three universal Shader ENGINE samplers.
 * Asset decoding remains owned by the shared Brand Kit runtime cache.
 */
export class ShaderBrandTextureBridge {
  private readonly _slots: Record<SlotName, BrandTextureSlot>
  private _preloadSignature = ''

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._slots = {
      logo: this._createSlot(),
      texture: this._createSlot(),
      background: this._createSlot(),
    }
  }

  update(
    kit: Readonly<BrandKit> | null | undefined,
    assets: readonly BrandKitAssetWithMedia[],
    enabled = true,
  ): void {
    if (!enabled || !kit || kit.autoApply === false) {
      this._clearAvailability()
      return
    }

    const signature = `${kit.userId}:${assets.map(asset => `${asset.id}:${asset.updatedAt}`).join('|')}`
    if (signature !== this._preloadSignature) {
      this._preloadSignature = signature
      preloadBrandAssets({ userId: kit.userId, assets })
    }

    const cache = getBrandAssetCacheSnapshot()
      .filter(entry => entry.userId === kit.userId)

    for (const slotName of Object.keys(this._slots) as SlotName[]) {
      const asset = pickAsset(assets, ROLE_PRIORITY[slotName])
      const runtime = asset
        ? cache.find(entry => entry.mediaItemId === asset.mediaItemId) ?? null
        : null
      if (!asset || !runtime?.image || (runtime.status !== 'ready' && runtime.status !== 'stale')) {
        this._slots[slotName].available = false
        continue
      }

      const slot = this._slots[slotName]
      if (slot.mediaItemId !== asset.mediaItemId || slot.updatedAt !== runtime.updatedAt) {
        this._upload(slot, runtime.image)
        slot.mediaItemId = asset.mediaItemId
        slot.updatedAt = runtime.updatedAt
      }
      slot.available = true
      slot.scale = clampFinite(asset.presentation?.scale ?? 1, 0.01, 10, 1)
      slot.opacity = clampFinite(asset.presentation?.opacity ?? 1, 0, 1, 1)
    }
  }

  applyToProgram(program: ShaderProgram): void {
    const gl = this._gl
    const units = getShaderReservedTextureUnits(gl)
    this._bindSlot(program, 'logo', units.brandLogo, 'uBrandLogoTexture', 'uBrandLogo')
    this._bindSlot(program, 'texture', units.brandTexture, 'uBrandTexture', 'uBrandTexture')
    this._bindSlot(program, 'background', units.brandBackground, 'uBrandBackgroundTexture', 'uBrandBackground')
  }

  dispose(): void {
    for (const slot of Object.values(this._slots)) this._gl.deleteTexture(slot.texture)
  }

  private _createSlot(): BrandTextureSlot {
    const gl = this._gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Unable to create Shader Brand Kit texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return {
      texture,
      mediaItemId: null,
      updatedAt: 0,
      available: false,
      aspect: 1,
      scale: 1,
      opacity: 1,
    }
  }

  private _upload(slot: BrandTextureSlot, image: CanvasImageSource): void {
    const gl = this._gl
    const dimensions = getImageDimensions(image)
    gl.bindTexture(gl.TEXTURE_2D, slot.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image as TexImageSource,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
    slot.aspect = dimensions.height > 0 ? dimensions.width / dimensions.height : 1
  }

  private _bindSlot(
    program: ShaderProgram,
    slotName: SlotName,
    unit: number,
    samplerName: string,
    metadataPrefix: string,
  ): void {
    const gl = this._gl
    const slot = this._slots[slotName]
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, slot.texture)
    program.setSampler(samplerName, unit)
    program.setFloat(`${metadataPrefix}Available`, slot.available ? 1 : 0)
    program.setFloat(`${metadataPrefix}Aspect`, slot.aspect)
    program.setFloat(`${metadataPrefix}Scale`, slot.scale)
    program.setFloat(`${metadataPrefix}Opacity`, slot.opacity)
    program.setVec2(`${metadataPrefix}UvScale`, 1, 1)
    program.setVec2(`${metadataPrefix}UvOffset`, 0, 0)
  }

  private _clearAvailability(): void {
    for (const slot of Object.values(this._slots)) slot.available = false
  }
}

function pickAsset(
  assets: readonly BrandKitAssetWithMedia[],
  roles: readonly BrandAssetRole[],
): BrandKitAssetWithMedia | null {
  for (const role of roles) {
    const asset = assets
      .filter(candidate => candidate.role === role && candidate.media !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    if (asset) return asset
  }
  return null
}

function getImageDimensions(image: CanvasImageSource): { width: number; height: number } {
  const source = image as unknown as Record<string, unknown>
  const width = Number(source.naturalWidth ?? source.videoWidth ?? source.width ?? 1)
  const height = Number(source.naturalHeight ?? source.videoHeight ?? source.height ?? 1)
  return {
    width: Number.isFinite(width) && width > 0 ? width : 1,
    height: Number.isFinite(height) && height > 0 ? height : 1,
  }
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

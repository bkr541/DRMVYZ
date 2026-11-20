import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'

/** Longest side a user model's textures keep on each quality tier. High keeps them as they were saved. */
export const CINEMA2_USER_MODEL_TEXTURE_SIDE: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 1024, medium: 2048, high: Number.POSITIVE_INFINITY })

const TEXTURE_SLOTS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap', 'displacementMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'transmissionMap', 'thicknessMap', 'specularIntensityMap', 'specularColorMap', 'sheenColorMap', 'sheenRoughnessMap', 'iridescenceMap', 'iridescenceThicknessMap', 'anisotropyMap'] as const
type Slot = typeof TEXTURE_SLOTS[number]
type Drawable = { width: number; height: number }
export type Cinema2TextureCanvasFactory = (width: number, height: number) => HTMLCanvasElement | OffscreenCanvas

const defaultCanvas: Cinema2TextureCanvasFactory = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas
}

/**
 * Keeps a smaller copy of each large texture of a user model for the lower quality tiers and swaps it into the model's own (per-instance) materials.
 * The shared decoded texture is never changed, so going back to a higher tier restores the original at once. Copies are made once per texture and
 * size, halving step by step so the result stays sharp, and are released together when the model is replaced or the scene is disposed.
 */
export class Cinema2UserModelTextureTier {
  private readonly copies = new Map<ThreeNamespace.Texture, Map<number, ThreeNamespace.Texture>>()
  private readonly originals = new Map<ThreeNamespace.Texture, ThreeNamespace.Texture>()
  constructor(private readonly THREE: typeof ThreeNamespace, private readonly makeCanvas: Cinema2TextureCanvasFactory = defaultCanvas) {}

  /** Applies a tier to the materials; returns how many texture slots changed. */
  apply(materials: readonly ThreeNamespace.Material[], quality: Cinema2RenderQualityLevel): number {
    const cap = CINEMA2_USER_MODEL_TEXTURE_SIDE[quality]
    let changed = 0
    for (const material of materials) {
      const slots = material as unknown as Record<Slot, ThreeNamespace.Texture | null | undefined>
      for (const slot of TEXTURE_SLOTS) {
        const current = slots[slot]
        if (!current) continue
        const original = this.originals.get(current) ?? current
        const next = this.tiered(original, cap)
        if (next !== current) { slots[slot] = next; changed++ }
      }
    }
    return changed
  }

  /** Disposes every smaller copy made so far. The originals belong to the model's cache and are left alone. */
  release(): void {
    for (const sizes of this.copies.values()) for (const copy of sizes.values()) copy.dispose()
    this.copies.clear(); this.originals.clear()
  }

  private tiered(original: ThreeNamespace.Texture, cap: number): ThreeNamespace.Texture {
    const image = original.image as Drawable | null
    if (!image || !(image.width > 0) || !(image.height > 0) || Math.max(image.width, image.height) <= cap) return original
    const scale = cap / Math.max(image.width, image.height)
    const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale))
    let sizes = this.copies.get(original)
    if (!sizes) { sizes = new Map(); this.copies.set(original, sizes) }
    const existing = sizes.get(cap)
    if (existing) return existing
    const copy = this.downscale(original, image, width, height)
    sizes.set(cap, copy); this.originals.set(copy, original)
    return copy
  }

  private downscale(original: ThreeNamespace.Texture, image: Drawable, width: number, height: number): ThreeNamespace.Texture {
    let source: CanvasImageSource = image as unknown as CanvasImageSource, sw = image.width, sh = image.height
    // Halve until close to the target: one big step skips pixels and aliases; many small ones keep the detail.
    while (sw / 2 >= width && sh / 2 >= height) {
      const w = Math.max(width, Math.floor(sw / 2)), h = Math.max(height, Math.floor(sh / 2))
      source = this.draw(source, sw, sh, w, h); sw = w; sh = h
    }
    const target = this.draw(source, sw, sh, width, height)
    const { THREE } = this, copy = new THREE.Texture(target as unknown as HTMLCanvasElement)
    copy.name = original.name; copy.colorSpace = original.colorSpace; copy.wrapS = original.wrapS; copy.wrapT = original.wrapT
    copy.repeat.copy(original.repeat); copy.offset.copy(original.offset); copy.center.copy(original.center); copy.rotation = original.rotation
    copy.matrixAutoUpdate = original.matrixAutoUpdate; copy.flipY = original.flipY; copy.channel = original.channel; copy.anisotropy = original.anisotropy
    copy.magFilter = original.magFilter; copy.minFilter = original.minFilter; copy.generateMipmaps = original.generateMipmaps; copy.premultiplyAlpha = original.premultiplyAlpha
    copy.needsUpdate = true
    return copy
  }

  private draw(source: CanvasImageSource, sw: number, sh: number, width: number, height: number): CanvasImageSource {
    const canvas = this.makeCanvas(width, height)
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!context) throw new Error('A smaller texture could not be drawn.')
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, sw, sh, 0, 0, width, height)
    return canvas as unknown as CanvasImageSource
  }
}

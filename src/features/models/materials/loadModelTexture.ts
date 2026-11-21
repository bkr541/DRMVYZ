import { ImageLoader, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { MODEL_TEXTURES, isModelTextureId, modelTextureUrl, type ModelTextureId } from '../domain/modelTextures'

const TEXTURE_NAME_PREFIX = 'DRMVYZ starter texture: '

export function savedModelTextureLabel(texture: Texture | null): string | undefined {
  if (!texture?.name.startsWith(TEXTURE_NAME_PREFIX)) return
  const id = texture.name.slice(TEXTURE_NAME_PREFIX.length)
  if (isModelTextureId(id)) return MODEL_TEXTURES[id]
}

export async function loadModelTexture(id: ModelTextureId): Promise<Texture> {
  let image: HTMLImageElement
  try {
    image = await new ImageLoader().loadAsync(modelTextureUrl(id))
  } catch {
    throw new Error(`The ${MODEL_TEXTURES[id]} texture could not be loaded.`)
  }
  const texture = new Texture(image)
  texture.name = `${TEXTURE_NAME_PREFIX}${id}`
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

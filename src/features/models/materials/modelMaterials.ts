import { Mesh, MeshPhysicalMaterial, type Group, type Texture } from 'three'
import type { ModelGeneratorRecipe } from '../domain/modelAssetTypes'
import type { ModelTextureId } from '../domain/modelTextures'
import { checkAbort } from '../geometry/modelQualityBudget'
import { loadModelTexture } from './loadModelTexture'
export const MODEL_MATERIAL_PRESETS = {
  Chrome: { color: '#d7dce5', metalness: 1, roughness: 0.1, opacity: 1, emissive: '#000000' },
  'Black Chrome': { color: '#15171c', metalness: 1, roughness: 0.18, opacity: 1, emissive: '#000000' },
  Gold: { color: '#e7b64c', metalness: 1, roughness: 0.2, opacity: 1, emissive: '#000000' },
  Holographic: { color: '#64dfff', metalness: 0.6, roughness: 0.15, opacity: 0.55, emissive: '#133848' },
  Gloss: { color: '#eeeeee', metalness: 0, roughness: 0.1, opacity: 1, emissive: '#000000' },
  Matte: { color: '#bcbcbc', metalness: 0, roughness: 0.9, opacity: 1, emissive: '#000000' },
  Clay: { color: '#bb7964', metalness: 0, roughness: 1, opacity: 1, emissive: '#000000' },
} satisfies Record<string, Omit<ModelGeneratorRecipe['materials'][number], 'region'>>
function materialRegions(recipe: ModelGeneratorRecipe) {
  const front = recipe.materials.find(m => m.region === 'front') ?? recipe.materials[0]
  const side = recipe.materials.find(m => m.region === 'side') ?? front
  return { front, side }
}

export function createModelMaterials(recipe: ModelGeneratorRecipe): [MeshPhysicalMaterial, MeshPhysicalMaterial] {
  const { front, side } = materialRegions(recipe)
  return [front, side].map(region => {
    const material = new MeshPhysicalMaterial({ color: region.color, metalness: region.metalness, roughness: region.roughness,
      opacity: region.opacity, transparent: region.opacity < 1, emissive: region.emissive, emissiveIntensity: region.emissiveIntensity ?? 1, clearcoat: region.clearcoat ?? 0, clearcoatRoughness: region.clearcoatRoughness ?? 0.1 })
    material.name = region.region
    return material
  }) as [MeshPhysicalMaterial, MeshPhysicalMaterial]
}

/** Both generated material regions use the extrusion's existing UVs. The model owns any attached textures. */
export async function applyModelMaterialTextures(group: Group, recipe: ModelGeneratorRecipe, signal?: AbortSignal) {
  const { front, side } = materialRegions(recipe)
  const textureIds = new Set([front.textureId, side.textureId].filter((id): id is ModelTextureId => id !== undefined))
  if (!textureIds.size) return
  const textures = new Map<ModelTextureId, Texture>()
  const results = await Promise.allSettled([...textureIds].map(async id => {
    textures.set(id, await loadModelTexture(id))
  }))
  try {
    checkAbort(signal)
    for (const result of results) if (result.status === 'rejected') throw result.reason
    group.traverse(object => {
      if (!(object instanceof Mesh) || !Array.isArray(object.material)) return
      for (const [index, material] of object.material.entries()) {
        const id = index === 0 ? front.textureId : side.textureId
        const texture = id && textures.get(id)
        if (!(material instanceof MeshPhysicalMaterial) || !texture || material.map === texture) continue
        material.map = texture
        material.needsUpdate = true
      }
    })
  } catch (error) {
    textures.forEach(texture => texture.dispose())
    throw error
  }
}

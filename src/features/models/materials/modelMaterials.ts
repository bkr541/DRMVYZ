import { MeshPhysicalMaterial } from 'three'
import type { ModelGeneratorRecipe } from '../domain/modelAssetTypes'
export const MODEL_MATERIAL_PRESETS = {
  Chrome: { color: '#d7dce5', metalness: 1, roughness: 0.1, opacity: 1, emissive: '#000000' },
  'Black Chrome': { color: '#15171c', metalness: 1, roughness: 0.18, opacity: 1, emissive: '#000000' },
  Gold: { color: '#e7b64c', metalness: 1, roughness: 0.2, opacity: 1, emissive: '#000000' },
  Holographic: { color: '#64dfff', metalness: 0.6, roughness: 0.15, opacity: 0.55, emissive: '#133848' },
  Gloss: { color: '#eeeeee', metalness: 0, roughness: 0.1, opacity: 1, emissive: '#000000' },
  Matte: { color: '#bcbcbc', metalness: 0, roughness: 0.9, opacity: 1, emissive: '#000000' },
  Clay: { color: '#bb7964', metalness: 0, roughness: 1, opacity: 1, emissive: '#000000' },
} satisfies Record<string, Omit<ModelGeneratorRecipe['materials'][number], 'region'>>
export function createModelMaterials(recipe: ModelGeneratorRecipe): [MeshPhysicalMaterial, MeshPhysicalMaterial] {
  const front = recipe.materials.find(m => m.region === 'front') ?? recipe.materials[0]
  const side = recipe.materials.find(m => m.region === 'side') ?? front
  return [front, side].map(region => {
    const material = new MeshPhysicalMaterial({ color: region.color, metalness: region.metalness, roughness: region.roughness,
      opacity: region.opacity, transparent: region.opacity < 1, emissive: region.emissive, emissiveIntensity: region.emissiveIntensity ?? 1, clearcoat: region.clearcoat ?? 0, clearcoatRoughness: region.clearcoatRoughness ?? 0.1 })
    material.name = region.region
    return material
  }) as [MeshPhysicalMaterial, MeshPhysicalMaterial]
}

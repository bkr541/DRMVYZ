import { Box3, Mesh, MeshStandardMaterial, MathUtils, type Group } from 'three'
import type { ModelGeometryStats } from '../domain/modelAssetTypes'

export type ModelRotation = [number, number, number]
export interface BuiltinMaterialValues {
  name: string
  color: string
  metalness: number
  roughness: number
}
export interface BuiltinModelEditValues {
  scale: number
  rotation: ModelRotation
  materials: BuiltinMaterialValues[]
}

export const BUILTIN_MODEL_SCALE_RANGE = { min: 0.25, max: 2 } as const

/** Operates on the editor's decoded GLB instance, preserving its hierarchy and other material properties. */
export function createBuiltinModelEdit(group: Group, stats: ModelGeometryStats) {
  const editable = new Set<MeshStandardMaterial>()
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof MeshStandardMaterial) editable.add(material)
    }
  })
  const materials = [...editable]
  const colors = materials.map(material => material.color.clone())
  const original: BuiltinModelEditValues = {
    scale: 1,
    rotation: [0, 0, 0],
    materials: materials.map((material, index) => ({
      name: material.name || `Material ${index + 1}`, color: `#${material.color.getHexString()}`,
      metalness: material.metalness, roughness: material.roughness,
    })),
  }
  function apply(values: BuiltinModelEditValues): ModelGeometryStats {
    group.scale.setScalar(values.scale)
    const [x, y, z] = values.rotation.map(MathUtils.degToRad)
    group.rotation.set(x, y, z, 'XYZ')
    materials.forEach((material, index) => {
      const { color, metalness, roughness } = values.materials[index]
      if (color === original.materials[index].color) material.color.copy(colors[index])
      else material.color.set(color)
      material.metalness = metalness
      material.roughness = roughness
    })
    const bounds = new Box3().setFromObject(group)
    return bounds.isEmpty() ? stats : { ...stats, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } }
  }
  return { original, apply }
}

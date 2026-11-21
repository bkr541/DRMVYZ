import { Box3, Float32BufferAttribute, Mesh, MeshStandardMaterial, MathUtils, Vector3, type BufferGeometry, type Group, type Texture } from 'three'
import type { ModelGeometryStats } from '../domain/modelAssetTypes'
import type { ModelTextureId } from '../domain/modelTextures'
import { savedModelTextureLabel } from '../materials/loadModelTexture'
import { applyTwoSidedOverlay, twoSidedSupport, type TwoSidedOverlay, type TwoSidedSupport } from './twoSidedModel'

export type ModelRotation = [number, number, number]
export interface BuiltinMaterialValues {
  name: string
  color: string
  metalness: number
  roughness: number
  textureId?: ModelTextureId
}
export interface BuiltinModelEditValues {
  scale: number
  rotation: ModelRotation
  materials: BuiltinMaterialValues[]
  /** Keep the front and add a matching back, so the model reads correctly from both sides as it turns. */
  twoSided: boolean
}

export const BUILTIN_MODEL_SCALE_RANGE = { min: 0.25, max: 2 } as const

/** Supply exportable UVs without changing the imported mesh's positions, normals, or topology. */
function projectTextureUvs(geometry: BufferGeometry) {
  geometry.computeBoundingBox()
  const positions = geometry.getAttribute('position')
  const bounds = geometry.boundingBox!
  const origin = bounds.getCenter(new Vector3())
  const dimensions = bounds.getSize(new Vector3()).toArray()
  const scale = Math.max(...dimensions) || 1
  const thinAxis = dimensions.indexOf(Math.min(...dimensions))
  const flat = dimensions[thinAxis] < scale * 0.05
  const uv = new Float32Array(positions.count * 2)
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) - origin.x
    const y = positions.getY(i) - origin.y
    const z = positions.getZ(i) - origin.z
    // Face-on for flat models, angled for solids so all three axis-aligned faces receive a pattern.
    const u = flat ? (thinAxis === 0 ? z : x) : (x - z) * Math.SQRT1_2
    const v = flat ? (thinAxis === 1 ? z : y) : (2 * y - x - z) / Math.sqrt(6)
    uv[i * 2] = u / scale + 0.5
    uv[i * 2 + 1] = v / scale + 0.5
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
}

/** Operates on the editor's decoded GLB instance, preserving its hierarchy and other material properties. */
export function createBuiltinModelEdit(group: Group, stats: ModelGeometryStats) {
  const twoSidedAvailable: TwoSidedSupport = twoSidedSupport(group)
  let overlay: TwoSidedOverlay | null = null
  const editable = new Set<MeshStandardMaterial>()
  const unmapped = new Map<BufferGeometry, Set<MeshStandardMaterial>>()
  group.traverse(object => {
    if (!(object instanceof Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial)) continue
      editable.add(material)
      if (object.geometry.hasAttribute('uv')) continue
      const users = unmapped.get(object.geometry) ?? new Set<MeshStandardMaterial>()
      users.add(material)
      unmapped.set(object.geometry, users)
    }
  })
  const materials = [...editable]
  const colors = materials.map(material => material.color.clone())
  const originalMaps = materials.map(material => material.map)
  const originalTextureLabels = originalMaps.map(savedModelTextureLabel)
  const original: BuiltinModelEditValues = {
    scale: 1,
    rotation: [0, 0, 0],
    twoSided: false,
    materials: materials.map((material, index) => ({
      name: material.name || `Material ${index + 1}`, color: `#${material.color.getHexString()}`,
      metalness: material.metalness, roughness: material.roughness,
    })),
  }
  function swapTexture(index: number, texture: Texture | null) {
    const material = materials[index]
    const previous = material.map
    if (previous === texture) return false
    material.map = texture
    material.needsUpdate = true
    if (previous !== originalMaps[index]) previous?.dispose()
    return true
  }

  function apply(values: BuiltinModelEditValues, replacement?: { index: number; texture: Texture }): ModelGeometryStats {
    let mapsChanged = false
    for (const [index, value] of values.materials.entries()) {
      if (replacement?.index === index) mapsChanged = swapTexture(index, replacement.texture) || mapsChanged
      else if (!value.textureId) mapsChanged = swapTexture(index, originalMaps[index]) || mapsChanged
    }
    if (mapsChanged && unmapped.size) {
      const textured = new Set(materials.filter((material, index) => material.map !== originalMaps[index]))
      for (const [geometry, users] of unmapped) {
        const needsUvs = [...users].some(material => textured.has(material))
        if (geometry.hasAttribute('uv') === needsUvs) continue
        if (overlay) { overlay.remove(); overlay = null }
        if (needsUvs) projectTextureUvs(geometry)
        else geometry.deleteAttribute('uv')
      }
    }
    if (values.twoSided && !overlay && twoSidedAvailable.ok) overlay = applyTwoSidedOverlay(group)
    else if (!values.twoSided && overlay) { overlay.remove(); overlay = null }
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
    const counted = overlay ? { triangles: overlay.triangles, vertices: overlay.vertices, meshes: overlay.meshes } : {}
    return bounds.isEmpty() ? { ...stats, ...counted } : { ...stats, ...counted, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } }
  }
  // Put the imported maps back so the model's disposer also releases maps detached during editing.
  function restoreOriginalTextures() {
    originalMaps.forEach((texture, index) => swapTexture(index, texture))
  }

  return { original, originalTextureLabels, apply, restoreOriginalTextures, twoSidedAvailable }
}

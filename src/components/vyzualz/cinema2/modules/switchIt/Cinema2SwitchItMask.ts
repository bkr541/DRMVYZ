import { cinema2ThreeAssetRegistry,CINEMA2_SWITCH_IT_MASK_ASSET_ID } from '../three/Cinema2ThreeAssetManifest'
import type * as Three from 'three'

export const SWITCH_IT_MASK_URL = `${import.meta.env.BASE_URL}${cinema2ThreeAssetRegistry.get(CINEMA2_SWITCH_IT_MASK_ASSET_ID)!.url.slice(1)}`
export const SWITCH_IT_MASK_REGISTRATION = Object.freeze({ scale: 1.22 * 1.30, width: 2.3 * 1.22 * 1.30, offsetY: .22 + (.30 - .22) * 1.22 * 1.30, eyeX: .21 * 1.22 * 1.30, eyeY: .22, eyeZ: .46 * 1.22 * 1.30, depthOffset: .28 })

/** Bake the supplied node transforms once, retaining topology, normals and UVs. */
export function buildSwitchItMaskGeometry(THREE: typeof Three, source: Three.Object3D): Array<{ geometry: Three.BufferGeometry; material: Three.MeshStandardMaterial }> {
  source.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(source)
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3())
  const scale = SWITCH_IT_MASK_REGISTRATION.width / size.x
  const registration = new THREE.Matrix4().makeTranslation(0, SWITCH_IT_MASK_REGISTRATION.offsetY, 0)
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))
  const parts: Array<{ geometry: Three.BufferGeometry; material: Three.MeshStandardMaterial }> = []
  source.traverse(object => {
    const mesh = object as Three.Mesh
    if (!mesh.isMesh) return
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!(material as Three.MeshStandardMaterial).isMeshStandardMaterial) throw new Error('Switch It mask requires a glTF standard material.')
    parts.push({ geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(registration), material: material as Three.MeshStandardMaterial })
  })
  if (!parts.length) throw new Error('Switch It mask contains no meshes.')
  return parts
}

/** Release parsed source data after its renderer-owned clones have been retired. */
export function disposeSwitchItMaskSource(source: Three.Object3D): void {
  const geometries = new Set<Three.BufferGeometry>(), materials = new Set<Three.Material>(), textures = new Set<Three.Texture>()
  source.traverse(object => {
    const mesh = object as Three.Mesh
    if (!mesh.isMesh) return
    geometries.add(mesh.geometry)
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if ((value as Three.Texture | null)?.isTexture) textures.add(value as Three.Texture)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) {
    texture.dispose()
    const image = texture.image as { close?: () => void } | undefined
    image?.close?.()
  }
}

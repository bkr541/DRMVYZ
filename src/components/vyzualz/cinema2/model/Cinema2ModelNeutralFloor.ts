import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { describeCinema2LoadedModel } from '../modules/three/Cinema2ThreeAssetMetadata'
import { measureObject, type Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
export function createCinema2ModelNeutralFloor(library: Cinema2ThreeLibrary): Cinema2ThreeLoadedAsset {
  const { THREE } = library, scene = new THREE.Group()
  scene.name = 'UserModelNeutralFloor'
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 8), new THREE.MeshStandardMaterial({ color: '#172129', roughness: 0.42, metalness: 0.15 }))
  mesh.position.y = -0.04
  scene.add(mesh)
  return { id: 'user-model-neutral-floor', scene, animations: [], triangleCount: measureObject(scene).triangles, gpuBytes: measureObject(scene).bytes, metadata: describeCinema2LoadedModel(scene, []) }
}

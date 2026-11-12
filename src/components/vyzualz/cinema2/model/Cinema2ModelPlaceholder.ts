import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { describeCinema2LoadedModel } from '../modules/three/Cinema2ThreeAssetMetadata'
import { measureObject, type Cinema2ThreeLoadedAsset } from '../modules/three/Cinema2ThreeAssetCache'
export function createCinema2ModelPlaceholder(library: Cinema2ThreeLibrary, floor = false): Cinema2ThreeLoadedAsset {
  const { THREE } = library, scene = new THREE.Group()
  scene.name = floor ? 'UserModelNeutralFloor' : 'UserModelDefault'
  const mesh = new THREE.Mesh(floor ? new THREE.BoxGeometry(8, 0.08, 8) : new THREE.TorusKnotGeometry(0.6, 0.2, 64, 12), new THREE.MeshStandardMaterial({ color: floor ? '#172129' : '#adb8c4', roughness: 0.42, metalness: 0.15 }))
  if (floor) mesh.position.y = -0.04
  scene.add(mesh)
  return { id: floor ? 'user-model-neutral-floor' : 'user-model-default', scene, animations: [], triangleCount: measureObject(scene).triangles, gpuBytes: measureObject(scene).bytes, metadata: describeCinema2LoadedModel(scene, []) }
}

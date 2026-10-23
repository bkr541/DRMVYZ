import type { Mesh, MeshStandardMaterial } from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { loadCinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { Cinema2ThreeAssetCache, type Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { cinema2ThreeAssetRegistry } from '../three/Cinema2ThreeAssetManifest'
import { chartCinema2BlockshiftLedBars } from './Cinema2BlockshiftLeds'

export const CINEMA2_BLOCKSHIFT_MODEL_IDS = ['cinema2-blockshift-hallow-cube', 'cinema2-blockshift-impossible-cube'] as const
export interface Cinema2BlockshiftMesh { vertices: Float32Array; indices: Uint16Array; ledCoordinates?: Float32Array }
export interface Cinema2BlockshiftModel {
  id: string
  body: Cinema2BlockshiftMesh
  frame: Cinema2BlockshiftMesh
}
const cache = new Cinema2ThreeAssetCache(cinema2ThreeAssetRegistry)

/** Bake authored scene transforms, then center and uniformly normalize the complete model to a unit bounding box.
 * Geometry remains the supplied GLB's triangles; dark materials map to Body and colored/emissive ones to its bank color.
 */
export function bakeCinema2BlockshiftModel(library: Cinema2ThreeLibrary, asset: Pick<Cinema2ThreeLoadedAsset, 'id' | 'scene'>): Cinema2BlockshiftModel {
  const { THREE } = library
  asset.scene.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(asset.scene)
  const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3())
  const extent = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(extent) || extent <= 0) throw new Error(`BLOCKSHIFT ${asset.id}: empty or invalid model bounds.`)
  const parts = [{ vertices: [] as number[], indices: [] as number[] }, { vertices: [] as number[], indices: [] as number[] }]
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3()
  asset.scene.traverse(object => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry, positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal')
    if (!positions || !normals || ('isSkinnedMesh' in mesh && mesh.isSkinnedMesh)) throw new Error(`BLOCKSHIFT ${asset.id}: requires static positions and normals.`)
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? positions.count, materialIndex: 0 }]
    normalMatrix.getNormalMatrix(mesh.matrixWorld)
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0] as MeshStandardMaterial
      const frame = Math.max(material.color?.r ?? 0, material.color?.g ?? 0, material.color?.b ?? 0, material.emissive?.r ?? 0, material.emissive?.g ?? 0, material.emissive?.b ?? 0) > 0.05
      const part = parts[frame ? 1 : 0]!
      const remap = new Map<number, number>()
      for (let offset = group.start; offset < group.start + group.count; offset++) {
        const source = geometry.index ? geometry.index.getX(offset) : offset
        let index = remap.get(source)
        if (index === undefined) {
          index = part.vertices.length / 6
          point.fromBufferAttribute(positions, source).applyMatrix4(mesh.matrixWorld).sub(center).divideScalar(extent)
          normal.fromBufferAttribute(normals, source).applyMatrix3(normalMatrix).normalize()
          part.vertices.push(point.x, point.y, point.z, normal.x, normal.y, normal.z)
          remap.set(source, index)
        }
        part.indices.push(index)
      }
    }
  })
  const convert = (part: typeof parts[number]): Cinema2BlockshiftMesh => {
    if (!part.indices.length || part.vertices.length / 6 > 65535 || !part.vertices.every(Number.isFinite)) throw new Error(`BLOCKSHIFT ${asset.id}: invalid material geometry.`)
    return { vertices: new Float32Array(part.vertices), indices: new Uint16Array(part.indices) }
  }
  return { id: asset.id, body: convert(parts[0]!), frame: chartCinema2BlockshiftLedBars(convert(parts[1]!)) }
}

/** Shared loader/registry/cache, with balanced asset leases even on failure or preset exit while loading. */
export async function loadCinema2BlockshiftModels(): Promise<readonly Cinema2BlockshiftModel[]> {
  const library = await loadCinema2ThreeLibrary()
  const results = await Promise.allSettled(CINEMA2_BLOCKSHIFT_MODEL_IDS.map(id => cache.acquire(library, id, 'high')))
  const held = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
  try {
    const failure = results.find(result => result.status === 'rejected')
    if (failure?.status === 'rejected') throw failure.reason
    return held.map(asset => bakeCinema2BlockshiftModel(library, asset))
  } finally {
    for (const asset of held) cache.release(asset)
  }
}

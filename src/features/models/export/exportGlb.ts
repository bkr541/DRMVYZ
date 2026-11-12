import { Box3, Mesh, MeshStandardMaterial, type Group } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MODEL_MAX_FILE_BYTES } from '../domain/modelAssetTypes'
import { disposeModelGroup } from '../geometry/createExtrudedModel'
import { checkAbort, ModelGenerationError } from '../geometry/modelQualityBudget'

/** Validate bytes through the same loader Cinema uses; parsed validation resources never escape. */
export async function validateModelGlb(bytes: ArrayBuffer): Promise<{ triangles: number; materials: number; bounds: Box3 }> {
  if (bytes.byteLength < 20 || bytes.byteLength > MODEL_MAX_FILE_BYTES) throw new ModelGenerationError('glb_invalid', 'GLB is empty or exceeds the file budget.')
  const view = new DataView(bytes)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new ModelGenerationError('glb_invalid', 'Invalid GLB header.')
  const gltf = await new GLTFLoader().parseAsync(bytes, '')
  try {
    let triangles = 0; const materials = new Set<string>()
    gltf.scene.traverse(object => {
      if (object instanceof Mesh) {
        const positions = object.geometry.attributes.position
        if (!positions || Array.from(positions.array).some(n => !Number.isFinite(n))) throw new ModelGenerationError('glb_invalid', 'GLB contains invalid mesh positions.')
        triangles += (object.geometry.index?.count ?? positions.count) / 3
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          if (!(material instanceof MeshStandardMaterial)) throw new ModelGenerationError('glb_invalid', 'GLB did not retain PBR materials.')
          materials.add(material.uuid)
        }
      }
    })
    const bounds = new Box3().setFromObject(gltf.scene)
    if (!triangles || bounds.isEmpty() || !materials.size) throw new ModelGenerationError('glb_invalid', 'GLB round-trip has no usable geometry or materials.')
    return { triangles, materials: materials.size, bounds }
  } finally { disposeModelGroup(gltf.scene) }
}
export async function exportModelGlb(group: Group, signal?: AbortSignal): Promise<Blob> {
  checkAbort(signal)
  let meshes = 0; group.traverse(object => { if (object instanceof Mesh) meshes++ })
  if (!meshes) throw new ModelGenerationError('empty_geometry', 'Cannot export an empty model.')
  const result = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true })
  if (!(result instanceof ArrayBuffer)) throw new ModelGenerationError('glb_invalid', 'Exporter returned no binary GLB.')
  checkAbort(signal)
  await validateModelGlb(result)
  checkAbort(signal)
  return new Blob([result], { type: 'model/gltf-binary' })
}

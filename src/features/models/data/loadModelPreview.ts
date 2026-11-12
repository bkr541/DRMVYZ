import { Box3, Mesh } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MODEL_MAX_FILE_BYTES, parseModelGeometryStats, type ModelAsset } from '../domain/modelAssetTypes'
import { disposeModelGroup } from '../geometry/createExtrudedModel'
import { checkAbort } from '../geometry/modelQualityBudget'
import { modelAssetRepository } from './modelAssetRepository'
export async function loadModelPreview(asset: ModelAsset, signal: AbortSignal) {
  let bytes: ArrayBuffer | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const signed = await modelAssetRepository.signedUrl(asset.id, asset.currentVersion, 'glbPath')
    checkAbort(signal)
    const response = await fetch(signed.url, { signal })
    if (response.ok) {
      if (Number(response.headers.get('content-length')) > MODEL_MAX_FILE_BYTES) throw new Error('Model exceeds the GLB size budget.')
      bytes = await response.arrayBuffer(); break
    }
    if (attempt || ![401, 403].includes(response.status)) throw new Error('The saved model could not be downloaded. Retry loading it.')
  }
  if (!bytes || bytes.byteLength < 20 || bytes.byteLength > MODEL_MAX_FILE_BYTES) throw new Error('Saved model is empty or too large.')
  const header = new DataView(bytes)
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength || header.getUint32(16, true) !== 0x4e4f534a) throw new Error('Saved model has an invalid GLB header.')
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, header.getUint32(12, true)))) as { buffers?: { uri?: string }[]; images?: { uri?: string }[] }
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some(item => item.uri)) throw new Error('External model resources are not supported.')
  checkAbort(signal)
  const loaded = await new GLTFLoader().parseAsync(bytes, '')
  try {
    checkAbort(signal)
    let triangles = 0, vertices = 0, meshes = 0
    loaded.scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      meshes++; const positions = object.geometry.attributes.position
      if (!positions || Array.from(positions.array).some(n => !Number.isFinite(n))) throw new Error('Saved model contains invalid geometry.')
      vertices += positions.count; triangles += (object.geometry.index?.count ?? positions.count) / 3
    })
    const box = new Box3().setFromObject(loaded.scene)
    const stats = parseModelGeometryStats({ triangles, vertices, meshes, bounds: { min: box.min.toArray(), max: box.max.toArray() } })
    return { group: loaded.scene, stats, dispose: () => disposeModelGroup(loaded.scene) }
  } catch (error) { disposeModelGroup(loaded.scene); throw error }
}

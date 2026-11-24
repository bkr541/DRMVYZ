import { BUILTIN_MODELS, type BuiltinModel } from '../domain/builtinModels'
import { Box3, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MODEL_MAX_FILE_BYTES, MODEL_MAX_TRIANGLES, parseModelGeometryStats, type ModelAsset } from '../domain/modelAssetTypes'
import { disposeModelGroup } from '../geometry/createExtrudedModel'
import { checkAbort } from '../geometry/modelQualityBudget'
import { modelAssetRepository } from './modelAssetRepository'
import { validateModelRuntimeGlb } from '../import/validateModelRuntimeGlb'
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
  return decodeModelPreview(bytes, signal)
}

export async function loadBuiltinModelPreview(model: BuiltinModel, signal: AbortSignal) {
  const known = BUILTIN_MODELS.find(item => item.id === model.id)
  if (!known) throw new Error('This built-in model is unavailable.')
  const response = await fetch(known.url, { signal })
  if (!response.ok) throw new Error('The wordmark could not be loaded. Select it again to retry.')
  if (Number(response.headers.get('content-length')) > MODEL_MAX_FILE_BYTES) throw new Error('Model exceeds the GLB size budget.')
  return decodeModelPreview(await response.arrayBuffer(), signal)
}

/** Decodes GLB bytes into a group the caller owns (call `dispose` to release its geometry, materials and textures). */
export async function decodeModelPreview(bytes: ArrayBuffer | null, signal: AbortSignal, checkRuntimeProfile = false) {
  if (!bytes || bytes.byteLength < 20 || bytes.byteLength > MODEL_MAX_FILE_BYTES) throw new Error('Saved model is empty or too large.')
  if (checkRuntimeProfile) validateModelRuntimeGlb(bytes, { imported: true })
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
      if (!positions || !positions.array.every(Number.isFinite)) throw new Error('Saved model contains invalid geometry.')
      vertices += positions.count; triangles += (object.geometry.index?.count ?? positions.count) / 3
    })
    const box = new Box3().setFromObject(loaded.scene)
    // Say which budget was exceeded; the stats parser below only knows the number is out of range.
    if (box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) || !box.getSize(new Vector3()).lengthSq()) throw new Error('Model bounds are empty or invalid.')
    if (triangles < 1) throw new Error('This model contains no triangles to display.')
    if (triangles > MODEL_MAX_TRIANGLES) throw new Error(`This model has ${Math.round(triangles).toLocaleString('en-US')} triangles; the limit is ${MODEL_MAX_TRIANGLES.toLocaleString('en-US')}.`)
    if (vertices > 1_000_000) throw new Error(`This model has ${vertices.toLocaleString('en-US')} vertices; the limit is 1,000,000.`)
    if (meshes > 1024) throw new Error(`This model has ${meshes.toLocaleString('en-US')} meshes; the limit is 1,024.`)
    const stats = parseModelGeometryStats({ triangles, vertices, meshes, bounds: { min: box.min.toArray(), max: box.max.toArray() } })
    return { group: loaded.scene, stats, animations: loaded.animations.length, dispose: () => disposeModelGroup(loaded.scene) }
  } catch (error) { disposeModelGroup(loaded.scene); throw error }
}

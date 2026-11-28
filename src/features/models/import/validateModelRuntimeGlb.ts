import { MODEL_MAX_FILE_BYTES, MODEL_MAX_TRIANGLES } from '../domain/modelAssetTypes'
import { assertImageBudget, scanGlbContainer } from './glbContainer'
const reject = (message: string): never => { throw new Error(message) }
/** Shared pre-decode profile for import and private Cinema model playback. */
export function validateModelRuntimeGlb(buffer: ArrayBuffer, profile: { imported?: boolean } = {}): void {
  const view = new DataView(buffer)
  if (buffer.byteLength < 20 || buffer.byteLength > MODEL_MAX_FILE_BYTES || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) reject('The saved model is not a valid bounded GLB.')
  const length = view.getUint32(12, true)
  if (length > 4 * 1024 * 1024 || length + 20 > buffer.byteLength) reject('Model metadata exceeds the runtime budget.')
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))) as {
    images?: unknown[]; textures?: unknown[]; skins?: unknown[]; animations?: unknown[]; nodes?: unknown[]; materials?: unknown[]
    accessors?: { count: number }[]; bufferViews?: { byteLength: number }[]; buffers?: { byteLength: number }[]; meshes?: { primitives: { mode?: number; indices?: number; attributes?: { POSITION?: number } }[] }[]
  }
  const rejectUris = (value: unknown): void => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (key === 'uri') reject('External or URI-based model resources are unsupported.'); rejectUris(child) } }
  rejectUris(json)
  if (json.skins?.length) reject('Models with a skeleton (skins) cannot be used in a Cinema 2.0 preset. Export the model without a rig.')
  if (profile.imported) {
    try { assertImageBudget(scanGlbContainer(buffer).images) } catch (error) { reject(error instanceof Error ? error.message : 'The model textures exceed the runtime budget.') }
    if ((json.images?.length ?? 0) > 64) reject('The model has more than 64 embedded images.')
  } else if (json.images?.length || json.textures?.length || json.animations?.length) reject('Private models must be static generated meshes without textures or skins.')
  if ((json.nodes?.length ?? 0) > 2048 || (json.materials?.length ?? 0) > 128 || (json.accessors?.length ?? 0) > 8192) reject('Model structure exceeds the runtime budget.')
  if (json.accessors?.some(a => !Number.isInteger(a.count) || a.count < 1 || a.count > 1_000_000) || json.buffers?.some(b => !Number.isInteger(b.byteLength) || b.byteLength < 1 || b.byteLength > MODEL_MAX_FILE_BYTES) || (json.bufferViews ?? []).reduce((sum, v) => sum + v.byteLength, 0) > MODEL_MAX_FILE_BYTES * 2 || json.bufferViews?.some(v => !Number.isInteger(v.byteLength) || v.byteLength < 1 || v.byteLength > MODEL_MAX_FILE_BYTES)) reject('Decoded buffers exceed the model resource budget.')
  let triangles = 0
  for (const mesh of json.meshes ?? []) for (const primitive of mesh.primitives) {
    const accessor = json.accessors?.[primitive.indices ?? primitive.attributes?.POSITION ?? -1]
    if ((primitive.mode ?? 4) !== 4 || !accessor || !Number.isInteger(accessor.count) || accessor.count < 3) return reject('Only bounded triangle meshes are supported.')
    triangles += accessor.count / 3
  }
  if (!triangles || triangles > MODEL_MAX_TRIANGLES) reject('Model exceeds the triangle budget or has no mesh.')
}
